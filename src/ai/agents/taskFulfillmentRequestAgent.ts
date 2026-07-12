import type { TaskRequest } from '../schemas/nextLearningStrategy.schema.ts';
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

function buildFulfillmentRequestId(taskRequestId: string, createdAt: string): string {
  const timestamp = createdAt.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  return `fulfillment-${taskRequestId}-${timestamp}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
