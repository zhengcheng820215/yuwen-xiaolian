import type {
  NextLearningStrategy,
  StrategyValidationResult,
  TaskRequestConversionResult,
} from '../schemas/nextLearningStrategy.schema.ts';

export type TaskRequestInput = {
  strategy: NextLearningStrategy;
  validationResult: StrategyValidationResult;
  createdAt?: string;
};

export function createTaskRequest(
  input: TaskRequestInput,
): TaskRequestConversionResult {
  if (!input.validationResult.isValid || input.validationResult.nextStep !== 'create_task_request') {
    return {
      strategyId: input.strategy.strategyId,
      taskRequest: null,
      blockedReason: input.validationResult.blockedReason || 'Strategy validation did not allow TaskRequest creation.',
    };
  }

  const now = input.createdAt || new Date().toISOString();

  return {
    strategyId: input.strategy.strategyId,
    taskRequest: {
      taskRequestId: buildTaskRequestId(input.strategy.strategyId, now),
      strategyId: input.strategy.strategyId,
      studentId: input.strategy.studentId,
      targetAbilityId: input.strategy.targetAbilityId,
      taskRole: input.strategy.recommendedTaskRole,
      action: input.strategy.action,
      validationGoal: input.strategy.validationGoal,
      evidenceLinks: input.strategy.evidenceLinks,
      growthMemoryRecordIds: input.strategy.growthMemoryRecordIds,
      constraints: input.strategy.limitations,
      createdAt: now,
    },
  };
}

function buildTaskRequestId(strategyId: string, createdAt: string): string {
  const timestamp = createdAt.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  return `task-request-${strategyId}-${timestamp}`;
}
