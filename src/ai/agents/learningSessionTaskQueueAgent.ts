import {
  LEARNING_SESSION_TASK_QUEUE_VERSION,
  isLearningSessionTaskQueue,
  type LearningSessionTaskQueue,
} from '../schemas/unifiedLearningEntry.schema.ts';
import type { FrozenQuestionResourceVersion } from '../schemas/questionResourceAdmission.schema.ts';
import type { FormalTaskGroupProgressionArtifact } from
  '../schemas/formalTaskProgressionMetadata.schema.ts';
import { orderFormalResourcesForLearningSequence } from './learningTaskSequenceScheduler.ts';

export const LEARNING_SESSION_TASK_QUEUE_MAX_COUNT = 6;

export type LearningSessionTaskQueueProgress = {
  currentTaskNumber: number;
  totalTaskCount: number;
  currentResourceVersionId?: string;
  nextResourceVersionId?: string;
  hasNextTask: boolean;
  isComplete: boolean;
};

export type LearningSessionNextTaskAdmissionSnapshot = {
  status?: string;
  resourceVersion?: {
    resourceVersionId?: string;
  };
  taskReadiness?: {
    canExecute?: boolean;
  };
};

/**
 * A queue pointer is only navigation intent. Learning may expose the next
 * question after the exact queued Frozen Version has passed the formal match
 * and executable-readiness boundary for this checkpoint.
 */
export function canAdvanceLearningSessionTaskQueue(input: {
  hasFormalRoundResult: boolean;
  checkpointStatus: string;
  queueProgress: LearningSessionTaskQueueProgress;
  nextTaskResolution?: LearningSessionNextTaskAdmissionSnapshot;
}): boolean {
  const expectedNextResourceVersionId = input.queueProgress.nextResourceVersionId;
  const resolution = input.nextTaskResolution;
  return Boolean(
    input.hasFormalRoundResult
    && input.checkpointStatus === 'completed'
    && input.queueProgress.hasNextTask
    && expectedNextResourceVersionId
    && resolution?.status === 'matched'
    && resolution.resourceVersion?.resourceVersionId === expectedNextResourceVersionId
    && resolution.taskReadiness?.canExecute === true,
  );
}

export function createLearningSessionTaskQueue(input: {
  firstResourceVersion: FrozenQuestionResourceVersion;
  currentVersions: FrozenQuestionResourceVersion[];
  createdAt: string;
  maxTaskCount?: number;
  currentTaskNumber?: number;
  progressionArtifacts?: FormalTaskGroupProgressionArtifact[];
}): LearningSessionTaskQueue {
  const maxTaskCount = Math.min(
    LEARNING_SESSION_TASK_QUEUE_MAX_COUNT,
    Math.max(1, Math.floor(input.maxTaskCount || LEARNING_SESSION_TASK_QUEUE_MAX_COUNT)),
  );
  const first = input.firstResourceVersion;
  const candidates = input.currentVersions.filter((version) => (
    version.status === 'frozen' &&
    version.materialId === first.materialId &&
    version.abilityMetadata.taskRole === 'training'
  ));
  const ordered = first.abilityMetadata.taskRole === 'training'
    ? orderFormalResourcesForLearningSequence(candidates, {
        taskRole: 'training',
        progressionArtifacts: input.progressionArtifacts,
      })
    : [first];
  const otherResourceVersionIds = unique(ordered
    .map((version) => version.resourceVersionId)
    .filter((resourceVersionId) => resourceVersionId !== first.resourceVersionId));
  const currentTaskIndex = Math.min(
    Math.max(0, Math.floor(input.currentTaskNumber || 1) - 1),
    Math.max(0, maxTaskCount - 1),
    otherResourceVersionIds.length,
  );
  const resourceVersionIds = first.abilityMetadata.taskRole === 'training'
    ? unique([
        ...otherResourceVersionIds.slice(0, currentTaskIndex),
        first.resourceVersionId,
        ...otherResourceVersionIds.slice(currentTaskIndex),
      ]).slice(0, maxTaskCount)
    : [first.resourceVersionId];
  const queue: LearningSessionTaskQueue = {
    queueVersion: LEARNING_SESSION_TASK_QUEUE_VERSION,
    materialId: first.materialId,
    resourceVersionIds,
    targetTaskCount: resourceVersionIds.length,
    createdAt: input.createdAt,
  };
  if (!isLearningSessionTaskQueue(queue)) {
    throw new Error('LearningSessionTaskQueue validation failed.');
  }
  return queue;
}

/**
 * Rebuild a missing legacy Session queue from the exact Frozen Version that
 * was already presented in the previous round. A newer Registry head for the
 * same resource must not be inserted beside that immutable Session version.
 */
export function createRecoveredLearningSessionTaskQueue(input: {
  previousResourceVersion: FrozenQuestionResourceVersion;
  currentVersions: FrozenQuestionResourceVersion[];
  createdAt: string;
  currentTaskNumber: number;
  maxTaskCount?: number;
  progressionArtifacts?: FormalTaskGroupProgressionArtifact[];
}): LearningSessionTaskQueue {
  const previous = input.previousResourceVersion.status === 'superseded'
    ? { ...input.previousResourceVersion, status: 'frozen' as const }
    : input.previousResourceVersion;
  const recoveryVersions = uniqueByResourceVersionId([
    previous,
    ...input.currentVersions.filter((version) => (
      version.resourceId !== previous.resourceId
    )),
  ]);
  return createLearningSessionTaskQueue({
    firstResourceVersion: previous,
    currentVersions: recoveryVersions,
    createdAt: input.createdAt,
    currentTaskNumber: input.currentTaskNumber,
    maxTaskCount: input.maxTaskCount,
    progressionArtifacts: input.progressionArtifacts,
  });
}

export function resolveLearningSessionTaskQueueProgress(
  queue: LearningSessionTaskQueue | undefined,
  currentTaskNumber: number,
): LearningSessionTaskQueueProgress {
  const normalizedTaskNumber = Number.isInteger(currentTaskNumber) && currentTaskNumber > 0
    ? currentTaskNumber
    : 1;
  const totalTaskCount = queue?.targetTaskCount || 1;
  const currentIndex = normalizedTaskNumber - 1;
  return {
    currentTaskNumber: normalizedTaskNumber,
    totalTaskCount,
    currentResourceVersionId: queue?.resourceVersionIds[currentIndex],
    nextResourceVersionId: queue?.resourceVersionIds[currentIndex + 1],
    hasNextTask: Boolean(queue?.resourceVersionIds[currentIndex + 1]),
    isComplete: Boolean(queue && normalizedTaskNumber >= totalTaskCount),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function uniqueByResourceVersionId(
  versions: FrozenQuestionResourceVersion[],
): FrozenQuestionResourceVersion[] {
  return [...new Map(versions.map((version) => [version.resourceVersionId, version])).values()];
}
