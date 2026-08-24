import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildFormalTaskGroupProgressionArtifact,
  buildFormalTaskProgressionMetadata,
  isFormalTaskGroupProgressionArtifact,
  isFormalTaskProgressionMetadata,
} from '../schemas/formalTaskProgressionMetadata.schema.ts';
import {
  calculateTaskGroupProgressionPlanHash,
  READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
  TASK_GROUP_PROGRESSION_PLAN_SCHEMA_VERSION,
  type TaskGroupProgressionPlan,
} from '../schemas/readingTaskGroupProgression.schema.ts';
import {
  calculateTaskLoadSemanticsHash,
  TASK_LOAD_SEMANTICS_SCHEMA_VERSION,
  type TaskLoadSemantics,
} from '../schemas/readingTaskLoadSemantics.schema.ts';
import { READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION } from
  '../schemas/readingTrainingProgressionAudit.schema.ts';
import type { FrozenQuestionResourceVersion } from
  '../schemas/questionResourceAdmission.schema.ts';
import { resolveLearningProgressionContext } from
  '../agents/learningProgressionContextResolver.ts';
import {
  createLearningProgressionContextSnapshot,
  isLearningProgressionContextSnapshot,
} from '../schemas/learningProgressionContext.schema.ts';
import {
  orderFormalResourcesForLearningSequence,
  resolveFormalProgressionAuthority,
} from '../agents/learningTaskSequenceScheduler.ts';
import { createProgressionPerformanceObservation } from
  '../agents/progressionPerformanceObservationAgent.ts';
import { isProgressionPerformanceObservation } from
  '../schemas/progressionPerformanceObservation.schema.ts';
import { assessProgressionInstability } from
  '../agents/progressionInstabilityAssessmentAgent.ts';
import { isProgressionInstabilityAssessment } from
  '../schemas/progressionInstabilityAssessment.schema.ts';
import { decideProgressionEvidenceAdmission } from
  '../agents/progressionEvidenceAdmissionAgent.ts';
import {
  isProgressionEvidenceAdmissionDecision,
  isProgressionEvidenceContext,
} from '../schemas/progressionEvidenceAdmission.schema.ts';
import { InMemoryLearningProgressionRepository } from
  '../repositories/inMemoryLearningProgressionRepository.ts';
import { LearningProgressionRuntimeService } from
  '../services/learningProgressionRuntimeService.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';

const ROOT = '/Users/chengzheng/Desktop/web/yuwen-xiaolian/System';
const NOW = '2026-08-24T00:00:00.000Z';
const tests: Array<{ id: string; name: string; run: () => void | Promise<void> }> = [];
function test(id: string, name: string, run: () => void | Promise<void>) {
  tests.push({ id, name, run });
}

function semantics(
  key: 'entry' | 'evidence' | 'relation' | 'inference' | 'expression',
  thread = 'thread:reading:one',
): TaskLoadSemantics {
  const responsibilities = {
    entry: ['basic_understanding'],
    evidence: ['basic_understanding', 'text_evidence'],
    relation: ['basic_understanding', 'text_evidence', 'relation_explanation'],
    inference: ['basic_understanding', 'text_evidence', 'relation_explanation', 'inference_integration'],
    expression: ['basic_understanding', 'text_evidence', 'relation_explanation', 'inference_integration', 'expression_organization'],
  }[key] as TaskLoadSemantics['responsibilities'];
  return {
    schemaVersion: TASK_LOAD_SEMANTICS_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    observationThreadId: thread,
    sequenceRole: key === 'entry' ? 'foundation_entry' : key === 'expression' ? 'integration' : 'development',
    primaryAction: key === 'entry' ? 'locate_information' : key === 'evidence' ? 'extract_evidence' : 'identify_relation',
    responsibilities,
    derivationSource: 'planned',
    confidence: 'high',
  };
}

function planFixture(strategy: TaskGroupProgressionPlan['strategy'] = 'entry_first') {
  const low = semantics('entry');
  const high = semantics('evidence');
  const base: Omit<TaskGroupProgressionPlan, 'planHash'> = {
    schemaVersion: TASK_GROUP_PROGRESSION_PLAN_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    stageRuleVersion: READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
    materialVersionId: 'material:v1',
    observationPlanRevisionId: 'observation-plan:1',
    strategy,
    reasonCode: strategy === 'holistic_first'
      ? 'holistic_judgment_required'
      : 'default_foundation_entry',
    orderedTasks: [
      { planningTaskKey: 'task-low', taskLoadSemanticsHash: calculateTaskLoadSemanticsHash(low), sequenceRank: 1 },
      { planningTaskKey: 'task-high', taskLoadSemanticsHash: calculateTaskLoadSemanticsHash(high), sequenceRank: 2 },
    ],
    accessibleEntryTaskKeys: ['task-low'],
    protectedHigherOrderTaskKeys: ['task-high'],
    transitions: [{
      transitionId: 'transition:1',
      fromPlanningTaskKey: 'task-low',
      toPlanningTaskKey: 'task-high',
      threadRelation: 'same_thread',
      transitionKind: 'progressive',
      addedResponsibilities: ['text_evidence'],
      retainedResponsibilities: ['basic_understanding'],
      loadDirection: 'increase',
      rationaleCode: 'adjacent_responsibility_growth',
      rationale: '在基础理解后增加文本依据责任。',
    }],
    derivationSource: 'planned',
  };
  const progressionPlan = { ...base, planHash: calculateTaskGroupProgressionPlanHash(base) };
  const artifact = buildFormalTaskGroupProgressionArtifact({
    progressionPlan,
    sourceCandidateIds: ['candidate-low', 'candidate-high'],
    createdAt: NOW,
  });
  return { low, high, progressionPlan, artifact };
}

function frozen(
  key: 'low' | 'high',
  input: { plan?: ReturnType<typeof planFixture>; metadata?: boolean; materialId?: string } = {},
): FrozenQuestionResourceVersion {
  const set = input.plan || planFixture();
  const task = key === 'low' ? set.low : set.high;
  const planningTaskKey = key === 'low' ? 'task-low' : 'task-high';
  return {
    resourceId: `resource-${key}`,
    resourceVersionId: `resource-${key}:v1`,
    versionNumber: 1,
    sourceDraftId: `draft-${key}`,
    materialId: input.materialId || 'material',
    materialVersionId: 'material:v1',
    taskId: `task-${key}`,
    title: key,
    questionStem: `${key} question`,
    questionType: 'reading_comprehension',
    responseFormat: key === 'low' ? 'single_choice' : 'short_text',
    rubric: [],
    assessmentMode: key === 'low' ? 'exact_match' : 'key_points',
    minimumAnswerRequirement: key === 'low'
      ? { responseFormat: 'single_choice', minLength: 0, requireTextEvidence: false, requireExplanation: false, minSelections: 1, maxSelections: 1 }
      : { minLength: 10, requireTextEvidence: true, requireExplanation: false },
    abilityMetadata: { abilityId: 'comprehension', supportingAbilityIds: [], prerequisiteAbilityIds: [], taskRole: 'training', difficulty: 'basic' },
    source: { sourceType: 'ai_assisted', description: 'stage3 debug' },
    tags: [`sequence-rank:${key === 'low' ? 1 : 2}`],
    validationId: `validation-${key}`,
    reviewId: `review-${key}`,
    status: 'frozen', frozenAt: NOW, updatedAt: NOW,
    version: 'phase16_1a_v1', schemaVersion: 'question_resource_admission_v1',
    progressionMetadata: input.metadata === false ? undefined : buildFormalTaskProgressionMetadata({
      materialVersionId: 'material:v1', observationPlanRevisionId: 'observation-plan:1',
      planningTaskKey, progressionPlan: set.progressionPlan, taskLoadSemantics: task,
    }),
  } as FrozenQuestionResourceVersion;
}

function contextFor(
  rank: 1 | 2,
  input: { thread?: 'same_thread' | 'cross_thread'; authority?: 'native_authority' | 'legacy_projection'; layer?: Parameters<typeof semantics>[0] } = {},
) {
  const set = planFixture();
  const native = (input.authority || 'native_authority') === 'native_authority';
  return createLearningProgressionContextSnapshot({
    studentId: 'student-1', learningSessionId: 'session-1', learningRoundId: 'round-1',
    learningTaskAttemptId: `attempt-${rank}`, resourceVersionId: `resource-${rank}:v1`,
    materialVersionId: 'material:v1', authoritySource: native ? 'native_authority' : 'legacy_projection',
    taskGroupProgressionPlanHash: native ? set.progressionPlan.planHash : undefined,
    planningTaskKey: native ? (rank === 1 ? 'task-low' : 'task-high') : undefined,
    sequenceRank: native ? rank : undefined,
    taskLoadSemantics: native ? semantics(input.layer || (rank === 1 ? 'entry' : 'evidence')) : undefined,
    taskLoadSemanticsHash: native ? calculateTaskLoadSemanticsHash(semantics(input.layer || (rank === 1 ? 'entry' : 'evidence'))) : undefined,
    predecessor: native && rank === 2 ? {
      resourceVersionId: 'resource-1:v1', planningTaskKey: 'task-low', sequenceRank: 1,
      transitionId: 'transition:1', threadRelation: input.thread || 'same_thread',
      addedResponsibilities: semantics(input.layer || 'evidence').responsibilities.slice(1),
      loadDirection: 'increase',
    } : undefined,
    comparisonEligibility: native ? 'eligible' : 'ordering_only',
    comparisonLimitations: native ? [] : ['legacy_projection_ordering_only'],
    capturedAt: NOW,
  });
}

function diagnosis(outcome: 'meets' | 'partial' | 'fails' | 'invalid' = 'meets'): DiagnosisResult {
  const answerStatus = outcome === 'meets' ? 'fully_meets' : outcome === 'partial'
    ? 'partially_meets' : outcome === 'fails' ? 'does_not_meet' : 'insufficient_evidence';
  return {
    taskType: 'open_response', correct: outcome === 'meets' ? true : outcome === 'fails' ? false : null,
    strategyUsed: 'debug', answerStatus,
    rubricItems: [{ id: 'r1', label: '依据', ability: '理解', required: true, matched: outcome === 'meets' }],
    mainAbility: 'comprehension', relatedAbilities: [], surfaceError: '观察', rootCause: '观察',
    errorType: outcome === 'meets' ? '待验证' : '理解错误', abilityEvidence: ['观察'],
    diagnosisSummary: '诊断', nextTraining: '继续', confidence: 0.8,
  };
}

function observation(rank: 1 | 2, outcome: Parameters<typeof diagnosis>[0] = 'meets', supportMode?: Parameters<typeof createProgressionPerformanceObservation>[0]['supportMode'], context = contextFor(rank)) {
  return createProgressionPerformanceObservation({
    context, responseId: `response-${rank}`, formalDiagnosisId: `diagnosis-${rank}`,
    diagnosis: diagnosis(outcome), supportMode, observedAt: NOW,
  });
}

function evidence(): AbilityEvidence {
  return { id: 'evidence-1', studentId: 'student-1', ability: 'comprehension',
    evidenceType: 'weakness', detail: '缺少依据', source: 'diagnosis', observation: '缺少依据',
    confidence: 0.8, createdAt: NOW, taskId: 'task-high', diagnosisId: 'diagnosis-2' };
}

const set = planFixture();
test('S3-01', '合法 Formal Metadata 通过 Guard', () => assert(isFormalTaskProgressionMetadata(frozen('low').progressionMetadata)));
test('S3-02', 'Semantics Hash 不一致被拒绝', () => { const value = structuredClone(frozen('low').progressionMetadata!); value.taskLoadSemanticsHash = 'bad'; assert(!isFormalTaskProgressionMetadata(value)); });
test('S3-03', 'Plan Hash 空值被拒绝', () => { const value = structuredClone(frozen('low').progressionMetadata!); value.taskGroupProgressionPlanHash = ''; assert(!isFormalTaskProgressionMetadata(value)); });
test('S3-04', '合法 Artifact 通过 Guard', () => assert(isFormalTaskGroupProgressionArtifact(set.artifact)));
test('S3-05', '同 Hash 不同内容冲突', async () => { const repo = new InMemoryLearningProgressionRepository(); await repo.saveArtifact(set.artifact); await assert.rejects(() => repo.saveArtifact({ ...set.artifact, sourceCandidateIds: ['changed'] })); });
test('S3-06', 'Artifact round-trip 稳定', async () => { const repo = new InMemoryLearningProgressionRepository(); await repo.saveArtifact(set.artifact); assert.deepEqual(await repo.getArtifact(set.artifact.planHash), set.artifact); });
test('S3-07', '发布 Gateway 装配正式 Metadata', () => assert(read('src/ai/agents/questionCandidateAdoptionGateway.ts').includes('persistAndBuildProgressionMetadata')));
test('S3-08', '历史 Frozen 可缺 Metadata', () => assert.equal(frozen('low', { metadata: false }).progressionMetadata, undefined));
test('S3-09', '阶段 3 不批量修改历史资源', () => assert(!read('src/ai/services/learningProgressionRuntimeService.ts').includes('listVersions')));
test('S3-10', '分批成员保持正式相对顺序', () => { assert.deepEqual(orderFormalResourcesForLearningSequence([frozen('high')], { taskRole: 'training', progressionArtifacts: [set.artifact] }).map((v) => v.taskId), ['task-high']); assert(read('src/ai/agents/learningSessionTaskQueueAgent.ts').includes('progressionArtifacts')); });

const native = resolveLearningProgressionContext({ studentId: 'student-1', learningSessionId: 'session-1', learningRoundId: 'round-1', learningTaskAttemptId: 'attempt-2', resourceVersion: frozen('high'), activeResourceVersions: [frozen('low'), frozen('high')], progressionArtifact: set.artifact, capturedAt: NOW });
test('S3-11', '原生 Metadata + Artifact 解析 native authority', () => assert.equal(native.authoritySource, 'native_authority'));
test('S3-12', '历史标签仅形成 legacy projection', () => assert.equal(resolveLearningProgressionContext({ studentId: 's', learningSessionId: 'x', learningRoundId: 'r', learningTaskAttemptId: 'a', resourceVersion: frozen('low', { metadata: false }), capturedAt: NOW }).authoritySource, 'legacy_projection'));
test('S3-13', 'Metadata / Artifact 冲突不可比较', () => assert.notEqual(resolveLearningProgressionContext({ studentId: 's', learningSessionId: 'x', learningRoundId: 'r', learningTaskAttemptId: 'a', resourceVersion: frozen('low'), progressionArtifact: null, capturedAt: NOW }).comparisonEligibility, 'eligible'));
test('S3-14', 'Snapshot 绑定五类身份', () => ['studentId', 'learningSessionId', 'learningRoundId', 'learningTaskAttemptId', 'resourceVersionId'].forEach((key) => assert((native as unknown as Record<string, unknown>)[key])));
test('S3-15', 'Snapshot Hash 稳定', () => assert.equal(contextFor(1).snapshotHash, contextFor(1).snapshotHash));
test('S3-16', 'Successor 不改变已冻结 Snapshot', () => { const before = structuredClone(native); frozen('high'); assert.deepEqual(native, before); });
test('S3-17', 'Repository 恢复原 Snapshot', async () => { const repo = new InMemoryLearningProgressionRepository(); await repo.saveContext(native); assert.deepEqual(await repo.getContextByAttemptId(native.learningTaskAttemptId), native); assert(read('src/api/phase163LiveLearning.ts').includes('freezeAttemptContext')); });
test('S3-18', '原生 Plan 按 sequenceRank 推进', () => assert.deepEqual(orderFormalResourcesForLearningSequence([frozen('high'), frozen('low')], { taskRole: 'training', progressionArtifacts: [set.artifact] }).map((v) => v.taskId), ['task-low', 'task-high']));
test('S3-19', 'holistic_first 服从正式 rank', () => { const holistic = planFixture('holistic_first'); assert.deepEqual(orderFormalResourcesForLearningSequence([frozen('high', { plan: holistic }), frozen('low', { plan: holistic })], { taskRole: 'training', progressionArtifacts: [holistic.artifact] }).map((v) => v.taskId), ['task-low', 'task-high']); });
test('S3-20', 'Retest 不参与 Training 改排', () => assert.deepEqual(orderFormalResourcesForLearningSequence([frozen('high'), frozen('low')], { taskRole: 'retest', progressionArtifacts: [set.artifact] }).map((v) => v.taskId), ['task-high', 'task-low']));
test('S3-21', '不同 Plan 保持块顺序', () => { const other = planFixture(); other.progressionPlan.materialVersionId = 'other:v1'; other.progressionPlan.planHash = calculateTaskGroupProgressionPlanHash(other.progressionPlan); const list = orderFormalResourcesForLearningSequence([frozen('high'), frozen('low')], { taskRole: 'training', progressionArtifacts: [set.artifact] }); assert.equal(list.length, 2); });
test('S3-22', '缺原生 Plan 保持旧 Scheduler', () => assert.deepEqual(orderFormalResourcesForLearningSequence([frozen('high', { metadata: false }), frozen('low', { metadata: false })], { taskRole: 'training' }).map((v) => v.taskId), ['task-low', 'task-high']));

test('S3-23', 'Initial Attempt 形成 Observation', () => assert(isProgressionPerformanceObservation(observation(1))));
test('S3-24', 'Observation 重放幂等', () => assert.equal(observation(1).observationId, observation(1).observationId));
test('S3-25', '无效作答不可比较', () => assert.notEqual(observation(1, 'invalid').comparisonEligibility, 'eligible'));
test('S3-26', 'Hint 映射支持模式', () => assert.equal(createProgressionPerformanceObservation({ context: contextFor(1), responseId: 'r', formalDiagnosisId: 'd', diagnosis: diagnosis(), usedHint: true, observedAt: NOW }).supportMode, 'hint_supported_initial'));
test('S3-27', 'Revision 映射反馈支持', () => assert.equal(observation(1, 'meets', 'feedback_revision').comparisonEligibility, 'excluded'));
test('S3-28', 'Targeted 标记支持上下文', () => assert.equal(observation(1, 'meets', 'targeted_training').supportMode, 'targeted_training'));
test('S3-29', 'Retest / Transfer 保持独立身份', () => ['retest_independent', 'transfer_independent'].forEach((mode) => assert.equal(observation(1, 'meets', mode as never).comparisonEligibility, 'eligible')));
test('S3-30', '身份不一致由 Admission 排除', () => { const result = decideProgressionEvidenceAdmission({ evidence: { ...evidence(), studentId: 'other' }, context: contextFor(2), observation: observation(2, 'fails'), taskId: 'task-high', responseId: 'response-2', diagnosisId: 'diagnosis-2', decidedAt: NOW }); assert.equal(result.decision.allowProfileEvaluation, false); });

function boundary(layer: Parameters<typeof semantics>[0] = 'evidence', thread: 'same_thread' | 'cross_thread' = 'same_thread', support?: Parameters<typeof observation>[2], taskLoadRisk = false) {
  const context = contextFor(2, { layer, thread });
  const high = observation(2, 'fails', support, context);
  const low = observation(1, 'meets');
  return assessProgressionInstability({ higher: high, higherContext: context, lower: low, taskLoadRisk, assessedAt: NOW });
}
test('S3-31', '低层成功高层失败形成 provisional', () => assert.equal(boundary().status, 'provisional_boundary'));
test('S3-32', '基础理解失稳映射正确', () => { const context = contextFor(2, { layer: 'entry' }); context.predecessor!.addedResponsibilities = ['basic_understanding']; assert.equal(assessProgressionInstability({ higher: observation(2, 'fails', undefined, context), higherContext: context, lower: observation(1), assessedAt: NOW }).instabilityLayer, 'basic_understanding_not_established'); });
test('S3-33', '文本依据失稳映射正确', () => assert.equal(boundary('evidence').instabilityLayer, 'text_evidence_not_established'));
test('S3-34', '关系说明失稳映射正确', () => assert.equal(boundary('relation').instabilityLayer, 'relation_explanation_not_established'));
test('S3-35', '推理整合失稳映射正确', () => assert.equal(boundary('inference').instabilityLayer, 'inference_integration_not_established'));
test('S3-36', '表达组织失稳映射正确', () => assert.equal(boundary('expression').instabilityLayer, 'expression_organization_not_established'));
test('S3-37', '两题满足时无失稳', () => assert.equal(assessProgressionInstability({ higher: observation(2), higherContext: contextFor(2), lower: observation(1), assessedAt: NOW }).status, 'no_instability_observed'));
test('S3-38', '跨线程不可评估', () => assert.equal(boundary('evidence', 'cross_thread').status, 'not_assessable'));
test('S3-39', 'legacy 不可评估', () => { const context = contextFor(2, { authority: 'legacy_projection' }); assert.equal(assessProgressionInstability({ higher: observation(2, 'fails', undefined, context), higherContext: context, lower: observation(1), assessedAt: NOW }).status, 'not_assessable'); });
test('S3-40', '缺低层参照不可反推', () => assert.equal(assessProgressionInstability({ higher: observation(2, 'fails'), higherContext: contextFor(2), assessedAt: NOW }).status, 'not_assessable'));
test('S3-41', '负担风险优先', () => assert.equal(boundary('expression', 'same_thread', undefined, true).status, 'task_load_risk'));
test('S3-42', 'Revision 不自动证明掌握', () => assert.equal(boundary('evidence', 'same_thread', 'feedback_revision').status, 'not_assessable'));
test('S3-43', '独立验证可佐证边界', () => { const context = contextFor(2); const high = observation(2, 'fails', 'retest_independent', context); const corroboration = { ...high, observationId: `${high.observationId}-independent` }; const result = assessProgressionInstability({ higher: high, higherContext: context, lower: observation(1), corroboratingObservations: [corroboration], assessedAt: NOW }); assert.equal(result.status, 'corroborated_boundary'); });
test('S3-44', '不同学生不可拼接', () => { const low = { ...observation(1), studentId: 'other' }; assert.equal(assessProgressionInstability({ higher: observation(2, 'fails'), higherContext: contextFor(2), lower: low, assessedAt: NOW }).status, 'not_assessable'); });

function admission(input: { assessment?: ReturnType<typeof boundary>; support?: Parameters<typeof observation>[2]; evidenceOverride?: Partial<AbilityEvidence> } = {}) {
  const context = contextFor(2);
  const obs = observation(2, 'fails', input.support, context);
  return decideProgressionEvidenceAdmission({ evidence: { ...evidence(), ...input.evidenceOverride }, context, observation: obs, assessment: input.assessment, taskId: 'task-high', responseId: 'response-2', diagnosisId: 'diagnosis-2', decidedAt: NOW });
}
test('S3-45', '负担风险 Evidence 不进 Profile', () => assert.equal(admission({ assessment: boundary('expression', 'same_thread', undefined, true) }).decision.allowProfileEvaluation, false));
test('S3-46', '单一 provisional 默认 hold', () => assert.equal(admission({ assessment: boundary() }).decision.decision, 'hold_for_more_evidence'));
test('S3-47', 'Revision 只保留支持语义', () => assert.equal(admission({ support: 'feedback_revision' }).decision.allowProfileEvaluation, false));
test('S3-48', 'Targeted 不覆盖首次 Evidence', () => assert.equal(admission({ support: 'targeted_training' }).decision.decision, 'exclude_from_profile_evaluation'));
test('S3-49', '独立佐证可进入既有 Evaluation', () => { const assessment = { ...boundary(), status: 'corroborated_boundary' as const }; assert.equal(admission({ assessment, support: 'retest_independent' }).decision.allowProfileEvaluation, true); });
test('S3-50', 'Admission 重放幂等', () => assert.deepEqual(admission(), admission()));
test('S3-51', 'Admission 对象与 Context 均合法', () => { const value = admission(); assert(isProgressionEvidenceContext(value.context)); assert(isProgressionEvidenceAdmissionDecision(value.decision)); assert(read('src/ai/agents/phase163RealLearningChainAgent.ts').includes('persistEvidenceSidecar')); });
test('S3-52', 'Profile Schema 不出现负担等级', () => { const source = read('src/ai/schemas/studentAbilityProfile.schema.ts'); assert(!source.includes('loadLevel') && !source.includes('sequenceRole')); });
test('S3-53', 'Learning 学生投射不暴露内部字段', () => { const source = read('src/components/continuous-learning/LearningTaskWorkspace.jsx'); assert(!source.includes('taskGroupProgressionPlanHash')); });
test('S3-54', '临时边界不写确定结论', () => assert.equal(boundary().attribution, 'student_performance_hypothesis'));
test('S3-55', '阶段 3 Runtime 不生成 Candidate', () => assert(!read('src/ai/services/learningProgressionRuntimeService.ts').includes('QuestionCandidate')));
test('S3-56', '契约与边界完整', () => { const doc = read('docs/product/READING_TRAINING_PROGRESSIVE_LOAD_STAGE3_LEARNING_DIAGNOSIS_EVIDENCE_ENGINEERING_AND_DEBUG_PLAN.md'); assert(doc.includes('S3-01—S3-56') && doc.includes('旧主链零回归')); });

test('S3-R1', 'Context Guard 与 Runtime 持久化闭环', async () => { const repo = new InMemoryLearningProgressionRepository(); const service = new LearningProgressionRuntimeService(repo); assert(isLearningProgressionContextSnapshot(await service.freezeAttemptContext(contextFor(1)))); });
test('S3-R2', 'Assessment Guard 可消费', () => assert(isProgressionInstabilityAssessment(boundary())));
test('S3-R3', '原生 Authority 可解析', () => assert(resolveFormalProgressionAuthority(frozen('low'), [set.artifact])));

function read(relative: string) { return readFileSync(`${ROOT}/${relative}`, 'utf8'); }
let passed = 0;
console.log('\nReading Training Progressive Load Stage 3 Debug');
console.log('='.repeat(78));
for (const item of tests) {
  try { await item.run(); passed += 1; console.log(`PASS | ${item.id} ${item.name}`); }
  catch (error) { console.log(`FAIL | ${item.id} ${item.name}`); console.error(error); }
}
console.log('-'.repeat(78));
console.log(`Result: ${passed} / ${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
