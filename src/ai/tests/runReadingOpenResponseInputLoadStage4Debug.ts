import assert from 'node:assert/strict';
import {
  ReadingOpenResponseExistingQuestionGovernanceAgent,
  ReadingOpenResponseGovernanceConflictError,
  buildGovernanceCaseId,
  buildReadingOpenResponseGovernanceProjection,
  resolveGovernanceAvailableActions,
  resolveReadingSessionResourceVersion,
  translateGovernanceFindings,
  type ExistingQuestionCandidateGateway,
} from '../agents/readingOpenResponseExistingQuestionGovernanceAgent.ts';
import {
  auditReadingOpenResponseCalibrationIntegrity,
  projectReadingOpenResponseVersionCalibration,
} from '../agents/readingOpenResponseRealCalibrationAgent.ts';
import { InMemoryReadingOpenResponseGovernanceRepository } from
  '../repositories/inMemoryReadingOpenResponseGovernanceRepository.ts';
import { InMemoryReadingOpenResponseProcessFactRepository } from
  '../repositories/inMemoryReadingOpenResponseProcessFactRepository.ts';
import { ReadingOpenResponseProcessFactService } from
  '../services/readingOpenResponseProcessFactService.ts';
import {
  READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION,
  type TextResponseLoadFindingCode,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';
import {
  READING_OPEN_RESPONSE_CALIBRATION_POLICY_VERSION,
  READING_OPEN_RESPONSE_TIMING_POLICY_VERSION,
  isExistingQuestionGovernanceCase,
  isReadingOpenResponseLearningProcessFact,
  type ExistingQuestionGovernanceCaseInput,
  type ReadingOpenResponseLearningProcessFact,
} from '../schemas/readingOpenResponseGovernance.schema.ts';
import type { LearningObservationEvent, LearningObservationEventType } from
  '../schemas/learningObservationEvent.schema.ts';
import type { QuestionCalibrationProjectionRecord } from
  '../schemas/questionCalibrationProjection.schema.ts';
import type {
  CandidateRuntimeContext,
  QuestionCandidate,
} from '../schemas/questionCandidate.schema.ts';

type DebugCase = { id: string; name: string; run: () => void | Promise<void> };

const NOW = '2026-08-21T08:00:00.000Z';
const CONTEXT: CandidateRuntimeContext = {
  materialVersionId: 'material-v1',
  observationPlanVersion: 1,
  trainingTaskVersion: 1,
  baseFormalResourceId: 'resource-1',
  baseFormalVersionId: 'resource-v1',
};

class FakeCandidateGateway implements ExistingQuestionCandidateGateway {
  calls: Array<Record<string, unknown>> = [];
  failuresRemaining = 0;
  sequence = 0;

  async generateFormalVersionOptimizationCandidates(
    input: Parameters<ExistingQuestionCandidateGateway['generateFormalVersionOptimizationCandidates']>[0],
  ) {
    this.calls.push(structuredClone(input));
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error('planned generation failure');
    }
    this.sequence += 1;
    return [{ candidateId: `candidate-${this.sequence}` } as QuestionCandidate];
  }
}

const cases: DebugCase[] = [];
function test(id: string, name: string, run: DebugCase['run']) { cases.push({ id, name, run }); }

test('S4-01', '相同审计快照重复创建返回同一 Case', async () => {
  const { agent } = setup();
  const first = await agent.createCase(caseInput());
  const second = await agent.createCase(caseInput());
  assert.equal(first.governanceCaseId, second.governanceCaseId);
});
test('S4-02', '不同 Question Version 不合并 Case', () => {
  assert.notEqual(buildGovernanceCaseId(caseInput()), buildGovernanceCaseId(caseInput({
    sourceResourceVersionId: 'resource-v2',
  })));
});
test('S4-03', '正式版本变化使旧 Case stale', async () => {
  const { agent } = setup();
  const item = await agent.createCase(caseInput());
  const changed = await agent.markStaleWhenSourceVersionChanges({
    questionLineageId: item.questionLineageId,
    activeSourceResourceVersionId: 'resource-v2',
  });
  assert.equal(changed[0]?.status, 'stale');
});
test('S4-04', 'retain 题默认不创建活动 Candidate', async () => {
  const { agent } = setup();
  const item = await agent.createCase(caseInput({ disposition: 'retain', findingCodes: [] }));
  await assert.rejects(() => agent.generateSuccessorCandidate(generateInput(item.governanceCaseId)));
  assert.equal(item.activeCandidateId, undefined);
});
test('S4-05', 'regenerate 题优先级最高', async () => {
  const { agent } = setup();
  assert.equal((await agent.createCase(caseInput())).priority, 1);
});
test('S4-06', 'Finding 白名单拒绝非法 Finding', async () => {
  const { agent } = setup();
  await assert.rejects(() => agent.createCase(caseInput({
    findingCodes: ['not_allowed'] as TextResponseLoadFindingCode[],
  })));
});
test('S4-07', '缺少 source/audit digest 时 Case 被拒绝', async () => {
  const { agent } = setup();
  await assert.rejects(() => agent.createCase(caseInput({ sourceDigest: '' })));
});
test('S4-08', '同题已有活动 Candidate 时不重复生成', async () => {
  const { agent, gateway } = setup();
  const item = await agent.createCase(caseInput());
  const first = await agent.generateSuccessorCandidate(generateInput(item.governanceCaseId));
  const second = await agent.generateSuccessorCandidate(generateInput(item.governanceCaseId));
  assert.equal(second.candidateId, first.candidateId);
  assert.equal(gateway.calls.length, 1);
});
test('S4-09', 'Case 只保存引用而不复制正式题正文', async () => {
  const { agent } = setup();
  const item = await agent.createCase(caseInput());
  assert.equal(isExistingQuestionGovernanceCase(item), true);
  assert.equal('questionStem' in item, false);
});
test('S4-10', '重复批次命令保持幂等', async () => {
  const { agent } = setup();
  await agent.createCase(caseInput());
  const first = await agent.planBatch({ idempotencyKey: 'batch-1' });
  const second = await agent.planBatch({ idempotencyKey: 'batch-1' });
  assert.equal(first?.batchId, second?.batchId);
});

test('S4-11', '批次超过 5 道被拒绝', async () => {
  const { agent } = setup();
  await assert.rejects(() => agent.planBatch({ idempotencyKey: 'batch', maximumSize: 6 }));
});
test('S4-12', '只含 retain 的队列不生成无意义批次', async () => {
  const { agent } = setup();
  await agent.createCase(caseInput({ disposition: 'retain', findingCodes: [] }));
  assert.equal(await agent.planBatch({ idempotencyKey: 'retain' }), null);
});
test('S4-13', 'Finding 转译进入生成目标', async () => {
  const { agent, gateway } = setup();
  const item = await agent.createCase(caseInput());
  await agent.generateSuccessorCandidate(generateInput(item.governanceCaseId));
  assert(JSON.stringify(gateway.calls[0]).includes('只保留一个主要作答动作'));
});
test('S4-14', '主要能力变化返回 Observation Plan 阻断', async () => {
  const { agent } = setup();
  const item = await agent.createCase(caseInput());
  const result = await agent.generateSuccessorCandidate({
    ...generateInput(item.governanceCaseId),
    primaryAbilityChanged: true,
  });
  assert.equal(result.governanceCase.status, 'blocked');
});
test('S4-15', '三个独立核心动作约束为单一主要动作', () => {
  assert(translateGovernanceFindings(['composite_core_actions'])[0]!.goal.includes('一个主要'));
});
test('S4-16', 'Hidden Rubric 约束题干与 Required Rubric 对齐', () => {
  assert(translateGovernanceFindings(['hidden_rubric_requirement'])[0]!.goal.includes('完全对齐'));
});
test('S4-17', '证据范围不足只允许缩小或合法扩大', () => {
  const value = translateGovernanceFindings(['evidence_scope_insufficient'])[0]!;
  assert(value.lockedPrinciples.includes('不得伪造材料依据'));
});
test('S4-18', '最低要求过重时学生门槛收敛', () => {
  assert(translateGovernanceFindings(['minimum_length_overweighted'])[0]!.goal.includes('降低'));
});
test('S4-19', 'responseFormat 错配形成一致完整方案', () => {
  assert(translateGovernanceFindings(['response_format_load_mismatch'])[0]!.goal.includes('保持一致'));
});
test('S4-20', '一次受控修复只产生一个 Candidate', async () => {
  const { agent, gateway } = setup();
  const item = await agent.createCase(caseInput());
  const result = await agent.generateSuccessorCandidate(generateInput(item.governanceCaseId));
  assert.equal(result.governanceCase.generationAttemptCount, 1);
  assert.equal(gateway.calls[0]?.count, 1);
});
test('S4-21', '两次连续生成失败进入 deferred', async () => {
  const { agent, gateway } = setup();
  gateway.failuresRemaining = 2;
  const item = await agent.createCase(caseInput());
  const first = await agent.generateSuccessorCandidate(generateInput(item.governanceCaseId));
  const second = await agent.generateSuccessorCandidate(generateInput(item.governanceCaseId, 'retry'));
  assert.equal(first.governanceCase.status, 'blocked');
  assert.equal(second.governanceCase.status, 'deferred');
});
test('S4-22', '未采用 Candidate 不形成 successor Version', async () => {
  const { agent } = setup();
  const item = await agent.createCase(caseInput());
  const result = await agent.generateSuccessorCandidate(generateInput(item.governanceCaseId));
  assert.equal(result.governanceCase.successorResourceVersionId, undefined);
});

test('S4-23', 'ready Candidate 提供采用并发布', async () => {
  const ready = await readyCase();
  assert(resolveGovernanceAvailableActions(ready.item).includes('adopt_and_publish'));
});
test('S4-24', 'advisory 不增加人工确认步骤', async () => {
  const ready = await readyCase();
  assert.deepEqual(resolveGovernanceAvailableActions(ready.item), ['regenerate', 'adopt_and_publish']);
});
test('S4-25', 'blocker 只允许重新优化', async () => {
  const { agent, gateway } = setup();
  gateway.failuresRemaining = 1;
  const item = await agent.createCase(caseInput());
  const result = await agent.generateSuccessorCandidate(generateInput(item.governanceCaseId));
  assert.deepEqual(resolveGovernanceAvailableActions(result.governanceCase), ['regenerate']);
});
test('S4-26', 'stale Case 不允许发布', async () => {
  const { agent } = setup();
  const item = await agent.createCase(caseInput());
  const stale = (await agent.markStaleWhenSourceVersionChanges({
    questionLineageId: item.questionLineageId,
    activeSourceResourceVersionId: 'resource-v2',
  }))[0]!;
  assert.deepEqual(resolveGovernanceAvailableActions(stale), []);
});
test('S4-27', '采用后只显示继续发布而不重复显示发布按钮', async () => {
  const ready = await readyCase();
  const adopted = await ready.agent.recordAdopted(ready.item.governanceCaseId, ready.item.activeCandidateId!);
  assert.deepEqual(resolveGovernanceAvailableActions(adopted), ['continue_publication']);
});
test('S4-28', '采用重试不制造第二治理状态', async () => {
  const ready = await readyCase();
  const first = await ready.agent.recordAdopted(ready.item.governanceCaseId, ready.item.activeCandidateId!);
  const second = await ready.agent.recordAdopted(ready.item.governanceCaseId, ready.item.activeCandidateId!);
  assert.equal(first.status, second.status);
});
test('S4-29', '发布成功绑定新 Frozen Version', async () => {
  const value = await publishedCase();
  assert.equal(value.published.successorResourceVersionId, 'resource-v2');
});
test('S4-30', '发布后 predecessor 仍保留', async () => {
  const value = await publishedCase();
  assert.equal(value.published.sourceResourceVersionId, 'resource-v1');
});
test('S4-31', '发布身份要求 Candidate 与 predecessor 同时一致', async () => {
  const ready = await readyCase();
  await assert.rejects(() => ready.agent.recordPublished({
    governanceCaseId: ready.item.governanceCaseId,
    candidateId: ready.item.activeCandidateId!,
    predecessorResourceVersionId: 'wrong-version',
    successorResourceVersionId: 'resource-v2',
  }), ReadingOpenResponseGovernanceConflictError);
});
test('S4-32', '发布中断保留 adopted 阶段结果', async () => {
  const ready = await readyCase();
  const adopted = await ready.agent.recordAdopted(ready.item.governanceCaseId, ready.item.activeCandidateId!);
  assert.equal(adopted.status, 'adopted');
});
test('S4-33', '活动 Session 保持启动时冻结版本', () => {
  assert.equal(resolveReadingSessionResourceVersion({
    sessionStarted: true,
    sessionResourceVersionId: 'resource-v1',
    registryActiveResourceVersionId: 'resource-v2',
  }), 'resource-v1');
});
test('S4-34', '新 Session 消费 Registry 当前活动版本', () => {
  assert.equal(resolveReadingSessionResourceVersion({
    sessionStarted: false,
    registryActiveResourceVersionId: 'resource-v2',
  }), 'resource-v2');
});

test('S4-35', '正式五事件与 eligible Projection 形成待校准样本', () => {
  const report = calibrationReport({ events: fiveEvents(), projections: [projection()] });
  assert.equal(report.eligibleSampleCount, 1);
});
test('S4-36', '未完成 Round 不进入有效分母', () => {
  const report = calibrationReport({ projections: [projection({ status: 'excluded_incomplete_round', valid: false })] });
  assert.equal(report.eligibleSampleCount, 0);
});
test('S4-37', '无效答案不进入题目质量样本', () => {
  const report = calibrationReport({ facts: [fact({ responseValidity: 'placeholder' })] });
  assert.equal(report.invalidResponseCount, 1);
});
test('S4-38', 'Demo / Fixture 与 Product 严格隔离', () => {
  const report = calibrationReport({
    events: [],
    projections: [],
    facts: [fact({ runtimeScope: 'demo' })],
  });
  assert.equal(report.presentedCount, 0);
  assert.equal(report.eligibleSampleCount, 0);
});
test('S4-39', '同一 Attempt 重复投影只计一次', () => {
  const item = projection();
  assert.equal(calibrationReport({ projections: [item, item] }).eligibleSampleCount, 1);
});
test('S4-40', '不同 Version 的样本不合并', () => {
  assert.equal(calibrationReport({ projections: [projection({ resourceVersionId: 'resource-v2' })] }).eligibleSampleCount, 0);
});
test('S4-41', '首次输入时间由事实时间计算', () => {
  assert.equal(calibrationReport().medianFirstInputDelayMs, 5_000);
});
test('S4-42', 'Timing Policy 显式版本化', () => {
  assert.equal(calibrationReport().timingPolicyVersion, READING_OPEN_RESPONSE_TIMING_POLICY_VERSION);
});
test('S4-43', '提示打开只记录布尔事实', () => {
  const report = calibrationReport({ facts: [fact({ hintOpened: true })] });
  assert.equal(report.hintOpenedCount, 1);
  assert.equal(JSON.stringify(report).includes('ability'), false);
});
test('S4-44', 'Revision 与首次独立表现分开统计', () => {
  const report = calibrationReport({
    facts: [fact({ revisionOffered: true, revisionSubmitted: true })],
    events: [revisionEvent('improved')],
  });
  assert.equal(report.revisionSubmittedCount, 1);
  assert.equal(report.revisionOutcomeCounts.improved, 1);
});
test('S4-45', 'Retest / Transfer 与即时修订分开验证', () => {
  const report = calibrationReport({ facts: [
    fact({ attemptId: 'r', followUpRole: 'retest', sameGapRecurred: true }),
    fact({ attemptId: 't', followUpRole: 'transfer', sameGapRecurred: false }),
  ] });
  assert.deepEqual(report.followUpRecurrence, { retestObserved: 1, transferObserved: 1, sameGapRecurred: 1 });
});
test('S4-46', '样本不足只显示事实数量与边界', () => {
  const report = calibrationReport({ projections: [projection()] });
  assert.equal(report.status, 'insufficient_sample');
  assert(report.limitations[0]!.includes('1 份有效作答'));
});
test('S4-47', '30 份阈值记录策略版本而非统计承诺', () => {
  const report = calibrationReport({ projections: [projection()] });
  assert.equal(report.minimumIndependentSubjectCount, 30);
  assert.equal(report.policyVersion, READING_OPEN_RESPONSE_CALIBRATION_POLICY_VERSION);
});
test('S4-48', '负担等级不写入 Student Ability Profile', () => {
  const serialized = JSON.stringify(calibrationReport());
  assert.equal(serialized.includes('loadLevel'), false);
  assert.equal(serialized.includes('studentAbility'), false);
});

test('S4-49', 'Case Repository 重载结果可恢复且克隆隔离', async () => {
  const { agent, repository } = setup();
  const item = await agent.createCase(caseInput());
  const loaded = await repository.getCase(item.governanceCaseId);
  loaded!.status = 'rejected';
  assert.equal((await repository.getCase(item.governanceCaseId))!.status, 'queued');
});
test('S4-50', 'Candidate adoption receipt 语义可幂等恢复', async () => {
  const ready = await readyCase();
  await ready.agent.recordAdopted(ready.item.governanceCaseId, ready.item.activeCandidateId!);
  const repeated = await ready.agent.recordAdopted(ready.item.governanceCaseId, ready.item.activeCandidateId!);
  assert.equal(repeated.status, 'adopted');
});
test('S4-51', '过程事实补写幂等合并', async () => {
  const repository = new InMemoryReadingOpenResponseProcessFactRepository();
  const service = new ReadingOpenResponseProcessFactService(repository, () => NOW);
  await service.recordPresented(identity());
  await service.recordFirstInput('attempt-1', '2026-08-21T08:00:05.000Z');
  await service.recordFirstInput('attempt-1', '2026-08-21T08:00:06.000Z');
  assert.equal((await repository.getByAttemptId('attempt-1'))!.firstInputAt, '2026-08-21T08:00:05.000Z');
});
test('S4-52', 'Registry / predecessor 冲突显式失败', async () => {
  const ready = await readyCase();
  await assert.rejects(() => ready.agent.recordPublished({
    governanceCaseId: ready.item.governanceCaseId,
    candidateId: 'another-candidate',
    predecessorResourceVersionId: 'resource-v1',
    successorResourceVersionId: 'resource-v2',
  }));
});
test('S4-53', '批次暂停不改变正式题或 Case', async () => {
  const { agent, repository } = setup();
  const item = await agent.createCase(caseInput());
  const batch = await agent.planBatch({ idempotencyKey: 'pause' });
  const paused = await agent.updateBatchStatus(batch!.batchId, 'paused');
  assert.equal(paused.status, 'paused');
  assert.equal((await repository.getCase(item.governanceCaseId))!.status, 'queued');
});
test('S4-54', '后继版本保留 predecessor 可用于回滚', async () => {
  const value = await publishedCase();
  assert.deepEqual(
    [value.published.sourceResourceVersionId, value.published.successorResourceVersionId],
    ['resource-v1', 'resource-v2'],
  );
});
test('S4-55', '自动化与浏览器验证数据不写入真实样本', () => {
  const report = calibrationReport({
    projections: [projection({ runtimeScope: 'debug', status: 'excluded_non_product_scope', valid: false })],
    facts: [fact({ runtimeScope: 'debug' })],
  });
  assert.equal(report.eligibleSampleCount, 0);
});
test('S4-56', '完整性报告区分 Product、排除数据与冲突', () => {
  const product = fact();
  const debug = fact({ attemptId: 'debug-attempt', runtimeScope: 'debug' });
  const report = auditReadingOpenResponseCalibrationIntegrity({
    events: fiveEvents(),
    projections: [projection()],
    processFacts: [product, debug],
  });
  assert.equal(report.productFactCount, 1);
  assert.equal(report.excludedFactCount, 1);
});

let passed = 0;
for (const item of cases) {
  try {
    await item.run();
    passed += 1;
    console.log(`PASS ${item.id} ${item.name}`);
  } catch (error) {
    console.error(`FAIL ${item.id} ${item.name}`);
    throw error;
  }
}
console.log(`\nReading Open Response Input Load Stage 4 Debug: ${passed}/${cases.length} passed.`);

function setup() {
  const repository = new InMemoryReadingOpenResponseGovernanceRepository();
  const gateway = new FakeCandidateGateway();
  const agent = new ReadingOpenResponseExistingQuestionGovernanceAgent(
    repository,
    gateway,
    () => NOW,
  );
  return { repository, gateway, agent };
}

function caseInput(
  patch: Partial<ExistingQuestionGovernanceCaseInput> = {},
): ExistingQuestionGovernanceCaseInput {
  return {
    questionLineageId: 'lineage-1',
    sourceResourceVersionId: 'resource-v1',
    materialVersionId: 'material-v1',
    observationTaskPlanId: 'task-plan-1',
    baselineAuditVersion: READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION,
    sourceDigest: 'source-digest-1',
    auditDigest: 'audit-digest-1',
    disposition: 'regenerate',
    findingCodes: ['composite_core_actions'],
    ...patch,
  };
}

function generateInput(governanceCaseId: string, suffix = 'first') {
  return {
    governanceCaseId,
    trainingTaskId: 'task-1',
    expectedContext: CONTEXT,
    formalResourceId: 'resource-1',
    baseFormalVersionId: 'resource-v1',
    idempotencyKey: `generation-${suffix}`,
  };
}

async function readyCase() {
  const value = setup();
  const queued = await value.agent.createCase(caseInput());
  const generated = await value.agent.generateSuccessorCandidate(generateInput(queued.governanceCaseId));
  return { ...value, item: generated.governanceCase };
}

async function publishedCase() {
  const ready = await readyCase();
  await ready.agent.recordAdopted(ready.item.governanceCaseId, ready.item.activeCandidateId!);
  const published = await ready.agent.recordPublished({
    governanceCaseId: ready.item.governanceCaseId,
    candidateId: ready.item.activeCandidateId!,
    predecessorResourceVersionId: 'resource-v1',
    successorResourceVersionId: 'resource-v2',
  });
  return { ...ready, published };
}

function fact(
  patch: Partial<ReadingOpenResponseLearningProcessFact> = {},
): ReadingOpenResponseLearningProcessFact {
  return {
    attemptId: 'attempt-1',
    runtimeScope: 'product',
    studentId: 'student-local-primary-v1',
    learningSessionId: 'session-1',
    learningRoundId: 'round-1',
    materialVersionId: 'material-v1',
    resourceVersionId: 'resource-v1',
    presentedAt: NOW,
    firstInputAt: '2026-08-21T08:00:05.000Z',
    submittedAt: '2026-08-21T08:00:35.000Z',
    completedAt: '2026-08-21T08:00:40.000Z',
    lastActivityAt: '2026-08-21T08:00:40.000Z',
    hintOpened: false,
    responseValidity: 'valid',
    revisionOffered: false,
    revisionSubmitted: false,
    timingPolicyVersion: READING_OPEN_RESPONSE_TIMING_POLICY_VERSION,
    ...patch,
  };
}

function identity() {
  return {
    attemptId: 'attempt-1',
    runtimeScope: 'product' as const,
    studentId: 'student-local-primary-v1',
    learningSessionId: 'session-1',
    learningRoundId: 'round-1',
    materialVersionId: 'material-v1',
    resourceVersionId: 'resource-v1',
  };
}

function projection(
  patch: Partial<QuestionCalibrationProjectionRecord> = {},
): QuestionCalibrationProjectionRecord {
  return {
    schemaVersion: 'question_calibration_projection_v1',
    projectionId: 'projection-1',
    attemptId: 'attempt-1',
    status: 'eligible',
    runtimeScope: 'product',
    studentId: 'student-local-primary-v1',
    operationId: 'operation-1',
    learningSessionId: 'session-1',
    learningRoundId: 'round-1',
    responseId: 'response-1',
    formalDiagnosisId: 'diagnosis-1',
    resourceVersionId: 'resource-v1',
    responseFormat: 'text',
    itemScore: 0.5,
    itemScorePolicyVersion: 'rubric_required_equal_weight_v1',
    totalScoreStatus: 'unavailable_single_round',
    valid: true,
    completedAt: '2026-08-21T08:00:40.000Z',
    projectedAt: '2026-08-21T08:01:00.000Z',
    issues: [],
    ...patch,
  };
}

function fiveEvents(): LearningObservationEvent[] {
  return [
    observationEvent('question_presented'),
    observationEvent('answer_submitted'),
    observationEvent('diagnosis_completed'),
    observationEvent('feedback_presented'),
    observationEvent('learning_round_completed'),
  ];
}

function observationEvent(type: LearningObservationEventType): LearningObservationEvent {
  const base = {
    schemaVersion: 'learning_observation_event_v1' as const,
    eventId: `event-${type}`,
    eventType: type,
    occurredAt: NOW,
    recordedAt: NOW,
    runtimeScope: 'product' as const,
    studentId: 'student-local-primary-v1' as const,
    operationId: 'operation-1',
    learningSessionId: 'session-1',
    learningRoundId: 'round-1',
    materialVersionId: 'material-v1',
    resourceId: 'resource-1',
    resourceVersionId: 'resource-v1',
    taskId: 'task-1',
    sourceEntityId: `source-${type}`,
    appVersion: 'test',
  };
  if (type === 'question_presented') {
    return { ...base, eventType: type, payload: { kind: type, presentationId: 'presentation-1' } };
  }
  if (type === 'answer_submitted') {
    return { ...base, eventType: type, payload: { kind: type, responseId: 'response-1', attemptId: 'attempt-1', submittedAt: NOW } };
  }
  if (type === 'diagnosis_completed') {
    return { ...base, eventType: type, payload: { kind: type, responseId: 'response-1', attemptId: 'attempt-1', formalDiagnosisId: 'diagnosis-1', diagnosisSchemaVersion: 'v1' } };
  }
  if (type === 'feedback_presented') {
    return { ...base, eventType: type, payload: { kind: type, responseId: 'response-1', attemptId: 'attempt-1', feedbackRequestId: 'feedback-1', feedbackSchemaVersion: 'v1' } };
  }
  return { ...base, eventType: 'learning_round_completed', payload: { kind: 'learning_round_completed', responseId: 'response-1', attemptId: 'attempt-1', persistenceRecordId: 'persist-1', completedAt: NOW } };
}

function revisionEvent(
  outcome: 'improved' | 'partially_improved' | 'unchanged' | 'regressed',
): LearningObservationEvent {
  return {
    ...observationEvent('learning_round_completed'),
    eventId: `revision-${outcome}`,
    eventType: 'revision_evaluation_completed',
    payload: {
      kind: 'revision_evaluation_completed',
      responseId: 'response-1',
      attemptId: 'attempt-1',
      learningTaskAttemptId: 'learning-attempt-1',
      revisionId: 'revision-1',
      revisionEvaluationId: 'evaluation-1',
      feedbackSupportedEvidenceId: 'evidence-1',
      outcome,
      policyVersion: 'v1',
      completedAt: NOW,
    },
  };
}

function calibrationReport(input: {
  events?: LearningObservationEvent[];
  projections?: QuestionCalibrationProjectionRecord[];
  facts?: ReadingOpenResponseLearningProcessFact[];
} = {}) {
  return projectReadingOpenResponseVersionCalibration({
    resourceVersionId: 'resource-v1',
    events: input.events || fiveEvents(),
    projections: input.projections || [projection()],
    processFacts: input.facts || [fact()],
    generatedAt: '2026-08-21T09:00:00.000Z',
  });
}

assert.equal(cases.length, 56);
assert.equal(isReadingOpenResponseLearningProcessFact(fact()), true);
assert.equal(buildReadingOpenResponseGovernanceProjection({
  cases: [], batches: [], calibrationReports: [],
}).educationConclusion, 'not_inferred_from_engineering_or_sample_status');
