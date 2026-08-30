import type { KnowledgeQuestionCategory } from '../questions/knowledgeQuestionTypes.ts';
import type { PracticeMode } from '../practice/practiceSessionTypes.ts';

export const PRACTICE_RESULT_SCHEMA_VERSION = 1 as const;
export const PRACTICE_RESULT_RESPONSE_CAP_MS = 10 * 60 * 1000;

export type KnowledgePointResultLevel =
  | 'insufficient_evidence'
  | 'steady_this_round'
  | 'reinforce_this_round'
  | 'prioritize_this_round';

export type BasePerformanceSummary = {
  questionCount: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  firstAttemptAccuracy: number;
};

export type ReinforcementPerformanceSummary = {
  scheduledCount: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
};

export type PracticeTimingSummary = {
  perResponseCapMs: number;
  rawDurationMs: number;
  effectiveDurationMs: number;
  baseEffectiveDurationMs: number;
  reinforcementEffectiveDurationMs: number;
  cappedResponseCount: number;
};

export type KnowledgePointResultSummary = {
  knowledgePoint: string;
  category?: KnowledgeQuestionCategory;
  baseQuestionCount: number;
  correctCount: number;
  incorrectCount: number;
  firstOccurrenceIndex: number;
  level: KnowledgePointResultLevel;
  studentMessage: string;
};

export type MisconceptionResultSummary = {
  code: string;
  studentMessage: string;
  occurrenceCount: number;
  questionIds: string[];
  firstOccurrenceIndex: number;
};

export type PracticeWrongItemSummary = {
  questionId: string;
  questionContentVersion: number;
  category?: KnowledgeQuestionCategory;
  knowledgePoint: string;
  stemSnapshot: string;
  submittedAnswerText: string;
  correctAnswerText: string;
  keyEvidence: string;
  hasStructuredMisconception: boolean;
  occurrenceIndex: number;
};

export type PracticeRecommendationType =
  | 'retry_wrong_items'
  | 'start_category_practice'
  | 'start_mixed_practice'
  | 'return_to_learning';

export type PracticeRecommendation = {
  type: PracticeRecommendationType;
  title: string;
  reason: string;
  targetPath: string;
  sourceKnowledgePoint?: string;
  category?: KnowledgeQuestionCategory;
  targetCount?: number;
  sourceQuestionIds?: string[];
  availability: 'available' | 'fallback';
};

export type PracticeResult = {
  schemaVersion: 1;
  resultId: string;
  sourceSessionId: string;
  mode: PracticeMode;
  category?: KnowledgeQuestionCategory;
  completedAt: string;
  basePerformance: BasePerformanceSummary;
  reinforcementPerformance: ReinforcementPerformanceSummary;
  timing: PracticeTimingSummary;
  knowledgePoints: KnowledgePointResultSummary[];
  misconceptions: MisconceptionResultSummary[];
  wrongItems: PracticeWrongItemSummary[];
  recommendation: PracticeRecommendation;
  statementBoundary: 'current_round_only';
};
