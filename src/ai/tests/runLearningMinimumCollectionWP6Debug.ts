import { LearningCollectionIntegrityService } from '../services/learningCollectionIntegrityService.ts';
import type { LearningCollectionIntegrityInput } from '../services/learningCollectionIntegrityService.ts';
import type { LearningObservationEvent, LearningObservationEventType } from '../schemas/learningObservationEvent.schema.ts';
import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';
import type { QuestionCalibrationProjectionRecord } from '../schemas/questionCalibrationProjection.schema.ts';
import type { RealLearningOperationCheckpoint } from '../schemas/realLearningOperation.schema.ts';
import { buildLearningCalibrationAttemptId, buildLearningSubmissionIntentId } from '../agents/learningObservationIdentity.ts';

const reports: Array<{ name: string; passed: boolean; detail: string }> = [];
const service = new LearningCollectionIntegrityService();
const ATTEMPT_ID = buildLearningCalibrationAttemptId({
  studentId: 'student-local-primary-v1', learningSessionId: 'session-1', learningRoundId: 'round-1',
  submissionIntentId: buildLearningSubmissionIntentId({ responseId: 'response-1', answerText: '有效回答' }),
});

function main(): void {
  const healthy = service.buildReport(fixture());
  check('WP6-1 正常完整链报告 pass', healthy.status === 'pass' && healthy.issues.length === 0, `${healthy.status}/${healthy.issues.length}`);
  check('WP6-2 正常计数闭合', healthy.totals.completedRounds === 1 && healthy.totals.submittedAttempts === 1 && healthy.totals.eligibleCalibrationAttempts === 1 && healthy.totals.independentSubjects === 1, JSON.stringify(healthy.totals));
  assertIssue('WP6-3 发现缺少题目展示', mutate((value) => { value.events = value.events.filter((event) => event.eventType !== 'question_presented'); }), 'missing_question_presented', 'warning');
  assertIssue('WP6-4 发现缺少答案提交', mutate((value) => { value.events = value.events.filter((event) => event.eventType !== 'answer_submitted'); }), 'missing_answer_submitted', 'fail');
  assertIssue('WP6-5 发现缺少诊断完成', mutate((value) => { value.events = value.events.filter((event) => event.eventType !== 'diagnosis_completed'); }), 'missing_diagnosis_completed', 'fail');
  assertIssue('WP6-6 发现缺少反馈展示', mutate((value) => { value.events = value.events.filter((event) => event.eventType !== 'feedback_presented'); }), 'missing_feedback_presented', 'warning');
  assertIssue('WP6-7 发现缺少轮次完成', mutate((value) => { value.events = value.events.filter((event) => event.eventType !== 'learning_round_completed'); }), 'missing_round_completed', 'fail');
  assertIssue('WP6-8 发现缺少 Projection', mutate((value) => { value.projections = []; }), 'missing_projection', 'fail');
  assertIssue('WP6-9 发现重复 Event', mutate((value) => { value.events.push({ ...value.events[0] }); }), 'duplicate_event', 'fail');
  assertIssue('WP6-10 发现重复 Projection', mutate((value) => { value.projections.push({ ...value.projections[0], projectionId: 'projection-duplicate' }); }), 'duplicate_projection', 'fail');
  assertIssue('WP6-11 发现资源版本错绑', mutate((value) => { value.events[1] = { ...value.events[1], resourceVersionId: 'resource-version-other' }; }), 'resource_version_mismatch', 'fail');
  assertIssue('WP6-12 发现身份链错绑', mutate((value) => { value.events[1] = { ...value.events[1], operationId: 'operation-other' }; }), 'identity_mismatch', 'fail');
  assertIssue('WP6-13 发现 Demo 泄漏', mutate((value) => { value.events.push({ ...value.events[0], eventId: 'event-demo', runtimeScope: 'demo', studentId: 'student-phase16-integration-demo' }); }), 'demo_scope_leak', 'fail');
  assertIssue('WP6-14 发现事实时间倒置', mutate((value) => { value.events[1] = { ...value.events[1], occurredAt: '2026-08-13T11:59:00.000Z' }; }), 'occurred_at_inversion', 'warning');
  assertIssue('WP6-15 发现未完成却 eligible', mutate((value) => { value.persistenceRecords = []; }), 'eligible_without_completed_round', 'fail');
  assertIssue('WP6-16 发现独立主体过计', mutate((value) => { value.claimedIndependentSampleCount = 2; }), 'independent_sample_overcount', 'fail');
  const warningOnly = service.buildReport(mutate((value) => { value.events = value.events.filter((event) => !['question_presented', 'feedback_presented'].includes(event.eventType)); }));
  check('WP6-17 只有 UI marker 缺失时为 warning', warningOnly.status === 'warning' && warningOnly.issues.every((issue) => issue.severity === 'warning'), `${warningOnly.status}/${warningOnly.issues.map((issue) => issue.code).join('|')}`);
  const failPriority = service.buildReport(mutate((value) => { value.events = []; }));
  check('WP6-18 fail 优先于 warning', failPriority.status === 'fail' && failPriority.issues.some((issue) => issue.severity === 'warning'), failPriority.status);

  console.log('\nReal Learning Minimum Collection WP6 Debug');
  console.log('='.repeat(78));
  reports.forEach((report) => { console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`); console.log(`       ${report.detail}`); });
  const passed = reports.filter((report) => report.passed).length;
  console.log('-'.repeat(78));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  if (passed !== reports.length) throw new Error('WP6 Debug failed.');
}

function assertIssue(name: string, input: LearningCollectionIntegrityInput, code: string, status: 'warning' | 'fail') {
  const report = service.buildReport(input);
  check(name, report.status === status && report.issues.some((issue) => issue.code === code), `${report.status}/${report.issues.map((issue) => issue.code).join('|')}`);
}

function mutate(change: (input: LearningCollectionIntegrityInput) => void): LearningCollectionIntegrityInput {
  const value = fixture();
  change(value);
  return value;
}

function fixture(): LearningCollectionIntegrityInput {
  return {
    studentId: 'student-local-primary-v1', generatedAt: '2026-08-13T12:10:00.000Z',
    checkpoints: [checkpoint()], persistenceRecords: [persistence()], events: eventChain(), projections: [projection()],
    questionPresentedRoundIds: ['round-1'], feedbackPresentedRoundIds: ['round-1'], claimedIndependentSampleCount: 1,
  };
}

function checkpoint(): RealLearningOperationCheckpoint {
  return {
    schemaVersion: 'real_learning_operation_v1', operationId: 'operation-1', learningSessionId: 'session-1', learningRoundId: 'round-1',
    studentId: 'student-local-primary-v1', stage: 'next_task_ready', status: 'completed', nextAction: 'start_next_task',
    sourceResourceId: 'resource-1', sourceResourceVersionId: 'resource-version-1', sourceTaskId: 'task-1', diagnosisRequestId: 'request-1',
    taskExecutionResult: {
      executionSessionId: 'execution-1', studentId: 'student-local-primary-v1', taskId: 'task-1', status: 'submitted_valid',
      studentResponse: { responseId: 'response-1', executionSessionId: 'execution-1', studentId: 'student-local-primary-v1', taskId: 'task-1', answerText: '有效回答', submittedAt: '2026-08-13T12:01:00.000Z', usedHint: false, hintCount: 0 },
      responseValidity: { responseId: 'response-1', status: 'valid', canDiagnose: true, reasons: [] }, usedHint: false, hintCount: 0, canEnterDiagnosisRuntime: true,
    },
    realDiagnosisRuntimeResult: {
      requestId: 'request-1', status: 'formal_result_committed', formalizationStatus: 'committed', canEnterEvidenceReturn: true,
      runRecord: { schemaVersion: 'diagnosis_run_record_v1', runId: 'run-1', requestId: 'request-1', studentId: 'student-local-primary-v1', taskId: 'task-1', executionSessionId: 'execution-1', responseId: 'response-1', executionMode: 'live', status: 'formal_result_committed', providerConfigId: 'provider-1', providerRequestIds: [], attemptCount: 1, repairOperations: [], promptVersion: 'v1', diagnosisSchemaVersion: 'v1', issues: [], startedAt: '2026-08-13T12:01:00.000Z', completedAt: '2026-08-13T12:02:00.000Z' },
      formalDiagnosisCommit: { schemaVersion: 'formal_diagnosis_commit_v1', formalDiagnosisId: 'diagnosis-1', requestId: 'request-1', runId: 'run-1', status: 'committed', committedAt: '2026-08-13T12:02:00.000Z', validation: { passed: true, issues: [] } },
      validation: { passed: true, schemaValid: true, identityAligned: true, semanticBoundaryPassed: true, promptLeakagePassed: true, issues: [] },
    }, issues: [], createdAt: '2026-08-13T12:00:00.000Z', updatedAt: '2026-08-13T12:05:00.000Z',
  };
}

function persistence(): LearningPersistenceRecord {
  return { recordId: 'persistence-1', studentId: 'student-local-primary-v1', learningRoundId: 'round-1', savedAt: '2026-08-13T12:04:00.000Z', updatedAt: '2026-08-13T12:04:00.000Z', version: 'phase12_1_v1', schemaVersion: 'learning_persistence_v1', learningRoundResult: { status: 'completed' } as LearningPersistenceRecord['learningRoundResult'], status: 'saved', issues: [] };
}

function eventChain(): LearningObservationEvent[] {
  const types: LearningObservationEventType[] = ['question_presented', 'answer_submitted', 'diagnosis_completed', 'feedback_presented', 'learning_round_completed'];
  return types.map((type, index) => ({
    schemaVersion: 'learning_observation_event_v1', eventId: `event-${type}`, eventType: type, occurredAt: `2026-08-13T12:0${index}:00.000Z`, recordedAt: `2026-08-13T12:0${index}:00.000Z`, runtimeScope: 'product', studentId: 'student-local-primary-v1', operationId: 'operation-1', learningSessionId: 'session-1', learningRoundId: 'round-1', materialVersionId: 'material-version-1', resourceId: 'resource-1', resourceVersionId: 'resource-version-1', taskId: 'task-1', sourceEntityId: `source-${type}`,
    appVersion: 'wp6-debug', payload: payload(type),
  }));
}

function payload(type: LearningObservationEventType): LearningObservationEvent['payload'] {
  const attemptId = ATTEMPT_ID;
  if (type === 'question_presented') return { kind: type, presentationId: 'presentation-1' };
  if (type === 'answer_submitted') return { kind: type, responseId: 'response-1', attemptId, submittedAt: '2026-08-13T12:01:00.000Z' };
  if (type === 'diagnosis_completed') return { kind: type, responseId: 'response-1', attemptId, formalDiagnosisId: 'diagnosis-1', diagnosisSchemaVersion: 'v1' };
  if (type === 'feedback_presented') return { kind: type, responseId: 'response-1', attemptId, feedbackRequestId: 'feedback-1', feedbackSchemaVersion: 'v1' };
  return { kind: type, responseId: 'response-1', attemptId, persistenceRecordId: 'persistence-1', completedAt: '2026-08-13T12:04:00.000Z' };
}

function projection(): QuestionCalibrationProjectionRecord {
  return { schemaVersion: 'question_calibration_projection_v1', projectionId: 'projection-1', attemptId: ATTEMPT_ID, status: 'eligible', runtimeScope: 'product', studentId: 'student-local-primary-v1', operationId: 'operation-1', learningSessionId: 'session-1', learningRoundId: 'round-1', responseId: 'response-1', formalDiagnosisId: 'diagnosis-1', resourceVersionId: 'resource-version-1', itemScore: 0.75, itemScorePolicyVersion: 'rubric_required_equal_weight_v1', totalScoreStatus: 'unavailable_single_round', valid: true, completedAt: '2026-08-13T12:04:00.000Z', projectedAt: '2026-08-13T12:04:00.000Z', issues: [] };
}

function check(name: string, passed: boolean, detail: string): void { reports.push({ name, passed, detail }); }
main();
