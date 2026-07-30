import {
  cloneSharedFormalResourceValue,
  type SharedFormalResourceData,
  type SharedFormalResourceSnapshot,
  type SharedFormalResourceStatus,
} from '../schemas/sharedFormalResourcePersistence.schema.ts';

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
    const maxAttempts = 3;
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
          throw error;
        }
      }
    }
    throw new Error('Shared resource mutation retry exhausted.');
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
      snapshot?: SharedFormalResourceSnapshot;
      status?: SharedFormalResourceStatus;
    };
    if (!response.ok || !payload.snapshot || !payload.status) {
      throw new Error(payload.error || `Shared resource request failed (${response.status}).`);
    }
    return {
      snapshot: cloneSharedFormalResourceValue(payload.snapshot),
      status: cloneSharedFormalResourceValue(payload.status),
    };
  }
}

function isSharedStoreRevisionConflict(error: unknown): boolean {
  return error instanceof Error &&
    error.message.startsWith('Shared resource revision conflict:');
}
