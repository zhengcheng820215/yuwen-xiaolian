import type { AssessmentMode, QuestionMetadataRubricItem } from '../ai/schemas/diagnosis.schema';

export type QuestionConfig = {
  id: string;
  title: string;
  questionText: string;
  referenceAnswer: string;
  studentAnswer: string;
  questionType: string;
  assessmentMode: AssessmentMode;
  mainAbility: string;
  relatedAbilities: string[];
  abilityPath: string[];
  rubric: QuestionMetadataRubricItem[];
  trainingDirection?: string[];
};

export const questionConfigs: QuestionConfig[] = [
  {
    id: 'antonym_001',
    title: '反义词题',
    questionType: '反义词',
    assessmentMode: 'exact_match',
    mainAbility: '理解',
    questionText: '写出一对反义词。',
    referenceAnswer: '黑白、大小、胖瘦、长短',
    studentAnswer: '长短',
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
  },
  {
    id: 'summary_001',
    title: '概括题',
    questionType: '概括',
    assessmentMode: 'key_points',
    mainAbility: '概括',
    questionText: '请概括这段文字的主要内容。',
    referenceAnswer: '文章回忆父亲送“我”上学和等待“我”回家的经历，表现了父亲深沉而无言的爱。',
    studentAnswer: '父亲很辛苦，我很感动。',
    relatedAbilities: ['信息提取', '理解', '表达'],
    abilityPath: ['信息提取', '要点筛选', '事件概括', '主题提炼'],
    rubric: [
      {
        id: 'core_event',
        name: '核心事件',
        description: '是否概括父亲送我上学、等待我回家的主要经历',
        ability: '概括',
        weight: 40,
      },
      {
        id: 'theme_or_emotion',
        name: '情感主题',
        description: '是否提炼父亲深沉而无言的爱',
        ability: '理解',
        weight: 35,
      },
      {
        id: 'complete_expression',
        name: '表达完整',
        description: '是否用完整、简洁的语言概括主要内容',
        ability: '表达',
        weight: 25,
        required: false,
      },
    ],
    trainingDirection: ['核心事件提取训练', '主要内容概括训练', '主题提炼训练'],
  },
  {
    id: 'sentence_meaning_001',
    title: '句子含义题',
    questionType: '句子含义',
    assessmentMode: 'reasoning_chain',
    mainAbility: '理解',
    questionText: '请分析“照亮了父亲对我的牵挂”的含义。',
    referenceAnswer: '“照亮”不是指灯光真正照亮，而是指作者通过这盏灯感受到父亲一直以来的关爱和牵挂，表达了作者对父亲爱的理解和感动。',
    studentAnswer: '父亲用灯给我照亮回家的路。',
    relatedAbilities: ['信息提取', '表达'],
    abilityPath: ['字词含义理解', '语境分析', '深层含义理解', '情感体会'],
    rubric: [
      {
        id: 'literal_to_symbolic',
        name: '字面含义转换',
        description: '是否理解“照亮”不是实际灯光照亮，而具有象征意义',
        ability: '理解',
        weight: 35,
      },
      {
        id: 'context_relation',
        name: '语境联系',
        description: '是否结合父亲对作者的关爱理解句子',
        ability: '理解',
        weight: 25,
        required: false,
      },
      {
        id: 'emotional_understanding',
        name: '情感理解',
        description: '是否理解作者对父亲爱的感受和感动',
        ability: '理解',
        weight: 25,
      },
      {
        id: 'complete_expression',
        name: '表达完整',
        description: '是否完整说明句子含义和情感',
        ability: '表达',
        weight: 15,
        required: false,
      },
    ],
    trainingDirection: ['关键词深层含义理解训练', '语境分析训练', '情感体会训练'],
  },
  {
    id: 'inference_001',
    title: '推理题',
    questionType: '推理',
    assessmentMode: 'reasoning_chain',
    mainAbility: '推理',
    questionText: '从文中父亲反复整理旧书的行为，可以推断出他怎样的心理？',
    referenceAnswer: '可以推断父亲舍不得过去的生活，也珍惜与孩子共同读书的回忆，内心有不舍和牵挂。',
    studentAnswer: '父亲很喜欢书。',
    relatedAbilities: ['信息提取', '理解', '表达'],
    abilityPath: ['线索提取', '语境理解', '推理链建构', '结论表达'],
    rubric: [
      {
        id: 'clue_extraction',
        name: '文本线索',
        description: '是否提取反复整理旧书这一关键行为',
        ability: '信息提取',
        weight: 30,
      },
      {
        id: 'inference_chain',
        name: '推理链',
        description: '是否说明行为如何指向人物心理',
        ability: '推理',
        weight: 45,
      },
      {
        id: 'complete_expression',
        name: '表达完整',
        description: '是否完整表达推理结论',
        ability: '表达',
        weight: 25,
        required: false,
      },
    ],
    trainingDirection: ['文本线索提取训练', '推理链训练'],
  },
  {
    id: 'expression_001',
    title: '表达题',
    questionType: '表达',
    assessmentMode: 'expression_quality',
    mainAbility: '表达',
    questionText: '请结合文本，用完整的话说明这个人物给你留下的印象。',
    referenceAnswer: '这个人物勤劳、善良且有责任感。文中他主动帮助邻居修门，说明他热心；坚持照顾家人，表现出责任感。',
    studentAnswer: '他是一个好人，很负责。',
    relatedAbilities: ['信息提取', '理解', '分析'],
    abilityPath: ['观点明确', '文本依据', '表达完整'],
    rubric: [
      {
        id: 'answer_relevance',
        name: '观点明确',
        description: '是否明确说明人物特点',
        ability: '表达',
        weight: 30,
      },
      {
        id: 'text_evidence',
        name: '文本依据',
        description: '是否结合文本中的具体行为说明人物特点',
        ability: '信息提取',
        weight: 40,
      },
      {
        id: 'complete_expression',
        name: '表达完整',
        description: '是否用完整、有层次的语言表达',
        ability: '表达',
        weight: 30,
      },
    ],
    trainingDirection: ['观点表达训练', '文本依据组织训练'],
  },
];

export function getQuestionConfigById(id: string): QuestionConfig {
  return questionConfigs.find((config) => config.id === id) || questionConfigs[0];
}

export function toQuestionMetadata(config: QuestionConfig) {
  return {
    questionId: config.id,
    questionType: config.questionType,
    assessmentMode: config.assessmentMode,
    mainAbility: config.mainAbility,
    relatedAbilities: config.relatedAbilities,
    abilityPath: config.abilityPath,
    rubric: config.rubric,
    trainingDirection: config.trainingDirection,
  };
}
