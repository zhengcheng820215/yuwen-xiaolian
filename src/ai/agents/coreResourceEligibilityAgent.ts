import { isAdaptiveTaskRequestEnvelope } from '../schemas/adaptiveTaskConstraints.schema.ts';
import type {
  FrozenQuestionResourceVersion,
  ResourceRegistryEntry,
  ResourceReviewDecision,
  ResourceValidationResult,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  CORE_RESOURCE_ELIGIBILITY_POLICY_VERSION,
  RESOURCE_MATCH_QUALITY_SCHEMA_VERSION,
  isResourceEligibilitySnapshot,
  type CoreResourceCandidateEvaluation,
  type CoreResourceEligibilityInput,
  type CoreResourceEligibilityResult,
  type ReviewedResourceMatchCandidate,
} from '../schemas/resourceMatchQuality.schema.ts';
import { isTaskFulfillmentRequest } from '../schemas/taskFulfillment.schema.ts';
import { isSingleChoiceInteraction } from '../schemas/singleChoiceInteraction.schema.ts';
import {
  adaptReviewedResourceCandidate,
  buildStableId,
} from './reviewedResourceCandidateAdapter.ts';

export function evaluateCoreResourceEligibility(
  input: CoreResourceEligibilityInput,
): CoreResourceEligibilityResult {
  const inputIssues = validateInput(input);
  const baseIdentity = {
    envelopeId: input.adaptiveTaskRequestEnvelope?.envelopeId || 'invalid-envelope',
    taskRequestId: input.adaptiveTaskRequestEnvelope?.taskRequest?.taskRequestId || 'invalid-task-request',
    fulfillmentRequestId: input.taskFulfillmentRequest?.requestId || 'invalid-fulfillment-request',
    constraintsId: input.adaptiveTaskRequestEnvelope?.constraintsId || 'invalid-constraints',
    snapshotId: input.resourceSnapshot?.snapshotId || 'invalid-snapshot',
  };

  if (inputIssues.length > 0) {
    return buildResult({
      ...baseIdentity,
      status: 'blocked',
      candidates: [],
      evaluations: [],
      issues: inputIssues,
      evaluatedAt: input.evaluatedAt,
    });
  }

  const snapshot = input.resourceSnapshot;
  const globalIssues = validateSnapshotConsistency(snapshot.registryEntries, snapshot.frozenVersions);
  const registryByResource = uniqueMap(snapshot.registryEntries, (item) => item.resourceId);
  const validationById = uniqueMap(snapshot.validations, (item) => item.validationId);
  const reviewById = uniqueMap(snapshot.reviews, (item) => item.reviewId);

  const candidates = snapshot.frozenVersions
    .map((version) => adaptReviewedResourceCandidate({
      version,
      registryEntry: registryByResource.get(version.resourceId),
      validation: validationById.get(version.validationId),
      review: reviewById.get(version.reviewId),
    }))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));

  const versionsById = uniqueMap(snapshot.frozenVersions, (item) => item.resourceVersionId);
  const evaluations = candidates.map((candidate) => evaluateCandidate({
    candidate,
    version: versionsById.get(candidate.resourceVersionId)!,
    registryEntry: registryByResource.get(candidate.resourceId),
    validation: validationById.get(candidate.validationId),
    review: reviewById.get(candidate.reviewId),
    input,
    resourceHasMultipleFrozenHeads: snapshot.frozenVersions.filter((version) => (
      version.resourceId === candidate.resourceId && version.status === 'frozen'
    )).length > 1,
  }));

  const eligible = evaluations.filter((item) => item.status === 'eligible');
  const reviewRequired = evaluations.filter((item) => item.status === 'review_required');
  const fatalConsistencyIssue = globalIssues.some((issue) => (
    issue.startsWith('registry.') || issue.startsWith('version.multiple_current')
  ));
  const status = fatalConsistencyIssue
    ? 'review_required'
    : eligible.length > 0
      ? 'eligible'
      : reviewRequired.length > 0
        ? 'review_required'
        : 'no_eligible_resource';

  return buildResult({
    ...baseIdentity,
    status,
    candidates,
    evaluations,
    issues: uniqueSorted([
      ...globalIssues,
      ...evaluations.flatMap((item) => item.issues),
    ]),
    evaluatedAt: input.evaluatedAt,
  });
}

function evaluateCandidate(input: {
  candidate: ReviewedResourceMatchCandidate;
  version: FrozenQuestionResourceVersion;
  registryEntry?: ResourceRegistryEntry;
  validation?: ResourceValidationResult;
  review?: ResourceReviewDecision;
  input: CoreResourceEligibilityInput;
  resourceHasMultipleFrozenHeads: boolean;
}): CoreResourceCandidateEvaluation {
  const { candidate, version, registryEntry, validation, review } = input;
  const request = input.input.taskFulfillmentRequest;
  const identityAligned = Boolean(
    registryEntry &&
    registryEntry.resourceId === version.resourceId &&
    registryEntry.taskId === version.taskId &&
    registryEntry.abilityId === version.abilityMetadata.abilityId &&
    registryEntry.taskRole === version.abilityMetadata.taskRole &&
    registryEntry.difficulty === version.abilityMetadata.difficulty
  );
  const registryCurrentVersion = Boolean(
    registryEntry?.status === 'active' &&
    registryEntry.currentFrozenVersionId === version.resourceVersionId &&
    !input.resourceHasMultipleFrozenHeads
  );
  const resourceFrozenAndActive = version.status === 'frozen' && registryEntry?.status === 'active';
  const registryReviewTraceAligned = registryEntry?.currentFrozenVersionId === version.resourceVersionId
    ? registryEntry.latestValidationId === version.validationId &&
      registryEntry.latestReviewId === version.reviewId
    : true;
  const reviewAndValidationTraceable = Boolean(
    validation?.passed &&
    validation.validationId === version.validationId &&
    validation.resourceId === version.resourceId &&
    validation.draftId === version.sourceDraftId &&
    review?.action === 'approve' &&
    review.reviewId === version.reviewId &&
    review.resourceId === version.resourceId &&
    review.draftId === version.sourceDraftId &&
    review.validationId === version.validationId &&
    registryReviewTraceAligned
  );
  const targetAbilityAligned = version.abilityMetadata.abilityId === request.targetAbilityId;
  const taskRoleAligned = version.abilityMetadata.taskRole === request.taskRole;
  const difficultyAllowed = difficultyWithinRange(
    candidate.fulfillmentDifficulty,
    request.difficultyRange,
  );
  const rubricSupportsValidationGoal = rubricSupportsObservation(version, request.validationGoal);
  const checks = {
    identityAligned,
    registryCurrentVersion,
    resourceFrozenAndActive,
    reviewAndValidationTraceable,
    targetAbilityAligned,
    taskRoleAligned,
    difficultyAllowed,
    rubricSupportsValidationGoal,
  };
  const issues: string[] = [];
  const reasons: string[] = [];

  if (!identityAligned) issues.push('candidate.identity_mismatch');
  if (!registryCurrentVersion) issues.push(input.resourceHasMultipleFrozenHeads
    ? 'version.multiple_current_frozen'
    : 'candidate.not_registry_current');
  if (!resourceFrozenAndActive) issues.push('candidate.not_frozen_active');
  if (!reviewAndValidationTraceable) issues.push('candidate.review_validation_untraceable');
  if (!targetAbilityAligned) issues.push('candidate.primary_ability_mismatch');
  if (!taskRoleAligned) issues.push('candidate.task_role_mismatch');
  if (!difficultyAllowed) issues.push('candidate.difficulty_not_allowed');
  if (!rubricSupportsValidationGoal) issues.push('candidate.rubric_not_observable');

  if (targetAbilityAligned) reasons.push('Primary ability matches the formal request.');
  if (taskRoleAligned) reasons.push('Task role matches the formal request.');
  if (difficultyAllowed) reasons.push('Resource difficulty is inside the requested core range.');
  if (rubricSupportsValidationGoal) reasons.push('Rubric provides required observable assessment basis.');

  const traceOrIdentityFailure = (
    !identityAligned ||
    !reviewAndValidationTraceable ||
    input.resourceHasMultipleFrozenHeads ||
    (!registryEntry && version.status === 'frozen')
  );
  const status = traceOrIdentityFailure
    ? 'review_required'
    : Object.values(checks).every(Boolean)
      ? 'eligible'
      : 'rejected';

  return {
    candidateEvaluationId: buildStableId('core-resource-candidate-evaluation', [
      candidate.candidateId,
      request.requestId,
      status,
      ...uniqueSorted(issues),
    ]),
    candidateId: candidate.candidateId,
    resourceId: candidate.resourceId,
    resourceVersionId: candidate.resourceVersionId,
    status,
    checks,
    reasons: uniqueSorted(reasons),
    issues: uniqueSorted(issues),
  };
}

function validateInput(input: CoreResourceEligibilityInput): string[] {
  const issues: string[] = [];
  const envelope = input.adaptiveTaskRequestEnvelope;
  const request = input.taskFulfillmentRequest;
  if (!isAdaptiveTaskRequestEnvelope(envelope) || !envelope.validation.passed || !envelope.canEnterTaskFulfillment) {
    issues.push('input.adaptive_envelope_invalid');
  }
  if (!isTaskFulfillmentRequest(request)) issues.push('input.fulfillment_request_invalid');
  if (!isResourceEligibilitySnapshot(input.resourceSnapshot)) issues.push('input.resource_snapshot_invalid');
  if (!isTimestamp(input.evaluatedAt)) issues.push('input.evaluated_at_invalid');
  if (envelope?.taskRequest && request) {
    if (request.sourceTaskRequestId !== envelope.taskRequest.taskRequestId) issues.push('input.task_request_id_mismatch');
    if (request.sourceStrategyId !== envelope.taskRequest.strategyId) issues.push('input.strategy_id_mismatch');
    if (request.studentId !== envelope.taskRequest.studentId) issues.push('input.student_id_mismatch');
    if (request.targetAbilityId !== envelope.taskRequest.targetAbilityId) issues.push('input.target_ability_mismatch');
    if (request.taskRole !== envelope.taskRequest.taskRole) issues.push('input.task_role_mismatch');
    if (request.validationGoal !== envelope.taskRequest.validationGoal) issues.push('input.validation_goal_mismatch');
    if (!request.hardConstraints.includes(`adaptiveConstraintsId:${envelope.constraintsId}`)) {
      issues.push('input.constraints_id_mismatch');
    }
  }
  return uniqueSorted(issues);
}

function validateSnapshotConsistency(
  entries: ResourceRegistryEntry[],
  versions: FrozenQuestionResourceVersion[],
): string[] {
  const issues: string[] = [];
  const duplicateResources = duplicates(entries.map((item) => item.resourceId));
  duplicateResources.forEach((id) => issues.push(`registry.duplicate_resource:${id}`));
  const duplicateVersions = duplicates(versions.map((item) => item.resourceVersionId));
  duplicateVersions.forEach((id) => issues.push(`version.duplicate_id:${id}`));
  for (const entry of entries) {
    if (entry.status === 'active' && !entry.currentFrozenVersionId) {
      issues.push(`registry.active_head_missing:${entry.resourceId}`);
    }
    if (entry.currentFrozenVersionId && !versions.some((item) => item.resourceVersionId === entry.currentFrozenVersionId)) {
      issues.push(`registry.current_version_missing:${entry.resourceId}:${entry.currentFrozenVersionId}`);
    }
  }
  const resourceIds = uniqueSorted(versions.map((item) => item.resourceId));
  for (const resourceId of resourceIds) {
    if (versions.filter((item) => item.resourceId === resourceId && item.status === 'frozen').length > 1) {
      issues.push(`version.multiple_current:${resourceId}`);
    }
  }
  return uniqueSorted(issues);
}

function rubricSupportsObservation(version: FrozenQuestionResourceVersion, validationGoal: string): boolean {
  if (!validationGoal.trim()) return false;
  const primaryItems = version.rubric.filter((item) => (
    item.abilityId === version.abilityMetadata.abilityId &&
    item.required &&
    ['critical', 'important'].includes(item.importance) &&
    item.acceptedSignals.some((signal) => signal.trim().length > 0)
  ));
  if (primaryItems.length === 0) return false;
  if (version.responseFormat === 'single_choice') {
    return isSingleChoiceInteraction(version.choiceInteraction);
  }
  const hasObservableRequirement = primaryItems.some((item) => Boolean(
    item.evidenceRequirement?.requireTextEvidence ||
    item.evidenceRequirement?.requireExplanation ||
    item.evidenceRequirement?.requireConclusion
  ));
  return hasObservableRequirement;
}

function difficultyWithinRange(
  value: 'lower' | 'same' | 'higher',
  range: { preferred: 'lower' | 'same' | 'higher'; minimum?: 'lower' | 'same' | 'higher'; maximum?: 'lower' | 'same' | 'higher' },
): boolean {
  const order = { lower: 0, same: 1, higher: 2 } as const;
  const minimum = range.minimum ? order[range.minimum] : order[range.preferred];
  const maximum = range.maximum ? order[range.maximum] : order[range.preferred];
  return order[value] >= minimum && order[value] <= maximum;
}

function buildResult(input: {
  envelopeId: string;
  taskRequestId: string;
  fulfillmentRequestId: string;
  constraintsId: string;
  snapshotId: string;
  status: CoreResourceEligibilityResult['status'];
  candidates: ReviewedResourceMatchCandidate[];
  evaluations: CoreResourceCandidateEvaluation[];
  issues: string[];
  evaluatedAt: string;
}): CoreResourceEligibilityResult {
  const eligibleIds = input.evaluations.filter((item) => item.status === 'eligible').map((item) => item.candidateId).sort();
  const rejectedIds = input.evaluations.filter((item) => item.status === 'rejected').map((item) => item.candidateId).sort();
  const reviewIds = input.evaluations.filter((item) => item.status === 'review_required').map((item) => item.candidateId).sort();
  const eligibleIdSet = new Set(eligibleIds);
  const eligibleResources = input.status === 'eligible'
    ? input.candidates
      .filter((item) => eligibleIdSet.has(item.candidateId))
      .map((item) => item.availableTaskResource)
      .sort((left, right) => left.taskId.localeCompare(right.taskId))
    : [];
  const issues = uniqueSorted(input.issues);
  const result: CoreResourceEligibilityResult = {
    eligibilityResultId: buildStableId('core-resource-eligibility', [
      input.envelopeId,
      input.taskRequestId,
      input.fulfillmentRequestId,
      input.constraintsId,
      input.snapshotId,
      input.status,
      ...eligibleIds,
      ...rejectedIds,
      ...reviewIds,
      ...issues,
    ]),
    envelopeId: input.envelopeId,
    taskRequestId: input.taskRequestId,
    fulfillmentRequestId: input.fulfillmentRequestId,
    constraintsId: input.constraintsId,
    snapshotId: input.snapshotId,
    status: input.status,
    candidates: input.candidates,
    candidateEvaluations: input.evaluations,
    eligibleCandidateIds: eligibleIds,
    rejectedCandidateIds: rejectedIds,
    reviewRequiredCandidateIds: reviewIds,
    eligibleResources,
    issues,
    canEnterExistingTaskFulfillment: input.status === 'eligible' && eligibleResources.length > 0,
    policyVersion: CORE_RESOURCE_ELIGIBILITY_POLICY_VERSION,
    schemaVersion: RESOURCE_MATCH_QUALITY_SCHEMA_VERSION,
    evaluatedAt: input.evaluatedAt,
    validation: {
      passed: input.status !== 'blocked' && input.status !== 'review_required',
      issues: input.status === 'blocked' || input.status === 'review_required' ? issues : [],
    },
  };
  return result;
}

function uniqueMap<T>(values: T[], key: (value: T) => string): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = key(value);
    if (!result.has(id)) result.set(id, value);
  }
  return result;
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  values.forEach((value) => seen.has(value) ? duplicate.add(value) : seen.add(value));
  return [...duplicate].sort();
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort();
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}
