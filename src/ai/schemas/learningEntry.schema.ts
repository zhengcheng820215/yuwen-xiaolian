import type { AbilityEvidence } from './abilityEvidence.schema.ts';
import type { DiagnosisResult } from './diagnosis.schema.ts';
import type { StudentAbilityProfile } from './studentAbilityProfile.schema.ts';

export type LearningEntryStudentFeedback = {
  title: string;
  summary: string;
  next_step: string;
};

export type LearningEntryResult = {
  session_id: string;
  student_id: string;
  question: string;
  student_answer: string;
  diagnosis_result: DiagnosisResult;
  new_ability_evidence: AbilityEvidence;
  updated_evidence: AbilityEvidence[];
  student_ability_profile: StudentAbilityProfile;
  initial_target_ability: string;
  next_step_hint: string;
  student_feedback: LearningEntryStudentFeedback;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export function isLearningEntryResult(value: unknown): value is LearningEntryResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as LearningEntryResult;

  return (
    isNonEmptyString(result.session_id) &&
    isNonEmptyString(result.student_id) &&
    isNonEmptyString(result.question) &&
    typeof result.student_answer === 'string' &&
    Boolean(result.diagnosis_result) &&
    Boolean(result.new_ability_evidence) &&
    isNonEmptyString(result.new_ability_evidence.ability) &&
    ['diagnosis', 'training', 'retest'].includes(result.new_ability_evidence.source) &&
    Array.isArray(result.updated_evidence) &&
    result.updated_evidence.length > 0 &&
    Boolean(result.student_ability_profile) &&
    isNonEmptyString(result.initial_target_ability) &&
    isNonEmptyString(result.next_step_hint) &&
    isStudentFeedback(result.student_feedback) &&
    isValidation(result.validation)
  );
}

function isStudentFeedback(value: unknown): value is LearningEntryStudentFeedback {
  if (!value || typeof value !== 'object') return false;

  const feedback = value as LearningEntryStudentFeedback;

  return (
    isNonEmptyString(feedback.title) &&
    isNonEmptyString(feedback.summary) &&
    isNonEmptyString(feedback.next_step)
  );
}

function isValidation(value: unknown): value is LearningEntryResult['validation'] {
  if (!value || typeof value !== 'object') return false;

  const validation = value as LearningEntryResult['validation'];

  return (
    typeof validation.passed === 'boolean' &&
    Array.isArray(validation.issues) &&
    validation.issues.every((issue) => typeof issue === 'string')
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
