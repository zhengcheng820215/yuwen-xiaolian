import { buildLearningObservationEventId } from '../agents/learningObservationIdentity.ts';
import {
  InMemoryLearningObservationOutboxRepository,
  InMemoryLearningObservationRepository,
} from '../repositories/inMemoryLearningCollectionRepositories.ts';
import type { LearningObservationRepository } from '../repositories/learningObservationRepository.ts';
import { LearningObservationService } from '../services/learningObservationService.ts';
import type { LearningObservationEvent, LearningObservationEventType } from '../schemas/learningObservationEvent.schema.ts';

const T0 = '2026-08-13T12:00:00.000Z';
const T1 = '2026-08-13T12:00:01.000Z';
const T3 = '2026-08-13T12:00:03.000Z';
const reports: Array<{ name: string; passed: boolean; detail: string }> = [];

async function main(): Promise<void> {
  let failuresRemaining = 1;
  const recoveredEvents = new InMemoryLearningObservationRepository();
  const flakyRepository: LearningObservationRepository = {
    save: async (event) => {
      if (failuresRemaining > 0) { failuresRemaining -= 1; throw new Error('transient_store_failure'); }
      return recoveredEvents.save(event);
    },
    getById: (eventId) => recoveredEvents.getById(eventId),
    listByStudent: (studentId) => recoveredEvents.listByStudent(studentId),
    listAll: () => recoveredEvents.listAll(),
    listByRound: (studentId, roundId) => recoveredEvents.listByRound(studentId, roundId),
    listByResourceVersion: (resourceVersionId) => recoveredEvents.listByResourceVersion(resourceVersionId),
    clear: () => recoveredEvents.clear(),
  };
  const outbox = new InMemoryLearningObservationOutboxRepository();
  const event = makeEvent('answer_submitted', 'submission-1');
  const service = new LearningObservationService(flakyRepository, outbox, () => T0);
  check('WP4-1 首次落盘失败进入 Outbox', await service.record(event) === 'queued', 'queued');
  check('WP4-2 Outbox 保留原始 occurredAt', (await outbox.listDue(T0))[0]?.event.occurredAt === T0, (await outbox.listDue(T0))[0]?.event.occurredAt || 'missing');
  const recovered = await service.retryDue(T0);
  check('WP4-3 到期重试成功', recovered.processed === 1 && recovered.succeeded === 1, JSON.stringify(recovered));
  check('WP4-4 成功后清除 Outbox 且事件只写一份', (await outbox.listDue(T3)).length === 0 && (await recoveredEvents.listByRound('student-local-primary-v1', 'round-1')).length === 1, 'outbox=0/events=1');
  check('WP4-5 重复恢复不产生重复事件', (await service.retryDue(T3)).processed === 0 && await service.record({ ...event, recordedAt: T3 }) === 'unchanged', 'unchanged');

  const alwaysFailing: LearningObservationRepository = {
    save: async () => { throw new Error('persistent_store_failure'); },
    getById: async () => undefined,
    listByStudent: async () => [],
    listAll: async () => [],
    listByRound: async () => [],
    listByResourceVersion: async () => [],
    clear: async () => {},
  };
  const retryOutbox = new InMemoryLearningObservationOutboxRepository();
  const retryService = new LearningObservationService(alwaysFailing, retryOutbox, () => T0, {
    maxRetryCount: 2,
    baseRetryDelayMs: 1_000,
    maxRetryDelayMs: 4_000,
  });
  await retryService.record(event);
  const firstRetry = await retryService.retryDue(T0);
  const afterFirst = (await retryOutbox.listDue(T3))[0];
  check('WP4-6 首次重试失败按指数退避重新排队', firstRetry.rescheduled === 1 && afterFirst?.retryCount === 1 && afterFirst.nextRetryAt === T1, afterFirst ? `${afterFirst.retryCount}/${afterFirst.nextRetryAt}` : 'missing');
  check('WP4-7 退避时间前不执行', (await retryService.retryDue('2026-08-13T12:00:00.500Z')).processed === 0, 'processed=0');
  const terminal = await retryService.retryDue(T1);
  const terminalEntry = await retryOutbox.getById(afterFirst.outboxId);
  check('WP4-8 达到上限转为终止失败', terminal.failed === 1 && terminalEntry?.status === 'failed' && terminalEntry.retryCount === 2, terminalEntry ? `${terminalEntry.status}/${terminalEntry.retryCount}` : 'missing');
  check('WP4-9 终止失败不再进入到期队列', (await retryOutbox.listDue(T3)).length === 0, 'due=0');

  const reconcileEvents = new InMemoryLearningObservationRepository();
  const reconcileService = new LearningObservationService(reconcileEvents, new InMemoryLearningObservationOutboxRepository(), () => T0);
  const candidates = [
    makeEvent('question_presented', 'presentation-1'),
    makeEvent('answer_submitted', 'submission-2'),
    makeEvent('diagnosis_completed', 'diagnosis-1'),
    makeEvent('feedback_presented', 'feedback-1'),
    makeEvent('learning_round_completed', 'persistence-1'),
  ];
  const reconciliation = await reconcileService.reconcileRound('round-1', candidates);
  const recoveredTypes = (await reconcileEvents.listByRound('student-local-primary-v1', 'round-1')).map((item) => item.eventType);
  check('WP4-10 只补写三类权威可推导事件', reconciliation.created === 3
    && reconciliation.dropped === 2
    && ['answer_submitted', 'diagnosis_completed', 'learning_round_completed'].every((type) => recoveredTypes.includes(type as LearningObservationEventType)), recoveredTypes.join('|'));
  const repeatedReconciliation = await reconcileService.reconcileRound('round-1', candidates);
  check('WP4-11 重复补录幂等', repeatedReconciliation.unchanged === 3 && repeatedReconciliation.dropped === 2, JSON.stringify(repeatedReconciliation));
  check('WP4-12 UI 可见事件不从后台结果反推', !recoveredTypes.includes('question_presented') && !recoveredTypes.includes('feedback_presented'), recoveredTypes.join('|'));

  console.log('\nReal Learning Minimum Collection WP4 Debug');
  console.log('='.repeat(78));
  reports.forEach((report) => { console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`); console.log(`       ${report.detail}`); });
  const passed = reports.filter((report) => report.passed).length;
  console.log('-'.repeat(78));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  if (passed !== reports.length) throw new Error('WP4 Debug failed.');
}

function makeEvent(eventType: LearningObservationEventType, sourceEntityId: string): LearningObservationEvent {
  const attemptId = 'attempt-1';
  const payloads: Record<LearningObservationEventType, LearningObservationEvent['payload']> = {
    question_presented: { kind: 'question_presented', presentationId: sourceEntityId },
    answer_submitted: { kind: 'answer_submitted', responseId: 'response-1', attemptId, submittedAt: T0 },
    diagnosis_completed: { kind: 'diagnosis_completed', responseId: 'response-1', attemptId, formalDiagnosisId: sourceEntityId, diagnosisSchemaVersion: 'formal_diagnosis_commit_v1' },
    feedback_presented: { kind: 'feedback_presented', responseId: 'response-1', attemptId, feedbackRequestId: sourceEntityId, feedbackSchemaVersion: 'controlled_feedback_expression_v1' },
    learning_round_completed: { kind: 'learning_round_completed', responseId: 'response-1', attemptId, persistenceRecordId: sourceEntityId, completedAt: T0 },
  };
  return {
    schemaVersion: 'learning_observation_event_v1',
    eventId: buildLearningObservationEventId({ schemaVersion: 'learning_observation_event_v1', eventType, studentId: 'student-local-primary-v1', learningSessionId: 'session-1', learningRoundId: 'round-1', sourceEntityId }),
    eventType, occurredAt: T0, recordedAt: T0, runtimeScope: 'product', studentId: 'student-local-primary-v1',
    operationId: 'operation-1', learningSessionId: 'session-1', learningRoundId: 'round-1', materialVersionId: 'material-version-1',
    resourceId: 'resource-1', resourceVersionId: 'resource-version-1', taskId: 'task-1', sourceEntityId, appVersion: 'wp4-debug', payload: payloads[eventType],
  };
}

function check(name: string, passed: boolean, detail: string): void { reports.push({ name, passed, detail }); }
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
