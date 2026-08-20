import type {
  FrozenQuestionResourceVersion,
  PrimaryAbilityId,
  QuestionMaterialVersion,
  ResourceRegistryEntry,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  buildTargetedMicroTrainingAssignmentId,
  buildTargetedMicroTrainingRequestId,
  TARGETED_GAP_REASON_CODES,
  type TargetedGapReasonCode,
  type TargetedMicroTrainingAssignment,
  type TargetedMicroTrainingRequest,
  type TargetedSourceAnchor,
} from '../schemas/targetedMicroTraining.schema.ts';
import {
  buildTargetedMicroTrainingDecisionId,
  TARGETED_MICRO_TRAINING_MATCH_POLICY_VERSION,
  TARGETED_MICRO_TRAINING_SESSION_LIMIT,
  TARGETED_MICRO_TRAINING_TRIGGER_POLICY_VERSION,
  type TargetedMicroTrainingMatchResult,
  type TargetedMicroTrainingSessionOverlay,
  type TargetedMicroTrainingTriggerDecision,
} from '../schemas/targetedMicroTrainingScheduling.schema.ts';

export type TargetedMicroTrainingTriggerInput = {
  enabled: boolean;
  studentId: string;
  learningSessionId: string;
  sourceLearningRoundId: string;
  sourceAttemptId: string;
  sourceResourceVersionId: string;
  sourceMaterialId: string;
  sourceCoreTaskNumber: number;
  sourceTaskRole:
    | 'training'
    | 'retest'
    | 'transfer'
    | 'diagnosis'
    | 'observation'
    | 'revision'
    | 'targeted_training';
  sourceIsCurrentCoreQueueTask: boolean;
  persistenceCompleted: boolean;
  identitiesAligned: boolean;
  primaryAbilityId?: PrimaryAbilityId;
  primaryGapRequirementIds: string[];
  requirementGapReasonCodes: Record<string, string | undefined>;
  revisionAvailable: boolean;
  alreadyTerminatedForAttempt: boolean;
  completedAssignmentCount: number;
  hasPendingOrInProgressAssignment: boolean;
  evaluatedAt: string;
};

export type TargetedMicroTrainingMatchInput = {
  request: TargetedMicroTrainingRequest;
  sourceMaterialId: string;
  sourceResourceVersionId: string;
  sourceAnchors: TargetedSourceAnchor[];
  currentFrozenVersions: FrozenQuestionResourceVersion[];
  activeRegistryEntries: ResourceRegistryEntry[];
  activeMaterials: QuestionMaterialVersion[];
};

export function evaluateTargetedMicroTrainingTrigger(
  input: TargetedMicroTrainingTriggerInput,
): TargetedMicroTrainingTriggerDecision {
  const primaryGapRequirementId = input.primaryGapRequirementIds.length === 1
    ? input.primaryGapRequirementIds[0]
    : undefined;
  const rawGap = primaryGapRequirementId
    ? input.requirementGapReasonCodes[primaryGapRequirementId]
    : undefined;
  const gapReasonCode = TARGETED_GAP_REASON_CODES.includes(rawGap as TargetedGapReasonCode)
    ? rawGap as TargetedGapReasonCode
    : undefined;
  const base = {
    decisionId: buildTargetedMicroTrainingDecisionId({
      studentId: input.studentId,
      sourceAttemptId: input.sourceAttemptId,
      gapReasonCode,
    }),
    studentId: input.studentId,
    learningSessionId: input.learningSessionId,
    sourceLearningRoundId: input.sourceLearningRoundId,
    sourceAttemptId: input.sourceAttemptId,
    sourceResourceVersionId: input.sourceResourceVersionId,
    sourceMaterialId: input.sourceMaterialId,
    sourceCoreTaskNumber: input.sourceCoreTaskNumber,
    ...(input.primaryAbilityId ? { abilityId: input.primaryAbilityId } : {}),
    ...(primaryGapRequirementId ? { primaryGapRequirementId } : {}),
    ...(gapReasonCode ? { gapReasonCode } : {}),
    triggerPolicyVersion: TARGETED_MICRO_TRAINING_TRIGGER_POLICY_VERSION,
    evaluatedAt: input.evaluatedAt,
  } as const;

  if (!input.enabled) return { ...base, outcome: 'not_eligible', reasonCode: 'feature_disabled' };
  if (!input.sourceIsCurrentCoreQueueTask || input.sourceTaskRole !== 'training') {
    return { ...base, outcome: 'not_eligible', reasonCode: 'source_not_core_training' };
  }
  if (!input.persistenceCompleted) {
    return { ...base, outcome: 'not_eligible', reasonCode: 'persistence_incomplete' };
  }
  if (!input.identitiesAligned) {
    return { ...base, outcome: 'not_eligible', reasonCode: 'identity_not_aligned' };
  }
  if (input.revisionAvailable) {
    return { ...base, outcome: 'intervention_conflict', reasonCode: 'revision_has_priority' };
  }
  if (input.alreadyTerminatedForAttempt) {
    return { ...base, outcome: 'not_eligible', reasonCode: 'attempt_already_evaluated' };
  }
  if (input.completedAssignmentCount >= TARGETED_MICRO_TRAINING_SESSION_LIMIT) {
    return { ...base, outcome: 'limit_reached', reasonCode: 'session_limit_reached' };
  }
  if (input.hasPendingOrInProgressAssignment) {
    return { ...base, outcome: 'not_eligible', reasonCode: 'assignment_already_active' };
  }
  if (input.primaryGapRequirementIds.length !== 1) {
    return { ...base, outcome: 'not_eligible', reasonCode: 'primary_gap_not_unique' };
  }
  if (rawGap === 'insufficient_to_judge') {
    return { ...base, outcome: 'not_eligible', reasonCode: 'answer_not_judgeable' };
  }
  if (!gapReasonCode) {
    return { ...base, outcome: 'not_eligible', reasonCode: 'gap_not_supported' };
  }
  if (!input.primaryAbilityId) {
    return { ...base, outcome: 'not_eligible', reasonCode: 'ability_not_resolved' };
  }
  return { ...base, outcome: 'eligible', reasonCode: 'eligible' };
}

export function createTargetedMicroTrainingRequestFromDecision(input: {
  decision: TargetedMicroTrainingTriggerDecision;
  excludedSourceAnchors?: TargetedSourceAnchor[];
  excludedResourceVersionIds?: string[];
}): TargetedMicroTrainingRequest {
  const { decision } = input;
  if (decision.outcome !== 'eligible' || !decision.abilityId || !decision.gapReasonCode) {
    throw new Error('Only an eligible trigger decision can create a targeted request.');
  }
  return {
    requestId: buildTargetedMicroTrainingRequestId({
      studentId: decision.studentId,
      sourceAttemptId: decision.sourceAttemptId,
      gapReasonCode: decision.gapReasonCode,
    }),
    studentId: decision.studentId,
    learningSessionId: decision.learningSessionId,
    sourceLearningRoundId: decision.sourceLearningRoundId,
    sourceAttemptId: decision.sourceAttemptId,
    abilityId: decision.abilityId,
    gapReasonCode: decision.gapReasonCode,
    taskRole: 'training',
    materialRelationPolicy: 'prefer_new_context',
    excludedSourceAnchors: input.excludedSourceAnchors || [],
    excludedResourceVersionIds: input.excludedResourceVersionIds || [],
    maxTaskCount: 1,
    createdAt: decision.evaluatedAt,
  };
}

export function matchTargetedMicroTrainingResource(
  input: TargetedMicroTrainingMatchInput,
): TargetedMicroTrainingMatchResult {
  const materials = new Map(
    input.activeMaterials
      .filter((material) => material.status !== 'retired' && material.usageType === 'targeted_excerpt')
      .map((material) => [material.materialVersionId, material]),
  );
  const versions = new Map(input.currentFrozenVersions.map((version) => [version.resourceVersionId, version]));
  const excluded = new Set(input.request.excludedResourceVersionIds);
  const candidates = input.activeRegistryEntries
    .filter((entry) => entry.status === 'active' && Boolean(entry.currentFrozenVersionId))
    .map((entry) => ({ entry, version: versions.get(entry.currentFrozenVersionId!) }))
    .filter((item): item is { entry: ResourceRegistryEntry; version: FrozenQuestionResourceVersion } => Boolean(item.version))
    .filter(({ entry, version }) => entry.currentFrozenVersionId === version.resourceVersionId)
    .filter(({ version }) => version.status === 'frozen')
    .filter(({ version }) => version.resourceVersionId !== input.sourceResourceVersionId)
    .filter(({ entry, version }) => entry.taskRole === 'training' && version.abilityMetadata.taskRole === 'training')
    .filter(({ entry, version }) => entry.abilityId === input.request.abilityId
      && version.abilityMetadata.abilityId === input.request.abilityId)
    .filter(({ entry, version }) => (
      entry.targetedTrainingMetadata?.primaryGapReasonCode === input.request.gapReasonCode
      && version.abilityMetadata.targetedTrainingMetadata?.primaryGapReasonCode === input.request.gapReasonCode
    ))
    .filter(({ version }) => !excluded.has(version.resourceVersionId))
    .map(({ entry, version }) => {
      const targetedMaterialVersionId = entry.targetedTrainingMetadata!.targetedMaterialVersionId;
      const versionMaterialId = version.abilityMetadata.targetedTrainingMetadata!.targetedMaterialVersionId;
      const material = materials.get(targetedMaterialVersionId);
      return { entry, version, material, targetedMaterialVersionId, versionMaterialId };
    })
    .filter((item): item is typeof item & { material: QuestionMaterialVersion } => Boolean(item.material))
    .filter(({ version, material, targetedMaterialVersionId, versionMaterialId }) => (
      targetedMaterialVersionId === versionMaterialId
      && version.materialVersionId === targetedMaterialVersionId
      && material.materialVersionId === targetedMaterialVersionId
      && material.targetedExcerptMetadata?.targetAbilityIds.includes(input.request.abilityId)
      && material.targetedExcerptMetadata?.supportedGapReasonCodes.includes(input.request.gapReasonCode)
    ))
    .filter(({ version, material }) => !leaksSourceAnswer({
      material,
      version,
      sourceMaterialId: input.sourceMaterialId,
      sourceAnchors: input.sourceAnchors,
      excludedSourceAnchors: input.request.excludedSourceAnchors,
    }))
    .sort((left, right) => {
      const leftSame = left.material.targetedExcerptMetadata?.parentMaterialId === input.sourceMaterialId ? 1 : 0;
      const rightSame = right.material.targetedExcerptMetadata?.parentMaterialId === input.sourceMaterialId ? 1 : 0;
      return leftSame - rightSame
        || left.version.resourceVersionId.localeCompare(right.version.resourceVersionId);
    });

  const selected = candidates[0];
  return selected
    ? {
        status: 'matched',
        resourceVersionId: selected.version.resourceVersionId,
        materialVersionId: selected.material.materialVersionId,
        matchPolicyVersion: TARGETED_MICRO_TRAINING_MATCH_POLICY_VERSION,
      }
    : {
        status: 'no_match',
        reasonCode: 'no_exact_active_resource',
        matchPolicyVersion: TARGETED_MICRO_TRAINING_MATCH_POLICY_VERSION,
      };
}

export function createTargetedMicroTrainingAssignment(input: {
  request: TargetedMicroTrainingRequest;
  match: TargetedMicroTrainingMatchResult;
  sourceCoreTaskNumber: number;
}): TargetedMicroTrainingAssignment {
  if (input.match.status !== 'matched') throw new Error('A matched resource is required.');
  return {
    assignmentId: buildTargetedMicroTrainingAssignmentId({
      requestId: input.request.requestId,
      resourceVersionId: input.match.resourceVersionId,
    }),
    requestId: input.request.requestId,
    sourceLearningRoundId: input.request.sourceLearningRoundId,
    resourceVersionId: input.match.resourceVersionId,
    status: 'pending',
    returnToCoreTaskNumber: input.sourceCoreTaskNumber + 1,
  };
}

export function activateTargetedMicroTrainingOverlay(input: {
  overlay: TargetedMicroTrainingSessionOverlay;
  assignment: TargetedMicroTrainingAssignment;
  now: string;
}): TargetedMicroTrainingSessionOverlay {
  if (input.overlay.mode === 'targeted' && input.overlay.activeAssignmentId !== input.assignment.assignmentId) {
    throw new Error('Another targeted assignment is already active.');
  }
  return {
    ...input.overlay,
    mode: 'targeted',
    activeAssignmentId: input.assignment.assignmentId,
    returnToCoreTaskNumber: input.assignment.returnToCoreTaskNumber,
    overlayRevision: input.overlay.overlayRevision + 1,
    updatedAt: input.now,
  };
}

export function settleTargetedMicroTrainingOverlay(input: {
  overlay: TargetedMicroTrainingSessionOverlay;
  assignment: TargetedMicroTrainingAssignment;
  terminalStatus: 'completed' | 'skipped' | 'unavailable';
  now: string;
}): TargetedMicroTrainingSessionOverlay {
  if (input.overlay.activeAssignmentId !== input.assignment.assignmentId) {
    throw new Error('Cannot settle an assignment that is not active in this session.');
  }
  const completed = uniqueAppend(input.overlay.completedAssignmentIds,
    input.terminalStatus === 'completed' ? input.assignment.assignmentId : undefined);
  const skipped = uniqueAppend(input.overlay.skippedAssignmentIds,
    input.terminalStatus === 'skipped' ? input.assignment.assignmentId : undefined);
  const unavailable = uniqueAppend(input.overlay.unavailableAssignmentIds,
    input.terminalStatus === 'unavailable' ? input.assignment.assignmentId : undefined);
  return {
    ...input.overlay,
    mode: 'core',
    activeAssignmentId: undefined,
    returnToCoreTaskNumber: input.assignment.returnToCoreTaskNumber,
    completedAssignmentIds: completed,
    skippedAssignmentIds: skipped,
    unavailableAssignmentIds: unavailable,
    consumedCount: completed.length,
    overlayRevision: input.overlay.overlayRevision + 1,
    updatedAt: input.now,
  };
}

function leaksSourceAnswer(input: {
  material: QuestionMaterialVersion;
  version: FrozenQuestionResourceVersion;
  sourceMaterialId: string;
  sourceAnchors: TargetedSourceAnchor[];
  excludedSourceAnchors: TargetedSourceAnchor[];
}): boolean {
  const metadata = input.material.targetedExcerptMetadata;
  if (!metadata) return true;
  if (metadata.sourceRelation !== 'same_material_excerpt') return false;
  if (metadata.parentMaterialId !== input.sourceMaterialId || !metadata.sourceAnchor) return true;
  const sourceAnchors = [...input.sourceAnchors, ...input.excludedSourceAnchors];
  if (sourceAnchors.length === 0) return true;
  const candidate: TargetedSourceAnchor = {
    materialId: input.sourceMaterialId,
    ...metadata.sourceAnchor,
  };
  return sourceAnchors.some((anchor) => anchorsOverlap(candidate, anchor));
}

function anchorsOverlap(left: TargetedSourceAnchor, right: TargetedSourceAnchor): boolean {
  if (left.materialId !== right.materialId) return false;
  if (left.contentHash === right.contentHash) return true;
  if (left.paragraphStart === undefined || left.paragraphEnd === undefined
    || right.paragraphStart === undefined || right.paragraphEnd === undefined) return false;
  return left.paragraphStart <= right.paragraphEnd && right.paragraphStart <= left.paragraphEnd;
}

function uniqueAppend(values: string[], value?: string): string[] {
  return value && !values.includes(value) ? [...values, value] : [...values];
}
