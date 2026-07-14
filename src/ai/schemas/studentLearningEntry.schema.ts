import type { LearningRoundStartResult } from './learningRound.schema.ts';

export type StudentLearningEntryStatus =
  | 'loading_task'
  | 'ready_to_answer'
  | 'blocked'
  | 'retry_required'
  | 'error';

export type StudentLearningViewStatus =
  | 'loading_task'
  | 'ready'
  | 'submitting'
  | 'analyzing'
  | 'feedback_ready'
  | 'error';

export type StudentLearningEntryDebugState = {
  startStatus?: string;
  taskReadiness?: boolean;
  sourceType?: string;
  issues?: string[];
};

export type StudentLearningEntryState = {
  learningRoundId: string;
  studentId: string;
  status: StudentLearningEntryStatus;
  viewStatus: StudentLearningViewStatus;

  taskTitle: string;
  readingText?: string;
  questionText: string;
  answerRequirements: string[];
  successCriteriaText: string[];

  studentRoundFocus: {
    title: string;
    description: string;
  };

  canAnswer: boolean;
  canSubmit: boolean;
  message?: string;

  debugState?: StudentLearningEntryDebugState;
};

export type StudentLearningEntryInput = {
  startResult: LearningRoundStartResult;
  answerDraft?: string;
};

export function isStudentLearningEntryState(value: unknown): value is StudentLearningEntryState {
  if (!value || typeof value !== 'object') return false;

  const state = value as StudentLearningEntryState;
  return (
    isNonEmptyString(state.learningRoundId) &&
    isNonEmptyString(state.studentId) &&
    ['loading_task', 'ready_to_answer', 'blocked', 'retry_required', 'error'].includes(state.status) &&
    ['loading_task', 'ready', 'submitting', 'analyzing', 'feedback_ready', 'error'].includes(state.viewStatus) &&
    isNonEmptyString(state.taskTitle) &&
    isNonEmptyString(state.questionText) &&
    Array.isArray(state.answerRequirements) &&
    state.answerRequirements.every(isNonEmptyString) &&
    Array.isArray(state.successCriteriaText) &&
    state.successCriteriaText.every(isNonEmptyString) &&
    Boolean(state.studentRoundFocus) &&
    isNonEmptyString(state.studentRoundFocus.title) &&
    isNonEmptyString(state.studentRoundFocus.description) &&
    typeof state.canAnswer === 'boolean' &&
    typeof state.canSubmit === 'boolean'
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
