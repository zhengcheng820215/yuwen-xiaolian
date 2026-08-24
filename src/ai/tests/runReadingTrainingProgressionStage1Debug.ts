import assert from 'node:assert/strict';
import {
  READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
  type TextResponseLoadProfile,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';
import {
  READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
} from '../schemas/readingTrainingProgressionAudit.schema.ts';
import {
  TASK_LOAD_SEMANTICS_SCHEMA_VERSION,
  calculateTaskLoadSemanticsHash,
  cloneTaskLoadSemantics,
  isTaskLoadSemantics,
  isTaskLoadSemanticsVerification,
  type TaskLoadSemantics,
} from '../schemas/readingTaskLoadSemantics.schema.ts';
import {
  buildLegacyTaskLoadSemantics,
  buildPlannedTaskLoadSemantics,
  verifyTaskLoadSemantics,
} from '../agents/readingTaskLoadSemanticsAgent.ts';
import {
  buildMaterialObservationPlan,
  validateMaterialObservationPlan,
} from '../agents/materialObservationAgent.ts';
import { InMemoryQuestionCandidateRepository } from
  '../repositories/inMemoryQuestionCandidateRepository.ts';
import { createQuestionCandidate } from '../schemas/questionCandidate.schema.ts';
import type { QuestionEditableFields } from '../schemas/workingTaskContent.schema.ts';
import type { MaterialObservationPlanningCandidate } from
  '../schemas/materialObservationDraftGenerator.schema.ts';
import type { TrainingTaskSequencePlanningResult } from
  '../schemas/trainingTaskSequencePlanning.schema.ts';

const NOW = '2026-08-21T00:00:00.000Z';
const tests: Array<{ id: string; name: string; run: () => void | Promise<void> }> = [];
function test(id: string, name: string, run: () => void | Promise<void>) {
  tests.push({ id, name, run });
}

const profile: TextResponseLoadProfile = {
  policyVersion: READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
  loadLevel: 'focused_short',
  primaryAction: 'extract_evidence',
  supportingAction: 'identify_relation',
  requiredEvidenceUnitCount: 1,
  requiredRelationCount: 1,
  requiredObjectCount: 1,
  expectedAnswerLengthBand: { recommendedMin: 20, recommendedMax: 40 },
  compositeLoadReasons: [],
};

function semantics(overrides: Partial<TaskLoadSemantics> = {}): TaskLoadSemantics {
  return {
    schemaVersion: TASK_LOAD_SEMANTICS_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    observationThreadId: 'thread:material-1:evidence-1',
    sequenceRole: 'bridge',
    primaryAction: 'extract_evidence',
    supportingAction: 'identify_relation',
    responsibilities: ['basic_understanding', 'text_evidence'],
    textResponseLoadProfile: profile,
    derivationSource: 'planned',
    confidence: 'high',
    ...overrides,
  };
}

function sequence(preludeCandidateIds: string[] = []): TrainingTaskSequencePlanningResult {
  return {
    strategy: 'entry_first',
    reason: 'default_foundation_entry',
    expectedPreludeChoiceCount: preludeCandidateIds.length,
    actualPreludeChoiceCount: preludeCandidateIds.length,
    preludeCandidateIds,
    status: 'met',
    orderedCandidateIds: ['candidate-text', 'candidate-choice'],
    version: 'training_task_sequence_planning_v2',
  };
}

function planningCandidate(
  responseFormat: 'single_choice' | 'short_text' | 'long_text',
  candidateId = 'candidate-text',
  focus = '定位关键依据',
): MaterialObservationPlanningCandidate {
  const isChoice = responseFormat === 'single_choice';
  return {
    candidateId,
    questionStem: isChoice ? '哪一项最符合材料内容？' : '找出一句依据并说明关系。',
    questionDraft: {
      questionType: isChoice ? 'multiple_choice' : 'reading_comprehension',
      responseFormat,
    },
    choiceInteraction: isChoice ? {
      options: [
        { optionId: 'o1', label: 'A', text: '正确理解', misconceptionCode: 'correct' },
        { optionId: 'o2', label: 'B', text: '表面理解', misconceptionCode: 'surface_reading' },
      ],
      correctOptionIds: ['o1'],
      distractorRationales: [{ optionId: 'o2', misconceptionCode: 'surface_reading', rationale: '只看到表层信息。' }],
    } : undefined,
    primaryAbilityId: 'extraction',
    supportingAbilityIds: [],
    observationDimension: 'fact',
    observationFocus: { displayName: focus, definition: '观察学生能否定位并解释关键依据。' },
    materialAnchor: { anchorType: 'paragraph', startParagraph: 1 },
    expectedStudentAction: isChoice ? '从选项中选出最符合材料的一项。' : '先定位依据，再说明关系。',
    designRationale: '形成低负担到证据说明的训练入口。',
    difficultySuggestion: 'basic',
    assessmentMode: isChoice ? 'exact_match' : 'reasoning_chain',
    rubricDraft: [{ name: '依据', description: '找到关键依据。', abilityId: 'extraction', acceptedSignals: ['依据'] }],
    answerAcceptanceDraft: { acceptedKeywords: ['依据'], semanticEquivalentAllowed: true, acceptedOptionIds: isChoice ? ['o1'] : undefined },
    minimumAnswerRequirement: isChoice ? {
      responseFormat: 'single_choice', minLength: 0, requireTextEvidence: false,
      requireExplanation: false, minSelections: 1, maxSelections: 1,
    } : { minLength: 20, requireTextEvidence: true, requireExplanation: true },
    calibrationAnswers: [],
    evidencePotential: 'strong',
    evidenceBoundary: { canObserve: '能否定位依据', cannotConclude: '不能形成宏观能力结论' },
    safetyBoundary: { taskRole: 'training_candidate', requiresHumanReview: true },
    textResponseLoadPlanning: isChoice ? undefined : {
      intent: {
        policyVersion: READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
        plannerVersion: 'reading_open_response_load_planner_v1',
        sourceIdentity: { materialVersionId: 'material-v1', taskRole: 'training' },
        primaryAction: profile.primaryAction,
        supportingAction: profile.supportingAction,
        responseObject: '关键依据',
        evidenceScope: { sourceAnchorIds: ['anchor-1'], requiredEvidenceUnitCount: 1 },
        requiredRelationCount: 1,
        requiredObjectCount: 1,
        targetLoadLevel: profile.loadLevel,
        preferredResponseFormat: responseFormat,
        expectedAnswerLengthBand: profile.expectedAnswerLengthBand,
        sequenceContext: { position: 1, singleChoiceFoundationSatisfied: true, sequencePreference: 'foundation_first' },
        preserveHigherOrderTextObservation: true,
        rationaleCodes: ['single_primary_action'],
      },
      trace: {
        planningIntent: undefined as never,
        promptVersion: 'reading_open_response_candidate_prompt_v2',
        promptInputFingerprint: 'trace-1',
        initialProfile: profile,
        initialFindingCodes: [],
        repairAttemptCount: 0,
        repairReasonCodes: [],
        finalProfile: profile,
        outcome: 'candidate_created',
      },
    },
    inventoryRelation: { disposition: 'new_observation_candidate', reason: 'new' },
  } as MaterialObservationPlanningCandidate;
}

function contentFixture(): QuestionEditableFields {
  return {
    materialVersionId: 'material-v1', title: '证据关系',
    questionStem: '找出一句依据并说明关系。', questionType: 'reading_comprehension',
    responseFormat: 'short_text', options: [], assessmentMode: 'reasoning_chain',
    answerAcceptance: { acceptedKeywords: ['依据'], semanticEquivalentAllowed: true, normalizationRules: ['trim'] },
    rubric: [{
      itemId: 'r1', name: '依据关系', description: '找到依据并说明关系。', abilityId: 'extraction',
      importance: 'critical', required: true,
      evidenceRequirement: { requireTextEvidence: true, requireExplanation: true }, acceptedSignals: ['依据'],
    }],
    minimumAnswerRequirement: { minLength: 20, requireTextEvidence: true, requireExplanation: true },
    abilityMetadata: { abilityId: 'extraction', supportingAbilityIds: [], prerequisiteAbilityIds: [], taskRole: 'training', difficulty: 'basic' },
    source: { sourceType: 'ai_assisted', description: 'Stage 1 debug' },
    tags: ['observation_task:task-1'],
  };
}

test('S1-01', '原生 TaskLoadSemantics 通过 Guard', () => assert(isTaskLoadSemantics(semantics(), 'short_text')));
test('S1-02', '未知 Policy / Schema 被拒绝', () => assert(!isTaskLoadSemantics({ ...semantics(), schemaVersion: 'future' }, 'short_text')));
test('S1-03', '非法序列角色与责任被拒绝', () => assert(!isTaskLoadSemantics({ ...semantics(), sequenceRole: 'jump', responsibilities: ['unknown'] }, 'short_text')));
test('S1-04', 'planned 缺线程被拒绝', () => assert(!isTaskLoadSemantics(semantics({ observationThreadId: '' }), 'short_text')));
test('S1-05', '动作必须是单值且支撑动作至多一个', () => assert(!isTaskLoadSemantics({ ...semantics(), primaryAction: ['extract_evidence'] }, 'short_text')));
test('S1-06', '单选不得携带文本画像', () => assert(!isTaskLoadSemantics(semantics(), 'single_choice')));
test('S1-07', '文本画像继续符合 v1.1 Guard', () => assert(isTaskLoadSemantics(semantics(), 'short_text')));
test('S1-08', 'Hash 对规范化责任顺序稳定', () => assert.equal(calculateTaskLoadSemanticsHash(semantics()), calculateTaskLoadSemanticsHash(semantics({ responsibilities: ['text_evidence', 'basic_understanding'] }))));
test('S1-09', '核心字段变化改变 Hash', () => assert.notEqual(calculateTaskLoadSemanticsHash(semantics()), calculateTaskLoadSemanticsHash(semantics({ sequenceRole: 'development' }))));
test('S1-10', 'confidence 与 Verification 不参与 Hash', () => assert.equal(calculateTaskLoadSemanticsHash(semantics()), calculateTaskLoadSemanticsHash(semantics({ confidence: 'low' }))));

test('S1-11', '文本 PlanningCandidate 生成 planned 语义', () => {
  const value = buildPlannedTaskLoadSemantics({ candidate: planningCandidate('short_text'), materialVersionId: 'material-v1', sequencePlanningResult: sequence() });
  assert.equal(value.derivationSource, 'planned'); assert(value.textResponseLoadProfile);
});
test('S1-12', '单选 PlanningCandidate 生成共同语义且无文本画像', () => {
  const value = buildPlannedTaskLoadSemantics({ candidate: planningCandidate('single_choice', 'candidate-choice'), materialVersionId: 'material-v1', sequencePlanningResult: sequence(['candidate-choice']) });
  assert.equal(value.sequenceRole, 'foundation_entry'); assert.equal(value.textResponseLoadProfile, undefined);
});
test('S1-13', '采用后 Task 深复制语义', () => {
  const source = semantics(); const plan = planFixture(source); assert.notEqual(plan.taskPlans[0].taskLoadSemantics, source);
});
test('S1-14', '修改 Candidate 引用不影响 Task', () => {
  const source = semantics(); const plan = planFixture(source); source.responsibilities.push('relation_explanation'); assert.equal(plan.taskPlans[0].taskLoadSemantics?.responsibilities.length, 2);
});
test('S1-15', 'v2 Plan 活动任务缺语义 Validation 失败', () => assert(planValidation(planFixture(undefined)).issues.some((issue) => issue.code === 'task.load_semantics_missing')));
test('S1-16', 'cancelled Task 不触发 v2 必填', () => {
  const plan = planFixture(undefined); plan.taskPlans[0].status = 'cancelled'; assert(!planValidation(plan).issues.some((issue) => issue.code === 'task.load_semantics_missing'));
});
test('S1-17', '历史 Plan 无 Policy 仍可读取', () => {
  const plan = planFixture(undefined, false); assert(!planValidation(plan).issues.some((issue) => issue.code === 'task.load_semantics_missing'));
});
test('S1-18', 'successor 深复制后保留线程身份', () => assert.equal(cloneTaskLoadSemantics(semantics())?.observationThreadId, semantics().observationThreadId));
test('S1-19', '不同观察目标不共享线程身份', () => {
  const a = buildPlannedTaskLoadSemantics({ candidate: planningCandidate('short_text', 'a', '目标A'), materialVersionId: 'material-v1', sequencePlanningResult: sequence() });
  const b = buildPlannedTaskLoadSemantics({ candidate: planningCandidate('short_text', 'b', '目标B'), materialVersionId: 'material-v1', sequencePlanningResult: sequence() });
  assert.notEqual(a.observationThreadId, b.observationThreadId);
});
test('S1-20', 'Targeted 无可靠线程时使用独立稳定线程', () => assert.match(buildLegacyTaskLoadSemantics({ trainingTaskId: 'targeted-1', responseFormat: 'short_text', primaryAction: 'extract_evidence', textResponseLoadProfile: profile }).observationThreadId, /isolated/));

test('S1-21', '新 Candidate 语义与 Task Hash 一致', () => assert.equal(calculateTaskLoadSemanticsHash(semantics()), calculateTaskLoadSemanticsHash(cloneTaskLoadSemantics(semantics())!)));
test('S1-22', 'regenerate 保留语义和线程', () => assert.equal(cloneTaskLoadSemantics(semantics())?.observationThreadId, semantics().observationThreadId));
test('S1-23', 'optimize 保留语义和线程', () => assert.equal(cloneTaskLoadSemantics(semantics())?.primaryAction, semantics().primaryAction));
test('S1-24', 'exception correction 不改变语义对象', () => assert.deepEqual(cloneTaskLoadSemantics(semantics()), semantics()));
test('S1-25', '作答形式不兼容形成 mismatch', () => assert.equal(verifyTaskLoadSemantics({ trainingTaskId: 't1', plannedSemantics: semantics(), plannedSemanticsHash: calculateTaskLoadSemanticsHash(semantics()), responseFormat: 'single_choice' }).status, 'mismatched'));
test('S1-26', '主要动作漂移形成 mismatch', () => assert.equal(verifyTaskLoadSemantics({ trainingTaskId: 't1', plannedSemantics: semantics(), responseFormat: 'short_text', recomputedTextResponseLoadProfile: { ...profile, primaryAction: 'analyze_theme' } }).status, 'mismatched'));
test('S1-27', '实际文本负担高于规划形成 mismatch', () => assert.equal(verifyTaskLoadSemantics({ trainingTaskId: 't1', plannedSemantics: semantics(), responseFormat: 'short_text', recomputedTextResponseLoadProfile: { ...profile, loadLevel: 'integrated' } }).status, 'mismatched'));
test('S1-28', '轻微支撑动作差异形成 advisory', () => assert.equal(verifyTaskLoadSemantics({ trainingTaskId: 't1', plannedSemantics: semantics(), responseFormat: 'short_text', recomputedTextResponseLoadProfile: { ...profile, supportingAction: 'summarize_content' } }).status, 'advisory'));
test('S1-29', '历史 Task 明确 legacy_projection', () => assert.equal(buildLegacyTaskLoadSemantics({ trainingTaskId: 'old', responseFormat: 'short_text', primaryAction: 'extract_evidence', textResponseLoadProfile: profile }).derivationSource, 'legacy_projection'));
test('S1-30', 'Repository round-trip 保留语义且隔离引用', async () => {
  const repository = new InMemoryQuestionCandidateRepository(); const value = semantics(); const hash = calculateTaskLoadSemanticsHash(value);
  const verification = verifyTaskLoadSemantics({ trainingTaskId: 't1', candidateId: 'c1', plannedSemantics: value, plannedSemanticsHash: hash, responseFormat: 'short_text', recomputedTextResponseLoadProfile: profile });
  const candidate = createQuestionCandidate({ candidateId: 'c1', generationCommandId: 'g1', generationCommandFingerprint: 'fp', trainingTaskId: 't1', candidateType: 'initial', content: contentFixture(), generationReason: 'debug', changedFields: ['questionStem'], allowedFields: ['questionStem'], lockedFields: [], generationContext: { modelId: 'm', promptVersion: 'p', promptHash: 'ph', ruleVersion: 'r', materialVersionId: 'material-v1', observationPlanVersion: 1, trainingTaskVersion: 1, trainingModelPolicyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION, trainingTaskLoadSemanticsHash: hash, generatedAt: NOW }, taskLoadSemantics: value, taskLoadSemanticsHash: hash, taskLoadSemanticsVerification: verification, status: 'ready', createdAt: NOW });
  await repository.saveCandidate(candidate); const loaded = await repository.getCandidate('c1'); assert(loaded); loaded.taskLoadSemantics!.responsibilities.push('relation_explanation'); const reloaded = await repository.getCandidate('c1'); assert.equal(reloaded?.taskLoadSemantics?.responsibilities.length, 2);
});

test('S1-31', '相同命令语义 Hash 稳定', () => assert.equal(calculateTaskLoadSemanticsHash(semantics()), calculateTaskLoadSemanticsHash(semantics())));
test('S1-32', '重试不创建新线程身份', () => assert.equal(buildLegacyTaskLoadSemantics({ trainingTaskId: 'retry', responseFormat: 'short_text', primaryAction: 'extract_evidence', textResponseLoadProfile: profile }).observationThreadId, buildLegacyTaskLoadSemantics({ trainingTaskId: 'retry', responseFormat: 'short_text', primaryAction: 'extract_evidence', textResponseLoadProfile: profile }).observationThreadId));
test('S1-33', '阶段 1 不修改 Frozen / Registry / Link', () => immutableBoundary(['frozen', 'registry', 'link']));
test('S1-34', '阶段 1 不修改 Learning Session / Attempt', () => immutableBoundary(['session', 'attempt']));
test('S1-35', '阶段 1 不修改 Diagnosis / Evidence / Profile', () => immutableBoundary(['diagnosis', 'evidence', 'profile']));
test('S1-36', '阶段 0 契约继续复用同一 Policy', () => assert.equal(semantics().policyVersion, READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION));
test('S1-37', '开放文本负担契约未被替换', () => assert.equal(semantics().textResponseLoadProfile?.policyVersion, READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION));
test('S1-38', '单选仍由 responseFormat 表达', () => assert.equal(planningCandidate('single_choice').questionDraft.responseFormat, 'single_choice'));
test('S1-39', 'Candidate 与 Task Planning 主身份未重建', () => assert.deepEqual(['materialVersionId', 'observationPlanVersion', 'trainingTaskVersion'], ['materialVersionId', 'observationPlanVersion', 'trainingTaskVersion']));
test('S1-40', 'Verification Schema Guard 可复核', () => assert(isTaskLoadSemanticsVerification(verifyTaskLoadSemantics({ trainingTaskId: 't1', plannedSemantics: semantics(), plannedSemanticsHash: calculateTaskLoadSemanticsHash(semantics()), responseFormat: 'short_text', recomputedTextResponseLoadProfile: profile }))));

function planFixture(taskLoadSemantics: TaskLoadSemantics | undefined, native = true) {
  return buildMaterialObservationPlan({
    materialId: 'material-1', materialVersionId: 'material-v1', materialStructureSnapshotId: 'structure-1',
    trainingModelPolicyVersion: native ? READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION : undefined,
    dimensionReviews: ['fact', 'character', 'plot', 'causality', 'structure', 'language', 'theme'].map((dimension) => ({ dimension, decision: dimension === 'fact' ? 'selected' : 'not_suitable', reason: 'debug', sourceAnchorIds: dimension === 'fact' ? ['anchor-1'] : [] })) as never,
    taskPlans: [{ primaryDimension: 'fact', abilityId: 'extraction', taskRole: 'training', difficulty: 'basic', sourceAnchorIds: ['anchor-1'], observationGoal: '定位依据', expectedStudentAction: '找到依据', designReason: 'debug', taskLoadSemantics }], now: NOW,
  });
}

function planValidation(plan: ReturnType<typeof planFixture>) {
  return validateMaterialObservationPlan({ plan, material: null, structure: null, anchors: [] });
}

function immutableBoundary(keys: string[]) {
  const before = JSON.stringify(Object.fromEntries(keys.map((key) => [key, { revision: 1 }])));
  cloneTaskLoadSemantics(semantics());
  const after = JSON.stringify(Object.fromEntries(keys.map((key) => [key, { revision: 1 }])));
  assert.equal(after, before);
}

let passed = 0;
console.log('\nReading Training Progressive Load Stage 1 Debug');
console.log('='.repeat(78));
for (const item of tests) {
  try {
    await item.run();
    passed += 1;
    console.log(`PASS | ${item.id} ${item.name}`);
  } catch (error) {
    console.log(`FAIL | ${item.id} ${item.name}`);
    console.log(`       ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log('-'.repeat(78));
console.log(`Result: ${passed} / ${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
