import type { QuestionResourceAdmissionRepository } from '../repositories/questionResourceAdmissionRepository.ts';
import type {
  FrozenQuestionResourceVersion,
  ResourceRegistryEntry,
  ResourceReviewDecision,
  ResourceValidationResult,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  RESOURCE_MATCH_QUALITY_SCHEMA_VERSION,
  type ResourceEligibilitySnapshot,
  type ReviewedResourceMatchCandidate,
} from '../schemas/resourceMatchQuality.schema.ts';
import type { AvailableTaskResource, DifficultyLevel } from '../schemas/taskFulfillment.schema.ts';

export async function loadResourceEligibilitySnapshot(
  repository: QuestionResourceAdmissionRepository,
  capturedAt = new Date().toISOString(),
): Promise<ResourceEligibilitySnapshot> {
  const registryEntries = sortBy(await repository.listRegistryEntries(), (item) => item.resourceId);
  const frozenVersions = sortBy(await repository.listVersions(), (item) => item.resourceVersionId);
  const validationIds = uniqueSorted(frozenVersions.map((item) => item.validationId));
  const reviewIds = uniqueSorted(frozenVersions.map((item) => item.reviewId));
  const validations = compact(await Promise.all(validationIds.map((id) => repository.getValidation(id))));
  const reviews = compact(await Promise.all(reviewIds.map((id) => repository.getReview(id))));
  const snapshotFingerprint = [
    ...registryEntries.map((item) => `${item.resourceId}:${item.currentFrozenVersionId || 'none'}:${item.status}`),
    ...frozenVersions.map((item) => `${item.resourceVersionId}:${item.status}:${item.validationId}:${item.reviewId}`),
    ...validations.map((item) => `${item.validationId}:${item.passed}`),
    ...reviews.map((item) => `${item.reviewId}:${item.action}`),
  ];

  return {
    snapshotId: buildStableId('resource-eligibility-snapshot', snapshotFingerprint),
    registryEntries,
    frozenVersions,
    validations: sortBy(validations, (item) => item.validationId),
    reviews: sortBy(reviews, (item) => item.reviewId),
    capturedAt,
    schemaVersion: RESOURCE_MATCH_QUALITY_SCHEMA_VERSION,
  };
}

export function adaptReviewedResourceCandidate(input: {
  version: FrozenQuestionResourceVersion;
  registryEntry?: ResourceRegistryEntry;
  validation?: ResourceValidationResult;
  review?: ResourceReviewDecision;
}): ReviewedResourceMatchCandidate {
  const { version, registryEntry } = input;
  const capabilities = deriveCapabilities(version);
  const availableTaskResource: AvailableTaskResource = {
    taskId: version.taskId,
    taskRole: version.abilityMetadata.taskRole,
    // Supporting abilities are context only and must not qualify as target abilities.
    targetAbilityIds: [version.abilityMetadata.abilityId],
    difficulty: mapResourceDifficulty(version.abilityMetadata.difficulty),
    contentType: version.materialVersionId ? 'reading_material' : 'standalone_question',
    questionType: mapRuntimeQuestionType(version.questionType),
    responseMode: mapRuntimeResponseMode(version.responseFormat),
    capabilities,
    validationTags: uniqueSorted([
      `ability:${version.abilityMetadata.abilityId}`,
      `task_role:${version.abilityMetadata.taskRole}`,
      validationTagForRole(version.abilityMetadata.taskRole),
      ...version.rubric.map((item) => `rubric:${item.itemId}`),
    ]),
    source: version.source.sourceType === 'ai_assisted' ? 'generated' : 'manual',
    title: version.title,
    contentRef: version.materialVersionId || `resource-version:${version.resourceVersionId}`,
    questionRef: `question:${version.taskId}`,
    rubricRef: `rubric:${version.resourceVersionId}`,
  };

  return {
    candidateId: buildStableId('reviewed-resource-candidate', [
      version.resourceId,
      version.resourceVersionId,
      version.validationId,
      version.reviewId,
    ]),
    resourceId: version.resourceId,
    resourceVersionId: version.resourceVersionId,
    taskId: version.taskId,
    materialId: version.materialId,
    materialVersionId: version.materialVersionId,
    primaryAbilityId: version.abilityMetadata.abilityId,
    supportingAbilityIds: uniqueSorted(version.abilityMetadata.supportingAbilityIds),
    taskRole: version.abilityMetadata.taskRole,
    resourceDifficulty: version.abilityMetadata.difficulty,
    fulfillmentDifficulty: availableTaskResource.difficulty,
    questionType: version.questionType,
    responseFormat: version.responseFormat,
    capabilities,
    validationGoalTags: availableTaskResource.validationTags,
    resourceTags: uniqueSorted(version.tags),
    sourceDraftId: version.sourceDraftId,
    validationId: version.validationId,
    reviewId: version.reviewId,
    registryStatus: registryEntry?.status,
    registryCurrentFrozenVersionId: registryEntry?.currentFrozenVersionId,
    resourceStatus: version.status,
    availableTaskResource,
    schemaVersion: RESOURCE_MATCH_QUALITY_SCHEMA_VERSION,
  };
}

export function mapResourceDifficulty(
  difficulty: FrozenQuestionResourceVersion['abilityMetadata']['difficulty'],
): DifficultyLevel {
  if (difficulty === 'basic') return 'lower';
  if (difficulty === 'advanced') return 'higher';
  return 'same';
}

function deriveCapabilities(version: FrozenQuestionResourceVersion): string[] {
  const capabilities = ['ability_observation'];
  if (['open_short_answer', 'reading_comprehension'].includes(version.questionType)) {
    capabilities.push('open_response');
  }
  if (version.rubric.some((item) => item.evidenceRequirement?.requireTextEvidence)) {
    capabilities.push('text_evidence');
  }
  if (version.rubric.some((item) => (
    item.evidenceRequirement?.requireExplanation && item.evidenceRequirement?.requireConclusion
  ))) {
    capabilities.push('inference_chain');
  }
  if (version.abilityMetadata.taskRole === 'training') capabilities.push('focused_practice');
  if (version.abilityMetadata.taskRole === 'retest') capabilities.push('independent_answer');
  if (version.abilityMetadata.taskRole === 'transfer') capabilities.push('new_context_transfer');
  if (version.abilityMetadata.taskRole === 'diagnosis') capabilities.push('root_cause_probe');
  if (!version.tags.some((tag) => tag.startsWith('hint_policy:'))) {
    capabilities.push(defaultHintPolicyForRole(version.abilityMetadata.taskRole));
  }
  for (const tag of version.tags) {
    if (tag.startsWith('capability:')) capabilities.push(tag.slice('capability:'.length));
    if (tag.startsWith('hint_policy:')) capabilities.push(tag);
  }
  return uniqueSorted(capabilities);
}

function defaultHintPolicyForRole(
  role: FrozenQuestionResourceVersion['abilityMetadata']['taskRole'],
): string {
  return role === 'retest' ? 'hint_policy:no_hint' : 'hint_policy:limited_hint';
}

function mapRuntimeQuestionType(
  questionType: FrozenQuestionResourceVersion['questionType'],
): string {
  if (['open_short_answer', 'reading_comprehension'].includes(questionType)) return 'open_response';
  return questionType;
}

function mapRuntimeResponseMode(
  responseFormat: FrozenQuestionResourceVersion['responseFormat'],
): string {
  if (['short_text', 'long_text'].includes(responseFormat)) return 'written';
  return responseFormat;
}

function validationTagForRole(
  role: FrozenQuestionResourceVersion['abilityMetadata']['taskRole'],
): string {
  if (role === 'training') return 'focused_training';
  if (role === 'retest') return 'independent_retest';
  if (role === 'transfer') return 'transfer_validation';
  if (role === 'diagnosis') return 'diagnostic_probe';
  return 'general_validation';
}

export function buildStableId(prefix: string, parts: string[]): string {
  const text = parts.join('|');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort();
}

function sortBy<T>(values: T[], key: (value: T) => string): T[] {
  return [...values].sort((left, right) => key(left).localeCompare(key(right)));
}

function compact<T>(values: Array<T | null>): T[] {
  return values.filter((value): value is T => value !== null);
}
