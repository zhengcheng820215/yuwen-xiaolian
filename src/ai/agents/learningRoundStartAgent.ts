import { instantiateConcreteLearningTask } from './concreteLearningTaskAgent.ts';
import { generateNextLearningStrategy } from './nextLearningStrategyAgent.ts';
import { validateNextLearningStrategy } from './strategyValidationAgent.ts';
import { branchTaskFulfillment } from './taskFulfillmentBranchingAgent.ts';
import { createTaskFulfillmentRequest } from './taskFulfillmentRequestAgent.ts';
import { createTaskRequest } from './taskRequestAgent.ts';
import { matchTaskResources } from './taskResourceMatchingAgent.ts';
import type { ConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import type { GrowthMemorySummary } from '../schemas/growthMemory.schema.ts';
import type {
  CurrentLearningContext,
  NextLearningStrategy,
  StrategyValidationNextStep,
} from '../schemas/nextLearningStrategy.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import type { AvailableTaskResource } from '../schemas/taskFulfillment.schema.ts';
import type {
  LearningRoundStartNextAction,
  LearningRoundStartResult,
  LearningRoundStartStatus,
} from '../schemas/learningRound.schema.ts';

export type LearningRoundStartInput = {
  studentAbilityProfile: StudentAbilityProfile;
  growthMemorySummary: GrowthMemorySummary;
  currentLearningContext: CurrentLearningContext;
  availableTaskResources: AvailableTaskResource[];
  learningRoundId?: string;
  createdAt?: string;
  recentTaskIds?: string[];
  strategyOverride?: NextLearningStrategy;
  concreteTaskOverrides?: Partial<ConcreteLearningTask>;
  simulateNoTaskFulfillment?: boolean;
};

export function startLearningRound(input: LearningRoundStartInput): LearningRoundStartResult {
  const createdAt = input.createdAt || new Date().toISOString();
  const studentId = input.studentAbilityProfile.studentId;
  const learningRoundId = input.learningRoundId || buildLearningRoundId(studentId, createdAt);
  const base = buildBaseResult(input, learningRoundId, studentId);
  const inputIssues = validateStartInput(input);

  if (inputIssues.length > 0) {
    return {
      ...base,
      status: inputIssues.some((issue) => issue.includes('studentId')) ? 'review_required' : 'blocked',
      nextAction: inputIssues.some((issue) => issue.includes('studentId')) ? 'human_review' : 'regenerate_strategy',
      issues: inputIssues,
    };
  }

  const nextLearningStrategy = input.strategyOverride || generateNextLearningStrategy({
    growthMemorySummary: input.growthMemorySummary,
    studentAbilityProfile: input.studentAbilityProfile,
    currentLearningContext: input.currentLearningContext,
    createdAt,
  });

  const strategyValidationResult = validateNextLearningStrategy({
    strategy: nextLearningStrategy,
    currentLearningContext: input.currentLearningContext,
    validatedAt: createdAt,
  });

  if (!strategyValidationResult.isValid) {
    return {
      ...base,
      nextLearningStrategy,
      strategyValidationResult,
      status: statusFromStrategyValidation(strategyValidationResult.nextStep),
      nextAction: actionFromStrategyValidation(strategyValidationResult.nextStep),
      issues: collectIssues(strategyValidationResult.validationErrors, strategyValidationResult.blockedReason),
    };
  }

  const taskRequestResult = createTaskRequest({
    strategy: nextLearningStrategy,
    validationResult: strategyValidationResult,
    createdAt,
  });

  if (!taskRequestResult.taskRequest) {
    return {
      ...base,
      nextLearningStrategy,
      strategyValidationResult,
      status: 'blocked',
      nextAction: 'regenerate_strategy',
      issues: collectIssues([taskRequestResult.blockedReason || 'TaskRequest could not be created.']),
    };
  }

  const fulfillmentRequestResult = createTaskFulfillmentRequest({
    taskRequest: taskRequestResult.taskRequest,
    recentTaskIds: input.recentTaskIds,
    createdAt,
  });

  if (!fulfillmentRequestResult.request) {
    return {
      ...base,
      nextLearningStrategy,
      strategyValidationResult,
      taskRequest: taskRequestResult.taskRequest,
      status: 'blocked',
      nextAction: 'regenerate_task',
      issues: collectIssues([fulfillmentRequestResult.blockedReason || 'TaskFulfillmentRequest could not be created.']),
    };
  }

  const taskResourceMatchResult = matchTaskResources({
    fulfillmentRequest: fulfillmentRequestResult.request,
    availableTaskResources: input.availableTaskResources,
  });

  const branchResult = input.simulateNoTaskFulfillment
    ? {
      fulfillmentRequestId: fulfillmentRequestResult.request.requestId,
      executableTask: null,
      generationRequest: null,
      blockedReason: 'Simulated: no executable task or generation request is available.',
    }
    : branchTaskFulfillment({
      fulfillmentRequest: fulfillmentRequestResult.request,
      matchResult: taskResourceMatchResult,
      availableTaskResources: input.availableTaskResources,
      createdAt,
    });

  if (!branchResult.executableTask && !branchResult.generationRequest) {
    return {
      ...base,
      nextLearningStrategy,
      strategyValidationResult,
      taskRequest: taskRequestResult.taskRequest,
      taskFulfillmentRequest: fulfillmentRequestResult.request,
      taskResourceMatchResult,
      status: 'blocked',
      nextAction: 'regenerate_task',
      issues: collectIssues([branchResult.blockedReason || 'Task fulfillment did not produce executable task or generation request.']),
    };
  }

  const concreteTaskResult = instantiateConcreteLearningTask({
    executableTask: branchResult.executableTask,
    generationRequest: branchResult.generationRequest,
    studentId,
    createdAt,
    overrides: input.concreteTaskOverrides,
  });

  if (!concreteTaskResult.concreteTask || !concreteTaskResult.readiness.canExecute) {
    return {
      ...base,
      nextLearningStrategy,
      strategyValidationResult,
      taskRequest: taskRequestResult.taskRequest,
      taskFulfillmentRequest: fulfillmentRequestResult.request,
      taskResourceMatchResult,
      executableTask: branchResult.executableTask || undefined,
      taskGenerationRequest: branchResult.generationRequest || undefined,
      concreteTask: concreteTaskResult.concreteTask || undefined,
      taskReadinessValidation: concreteTaskResult.readiness,
      status: 'blocked',
      nextAction: 'regenerate_task',
      issues: collectIssues(concreteTaskResult.readiness.issues.map((issue) => issue.message)),
    };
  }

  return {
    ...base,
    nextLearningStrategy,
    strategyValidationResult,
    taskRequest: taskRequestResult.taskRequest,
    taskFulfillmentRequest: fulfillmentRequestResult.request,
    taskResourceMatchResult,
    executableTask: branchResult.executableTask || undefined,
    taskGenerationRequest: branchResult.generationRequest || undefined,
    concreteTask: concreteTaskResult.concreteTask,
    taskReadinessValidation: concreteTaskResult.readiness,
    status: 'ready_for_execution',
    nextAction: 'start_task_execution',
    issues: [],
  };
}

function buildBaseResult(
  input: LearningRoundStartInput,
  learningRoundId: string,
  studentId: string,
): Pick<
  LearningRoundStartResult,
  | 'learningRoundId'
  | 'studentId'
  | 'growthMemorySummary'
  | 'studentAbilityProfile'
  | 'currentLearningContext'
> {
  return {
    learningRoundId,
    studentId,
    growthMemorySummary: input.growthMemorySummary,
    studentAbilityProfile: input.studentAbilityProfile,
    currentLearningContext: input.currentLearningContext,
  };
}

function validateStartInput(input: LearningRoundStartInput): string[] {
  const issues: string[] = [];
  const studentIds = [
    input.studentAbilityProfile.studentId,
    input.growthMemorySummary.studentId,
    input.currentLearningContext.studentId,
  ].filter(Boolean);

  if (new Set(studentIds).size > 1) {
    issues.push('studentId mismatch across profile, growth memory, and current context.');
  }
  if (!input.growthMemorySummary.latestRecordId || input.growthMemorySummary.recordCount <= 0) {
    issues.push('GrowthMemorySummary does not contain enough records to generate a trustworthy strategy.');
  }
  if (!input.growthMemorySummary.evidenceLinks.length) {
    issues.push('GrowthMemorySummary does not contain evidence links.');
  }
  if (!input.studentAbilityProfile.evidence_links.length) {
    issues.push('StudentAbilityProfile does not contain evidence links.');
  }
  if (input.currentLearningContext.targetAbilityId && input.currentLearningContext.targetAbilityId !== input.growthMemorySummary.abilityId) {
    issues.push('CurrentLearningContext targetAbilityId does not match GrowthMemorySummary abilityId.');
  }

  return issues;
}

function statusFromStrategyValidation(nextStep: StrategyValidationNextStep): LearningRoundStartStatus {
  if (nextStep === 'review_required') return 'review_required';
  return 'blocked';
}

function actionFromStrategyValidation(nextStep: StrategyValidationNextStep): LearningRoundStartNextAction {
  if (nextStep === 'review_required') return 'human_review';
  if (nextStep === 'regenerate_strategy') return 'regenerate_strategy';
  return 'stop';
}

function collectIssues(issues: Array<string | undefined>, fallback = 'Learning round start was blocked.'): string[] {
  const cleanIssues = issues
    .map((issue) => issue?.trim())
    .filter((issue): issue is string => Boolean(issue));

  return cleanIssues.length > 0 ? cleanIssues : [fallback];
}

function buildLearningRoundId(studentId: string, createdAt: string): string {
  const timestamp = createdAt.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17);
  return `learning-round-${studentId}-${timestamp}`;
}
