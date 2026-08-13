import {
  buildLearningCalibrationAttemptId,
  buildLearningObservationEventId,
  buildQuestionCalibrationProjectionId,
  buildQuestionPresentationId,
} from '../agents/learningObservationIdentity.ts';
import { calibrateQuestionFromAnonymousAttempts } from '../agents/questionEmpiricalCalibrationAgent.ts';
import {
  LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION,
  validateLearningObservationEvent,
  type LearningObservationEvent,
} from '../schemas/learningObservationEvent.schema.ts';
import { resolveLearningCollectionIntegrityStatus } from '../schemas/learningCollectionIntegrity.schema.ts';
import {
  QUESTION_CALIBRATION_ITEM_SCORE_POLICY_VERSION,
  QUESTION_CALIBRATION_PROJECTION_SCHEMA_VERSION,
  validateQuestionCalibrationProjectionRecord,
  type QuestionCalibrationProjectionRecord,
} from '../schemas/questionCalibrationProjection.schema.ts';

const NOW = '2026-08-13T12:00:00.000Z';
const reports: Array<{ name: string; passed: boolean; detail: string }> = [];

const identityInput = {
  studentId: 'student-local-primary-v1',
  learningSessionId: 'session-1',
  learningRoundId: 'round-1',
  responseId: 'response-execution-1',
  submissionIntentId: 'submission-execution-1',
};
const attemptId = buildLearningCalibrationAttemptId(identityInput);
check('WP1-1 相同提交输入生成稳定 attemptId',
  attemptId === buildLearningCalibrationAttemptId(identityInput), attemptId);
check('WP1-2 不同 Round 生成不同 attemptId',
  attemptId !== buildLearningCalibrationAttemptId({ ...identityInput, learningRoundId: 'round-2' }), attemptId);

const presentationId = buildQuestionPresentationId({
  studentId: identityInput.studentId,
  learningRoundId: identityInput.learningRoundId,
  resourceVersionId: 'resource-version-1',
});
const eventId = buildLearningObservationEventId({
  schemaVersion: LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION,
  eventType: 'question_presented',
  studentId: identityInput.studentId,
  learningSessionId: identityInput.learningSessionId,
  learningRoundId: identityInput.learningRoundId,
  sourceEntityId: presentationId,
});
check('WP1-3 时间不参与 eventId', eventId === buildLearningObservationEventId({
  schemaVersion: LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION,
  eventType: 'question_presented',
  studentId: identityInput.studentId,
  learningSessionId: identityInput.learningSessionId,
  learningRoundId: identityInput.learningRoundId,
  sourceEntityId: presentationId,
}), eventId);

const event: LearningObservationEvent = {
  schemaVersion: LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION,
  eventId,
  eventType: 'question_presented',
  occurredAt: NOW,
  recordedAt: NOW,
  runtimeScope: 'product',
  studentId: 'student-local-primary-v1',
  operationId: 'operation-1',
  learningSessionId: 'session-1',
  learningRoundId: 'round-1',
  materialVersionId: 'material-version-1',
  resourceId: 'resource-1',
  resourceVersionId: 'resource-version-1',
  taskId: 'task-1',
  sourceEntityId: presentationId,
  appVersion: 'debug-build',
  payload: { kind: 'question_presented', presentationId },
};
check('WP1-4 合法 Product Event 通过 Schema 校验',
  validateLearningObservationEvent(event).passed, validateLearningObservationEvent(event).issues.join('|') || 'passed');
const mismatchedEvent = {
  ...event,
  eventType: 'answer_submitted',
};
check('WP1-5 Event Type 与 Payload 不一致被拒绝',
  validateLearningObservationEvent(mismatchedEvent).issues.includes('event_payload_kind_mismatch'),
  validateLearningObservationEvent(mismatchedEvent).issues.join('|'));
const demoEvent = { ...event, runtimeScope: 'demo', studentId: 'student-phase16-integration-demo' };
const demoValidation = validateLearningObservationEvent(demoEvent);
check('WP1-6 Demo 身份不能进入 Product Event',
  !demoValidation.passed && demoValidation.issues.includes('non_product_runtime_scope'), demoValidation.issues.join('|'));

const projectionId = buildQuestionCalibrationProjectionId({
  schemaVersion: QUESTION_CALIBRATION_PROJECTION_SCHEMA_VERSION,
  attemptId,
});
const projection: QuestionCalibrationProjectionRecord = {
  schemaVersion: QUESTION_CALIBRATION_PROJECTION_SCHEMA_VERSION,
  projectionId,
  attemptId,
  status: 'eligible',
  runtimeScope: 'product',
  studentId: identityInput.studentId,
  operationId: 'operation-1',
  learningSessionId: identityInput.learningSessionId,
  learningRoundId: identityInput.learningRoundId,
  responseId: identityInput.responseId,
  formalDiagnosisId: 'formal-diagnosis-1',
  resourceVersionId: 'resource-version-1',
  itemScore: 0.75,
  itemScorePolicyVersion: QUESTION_CALIBRATION_ITEM_SCORE_POLICY_VERSION,
  totalScoreStatus: 'unavailable_single_round',
  valid: true,
  completedAt: NOW,
  projectedAt: NOW,
  issues: [],
};
check('WP1-7 单学生 eligible Projection 无 totalScore 时合法',
  validateQuestionCalibrationProjectionRecord(projection).passed,
  validateQuestionCalibrationProjectionRecord(projection).issues.join('|') || 'passed');
const fabricatedTotal = validateQuestionCalibrationProjectionRecord({ ...projection, totalScore: 0.75 });
check('WP1-8 单轮 Projection 伪造 totalScore 被拒绝',
  fabricatedTotal.issues.includes('unexpected_total_score'), fabricatedTotal.issues.join('|'));
const demoProjection = validateQuestionCalibrationProjectionRecord({
  ...projection,
  runtimeScope: 'demo',
  studentId: 'student-phase16-integration-demo',
});
check('WP1-9 Demo Projection 不能标记 eligible',
  demoProjection.issues.includes('eligible_non_product_scope'), demoProjection.issues.join('|'));

const resourceVersionId = 'resource-version-1';
const singleStudentAttempts = Array.from({ length: 30 }, (_, index) => ({
  attemptId: `attempt-${index}`,
  subjectKey: 'subject-local-primary',
  resourceVersionId,
  itemScore: index % 2,
  itemScorePolicyVersion: QUESTION_CALIBRATION_ITEM_SCORE_POLICY_VERSION,
  totalScoreStatus: 'unavailable_single_round' as const,
  valid: true as const,
  completedAt: NOW,
}));
const singleStudentReport = calibrateQuestionFromAnonymousAttempts({
  resourceVersionId,
  attempts: singleStudentAttempts,
  generatedAt: NOW,
});
check('WP1-10 同一学生30次作答不伪装成30个独立样本',
  singleStudentReport.status === 'insufficient_sample'
    && singleStudentReport.sampleSize === 30
    && singleStudentReport.independentSubjectCount === 1,
  `${singleStudentReport.status}/${singleStudentReport.sampleSize}/${singleStudentReport.independentSubjectCount}`);

const independentAttempts = Array.from({ length: 30 }, (_, index) => ({
  ...singleStudentAttempts[index],
  subjectKey: `subject-${index}`,
}));
const noTotalReport = calibrateQuestionFromAnonymousAttempts({
  resourceVersionId,
  attempts: independentAttempts,
  generatedAt: NOW,
});
check('WP1-11 足量独立样本可算均分但不伪造区分度',
  noTotalReport.status === 'calibrated'
    && noTotalReport.meanItemScore === 0.5
    && noTotalReport.highLowDiscrimination === undefined,
  `${noTotalReport.status}/${noTotalReport.meanItemScore}/${String(noTotalReport.highLowDiscrimination)}`);

const compatibleLegacy = calibrateQuestionFromAnonymousAttempts({
  resourceVersionId,
  generatedAt: NOW,
  attempts: Array.from({ length: 30 }, (_, index) => ({
    attemptId: `legacy-${index}`,
    resourceVersionId,
    itemScore: index >= 15 ? 1 : 0,
    totalScore: index,
    valid: true,
    completedAt: NOW,
  })),
});
check('WP1-12 v1 历史输入可读取但不伪装独立主体',
  compatibleLegacy.status === 'insufficient_sample'
    && compatibleLegacy.sampleSize === 30
    && compatibleLegacy.independentSubjectCount === 1,
  `${compatibleLegacy.status}/${compatibleLegacy.sampleSize}/${compatibleLegacy.independentSubjectCount}`);

check('WP1-13 完整性状态按 fail 优先级解析',
  resolveLearningCollectionIntegrityStatus([
    { code: 'missing_feedback_presented', severity: 'warning', sourceIds: [], message: 'warning' },
    { code: 'demo_scope_leak', severity: 'fail', sourceIds: [], message: 'fail' },
  ]) === 'fail', 'fail');

console.log('\nReal Learning Minimum Collection WP1 Debug');
console.log('='.repeat(78));
for (const report of reports) {
  console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`);
  console.log(`       ${report.detail}`);
}
const passed = reports.filter((report) => report.passed).length;
console.log('-'.repeat(78));
console.log(`Result: ${passed} / ${reports.length} PASS`);
console.log('Runtime integration: intentionally not connected in WP1.');
if (passed !== reports.length) throw new Error('Real Learning Minimum Collection WP1 Debug failed.');

function check(name: string, passed: boolean, detail: string): void {
  reports.push({ name, passed, detail });
}
