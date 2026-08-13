import {
  IndexedDBLearningObservationOutboxRepository,
  IndexedDBLearningObservationRepository,
  IndexedDBQuestionCalibrationProjectionRepository,
  LEARNING_COLLECTION_DATABASE_VERSION,
  LEARNING_OBSERVATION_EVENT_STORE,
  LEARNING_OBSERVATION_OUTBOX_STORE,
  QUESTION_CALIBRATION_PROJECTION_STORE,
  openLearningCollectionDatabase,
} from '../repositories/indexedDBLearningCollectionRepositories.ts';
import type { LearningObservationEvent } from '../schemas/learningObservationEvent.schema.ts';
import type { LearningObservationOutboxEntry } from '../schemas/learningObservationOutbox.schema.ts';
import type { QuestionCalibrationProjectionRecord } from '../schemas/questionCalibrationProjection.schema.ts';

const button = document.querySelector<HTMLButtonElement>('#run');
const output = document.querySelector<HTMLElement>('#result');
if (!button || !output) throw new Error('WP2 smoke controls missing.');

button.addEventListener('click', () => {
  button.disabled = true;
  void run().then((result) => {
    output.textContent = JSON.stringify(result, null, 2);
    output.dataset.status = result.passed === result.total ? 'pass' : 'fail';
  }).catch((error) => {
    output.textContent = JSON.stringify({ status: 'FAIL', error: error instanceof Error ? error.message : String(error) }, null, 2);
    output.dataset.status = 'fail';
  }).finally(() => { button.disabled = false; });
});

async function run(): Promise<{ status: string; passed: number; total: number; checks: string[] }> {
  const databaseName = `wp2_learning_collection_smoke_${Date.now()}`;
  const checks: string[] = [];
  try {
    await createVersionOneDatabase(databaseName);
    const upgraded = await openLearningCollectionDatabase(databaseName);
    check(upgraded.version === LEARNING_COLLECTION_DATABASE_VERSION, 'upgrade_to_v2', checks);
    check(upgraded.objectStoreNames.contains('legacySentinel'), 'legacy_store_preserved', checks);
    check(upgraded.objectStoreNames.contains(LEARNING_OBSERVATION_EVENT_STORE), 'event_store_created', checks);
    check(upgraded.objectStoreNames.contains(LEARNING_OBSERVATION_OUTBOX_STORE), 'outbox_store_created', checks);
    check(upgraded.objectStoreNames.contains(QUESTION_CALIBRATION_PROJECTION_STORE), 'projection_store_created', checks);
    const tx = upgraded.transaction([
      LEARNING_OBSERVATION_EVENT_STORE,
      LEARNING_OBSERVATION_OUTBOX_STORE,
      QUESTION_CALIBRATION_PROJECTION_STORE,
    ], 'readonly');
    check(tx.objectStore(LEARNING_OBSERVATION_EVENT_STORE).indexNames.contains('studentRound'), 'event_compound_index', checks);
    check(tx.objectStore(LEARNING_OBSERVATION_OUTBOX_STORE).indexNames.contains('nextRetryAt'), 'outbox_due_index', checks);
    check(tx.objectStore(QUESTION_CALIBRATION_PROJECTION_STORE).indexNames.contains('attemptId'), 'projection_unique_attempt_index', checks);
    upgraded.close();

    const events = new IndexedDBLearningObservationRepository(databaseName);
    const outbox = new IndexedDBLearningObservationOutboxRepository(databaseName);
    const projections = new IndexedDBQuestionCalibrationProjectionRepository(databaseName);
    const sourceEvent = event();
    check((await events.save(sourceEvent)).status === 'created', 'event_created', checks);
    check((await events.save({ ...sourceEvent, recordedAt: '2026-08-13T12:01:00.000Z' })).status === 'unchanged', 'event_idempotent', checks);
    check((await events.save({ ...sourceEvent, taskId: 'conflict-task' })).status === 'conflict', 'event_conflict', checks);
    check((await events.listByRound(sourceEvent.studentId, sourceEvent.learningRoundId)).length === 1, 'event_round_query', checks);

    const pending = outboxEntry(sourceEvent);
    check((await outbox.save(pending)).status === 'created', 'outbox_created', checks);
    check((await outbox.listDue('2026-08-13T12:01:00.000Z')).length === 1, 'outbox_due_query', checks);
    await outbox.delete(pending.outboxId);
    check(!(await outbox.getById(pending.outboxId)), 'outbox_deleted', checks);

    const record = projection();
    check((await projections.save(record)).status === 'created', 'projection_created', checks);
    check((await projections.save(record)).status === 'unchanged', 'projection_idempotent', checks);
    check((await projections.save({ ...record, projectionId: 'projection-duplicate' })).status === 'conflict', 'projection_attempt_unique', checks);
    check((await projections.listEligibleByResourceVersion(record.resourceVersionId)).length === 1, 'projection_version_query', checks);

    return { status: 'PASS', passed: checks.length, total: 19, checks };
  } finally {
    await deleteDatabase(databaseName);
  }
}

function event(): LearningObservationEvent {
  return {
    schemaVersion: 'learning_observation_event_v1', eventId: 'event-browser-1', eventType: 'question_presented',
    occurredAt: '2026-08-13T12:00:00.000Z', recordedAt: '2026-08-13T12:00:00.000Z', runtimeScope: 'product',
    studentId: 'student-local-primary-v1', operationId: 'operation-browser-1', learningSessionId: 'session-browser-1',
    learningRoundId: 'round-browser-1', materialVersionId: 'material-browser-1', resourceId: 'resource-browser-1',
    resourceVersionId: 'resource-version-browser-1', taskId: 'task-browser-1', sourceEntityId: 'presentation-browser-1',
    appVersion: 'wp2-browser-smoke', payload: { kind: 'question_presented', presentationId: 'presentation-browser-1' },
  };
}

function outboxEntry(source: LearningObservationEvent): LearningObservationOutboxEntry {
  return {
    schemaVersion: 'learning_observation_outbox_v1', outboxId: 'outbox-browser-1', eventId: source.eventId,
    learningRoundId: source.learningRoundId, eventType: source.eventType, event: source, status: 'pending', retryCount: 0,
    nextRetryAt: '2026-08-13T12:00:00.000Z', createdAt: '2026-08-13T12:00:00.000Z', updatedAt: '2026-08-13T12:00:00.000Z',
  };
}

function projection(): QuestionCalibrationProjectionRecord {
  return {
    schemaVersion: 'question_calibration_projection_v1', projectionId: 'projection-browser-1', attemptId: 'attempt-browser-1',
    status: 'eligible', runtimeScope: 'product', studentId: 'student-local-primary-v1', operationId: 'operation-browser-1',
    learningSessionId: 'session-browser-1', learningRoundId: 'round-browser-1', responseId: 'response-browser-1',
    formalDiagnosisId: 'diagnosis-browser-1', resourceVersionId: 'resource-version-browser-1', itemScore: 0.75,
    itemScorePolicyVersion: 'rubric_required_equal_weight_v1', totalScoreStatus: 'unavailable_single_round', valid: true,
    completedAt: '2026-08-13T12:00:00.000Z', projectedAt: '2026-08-13T12:00:00.000Z', issues: [],
  };
}

function createVersionOneDatabase(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('legacySentinel', { keyPath: 'id' });
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
  });
}

function deleteDatabase(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Isolated WP2 smoke database cleanup blocked.'));
  });
}

function check(condition: boolean, name: string, checks: string[]): void {
  if (!condition) throw new Error(name);
  checks.push(name);
}
