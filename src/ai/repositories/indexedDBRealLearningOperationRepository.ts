import type { RealLearningOperationCheckpoint } from '../schemas/realLearningOperation.schema.ts';
import {
  InMemoryRealLearningOperationRepository,
  type InMemoryRealLearningOperationStore,
} from './inMemoryRealLearningOperationRepository.ts';
import type {
  RealLearningOperationRepository,
  RealLearningOperationWriteResult,
} from './realLearningOperationRepository.ts';

const DEFAULT_DATABASE_NAME = 'yuwen_xiaolian_real_learning_operations';
const DATABASE_VERSION = 1;
const STORE_NAME = 'operation_checkpoints';
const INDEXED_DB_TIMEOUT_MS = 3_000;

export class IndexedDBRealLearningOperationRepository implements RealLearningOperationRepository {
  private readonly databaseName: string;

  constructor(databaseName = DEFAULT_DATABASE_NAME) {
    this.databaseName = databaseName;
  }

  async getByOperationId(operationId: string): Promise<RealLearningOperationCheckpoint | null> {
    const database = await this.openDatabase();
    try {
      const record = await requestToPromise<RealLearningOperationCheckpoint | undefined>(
        database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(operationId),
      );
      return record || null;
    } finally {
      database.close();
    }
  }

  async listByStudent(studentId: string): Promise<RealLearningOperationCheckpoint[]> {
    const database = await this.openDatabase();
    try {
      return await requestToPromise<RealLearningOperationCheckpoint[]>(
        database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).index('studentId').getAll(studentId),
      );
    } finally { database.close(); }
  }

  async save(checkpoint: RealLearningOperationCheckpoint): Promise<RealLearningOperationWriteResult> {
    const existing = await this.getByOperationId(checkpoint.operationId);
    const store: InMemoryRealLearningOperationStore = new Map();
    if (existing) store.set(existing.operationId, existing);
    const validationRepository = new InMemoryRealLearningOperationRepository(store);
    const result = await validationRepository.save(checkpoint);
    if (result.status === 'conflict' || result.status === 'reused') return result;

    const database = await this.openDatabase();
    try {
      await requestToPromise(
        database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(result.checkpoint),
      );
      return result;
    } finally {
      database.close();
    }
  }

  async clear(): Promise<void> {
    const database = await this.openDatabase();
    try {
      await requestToPromise(
        database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear(),
      );
    } finally {
      database.close();
    }
  }

  async clearByStudent(studentId: string): Promise<void> {
    const database = await this.openDatabase();
    try {
      const records = await requestToPromise<RealLearningOperationCheckpoint[]>(
        database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).index('studentId').getAll(studentId),
      );
      const store = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
      await Promise.all(records.map((record) => requestToPromise(store.delete(record.operationId))));
    } finally {
      database.close();
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is unavailable in the current runtime.'));
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const request = indexedDB.open(this.databaseName, DATABASE_VERSION);
      const timer = setTimeout(() => {
        settled = true;
        reject(new Error('Real learning operation database open timed out.'));
      }, INDEXED_DB_TIMEOUT_MS);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'operationId' });
          store.createIndex('studentId', 'studentId', { unique: false });
          store.createIndex('learningSessionId', 'learningSessionId', { unique: false });
          store.createIndex('learningRoundId', 'learningRoundId', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
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
        reject(request.error || new Error('Real learning operation database open failed.'));
      };
      request.onblocked = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error('Real learning operation database is blocked.'));
      };
    });
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Real learning operation database request timed out.'));
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
