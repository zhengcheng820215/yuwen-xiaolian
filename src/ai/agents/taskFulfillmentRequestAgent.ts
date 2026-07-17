import type { TaskRequest } from '../schemas/nextLearningStrategy.schema.ts';
import type {
  AdaptiveConstraintRule,
  AdaptiveTaskRequestEnvelope,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import { isAdaptiveTaskRequestEnvelope } from '../schemas/adaptiveTaskConstraints.schema.ts';
import type {
  DifficultyLevel,
  TaskFulfillmentRequest,
  TaskFulfillmentRequestResult,
} from '../schemas/taskFulfillment.schema.ts';
import { canFulfillTaskRequest } from '../schemas/taskFulfillment.schema.ts';

export type TaskFulfillmentRequestInput = {
  taskRequest: unknown;
  recentTaskIds?: string[];
  createdAt?: string;
};

export type AdaptiveTaskFulfillmentRequestInput = {
  adaptiveTaskRequestEnvelope: AdaptiveTaskRequestEnvelope;
  recentTaskIds?: string[];
  createdAt?: string;
};

export function createTaskFulfillmentRequest(
  input: TaskFulfillmentRequestInput,
): TaskFulfillmentRequestResult {
  if (!canFulfillTaskRequest(input.taskRequest)) {
    return {
      request: null,
      blockedReason: 'TaskRequest is missing required fields or failed schema validation.',
    };
  }

  const taskRequest = input.taskRequest;
  const now = input.createdAt || new Date().toISOString();
  const requiredCapabilities = inferRequiredCapabilities(taskRequest);
  const hardConstraints = buildHardConstraints(taskRequest, requiredCapabilities);
  const softPreferences = buildSoftPreferences(taskRequest);

  return {
    request: {
      requestId: buildFulfillmentRequestId(taskRequest.taskRequestId, now),
      studentId: taskRequest.studentId,
      taskRole: taskRequest.taskRole,
      targetAbilityId: taskRequest.targetAbilityId,
      contentType: inferContentType(taskRequest),
      questionType: 'open_response',
      responseMode: 'written',
      difficultyRange: inferDifficultyRange(taskRequest),
      validationGoal: taskRequest.validationGoal,
      requiredCapabilities,
      hardConstraints,
      softPreferences,
      recentTaskIds: input.recentTaskIds || [],
      sourceTaskRequestId: taskRequest.taskRequestId,
      sourceStrategyId: taskRequest.strategyId,
      createdAt: now,
    },
  };
}

export function createAdaptiveTaskFulfillmentRequest(
  input: AdaptiveTaskFulfillmentRequestInput,
): TaskFulfillmentRequestResult {
  const envelope = input.adaptiveTaskRequestEnvelope;
  if (
    !isAdaptiveTaskRequestEnvelope(envelope) ||
    !envelope.validation.passed ||
    !envelope.canEnterTaskFulfillment ||
    envelope.alignmentResult.status !== 'aligned'
  ) {
    return {
      request: null,
      blockedReason: 'AdaptiveTaskRequestEnvelope is invalid or not approved for TaskFulfillment.',
    };
  }

  const { taskRequest, adaptiveConstraints } = envelope;
  if (
    adaptiveConstraints.preExecutionQualityConditions.requiredHintPolicy !== adaptiveConstraints.hintPolicy ||
    adaptiveConstraints.recommendedTaskRole !== taskRequest.taskRole ||
    adaptiveConstraints.targetAbilityId !== taskRequest.targetAbilityId
  ) {
    return {
      request: null,
      blockedReason: 'Adaptive task constraints are not aligned with the TaskRequest.',
    };
  }

  const now = input.createdAt || new Date().toISOString();
  const hardConstraints = adaptiveConstraints.hardConstraints.map(serializeAdaptiveRule);
  const softPreferences = adaptiveConstraints.softPreferences.map(serializeAdaptiveRule);
  const excludedRecentTaskIds = adaptiveConstraints.hardConstraints
    .concat(adaptiveConstraints.softPreferences)
    .filter((rule) => rule.code === 'exclude_task')
    .flatMap((rule) => Array.isArray(rule.value) ? rule.value : [String(rule.value)]);

  return {
    request: {
      requestId: `adaptive-fulfillment-${taskRequest.taskRequestId}-${adaptiveConstraints.constraintsId}`,
      studentId: taskRequest.studentId,
      taskRole: taskRequest.taskRole,
      targetAbilityId: taskRequest.targetAbilityId,
      contentType: mapAdaptiveContentType(adaptiveConstraints.materialNovelty),
      questionType: 'open_response',
      responseMode: 'written',
      difficultyRange: mapAdaptiveDifficulty(adaptiveConstraints.difficultyDirection),
      validationGoal: taskRequest.validationGoal,
      requiredCapabilities: unique(adaptiveConstraints.requiredCapabilities),
      hardConstraints: unique([
        `adaptiveConstraintsId:${adaptiveConstraints.constraintsId}`,
        ...hardConstraints,
      ]),
      softPreferences: unique(softPreferences),
      recentTaskIds: unique([...(input.recentTaskIds || []), ...excludedRecentTaskIds]),
      sourceTaskRequestId: taskRequest.taskRequestId,
      sourceStrategyId: taskRequest.strategyId,
      createdAt: now,
    },
  };
}

function inferRequiredCapabilities(taskRequest: TaskRequest): string[] {
  const capabilities = ['open_response', 'ability_observation'];

  if (taskRequest.targetAbilityId.includes('推理') || taskRequest.validationGoal.includes('推理')) {
    capabilities.push('text_evidence', 'inference_chain');
  }
  if (taskRequest.taskRole === 'transfer') capabilities.push('new_context_transfer');
  if (taskRequest.taskRole === 'retest') capabilities.push('independent_answer');
  if (taskRequest.taskRole === 'diagnosis') capabilities.push('root_cause_probe');
  if (taskRequest.taskRole === 'training') capabilities.push('focused_practice');

  return unique(capabilities);
}

function buildHardConstraints(taskRequest: TaskRequest, requiredCapabilities: string[]): string[] {
  return [
    `taskRole:${taskRequest.taskRole}`,
    `targetAbilityId:${taskRequest.targetAbilityId}`,
    'responseMode:written',
    'questionType:open_response',
    ...requiredCapabilities.map((capability) => `capability:${capability}`),
  ];
}

function buildSoftPreferences(taskRequest: TaskRequest): string[] {
  const preferences = ['difficulty:same', 'avoid_recent_tasks'];

  if (taskRequest.taskRole === 'transfer') preferences.push('contentType:new_text');
  if (taskRequest.taskRole === 'retest') preferences.push('minimal_hinting');
  if (taskRequest.taskRole === 'training') preferences.push('short_text');

  return unique([...preferences, ...taskRequest.constraints]);
}

function inferContentType(taskRequest: TaskRequest): string {
  if (taskRequest.taskRole === 'transfer') return 'new_text';
  if (taskRequest.taskRole === 'retest') return 'comparable_text';
  if (taskRequest.taskRole === 'training') return 'short_text';
  return 'diagnostic_text';
}

function inferDifficultyRange(taskRequest: TaskRequest): {
  preferred: DifficultyLevel;
  minimum?: DifficultyLevel;
  maximum?: DifficultyLevel;
} {
  if (taskRequest.action === 'lower_difficulty_training') {
    return { preferred: 'lower', minimum: 'lower', maximum: 'same' };
  }
  if (taskRequest.action === 'transfer_test') {
    return { preferred: 'same', minimum: 'same', maximum: 'higher' };
  }
  return { preferred: 'same', minimum: 'lower', maximum: 'higher' };
}

function mapAdaptiveContentType(
  novelty: AdaptiveTaskRequestEnvelope['adaptiveConstraints']['materialNovelty'],
): string {
  if (novelty === 'new_context') return 'new_text';
  if (novelty === 'similar_context') return 'comparable_text';
  return 'same_context_text';
}

function mapAdaptiveDifficulty(
  direction: AdaptiveTaskRequestEnvelope['adaptiveConstraints']['difficultyDirection'],
): { preferred: DifficultyLevel; minimum?: DifficultyLevel; maximum?: DifficultyLevel } {
  if (direction === 'decrease') return { preferred: 'lower', minimum: 'lower', maximum: 'same' };
  if (direction === 'increase') return { preferred: 'higher', minimum: 'same', maximum: 'higher' };
  return { preferred: 'same', minimum: 'lower', maximum: 'same' };
}

function serializeAdaptiveRule(rule: AdaptiveConstraintRule): string {
  const value = Array.isArray(rule.value) ? [...rule.value].sort().join(',') : String(rule.value);
  return `${rule.code}:${rule.operator}:${value}:${rule.source}`;
}

function buildFulfillmentRequestId(taskRequestId: string, createdAt: string): string {
  const timestamp = createdAt.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  return `fulfillment-${taskRequestId}-${timestamp}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
