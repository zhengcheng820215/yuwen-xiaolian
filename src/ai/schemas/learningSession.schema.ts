export type LearningSessionStatus =
  | 'in_progress'
  | 'completed'
  | 'needs_retest'
  | 'needs_more_training'
  | 'ready_to_switch_ability';

export type LearningSessionOutcome =
  | 'no_clear_improvement'
  | 'early_improvement_signal'
  | 'consistent_improvement'
  | 'needs_retest_validation'
  | 'ability_focus_can_shift';

export type LearningSessionNextRecommendationDecision =
  | 'continue_session'
  | 'retest'
  | 'start_new_session_same_ability'
  | 'start_new_session_new_ability';

export type LearningSessionTaskExecutionSnapshot = {
  task_id: string;
  diagnosis_answer_status: string;
  diagnosis_main_ability: string;
  diagnosis_focus_match: boolean;
  new_evidence_type: string;
  next_decision: string;
};

export type LearningSessionMemory = {
  session_id: string;
  student_id: string;
  target_ability: string;
  started_at: string;
  ended_at?: string;
  task_execution_ids: string[];
  task_execution_snapshots: LearningSessionTaskExecutionSnapshot[];
  evidence_ids: string[];
  task_count: number;
  weakness_evidence_count_before: number;
  weakness_evidence_count_after: number;
  growth_evidence_count_before: number;
  growth_evidence_count_after: number;
  positive_evidence_count_before: number;
  positive_evidence_count_after: number;
  session_status: LearningSessionStatus;
  session_outcome: LearningSessionOutcome;
  summary: string;
  next_recommendation: {
    decision: LearningSessionNextRecommendationDecision;
    reason: string;
  };
};

export function isLearningSessionMemory(value: unknown): value is LearningSessionMemory {
  if (!value || typeof value !== 'object') return false;

  const memory = value as LearningSessionMemory;

  return (
    isNonEmptyString(memory.session_id) &&
    isNonEmptyString(memory.student_id) &&
    isNonEmptyString(memory.target_ability) &&
    isNonEmptyString(memory.started_at) &&
    (
      memory.ended_at === undefined ||
      isNonEmptyString(memory.ended_at)
    ) &&
    Array.isArray(memory.task_execution_ids) &&
    memory.task_execution_ids.length > 0 &&
    memory.task_execution_ids.every(isNonEmptyString) &&
    Array.isArray(memory.task_execution_snapshots) &&
    memory.task_execution_snapshots.length > 0 &&
    memory.task_execution_snapshots.every(isTaskExecutionSnapshot) &&
    Array.isArray(memory.evidence_ids) &&
    memory.evidence_ids.length > 0 &&
    memory.evidence_ids.every(isNonEmptyString) &&
    isNonNegativeNumber(memory.task_count) &&
    isNonNegativeNumber(memory.weakness_evidence_count_before) &&
    isNonNegativeNumber(memory.weakness_evidence_count_after) &&
    isNonNegativeNumber(memory.growth_evidence_count_before) &&
    isNonNegativeNumber(memory.growth_evidence_count_after) &&
    isNonNegativeNumber(memory.positive_evidence_count_before) &&
    isNonNegativeNumber(memory.positive_evidence_count_after) &&
    isLearningSessionStatus(memory.session_status) &&
    isLearningSessionOutcome(memory.session_outcome) &&
    isNonEmptyString(memory.summary) &&
    isNextRecommendation(memory.next_recommendation)
  );
}

export function isLearningSessionStatus(value: unknown): value is LearningSessionStatus {
  return [
    'in_progress',
    'completed',
    'needs_retest',
    'needs_more_training',
    'ready_to_switch_ability',
  ].includes(value as LearningSessionStatus);
}

export function isLearningSessionOutcome(value: unknown): value is LearningSessionOutcome {
  return [
    'no_clear_improvement',
    'early_improvement_signal',
    'consistent_improvement',
    'needs_retest_validation',
    'ability_focus_can_shift',
  ].includes(value as LearningSessionOutcome);
}

export function isLearningSessionNextRecommendationDecision(
  value: unknown,
): value is LearningSessionNextRecommendationDecision {
  return [
    'continue_session',
    'retest',
    'start_new_session_same_ability',
    'start_new_session_new_ability',
  ].includes(value as LearningSessionNextRecommendationDecision);
}

function isTaskExecutionSnapshot(value: unknown): value is LearningSessionTaskExecutionSnapshot {
  if (!value || typeof value !== 'object') return false;

  const snapshot = value as LearningSessionTaskExecutionSnapshot;

  return (
    isNonEmptyString(snapshot.task_id) &&
    isNonEmptyString(snapshot.diagnosis_answer_status) &&
    isNonEmptyString(snapshot.diagnosis_main_ability) &&
    typeof snapshot.diagnosis_focus_match === 'boolean' &&
    isNonEmptyString(snapshot.new_evidence_type) &&
    isNonEmptyString(snapshot.next_decision)
  );
}

function isNextRecommendation(
  value: unknown,
): value is LearningSessionMemory['next_recommendation'] {
  if (!value || typeof value !== 'object') return false;

  const recommendation = value as LearningSessionMemory['next_recommendation'];

  return (
    isLearningSessionNextRecommendationDecision(recommendation.decision) &&
    isNonEmptyString(recommendation.reason)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0;
}
