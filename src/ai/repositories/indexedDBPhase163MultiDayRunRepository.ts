import type { Phase163MultiDayRunState } from '../schemas/phase163MultiDayOperation.schema.ts';
import type { Phase163MultiDayRunRepository } from './phase163MultiDayRunRepository.ts';

const DATABASE_NAME = 'yuwen_xiaolian_phase16_3_multiday';
const DATABASE_VERSION = 1;
const STORE_NAME = 'multiday_runs';

export class IndexedDBPhase163MultiDayRunRepository implements Phase163MultiDayRunRepository {
  async getByStudent(studentId: string): Promise<Phase163MultiDayRunState | null> {
    const database = await openDatabase();
    try {
      const value = await requestToPromise<Phase163MultiDayRunState | undefined>(
        database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(studentId),
      );
      return value || null;
    } finally {
      database.close();
    }
  }

  async save(state: Phase163MultiDayRunState): Promise<Phase163MultiDayRunState> {
    const database = await openDatabase();
    try {
      await requestToPromise(
        database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(state),
      );
      return state;
    } finally {
      database.close();
    }
  }

  async clear(studentId: string): Promise<void> {
    const database = await openDatabase();
    try {
      await requestToPromise(
        database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(studentId),
      );
    } finally {
      database.close();
    }
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'studentId' });
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
