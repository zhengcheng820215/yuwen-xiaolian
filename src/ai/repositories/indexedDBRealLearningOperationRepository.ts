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

  private openDatabase(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is unavailable in the current runtime.'));
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, DATABASE_VERSION);
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
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Real learning operation database open failed.'));
    });
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
