import {
  READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
  calculateTaskGroupProgressionPlanHash,
  isTaskGroupProgressionPlan,
  type TaskGroupProgressionPlan,
} from './readingTaskGroupProgression.schema.ts';
import {
  calculateTaskLoadSemanticsHash,
  cloneTaskLoadSemantics,
  isTaskLoadSemantics,
  type TaskLoadSemantics,
} from './readingTaskLoadSemantics.schema.ts';
import { READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION } from
  './readingTrainingProgressionAudit.schema.ts';

export const FORMAL_TASK_PROGRESSION_METADATA_SCHEMA_VERSION =
  'formal_task_progression_metadata_v1' as const;
export const FORMAL_TASK_GROUP_PROGRESSION_ARTIFACT_SCHEMA_VERSION =
  'formal_task_group_progression_artifact_v1' as const;

export type FormalTaskProgressionMetadata = {
  schemaVersion: typeof FORMAL_TASK_PROGRESSION_METADATA_SCHEMA_VERSION;
  policyVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION;
  stageRuleVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION;
  materialVersionId: string;
  observationPlanRevisionId: string;
  planningTaskKey: string;
  taskGroupProgressionPlanHash: string;
  sequenceRank: number;
  taskLoadSemantics: TaskLoadSemantics;
  taskLoadSemanticsHash: string;
};

export type FormalTaskGroupProgressionArtifact = {
  schemaVersion: typeof FORMAL_TASK_GROUP_PROGRESSION_ARTIFACT_SCHEMA_VERSION;
  planHash: string;
  materialVersionId: string;
  observationPlanRevisionId: string;
  progressionPlan: TaskGroupProgressionPlan;
  sourceCandidateIds: string[];
  createdAt: string;
};

export function buildFormalTaskProgressionMetadata(input: {
  materialVersionId: string;
  observationPlanRevisionId: string;
  planningTaskKey: string;
  progressionPlan: TaskGroupProgressionPlan;
  taskLoadSemantics: TaskLoadSemantics;
  taskLoadSemanticsHash?: string;
}): FormalTaskProgressionMetadata {
  const member = input.progressionPlan.orderedTasks.find(
    (item) => item.planningTaskKey === input.planningTaskKey,
  );
  if (!member) throw new Error('formal_progression_member_missing');
  const semanticsHash = calculateTaskLoadSemanticsHash(input.taskLoadSemantics);
  if (input.taskLoadSemanticsHash && input.taskLoadSemanticsHash !== semanticsHash) {
    throw new Error('formal_progression_semantics_hash_mismatch');
  }
  const metadata: FormalTaskProgressionMetadata = {
    schemaVersion: FORMAL_TASK_PROGRESSION_METADATA_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    stageRuleVersion: READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
    materialVersionId: input.materialVersionId,
    observationPlanRevisionId: input.observationPlanRevisionId,
    planningTaskKey: input.planningTaskKey,
    taskGroupProgressionPlanHash: input.progressionPlan.planHash,
    sequenceRank: member.sequenceRank,
    taskLoadSemantics: cloneTaskLoadSemantics(input.taskLoadSemantics)!,
    taskLoadSemanticsHash: semanticsHash,
  };
  if (!isFormalTaskProgressionMetadata(metadata)) {
    throw new Error('formal_progression_metadata_invalid');
  }
  return metadata;
}

export function buildFormalTaskGroupProgressionArtifact(input: {
  progressionPlan: TaskGroupProgressionPlan;
  sourceCandidateIds: string[];
  createdAt?: string;
}): FormalTaskGroupProgressionArtifact {
  const artifact: FormalTaskGroupProgressionArtifact = {
    schemaVersion: FORMAL_TASK_GROUP_PROGRESSION_ARTIFACT_SCHEMA_VERSION,
    planHash: input.progressionPlan.planHash,
    materialVersionId: input.progressionPlan.materialVersionId,
    observationPlanRevisionId: input.progressionPlan.observationPlanRevisionId,
    progressionPlan: clone(input.progressionPlan),
    sourceCandidateIds: [...new Set(input.sourceCandidateIds.filter(nonEmpty))].sort(),
    createdAt: input.createdAt || new Date().toISOString(),
  };
  if (!isFormalTaskGroupProgressionArtifact(artifact)) {
    throw new Error('formal_progression_artifact_invalid');
  }
  return artifact;
}

export function isFormalTaskProgressionMetadata(
  value: unknown,
): value is FormalTaskProgressionMetadata {
  if (!value || typeof value !== 'object') return false;
  const metadata = value as FormalTaskProgressionMetadata;
  return metadata.schemaVersion === FORMAL_TASK_PROGRESSION_METADATA_SCHEMA_VERSION
    && metadata.policyVersion === READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION
    && metadata.stageRuleVersion === READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION
    && nonEmpty(metadata.materialVersionId)
    && nonEmpty(metadata.observationPlanRevisionId)
    && nonEmpty(metadata.planningTaskKey)
    && nonEmpty(metadata.taskGroupProgressionPlanHash)
    && Number.isInteger(metadata.sequenceRank)
    && metadata.sequenceRank > 0
    && isTaskLoadSemantics(metadata.taskLoadSemantics)
    && metadata.taskLoadSemantics.derivationSource === 'planned'
    && metadata.taskLoadSemanticsHash
      === calculateTaskLoadSemanticsHash(metadata.taskLoadSemantics);
}

export function isFormalTaskGroupProgressionArtifact(
  value: unknown,
): value is FormalTaskGroupProgressionArtifact {
  if (!value || typeof value !== 'object') return false;
  const artifact = value as FormalTaskGroupProgressionArtifact;
  return artifact.schemaVersion === FORMAL_TASK_GROUP_PROGRESSION_ARTIFACT_SCHEMA_VERSION
    && nonEmpty(artifact.planHash)
    && nonEmpty(artifact.materialVersionId)
    && nonEmpty(artifact.observationPlanRevisionId)
    && isTaskGroupProgressionPlan(artifact.progressionPlan)
    && artifact.planHash === artifact.progressionPlan.planHash
    && artifact.planHash === calculateTaskGroupProgressionPlanHash(artifact.progressionPlan)
    && artifact.materialVersionId === artifact.progressionPlan.materialVersionId
    && artifact.observationPlanRevisionId
      === artifact.progressionPlan.observationPlanRevisionId
    && Array.isArray(artifact.sourceCandidateIds)
    && new Set(artifact.sourceCandidateIds).size === artifact.sourceCandidateIds.length
    && artifact.sourceCandidateIds.every(nonEmpty)
    && nonEmpty(artifact.createdAt);
}

export function cloneFormalTaskProgressionMetadata(
  value: FormalTaskProgressionMetadata | undefined,
): FormalTaskProgressionMetadata | undefined {
  return value ? clone(value) : undefined;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
