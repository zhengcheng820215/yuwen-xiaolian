import type {
  FrozenQuestionResourceVersion,
  ResourceRegistryEntry,
  ResourceReviewDecision,
  ResourceValidationResult,
} from './questionResourceAdmission.schema.ts';
import type { AdaptiveTaskRequestEnvelope } from './adaptiveTaskConstraints.schema.ts';
import type { AdaptiveConstraintCode } from './adaptiveTaskConstraints.schema.ts';
import type { RecommendedTaskRole } from './nextLearningStrategy.schema.ts';
import type {
  AvailableTaskResource,
  DifficultyLevel,
  ExecutableLearningTask,
  TaskFulfillmentRequest,
  TaskResourceMatchResult,
} from './taskFulfillment.schema.ts';
import {
  isExecutableLearningTask,
  isTaskResourceMatchResult,
} from './taskFulfillment.schema.ts';

export const RESOURCE_MATCH_QUALITY_SCHEMA_VERSION = 'resource_match_quality_v1' as const;
export const CORE_RESOURCE_ELIGIBILITY_POLICY_VERSION = 'core_resource_eligibility_policy_v1' as const;
export const RESOURCE_MATCH_QUALITY_POLICY_VERSION = 'resource_match_quality_policy_v1' as const;

export type ResourceEligibilitySnapshot = {
  snapshotId: string;
  registryEntries: ResourceRegistryEntry[];
  frozenVersions: FrozenQuestionResourceVersion[];
  validations: ResourceValidationResult[];
  reviews: ResourceReviewDecision[];
  capturedAt: string;
  schemaVersion: typeof RESOURCE_MATCH_QUALITY_SCHEMA_VERSION;
};

export type ReviewedResourceMatchCandidate = {
  candidateId: string;
  resourceId: string;
  resourceVersionId: string;
  taskId: string;
  materialId?: string;
  materialVersionId?: string;
  primaryAbilityId: string;
  supportingAbilityIds: string[];
  taskRole: FrozenQuestionResourceVersion['abilityMetadata']['taskRole'];
  resourceDifficulty: FrozenQuestionResourceVersion['abilityMetadata']['difficulty'];
  fulfillmentDifficulty: DifficultyLevel;
  questionType: FrozenQuestionResourceVersion['questionType'];
  responseFormat: FrozenQuestionResourceVersion['responseFormat'];
  capabilities: string[];
  validationGoalTags: string[];
  resourceTags: string[];
  sourceDraftId: string;
  validationId: string;
  reviewId: string;
  registryStatus?: ResourceRegistryEntry['status'];
  registryCurrentFrozenVersionId?: string;
  resourceStatus: FrozenQuestionResourceVersion['status'];
  availableTaskResource: AvailableTaskResource;
  schemaVersion: typeof RESOURCE_MATCH_QUALITY_SCHEMA_VERSION;
};

export type CoreResourceCandidateStatus = 'eligible' | 'rejected' | 'review_required';

export type CoreResourceCandidateEvaluation = {
  candidateEvaluationId: string;
  candidateId: string;
  resourceId: string;
  resourceVersionId: string;
  status: CoreResourceCandidateStatus;
  checks: {
    identityAligned: boolean;
    registryCurrentVersion: boolean;
    resourceFrozenAndActive: boolean;
    reviewAndValidationTraceable: boolean;
    targetAbilityAligned: boolean;
    taskRoleAligned: boolean;
    difficultyAllowed: boolean;
    rubricSupportsValidationGoal: boolean;
  };
  reasons: string[];
  issues: string[];
};

export type CoreResourceEligibilityStatus =
  | 'eligible'
  | 'no_eligible_resource'
  | 'review_required'
  | 'blocked';

export type CoreResourceEligibilityResult = {
  eligibilityResultId: string;
  envelopeId: string;
  taskRequestId: string;
  fulfillmentRequestId: string;
  constraintsId: string;
  snapshotId: string;
  status: CoreResourceEligibilityStatus;
  candidates: ReviewedResourceMatchCandidate[];
  candidateEvaluations: CoreResourceCandidateEvaluation[];
  eligibleCandidateIds: string[];
  rejectedCandidateIds: string[];
  reviewRequiredCandidateIds: string[];
  eligibleResources: AvailableTaskResource[];
  issues: string[];
  canEnterExistingTaskFulfillment: boolean;
  policyVersion: typeof CORE_RESOURCE_ELIGIBILITY_POLICY_VERSION;
  schemaVersion: typeof RESOURCE_MATCH_QUALITY_SCHEMA_VERSION;
  evaluatedAt: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type CoreResourceEligibilityInput = {
  adaptiveTaskRequestEnvelope: AdaptiveTaskRequestEnvelope;
  taskFulfillmentRequest: TaskFulfillmentRequest;
  resourceSnapshot: ResourceEligibilitySnapshot;
  evaluatedAt: string;
};

export type ResourceMatchRecentHistory = {
  studentId: string;
  recentTaskIds: string[];
  recentResourceIds: string[];
  recentResourceVersionIds: string[];
  /** Completed Frozen Versions in chronological order. Repeated consumption is retained. */
  resourceVersionConsumptionSequence?: string[];
  recentMaterialIds: string[];
  recentExecutionSessionIds: string[];
  historyWindowStartedAt?: string;
  historyWindowEndedAt: string;
};

export type ResourceMatchCheckCode =
  | 'identity'
  | 'registry_current_version'
  | 'frozen_active_status'
  | 'review_validation_traceability'
  | 'target_ability'
  | 'task_role'
  | 'difficulty'
  | 'material_novelty'
  | 'recent_duplication'
  | 'rubric_validation_goal'
  | 'required_capability'
  | 'hint_policy';

export type ResourceConstraintCheck = {
  code: AdaptiveConstraintCode | ResourceMatchCheckCode;
  kind: 'hard_constraint' | 'soft_preference' | 'safety_gate';
  passed: boolean;
  expected: string | string[] | boolean;
  actual?: string | string[] | boolean;
  source: 'strategy' | 'quality' | 'conflict' | 'registry' | 'resource' | 'history';
  reason: string;
};

export type ResourceCandidateMatchStatus =
  | 'eligible_match'
  | 'partial_match'
  | 'rejected'
  | 'review_required';

export type ResourceCandidateMatchEvaluation = {
  candidateEvaluationId: string;
  candidateId: string;
  resourceId: string;
  resourceVersionId: string;
  taskId: string;
  materialId?: string;
  status: ResourceCandidateMatchStatus;
  checks: {
    identityAligned: boolean;
    registryCurrentVersion: boolean;
    resourceFrozenAndActive: boolean;
    reviewAndValidationTraceable: boolean;
    targetAbilityAligned: boolean;
    taskRoleAligned: boolean;
    difficultyAllowed: boolean;
    materialNoveltySatisfied: boolean;
    recentDuplicationAvoided: boolean;
    rubricSupportsValidationGoal: boolean;
    requiredCapabilitiesSatisfied: boolean;
    hintPolicySupported: boolean;
  };
  constraintChecks: ResourceConstraintCheck[];
  satisfiedConstraints: string[];
  unmetHardConstraints: string[];
  unmetSoftPreferences: string[];
  reasons: string[];
  limitations: string[];
  canBeSelected: boolean;
};

export type StructuredResourceGap = {
  resourceGapId: string;
  studentId: string;
  taskRequestId: string;
  fulfillmentRequestId: string;
  constraintsId: string;
  targetAbilityId: string;
  taskRole: RecommendedTaskRole;
  validationGoal: string;
  missingConditions: string[];
  rejectedResourceVersionIds: string[];
  partialCandidateVersionIds: string[];
  reviewRequiredVersionIds: string[];
  nextAction:
    | 'prepare_resource'
    | 'revise_resource_metadata'
    | 'human_review'
    | 'regenerate_strategy'
    | 'stop';
  createdAt: string;
};

export type ResourceMatchQualityStatus =
  | 'matched'
  | 'partial_match'
  | 'no_match'
  | 'review_required';

export type ResourceMatchQualityEvaluation = {
  evaluationId: string;
  studentId: string;
  strategyId: string;
  taskRequestId: string;
  fulfillmentRequestId: string;
  adaptiveEnvelopeId: string;
  constraintsId: string;
  targetAbilityId: string;
  taskRole: RecommendedTaskRole;
  validationGoal: string;
  fulfillmentInvoked: boolean;
  existingMatchResult?: TaskResourceMatchResult;
  candidateEvaluations: ResourceCandidateMatchEvaluation[];
  status: ResourceMatchQualityStatus;
  selectedResourceId?: string;
  selectedResourceVersionId?: string;
  selectedTaskId?: string;
  selectedMaterialId?: string;
  selectionReasons: string[];
  unmetConstraints: string[];
  unmetPreferences: string[];
  issues: string[];
  limitations: string[];
  resourceGap?: StructuredResourceGap;
  canCreateExecutableTask: boolean;
  nextStep:
    | 'create_executable_task'
    | 'prepare_resource'
    | 'human_review'
    | 'regenerate_strategy'
    | 'stop';
  policyVersion: typeof RESOURCE_MATCH_QUALITY_POLICY_VERSION;
  schemaVersion: typeof RESOURCE_MATCH_QUALITY_SCHEMA_VERSION;
  evaluatedAt: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type ResourceMatchQualityResult = {
  status: 'completed' | 'blocked';
  coreEligibility: CoreResourceEligibilityResult;
  evaluation: ResourceMatchQualityEvaluation | null;
  issues: string[];
};

export type ResourceMatchQualityInput = {
  adaptiveRequestEnvelope: AdaptiveTaskRequestEnvelope;
  fulfillmentRequest: TaskFulfillmentRequest;
  coreEligibility: CoreResourceEligibilityResult;
  resourceSnapshot: ResourceEligibilitySnapshot;
  recentHistory: ResourceMatchRecentHistory;
  evaluatedAt: string;
  existingMatchResult?: TaskResourceMatchResult;
};

export type QualityGatedExecutableTask = {
  traceId: string;
  executableTask: ExecutableLearningTask;
  resourceId: string;
  resourceVersionId: string;
  taskId: string;
  materialId?: string;
  materialVersionId?: string;
  constraintsId: string;
  resourceMatchQualityEvaluationId: string;
  createdAt: string;
  schemaVersion: typeof RESOURCE_MATCH_QUALITY_SCHEMA_VERSION;
};

export type QualityGatedExecutableTaskResult = {
  status: 'created' | 'blocked';
  task: QualityGatedExecutableTask | null;
  issues: string[];
};

export function isResourceEligibilitySnapshot(value: unknown): value is ResourceEligibilitySnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as ResourceEligibilitySnapshot;
  return (
    isNonEmptyString(snapshot.snapshotId) &&
    Array.isArray(snapshot.registryEntries) &&
    Array.isArray(snapshot.frozenVersions) &&
    Array.isArray(snapshot.validations) &&
    Array.isArray(snapshot.reviews) &&
    isTimestamp(snapshot.capturedAt) &&
    snapshot.schemaVersion === RESOURCE_MATCH_QUALITY_SCHEMA_VERSION
  );
}

export function isReviewedResourceMatchCandidate(value: unknown): value is ReviewedResourceMatchCandidate {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as ReviewedResourceMatchCandidate;
  return (
    isNonEmptyString(candidate.candidateId) &&
    isNonEmptyString(candidate.resourceId) &&
    isNonEmptyString(candidate.resourceVersionId) &&
    isNonEmptyString(candidate.taskId) &&
    (candidate.materialId === undefined || isNonEmptyString(candidate.materialId)) &&
    (candidate.materialVersionId === undefined || isNonEmptyString(candidate.materialVersionId)) &&
    isNonEmptyString(candidate.primaryAbilityId) &&
    stringArray(candidate.supportingAbilityIds) &&
    ['training', 'retest', 'transfer', 'diagnosis', 'observation'].includes(candidate.taskRole) &&
    ['basic', 'intermediate', 'advanced'].includes(candidate.resourceDifficulty) &&
    ['lower', 'same', 'higher'].includes(candidate.fulfillmentDifficulty) &&
    isNonEmptyString(candidate.questionType) &&
    isNonEmptyString(candidate.responseFormat) &&
    nonEmptyStringArray(candidate.capabilities) &&
    nonEmptyStringArray(candidate.validationGoalTags) &&
    stringArray(candidate.resourceTags) &&
    isNonEmptyString(candidate.sourceDraftId) &&
    isNonEmptyString(candidate.validationId) &&
    isNonEmptyString(candidate.reviewId) &&
    (candidate.registryStatus === undefined || ['active', 'retired', 'no_frozen_version'].includes(candidate.registryStatus)) &&
    (candidate.registryCurrentFrozenVersionId === undefined || isNonEmptyString(candidate.registryCurrentFrozenVersionId)) &&
    ['frozen', 'superseded', 'retired'].includes(candidate.resourceStatus) &&
    Boolean(candidate.availableTaskResource) &&
    candidate.schemaVersion === RESOURCE_MATCH_QUALITY_SCHEMA_VERSION
  );
}

export function isCoreResourceEligibilityResult(value: unknown): value is CoreResourceEligibilityResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as CoreResourceEligibilityResult;
  return (
    isNonEmptyString(result.eligibilityResultId) &&
    isNonEmptyString(result.envelopeId) &&
    isNonEmptyString(result.taskRequestId) &&
    isNonEmptyString(result.fulfillmentRequestId) &&
    isNonEmptyString(result.constraintsId) &&
    isNonEmptyString(result.snapshotId) &&
    ['eligible', 'no_eligible_resource', 'review_required', 'blocked'].includes(result.status) &&
    Array.isArray(result.candidates) && result.candidates.every(isReviewedResourceMatchCandidate) &&
    Array.isArray(result.candidateEvaluations) &&
    stringArray(result.eligibleCandidateIds) &&
    stringArray(result.rejectedCandidateIds) &&
    stringArray(result.reviewRequiredCandidateIds) &&
    Array.isArray(result.eligibleResources) &&
    stringArray(result.issues) &&
    typeof result.canEnterExistingTaskFulfillment === 'boolean' &&
    result.policyVersion === CORE_RESOURCE_ELIGIBILITY_POLICY_VERSION &&
    result.schemaVersion === RESOURCE_MATCH_QUALITY_SCHEMA_VERSION &&
    isTimestamp(result.evaluatedAt) &&
    Boolean(result.validation) &&
    typeof result.validation.passed === 'boolean' &&
    stringArray(result.validation.issues) &&
    result.canEnterExistingTaskFulfillment === (
      result.status === 'eligible' && result.eligibleResources.length > 0
    )
  );
}

export function isResourceMatchQualityEvaluation(value: unknown): value is ResourceMatchQualityEvaluation {
  if (!value || typeof value !== 'object') return false;
  const result = value as ResourceMatchQualityEvaluation;
  return (
    isNonEmptyString(result.evaluationId) &&
    isNonEmptyString(result.studentId) &&
    isNonEmptyString(result.strategyId) &&
    isNonEmptyString(result.taskRequestId) &&
    isNonEmptyString(result.fulfillmentRequestId) &&
    isNonEmptyString(result.adaptiveEnvelopeId) &&
    isNonEmptyString(result.constraintsId) &&
    isNonEmptyString(result.targetAbilityId) &&
    ['training', 'retest', 'transfer', 'diagnosis', 'observation'].includes(result.taskRole) &&
    isNonEmptyString(result.validationGoal) &&
    typeof result.fulfillmentInvoked === 'boolean' &&
    (result.existingMatchResult === undefined || isTaskResourceMatchResult(result.existingMatchResult)) &&
    Array.isArray(result.candidateEvaluations) &&
    ['matched', 'partial_match', 'no_match', 'review_required'].includes(result.status) &&
    (result.selectedResourceId === undefined || isNonEmptyString(result.selectedResourceId)) &&
    (result.selectedResourceVersionId === undefined || isNonEmptyString(result.selectedResourceVersionId)) &&
    (result.selectedTaskId === undefined || isNonEmptyString(result.selectedTaskId)) &&
    (result.selectedMaterialId === undefined || isNonEmptyString(result.selectedMaterialId)) &&
    stringArray(result.selectionReasons) &&
    stringArray(result.unmetConstraints) &&
    stringArray(result.unmetPreferences) &&
    stringArray(result.issues) &&
    stringArray(result.limitations) &&
    typeof result.canCreateExecutableTask === 'boolean' &&
    ['create_executable_task', 'prepare_resource', 'human_review', 'regenerate_strategy', 'stop'].includes(result.nextStep) &&
    result.policyVersion === RESOURCE_MATCH_QUALITY_POLICY_VERSION &&
    result.schemaVersion === RESOURCE_MATCH_QUALITY_SCHEMA_VERSION &&
    isTimestamp(result.evaluatedAt) &&
    Boolean(result.validation) &&
    typeof result.validation.passed === 'boolean' &&
    stringArray(result.validation.issues) &&
    (result.status === 'matched'
      ? result.canCreateExecutableTask &&
        result.nextStep === 'create_executable_task' &&
        isNonEmptyString(result.selectedResourceId) &&
        isNonEmptyString(result.selectedResourceVersionId) &&
        isNonEmptyString(result.selectedTaskId)
      : !result.canCreateExecutableTask && result.nextStep !== 'create_executable_task')
  );
}

export function isResourceMatchQualityResult(value: unknown): value is ResourceMatchQualityResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as ResourceMatchQualityResult;
  return (
    ['completed', 'blocked'].includes(result.status) &&
    isCoreResourceEligibilityResult(result.coreEligibility) &&
    (result.evaluation === null || isResourceMatchQualityEvaluation(result.evaluation)) &&
    stringArray(result.issues) &&
    (result.status === 'blocked' ? result.evaluation === null : result.evaluation !== null)
  );
}

export function isQualityGatedExecutableTaskResult(value: unknown): value is QualityGatedExecutableTaskResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as QualityGatedExecutableTaskResult;
  if (!['created', 'blocked'].includes(result.status) || !stringArray(result.issues)) return false;
  if (result.status === 'blocked') return result.task === null;
  if (!result.task) return false;
  return (
    isNonEmptyString(result.task.traceId) &&
    isExecutableLearningTask(result.task.executableTask) &&
    isNonEmptyString(result.task.resourceId) &&
    isNonEmptyString(result.task.resourceVersionId) &&
    isNonEmptyString(result.task.taskId) &&
    (result.task.materialId === undefined || isNonEmptyString(result.task.materialId)) &&
    (result.task.materialVersionId === undefined || isNonEmptyString(result.task.materialVersionId)) &&
    isNonEmptyString(result.task.constraintsId) &&
    isNonEmptyString(result.task.resourceMatchQualityEvaluationId) &&
    isTimestamp(result.task.createdAt) &&
    result.task.schemaVersion === RESOURCE_MATCH_QUALITY_SCHEMA_VERSION
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}
