import { validateNextLearningStrategy } from '../agents/strategyValidationAgent.ts';
import { createTaskRequest } from '../agents/taskRequestAgent.ts';
import type { TaskRequest } from '../schemas/nextLearningStrategy.schema.ts';
import type {
  AvailableTaskResource,
  TaskFulfillmentRequest,
} from '../schemas/taskFulfillment.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildStrategyFixture,
  phase83RunAt,
} from './nextLearningStrategyDebugFixtures.ts';

export const phase84RunAt = '2026-07-12T10:20:00.000Z';

export function buildTaskRequestFixture(
  overrides: Partial<TaskRequest> = {},
): TaskRequest {
  const strategy = buildStrategyFixture({
    action: overrides.action || 'independent_retest',
    recommendedTaskRole: overrides.taskRole || 'retest',
  });
  const context = buildCurrentLearningContextFixture();
  const validationResult = validateNextLearningStrategy({
    strategy,
    currentLearningContext: context,
    validatedAt: phase83RunAt,
  });
  const conversionResult = createTaskRequest({
    strategy,
    validationResult,
    createdAt: phase83RunAt,
  });

  if (!conversionResult.taskRequest) {
    throw new Error('TaskRequest fixture could not be created.');
  }

  return {
    ...conversionResult.taskRequest,
    ...overrides,
  };
}

export function buildFulfillmentRequestFixture(
  overrides: Partial<TaskFulfillmentRequest> = {},
): TaskFulfillmentRequest {
  return {
    requestId: 'fulfillment-debug',
    studentId: 'demo-student',
    taskRole: 'retest',
    targetAbilityId: '推理',
    contentType: 'comparable_text',
    questionType: 'open_response',
    responseMode: 'written',
    difficultyRange: {
      preferred: 'same',
      minimum: 'lower',
      maximum: 'higher',
    },
    validationGoal: '验证推理是否能独立完成。',
    requiredCapabilities: ['open_response', 'ability_observation', 'text_evidence', 'inference_chain', 'independent_answer'],
    hardConstraints: ['taskRole:retest', 'targetAbilityId:推理', 'responseMode:written', 'questionType:open_response'],
    softPreferences: ['difficulty:same', 'avoid_recent_tasks'],
    recentTaskIds: [],
    sourceTaskRequestId: 'task-request-debug',
    sourceStrategyId: 'next-strategy-debug',
    createdAt: phase84RunAt,
    ...overrides,
  };
}

export function buildMockTaskResources(): AvailableTaskResource[] {
  return [
    {
      taskId: 'task_matched_retest_reasoning',
      taskRole: 'retest',
      targetAbilityIds: ['推理'],
      difficulty: 'same',
      contentType: 'comparable_text',
      questionType: 'open_response',
      responseMode: 'written',
      capabilities: ['open_response', 'ability_observation', 'text_evidence', 'inference_chain', 'independent_answer'],
      validationTags: ['independent_retest'],
      source: 'mock',
      title: '同能力独立复测任务',
      contentRef: 'mock://content/retest-reasoning-001',
      questionRef: 'mock://question/retest-reasoning-001',
      rubricRef: 'mock://rubric/retest-reasoning-001',
    },
    {
      taskId: 'task_partial_retest_reasoning',
      taskRole: 'retest',
      targetAbilityIds: ['推理'],
      difficulty: 'higher',
      contentType: 'different_text_type',
      questionType: 'open_response',
      responseMode: 'written',
      capabilities: ['open_response', 'ability_observation', 'text_evidence', 'inference_chain', 'independent_answer'],
      validationTags: ['independent_retest'],
      source: 'mock',
      title: '部分匹配复测任务',
      contentRef: 'mock://content/retest-reasoning-partial',
      questionRef: 'mock://question/retest-reasoning-partial',
      rubricRef: 'mock://rubric/retest-reasoning-partial',
    },
    {
      taskId: 'task_training_expression',
      taskRole: 'training',
      targetAbilityIds: ['表达'],
      difficulty: 'same',
      contentType: 'short_text',
      questionType: 'open_response',
      responseMode: 'written',
      capabilities: ['open_response', 'ability_observation', 'focused_practice'],
      validationTags: ['focused_training'],
      source: 'mock',
      title: '表达训练任务',
      contentRef: 'mock://content/expression-training-001',
    },
  ];
}
