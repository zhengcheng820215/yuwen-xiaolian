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

export class IndexedDBLearningSessionRepository implements LearningSessionRepository {
  async save(record: LearningSessionRecord): Promise<LearningSessionRecord> {
    await this.assertRoundOwnership(record);
    const db = await openDatabase();
    await requestToPromise(
      db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record),
    );
    db.close();
    return record;
  }

  async getById(studentId: string, sessionId: string): Promise<LearningSessionRecord | null> {
    const db = await openDatabase();
    const result = await requestToPromise<LearningSessionRecord | undefined>(
      db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(recordKey(studentId, sessionId)),
    );
    db.close();
    return result || null;
  }

  async findByRoundId(studentId: string, learningRoundId: string): Promise<LearningSessionRecord | null> {
    const db = await openDatabase();
    const matches = await requestToPromise<LearningSessionRecord[]>(
      db
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .index('learningRoundIds')
        .getAll(learningRoundId),
    );
    db.close();
    return matches.find((record) => record.studentId === studentId) || null;
  }

  async query(input: LearningSessionQuery): Promise<LearningSessionRecord[]> {
    const db = await openDatabase();
    const records = await requestToPromise<LearningSessionRecord[]>(
      db
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .index('studentId')
        .getAll(input.studentId),
    );
    db.close();
    return filterLearningSessions(records, input);
  }

  async clear(studentId: string): Promise<void> {
    const records = await this.query({ studentId });
    const db = await openDatabase();
    const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
    await Promise.all(records.map((record) => requestToPromise(store.delete(recordKey(studentId, record.sessionId)))));
    db.close();
  }

  private async assertRoundOwnership(candidate: LearningSessionRecord): Promise<void> {
    const db = await openDatabase();
    const records = await requestToPromise<LearningSessionRecord[]>(
      db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll(),
    );
    db.close();

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
    const request = indexedDB.open(DB_NAME, DB_VERSION);
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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function recordKey(studentId: string, sessionId: string): [string, string] {
  return [studentId, sessionId];
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
