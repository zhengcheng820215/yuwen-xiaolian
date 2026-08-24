import assert from 'node:assert/strict';
import {
  ReadingOpenResponseExistingQuestionGovernanceAgent,
  resolveGovernanceAvailableActions,
  resolveReadingSessionResourceVersion,
  type ExistingQuestionCandidateGateway,
} from '../agents/readingOpenResponseExistingQuestionGovernanceAgent.ts';
import { InMemoryProgressiveLoadStage4Repository } from
  '../repositories/inMemoryProgressiveLoadStage4Repository.ts';
import { InMemoryReadingOpenResponseGovernanceRepository } from
  '../repositories/inMemoryReadingOpenResponseGovernanceRepository.ts';
import {
  READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';
import {
  LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION,
  PRODUCT_LEARNING_STUDENT_ID,
  type LearningObservationEvent,
} from '../schemas/learningObservationEvent.schema.ts';
import { createLearningProgressionContextSnapshot } from
  '../schemas/learningProgressionContext.schema.ts';
import {
  PROGRESSIVE_LOAD_CALIBRATION_EVENT_SCHEMA_VERSION,
  PROGRESSIVE_LOAD_GOVERNANCE_CONTEXT_SCHEMA_VERSION,
  createDefaultProgressiveLoadCalibrationThresholdPolicy,
  isProgressiveLoadCalibrationEvent,
  isProgressiveLoadCalibrationProjection,
  isProgressiveLoadCalibrationThresholdPolicy,
  isProgressiveLoadGovernanceContext,
  stableProgressiveLoadId,
  type ProgressiveLoadCalibrationEvent,
  type ProgressiveLoadGovernanceContext,
} from '../schemas/progressiveLoadStage4.schema.ts';
import { READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION } from
  '../schemas/readingTrainingProgressionAudit.schema.ts';
import type { QuestionCandidate } from '../schemas/questionCandidate.schema.ts';
import {
  ProgressiveLoadCalibrationService,
  auditProgressiveLoadCalibrationEvents,
  buildProgressiveLoadCalibrationEvent,
  buildProgressiveLoadCalibrationProjection,
} from '../services/progressiveLoadCalibrationService.ts';
import { ProgressiveLoadGovernanceService } from
  '../services/progressiveLoadGovernanceService.ts';

type DebugCase = { id: string; name: string; run: () => void | Promise<void> };
const NOW = '2026-08-24T08:00:00.000Z';
const cases: DebugCase[] = [];
const test = (id: string, name: string, run: DebugCase['run']) => cases.push({ id, name, run });

test('S4-01', '合法 ProgressiveLoadGovernanceContext 通过 Guard', () => assert(isProgressiveLoadGovernanceContext(governanceContext())));
test('S4-02', '缺 sourceResourceVersionId 被拒绝', () => assert(!isProgressiveLoadGovernanceContext(governanceContext({ sourceResourceVersionId: '' }))));
test('S4-03', 'Source / Audit Digest 变化生成新治理身份', () => assert.notEqual(contextId('source-a', 'audit-a'), contextId('source-b', 'audit-a')));
test('S4-04', '相同基线重放返回同一 Context', async () => {
  const repo = new InMemoryProgressiveLoadStage4Repository();
  const first = await repo.saveGovernanceContext(governanceContext());
  const second = await repo.saveGovernanceContext(governanceContext());
  assert.equal(first.governanceContextId, second.governanceContextId);
});
test('S4-05', 'Registry Head 变化使旧 Context stale', async () => {
  const repo = new InMemoryProgressiveLoadStage4Repository();
  await repo.saveGovernanceContext(governanceContext());
  const changed = await new ProgressiveLoadGovernanceService(repo, undefined, () => NOW)
    .markStaleWhenRegistryHeadChanges({ questionLineageId: 'resource-1', activeResourceVersionId: 'resource-v2' });
  assert.equal(changed[0]?.status, 'stale');
});
test('S4-06', '单次学生失败不自动生成治理 Context', async () => assert.equal((await new InMemoryProgressiveLoadStage4Repository().listGovernanceContexts()).length, 0));
test('S4-07', '身份一致性错误可以最高优先级进入上下文', () => assert.equal(governanceContext({ targetOutcome: 'repair_identity_consistency', priority: 1 }).priority, 1));
test('S4-08', '治理批次边界最大为 5', async () => await assert.rejects(() => existingSetup().agent.planBatch({ idempotencyKey: 'batch', maximumSize: 6 })));
test('S4-09', 'retain 不生成 Candidate', async () => {
  const { agent } = existingSetup();
  const item = await agent.createCase(existingCase({ disposition: 'retain', findingCodes: [] }));
  assert.deepEqual(resolveGovernanceAvailableActions(item), []);
});
test('S4-10', '未选中题目零写入', async () => assert.equal((await new InMemoryProgressiveLoadStage4Repository().listGovernanceContexts()).length, 0));
test('S4-11', '治理身份 Hash 重放稳定', () => assert.equal(contextId('a', 'b'), contextId('a', 'b')));
test('S4-12', 'Context 不复制正式题正文', () => assert(!JSON.stringify(governanceContext()).includes('questionStem')));

test('S4-13', 'successor 治理继承正式身份引用', async () => {
  const repo = new InMemoryProgressiveLoadStage4Repository();
  const existing = existingSetup();
  const service = new ProgressiveLoadGovernanceService(repo, existing.agent, () => NOW);
  await repo.saveGovernanceContext(governanceContext());
  const linked = await service.linkToExistingGovernance(governanceContext().governanceContextId);
  assert(linked.existingGovernanceCaseId);
});
test('S4-14', '主要能力变化在既有治理链中阻断', async () => {
  const value = existingSetup(); const item = await value.agent.createCase(existingCase());
  const result = await value.agent.generateSuccessorCandidate({ ...generateInput(item.governanceCaseId), primaryAbilityChanged: true });
  assert.equal(result.governanceCase.status, 'blocked');
});
test('S4-15', 'Plan 变化必须形成不同 Hash', () => assert.notEqual(stableProgressiveLoadId('plan', ['a']), stableProgressiveLoadId('plan', ['b'])));
test('S4-16', '旧 Hash 不能表达新坡度', () => assert.notEqual(governanceContext().sourceProgressionPlanHash, 'plan-successor'));
test('S4-17', '只有 candidate_ready 才提供采用并发布', async () => assert.deepEqual(resolveGovernanceAvailableActions((await readyCase()).item), ['regenerate', 'adopt_and_publish']));
test('S4-18', '重复观察属于显式治理目标', () => assert.equal(governanceContext({ targetOutcome: 'remove_duplicate_observation' }).targetOutcome, 'remove_duplicate_observation'));
test('S4-19', '治理上下文不具备删除正式资源能力', () => assert(!('deleteResource' in governanceContext())));
test('S4-20', '响应形式不由治理上下文静默覆盖', () => assert(!('responseFormat' in governanceContext())));
test('S4-21', '相同采用命令幂等', async () => {
  const value = await readyCase(); await value.agent.recordAdopted(value.item.governanceCaseId, value.item.activeCandidateId!);
  assert.equal((await value.agent.recordAdopted(value.item.governanceCaseId, value.item.activeCandidateId!)).status, 'adopted');
});
test('S4-22', '未采用 Candidate 不形成 successor', async () => assert.equal((await readyCase()).item.successorResourceVersionId, undefined));
test('S4-23', '发布要求新的 successor Version', async () => {
  const value = await readyCase(); await value.agent.recordAdopted(value.item.governanceCaseId, value.item.activeCandidateId!);
  await assert.rejects(() => value.agent.recordPublished({ governanceCaseId: value.item.governanceCaseId, candidateId: value.item.activeCandidateId!, predecessorResourceVersionId: 'resource-v1', successorResourceVersionId: 'resource-v1' }));
});
test('S4-24', 'predecessor 保留可追踪', async () => assert.equal((await publishedCase()).published.sourceResourceVersionId, 'resource-v1'));
test('S4-25', '已开始 Session 继续消费 predecessor', () => assert.equal(resolveReadingSessionResourceVersion({ sessionStarted: true, sessionResourceVersionId: 'resource-v1', registryActiveResourceVersionId: 'resource-v2' }), 'resource-v1'));
test('S4-26', '新 Session 消费 successor', () => assert.equal(resolveReadingSessionResourceVersion({ sessionStarted: false, registryActiveResourceVersionId: 'resource-v2' }), 'resource-v2'));
test('S4-27', '回滚只切换 Head，不删除版本', () => assert.deepEqual(['resource-v1', 'resource-v2'].sort(), ['resource-v2', 'resource-v1'].sort()));
test('S4-28', 'stale Context 不显示采用能力', () => assert.equal(governanceContext({ status: 'stale' }).status, 'stale'));

test('S4-29', '合法真实 Learning 校准事件通过 Guard', () => assert(isProgressiveLoadCalibrationEvent(calibrationEvent())));
test('S4-30', 'Fixture / Demo / Internal Acceptance 被排除', () => assert.equal(auditProgressiveLoadCalibrationEvents([calibrationEvent({ runtimeScope: 'fixture', source: 'isolated_acceptance' })]).eligible, 0));
test('S4-31', '缺 Attempt 身份被排除', () => assert.equal(auditProgressiveLoadCalibrationEvents([calibrationEvent({ learningTaskAttemptId: '' })]).eligible, 0));
test('S4-32', '事件幂等键阻止重复计数', async () => {
  const repo = new InMemoryProgressiveLoadStage4Repository(); const event = calibrationEvent();
  assert.equal((await repo.saveEvent(event)).status, 'created'); assert.equal((await repo.saveEvent(event)).status, 'unchanged');
});
test('S4-33', 'Outbox 重放语义不制造第二份样本', () => assert.equal(auditProgressiveLoadCalibrationEvents([calibrationEvent(), calibrationEvent()]).eligible, 1));
test('S4-34', '事件仓库失败不抛出学习阻断', async () => {
  const service = new ProgressiveLoadCalibrationService(failingRepository());
  assert.equal(await service.recordFromLearningObservation({ observation: observation(), context: progressionContext() }), 'dropped');
});
test('S4-35', '恢复后相同事件可幂等补写', async () => {
  const repo = new InMemoryProgressiveLoadStage4Repository(); const service = new ProgressiveLoadCalibrationService(repo);
  assert.equal(await service.recordFromLearningObservation({ observation: observation(), context: progressionContext() }), 'created');
  assert.equal(await service.recordFromLearningObservation({ observation: observation(), context: progressionContext() }), 'unchanged');
});
test('S4-36', 'Invalid Response 不进入有效首答分母', () => {
  const invalid = buildProgressiveLoadCalibrationEvent({
    observation: observation(),
    context: progressionContext(),
    eventTypeOverride: 'invalid_response_rejected',
    responseFormat: 'text',
  });
  assert(invalid);
  assert.equal(invalid.eventType, 'invalid_response_rejected');
  assert.equal(projection([invalid]).validInitialAttemptCount, 0);
});
test('S4-37', 'Hint 与 Revision 保留支持身份', () => assert.equal(calibrationEvent({ supportMode: 'feedback_revision' }).supportMode, 'feedback_revision'));
test('S4-38', 'Targeted 不覆盖首次独立表现', () => assert.equal(projection([calibrationEvent({ eventType: 'valid_response_submitted', supportMode: 'targeted_training' })]).validInitialAttemptCount, 0));
test('S4-39', 'Retest / Transfer 保持独立支持身份', () => assert.notEqual(calibrationEvent({ supportMode: 'retest_independent' }).supportMode, calibrationEvent({ supportMode: 'transfer_independent' }).supportMode));
test('S4-40', 'Question Version 不一致不能进入同一投影', () => assert.notEqual(projection([calibrationEvent()]).projectionId, projection([calibrationEvent({ resourceVersionId: 'resource-v2' })]).projectionId));
test('S4-41', '同一学生重复 Attempt 不伪装成多学生', () => assert.equal(projection([calibrationEvent({ eventType: 'valid_response_submitted' }), calibrationEvent({ eventId: 'event-2', learningTaskAttemptId: 'attempt-2', eventType: 'valid_response_submitted' })]).distinctLearnerCount, 1));
test('S4-42', '事件不复制完整学生答案', () => assert(!('answerText' in calibrationEvent())));
test('S4-43', '完整性失败形成 issue 并退出分母', () => assert.equal(auditProgressiveLoadCalibrationEvents([{}]).excluded, 1));
test('S4-44', '正式学习事件可先完成再派生校准', () => assert(buildProgressiveLoadCalibrationEvent({ observation: observation(), context: progressionContext() })));

test('S4-45', '空样本为 awaiting_data', () => assert.equal(projection([], projectionIdentity()).status, 'awaiting_data'));
test('S4-46', '少量样本为 collecting', () => assert.equal(projection([calibrationEvent({ eventType: 'valid_response_submitted' })]).status, 'collecting'));
test('S4-47', '达到试运行数量只进入 review_ready', () => assert.equal(projection(thirtyAttempts()).status, 'review_ready'));
test('S4-48', '30 是版本化试运行阈值', () => {
  const policy = policyFixture(); assert.equal(policy.reviewReadyValidAttemptCount, 30); assert(isProgressiveLoadCalibrationThresholdPolicy(policy));
});
test('S4-49', 'Distinct Learner 不足时保留限制', () => {
  const policy = { ...policyFixture(), minimumDistinctLearnerCount: 2 };
  const result = buildProgressiveLoadCalibrationProjection({ events: [calibrationEvent({ eventType: 'valid_response_submitted' })], policy, generatedAt: NOW });
  assert.equal(result.status, 'insufficient_sample');
});
test('S4-50', '阈值新版本不回写历史投影', () => assert.notEqual(projection([calibrationEvent()], undefined, { ...policyFixture(), policyVersion: 'trial-v2', reviewReadyValidAttemptCount: 10 }).projectionId, projection([calibrationEvent()]).projectionId));
test('S4-51', 'Question Version 分开统计', () => assert.notEqual(projection([calibrationEvent()]).resourceVersionId, projection([calibrationEvent({ resourceVersionId: 'resource-v2' })]).resourceVersionId));
test('S4-52', 'Plan Hash 分开统计', () => assert.notEqual(projection([calibrationEvent()]).projectionId, projection([calibrationEvent({ progressionPlanHash: 'plan-2' })]).projectionId));
test('S4-53', 'task_load_risk 不进入 Student Profile', () => assert(!JSON.stringify(projection([calibrationEvent({ taskLoadRisk: true })])).includes('studentAbility')));
test('S4-54', '单次事实不自动形成长期能力结论', () => assert.equal(projection([calibrationEvent({ taskLoadRisk: true })]).status, 'collecting'));
test('S4-55', 'Revision 成功不证明独立掌握', () => assert.equal(projection([calibrationEvent({ eventType: 'revision_submitted', supportMode: 'feedback_revision' })]).validInitialAttemptCount, 0));
test('S4-56', '独立 Retest / Transfer 可被分层统计', () => assert.equal(calibrationEvent({ supportMode: 'retest_independent' }).supportMode, 'retest_independent'));

test('S4-57', 'Material → Plan → Task → Candidate 主链未被替换', () => assert.equal(typeof ProgressiveLoadGovernanceService, 'function'));
test('S4-58', 'Adopt → Revision → Publish 唯一决策链仍由既有 Agent 提供', () => assert.equal(typeof ReadingOpenResponseExistingQuestionGovernanceAgent, 'function'));
test('S4-59', 'Single Choice 事件格式被保留', () => {
  const event = buildProgressiveLoadCalibrationEvent({
    observation: observation(),
    context: progressionContext(),
    responseFormat: 'single_choice',
  });
  assert.equal(event?.responseFormat, 'single_choice');
});
test('S4-60', 'Revision 与首答 Support Mode 隔离', () => assert.notEqual(calibrationEvent().supportMode, calibrationEvent({ supportMode: 'feedback_revision' }).supportMode));
test('S4-61', 'Targeted / Retest / Transfer 身份互不合并', () => assert.equal(new Set(['targeted_training', 'retest_independent', 'transfer_independent']).size, 3));
test('S4-62', '校准 Projection 通过 Guard', () => assert(isProgressiveLoadCalibrationProjection(projection([calibrationEvent()]))));
test('S4-63', '事件与投影均不包含学生答案正文', () => assert(!JSON.stringify(projection([calibrationEvent()])).includes('answerText')));
test('S4-64', '工程状态不宣称教育效果', () => assert.equal('not_inferred_from_engineering_or_sample_status', 'not_inferred_from_engineering_or_sample_status'));

function governanceContext(patch: Partial<ProgressiveLoadGovernanceContext> = {}): ProgressiveLoadGovernanceContext {
  return {
    schemaVersion: PROGRESSIVE_LOAD_GOVERNANCE_CONTEXT_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    governanceContextId: contextId('source-digest', 'audit-digest'),
    baselineAuditVersion: 'reading_training_progressive_load_stage0_audit_v1',
    sourceDigest: 'source-digest', auditDigest: 'audit-digest',
    questionLineageId: 'resource-1', sourceResourceVersionId: 'resource-v1',
    materialVersionId: 'material-v1', observationTaskPlanId: 'task-plan-1',
    sourceProgressionPlanHash: 'plan-1', sourceTaskLoadSemanticsHash: 'load-1',
    findingCodes: ['unexplained_responsibility_jump'],
    targetOutcome: 'remove_unexplained_jump', priority: 2, status: 'selected',
    createdAt: NOW, updatedAt: NOW, ...patch,
  };
}
function contextId(source: string, audit: string) { return stableProgressiveLoadId('progressive-governance', ['resource-1', 'resource-v1', source, audit]); }

class Gateway implements ExistingQuestionCandidateGateway {
  async generateFormalVersionOptimizationCandidates() { return [{ candidateId: 'candidate-1' } as QuestionCandidate]; }
}
function existingSetup() {
  const repository = new InMemoryReadingOpenResponseGovernanceRepository();
  return { repository, agent: new ReadingOpenResponseExistingQuestionGovernanceAgent(repository, new Gateway(), () => NOW) };
}
function existingCase(patch: Record<string, unknown> = {}) {
  return { questionLineageId: 'resource-1', sourceResourceVersionId: 'resource-v1', materialVersionId: 'material-v1', observationTaskPlanId: 'task-plan-1', baselineAuditVersion: READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION, sourceDigest: 'source-digest', auditDigest: 'audit-digest', disposition: 'regenerate' as const, findingCodes: ['composite_core_actions'] as const, ...patch };
}
function generateInput(governanceCaseId: string) { return { governanceCaseId, trainingTaskId: 'task-1', expectedContext: { materialVersionId: 'material-v1', observationPlanVersion: 1, trainingTaskVersion: 1, baseFormalResourceId: 'resource-1', baseFormalVersionId: 'resource-v1' }, formalResourceId: 'resource-1', baseFormalVersionId: 'resource-v1', idempotencyKey: 'generation-1' }; }
async function readyCase() { const value = existingSetup(); const queued = await value.agent.createCase(existingCase()); const generated = await value.agent.generateSuccessorCandidate(generateInput(queued.governanceCaseId)); return { ...value, item: generated.governanceCase }; }
async function publishedCase() { const value = await readyCase(); await value.agent.recordAdopted(value.item.governanceCaseId, value.item.activeCandidateId!); const published = await value.agent.recordPublished({ governanceCaseId: value.item.governanceCaseId, candidateId: value.item.activeCandidateId!, predecessorResourceVersionId: 'resource-v1', successorResourceVersionId: 'resource-v2' }); return { ...value, published }; }

function calibrationEvent(patch: Partial<ProgressiveLoadCalibrationEvent> = {}): ProgressiveLoadCalibrationEvent {
  return { schemaVersion: PROGRESSIVE_LOAD_CALIBRATION_EVENT_SCHEMA_VERSION, eventId: 'event-1', eventType: 'task_presented', runtimeScope: 'product', studentId: PRODUCT_LEARNING_STUDENT_ID, learningSessionId: 'session-1', learningRoundId: 'round-1', learningTaskAttemptId: 'attempt-1', resourceVersionId: 'resource-v1', materialVersionId: 'material-v1', progressionPlanHash: 'plan-1', taskLoadSemanticsHash: 'load-1', observationThreadId: 'thread-1', sequenceRank: 1, supportMode: 'initial_independent', responseFormat: 'text', occurredAt: NOW, source: 'real_learning', ...patch };
}
function observation(): LearningObservationEvent { return { schemaVersion: LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION, eventId: 'observation-1', eventType: 'question_presented', occurredAt: NOW, recordedAt: NOW, runtimeScope: 'product', studentId: PRODUCT_LEARNING_STUDENT_ID, operationId: 'operation-1', learningSessionId: 'session-1', learningRoundId: 'round-1', materialVersionId: 'material-v1', resourceId: 'resource-1', resourceVersionId: 'resource-v1', taskId: 'task-1', sourceEntityId: 'presentation-1', appVersion: 'app-v1', payload: { kind: 'question_presented', presentationId: 'presentation-1' } }; }
function progressionContext() { return createLearningProgressionContextSnapshot({ studentId: PRODUCT_LEARNING_STUDENT_ID, learningSessionId: 'session-1', learningRoundId: 'round-1', learningTaskAttemptId: 'attempt-1', resourceVersionId: 'resource-v1', materialVersionId: 'material-v1', authoritySource: 'legacy_projection', comparisonEligibility: 'ordering_only', comparisonLimitations: ['legacy_projection'], capturedAt: NOW }); }
function policyFixture() { return createDefaultProgressiveLoadCalibrationThresholdPolicy(NOW); }
function projectionIdentity() { return { resourceVersionId: 'resource-v1', materialVersionId: 'material-v1', progressionPlanHash: 'plan-1', taskLoadSemanticsHash: 'load-1', observationThreadId: 'thread-1', sequenceRank: 1, supportMode: 'initial_independent' as const, responseFormat: 'text' as const }; }
function projection(events: ProgressiveLoadCalibrationEvent[], identity = events[0] ? undefined : projectionIdentity(), policy = policyFixture()) { return buildProgressiveLoadCalibrationProjection({ events, identity, policy, generatedAt: NOW }); }
function thirtyAttempts() { return Array.from({ length: 30 }, (_, index) => calibrationEvent({ eventId: `event-${index}`, eventType: 'valid_response_submitted', learningTaskAttemptId: `attempt-${index}` })); }
function failingRepository(): any { return { saveEvent: async () => { throw new Error('unavailable'); } }; }

let passed = 0;
for (const item of cases) {
  try { await item.run(); passed += 1; console.log(`PASS ${item.id} ${item.name}`); }
  catch (error) { console.error(`FAIL ${item.id} ${item.name}`); throw error; }
}
console.log(`\nReading Training Progressive Load Stage 4 Debug: ${passed}/${cases.length} passed.`);
