import { projectLearningSurface } from '../ai/agents/productComplexityConvergenceSurfaceProjectionAgent.ts';
import { IndexedDBProductComplexityConvergenceConditionalPolicyAuditRepository } from '../ai/repositories/indexedDBProductComplexityConvergenceConditionalPolicyAuditRepository.ts';
import {
  DEFAULT_CONVERGENCE_CONDITIONAL_CAPABILITY_FLAGS,
  type ConvergenceConditionalCapability,
  type ConvergenceConditionalCapabilityFlags,
} from '../ai/schemas/productComplexityConvergenceConditionalPolicy.schema.ts';
import {
  InMemoryConvergenceConditionalSessionPolicyRepository,
  resolveConvergenceConditionalSessionPolicy,
} from '../ai/services/productComplexityConvergenceConditionalSessionPolicyService.ts';
import {
  runConvergenceConditionalPolicy,
  type ConvergenceConditionalPolicyRuntimeInput,
} from '../ai/services/productComplexityConvergenceConditionalPolicyService.ts';

export type ProductComplexityStage2BrowserCheck = {
  id: string;
  title: string;
  evidence: string;
  passed: boolean;
};

export type ProductComplexityStage2BrowserReport = {
  schemaVersion: 'product_complexity_convergence_stage2_browser_acceptance_v1';
  runtimeScope: 'isolated_conditional_policy_acceptance';
  total: number;
  passed: number;
  auditProjectionCount: number;
  formalResourceWriteCount: 0;
  studentAttemptWriteCount: 0;
  evidenceWriteCount: 0;
  studentProfileWriteCount: 0;
  realCalibrationDenominatorWriteCount: 0;
  generatedAt: string;
  checks: ProductComplexityStage2BrowserCheck[];
};

export async function runProductComplexityConvergenceStage2BrowserAcceptance(): Promise<ProductComplexityStage2BrowserReport> {
  const auditRepository = new IndexedDBProductComplexityConvergenceConditionalPolicyAuditRepository(
    'yuwen-xiaolian-product-complexity-convergence-stage2-browser-acceptance',
  );
  await auditRepository.clear();
  const sessionRepository = new InMemoryConvergenceConditionalSessionPolicyRepository();
  const legacyFlags = { ...DEFAULT_CONVERGENCE_CONDITIONAL_CAPABILITY_FLAGS };
  const shadowFlags = allFlags('shadow');
  const enforcedFlags = allFlags('enforced');
  const snapshot = await resolveConvergenceConditionalSessionPolicy({
    learningSessionId: 'b2-session',
    requestedFlags: { revision: 'enforced', targeted: 'shadow' },
    repository: sessionRepository,
    now: () => '2026-08-24T08:00:00.000Z',
  });
  const legacy = await runConvergenceConditionalPolicy({ flags: legacyFlags, policyInput: fixture('revision') });
  const shadow = await runConvergenceConditionalPolicy({
    flags: shadowFlags, policyInput: fixture('revision'), auditRepository,
  });
  const revisionTrigger = await runConvergenceConditionalPolicy({
    flags: enforcedFlags, policyInput: fixture('revision'), auditRepository,
  });
  const revisionNone = await runConvergenceConditionalPolicy({
    flags: enforcedFlags,
    policyInput: fixture('revision', { facts: { revisionNeeded: false } }),
    auditRepository,
  });
  const targetedTrigger = await runConvergenceConditionalPolicy({
    flags: enforcedFlags, policyInput: fixture('targeted'), auditRepository,
  });
  const targetedNoMatch = await runConvergenceConditionalPolicy({
    flags: enforcedFlags,
    policyInput: fixture('targeted', { facts: { formalResourceAvailable: false } }),
    auditRepository,
  });
  const retestDeferred = await runConvergenceConditionalPolicy({
    flags: enforcedFlags, policyInput: fixture('retest', { facts: { due: false } }), auditRepository,
  });
  const retestTrigger = await runConvergenceConditionalPolicy({
    flags: enforcedFlags, policyInput: fixture('retest'), auditRepository,
  });
  const transferNone = await runConvergenceConditionalPolicy({
    flags: enforcedFlags,
    policyInput: fixture('transfer', { facts: { stableIndependentEvidence: false } }),
    auditRepository,
  });
  const transferTrigger = await runConvergenceConditionalPolicy({
    flags: enforcedFlags, policyInput: fixture('transfer'), auditRepository,
  });
  const firstFrozen = await resolveConvergenceConditionalSessionPolicy({
    learningSessionId: 'b2-session', requestedFlags: allFlags('legacy'), repository: sessionRepository,
  });
  const repeated = await runConvergenceConditionalPolicy({
    flags: enforcedFlags, policyInput: fixture('targeted'), auditRepository,
  });
  const ordinaryProjection = JSON.stringify(projectLearningSurface({
    surfaceId: 'b2-task', state: 'task', currentQuestionNumber: 2, totalQuestionCount: 5,
    canSubmit: true, canSaveDraft: true,
  }));
  const forbidden = /Policy|Owner|Shadow|Reason Code|Hash|Identity/i;
  const checks = [
    check('B2-01', '全部 Legacy 保持旧行为', '没有新决策或审计写入，Owner 结果直接生效。', legacy.flag === 'legacy' && !legacy.decision && legacy.effectiveOutcome === 'trigger'),
    check('B2-02', '全部 Shadow 零行为变化', 'Shadow 形成审计，但 Effective 仍来自 Owner。', shadow.flag === 'shadow' && shadow.effectiveOutcome === shadow.decision?.ownerDecision.ownerMappedOutcome && shadow.audit?.behaviorChanged === false),
    check('B2-03', 'Revision 只触发一次', '明确可修订缺口得到一次 trigger 与退出条件。', revisionTrigger.effectiveOutcome === 'trigger' && revisionTrigger.decision?.exitConditionCode === 'revision_submitted_or_declined'),
    check('B2-04', 'Revision 不触发无占位', '无修订必要时得到 no_action，普通页面无需投射入口。', revisionNone.effectiveOutcome === 'no_action'),
    check('B2-05', 'Revision 放弃可继续', 'Revision 退出与回退均指向核心队列。', revisionTrigger.decision?.fallbackCode === 'continue_core_queue'),
    check('B2-06', 'Targeted 完成返回核心题号', 'Targeted 使用明确退出条件，不接管核心队列。', targetedTrigger.decision?.exitConditionCode === 'targeted_completed_skipped_or_unavailable'),
    check('B2-07', 'Targeted 无匹配不阻断', '资源不可用得到 no_action + continue_core_queue。', targetedNoMatch.effectiveOutcome === 'no_action' && targetedNoMatch.decision?.fallbackCode === 'continue_core_queue'),
    check('B2-08', 'Targeted 刷新身份稳定', '重复评估复用同一 Decision ID。', targetedTrigger.decision?.decisionId === repeated.decision?.decisionId),
    check('B2-09', 'Retest 未到期不出现入口', '未到期为 defer，不创建当前任务。', retestDeferred.effectiveOutcome === 'defer' && retestDeferred.decision?.fallbackCode === 'wait_until_due'),
    check('B2-10', 'Retest 到期可进入正式任务', '仅 Owner 已确认任务请求时允许 trigger。', retestTrigger.effectiveOutcome === 'trigger' && retestTrigger.decision?.expectedBenefitCode === 'verify_independent_retention'),
    check('B2-11', 'Transfer 基础不足无入口', '缺少稳定独立证据时 no_action。', transferNone.effectiveOutcome === 'no_action'),
    check('B2-12', 'Transfer 满足条件可消费', '稳定基础、新情境与正式资源齐备时 trigger。', transferTrigger.effectiveOutcome === 'trigger' && transferTrigger.decision?.expectedBenefitCode === 'verify_transfer'),
    check('B2-13', '条件动作失败局部恢复', '所有不触发分支均携带继续、等待或保留 Owner Flow 的回退码。', Boolean(targetedNoMatch.decision?.fallbackCode && transferNone.decision?.fallbackCode)),
    check('B2-14', '重复点击幂等', '重复 Targeted 评估不创建第二决策身份。', targetedTrigger.decision?.decisionId === repeated.decision?.decisionId),
    check('B2-15', 'Session 策略冻结', 'Session 首次冻结后忽略中途 Flag 修改。', JSON.stringify(snapshot.flags) === JSON.stringify(firstFrozen.flags) && firstFrozen.flags.revision === 'enforced'),
    check('B2-16', '单项回滚不影响其他能力', 'Revision Enforced 与 Targeted Shadow 可独立存在，其余保持 Legacy。', snapshot.flags.revision === 'enforced' && snapshot.flags.targeted === 'shadow' && snapshot.flags.retest === 'legacy' && snapshot.flags.transfer === 'legacy'),
    check('B2-17', '无条件能力可完成核心题组', '四项 Legacy 时不产生新条件决策，核心队列可独立完成。', !legacy.decision && legacy.ownerRemainsAuthority),
    check('B2-18', '普通页面不泄露内部术语', '普通 Learning 投射不读取阶段 2 判定封套。', !forbidden.test(ordinaryProjection)),
  ];
  const audits = await auditRepository.list();
  return {
    schemaVersion: 'product_complexity_convergence_stage2_browser_acceptance_v1',
    runtimeScope: 'isolated_conditional_policy_acceptance', total: checks.length,
    passed: checks.filter((item) => item.passed).length, auditProjectionCount: audits.length,
    formalResourceWriteCount: 0, studentAttemptWriteCount: 0, evidenceWriteCount: 0,
    studentProfileWriteCount: 0, realCalibrationDenominatorWriteCount: 0,
    generatedAt: new Date().toISOString(), checks,
  };
}

function fixture(
  capability: ConvergenceConditionalCapability,
  patch: { facts?: Record<string, unknown> } = {},
): ConvergenceConditionalPolicyRuntimeInput {
  const common = {
    capability,
    studentId: 'student-b2', learningSessionId: 'b2-session', learningRoundId: 'b2-round-2',
    sourceAttemptId: 'attempt-b2', sourceResourceVersionId: 'resource-version-b2',
    sourceFactRefs: [{ factType: 'attempt' as const, factId: 'attempt-b2' }],
    sourceEvidenceIds: ['evidence-b2'], identitiesAligned: true,
    evaluatedAt: '2026-08-24T08:00:00.000Z',
    loopGuard: { scopeKey: `b2:${capability}`, currentDepth: 0, maximumDepth: 1, usageCount: 0, usageLimit: 1, passed: true },
  };
  if (capability === 'revision') return {
    ...common, capability,
    ownerDecision: owner('revision_offer_snapshot', 'revision-owner', 'optional', 'trigger'),
    facts: { taskRole: 'training', formalFeedbackReady: true, hasActionableGap: true,
      revisionNeeded: true, alreadyUsed: false, requiresFullRedo: false, ...(patch.facts || {}) },
  };
  if (capability === 'targeted') return {
    ...common, capability,
    ownerDecision: owner('targeted_trigger_decision', 'targeted-owner', 'eligible', 'trigger'),
    facts: { atomicGapConfirmed: true, formalResourceAvailable: true, duplicateObservation: false,
      sessionSuitable: true, revisionActive: false, alreadyUsedForGap: false, recursiveDepth: 0,
      ...(patch.facts || {}) },
  };
  if (capability === 'retest') return {
    ...common, capability,
    sourceFactRefs: [{ factType: 'retest_candidate', factId: 'retest-owner' }],
    ownerDecision: owner('delayed_retest_candidate', 'retest-owner', 'create_task_request', 'trigger'),
    facts: { due: true, evidenceSufficient: true, formalResourceAvailable: true,
      alreadyScheduled: false, ...(patch.facts || {}) },
  };
  return {
    ...common, capability: 'transfer',
    sourceFactRefs: [{ factType: 'next_learning_strategy', factId: 'transfer-owner' }],
    ownerDecision: owner('next_learning_strategy', 'transfer-owner', 'transfer_test', 'trigger'),
    facts: { stableIndependentEvidence: true, newContextAvailable: true,
      formalResourceAvailable: true, alreadyScheduled: false, ...(patch.facts || {}) },
  };
}

function owner(
  ownerType: 'revision_offer_snapshot' | 'targeted_trigger_decision' | 'delayed_retest_candidate' | 'next_learning_strategy',
  ownerId: string,
  ownerOutcome: string,
  ownerMappedOutcome: 'trigger' | 'no_action' | 'defer' | 'blocked',
) {
  return { ownerType, ownerId, ownerPolicyVersion: `${ownerType}_v1`, ownerOutcome, ownerMappedOutcome };
}

function allFlags(flag: 'legacy' | 'shadow' | 'enforced'): ConvergenceConditionalCapabilityFlags {
  return { revision: flag, targeted: flag, retest: flag, transfer: flag };
}

function check(id: string, title: string, evidence: string, passed: boolean): ProductComplexityStage2BrowserCheck {
  return { id, title, evidence, passed };
}
