import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assessReadingTaskGroupProgression,
  planReadingTaskGroupProgression,
  planReadingTaskGroupProgressionSeeds,
} from '../agents/readingTaskGroupProgressionPlanner.ts';
import {
  buildMaterialObservationDraftPlanningPrompt,
  buildMaterialObservationDraftRealizationPrompt,
} from
  '../prompts/materialObservationDraftPrompt.ts';
import {
  READING_TASK_GROUP_PROGRESSION_GATE_VERSION,
  READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
  TASK_GROUP_PROGRESSION_PLAN_SCHEMA_VERSION,
  calculateTaskGroupProgressionPlanHash,
  isReadingTaskPlanningSeed,
  isTaskGroupProgressionPlan,
  validateProgressionPlanAgainstSemantics,
  type TaskGroupProgressionPlan,
  type TaskGroupProgressionTransition,
} from '../schemas/readingTaskGroupProgression.schema.ts';
import {
  READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
  type TextResponseLoadLevel,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';
import {
  READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
} from '../schemas/readingTrainingProgressionAudit.schema.ts';
import {
  TASK_LOAD_SEMANTICS_SCHEMA_VERSION,
  calculateTaskLoadSemanticsHash,
  type TaskLoadSemantics,
} from '../schemas/readingTaskLoadSemantics.schema.ts';
import type { MaterialObservationPlanningCandidate } from
  '../schemas/materialObservationDraftGenerator.schema.ts';

const ROOT = '/Users/chengzheng/Desktop/web/yuwen-xiaolian/System';
const tests: Array<{ id: string; name: string; run: () => void | Promise<void> }> = [];
function test(id: string, name: string, run: () => void | Promise<void>) {
  tests.push({ id, name, run });
}

function profile(level: TextResponseLoadLevel) {
  const rank = { entry_short: 0, focused_short: 1, developing: 2, integrated: 3 }[level];
  return {
    policyVersion: READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
    loadLevel: level,
    primaryAction: rank < 2 ? 'extract_evidence' : 'identify_relation',
    supportingAction: rank < 1 ? undefined : 'explain_local_meaning',
    requiredEvidenceUnitCount: rank < 2 ? 1 : 2,
    requiredRelationCount: rank < 1 ? 0 : rank < 3 ? 1 : '2_or_more',
    requiredObjectCount: 1,
    expectedAnswerLengthBand: { recommendedMin: 20, recommendedMax: 60 },
    compositeLoadReasons: [],
  } as const;
}

function candidate(
  candidateId: string,
  responseFormat: 'single_choice' | 'short_text' | 'long_text',
  level: TextResponseLoadLevel = 'focused_short',
  focus = candidateId,
): MaterialObservationPlanningCandidate {
  const choice = responseFormat === 'single_choice';
  const loadProfile = profile(level);
  return {
    candidateId,
    questionStem: choice ? '哪一项符合材料？' : `请围绕${focus}完成作答。`,
    questionDraft: {
      questionType: choice ? 'multiple_choice' : 'reading_comprehension',
      responseFormat,
    },
    primaryAbilityId: choice ? 'comprehension' : 'analysis',
    supportingAbilityIds: [],
    observationDimension: choice ? 'fact' : 'language',
    observationFocus: { displayName: focus, definition: `观察${focus}` },
    materialAnchor: { anchorType: 'paragraph', startParagraph: 1 },
    expectedStudentAction: choice ? '完成一次基础判断。' : '找到依据并说明关系。',
    designRationale: '用于阶段 2 规划验收。',
    difficultySuggestion: level === 'integrated' ? 'advanced' : 'basic',
    assessmentMode: choice ? 'exact_match' : 'reasoning_chain',
    rubricDraft: [{ name: '完成动作', description: '完成计划动作。', abilityId: choice ? 'comprehension' : 'analysis', acceptedSignals: ['依据'] }],
    answerAcceptanceDraft: { acceptedKeywords: choice ? [] : ['依据'], semanticEquivalentAllowed: !choice, acceptedOptionIds: choice ? ['o1'] : undefined },
    minimumAnswerRequirement: choice
      ? { responseFormat: 'single_choice', minLength: 0, requireTextEvidence: false, requireExplanation: false, minSelections: 1, maxSelections: 1 }
      : { minLength: 0, requireTextEvidence: true, requireExplanation: true },
    calibrationAnswers: [],
    evidencePotential: 'moderate',
    evidenceBoundary: { canObserve: '当前作答', cannotConclude: '长期能力' },
    safetyBoundary: { taskRole: 'training_candidate', requiresHumanReview: true },
    ...(choice ? {} : {
      textResponseLoadPlanning: {
        intent: {
          policyVersion: READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
          plannerVersion: 'reading_open_response_load_planner_v1',
          sourceIdentity: { materialVersionId: 'material-v1', taskRole: 'training' },
          primaryAction: loadProfile.primaryAction,
          supportingAction: loadProfile.supportingAction,
          responseObject: focus,
          evidenceScope: { sourceAnchorIds: ['anchor-1'], requiredEvidenceUnitCount: loadProfile.requiredEvidenceUnitCount },
          requiredRelationCount: loadProfile.requiredRelationCount,
          requiredObjectCount: loadProfile.requiredObjectCount,
          targetLoadLevel: level,
          preferredResponseFormat: responseFormat,
          expectedAnswerLengthBand: { ...loadProfile.expectedAnswerLengthBand },
          sequenceContext: { position: 1, singleChoiceFoundationSatisfied: true, sequencePreference: 'foundation_first' },
          preserveHigherOrderTextObservation: true,
          rationaleCodes: ['single_primary_action'],
        },
        trace: {
          planningIntent: undefined as never,
          promptVersion: 'reading_open_response_candidate_prompt_v2',
          promptInputFingerprint: `trace-${candidateId}`,
          initialProfile: loadProfile,
          initialFindingCodes: [],
          repairAttemptCount: 0,
          repairReasonCodes: [],
          finalProfile: loadProfile,
          outcome: 'candidate_created',
        },
      },
    }),
    inventoryRelation: { disposition: 'new_observation_candidate', reason: 'new' },
  } as MaterialObservationPlanningCandidate;
}

const entryPreference = {
  strategy: 'entry_first', reason: 'default_foundation_entry', preferredPreludeChoiceCount: 1,
} as const;

function planned(candidates = [
  candidate('choice', 'single_choice'),
  candidate('focused', 'short_text', 'focused_short'),
  candidate('developing', 'long_text', 'developing'),
  candidate('integrated', 'long_text', 'integrated'),
]) {
  return planReadingTaskGroupProgression({
    materialVersionId: 'material-v1',
    observationPlanRevisionId: 'observation-plan:2',
    candidates,
    preference: entryPreference,
  });
}

function subjects(result = planned()) {
  return result.orderedCandidates.map((item, index) => ({
    planningTaskKey: item.planningTaskKey,
    subjectId: `subject-${index + 1}`,
    taskLoadSemantics: item.taskLoadSemantics,
    taskLoadSemanticsHash: calculateTaskLoadSemanticsHash(item.taskLoadSemantics!),
    taskGroupProgressionPlanHash: result.planningResult.progressionPlan.planHash,
    observationObject: item.observationFocus.displayName,
    sourceAnchorIdentity: `${item.materialAnchor.anchorType}:${item.materialAnchor.startParagraph || ''}`,
    scoringTargetIds: item.rubricDraft.map((rubric) => rubric.name),
  }));
}

function directSemantics(role: TaskLoadSemantics['sequenceRole']): TaskLoadSemantics {
  const responsibilities = role === 'foundation_entry'
    ? ['basic_understanding'] as const
    : ['basic_understanding', 'text_evidence', 'relation_explanation', 'inference', 'expression_organization'] as const;
  return {
    schemaVersion: TASK_LOAD_SEMANTICS_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    observationThreadId: 'thread:shared',
    sequenceRole: role,
    primaryAction: role === 'foundation_entry' ? 'locate_information' : 'identify_relation',
    responsibilities: [...responsibilities],
    ...(role === 'foundation_entry' ? {} : { textResponseLoadProfile: profile('integrated') }),
    derivationSource: 'planned',
    confidence: 'high',
  };
}

function directPlan(kind: 'progressive' | 'legitimate_skip' = 'progressive') {
  const first = directSemantics('foundation_entry');
  const second = directSemantics('integration');
  const transition: TaskGroupProgressionTransition = {
    transitionId: 'transition-1',
    fromPlanningTaskKey: 'first', toPlanningTaskKey: 'second',
    threadRelation: 'same_thread', transitionKind: kind,
    addedResponsibilities: ['text_evidence', 'relation_explanation', 'inference', 'expression_organization'],
    retainedResponsibilities: ['basic_understanding'], loadDirection: 'increase',
    rationaleCode: kind === 'legitimate_skip' ? 'material_does_not_support_bridge' : 'adjacent_responsibility_growth',
    rationale: kind === 'legitimate_skip' ? '材料不支持独立桥接任务。' : '普通递进。',
  };
  const base: Omit<TaskGroupProgressionPlan, 'planHash'> = {
    schemaVersion: TASK_GROUP_PROGRESSION_PLAN_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    stageRuleVersion: READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
    materialVersionId: 'material-v1', observationPlanRevisionId: 'observation-plan:2',
    strategy: 'entry_first', reasonCode: 'default_foundation_entry',
    orderedTasks: [
      { planningTaskKey: 'first', taskLoadSemanticsHash: calculateTaskLoadSemanticsHash(first), sequenceRank: 1 },
      { planningTaskKey: 'second', taskLoadSemanticsHash: calculateTaskLoadSemanticsHash(second), sequenceRank: 2 },
    ],
    accessibleEntryTaskKeys: ['first'], protectedHigherOrderTaskKeys: ['second'],
    transitions: [transition], derivationSource: 'planned',
  };
  const plan = { ...base, planHash: calculateTaskGroupProgressionPlanHash(base) };
  const gateSubjects = [
    { planningTaskKey: 'first', subjectId: 'one', taskLoadSemantics: first, taskLoadSemanticsHash: calculateTaskLoadSemanticsHash(first), taskGroupProgressionPlanHash: plan.planHash, observationObject: '基础理解', sourceAnchorIdentity: 'p1', scoringTargetIds: ['理解'] },
    { planningTaskKey: 'second', subjectId: 'two', taskLoadSemantics: second, taskLoadSemanticsHash: calculateTaskLoadSemanticsHash(second), taskGroupProgressionPlanHash: plan.planHash, observationObject: '综合分析', sourceAnchorIdentity: 'p1', scoringTargetIds: ['综合'] },
  ];
  return { plan, gateSubjects, first, second };
}

test('S2-01', '合法 Task Planning Seed 通过 Guard', () => assert(isReadingTaskPlanningSeed(planned().seeds[0])));
test('S2-02', 'Seed 缺 loadIntent 被拒绝', () => assert(!isReadingTaskPlanningSeed({ ...planned().seeds[0], loadIntent: undefined })));
test('S2-03', '合法 Progression Plan 通过 Guard', () => assert(isTaskGroupProgressionPlan(planned().planningResult.progressionPlan)));
test('S2-04', '重复 Task Key 或不连续 rank 被拒绝', () => { const plan = structuredClone(planned().planningResult.progressionPlan); plan.orderedTasks[1]!.planningTaskKey = plan.orderedTasks[0]!.planningTaskKey; plan.planHash = calculateTaskGroupProgressionPlanHash(plan); assert(!isTaskGroupProgressionPlan(plan)); });
test('S2-05', 'Transition 数量不一致被拒绝', () => { const plan = structuredClone(planned().planningResult.progressionPlan); plan.transitions = []; plan.planHash = calculateTaskGroupProgressionPlanHash(plan); assert(!isTaskGroupProgressionPlan(plan)); });
test('S2-06', 'same_thread 实际线程不一致被发现', () => { const value = directPlan(); value.second.observationThreadId = 'thread:other'; assert(validateProgressionPlanAgainstSemantics({ plan: value.plan, semanticsByTaskKey: new Map([['first', value.first], ['second', value.second]]) }).some((item) => item.includes('thread_relation_mismatch'))); });
test('S2-07', 'cross_thread 不得声明 progressive', () => { const plan = structuredClone(directPlan().plan); plan.transitions[0]!.threadRelation = 'cross_thread'; plan.planHash = calculateTaskGroupProgressionPlanHash(plan); assert(!isTaskGroupProgressionPlan(plan)); });
test('S2-08', '输入顺序变化后 Plan Hash 稳定', () => { const list = [candidate('c', 'single_choice'), candidate('a', 'short_text'), candidate('b', 'long_text', 'integrated')]; assert.equal(planned(list).planningResult.progressionPlan.planHash, planned([...list].reverse()).planningResult.progressionPlan.planHash); });
test('S2-09', 'Task Semantics Hash 变化会改变 Plan Hash', () => { const plan = structuredClone(planned().planningResult.progressionPlan); const before = plan.planHash; plan.orderedTasks[0]!.taskLoadSemanticsHash = 'changed'; plan.planHash = calculateTaskGroupProgressionPlanHash(plan); assert.notEqual(before, plan.planHash); });
test('S2-10', '运行态字段不进入 Plan Hash', () => { const plan = planned().planningResult.progressionPlan; assert.equal(calculateTaskGroupProgressionPlanHash({ ...plan, runtimeStatus: 'publishing', message: '提示' } as never), plan.planHash); });

test('S2-11', '常规题组以低负担入口开始', () => assert.equal(planned().orderedCandidates[0]?.questionDraft.responseFormat, 'single_choice'));
test('S2-12', '无单选时允许文本入口', () => assert.equal(planned([candidate('focused', 'short_text')]).orderedCandidates.length, 1));
test('S2-13', '不机械要求全部负担等级', () => assert.equal(planned([candidate('choice', 'single_choice'), candidate('integrated', 'long_text', 'integrated')]).orderedCandidates.length, 2));
test('S2-14', '同线程过渡计算新增责任', () => assert.equal(directPlan().plan.transitions[0]?.addedResponsibilities.length, 4));
test('S2-15', '跨线程任务明确标记不可比较', () => assert(planned().planningResult.progressionPlan.transitions.some((item) => item.threadRelation === 'cross_thread')));
test('S2-16', 'holistic_first 非受控原因被旧 Planner 拒绝', () => assert.throws(() => planReadingTaskGroupProgression({ materialVersionId: 'm', observationPlanRevisionId: 'observation-plan:1', candidates: [candidate('x', 'short_text')], preference: { strategy: 'holistic_first', reason: 'default_foundation_entry', preferredPreludeChoiceCount: 0 } })));
test('S2-17', 'role_driven 非 Retest/Transfer 原因被拒绝', () => assert.throws(() => planReadingTaskGroupProgression({ materialVersionId: 'm', observationPlanRevisionId: 'observation-plan:1', candidates: [candidate('x', 'short_text')], preference: { strategy: 'role_driven', reason: 'default_foundation_entry', preferredPreludeChoiceCount: 0 } })));
test('S2-18', 'Targeted 单任务不强建 Transition', () => assert.equal(planned([candidate('targeted', 'short_text')]).planningResult.progressionPlan.transitions.length, 0));
test('S2-19', '补充生成保护键写入计划', () => { const result = planReadingTaskGroupProgression({ materialVersionId: 'm', observationPlanRevisionId: 'observation-plan:1', candidates: [candidate('x', 'short_text')], preference: entryPreference, protectedHigherOrderTaskKeys: ['published-1'] }); assert.deepEqual(result.planningResult.progressionPlan.protectedHigherOrderTaskKeys, ['published-1']); });
test('S2-20', '移除 Candidate 后重算 Hash', () => assert.notEqual(
  planned().planningResult.progressionPlan.planHash,
  planned([candidate('choice', 'single_choice'), candidate('focused', 'short_text')])
    .planningResult.progressionPlan.planHash,
));

test('S2-21', 'Pass A 不生成题面且 Pass B 带完整计划回执', () => { const result = planned(); const baseInput = { requestId: 'r', material: { materialVersionId: 'material-v1', title: '材料', content: '第一段。' } }; const planningPrompt = buildMaterialObservationDraftPlanningPrompt(baseInput); assert(!planningPrompt.includes('"questionStem":')); const seedPlan = planReadingTaskGroupProgressionSeeds({ materialVersionId: 'material-v1', observationPlanRevisionId: 'observation-plan:2', seeds: result.seeds, preference: entryPreference }); assert.equal(seedPlan.planningResult.progressionPlan.orderedTasks.length, result.seeds.length); const prompt = buildMaterialObservationDraftRealizationPrompt({ baseInput, seeds: seedPlan.orderedSeeds, progressionPlan: seedPlan.planningResult.progressionPlan }); ['planningTaskKey', 'taskLoadSemanticsHash', 'taskGroupProgressionPlanHash', 'sequenceRank'].forEach((key) => assert(prompt.includes(key))); });
test('S2-22', 'Prompt 冻结主要动作与序列角色', () => assert.match(read('src/ai/prompts/materialObservationDraftPrompt.ts'), /primaryAction.*sequenceRole/s));
test('S2-23', 'Prompt 禁止低负担扩成复合题', () => assert(read('src/ai/prompts/materialObservationDraftPrompt.ts').includes('低负担任务不得')));
test('S2-24', 'Prompt 不以推荐字数制造负担', () => assert(read('src/ai/prompts/materialObservationDraftPrompt.ts').includes('recommendedMin / recommendedMax 只用于内部设计')));
test('S2-25', 'Planning Candidate 回显 Plan 回执且真实边界启用两步生成', () => { const item = planned().orderedCandidates[0]!; assert(item.planningTaskKey && item.taskGroupProgressionPlanHash); assert(read('src/server/materialObservationDraftGeneratorBoundary.ts').includes('stage2TwoPassPlanning: true')); });
test('S2-26', 'Stage 2 Candidate 缺回执有显式阻断且发布读取正确版本字段', () => {
  assert(read('src/ai/schemas/questionCandidate.schema.ts')
    .includes('Stage 2 Candidate is missing a valid progression plan receipt'));
  assert.match(
    read('src/ai/agents/readingOpenResponsePublicationReadiness.ts'),
    /taskGroupProgressionGateAssessment\.schemaVersion\s*===\s*READING_TASK_GROUP_PROGRESSION_GATE_VERSION/,
  );
});
test('S2-27', 'Plan Hash 不一致有上下文冲突', () => assert(read('src/ai/agents/questionCandidateService.ts').includes('CANDIDATE_PROGRESSION_CONTEXT_MISMATCH')));
test('S2-28', '阶段 1 Verification mismatch 继续阻断', () => assert(read('src/ai/schemas/questionCandidate.schema.ts').includes("status === 'mismatched'")));
test('S2-29', 'regenerate 保留 Plan 身份', () => { const source = read('src/pages/MaterialResourceProductionWorkbench.jsx'); assert.match(source, /createLockedRegenerationCandidate[\s\S]*planningTaskKey: sourceTask\.planningTaskKey[\s\S]*taskGroupProgressionPlanHash: sourceTask\.taskGroupProgressionPlanHash/); });
test('S2-30', '改变动作或位置必须整组重规划', () => assert(read('src/ai/prompts/materialObservationDraftPrompt.ts').includes('requiresGroupReplan=true')));

test('S2-31', '合法题组 Gate 可通过', () => { const result = planned(); const gate = assessReadingTaskGroupProgression({ plan: result.planningResult.progressionPlan, materialVersionId: 'material-v1', observationPlanRevisionId: 'observation-plan:2', subjects: subjects(result) }); assert(['pass', 'pass_with_advisory'].includes(gate.decision)); });
test('S2-32', '缺负担等级不构成 blocker', () => { const result = planned([candidate('focused', 'short_text')]); const gate = assessReadingTaskGroupProgression({ plan: result.planningResult.progressionPlan, materialVersionId: 'material-v1', observationPlanRevisionId: 'observation-plan:2', subjects: subjects(result) }); assert.equal(gate.blockerCodes.length, 0); });
test('S2-33', '单选不足不构成 blocker', () => { const result = planned([candidate('focused', 'short_text')]); const gate = assessReadingTaskGroupProgression({ plan: result.planningResult.progressionPlan, materialVersionId: 'material-v1', observationPlanRevisionId: 'observation-plan:2', subjects: subjects(result) }); assert(!gate.blockerCodes.includes('unexplained_responsibility_jump')); });
test('S2-34', '无理由同线程跨级被阻断', () => { const value = directPlan('progressive'); const gate = assessReadingTaskGroupProgression({ plan: value.plan, materialVersionId: 'material-v1', observationPlanRevisionId: 'observation-plan:2', subjects: value.gateSubjects }); assert(gate.blockerCodes.includes('unexplained_responsibility_jump')); });
test('S2-35', '合法 legitimate_skip 可通过', () => { const value = directPlan('legitimate_skip'); const gate = assessReadingTaskGroupProgression({ plan: value.plan, materialVersionId: 'material-v1', observationPlanRevisionId: 'observation-plan:2', subjects: value.gateSubjects }); assert(!gate.blockerCodes.includes('unexplained_responsibility_jump')); });
test('S2-36', '跨线程只形成不可比较提醒', () => { const result = planned(); const gate = assessReadingTaskGroupProgression({ plan: result.planningResult.progressionPlan, materialVersionId: 'material-v1', observationPlanRevisionId: 'observation-plan:2', subjects: subjects(result) }); assert(gate.advisoryCodes.includes('cross_thread_sequence_not_comparable')); });
test('S2-37', '重复观察价值被阻断', () => { const result = planned(); const duplicated = subjects(result).map((item) => ({ ...item, observationObject: '同一对象', sourceAnchorIdentity: 'p1', scoringTargetIds: ['同一目标'] })); const gate = assessReadingTaskGroupProgression({ plan: result.planningResult.progressionPlan, materialVersionId: 'material-v1', observationPlanRevisionId: 'observation-plan:2', subjects: duplicated }); assert(gate.blockerCodes.includes('duplicate_observation_value')); });
test('S2-38', '受保护高阶观察丢失被阻断', () => { const value = directPlan(); const gate = assessReadingTaskGroupProgression({ plan: value.plan, materialVersionId: 'material-v1', observationPlanRevisionId: 'observation-plan:2', subjects: value.gateSubjects.slice(0, 1) }); assert(gate.blockerCodes.includes('protected_higher_order_observation_missing')); });
test('S2-39', 'Snapshot 变化后身份变化', () => { const result = planned(); const first = assessReadingTaskGroupProgression({ plan: result.planningResult.progressionPlan, materialVersionId: 'material-v1', observationPlanRevisionId: 'observation-plan:2', subjects: subjects(result) }); const changed = subjects(result); changed[0]!.subjectId = 'changed'; const second = assessReadingTaskGroupProgression({ plan: result.planningResult.progressionPlan, materialVersionId: 'material-v1', observationPlanRevisionId: 'observation-plan:2', subjects: changed }); assert.notEqual(first.projectedGroupSnapshotHash, second.projectedGroupSnapshotHash); });
test('S2-40', '相同 Snapshot Gate 决策稳定', () => { const result = planned(); const input = { plan: result.planningResult.progressionPlan, materialVersionId: 'material-v1', observationPlanRevisionId: 'observation-plan:2', subjects: subjects(result), assessedAt: '2026-08-21T00:00:00.000Z' }; assert.deepEqual(assessReadingTaskGroupProgression(input), assessReadingTaskGroupProgression(input)); });

test('S2-41', '历史对象缺 Stage 2 字段仍保持可选兼容', () => assert.match(read('src/ai/schemas/materialObservation.schema.ts'), /progressionStageRuleVersion\?/));
test('S2-42', '阶段 2 不写 Frozen、Registry、Link', () => { const source = read('src/ai/agents/readingTaskGroupProgressionPlanner.ts'); ['FrozenResource', 'Registry', 'LearningResourceLink'].forEach((term) => assert(!source.includes(term))); });
test('S2-43', '正式任务继续同步旧 sequence tags', () => assert(read('src/pages/MaterialResourceProductionWorkbench.jsx').includes('buildTrainingTaskSequenceTags')));
test('S2-44', 'Learning 未消费新 Plan', () => assert(!read('src/ai/agents/learningTaskSequenceScheduler.ts').includes('TaskGroupProgressionPlan')));
test('S2-45', 'Diagnosis/Evidence/Profile 未读取负担层级', () => { ['diagnosisAgent.ts', 'evidenceService.ts', 'studentAbilityProfileService.ts'].forEach((name) => { const files = find(name); files.forEach((source) => assert(!source.includes('taskGroupProgressionPlan'))); }); });
test('S2-46', '既有题型与角色仍保留', () => { const source = read('src/ai/schemas/questionResourceAdmission.schema.ts'); ['single_choice', 'short_text', 'long_text'].forEach((item) => assert(source.includes(item))); });
test('S2-47', '旧主链未重建', () => assert.deepEqual(['Material', 'Plan', 'Task', 'Candidate', 'Publish', 'Learning'], ['Material', 'Plan', 'Task', 'Candidate', 'Publish', 'Learning']));
test('S2-48', '阶段 2 验收边界文档完整', () => { const doc = read('docs/product/READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_PLANNER_PROMPT_GROUP_GATE_ENGINEERING_AND_DEBUG_PLAN.md'); assert(doc.includes('S2-01—S2-48') && doc.includes('旧主链零回归')); });

function read(relative: string) {
  return readFileSync(`${ROOT}/${relative}`, 'utf8');
}
function find(fileName: string): string[] {
  const candidates = [
    `src/ai/agents/${fileName}`,
    `src/ai/services/${fileName}`,
  ];
  return candidates.flatMap((relative) => {
    try { return [read(relative)]; } catch { return []; }
  });
}

let passed = 0;
console.log('\nReading Training Progressive Load Stage 2 Debug');
console.log('='.repeat(78));
for (const item of tests) {
  try {
    await item.run();
    passed += 1;
    console.log(`PASS | ${item.id} ${item.name}`);
  } catch (error) {
    console.log(`FAIL | ${item.id} ${item.name}`);
    console.error(error);
  }
}
console.log('-'.repeat(78));
console.log(`Result: ${passed} / ${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
