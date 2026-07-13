import type { ConcreteLearningTask, TaskReadinessValidation } from './concreteLearningTask.schema.ts';
import type { GrowthMemorySummary } from './growthMemory.schema.ts';
import type {
  CurrentLearningContext,
  NextLearningStrategy,
  StrategyValidationResult,
  TaskRequest,
} from './nextLearningStrategy.schema.ts';
import type { StudentAbilityProfile } from './studentAbilityProfile.schema.ts';
import type {
  ExecutableLearningTask,
  TaskFulfillmentRequest,
  TaskGenerationRequest,
  TaskResourceMatchResult,
} from './taskFulfillment.schema.ts';
import type {
  ResponseValidityResult,
  StudentResponse,
  TaskExecutionResult,
  TaskExecutionSession,
} from './taskExecution.schema.ts';
import type { TaskEvidenceReturnResult } from './taskEvidenceReturn.schema.ts';

export type LearningRoundStartStatus =
  | 'ready_for_execution'
  | 'blocked'
  | 'review_required';

export type LearningRoundStartNextAction =
  | 'start_task_execution'
  | 'regenerate_strategy'
  | 'regenerate_task'
  | 'human_review'
  | 'stop';

export type LearningRoundStartResult = {
  learningRoundId: string;
  studentId: string;
  status: LearningRoundStartStatus;

  growthMemorySummary: GrowthMemorySummary;
  studentAbilityProfile: StudentAbilityProfile;
  currentLearningContext: CurrentLearningContext;

  nextLearningStrategy?: NextLearningStrategy;
  strategyValidationResult?: StrategyValidationResult;
  taskRequest?: TaskRequest;
  taskFulfillmentRequest?: TaskFulfillmentRequest;
  taskResourceMatchResult?: TaskResourceMatchResult;
  executableTask?: ExecutableLearningTask;
  taskGenerationRequest?: TaskGenerationRequest;
  concreteTask?: ConcreteLearningTask;
  taskReadinessValidation?: TaskReadinessValidation;

  nextAction: LearningRoundStartNextAction;
  issues: string[];
};

export type LearningRoundExecutionStatus =
  | 'evidence_return_ready'
  | 'retry_required'
  | 'blocked'
  | 'review_required'
  | 'abandoned';

export type LearningRoundExecutionNextAction =
  | 'enter_evidence_return'
  | 'supplement_response'
  | 'retry_task'
  | 'human_review'
  | 'stop';

export type LearningRoundExecutionResult = {
  learningRoundId: string;
  studentId: string;
  status: LearningRoundExecutionStatus;

  startResult: LearningRoundStartResult;
  taskExecutionSession?: TaskExecutionSession;
  studentResponse?: StudentResponse;
  responseValidityResult?: ResponseValidityResult;
  taskExecutionResult?: TaskExecutionResult;

  canEnterEvidenceReturn: boolean;
  nextAction: LearningRoundExecutionNextAction;
  issues: string[];
};

export type LearningRoundStatus =
  | 'completed'
  | 'blocked'
  | 'retry_required'
  | 'review_required'
  | 'abandoned';

export type LearningRoundNextStep =
  | 'continue'
  | 'supplement_response'
  | 'regenerate_task'
  | 'human_review'
  | 'stop';

export type LearningRoundResult = {
  learningRoundId: string;
  studentId: string;
  status: LearningRoundStatus;

  startResult: LearningRoundStartResult;
  executionResult: LearningRoundExecutionResult;
  taskEvidenceReturnResult?: TaskEvidenceReturnResult;

  nextStep: LearningRoundNextStep;
  nextStepReason: string;
  issues: string[];
};

export function isLearningRoundStartResult(value: unknown): value is LearningRoundStartResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as LearningRoundStartResult;
  return (
    isNonEmptyString(result.learningRoundId) &&
    isNonEmptyString(result.studentId) &&
    ['ready_for_execution', 'blocked', 'review_required'].includes(result.status) &&
    isObject(result.growthMemorySummary) &&
    isObject(result.studentAbilityProfile) &&
    isObject(result.currentLearningContext) &&
    ['start_task_execution', 'regenerate_strategy', 'regenerate_task', 'human_review', 'stop'].includes(result.nextAction) &&
    Array.isArray(result.issues) &&
    result.issues.every((issue) => typeof issue === 'string')
  );
}

export function isLearningRoundExecutionResult(value: unknown): value is LearningRoundExecutionResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as LearningRoundExecutionResult;
  return (
    isNonEmptyString(result.learningRoundId) &&
    isNonEmptyString(result.studentId) &&
    ['evidence_return_ready', 'retry_required', 'blocked', 'review_required', 'abandoned'].includes(result.status) &&
    isLearningRoundStartResult(result.startResult) &&
    typeof result.canEnterEvidenceReturn === 'boolean' &&
    ['enter_evidence_return', 'supplement_response', 'retry_task', 'human_review', 'stop'].includes(result.nextAction) &&
    Array.isArray(result.issues) &&
    result.issues.every((issue) => typeof issue === 'string')
  );
}

export function isLearningRoundResult(value: unknown): value is LearningRoundResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as LearningRoundResult;
  return (
    isNonEmptyString(result.learningRoundId) &&
    isNonEmptyString(result.studentId) &&
    ['completed', 'blocked', 'retry_required', 'review_required', 'abandoned'].includes(result.status) &&
    isLearningRoundStartResult(result.startResult) &&
    isLearningRoundExecutionResult(result.executionResult) &&
    ['continue', 'supplement_response', 'regenerate_task', 'human_review', 'stop'].includes(result.nextStep) &&
    isNonEmptyString(result.nextStepReason) &&
    Array.isArray(result.issues) &&
    result.issues.every((issue) => typeof issue === 'string')
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
