export const TRAINING_TASK_SEQUENCE_PLANNING_VERSION =
  'training_task_sequence_planning_v2' as const;

export const TRAINING_TASK_SEQUENCE_STRATEGIES = [
  'entry_first',
  'holistic_first',
  'role_driven',
] as const;

export type TrainingTaskSequenceStrategy =
  typeof TRAINING_TASK_SEQUENCE_STRATEGIES[number];

export const TRAINING_TASK_SEQUENCE_REASONS = [
  'default_foundation_entry',
  'holistic_judgment_required',
  'independent_expression_baseline',
  'retest_after_training',
  'transfer_in_new_context',
  'no_qualified_single_choice',
] as const;

export type TrainingTaskSequenceReason =
  typeof TRAINING_TASK_SEQUENCE_REASONS[number];

export type TrainingTaskSequencePlanningPreference = {
  strategy: TrainingTaskSequenceStrategy;
  reason: TrainingTaskSequenceReason;
  preferredPreludeChoiceCount: number;
};

export type TrainingTaskSequencePlanningStatus =
  | 'not_applicable'
  | 'met'
  | 'adjusted'
  | 'underfilled';

export type TrainingTaskSequencePlanningResult = {
  strategy: TrainingTaskSequenceStrategy;
  reason: TrainingTaskSequenceReason;
  expectedPreludeChoiceCount: number;
  actualPreludeChoiceCount: number;
  preludeCandidateIds: string[];
  status: TrainingTaskSequencePlanningStatus;
  orderedCandidateIds: string[];
  version: typeof TRAINING_TASK_SEQUENCE_PLANNING_VERSION;
};

export function isTrainingTaskSequenceStrategy(
  value: unknown,
): value is TrainingTaskSequenceStrategy {
  return typeof value === 'string' && (
    TRAINING_TASK_SEQUENCE_STRATEGIES as readonly string[]
  ).includes(value);
}

export function isTrainingTaskSequenceReason(
  value: unknown,
): value is TrainingTaskSequenceReason {
  return typeof value === 'string' && (
    TRAINING_TASK_SEQUENCE_REASONS as readonly string[]
  ).includes(value);
}
