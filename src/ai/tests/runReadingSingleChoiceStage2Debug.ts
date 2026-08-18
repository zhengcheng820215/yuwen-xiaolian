import assert from 'node:assert/strict';
import {
  createMaterialObservationDraftGeneratorConfig,
  generateMaterialObservationDraftCandidates,
} from '../agents/materialObservationDraftGeneratorAgent.ts';
import {
  evaluateGeneratedSingleChoiceOptions,
  evaluateSingleChoiceTrainingFit,
} from '../agents/singleChoiceGenerationPolicy.ts';
import { evaluateQuestionGenerationQuality } from
  '../agents/questionGenerationQualityPolicyAgent.ts';
import {
  createQuestionMaterial,
  createStructuredQuestionDraft,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  validateStructuredQuestionDraft,
} from '../agents/questionResourceAdmissionAgent.ts';
import { buildMaterialObservationDraftPrompt } from
  '../prompts/materialObservationDraftPrompt.ts';
import { ScriptedDiagnosisProviderAdapter } from
  '../providers/diagnosisProviderAdapter.ts';
import { InMemoryQuestionResourceAdmissionRepository } from
  '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION,
  type SingleChoiceInteraction,
} from '../schemas/singleChoiceInteraction.schema.ts';
import type { QuestionEditableFields } from '../schemas/workingTaskContent.schema.ts';
import { resolveSingleChoiceCandidatePreview } from
  '../../pages/singleChoiceCandidatePresentation.ts';
import {
  formatSingleChoiceAcceptedSignal,
  formatTrainingTaskTitle,
  resolveSingleChoiceAssessmentPresentation,
} from '../../pages/singleChoiceAssessmentPresentation.ts';

const NOW = '2026-08-18T12:00:00.000Z';
type Case = { name: string; run: () => void | Promise<void> };

const cases: Case[] = [
  {
    name: 'prompt freezes action-driven format with a controlled entry sequence',
    run: () => {
      const prompt = buildMaterialObservationDraftPrompt(generatorInput());
      assert.match(prompt, /单选数量目标只能在训练动作适配、干扰项质量和任务去重之后参考/);
      assert.match(prompt, /不得为了题型丰富度机械转换任务/);
      assert.match(prompt, /entry_first 是常规默认/);
      assert.match(prompt, /首个高负荷文本任务之前/);
      assert.match(prompt, /choiceInteraction/);
      assert.match(prompt, /acceptedOptionIds/);
    },
  },
  {
    name: 'supplement prompt receives a two-choice target with complete planning context',
    run: () => {
      const prompt = buildMaterialObservationDraftPrompt(generatorInput({
        candidateCount: 2,
        singleChoiceCandidateTarget: 2,
        singleChoicePlanning: singleChoicePlanningContext(),
      }));
      assert.match(prompt, /当前有效任务 3 道，其中单选 0 道/);
      assert.match(prompt, /完成后目标任务组 5 道/);
      assert.match(prompt, /本批次实际请求 2 道 single_choice/);
      assert.match(prompt, /本批次优先生成 2 个符合规则的 single_choice 候选/);
      assert.match(prompt, /单选数量是规划软目标/);
      assert.match(prompt, /当前顺序策略为 entry_first/);
      assert.match(prompt, /观察对象、证据范围或认知动作至少一项上形成实质差异/);
      assert.match(prompt, /不得复用已有题干/);
      assert.match(prompt, /single_choice_target_unfilled:/);
    },
  },
  {
    name: 'two independent single-choice candidates satisfy the supplement target',
    run: async () => {
      const result = await runGenerator({
        candidates: [choicePlanningCandidate(), factChoicePlanningCandidate()],
        materialLimitations: [],
      }, generatorInput({
        candidateCount: 2,
        singleChoiceCandidateTarget: 2,
        singleChoicePlanning: singleChoicePlanningContext(),
      }));
      assert.equal(result.status, 'candidates_ready', JSON.stringify(result.validation));
      assert.equal(result.candidates.length, 2);
      assert.deepEqual(result.candidates.map((candidate) => (
        candidate.questionDraft.responseFormat
      )), ['single_choice', 'single_choice']);
    },
  },
  {
    name: 'mismatched planning context is rejected before generation',
    run: async () => {
      const result = await runGenerator({
        candidates: [choicePlanningCandidate(), factChoicePlanningCandidate()],
        materialLimitations: [],
      }, generatorInput({
        candidateCount: 2,
        singleChoiceCandidateTarget: 1,
        singleChoicePlanning: singleChoicePlanningContext(),
      }));
      assert.equal(result.status, 'insufficient_material_for_observation_planning');
      assert(result.validation.issues.includes('single_choice_planning_context_invalid'));
      assert.equal(result.provider.attemptCount, 0);
    },
  },
  {
    name: 'complete single-choice provider output becomes a candidate',
    run: async () => {
      const result = await runGenerator({ candidates: [choicePlanningCandidate()], materialLimitations: [] });
      assert.equal(result.status, 'candidates_ready', JSON.stringify({
        validation: result.validation,
        rejected: result.rejectedCandidates,
      }));
      assert.equal(result.candidates[0]?.questionDraft.responseFormat, 'single_choice');
      assert.equal(result.candidates[0]?.choiceInteraction?.options.length, 4);
    },
  },
  {
    name: 'text-only generation is accepted without a choice quota',
    run: async () => {
      const result = await runGenerator({ candidates: [textPlanningCandidate()], materialLimitations: [] });
      assert.equal(result.status, 'candidates_ready');
      assert.equal(result.candidates[0]?.questionDraft.responseFormat, 'long_text');
    },
  },
  {
    name: 'valid text-only supplement is explainably underfilled instead of blocked',
    run: async () => {
      const result = await runGenerator(
        { candidates: [textPlanningCandidate()], materialLimitations: [] },
        generatorInput({ singleChoiceCandidateTarget: 1 }),
      );
      assert.equal(result.status, 'candidates_ready');
      assert.equal(result.validation.passed, true);
      assert.equal(result.singleChoicePlanningResult?.status, 'underfilled');
      assert.equal(result.singleChoicePlanningResult?.targetCount, 1);
      assert.equal(result.singleChoicePlanningResult?.actualCount, 0);
      assert.equal(result.singleChoicePlanningResult?.generatedCount, 0);
      assert.equal(result.singleChoicePlanningResult?.projectedTotalCount, 0);
      assert.equal(result.singleChoicePlanningResult?.shortfallCount, 1);
      assert.deepEqual(result.singleChoicePlanningResult?.reasons, ['no_independent_observation']);
      assert(!result.validation.issues.includes('single_choice_candidate_target_unmet'));
    },
  },
  {
    name: 'provider shortfall reason is preserved while valid candidates remain adoptable',
    run: async () => {
      const result = await runGenerator({
        candidates: [choicePlanningCandidate(), textPlanningCandidate()],
        materialLimitations: [
          'single_choice_target_unfilled:distractor_quality_insufficient',
        ],
      }, generatorInput({
        candidateCount: 2,
        singleChoiceCandidateTarget: 2,
        singleChoicePlanning: singleChoicePlanningContext(),
      }));
      assert.equal(result.status, 'candidates_ready', JSON.stringify(result.validation));
      assert.equal(result.candidates.length, 2);
      assert.equal(result.singleChoicePlanningResult?.status, 'underfilled');
      assert.equal(result.singleChoicePlanningResult?.targetCount, 2);
      assert.equal(result.singleChoicePlanningResult?.actualCount, 1);
      assert.equal(result.singleChoicePlanningResult?.generatedCount, 1);
      assert.equal(result.singleChoicePlanningResult?.projectedTotalCount, 1);
      assert.equal(result.singleChoicePlanningResult?.shortfallCount, 1);
      assert(result.singleChoicePlanningResult?.reasons.includes('distractor_quality_insufficient'));
    },
  },
  {
    name: 'structurally invalid generation remains hard-blocked',
    run: async () => {
      const result = await runGenerator({
        candidates: [{ questionStem: '只有题干，没有完整候选结构。' }],
        materialLimitations: [],
      }, generatorInput({ singleChoiceCandidateTarget: 1 }));
      assert.equal(result.status, 'review_required');
      assert.equal(result.validation.passed, false);
      assert.equal(result.candidates.length, 0);
      assert(result.rejectedCandidates.length > 0);
    },
  },
  {
    name: 'default sequence moves a qualified choice before text candidates',
    run: async () => {
      const input = generatorInput({ planningIntent: 'initial', candidateCount: 3 });
      const payload = {
        sequencePlanningDecision: {
          strategy: 'entry_first',
          reason: 'default_foundation_entry',
          preferredPreludeChoiceCount: 1,
        },
        candidates: [
          textPlanningCandidate({ questionStem: '请概括父亲送别孩子时的表现。' }),
          choicePlanningCandidate(),
          textPlanningCandidate({
            questionStem: '请分析第二段动作描写对情感表达的作用。',
            primaryAbilityId: 'analysis',
            observationDimension: 'language',
            observationFocus: { displayName: '动作描写作用', definition: '观察学生能否分析动作描写与情感表达的关系。' },
            expectedStudentAction: '结合第二段动作描写，分析其情感表达作用。',
            rubricDraft: [rubric('动作描写作用', 'analysis')],
          }),
        ],
        materialLimitations: [],
      };
      const result = await runGenerator(payload, input);
      assert.deepEqual(result.candidates.map((item) => item.questionDraft.responseFormat), [
        'single_choice', 'long_text',
      ]);
      assert.equal(result.sequencePlanningResult.strategy, 'entry_first');
      assert.equal(result.sequencePlanningResult.status, 'met');
    },
  },
  {
    name: 'holistic-first exception preserves an independent text baseline',
    run: async () => {
      const result = await runGenerator({
        sequencePlanningDecision: {
          strategy: 'holistic_first',
          reason: 'independent_expression_baseline',
          preferredPreludeChoiceCount: 1,
        },
        candidates: [
          textPlanningCandidate({ questionStem: '请先概括父亲送别孩子时的整体表现。' }),
          choicePlanningCandidate(),
        ],
        materialLimitations: [],
      }, generatorInput({
        candidateCount: 2,
      }));
      assert.deepEqual(result.candidates.map((item) => item.questionDraft.responseFormat), [
        'long_text', 'single_choice',
      ]);
      assert.equal(result.sequencePlanningResult.status, 'adjusted');
    },
  },
  {
    name: 'invalid provider sequence decision falls back to the default entry layer',
    run: async () => {
      const result = await runGenerator({
        sequencePlanningDecision: {
          strategy: 'role_driven',
          reason: 'transfer_in_new_context',
          preferredPreludeChoiceCount: 1,
        },
        candidates: [textPlanningCandidate(), choicePlanningCandidate()],
        materialLimitations: [],
      }, generatorInput({ candidateCount: 2 }));
      assert.equal(result.sequencePlanningResult.strategy, 'entry_first');
      assert.deepEqual(result.candidates.map((item) => item.questionDraft.responseFormat), [
        'single_choice', 'long_text',
      ]);
      assert(result.limitations.includes(
        'sequence_planning_decision_invalid:fallback_to_entry_first',
      ));
    },
  },
  {
    name: 'summarization cannot be converted to single choice',
    run: () => {
      const result = evaluateSingleChoiceTrainingFit({
        primaryAbilityId: 'summarization',
        observationDimension: 'structure',
        questionStem: '下列哪项最能概括全文？',
        expectedStudentAction: '概括全文主要内容。',
        requiredRubricCount: 1,
      });
      assert.equal(result.passed, false);
      assert(result.issues.some((issue) => issue.code === 'choice.training_action_requires_text'));
    },
  },
  {
    name: 'missing distractor rationale is blocked',
    run: () => {
      const interaction = choiceInteraction();
      interaction.distractorRationales.pop();
      const result = evaluateGeneratedSingleChoiceOptions(interaction);
      assert.equal(result.passed, false);
      assert(result.issues.some((issue) => issue.code === 'choice.distractor_coverage'));
    },
  },
  {
    name: 'duplicate misconception categories are blocked',
    run: () => {
      const interaction = choiceInteraction();
      interaction.distractorRationales[1].misconceptionCode = 'surface_reading';
      const result = evaluateGeneratedSingleChoiceOptions(interaction);
      assert(result.issues.some((issue) => issue.code === 'choice.misconception_duplicate'));
    },
  },
  {
    name: 'answer acceptance must match the correct stable option ID',
    run: async () => {
      const candidate = choicePlanningCandidate();
      candidate.answerAcceptanceDraft.acceptedOptionIds = ['option-surface'];
      const result = await runGenerator({ candidates: [candidate], materialLimitations: [] });
      assert.equal(result.status, 'review_required');
      assert(result.rejectedCandidates[0]?.issues.includes('answer_acceptance_option_mismatch'));
    },
  },
  {
    name: 'choice uses structured one-selection minimum instead of text length',
    run: async () => {
      const candidate = choicePlanningCandidate();
      candidate.minimumAnswerRequirement = {
        minLength: 1,
        requireTextEvidence: false,
        requireExplanation: false,
      };
      const result = await runGenerator({ candidates: [candidate], materialLimitations: [] });
      assert(result.rejectedCandidates[0]?.issues.includes('choice_minimum_answer_requirement_invalid'));
    },
  },
  {
    name: 'obvious correct-option length cue is blocked',
    run: () => {
      const interaction = choiceInteraction();
      interaction.options[0].content = '父亲通过反复整理衣领以及列车启动后继续向前走等一连串动作，完整地表现了非常复杂而深沉且无比强烈的离别不舍。';
      const result = evaluateGeneratedSingleChoiceOptions(interaction);
      assert(result.issues.some((issue) => issue.code === 'choice.correct_option_length_cue'));
    },
  },
  {
    name: 'generation quality accepts a bounded complete choice candidate',
    run: () => {
      const result = evaluateQuestionGenerationQuality({
        candidate: choiceEditableContent(),
        includePortfolioGuidance: false,
      });
      assert.notEqual(result.status, 'blocked', result.blockerCodes.join(','));
    },
  },
  {
    name: 'generation quality blocks dense choice rubric',
    run: () => {
      const content = choiceEditableContent();
      content.rubric = [
        rubricResource('判断人物心理', 'comprehension', 'r1'),
        rubricResource('说明动作依据', 'comprehension', 'r2'),
        rubricResource('分析表达效果', 'comprehension', 'r3'),
      ];
      const result = evaluateQuestionGenerationQuality({ candidate: content, includePortfolioGuidance: false });
      assert.equal(result.status, 'blocked');
      assert(result.blockerCodes.includes('choice_training_action_mismatch'));
    },
  },
  {
    name: 'workbench preview exposes options but strips answer and rationale',
    run: () => {
      const preview = resolveSingleChoiceCandidatePreview(choiceInteraction());
      assert(preview);
      assert.deepEqual(preview.options.map((item) => item.displayLabel), ['A', 'B', 'C', 'D']);
      const serialized = JSON.stringify(preview);
      assert.equal(serialized.includes('correctOptionIds'), false);
      assert.equal(serialized.includes('distractorRationales'), false);
      assert.equal(serialized.includes('surface_reading'), false);
    },
  },
  {
    name: 'production assessment renders option labels without exposing stable IDs',
    run: () => {
      const interaction = choiceInteraction();
      const presentation = resolveSingleChoiceAssessmentPresentation(interaction);
      assert.deepEqual(presentation.correctOption, {
        displayLabel: 'A',
        content: '舍不得孩子离开',
      });
      assert.deepEqual(
        presentation.distractors.map((item) => item.displayLabel),
        ['B', 'C', 'D'],
      );
      assert.equal(presentation.distractors[0]?.misconceptionLabel, '停留在表面信息');
      const serialized = JSON.stringify(presentation);
      assert.equal(serialized.includes('option-correct'), false);
      assert.equal(serialized.includes('option-surface'), false);
      assert.equal(serialized.includes('部分完成'), false);
      assert.equal(serialized.includes('合理异表述'), false);
    },
  },
  {
    name: 'production rubric replaces stable option ID with label and content',
    run: () => {
      const display = formatSingleChoiceAcceptedSignal(
        '选择option-correct',
        choiceInteraction(),
      );
      assert.equal(display, '选择A（舍不得孩子离开）');
      assert.equal(display.includes('option-'), false);
    },
  },
  {
    name: 'task title identifies single choice without changing text task titles',
    run: () => {
      assert.equal(formatTrainingTaskTitle(3, 'single_choice'), '训练任务4（单项选择）');
      assert.equal(formatTrainingTaskTitle(0, 'short_text'), '训练任务1');
      assert.equal(formatTrainingTaskTitle(1, 'long_text'), '训练任务2');
    },
  },
  {
    name: 'adopted choice content validates and freezes through the existing resource chain',
    run: async () => {
      const repository = new InMemoryQuestionResourceAdmissionRepository();
      await createQuestionMaterial(repository, {
        materialId: 'material-stage2',
        materialVersionId: 'material-stage2:v1',
        versionNumber: 1,
        title: '雨后的站台',
        content: generatorInput().material.content,
        source: source(),
        createdAt: NOW,
      });
      const draft = await createStructuredQuestionDraft(repository, {
        ...choiceEditableContent(),
        draftId: 'draft-stage2-choice',
        resourceId: 'resource-stage2-choice',
        taskId: 'task-stage2-choice',
        now: NOW,
      });
      const validation = await validateStructuredQuestionDraft(repository, draft.draftId, NOW);
      assert.equal(validation.passed, true, validation.issues.map((item) => item.code).join(','));
      await submitQuestionResourceForReview(repository, draft.draftId, NOW);
      await reviewQuestionResourceDraft(repository, {
        draftId: draft.draftId,
        action: 'approve',
        reviewerId: 'single-operator',
        notes: '采用完整 AI Candidate。',
        now: NOW,
      });
      const frozen = await freezeQuestionResourceDraft(repository, draft.draftId, NOW);
      assert.deepEqual(frozen.version.choiceInteraction, choiceInteraction());
    },
  },
];

let passed = 0;
for (const testCase of cases) {
  try {
    await testCase.run();
    passed += 1;
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    console.error(`FAIL ${testCase.name}`);
    throw error;
  }
}
console.log(`Reading single-choice Stage 2 debug: ${passed}/${cases.length} passed.`);

function generatorInput(preferences: Record<string, unknown> = {}) {
  return {
    requestId: 'single-choice-stage2-request',
    material: {
      materialVersionId: 'material-stage2:v1',
      title: '雨后的站台',
      content: '父亲站在站台边，反复整理孩子的衣领。\n列车启动后，他仍向前走了几步，直到看不清车窗。',
      sourceDescription: '工程验收原创材料',
    },
    preferences: {
      gradeRange: '初中',
      planningIntent: 'supplement' as const,
      candidateCount: 1,
      ...preferences,
    },
    existingInventory: {
      observations: [{
        observationId: 'existing-unrelated',
        primaryAbilityId: 'extraction' as const,
        observationDimension: 'fact' as const,
        focusDisplayName: '站台环境信息',
        focusDefinition: '识别站台场景中的明确环境信息。',
        expectedStudentAction: '找出材料中的站台环境信息。',
      }],
      questions: [],
    },
  };
}

async function runGenerator(payload: unknown, input = generatorInput()) {
  const provider = new ScriptedDiagnosisProviderAdapter([{ type: 'response', rawOutput: JSON.stringify(payload) }]);
  return generateMaterialObservationDraftCandidates(input, {
    provider,
    config: createMaterialObservationDraftGeneratorConfig({
      providerName: provider.providerName,
      model: 'stage2-scripted-provider',
      maxAttempts: 1,
    }),
  });
}

function choicePlanningCandidate() {
  const rubricName = '人物心理判断';
  return {
    questionStem: '下列哪项最能说明父亲在列车启动后的心情？',
    questionDraft: { questionType: 'multiple_choice', responseFormat: 'single_choice' },
    choiceInteraction: choiceInteraction(),
    primaryAbilityId: 'comprehension',
    supportingAbilityIds: [],
    observationDimension: 'character',
    observationFocus: { displayName: '人物心理判断', definition: '观察学生能否根据动作判断人物的主要心理。' },
    materialAnchor: { anchorType: 'full_text' },
    expectedStudentAction: '根据父亲的动作选择最恰当的心理判断。',
    designRationale: '以低输入负担观察学生能否建立动作与人物心理之间的直接联系。',
    difficultySuggestion: 'basic',
    assessmentMode: 'exact_match',
    rubricDraft: [rubric(rubricName, 'comprehension')],
    answerAcceptanceDraft: { acceptedKeywords: [], semanticEquivalentAllowed: false, acceptedOptionIds: ['option-correct'] },
    minimumAnswerRequirement: choiceMinimum(),
    calibrationAnswers: calibrationAnswers(rubricName),
    evidencePotential: 'moderate',
    evidenceBoundary: { canObserve: '本次选择能否依据动作理解父亲的不舍。', cannotConclude: '不能据此宣布人物理解能力已经稳定掌握。' },
    safetyBoundary: { taskRole: 'training_candidate', requiresHumanReview: true },
  };
}

function factChoicePlanningCandidate() {
  const rubricName = '关键动作定位';
  return {
    questionStem: '列车启动后，父亲紧接着做了什么？',
    questionDraft: { questionType: 'multiple_choice', responseFormat: 'single_choice' },
    choiceInteraction: factChoiceInteraction(),
    primaryAbilityId: 'extraction',
    supportingAbilityIds: [],
    observationDimension: 'fact',
    observationFocus: { displayName: '关键动作定位', definition: '观察学生能否定位列车启动后的明确人物动作。' },
    materialAnchor: { anchorType: 'paragraph', startParagraph: 2, endParagraph: 2 },
    expectedStudentAction: '定位第二段信息，选择父亲紧接着完成的动作。',
    designRationale: '以低输入负担观察学生是否准确定位事件后的直接行为。',
    difficultySuggestion: 'basic',
    assessmentMode: 'exact_match',
    rubricDraft: [rubric(rubricName, 'extraction')],
    answerAcceptanceDraft: { acceptedKeywords: [], semanticEquivalentAllowed: false, acceptedOptionIds: ['fact-correct'] },
    minimumAnswerRequirement: choiceMinimum(),
    calibrationAnswers: [
      calibration('fully_meets', 'fact-correct', 'fully_meets', rubricName, 'completed', 'eligible'),
      calibration('partially_meets', 'fact-surface', 'partially_meets', rubricName, 'partial', 'eligible_but_weak'),
      calibration('typical_error', 'fact-entity', 'does_not_meet', rubricName, 'missing', 'eligible'),
      calibration('reasonable_alternative', 'fact-correct', 'fully_meets', rubricName, 'completed', 'eligible'),
      calibration('irrelevant', '未作答', 'insufficient_evidence', rubricName, 'missing', 'ineligible'),
    ],
    evidencePotential: 'moderate',
    evidenceBoundary: { canObserve: '本次选择能否定位列车启动后的直接动作。', cannotConclude: '不能据此宣布信息提取能力已经稳定掌握。' },
    safetyBoundary: { taskRole: 'training_candidate', requiresHumanReview: true },
  };
}

function textPlanningCandidate(overrides: Record<string, unknown> = {}) {
  const rubricName = '送别表现概括';
  return {
    questionStem: '请概括父亲送别孩子时的表现。',
    questionDraft: { questionType: 'reading_comprehension', responseFormat: 'long_text' },
    primaryAbilityId: 'summarization',
    supportingAbilityIds: [],
    observationDimension: 'structure',
    observationFocus: { displayName: '送别表现概括', definition: '观察学生能否整合两段中的人物动作。' },
    materialAnchor: { anchorType: 'full_text' },
    expectedStudentAction: '整合两段动作并形成简洁概括。',
    designRationale: '观察跨段信息整合，不以单项判断替代文本组织。',
    difficultySuggestion: 'intermediate',
    assessmentMode: 'key_points',
    rubricDraft: [rubric(rubricName, 'summarization')],
    answerAcceptanceDraft: { acceptedKeywords: ['整理衣领', '向前走'], semanticEquivalentAllowed: true },
    minimumAnswerRequirement: { minLength: 12, requireTextEvidence: true, requireExplanation: false },
    calibrationAnswers: calibrationAnswers(rubricName),
    evidencePotential: 'moderate',
    evidenceBoundary: { canObserve: '本次概括是否覆盖两处主要动作。', cannotConclude: '不能据此宣布概括能力已经稳定掌握。' },
    safetyBoundary: { taskRole: 'training_candidate', requiresHumanReview: true },
    ...overrides,
  };
}

function choiceInteraction(): SingleChoiceInteraction {
  return {
    schemaVersion: SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION,
    selectionMode: 'single',
    options: [
      { optionId: 'option-correct', content: '舍不得孩子离开' },
      { optionId: 'option-surface', content: '担心衣领不够整齐' },
      { optionId: 'option-entity', content: '孩子不愿登上列车' },
      { optionId: 'option-over', content: '准备追赶已经开走的列车' },
    ],
    correctOptionIds: ['option-correct'],
    distractorRationales: [
      { optionId: 'option-surface', misconceptionCode: 'surface_reading', diagnosisMeaning: '只看到整理衣领的表面动作，忽略列车启动后仍向前走。', evidenceBoundary: '第1—2段父亲的连续动作。' },
      { optionId: 'option-entity', misconceptionCode: 'entity_confusion', diagnosisMeaning: '混淆人物对象，材料没有写孩子不愿登车。', evidenceBoundary: '材料动作主体始终是父亲。' },
      { optionId: 'option-over', misconceptionCode: 'over_inference', diagnosisMeaning: '把向前走过度推断为追赶列车，超过文本证据。', evidenceBoundary: '第2段只写向前走了几步。' },
    ],
    optionSetVersion: 1,
  };
}

function factChoiceInteraction(): SingleChoiceInteraction {
  return {
    schemaVersion: SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION,
    selectionMode: 'single',
    options: [
      { optionId: 'fact-correct', content: '仍向前走了几步' },
      { optionId: 'fact-surface', content: '继续整理孩子衣领' },
      { optionId: 'fact-entity', content: '跟着孩子登上列车' },
      { optionId: 'fact-sequence', content: '立即转身离开站台' },
    ],
    correctOptionIds: ['fact-correct'],
    distractorRationales: [
      { optionId: 'fact-surface', misconceptionCode: 'surface_reading', diagnosisMeaning: '停留在第一段动作，没有定位列车启动后的信息。', evidenceBoundary: '整理衣领发生在列车启动前。' },
      { optionId: 'fact-entity', misconceptionCode: 'entity_confusion', diagnosisMeaning: '混淆父亲与孩子的行动位置。', evidenceBoundary: '材料没有写父亲登上列车。' },
      { optionId: 'fact-sequence', misconceptionCode: 'evidence_omission', diagnosisMeaning: '忽略第二段明确动作，用没有出现的离开行为替代。', evidenceBoundary: '第二段明确写父亲仍向前走了几步。' },
    ],
    optionSetVersion: 1,
  };
}

function singleChoicePlanningContext() {
  return {
    currentEffectiveTaskCount: 3,
    currentSingleChoiceCount: 0,
    intendedSupplementTaskCount: 2,
    targetEffectiveTaskCount: 5,
    defaultSingleChoiceTarget: 2,
    maximumSingleChoiceCount: 3,
    targetSingleChoiceCount: 2,
    availableTaskCapacity: 3,
    requestedSupplementSingleChoiceCount: 2,
  };
}

function choiceEditableContent(): QuestionEditableFields {
  return {
    materialVersionId: 'material-stage2:v1',
    title: '人物心理判断',
    questionStem: '下列哪项最能说明父亲在列车启动后的心情？',
    questionType: 'multiple_choice',
    responseFormat: 'single_choice',
    choiceInteraction: choiceInteraction(),
    assessmentMode: 'exact_match',
    answerAcceptance: { acceptedOptionIds: ['option-correct'] },
    rubric: [rubricResource('人物心理判断', 'comprehension', 'rubric-choice')],
    minimumAnswerRequirement: choiceMinimum(),
    abilityMetadata: { abilityId: 'comprehension', supportingAbilityIds: [], prerequisiteAbilityIds: [], taskRole: 'training', difficulty: 'basic' },
    source: source(),
    tags: ['observation_task:stage2-choice', 'observation_dimension:character', 'reading'],
  };
}

function choiceMinimum() {
  return { responseFormat: 'single_choice' as const, minLength: 0 as const, requireTextEvidence: false as const, requireExplanation: false as const, minSelections: 1 as const, maxSelections: 1 as const };
}

function rubric(name: string, abilityId: string) {
  return { name, description: `准确完成${name}。`, abilityId, acceptedSignals: ['依据材料作出判断'] };
}

function rubricResource(name: string, abilityId: string, itemId: string) {
  return { itemId, name, description: `准确完成${name}。`, abilityId, importance: 'critical' as const, required: true, acceptedSignals: ['依据材料作出判断'] };
}

function calibrationAnswers(rubricName: string) {
  return [
    calibration('fully_meets', 'option-correct', 'fully_meets', rubricName, 'completed', 'eligible'),
    calibration('partially_meets', 'option-surface', 'partially_meets', rubricName, 'partial', 'eligible_but_weak'),
    calibration('typical_error', 'option-entity', 'does_not_meet', rubricName, 'missing', 'eligible'),
    calibration('reasonable_alternative', 'option-correct', 'fully_meets', rubricName, 'completed', 'eligible'),
    calibration('irrelevant', '未作答', 'insufficient_evidence', rubricName, 'missing', 'ineligible'),
  ];
}

function calibration(category: string, answerText: string, expectedAnswerStatus: string, rubricName: string, status: string, expectedEvidenceEligibility: string) {
  return { category, answerText, expectedAnswerStatus, expectedRubricCoverage: [{ rubricName, status }], expectedDiagnosisBoundary: '仅描述本次作答表现。', expectedEvidenceEligibility };
}

function source() {
  return { sourceType: 'ai_assisted' as const, description: '阶段2工程验收原创材料。', copyrightNote: '内部原创测试材料。' };
}
