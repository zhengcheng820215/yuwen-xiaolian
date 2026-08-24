import type { GrowthMemoryRecord, GrowthMemorySummary } from './growthMemory.schema.ts';
import type { LearningRoundResult } from './learningRound.schema.ts';
import type { StudentAbilityProfile } from './studentAbilityProfile.schema.ts';
import type { StudentLearningFeedback } from './studentLearningFeedback.schema.ts';
import type { StudentRoundSummary } from './studentRoundSummary.schema.ts';
import type { ConcreteLearningTask } from './concreteLearningTask.schema.ts';
import type { StudentResponse } from './taskExecution.schema.ts';
import type { SingleChoiceStudentAnswerValue } from './singleChoiceInteraction.schema.ts';
import {
  isLearningProgressionContextSnapshot,
  type LearningProgressionContextSnapshot,
} from './learningProgressionContext.schema.ts';

export const LEARNING_PERSISTENCE_VERSION = 'phase12_1_v1';
export const LEARNING_PERSISTENCE_SCHEMA_VERSION = 'learning_persistence_v1';

export type LearningPersistenceStatus =
  | 'saved'
  | 'restore_ready'
  | 'restore_failed'
  | 'invalid';

export type LearningResumeMode =
  | 'continue_unfinished_round'
  | 'view_completed_round'
  | 'start_next_round'
  | 'cannot_restore';

export type LearningPersistenceRecord = {
  recordId: string;
  studentId: string;
  learningRoundId: string;

  savedAt: string;
  updatedAt: string;
  version: typeof LEARNING_PERSISTENCE_VERSION;
  schemaVersion: typeof LEARNING_PERSISTENCE_SCHEMA_VERSION;
  sourceVersion?: string;

  learningRoundResult?: LearningRoundResult;
  concreteTask?: ConcreteLearningTask;
  progressionContextSnapshot?: LearningProgressionContextSnapshot;
  answerDraft?: string;
  singleChoiceDraft?: SingleChoiceStudentAnswerValue;
  studentResponse?: StudentResponse;
  studentLearningFeedback?: StudentLearningFeedback;
  studentRoundSummary?: StudentRoundSummary;

  growthMemoryRecord?: GrowthMemoryRecord;
  growthMemorySummary?: GrowthMemorySummary;
  studentAbilityProfile?: StudentAbilityProfile;

  status: LearningPersistenceStatus;
  issues: string[];
};

export type RestoredLearningState = {
  studentId: string;
  learningRoundId: string;

  canResume: boolean;
  resumeMode: LearningResumeMode;

  restoredRecord?: LearningPersistenceRecord;

  studentVisibleState: {
    title: string;
    message: string;
    primaryActionText: string;
  };

  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type LearningPersistenceInput = {
  studentId: string;
  learningRoundId: string;
  savedAt?: string;
  updatedAt?: string;
  sourceVersion?: string;

  learningRoundResult?: LearningRoundResult;
  concreteTask?: ConcreteLearningTask;
  progressionContextSnapshot?: LearningProgressionContextSnapshot;
  answerDraft?: string;
  singleChoiceDraft?: SingleChoiceStudentAnswerValue;
  studentResponse?: StudentResponse;
  studentLearningFeedback?: StudentLearningFeedback;
  studentRoundSummary?: StudentRoundSummary;
  growthMemoryRecord?: GrowthMemoryRecord;
  growthMemorySummary?: GrowthMemorySummary;
  studentAbilityProfile?: StudentAbilityProfile;
};

export function isLearningPersistenceRecord(value: unknown): value is LearningPersistenceRecord {
  if (!value || typeof value !== 'object') return false;

  const record = value as LearningPersistenceRecord;
  return (
    isNonEmptyString(record.recordId) &&
    isNonEmptyString(record.studentId) &&
    isNonEmptyString(record.learningRoundId) &&
    isNonEmptyString(record.savedAt) &&
    isNonEmptyString(record.updatedAt) &&
    record.version === LEARNING_PERSISTENCE_VERSION &&
    record.schemaVersion === LEARNING_PERSISTENCE_SCHEMA_VERSION &&
    (!record.progressionContextSnapshot ||
      isLearningProgressionContextSnapshot(record.progressionContextSnapshot)) &&
    ['saved', 'restore_ready', 'restore_failed', 'invalid'].includes(record.status) &&
    Array.isArray(record.issues) &&
    record.issues.every((issue) => typeof issue === 'string')
  );
}

export function isRestoredLearningState(value: unknown): value is RestoredLearningState {
  if (!value || typeof value !== 'object') return false;

  const state = value as RestoredLearningState;
  return (
    isNonEmptyString(state.studentId) &&
    isNonEmptyString(state.learningRoundId) &&
    typeof state.canResume === 'boolean' &&
    ['continue_unfinished_round', 'view_completed_round', 'start_next_round', 'cannot_restore'].includes(state.resumeMode) &&
    Boolean(state.studentVisibleState) &&
    isNonEmptyString(state.studentVisibleState.title) &&
    isNonEmptyString(state.studentVisibleState.message) &&
    isNonEmptyString(state.studentVisibleState.primaryActionText) &&
    Boolean(state.validation) &&
    typeof state.validation.passed === 'boolean' &&
    Array.isArray(state.validation.issues) &&
    state.validation.issues.every((issue) => typeof issue === 'string')
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
