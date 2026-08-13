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
  capabilities?: { atomicCollectionPatch?: string; atomicCommands?: string[] };
  commandReceipt?: {
    commandId: string;
    commandType: string;
    committedRevision: number;
  };
};

export const LOCAL_FORMAL_RESOURCE_REQUEST_TIMEOUT_MS = 3_000;
export const LOCAL_FORMAL_RESOURCE_READ_CACHE_TTL_MS = 1_000;
export const LOCAL_FORMAL_RESOURCE_MUTATION_MAX_ATTEMPTS = 8;
export const LOCAL_FORMAL_RESOURCE_MUTATION_TIMEOUT_MS = 8_000;
export const LOCAL_FORMAL_RESOURCE_MUTATION_BACKOFF_MS = [100, 200, 400, 800, 1_600, 2_000, 2_000] as const;
export const LOCAL_FORMAL_RESOURCE_MUTATION_JITTER_MAX_MS = 100;
export const FORMAL_RESOURCE_WRITE_LOCK_NAME = 'formal-resource-store-write';
export const FORMAL_RESOURCE_EVENT_CHANNEL_NAME = 'formal-resource-store-events';

type FormalResourceLockManager = {
  request<T>(
    name: string,
    options: { mode: 'exclusive'; signal?: AbortSignal },
    callback: () => Promise<T>,
  ): Promise<T>;
};

type FormalResourceBroadcastChannel = {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  close(): void;
};

export type LocalApiFormalResourceClientOptions = {
  mutationMaxAttempts?: number;
  mutationTimeoutMs?: number;
  mutationBackoffMs?: readonly number[];
  mutationJitterMaxMs?: number;
  random?: () => number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  lockManager?: FormalResourceLockManager | null;
  broadcastChannelFactory?: (() => FormalResourceBroadcastChannel) | null;
};

export type SharedFormalResourceAtomicCommandType =
  | 'apply_collection_patch'
  | 'save-plan'
  | 'save-draft'
  | 'save-validation'
  | 'save-quality-bundle'
  | 'record-review'
  | 'commit-publication'
  | 'recover-publication';

export type FormalResourceRevisionUpdatedEvent = {
  type: 'formal_resource_revision_updated';
  revision: number;
  occurredAt: string;
};

export type FormalResourceWriteRuntimeEvent = {
  state: 'lock_waiting' | 'executing' | 'conflict_retrying' | 'recovered' | 'conflict_exhausted';
  occurredAt: string;
  attempt?: number;
};

const formalResourceRevisionListeners = new Set<(event: FormalResourceRevisionUpdatedEvent) => void>();
const formalResourceWriteRuntimeListeners = new Set<(event: FormalResourceWriteRuntimeEvent) => void>();
let lastNotifiedRevision = -1;

export function subscribeFormalResourceRevisionUpdates(
  listener: (event: FormalResourceRevisionUpdatedEvent) => void,
): () => void {
  formalResourceRevisionListeners.add(listener);
  return () => formalResourceRevisionListeners.delete(listener);
}

export function subscribeFormalResourceWriteRuntime(
  listener: (event: FormalResourceWriteRuntimeEvent) => void,
): () => void {
  formalResourceWriteRuntimeListeners.add(listener);
  return () => formalResourceWriteRuntimeListeners.delete(listener);
}

type SharedFormalResourceReadCacheEntry = {
  expiresAt?: number;
  pending?: Promise<SharedFormalResourceEnvelope>;
  value?: SharedFormalResourceEnvelope;
};

const sharedReadCaches = new WeakMap<
  typeof fetch,
  Map<string, SharedFormalResourceReadCacheEntry>
>();
type SharedMutationQueue = { tail: Promise<void> };
const sharedMutationQueues = new WeakMap<typeof fetch, Map<string, SharedMutationQueue>>();

export class LocalApiFormalResourceClient {
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;
  private readonly requestTimeoutMs: number;
  private readonly options: Required<LocalApiFormalResourceClientOptions>;
  private readonly lockManager: FormalResourceLockManager | null;
  private readonly broadcastChannel: FormalResourceBroadcastChannel | null;
  private readonly onBroadcastMessage: (event: MessageEvent) => void;
  private lastReceivedRevision = -1;
  private capabilities: SharedFormalResourceEnvelope['capabilities'] | null = null;

  constructor(
    endpoint = '/__runtime/phase17-4/formal-resources',
    fetcher: typeof fetch = fetch,
    requestTimeoutMs = LOCAL_FORMAL_RESOURCE_REQUEST_TIMEOUT_MS,
    options: LocalApiFormalResourceClientOptions = {},
  ) {
    this.endpoint = endpoint;
    this.fetcher = fetcher;
    this.requestTimeoutMs = requestTimeoutMs;
    this.options = {
      mutationMaxAttempts: options.mutationMaxAttempts ?? LOCAL_FORMAL_RESOURCE_MUTATION_MAX_ATTEMPTS,
      mutationTimeoutMs: options.mutationTimeoutMs ?? LOCAL_FORMAL_RESOURCE_MUTATION_TIMEOUT_MS,
      mutationBackoffMs: options.mutationBackoffMs ?? LOCAL_FORMAL_RESOURCE_MUTATION_BACKOFF_MS,
      mutationJitterMaxMs: options.mutationJitterMaxMs ?? LOCAL_FORMAL_RESOURCE_MUTATION_JITTER_MAX_MS,
      random: options.random ?? Math.random,
      now: options.now ?? Date.now,
      sleep: options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))),
      lockManager: options.lockManager ?? null,
      broadcastChannelFactory: options.broadcastChannelFactory ?? null,
    };
    this.lockManager = options.lockManager === undefined ? getBrowserLockManager() : options.lockManager;
    const channelFactory = options.broadcastChannelFactory === undefined
      ? getBrowserBroadcastChannelFactory()
      : options.broadcastChannelFactory;
    this.broadcastChannel = channelFactory ? channelFactory() : null;
    this.onBroadcastMessage = (event) => this.handleBroadcastMessage(event.data);
    this.broadcastChannel?.addEventListener('message', this.onBroadcastMessage);
  }

  async read(options: { bypassCache?: boolean } = {}): Promise<SharedFormalResourceEnvelope> {
    const cache = this.getReadCache();
    if (options.bypassCache) {
      this.invalidateReadCache();
      const envelope = await this.request(this.endpoint, { method: 'GET' });
      this.setReadCache(envelope);
      return envelope;
    }
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
    return this.enqueueMutation(() => this.withExclusiveWriteLock(
      () => this.initializeUnlocked(data, baselineSource),
    ));
  }

  private async initializeUnlocked(
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
    this.broadcastRevision(envelope.snapshot.revision);
    return envelope;
  }

  async replace(
    expectedRevision: number,
    data: SharedFormalResourceData,
  ): Promise<SharedFormalResourceEnvelope> {
    return this.enqueueMutation(() => this.withExclusiveWriteLock(
      () => this.replaceUnlocked(expectedRevision, data),
    ));
  }

  private async replaceUnlocked(
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
    this.broadcastRevision(envelope.snapshot.revision);
    return envelope;
  }

  async mutate<T>(
    mutation: (data: SharedFormalResourceData) => T,
    commandType: SharedFormalResourceAtomicCommandType = 'apply_collection_patch',
  ): Promise<T> {
    return this.enqueueMutation(() => this.withExclusiveWriteLock(
      () => this.mutateWithRetry(mutation, commandType),
    ));
  }

  private async mutateWithRetry<T>(
    mutation: (data: SharedFormalResourceData) => T,
    commandType: SharedFormalResourceAtomicCommandType,
  ): Promise<T> {
    const startedAt = this.options.now();
    const maxAttempts = this.options.mutationMaxAttempts;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (attempt > 1 && this.options.now() - startedAt >= this.options.mutationTimeoutMs) {
        throw this.createConflictExhaustedError();
      }
      const envelope = await this.read({ bypassCache: true });
      if (!envelope.status.initialized) {
        throw new Error('Shared formal resource store is not initialized.');
      }
      const data = cloneSharedFormalResourceValue(envelope.snapshot.data);
      const result = mutation(data);
      try {
        const patches = buildCollectionPatches(envelope.snapshot.data, data);
        if (patches.length === 0) return result === undefined ? result : cloneSharedFormalResourceValue(result);
        if (this.supportsAtomicCollectionPatch(envelope)) {
          await this.applyCollectionPatchUnlocked(envelope.snapshot.revision, patches, commandType);
        } else {
          await this.replaceUnlocked(envelope.snapshot.revision, data);
        }
        if (attempt > 1) this.emitWriteRuntime({ state: 'recovered', attempt });
        return result === undefined ? result : cloneSharedFormalResourceValue(result);
      } catch (error) {
        if (!isSharedStoreRevisionConflict(error)) throw error;
        if (attempt === maxAttempts) throw this.createConflictExhaustedError(error);

        this.emitWriteRuntime({ state: 'conflict_retrying', attempt });
        this.invalidateReadCache();
        const delayIndex = Math.min(attempt - 1, this.options.mutationBackoffMs.length - 1);
        const baseDelay = this.options.mutationBackoffMs[delayIndex] ?? 0;
        const jitter = Math.floor(this.options.random() * (this.options.mutationJitterMaxMs + 1));
        const remaining = this.options.mutationTimeoutMs - (this.options.now() - startedAt);
        if (remaining <= 0) throw this.createConflictExhaustedError(error);
        await this.options.sleep(Math.min(baseDelay + jitter, remaining));
      }
    }
    throw this.createConflictExhaustedError();
  }

  private createConflictExhaustedError(cause?: unknown): Error {
    this.emitWriteRuntime({ state: 'conflict_exhausted' });
    return createStructuredRuntimeError({
      code: 'SHARED_STORE_REVISION_CONFLICT',
      message: '共享数据仍在同步，本次操作尚未完成，请稍后重试。',
      operation: 'shared_store.replace',
      recoverability: 'retry_safe',
      cause,
    });
  }

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const queues = getSharedMutationQueues(this.fetcher);
    const queue = queues.get(this.endpoint) || { tail: Promise.resolve() };
    queues.set(this.endpoint, queue);
    const execution = queue.tail.then(operation, operation);
    queue.tail = execution.then(() => undefined, () => undefined);
    return execution;
  }

  private async withExclusiveWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.lockManager) return operation();
    const controller = new AbortController();
    const abort = () => controller.abort();
    const browserWindow = typeof window === 'undefined' ? null : window;
    browserWindow?.addEventListener('pagehide', abort, { once: true });
    try {
      this.emitWriteRuntime({ state: 'lock_waiting' });
      return await this.lockManager.request(
        FORMAL_RESOURCE_WRITE_LOCK_NAME,
        { mode: 'exclusive', signal: controller.signal },
        async () => {
          this.emitWriteRuntime({ state: 'executing' });
          return operation();
        },
      );
    } finally {
      browserWindow?.removeEventListener('pagehide', abort);
    }
  }

  private broadcastRevision(revision: number): void {
    this.broadcastChannel?.postMessage({
      type: 'formal_resource_revision_updated',
      revision,
      occurredAt: new Date().toISOString(),
    } satisfies FormalResourceRevisionUpdatedEvent);
  }

  private handleBroadcastMessage(message: unknown): void {
    if (!isFormalResourceRevisionUpdatedEvent(message)) return;
    const cachedRevision = this.getReadCache().get(this.endpoint)?.value?.snapshot.revision ?? -1;
    if (message.revision <= Math.max(cachedRevision, this.lastReceivedRevision)) return;
    this.lastReceivedRevision = message.revision;
    this.invalidateReadCache();
    if (message.revision <= lastNotifiedRevision) return;
    lastNotifiedRevision = message.revision;
    formalResourceRevisionListeners.forEach((listener) => listener(message));
  }

  private emitWriteRuntime(event: Omit<FormalResourceWriteRuntimeEvent, 'occurredAt'>): void {
    const completed = { ...event, occurredAt: new Date().toISOString() };
    formalResourceWriteRuntimeListeners.forEach((listener) => listener(completed));
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
        capabilities?: { atomicCollectionPatch?: string; atomicCommands?: string[] };
        commandReceipt?: SharedFormalResourceEnvelope['commandReceipt'];
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
      const envelope = {
        snapshot: cloneSharedFormalResourceValue(payload.snapshot),
        status: cloneSharedFormalResourceValue(payload.status),
        capabilities: payload.capabilities,
        commandReceipt: payload.commandReceipt,
      };
      if (payload.capabilities) this.capabilities = payload.capabilities;
      return envelope;
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

  private supportsAtomicCollectionPatch(envelope: SharedFormalResourceEnvelope): boolean {
    return Boolean(
      envelope.capabilities?.atomicCollectionPatch
      || this.capabilities?.atomicCollectionPatch,
    );
  }

  private async applyCollectionPatchUnlocked(
    expectedRevision: number,
    patches: ReturnType<typeof buildCollectionPatches>,
    commandType: SharedFormalResourceAtomicCommandType,
  ): Promise<SharedFormalResourceEnvelope> {
    this.invalidateReadCache();
    const commandId = createCollectionPatchCommandId(expectedRevision, patches, commandType);
    const envelope = await this.request(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'command',
        expectedRevision,
        command: { commandType, commandId, patches },
      }),
    });
    if (envelope.commandReceipt?.commandId !== commandId) {
      throw new Error('Shared formal resource command receipt mismatch.');
    }
    this.setReadCache(envelope);
    this.broadcastRevision(envelope.snapshot.revision);
    return envelope;
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

function getSharedMutationQueues(fetcher: typeof fetch): Map<string, SharedMutationQueue> {
  const existing = sharedMutationQueues.get(fetcher);
  if (existing) return existing;
  const queues = new Map<string, SharedMutationQueue>();
  sharedMutationQueues.set(fetcher, queues);
  return queues;
}

function getBrowserLockManager(): FormalResourceLockManager | null {
  if (typeof navigator === 'undefined' || !navigator.locks) return null;
  return navigator.locks as FormalResourceLockManager;
}

function getBrowserBroadcastChannelFactory(): (() => FormalResourceBroadcastChannel) | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  return () => new BroadcastChannel(FORMAL_RESOURCE_EVENT_CHANNEL_NAME);
}

type CollectionPatch = {
  scope: 'questionResources' | 'materialObservations' | 'questionQuality';
  collection: string;
  values: unknown[];
};

function buildCollectionPatches(
  before: SharedFormalResourceData,
  after: SharedFormalResourceData,
): CollectionPatch[] {
  const patches: CollectionPatch[] = [];
  for (const scope of ['questionResources', 'materialObservations', 'questionQuality'] as const) {
    const beforeScope = before[scope] as unknown as Record<string, unknown[]>;
    const afterScope = after[scope] as unknown as Record<string, unknown[]>;
    for (const collection of Object.keys(afterScope)) {
      if (JSON.stringify(beforeScope[collection]) === JSON.stringify(afterScope[collection])) continue;
      patches.push({
        scope,
        collection,
        values: cloneSharedFormalResourceValue(afterScope[collection]),
      });
    }
  }
  return patches;
}

function createCollectionPatchCommandId(
  expectedRevision: number,
  patches: CollectionPatch[],
  commandType: SharedFormalResourceAtomicCommandType,
): string {
  const identity = patches
    .map((patch) => `${patch.scope}.${patch.collection}:${JSON.stringify(patch.values)}`)
    .join('|');
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${commandType}:r${expectedRevision}:${(hash >>> 0).toString(16)}`;
}

function isFormalResourceRevisionUpdatedEvent(
  value: unknown,
): value is FormalResourceRevisionUpdatedEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FormalResourceRevisionUpdatedEvent>;
  if (
    candidate.type !== 'formal_resource_revision_updated'
    || !Number.isInteger(candidate.revision)
    || (candidate.revision ?? -1) < 0
    || typeof candidate.occurredAt !== 'string'
    || !Number.isFinite(Date.parse(candidate.occurredAt))
  ) return false;
  return true;
}
