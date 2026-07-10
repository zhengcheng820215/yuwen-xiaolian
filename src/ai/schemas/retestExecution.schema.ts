import {
  type AbilityEvidence,
  isAbilityEvidence,
} from './abilityEvidence.schema.ts';
import type { DiagnosisResult } from './diagnosis.schema.ts';
import type { StudentAbilityProfile } from './studentAbilityProfile.schema.ts';
import type { AbilityEvidenceSummary } from '../agents/weaknessRankingAgent.ts';

export type RetestExecutionValidation = {
  passed: boolean;
  diagnosis_focus_match: boolean;
  review_required: boolean;
  issues: string[];
};

export type RetestExecutionResult = {
  retest_task_id: string;
  target_ability: string;
  student_retest_answer: string;
  diagnosis_result: DiagnosisResult;
  new_retest_evidence: AbilityEvidence;
  updated_evidence: AbilityEvidence[];
  evidence_summary: AbilityEvidenceSummary[];
  updated_student_ability_profile: StudentAbilityProfile;
  validation: RetestExecutionValidation;
};

export function isRetestExecutionResult(value: unknown): value is RetestExecutionResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as RetestExecutionResult;

  return (
    isNonEmptyString(result.retest_task_id) &&
    isNonEmptyString(result.target_ability) &&
    typeof result.student_retest_answer === 'string' &&
    isDiagnosisResultLike(result.diagnosis_result) &&
    isAbilityEvidence(result.new_retest_evidence) &&
    Array.isArray(result.updated_evidence) &&
    result.updated_evidence.length > 0 &&
    result.updated_evidence.every(isAbilityEvidence) &&
    Array.isArray(result.evidence_summary) &&
    result.evidence_summary.length > 0 &&
    Boolean(result.updated_student_ability_profile) &&
    isValidation(result.validation)
  );
}

function isDiagnosisResultLike(value: unknown): value is DiagnosisResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as DiagnosisResult;

  return (
    isNonEmptyString(result.mainAbility) &&
    isNonEmptyString(result.rootCause) &&
    typeof result.confidence === 'number' &&
    result.confidence >= 0 &&
    result.confidence <= 1
  );
}

function isValidation(value: unknown): value is RetestExecutionValidation {
  if (!value || typeof value !== 'object') return false;

  const validation = value as RetestExecutionValidation;

  return (
    typeof validation.passed === 'boolean' &&
    typeof validation.diagnosis_focus_match === 'boolean' &&
    typeof validation.review_required === 'boolean' &&
    Array.isArray(validation.issues) &&
    validation.issues.every((issue) => typeof issue === 'string')
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
