import type {
  AvailableTaskResource,
  TaskFulfillmentRequest,
  TaskResourceMatchResult,
} from '../schemas/taskFulfillment.schema.ts';

export type TaskResourceMatchingInput = {
  fulfillmentRequest: TaskFulfillmentRequest;
  availableTaskResources: AvailableTaskResource[];
};

type CandidateScore = {
  resource: AvailableTaskResource;
  unmetConstraints: string[];
  unmetPreferences: string[];
  reasons: string[];
};

export function matchTaskResources(
  input: TaskResourceMatchingInput,
): TaskResourceMatchResult {
  const candidates = input.availableTaskResources.map((resource) => scoreResource(input.fulfillmentRequest, resource));
  const hardMatched = candidates.filter((candidate) => candidate.unmetConstraints.length === 0);

  if (hardMatched.length === 0) {
    return {
      fulfillmentRequestId: input.fulfillmentRequest.requestId,
      sourceTaskRequestId: input.fulfillmentRequest.sourceTaskRequestId,
      status: 'no_match',
      matchedTaskIds: [],
      matchReasons: ['没有资源满足全部硬约束。'],
      unmetConstraints: inferCommonUnmetConstraints(candidates),
      unmetPreferences: [],
    };
  }

  const fullMatched = hardMatched.filter((candidate) => candidate.unmetPreferences.length === 0);
  const selected = pickBestCandidate(fullMatched.length > 0 ? fullMatched : hardMatched);
  const status = fullMatched.length > 0 ? 'matched' : 'partial_match';

  return {
    fulfillmentRequestId: input.fulfillmentRequest.requestId,
    sourceTaskRequestId: input.fulfillmentRequest.sourceTaskRequestId,
    status,
    matchedTaskIds: hardMatched.map((candidate) => candidate.resource.taskId),
    selectedTaskId: status === 'matched' ? selected.resource.taskId : undefined,
    matchReasons: selected.reasons,
    unmetConstraints: selected.unmetConstraints,
    unmetPreferences: selected.unmetPreferences,
  };
}

function scoreResource(
  request: TaskFulfillmentRequest,
  resource: AvailableTaskResource,
): CandidateScore {
  const unmetConstraints: string[] = [];
  const unmetPreferences: string[] = [];
  const reasons: string[] = [];

  if (resource.taskRole !== request.taskRole) unmetConstraints.push(`taskRole mismatch: ${resource.taskRole}`);
  else reasons.push('taskRole matches.');

  if (!resource.targetAbilityIds.includes(request.targetAbilityId)) unmetConstraints.push(`targetAbilityId not supported: ${request.targetAbilityId}`);
  else reasons.push('targetAbilityId matches.');

  if (request.responseMode && resource.responseMode !== request.responseMode) unmetConstraints.push(`responseMode mismatch: ${resource.responseMode}`);
  else reasons.push('responseMode matches.');

  if (request.questionType && resource.questionType !== request.questionType) unmetConstraints.push(`questionType mismatch: ${resource.questionType}`);
  else reasons.push('questionType matches.');

  const missingCapabilities = request.requiredCapabilities.filter((capability) => !resource.capabilities.includes(capability));
  if (missingCapabilities.length > 0) unmetConstraints.push(`missing capabilities: ${missingCapabilities.join(', ')}`);
  else reasons.push('requiredCapabilities are covered.');

  if (!supportsValidationGoal(request, resource)) unmetConstraints.push('validationGoal is not supported by resource.');
  else reasons.push('validationGoal is supported.');

  if (resource.difficulty !== request.difficultyRange.preferred) unmetPreferences.push(`difficulty preferred ${request.difficultyRange.preferred}, got ${resource.difficulty}`);
  if (request.contentType && resource.contentType !== request.contentType) unmetPreferences.push(`contentType preferred ${request.contentType}, got ${resource.contentType}`);
  if (request.recentTaskIds?.includes(resource.taskId)) unmetPreferences.push(`recentTaskIds contains ${resource.taskId}`);

  return {
    resource,
    unmetConstraints,
    unmetPreferences,
    reasons,
  };
}

function supportsValidationGoal(
  request: TaskFulfillmentRequest,
  resource: AvailableTaskResource,
): boolean {
  if (resource.validationTags.includes('general_validation')) return true;
  if (request.taskRole === 'transfer') return resource.validationTags.includes('transfer_validation');
  if (request.taskRole === 'retest') return resource.validationTags.includes('independent_retest');
  if (request.taskRole === 'diagnosis') return resource.validationTags.includes('diagnostic_probe');
  if (request.taskRole === 'training') return resource.validationTags.includes('focused_training');
  return true;
}

function pickBestCandidate(candidates: CandidateScore[]): CandidateScore {
  return candidates
    .slice()
    .sort((a, b) => a.unmetPreferences.length - b.unmetPreferences.length)[0];
}

function inferCommonUnmetConstraints(candidates: CandidateScore[]): string[] {
  const constraints = candidates.flatMap((candidate) => candidate.unmetConstraints);
  return unique(constraints.length > 0 ? constraints : ['no available resources']);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
