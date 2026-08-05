import type { WorkingTaskContentRepository } from './workingTaskContentRepository.ts';
import {
  cloneWorkingTaskContent,
  migrateWorkingTaskContent,
  type WorkingTaskContent,
} from '../schemas/workingTaskContent.schema.ts';

const DEFAULT_DB_NAME = 'yuwen_xiaolian_working_task_content';
const DB_VERSION = 1;
const CONTENT_STORE = 'workingTaskContents';

export class IndexedDBWorkingTaskContentRepository
implements WorkingTaskContentRepository {
  private readonly databaseName: string;

  constructor(databaseName = DEFAULT_DB_NAME) {
    this.databaseName = databaseName;
  }

  async save(content: WorkingTaskContent): Promise<WorkingTaskContent> {
    const db = await this.openDatabase();
    const transaction = db.transaction(CONTENT_STORE, 'readwrite');
    transaction.objectStore(CONTENT_STORE).put(cloneWorkingTaskContent(content));
    await transactionToPromise(transaction);
    db.close();
    return cloneWorkingTaskContent(content);
  }

  async get(trainingTaskId: string): Promise<WorkingTaskContent | null> {
    const db = await this.openDatabase();
    const transaction = db.transaction(CONTENT_STORE, 'readonly');
    const result = await requestToPromise<WorkingTaskContent | undefined>(
      transaction.objectStore(CONTENT_STORE).get(trainingTaskId),
    );
    await transactionToPromise(transaction);
    db.close();
    return result ? migrateWorkingTaskContent(result) : null;
  }

  async list(): Promise<WorkingTaskContent[]> {
    const db = await this.openDatabase();
    const transaction = db.transaction(CONTENT_STORE, 'readonly');
    const result = await requestToPromise<WorkingTaskContent[]>(
      transaction.objectStore(CONTENT_STORE).getAll(),
    );
    await transactionToPromise(transaction);
    db.close();
    return result
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .map((item) => migrateWorkingTaskContent(item));
  }

  async delete(trainingTaskId: string): Promise<void> {
    const db = await this.openDatabase();
    const transaction = db.transaction(CONTENT_STORE, 'readwrite');
    transaction.objectStore(CONTENT_STORE).delete(trainingTaskId);
    await transactionToPromise(transaction);
    db.close();
  }

  async clear(): Promise<void> {
    const db = await this.openDatabase();
    const transaction = db.transaction(CONTENT_STORE, 'readwrite');
    transaction.objectStore(CONTENT_STORE).clear();
    await transactionToPromise(transaction);
    db.close();
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is not available in this runtime.'));
    }

    return new Promise((resolve, reject) => {
      let blocked = false;
      const request = indexedDB.open(this.databaseName, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CONTENT_STORE)) {
          db.createObjectStore(CONTENT_STORE, { keyPath: 'trainingTaskId' });
        }
      };
      request.onsuccess = () => {
        if (blocked) {
          request.result.close();
          return;
        }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        blocked = true;
        reject(new Error('Working task content database is blocked.'));
      };
    });
  }
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
    transaction.onabort = () => reject(
      transaction.error || new Error('IndexedDB transaction aborted.'),
    );
    transaction.onerror = () => reject(
      transaction.error || new Error('IndexedDB transaction failed.'),
    );
  });
}
