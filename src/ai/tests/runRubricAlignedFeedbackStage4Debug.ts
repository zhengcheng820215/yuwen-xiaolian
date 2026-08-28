import { strict as assert } from 'node:assert';
import {
  allPassingRubricAlignedFeedbackTrialPreflightSignals,
  buildRubricAlignedFeedbackTrialObservation,
  resolveRubricAlignedFeedbackTrialDecision,
  resolveRubricAlignedFeedbackTrialMode,
  runRubricAlignedFeedbackTrialPreflight,
} from '../services/rubricAlignedFeedbackTrialService.ts';
import {
  emptyRubricAlignedFeedbackTrialProtectedWriteCounts,
  validateRubricAlignedFeedbackTrialActivation,
  validateRubricAlignedFeedbackTrialObservation,
  type RubricAlignedFeedbackTrialActivation,
} from '../schemas/rubricAlignedFeedbackTrial.schema.ts';
import { InMemoryRubricAlignedFeedbackTrialObservationRepository } from
  '../repositories/inMemoryRubricAlignedFeedbackTrialObservationRepository.ts';
import { formatStudentNextQuestionAction } from '../../ui/productComplexityConvergencePresentation.ts';

type Check = { id: string; passed: boolean; evidence: string; reasonCodes: string[] };
const checks: Check[] = [];

async function run(id: string, evidence: string, test: () => void | Promise<void>) {
  try {
    await test();
    checks.push({ id, passed: true, evidence, reasonCodes: [] });
  } catch (error) {
    checks.push({
      id, passed: false, evidence,
      reasonCodes: [error instanceof Error ? error.message : String(error)],
    });
  }
}

const now = '2026-08-28T08:00:00.000Z';
const active = activation();
const context = {
  studentId: 'student-real-1', learningRoundId: 'round-1',
  runtimeIdentityDigest: 'sha256:runtime-a', formalResourceRevision: 61,
  sessionCount: 0, now,
};

await run('RF4-A01', 'Stage 3 签署缺失时 Schema 阻断。', () => {
  const value = activation(); value.stage3Acceptance.reportRef = '';
  assert(validateRubricAlignedFeedbackTrialActivation(value).includes('stage3_acceptance_missing'));
});
await run('RF4-A02', '过期 Stage 3 签署使 Preflight 不可准入。', () => {
  const signals = allPassingRubricAlignedFeedbackTrialPreflightSignals();
  signals.stage3AcceptanceFresh = false;
  const report = runRubricAlignedFeedbackTrialPreflight({ activation: active, signals, generatedAt: now });
  assert.equal(report.eligibleForActivation, false);
  assert(report.reasonCodes.includes('stage3_acceptance_stale'));
});
await run('RF4-A03', 'Runtime、资源、scope 对齐时活动 Trial 可见。', () => {
  assert.equal(resolveRubricAlignedFeedbackTrialMode({ activation: active, context }).mode, 'student_visible');
});
await run('RF4-A04', 'Runtime Identity 错位原子回落 shadow。', () => {
  const result = resolveRubricAlignedFeedbackTrialMode({ activation: active,
    context: { ...context, runtimeIdentityDigest: 'sha256:runtime-b' } });
  assert.equal(result.mode, 'shadow');
  assert(result.reasonCodes.includes('runtime_identity_mismatch'));
});
await run('RF4-A05', 'Formal Revision 变化使激活失效。', () => {
  const result = resolveRubricAlignedFeedbackTrialMode({ activation: active,
    context: { ...context, formalResourceRevision: 62 } });
  assert.equal(result.mode, 'shadow');
});
await run('RF4-A06', 'scope 外学生保持 shadow。', () => {
  assert.equal(resolveRubricAlignedFeedbackTrialMode({ activation: active,
    context: { ...context, studentId: 'student-other' } }).mode, 'shadow');
});
await run('RF4-A07', 'scope 内学生只在 active 状态可见。', () => {
  const paused = { ...active, status: 'paused' as const };
  assert.equal(resolveRubricAlignedFeedbackTrialMode({ activation: paused, context }).mode, 'shadow');
  assert.equal(resolveRubricAlignedFeedbackTrialMode({ activation: active, context }).mode, 'student_visible');
});
await run('RF4-A08', 'Trial 到期自动回落 shadow。', () => {
  assert.equal(resolveRubricAlignedFeedbackTrialMode({ activation: active,
    context: { ...context, now: active.expiresAt } }).mode, 'shadow');
});
await run('RF4-A09', '完整覆盖观察不强制制造缺口码。', () => {
  const item = observation('complete', ['feedback_matches_original_response']);
  assert(!item.observationCodes.includes('revision_does_not_reduce_primary_gap'));
});
await run('RF4-A10', '有结论无依据只保存结构化行动观察。', () => {
  const item = observation('missing-evidence', ['student_understands_primary_gap']);
  assert.deepEqual(item.observationCodes, ['student_understands_primary_gap']);
});
await run('RF4-A11', '有依据无关系不写答案正文。', () => {
  const item = observation('missing-relation', ['student_understands_next_action']);
  assert.equal(JSON.stringify(item).includes('answerText'), false);
});
await run('RF4-A12', 'not_assessable 可记录 fallback，且不猜测能力。', () => {
  const item = observation('not-assessable', ['fallback_recovery_succeeded'], 'not_assessable');
  assert.equal(item.taskContext.projectionStatus, 'not_assessable');
});
await run('RF4-A13', '单选正确走 single_choice 独立路径。', () => {
  const item = observation('choice-correct', ['feedback_matches_original_response'], 'ready', 'single_choice');
  assert.equal(item.taskContext.responseFormat, 'single_choice');
});
await run('RF4-A14', '单选错误不混入文本 Rubric 字段。', () => {
  const item = observation('choice-wrong', ['student_understands_next_action'], 'ready', 'single_choice');
  const serialized = JSON.stringify(item);
  assert.equal(serialized.includes('answerText'), false);
  assert.equal(serialized.includes('acceptedSignals'), false);
});
await run('RF4-A15', '合法 Revision 只记录支持下改善事实。', () => {
  const item = observation('revision-1', ['revision_reduces_primary_gap'], 'ready', 'short_text', 'revision');
  assert(item.observationCodes.includes('revision_reduces_primary_gap'));
});
await run('RF4-A16', 'Observation 幂等，重复事件不重复计数。', async () => {
  const repository = new InMemoryRubricAlignedFeedbackTrialObservationRepository();
  const item = observation('revision-once', ['student_executes_revision_action']);
  assert.equal(await repository.append(item), 'inserted');
  assert.equal(await repository.append(item), 'duplicate');
  assert.equal((await repository.list()).length, 1);
});
await run('RF4-A17', 'Retest / Transfer 观察只保存结果码。', () => {
  const item = observation('retest', ['independent_revalidation_reduces_gap'], 'ready', 'short_text', 'retest');
  assert.equal(item.taskContext.taskRole, 'retest');
  assert.equal(JSON.stringify(item).includes('nextAction'), false);
});
await run('RF4-A18', '固定题组尚有下一题时题号准确。', () => {
  assert.equal(formatStudentNextQuestionAction(2, 6), '进入第 3 题（共 6 题）');
});
await run('RF4-A19', '固定题组完成后才允许完成出口。', () => {
  const actions = Array.from({ length: 6 }, (_, index) => index < 5
    ? formatStudentNextQuestionAction(index + 1, 6) : '完成本次学习');
  assert.equal(actions[5], '完成本次学习');
  assert(!actions.slice(0, 5).includes('返回学习入口'));
});
await run('RF4-A20', '恢复身份保持 Session / Round / Question 不变。', () => {
  const first = observation('restore', ['fixed_group_continuity_preserved']);
  const restored = structuredClone(first);
  assert.deepEqual(restored.identity, first.identity);
});
await run('RF4-A21', '新路径失败触发 fallback 决策。', () => {
  const decision = resolveRubricAlignedFeedbackTrialDecision({
    observations: [observation('fallback-failed', ['fallback_recovery_failed'])],
    active: true, unresolvedCriticalIssueCount: 0,
  });
  assert.equal(decision.decision, 'rollback');
});
await run('RF4-A22', 'Debug / Fixture 不进入真实校准分母。', () => {
  const item = observation('fixture', ['feedback_matches_original_response'], 'ready', 'short_text', 'training', 'browser_acceptance');
  assert.equal(item.countsTowardCalibration, false);
});
await run('RF4-A23', '真实观察才进入校准分母且 Schema 有效。', () => {
  const item = observation('real', ['feedback_matches_original_response']);
  assert.equal(item.countsTowardCalibration, true);
  assert.deepEqual(validateRubricAlignedFeedbackTrialObservation(item), []);
});
await run('RF4-A24', '完整 Preflight 24/24 且保护写入为零。', () => {
  const report = runRubricAlignedFeedbackTrialPreflight({
    activation: active,
    signals: allPassingRubricAlignedFeedbackTrialPreflightSignals(),
    generatedAt: now,
    protectedWriteCounts: emptyRubricAlignedFeedbackTrialProtectedWriteCounts(),
  });
  assert.equal(report.checkResults.length, 24);
  assert.equal(report.checkResults.filter((item) => item.status === 'passed').length, 24);
  assert.equal(report.eligibleForActivation, true);
  assert(Object.values(report.protectedWriteCounts).every((count) => count === 0));
});

const passed = checks.filter((item) => item.passed).length;
checks.forEach((item) => console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.id} | ${item.evidence}${item.reasonCodes.length ? ` | ${item.reasonCodes.join(',')}` : ''}`));
console.log(`\nresult: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exitCode = 1;

function activation(): RubricAlignedFeedbackTrialActivation {
  return {
    schemaVersion: 'rubric_aligned_feedback_trial_activation_v1',
    trialId: 'rubric-feedback-trial-1',
    status: 'student_visible_active',
    stage3Acceptance: {
      reportRef: 'docs/education/phase/reports/rubric-stage3.md',
      acceptanceDigest: 'sha256:stage3-accepted',
      acceptedAt: '2026-08-28T07:00:00.000Z',
    },
    scope: { studentIds: ['student-real-1'], learningRoundIds: ['round-1'], maxSessions: 5 },
    runtimeIdentityDigest: 'sha256:runtime-a',
    gitCommit: 'commit-a',
    formalResourceRevision: 61,
    sourcePolicyVersion: 'rubric_aligned_feedback_source_policy_v1',
    feedbackMode: 'student_visible',
    startsAt: '2026-08-28T07:30:00.000Z',
    expiresAt: '2026-08-29T07:30:00.000Z',
    rollbackPolicyVersion: 'rubric_aligned_feedback_trial_rollback_v1',
    activatedBy: 'operator-1',
    activatedAt: '2026-08-28T07:30:00.000Z',
  };
}

function observation(
  suffix: string,
  observationCodes: Parameters<typeof buildRubricAlignedFeedbackTrialObservation>[0]['observationCodes'],
  projectionStatus: 'ready' | 'limited' | 'not_assessable' = 'ready',
  responseFormat: 'short_text' | 'long_text' | 'single_choice' = 'short_text',
  taskRole: 'training' | 'revision' | 'retest' | 'transfer' = 'training',
  origin: 'internal_debug' | 'browser_acceptance' | 'real_student' = 'real_student',
) {
  return buildRubricAlignedFeedbackTrialObservation({
    observationId: `observation-${suffix}`,
    trialId: active.trialId,
    origin,
    identity: {
      studentId: 'student-real-1', sessionId: 'session-1', roundId: 'round-1',
      attemptId: `attempt-${suffix}`, questionId: 'question-1', questionVersion: 'version-1',
      formalResourceRevision: 61, runtimeIdentityDigest: 'sha256:runtime-a',
    },
    taskContext: { responseFormat, taskRole, projectionStatus, feedbackSource: 'rubric_aligned' },
    observationCodes, severity: 'info', occurredAt: now,
  });
}
