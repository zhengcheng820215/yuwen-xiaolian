import { buildLearningCalibrationAttemptId, buildLearningObservationEventId, buildLearningSubmissionIntentId } from '../agents/learningObservationIdentity.ts';
import {
  InMemoryLearningObservationOutboxRepository,
  InMemoryLearningObservationRepository,
} from '../repositories/inMemoryLearningCollectionRepositories.ts';
import type { LearningObservationRepository } from '../repositories/learningObservationRepository.ts';
import { LearningObservationService } from '../services/learningObservationService.ts';
import type { LearningObservationEvent, LearningObservationEventType } from '../schemas/learningObservationEvent.schema.ts';

const NOW = '2026-08-13T12:00:00.000Z';
const reports: Array<{ name: string; passed: boolean; detail: string }> = [];

async function main(): Promise<void> {
  const events = new InMemoryLearningObservationRepository();
  const outbox = new InMemoryLearningObservationOutboxRepository();
  const service = new LearningObservationService(events, outbox, () => NOW);
  const attemptId = buildLearningCalibrationAttemptId({
    studentId: 'student-local-primary-v1', learningSessionId: 'session-1', learningRoundId: 'round-1', submissionIntentId: 'submission-1',
  });
  const chain: LearningObservationEvent[] = [
    makeEvent('question_presented', 'presentation-1', { kind: 'question_presented', presentationId: 'presentation-1' }),
    makeEvent('answer_submitted', 'response-1', { kind: 'answer_submitted', responseId: 'response-1', attemptId, submittedAt: NOW }),
    makeEvent('diagnosis_completed', 'diagnosis-1', { kind: 'diagnosis_completed', responseId: 'response-1', attemptId, formalDiagnosisId: 'diagnosis-1', diagnosisSchemaVersion: 'formal_diagnosis_commit_v1' }),
    makeEvent('feedback_presented', 'feedback-1', { kind: 'feedback_presented', responseId: 'response-1', attemptId, feedbackRequestId: 'feedback-1', feedbackSchemaVersion: 'controlled_feedback_expression_v1' }),
    makeEvent('learning_round_completed', 'persistence-1', { kind: 'learning_round_completed', responseId: 'response-1', attemptId, persistenceRecordId: 'persistence-1', completedAt: NOW }),
  ];
  const statuses = await Promise.all(chain.map((event) => service.record(event)));
  check('WP3-1 正常轮次形成五事件', statuses.every((status) => status === 'created'), statuses.join('|'));
  check('WP3-2 五事件共享同一稳定 Attempt',
    chain.slice(1).every((event) => 'attemptId' in event.payload && event.payload.attemptId === attemptId), attemptId);
  const repeated = await Promise.all(chain.map((event) => service.record({ ...event, recordedAt: '2026-08-13T12:01:00.000Z' })));
  check('WP3-3 刷新重记全部 unchanged', repeated.every((status) => status === 'unchanged'), repeated.join('|'));
  check('WP3-4 Round 查询仍只有五条', (await events.listByRound('student-local-primary-v1', 'round-1')).length === 5, 'count=5');

  const invalidEvents = new InMemoryLearningObservationRepository();
  const invalidService = new LearningObservationService(invalidEvents, new InMemoryLearningObservationOutboxRepository(), () => NOW);
  await invalidService.record(chain[0]);
  await invalidService.record(chain[1]);
  const invalidTypes = (await invalidEvents.listByRound('student-local-primary-v1', 'round-1')).map((event) => event.eventType);
  check('WP3-5 无效作答只形成展示与提交事件',
    invalidTypes.length === 2
      && invalidTypes.includes('question_presented')
      && invalidTypes.includes('answer_submitted'),
    invalidTypes.join('|'));

  const failingRepository: LearningObservationRepository = {
    save: async () => { throw new Error('simulated_event_store_failure'); },
    getById: async () => undefined,
    listByStudent: async () => [],
    listAll: async () => [],
    listByRound: async () => [],
    listByResourceVersion: async () => [],
    clear: async () => {},
  };
  const failureOutbox = new InMemoryLearningObservationOutboxRepository();
  const nonBlockingService = new LearningObservationService(failingRepository, failureOutbox, () => NOW);
  const queued = await nonBlockingService.record(chain[1]);
  check('WP3-6 Event Store 失败转入 Outbox', queued === 'queued', queued);
  check('WP3-7 Outbox 记录稳定 Event 身份与错误',
    (await failureOutbox.listDue(NOW))[0]?.eventId === chain[1].eventId
      && (await failureOutbox.listDue(NOW))[0]?.lastError === 'simulated_event_store_failure',
    (await failureOutbox.listDue(NOW))[0]?.lastError || 'missing');
  const bad = { ...chain[0], runtimeScope: 'demo', studentId: 'student-phase16-integration-demo' };
  check('WP3-8 Demo 事件被 Service 丢弃且不进入 Outbox',
    await service.record(bad as unknown as LearningObservationEvent) === 'dropped'
      && (await outbox.listDue(NOW)).length === 0,
    'dropped');
  const firstIntent = buildLearningSubmissionIntentId({ responseId: 'response-1', answerText: '不知道' });
  const revisedIntent = buildLearningSubmissionIntentId({ responseId: 'response-1', answerText: '结合材料形成的有效回答。' });
  check('WP3-9 修改答案形成新提交意图，同答案刷新保持稳定',
    firstIntent !== revisedIntent
      && revisedIntent === buildLearningSubmissionIntentId({ responseId: 'response-1', answerText: '  结合材料形成的有效回答。  ' }),
    `${firstIntent}/${revisedIntent}`);

  console.log('\nReal Learning Minimum Collection WP3 Debug');
  console.log('='.repeat(78));
  reports.forEach((report) => { console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`); console.log(`       ${report.detail}`); });
  const passed = reports.filter((report) => report.passed).length;
  console.log('-'.repeat(78));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  if (passed !== reports.length) throw new Error('WP3 Debug failed.');
}

function makeEvent(eventType: LearningObservationEventType, sourceEntityId: string, payload: LearningObservationEvent['payload']): LearningObservationEvent {
  return {
    schemaVersion: 'learning_observation_event_v1',
    eventId: buildLearningObservationEventId({ schemaVersion: 'learning_observation_event_v1', eventType, studentId: 'student-local-primary-v1', learningSessionId: 'session-1', learningRoundId: 'round-1', sourceEntityId }),
    eventType, occurredAt: NOW, recordedAt: NOW, runtimeScope: 'product', studentId: 'student-local-primary-v1',
    operationId: 'operation-1', learningSessionId: 'session-1', learningRoundId: 'round-1', materialVersionId: 'material-version-1',
    resourceId: 'resource-1', resourceVersionId: 'resource-version-1', taskId: 'task-1', sourceEntityId, appVersion: 'wp3-debug', payload,
  };
}

function check(name: string, passed: boolean, detail: string): void { reports.push({ name, passed, detail }); }
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
