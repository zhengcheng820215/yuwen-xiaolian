import type { RubricAlignedFeedbackTrialObservationRepository } from
  './rubricAlignedFeedbackTrialObservationRepository.ts';
import {
  validateRubricAlignedFeedbackTrialObservation,
  type RubricAlignedFeedbackTrialObservation,
} from '../schemas/rubricAlignedFeedbackTrial.schema.ts';

const DATABASE_NAME = 'yuwen-xiaolian-rubric-aligned-feedback-trial-v1';
const STORE_NAME = 'observations';

export class IndexedDBRubricAlignedFeedbackTrialObservationRepository
implements RubricAlignedFeedbackTrialObservationRepository {
  constructor(private readonly databaseName = DATABASE_NAME) {}

  async append(observation: RubricAlignedFeedbackTrialObservation): Promise<'inserted' | 'duplicate'> {
    const issues = validateRubricAlignedFeedbackTrialObservation(observation);
    if (issues.length) throw new Error(`rubric_feedback_trial_observation_invalid:${issues.join(',')}`);
    const database = await this.open();
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const existing = await requestDone<RubricAlignedFeedbackTrialObservation | undefined>(
        store.get(observation.observationId),
      );
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(observation)) {
          throw new Error('rubric_feedback_trial_observation_identity_conflict');
        }
        return 'duplicate';
      }
      await requestDone(store.add(structuredClone(observation)));
      return 'inserted';
    } finally { database.close(); }
  }

  async list(trialId?: string): Promise<RubricAlignedFeedbackTrialObservation[]> {
    const database = await this.open();
    try {
      const values = await requestDone<RubricAlignedFeedbackTrialObservation[]>(
        database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll(),
      );
      return values.filter((item) => !trialId || item.trialId === trialId);
    } finally { database.close(); }
  }

  async clear(): Promise<void> {
    const database = await this.open();
    try {
      await requestDone(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear());
    } finally { database.close(); }
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'observationId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('rubric_feedback_trial_db_open_failed'));
    });
  }
}

function requestDone<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('rubric_feedback_trial_db_request_failed'));
  });
}
