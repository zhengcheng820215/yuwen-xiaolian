import assert from 'node:assert/strict';
import {
  analyzeQuestionPortfolioGradient,
  compareQuestionObservationValue,
  evaluateQuestionGenerationQuality,
} from '../agents/questionGenerationQualityPolicyAgent.ts';
import {
  calculateQuestionEditableFieldsHash,
  type QuestionEditableFields,
} from '../schemas/workingTaskContent.schema.ts';

const base = fixture();

{
  const candidate = fixture({
    rubric: [rubric('观点'), rubric('依据'), rubric('解释')],
    responseFormat: 'short_text',
    questionStem: '请结合材料概括人物此时的心情，并说明相关文本依据。',
  });
  const evaluation = evaluateQuestionGenerationQuality({ candidate });
  assert.notEqual(
    evaluation.status,
    'blocked',
    `Three rubric items alone must not force long_text: ${JSON.stringify(evaluation.findings)}`,
  );
  assert(evaluation.findings.some((item) => item.code === 'rubric_density_long_text_hint'));
}

{
  const candidate = fixture({
    questionStem: '请结合第2段的具体描写，说说作者是如何表现“刚睡醒”的特点的。',
    rubric: [rubric('提取具体描写'), rubric('分析共同特点'), rubric('说明总起与分述关系')],
  });
  const evaluation = evaluateQuestionGenerationQuality({ candidate });
  assert.equal(evaluation.status, 'blocked');
  assert(evaluation.blockerCodes.includes('rubric_requirement_not_in_stem'));
}

{
  const candidate = fixture({
    questionStem: '请结合第2段的具体描写，说明“一切都像刚睡醒”与后面分述景物之间的结构关系。',
    rubric: [rubric('提取具体描写'), rubric('说明总起与分述关系')],
  });
  assert(!evaluateQuestionGenerationQuality({ candidate }).blockerCodes.includes('rubric_requirement_not_in_stem'));
}

{
  const candidate = fixture({
    questionStem: '“一切都像刚睡醒”是总起句，后面三句是分述。请结合三处描写分析春天刚醒的状态。',
    rubric: [rubric('提取具体描写'), rubric('说明总起与分述关系')],
  });
  assert(
    evaluateQuestionGenerationQuality({ candidate }).blockerCodes.includes('rubric_requirement_not_in_stem'),
    'Merely naming total/detail structure must not replace an explicit structural action.',
  );
}

{
  const candidate = fixture({
    questionStem: '文章第3段和第4段都描写了济南的山。请分别概括两段中山的特点，并说明作者这样安排有什么作用。',
    rubric: [rubric('段落概括'), rubric('结构分析')],
  });
  assert(
    !evaluateQuestionGenerationQuality({ candidate }).blockerCodes.includes('rubric_requirement_not_in_stem'),
    'A scoped paragraph-and-arrangement prompt must satisfy evidence and structural alignment.',
  );
}

{
  const candidate = fixture({
    questionStem: '诗中多次使用“定然”“定能够”等词语，请结合诗句分析这些词语的表达效果。',
    rubric: [rubric('找出关键词语'), rubric('分析表达效果'), rubric('结合主题')],
  });
  assert(
    !evaluateQuestionGenerationQuality({ candidate }).blockerCodes.includes('rubric_requirement_not_in_stem'),
    'Expected theme content under an expression-effect action must not be mistaken for a hidden task.',
  );
}

{
  const candidate = fixture({
    responseFormat: 'short_text',
    questionStem: '请结合全文，从人物心理和所处环境两个角度，比较前后变化并分析原因与作用。',
    rubric: [rubric('心理'), rubric('环境'), rubric('变化'), rubric('作用')],
  });
  const evaluation = evaluateQuestionGenerationQuality({ candidate });
  assert.equal(evaluation.status, 'blocked');
  assert(evaluation.blockerCodes.includes('response_format_underloaded'));
}

{
  const candidate = fixture({
    responseFormat: 'long_text',
    questionStem: '请结合全文，从人物心理和所处环境两个角度，比较前后变化并分析原因与作用。',
    rubric: [rubric('心理'), rubric('环境'), rubric('变化'), rubric('作用')],
  });
  assert.notEqual(evaluateQuestionGenerationQuality({ candidate }).status, 'blocked');
}

{
  const retest = fixture({
    abilityMetadata: { ...base.abilityMetadata, taskRole: 'retest' },
    tags: ['observation_task:task-retest'],
  });
  const comparison = compareQuestionObservationValue(retest, base);
  assert.equal(comparison.substantiveDuplicate, true);
  const evaluation = evaluateQuestionGenerationQuality({ candidate: retest, peerQuestions: [base] });
  assert(evaluation.blockerCodes.includes('substantive_duplicate'), 'Task role must not bypass duplicate checks.');
}

{
  const transfer = fixture({
    questionStem: '第6段的环境描写营造了怎样的氛围？请指出一个词语并说明效果。',
    title: '环境氛围分析',
    rubric: [rubric('环境词语'), rubric('氛围效果')],
    abilityMetadata: { ...base.abilityMetadata, taskRole: 'transfer' },
    tags: ['paragraph:6-6', 'observation_task:task-transfer'],
  });
  assert.equal(compareQuestionObservationValue(transfer, base).substantiveDuplicate, false);
}

{
  const incomplete = fixture({ questionStem: '', tags: [] });
  assert(evaluateQuestionGenerationQuality({ candidate: incomplete }).blockerCodes.includes('candidate_incomplete'));
}

{
  const candidate = choiceFixture({
    rubric: [{
      ...choiceFixture().rubric[0],
      evidenceRequirement: { requireTextEvidence: true, requireExplanation: true },
    }],
  });
  const evaluation = evaluateQuestionGenerationQuality({ candidate });
  assert(evaluation.blockerCodes.includes('choice_rubric_open_response_not_allowed'));
}

{
  const candidate = choiceFixture();
  const evaluation = evaluateQuestionGenerationQuality({ candidate });
  assert(!evaluation.blockerCodes.includes('rubric_requirement_not_in_stem'));
  assert(!evaluation.blockerCodes.includes('choice_rubric_open_response_not_allowed'));
}

{
  const evaluation = evaluateQuestionGenerationQuality({
    candidate: base,
    baseContentHash: calculateQuestionEditableFieldsHash(base),
  });
  assert(evaluation.blockerCodes.includes('candidate_unchanged'));
}

{
  const portfolio = analyzeQuestionPortfolioGradient([
    base,
    fixture({ questionStem: '请概括情节。', tags: ['observation_task:2'] }),
    fixture({ questionStem: '请分析句子。', tags: ['observation_task:3'] }),
  ]);
  assert(portfolio.findings.length > 0);
  assert(portfolio.findings.every((item) => item.severity === 'advisory'));
}

console.log('Question generation quality policy debug passed (15 / 15).');

function rubric(name: string): QuestionEditableFields['rubric'][number] {
  return {
    itemId: `rubric-${name}`,
    name,
    description: `说明${name}`,
    abilityId: 'analysis',
    importance: 'critical',
    required: true,
    evidenceRequirement: { requireTextEvidence: true, requireExplanation: true },
    acceptedSignals: [name],
  };
}

function fixture(overrides: Partial<QuestionEditableFields> = {}): QuestionEditableFields {
  return {
    materialVersionId: 'material:v1',
    title: '人物沉默的原因',
    questionStem: '请结合第2段，分析人物选择沉默的原因。',
    questionType: 'reading_comprehension',
    responseFormat: 'short_text',
    options: [],
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: ['处境', '压力'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim'],
    },
    rubric: [rubric('人物处境'), rubric('沉默原因')],
    minimumAnswerRequirement: {
      minLength: 30,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: 'analysis',
      supportingAbilityIds: [],
      prerequisiteAbilityIds: [],
      taskRole: 'training',
      difficulty: 'intermediate',
    },
    source: { sourceType: 'ai_assisted', description: 'quality fixture' },
    tags: ['paragraph:2-2', 'observation_task:task-training'],
    ...overrides,
  };
}

function choiceFixture(overrides: Partial<QuestionEditableFields> = {}): QuestionEditableFields {
  return {
    materialVersionId: 'material:v1',
    title: '人物行为的基础理解',
    questionStem: '人物此时选择沉默的直接原因是（）。',
    questionType: 'multiple_choice',
    responseFormat: 'single_choice',
    choiceInteraction: {
      schemaVersion: 'single-choice-interaction-v1',
      selectionMode: 'single',
      options: [
        { optionId: 'option-1', content: '他受到现实处境的压力。' },
        { optionId: 'option-2', content: '他没有听见对方的问题。' },
        { optionId: 'option-3', content: '他准备马上离开现场。' },
        { optionId: 'option-4', content: '他完全忘记了此前发生的事。' },
      ],
      correctOptionIds: ['option-1'],
      distractorRationales: [
        { optionId: 'option-2', misconceptionCode: 'surface_reading', diagnosisMeaning: '忽略人物处境。', evidenceBoundary: '第2段写到人物承受压力。' },
        { optionId: 'option-3', misconceptionCode: 'over_inference', diagnosisMeaning: '推断超过文本。', evidenceBoundary: '文本没有写人物马上离开。' },
        { optionId: 'option-4', misconceptionCode: 'entity_confusion', diagnosisMeaning: '混淆沉默与遗忘。', evidenceBoundary: '人物记得此前发生的事。' },
      ],
      optionSetVersion: 1,
    },
    assessmentMode: 'exact_match',
    answerAcceptance: { acceptedOptionIds: ['option-1'] },
    rubric: [{
      itemId: 'rubric-choice-judgment',
      name: '识别直接原因',
      description: '根据人物处境判断其沉默原因。',
      abilityId: 'comprehension',
      importance: 'critical',
      required: true,
      evidenceRequirement: {
        requireTextEvidence: false,
        requireExplanation: false,
        requireConclusion: false,
      },
      acceptedSignals: ['option-1'],
    }],
    minimumAnswerRequirement: {
      responseFormat: 'single_choice',
      minLength: 0,
      requireTextEvidence: false,
      requireExplanation: false,
      minSelections: 1,
      maxSelections: 1,
    },
    abilityMetadata: {
      abilityId: 'comprehension',
      supportingAbilityIds: [],
      prerequisiteAbilityIds: [],
      taskRole: 'training',
      difficulty: 'basic',
    },
    source: { sourceType: 'ai_assisted', description: 'quality choice fixture' },
    tags: ['paragraph:2-2', 'observation_task:task-choice', 'observation_dimension:factual'],
    ...overrides,
  };
}
