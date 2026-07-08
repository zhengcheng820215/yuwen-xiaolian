import {
  type QuestionMetadataAgentResult,
  type QuestionMetadataInput,
  type QuestionMetadataResult,
  normalizeQuestionMetadata,
  validateQuestionMetadata,
} from '../schemas/questionMetadata.schema.ts';

export async function runQuestionMetadataAgent(
  input: QuestionMetadataInput,
): Promise<QuestionMetadataAgentResult> {
  const metadata = normalizeQuestionMetadata(mockGenerateQuestionMetadata(input));
  const validation = validateQuestionMetadata(metadata);

  return {
    metadata,
    validation,
    confidence: validation.valid ? inferConfidence(metadata.questionType) : 0.35,
  };
}

function mockGenerateQuestionMetadata(input: QuestionMetadataInput): Partial<QuestionMetadataResult> {
  const question = normalizeText(input.question);

  if (isExactMatchQuestion(question)) {
    return buildExactMatchMetadata();
  }

  if (isSummaryQuestion(question)) {
    return buildSummaryMetadata();
  }

  if (isSentenceMeaningQuestion(question)) {
    return buildSentenceMeaningMetadata();
  }

  return buildDefaultOpenResponseMetadata();
}

function buildExactMatchMetadata(): Partial<QuestionMetadataResult> {
  return {
    questionType: '反义词',
    assessmentMode: 'exact_match',
    mainAbility: '理解',
    relatedAbilities: ['词语理解', '关系判断', '表达'],
    abilityPath: ['词语理解', '关系判断'],
    rubric: [
      {
        name: '词义关系',
        description: '是否能够识别两个词语之间的相反关系',
        ability: '理解',
        weight: 70,
      },
      {
        name: '表达准确',
        description: '是否写出完整、准确的一组反义词',
        ability: '表达',
        weight: 30,
      },
    ],
    trainingDirection: ['词义辨析训练', '反义关系识别训练'],
  };
}

function buildSummaryMetadata(): Partial<QuestionMetadataResult> {
  return {
    questionType: '概括',
    assessmentMode: 'key_points',
    mainAbility: '概括',
    relatedAbilities: ['信息提取', '理解', '表达'],
    abilityPath: ['信息提取', '要点筛选', '事件概括', '主题提炼'],
    rubric: [
      {
        id: 'main_object',
        name: '主要对象',
        description: '是否说清文章主要写谁或什么对象',
        ability: '信息提取',
        weight: 20,
      },
      {
        id: 'core_event',
        name: '核心事件',
        description: '是否概括主要事件、经历或变化过程',
        ability: '概括',
        weight: 35,
      },
      {
        id: 'theme_or_emotion',
        name: '主题情感',
        description: '是否提炼文章主题、情感或中心意义',
        ability: '理解',
        weight: 30,
      },
      {
        id: 'complete_expression',
        name: '表达完整',
        description: '是否用完整、简洁的语言概括主要内容',
        ability: '表达',
        weight: 15,
        required: false,
      },
    ],
    trainingDirection: ['核心事件提取训练', '主要内容概括训练', '主题提炼训练'],
  };
}

function buildSentenceMeaningMetadata(): Partial<QuestionMetadataResult> {
  return {
    questionType: '句子含义',
    assessmentMode: 'reasoning_chain',
    mainAbility: '理解',
    relatedAbilities: ['信息提取', '表达'],
    abilityPath: ['字词含义理解', '语境分析', '深层含义理解', '情感体会'],
    rubric: [
      {
        id: 'literal_to_symbolic',
        name: '字面含义转换',
        description: '是否理解关键词不是停留在表层意思，而具有深层或象征意义',
        ability: '理解',
        weight: 35,
      },
      {
        id: 'context_relation',
        name: '语境联系',
        description: '是否结合上下文语境理解句子含义',
        ability: '理解',
        weight: 30,
        required: false,
      },
      {
        id: 'emotional_understanding',
        name: '情感理解',
        description: '是否理解句子背后的人物情感、态度或变化',
        ability: '理解',
        weight: 25,
      },
      {
        id: 'complete_expression',
        name: '表达完整',
        description: '是否完整说明句子含义和情感',
        ability: '表达',
        weight: 10,
        required: false,
      },
    ],
    trainingDirection: ['关键词深层含义理解训练', '语境分析训练', '情感体会训练'],
  };
}

function buildDefaultOpenResponseMetadata(): Partial<QuestionMetadataResult> {
  return {
    questionType: '阅读简答',
    assessmentMode: 'reasoning_chain',
    mainAbility: '理解',
    relatedAbilities: ['信息提取', '表达'],
    abilityPath: ['题意理解', '文本依据提取', '语境理解', '完整表达'],
    rubric: [
      {
        id: 'answer_relevance',
        name: '回应题意',
        description: '是否回应题目要求',
        ability: '理解',
        weight: 30,
      },
      {
        id: 'text_evidence',
        name: '文本依据',
        description: '是否结合文本依据说明答案',
        ability: '信息提取',
        weight: 35,
      },
      {
        id: 'complete_expression',
        name: '表达完整',
        description: '是否完整表达思考结果',
        ability: '表达',
        weight: 35,
      },
    ],
    trainingDirection: ['题意理解训练', '文本依据提取训练', '完整表达训练'],
  };
}

function isExactMatchQuestion(question: string): boolean {
  return /反义词|近义词|填空|默写|选择|选出|词语解释|解释词语|拼音|字音|字形/.test(question);
}

function isSummaryQuestion(question: string): boolean {
  return /概括|主要内容|段落大意|主旨|中心思想|写了什么/.test(question);
}

function isSentenceMeaningQuestion(question: string): boolean {
  return /句子.*含义|含义|如何理解|理解.*句|分析.*含义|赏析.*句/.test(question);
}

function inferConfidence(questionType: string): number {
  if (questionType === '反义词') return 0.86;
  if (questionType === '概括') return 0.82;
  if (questionType === '句子含义') return 0.82;
  return 0.62;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, '').trim();
}
