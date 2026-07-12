import type { RecommendedTaskRole, TaskRequest } from './nextLearningStrategy.schema.ts';
import { isTaskRequest, RECOMMENDED_TASK_ROLES } from './nextLearningStrategy.schema.ts';

export type DifficultyLevel = 'lower' | 'same' | 'higher';

export type DifficultyRange = {
  preferred: DifficultyLevel;
  minimum?: DifficultyLevel;
  maximum?: DifficultyLevel;
};

export type TaskFulfillmentRequest = {
  requestId: string;
  studentId: string;
  taskRole: RecommendedTaskRole;
  targetAbilityId: string;
  contentType?: string;
  questionType?: string;
  responseMode?: string;
  difficultyRange: DifficultyRange;
  validationGoal: string;
  requiredCapabilities: string[];
  hardConstraints: string[];
  softPreferences: string[];
  recentTaskIds?: string[];
  sourceTaskRequestId: string;
  sourceStrategyId?: string;
  createdAt: string;
};

export type TaskFulfillmentRequestResult = {
  request: TaskFulfillmentRequest | null;
  blockedReason?: string;
};

export type AvailableTaskResource = {
  taskId: string;
  taskRole: RecommendedTaskRole;
  targetAbilityIds: string[];
  difficulty: DifficultyLevel;
  contentType: string;
  questionType: string;
  responseMode: string;
  capabilities: string[];
  validationTags: string[];
  source: 'mock' | 'manual' | 'generated';
  title: string;
  contentRef: string;
  questionRef?: string;
  rubricRef?: string;
};

export type TaskResourceMatchStatus =
  | 'matched'
  | 'partial_match'
  | 'no_match';

export type TaskResourceMatchResult = {
  fulfillmentRequestId: string;
  sourceTaskRequestId: string;
  status: TaskResourceMatchStatus;
  matchedTaskIds: string[];
  selectedTaskId?: string;
  matchReasons: string[];
  unmetConstraints: string[];
  unmetPreferences: string[];
};

export type ExecutableLearningTask = {
  executableTaskId: string;
  studentId: string;
  sourceType: 'resource_match' | 'generated_candidate';
  sourceTaskId?: string;
  taskRole: RecommendedTaskRole;
  targetAbilityId: string;
  validationGoal: string;
  contentRef: string;
  questionRef?: string;
  rubricRef?: string;
  sourceStrategyId?: string;
  sourceTaskRequestId: string;
  sourceFulfillmentRequestId: string;
  limitations: string[];
  createdAt: string;
};

export type TaskGenerationRequest = {
  generationRequestId: string;
  taskRole: RecommendedTaskRole;
  targetAbilityId: string;
  validationGoal: string;
  difficultyPreference: DifficultyLevel;
  contentConstraints: string[];
  answerRequirements: string[];
  evaluationRequirements: string[];
  sourceTaskRequestId: string;
  sourceFulfillmentRequestId: string;
  sourceStrategyId?: string;
  createdAt: string;
};

export type TaskFulfillmentBranchResult = {
  fulfillmentRequestId: string;
  executableTask: ExecutableLearningTask | null;
  generationRequest: TaskGenerationRequest | null;
  blockedReason?: string;
};

export function isTaskFulfillmentRequest(value: unknown): value is TaskFulfillmentRequest {
  if (!value || typeof value !== 'object') return false;

  const request = value as TaskFulfillmentRequest;
  return (
    isNonEmptyString(request.requestId) &&
    isNonEmptyString(request.studentId) &&
    RECOMMENDED_TASK_ROLES.includes(request.taskRole) &&
    isNonEmptyString(request.targetAbilityId) &&
    (request.contentType === undefined || isNonEmptyString(request.contentType)) &&
    (request.questionType === undefined || isNonEmptyString(request.questionType)) &&
    (request.responseMode === undefined || isNonEmptyString(request.responseMode)) &&
    isDifficultyRange(request.difficultyRange) &&
    isNonEmptyString(request.validationGoal) &&
    nonEmptyStringArray(request.requiredCapabilities) &&
    nonEmptyStringArray(request.hardConstraints) &&
    Array.isArray(request.softPreferences) &&
    request.softPreferences.every((item) => typeof item === 'string') &&
    (request.recentTaskIds === undefined || (
      Array.isArray(request.recentTaskIds) &&
      request.recentTaskIds.every(isNonEmptyString)
    )) &&
    isNonEmptyString(request.sourceTaskRequestId) &&
    (request.sourceStrategyId === undefined || isNonEmptyString(request.sourceStrategyId)) &&
    isNonEmptyString(request.createdAt)
  );
}

export function isTaskResourceMatchResult(value: unknown): value is TaskResourceMatchResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as TaskResourceMatchResult;
  return (
    isNonEmptyString(result.fulfillmentRequestId) &&
    isNonEmptyString(result.sourceTaskRequestId) &&
    ['matched', 'partial_match', 'no_match'].includes(result.status) &&
    Array.isArray(result.matchedTaskIds) &&
    result.matchedTaskIds.every(isNonEmptyString) &&
    (result.selectedTaskId === undefined || isNonEmptyString(result.selectedTaskId)) &&
    nonEmptyStringArray(result.matchReasons) &&
    Array.isArray(result.unmetConstraints) &&
    result.unmetConstraints.every((item) => typeof item === 'string') &&
    Array.isArray(result.unmetPreferences) &&
    result.unmetPreferences.every((item) => typeof item === 'string') &&
    (result.status !== 'matched' || isNonEmptyString(result.selectedTaskId))
  );
}

export function isExecutableLearningTask(value: unknown): value is ExecutableLearningTask {
  if (!value || typeof value !== 'object') return false;

  const task = value as ExecutableLearningTask;
  return (
    isNonEmptyString(task.executableTaskId) &&
    isNonEmptyString(task.studentId) &&
    ['resource_match', 'generated_candidate'].includes(task.sourceType) &&
    (task.sourceTaskId === undefined || isNonEmptyString(task.sourceTaskId)) &&
    RECOMMENDED_TASK_ROLES.includes(task.taskRole) &&
    isNonEmptyString(task.targetAbilityId) &&
    isNonEmptyString(task.validationGoal) &&
    isNonEmptyString(task.contentRef) &&
    (task.questionRef === undefined || isNonEmptyString(task.questionRef)) &&
    (task.rubricRef === undefined || isNonEmptyString(task.rubricRef)) &&
    (task.sourceStrategyId === undefined || isNonEmptyString(task.sourceStrategyId)) &&
    isNonEmptyString(task.sourceTaskRequestId) &&
    isNonEmptyString(task.sourceFulfillmentRequestId) &&
    Array.isArray(task.limitations) &&
    task.limitations.every((item) => typeof item === 'string') &&
    isNonEmptyString(task.createdAt)
  );
}

export function isTaskGenerationRequest(value: unknown): value is TaskGenerationRequest {
  if (!value || typeof value !== 'object') return false;

  const request = value as TaskGenerationRequest;
  return (
    isNonEmptyString(request.generationRequestId) &&
    RECOMMENDED_TASK_ROLES.includes(request.taskRole) &&
    isNonEmptyString(request.targetAbilityId) &&
    isNonEmptyString(request.validationGoal) &&
    ['lower', 'same', 'higher'].includes(request.difficultyPreference) &&
    nonEmptyStringArray(request.contentConstraints) &&
    nonEmptyStringArray(request.answerRequirements) &&
    nonEmptyStringArray(request.evaluationRequirements) &&
    isNonEmptyString(request.sourceTaskRequestId) &&
    isNonEmptyString(request.sourceFulfillmentRequestId) &&
    (request.sourceStrategyId === undefined || isNonEmptyString(request.sourceStrategyId)) &&
    isNonEmptyString(request.createdAt)
  );
}

export function canFulfillTaskRequest(value: unknown): value is TaskRequest {
  return isTaskRequest(value);
}

function isDifficultyRange(value: unknown): value is DifficultyRange {
  if (!value || typeof value !== 'object') return false;

  const range = value as DifficultyRange;
  return (
    ['lower', 'same', 'higher'].includes(range.preferred) &&
    (range.minimum === undefined || ['lower', 'same', 'higher'].includes(range.minimum)) &&
    (range.maximum === undefined || ['lower', 'same', 'higher'].includes(range.maximum))
  );
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
