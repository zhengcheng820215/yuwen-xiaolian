import type {
  AvailableTaskResource,
  ExecutableLearningTask,
  TaskFulfillmentBranchResult,
  TaskFulfillmentRequest,
  TaskGenerationRequest,
  TaskResourceMatchResult,
} from '../schemas/taskFulfillment.schema.ts';

export type TaskFulfillmentBranchInput = {
  fulfillmentRequest: TaskFulfillmentRequest;
  matchResult: TaskResourceMatchResult;
  availableTaskResources: AvailableTaskResource[];
  createdAt?: string;
};

export function branchTaskFulfillment(
  input: TaskFulfillmentBranchInput,
): TaskFulfillmentBranchResult {
  if (input.matchResult.status === 'matched') {
    const resource = input.availableTaskResources.find((item) => item.taskId === input.matchResult.selectedTaskId);
    if (!resource) {
      return {
        fulfillmentRequestId: input.fulfillmentRequest.requestId,
        executableTask: null,
        generationRequest: buildGenerationRequest(input, 'matched resource was not found'),
        blockedReason: 'Selected resource is missing.',
      };
    }

    return {
      fulfillmentRequestId: input.fulfillmentRequest.requestId,
      executableTask: buildExecutableLearningTask(input, resource),
      generationRequest: null,
    };
  }

  if (input.matchResult.status === 'partial_match') {
    return {
      fulfillmentRequestId: input.fulfillmentRequest.requestId,
      executableTask: null,
      generationRequest: buildGenerationRequest(input, 'partial match requires review or generation request'),
      blockedReason: 'partial_match is not automatically executable.',
    };
  }

  return {
    fulfillmentRequestId: input.fulfillmentRequest.requestId,
    executableTask: null,
    generationRequest: buildGenerationRequest(input, 'no matching resource'),
    blockedReason: 'no_match requires generation request.',
  };
}

function buildExecutableLearningTask(
  input: TaskFulfillmentBranchInput,
  resource: AvailableTaskResource,
): ExecutableLearningTask {
  const now = input.createdAt || new Date().toISOString();

  return {
    executableTaskId: `executable-${input.fulfillmentRequest.requestId}-${resource.taskId}`,
    studentId: input.fulfillmentRequest.studentId,
    sourceType: 'resource_match',
    sourceTaskId: resource.taskId,
    taskRole: input.fulfillmentRequest.taskRole,
    targetAbilityId: input.fulfillmentRequest.targetAbilityId,
    validationGoal: input.fulfillmentRequest.validationGoal,
    contentRef: resource.contentRef,
    questionRef: resource.questionRef,
    rubricRef: resource.rubricRef,
    sourceStrategyId: input.fulfillmentRequest.sourceStrategyId,
    sourceTaskRequestId: input.fulfillmentRequest.sourceTaskRequestId,
    sourceFulfillmentRequestId: input.fulfillmentRequest.requestId,
    limitations: ['ExecutableLearningTask 表示可执行封装，不代表题目质量已正式合格。'],
    createdAt: now,
  };
}

function buildGenerationRequest(
  input: TaskFulfillmentBranchInput,
  reason: string,
): TaskGenerationRequest {
  const now = input.createdAt || new Date().toISOString();

  return {
    generationRequestId: `generation-${input.fulfillmentRequest.requestId}-${input.matchResult.status}`,
    taskRole: input.fulfillmentRequest.taskRole,
    targetAbilityId: input.fulfillmentRequest.targetAbilityId,
    validationGoal: input.fulfillmentRequest.validationGoal,
    difficultyPreference: input.fulfillmentRequest.difficultyRange.preferred,
    contentConstraints: unique([
      input.fulfillmentRequest.contentType ? `contentType:${input.fulfillmentRequest.contentType}` : '',
      input.fulfillmentRequest.questionType ? `questionType:${input.fulfillmentRequest.questionType}` : '',
      ...input.fulfillmentRequest.hardConstraints,
    ]),
    answerRequirements: unique([
      input.fulfillmentRequest.responseMode ? `responseMode:${input.fulfillmentRequest.responseMode}` : '',
      ...input.fulfillmentRequest.requiredCapabilities.map((capability) => `capability:${capability}`),
    ]),
    evaluationRequirements: unique([
      input.fulfillmentRequest.validationGoal,
      reason,
      ...input.matchResult.unmetConstraints,
      ...input.matchResult.unmetPreferences,
    ]),
    sourceTaskRequestId: input.fulfillmentRequest.sourceTaskRequestId,
    sourceFulfillmentRequestId: input.fulfillmentRequest.requestId,
    sourceStrategyId: input.fulfillmentRequest.sourceStrategyId,
    createdAt: now,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
