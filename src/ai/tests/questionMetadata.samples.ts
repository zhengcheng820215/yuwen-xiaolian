export type QuestionMetadataSample = {
  id: string;
  title: string;
  question: string;
  referenceAnswer: string;
  expectedQuestionType: string;
  expectedAssessmentMode: string;
  expectedMainAbility: string;
  expectedRubricKeywords: string[];
};

export const questionMetadataSamples: QuestionMetadataSample[] = [
  {
    id: 'metadata_antonym_001',
    title: '反义词题 metadata',
    question: '写出一对反义词。',
    referenceAnswer: '黑白、大小、胖瘦、长短',
    expectedQuestionType: '反义词',
    expectedAssessmentMode: 'exact_match',
    expectedMainAbility: '理解',
    expectedRubricKeywords: ['词义关系'],
  },
  {
    id: 'metadata_summary_001',
    title: '概括题 metadata',
    question: '请概括文章主要内容。',
    referenceAnswer: '文章回忆父亲送“我”上学和等待“我”回家的经历，表现了父亲深沉而无言的爱。',
    expectedQuestionType: '概括',
    expectedAssessmentMode: 'key_points',
    expectedMainAbility: '概括',
    expectedRubricKeywords: ['核心事件', '主题'],
  },
  {
    id: 'metadata_sentence_meaning_001',
    title: '句子含义题 metadata',
    question: '请分析“照亮了父亲对我的牵挂”的含义。',
    referenceAnswer: '“照亮”不是指灯光真正照亮，而是指作者通过这盏灯感受到父亲一直以来的关爱和牵挂，表达了作者对父亲爱的理解和感动。',
    expectedQuestionType: '句子含义',
    expectedAssessmentMode: 'reasoning_chain',
    expectedMainAbility: '理解',
    expectedRubricKeywords: ['字面含义转换', '语境联系', '情感理解'],
  },
];
