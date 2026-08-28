import { evaluateCoreResourceEligibility } from './coreResourceEligibilityAgent.ts';
import { prepareFormalResourceRuntimeTask } from './formalResourceRuntimeIntegrationAgent.ts';
import {
  createQualityGatedExecutableTask,
  evaluateResourceMatchQuality,
} from './resourceMatchQualityAgent.ts';
import {
  buildStableId,
  loadResourceEligibilitySnapshot,
  mapResourceDifficulty,
} from './reviewedResourceCandidateAdapter.ts';
import { createAdaptiveTaskFulfillmentRequest } from './taskFulfillmentRequestAgent.ts';
import { orderFormalResourcesForLearningSequence } from './learningTaskSequenceScheduler.ts';
import { evaluateQuestionGenerationQuality } from './questionGenerationQualityPolicyAgent.ts';
import { prepareConcreteLearningTaskFromFrozenResource } from './frozenQuestionResourceTaskAdapter.ts';
import type { MaterialObservationRepository } from '../repositories/materialObservationRepository.ts';
import type { QuestionResourceAdmissionRepository } from '../repositories/questionResourceAdmissionRepository.ts';
import {
  ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
  ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
  ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
  type AdaptiveMaterialNovelty,
  type AdaptiveTaskRequestEnvelope,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import type {
  RecommendedTaskRole,
  TaskRequest,
} from '../schemas/nextLearningStrategy.schema.ts';
import type { FrozenQuestionResourceVersion } from '../schemas/questionResourceAdmission.schema.ts';
import type { NextFormalTaskResolution } from '../schemas/realLearningOperation.schema.ts';
import type {
  ResourceEligibilitySnapshot,
  ResourceMatchRecentHistory,
} from '../schemas/resourceMatchQuality.schema.ts';
import { projectTargetedMaterialUsage } from '../schemas/targetedMicroTraining.schema.ts';
import type { QuestionEditableFields } from '../schemas/workingTaskContent.schema.ts';

const BATCH_A_RESOURCE_PREFIX = 'phase17-batch-a-resource-';
const BATCH_A_BOOTSTRAP_MATERIAL_ID = 'phase17-batch-a-material-station';
const FORMAL_RESOURCE_ROTATION_COOLDOWN_TASK_COUNT = 2;

export type Phase173FormalResourceMatchInput = {
  taskRequest: TaskRequest;
  studentId: string;
  resourceRepository: QuestionResourceAdmissionRepository;
  observationRepository: MaterialObservationRepository;
  recentHistory?: Partial<ResourceMatchRecentHistory>;
  evaluatedAt?: string;
  bootstrapMaterialId?: string;
  requiredResourceVersionId?: string;
  /**
   * Exact immutable version frozen into an already-started Learning session.
   * It may no longer be the Registry Current Head after authoring publishes a
   * successor, but it remains the authoritative version for that session.
   */
  frozenSessionResourceVersionId?: string;
  /** Explicit admission boundary supplied by a new Learning-session resolver. */
  eligibleResourceVersionIds?: string[];
};

type FormalResourceMatchScope = 'all_active' | 'phase173_batch_a';

export async function matchCurrentFormalResource(
  input: Phase173FormalResourceMatchInput,
): Promise<NextFormalTaskResolution> {
  return matchFormalResource(input, 'all_active');
}

export async function matchPhase173BatchAFormalResource(
  input: Phase173FormalResourceMatchInput,
): Promise<NextFormalTaskResolution> {
  return matchFormalResource(input, 'phase173_batch_a');
}

async function matchFormalResource(
  input: Phase173FormalResourceMatchInput,
  scope: FormalResourceMatchScope,
): Promise<NextFormalTaskResolution> {
  const evaluatedAt = input.evaluatedAt || new Date().toISOString();
  if (input.taskRequest.studentId !== input.studentId) {
    return blocked(input.taskRequest.taskRequestId, 'student_identity_mismatch');
  }
  if (
    input.frozenSessionResourceVersionId &&
    input.requiredResourceVersionId !== input.frozenSessionResourceVersionId
  ) {
    return blocked(input.taskRequest.taskRequestId, 'frozen_session_resource_identity_mismatch');
  }

  const completeSnapshot = await loadResourceEligibilitySnapshot(
    input.resourceRepository,
    evaluatedAt,
  );
  const scopedSnapshot = scope === 'phase173_batch_a'
    ? batchASnapshot(completeSnapshot)
    : completeSnapshot;
  const qualityScopedSnapshot = input.eligibleResourceVersionIds && !input.frozenSessionResourceVersionId
    ? resourceVersionIdsSnapshot(scopedSnapshot, input.eligibleResourceVersionIds)
    : scopedSnapshot;
  const snapshot = input.requiredResourceVersionId
    ? resourceVersionSnapshot(
        qualityScopedSnapshot,
        input.requiredResourceVersionId,
        input.frozenSessionResourceVersionId === input.requiredResourceVersionId,
      )
    : qualityScopedSnapshot;
  if (input.requiredResourceVersionId && snapshot.frozenVersions.length === 0) {
    return blocked(input.taskRequest.taskRequestId, 'required_resource_version_unavailable');
  }
  if (snapshot.registryEntries.length === 0) {
    return noMatch(
      input.taskRequest.taskRequestId,
      scope === 'phase173_batch_a' ? 'batch_a_registry_empty' : 'active_registry_empty',
    );
  }
  const requiredVersion = input.requiredResourceVersionId
    ? snapshot.frozenVersions.find((version) => (
        version.resourceVersionId === input.requiredResourceVersionId
      ))
    : undefined;
  const envelope = buildEnvelope(
    input.taskRequest,
    evaluatedAt,
    requiredVersion,
  );
  const generatedFulfillment = createAdaptiveTaskFulfillmentRequest({
    adaptiveTaskRequestEnvelope: envelope,
    recentTaskIds: input.recentHistory?.recentTaskIds || [],
    createdAt: evaluatedAt,
  }).request;
  if (!generatedFulfillment) {
    return blocked(input.taskRequest.taskRequestId, 'adaptive_fulfillment_request_blocked');
  }
  const fulfillment = alignPinnedResourceDifficultyPreference(
    generatedFulfillment,
    requiredVersion,
  );

  const recentMaterialIds = [...(input.recentHistory?.recentMaterialIds || [])];
  const bootstrapMaterialId = input.bootstrapMaterialId || (
    scope === 'phase173_batch_a' ? BATCH_A_BOOTSTRAP_MATERIAL_ID : undefined
  );
  if (
    input.taskRequest.taskRole === 'training' &&
    recentMaterialIds.length === 0 &&
    bootstrapMaterialId
  ) {
    recentMaterialIds.push(bootstrapMaterialId);
  }
  const recentHistory: ResourceMatchRecentHistory = {
    studentId: input.studentId,
    recentTaskIds: [],
    recentResourceIds: [],
    recentResourceVersionIds: [],
    recentMaterialIds,
    recentExecutionSessionIds: [],
    historyWindowEndedAt: evaluatedAt,
    ...input.recentHistory,
    recentMaterialIds,
  };
  const core = evaluateCoreResourceEligibility({
    adaptiveTaskRequestEnvelope: envelope,
    taskFulfillmentRequest: fulfillment,
    resourceSnapshot: snapshot,
    evaluatedAt,
  });
  const quality = evaluateResourceMatchQuality({
    adaptiveRequestEnvelope: envelope,
    fulfillmentRequest: fulfillment,
    coreEligibility: core,
    resourceSnapshot: snapshot,
    recentHistory,
    evaluatedAt,
  });
  const taskResult = createQualityGatedExecutableTask({
    qualityResult: quality,
    fulfillmentRequest: fulfillment,
    currentResourceSnapshot: snapshot,
    createdAt: evaluatedAt,
  });
  if (taskResult.status !== 'created' || !taskResult.task) {
    const status = quality.evaluation?.status === 'review_required'
      ? 'review_required'
      : quality.evaluation?.status === 'partial_match'
        ? 'partial_match'
        : quality.evaluation?.status === 'no_match'
          ? 'no_match'
          : 'blocked';
    return {
      status,
      taskRequestId: input.taskRequest.taskRequestId,
      matchEvaluation: quality.evaluation || undefined,
      issues: unique([...quality.issues, ...taskResult.issues]),
    };
  }

  const version = snapshot.frozenVersions.find((item) => (
    item.resourceVersionId === taskResult.task!.resourceVersionId
  ));
  if (!version) return blocked(input.taskRequest.taskRequestId, 'matched_version_missing');
  const preparation = input.frozenSessionResourceVersionId === version.resourceVersionId
    ? (() => {
        const prepared = prepareConcreteLearningTaskFromFrozenResource({
          resourceVersion: version,
          qualityGatedTask: taskResult.task!,
          createdAt: evaluatedAt,
        });
        return {
          status: prepared.status,
          taskPreparation: prepared.status === 'prepared'
            ? { concreteTaskResult: prepared.concreteTaskResult }
            : undefined,
          issues: prepared.issues,
        } as const;
      })()
    : await prepareFormalResourceRuntimeTask({
        resourceVersionId: version.resourceVersionId,
        qualityGatedTask: taskResult.task,
        resourceRepository: input.resourceRepository,
        observationRepository: input.observationRepository,
        createdAt: evaluatedAt,
      });
  if (preparation.status !== 'prepared') {
    return {
      status: preparation.status === 'review_required' ? 'review_required' : 'blocked',
      taskRequestId: input.taskRequest.taskRequestId,
      matchEvaluation: quality.evaluation || undefined,
      issues: unique(preparation.issues),
    };
  }

  return {
    status: 'matched',
    taskRequestId: input.taskRequest.taskRequestId,
    resourceVersion: version,
    qualityGatedTask: taskResult.task,
    concreteTask: preparation.taskPreparation?.concreteTaskResult.concreteTask || undefined,
    taskReadiness: preparation.taskPreparation?.concreteTaskResult.readiness,
    matchEvaluation: quality.evaluation || undefined,
    issues: [],
  };
}

export function createPhase173BatchABootstrapTaskRequest(
  studentId: string,
  createdAt = new Date().toISOString(),
): TaskRequest {
  return {
    taskRequestId: `phase17-3-bootstrap-task-request-${studentId}`,
    strategyId: `phase17-3-bootstrap-strategy-${studentId}`,
    studentId,
    targetAbilityId: 'analysis',
    taskRole: 'training',
    action: 'continue_training',
    validationGoal: '观察 analysis 在正式 Training 任务中建立人物特点、文本依据与解释关系的表现。',
    evidenceLinks: [`phase17-3-bootstrap-evidence-${studentId}`],
    growthMemoryRecordIds: [`phase17-3-bootstrap-memory-${studentId}`],
    constraints: [],
    createdAt,
  };
}

export function createFormalResourceBootstrapTaskRequest(
  studentId: string,
  createdAt = new Date().toISOString(),
  targetAbilityId = 'analysis',
  taskRole: RecommendedTaskRole = 'training',
): TaskRequest {
  return {
    taskRequestId: `formal-resource-bootstrap-task-request-${studentId}-${targetAbilityId}-${taskRole}`,
    strategyId: `formal-resource-bootstrap-strategy-${studentId}-${targetAbilityId}-${taskRole}`,
    studentId,
    targetAbilityId,
    taskRole,
    action: 'continue_training',
    validationGoal: `观察 ${targetAbilityId} 在正式 ${taskRole} 任务中的表现。`,
    evidenceLinks: [`formal-resource-bootstrap-evidence-${studentId}`],
    growthMemoryRecordIds: [`formal-resource-bootstrap-memory-${studentId}`],
    constraints: [],
    createdAt,
  };
}

export function selectFormalResourceBootstrapVersion(
  versions: FrozenQuestionResourceVersion[],
  recentHistory: Pick<
    ResourceMatchRecentHistory,
    'recentResourceVersionIds' | 'recentMaterialIds'
  >,
): FrozenQuestionResourceVersion | undefined {
  const recentVersionIds = new Set(recentHistory.recentResourceVersionIds);
  const recentMaterialIds = new Set(recentHistory.recentMaterialIds);
  const requiresKnownContext = recentMaterialIds.size > 0;
  return orderFormalResourcesForLearningSequence(
    versions.filter((version) => (
      version.status === 'frozen' &&
      version.abilityMetadata.taskRole === 'training' &&
      !recentVersionIds.has(version.resourceVersionId) &&
      Boolean(version.materialId) &&
      (!requiresKnownContext || recentMaterialIds.has(version.materialId!))
    )),
    {
      taskRole: 'training',
      recentResourceVersionIds: recentHistory.recentResourceVersionIds,
    },
  )[0];
}

export async function resolveFormalResourceBootstrapMatch(input: {
  studentId: string;
  versions: FrozenQuestionResourceVersion[];
  resourceRepository: QuestionResourceAdmissionRepository;
  observationRepository: MaterialObservationRepository;
  recentHistory: ResourceMatchRecentHistory;
  evaluatedAt?: string;
  reusePreviouslyUsedWhenExhausted?: boolean;
}): Promise<{
  taskRequest: TaskRequest;
  matched: NextFormalTaskResolution;
  bootstrapVersion?: FrozenQuestionResourceVersion;
}> {
  const evaluatedAt = input.evaluatedAt || new Date().toISOString();
  const recentVersionIds = new Set(input.recentHistory.recentResourceVersionIds);
  const recentMaterialIds = new Set(input.recentHistory.recentMaterialIds);
  const freshCandidates = orderFormalResourcesForLearningSequence(
    input.versions.filter((version) => (
      version.status === 'frozen' &&
      version.abilityMetadata.taskRole === 'training' &&
      !recentVersionIds.has(version.resourceVersionId) &&
      Boolean(version.materialId) &&
      (recentMaterialIds.size === 0 || recentMaterialIds.has(version.materialId!))
    )),
    {
      taskRole: 'training',
      recentResourceVersionIds: input.recentHistory.recentResourceVersionIds,
    },
  );
  const activeTaskIds = new Set(input.recentHistory.recentTaskIds);
  const activeResourceIds = new Set(input.recentHistory.recentResourceIds);
  const reviewCandidates = input.reusePreviouslyUsedWhenExhausted
    ? orderFormalResourceRotationCandidates(
        input.versions.filter((version) => (
          version.status === 'frozen' &&
          version.abilityMetadata.taskRole === 'training' &&
          recentVersionIds.has(version.resourceVersionId) &&
          Boolean(version.materialId) &&
          !activeTaskIds.has(version.taskId) &&
          !activeResourceIds.has(version.resourceId)
        )),
        input.recentHistory,
        input.versions,
      )
    : [];
  const reviewHistory = {
    ...input.recentHistory,
    recentResourceVersionIds: input.recentHistory.recentResourceVersionIds.filter((id) => (
      !reviewCandidates.some((candidate) => candidate.resourceVersionId === id)
    )),
  };
  let firstAttempt: {
    taskRequest: TaskRequest;
    matched: NextFormalTaskResolution;
    bootstrapVersion?: FrozenQuestionResourceVersion;
  } | undefined;

  for (const candidate of freshCandidates) {
    const taskRequest = createFormalResourceBootstrapTaskRequest(
      input.studentId,
      evaluatedAt,
      candidate.abilityMetadata.abilityId,
      candidate.abilityMetadata.taskRole,
    );
    const matched = await matchCurrentFormalResource({
      taskRequest,
      studentId: input.studentId,
      resourceRepository: input.resourceRepository,
      observationRepository: input.observationRepository,
      recentHistory: input.recentHistory,
      bootstrapMaterialId: candidate.materialId,
      requiredResourceVersionId: candidate.resourceVersionId,
      evaluatedAt,
    });
    const attempt = { taskRequest, matched, bootstrapVersion: candidate };
    firstAttempt ||= attempt;
    if (matched.status === 'matched') return attempt;
  }

  for (const candidate of reviewCandidates) {
    const taskRequest = createFormalResourceBootstrapTaskRequest(
      input.studentId,
      evaluatedAt,
      candidate.abilityMetadata.abilityId,
      candidate.abilityMetadata.taskRole,
    );
    const matched = await matchCurrentFormalResource({
      taskRequest,
      studentId: input.studentId,
      resourceRepository: input.resourceRepository,
      observationRepository: input.observationRepository,
      recentHistory: reviewHistory,
      bootstrapMaterialId: candidate.materialId,
      requiredResourceVersionId: candidate.resourceVersionId,
      evaluatedAt,
    });
    const attempt = { taskRequest, matched, bootstrapVersion: candidate };
    firstAttempt ||= attempt;
    if (matched.status === 'matched') return attempt;
  }

  if (firstAttempt) return firstAttempt;
  const taskRequest = createFormalResourceBootstrapTaskRequest(input.studentId, evaluatedAt);
  return {
    taskRequest,
    matched: await matchCurrentFormalResource({
      taskRequest,
      studentId: input.studentId,
      resourceRepository: input.resourceRepository,
      observationRepository: input.observationRepository,
      recentHistory: input.recentHistory,
      evaluatedAt,
    }),
  };
}

export function orderFormalResourceRotationCandidates(
  candidates: FrozenQuestionResourceVersion[],
  recentHistory: Pick<
    ResourceMatchRecentHistory,
    'recentResourceVersionIds' | 'resourceVersionConsumptionSequence'
  >,
  allVersions: FrozenQuestionResourceVersion[] = candidates,
): FrozenQuestionResourceVersion[] {
  const sequence = recentHistory.resourceVersionConsumptionSequence?.length
    ? recentHistory.resourceVersionConsumptionSequence
    : recentHistory.recentResourceVersionIds;
  const cooldownIds = new Set(sequence.slice(-FORMAL_RESOURCE_ROTATION_COOLDOWN_TASK_COUNT));
  const consumeCounts = new Map<string, number>();
  const lastConsumedIndex = new Map<string, number>();
  sequence.forEach((id, index) => {
    consumeCounts.set(id, (consumeCounts.get(id) || 0) + 1);
    lastConsumedIndex.set(id, index);
  });
  const lastVersionId = sequence.at(-1);
  const lastMaterialId = allVersions.find((version) => (
    version.resourceVersionId === lastVersionId
  ))?.materialId;
  const lastAbilityId = allVersions.find((version) => (
    version.resourceVersionId === lastVersionId
  ))?.abilityMetadata.abilityId;

  return [...candidates].sort((left, right) => (
    Number(cooldownIds.has(left.resourceVersionId)) - Number(cooldownIds.has(right.resourceVersionId)) ||
    (consumeCounts.get(left.resourceVersionId) || 0) - (consumeCounts.get(right.resourceVersionId) || 0) ||
    Number(Boolean(lastMaterialId && left.materialId === lastMaterialId)) -
      Number(Boolean(lastMaterialId && right.materialId === lastMaterialId)) ||
    Number(Boolean(lastAbilityId && left.abilityMetadata.abilityId === lastAbilityId)) -
      Number(Boolean(lastAbilityId && right.abilityMetadata.abilityId === lastAbilityId)) ||
    (lastConsumedIndex.get(left.resourceVersionId) ?? -1) -
      (lastConsumedIndex.get(right.resourceVersionId) ?? -1) ||
    left.abilityMetadata.abilityId.localeCompare(right.abilityMetadata.abilityId) ||
    left.resourceVersionId.localeCompare(right.resourceVersionId)
  ));
}

export async function loadPhase173BatchACurrentVersions(
  repository: QuestionResourceAdmissionRepository,
): Promise<FrozenQuestionResourceVersion[]> {
  return loadCurrentVersions(repository, (resourceId) => (
    resourceId.startsWith(BATCH_A_RESOURCE_PREFIX)
  ));
}

export async function loadCurrentFormalResourceVersions(
  repository: QuestionResourceAdmissionRepository,
  observationRepository?: MaterialObservationRepository,
): Promise<FrozenQuestionResourceVersion[]> {
  const versions = await loadCurrentVersions(repository, () => true);
  if (!observationRepository) return versions;

  const [materials, plans, links] = await Promise.all([
    repository.listMaterials(),
    observationRepository.listPlans(),
    observationRepository.listLinks(),
  ]);
  const activeMaterialVersionIds = new Set(materials
    .filter((material) => material.status !== 'retired')
    .map((material) => material.materialVersionId));
  const currentPlans = new Map<string, (typeof plans)[number]>();
  for (const plan of plans) {
    const current = currentPlans.get(plan.materialVersionId);
    if (
      !current ||
      plan.revision > current.revision ||
      (plan.revision === current.revision && plan.updatedAt > current.updatedAt)
    ) {
      currentPlans.set(plan.materialVersionId, plan);
    }
  }

  return versions.filter((version) => {
    if (!version.materialVersionId || !activeMaterialVersionIds.has(version.materialVersionId)) {
      return false;
    }
    const plan = currentPlans.get(version.materialVersionId);
    if (!plan || plan.status !== 'reviewed') return false;
    const versionLinks = links.filter((link) => (
      link.status === 'active' &&
      link.resourceId === version.resourceId &&
      link.resourceVersionId === version.resourceVersionId &&
      link.materialVersionId === version.materialVersionId
    ));
    if (versionLinks.length !== 1) return false;
    const taskIdentityIds = new Set(plan.taskPlans.flatMap((task) => [
      task.observationTaskPlanId,
      task.taskRevisionRootId,
      task.parentObservationTaskPlanId,
    ].filter((value): value is string => Boolean(value))));
    return taskIdentityIds.has(versionLinks[0].observationTaskPlanId);
  });
}

export type CurrentFormalResourceQualityAdmission = {
  resourceId: string;
  resourceVersionId: string;
  materialVersionId?: string;
  policyVersion: string;
  status: 'ready' | 'ready_with_guidance' | 'blocked';
  eligibleForNewLearningSession: boolean;
  blockerCodes: string[];
};

/**
 * Re-evaluates active formal content with the latest generation-quality policy.
 * Historical Frozen Quality Trace data is intentionally not trusted here: this
 * projection is for admission to a newly-created Learning session.
 */
export function evaluateCurrentFormalResourceQualityAdmission(
  versions: FrozenQuestionResourceVersion[],
): CurrentFormalResourceQualityAdmission[] {
  const contents = new Map(versions.map((version) => [
    version.resourceVersionId,
    formalVersionAsEditableContent(version),
  ]));
  return versions.map((version) => {
    const content = contents.get(version.resourceVersionId)!;
    const evaluation = evaluateQuestionGenerationQuality({
      candidate: content,
      peerQuestions: versions
        .filter((peer) => (
          peer.resourceVersionId !== version.resourceVersionId &&
          sameMaterialScope(peer, version)
        ))
        .map((peer) => contents.get(peer.resourceVersionId)!),
      includePortfolioGuidance: false,
    });
    return {
      resourceId: version.resourceId,
      resourceVersionId: version.resourceVersionId,
      materialVersionId: version.materialVersionId,
      policyVersion: evaluation.policyVersion,
      status: evaluation.status,
      eligibleForNewLearningSession: evaluation.status !== 'blocked',
      blockerCodes: evaluation.blockerCodes,
    };
  });
}

export function filterCurrentFormalResourcesForNewLearningSession(
  versions: FrozenQuestionResourceVersion[],
): FrozenQuestionResourceVersion[] {
  // A targeted excerpt is a published formal resource, but it enters Learning
  // only through an explicit micro-training Assignment/Overlay. Historical
  // versions without a material snapshot or usage type remain core-compatible.
  const coreReadingVersions = versions.filter((version) => (
    version.materialSnapshot === undefined ||
    projectTargetedMaterialUsage(version.materialSnapshot).usageType === 'core_reading'
  ));
  const eligibleIds = new Set(evaluateCurrentFormalResourceQualityAdmission(coreReadingVersions)
    .filter((item) => item.eligibleForNewLearningSession)
    .map((item) => item.resourceVersionId));
  return coreReadingVersions.filter((version) => eligibleIds.has(version.resourceVersionId));
}

function formalVersionAsEditableContent(
  version: FrozenQuestionResourceVersion,
): QuestionEditableFields {
  return {
    materialVersionId: version.materialVersionId,
    title: version.title,
    questionStem: version.questionStem,
    questionType: version.questionType,
    responseFormat: version.responseFormat,
    options: version.options,
    choiceInteraction: version.choiceInteraction,
    assessmentMode: version.assessmentMode,
    answerAcceptance: version.answerAcceptance,
    rubric: version.rubric,
    minimumAnswerRequirement: version.minimumAnswerRequirement,
    abilityMetadata: version.abilityMetadata,
    source: version.source,
    tags: version.tags,
  };
}

function sameMaterialScope(
  left: FrozenQuestionResourceVersion,
  right: FrozenQuestionResourceVersion,
): boolean {
  if (left.materialVersionId || right.materialVersionId) {
    return Boolean(
      left.materialVersionId &&
      right.materialVersionId &&
      left.materialVersionId === right.materialVersionId,
    );
  }
  return Boolean(left.materialId && right.materialId && left.materialId === right.materialId);
}

async function loadCurrentVersions(
  repository: QuestionResourceAdmissionRepository,
  acceptsResourceId: (resourceId: string) => boolean,
): Promise<FrozenQuestionResourceVersion[]> {
  const entries = (await repository.listRegistryEntries())
    .filter((entry) => (
      entry.status === 'active' &&
      acceptsResourceId(entry.resourceId) &&
      entry.currentFrozenVersionId
    ));
  const versions = await Promise.all(entries.map((entry) => (
    repository.getVersion(entry.currentFrozenVersionId!)
  )));
  return versions
    .filter((version): version is FrozenQuestionResourceVersion => Boolean(
      version && version.status === 'frozen',
    ))
    .sort((left, right) => left.resourceVersionId.localeCompare(right.resourceVersionId));
}

function batchASnapshot(snapshot: ResourceEligibilitySnapshot): ResourceEligibilitySnapshot {
  const registryEntries = snapshot.registryEntries.filter((entry) => (
    entry.resourceId.startsWith(BATCH_A_RESOURCE_PREFIX)
  ));
  const resourceIds = new Set(registryEntries.map((entry) => entry.resourceId));
  const frozenVersions = snapshot.frozenVersions.filter((version) => (
    resourceIds.has(version.resourceId)
  ));
  const validationIds = new Set(frozenVersions.map((version) => version.validationId));
  const reviewIds = new Set(frozenVersions.map((version) => version.reviewId));
  return {
    ...snapshot,
    snapshotId: buildStableId('phase17-3-batch-a-snapshot', [
      snapshot.snapshotId,
      ...registryEntries.map((entry) => (
        `${entry.resourceId}:${entry.currentFrozenVersionId || 'none'}:${entry.status}`
      )),
    ]),
    registryEntries,
    frozenVersions,
    validations: snapshot.validations.filter((item) => validationIds.has(item.validationId)),
    reviews: snapshot.reviews.filter((item) => reviewIds.has(item.reviewId)),
  };
}

function resourceVersionSnapshot(
  snapshot: ResourceEligibilitySnapshot,
  resourceVersionId: string,
  preserveFrozenSessionVersion = false,
): ResourceEligibilitySnapshot {
  const frozenVersions = snapshot.frozenVersions.filter((version) => (
    version.resourceVersionId === resourceVersionId
  ));
  const resourceIds = new Set(frozenVersions.map((version) => version.resourceId));
  const validationIds = new Set(frozenVersions.map((version) => version.validationId));
  const reviewIds = new Set(frozenVersions.map((version) => version.reviewId));
  const selectedVersion = frozenVersions[0];
  const executableFrozenVersions = preserveFrozenSessionVersion
    ? frozenVersions.map((version) => (
        version.status === 'superseded'
          ? { ...version, status: 'frozen' as const }
          : version
      ))
    : frozenVersions;
  const registryEntries = snapshot.registryEntries
    .filter((entry) => (
      resourceIds.has(entry.resourceId) &&
      (preserveFrozenSessionVersion || entry.currentFrozenVersionId === resourceVersionId)
    ))
    .map((entry) => preserveFrozenSessionVersion && selectedVersion
      ? {
          ...entry,
          currentFrozenVersionId: selectedVersion.resourceVersionId,
          latestValidationId: selectedVersion.validationId,
          latestReviewId: selectedVersion.reviewId,
        }
      : entry);
  return {
    ...snapshot,
    snapshotId: buildStableId('formal-resource-version-snapshot', [
      snapshot.snapshotId,
      resourceVersionId,
      preserveFrozenSessionVersion ? 'frozen-session' : 'current-head',
    ]),
    registryEntries,
    frozenVersions: executableFrozenVersions,
    validations: snapshot.validations.filter((item) => validationIds.has(item.validationId)),
    reviews: snapshot.reviews.filter((item) => reviewIds.has(item.reviewId)),
  };
}

function resourceVersionIdsSnapshot(
  snapshot: ResourceEligibilitySnapshot,
  resourceVersionIds: string[],
): ResourceEligibilitySnapshot {
  const acceptedVersionIds = new Set(resourceVersionIds);
  const frozenVersions = snapshot.frozenVersions.filter((version) => (
    acceptedVersionIds.has(version.resourceVersionId)
  ));
  const acceptedResourceVersions = new Map(frozenVersions.map((version) => [
    version.resourceId,
    version.resourceVersionId,
  ]));
  const validationIds = new Set(frozenVersions.map((version) => version.validationId));
  const reviewIds = new Set(frozenVersions.map((version) => version.reviewId));
  return {
    ...snapshot,
    snapshotId: buildStableId('formal-resource-admission-snapshot', [
      snapshot.snapshotId,
      ...[...acceptedVersionIds].sort(),
    ]),
    registryEntries: snapshot.registryEntries.filter((entry) => (
      acceptedResourceVersions.get(entry.resourceId) === entry.currentFrozenVersionId
    )),
    frozenVersions,
    validations: snapshot.validations.filter((item) => validationIds.has(item.validationId)),
    reviews: snapshot.reviews.filter((item) => reviewIds.has(item.reviewId)),
  };
}

function buildEnvelope(
  taskRequest: TaskRequest,
  generatedAt: string,
  requiredVersion?: FrozenQuestionResourceVersion,
): AdaptiveTaskRequestEnvelope {
  const constraintsId = `phase17-3-live-constraints-${taskRequest.taskRequestId}`;
  const materialNovelty = noveltyFor(taskRequest.taskRole);
  const hintPolicy = taskRequest.taskRole === 'retest' ? 'no_hint' : 'limited_hint';
  const requiredCapabilities = capabilitiesFor(
    taskRequest.targetAbilityId,
    taskRequest.taskRole,
    requiredVersion,
  );
  const difficultyDirection = taskRequest.action === 'lower_difficulty_training'
    ? 'decrease'
    : 'maintain';
  return {
    envelopeId: `phase17-3-live-envelope-${taskRequest.taskRequestId}`,
    taskRequest,
    adaptiveConstraints: {
      constraintsId,
      studentId: taskRequest.studentId,
      targetAbilityId: taskRequest.targetAbilityId,
      sourceStrategyId: taskRequest.strategyId,
      sourceStrategyAction: taskRequest.action,
      sourceStrategyTaskRole: taskRequest.taskRole,
      sourceValidationGoal: taskRequest.validationGoal,
      sourceContextSnapshotId: `phase17-3-live-context-${taskRequest.taskRequestId}`,
      sourceConflictAssessmentId: `phase17-3-live-conflict-${taskRequest.taskRequestId}`,
      sourceConflictStatus: 'aligned_weakness_evidence',
      sourceQualityAssessmentIds: ['phase17-3-live-quality-current'],
      sourceEvidenceIds: taskRequest.evidenceLinks,
      sourceObservationUnitIds: ['phase17-3-live-observation-current'],
      learningIntent: taskRequest.taskRole === 'transfer'
        ? 'transfer_validation'
        : taskRequest.taskRole === 'retest'
          ? 'independent_validation'
          : 'consolidation',
      observationTarget: taskRequest.taskRole === 'transfer'
        ? 'verify_transfer'
        : taskRequest.taskRole === 'retest'
          ? 'verify_independence'
          : 'collect_comparable_evidence',
      recommendedTaskRole: taskRequest.taskRole,
      difficultyDirection,
      materialNovelty,
      hintPolicy,
      targetEvidenceQuality: taskRequest.taskRole === 'retest' ? 'high' : 'medium',
      preExecutionQualityConditions: {
        requireNovelMaterial: taskRequest.taskRole === 'transfer',
        requireKnownDifficulty: true,
        requireAbilityAlignment: true,
        requiredHintPolicy: hintPolicy,
        requireTraceability: true,
      },
      requiredCapabilities,
      hardConstraints: [
        { code: 'task_role', operator: 'eq', value: taskRequest.taskRole, source: 'strategy' },
        { code: 'target_ability', operator: 'eq', value: taskRequest.targetAbilityId, source: 'strategy' },
        { code: 'difficulty', operator: 'eq', value: difficultyDirection, source: 'strategy' },
        { code: 'material_novelty', operator: 'eq', value: materialNovelty, source: 'strategy' },
        { code: 'hint_policy', operator: 'eq', value: hintPolicy, source: 'quality' },
      ],
      softPreferences: [],
      reasons: ['Reuse the frozen Phase 16.2 Resource Matching Quality gate.'],
      limitations: ['Initial Batch A task uses an explicit bootstrap material context.'],
      schemaVersion: ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION,
      policyVersion: ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION,
      generatedAt,
      validation: { passed: true, issues: [] },
    },
    alignmentResult: {
      alignmentId: `phase17-3-live-alignment-${taskRequest.taskRequestId}`,
      strategyId: taskRequest.strategyId,
      constraintsId,
      contextSnapshotId: `phase17-3-live-context-${taskRequest.taskRequestId}`,
      status: 'aligned',
      checks: {
        identityAligned: true,
        strategyValidationPassed: true,
        sourceStrategyAligned: true,
        targetAbilityAligned: true,
        taskRoleAligned: true,
        validationGoalAligned: true,
        difficultyAllowed: true,
        materialAllowed: true,
        hintPolicyAllowed: true,
        contextAllowed: true,
        conflictAllowed: true,
      },
      canCreateTaskRequest: true,
      nextStep: 'create_task_request',
      issues: [],
      warnings: [],
      alignedAt: generatedAt,
      validation: { passed: true, issues: [] },
    },
    constraintsId,
    canEnterTaskFulfillment: true,
    schemaVersion: ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION,
    validation: { passed: true, issues: [] },
  };
}

function noveltyFor(taskRole: RecommendedTaskRole): AdaptiveMaterialNovelty {
  if (taskRole === 'transfer') return 'new_context';
  if (taskRole === 'retest') return 'similar_context';
  return 'same_context';
}

function capabilitiesFor(
  abilityId: string,
  taskRole: RecommendedTaskRole,
  requiredVersion?: FrozenQuestionResourceVersion,
): string[] {
  const singleChoice = requiredVersion?.responseFormat === 'single_choice';
  const values = [
    singleChoice ? 'single_choice_response' : 'open_response',
    'ability_observation',
  ];
  if (!singleChoice) {
    const requiresTextEvidence = requiredVersion
      ? requiredVersion.rubric.some((item) => item.evidenceRequirement?.requireTextEvidence)
      : true;
    const requiresInferenceChain = requiredVersion
      ? requiredVersion.rubric.some((item) => (
          item.evidenceRequirement?.requireExplanation &&
          item.evidenceRequirement?.requireConclusion
        ))
      : abilityId !== 'extraction';
    if (requiresTextEvidence) values.push('text_evidence');
    if (requiresInferenceChain) values.push('inference_chain');
  }
  if (taskRole === 'training') values.push('focused_practice');
  if (taskRole === 'retest') values.push('independent_answer');
  if (taskRole === 'transfer') values.push('new_context_transfer');
  return unique(values);
}

function alignPinnedResourceDifficultyPreference(
  fulfillment: NonNullable<ReturnType<typeof createAdaptiveTaskFulfillmentRequest>['request']>,
  requiredVersion?: FrozenQuestionResourceVersion,
): NonNullable<ReturnType<typeof createAdaptiveTaskFulfillmentRequest>['request']> {
  if (!requiredVersion) return fulfillment;
  const preferred = mapResourceDifficulty(requiredVersion.abilityMetadata.difficulty);
  return {
    ...fulfillment,
    difficultyRange: {
      ...fulfillment.difficultyRange,
      minimum: preferred,
      preferred,
      maximum: preferred,
    },
  };
}

function noMatch(taskRequestId: string, issue: string): NextFormalTaskResolution {
  return { status: 'no_match', taskRequestId, issues: [issue] };
}

function blocked(taskRequestId: string, issue: string): NextFormalTaskResolution {
  return { status: 'blocked', taskRequestId, issues: [issue] };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
