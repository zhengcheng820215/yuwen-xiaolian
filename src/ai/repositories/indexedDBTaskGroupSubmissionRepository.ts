import type { TaskGroupSubmissionRepository } from './taskGroupSubmissionRepository.ts';
import {
  cloneTaskGroupSubmission,
  type TaskGroupSubmission,
} from '../schemas/taskGroupSubmission.schema.ts';

const DEFAULT_DB_NAME = 'yuwen_xiaolian_task_group_submissions';
const DB_VERSION = 1;
const SUBMISSION_STORE = 'taskGroupSubmissions';

export class IndexedDBTaskGroupSubmissionRepository
implements TaskGroupSubmissionRepository {
  private readonly databaseName: string;

  constructor(databaseName = DEFAULT_DB_NAME) {
    this.databaseName = databaseName;
  }

  async save(submission: TaskGroupSubmission): Promise<TaskGroupSubmission> {
    const db = await this.openDatabase();
    const transaction = db.transaction(SUBMISSION_STORE, 'readwrite');
    transaction.objectStore(SUBMISSION_STORE).put(cloneTaskGroupSubmission(submission));
    await transactionToPromise(transaction);
    db.close();
    return cloneTaskGroupSubmission(submission);
  }

  async get(submissionId: string): Promise<TaskGroupSubmission | null> {
    const db = await this.openDatabase();
    const transaction = db.transaction(SUBMISSION_STORE, 'readonly');
    const result = await requestToPromise<TaskGroupSubmission | undefined>(
      transaction.objectStore(SUBMISSION_STORE).get(submissionId),
    );
    await transactionToPromise(transaction);
    db.close();
    return result ? cloneTaskGroupSubmission(result) : null;
  }

  async getByIdempotencyKey(idempotencyKey: string): Promise<TaskGroupSubmission | null> {
    const submissions = await this.list();
    return submissions.find((item) => item.idempotencyKey === idempotencyKey) || null;
  }

  async list(planId?: string): Promise<TaskGroupSubmission[]> {
    const db = await this.openDatabase();
    const transaction = db.transaction(SUBMISSION_STORE, 'readonly');
    const result = await requestToPromise<TaskGroupSubmission[]>(
      transaction.objectStore(SUBMISSION_STORE).getAll(),
    );
    await transactionToPromise(transaction);
    db.close();
    return result
      .filter((item) => !planId || item.planId === planId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(cloneTaskGroupSubmission);
  }

  async delete(submissionId: string): Promise<void> {
    const db = await this.openDatabase();
    const transaction = db.transaction(SUBMISSION_STORE, 'readwrite');
    transaction.objectStore(SUBMISSION_STORE).delete(submissionId);
    await transactionToPromise(transaction);
    db.close();
  }

  async clear(): Promise<void> {
    const db = await this.openDatabase();
    const transaction = db.transaction(SUBMISSION_STORE, 'readwrite');
    transaction.objectStore(SUBMISSION_STORE).clear();
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
        if (!db.objectStoreNames.contains(SUBMISSION_STORE)) {
          db.createObjectStore(SUBMISSION_STORE, { keyPath: 'submissionId' });
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
        reject(new Error('Task group submission database is blocked.'));
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
