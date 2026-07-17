import type { FormalDiagnosisCommit } from '../schemas/diagnosisRunRecord.schema.ts';
import {
  compareFormalDiagnosisCommits,
  type FormalDiagnosisCommitWriteResult,
  type FormalDiagnosisRepository,
} from './formalDiagnosisRepository.ts';

const DEFAULT_DATABASE_NAME = 'yuwen-xiaolian-formal-diagnosis';
const DATABASE_VERSION = 1;
const STORE_NAME = 'formalDiagnosisCommits';

export class IndexedDBFormalDiagnosisRepository implements FormalDiagnosisRepository {
  private readonly databaseName: string;

  constructor(databaseName = DEFAULT_DATABASE_NAME) {
    this.databaseName = databaseName;
  }

  async commit(candidate: FormalDiagnosisCommit): Promise<FormalDiagnosisCommitWriteResult> {
    const database = await this.openDatabase();

    try {
      return await new Promise<FormalDiagnosisCommitWriteResult>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const addRequest = store.add(candidate);

        addRequest.onsuccess = () => resolve({ status: 'created', commit: candidate, issues: [] });
        addRequest.onerror = (event) => {
          if (addRequest.error?.name !== 'ConstraintError') {
            reject(addRequest.error || new Error('Formal Diagnosis commit failed.'));
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          const readTransaction = database.transaction(STORE_NAME, 'readonly');
          const readRequest = readTransaction.objectStore(STORE_NAME).get(candidate.requestId);
          readRequest.onsuccess = () => {
            const existing = readRequest.result as FormalDiagnosisCommit | undefined;
            if (!existing) {
              reject(new Error('Formal Diagnosis uniqueness conflict could not be resolved.'));
              return;
            }
            resolve(compareFormalDiagnosisCommits(existing, candidate));
          };
          readRequest.onerror = () => reject(readRequest.error || new Error('Formal Diagnosis lookup failed.'));
        };
      });
    } finally {
      database.close();
    }
  }

  async getByRequestId(requestId: string): Promise<FormalDiagnosisCommit | null> {
    const database = await this.openDatabase();
    try {
      return await new Promise<FormalDiagnosisCommit | null>((resolve, reject) => {
        const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(requestId);
        request.onsuccess = () => resolve((request.result as FormalDiagnosisCommit | undefined) || null);
        request.onerror = () => reject(request.error || new Error('Formal Diagnosis lookup failed.'));
      });
    } finally {
      database.close();
    }
  }

  async clear(): Promise<void> {
    const database = await this.openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new Error('Formal Diagnosis clear failed.'));
      });
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
          database.createObjectStore(STORE_NAME, { keyPath: 'requestId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Formal Diagnosis database open failed.'));
    });
  }
}
