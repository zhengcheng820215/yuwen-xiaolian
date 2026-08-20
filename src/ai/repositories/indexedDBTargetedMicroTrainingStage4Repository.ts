import {
  createEmptyTargetedMicroTrainingStage4Snapshot,
  isTargetedMicroTrainingStage4Snapshot,
  type TargetedMicroTrainingStage4Snapshot,
} from '../schemas/targetedMicroTrainingStage4.schema.ts';
import { normalizeTargetedMicroTrainingStage4Write } from
  './inMemoryTargetedMicroTrainingStage4Repository.ts';
import type {
  TargetedMicroTrainingStage4Repository,
  TargetedMicroTrainingStage4WriteResult,
} from './targetedMicroTrainingStage4Repository.ts';

const DATABASE_NAME = 'yuwen_xiaolian_targeted_micro_training_stage4';
const DATABASE_VERSION = 1;
const STORE_NAME = 'stage4_snapshot';
const SNAPSHOT_KEY = 'current';
const TIMEOUT_MS = 3_000;

export class IndexedDBTargetedMicroTrainingStage4Repository
implements TargetedMicroTrainingStage4Repository {
  async load(): Promise<TargetedMicroTrainingStage4Snapshot> {
    const database = await openDatabase();
    try {
      const value = await requestToPromise<unknown>(
        database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(SNAPSHOT_KEY),
      );
      return isTargetedMicroTrainingStage4Snapshot(value)
        ? value
        : createEmptyTargetedMicroTrainingStage4Snapshot(new Date().toISOString());
    } finally {
      database.close();
    }
  }

  async save(
    snapshot: TargetedMicroTrainingStage4Snapshot,
    expectedRevision: number,
  ): Promise<TargetedMicroTrainingStage4WriteResult> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const completion = transactionToPromise(transaction);
      const store = transaction.objectStore(STORE_NAME);
      const raw = await requestToPromise<unknown>(store.get(SNAPSHOT_KEY));
      const current = isTargetedMicroTrainingStage4Snapshot(raw)
        ? raw
        : createEmptyTargetedMicroTrainingStage4Snapshot(new Date().toISOString());
      if (current.revision !== expectedRevision) {
        await completion;
        return { status: 'conflict', snapshot: current };
      }
      const next = normalizeTargetedMicroTrainingStage4Write(snapshot, expectedRevision);
      await requestToPromise(store.put(next, SNAPSHOT_KEY));
      await completion;
      return { status: 'committed', snapshot: next };
    } finally {
      database.close();
    }
  }

  async clear(): Promise<void> {
    const database = await openDatabase();
    try {
      await requestToPromise(
        database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(SNAPSHOT_KEY),
      );
    } finally {
      database.close();
    }
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    const timer = setTimeout(
      () => reject(new Error('Targeted Stage 4 database timed out.')),
      TIMEOUT_MS,
    );
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => { clearTimeout(timer); resolve(request.result); };
    request.onerror = () => { clearTimeout(timer); reject(request.error); };
    request.onblocked = () => {
      clearTimeout(timer);
      reject(new Error('Targeted Stage 4 database is blocked.'));
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted.'));
  });
}
