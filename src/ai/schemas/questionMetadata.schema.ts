import type {
  AssessmentMode,
  QuestionMetadata,
  QuestionMetadataRubricItem,
} from './diagnosis.schema';

export type QuestionMetadataInput = {
  question: string;
  referenceAnswer: string;
};

export type QuestionMetadataResult = QuestionMetadata & {
  patternId?: string;
  questionType: string;
  assessmentMode: AssessmentMode;
  mainAbility: string;
  relatedAbilities: string[];
  abilityPath: string[];
  rubric: QuestionMetadataRubricItem[];
};

export type QuestionMetadataValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type QuestionMetadataAgentResult = {
  metadata: QuestionMetadataResult;
  matchedPattern: string;
  validation: QuestionMetadataValidationResult;
  confidence: number;
};

export const ASSESSMENT_MODES: AssessmentMode[] = [
  'exact_match',
  'key_points',
  'reasoning_chain',
  'expression_quality',
  'process_operation',
];

export const QUESTION_METADATA_REQUIRED_FIELDS: Array<keyof QuestionMetadataResult> = [
  'questionType',
  'assessmentMode',
  'mainAbility',
  'relatedAbilities',
  'abilityPath',
  'rubric',
];

export function isQuestionMetadataInput(value: unknown): value is QuestionMetadataInput {
  if (!value || typeof value !== 'object') return false;

  const input = value as QuestionMetadataInput;
  return (
    typeof input.question === 'string' &&
    input.question.trim().length > 0 &&
    typeof input.referenceAnswer === 'string' &&
    input.referenceAnswer.trim().length > 0
  );
}

export function normalizeQuestionMetadata(
  value: Partial<QuestionMetadataResult>,
): QuestionMetadataResult {
  return {
    patternId: value.patternId,
    questionId: value.questionId,
    subject: value.subject || '语文',
    grade: value.grade,
    questionType: value.questionType || '阅读简答',
    assessmentMode: ASSESSMENT_MODES.includes(value.assessmentMode as AssessmentMode)
      ? value.assessmentMode as AssessmentMode
      : 'reasoning_chain',
    mainAbility: value.mainAbility || '理解',
    relatedAbilities: Array.isArray(value.relatedAbilities) ? value.relatedAbilities : ['信息提取', '表达'],
    abilityPath: Array.isArray(value.abilityPath) ? value.abilityPath : ['信息提取', '理解', '表达'],
    difficulty: value.difficulty,
    knowledgePoint: value.knowledgePoint,
    answerAcceptance: value.answerAcceptance,
    rubric: Array.isArray(value.rubric) ? value.rubric : [],
    commonErrors: Array.isArray(value.commonErrors) ? value.commonErrors : [],
    trainingDirection: Array.isArray(value.trainingDirection) ? value.trainingDirection : [],
  };
}

export function validateQuestionMetadata(
  metadata: Partial<QuestionMetadataResult>,
): QuestionMetadataValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!metadata.questionType) errors.push('缺少 questionType。');
  if (!metadata.assessmentMode) errors.push('缺少 assessmentMode。');
  if (!metadata.mainAbility) errors.push('缺少 mainAbility。');
  if (!Array.isArray(metadata.abilityPath) || metadata.abilityPath.length === 0) {
    errors.push('缺少 abilityPath。');
  }
  if (!Array.isArray(metadata.rubric) || metadata.rubric.length === 0) {
    errors.push('缺少 rubric。');
  }

  if (
    metadata.questionType === '句子含义' &&
    metadata.assessmentMode &&
    metadata.assessmentMode !== 'reasoning_chain'
  ) {
    errors.push('句子含义题应使用 assessmentMode=reasoning_chain。');
  }

  if (metadata.questionType === '句子含义' && metadata.mainAbility === '推理') {
    errors.push('句子含义题 mainAbility 应优先为“理解”，不应默认为“推理”。');
  }

  if (
    metadata.questionType === '概括' &&
    metadata.assessmentMode &&
    metadata.assessmentMode !== 'key_points'
  ) {
    errors.push('概括题应使用 assessmentMode=key_points。');
  }

  if (
    metadata.questionType === '反义词' &&
    metadata.assessmentMode &&
    metadata.assessmentMode !== 'exact_match'
  ) {
    errors.push('反义词题应使用 assessmentMode=exact_match。');
  }

  if (
    metadata.questionType === '信息提取' &&
    metadata.mainAbility &&
    metadata.mainAbility !== '信息提取'
  ) {
    errors.push('信息提取题 mainAbility 应为“信息提取”。');
  }

  if (
    metadata.questionType === '人物形象分析' &&
    metadata.mainAbility &&
    metadata.mainAbility !== '分析'
  ) {
    errors.push('人物形象分析题 mainAbility 应为“分析”。');
  }

  if (
    metadata.questionType === '作用分析' &&
    metadata.mainAbility &&
    metadata.mainAbility !== '分析'
  ) {
    errors.push('作用分析题 mainAbility 应为“分析”。');
  }

  if (
    metadata.questionType === '表达效果' &&
    metadata.mainAbility &&
    metadata.mainAbility !== '分析'
  ) {
    errors.push('表达效果题 mainAbility 应为“分析”。');
  }

  if (
    metadata.questionType === '表达' &&
    metadata.assessmentMode &&
    metadata.assessmentMode !== 'expression_quality'
  ) {
    errors.push('表达题应使用 assessmentMode=expression_quality。');
  }

  if (metadata.questionType === '概括' && !hasRubricName(metadata.rubric, /事件|主题|主旨|情感/)) {
    warnings.push('概括题 rubric 建议包含核心事件和主题类观察点。');
  }

  if (
    metadata.questionType === '句子含义' &&
    !hasRubricName(metadata.rubric, /字面含义转换|语境联系|情感理解/)
  ) {
    warnings.push('句子含义题 rubric 建议包含字面含义转换、语境联系和情感理解。');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function hasRubricName(
  rubric: QuestionMetadataRubricItem[] | undefined,
  pattern: RegExp,
): boolean {
  return Array.isArray(rubric) && rubric.some((item) => pattern.test(item.name));
}
