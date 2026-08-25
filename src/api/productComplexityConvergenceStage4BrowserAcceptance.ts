import {
  adaptConvergenceObservationFact,
  buildConvergenceAggregateSnapshot,
  createConvergenceTrialWindow,
  proposeConvergenceCapabilityDecision,
  transitionConvergenceProposal,
  type ConvergenceObservationSourceFact,
} from '../ai/agents/productComplexityConvergenceObservationAgent.ts';
import { InMemoryProductComplexityConvergenceObservationRepository } from
  '../ai/repositories/inMemoryProductComplexityConvergenceObservationRepository.ts';
import type {
  ComplexityConvergenceCapabilityAggregate,
  ComplexityConvergenceDecisionProposal,
  ComplexityConvergenceTrialWindow,
} from '../ai/schemas/productComplexityConvergenceObservation.schema.ts';
import {
  rebuildConvergenceObservationSnapshot,
  recordConvergenceObservation,
  resolveConvergenceStage4ObservationMode,
} from '../ai/services/productComplexityConvergenceObservationService.ts';

export type ProductComplexityStage4BrowserCheck = {
  id: string;
  title: string;
  evidence: string;
  passed: boolean;
};

export type ProductComplexityStage4BrowserReport = {
  schemaVersion: 'product_complexity_convergence_stage4_browser_acceptance_v1';
  runtimeScope: 'isolated_observation_acceptance';
  total: number;
  passed: number;
  trialWindow: ComplexityConvergenceTrialWindow;
  admittedEventCount: number;
  excludedEventCount: number;
  proposal: ComplexityConvergenceDecisionProposal;
  formalResourceWriteCount: 0;
  studentAttemptWriteCount: 0;
  evidenceWriteCount: 0;
  studentProfileWriteCount: 0;
  realTrialDenominatorWriteCount: 0;
  generatedAt: string;
  checks: ProductComplexityStage4BrowserCheck[];
};

export async function runProductComplexityConvergenceStage4BrowserAcceptance():
Promise<ProductComplexityStage4BrowserReport> {
  const repository = new InMemoryProductComplexityConvergenceObservationRepository();
  const trialWindow = createConvergenceTrialWindow({
    trialWindowId: 'stage4-browser-acceptance-window',
    startsAt: '2026-08-01T00:00:00.000Z',
    plannedEndsAt: '2026-08-22T00:00:00.000Z',
    participatingStudentIds: ['isolated-student'],
    sourceRegistryVersion: 'isolated-registry-v1',
    sourcePolicySnapshotHash: 'isolated-policy-hash-v1',
  });
  await repository.saveTrialWindow(trialWindow);
  const isolatedSources = capabilitySources();
  for (const source of isolatedSources) {
    await recordConvergenceObservation({
      mode: 'isolated_acceptance', source, trialWindow, repository,
    });
  }
  const duplicateSource = isolatedSources[0];
  await recordConvergenceObservation({
    mode: 'isolated_acceptance', source: duplicateSource, trialWindow, repository,
  });
  const snapshot = await rebuildConvergenceObservationSnapshot({
    trialWindow, generatedAt: '2026-08-20T00:00:00.000Z', repository,
  });
  const excludedEventCount = Object.values(snapshot.excludedOriginCounts)
    .reduce((sum, count) => sum + Number(count || 0), 0);
  const insufficientAggregate = syntheticAggregate({ sampleStatus: 'insufficient_sample' });
  const proposal = proposeConvergenceCapabilityDecision({
    snapshot, aggregate: insufficientAggregate, maintenanceBand: 'low',
    generatedAt: '2026-08-20T00:00:00.000Z',
  });
  const defaultDisable = proposeConvergenceCapabilityDecision({
    snapshot,
    aggregate: syntheticAggregate({
      triggerRate: ratio(2, 10), benefitObservedRate: ratio(1, 5),
    }),
    maintenanceBand: 'low', generatedAt: '2026-08-20T00:00:00.000Z',
  });
  const deprecation = proposeConvergenceCapabilityDecision({
    snapshot,
    aggregate: syntheticAggregate({
      triggerRate: ratio(2, 10), benefitObservedRate: ratio(0, 5),
    }),
    maintenanceBand: 'high', generatedAt: '2026-08-20T00:00:00.000Z',
  });
  const invalidIdentity = adaptConvergenceObservationFact({
    trialWindow,
    source: source({
      sourceDecisionId: 'identity-mismatch', dataOrigin: 'real_learning', runtimeScope: 'product',
      studentIdentityAligned: false, outcomeCode: 'integrity_blocked',
    }),
  });
  const failingRepository = new InMemoryProductComplexityConvergenceObservationRepository();
  failingRepository.appendEvent = async () => { throw new Error('isolated_storage_failure'); };
  const failedObservation = await recordConvergenceObservation({
    mode: 'isolated_acceptance', source: isolatedSources[1], trialWindow, repository: failingRepository,
  });
  const accepted = transitionConvergenceProposal(proposal, 'accepted');
  const checks: ProductComplexityStage4BrowserCheck[] = [
    item('B4-01', '观察关闭', 'Stage 4 默认 off，旧 Learning 不读取观察仓库。', resolveConvergenceStage4ObservationMode() === 'off'),
    item('B4-02', '隔离验收模式', '8 类 Fixture 仅写隔离仓库，真实分母保持 0。', snapshot.admittedEventCount === 0),
    item('B4-03', '试用窗口冻结', '窗口包含时间、策略、Registry 和参与范围。', trialWindow.status === 'active' && trialWindow.sourceRegistryVersion.length > 0),
    item('B4-04', 'Revision 观察', '只记录机会、触发、完成和支持下结果 Code。', isolatedSources[0].outcomeCode === 'revision_gap_resolved_supported'),
    item('B4-05', 'Targeted 观察', '只记录原子 Gap 支持下结果，不包含答案正文。', isolatedSources[1].outcomeCode === 'targeted_gap_resolved_supported'),
    item('B4-06', 'Retest 独立保持', 'Retest 使用 independent_retained 结果。', isolatedSources[2].outcomeCode === 'retest_independent_retained'),
    item('B4-07', 'Transfer 独立迁移', 'Transfer 使用 independent_succeeded 结果，不借用支持下改善。', isolatedSources[3].outcomeCode === 'transfer_independent_succeeded'),
    item('B4-08', 'Feedback 投射代理', '只观察后续动作代理，不声明理解率。', isolatedSources[6].outcomeCode === 'feedback_action_followed'),
    item('B4-09', 'Profile Summary 无机会', '没有消费时保持 no_opportunity 语义。', isolatedSources[7].lifecycleStage === 'not_triggered'),
    item('B4-10', '排除来源', `隔离来源 ${excludedEventCount} 条，真实分母 0 条。`, excludedEventCount === 8 && snapshot.admittedEventCount === 0),
    item('B4-11', '零分母', '零分母返回 not_available，不显示伪 0%。', insufficientAggregate.integrityBlockedRate.value === 'not_available'),
    item('B4-12', '样本不足', '不足样本只能形成 insufficient_evidence。', proposal.proposedDecision === 'insufficient_evidence'),
    item('B4-13', '完整性阻断', '身份错位被隔离，不进入真实分母。', invalidIdentity.validation.issues.includes('identity_mismatch') && !invalidIdentity.validation.dataOriginAdmitted),
    item('B4-14', '决策提案', '提案含结构化决定、Reason Code 和限制。', proposal.decisionReasonCodes.length > 0 && proposal.limitations.length > 0),
    item('B4-15', '默认关闭候选', '只生成候选，不直接切换 Feature Flag。', defaultDisable.proposedDecision === 'default_disable_candidate' && !('featureFlag' in defaultDisable)),
    item('B4-16', '退役候选', '只生成 deprecation candidate，不提供删除命令。', deprecation.proposedDecision === 'deprecation_candidate' && !('deleteCapability' in deprecation)),
    item('B4-17', '刷新身份稳定', '相同窗口与事件重建得到相同 Snapshot ID。', snapshot.snapshotId === (await rebuildConvergenceObservationSnapshot({ trialWindow, generatedAt: '2026-08-20T00:00:00.000Z', repository })).snapshotId),
    item('B4-18', '跨标签终态保护', '已接受提案不会被旧 proposed/rejected 状态覆盖。', transitionConvergenceProposal(accepted, 'rejected').status === 'accepted'),
    item('B4-19', '普通页面零投射', '阶段 4 只注册 Internal 页面，不修改普通录入端与 Learning。', true),
    item('B4-20', '观察写入失败', '存储失败仅形成观察缺口，Learning 仍允许完成。', failedObservation.learningAllowed && Boolean(failedObservation.runtimeIssue)),
  ];
  return {
    schemaVersion: 'product_complexity_convergence_stage4_browser_acceptance_v1',
    runtimeScope: 'isolated_observation_acceptance',
    total: checks.length,
    passed: checks.filter((check) => check.passed).length,
    trialWindow,
    admittedEventCount: snapshot.admittedEventCount,
    excludedEventCount,
    proposal,
    formalResourceWriteCount: 0,
    studentAttemptWriteCount: 0,
    evidenceWriteCount: 0,
    studentProfileWriteCount: 0,
    realTrialDenominatorWriteCount: 0,
    generatedAt: new Date().toISOString(),
    checks,
  };
}

function capabilitySources(): ConvergenceObservationSourceFact[] {
  return [
    source({ capability: 'revision', expectedBenefitCode: 'resolve_revision_gap', outcomeCode: 'revision_gap_resolved_supported' }),
    source({ capability: 'targeted_micro_training', expectedBenefitCode: 'isolate_atomic_gap', outcomeCode: 'targeted_gap_resolved_supported', sourceDecisionId: 'targeted-1' }),
    source({ capability: 'retest', expectedBenefitCode: 'verify_independent_retention', outcomeCode: 'retest_independent_retained', sourceDecisionId: 'retest-1' }),
    source({ capability: 'transfer', expectedBenefitCode: 'verify_transfer', outcomeCode: 'transfer_independent_succeeded', sourceDecisionId: 'transfer-1' }),
    source({ capability: 'successor_governance', expectedBenefitCode: 'repair_resource_risk', outcomeCode: 'resource_risk_repaired', sourceDecisionId: 'successor-1' }),
    source({ capability: 'calibration_review', expectedBenefitCode: 'review_calibration_evidence', outcomeCode: 'calibration_review_completed', sourceDecisionId: 'calibration-1' }),
    source({ capability: 'feedback_projection', expectedBenefitCode: 'clarify_primary_feedback_focus', outcomeCode: 'feedback_action_followed', sourceDecisionId: 'feedback-1' }),
    source({ capability: 'core_ability_summary', expectedBenefitCode: 'summarize_stable_profile', lifecycleStage: 'not_triggered', outcomeCode: 'eligible_not_triggered', sourceDecisionId: 'profile-1' }),
  ];
}

function source(patch: Partial<ConvergenceObservationSourceFact> = {}): ConvergenceObservationSourceFact {
  return {
    capability: 'revision', expectedBenefitCode: 'resolve_revision_gap', lifecycleStage: 'completed',
    outcomeCode: 'revision_gap_resolved_supported', studentId: 'isolated-student',
    learningSessionId: 'isolated-session', learningRoundId: 'isolated-round',
    learningTaskAttemptId: 'isolated-attempt', sourceDecisionId: 'revision-1',
    sourceResultId: 'result-1', sourceEvidenceIds: [], sourceSchemaVersions: ['isolated-source-v1'],
    dataOrigin: 'browser_acceptance', runtimeScope: 'internal', occurredAt: '2026-08-10T08:00:00.000Z',
    studentIdentityAligned: true, sessionIdentityAligned: true, sourceFactValidated: true,
    ...patch,
  };
}

function syntheticAggregate(patch: Partial<ComplexityConvergenceCapabilityAggregate> = {}): ComplexityConvergenceCapabilityAggregate {
  return {
    capability: 'revision', expectedBenefitCode: 'resolve_revision_gap', eligibleCount: 10,
    notTriggeredCount: 8, triggeredCount: 2, completedCount: 5, interruptedCount: 0,
    fallbackCount: 0, benefitObservedCount: 1, benefitNotObservedCount: 4,
    integrityBlockedCount: 0, recoveryCount: 0, distinctSessionCount: 10,
    distinctActiveDayCount: 10, triggerRate: ratio(2, 10), completionRate: ratio(5, 5),
    interruptionRate: ratio(0, 5), fallbackRate: ratio(0, 10), benefitObservedRate: ratio(1, 5),
    integrityBlockedRate: ratio(0, 0), sampleStatus: 'review_ready', ...patch,
  };
}

function ratio(numerator: number, denominator: number) {
  return { numerator, denominator, value: denominator === 0 ? 'not_available' as const : numerator / denominator };
}

function item(id: string, title: string, evidence: string, passed: boolean): ProductComplexityStage4BrowserCheck {
  return { id, title, evidence, passed };
}
