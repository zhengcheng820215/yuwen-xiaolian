import {
  isProgressiveLoadCalibrationEvent,
  isProgressiveLoadCalibrationProjection,
  isProgressiveLoadCalibrationOutboxEntry,
  isProgressiveLoadCalibrationThresholdPolicy,
  isProgressiveLoadGovernanceContext,
  type ProgressiveLoadCalibrationEvent,
  type ProgressiveLoadCalibrationEventWriteResult,
  type ProgressiveLoadCalibrationProjection,
  type ProgressiveLoadCalibrationOutboxEntry,
  type ProgressiveLoadCalibrationThresholdPolicy,
  type ProgressiveLoadGovernanceContext,
} from '../schemas/progressiveLoadStage4.schema.ts';
import type { ProgressiveLoadStage4Repository } from './progressiveLoadStage4Repository.ts';

const DATABASE_NAME = 'yuwen_xiaolian_progressive_load_stage4';
const DATABASE_VERSION = 2;
const STORES = {
  contexts: 'governance_contexts', events: 'calibration_events', outbox: 'calibration_outbox',
  projections: 'calibration_projections', policies: 'threshold_policies',
} as const;

export class IndexedDBProgressiveLoadStage4Repository implements ProgressiveLoadStage4Repository {
  async saveGovernanceContext(value: ProgressiveLoadGovernanceContext) {
    if (!isProgressiveLoadGovernanceContext(value)) throw new Error('progressive_governance_context_invalid');
    const existing = await this.getGovernanceContext(value.governanceContextId);
    if (existing && (existing.sourceResourceVersionId !== value.sourceResourceVersionId
      || existing.auditDigest !== value.auditDigest || existing.sourceDigest !== value.sourceDigest)) {
      throw new Error('progressive_governance_context_identity_conflict');
    }
    await put(STORES.contexts, value); return structuredClone(value);
  }

  async getGovernanceContext(id: string) {
    const value = await get<unknown>(STORES.contexts, id);
    return isProgressiveLoadGovernanceContext(value) ? structuredClone(value) : null;
  }

  async listGovernanceContexts() {
    return (await all<unknown>(STORES.contexts)).filter(isProgressiveLoadGovernanceContext)
      .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt))
      .map((item) => structuredClone(item));
  }

  async saveEvent(value: ProgressiveLoadCalibrationEvent): Promise<ProgressiveLoadCalibrationEventWriteResult> {
    if (!isProgressiveLoadCalibrationEvent(value)) throw new Error('progressive_calibration_event_invalid');
    const existing = await this.getEvent(value.eventId);
    if (existing) return JSON.stringify(existing) === JSON.stringify(value)
      ? { status: 'unchanged', event: existing, issues: [] }
      : { status: 'conflict', event: existing, issues: ['progressive_event_identity_conflict'] };
    await put(STORES.events, value);
    return { status: 'created', event: structuredClone(value), issues: [] };
  }

  async getEvent(id: string) {
    const value = await get<unknown>(STORES.events, id);
    return isProgressiveLoadCalibrationEvent(value) ? structuredClone(value) : null;
  }

  async listEvents() {
    return (await all<unknown>(STORES.events)).filter(isProgressiveLoadCalibrationEvent)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).map((item) => structuredClone(item));
  }

  async saveOutboxEntry(value: ProgressiveLoadCalibrationOutboxEntry) {
    if (!isProgressiveLoadCalibrationOutboxEntry(value)) throw new Error('progressive_calibration_outbox_invalid');
    await put(STORES.outbox, value); return structuredClone(value);
  }
  async getOutboxEntry(id: string) {
    const value = await get<unknown>(STORES.outbox, id);
    return isProgressiveLoadCalibrationOutboxEntry(value) ? structuredClone(value) : null;
  }
  async listDueOutboxEntries(now: string) {
    return (await all<unknown>(STORES.outbox)).filter(isProgressiveLoadCalibrationOutboxEntry)
      .filter((item) => item.status !== 'failed' && item.nextRetryAt <= now)
      .sort((a, b) => a.nextRetryAt.localeCompare(b.nextRetryAt)).map((item) => structuredClone(item));
  }
  async deleteOutboxEntry(id: string) {
    const db = await openDatabase();
    try { await requestDone(db.transaction(STORES.outbox, 'readwrite').objectStore(STORES.outbox).delete(id)); }
    finally { db.close(); }
  }

  async saveProjection(value: ProgressiveLoadCalibrationProjection) {
    if (!isProgressiveLoadCalibrationProjection(value)) throw new Error('progressive_calibration_projection_invalid');
    await put(STORES.projections, value); return structuredClone(value);
  }

  async listProjections() {
    return (await all<unknown>(STORES.projections)).filter(isProgressiveLoadCalibrationProjection)
      .sort((a, b) => a.resourceVersionId.localeCompare(b.resourceVersionId)).map((item) => structuredClone(item));
  }

  async saveThresholdPolicy(value: ProgressiveLoadCalibrationThresholdPolicy) {
    if (!isProgressiveLoadCalibrationThresholdPolicy(value)) throw new Error('progressive_threshold_policy_invalid');
    const existing = (await this.listThresholdPolicies()).find((item) => item.policyVersion === value.policyVersion);
    if (existing && JSON.stringify(existing) !== JSON.stringify(value)) throw new Error('progressive_threshold_policy_immutable');
    await put(STORES.policies, value); return structuredClone(value);
  }

  async listThresholdPolicies() {
    return (await all<unknown>(STORES.policies)).filter(isProgressiveLoadCalibrationThresholdPolicy)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).map((item) => structuredClone(item));
  }

  async clear() {
    const db = await openDatabase();
    try {
      const transaction = db.transaction(Object.values(STORES), 'readwrite');
      const done = transactionDone(transaction);
      Object.values(STORES).forEach((store) => transaction.objectStore(store).clear());
      await done;
    } finally { db.close(); }
  }
}

async function put(store: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  try { await requestDone(db.transaction(store, 'readwrite').objectStore(store).put(value)); }
  finally { db.close(); }
}
async function get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDatabase();
  try { return await requestDone<T | undefined>(db.transaction(store, 'readonly').objectStore(store).get(key)); }
  finally { db.close(); }
}
async function all<T>(store: string): Promise<T[]> {
  const db = await openDatabase();
  try { return await requestDone<T[]>(db.transaction(store, 'readonly').objectStore(store).getAll()); }
  finally { db.close(); }
}
function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => Object.values(STORES).forEach((store) => {
      if (!request.result.objectStoreNames.contains(store)) {
        const keyPath = store === STORES.contexts ? 'governanceContextId'
          : store === STORES.events ? 'eventId'
            : store === STORES.outbox ? 'outboxId'
            : store === STORES.projections ? 'projectionId' : 'policyVersion';
        request.result.createObjectStore(store, { keyPath });
      }
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Progressive load Stage 4 database is blocked.'));
  });
}
function requestDone<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted.'));
  });
}
