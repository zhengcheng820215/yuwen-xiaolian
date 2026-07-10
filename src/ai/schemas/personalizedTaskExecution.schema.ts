export type PersonalizedTaskNextDecision =
  | 'continue_reinforcement'
  | 'increase_difficulty'
  | 'switch_ability'
  | 'retest';

export type PersonalizedTaskExecutionReviewStatus =
  | 'PASS'
  | 'REVIEW';

export type PersonalizedTaskExecutionSummary = {
  before: {
    target_ability: string;
    weakness_evidence_count: number;
    growth_evidence_count: number;
    status: string;
    reason: string;
  };
  execution: {
    task_id: string;
    target_ability: string;
    student_answer: string;
    diagnosis_answer_status: string;
    diagnosis_main_ability: string;
    diagnosis_focus_match: boolean;
    new_evidence_type: string;
  };
  after: {
    target_ability: string;
    evidence_updated: boolean;
    weakness_evidence_count: number;
    growth_evidence_count: number;
    status: string;
  };
  review_status: PersonalizedTaskExecutionReviewStatus;
  review_reason: string;
  next_decision: PersonalizedTaskNextDecision;
  decision_reason: string;
};

export function isPersonalizedTaskExecutionSummary(
  value: unknown,
): value is PersonalizedTaskExecutionSummary {
  if (!value || typeof value !== 'object') return false;

  const summary = value as PersonalizedTaskExecutionSummary;

  return (
    isExecutionBlock(summary.before) &&
    isExecutionResultBlock(summary.execution) &&
    isAfterBlock(summary.after) &&
    ['PASS', 'REVIEW'].includes(summary.review_status) &&
    isNonEmptyString(summary.review_reason) &&
    isPersonalizedTaskNextDecision(summary.next_decision) &&
    isNonEmptyString(summary.decision_reason)
  );
}

export function isPersonalizedTaskNextDecision(
  value: unknown,
): value is PersonalizedTaskNextDecision {
  return [
    'continue_reinforcement',
    'increase_difficulty',
    'switch_ability',
    'retest',
  ].includes(value as PersonalizedTaskNextDecision);
}

function isExecutionBlock(value: unknown): value is PersonalizedTaskExecutionSummary['before'] {
  if (!value || typeof value !== 'object') return false;

  const block = value as PersonalizedTaskExecutionSummary['before'];

  return (
    isNonEmptyString(block.target_ability) &&
    isNonNegativeNumber(block.weakness_evidence_count) &&
    isNonNegativeNumber(block.growth_evidence_count) &&
    isNonEmptyString(block.status) &&
    isNonEmptyString(block.reason)
  );
}

function isExecutionResultBlock(
  value: unknown,
): value is PersonalizedTaskExecutionSummary['execution'] {
  if (!value || typeof value !== 'object') return false;

  const block = value as PersonalizedTaskExecutionSummary['execution'];

  return (
    isNonEmptyString(block.task_id) &&
    isNonEmptyString(block.target_ability) &&
    typeof block.student_answer === 'string' &&
    isNonEmptyString(block.diagnosis_answer_status) &&
    isNonEmptyString(block.diagnosis_main_ability) &&
    typeof block.diagnosis_focus_match === 'boolean' &&
    isNonEmptyString(block.new_evidence_type)
  );
}

function isAfterBlock(value: unknown): value is PersonalizedTaskExecutionSummary['after'] {
  if (!value || typeof value !== 'object') return false;

  const block = value as PersonalizedTaskExecutionSummary['after'];

  return (
    isNonEmptyString(block.target_ability) &&
    typeof block.evidence_updated === 'boolean' &&
    isNonNegativeNumber(block.weakness_evidence_count) &&
    isNonNegativeNumber(block.growth_evidence_count) &&
    isNonEmptyString(block.status)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0;
}
