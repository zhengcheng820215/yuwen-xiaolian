import type {
  LearningSessionQuery,
  LearningSessionRecord,
} from '../schemas/learningSessionHistory.schema.ts';
import {
  filterLearningSessions,
  type LearningSessionRepository,
} from './learningSessionRepository.ts';

const DB_NAME = 'yuwen_xiaolian_learning_sessions';
const DB_VERSION = 1;
const STORE_NAME = 'learning_session_records';
const INDEXED_DB_TIMEOUT_MS = 3_000;

export class IndexedDBLearningSessionRepository implements LearningSessionRepository {
  async save(record: LearningSessionRecord): Promise<LearningSessionRecord> {
    await this.assertRoundOwnership(record);
    const db = await openDatabase();
    try {
      await requestToPromise(
        db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record),
      );
      return record;
    } finally {
      db.close();
    }
  }

  async getById(studentId: string, sessionId: string): Promise<LearningSessionRecord | null> {
    const db = await openDatabase();
    try {
      const result = await requestToPromise<LearningSessionRecord | undefined>(
        db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(recordKey(studentId, sessionId)),
      );
      return result || null;
    } finally {
      db.close();
    }
  }

  async findByRoundId(studentId: string, learningRoundId: string): Promise<LearningSessionRecord | null> {
    const db = await openDatabase();
    try {
      const matches = await requestToPromise<LearningSessionRecord[]>(
        db
          .transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
          .index('learningRoundIds')
          .getAll(learningRoundId),
      );
      return matches.find((record) => record.studentId === studentId) || null;
    } finally {
      db.close();
    }
  }

  async query(input: LearningSessionQuery): Promise<LearningSessionRecord[]> {
    const db = await openDatabase();
    try {
      const records = await requestToPromise<LearningSessionRecord[]>(
        db
          .transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
          .index('studentId')
          .getAll(input.studentId),
      );
      return filterLearningSessions(records, input);
    } finally {
      db.close();
    }
  }

  async clear(studentId: string): Promise<void> {
    const records = await this.query({ studentId });
    const db = await openDatabase();
    try {
      const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
      await Promise.all(records.map((record) => requestToPromise(store.delete(recordKey(studentId, record.sessionId)))));
    } finally {
      db.close();
    }
  }

  private async assertRoundOwnership(candidate: LearningSessionRecord): Promise<void> {
    const db = await openDatabase();
    let records: LearningSessionRecord[];
    try {
      records = await requestToPromise<LearningSessionRecord[]>(
        db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll(),
      );
    } finally {
      db.close();
    }

    for (const record of records) {
      if (record.sessionId === candidate.sessionId && record.studentId === candidate.studentId) continue;
      const duplicate = candidate.learningRoundIds.find((roundId) => record.learningRoundIds.includes(roundId));
      if (duplicate) throw new Error(`learningRoundId already belongs to another session: ${duplicate}`);
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
      reject(new Error('Learning session database open timed out.'));
    }, INDEXED_DB_TIMEOUT_MS);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: ['studentId', 'sessionId'] });
        store.createIndex('studentId', 'studentId', { unique: false });
        store.createIndex('startedAt', 'startedAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('targetAbilityIds', 'targetAbilityIds', { unique: false, multiEntry: true });
        store.createIndex('learningRoundIds', 'learningRoundIds', { unique: false, multiEntry: true });
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
      reject(new Error('Learning session database is blocked.'));
    };
  });
}

function recordKey(studentId: string, sessionId: string): [string, string] {
  return [studentId, sessionId];
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Learning session database request timed out.'));
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
