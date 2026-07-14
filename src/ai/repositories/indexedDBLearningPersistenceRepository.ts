import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';
import type { LearningPersistenceRepository } from './learningPersistenceRepository.ts';

const DB_NAME = 'yuwen_xiaolian_learning_runtime';
const STORE_NAME = 'learning_persistence_records';
const DB_VERSION = 1;

export class IndexedDBLearningPersistenceRepository implements LearningPersistenceRepository {
  async save(record: LearningPersistenceRecord): Promise<LearningPersistenceRecord> {
    const db = await openDatabase();
    await requestToPromise(
      db
        .transaction(STORE_NAME, 'readwrite')
        .objectStore(STORE_NAME)
        .put(record),
    );
    db.close();
    return record;
  }

  async loadLatest(studentId: string): Promise<LearningPersistenceRecord | null> {
    const records = await this.listByStudent(studentId);
    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
  }

  async loadByRound(studentId: string, learningRoundId: string): Promise<LearningPersistenceRecord | null> {
    const db = await openDatabase();
    const record = await requestToPromise<LearningPersistenceRecord | undefined>(
      db
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .get(`${studentId}::${learningRoundId}`),
    );
    db.close();
    return record || null;
  }

  async clear(studentId: string): Promise<void> {
    const records = await this.listByStudent(studentId);
    const db = await openDatabase();
    const store = db
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME);
    await Promise.all(records.map((record) => requestToPromise(store.delete(record.recordId))));
    db.close();
  }

  async listByStudent(studentId: string): Promise<LearningPersistenceRecord[]> {
    const db = await openDatabase();
    const records = await requestToPromise<LearningPersistenceRecord[]>(
      db
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .index('studentId')
        .getAll(studentId),
    );
    db.close();
    return records;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this runtime.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'recordId' });
        store.createIndex('studentId', 'studentId', { unique: false });
        store.createIndex('learningRoundId', 'learningRoundId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
