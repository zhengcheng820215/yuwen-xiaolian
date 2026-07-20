import { isAdaptiveTaskRequestEnvelope } from '../schemas/adaptiveTaskConstraints.schema.ts';
import type { AdaptiveConstraintRule } from '../schemas/adaptiveTaskConstraints.schema.ts';
import {
  RESOURCE_MATCH_QUALITY_POLICY_VERSION,
  RESOURCE_MATCH_QUALITY_SCHEMA_VERSION,
  isCoreResourceEligibilityResult,
  isResourceEligibilitySnapshot,
  type CoreResourceCandidateEvaluation,
  type CoreResourceEligibilityResult,
  type QualityGatedExecutableTaskResult,
  type ResourceCandidateMatchEvaluation,
  type ResourceConstraintCheck,
  type ResourceMatchQualityEvaluation,
  type ResourceMatchQualityInput,
  type ResourceMatchQualityResult,
  type ResourceMatchRecentHistory,
  type ReviewedResourceMatchCandidate,
  type StructuredResourceGap,
} from '../schemas/resourceMatchQuality.schema.ts';
import {
  isTaskFulfillmentRequest,
  isTaskResourceMatchResult,
  type AvailableTaskResource,
  type TaskResourceMatchResult,
} from '../schemas/taskFulfillment.schema.ts';
import { branchTaskFulfillment } from './taskFulfillmentBranchingAgent.ts';
import { buildStableId } from './reviewedResourceCandidateAdapter.ts';
import { matchTaskResources } from './taskResourceMatchingAgent.ts';

export function evaluateResourceMatchQuality(
  input: ResourceMatchQualityInput,
): ResourceMatchQualityResult {
  const issues = validateInput(input);
  if (issues.length > 0 || input.coreEligibility.status === 'blocked') {
    return {
      status: 'blocked',
      coreEligibility: input.coreEligibility,
      evaluation: null,
      issues: uniqueSorted([
        ...issues,
        ...(input.coreEligibility.status === 'blocked' ? ['core_eligibility_blocked'] : []),
      ]),
    };
  }

  if (input.coreEligibility.status === 'no_eligible_resource') {
    const evaluation = buildTerminalEvaluation(input, 'no_match', 'prepare_resource');
    return { status: 'completed', coreEligibility: input.coreEligibility, evaluation, issues: evaluation.issues };
  }
  if (input.coreEligibility.status === 'review_required') {
    const evaluation = buildTerminalEvaluation(input, 'review_required', 'human_review');
    return { status: 'completed', coreEligibility: input.coreEligibility, evaluation, issues: evaluation.issues };
  }

  const eligibleCandidates = input.coreEligibility.candidates
    .filter((candidate) => input.coreEligibility.eligibleCandidateIds.includes(candidate.candidateId))
    .sort(compareCandidates);
  const candidateEvaluations = eligibleCandidates.map((candidate) => evaluateCandidate(input, candidate));
  const contextualResources = eligibleCandidates.map((candidate) => (
    contextualizeAvailableResource(candidate, input)
  ));
  const existingMatchResult = input.existingMatchResult || matchTaskResources({
    fulfillmentRequest: input.fulfillmentRequest,
    availableTaskResources: contextualResources,
  });
  const evaluation = finalizeEvaluation(input, candidateEvaluations, existingMatchResult);

  return {
    status: 'completed',
    coreEligibility: input.coreEligibility,
    evaluation,
    issues: evaluation.issues,
  };
}

export function createQualityGatedExecutableTask(input: {
  qualityResult: ResourceMatchQualityResult;
  fulfillmentRequest: ResourceMatchQualityInput['fulfillmentRequest'];
  currentResourceSnapshot: ResourceMatchQualityInput['resourceSnapshot'];
  createdAt: string;
}): QualityGatedExecutableTaskResult {
  const evaluation = input.qualityResult.evaluation;
  if (
    input.qualityResult.status !== 'completed' ||
    !evaluation ||
    evaluation.status !== 'matched' ||
    !evaluation.canCreateExecutableTask ||
    !evaluation.validation.passed ||
    !evaluation.existingMatchResult ||
    !evaluation.selectedResourceId ||
    !evaluation.selectedResourceVersionId ||
    !evaluation.selectedTaskId
  ) {
    return { status: 'blocked', task: null, issues: ['quality_evaluation_not_executable'] };
  }

  const registry = input.currentResourceSnapshot.registryEntries.find((item) => (
    item.resourceId === evaluation.selectedResourceId
  ));
  const version = input.currentResourceSnapshot.frozenVersions.find((item) => (
    item.resourceVersionId === evaluation.selectedResourceVersionId
  ));
  if (
    !registry ||
    registry.status !== 'active' ||
    registry.currentFrozenVersionId !== evaluation.selectedResourceVersionId ||
    !version ||
    version.status !== 'frozen' ||
    version.taskId !== evaluation.selectedTaskId
  ) {
    return { status: 'blocked', task: null, issues: ['selected_resource_is_no_longer_current'] };
  }

  const candidate = input.qualityResult.coreEligibility.candidates.find((item) => (
    item.resourceVersionId === evaluation.selectedResourceVersionId
  ));
  if (!candidate) return { status: 'blocked', task: null, issues: ['selected_candidate_missing'] };

  const branch = branchTaskFulfillment({
    fulfillmentRequest: input.fulfillmentRequest,
    matchResult: evaluation.existingMatchResult,
    availableTaskResources: [candidate.availableTaskResource],
    createdAt: input.createdAt,
  });
  if (!branch.executableTask) {
    return { status: 'blocked', task: null, issues: ['existing_fulfillment_did_not_create_task'] };
  }

  return {
    status: 'created',
    task: {
      traceId: buildStableId('quality-gated-executable-task', [
        evaluation.evaluationId,
        evaluation.selectedResourceVersionId,
        branch.executableTask.executableTaskId,
      ]),
      executableTask: branch.executableTask,
      resourceId: candidate.resourceId,
      resourceVersionId: candidate.resourceVersionId,
      taskId: candidate.taskId,
      materialId: candidate.materialId,
      materialVersionId: candidate.materialVersionId,
      constraintsId: evaluation.constraintsId,
      resourceMatchQualityEvaluationId: evaluation.evaluationId,
      createdAt: input.createdAt,
      schemaVersion: RESOURCE_MATCH_QUALITY_SCHEMA_VERSION,
    },
    issues: [],
  };
}

function evaluateCandidate(
  input: ResourceMatchQualityInput,
  candidate: ReviewedResourceMatchCandidate,
): ResourceCandidateMatchEvaluation {
  const core = input.coreEligibility.candidateEvaluations.find((item) => item.candidateId === candidate.candidateId);
  const constraints = input.adaptiveRequestEnvelope.adaptiveConstraints;
  const novelty = evaluateMaterialNovelty(candidate, constraints.materialNovelty, input.recentHistory);
  const excludedTaskIds = constraintValues(constraints.hardConstraints, 'exclude_task');
  const excludedMaterialIds = constraintValues(constraints.hardConstraints, 'exclude_material');
  const explicitlyExcluded = excludedTaskIds.includes(candidate.taskId) || (
    Boolean(candidate.materialId) && excludedMaterialIds.includes(candidate.materialId!)
  );
  const recentDuplicationAvoided = !explicitlyExcluded &&
    !input.recentHistory.recentTaskIds.includes(candidate.taskId) &&
    !input.recentHistory.recentResourceIds.includes(candidate.resourceId) &&
    !input.recentHistory.recentResourceVersionIds.includes(candidate.resourceVersionId);
  const missingCapabilities = input.fulfillmentRequest.requiredCapabilities.filter((capability) => (
    !candidate.capabilities.includes(capability)
  ));
  const requiredCapabilitiesSatisfied = missingCapabilities.length === 0;
  const hintPolicySupported = candidate.capabilities.includes(`hint_policy:${constraints.hintPolicy}`);
  const safetyChecks = core?.checks || falseChecks();
  const constraintChecks: ResourceConstraintCheck[] = [
    check('material_novelty', 'hard_constraint', novelty.passed, constraints.materialNovelty,
      novelty.actual, 'history', novelty.reason),
    check('recent_duplication', 'safety_gate', recentDuplicationAvoided, true,
      recentDuplicationAvoided, 'history', explicitlyExcluded
        ? 'Resource matched an explicit task or material exclusion.'
        : 'Recent task, resource, and version identities were checked.'),
    check('required_capability', 'hard_constraint', requiredCapabilitiesSatisfied,
      input.fulfillmentRequest.requiredCapabilities, candidate.capabilities, 'resource',
      requiredCapabilitiesSatisfied ? 'All required capabilities are present.' : `Missing: ${missingCapabilities.join(', ')}`),
    check('hint_policy', 'hard_constraint', hintPolicySupported, constraints.hintPolicy,
      candidate.capabilities.filter((item) => item.startsWith('hint_policy:')), 'quality',
      hintPolicySupported ? 'Resource formally supports the requested hint policy.' : 'Requested hint policy is not declared.'),
  ];

  for (const rule of constraints.hardConstraints) {
    const evaluated = evaluateAdaptiveRule(rule, candidate, input, novelty.passed, hintPolicySupported);
    constraintChecks.push(check(rule.code, 'hard_constraint', evaluated.passed, printable(rule.value),
      evaluated.actual, rule.source, evaluated.reason));
  }
  for (const rule of constraints.softPreferences) {
    const evaluated = evaluateAdaptiveRule(rule, candidate, input, novelty.passed, hintPolicySupported);
    constraintChecks.push(check(rule.code, 'soft_preference', evaluated.passed, printable(rule.value),
      evaluated.actual, rule.source, evaluated.reason));
  }

  const unmetHardConstraints = uniqueSorted(constraintChecks
    .filter((item) => item.kind !== 'soft_preference' && !item.passed)
    .map((item) => `${item.code}: ${item.reason}`));
  const unmetSoftPreferences = uniqueSorted(constraintChecks
    .filter((item) => item.kind === 'soft_preference' && !item.passed)
    .map((item) => `${item.code}: ${item.reason}`));
  const uncertain = novelty.uncertain;
  const corePassed = core?.status === 'eligible' && Object.values(safetyChecks).every(Boolean);
  const status = uncertain
    ? 'review_required'
    : explicitlyExcluded
      ? 'rejected'
      : corePassed && unmetHardConstraints.length === 0 && unmetSoftPreferences.length === 0
        ? 'eligible_match'
        : 'partial_match';
  const limitations = uniqueSorted([
    ...(uncertain ? [novelty.reason] : []),
    ...unmetSoftPreferences,
  ]);

  return {
    candidateEvaluationId: buildStableId('resource-candidate-match', [
      candidate.candidateId,
      input.fulfillmentRequest.requestId,
      input.recentHistory.historyWindowEndedAt,
      status,
      ...unmetHardConstraints,
      ...unmetSoftPreferences,
    ]),
    candidateId: candidate.candidateId,
    resourceId: candidate.resourceId,
    resourceVersionId: candidate.resourceVersionId,
    taskId: candidate.taskId,
    materialId: candidate.materialId,
    status,
    checks: {
      ...safetyChecks,
      materialNoveltySatisfied: novelty.passed,
      recentDuplicationAvoided,
      requiredCapabilitiesSatisfied,
      hintPolicySupported,
    },
    constraintChecks,
    satisfiedConstraints: uniqueSorted(constraintChecks.filter((item) => item.passed).map((item) => item.code)),
    unmetHardConstraints,
    unmetSoftPreferences,
    reasons: uniqueSorted([
      ...(core?.reasons || []),
      ...(status === 'eligible_match' ? ['All active safety, hard, capability, hint, and preference checks passed.'] : []),
    ]),
    limitations,
    canBeSelected: status === 'eligible_match',
  };
}

function finalizeEvaluation(
  input: ResourceMatchQualityInput,
  candidates: ResourceCandidateMatchEvaluation[],
  existingMatchResult: TaskResourceMatchResult,
): ResourceMatchQualityEvaluation {
  const exact = candidates.filter((item) => item.status === 'eligible_match').sort(compareEvaluations);
  const partial = candidates.filter((item) => item.status === 'partial_match');
  const review = candidates.filter((item) => item.status === 'review_required');
  const selectedByExisting = existingMatchResult.selectedTaskId
    ? candidates.find((item) => item.taskId === existingMatchResult.selectedTaskId)
    : undefined;
  const selectedIsAmbiguous = existingMatchResult.selectedTaskId
    ? candidates.filter((item) => item.taskId === existingMatchResult.selectedTaskId).length !== 1
    : false;
  const issues: string[] = [];
  let status: ResourceMatchQualityEvaluation['status'];
  let selected: ResourceCandidateMatchEvaluation | undefined;

  if (
    existingMatchResult.fulfillmentRequestId !== input.fulfillmentRequest.requestId ||
    existingMatchResult.sourceTaskRequestId !== input.fulfillmentRequest.sourceTaskRequestId
  ) {
    status = 'review_required';
    issues.push('existing_match_identity_mismatch');
  } else if (existingMatchResult.status === 'matched' && (!selectedByExisting || selectedIsAmbiguous)) {
    status = 'review_required';
    issues.push('existing_selected_task_untraceable');
  } else if (review.length > 0 && exact.length === 0) {
    status = 'review_required';
    issues.push('candidate_context_requires_review');
  } else if (exact.length > 0) {
    selected = exact[0];
    if (existingMatchResult.status !== 'matched') {
      status = 'review_required';
      issues.push('existing_match_disagrees_with_quality_gate');
    } else if (selectedByExisting?.candidateId !== selected.candidateId) {
      status = 'review_required';
      issues.push('existing_selection_differs_from_stable_tie_breaker');
    } else {
      status = 'matched';
    }
  } else if (partial.length > 0 || existingMatchResult.status === 'partial_match') {
    status = 'partial_match';
  } else {
    status = 'no_match';
  }

  if (existingMatchResult.status === 'matched' && selectedByExisting && selectedByExisting.status !== 'eligible_match') {
    status = selectedByExisting.status === 'review_required' ? 'review_required' : 'partial_match';
    issues.push('existing_match_failed_quality_gate');
    selected = undefined;
  }

  const selectedCandidate = selected
    ? input.coreEligibility.candidates.find((item) => item.candidateId === selected!.candidateId)
    : undefined;
  const unmetConstraints = uniqueSorted(candidates.flatMap((item) => item.unmetHardConstraints));
  const unmetPreferences = uniqueSorted(candidates.flatMap((item) => item.unmetSoftPreferences));
  const resourceGap = status === 'matched' ? undefined : buildResourceGap(input, candidates, status, [
    ...unmetConstraints,
    ...unmetPreferences,
    ...issues,
    ...existingMatchResult.unmetConstraints,
    ...existingMatchResult.unmetPreferences,
  ]);
  const nextStep = status === 'matched'
    ? 'create_executable_task'
    : status === 'review_required'
      ? 'human_review'
      : 'prepare_resource';
  const sortedIssues = uniqueSorted(issues);

  return {
    evaluationId: buildStableId('resource-match-quality', [
      input.adaptiveRequestEnvelope.taskRequest.taskRequestId,
      input.fulfillmentRequest.requestId,
      input.adaptiveRequestEnvelope.constraintsId,
      input.resourceSnapshot.snapshotId,
      historyIdentity(input.recentHistory),
      RESOURCE_MATCH_QUALITY_POLICY_VERSION,
      existingMatchResult.status,
      existingMatchResult.selectedTaskId || 'none',
      status,
      ...candidates.map((item) => item.candidateEvaluationId).sort(),
    ]),
    studentId: input.fulfillmentRequest.studentId,
    strategyId: input.adaptiveRequestEnvelope.taskRequest.strategyId,
    taskRequestId: input.adaptiveRequestEnvelope.taskRequest.taskRequestId,
    fulfillmentRequestId: input.fulfillmentRequest.requestId,
    adaptiveEnvelopeId: input.adaptiveRequestEnvelope.envelopeId,
    constraintsId: input.adaptiveRequestEnvelope.constraintsId,
    targetAbilityId: input.fulfillmentRequest.targetAbilityId,
    taskRole: input.fulfillmentRequest.taskRole,
    validationGoal: input.fulfillmentRequest.validationGoal,
    fulfillmentInvoked: true,
    existingMatchResult,
    candidateEvaluations: candidates.sort(compareEvaluations),
    status,
    selectedResourceId: selected?.resourceId,
    selectedResourceVersionId: selected?.resourceVersionId,
    selectedTaskId: selected?.taskId,
    selectedMaterialId: selectedCandidate?.materialId,
    selectionReasons: selected ? uniqueSorted([
      ...selected.reasons,
      'Stable tie-breaker uses resourceVersionId and taskId.',
    ]) : [],
    unmetConstraints,
    unmetPreferences,
    issues: sortedIssues,
    limitations: uniqueSorted(candidates.flatMap((item) => item.limitations)),
    resourceGap,
    canCreateExecutableTask: status === 'matched' && Boolean(selected),
    nextStep,
    policyVersion: RESOURCE_MATCH_QUALITY_POLICY_VERSION,
    schemaVersion: RESOURCE_MATCH_QUALITY_SCHEMA_VERSION,
    evaluatedAt: input.evaluatedAt,
    validation: {
      passed: status === 'matched' || status === 'partial_match' || status === 'no_match',
      issues: status === 'review_required' ? sortedIssues : [],
    },
  };
}

function buildTerminalEvaluation(
  input: ResourceMatchQualityInput,
  status: 'no_match' | 'review_required',
  nextStep: 'prepare_resource' | 'human_review',
): ResourceMatchQualityEvaluation {
  const issues = uniqueSorted(input.coreEligibility.issues);
  const resourceGap = buildResourceGap(input, [], status, issues.length > 0 ? issues : ['no_eligible_resource']);
  return {
    evaluationId: buildStableId('resource-match-quality', [
      input.coreEligibility.eligibilityResultId,
      input.recentHistory.historyWindowEndedAt,
      status,
    ]),
    studentId: input.fulfillmentRequest.studentId,
    strategyId: input.adaptiveRequestEnvelope.taskRequest.strategyId,
    taskRequestId: input.adaptiveRequestEnvelope.taskRequest.taskRequestId,
    fulfillmentRequestId: input.fulfillmentRequest.requestId,
    adaptiveEnvelopeId: input.adaptiveRequestEnvelope.envelopeId,
    constraintsId: input.adaptiveRequestEnvelope.constraintsId,
    targetAbilityId: input.fulfillmentRequest.targetAbilityId,
    taskRole: input.fulfillmentRequest.taskRole,
    validationGoal: input.fulfillmentRequest.validationGoal,
    fulfillmentInvoked: false,
    candidateEvaluations: [],
    status,
    selectionReasons: [],
    unmetConstraints: resourceGap.missingConditions,
    unmetPreferences: [],
    issues,
    limitations: [],
    resourceGap,
    canCreateExecutableTask: false,
    nextStep,
    policyVersion: RESOURCE_MATCH_QUALITY_POLICY_VERSION,
    schemaVersion: RESOURCE_MATCH_QUALITY_SCHEMA_VERSION,
    evaluatedAt: input.evaluatedAt,
    validation: { passed: status === 'no_match', issues: status === 'review_required' ? issues : [] },
  };
}

function buildResourceGap(
  input: ResourceMatchQualityInput,
  candidates: ResourceCandidateMatchEvaluation[],
  status: ResourceMatchQualityEvaluation['status'],
  missingConditions: string[],
): StructuredResourceGap {
  const nextAction = status === 'review_required' ? 'human_review' : 'prepare_resource';
  const rejected = candidates.filter((item) => item.status === 'rejected').map((item) => item.resourceVersionId).sort();
  const partial = candidates.filter((item) => item.status === 'partial_match').map((item) => item.resourceVersionId).sort();
  const review = candidates.filter((item) => item.status === 'review_required').map((item) => item.resourceVersionId).sort();
  const missing = uniqueSorted(missingConditions.length > 0 ? missingConditions : ['no_matching_resource']);
  return {
    resourceGapId: buildStableId('structured-resource-gap', [
      input.adaptiveRequestEnvelope.taskRequest.taskRequestId,
      input.fulfillmentRequest.requestId,
      input.adaptiveRequestEnvelope.constraintsId,
      status,
      ...missing,
      ...rejected,
      ...partial,
      ...review,
    ]),
    studentId: input.fulfillmentRequest.studentId,
    taskRequestId: input.adaptiveRequestEnvelope.taskRequest.taskRequestId,
    fulfillmentRequestId: input.fulfillmentRequest.requestId,
    constraintsId: input.adaptiveRequestEnvelope.constraintsId,
    targetAbilityId: input.fulfillmentRequest.targetAbilityId,
    taskRole: input.fulfillmentRequest.taskRole,
    validationGoal: input.fulfillmentRequest.validationGoal,
    missingConditions: missing,
    rejectedResourceVersionIds: rejected,
    partialCandidateVersionIds: partial,
    reviewRequiredVersionIds: review,
    nextAction,
    createdAt: input.evaluatedAt,
  };
}

function contextualizeAvailableResource(
  candidate: ReviewedResourceMatchCandidate,
  input: ResourceMatchQualityInput,
): AvailableTaskResource {
  const novelty = input.adaptiveRequestEnvelope.adaptiveConstraints.materialNovelty;
  const contentType = novelty === 'new_context'
    ? 'new_text'
    : novelty === 'similar_context'
      ? 'comparable_text'
      : 'same_context_text';
  return { ...candidate.availableTaskResource, contentType };
}

function evaluateMaterialNovelty(
  candidate: ReviewedResourceMatchCandidate,
  expected: 'same_context' | 'similar_context' | 'new_context',
  history: ResourceMatchRecentHistory,
): { passed: boolean; uncertain: boolean; actual: string; reason: string } {
  if (!candidate.materialId) {
    return { passed: false, uncertain: true, actual: 'unknown', reason: 'Material identity is missing.' };
  }
  const recent = history.recentMaterialIds.includes(candidate.materialId);
  if (expected === 'new_context') {
    return {
      passed: !recent,
      uncertain: false,
      actual: recent ? 'recent_material' : 'new_context',
      reason: recent ? 'Material is present in recent history.' : 'Material identity is absent from recent history.',
    };
  }
  if (expected === 'same_context') {
    return {
      passed: recent,
      uncertain: false,
      actual: recent ? 'same_context' : 'different_context',
      reason: recent ? 'Material is formally present in recent history.' : 'Required same material is not present in recent history.',
    };
  }
  const formallySimilar = candidate.resourceTags.includes('material_relation:similar_context');
  return {
    passed: formallySimilar,
    uncertain: !formallySimilar,
    actual: formallySimilar ? 'similar_context' : 'unknown_relation',
    reason: formallySimilar
      ? 'Resource has a controlled similar-context relation tag.'
      : 'Similar-context relation cannot be proven from formal metadata.',
  };
}

function evaluateAdaptiveRule(
  rule: AdaptiveConstraintRule,
  candidate: ReviewedResourceMatchCandidate,
  input: ResourceMatchQualityInput,
  noveltyPassed: boolean,
  hintPolicySupported: boolean,
): { passed: boolean; actual: string | string[] | boolean; reason: string } {
  const values = Array.isArray(rule.value) ? rule.value : [String(rule.value)];
  if (rule.code === 'task_role') {
    return comparison(candidate.taskRole, values, rule.operator, 'Task role');
  }
  if (rule.code === 'target_ability') {
    return comparison(candidate.primaryAbilityId, values, rule.operator, 'Primary ability');
  }
  if (rule.code === 'difficulty') {
    const actual = input.adaptiveRequestEnvelope.adaptiveConstraints.difficultyDirection;
    return comparison(actual, values, rule.operator, 'Difficulty direction');
  }
  if (rule.code === 'material_novelty') {
    return { passed: noveltyPassed, actual: noveltyPassed, reason: noveltyPassed ? 'Material novelty passed.' : 'Material novelty did not pass.' };
  }
  if (rule.code === 'hint_policy') {
    return { passed: hintPolicySupported, actual: hintPolicySupported, reason: hintPolicySupported ? 'Hint policy is supported.' : 'Hint policy is unsupported.' };
  }
  if (rule.code === 'exclude_task') {
    const passed = !values.includes(candidate.taskId);
    return { passed, actual: candidate.taskId, reason: passed ? 'Task is not excluded.' : 'Task is explicitly excluded.' };
  }
  if (rule.code === 'exclude_material') {
    const passed = !candidate.materialId || !values.includes(candidate.materialId);
    return { passed, actual: candidate.materialId || 'missing', reason: passed ? 'Material is not excluded.' : 'Material is explicitly excluded.' };
  }
  const missing = values.filter((value) => !candidate.capabilities.includes(value));
  return {
    passed: missing.length === 0,
    actual: candidate.capabilities,
    reason: missing.length === 0 ? 'Required capability rule passed.' : `Missing capability rule values: ${missing.join(', ')}`,
  };
}

function comparison(
  actual: string,
  expected: string[],
  operator: AdaptiveConstraintRule['operator'],
  label: string,
): { passed: boolean; actual: string; reason: string } {
  const included = expected.includes(actual);
  const passed = operator === 'exclude' ? !included : included;
  return { passed, actual, reason: passed ? `${label} rule passed.` : `${label} rule failed.` };
}

function check(
  code: ResourceConstraintCheck['code'],
  kind: ResourceConstraintCheck['kind'],
  passed: boolean,
  expected: ResourceConstraintCheck['expected'],
  actual: ResourceConstraintCheck['actual'],
  source: ResourceConstraintCheck['source'],
  reason: string,
): ResourceConstraintCheck {
  return { code, kind, passed, expected, actual, source, reason };
}

function validateInput(input: ResourceMatchQualityInput): string[] {
  const issues: string[] = [];
  if (!isAdaptiveTaskRequestEnvelope(input.adaptiveRequestEnvelope)) issues.push('adaptive_request_envelope_invalid');
  if (!isTaskFulfillmentRequest(input.fulfillmentRequest)) issues.push('fulfillment_request_invalid');
  if (!isCoreResourceEligibilityResult(input.coreEligibility)) issues.push('core_eligibility_invalid');
  if (!isResourceEligibilitySnapshot(input.resourceSnapshot)) issues.push('resource_snapshot_invalid');
  if (!isRecentHistory(input.recentHistory)) issues.push('recent_history_invalid');
  if (!isTimestamp(input.evaluatedAt)) issues.push('evaluated_at_invalid');
  if (input.existingMatchResult && !isTaskResourceMatchResult(input.existingMatchResult)) issues.push('existing_match_result_invalid');
  if (input.recentHistory.studentId !== input.fulfillmentRequest.studentId) issues.push('history_student_id_mismatch');
  if (input.coreEligibility.envelopeId !== input.adaptiveRequestEnvelope.envelopeId) issues.push('core_envelope_id_mismatch');
  if (input.coreEligibility.taskRequestId !== input.adaptiveRequestEnvelope.taskRequest.taskRequestId) issues.push('core_task_request_id_mismatch');
  if (input.coreEligibility.fulfillmentRequestId !== input.fulfillmentRequest.requestId) issues.push('core_fulfillment_request_id_mismatch');
  if (input.coreEligibility.constraintsId !== input.adaptiveRequestEnvelope.constraintsId) issues.push('core_constraints_id_mismatch');
  if (input.coreEligibility.snapshotId !== input.resourceSnapshot.snapshotId) issues.push('core_snapshot_id_mismatch');
  if (input.fulfillmentRequest.sourceTaskRequestId !== input.adaptiveRequestEnvelope.taskRequest.taskRequestId) issues.push('task_request_id_mismatch');
  if (input.fulfillmentRequest.validationGoal !== input.adaptiveRequestEnvelope.taskRequest.validationGoal) issues.push('validation_goal_mismatch');
  if (input.fulfillmentRequest.studentId !== input.adaptiveRequestEnvelope.taskRequest.studentId) issues.push('student_id_mismatch');
  if (input.fulfillmentRequest.targetAbilityId !== input.adaptiveRequestEnvelope.taskRequest.targetAbilityId) issues.push('target_ability_mismatch');
  if (input.fulfillmentRequest.taskRole !== input.adaptiveRequestEnvelope.taskRequest.taskRole) issues.push('task_role_mismatch');
  const adaptiveCapabilities = uniqueSorted(input.adaptiveRequestEnvelope.adaptiveConstraints.requiredCapabilities);
  const fulfillmentCapabilities = uniqueSorted(input.fulfillmentRequest.requiredCapabilities);
  if (adaptiveCapabilities.join('|') !== fulfillmentCapabilities.join('|')) issues.push('required_capabilities_mismatch');
  const preExecution = input.adaptiveRequestEnvelope.adaptiveConstraints.preExecutionQualityConditions;
  if (preExecution.requiredHintPolicy !== input.adaptiveRequestEnvelope.adaptiveConstraints.hintPolicy) {
    issues.push('pre_execution_hint_policy_mismatch');
  }
  if (preExecution.requireNovelMaterial && input.adaptiveRequestEnvelope.adaptiveConstraints.materialNovelty !== 'new_context') {
    issues.push('pre_execution_novelty_mismatch');
  }
  return uniqueSorted(issues);
}

function isRecentHistory(value: ResourceMatchRecentHistory): boolean {
  return Boolean(
    value &&
    typeof value.studentId === 'string' && value.studentId.length > 0 &&
    arrays(value.recentTaskIds, value.recentResourceIds, value.recentResourceVersionIds,
      value.recentMaterialIds, value.recentExecutionSessionIds) &&
    (value.historyWindowStartedAt === undefined || isTimestamp(value.historyWindowStartedAt)) &&
    isTimestamp(value.historyWindowEndedAt)
  );
}

function arrays(...values: unknown[]): boolean {
  return values.every((value) => Array.isArray(value) && value.every((item) => typeof item === 'string'));
}

function falseChecks(): CoreResourceCandidateEvaluation['checks'] {
  return {
    identityAligned: false,
    registryCurrentVersion: false,
    resourceFrozenAndActive: false,
    reviewAndValidationTraceable: false,
    targetAbilityAligned: false,
    taskRoleAligned: false,
    difficultyAllowed: false,
    rubricSupportsValidationGoal: false,
  };
}

function constraintValues(rules: AdaptiveConstraintRule[], code: 'exclude_task' | 'exclude_material'): string[] {
  return uniqueSorted(rules
    .filter((rule) => rule.code === code)
    .flatMap((rule) => Array.isArray(rule.value) ? rule.value : [String(rule.value)]));
}

function printable(value: AdaptiveConstraintRule['value']): string | string[] | boolean {
  return Array.isArray(value) ? [...value].sort() : value;
}

function compareCandidates(left: ReviewedResourceMatchCandidate, right: ReviewedResourceMatchCandidate): number {
  return left.resourceVersionId.localeCompare(right.resourceVersionId) || left.taskId.localeCompare(right.taskId);
}

function compareEvaluations(left: ResourceCandidateMatchEvaluation, right: ResourceCandidateMatchEvaluation): number {
  return left.resourceVersionId.localeCompare(right.resourceVersionId) || left.taskId.localeCompare(right.taskId);
}

function historyIdentity(history: ResourceMatchRecentHistory): string {
  return buildStableId('resource-match-history', [
    history.studentId,
    ...uniqueSorted(history.recentTaskIds),
    ...uniqueSorted(history.recentResourceIds),
    ...uniqueSorted(history.recentResourceVersionIds),
    ...uniqueSorted(history.recentMaterialIds),
    ...uniqueSorted(history.recentExecutionSessionIds),
    history.historyWindowStartedAt || 'none',
    history.historyWindowEndedAt,
  ]);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort();
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}
