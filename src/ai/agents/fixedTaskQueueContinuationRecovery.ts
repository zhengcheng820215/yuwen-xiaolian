import type { LearningSessionTaskQueueProgress } from './learningSessionTaskQueueAgent.ts';
import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';
import type { RealLearningOperationCheckpoint } from '../schemas/realLearningOperation.schema.ts';
import type { NextFormalTaskResolution } from '../schemas/realLearningOperation.schema.ts';
import type { StudentResponse } from '../schemas/taskExecution.schema.ts';
import type { FrozenQuestionResourceVersion } from '../schemas/questionResourceAdmission.schema.ts';
import type { TaskRequest } from '../schemas/nextLearningStrategy.schema.ts';
import { RESOURCE_MATCH_QUALITY_SCHEMA_VERSION } from '../schemas/resourceMatchQuality.schema.ts';
import { prepareConcreteLearningTaskFromFrozenResource } from './frozenQuestionResourceTaskAdapter.ts';
import { buildStableId } from './reviewedResourceCandidateAdapter.ts';

export function shouldRecoverFixedTaskQueueAdmission(input: {
  hasFormalRoundResult: boolean;
  checkpointStatus: RealLearningOperationCheckpoint['status'];
  checkpointNextAction: RealLearningOperationCheckpoint['nextAction'];
  queueProgress: LearningSessionTaskQueueProgress;
  canAdvance: boolean;
  queueBlocked: boolean;
}): boolean {
  if (!input.hasFormalRoundResult || input.canAdvance || input.queueBlocked) return false;
  if (!input.queueProgress.hasNextTask || input.queueProgress.isComplete) return false;
  if (input.checkpointStatus === 'completed') return true;
  if (input.checkpointStatus === 'review_required' && input.checkpointNextAction === 'human_review') return true;
  return ['blocked', 'retry_required'].includes(input.checkpointStatus)
    && input.checkpointNextAction === 'prepare_resource';
}

export function restoreFixedTaskQueueCheckpointFromPersistence(input: {
  checkpoint: RealLearningOperationCheckpoint;
  persistence?: LearningPersistenceRecord;
  expectedNextResourceVersionId?: string;
}): {
  checkpoint: RealLearningOperationCheckpoint;
  studentResponse?: StudentResponse;
  changed: boolean;
} {
  const persistence = input.persistence;
  const persistenceCompleted = persistence?.learningRoundResult?.status === 'completed';
  const persistedExecution = persistence?.learningRoundResult?.executionResult?.taskExecutionResult;
  const persistedResponse = persistence?.studentResponse || persistedExecution?.studentResponse || undefined;
  const checkpointExecution = input.checkpoint.taskExecutionResult;
  const restoredExecution = checkpointExecution
    ? checkpointExecution.studentResponse || !persistedResponse
      ? checkpointExecution
      : { ...checkpointExecution, studentResponse: persistedResponse }
    : persistedExecution;
  const restoredPersistenceRecordId = input.checkpoint.learningPersistenceRecordId
    || (persistenceCompleted ? persistence?.recordId : undefined);
  const nextAdmissionComplete = Boolean(
    input.checkpoint.nextTaskResolution?.status === 'matched'
    && input.checkpoint.nextTaskResolution.resourceVersion?.resourceVersionId
      === input.expectedNextResourceVersionId
    && input.checkpoint.nextTaskResolution.qualityGatedTask
    && input.checkpoint.nextTaskResolution.concreteTask
    && input.checkpoint.nextTaskResolution.taskReadiness?.canExecute === true,
  );
  const hasExpectedContinuation = Boolean(
    persistenceCompleted
    && input.expectedNextResourceVersionId,
  );
  const resetIncompleteAdmission = hasExpectedContinuation && !nextAdmissionComplete;
  const normalizeCompletedAdmission = hasExpectedContinuation
    && nextAdmissionComplete
    && (
      input.checkpoint.stage !== 'next_task_ready'
      || input.checkpoint.status !== 'completed'
      || input.checkpoint.nextAction !== 'start_next_task'
    );
  const changed = restoredExecution !== checkpointExecution
    || restoredPersistenceRecordId !== input.checkpoint.learningPersistenceRecordId
    || resetIncompleteAdmission
    || normalizeCompletedAdmission;
  return {
    checkpoint: changed
      ? {
        ...input.checkpoint,
        taskExecutionResult: restoredExecution,
        learningPersistenceRecordId: restoredPersistenceRecordId,
        ...(resetIncompleteAdmission ? {
          stage: 'persisted' as const,
          status: 'completed' as const,
          nextAction: 'prepare_resource' as const,
          nextTaskResolution: undefined,
        } : normalizeCompletedAdmission ? {
          stage: 'next_task_ready' as const,
          status: 'completed' as const,
          nextAction: 'start_next_task' as const,
        } : {}),
      }
      : input.checkpoint,
    studentResponse: restoredExecution?.studentResponse || persistedResponse,
    changed,
  };
}

/**
 * The next Frozen Version has already crossed admission at the previous
 * checkpoint. Entering that exact queue item must consume the frozen snapshot
 * instead of running a second, state-dependent match that can invalidate a
 * continuation which was already presented as executable.
 */
export function reusableFixedQueueAdmission(input: {
  plannedResolution?: NextFormalTaskResolution;
  expectedResourceVersionId?: string;
}): NextFormalTaskResolution | undefined {
  const resolution = input.plannedResolution;
  return resolution?.status === 'matched'
    && resolution.resourceVersion?.resourceVersionId === input.expectedResourceVersionId
    && resolution.taskReadiness?.canExecute === true
    && Boolean(resolution.qualityGatedTask)
    ? resolution
    : undefined;
}

/**
 * A Frozen Version already placed in a fixed Learning queue has crossed the
 * authoring publication boundary. Continuing that queue must restore its
 * executable wrapper deterministically instead of asking the adaptive matcher
 * to re-admit the same published task against a newer history window.
 */
export function buildFixedQueueAdmissionFromFrozenResource(input: {
  resourceVersion: FrozenQuestionResourceVersion;
  taskRequest: TaskRequest;
  createdAt: string;
}): NextFormalTaskResolution {
  const { resourceVersion, taskRequest, createdAt } = input;
  if (resourceVersion.status !== 'frozen') {
    return {
      status: 'blocked',
      taskRequestId: taskRequest.taskRequestId,
      resolvedTaskRequest: taskRequest,
      issues: ['fixed_queue_resource_version_not_frozen'],
    };
  }
  const identity = [
    taskRequest.taskRequestId,
    resourceVersion.resourceVersionId,
    resourceVersion.validationId,
    resourceVersion.reviewId,
  ];
  const qualityGatedTask = {
    traceId: buildStableId('fixed-queue-quality-task', identity),
    executableTask: {
      executableTaskId: buildStableId('fixed-queue-executable-task', identity),
      studentId: taskRequest.studentId,
      sourceType: 'resource_match' as const,
      sourceTaskId: resourceVersion.taskId,
      taskRole: resourceVersion.abilityMetadata.taskRole,
      targetAbilityId: resourceVersion.abilityMetadata.abilityId,
      validationGoal: taskRequest.validationGoal,
      contentRef: resourceVersion.materialVersionId || `resource-version:${resourceVersion.resourceVersionId}`,
      questionRef: `question:${resourceVersion.taskId}`,
      rubricRef: `rubric:${resourceVersion.resourceVersionId}`,
      sourceStrategyId: taskRequest.strategyId,
      sourceTaskRequestId: taskRequest.taskRequestId,
      sourceFulfillmentRequestId: buildStableId('fixed-queue-fulfillment', identity),
      limitations: ['固定题组续题直接消费已发布 Frozen Resource Version，不重新运行动态候选匹配。'],
      createdAt,
    },
    resourceId: resourceVersion.resourceId,
    resourceVersionId: resourceVersion.resourceVersionId,
    taskId: resourceVersion.taskId,
    materialId: resourceVersion.materialId,
    materialVersionId: resourceVersion.materialVersionId,
    constraintsId: buildStableId('fixed-queue-constraints', identity),
    resourceMatchQualityEvaluationId: buildStableId('fixed-queue-published-admission', identity),
    createdAt,
    schemaVersion: RESOURCE_MATCH_QUALITY_SCHEMA_VERSION,
  };
  const preparation = prepareConcreteLearningTaskFromFrozenResource({
    resourceVersion,
    qualityGatedTask,
    createdAt,
  });
  if (
    preparation.status !== 'prepared'
    || !preparation.concreteTaskResult.concreteTask
    || preparation.concreteTaskResult.readiness?.canExecute !== true
  ) {
    return {
      status: 'blocked',
      taskRequestId: taskRequest.taskRequestId,
      resolvedTaskRequest: taskRequest,
      resourceVersion,
      qualityGatedTask,
      issues: preparation.issues.length > 0
        ? preparation.issues
        : ['fixed_queue_concrete_task_not_executable'],
    };
  }
  return {
    status: 'matched',
    taskRequestId: taskRequest.taskRequestId,
    resolvedTaskRequest: taskRequest,
    resourceVersion,
    qualityGatedTask,
    concreteTask: preparation.concreteTaskResult.concreteTask,
    taskReadiness: preparation.concreteTaskResult.readiness,
    issues: [],
  };
}
