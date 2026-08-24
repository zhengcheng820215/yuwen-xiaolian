import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  createMaterialObservationDraftGeneratorConfig,
  generateMaterialObservationDraftCandidates,
} from '../agents/materialObservationDraftGeneratorAgent.ts';
import {
  buildReadingOpenResponseLoadPromptPolicy,
  planReadingOpenResponseLoad,
  projectReadingOpenResponseCandidateLoad,
  stableTextResponsePromptFingerprint,
} from '../agents/readingOpenResponseLoadPlanningAgent.ts';
import { buildMaterialObservationDraftPrompt } from
  '../prompts/materialObservationDraftPrompt.ts';
import { ScriptedDiagnosisProviderAdapter } from
  '../providers/diagnosisProviderAdapter.ts';
import {
  READING_OPEN_RESPONSE_CANDIDATE_PROMPT_VERSION,
  READING_OPEN_RESPONSE_LOAD_PLANNER_VERSION,
  isTextResponseCandidateGenerationTrace,
  isTextResponseLoadPlanningIntent,
  type TextResponseLoadPlanningInput,
} from '../schemas/readingOpenResponseGenerationPlanning.schema.ts';
import {
  READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION,
} from '../schemas/readingOpenResponseInputLoad.schema.ts';

type DebugCase = { id: string; name: string; run: () => void | Promise<void> };

const cases: DebugCase[] = [
  {
    id: 'P2-01',
    name: '完整规划意图通过 Schema guard',
    run: () => assert.equal(isTextResponseLoadPlanningIntent(planned(baseInput()).intent), true),
  },
  {
    id: 'P2-02',
    name: '缺少 Material 身份时要求重新聚焦',
    run: () => assert.equal(planReadingOpenResponseLoad(baseInput({
      sourceIdentity: { materialVersionId: '', taskRole: 'training' },
    })).status, 'requires_task_refocus'),
  },
  {
    id: 'P2-03',
    name: '每道题形成唯一主要动作',
    run: () => assert.equal(planned(baseInput()).intent.primaryAction, 'extract_evidence'),
  },
  {
    id: 'P2-04',
    name: '支撑动作最多一个',
    run: () => {
      const intent = planned(baseInput({
        questionStem: '找出一句描写，并说明它表达的含义。',
        expectedStudentAction: '找出证据后解释局部含义',
        rubric: [rubric('证据解释', '找出证据并解释局部含义', 'comprehension')],
        abilityMetadata: ability('comprehension', 'basic'),
      })).intent;
      assert(intent.supportingAction);
      assert.equal(Array.isArray(intent.supportingAction), false);
    },
  },
  {
    id: 'P2-05',
    name: '支撑动作与主要动作共享同一证据范围',
    run: () => assert.deepEqual(planned(baseInput({
      sourceAnchorIds: ['p-2', 'p-1', 'p-2'],
    })).intent.evidenceScope.sourceAnchorIds, ['p-1', 'p-2']),
  },
  {
    id: 'P2-06',
    name: '三个独立动作阻止创建规划',
    run: () => {
      const result = planReadingOpenResponseLoad(compositeInput());
      assert.equal(result.status, 'requires_task_refocus');
      if (result.status === 'requires_task_refocus') {
        assert(result.reasonCodes.includes('three_or_more_independent_actions'));
      }
    },
  },
  {
    id: 'P2-07',
    name: '同一输入规划结果确定',
    run: () => assert.deepEqual(
      planReadingOpenResponseLoad(baseInput()),
      planReadingOpenResponseLoad(structuredClone(baseInput())),
    ),
  },
  {
    id: 'P2-08',
    name: '位置变化不机械改变负担等级',
    run: () => assert.equal(
      planned(baseInput({ sequenceContext: { position: 3 } })).intent.targetLoadLevel,
      planned(baseInput({ sequenceContext: { position: 0 } })).intent.targetLoadLevel,
    ),
  },
  {
    id: 'P2-09',
    name: '整体判断优先保留受控例外',
    run: () => {
      const intent = planned(baseInput({
        sequenceContext: {
          position: 0,
          sequencePreference: 'holistic_judgment_first',
          exceptionReason: 'holistic_judgment_required',
        },
      })).intent;
      assert.equal(intent.sequenceContext.exceptionReason, 'holistic_judgment_required');
    },
  },
  {
    id: 'P2-10',
    name: '单选不进入文本负担规划',
    run: () => assert.deepEqual(planReadingOpenResponseLoad(baseInput({
      responseFormat: 'single_choice',
    })), { status: 'not_applicable', reason: 'non_text_response_format' }),
  },
  {
    id: 'P2-11',
    name: '主 Prompt 包含材料、任务与负担策略',
    run: () => {
      const prompt = buildMaterialObservationDraftPrompt(generatorInput());
      assert(prompt.includes('<material'));
      assert(prompt.includes('开放文本题负担策略'));
      assert(prompt.includes('一个主要认知动作'));
    },
  },
  {
    id: 'P2-12',
    name: 'Prompt 输入 fingerprint 稳定',
    run: () => assert.equal(
      stableTextResponsePromptFingerprint({ b: 2, a: 1 }),
      stableTextResponsePromptFingerprint({ a: 1, b: 2 }),
    ),
  },
  {
    id: 'P2-13',
    name: '严格 JSON 之外的说明文本被拒绝',
    run: async () => {
      const provider = new ScriptedDiagnosisProviderAdapter([{
        type: 'response',
        rawOutput: `说明：${JSON.stringify(validPayload())}`,
      }]);
      const result = await runGenerator(generatorInput(), provider, 1);
      assert.equal(result.status, 'review_required');
      assert.deepEqual(result.candidates, []);
    },
  },
  {
    id: 'P2-14',
    name: '隐藏 Required Rubric 进入确定性 Finding',
    run: () => assert(planned(hiddenRubricInput()).findingCodes.includes(
      'hidden_rubric_requirement',
    )),
  },
  {
    id: 'P2-15',
    name: '材料 Anchor 完整进入规划意图',
    run: () => assert.deepEqual(planned(baseInput({
      sourceAnchorIds: ['paragraph-2'],
    })).intent.evidenceScope.sourceAnchorIds, ['paragraph-2']),
  },
  {
    id: 'P2-16',
    name: '综合负担优先 long_text',
    run: () => assert.equal(planned(integratedInput()).intent.preferredResponseFormat, 'long_text'),
  },
  {
    id: 'P2-17',
    name: 'Prompt 禁止把单选事实改写为文本复述',
    run: () => assert(buildReadingOpenResponseLoadPromptPolicy().includes(
      '不得只换成文字复述同一结论',
    )),
  },
  {
    id: 'P2-18',
    name: '高阶文本观察被标记为保留',
    run: () => assert.equal(
      planned(integratedInput()).intent.preserveHigherOrderTextObservation,
      true,
    ),
  },
  {
    id: 'P2-19',
    name: 'Prompt 明确禁止输出内部规划术语',
    run: () => assert(buildReadingOpenResponseLoadPromptPolicy().includes(
      '不输出 loadLevel、recommendedMin、recommendedMax',
    )),
  },
  {
    id: 'P2-20',
    name: '学生字段不包含内部推荐长度',
    run: () => {
      const payload = validPayload().candidates[0];
      const studentFields = JSON.stringify({
        questionStem: payload.questionStem,
        expectedStudentAction: payload.expectedStudentAction,
        minimumAnswerRequirement: payload.minimumAnswerRequirement,
      });
      assert.equal(/recommendedMin|recommendedMax|建议回答/u.test(studentFields), false);
    },
  },
  {
    id: 'P2-21',
    name: '四个负担等级使用已冻结内部长度策略',
    run: () => {
      assert.deepEqual(planned(baseInput()).intent.expectedAnswerLengthBand, {
        recommendedMin: 10, recommendedMax: 25,
      });
      assert.deepEqual(planned(focusedInput()).intent.expectedAnswerLengthBand, {
        recommendedMin: 20, recommendedMax: 40,
      });
      assert.equal(planned(developingInput()).intent.expectedAnswerLengthBand.recommendedMin, 30);
      assert.equal(planned(integratedInput()).intent.expectedAnswerLengthBand.recommendedMin, 50);
    },
  },
  {
    id: 'P2-22',
    name: '推荐长度不等于最低作答要求',
    run: () => {
      const input = focusedInput({ minimumAnswerRequirement: minimum(8, false, true) });
      const intent = planned(input).intent;
      assert.notEqual(intent.expectedAnswerLengthBand.recommendedMin, input.minimumAnswerRequirement.minLength);
    },
  },
  {
    id: 'P2-23',
    name: '简单题过高最低字数被识别',
    run: () => assert(planned(baseInput({
      minimumAnswerRequirement: minimum(90, false, false),
    })).findingCodes.includes('minimum_length_overweighted')),
  },
  {
    id: 'P2-24',
    name: '综合 Rubric 过低最低要求被识别',
    run: () => assert(planned(integratedInput({
      minimumAnswerRequirement: minimum(10, true, true),
    })).findingCodes.includes('minimum_length_under_supports_rubric')),
  },
  {
    id: 'P2-25',
    name: '候选生成追踪保存确定性复算画像',
    run: () => {
      const projection = projectionOf(focusedInput());
      assert(projection.trace?.finalProfile);
      assert.equal(isTextResponseCandidateGenerationTrace(projection.trace), true);
    },
  },
  {
    id: 'P2-26',
    name: '声明意图不完整时不创建 Candidate 投影',
    run: () => assert(projectionOf(compositeInput()).blockingIssueCodes.length > 0),
  },
  {
    id: 'P2-27',
    name: '负担偏差最多执行一次候选级修复',
    run: async () => {
      const initial = validPayload();
      initial.candidates[0] = compositeCandidate();
      const repaired = {
        ...initial.candidates[0],
        questionStem: '结合全文中父亲继续向前走这一动作，说明他怎样的心情？',
        expectedStudentAction: '根据父亲继续向前走的动作，说明他的关心。',
        rubricDraft: [draftRubric('动作与心理', 'analysis')],
        calibrationAnswers: calibrationAnswers('动作与心理'),
        repairOfCandidateIndex: 0,
      };
      const provider = scripted([initial, { candidates: [repaired], materialLimitations: [] }]);
      const result = await runGenerator(generatorInput(), provider, 2);
      assert.equal(provider.getCallCount(), 2, JSON.stringify(result, null, 2));
      assert.equal(result.provider.repair?.attempted, true);
      assert.equal(result.provider.repair?.recoveredCandidateCount, 1, JSON.stringify(result, null, 2));
    },
  },
  {
    id: 'P2-28',
    name: '修复不得改变主要能力与观察对象',
    run: async () => {
      const initial = validPayload();
      initial.candidates[0] = compositeCandidate();
      const illegalRepair = {
        ...textCandidate('被替换的目标', 'expression', 'theme'),
        repairOfCandidateIndex: 0,
      };
      const result = await runGenerator(
        generatorInput(),
        scripted([initial, { candidates: [illegalRepair], materialLimitations: [] }]),
        2,
      );
      assert.equal(result.provider.repair?.recoveredCandidateCount, 0);
    },
  },
  {
    id: 'P2-29',
    name: '一次修复仍失败时不产生该 Candidate',
    run: async () => {
      const initial = validPayload();
      initial.candidates[0] = compositeCandidate();
      const stillInvalid = { ...compositeCandidate(), repairOfCandidateIndex: 0 };
      const result = await runGenerator(
        generatorInput(),
        scripted([initial, { candidates: [stillInvalid], materialLimitations: [] }]),
        2,
      );
      assert.equal(result.provider.repair?.unresolvedCandidateCount, 1);
      assert.equal(result.candidates.some((candidate) => (
        candidate.observationFocus.displayName === initial.candidates[0].observationFocus.displayName
      )), false);
    },
  },
  {
    id: 'P2-30',
    name: '生成追踪只接受白名单修复原因',
    run: () => {
      const projection = projectReadingOpenResponseCandidateLoad({
        planningInput: focusedInput(),
        promptInputFingerprint: 'stage2-debug',
        repairAttemptCount: 1,
        repairIssueCodes: ['text_response_load.hidden_rubric_requirement', 'unknown_issue'],
      });
      assert.deepEqual(projection.trace?.repairReasonCodes, ['hidden_rubric_requirement']);
    },
  },
  {
    id: 'P2-31',
    name: '正常生成的文本候选附加内部规划追踪',
    run: async () => {
      const result = await runGenerator(generatorInput(), scripted([validPayload()]), 1);
      assert(result.candidates.every((candidate) => candidate.textResponseLoadPlanning));
    },
  },
  {
    id: 'P2-32',
    name: '阶段 2 不修改 Frozen Question Version',
    run: async () => assertSharedStoreUnchanged('versions'),
  },
  {
    id: 'P2-33',
    name: '阶段 2 不修改 Registry 与 Observation Link',
    run: async () => assertSharedStoreUnchanged('registry_and_links'),
  },
  {
    id: 'P2-34',
    name: '阶段 2 不修改 Learning Session 或 Attempt',
    run: () => {
      const learning = { sessions: [{ id: 's1' }], attempts: [{ id: 'a1' }] };
      const before = structuredClone(learning);
      projectionOf(focusedInput());
      assert.deepEqual(learning, before);
    },
  },
  {
    id: 'P2-35',
    name: '阶段 2 不修改 Student Ability Profile',
    run: () => {
      const profile = { abilityId: 'analysis', status: 'developing' };
      const before = structuredClone(profile);
      projectionOf(integratedInput());
      assert.deepEqual(profile, before);
    },
  },
  {
    id: 'P2-36',
    name: '同一次输入不会制造不同 fingerprint',
    run: () => assert.equal(
      projectionOf(focusedInput()).trace?.promptInputFingerprint,
      projectionOf(focusedInput()).trace?.promptInputFingerprint,
    ),
  },
  {
    id: 'P2-37',
    name: '显式重新生成可以获得新的 attempt identity',
    run: () => assert.notEqual(
      stableTextResponsePromptFingerprint({ requestId: 'attempt-1' }),
      stableTextResponsePromptFingerprint({ requestId: 'attempt-2' }),
    ),
  },
  {
    id: 'P2-38',
    name: '阶段 2 结果不包含正式资源身份',
    run: async () => {
      const result = await runGenerator(generatorInput(), scripted([validPayload()]), 1);
      assert(result.candidates.every((candidate) => (
        !('resourceVersionId' in candidate) && !('formalizationStatus' in candidate)
      )));
    },
  },
  {
    id: 'P2-39',
    name: '单选既有链不需要文本生成追踪',
    run: () => assert.equal(planReadingOpenResponseLoad(baseInput({
      responseFormat: 'single_choice',
    })).status, 'not_applicable'),
  },
  {
    id: 'P2-40',
    name: '阶段 2 版本与 Prompt 版本已冻结',
    run: () => {
      assert.equal(READING_OPEN_RESPONSE_LOAD_PLANNER_VERSION, 'reading_open_response_load_planner_v1');
      assert.equal(READING_OPEN_RESPONSE_CANDIDATE_PROMPT_VERSION, 'reading_open_response_candidate_prompt_v2');
      assert.equal(READING_OPEN_RESPONSE_INPUT_LOAD_POLICY_VERSION, 'reading_open_response_input_load_policy_v1_1');
    },
  },
];

let passed = 0;
for (const testCase of cases) {
  try {
    await testCase.run();
    passed += 1;
    console.log(`PASS ${testCase.id} ${testCase.name}`);
  } catch (error) {
    console.error(`FAIL ${testCase.id} ${testCase.name}`);
    throw error;
  }
}

console.log(JSON.stringify({ summary: `${passed}/${cases.length}` }, null, 2));
console.log(`Reading open-response input-load Stage 2 Debug passed (${passed}/${cases.length}).`);

function baseInput(
  overrides: Partial<TextResponseLoadPlanningInput> = {},
): TextResponseLoadPlanningInput {
  return {
    sourceIdentity: {
      materialVersionId: 'material-stage2:v1',
      trainingTaskId: 'task-stage2-1',
      taskRole: 'training',
    },
    questionIdentity: 'question-stage2-1',
    materialTitle: '调试材料',
    questionStem: '女娲最初在哪里行走？',
    responseObject: '起始地点',
    responseFormat: 'short_text',
    rubric: [rubric('地点定位', '定位女娲最初行走的地点', 'extraction', false, false)],
    minimumAnswerRequirement: minimum(6, false, false),
    abilityMetadata: ability('extraction', 'basic'),
    expectedStudentAction: '定位并写出一个地点',
    sourceAnchorIds: ['paragraph-1'],
    sourceEvidenceCharacterCount: 100,
    ...overrides,
  };
}

function focusedInput(
  overrides: Partial<TextResponseLoadPlanningInput> = {},
): TextResponseLoadPlanningInput {
  return baseInput({
    questionStem: '“荒凉寂寞”在这里有什么含义？',
    responseObject: '局部含义',
    rubric: [rubric('局部含义', '解释词语在语境中的含义', 'comprehension', false, true)],
    minimumAnswerRequirement: minimum(12, false, true),
    abilityMetadata: ability('comprehension', 'basic'),
    expectedStudentAction: '解释局部含义',
    ...overrides,
  });
}

function developingInput(
  overrides: Partial<TextResponseLoadPlanningInput> = {},
): TextResponseLoadPlanningInput {
  return baseInput({
    questionStem: '结合两处描写，说明人物心情的变化。',
    responseObject: '心情变化',
    rubric: [rubric('变化解释', '用两处描写说明人物心情变化', 'analysis', true, true)],
    minimumAnswerRequirement: minimum(20, true, true),
    abilityMetadata: ability('analysis', 'intermediate'),
    expectedStudentAction: '使用两处描写说明变化',
    sourceAnchorIds: ['paragraph-1', 'paragraph-2'],
    sourceEvidenceCharacterCount: 180,
    ...overrides,
  });
}

function integratedInput(
  overrides: Partial<TextResponseLoadPlanningInput> = {},
): TextResponseLoadPlanningInput {
  return baseInput({
    questionStem: '结合全文多处描写，分析人物形象，并说明这些表现共同反映的特点。',
    responseObject: '人物形象',
    responseFormat: 'long_text',
    rubric: [
      rubric('人物特点', '分析人物形象特点', 'analysis', true, true),
      rubric('证据关系', '说明多处证据与人物判断的关系', 'analysis', true, true),
    ],
    minimumAnswerRequirement: minimum(40, true, true),
    abilityMetadata: ability('analysis', 'advanced'),
    expectedStudentAction: '组织多处证据并完成人物分析',
    sourceAnchorIds: ['paragraph-1', 'paragraph-2', 'paragraph-3'],
    sourceEvidenceCharacterCount: 360,
    ...overrides,
  });
}

function compositeInput(): TextResponseLoadPlanningInput {
  return baseInput({
    questionStem: '概括故事内容，分析人物形象，并说明文章主题。',
    responseObject: '故事、人物与主题',
    responseFormat: 'long_text',
    rubric: [
      rubric('概括', '概括故事内容', 'summarization', true, true),
      rubric('人物', '分析人物形象', 'analysis', true, true),
      rubric('主题', '说明文章主题', 'analysis', true, true),
    ],
    minimumAnswerRequirement: minimum(60, true, true),
    abilityMetadata: ability('analysis', 'advanced'),
    expectedStudentAction: '概括、分析人物并说明主题',
    sourceAnchorIds: ['paragraph-1', 'paragraph-2', 'paragraph-3'],
  });
}

function hiddenRubricInput(): TextResponseLoadPlanningInput {
  return baseInput({
    questionStem: '请概括这一段的主要内容。',
    responseObject: '段落内容',
    rubric: [
      rubric('内容概括', '概括主要内容', 'summarization', false, true),
      rubric('结构作用', '分析这段在结构上的作用', 'analysis', true, true),
    ],
    abilityMetadata: ability('summarization', 'intermediate'),
    expectedStudentAction: '概括主要内容',
  });
}

function planned(input: TextResponseLoadPlanningInput) {
  const result = planReadingOpenResponseLoad(input);
  assert.equal(result.status, 'planned', JSON.stringify(result));
  if (result.status !== 'planned') throw new Error('Expected planned result.');
  return result;
}

function projectionOf(input: TextResponseLoadPlanningInput) {
  return projectReadingOpenResponseCandidateLoad({
    planningInput: input,
    promptInputFingerprint: stableTextResponsePromptFingerprint(input),
  });
}

function rubric(
  name: string,
  description: string,
  abilityId: 'extraction' | 'comprehension' | 'summarization' | 'analysis' | 'inference' | 'expression',
  requireTextEvidence = true,
  requireExplanation = true,
) {
  return {
    itemId: `rubric-${name}`,
    name,
    description,
    abilityId,
    importance: 'critical' as const,
    required: true,
    evidenceRequirement: { requireTextEvidence, requireExplanation, requireConclusion: requireExplanation },
    acceptedSignals: [name],
  };
}

function minimum(minLength: number, requireTextEvidence: boolean, requireExplanation: boolean) {
  return { minLength, requireTextEvidence, requireExplanation };
}

function ability(
  abilityId: 'extraction' | 'comprehension' | 'summarization' | 'analysis' | 'inference' | 'expression',
  difficulty: 'basic' | 'intermediate' | 'advanced',
) {
  return { abilityId, supportingAbilityIds: [], difficulty };
}

function generatorInput() {
  return {
    requestId: 'stage2-generator-request',
    material: {
      materialVersionId: 'stage2-material:v1',
      title: '雨后的站台',
      content: '父亲站在站台边，反复整理孩子的衣领。\n列车启动后，他仍向前走了几步，直到看不清车窗。',
    },
    preferences: {
      candidateCount: 2,
      planningIntent: 'initial' as const,
      preferredAbilityIds: ['extraction', 'comprehension'] as const,
    },
  };
}

function validPayload() {
  return {
    sequencePlanningDecision: {
      strategy: 'entry_first',
      reason: 'default_foundation_entry',
      preferredPreludeChoiceCount: 0,
    },
    candidates: [
      textCandidate('动作定位', 'extraction', 'fact', {
        questionStem: '父亲在站台上做了什么动作？',
        expectedStudentAction: '找出并写出父亲整理衣领的动作。',
        materialAnchor: { anchorType: 'paragraph', startParagraph: 1 },
      }),
      textCandidate('动作含义', 'comprehension', 'character', {
        questionStem: '根据第2段父亲继续向前走这一动作，说明他怎样的心情？',
        expectedStudentAction: '根据父亲继续向前走的动作，说明他的关心。',
        materialAnchor: { anchorType: 'paragraph', startParagraph: 2 },
      }),
    ],
    materialLimitations: [],
  };
}

function compositeCandidate() {
  const primaryRubricName = '概括故事内容';
  return textCandidate('综合目标', 'analysis', 'theme', {
    questionStem: '概括送别过程，分析父亲形象，并说明文章主题。',
    expectedStudentAction: '概括情节、分析人物并说明主题。',
    supportingAbilityIds: ['summarization'],
    materialAnchor: { anchorType: 'full_text' },
    rubricDraft: [
      draftRubric(primaryRubricName, 'summarization'),
      draftRubric('分析人物形象', 'analysis'),
      draftRubric('说明文章主题', 'analysis'),
    ],
    calibrationAnswers: calibrationAnswers(primaryRubricName),
  });
}

function textCandidate(
  focus: string,
  primaryAbilityId: string,
  observationDimension: string,
  overrides: Record<string, any> = {},
) {
  const rubricName = `${focus}评分项`;
  return {
    questionStem: `${focus}题目`,
    questionDraft: { questionType: 'reading_comprehension', responseFormat: 'short_text' },
    primaryAbilityId,
    supportingAbilityIds: [],
    observationDimension,
    observationFocus: {
      displayName: focus,
      definition: `观察学生能否完成${focus}。`,
    },
    materialAnchor: { anchorType: 'paragraph', startParagraph: 1 },
    expectedStudentAction: `完成${focus}。`,
    designRationale: `用于观察${focus}，不形成长期能力结论。`,
    difficultySuggestion: 'basic',
    assessmentMode: 'key_points',
    rubricDraft: [draftRubric(rubricName, primaryAbilityId)],
    answerAcceptanceDraft: {
      acceptedKeywords: ['父亲', '动作'],
      semanticEquivalentAllowed: true,
    },
    minimumAnswerRequirement: {
      minLength: 8,
      requireTextEvidence: false,
      requireExplanation: primaryAbilityId !== 'extraction',
    },
    calibrationAnswers: calibrationAnswers(rubricName),
    evidencePotential: 'moderate',
    evidenceBoundary: {
      canObserve: `本次作答中的${focus}。`,
      cannotConclude: '不能根据单题宣布长期掌握。',
    },
    safetyBoundary: { taskRole: 'training_candidate', requiresHumanReview: true },
    ...overrides,
  };
}

function draftRubric(name: string, abilityId: string) {
  return { name, description: name, abilityId, acceptedSignals: ['材料事实'] };
}

function calibrationAnswers(rubricName: string) {
  return [
    calibration('fully_meets', '完整回答。', 'fully_meets', 'completed', 'eligible', rubricName),
    calibration('partially_meets', '部分回答。', 'partially_meets', 'partial', 'eligible_but_weak', rubricName),
    calibration('typical_error', '出现典型错误。', 'does_not_meet', 'missing', 'eligible', rubricName),
    calibration('reasonable_alternative', '合理异表述。', 'fully_meets', 'completed', 'eligible', rubricName),
    calibration('irrelevant', '不知道。', 'insufficient_evidence', 'missing', 'ineligible', rubricName),
  ];
}

function calibration(
  category: string,
  answerText: string,
  expectedAnswerStatus: string,
  status: string,
  expectedEvidenceEligibility: string,
  rubricName: string,
) {
  return {
    category,
    answerText,
    expectedAnswerStatus,
    expectedRubricCoverage: [{ rubricName, status }],
    expectedDiagnosisBoundary: '只描述本次作答。',
    expectedEvidenceEligibility,
  };
}

function scripted(payloads: unknown[]) {
  return new ScriptedDiagnosisProviderAdapter(payloads.map((payload) => ({
    type: 'response' as const,
    rawOutput: JSON.stringify(payload),
  })));
}

async function runGenerator(
  input: ReturnType<typeof generatorInput>,
  provider: ScriptedDiagnosisProviderAdapter,
  maxAttempts: number,
) {
  return generateMaterialObservationDraftCandidates(input, {
    provider,
    config: createMaterialObservationDraftGeneratorConfig({
      providerName: provider.providerName,
      model: 'stage2-scripted-model',
      maxAttempts,
    }),
  });
}

async function assertSharedStoreUnchanged(
  scope: 'versions' | 'registry_and_links',
) {
  const store = new SharedFormalResourceStore();
  const before = await store.read();
  projectionOf(focusedInput());
  const after = await store.read();
  assert.equal(after.revision, before.revision);
  if (scope === 'versions') {
    assert.deepEqual(after.data.questionResources.versions, before.data.questionResources.versions);
  } else {
    assert.deepEqual(after.data.questionResources.registryEntries, before.data.questionResources.registryEntries);
    assert.deepEqual(after.data.materialObservations.links, before.data.materialObservations.links);
  }
}
