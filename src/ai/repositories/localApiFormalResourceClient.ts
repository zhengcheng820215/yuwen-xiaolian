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

export const LOCAL_FORMAL_RESOURCE_REQUEST_TIMEOUT_MS = 3_000;
export const LOCAL_FORMAL_RESOURCE_READ_CACHE_TTL_MS = 1_000;

type SharedFormalResourceReadCacheEntry = {
  expiresAt?: number;
  pending?: Promise<SharedFormalResourceEnvelope>;
  value?: SharedFormalResourceEnvelope;
};

const sharedReadCaches = new WeakMap<
  typeof fetch,
  Map<string, SharedFormalResourceReadCacheEntry>
>();

export class LocalApiFormalResourceClient {
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;
  private readonly requestTimeoutMs: number;

  constructor(
    endpoint = '/__runtime/phase17-4/formal-resources',
    fetcher: typeof fetch = fetch,
    requestTimeoutMs = LOCAL_FORMAL_RESOURCE_REQUEST_TIMEOUT_MS,
  ) {
    this.endpoint = endpoint;
    this.fetcher = fetcher;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  async read(): Promise<SharedFormalResourceEnvelope> {
    const cache = this.getReadCache();
    const cached = cache.get(this.endpoint);
    if (cached?.value && (cached.expiresAt ?? 0) > Date.now()) {
      return cached.value;
    }
    if (cached?.pending) return cached.pending;

    const pending = this.request(this.endpoint, { method: 'GET' });
    cache.set(this.endpoint, { pending });
    try {
      const envelope = await pending;
      if (cache.get(this.endpoint)?.pending === pending) {
        this.setReadCache(envelope);
      }
      return envelope;
    } catch (error) {
      if (cache.get(this.endpoint)?.pending === pending) {
        cache.delete(this.endpoint);
      }
      throw error;
    }
  }

  async initialize(
    data: SharedFormalResourceData,
    baselineSource: string,
  ): Promise<SharedFormalResourceEnvelope> {
    this.invalidateReadCache();
    const envelope = await this.request(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'initialize', data, baselineSource }),
    });
    this.setReadCache(envelope);
    return envelope;
  }

  async replace(
    expectedRevision: number,
    data: SharedFormalResourceData,
  ): Promise<SharedFormalResourceEnvelope> {
    this.invalidateReadCache();
    const envelope = await this.request(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'replace', expectedRevision, data }),
    });
    this.setReadCache(envelope);
    return envelope;
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
    if (!Number.isFinite(this.requestTimeoutMs) || this.requestTimeoutMs <= 0) {
      throw new Error('共享资源服务请求时限配置无效。');
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutTask = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('共享资源服务读取超时，请重新尝试。'));
      }, this.requestTimeoutMs);
    });
    const requestTask = (async () => {
      let response: Response;
      try {
        const fetcher = this.fetcher;
        response = await fetcher(url, { ...init, signal: controller.signal });
      } catch {
        if (controller.signal.aborted) {
          throw new Error('共享资源服务读取超时，请重新尝试。');
        }
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
    })();
    try {
      return await Promise.race([requestTask, timeoutTask]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private getReadCache(): Map<string, SharedFormalResourceReadCacheEntry> {
    const existing = sharedReadCaches.get(this.fetcher);
    if (existing) return existing;
    const cache = new Map<string, SharedFormalResourceReadCacheEntry>();
    sharedReadCaches.set(this.fetcher, cache);
    return cache;
  }

  private invalidateReadCache(): void {
    this.getReadCache().delete(this.endpoint);
  }

  private setReadCache(envelope: SharedFormalResourceEnvelope): void {
    this.getReadCache().set(this.endpoint, {
      value: envelope,
      expiresAt: Date.now() + LOCAL_FORMAL_RESOURCE_READ_CACHE_TTL_MS,
    });
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
