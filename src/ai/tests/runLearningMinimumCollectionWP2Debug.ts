import {
  InMemoryLearningObservationOutboxRepository,
  InMemoryLearningObservationRepository,
  InMemoryQuestionCalibrationProjectionRepository,
} from '../repositories/inMemoryLearningCollectionRepositories.ts';
import type { LearningObservationEvent } from '../schemas/learningObservationEvent.schema.ts';
import type { LearningObservationOutboxEntry } from '../schemas/learningObservationOutbox.schema.ts';
import type { QuestionCalibrationProjectionRecord } from '../schemas/questionCalibrationProjection.schema.ts';

const NOW = '2026-08-13T12:00:00.000Z';
const LATER = '2026-08-13T12:05:00.000Z';
const reports: Array<{ name: string; passed: boolean; detail: string }> = [];

async function main(): Promise<void> {
  const events = new InMemoryLearningObservationRepository();
  const first = event('event-1', 'round-1', 'resource-version-1', NOW);
  const created = await events.save(first);
  check('WP2-1 Event 首次写入 created', created.status === 'created', created.status);
  const unchanged = await events.save({ ...first, recordedAt: LATER });
  check('WP2-2 仅 recordedAt 不同仍 unchanged 且保留首条',
    unchanged.status === 'unchanged' && unchanged.event.recordedAt === NOW,
    `${unchanged.status}/${unchanged.event.recordedAt}`);
  const conflict = await events.save({ ...first, taskId: 'task-conflict' });
  check('WP2-3 同 eventId 业务内容不同 conflict 且不覆盖',
    conflict.status === 'conflict' && (await events.getById(first.eventId))?.taskId === 'task-1',
    `${conflict.status}/${conflict.issues.join('|')}`);
  await events.save(event('event-2', 'round-1', 'resource-version-2', LATER));
  check('WP2-4 Event 可按 Student + Round 查询',
    (await events.listByRound('student-local-primary-v1', 'round-1')).length === 2, 'count=2');
  check('WP2-5 Event 可按 Resource Version 查询',
    (await events.listByResourceVersion('resource-version-1')).length === 1, 'count=1');
  const cloned = await events.getById('event-1');
  if (cloned) cloned.taskId = 'mutated-outside';
  check('WP2-6 Repository 返回副本，不允许外部静默修改',
    (await events.getById('event-1'))?.taskId === 'task-1', 'taskId=task-1');

  const outbox = new InMemoryLearningObservationOutboxRepository();
  const pending = outboxEntry(first);
  check('WP2-7 Outbox 首次写入 created', (await outbox.save(pending)).status === 'created', 'created');
  check('WP2-8 相同 Outbox unchanged', (await outbox.save(pending)).status === 'unchanged', 'unchanged');
  const retrying = { ...pending, status: 'retrying' as const, retryCount: 1, updatedAt: LATER };
  check('WP2-9 同身份 Outbox 可更新重试状态', (await outbox.save(retrying)).status === 'updated', 'updated');
  const outboxConflict = await outbox.save({ ...retrying, eventId: 'event-other', event: { ...first, eventId: 'event-other' } });
  check('WP2-10 Outbox 身份变化 conflict', outboxConflict.status === 'conflict', outboxConflict.status);
  check('WP2-11 Outbox 可按 nextRetryAt 查询', (await outbox.listDue(LATER)).length === 1, 'due=1');
  await outbox.delete(pending.outboxId);
  check('WP2-12 Outbox 删除幂等', !(await outbox.getById(pending.outboxId)), 'missing');

  const projections = new InMemoryQuestionCalibrationProjectionRepository();
  const projection = eligibleProjection('projection-1', 'attempt-1', 'round-1', 'resource-version-1');
  check('WP2-13 Projection 首次写入 created', (await projections.save(projection)).status === 'created', 'created');
  check('WP2-14 相同 Projection unchanged', (await projections.save(projection)).status === 'unchanged', 'unchanged');
  const projectionConflict = await projections.save({ ...projection, itemScore: 0.5 });
  check('WP2-15 同 projectionId 不同内容 conflict 且不覆盖',
    projectionConflict.status === 'conflict' && (await projections.getByAttemptId('attempt-1'))?.itemScore === 0.75,
    projectionConflict.status);
  const duplicateAttempt = await projections.save({ ...projection, projectionId: 'projection-other' });
  check('WP2-16 同 attemptId 不同 projectionId 被拒绝',
    duplicateAttempt.status === 'conflict' && duplicateAttempt.issues.includes('question_calibration_attempt_identity_conflict'),
    duplicateAttempt.issues.join('|'));
  await projections.save(eligibleProjection('projection-2', 'attempt-2', 'round-2', 'resource-version-1'));
  await projections.save({
    ...eligibleProjection('projection-3', 'attempt-3', 'round-1', 'resource-version-1'),
    status: 'excluded_invalid_response',
    valid: false,
    itemScore: undefined,
    itemScorePolicyVersion: undefined,
    formalDiagnosisId: undefined,
    completedAt: undefined,
  });
  check('WP2-17 Projection 可按 Round 查询',
    (await projections.listByRound('student-local-primary-v1', 'round-1')).length === 2, 'count=2');
  check('WP2-18 版本查询只返回 eligible Projection',
    (await projections.listEligibleByResourceVersion('resource-version-1')).length === 2, 'eligible=2');

  await Promise.all([events.clear(), outbox.clear(), projections.clear()]);
  check('WP2-19 clear 只清理各自 Repository',
    (await events.listByRound('student-local-primary-v1', 'round-1')).length === 0
      && (await projections.listEligibleByResourceVersion('resource-version-1')).length === 0,
    'empty');

  console.log('\nReal Learning Minimum Collection WP2 Repository Debug');
  console.log('='.repeat(78));
  reports.forEach((report) => {
    console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`);
    console.log(`       ${report.detail}`);
  });
  const passed = reports.filter((report) => report.passed).length;
  console.log('-'.repeat(78));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  console.log('Storage mode: isolated in-memory repository contract debug.');
  if (passed !== reports.length) throw new Error('Real Learning Minimum Collection WP2 Debug failed.');
}

function event(eventId: string, roundId: string, resourceVersionId: string, time: string): LearningObservationEvent {
  return {
    schemaVersion: 'learning_observation_event_v1',
    eventId,
    eventType: 'question_presented',
    occurredAt: time,
    recordedAt: time,
    runtimeScope: 'product',
    studentId: 'student-local-primary-v1',
    operationId: `operation-${roundId}`,
    learningSessionId: 'session-1',
    learningRoundId: roundId,
    materialVersionId: 'material-version-1',
    resourceId: 'resource-1',
    resourceVersionId,
    taskId: 'task-1',
    sourceEntityId: `presentation-${eventId}`,
    appVersion: 'wp2-debug',
    payload: { kind: 'question_presented', presentationId: `presentation-${eventId}` },
  };
}

function outboxEntry(sourceEvent: LearningObservationEvent): LearningObservationOutboxEntry {
  return {
    schemaVersion: 'learning_observation_outbox_v1',
    outboxId: 'outbox-event-1',
    eventId: sourceEvent.eventId,
    learningRoundId: sourceEvent.learningRoundId,
    eventType: sourceEvent.eventType,
    event: sourceEvent,
    status: 'pending',
    retryCount: 0,
    nextRetryAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function eligibleProjection(
  projectionId: string,
  attemptId: string,
  roundId: string,
  resourceVersionId: string,
): QuestionCalibrationProjectionRecord {
  return {
    schemaVersion: 'question_calibration_projection_v1',
    projectionId,
    attemptId,
    status: 'eligible',
    runtimeScope: 'product',
    studentId: 'student-local-primary-v1',
    operationId: `operation-${roundId}`,
    learningSessionId: 'session-1',
    learningRoundId: roundId,
    responseId: `response-${attemptId}`,
    formalDiagnosisId: `diagnosis-${attemptId}`,
    resourceVersionId,
    itemScore: 0.75,
    itemScorePolicyVersion: 'rubric_required_equal_weight_v1',
    totalScoreStatus: 'unavailable_single_round',
    valid: true,
    completedAt: NOW,
    projectedAt: NOW,
    issues: [],
  };
}

function check(name: string, passed: boolean, detail: string): void {
  reports.push({ name, passed, detail });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
