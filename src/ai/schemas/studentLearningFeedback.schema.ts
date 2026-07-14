import type { StudentLearningEntryState } from './studentLearningEntry.schema.ts';
import type { LearningRoundExecutionResult, LearningRoundResult } from './learningRound.schema.ts';
import type { TaskEvidenceReturnResult } from './taskEvidenceReturn.schema.ts';
import type { TaskExecutionResult } from './taskExecution.schema.ts';

export type StudentLearningFeedbackStage =
  | 'submission'
  | 'analysis'
  | 'result';

export type StudentLearningFeedbackStatus =
  | 'completed'
  | 'retry_required'
  | 'review_required'
  | 'blocked';

export type StudentLearningFeedbackSource =
  | 'task_execution'
  | 'evidence_return'
  | 'learning_round';

export type StudentLearningFeedbackDebugState = {
  sourceStatus?: string;
  sourceType?: string;
  issues?: string[];
};

export type StudentLearningFeedback = {
  learningRoundId: string;
  studentId: string;

  stage: StudentLearningFeedbackStage;
  resultStatus: StudentLearningFeedbackStatus;

  headline: string;
  summary: string;

  whatYouDidWell: string[];
  whatNeedsAttention: string[];
  nextActionText: string;

  canRetry: boolean;
  canFinishRound: boolean;

  source: StudentLearningFeedbackSource;

  studentRoundFocus?: {
    title: string;
    description: string;
  };

  debugState?: StudentLearningFeedbackDebugState;
};

export type StudentLearningFeedbackInput = {
  entryState?: StudentLearningEntryState;
  taskExecutionResult?: TaskExecutionResult;
  learningRoundExecutionResult?: LearningRoundExecutionResult;
  taskEvidenceReturnResult?: TaskEvidenceReturnResult;
  learningRoundResult?: LearningRoundResult;
};

export function isStudentLearningFeedback(value: unknown): value is StudentLearningFeedback {
  if (!value || typeof value !== 'object') return false;

  const feedback = value as StudentLearningFeedback;
  return (
    isNonEmptyString(feedback.learningRoundId) &&
    isNonEmptyString(feedback.studentId) &&
    ['submission', 'analysis', 'result'].includes(feedback.stage) &&
    ['completed', 'retry_required', 'review_required', 'blocked'].includes(feedback.resultStatus) &&
    isNonEmptyString(feedback.headline) &&
    isNonEmptyString(feedback.summary) &&
    Array.isArray(feedback.whatYouDidWell) &&
    feedback.whatYouDidWell.every(isNonEmptyString) &&
    Array.isArray(feedback.whatNeedsAttention) &&
    feedback.whatNeedsAttention.every(isNonEmptyString) &&
    isNonEmptyString(feedback.nextActionText) &&
    typeof feedback.canRetry === 'boolean' &&
    typeof feedback.canFinishRound === 'boolean' &&
    ['task_execution', 'evidence_return', 'learning_round'].includes(feedback.source)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
