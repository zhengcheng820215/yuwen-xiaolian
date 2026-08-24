import type { FormalTaskProgressionMetadata } from
  './formalTaskProgressionMetadata.schema.ts';
import { isFormalTaskProgressionMetadata } from
  './formalTaskProgressionMetadata.schema.ts';
import type { ReadingLoadResponsibility } from
  './readingTrainingProgressionAudit.schema.ts';
import { READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION } from
  './readingTrainingProgressionAudit.schema.ts';
import type { TaskGroupProgressionTransition } from
  './readingTaskGroupProgression.schema.ts';
import { isTaskLoadSemantics, type TaskLoadSemantics } from
  './readingTaskLoadSemantics.schema.ts';

export const LEARNING_PROGRESSION_CONTEXT_SCHEMA_VERSION =
  'learning_progression_context_v1' as const;

export type LearningProgressionAuthoritySource =
  | 'native_authority'
  | 'legacy_projection'
  | 'none';

export type LearningProgressionContextSnapshot = {
  schemaVersion: typeof LEARNING_PROGRESSION_CONTEXT_SCHEMA_VERSION;
  policyVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION;
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  learningTaskAttemptId: string;
  resourceVersionId: string;
  materialVersionId: string;
  authoritySource: LearningProgressionAuthoritySource;
  taskGroupProgressionPlanHash?: string;
  planningTaskKey?: string;
  sequenceRank?: number;
  taskLoadSemantics?: TaskLoadSemantics;
  taskLoadSemanticsHash?: string;
  predecessor?: {
    resourceVersionId: string;
    planningTaskKey: string;
    sequenceRank: number;
    transitionId: string;
    threadRelation: 'same_thread' | 'cross_thread';
    addedResponsibilities: ReadingLoadResponsibility[];
    loadDirection: 'same' | 'increase' | 'decrease' | 'independent';
  };
  comparisonEligibility: 'eligible' | 'ordering_only' | 'not_comparable';
  comparisonLimitations: string[];
  snapshotHash: string;
  capturedAt: string;
};

export function createLearningProgressionContextSnapshot(input: Omit<
  LearningProgressionContextSnapshot,
  'schemaVersion' | 'policyVersion' | 'snapshotHash'
>): LearningProgressionContextSnapshot {
  const base = {
    schemaVersion: LEARNING_PROGRESSION_CONTEXT_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    ...clone(input),
  };
  const snapshot: LearningProgressionContextSnapshot = {
    ...base,
    snapshotHash: calculateLearningProgressionContextSnapshotHash(base),
  };
  if (!isLearningProgressionContextSnapshot(snapshot)) {
    throw new Error('learning_progression_context_invalid');
  }
  return snapshot;
}

export function calculateLearningProgressionContextSnapshotHash(
  value: Omit<LearningProgressionContextSnapshot, 'snapshotHash'>
    | LearningProgressionContextSnapshot,
): string {
  const { snapshotHash: _ignored, capturedAt: _capturedAt, ...identity } =
    value as LearningProgressionContextSnapshot;
  return stableHash(identity, 'learning-progression');
}

export function isLearningProgressionContextSnapshot(
  value: unknown,
): value is LearningProgressionContextSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as LearningProgressionContextSnapshot;
  const native = snapshot.authoritySource === 'native_authority';
  return snapshot.schemaVersion === LEARNING_PROGRESSION_CONTEXT_SCHEMA_VERSION
    && snapshot.policyVersion === READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION
    && [snapshot.studentId, snapshot.learningSessionId, snapshot.learningRoundId,
      snapshot.learningTaskAttemptId, snapshot.resourceVersionId,
      snapshot.materialVersionId, snapshot.capturedAt].every(nonEmpty)
    && ['native_authority', 'legacy_projection', 'none'].includes(snapshot.authoritySource)
    && ['eligible', 'ordering_only', 'not_comparable']
      .includes(snapshot.comparisonEligibility)
    && Array.isArray(snapshot.comparisonLimitations)
    && snapshot.comparisonLimitations.every(nonEmpty)
    && (!native || (
      nonEmpty(snapshot.taskGroupProgressionPlanHash)
      && nonEmpty(snapshot.planningTaskKey)
      && Number.isInteger(snapshot.sequenceRank)
      && Number(snapshot.sequenceRank) > 0
      && isTaskLoadSemantics(snapshot.taskLoadSemantics)
      && nonEmpty(snapshot.taskLoadSemanticsHash)
    ))
    && (native || snapshot.comparisonEligibility !== 'eligible')
    && (!snapshot.predecessor || isPredecessor(snapshot.predecessor))
    && nonEmpty(snapshot.snapshotHash)
    && snapshot.snapshotHash === calculateLearningProgressionContextSnapshotHash(snapshot);
}

export function nativeProgressionMetadataIsUsable(
  value: FormalTaskProgressionMetadata | undefined,
): value is FormalTaskProgressionMetadata {
  return isFormalTaskProgressionMetadata(value);
}

export function transitionToSnapshotPredecessor(input: {
  predecessorResourceVersionId: string;
  transition: TaskGroupProgressionTransition;
  predecessorSequenceRank: number;
}): LearningProgressionContextSnapshot['predecessor'] {
  return {
    resourceVersionId: input.predecessorResourceVersionId,
    planningTaskKey: input.transition.fromPlanningTaskKey,
    sequenceRank: input.predecessorSequenceRank,
    transitionId: input.transition.transitionId,
    threadRelation: input.transition.threadRelation,
    addedResponsibilities: [...input.transition.addedResponsibilities],
    loadDirection: input.transition.loadDirection,
  };
}

function isPredecessor(
  value: NonNullable<LearningProgressionContextSnapshot['predecessor']>,
): boolean {
  return [value.resourceVersionId, value.planningTaskKey, value.transitionId].every(nonEmpty)
    && Number.isInteger(value.sequenceRank)
    && value.sequenceRank > 0
    && ['same_thread', 'cross_thread'].includes(value.threadRelation)
    && Array.isArray(value.addedResponsibilities)
    && ['same', 'increase', 'decrease', 'independent'].includes(value.loadDirection);
}

function stableHash(value: unknown, prefix: string): string {
  const serialized = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
