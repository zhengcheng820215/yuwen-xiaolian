import type { AbilityChangeEvaluation } from './abilityChangeEvaluation.schema.ts';
import type { PersonalizedTrainingFlowResult } from './personalizedTrainingFlow.schema.ts';
import type { RetestExecutionResult } from './retestExecution.schema.ts';
import type { RetestTask } from './retestTask.schema.ts';

export type BetaLearningSessionStatus =
  | 'completed'
  | 'needs_more_training'
  | 'needs_more_evidence'
  | 'ready_for_next_ability'
  | 'validation_failed'
  | 'not_ready_for_retest';

export type BetaLearningSessionPersistenceStatus =
  | 'not_persisted'
  | 'mock_saved'
  | 'ready_for_persistence';

export type BetaLearningSessionSummary = {
  initial_problem: string;
  training_focus: string;
  retest_result: string;
  ability_change_summary: string;
  next_learning_decision: string;
};

export type BetaLearningSessionFeedback = {
  title: string;
  summary: string;
  what_improved?: string;
  what_still_needs_work?: string;
  next_step: string;
};

export type BetaLearningSessionResult = {
  session_id: string;
  student_id: string;
  target_ability: string;
  personalized_training_result_id?: string;
  personalized_training_result: PersonalizedTrainingFlowResult;
  retest_task?: RetestTask;
  student_retest_answer?: string;
  retest_execution_result?: RetestExecutionResult;
  ability_change_evaluation?: AbilityChangeEvaluation;
  session_summary: BetaLearningSessionSummary;
  student_readable_feedback: BetaLearningSessionFeedback;
  session_status: BetaLearningSessionStatus;
  persistence_status: BetaLearningSessionPersistenceStatus;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export function isBetaLearningSessionResult(
  value: unknown,
): value is BetaLearningSessionResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as BetaLearningSessionResult;

  return (
    isNonEmptyString(result.session_id) &&
    isNonEmptyString(result.student_id) &&
    isNonEmptyString(result.target_ability) &&
    Boolean(result.personalized_training_result) &&
    isSessionSummary(result.session_summary) &&
    isFeedback(result.student_readable_feedback) &&
    isSessionStatus(result.session_status) &&
    isPersistenceStatus(result.persistence_status) &&
    Boolean(result.validation) &&
    typeof result.validation.passed === 'boolean' &&
    Array.isArray(result.validation.issues) &&
    result.validation.issues.every((issue) => typeof issue === 'string')
  );
}

function isSessionSummary(value: unknown): value is BetaLearningSessionSummary {
  if (!value || typeof value !== 'object') return false;

  const summary = value as BetaLearningSessionSummary;

  return (
    isNonEmptyString(summary.initial_problem) &&
    isNonEmptyString(summary.training_focus) &&
    isNonEmptyString(summary.retest_result) &&
    isNonEmptyString(summary.ability_change_summary) &&
    isNonEmptyString(summary.next_learning_decision)
  );
}

function isFeedback(value: unknown): value is BetaLearningSessionFeedback {
  if (!value || typeof value !== 'object') return false;

  const feedback = value as BetaLearningSessionFeedback;

  return (
    isNonEmptyString(feedback.title) &&
    isNonEmptyString(feedback.summary) &&
    (
      feedback.what_improved === undefined ||
      isNonEmptyString(feedback.what_improved)
    ) &&
    (
      feedback.what_still_needs_work === undefined ||
      isNonEmptyString(feedback.what_still_needs_work)
    ) &&
    isNonEmptyString(feedback.next_step)
  );
}

function isSessionStatus(value: unknown): value is BetaLearningSessionStatus {
  return [
    'completed',
    'needs_more_training',
    'needs_more_evidence',
    'ready_for_next_ability',
    'validation_failed',
    'not_ready_for_retest',
  ].includes(value as BetaLearningSessionStatus);
}

function isPersistenceStatus(value: unknown): value is BetaLearningSessionPersistenceStatus {
  return [
    'not_persisted',
    'mock_saved',
    'ready_for_persistence',
  ].includes(value as BetaLearningSessionPersistenceStatus);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
