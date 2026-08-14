import {
  IndexedDBLearningObservationOutboxRepository,
  IndexedDBLearningObservationRepository,
  IndexedDBLearningTaskAttemptRepository,
  IndexedDBQuestionCalibrationProjectionRepository,
  LEARNING_COLLECTION_DATABASE_VERSION,
  LEARNING_OBSERVATION_EVENT_STORE,
  LEARNING_OBSERVATION_OUTBOX_STORE,
  LEARNING_TASK_ATTEMPT_STORE,
  QUESTION_CALIBRATION_PROJECTION_STORE,
  openLearningCollectionDatabase,
} from '../repositories/indexedDBLearningCollectionRepositories.ts';
import { LearningFeedbackRevisionPersistenceService } from '../services/learningFeedbackRevisionPersistenceService.ts';
import type { LearningObservationEvent } from '../schemas/learningObservationEvent.schema.ts';
import type { LearningObservationOutboxEntry } from '../schemas/learningObservationOutbox.schema.ts';
import type { LearningTaskAttemptRecord, RevisionGoal } from '../schemas/learningFeedbackRevision.schema.ts';
import type { QuestionCalibrationProjectionRecord } from '../schemas/questionCalibrationProjection.schema.ts';

const button = document.querySelector<HTMLButtonElement>('#run');
const output = document.querySelector<HTMLElement>('#result');
if (!button || !output) throw new Error('Revision Stage 1 acceptance controls missing.');

button.addEventListener('click', () => {
  button.disabled = true;
  void run().then((result) => {
    output.textContent = JSON.stringify(result, null, 2);
    output.dataset.status = result.status.toLowerCase();
  }).catch((error) => {
    output.textContent = JSON.stringify({
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    }, null, 2);
    output.dataset.status = 'fail';
  }).finally(() => { button.disabled = false; });
});

async function run() {
  const databaseName = `learning_feedback_revision_stage1_${Date.now()}`;
  const checks: string[] = [];
  try {
    await createVersionThreeDatabase(databaseName);
    const upgraded = await openLearningCollectionDatabase(databaseName);
    check(upgraded.version === LEARNING_COLLECTION_DATABASE_VERSION, 'upgrade_v3_to_v4', checks);
    check(upgraded.objectStoreNames.contains('legacySentinel'), 'legacy_store_preserved', checks);
    check(upgraded.objectStoreNames.contains(LEARNING_TASK_ATTEMPT_STORE), 'learning_task_attempt_store_created', checks);
    const tx = upgraded.transaction(LEARNING_TASK_ATTEMPT_STORE, 'readonly');
    const store = tx.objectStore(LEARNING_TASK_ATTEMPT_STORE);
    check(store.indexNames.contains('initialAttemptId'), 'unique_initial_attempt_index_created', checks);
    check(store.indexNames.contains('studentRound'), 'student_round_recovery_index_created', checks);
    check(store.indexNames.contains('studentId'), 'student_index_created', checks);
    upgraded.close();

    const events = new IndexedDBLearningObservationRepository(databaseName);
    const outbox = new IndexedDBLearningObservationOutboxRepository(databaseName);
    const projections = new IndexedDBQuestionCalibrationProjectionRepository(databaseName);
    check(Boolean(await events.getById('event-stage1-v3')), 'v3_event_preserved', checks);
    check(Boolean(await outbox.getById('outbox-stage1-v3')), 'v3_outbox_preserved', checks);
    check(Boolean(await projections.getByAttemptId('attempt-stage1-v3')), 'v3_projection_preserved', checks);

    const firstRepository = new IndexedDBLearningTaskAttemptRepository(databaseName);
    const secondRepository = new IndexedDBLearningTaskAttemptRepository(databaseName);
    const firstService = new LearningFeedbackRevisionPersistenceService(firstRepository);
    const secondService = new LearningFeedbackRevisionPersistenceService(secondRepository);
    const input = attemptInput();
    const concurrentCreate = await Promise.all([
      firstService.createInitialAttempt(input),
      secondService.createInitialAttempt(input),
    ]);
    check(concurrentCreate[0].learningTaskAttemptId === concurrentCreate[1].learningTaskAttemptId, 'cross_tab_same_initial_identity', checks);
    check((await firstRepository.listAll()).length === 1, 'cross_tab_same_attempt_single_record', checks);

    const initial = concurrentCreate[0];
    const conflicting: LearningTaskAttemptRecord = {
      ...initial,
      initialResponse: { ...initial.initialResponse, answerText: '并发标签页试图覆盖首次回答' },
      updatedAt: '2026-08-14T02:01:00.000Z',
    };
    const conflictResult = await secondRepository.save(conflicting);
    check(conflictResult.status === 'conflict', 'cross_tab_initial_response_conflict_structured', checks);
    check((await firstRepository.getById(initial.learningTaskAttemptId))?.initialResponse.answerText === input.initialResponse.answerText, 'initial_response_preserved_after_conflict', checks);

    const revision = await firstService.startRevision(
      initial.learningTaskAttemptId, goal(), '2026-08-14T02:02:00.000Z',
    );
    check(revision.revision?.draftAnswer === initial.initialResponse.answerText, 'revision_prefills_initial_answer', checks);
    await firstService.saveRevisionDraft(
      initial.learningTaskAttemptId,
      `${initial.initialResponse.answerText} 我补充了父亲停留很久这一文本依据。`,
      '2026-08-14T02:03:00.000Z',
    );
    const restored = await secondService.recover(initial.studentId, initial.learningRoundId);
    check(restored.status === 'revision_draft'
      && restored.record?.revision?.draftAnswer?.includes('停留很久'), 'cross_tab_revision_draft_recovered', checks);

    const submitted = await secondService.submitRevision(
      initial.learningTaskAttemptId,
      restored.record?.revision?.draftAnswer || '',
      '2026-08-14T02:04:00.000Z',
    );
    check(submitted.initialResponse.responseId !== submitted.revision?.revisedResponse?.responseId, 'initial_and_revised_response_separate', checks);
    check((await new IndexedDBLearningTaskAttemptRepository(databaseName)
      .getByInitialAttemptId(initial.initialAttemptId))?.status === 'revision_submitted', 'submitted_revision_recovers_after_repository_reopen', checks);
    check((await projections.listAll()).length === 1, 'revision_does_not_create_second_calibration_projection', checks);

    return {
      status: 'PASS',
      passed: checks.length,
      total: checks.length,
      databaseVersion: LEARNING_COLLECTION_DATABASE_VERSION,
      checks,
    };
  } finally {
    await deleteDatabase(databaseName);
  }
}

function attemptInput() {
  return {
    initialAttemptId: 'attempt-stage1-initial',
    studentId: 'student-local-primary-v1',
    learningSessionId: 'session-stage1-browser',
    learningRoundId: 'round-stage1-browser',
    operationId: 'operation-stage1-browser',
    materialVersionId: 'material-stage1-browser-v1',
    resourceId: 'resource-stage1-browser',
    resourceVersionId: 'resource-stage1-browser-v1',
    taskId: 'task-stage1-browser',
    taskRole: 'training' as const,
    rubricVersion: 'rubric-stage1-browser-v1',
    initialResponse: {
      responseId: 'response-stage1-browser-initial',
      executionSessionId: 'execution-stage1-browser',
      studentId: 'student-local-primary-v1',
      taskId: 'task-stage1-browser',
      answerText: '父亲舍不得离开，因为他很珍惜这段经历。',
      submittedAt: '2026-08-14T02:00:00.000Z',
      usedHint: false,
      hintCount: 0,
    },
    initialDiagnosisId: 'diagnosis-stage1-browser',
    initialDiagnosisSchemaVersion: 'formal_diagnosis_commit_v1',
    initialFeedbackId: 'feedback-stage1-browser',
    initialFeedbackSchemaVersion: 'controlled_feedback_expression_v1',
    createdAt: '2026-08-14T02:00:00.000Z',
  };
}

function goal(): RevisionGoal {
  return {
    primaryIssueCode: 'missing_text_evidence',
    relatedIssueCodes: ['missing_reasoning_relation'],
    instruction: '补充父亲行为对应的文本依据，并说明它为什么支持你的判断。',
    sourceDiagnosisId: 'diagnosis-stage1-browser',
    sourceFeedbackId: 'feedback-stage1-browser',
  };
}

function createVersionThreeDatabase(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 3);
    request.onupgradeneeded = () => {
      const legacy = request.result.createObjectStore('legacySentinel', { keyPath: 'id' });
      legacy.put({ id: 'v3-record', value: 'preserve-me' });
      const eventStore = request.result.createObjectStore(LEARNING_OBSERVATION_EVENT_STORE, { keyPath: 'eventId' });
      eventStore.createIndex('studentRound', ['studentId', 'learningRoundId']);
      eventStore.createIndex('resourceVersionId', 'resourceVersionId');
      eventStore.createIndex('eventType', 'eventType');
      eventStore.createIndex('studentId', 'studentId');
      eventStore.put(legacyEvent());
      const outboxStore = request.result.createObjectStore(LEARNING_OBSERVATION_OUTBOX_STORE, { keyPath: 'outboxId' });
      outboxStore.createIndex('eventId', 'eventId', { unique: true });
      outboxStore.createIndex('learningRoundId', 'learningRoundId');
      outboxStore.createIndex('nextRetryAt', 'nextRetryAt');
      outboxStore.createIndex('status', 'status');
      outboxStore.put(legacyOutbox());
      const projectionStore = request.result.createObjectStore(QUESTION_CALIBRATION_PROJECTION_STORE, { keyPath: 'projectionId' });
      projectionStore.createIndex('attemptId', 'attemptId', { unique: true });
      projectionStore.createIndex('studentRound', ['studentId', 'learningRoundId']);
      projectionStore.createIndex('resourceVersionStatus', ['resourceVersionId', 'status']);
      projectionStore.createIndex('status', 'status');
      projectionStore.createIndex('studentId', 'studentId');
      projectionStore.put(legacyProjection());
    };
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
  });
}

function legacyEvent(): LearningObservationEvent {
  return {
    schemaVersion: 'learning_observation_event_v1',
    eventId: 'event-stage1-v3',
    eventType: 'answer_submitted',
    occurredAt: '2026-08-13T02:00:00.000Z',
    recordedAt: '2026-08-13T02:00:00.000Z',
    runtimeScope: 'product',
    studentId: 'student-local-primary-v1',
    operationId: 'operation-stage1-v3',
    learningSessionId: 'session-stage1-v3',
    learningRoundId: 'round-stage1-v3',
    materialVersionId: 'material-stage1-v3',
    resourceId: 'resource-stage1-v3',
    resourceVersionId: 'resource-stage1-v3',
    taskId: 'task-stage1-v3',
    sourceEntityId: 'submission-stage1-v3',
    appVersion: 'real_learning_collection_v1',
    payload: {
      kind: 'answer_submitted',
      responseId: 'response-stage1-v3',
      attemptId: 'attempt-stage1-v3',
      submittedAt: '2026-08-13T02:00:00.000Z',
    },
  };
}

function legacyOutbox(): LearningObservationOutboxEntry {
  const event = legacyEvent();
  return {
    schemaVersion: 'learning_observation_outbox_v1',
    outboxId: 'outbox-stage1-v3',
    eventId: event.eventId,
    learningRoundId: event.learningRoundId,
    eventType: event.eventType,
    event,
    status: 'pending',
    retryCount: 0,
    nextRetryAt: '2099-01-01T00:00:00.000Z',
    createdAt: event.recordedAt,
    updatedAt: event.recordedAt,
  };
}

function legacyProjection(): QuestionCalibrationProjectionRecord {
  return {
    schemaVersion: 'question_calibration_projection_v1',
    projectionId: 'projection-stage1-v3',
    attemptId: 'attempt-stage1-v3',
    status: 'eligible',
    runtimeScope: 'product',
    studentId: 'student-local-primary-v1',
    operationId: 'operation-stage1-v3',
    learningSessionId: 'session-stage1-v3',
    learningRoundId: 'round-stage1-v3',
    responseId: 'response-stage1-v3',
    formalDiagnosisId: 'diagnosis-stage1-v3',
    resourceVersionId: 'resource-stage1-v3',
    itemScore: 0.5,
    itemScorePolicyVersion: 'rubric_required_equal_weight_v1',
    totalScoreStatus: 'unavailable_single_round',
    valid: true,
    completedAt: '2026-08-13T02:04:00.000Z',
    projectedAt: '2026-08-13T02:04:00.000Z',
    issues: [],
  };
}

function deleteDatabase(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Revision Stage 1 database cleanup blocked.'));
  });
}

function check(condition: boolean, name: string, checks: string[]): void {
  if (!condition) throw new Error(name);
  checks.push(name);
}
