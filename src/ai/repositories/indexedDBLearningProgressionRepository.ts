import type { LearningProgressionRepository } from './learningProgressionRepository.ts';
import type { FormalTaskGroupProgressionArtifact } from
  '../schemas/formalTaskProgressionMetadata.schema.ts';
import { isFormalTaskGroupProgressionArtifact } from
  '../schemas/formalTaskProgressionMetadata.schema.ts';
import type { LearningProgressionContextSnapshot } from
  '../schemas/learningProgressionContext.schema.ts';
import { isLearningProgressionContextSnapshot } from
  '../schemas/learningProgressionContext.schema.ts';
import type { ProgressionEvidenceAdmissionDecision, ProgressionEvidenceContext } from
  '../schemas/progressionEvidenceAdmission.schema.ts';
import {
  isProgressionEvidenceAdmissionDecision,
  isProgressionEvidenceContext,
} from '../schemas/progressionEvidenceAdmission.schema.ts';
import type { ProgressionInstabilityAssessment } from
  '../schemas/progressionInstabilityAssessment.schema.ts';
import { isProgressionInstabilityAssessment } from
  '../schemas/progressionInstabilityAssessment.schema.ts';
import type { ProgressionPerformanceObservation } from
  '../schemas/progressionPerformanceObservation.schema.ts';
import { isProgressionPerformanceObservation } from
  '../schemas/progressionPerformanceObservation.schema.ts';

const DB_NAME = 'yuwen_xiaolian_learning_progression';
const DB_VERSION = 1;
const STORES = {
  artifacts: 'progressionArtifacts',
  contexts: 'progressionContexts',
  observations: 'progressionObservations',
  assessments: 'progressionAssessments',
  evidenceContexts: 'progressionEvidenceContexts',
  admissions: 'progressionAdmissions',
} as const;

export class IndexedDBLearningProgressionRepository
implements LearningProgressionRepository {
  private readonly databaseName: string;

  constructor(databaseName = DB_NAME) {
    this.databaseName = databaseName;
  }

  saveArtifact(value: FormalTaskGroupProgressionArtifact) {
    if (!isFormalTaskGroupProgressionArtifact(value)) {
      return Promise.reject(new Error('progression_artifact_invalid'));
    }
    return this.saveImmutable(STORES.artifacts, value.planHash, value);
  }
  getArtifact(planHash: string) {
    return this.get<FormalTaskGroupProgressionArtifact>(STORES.artifacts, planHash);
  }
  saveContext(value: LearningProgressionContextSnapshot) {
    if (!isLearningProgressionContextSnapshot(value)) {
      return Promise.reject(new Error('progression_context_invalid'));
    }
    return this.saveImmutable(STORES.contexts, value.learningTaskAttemptId, value);
  }
  getContextByAttemptId(attemptId: string) {
    return this.get<LearningProgressionContextSnapshot>(STORES.contexts, attemptId);
  }
  saveObservation(value: ProgressionPerformanceObservation) {
    if (!isProgressionPerformanceObservation(value)) {
      return Promise.reject(new Error('progression_observation_invalid'));
    }
    return this.saveImmutable(STORES.observations, value.observationId, value);
  }
  async listObservations(studentId: string, threadId?: string) {
    return (await this.getAll<ProgressionPerformanceObservation>(STORES.observations))
      .filter((item) => item.studentId === studentId
        && (!threadId || item.observationThreadId === threadId))
      .sort((left, right) => left.observedAt.localeCompare(right.observedAt));
  }
  saveAssessment(value: ProgressionInstabilityAssessment) {
    if (!isProgressionInstabilityAssessment(value)) {
      return Promise.reject(new Error('progression_assessment_invalid'));
    }
    return this.saveImmutable(STORES.assessments, value.assessmentId, value);
  }
  getAssessment(assessmentId: string) {
    return this.get<ProgressionInstabilityAssessment>(STORES.assessments, assessmentId);
  }
  saveEvidenceContext(value: ProgressionEvidenceContext) {
    if (!isProgressionEvidenceContext(value)) {
      return Promise.reject(new Error('progression_evidence_context_invalid'));
    }
    return this.saveImmutable(STORES.evidenceContexts, value.evidenceId, value);
  }
  saveAdmission(value: ProgressionEvidenceAdmissionDecision) {
    if (!isProgressionEvidenceAdmissionDecision(value)) {
      return Promise.reject(new Error('progression_admission_invalid'));
    }
    return this.saveImmutable(STORES.admissions, value.evidenceId, value);
  }
  getAdmissionByEvidenceId(evidenceId: string) {
    return this.get<ProgressionEvidenceAdmissionDecision>(STORES.admissions, evidenceId);
  }

  async clear() {
    const db = await this.open();
    const transaction = db.transaction(Object.values(STORES), 'readwrite');
    Object.values(STORES).forEach((store) => transaction.objectStore(store).clear());
    await transactionDone(transaction);
    db.close();
  }

  private async saveImmutable<T>(store: string, key: string, value: T): Promise<T> {
    const existing = await this.get<T>(store, key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(value)) {
      throw new Error(`learning_progression_immutable_conflict:${store}:${key}`);
    }
    if (!existing) {
      const db = await this.open();
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).put({ id: key, value: clone(value) });
      await transactionDone(transaction);
      db.close();
    }
    return clone(existing || value);
  }

  private async get<T>(store: string, key: string): Promise<T | null> {
    const db = await this.open();
    const transaction = db.transaction(store, 'readonly');
    const row = await requestDone<{ id: string; value: T } | undefined>(
      transaction.objectStore(store).get(key),
    );
    await transactionDone(transaction);
    db.close();
    return row ? clone(row.value) : null;
  }

  private async getAll<T>(store: string): Promise<T[]> {
    const db = await this.open();
    const transaction = db.transaction(store, 'readonly');
    const rows = await requestDone<Array<{ id: string; value: T }>>(
      transaction.objectStore(store).getAll(),
    );
    await transactionDone(transaction);
    db.close();
    return rows.map((row) => clone(row.value));
  }

  private open(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is not available in this runtime.'));
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        Object.values(STORES).forEach((name) => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Learning progression database is blocked.'));
    });
  }
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
    transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted.'));
    transaction.onerror = () => reject(transaction.error || new Error('Transaction failed.'));
  });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
