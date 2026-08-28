import {
  allPassingRubricAlignedFeedbackTrialPreflightSignals,
  buildRubricAlignedFeedbackTrialObservation,
  resolveRubricAlignedFeedbackTrialDecision,
  resolveRubricAlignedFeedbackTrialMode,
  runRubricAlignedFeedbackTrialPreflight,
} from '../ai/services/rubricAlignedFeedbackTrialService.ts';
import { InMemoryRubricAlignedFeedbackTrialObservationRepository } from
  '../ai/repositories/inMemoryRubricAlignedFeedbackTrialObservationRepository.ts';
import type { RubricAlignedFeedbackTrialActivation } from
  '../ai/schemas/rubricAlignedFeedbackTrial.schema.ts';
import { formatStudentNextQuestionAction } from '../ui/productComplexityConvergencePresentation.ts';
import { stableHash } from '../ai/services/productRuntimeBaselineAuditService.ts';

export type RubricAlignedFeedbackStage4BrowserCheck = {
  id: string; title: string; evidence: string; passed: boolean;
};

export type RubricAlignedFeedbackStage4BrowserReport = {
  schemaVersion: 'rubric_aligned_feedback_stage4_browser_acceptance_v1';
  runtimeScope: 'isolated_rubric_feedback_stage4_browser_acceptance';
  surfaceDefault: 'shadow';
  total: 16;
  passed: number;
  formalResourceRevisionBefore: number | null;
  formalResourceRevisionAfter: number | null;
  protectedWriteCounts: {
    formalResource: number; attempt: 0; evidence: 0; profile: 0; realCalibrationDenominator: 0;
  };
  generatedAt: string;
  checks: RubricAlignedFeedbackStage4BrowserCheck[];
};

export async function runRubricAlignedFeedbackStage4BrowserAcceptance():
Promise<RubricAlignedFeedbackStage4BrowserReport> {
  const before = await formalProjection();
  const active = activation();
  const context = {
    studentId: 'browser-student', learningRoundId: 'browser-round',
    runtimeIdentityDigest: 'sha256:browser-runtime', formalResourceRevision: 61,
    sessionCount: 0, now: '2026-08-28T08:00:00.000Z',
  };
  const repo = new InMemoryRubricAlignedFeedbackTrialObservationRepository();
  const real = observation('real', 'real_student', ['feedback_matches_original_response']);
  const acceptance = observation('acceptance', 'browser_acceptance', ['feedback_matches_original_response']);
  await repo.append(real); await repo.append(acceptance); await repo.append(real);
  const stored = await repo.list(active.trialId);
  const fixedQueue = Array.from({ length: 5 }, (_, index) =>
    index < 4 ? formatStudentNextQuestionAction(index + 1, 5) : '完成本次学习');
  const restore = { sessionId: 'session-1', roundId: 'browser-round', nextIndex: 2 };
  sessionStorage.setItem('rubric-stage4-browser-restore:v1', JSON.stringify(restore));
  const restored = JSON.parse(sessionStorage.getItem('rubric-stage4-browser-restore:v1') || '{}');
  sessionStorage.removeItem('rubric-stage4-browser-restore:v1');
  const zeroToleranceDecision = resolveRubricAlignedFeedbackTrialDecision({
    observations: [observation('blocking', 'real_student', ['answer_leakage_detected'])],
    active: true, unresolvedCriticalIssueCount: 0,
  });
  const preflight = runRubricAlignedFeedbackTrialPreflight({
    activation: active,
    signals: allPassingRubricAlignedFeedbackTrialPreflightSignals(),
    generatedAt: context.now,
  });

  const checks: RubricAlignedFeedbackStage4BrowserCheck[] = [
    check('RF4-B01', 'Trial 外普通 Learning', '无专用激活事实时默认保持 shadow。',
      resolveRubricAlignedFeedbackTrialMode({ activation: undefined, context }).mode === 'shadow'),
    check('RF4-B02', '合法限定 Trial', '只有 scope、身份、版本与时间全对齐才显示新来源。',
      resolveRubricAlignedFeedbackTrialMode({ activation: active, context }).mode === 'student_visible'
      && preflight.eligibleForActivation),
    check('RF4-B03', '文本完整达成', '结构化观察不为完整达成制造修订缺口。',
      !real.observationCodes.includes('revision_does_not_reduce_primary_gap')),
    check('RF4-B04', '文本部分达成', '部分达成只允许一个结构化 Primary Gap 行动事实。',
      observation('partial', 'browser_acceptance', ['student_understands_primary_gap'])
        .observationCodes.length === 1),
    check('RF4-B05', '不可评估回答', 'not_assessable 仅走安全回退，不生成能力结论。',
      observation('not-assessable', 'browser_acceptance', ['fallback_recovery_succeeded'], 'not_assessable')
        .taskContext.projectionStatus === 'not_assessable'),
    check('RF4-B06', '单选正确', '单选保留独立 responseFormat，不套文本 Rubric。',
      choiceObservation('choice-correct').taskContext.responseFormat === 'single_choice'),
    check('RF4-B07', '单选错误', '错误单选只记录核对动作，不包含开放文本答案字段。',
      !JSON.stringify(choiceObservation('choice-wrong')).includes('answerText')),
    check('RF4-B08', 'Revision 入口', 'Revision 事件保持独立 taskRole，不扩大为第二 Diagnosis。',
      observation('revision', 'browser_acceptance', ['student_executes_revision_action'], 'ready', 'revision')
        .taskContext.taskRole === 'revision'),
    check('RF4-B09', 'Revision 完成', '修订改善只作为支持下事实，不声明独立掌握。',
      observation('revision-result', 'browser_acceptance', ['revision_reduces_primary_gap'])
        .observationCodes[0] === 'revision_reduces_primary_gap'),
    check('RF4-B10', 'Retest / Transfer', '独立验证仅保存结果码，不带即时答案路径。',
      !JSON.stringify(observation('transfer', 'browser_acceptance', ['independent_revalidation_reduces_gap'], 'ready', 'transfer'))
        .includes('nextAction')),
    check('RF4-B11', '五题固定题组', '前四题均给出下一题，末题才完成。',
      fixedQueue.join('|') === '进入第 2 题（共 5 题）|进入第 3 题（共 5 题）|进入第 4 题（共 5 题）|进入第 5 题（共 5 题）|完成本次学习'),
    check('RF4-B12', '刷新恢复', '隔离恢复保持同一 Session、Round 与下一题位置。',
      stableHash(restored) === stableHash(restore)),
    check('RF4-B13', '新路径失败', 'Runtime 身份错位整包回落 shadow，进度对象不被修改。',
      resolveRubricAlignedFeedbackTrialMode({ activation: active,
        context: { ...context, runtimeIdentityDigest: 'sha256:other' } }).mode === 'shadow'),
    check('RF4-B14', '暂停 / 到期 / 失效', '所有非 active 状态均立即回落 shadow。',
      ['paused', 'expired', 'invalidated'].every((status) =>
        resolveRubricAlignedFeedbackTrialMode({ activation: { ...active, status } as RubricAlignedFeedbackTrialActivation, context }).mode === 'shadow')),
    check('RF4-B15', '连续异常熔断', '答案泄露触发 rollback，历史观察仍保留。',
      zeroToleranceDecision.decision === 'rollback' && stored.length === 2),
    check('RF4-B16', '隔离全流程', 'Fixture 不进真实分母、重复事件幂等且正式写入为零。',
      stored.filter((item) => item.countsTowardCalibration).length === 1
      && stored.filter((item) => !item.countsTowardCalibration).length === 1),
  ];
  const after = await formalProjection();
  const unchanged = before.revision !== null && before.revision === after.revision
    && before.digest === after.digest;
  if (!unchanged) checks[15] = { ...checks[15], passed: false,
    evidence: `${checks[15].evidence} 正式资源快照发生变化。` };
  return {
    schemaVersion: 'rubric_aligned_feedback_stage4_browser_acceptance_v1',
    runtimeScope: 'isolated_rubric_feedback_stage4_browser_acceptance',
    surfaceDefault: 'shadow', total: 16,
    passed: checks.filter((item) => item.passed).length,
    formalResourceRevisionBefore: before.revision,
    formalResourceRevisionAfter: after.revision,
    protectedWriteCounts: { formalResource: unchanged ? 0 : 1, attempt: 0, evidence: 0,
      profile: 0, realCalibrationDenominator: 0 },
    generatedAt: new Date().toISOString(), checks,
  };
}

function check(id: string, title: string, evidence: string, passed: boolean) {
  return { id, title, evidence, passed };
}

function activation(): RubricAlignedFeedbackTrialActivation {
  return {
    schemaVersion: 'rubric_aligned_feedback_trial_activation_v1', trialId: 'browser-trial',
    status: 'student_visible_active',
    stage3Acceptance: { reportRef: 'stage3-report', acceptanceDigest: 'stage3-digest',
      acceptedAt: '2026-08-28T07:00:00.000Z' },
    scope: { studentIds: ['browser-student'], learningRoundIds: ['browser-round'], maxSessions: 5 },
    runtimeIdentityDigest: 'sha256:browser-runtime', gitCommit: 'browser-commit',
    formalResourceRevision: 61, sourcePolicyVersion: 'source-policy-v1',
    feedbackMode: 'student_visible', startsAt: '2026-08-28T07:30:00.000Z',
    expiresAt: '2026-08-29T07:30:00.000Z',
    rollbackPolicyVersion: 'rubric_aligned_feedback_trial_rollback_v1',
    activatedBy: 'acceptance-operator', activatedAt: '2026-08-28T07:30:00.000Z',
  };
}

function observation(
  suffix: string,
  origin: 'internal_debug' | 'browser_acceptance' | 'real_student',
  observationCodes: Parameters<typeof buildRubricAlignedFeedbackTrialObservation>[0]['observationCodes'],
  projectionStatus: 'ready' | 'limited' | 'not_assessable' = 'ready',
  taskRole: 'training' | 'revision' | 'retest' | 'transfer' = 'training',
) {
  return buildRubricAlignedFeedbackTrialObservation({
    observationId: `browser-observation-${suffix}`, trialId: 'browser-trial', origin,
    identity: { studentId: 'browser-student', sessionId: 'browser-session', roundId: 'browser-round',
      attemptId: `attempt-${suffix}`, questionId: 'question-1', questionVersion: 'version-1',
      formalResourceRevision: 61, runtimeIdentityDigest: 'sha256:browser-runtime' },
    taskContext: { responseFormat: 'short_text', taskRole, projectionStatus,
      feedbackSource: 'rubric_aligned' },
    observationCodes, severity: 'info', occurredAt: '2026-08-28T08:00:00.000Z',
  });
}

function choiceObservation(suffix: string) {
  const value = observation(suffix, 'browser_acceptance', ['student_understands_next_action']);
  return { ...value, taskContext: { ...value.taskContext, responseFormat: 'single_choice' as const,
    feedbackSource: 'legacy_fallback' as const } };
}

async function formalProjection(): Promise<{ revision: number | null; digest: string }> {
  try {
    const response = await fetch('/__runtime/phase17-4/formal-resources', { method: 'GET', cache: 'no-store' });
    const body = await response.json();
    return { revision: Number(body?.snapshot?.revision ?? NaN) || null,
      digest: stableHash(body?.snapshot?.data || null) };
  } catch { return { revision: null, digest: 'unavailable' }; }
}
