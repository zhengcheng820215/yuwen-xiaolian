import type { GrowthMemorySummary } from './growthMemory.schema.ts';
import type { StudentAbilityProfile } from './studentAbilityProfile.schema.ts';

export type NextLearningAction =
  | 'continue_training'
  | 'independent_retest'
  | 'transfer_test'
  | 'diagnostic_verification'
  | 'collect_more_evidence'
  | 'lower_difficulty_training'
  | 'maintenance_validation'
  | 'switch_ability'
  | 'human_review';

export type RecommendedTaskRole =
  | 'training'
  | 'retest'
  | 'transfer'
  | 'diagnosis'
  | 'observation';

export type StrategyValidationNextStep =
  | 'create_task_request'
  | 'review_required'
  | 'regenerate_strategy'
  | 'blocked';

export type CurrentLearningContext = {
  contextId: string;
  studentId: string;
  currentPhase:
    | 'diagnosis'
    | 'training'
    | 'retest'
    | 'transfer'
    | 'observation';
  targetAbilityId?: string;
  recentTaskRole?: RecommendedTaskRole;
  allowTraining: boolean;
  allowRetest: boolean;
  allowTransfer: boolean;
  recentFailureCount?: number;
  cognitiveLoad?: 'low' | 'medium' | 'high';
  reviewRequired?: boolean;
  notes?: string[];
};

export type NextLearningStrategy = {
  strategyId: string;
  studentId: string;
  targetAbilityId: string;
  action: NextLearningAction;
  reason: string;
  evidenceLinks: string[];
  growthMemoryRecordIds: string[];
  validationGoal: string;
  recommendedTaskRole: RecommendedTaskRole;
  limitations: string[];
  strategySource: 'growth_memory';
  createdAt: string;
};

export type StrategyValidationResult = {
  strategyId: string;
  isValid: boolean;
  validationErrors: string[];
  warnings: string[];
  blockedReason?: string;
  nextStep: StrategyValidationNextStep;
  validatedAt: string;
};

export type TaskRequest = {
  taskRequestId: string;
  strategyId: string;
  studentId: string;
  targetAbilityId: string;
  taskRole: RecommendedTaskRole;
  action: NextLearningAction;
  validationGoal: string;
  evidenceLinks: string[];
  growthMemoryRecordIds: string[];
  constraints: string[];
  createdAt: string;
};

export type TaskRequestConversionResult = {
  strategyId: string;
  taskRequest: TaskRequest | null;
  blockedReason?: string;
};

export type NextLearningStrategyInput = {
  growthMemorySummary: GrowthMemorySummary;
  studentAbilityProfile: StudentAbilityProfile;
  currentLearningContext: CurrentLearningContext;
  createdAt?: string;
};

export const NEXT_LEARNING_ACTIONS: NextLearningAction[] = [
  'continue_training',
  'independent_retest',
  'transfer_test',
  'diagnostic_verification',
  'collect_more_evidence',
  'lower_difficulty_training',
  'maintenance_validation',
  'switch_ability',
  'human_review',
];

export const RECOMMENDED_TASK_ROLES: RecommendedTaskRole[] = [
  'training',
  'retest',
  'transfer',
  'diagnosis',
  'observation',
];

export const STRATEGY_VALIDATION_NEXT_STEPS: StrategyValidationNextStep[] = [
  'create_task_request',
  'review_required',
  'regenerate_strategy',
  'blocked',
];

export function isCurrentLearningContext(value: unknown): value is CurrentLearningContext {
  if (!value || typeof value !== 'object') return false;

  const context = value as CurrentLearningContext;
  return (
    isNonEmptyString(context.contextId) &&
    isNonEmptyString(context.studentId) &&
    ['diagnosis', 'training', 'retest', 'transfer', 'observation'].includes(context.currentPhase) &&
    (context.targetAbilityId === undefined || isNonEmptyString(context.targetAbilityId)) &&
    (context.recentTaskRole === undefined || RECOMMENDED_TASK_ROLES.includes(context.recentTaskRole)) &&
    typeof context.allowTraining === 'boolean' &&
    typeof context.allowRetest === 'boolean' &&
    typeof context.allowTransfer === 'boolean' &&
    (context.recentFailureCount === undefined || isNonNegativeNumber(context.recentFailureCount)) &&
    (context.cognitiveLoad === undefined || ['low', 'medium', 'high'].includes(context.cognitiveLoad)) &&
    (context.reviewRequired === undefined || typeof context.reviewRequired === 'boolean') &&
    (context.notes === undefined || (Array.isArray(context.notes) && context.notes.every((item) => typeof item === 'string')))
  );
}

export function isNextLearningStrategy(value: unknown): value is NextLearningStrategy {
  if (!value || typeof value !== 'object') return false;

  const strategy = value as NextLearningStrategy;
  return (
    isNonEmptyString(strategy.strategyId) &&
    isNonEmptyString(strategy.studentId) &&
    isNonEmptyString(strategy.targetAbilityId) &&
    NEXT_LEARNING_ACTIONS.includes(strategy.action) &&
    isNonEmptyString(strategy.reason) &&
    Array.isArray(strategy.evidenceLinks) &&
    strategy.evidenceLinks.length > 0 &&
    strategy.evidenceLinks.every(isNonEmptyString) &&
    Array.isArray(strategy.growthMemoryRecordIds) &&
    strategy.growthMemoryRecordIds.length > 0 &&
    strategy.growthMemoryRecordIds.every(isNonEmptyString) &&
    isNonEmptyString(strategy.validationGoal) &&
    RECOMMENDED_TASK_ROLES.includes(strategy.recommendedTaskRole) &&
    Array.isArray(strategy.limitations) &&
    strategy.limitations.every((item) => typeof item === 'string') &&
    strategy.strategySource === 'growth_memory' &&
    isNonEmptyString(strategy.createdAt)
  );
}

export function isStrategyValidationResult(value: unknown): value is StrategyValidationResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as StrategyValidationResult;
  return (
    isNonEmptyString(result.strategyId) &&
    typeof result.isValid === 'boolean' &&
    Array.isArray(result.validationErrors) &&
    result.validationErrors.every(isNonEmptyString) &&
    Array.isArray(result.warnings) &&
    result.warnings.every((item) => typeof item === 'string') &&
    (result.blockedReason === undefined || isNonEmptyString(result.blockedReason)) &&
    STRATEGY_VALIDATION_NEXT_STEPS.includes(result.nextStep) &&
    isNonEmptyString(result.validatedAt)
  );
}

export function isTaskRequest(value: unknown): value is TaskRequest {
  if (!value || typeof value !== 'object') return false;

  const request = value as TaskRequest;
  return (
    isNonEmptyString(request.taskRequestId) &&
    isNonEmptyString(request.strategyId) &&
    isNonEmptyString(request.studentId) &&
    isNonEmptyString(request.targetAbilityId) &&
    RECOMMENDED_TASK_ROLES.includes(request.taskRole) &&
    NEXT_LEARNING_ACTIONS.includes(request.action) &&
    isNonEmptyString(request.validationGoal) &&
    Array.isArray(request.evidenceLinks) &&
    request.evidenceLinks.length > 0 &&
    request.evidenceLinks.every(isNonEmptyString) &&
    Array.isArray(request.growthMemoryRecordIds) &&
    request.growthMemoryRecordIds.length > 0 &&
    request.growthMemoryRecordIds.every(isNonEmptyString) &&
    Array.isArray(request.constraints) &&
    request.constraints.every((item) => typeof item === 'string') &&
    isNonEmptyString(request.createdAt)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0;
}
