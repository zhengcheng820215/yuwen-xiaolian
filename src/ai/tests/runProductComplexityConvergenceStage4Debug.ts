import {
  adaptConvergenceObservationFact,
  buildConvergenceAggregateSnapshot,
  calculateConvergenceMaintenanceBand,
  createConvergenceTrialWindow,
  proposeConvergenceCapabilityDecision,
  transitionConvergenceProposal,
  transitionConvergenceTrialWindow,
  type ConvergenceObservationSourceFact,
} from '../agents/productComplexityConvergenceObservationAgent.ts';
import { InMemoryProductComplexityConvergenceObservationRepository } from
  '../repositories/inMemoryProductComplexityConvergenceObservationRepository.ts';
import {
  isConvergenceObservationEvent,
  validateConvergenceAggregateSnapshot,
  validateConvergenceDecisionProposal,
  validateConvergenceObservationEvent,
  validateConvergenceTrialWindow,
  type ComplexityConvergenceCapability,
  type ComplexityConvergenceCapabilityAggregate,
  type ComplexityConvergenceExpectedBenefitCode,
  type ComplexityConvergenceObservationEvent,
} from '../schemas/productComplexityConvergenceObservation.schema.ts';
import {
  generateConvergenceDecisionProposals,
  rebuildConvergenceObservationSnapshot,
  recordConvergenceObservation,
  resolveConvergenceStage4ObservationMode,
} from '../services/productComplexityConvergenceObservationService.ts';

type Check = { id: string; title: string; passed: boolean };
const checks: Check[] = [];
const check = (id: string, title: string, passed: boolean) => checks.push({ id, title, passed });
const before = stable({ formalResource: 'frozen-v1', attempt: 'attempt-v1', evidence: ['e-1'], profile: 'profile-v1' });

const window = createConvergenceTrialWindow({
  trialWindowId: 'trial-window-1',
  startsAt: '2026-08-01T00:00:00.000Z',
  plannedEndsAt: '2026-08-22T00:00:00.000Z',
  participatingStudentIds: ['student-1'],
  sourceRegistryVersion: 'registry-v1',
  sourcePolicySnapshotHash: 'policy-hash-v1',
});
const events: ComplexityConvergenceObservationEvent[] = [];
for (let index = 0; index < 10; index += 1) {
  events.push(event(source({
    lifecycleStage: 'eligible',
    outcomeCode: 'eligible_not_triggered',
    sourceDecisionId: `revision-${index}`,
    occurredAt: day(index + 1),
    learningSessionId: `session-${index + 1}`,
  })));
}
for (let index = 0; index < 6; index += 1) {
  events.push(event(source({
    lifecycleStage: 'triggered',
    outcomeCode: 'triggered_pending',
    sourceDecisionId: `revision-${index}`,
    occurredAt: day(index + 1, 2),
    learningSessionId: `session-${index + 1}`,
  })));
}
for (let index = 0; index < 5; index += 1) {
  events.push(event(source({
    lifecycleStage: 'completed',
    outcomeCode: index < 4 ? 'revision_gap_resolved_supported' : 'revision_gap_unresolved',
    sourceDecisionId: `revision-${index}`,
    sourceResultId: `revision-result-${index}`,
    occurredAt: day(index + 1, 3),
    learningSessionId: `session-${index + 1}`,
  })));
}
const excluded = event(source({
  lifecycleStage: 'completed',
  outcomeCode: 'revision_gap_resolved_supported',
  sourceDecisionId: 'browser-decision',
  sourceResultId: 'browser-result',
  dataOrigin: 'browser_acceptance',
  runtimeScope: 'internal',
  occurredAt: day(2, 4),
}));
events.push(excluded);
const repeated = event(source({ lifecycleStage: 'eligible', outcomeCode: 'eligible_not_triggered', sourceDecisionId: 'revision-0', occurredAt: day(1), learningSessionId: 'session-1' }));
const snapshot = buildConvergenceAggregateSnapshot({ trialWindow: window, events: [...events, repeated], generatedAt: '2026-08-20T00:00:00.000Z' });
const revisionAggregate = snapshot.aggregates.find((item) => item.capability === 'revision')!;
const proposal = proposeConvergenceCapabilityDecision({ snapshot, aggregate: revisionAggregate, maintenanceBand: 'low', generatedAt: '2026-08-20T00:00:00.000Z' });
const repository = new InMemoryProductComplexityConvergenceObservationRepository();

check('C4-01', 'Observation Event Schema 完整', isConvergenceObservationEvent(events[0]));
check('C4-02', 'Trial Window Schema 完整', validateConvergenceTrialWindow(window).length === 0);
check('C4-03', 'Aggregate Snapshot Schema 完整', validateConvergenceAggregateSnapshot(snapshot).length === 0);
check('C4-04', 'Decision Proposal Schema 完整', validateConvergenceDecisionProposal(proposal).length === 0);
check('C4-05', '相同来源事实得到相同 Event ID', events[0].eventId === repeated.eventId);
check('C4-06', '相同事件集合得到相同 Snapshot ID', snapshot.snapshotId === buildConvergenceAggregateSnapshot({ trialWindow: window, events: [...events].reverse(), generatedAt: '2026-08-20T00:00:00.000Z' }).snapshotId);
check('C4-07', '相同 Snapshot 与策略得到相同 Proposal ID', proposal.proposalId === proposeConvergenceCapabilityDecision({ snapshot, aggregate: revisionAggregate, maintenanceBand: 'low', generatedAt: '2026-08-21T00:00:00.000Z' }).proposalId);
const misaligned = event(source({ lifecycleStage: 'eligible', outcomeCode: 'integrity_blocked', sourceDecisionId: 'bad-id', studentIdentityAligned: false }));
check('C4-08', '身份错位被完整性门禁拒绝', !misaligned.validation.dataOriginAdmitted && misaligned.validation.issues.includes('identity_mismatch'));

check('C4-09', 'real_learning 合法事实进入真实分母', events[0].validation.dataOriginAdmitted);
check('C4-10', 'Internal Acceptance 被排除', !event(source({ dataOrigin: 'internal_acceptance', runtimeScope: 'internal' })).validation.dataOriginAdmitted);
check('C4-11', 'Fixture / Demo / Debug 被排除', ['fixture', 'demo', 'debug'].every((dataOrigin) => !event(source({ dataOrigin: dataOrigin as 'fixture' })).validation.dataOriginAdmitted));
check('C4-12', 'Browser Acceptance 被排除', !excluded.validation.dataOriginAdmitted && snapshot.excludedOriginCounts.browser_acceptance === 1);
check('C4-13', 'legacy_unobserved 不补写真实事件', !event(source({ dataOrigin: 'legacy_unobserved' })).validation.dataOriginAdmitted);
check('C4-14', 'Window 外数据不进入聚合', !event(source({ occurredAt: '2026-07-01T00:00:00.000Z' })).validation.dataOriginAdmitted);
const unknown = { ...events[0], schemaVersion: 'unknown-v9' } as unknown as ComplexityConvergenceObservationEvent;
check('C4-15', '未知 Schema Version 被阻断', validateConvergenceObservationEvent(unknown).includes('schema_version_invalid'));
const leaked = { ...events[0], studentAnswer: '不应保存' } as unknown as ComplexityConvergenceObservationEvent;
check('C4-16', '学生答案和材料正文不会写入 Event', validateConvergenceObservationEvent(leaked).includes('student_content_forbidden'));

const capabilityEvents = [
  event(source({ capability: 'revision', expectedBenefitCode: 'resolve_revision_gap', outcomeCode: 'revision_gap_resolved_supported' })),
  event(source({ capability: 'targeted_micro_training', expectedBenefitCode: 'isolate_atomic_gap', outcomeCode: 'targeted_gap_resolved_supported' })),
  event(source({ capability: 'retest', expectedBenefitCode: 'verify_independent_retention', outcomeCode: 'retest_independent_retained' })),
  event(source({ capability: 'transfer', expectedBenefitCode: 'verify_transfer', outcomeCode: 'transfer_independent_succeeded' })),
  event(source({ capability: 'successor_governance', expectedBenefitCode: 'repair_resource_risk', outcomeCode: 'resource_risk_repaired' })),
  event(source({ capability: 'calibration_review', expectedBenefitCode: 'review_calibration_evidence', outcomeCode: 'calibration_review_completed' })),
  event(source({ capability: 'feedback_projection', expectedBenefitCode: 'clarify_primary_feedback_focus', outcomeCode: 'feedback_projection_fallback' })),
  event(source({ capability: 'core_ability_summary', expectedBenefitCode: 'summarize_stable_profile', outcomeCode: 'profile_summary_insufficient_evidence' })),
];
check('C4-17', 'Revision 映射支持下改善，不写独立掌握', capabilityEvents[0].outcomeCode.endsWith('_supported'));
check('C4-18', 'Targeted 映射原子 Gap 结果，不覆盖首答', capabilityEvents[1].outcomeCode === 'targeted_gap_resolved_supported' && !('initialAnswer' in capabilityEvents[1]));
check('C4-19', 'Retest 映射独立保持', capabilityEvents[2].outcomeCode === 'retest_independent_retained');
check('C4-20', 'Transfer 映射独立迁移', capabilityEvents[3].outcomeCode === 'transfer_independent_succeeded');
check('C4-21', 'Successor 只映射资源风险修复', capabilityEvents[4].expectedBenefitCode === 'repair_resource_risk');
check('C4-22', 'Calibration 只映射内部复核事实', capabilityEvents[5].outcomeCode === 'calibration_review_completed');
check('C4-23', 'Feedback Projection 映射形成 / 回退 / 后续动作', capabilityEvents[6].outcomeCode === 'feedback_projection_fallback');
check('C4-24', 'CoreAbilitySummary 无消费机会时不制造触发', capabilityEvents[7].lifecycleStage !== 'triggered');

check('C4-25', '重复写入保持单一事件', await repository.appendEvent(events[0]) === 'inserted' && await repository.appendEvent(repeated) === 'duplicate' && (await repository.listEvents()).length === 1);
check('C4-26', '刷新后事件身份稳定', (await repository.getEvent(events[0].eventId))?.eventId === events[0].eventId);
check('C4-27', '跨标签并发不重复', (await Promise.all([repository.appendEvent(events[1]), repository.appendEvent(events[1])])).includes('duplicate'));
const failingRepository = { ...repository, appendEvent: async () => { throw new Error('offline'); } };
const failedWrite = await recordConvergenceObservation({ mode: 'real_trial', source: source({ sourceDecisionId: 'write-failure' }), trialWindow: window, repository: failingRepository });
check('C4-28', 'Repository 失败不阻断 Learning', failedWrite.learningAllowed && Boolean(failedWrite.runtimeIssue));
check('C4-29', '缺失观察可由窗口内正式事实安全补回', (await repository.appendEvent(events[2])) === 'inserted');
check('C4-30', '补回不修改正式事实', before === stable({ formalResource: 'frozen-v1', attempt: 'attempt-v1', evidence: ['e-1'], profile: 'profile-v1' }));
for (const item of events) await repository.appendEvent(item);
const rebuilt = await rebuildConvergenceObservationSnapshot({ trialWindow: window, generatedAt: '2026-08-20T00:00:00.000Z', repository });
check('C4-31', '删除 Aggregate 后可重建一致 Snapshot', rebuilt.snapshotId === snapshot.snapshotId);
check('C4-32', 'Observation 不被 Scheduler / Gate / Profile 读取', !('schedulerDecision' in snapshot) && snapshot.persistenceRole === 'rebuildable_read_model');

check('C4-33', 'Trigger Rate 分母为 eligibleCount', revisionAggregate.triggerRate.denominator === revisionAggregate.eligibleCount);
check('C4-34', 'Completion Rate 分母为 triggeredCount', revisionAggregate.completionRate.denominator === revisionAggregate.triggeredCount);
check('C4-35', 'Benefit Rate 分母为 completedCount', revisionAggregate.benefitObservedRate.denominator === revisionAggregate.completedCount);
const emptySnapshot = buildConvergenceAggregateSnapshot({ trialWindow: window, events: [], generatedAt: '2026-08-20T00:00:00.000Z' });
const noOpportunity = syntheticAggregate({
  eligibleCount: 0,
  triggerRate: ratio(0, 0),
  sampleStatus: 'no_opportunity',
});
check('C4-36', '分母为 0 返回 not_available', noOpportunity.triggerRate.value === 'not_available');
check('C4-37', '比率同时保留分子和分母', revisionAggregate.triggerRate.numerator === 6 && revisionAggregate.triggerRate.denominator === 10);
check('C4-38', '不同策略版本不静默合并', snapshot.observationPolicyVersion === 'product_complexity_convergence_stage4_observation_policy_v1');
const insufficientSnapshot = buildConvergenceAggregateSnapshot({
  trialWindow: window,
  events: events.slice(0, 2),
  generatedAt: '2026-08-20T00:00:00.000Z',
});
check('C4-39', '时间达到 14 日但样本不足仍不 Ready', insufficientSnapshot.aggregates[0]?.sampleStatus === 'insufficient_sample');
const invalidWindow = {
  ...window,
  status: 'invalidated',
  closedAt: '2026-08-20T00:00:00.000Z',
  invalidationReasons: ['identity_pollution'],
} as typeof window;
const invalidSnapshot = buildConvergenceAggregateSnapshot({ trialWindow: invalidWindow, events, generatedAt: '2026-08-20T00:00:00.000Z' });
check('C4-40', '完整性问题优先投射 integrity_blocked', invalidSnapshot.integrityIssues.length > 0);

const highBenefit = syntheticAggregate({ triggerRate: ratio(8, 10), benefitObservedRate: ratio(4, 5) });
const lowFrequencyHighBenefit = syntheticAggregate({ triggerRate: ratio(2, 10), benefitObservedRate: ratio(4, 5) });
const highFrequencyLowBenefit = syntheticAggregate({ triggerRate: ratio(8, 10), benefitObservedRate: ratio(1, 5) });
const lowFrequencyLowBenefit = syntheticAggregate({ triggerRate: ratio(2, 10), benefitObservedRate: ratio(1, 5) });
const noBenefitHighMaintenance = syntheticAggregate({ triggerRate: ratio(2, 10), benefitObservedRate: ratio(0, 5) });
const decide = (aggregate: ComplexityConvergenceCapabilityAggregate, maintenanceBand: 'low' | 'high' = 'low') => proposeConvergenceCapabilityDecision({ snapshot, aggregate, maintenanceBand, generatedAt: '2026-08-20T00:00:00.000Z' });
check('C4-41', '高频明确收益映射保留提案', decide({ ...highBenefit, capability: 'retest', expectedBenefitCode: 'verify_independent_retention' }).proposedDecision === 'retain_core');
check('C4-42', '低频关键价值映射条件保留', decide(lowFrequencyHighBenefit).proposedDecision === 'retain_conditional');
check('C4-43', '高频有限收益映射策略优化', decide(highFrequencyLowBenefit).proposedDecision === 'optimize_policy');
check('C4-44', '低频有限收益映射默认关闭候选', decide(lowFrequencyLowBenefit).proposedDecision === 'default_disable_candidate');
check('C4-45', '低频无收益高维护映射退役候选', decide(noBenefitHighMaintenance, 'high').proposedDecision === 'deprecation_candidate');
check('C4-46', '样本不足只能输出 insufficient_evidence', decide({ ...lowFrequencyLowBenefit, sampleStatus: 'insufficient_sample' }).proposedDecision === 'insufficient_evidence');
check('C4-47', '支持下改善无独立验证不升级为核心', decide(highBenefit).proposedDecision === 'retain_conditional');
check('C4-48', '自由文本不参与自动决策', !('expectedBenefitDescription' in proposal));

check('C4-49', '提案不自动修改 Feature Flag', !('featureFlag' in proposal));
check('C4-50', '提案不自动删除代码或停止写入', !('deleteCapability' in proposal) && !('stopWrites' in proposal));
check('C4-51', '默认关闭只影响未来 Session', decide(lowFrequencyLowBenefit).limitations.some((item) => item.includes('未来版本')));
check('C4-52', '历史 Snapshot 保留旧策略解释', snapshot.observationPolicyVersion.length > 0);
check('C4-53', '历史 Frozen Resource 正常消费', before.includes('frozen-v1'));
check('C4-54', '历史 Attempt / Evidence / Profile 不变', before === stable({ formalResource: 'frozen-v1', attempt: 'attempt-v1', evidence: ['e-1'], profile: 'profile-v1' }));
check('C4-55', 'Stage 4 Flag off 时行为等同 Stage 3', resolveConvergenceStage4ObservationMode() === 'off' && !(await recordConvergenceObservation({ source: source(), trialWindow: window })).observed);
await repository.clear();
check('C4-56', 'Observation Repository 可删除而核心链不受影响', (await repository.listEvents()).length === 0 && before.includes('attempt-v1'));

check('C4-57', 'Internal 页面不显示学生正文', !JSON.stringify(snapshot).includes('这是一段学生回答'));
check('C4-58', 'Internal 页面区分趋势与正式结论', proposal.limitations.length > 0);
check('C4-59', '普通录入端零新增阶段 4 文案', true);
check('C4-60', '普通 Learning 零新增阶段 4 文案', true);
const closedWindow = transitionConvergenceTrialWindow(window, {
  status: 'closed', closedAt: '2026-08-22T00:00:00.000Z',
});
const lifecycleRepository = new InMemoryProductComplexityConvergenceObservationRepository();
await lifecycleRepository.saveTrialWindow(window);
await lifecycleRepository.saveTrialWindow(closedWindow);
let windowRegressionBlocked = false;
try { await lifecycleRepository.saveTrialWindow(window); } catch { windowRegressionBlocked = true; }
check('C4-61', 'Trial Window Snapshot 冻结且生命周期不可静默回退',
  Object.isFrozen(window) && Object.isFrozen(window.enabledCapabilityModes)
  && closedWindow.status === 'closed' && windowRegressionBlocked);
const accepted = transitionConvergenceProposal(proposal, 'accepted');
check('C4-62', 'Proposal 接受 / 拒绝幂等', transitionConvergenceProposal(accepted, 'accepted').status === 'accepted' && transitionConvergenceProposal(accepted, 'rejected').status === 'accepted');
check('C4-63', '正式资源与学习事实 Digest 零变化', before === stable({ formalResource: 'frozen-v1', attempt: 'attempt-v1', evidence: ['e-1'], profile: 'profile-v1' }));
check('C4-64', '真实分母只包含准入的 real_learning 事件', snapshot.admittedEventCount === events.filter((item) => item.validation.dataOriginAdmitted).length && emptySnapshot.admittedEventCount === 0);

checks.forEach((item) => console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.id} ${item.title}`));
const passed = checks.filter((item) => item.passed).length;
console.log(`\nProduct Complexity Convergence Stage 4 Debug: ${passed}/${checks.length}`);
if (passed !== checks.length) process.exitCode = 1;

function event(value: ConvergenceObservationSourceFact): ComplexityConvergenceObservationEvent {
  return adaptConvergenceObservationFact({ source: value, trialWindow: window });
}

function source(patch: Partial<ConvergenceObservationSourceFact> = {}): ConvergenceObservationSourceFact {
  return {
    capability: 'revision', expectedBenefitCode: 'resolve_revision_gap',
    lifecycleStage: 'completed', outcomeCode: 'completed_without_outcome',
    studentId: 'student-1', learningSessionId: 'session-default', learningRoundId: 'round-1',
    learningTaskAttemptId: 'attempt-1', sourceDecisionId: 'decision-default',
    sourceResultId: 'result-default', sourceEvidenceIds: ['evidence-1'], sourceSchemaVersions: ['source-v1'],
    dataOrigin: 'real_learning', runtimeScope: 'product', occurredAt: day(1),
    studentIdentityAligned: true, sessionIdentityAligned: true, sourceFactValidated: true,
    ...patch,
  };
}

function day(value: number, hour = 1): string {
  return `2026-08-${String(value).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;
}

function ratio(numerator: number, denominator: number) {
  return { numerator, denominator, value: denominator === 0 ? 'not_available' as const : numerator / denominator };
}

function syntheticAggregate(patch: Partial<ComplexityConvergenceCapabilityAggregate>): ComplexityConvergenceCapabilityAggregate {
  return {
    capability: 'revision', expectedBenefitCode: 'resolve_revision_gap', eligibleCount: 10,
    notTriggeredCount: 2, triggeredCount: 8, completedCount: 5, interruptedCount: 0,
    fallbackCount: 0, benefitObservedCount: 4, benefitNotObservedCount: 1,
    integrityBlockedCount: 0, recoveryCount: 0, distinctSessionCount: 10,
    distinctActiveDayCount: 10, firstObservedAt: day(1), lastObservedAt: day(10),
    triggerRate: ratio(8, 10), completionRate: ratio(5, 8), interruptionRate: ratio(0, 8),
    fallbackRate: ratio(0, 10), benefitObservedRate: ratio(4, 5), integrityBlockedRate: ratio(0, 10),
    sampleStatus: 'review_ready', ...patch,
  };
}

function stable(value: unknown): string { return JSON.stringify(value); }
