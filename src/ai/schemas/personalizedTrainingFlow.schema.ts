import type { AbilityEvidence } from './abilityEvidence.schema.ts';
import type { DiagnosisResult } from './diagnosis.schema.ts';
import type { LearningEntryResult } from './learningEntry.schema.ts';
import type { PersonalizedNextTask } from './personalizedNextTask.schema.ts';
import type { PersonalizedTaskExecutionSummary } from './personalizedTaskExecution.schema.ts';
import type { StudentAbilityProfile } from './studentAbilityProfile.schema.ts';

export type PersonalizedTrainingFlowStatus =
  | 'task_generated'
  | 'task_completed'
  | 'diagnosis_completed'
  | 'ready_for_retest'
  | 'validation_failed';

export type PersonalizedTrainingFlowFeedback = {
  task_goal: string;
  why_this_task: string;
  performance_summary: string;
  what_to_improve_next: string;
};

export type PersonalizedTrainingFlowResult = {
  session_id: string;
  student_id: string;
  target_ability: string;
  learning_entry_result: LearningEntryResult;
  personalized_task: PersonalizedNextTask;
  student_task_answer: string;
  task_diagnosis_result: DiagnosisResult;
  new_ability_evidence: AbilityEvidence;
  updated_evidence: AbilityEvidence[];
  updated_student_ability_profile: StudentAbilityProfile;
  task_execution_summary: PersonalizedTaskExecutionSummary;
  student_readable_feedback: PersonalizedTrainingFlowFeedback;
  next_step_hint: string;
  flow_status: PersonalizedTrainingFlowStatus;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export function isPersonalizedTrainingFlowResult(
  value: unknown,
): value is PersonalizedTrainingFlowResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as PersonalizedTrainingFlowResult;

  return (
    isNonEmptyString(result.session_id) &&
    isNonEmptyString(result.student_id) &&
    isNonEmptyString(result.target_ability) &&
    Boolean(result.learning_entry_result) &&
    Boolean(result.personalized_task) &&
    typeof result.student_task_answer === 'string' &&
    Boolean(result.task_diagnosis_result) &&
    Boolean(result.new_ability_evidence) &&
    isNonEmptyString(result.new_ability_evidence.ability) &&
    ['diagnosis', 'training'].includes(result.new_ability_evidence.source) &&
    Array.isArray(result.updated_evidence) &&
    result.updated_evidence.length > 0 &&
    Boolean(result.updated_student_ability_profile) &&
    Boolean(result.task_execution_summary) &&
    isFeedback(result.student_readable_feedback) &&
    isNonEmptyString(result.next_step_hint) &&
    isFlowStatus(result.flow_status) &&
    Boolean(result.validation) &&
    typeof result.validation.passed === 'boolean' &&
    Array.isArray(result.validation.issues) &&
    result.validation.issues.every((issue) => typeof issue === 'string')
  );
}

function isFeedback(value: unknown): value is PersonalizedTrainingFlowFeedback {
  if (!value || typeof value !== 'object') return false;

  const feedback = value as PersonalizedTrainingFlowFeedback;

  return (
    isNonEmptyString(feedback.task_goal) &&
    isNonEmptyString(feedback.why_this_task) &&
    isNonEmptyString(feedback.performance_summary) &&
    isNonEmptyString(feedback.what_to_improve_next)
  );
}

function isFlowStatus(value: unknown): value is PersonalizedTrainingFlowStatus {
  return [
    'task_generated',
    'task_completed',
    'diagnosis_completed',
    'ready_for_retest',
    'validation_failed',
  ].includes(value as PersonalizedTrainingFlowStatus);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
