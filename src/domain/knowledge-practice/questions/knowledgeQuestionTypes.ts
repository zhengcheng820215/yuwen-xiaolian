export const KNOWLEDGE_QUESTION_CATEGORIES = [
  '字音字形',
  '成语运用',
  '病句辨析与修改',
  '标点符号',
  '文学文化常识',
  '古诗文默写与理解',
  '文言实词虚词',
  '作家作品与课文背景',
] as const;

export const KNOWLEDGE_QUESTION_TYPES = ['single_choice', 'true_false', 'fill_blank'] as const;
export const KNOWLEDGE_QUESTION_STATUSES = ['draft', 'approved', 'retired'] as const;
export const ANSWER_NORMALIZATION_RULES = [
  'trim',
  'collapse_whitespace',
  'normalize_fullwidth_space',
  'ignore_terminal_punctuation',
] as const;

export type KnowledgeQuestionCategory = typeof KNOWLEDGE_QUESTION_CATEGORIES[number];
export type KnowledgeQuestionType = typeof KNOWLEDGE_QUESTION_TYPES[number];
export type KnowledgeQuestionContentStatus = typeof KNOWLEDGE_QUESTION_STATUSES[number];
export type KnowledgeQuestionDifficulty = 1 | 2 | 3;
export type AnswerNormalizationRule = typeof ANSWER_NORMALIZATION_RULES[number];

export type KnowledgeQuestionOption = {
  id: string;
  text: string;
};

export type KnowledgeQuestionMisconception = {
  code: string;
  studentMessage: string;
};

export type KnowledgeQuestion = {
  id: string;
  contentVersion: number;
  contentStatus: KnowledgeQuestionContentStatus;
  grade: string;
  semester: string;
  category: KnowledgeQuestionCategory;
  subCategory: string;
  knowledgePoint: string;
  examPoint: string;
  difficulty: KnowledgeQuestionDifficulty;
  type: KnowledgeQuestionType;
  stem: string;
  options?: KnowledgeQuestionOption[];
  correctAnswer: string;
  acceptedAnswers?: string[];
  answerNormalization?: AnswerNormalizationRule[];
  explanation: string;
  answerAnalysis?: Record<string, string>;
  misconceptionByAnswer?: Record<string, KnowledgeQuestionMisconception>;
  solutionSteps: string[];
  sourceText: string;
  variantGroupId?: string;
  reviewedAt?: string;
  reviewNote?: string;
};

export type KnowledgeQuestionDataset = {
  schemaVersion: 1;
  datasetId: 'knowledge-practice-grade7-semester1';
  grade: '七年级';
  semester: '上';
  updatedAt: string;
  questions: KnowledgeQuestion[];
};

export type LegacyKnowledgeQuestion = {
  id: string;
  category: string;
  subCategory?: string;
  type: string;
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
  knowledgePoint?: string;
  examPoint?: string;
  sourceText?: string;
  grade?: string;
  term?: string;
  difficulty?: string;
};

export type KnowledgeQuestionQuery = {
  grade?: string;
  semester?: string;
  category?: KnowledgeQuestionCategory;
  type?: KnowledgeQuestionType;
  status?: KnowledgeQuestionContentStatus;
  ids?: string[];
};

export interface KnowledgeQuestionRepository {
  listApproved(query?: Omit<KnowledgeQuestionQuery, 'status'>): KnowledgeQuestion[];
  listForContentReview(query?: KnowledgeQuestionQuery): KnowledgeQuestion[];
  getApprovedById(id: string): KnowledgeQuestion | undefined;
  getByIdForContentReview(id: string): KnowledgeQuestion | undefined;
}
