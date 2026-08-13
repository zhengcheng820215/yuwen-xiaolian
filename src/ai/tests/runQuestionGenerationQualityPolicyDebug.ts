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
    questionStem: '请概括人物此时的心情。',
  });
  const evaluation = evaluateQuestionGenerationQuality({ candidate });
  assert.notEqual(evaluation.status, 'blocked', 'Three rubric items alone must not force long_text.');
  assert(evaluation.findings.some((item) => item.code === 'rubric_density_long_text_hint'));
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

console.log('Question generation quality policy debug passed (8 / 8).');

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
