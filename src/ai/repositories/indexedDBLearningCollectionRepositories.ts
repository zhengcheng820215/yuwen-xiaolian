import type { LearningObservationEvent } from '../schemas/learningObservationEvent.schema.ts';
import type { LearningObservationOutboxEntry } from '../schemas/learningObservationOutbox.schema.ts';
import type { QuestionCalibrationProjectionRecord } from '../schemas/questionCalibrationProjection.schema.ts';
import {
  InMemoryLearningObservationOutboxRepository,
  InMemoryLearningObservationRepository,
  InMemoryQuestionCalibrationProjectionRepository,
} from './inMemoryLearningCollectionRepositories.ts';
import type { LearningObservationRepository, LearningObservationWriteResult } from './learningObservationRepository.ts';
import type { LearningObservationOutboxRepository, LearningObservationOutboxWriteResult } from './learningObservationOutboxRepository.ts';
import type { QuestionCalibrationProjectionRepository, QuestionCalibrationProjectionWriteResult } from './questionCalibrationProjectionRepository.ts';

export const LEARNING_COLLECTION_DATABASE_NAME = 'yuwen_xiaolian_learning_collection';
export const LEARNING_COLLECTION_DATABASE_VERSION = 3;
export const LEARNING_OBSERVATION_EVENT_STORE = 'learningObservationEvents';
export const LEARNING_OBSERVATION_OUTBOX_STORE = 'learningObservationOutbox';
export const QUESTION_CALIBRATION_PROJECTION_STORE = 'questionCalibrationProjections';

const INDEXED_DB_TIMEOUT_MS = 3_000;

export class IndexedDBLearningObservationRepository implements LearningObservationRepository {
  private readonly databaseName: string;

  constructor(databaseName = LEARNING_COLLECTION_DATABASE_NAME) {
    this.databaseName = databaseName;
  }

  async save(event: LearningObservationEvent): Promise<LearningObservationWriteResult> {
    const existing = await this.getById(event.eventId);
    const validator = new InMemoryLearningObservationRepository();
    if (existing) await validator.save(existing);
    const result = await validator.save(event);
    if (result.status !== 'created') return result;
    const database = await openLearningCollectionDatabase(this.databaseName);
    try {
      await requestToPromise(database.transaction(LEARNING_OBSERVATION_EVENT_STORE, 'readwrite')
        .objectStore(LEARNING_OBSERVATION_EVENT_STORE).add(result.event));
      return result;
    } finally { database.close(); }
  }

  async getById(eventId: string): Promise<LearningObservationEvent | undefined> {
    return getOne<LearningObservationEvent>(this.databaseName, LEARNING_OBSERVATION_EVENT_STORE, eventId);
  }

  async listByStudent(studentId: string): Promise<LearningObservationEvent[]> {
    const records = await getAllByIndex<LearningObservationEvent>(
      this.databaseName, LEARNING_OBSERVATION_EVENT_STORE, 'studentId', studentId,
    );
    return records.sort(byOccurredAt);
  }

  async listAll(): Promise<LearningObservationEvent[]> {
    return (await getAll<LearningObservationEvent>(this.databaseName, LEARNING_OBSERVATION_EVENT_STORE)).sort(byOccurredAt);
  }

  async listByRound(studentId: string, learningRoundId: string): Promise<LearningObservationEvent[]> {
    const records = await getAllByIndex<LearningObservationEvent>(
      this.databaseName, LEARNING_OBSERVATION_EVENT_STORE, 'studentRound', [studentId, learningRoundId],
    );
    return records.sort(byOccurredAt);
  }

  async listByResourceVersion(resourceVersionId: string): Promise<LearningObservationEvent[]> {
    const records = await getAllByIndex<LearningObservationEvent>(
      this.databaseName, LEARNING_OBSERVATION_EVENT_STORE, 'resourceVersionId', resourceVersionId,
    );
    return records.sort(byOccurredAt);
  }

  async clear(): Promise<void> { await clearStore(this.databaseName, LEARNING_OBSERVATION_EVENT_STORE); }
}

export class IndexedDBLearningObservationOutboxRepository implements LearningObservationOutboxRepository {
  private readonly databaseName: string;

  constructor(databaseName = LEARNING_COLLECTION_DATABASE_NAME) {
    this.databaseName = databaseName;
  }

  async save(entry: LearningObservationOutboxEntry): Promise<LearningObservationOutboxWriteResult> {
    const existing = await this.getById(entry.outboxId);
    const validator = new InMemoryLearningObservationOutboxRepository();
    if (existing) await validator.save(existing);
    const result = await validator.save(entry);
    if (result.status === 'conflict' || result.status === 'unchanged') return result;
    await putOne(this.databaseName, LEARNING_OBSERVATION_OUTBOX_STORE, result.entry);
    return result;
  }

  async getById(outboxId: string): Promise<LearningObservationOutboxEntry | undefined> {
    return getOne<LearningObservationOutboxEntry>(this.databaseName, LEARNING_OBSERVATION_OUTBOX_STORE, outboxId);
  }

  async listDue(now: string): Promise<LearningObservationOutboxEntry[]> {
    const database = await openLearningCollectionDatabase(this.databaseName);
    try {
      const range = IDBKeyRange.upperBound(now);
      const records = await requestToPromise<LearningObservationOutboxEntry[]>(
        database.transaction(LEARNING_OBSERVATION_OUTBOX_STORE, 'readonly')
          .objectStore(LEARNING_OBSERVATION_OUTBOX_STORE).index('nextRetryAt').getAll(range),
      );
      return records
        .filter((entry) => entry.status !== 'failed')
        .sort((left, right) => left.nextRetryAt.localeCompare(right.nextRetryAt));
    } finally { database.close(); }
  }

  async delete(outboxId: string): Promise<void> {
    const database = await openLearningCollectionDatabase(this.databaseName);
    try {
      await requestToPromise(database.transaction(LEARNING_OBSERVATION_OUTBOX_STORE, 'readwrite')
        .objectStore(LEARNING_OBSERVATION_OUTBOX_STORE).delete(outboxId));
    } finally { database.close(); }
  }

  async clear(): Promise<void> { await clearStore(this.databaseName, LEARNING_OBSERVATION_OUTBOX_STORE); }
}

export class IndexedDBQuestionCalibrationProjectionRepository implements QuestionCalibrationProjectionRepository {
  private readonly databaseName: string;

  constructor(databaseName = LEARNING_COLLECTION_DATABASE_NAME) {
    this.databaseName = databaseName;
  }

  async save(record: QuestionCalibrationProjectionRecord): Promise<QuestionCalibrationProjectionWriteResult> {
    const [existingById, existingByAttempt] = await Promise.all([
      getOne<QuestionCalibrationProjectionRecord>(this.databaseName, QUESTION_CALIBRATION_PROJECTION_STORE, record.projectionId),
      getOneByIndex<QuestionCalibrationProjectionRecord>(
        this.databaseName, QUESTION_CALIBRATION_PROJECTION_STORE, 'attemptId', record.attemptId,
      ),
    ]);
    const validator = new InMemoryQuestionCalibrationProjectionRepository();
    if (existingById) await validator.save(existingById);
    if (existingByAttempt && existingByAttempt.projectionId !== existingById?.projectionId) {
      await validator.save(existingByAttempt);
    }
    const result = await validator.save(record);
    if (result.status === 'conflict' || result.status === 'unchanged') return result;
    const database = await openLearningCollectionDatabase(this.databaseName);
    try {
      await requestToPromise(database.transaction(QUESTION_CALIBRATION_PROJECTION_STORE, 'readwrite')
        .objectStore(QUESTION_CALIBRATION_PROJECTION_STORE).put(result.record));
      return result;
    } finally { database.close(); }
  }

  async getByAttemptId(attemptId: string): Promise<QuestionCalibrationProjectionRecord | undefined> {
    return getOneByIndex<QuestionCalibrationProjectionRecord>(
      this.databaseName, QUESTION_CALIBRATION_PROJECTION_STORE, 'attemptId', attemptId,
    );
  }

  async listByStudent(studentId: string): Promise<QuestionCalibrationProjectionRecord[]> {
    const records = await getAllByIndex<QuestionCalibrationProjectionRecord>(
      this.databaseName, QUESTION_CALIBRATION_PROJECTION_STORE, 'studentId', studentId,
    );
    return records.sort((left, right) => left.projectedAt.localeCompare(right.projectedAt));
  }

  async listAll(): Promise<QuestionCalibrationProjectionRecord[]> {
    return (await getAll<QuestionCalibrationProjectionRecord>(this.databaseName, QUESTION_CALIBRATION_PROJECTION_STORE))
      .sort((left, right) => left.projectedAt.localeCompare(right.projectedAt));
  }

  async listByRound(studentId: string, learningRoundId: string): Promise<QuestionCalibrationProjectionRecord[]> {
    const records = await getAllByIndex<QuestionCalibrationProjectionRecord>(
      this.databaseName, QUESTION_CALIBRATION_PROJECTION_STORE, 'studentRound', [studentId, learningRoundId],
    );
    return records.sort((left, right) => left.projectedAt.localeCompare(right.projectedAt));
  }

  async listEligibleByResourceVersion(resourceVersionId: string): Promise<QuestionCalibrationProjectionRecord[]> {
    const records = await getAllByIndex<QuestionCalibrationProjectionRecord>(
      this.databaseName, QUESTION_CALIBRATION_PROJECTION_STORE, 'resourceVersionStatus', [resourceVersionId, 'eligible'],
    );
    return records.sort((left, right) => left.projectedAt.localeCompare(right.projectedAt));
  }

  async clear(): Promise<void> { await clearStore(this.databaseName, QUESTION_CALIBRATION_PROJECTION_STORE); }
}

export function openLearningCollectionDatabase(
  databaseName = LEARNING_COLLECTION_DATABASE_NAME,
): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable.'));
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(databaseName, LEARNING_COLLECTION_DATABASE_VERSION);
    const timer = setTimeout(() => finishReject(new Error('Learning collection database open timed out.')), INDEXED_DB_TIMEOUT_MS);
    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    request.onupgradeneeded = () => upgradeDatabase(request.result, request.transaction);
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      settled = true;
      clearTimeout(timer);
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => finishReject(request.error || new Error('Learning collection database open failed.'));
    request.onblocked = () => finishReject(new Error('Learning collection database upgrade is blocked.'));
  });
}

function upgradeDatabase(database: IDBDatabase, transaction: IDBTransaction | null): void {
  const eventStore = ensureStore(database, transaction, LEARNING_OBSERVATION_EVENT_STORE, 'eventId');
  ensureIndex(eventStore, 'studentRound', ['studentId', 'learningRoundId']);
  ensureIndex(eventStore, 'resourceVersionId', 'resourceVersionId');
  ensureIndex(eventStore, 'eventType', 'eventType');
  ensureIndex(eventStore, 'studentId', 'studentId');

  const outboxStore = ensureStore(database, transaction, LEARNING_OBSERVATION_OUTBOX_STORE, 'outboxId');
  ensureIndex(outboxStore, 'eventId', 'eventId', true);
  ensureIndex(outboxStore, 'learningRoundId', 'learningRoundId');
  ensureIndex(outboxStore, 'nextRetryAt', 'nextRetryAt');
  ensureIndex(outboxStore, 'status', 'status');

  const projectionStore = ensureStore(database, transaction, QUESTION_CALIBRATION_PROJECTION_STORE, 'projectionId');
  ensureIndex(projectionStore, 'attemptId', 'attemptId', true);
  ensureIndex(projectionStore, 'studentRound', ['studentId', 'learningRoundId']);
  ensureIndex(projectionStore, 'resourceVersionStatus', ['resourceVersionId', 'status']);
  ensureIndex(projectionStore, 'status', 'status');
  ensureIndex(projectionStore, 'studentId', 'studentId');
}

function ensureStore(
  database: IDBDatabase,
  transaction: IDBTransaction | null,
  name: string,
  keyPath: string,
): IDBObjectStore {
  if (!database.objectStoreNames.contains(name)) return database.createObjectStore(name, { keyPath });
  if (!transaction) throw new Error(`Missing upgrade transaction for ${name}.`);
  return transaction.objectStore(name);
}

function ensureIndex(store: IDBObjectStore, name: string, keyPath: string | string[], unique = false): void {
  if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, { unique });
}

async function getOne<T>(databaseName: string, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const database = await openLearningCollectionDatabase(databaseName);
  try {
    return await requestToPromise<T | undefined>(database.transaction(storeName, 'readonly').objectStore(storeName).get(key));
  } finally { database.close(); }
}

async function getOneByIndex<T>(databaseName: string, storeName: string, indexName: string, key: IDBValidKey): Promise<T | undefined> {
  const database = await openLearningCollectionDatabase(databaseName);
  try {
    return await requestToPromise<T | undefined>(database.transaction(storeName, 'readonly').objectStore(storeName).index(indexName).get(key));
  } finally { database.close(); }
}

async function getAllByIndex<T>(databaseName: string, storeName: string, indexName: string, key: IDBValidKey): Promise<T[]> {
  const database = await openLearningCollectionDatabase(databaseName);
  try {
    return await requestToPromise<T[]>(database.transaction(storeName, 'readonly').objectStore(storeName).index(indexName).getAll(key));
  } finally { database.close(); }
}

async function getAll<T>(databaseName: string, storeName: string): Promise<T[]> {
  const database = await openLearningCollectionDatabase(databaseName);
  try {
    return await requestToPromise<T[]>(database.transaction(storeName, 'readonly').objectStore(storeName).getAll());
  } finally { database.close(); }
}

async function putOne<T>(databaseName: string, storeName: string, value: T): Promise<void> {
  const database = await openLearningCollectionDatabase(databaseName);
  try {
    await requestToPromise(database.transaction(storeName, 'readwrite').objectStore(storeName).put(value));
  } finally { database.close(); }
}

async function clearStore(databaseName: string, storeName: string): Promise<void> {
  const database = await openLearningCollectionDatabase(databaseName);
  try {
    await requestToPromise(database.transaction(storeName, 'readwrite').objectStore(storeName).clear());
  } finally { database.close(); }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Learning collection database request timed out.')), INDEXED_DB_TIMEOUT_MS);
    request.onsuccess = () => { clearTimeout(timer); resolve(request.result); };
    request.onerror = () => { clearTimeout(timer); reject(request.error || new Error('Learning collection database request failed.')); };
  });
}

function byOccurredAt(left: LearningObservationEvent, right: LearningObservationEvent): number {
  return left.occurredAt.localeCompare(right.occurredAt) || left.eventId.localeCompare(right.eventId);
}
