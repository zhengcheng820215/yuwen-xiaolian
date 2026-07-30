import {
  cloneSharedFormalResourceValue,
  type SharedFormalResourceData,
  type SharedFormalResourceSnapshot,
  type SharedFormalResourceStatus,
} from '../schemas/sharedFormalResourcePersistence.schema.ts';
import { createStructuredRuntimeError } from '../errors/structuredRuntimeError.ts';

export type SharedFormalResourceEnvelope = {
  snapshot: SharedFormalResourceSnapshot;
  status: SharedFormalResourceStatus;
};

export class LocalApiFormalResourceClient {
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;

  constructor(
    endpoint = '/__runtime/phase17-4/formal-resources',
    fetcher: typeof fetch = fetch,
  ) {
    this.endpoint = endpoint;
    this.fetcher = fetcher;
  }

  async read(): Promise<SharedFormalResourceEnvelope> {
    return this.request(this.endpoint, { method: 'GET' });
  }

  async initialize(
    data: SharedFormalResourceData,
    baselineSource: string,
  ): Promise<SharedFormalResourceEnvelope> {
    return this.request(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'initialize', data, baselineSource }),
    });
  }

  async replace(
    expectedRevision: number,
    data: SharedFormalResourceData,
  ): Promise<SharedFormalResourceEnvelope> {
    return this.request(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'replace', expectedRevision, data }),
    });
  }

  async mutate<T>(
    mutation: (data: SharedFormalResourceData) => T,
  ): Promise<T> {
    const maxAttempts = 6;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const envelope = await this.read();
      if (!envelope.status.initialized) {
        throw new Error('Shared formal resource store is not initialized.');
      }
      const data = cloneSharedFormalResourceValue(envelope.snapshot.data);
      const result = mutation(data);
      try {
        await this.replace(envelope.snapshot.revision, data);
        return cloneSharedFormalResourceValue(result);
      } catch (error) {
        if (attempt === maxAttempts || !isSharedStoreRevisionConflict(error)) {
          if (isSharedStoreRevisionConflict(error)) {
            throw createStructuredRuntimeError({
              code: 'SHARED_STORE_REVISION_CONFLICT',
              message: '共享数据仍在同步，本次操作尚未完成，请稍后重试。',
              operation: 'shared_store.replace',
              recoverability: 'retry_safe',
              cause: error,
            });
          }
          throw error;
        }
        await waitForMutationRetry(attempt);
      }
    }
    throw createStructuredRuntimeError({
      code: 'SHARED_STORE_REVISION_CONFLICT',
      message: '共享数据仍在同步，本次操作尚未完成，请稍后重试。',
      operation: 'shared_store.replace',
      recoverability: 'retry_safe',
    });
  }

  private async request(url: string, init: RequestInit): Promise<SharedFormalResourceEnvelope> {
    let response: Response;
    try {
      const fetcher = this.fetcher;
      response = await fetcher(url, init);
    } catch {
      throw new Error('共享资源服务不可用，正式写入已阻断。');
    }
    const payload = await response.json().catch(() => ({})) as {
      error?: string;
      code?: string;
      expectedRevision?: number;
      actualRevision?: number;
      snapshot?: SharedFormalResourceSnapshot;
      status?: SharedFormalResourceStatus;
    };
    if (!response.ok || !payload.snapshot || !payload.status) {
      if (response.status === 409 && payload.code === 'SHARED_RESOURCE_REVISION_CONFLICT') {
        throw new SharedStoreRevisionConflictError(
          payload.expectedRevision,
          payload.actualRevision,
        );
      }
      throw new Error(payload.error || `Shared resource request failed (${response.status}).`);
    }
    return {
      snapshot: cloneSharedFormalResourceValue(payload.snapshot),
      status: cloneSharedFormalResourceValue(payload.status),
    };
  }
}

function isSharedStoreRevisionConflict(error: unknown): boolean {
  return error instanceof SharedStoreRevisionConflictError ||
    (
      error instanceof Error &&
      error.message.startsWith('Shared resource revision conflict:')
    );
}

class SharedStoreRevisionConflictError extends Error {
  constructor(expectedRevision?: number, actualRevision?: number) {
    super(
      `Shared resource revision conflict: expected ${String(expectedRevision)}, actual ${String(actualRevision)}.`,
    );
    this.name = 'SharedStoreRevisionConflictError';
  }
}

function waitForMutationRetry(attempt: number): Promise<void> {
  const exponentialDelay = Math.min(20 * (2 ** (attempt - 1)), 240);
  const jitter = Math.floor(Math.random() * 20);
  return new Promise((resolve) => {
    setTimeout(resolve, exponentialDelay + jitter);
  });
}
