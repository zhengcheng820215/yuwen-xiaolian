import {
  IndexedDBLearningObservationOutboxRepository,
  IndexedDBLearningObservationRepository,
  IndexedDBQuestionCalibrationProjectionRepository,
  LEARNING_COLLECTION_DATABASE_VERSION,
  LEARNING_OBSERVATION_EVENT_STORE,
  LEARNING_OBSERVATION_OUTBOX_STORE,
  LEARNING_TASK_ATTEMPT_STORE,
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
    await createVersionTwoDatabase(databaseName);
    const upgraded = await openLearningCollectionDatabase(databaseName);
    check(upgraded.version === LEARNING_COLLECTION_DATABASE_VERSION, 'upgrade_v2_to_v4', checks);
    check(upgraded.objectStoreNames.contains('legacySentinel'), 'legacy_store_preserved', checks);
    check(upgraded.objectStoreNames.contains(LEARNING_OBSERVATION_EVENT_STORE), 'event_store_created', checks);
    check(upgraded.objectStoreNames.contains(LEARNING_OBSERVATION_OUTBOX_STORE), 'outbox_store_created', checks);
    check(upgraded.objectStoreNames.contains(QUESTION_CALIBRATION_PROJECTION_STORE), 'projection_store_created', checks);
    check(upgraded.objectStoreNames.contains(LEARNING_TASK_ATTEMPT_STORE), 'learning_task_attempt_store_created', checks);
    const tx = upgraded.transaction([
      LEARNING_OBSERVATION_EVENT_STORE,
      LEARNING_OBSERVATION_OUTBOX_STORE,
      QUESTION_CALIBRATION_PROJECTION_STORE,
      LEARNING_TASK_ATTEMPT_STORE,
    ], 'readonly');
    check(tx.objectStore(LEARNING_OBSERVATION_EVENT_STORE).indexNames.contains('studentRound'), 'event_compound_index', checks);
    check(tx.objectStore(LEARNING_OBSERVATION_OUTBOX_STORE).indexNames.contains('nextRetryAt'), 'outbox_due_index', checks);
    check(tx.objectStore(QUESTION_CALIBRATION_PROJECTION_STORE).indexNames.contains('attemptId'), 'projection_unique_attempt_index', checks);
    check(tx.objectStore(LEARNING_OBSERVATION_EVENT_STORE).indexNames.contains('studentId'), 'event_student_index_added', checks);
    check(tx.objectStore(QUESTION_CALIBRATION_PROJECTION_STORE).indexNames.contains('studentId'), 'projection_student_index_added', checks);
    check(tx.objectStore(LEARNING_TASK_ATTEMPT_STORE).indexNames.contains('initialAttemptId'), 'attempt_unique_initial_index_added', checks);
    upgraded.close();

    const events = new IndexedDBLearningObservationRepository(databaseName);
    const outbox = new IndexedDBLearningObservationOutboxRepository(databaseName);
    const projections = new IndexedDBQuestionCalibrationProjectionRepository(databaseName);
    check(Boolean(await events.getById('event-browser-v2')), 'v2_event_preserved', checks);
    check(Boolean(await outbox.getById('outbox-browser-v2')), 'v2_outbox_preserved', checks);
    check(Boolean(await projections.getByAttemptId('attempt-browser-v2')), 'v2_projection_preserved', checks);
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

    const concurrent = { ...record, projectionId: 'projection-concurrent', attemptId: 'attempt-concurrent', responseId: 'response-concurrent' };
    const concurrentResults = await Promise.all([
      new IndexedDBQuestionCalibrationProjectionRepository(databaseName).save(concurrent),
      new IndexedDBQuestionCalibrationProjectionRepository(databaseName).save(concurrent),
    ]);
    check(concurrentResults.map((item) => item.status).sort().join('|') === 'created|unchanged', 'projection_cross_tab_idempotent', checks);
    check((await projections.listAll()).filter((item) => item.attemptId === concurrent.attemptId).length === 1, 'projection_cross_tab_single_record', checks);

    const conflictAttempt = { ...record, projectionId: 'projection-race-a', attemptId: 'attempt-race', responseId: 'response-race' };
    const conflictResults = await Promise.all([
      new IndexedDBQuestionCalibrationProjectionRepository(databaseName).save(conflictAttempt),
      new IndexedDBQuestionCalibrationProjectionRepository(databaseName).save({ ...conflictAttempt, projectionId: 'projection-race-b' }),
    ]);
    check(conflictResults.map((item) => item.status).sort().join('|') === 'conflict|created', 'projection_cross_tab_conflict_is_structured', checks);
    check((await projections.listAll()).filter((item) => item.attemptId === conflictAttempt.attemptId).length === 1, 'projection_cross_tab_attempt_unique', checks);

    return { status: 'PASS', passed: checks.length, total: checks.length, checks };
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

function createVersionTwoDatabase(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2);
    request.onupgradeneeded = () => {
      const legacy = request.result.createObjectStore('legacySentinel', { keyPath: 'id' });
      legacy.put({ id: 'v2-record', value: 'preserve-me' });
      const eventStore = request.result.createObjectStore(LEARNING_OBSERVATION_EVENT_STORE, { keyPath: 'eventId' });
      eventStore.createIndex('studentRound', ['studentId', 'learningRoundId']);
      eventStore.createIndex('resourceVersionId', 'resourceVersionId');
      eventStore.createIndex('eventType', 'eventType');
      const legacyEvent = {
        ...event(),
        eventId: 'event-browser-v2',
        operationId: 'operation-browser-v2',
        learningSessionId: 'session-browser-v2',
        learningRoundId: 'round-browser-v2',
        resourceVersionId: 'resource-version-browser-v2',
        sourceEntityId: 'presentation-browser-v2',
      };
      eventStore.put(legacyEvent);
      const outboxStore = request.result.createObjectStore(LEARNING_OBSERVATION_OUTBOX_STORE, { keyPath: 'outboxId' });
      outboxStore.createIndex('eventId', 'eventId', { unique: true });
      outboxStore.createIndex('learningRoundId', 'learningRoundId');
      outboxStore.createIndex('nextRetryAt', 'nextRetryAt');
      outboxStore.createIndex('status', 'status');
      outboxStore.put({
        ...outboxEntry(legacyEvent),
        outboxId: 'outbox-browser-v2',
        eventId: 'event-browser-v2',
        learningRoundId: 'round-browser-v2',
        nextRetryAt: '2099-01-01T00:00:00.000Z',
        event: legacyEvent,
      });
      const projectionStore = request.result.createObjectStore(QUESTION_CALIBRATION_PROJECTION_STORE, { keyPath: 'projectionId' });
      projectionStore.createIndex('attemptId', 'attemptId', { unique: true });
      projectionStore.createIndex('studentRound', ['studentId', 'learningRoundId']);
      projectionStore.createIndex('resourceVersionStatus', ['resourceVersionId', 'status']);
      projectionStore.createIndex('status', 'status');
      projectionStore.put({
        ...projection(),
        projectionId: 'projection-browser-v2',
        attemptId: 'attempt-browser-v2',
        operationId: 'operation-browser-v2',
        learningSessionId: 'session-browser-v2',
        learningRoundId: 'round-browser-v2',
        responseId: 'response-browser-v2',
        resourceVersionId: 'resource-version-browser-v2',
      });
    };
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
