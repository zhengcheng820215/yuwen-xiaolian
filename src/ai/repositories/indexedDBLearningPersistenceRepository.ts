import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';
import type { LearningPersistenceRepository } from './learningPersistenceRepository.ts';

const DB_NAME = 'yuwen_xiaolian_learning_runtime';
const STORE_NAME = 'learning_persistence_records';
const DB_VERSION = 1;
const INDEXED_DB_TIMEOUT_MS = 3_000;

export class IndexedDBLearningPersistenceRepository implements LearningPersistenceRepository {
  async save(record: LearningPersistenceRecord): Promise<LearningPersistenceRecord> {
    const db = await openDatabase();
    try {
      await requestToPromise(
        db
          .transaction(STORE_NAME, 'readwrite')
          .objectStore(STORE_NAME)
          .put(record),
      );
      return record;
    } finally {
      db.close();
    }
  }

  async loadLatest(studentId: string): Promise<LearningPersistenceRecord | null> {
    const records = await this.listByStudent(studentId);
    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
  }

  async loadByRound(studentId: string, learningRoundId: string): Promise<LearningPersistenceRecord | null> {
    const db = await openDatabase();
    try {
      const record = await requestToPromise<LearningPersistenceRecord | undefined>(
        db
          .transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
          .get(`${studentId}::${learningRoundId}`),
      );
      return record || null;
    } finally {
      db.close();
    }
  }

  async clear(studentId: string): Promise<void> {
    const records = await this.listByStudent(studentId);
    const db = await openDatabase();
    try {
      const store = db
        .transaction(STORE_NAME, 'readwrite')
        .objectStore(STORE_NAME);
      await Promise.all(records.map((record) => requestToPromise(store.delete(record.recordId))));
    } finally {
      db.close();
    }
  }

  async listByStudent(studentId: string): Promise<LearningPersistenceRecord[]> {
    const db = await openDatabase();
    try {
      return await requestToPromise<LearningPersistenceRecord[]>(
        db
          .transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
          .index('studentId')
          .getAll(studentId),
      );
    } finally {
      db.close();
    }
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this runtime.'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error('Learning persistence database open timed out.'));
    }, INDEXED_DB_TIMEOUT_MS);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'recordId' });
        store.createIndex('studentId', 'studentId', { unique: false });
        store.createIndex('learningRoundId', 'learningRoundId', { unique: false });
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(request.error);
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('Learning persistence database is blocked.'));
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Learning persistence database request timed out.'));
    }, INDEXED_DB_TIMEOUT_MS);
    request.onsuccess = () => {
      clearTimeout(timer);
      resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error);
    };
  });
}
