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
const INVALID_ATTEMPT_ID = buildLearningCalibrationAttemptId({
  studentId: 'student-local-primary-v1', learningSessionId: 'session-1', learningRoundId: 'round-1',
  submissionIntentId: buildLearningSubmissionIntentId({ responseId: 'response-invalid', answerText: '无效回答' }),
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
  const mixed = mixedHistoryFixture();
  const currentOnly = service.buildReport({ ...mixed, scope: 'current_collection' });
  check('WP6-19 当前范围不受旧历史 FAIL 污染', currentOnly.status === 'pass' && currentOnly.issues.length === 0, `${currentOnly.status}/${currentOnly.issues.length}`);
  check('WP6-20 当前范围返回代际和范围计数', currentOnly.scope === 'current_collection' && currentOnly.scopeTotals.includedRounds === 1 && currentOnly.scopeTotals.currentCollectionRounds === 1 && currentOnly.scopeTotals.legacyRounds === 1, `${currentOnly.scope}/${JSON.stringify(currentOnly.scopeTotals)}`);
  const allHistory = service.buildReport({ ...mixed, scope: 'all_history' });
  check('WP6-21 全部历史继续保留旧轮次 FAIL', allHistory.status === 'fail' && allHistory.issues.some((issue) => issue.learningRoundId === 'round-legacy'), `${allHistory.status}/${allHistory.issues.map((issue) => issue.code).join('|')}`);
  const emptyCurrent = service.buildReport({ ...legacyOnlyFixture(), scope: 'current_collection' });
  check('WP6-22 当前范围为空时返回零纳入轮次', emptyCurrent.scopeTotals.includedRounds === 0 && emptyCurrent.totals.roundsWithFormalQuestion === 0, JSON.stringify(emptyCurrent.scopeTotals));
  const brokenCurrent = currentFixture();
  brokenCurrent.events = [];
  brokenCurrent.projections = [];
  const brokenCurrentReport = service.buildReport({ ...brokenCurrent, scope: 'current_collection' });
  check('WP6-23 当前轮次采集失败不会被误归历史', brokenCurrentReport.status === 'fail' && brokenCurrentReport.scopeTotals.includedRounds === 1 && brokenCurrentReport.issues.some((issue) => issue.code === 'missing_answer_submitted'), `${brokenCurrentReport.status}/${brokenCurrentReport.scopeTotals.includedRounds}`);
  const retried = invalidThenValidFixture();
  const retriedReport = service.buildReport(retried);
  check('WP6-24 同轮无效后有效提交分别闭合', retriedReport.status === 'pass' && retriedReport.totals.submittedAttempts === 2 && retriedReport.totals.eligibleCalibrationAttempts === 1 && retriedReport.totals.excludedCalibrationAttempts === 1, `${retriedReport.status}/${JSON.stringify(retriedReport.totals)}`);
  const missingEarlyProjection = invalidThenValidFixture();
  missingEarlyProjection.projections = missingEarlyProjection.projections.filter((record) => record.attemptId !== INVALID_ATTEMPT_ID);
  const missingEarlyProjectionReport = service.buildReport(missingEarlyProjection);
  check('WP6-25 早期提交缺少 Projection 可被发现', missingEarlyProjectionReport.status === 'fail' && missingEarlyProjectionReport.issues.some((issue) => issue.code === 'missing_projection' && issue.attemptId === INVALID_ATTEMPT_ID), missingEarlyProjectionReport.issues.map((issue) => `${issue.code}:${issue.attemptId}`).join('|'));
  const earlierOnly = invalidThenValidFixture();
  earlierOnly.events = earlierOnly.events.filter((event) => !(event.eventType === 'answer_submitted' && event.payload.kind === 'answer_submitted' && event.payload.attemptId === ATTEMPT_ID));
  const earlierOnlyReport = service.buildReport(earlierOnly);
  check('WP6-26 早期提交不能掩盖最终提交事件缺失', earlierOnlyReport.status === 'fail' && earlierOnlyReport.issues.some((issue) => issue.code === 'missing_answer_submitted' && issue.attemptId === ATTEMPT_ID), earlierOnlyReport.issues.map((issue) => `${issue.code}:${issue.attemptId}`).join('|'));
  const failedProjection = invalidThenValidFixture();
  failedProjection.projections = failedProjection.projections.map((record) => record.attemptId === INVALID_ATTEMPT_ID ? { ...record, status: 'projection_failed', issues: ['projection_identity_failure'] } : record);
  const failedProjectionReport = service.buildReport(failedProjection);
  check('WP6-27 projection_failed 计入闭合等式', failedProjectionReport.status === 'pass' && failedProjectionReport.totals.submittedAttempts === 2 && failedProjectionReport.totals.projectionFailedAttempts === 1 && failedProjectionReport.totals.excludedCalibrationAttempts === 0, `${failedProjectionReport.status}/${JSON.stringify(failedProjectionReport.totals)}`);
  const orphanProjection = fixture();
  orphanProjection.projections.push({ ...orphanProjection.projections[0], projectionId: 'projection-orphan', attemptId: 'attempt-orphan', responseId: 'response-orphan', status: 'excluded_invalid_response', itemScore: undefined, itemScorePolicyVersion: undefined, formalDiagnosisId: undefined, completedAt: undefined, valid: false, issues: ['excluded_invalid_response'] });
  const orphanProjectionReport = service.buildReport(orphanProjection);
  check('WP6-28 无提交事件的 Projection 触发身份错误', orphanProjectionReport.status === 'fail' && orphanProjectionReport.issues.some((issue) => issue.code === 'identity_mismatch' && issue.attemptId === 'attempt-orphan'), orphanProjectionReport.issues.map((issue) => `${issue.code}:${issue.attemptId}`).join('|'));
  const repeatedSubjectReport = service.buildReport(repeatedSubjectFixture());
  check('WP6-29 同一学生多轮只计一个独立对象', repeatedSubjectReport.status === 'pass' && repeatedSubjectReport.totals.completedRounds === 2 && repeatedSubjectReport.totals.eligibleCalibrationAttempts === 2 && repeatedSubjectReport.totals.independentSubjects === 1, `${repeatedSubjectReport.status}/${JSON.stringify(repeatedSubjectReport.totals)}`);
  const trialScoped = service.buildReport({
    ...mixed,
    scope: 'current_collection',
    currentCollectionStartedAt: '2026-08-13T14:00:00.000Z',
  });
  check('WP6-30 Trial Window 起点覆盖静态采集边界', trialScoped.status === 'pass'
    && trialScoped.currentCollectionStartedAt === '2026-08-13T14:00:00.000Z'
    && trialScoped.scopeTotals.includedRounds === 1,
  `${trialScoped.status}/${trialScoped.currentCollectionStartedAt}/${JSON.stringify(trialScoped.scopeTotals)}`);
  const afterTrial = service.buildReport({
    ...mixed,
    scope: 'current_collection',
    currentCollectionStartedAt: '2026-08-13T16:00:00.000Z',
  });
  check('WP6-31 Trial Window 之前的全部轮次只读隔离', afterTrial.scopeTotals.includedRounds === 0
    && afterTrial.scopeTotals.legacyRounds === 2,
  JSON.stringify(afterTrial.scopeTotals));
  const layered = internalAndRealFixture();
  const layeredCurrent = service.buildReport({
    ...layered,
    scope: 'current_collection',
    currentCollectionStartedAt: '2026-08-13T14:00:00.000Z',
    trialWindowId: 'trial-window-1',
    originPolicyVersion: 'learning_collection_origin_policy_v1',
    internalAcceptanceSessionIds: ['session-internal'],
  });
  check('WP6-32 内部验收轮次不污染真实学生完整性结论', layeredCurrent.status === 'pass'
    && layeredCurrent.scopeTotals.includedRounds === 1
    && layeredCurrent.scopeTotals.currentCollectionRounds === 2
    && layeredCurrent.scopeTotals.realLearningRounds === 1
    && layeredCurrent.scopeTotals.internalAcceptanceRounds === 1,
  `${layeredCurrent.status}/${JSON.stringify(layeredCurrent.scopeTotals)}`);
  const layeredHistory = service.buildReport({
    ...layered,
    scope: 'all_history',
    currentCollectionStartedAt: '2026-08-13T14:00:00.000Z',
    internalAcceptanceSessionIds: ['session-internal'],
  });
  check('WP6-33 全部历史仍保留内部验收缺口供追溯', layeredHistory.status === 'fail'
    && layeredHistory.scopeTotals.includedRounds === 2
    && layeredHistory.issues.some((issue) => issue.learningRoundId === 'round-internal'),
  `${layeredHistory.status}/${JSON.stringify(layeredHistory.scopeTotals)}`);
  const noOriginPolicy = service.buildReport({
    ...layered,
    scope: 'current_collection',
    currentCollectionStartedAt: '2026-08-13T14:00:00.000Z',
  });
  check('WP6-34 未明确标记的新轮次默认进入真实学生范围', noOriginPolicy.status === 'fail'
    && noOriginPolicy.scopeTotals.realLearningRounds === 2
    && noOriginPolicy.scopeTotals.internalAcceptanceRounds === 0,
  `${noOriginPolicy.status}/${JSON.stringify(noOriginPolicy.scopeTotals)}`);

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

function currentFixture(): LearningCollectionIntegrityInput {
  const value = fixture();
  value.checkpoints[0] = {
    ...value.checkpoints[0],
    createdAt: '2026-08-13T15:00:00.000Z',
    updatedAt: '2026-08-13T15:05:00.000Z',
  };
  return value;
}

function legacyOnlyFixture(): LearningCollectionIntegrityInput {
  const value = fixture();
  const checkpointValue = value.checkpoints[0];
  const legacyCheckpoint: RealLearningOperationCheckpoint = {
    ...checkpointValue,
    operationId: 'operation-legacy',
    learningSessionId: 'session-legacy',
    learningRoundId: 'round-legacy',
    createdAt: '2026-08-13T12:00:00.000Z',
    updatedAt: '2026-08-13T12:05:00.000Z',
  };
  return {
    ...value,
    checkpoints: [legacyCheckpoint],
    persistenceRecords: [{ ...value.persistenceRecords[0], recordId: 'persistence-legacy', learningRoundId: 'round-legacy' }],
    events: [],
    projections: [],
    questionPresentedRoundIds: [],
    feedbackPresentedRoundIds: [],
  };
}

function mixedHistoryFixture(): LearningCollectionIntegrityInput {
  const current = currentFixture();
  const legacy = legacyOnlyFixture();
  return {
    ...current,
    checkpoints: [...legacy.checkpoints, ...current.checkpoints],
    persistenceRecords: [...legacy.persistenceRecords, ...current.persistenceRecords],
  };
}

function internalAndRealFixture(): LearningCollectionIntegrityInput {
  const real = currentFixture();
  const internalCheckpoint: RealLearningOperationCheckpoint = {
    ...structuredClone(real.checkpoints[0]),
    operationId: 'operation-internal',
    learningSessionId: 'session-internal',
    learningRoundId: 'round-internal',
    createdAt: '2026-08-13T15:10:00.000Z',
    updatedAt: '2026-08-13T15:15:00.000Z',
  };
  return {
    ...real,
    checkpoints: [internalCheckpoint, ...real.checkpoints],
    persistenceRecords: [{
      ...real.persistenceRecords[0],
      recordId: 'persistence-internal',
      learningRoundId: 'round-internal',
    }, ...real.persistenceRecords],
    questionPresentedRoundIds: ['round-internal', 'round-1'],
    feedbackPresentedRoundIds: ['round-internal', 'round-1'],
  };
}

function invalidThenValidFixture(): LearningCollectionIntegrityInput {
  const value = fixture();
  const finalAnswer = value.events.find((event) => event.eventType === 'answer_submitted')!;
  const invalidEvent: LearningObservationEvent = {
    ...finalAnswer,
    eventId: 'event-answer-invalid',
    occurredAt: '2026-08-13T12:00:30.000Z',
    recordedAt: '2026-08-13T12:00:30.000Z',
    sourceEntityId: 'source-answer-invalid',
    payload: {
      kind: 'answer_submitted',
      responseId: 'response-invalid',
      attemptId: INVALID_ATTEMPT_ID,
      submittedAt: '2026-08-13T12:00:30.000Z',
    },
  };
  value.events.splice(1, 0, invalidEvent);
  value.projections.unshift({
    ...value.projections[0],
    projectionId: 'projection-invalid',
    attemptId: INVALID_ATTEMPT_ID,
    status: 'excluded_invalid_response',
    responseId: 'response-invalid',
    formalDiagnosisId: undefined,
    itemScore: undefined,
    itemScorePolicyVersion: undefined,
    valid: false,
    completedAt: undefined,
    projectedAt: '2026-08-13T12:00:30.000Z',
    issues: ['excluded_invalid_response'],
  });
  return value;
}

function repeatedSubjectFixture(): LearningCollectionIntegrityInput {
  const value = fixture();
  const secondCheckpoint = structuredClone(value.checkpoints[0]);
  secondCheckpoint.operationId = 'operation-2';
  secondCheckpoint.learningSessionId = 'session-2';
  secondCheckpoint.learningRoundId = 'round-2';
  secondCheckpoint.taskExecutionResult!.executionSessionId = 'execution-2';
  secondCheckpoint.taskExecutionResult!.studentResponse!.responseId = 'response-2';
  secondCheckpoint.taskExecutionResult!.studentResponse!.executionSessionId = 'execution-2';
  secondCheckpoint.taskExecutionResult!.studentResponse!.answerText = '第二次有效回答';
  secondCheckpoint.taskExecutionResult!.responseValidity!.responseId = 'response-2';
  secondCheckpoint.realDiagnosisRuntimeResult!.requestId = 'request-2';
  secondCheckpoint.realDiagnosisRuntimeResult!.runRecord.requestId = 'request-2';
  secondCheckpoint.realDiagnosisRuntimeResult!.runRecord.responseId = 'response-2';
  secondCheckpoint.realDiagnosisRuntimeResult!.formalDiagnosisCommit!.requestId = 'request-2';
  secondCheckpoint.realDiagnosisRuntimeResult!.formalDiagnosisCommit!.formalDiagnosisId = 'diagnosis-2';
  const secondAttemptId = buildLearningCalibrationAttemptId({
    studentId: secondCheckpoint.studentId,
    learningSessionId: secondCheckpoint.learningSessionId,
    learningRoundId: secondCheckpoint.learningRoundId,
    submissionIntentId: buildLearningSubmissionIntentId({ responseId: 'response-2', answerText: '第二次有效回答' }),
  });
  const secondEvents = value.events.map((event) => ({
    ...event,
    eventId: `${event.eventId}-round-2`,
    operationId: 'operation-2',
    learningSessionId: 'session-2',
    learningRoundId: 'round-2',
    sourceEntityId: `${event.sourceEntityId}-round-2`,
    payload: secondRoundPayload(event.eventType, secondAttemptId),
  }));
  return {
    ...value,
    checkpoints: [...value.checkpoints, secondCheckpoint],
    persistenceRecords: [...value.persistenceRecords, {
      ...value.persistenceRecords[0],
      recordId: 'persistence-2',
      learningRoundId: 'round-2',
    }],
    events: [...value.events, ...secondEvents],
    projections: [...value.projections, {
      ...value.projections[0],
      projectionId: 'projection-2',
      attemptId: secondAttemptId,
      operationId: 'operation-2',
      learningSessionId: 'session-2',
      learningRoundId: 'round-2',
      responseId: 'response-2',
      formalDiagnosisId: 'diagnosis-2',
    }],
    questionPresentedRoundIds: ['round-1', 'round-2'],
    feedbackPresentedRoundIds: ['round-1', 'round-2'],
    claimedIndependentSampleCount: 1,
  };
}

function secondRoundPayload(
  type: LearningObservationEventType,
  attemptId: string,
): LearningObservationEvent['payload'] {
  if (type === 'question_presented') return { kind: type, presentationId: 'presentation-2' };
  if (type === 'answer_submitted') return { kind: type, responseId: 'response-2', attemptId, submittedAt: '2026-08-13T12:01:00.000Z' };
  if (type === 'diagnosis_completed') return { kind: type, responseId: 'response-2', attemptId, formalDiagnosisId: 'diagnosis-2', diagnosisSchemaVersion: 'v1' };
  if (type === 'feedback_presented') return { kind: type, responseId: 'response-2', attemptId, feedbackRequestId: 'feedback-2', feedbackSchemaVersion: 'v1' };
  return { kind: type, responseId: 'response-2', attemptId, persistenceRecordId: 'persistence-2', completedAt: '2026-08-13T12:04:00.000Z' };
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
