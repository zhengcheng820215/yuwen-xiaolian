export type AbilityChangeStatus =
  | 'likely_improved'
  | 'not_transferred'
  | 'still_weak'
  | 'needs_more_evidence'
  | 'ready_to_switch_ability';

export type AbilityChangeNextDecision =
  | 'continue_training'
  | 'retest_again'
  | 'switch_ability'
  | 'collect_more_evidence';

export type AbilityChangeEvidenceSummary = {
  weakness_count: number;
  growth_count: number;
  positive_count: number;
  insufficient_count: number;
  evidence_ids: string[];
  key_observations: string[];
};

export type AbilityChangeEvaluation = {
  evaluation_id: string;
  student_id: string;
  target_ability: string;
  before_summary: AbilityChangeEvidenceSummary;
  training_summary: AbilityChangeEvidenceSummary;
  retest_summary: AbilityChangeEvidenceSummary;
  change_status: AbilityChangeStatus;
  change_reason: string;
  evidence_basis: string[];
  confidence: number;
  next_decision: AbilityChangeNextDecision;
  next_decision_reason: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export const ABILITY_CHANGE_STATUSES: AbilityChangeStatus[] = [
  'likely_improved',
  'not_transferred',
  'still_weak',
  'needs_more_evidence',
  'ready_to_switch_ability',
];

export const ABILITY_CHANGE_NEXT_DECISIONS: AbilityChangeNextDecision[] = [
  'continue_training',
  'retest_again',
  'switch_ability',
  'collect_more_evidence',
];

export function isAbilityChangeEvaluation(
  value: unknown,
): value is AbilityChangeEvaluation {
  if (!value || typeof value !== 'object') return false;

  const evaluation = value as AbilityChangeEvaluation;

  return (
    isNonEmptyString(evaluation.evaluation_id) &&
    isNonEmptyString(evaluation.student_id) &&
    isNonEmptyString(evaluation.target_ability) &&
    isEvidenceSummary(evaluation.before_summary) &&
    isEvidenceSummary(evaluation.training_summary) &&
    isEvidenceSummary(evaluation.retest_summary) &&
    ABILITY_CHANGE_STATUSES.includes(evaluation.change_status) &&
    isNonEmptyString(evaluation.change_reason) &&
    Array.isArray(evaluation.evidence_basis) &&
    evaluation.evidence_basis.length > 0 &&
    evaluation.evidence_basis.every(isNonEmptyString) &&
    typeof evaluation.confidence === 'number' &&
    !Number.isNaN(evaluation.confidence) &&
    evaluation.confidence >= 0 &&
    evaluation.confidence <= 1 &&
    ABILITY_CHANGE_NEXT_DECISIONS.includes(evaluation.next_decision) &&
    isNonEmptyString(evaluation.next_decision_reason) &&
    isValidation(evaluation.validation)
  );
}

function isEvidenceSummary(value: unknown): value is AbilityChangeEvidenceSummary {
  if (!value || typeof value !== 'object') return false;

  const summary = value as AbilityChangeEvidenceSummary;

  return (
    isNonNegativeNumber(summary.weakness_count) &&
    isNonNegativeNumber(summary.growth_count) &&
    isNonNegativeNumber(summary.positive_count) &&
    isNonNegativeNumber(summary.insufficient_count) &&
    Array.isArray(summary.evidence_ids) &&
    summary.evidence_ids.every(isNonEmptyString) &&
    Array.isArray(summary.key_observations) &&
    summary.key_observations.every(isNonEmptyString)
  );
}

function isValidation(value: unknown): value is AbilityChangeEvaluation['validation'] {
  if (!value || typeof value !== 'object') return false;

  const validation = value as AbilityChangeEvaluation['validation'];

  return (
    typeof validation.passed === 'boolean' &&
    Array.isArray(validation.issues) &&
    validation.issues.every((issue) => typeof issue === 'string')
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0;
}
