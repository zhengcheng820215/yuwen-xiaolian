import type { KnowledgeQuestionCategory } from '../questions/knowledgeQuestionTypes.ts';

export type PracticeMode = 'category' | 'mixed' | 'mistake_review';
export type PracticeSessionStatus = 'active' | 'completed' | 'abandoned';
export type PracticeQueueItemRole = 'base' | 'reinforcement';
export type PracticeQueueItemStatus = 'pending' | 'answered';

export type PracticeSelectionRelaxationCode =
  | 'candidate_shortage'
  | 'recent_second_session_reused'
  | 'recent_latest_session_reused'
  | 'difficulty_quota_relaxed'
  | 'category_coverage_relaxed'
  | 'category_cap_relaxed'
  | 'variant_group_relaxed';

export type PracticeQueueItem = {
  id: string;
  questionId: string;
  questionContentVersion: number;
  role: PracticeQueueItemRole;
  sourceQuestionId?: string;
  status: PracticeQueueItemStatus;
};

export type PracticeSelectionSummary = {
  candidateCount: number;
  selectedCount: number;
  targetCount: number;
  categoryCounts: Record<string, number>;
  difficultyCounts: Record<'1' | '2' | '3', number>;
  recentQuestionCount: number;
  reusedRecentQuestionCount: number;
  relaxationCodes: PracticeSelectionRelaxationCode[];
};

export type PracticeSession = {
  schemaVersion: 1;
  id: string;
  mode: PracticeMode;
  category?: KnowledgeQuestionCategory;
  seed: string;
  targetBaseQuestionCount: number;
  actualBaseQuestionCount: number;
  baseQuestionIds: string[];
  queue: PracticeQueueItem[];
  currentIndex: number;
  status: PracticeSessionStatus;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  abandonedAt?: string;
  selectionSummary: PracticeSelectionSummary;
};

export type CompletedPracticeSessionSummary = {
  sessionId: string;
  completedAt: string;
  baseQuestionIds: string[];
};

export type PracticeSessionBuildErrorCode =
  | 'invalid_mode'
  | 'category_required'
  | 'category_not_allowed_for_mixed'
  | 'target_count_invalid'
  | 'no_approved_questions'
  | 'no_questions_for_category'
  | 'no_questions_for_mistake_review'
  | 'session_identity_failed';

export type PracticeSessionBuildError = {
  code: PracticeSessionBuildErrorCode;
  studentMessage: string;
  details?: Record<string, unknown>;
};
