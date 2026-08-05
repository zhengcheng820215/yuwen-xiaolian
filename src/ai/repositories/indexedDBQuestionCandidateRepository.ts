import type { QuestionCandidateRepository } from './questionCandidateRepository.ts';
import {
  cloneQuestionCandidate,
  type CandidateCommandName,
  type CandidateCommandReceipt,
  type CandidateDecisionEvent,
  type QuestionCandidate,
  type QuestionCandidateStatus,
} from '../schemas/questionCandidate.schema.ts';
import type { ExceptionCorrectionRecord } from
  '../schemas/questionCandidateCorrection.schema.ts';

const DEFAULT_DB_NAME = 'yuwen_xiaolian_question_candidates';
const DB_VERSION = 2;
const CANDIDATE_STORE = 'questionCandidates';
const EVENT_STORE = 'candidateDecisionEvents';
const RECEIPT_STORE = 'candidateCommandReceipts';
const CORRECTION_STORE = 'exceptionCorrectionRecords';

type StoredReceipt = CandidateCommandReceipt & { receiptId: string };

export class IndexedDBQuestionCandidateRepository
implements QuestionCandidateRepository {
  private readonly databaseName: string;

  constructor(databaseName = DEFAULT_DB_NAME) {
    this.databaseName = databaseName;
  }

  async saveCandidate(candidate: QuestionCandidate): Promise<QuestionCandidate> {
    const existing = await this.getCandidate(candidate.candidateId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(candidate)) {
      throw new Error(`Question candidate is immutable: ${candidate.candidateId}`);
    }
    if (!existing) await this.put(CANDIDATE_STORE, cloneQuestionCandidate(candidate));
    return cloneQuestionCandidate(candidate);
  }

  async getCandidate(candidateId: string): Promise<QuestionCandidate | null> {
    return this.get<QuestionCandidate>(CANDIDATE_STORE, candidateId);
  }

  async listCandidates(trainingTaskId?: string): Promise<QuestionCandidate[]> {
    return (await this.getAll<QuestionCandidate>(CANDIDATE_STORE))
      .filter((candidate) => !trainingTaskId || candidate.trainingTaskId === trainingTaskId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async updateCandidateStatus(input: {
    candidateId: string;
    expectedStatus: QuestionCandidateStatus;
    status: QuestionCandidateStatus;
    occurredAt: string;
  }): Promise<QuestionCandidate> {
    const db = await this.openDatabase();
    const transaction = db.transaction(CANDIDATE_STORE, 'readwrite');
    const store = transaction.objectStore(CANDIDATE_STORE);
    const current = await requestToPromise<QuestionCandidate | undefined>(
      store.get(input.candidateId),
    );
    if (!current) {
      transaction.abort();
      db.close();
      throw new Error(`Question candidate not found: ${input.candidateId}`);
    }
    if (current.status !== input.expectedStatus) {
      transaction.abort();
      db.close();
      throw new Error(
        `Question candidate status conflict: expected ${input.expectedStatus}, actual ${current.status}.`,
      );
    }
    const updated: QuestionCandidate = {
      ...current,
      status: input.status,
      adoptedAt: input.status === 'adopted' ? input.occurredAt : current.adoptedAt,
    };
    store.put(cloneQuestionCandidate(updated));
    await transactionToPromise(transaction);
    db.close();
    return cloneQuestionCandidate(updated);
  }

  async saveDecisionEvent(event: CandidateDecisionEvent): Promise<CandidateDecisionEvent> {
    const existing = await this.get<CandidateDecisionEvent>(EVENT_STORE, event.eventId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(event)) {
      throw new Error(`Candidate decision event is immutable: ${event.eventId}`);
    }
    if (!existing) await this.put(EVENT_STORE, cloneQuestionCandidate(event));
    return cloneQuestionCandidate(event);
  }

  async listDecisionEvents(candidateId?: string): Promise<CandidateDecisionEvent[]> {
    return (await this.getAll<CandidateDecisionEvent>(EVENT_STORE))
      .filter((event) => !candidateId || event.candidateId === candidateId)
      .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt));
  }

  async saveCorrectionRecord(
    record: ExceptionCorrectionRecord,
  ): Promise<ExceptionCorrectionRecord> {
    const existing = await this.get<ExceptionCorrectionRecord>(
      CORRECTION_STORE,
      record.correctionId,
    );
    if (existing && JSON.stringify(existing) !== JSON.stringify(record)) {
      throw new Error(`Exception correction record is immutable: ${record.correctionId}`);
    }
    if (!existing) await this.put(CORRECTION_STORE, cloneQuestionCandidate(record));
    return cloneQuestionCandidate(record);
  }

  async getCorrectionRecord(correctionId: string): Promise<ExceptionCorrectionRecord | null> {
    return this.get<ExceptionCorrectionRecord>(CORRECTION_STORE, correctionId);
  }

  async listCorrectionRecords(candidateId?: string): Promise<ExceptionCorrectionRecord[]> {
    return (await this.getAll<ExceptionCorrectionRecord>(CORRECTION_STORE))
      .filter((record) => !candidateId || record.candidateId === candidateId)
      .sort((left, right) => right.correctedAt.localeCompare(left.correctedAt));
  }

  async saveCommandReceipt(receipt: CandidateCommandReceipt): Promise<CandidateCommandReceipt> {
    const receiptId = receiptKey(receipt.command, receipt.idempotencyKey);
    const existing = await this.get<StoredReceipt>(RECEIPT_STORE, receiptId);
    const stored: StoredReceipt = { ...cloneQuestionCandidate(receipt), receiptId };
    if (existing && JSON.stringify(existing) !== JSON.stringify(stored)) {
      throw new Error(`Candidate command receipt conflict: ${receiptId}`);
    }
    if (!existing) await this.put(RECEIPT_STORE, stored);
    return cloneQuestionCandidate(receipt);
  }

  async getCommandReceipt(
    command: CandidateCommandName,
    idempotencyKey: string,
  ): Promise<CandidateCommandReceipt | null> {
    const receipt = await this.get<StoredReceipt>(
      RECEIPT_STORE,
      receiptKey(command, idempotencyKey),
    );
    if (!receipt) return null;
    const { receiptId: _receiptId, ...result } = receipt;
    return cloneQuestionCandidate(result);
  }

  async clear(): Promise<void> {
    const db = await this.openDatabase();
    const transaction = db.transaction(
      [CANDIDATE_STORE, EVENT_STORE, RECEIPT_STORE, CORRECTION_STORE],
      'readwrite',
    );
    transaction.objectStore(CANDIDATE_STORE).clear();
    transaction.objectStore(EVENT_STORE).clear();
    transaction.objectStore(RECEIPT_STORE).clear();
    transaction.objectStore(CORRECTION_STORE).clear();
    await transactionToPromise(transaction);
    db.close();
  }

  private async get<T>(storeName: string, key: string): Promise<T | null> {
    const db = await this.openDatabase();
    const transaction = db.transaction(storeName, 'readonly');
    const result = await requestToPromise<T | undefined>(
      transaction.objectStore(storeName).get(key),
    );
    await transactionToPromise(transaction);
    db.close();
    return result ? cloneQuestionCandidate(result) : null;
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.openDatabase();
    const transaction = db.transaction(storeName, 'readonly');
    const result = await requestToPromise<T[]>(transaction.objectStore(storeName).getAll());
    await transactionToPromise(transaction);
    db.close();
    return result.map(cloneQuestionCandidate);
  }

  private async put(storeName: string, value: unknown): Promise<void> {
    const db = await this.openDatabase();
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value);
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
        if (!db.objectStoreNames.contains(CANDIDATE_STORE)) {
          db.createObjectStore(CANDIDATE_STORE, { keyPath: 'candidateId' });
        }
        if (!db.objectStoreNames.contains(EVENT_STORE)) {
          db.createObjectStore(EVENT_STORE, { keyPath: 'eventId' });
        }
        if (!db.objectStoreNames.contains(RECEIPT_STORE)) {
          db.createObjectStore(RECEIPT_STORE, { keyPath: 'receiptId' });
        }
        if (!db.objectStoreNames.contains(CORRECTION_STORE)) {
          db.createObjectStore(CORRECTION_STORE, { keyPath: 'correctionId' });
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
        reject(new Error('Question candidate database is blocked.'));
      };
    });
  }
}

function receiptKey(command: CandidateCommandName, idempotencyKey: string): string {
  return `${command}:${idempotencyKey}`;
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
