import {
  isExistingQuestionGovernanceBatch,
  isExistingQuestionGovernanceCase,
  type ExistingQuestionGovernanceBatch,
  type ExistingQuestionGovernanceCase,
} from '../schemas/readingOpenResponseGovernance.schema.ts';
import {
  InMemoryReadingOpenResponseGovernanceRepository,
} from './inMemoryReadingOpenResponseGovernanceRepository.ts';
import type {
  ExistingQuestionGovernanceWriteResult,
  ReadingOpenResponseGovernanceRepository,
} from './readingOpenResponseGovernanceRepository.ts';

const DATABASE_NAME = 'yuwen_xiaolian_reading_open_response_governance';
const DATABASE_VERSION = 1;
const CASE_STORE = 'governance_cases';
const BATCH_STORE = 'governance_batches';

export class IndexedDBReadingOpenResponseGovernanceRepository
implements ReadingOpenResponseGovernanceRepository {
  async saveCase(
    governanceCase: ExistingQuestionGovernanceCase,
  ): Promise<ExistingQuestionGovernanceWriteResult> {
    const current = await this.listCases();
    const memory = new InMemoryReadingOpenResponseGovernanceRepository();
    for (const item of current) await memory.saveCase(item);
    const result = await memory.saveCase(governanceCase);
    if (result.status === 'created' || result.status === 'updated') {
      await put(CASE_STORE, result.governanceCase);
    }
    return result;
  }

  async getCase(governanceCaseId: string): Promise<ExistingQuestionGovernanceCase | null> {
    const value = await get<unknown>(CASE_STORE, governanceCaseId);
    return isExistingQuestionGovernanceCase(value) ? structuredClone(value) : null;
  }

  async listCases(): Promise<ExistingQuestionGovernanceCase[]> {
    return (await getAll<unknown>(CASE_STORE))
      .filter(isExistingQuestionGovernanceCase)
      .sort((left, right) => left.priority - right.priority
        || left.createdAt.localeCompare(right.createdAt))
      .map((item) => structuredClone(item));
  }

  async saveBatch(batch: ExistingQuestionGovernanceBatch): Promise<ExistingQuestionGovernanceBatch> {
    if (!isExistingQuestionGovernanceBatch(batch)) throw new Error('Governance batch is invalid.');
    const existing = await this.getBatch(batch.batchId);
    if (existing && (
      existing.createdAt !== batch.createdAt
      || existing.policyVersion !== batch.policyVersion
      || JSON.stringify(existing.governanceCaseIds) !== JSON.stringify(batch.governanceCaseIds)
    )) {
      throw new Error(`Governance batch is immutable: ${batch.batchId}`);
    }
    await put(BATCH_STORE, batch);
    return structuredClone(batch);
  }

  async getBatch(batchId: string): Promise<ExistingQuestionGovernanceBatch | null> {
    const value = await get<unknown>(BATCH_STORE, batchId);
    return isExistingQuestionGovernanceBatch(value) ? structuredClone(value) : null;
  }

  async listBatches(): Promise<ExistingQuestionGovernanceBatch[]> {
    return (await getAll<unknown>(BATCH_STORE))
      .filter(isExistingQuestionGovernanceBatch)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((item) => structuredClone(item));
  }

  async clear(): Promise<void> {
    const database = await openDatabase();
    try {
      const transaction = database.transaction([CASE_STORE, BATCH_STORE], 'readwrite');
      const completion = transactionDone(transaction);
      transaction.objectStore(CASE_STORE).clear();
      transaction.objectStore(BATCH_STORE).clear();
      await completion;
    } finally {
      database.close();
    }
  }
}

async function put(storeName: string, value: unknown): Promise<void> {
  const database = await openDatabase();
  try {
    await requestDone(database.transaction(storeName, 'readwrite').objectStore(storeName).put(value));
  } finally {
    database.close();
  }
}

async function get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const database = await openDatabase();
  try {
    return await requestDone<T | undefined>(
      database.transaction(storeName, 'readonly').objectStore(storeName).get(key),
    );
  } finally {
    database.close();
  }
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const database = await openDatabase();
  try {
    return await requestDone<T[]>(
      database.transaction(storeName, 'readonly').objectStore(storeName).getAll(),
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
      if (!request.result.objectStoreNames.contains(CASE_STORE)) {
        request.result.createObjectStore(CASE_STORE, { keyPath: 'governanceCaseId' });
      }
      if (!request.result.objectStoreNames.contains(BATCH_STORE)) {
        request.result.createObjectStore(BATCH_STORE, { keyPath: 'batchId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Reading governance database is blocked.'));
  });
}

function requestDone<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted.'));
  });
}
