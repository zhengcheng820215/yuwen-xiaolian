import type { AssessmentMode, QuestionMetadataRubricItem } from '../schemas/diagnosis.schema';

export type QuestionMetadataPattern = {
  patternId: string;
  questionType: string;
  assessmentMode: AssessmentMode;
  mainAbility: string;
  relatedAbilities: string[];
  abilityPath: string[];
  rubric: QuestionMetadataRubricItem[];
  trainingDirection: string[];
  examples: string[];
  matchers: RegExp[];
  antiMatchers?: RegExp[];
  priority: number;
  confidence: number;
};

export const questionMetadataPatterns: QuestionMetadataPattern[] = [
  {
    patternId: 'expression_effect_v1',
    questionType: '表达效果',
    assessmentMode: 'reasoning_chain',
    mainAbility: '分析',
    relatedAbilities: ['信息提取', '理解', '表达'],
    abilityPath: ['表达对象识别', '表现手法分析', '效果说明', '情感主题联系'],
    rubric: [
      { id: 'expression_target', name: '表达对象', description: '是否明确要赏析的词句、描写或表达对象', ability: '理解', weight: 20 },
      { id: 'technique_identification', name: '表现手法', description: '是否识别修辞、描写、用词或表达方式', ability: '分析', weight: 30 },
      { id: 'effect_explanation', name: '效果说明', description: '是否说明该表达方式产生的具体表达效果', ability: '分析', weight: 30 },
      { id: 'theme_connection', name: '情感主题', description: '是否联系人物情感或文章主题说明表达意义', ability: '理解', weight: 20 },
    ],
    trainingDirection: ['表达对象识别训练', '表现手法分析训练', '表达效果说明训练'],
    examples: ['赏析画线句。', '说说这句话好在哪里。', '分析表达效果。', '这句话有什么妙处？'],
    matchers: [/赏析/, /表达效果/, /妙处/, /好在哪里/, /修辞|描写|用词|画线句|划线句/],
    antiMatchers: [/含义|如何理解|理解.*句|意思|言外之意/],
    priority: 95,
    confidence: 0.82,
  },
  {
    patternId: 'character_analysis_v1',
    questionType: '人物形象分析',
    assessmentMode: 'reasoning_chain',
    mainAbility: '分析',
    relatedAbilities: ['信息提取', '理解', '表达'],
    abilityPath: ['人物特点识别', '文本依据提取', '特点分析', '完整表达'],
    rubric: [
      { id: 'character_trait', name: '人物特点', description: '是否准确概括人物性格、品质或形象特点', ability: '分析', weight: 30 },
      { id: 'text_evidence', name: '文本依据', description: '是否结合人物语言、动作、事件等文本依据', ability: '信息提取', weight: 30 },
      { id: 'analysis_explanation', name: '分析说明', description: '是否说明文本依据如何体现人物特点', ability: '分析', weight: 25 },
      { id: 'complete_expression', name: '表达完整', description: '是否用完整、有层次的语言表达分析结论', ability: '表达', weight: 15 },
    ],
    trainingDirection: ['人物特点提炼训练', '文本依据组织训练', '人物形象分析训练'],
    examples: ['分析父亲形象。', '父亲是一个怎样的人？', '结合全文评价父亲。', '作者塑造了怎样的父亲？'],
    matchers: [/人物形象|形象/, /怎样的人|什么样的人/, /人物.*特点|特点/, /性格特点|品质特点|有哪些.*特点/, /评价.*(父亲|母亲|人物|他|她)/, /塑造.*(父亲|母亲|人物|他|她)/],
    antiMatchers: [/表达效果|作用|含义|概括/],
    priority: 90,
    confidence: 0.82,
  },
  {
    patternId: 'function_analysis_v1',
    questionType: '作用分析',
    assessmentMode: 'reasoning_chain',
    mainAbility: '分析',
    relatedAbilities: ['信息提取', '理解', '表达'],
    abilityPath: ['分析对象识别', '文本依据提取', '作用说明', '主题结构联系'],
    rubric: [
      { id: 'analysis_target', name: '分析对象', description: '是否明确题目要求分析的词语、物象、情节或段落', ability: '理解', weight: 20 },
      { id: 'text_evidence', name: '文本依据', description: '是否结合文本中的具体内容说明作用', ability: '信息提取', weight: 25 },
      { id: 'function_explanation', name: '作用说明', description: '是否说明该内容在情节、人物、结构或主题上的作用', ability: '分析', weight: 35 },
      { id: 'theme_connection', name: '主题联系', description: '是否联系文章主题、情感或结构深化分析', ability: '理解', weight: 20 },
    ],
    trainingDirection: ['分析对象定位训练', '作用维度拆解训练', '主题结构联系训练'],
    examples: ['文中多次写“旧自行车”有什么作用？', '这一段在文中有什么作用？', '作者为什么反复写这盏灯？'],
    matchers: [/有什么作用|作用是什么|有何作用/, /为什么.*(写|反复写|安排)/, /好处|用意/, /铺垫|照应|线索|推动情节/],
    priority: 86,
    confidence: 0.8,
  },
  {
    patternId: 'sentence_meaning_v1',
    questionType: '句子含义',
    assessmentMode: 'reasoning_chain',
    mainAbility: '理解',
    relatedAbilities: ['信息提取', '表达'],
    abilityPath: ['字词含义理解', '语境分析', '深层含义理解', '情感体会'],
    rubric: [
      { id: 'literal_to_symbolic', name: '字面含义转换', description: '是否理解关键词不是停留在表层意思，而具有深层或象征意义', ability: '理解', weight: 35 },
      { id: 'context_relation', name: '语境联系', description: '是否结合上下文语境理解句子含义', ability: '理解', weight: 30, required: false },
      { id: 'emotional_understanding', name: '情感理解', description: '是否理解句子背后的人物情感、态度或变化', ability: '理解', weight: 25 },
      { id: 'complete_expression', name: '表达完整', description: '是否完整说明句子含义和情感', ability: '表达', weight: 10, required: false },
    ],
    trainingDirection: ['关键词深层含义理解训练', '语境分析训练', '情感体会训练'],
    examples: ['请分析“照亮了父亲对我的牵挂”的含义。', '如何理解文中这句话？', '说说这句话的深层含义。'],
    matchers: [/句子.*含义|含义/, /如何理解|理解.*句/, /深层含义|言外之意/, /分析.*含义/, /对.*(这句|这句话|某句).*理解/],
    antiMatchers: [/表达效果|作用|人物形象|概括/],
    priority: 84,
    confidence: 0.82,
  },
  {
    patternId: 'inference_v1',
    questionType: '推理',
    assessmentMode: 'reasoning_chain',
    mainAbility: '推理',
    relatedAbilities: ['信息提取', '理解', '表达'],
    abilityPath: ['线索提取', '语境理解', '推理链建构', '结论表达'],
    rubric: [
      { id: 'clue_extraction', name: '文本线索', description: '是否提取支持推断的关键文本线索', ability: '信息提取', weight: 30 },
      { id: 'context_understanding', name: '语境理解', description: '是否理解线索所在语境和人物处境', ability: '理解', weight: 20 },
      { id: 'inference_chain', name: '推理链', description: '是否说明线索如何支持推断结论', ability: '推理', weight: 35 },
      { id: 'complete_expression', name: '结论表达', description: '是否完整表达合理推断结论', ability: '表达', weight: 15 },
    ],
    trainingDirection: ['文本线索提取训练', '推理链训练', '结论表达训练'],
    examples: ['可以推断出他怎样的心理？', '从这个行为可以看出什么？', '推测人物这样做的原因。'],
    matchers: [/推断|推测|可以看出|看出/, /怎样的心理|什么心理/, /行为.*原因|这样做.*原因/, /暗示|说明了什么/],
    antiMatchers: [/含义|概括|作用|表达效果/],
    priority: 80,
    confidence: 0.8,
  },
  {
    patternId: 'summary_v1',
    questionType: '概括',
    assessmentMode: 'key_points',
    mainAbility: '概括',
    relatedAbilities: ['信息提取', '理解', '表达'],
    abilityPath: ['信息提取', '要点筛选', '事件概括', '主题提炼'],
    rubric: [
      { id: 'main_object', name: '主要对象', description: '是否说清文章主要写谁或什么对象', ability: '信息提取', weight: 20 },
      { id: 'core_event', name: '核心事件', description: '是否概括主要事件、经历或变化过程', ability: '概括', weight: 35 },
      { id: 'theme_or_emotion', name: '主题情感', description: '是否提炼文章主题、情感或中心意义', ability: '理解', weight: 30 },
      { id: 'complete_expression', name: '表达完整', description: '是否用完整、简洁的语言概括主要内容', ability: '表达', weight: 15, required: false },
    ],
    trainingDirection: ['核心事件提取训练', '主要内容概括训练', '主题提炼训练'],
    examples: ['请概括文章主要内容。', '概括选文主要写了什么。', '请概括这一段的大意。'],
    matchers: [/概括|概述|简要概括/, /主要内容|主要写了什么|写了什么/, /段落大意|段意/, /主旨|中心思想/],
    antiMatchers: [/找出|哪些|哪几|含义|作用|表达效果/],
    priority: 72,
    confidence: 0.82,
  },
  {
    patternId: 'information_extraction_v1',
    questionType: '信息提取',
    assessmentMode: 'key_points',
    mainAbility: '信息提取',
    relatedAbilities: ['理解', '表达'],
    abilityPath: ['题干限定识别', '关键文本定位', '完整要点提取', '清晰表达'],
    rubric: [
      { id: 'task_scope', name: '题干限定', description: '是否识别题目中的范围、数量和限定条件', ability: '理解', weight: 25 },
      { id: 'key_text', name: '关键文本', description: '是否定位原文中的关键句或关键词', ability: '信息提取', weight: 35 },
      { id: 'complete_points', name: '完整要点', description: '是否完整提取题目要求的全部信息点', ability: '信息提取', weight: 30 },
      { id: 'clear_expression', name: '表达清晰', description: '是否清晰呈现提取结果', ability: '表达', weight: 10, required: false },
    ],
    trainingDirection: ['题干限定识别训练', '关键词定位训练', '完整要点提取训练'],
    examples: ['根据原文，找出母亲改变主意的两个原因。', '文中写了哪几件事？', '从文中找出相关句子。'],
    matchers: [/根据原文|结合原文|从文中|文中/, /找出|找一找|圈出|摘录/, /哪几|哪些|几个|两个|三点/, /原因|表现|依据/],
    antiMatchers: [/含义|表达效果|作用|人物形象/, /写一段|写几句|表达.*看法|联系生活|谈谈|仿写/],
    priority: 70,
    confidence: 0.8,
  },
  {
    patternId: 'expression_task_v1',
    questionType: '表达',
    assessmentMode: 'expression_quality',
    mainAbility: '表达',
    relatedAbilities: ['理解', '分析'],
    abilityPath: ['题意理解', '观点形成', '语言组织', '完整表达'],
    rubric: [
      { id: 'task_relevance', name: '回应任务', description: '是否回应题目要求和表达任务', ability: '理解', weight: 25 },
      { id: 'clear_viewpoint', name: '观点明确', description: '是否表达明确观点、态度或想法', ability: '表达', weight: 25 },
      { id: 'language_organization', name: '语言组织', description: '是否语言通顺、结构清楚', ability: '表达', weight: 30 },
      { id: 'content_support', name: '内容支撑', description: '是否结合文本、生活或合理内容支撑表达', ability: '分析', weight: 20, required: false },
    ],
    trainingDirection: ['观点表达训练', '语言组织训练', '完整表达训练'],
    examples: ['请仿写一句话。', '联系生活谈谈你的感受。', '请写一段话表达你的看法。', '请谈谈你是否赞同并说明理由。'],
    matchers: [/仿写|改写|扩写|续写/, /写一段|写几句|表达你的看法/, /联系生活|谈谈感受|谈感受|启示/, /你的理解和体会/, /是否赞同|赞同.*理由|说明理由|谈谈.*看法/],
    priority: 76,
    confidence: 0.78,
  },
  {
    patternId: 'exact_match_antonym_v1',
    questionType: '反义词',
    assessmentMode: 'exact_match',
    mainAbility: '理解',
    relatedAbilities: ['词语理解', '关系判断', '表达'],
    abilityPath: ['词语理解', '关系判断'],
    rubric: [
      { id: 'word_relation', name: '词义关系', description: '是否能够识别两个词语之间的相反关系', ability: '理解', weight: 70 },
      { id: 'accurate_expression', name: '表达准确', description: '是否写出完整、准确的一组反义词', ability: '表达', weight: 30 },
    ],
    trainingDirection: ['词义辨析训练', '反义关系识别训练'],
    examples: ['写出一对反义词。'],
    matchers: [/反义词|近义词|词语解释|解释词语|填空|默写|选择|选出|拼音|字音|字形/],
    priority: 60,
    confidence: 0.86,
  },
];

export function matchQuestionMetadataPattern(question: string): QuestionMetadataPattern {
  const normalizedQuestion = normalizeText(question);
  const scoredPatterns = questionMetadataPatterns
    .map((pattern) => ({
      pattern,
      score: scorePattern(pattern, normalizedQuestion),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.pattern.priority - a.pattern.priority);

  return scoredPatterns[0]?.pattern || defaultReadingPattern;
}

export const defaultReadingPattern: QuestionMetadataPattern = {
  patternId: 'default_reading_response_v1',
  questionType: '阅读简答',
  assessmentMode: 'reasoning_chain',
  mainAbility: '理解',
  relatedAbilities: ['信息提取', '表达'],
  abilityPath: ['题意理解', '文本依据提取', '语境理解', '完整表达'],
  rubric: [
    { id: 'answer_relevance', name: '回应题意', description: '是否回应题目要求', ability: '理解', weight: 30 },
    { id: 'text_evidence', name: '文本依据', description: '是否结合文本依据说明答案', ability: '信息提取', weight: 35 },
    { id: 'complete_expression', name: '表达完整', description: '是否完整表达思考结果', ability: '表达', weight: 35 },
  ],
  trainingDirection: ['题意理解训练', '文本依据提取训练', '完整表达训练'],
  examples: ['阅读后回答问题。'],
  matchers: [],
  priority: 0,
  confidence: 0.62,
};

function scorePattern(pattern: QuestionMetadataPattern, question: string): number {
  if (pattern.antiMatchers?.some((matcher) => matcher.test(question))) return 0;

  const matchedCount = pattern.matchers.filter((matcher) => matcher.test(question)).length;

  if (matchedCount === 0) return 0;

  return matchedCount * 10 + pattern.priority / 100;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, '').trim();
}
