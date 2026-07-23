import { evaluateCoreResourceEligibility } from './coreResourceEligibilityAgent.ts';
import { prepareFormalResourceRuntimeTask } from './formalResourceRuntimeIntegrationAgent.ts';
import {
  createQualityGatedExecutableTask,
  evaluateResourceMatchQuality,
} from './resourceMatchQualityAgent.ts';
import {
  buildStableId,
  loadResourceEligibilitySnapshot,
} from './reviewedResourceCandidateAdapter.ts';
import { createAdaptiveTaskFulfillmentRequest } from './taskFulfillmentRequestAgent.ts';
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

const BATCH_A_RESOURCE_PREFIX = 'phase17-batch-a-resource-';
const BATCH_A_BOOTSTRAP_MATERIAL_ID = 'phase17-batch-a-material-station';

export type Phase173FormalResourceMatchInput = {
  taskRequest: TaskRequest;
  studentId: string;
  resourceRepository: QuestionResourceAdmissionRepository;
  observationRepository: MaterialObservationRepository;
  recentHistory?: Partial<ResourceMatchRecentHistory>;
  evaluatedAt?: string;
  bootstrapMaterialId?: string;
};

export async function matchPhase173BatchAFormalResource(
  input: Phase173FormalResourceMatchInput,
): Promise<NextFormalTaskResolution> {
  const evaluatedAt = input.evaluatedAt || new Date().toISOString();
  if (input.taskRequest.studentId !== input.studentId) {
    return blocked(input.taskRequest.taskRequestId, 'student_identity_mismatch');
  }

  const envelope = buildEnvelope(input.taskRequest, evaluatedAt);
  const fulfillment = createAdaptiveTaskFulfillmentRequest({
    adaptiveTaskRequestEnvelope: envelope,
    recentTaskIds: input.recentHistory?.recentTaskIds || [],
    createdAt: evaluatedAt,
  }).request;
  if (!fulfillment) {
    return blocked(input.taskRequest.taskRequestId, 'adaptive_fulfillment_request_blocked');
  }

  const completeSnapshot = await loadResourceEligibilitySnapshot(
    input.resourceRepository,
    evaluatedAt,
  );
  const snapshot = batchASnapshot(completeSnapshot);
  if (snapshot.registryEntries.length === 0) {
    return noMatch(input.taskRequest.taskRequestId, 'batch_a_registry_empty');
  }

  const recentMaterialIds = [...(input.recentHistory?.recentMaterialIds || [])];
  if (
    input.taskRequest.taskRole === 'training' &&
    recentMaterialIds.length === 0
  ) {
    recentMaterialIds.push(input.bootstrapMaterialId || BATCH_A_BOOTSTRAP_MATERIAL_ID);
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
  const preparation = await prepareFormalResourceRuntimeTask({
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

export async function loadPhase173BatchACurrentVersions(
  repository: QuestionResourceAdmissionRepository,
): Promise<FrozenQuestionResourceVersion[]> {
  const entries = (await repository.listRegistryEntries())
    .filter((entry) => (
      entry.status === 'active' &&
      entry.resourceId.startsWith(BATCH_A_RESOURCE_PREFIX) &&
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

function buildEnvelope(
  taskRequest: TaskRequest,
  generatedAt: string,
): AdaptiveTaskRequestEnvelope {
  const constraintsId = `phase17-3-live-constraints-${taskRequest.taskRequestId}`;
  const materialNovelty = noveltyFor(taskRequest.taskRole);
  const hintPolicy = taskRequest.taskRole === 'retest' ? 'no_hint' : 'limited_hint';
  const requiredCapabilities = capabilitiesFor(
    taskRequest.targetAbilityId,
    taskRequest.taskRole,
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
): string[] {
  const values = ['open_response', 'ability_observation', 'text_evidence'];
  if (abilityId !== 'extraction') values.push('inference_chain');
  if (taskRole === 'training') values.push('focused_practice');
  if (taskRole === 'retest') values.push('independent_answer');
  if (taskRole === 'transfer') values.push('new_context_transfer');
  return unique(values);
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
