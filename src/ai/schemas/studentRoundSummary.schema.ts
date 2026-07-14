import type { LearningRoundResult } from './learningRound.schema.ts';
import type { StudentLearningEntryState } from './studentLearningEntry.schema.ts';
import type { StudentLearningFeedback } from './studentLearningFeedback.schema.ts';

export type StudentRoundSummaryStatus =
  | 'completed'
  | 'retry_required'
  | 'review_required'
  | 'blocked'
  | 'abandoned';

export type StudentRoundNextAction =
  | 'continue_learning'
  | 'retry_answer'
  | 'supplement_answer'
  | 'wait_for_review'
  | 'finish_round'
  | 'restart_later';

export type StudentRoundSummaryDebugState = {
  roundStatus?: string;
  feedbackStatus?: string;
  nextStep?: string;
  issues?: string[];
};

export type StudentRoundSummary = {
  learningRoundId: string;
  studentId: string;

  status: StudentRoundSummaryStatus;

  title: string;
  completedTaskTitle: string;

  roundFocus: {
    title: string;
    description: string;
  };

  completionSummary: string;
  studentReadableResult: string;

  positiveTakeaway: string[];
  continueAttention: string[];

  nextAction: StudentRoundNextAction;
  nextActionText: string;

  canContinue: boolean;
  canRetry: boolean;
  canFinish: boolean;

  debugState?: StudentRoundSummaryDebugState;
};

export type StudentRoundSummaryInput = {
  learningRoundResult: LearningRoundResult;
  studentLearningFeedback: StudentLearningFeedback;
  studentLearningEntryState: StudentLearningEntryState;
  exitState?: {
    abandoned?: boolean;
    reason?: string;
  };
};

export function isStudentRoundSummary(value: unknown): value is StudentRoundSummary {
  if (!value || typeof value !== 'object') return false;

  const summary = value as StudentRoundSummary;
  return (
    isNonEmptyString(summary.learningRoundId) &&
    isNonEmptyString(summary.studentId) &&
    ['completed', 'retry_required', 'review_required', 'blocked', 'abandoned'].includes(summary.status) &&
    isNonEmptyString(summary.title) &&
    isNonEmptyString(summary.completedTaskTitle) &&
    Boolean(summary.roundFocus) &&
    isNonEmptyString(summary.roundFocus.title) &&
    isNonEmptyString(summary.roundFocus.description) &&
    isNonEmptyString(summary.completionSummary) &&
    isNonEmptyString(summary.studentReadableResult) &&
    Array.isArray(summary.positiveTakeaway) &&
    summary.positiveTakeaway.every(isNonEmptyString) &&
    Array.isArray(summary.continueAttention) &&
    summary.continueAttention.every(isNonEmptyString) &&
    ['continue_learning', 'retry_answer', 'supplement_answer', 'wait_for_review', 'finish_round', 'restart_later'].includes(summary.nextAction) &&
    isNonEmptyString(summary.nextActionText) &&
    typeof summary.canContinue === 'boolean' &&
    typeof summary.canRetry === 'boolean' &&
    typeof summary.canFinish === 'boolean'
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
