import {
  isReadingOpenResponseLearningProcessFact,
  type ReadingOpenResponseLearningProcessFact,
} from '../schemas/readingOpenResponseGovernance.schema.ts';
import {
  InMemoryReadingOpenResponseProcessFactRepository,
} from './inMemoryReadingOpenResponseProcessFactRepository.ts';
import type {
  ReadingOpenResponseProcessFactRepository,
  ReadingOpenResponseProcessFactWriteResult,
} from './readingOpenResponseProcessFactRepository.ts';

const DATABASE_NAME = 'yuwen_xiaolian_reading_open_response_process_facts';
const DATABASE_VERSION = 1;
const STORE_NAME = 'process_facts';

export class IndexedDBReadingOpenResponseProcessFactRepository
implements ReadingOpenResponseProcessFactRepository {
  async save(
    fact: ReadingOpenResponseLearningProcessFact,
  ): Promise<ReadingOpenResponseProcessFactWriteResult> {
    const memory = new InMemoryReadingOpenResponseProcessFactRepository();
    const existing = await this.getByAttemptId(fact.attemptId);
    if (existing) await memory.save(existing);
    const result = await memory.save(fact);
    if (result.status === 'created' || result.status === 'updated') await put(result.fact);
    return result;
  }

  async getByAttemptId(attemptId: string): Promise<ReadingOpenResponseLearningProcessFact | null> {
    const value = await read<unknown>(attemptId);
    return isReadingOpenResponseLearningProcessFact(value) ? structuredClone(value) : null;
  }

  async listByResourceVersion(
    resourceVersionId: string,
  ): Promise<ReadingOpenResponseLearningProcessFact[]> {
    return (await this.listAll()).filter((fact) => fact.resourceVersionId === resourceVersionId);
  }

  async listAll(): Promise<ReadingOpenResponseLearningProcessFact[]> {
    return (await readAll<unknown>())
      .filter(isReadingOpenResponseLearningProcessFact)
      .sort((left, right) => left.presentedAt.localeCompare(right.presentedAt))
      .map((fact) => structuredClone(fact));
  }

  async clear(): Promise<void> {
    const database = await openDatabase();
    try {
      await requestDone(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear());
    } finally {
      database.close();
    }
  }
}

async function put(fact: ReadingOpenResponseLearningProcessFact): Promise<void> {
  const database = await openDatabase();
  try {
    await requestDone(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(fact));
  } finally {
    database.close();
  }
}

async function read<T>(key: IDBValidKey): Promise<T | undefined> {
  const database = await openDatabase();
  try {
    return await requestDone<T | undefined>(
      database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key),
    );
  } finally {
    database.close();
  }
}

async function readAll<T>(): Promise<T[]> {
  const database = await openDatabase();
  try {
    return await requestDone<T[]>(
      database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll(),
    );
  } finally {
    database.close();
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'attemptId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Reading process fact database is blocked.'));
  });
}

function requestDone<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
