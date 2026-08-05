import type { TaskGroupSubmissionRepository } from '../repositories/taskGroupSubmissionRepository.ts';
import {
  TASK_GROUP_SUBMISSION_SCHEMA_VERSION,
  type CommitTaskGroupChangesResult,
  type TaskGroupSubmission,
  type TaskGroupSubmissionTaskResult,
  type TaskRevisionBinding,
} from '../schemas/taskGroupSubmission.schema.ts';
import type { WorkingTaskContentState } from '../schemas/workingTaskContent.schema.ts';

export type TaskDraftSnapshot = {
  trainingTaskId: string;
  draftId: string;
  revision: number;
  contentHash: string;
};

export type CommitTaskGroupChangesInput = {
  planId: string;
  idempotencyKey: string;
  requestedTaskIds: string[];
  now?: string;
};

export type CommitTaskGroupChangesDependencies = {
  submissionRepository: TaskGroupSubmissionRepository;
  getWorkingState: (trainingTaskId: string) => Promise<WorkingTaskContentState>;
  listTaskDrafts: () => Promise<TaskDraftSnapshot[]>;
  commitWorkingChanges: (submission: TaskGroupSubmission) => Promise<{
    committedPlanId?: string;
    failedTaskIds?: string[];
  } | void>;
  completeTaskAssessment: (draftId: string, revision: number) => Promise<void>;
  completeGroupAssessment: (
    bindings: TaskRevisionBinding[],
    submission: TaskGroupSubmission,
  ) => Promise<void>;
  discardWorkingContent: (trainingTaskId: string) => Promise<void>;
};

export class TaskGroupSubmissionConflictError extends Error {
  readonly code = 'TASK_GROUP_SUBMISSION_BASE_CONFLICT';
  readonly trainingTaskIds: string[];

  constructor(trainingTaskIds: string[]) {
    super(`Working task base revision conflict: ${trainingTaskIds.join(', ')}.`);
    this.name = 'TaskGroupSubmissionConflictError';
    this.trainingTaskIds = trainingTaskIds;
  }
}

export async function commitTaskGroupChanges(
  dependencies: CommitTaskGroupChangesDependencies,
  input: CommitTaskGroupChangesInput,
): Promise<CommitTaskGroupChangesResult> {
  const requestedTaskIds = [...new Set(input.requestedTaskIds.filter(Boolean))];
  if (requestedTaskIds.length === 0) {
    return {
      status: 'no_changes',
      taskResults: [],
      groupAssessmentStatus: 'not_started',
    };
  }

  const existing = await dependencies.submissionRepository.getByIdempotencyKey(
    input.idempotencyKey,
  );
  if (existing?.status === 'completed') return toResult(existing);

  let submission = existing;
  if (!submission) {
    const states = await Promise.all(
      requestedTaskIds.map((taskId) => dependencies.getWorkingState(taskId)),
    );
    const conflicts = requestedTaskIds.filter(
      (_, index) => states[index].status === 'base_revision_conflict',
    );
    if (conflicts.length > 0) throw new TaskGroupSubmissionConflictError(conflicts);

    const currentTaskIds = requestedTaskIds.filter(
      (_, index) => states[index].status === 'current',
    );
    if (currentTaskIds.length === 0) {
      return {
        status: 'no_changes',
        taskResults: requestedTaskIds.map((trainingTaskId) => ({
          trainingTaskId,
          revisionCreated: false,
          completedStages: ['no_changes'],
        })),
        groupAssessmentStatus: 'not_started',
      };
    }

    const before = await dependencies.listTaskDrafts();
    const now = input.now || new Date().toISOString();
    submission = await dependencies.submissionRepository.save({
      submissionId: createSubmissionId(input.planId, now),
      planId: input.planId,
      idempotencyKey: input.idempotencyKey,
      requestedTaskIds: currentTaskIds,
      taskRevisionBindings: before.map((draft) => ({
        trainingTaskId: draft.trainingTaskId,
        fromDraftId: draft.draftId,
        draftId: draft.draftId,
        fromRevision: draft.revision,
        toRevision: draft.revision,
        contentHash: draft.contentHash,
      })),
      unchangedTaskIds: [],
      taskResults: currentTaskIds.map((trainingTaskId) => ({
        trainingTaskId,
        revisionCreated: false,
        completedStages: ['working_content_saved'],
      })),
      status: 'committing',
      groupAssessment: {
        submissionId: '',
        taskRevisionBindings: [],
        ruleVersion: 'task-group-coverage-v1',
        status: 'not_started',
      },
      createdAt: now,
      updatedAt: now,
      schemaVersion: TASK_GROUP_SUBMISSION_SCHEMA_VERSION,
    });
    submission.groupAssessment.submissionId = submission.submissionId;
    submission = await dependencies.submissionRepository.save(submission);
  }

  const hasPendingRevisionCreation = submission.taskResults.some(
    (result) => result.failedStage === 'revision_creation',
  );
  if (submission.status === 'committing' || hasPendingRevisionCreation) {
    const beforeBindings = submission.taskRevisionBindings;
    const beforeByTask = new Map(beforeBindings.map((item) => [item.trainingTaskId, item]));
    const currentDrafts = await dependencies.listTaskDrafts();
    const currentByTask = new Map(currentDrafts.map((item) => [item.trainingTaskId, item]));
    const alreadyCommitted = submission.requestedTaskIds.every((taskId) => {
      const before = beforeByTask.get(taskId);
      const current = currentByTask.get(taskId);
      return Boolean(before && current && (
        current.draftId !== (before.fromDraftId || before.draftId)
        || current.revision > before.fromRevision
        || current.contentHash !== before.contentHash
      ));
    });
    const commitResult = alreadyCommitted
      ? undefined
      : await dependencies.commitWorkingChanges(submission);

    const after = await dependencies.listTaskDrafts();
    const requestedSet = new Set(submission.requestedTaskIds);
    const bindings = after.map((draft): TaskRevisionBinding => {
      const before = beforeByTask.get(draft.trainingTaskId);
      return {
        trainingTaskId: draft.trainingTaskId,
        fromDraftId: before?.fromDraftId || draft.draftId,
        draftId: draft.draftId,
        fromRevision: before?.fromRevision || draft.revision,
        toRevision: draft.revision,
        contentHash: draft.contentHash,
      };
    });
    const changed = bindings.filter(
      (binding) => requestedSet.has(binding.trainingTaskId)
        && (
          binding.draftId !== binding.fromDraftId
          || binding.toRevision > binding.fromRevision
          || binding.contentHash !== beforeByTask.get(binding.trainingTaskId)?.contentHash
        ),
    );
    const failedTaskIds = new Set(commitResult?.failedTaskIds || []);
    if (changed.length === 0 && failedTaskIds.size === 0) {
      await dependencies.submissionRepository.delete(submission.submissionId);
      await Promise.all(submission.requestedTaskIds.map(dependencies.discardWorkingContent));
      return {
        status: 'no_changes',
        taskResults: submission.requestedTaskIds.map((trainingTaskId) => ({
          trainingTaskId,
          revisionCreated: false,
          completedStages: ['working_content_saved', 'no_changes'],
        })),
        groupAssessmentStatus: 'not_started',
      };
    }

    const changedByTask = new Map(changed.map((item) => [item.trainingTaskId, item]));
    submission = await saveSubmission(dependencies, {
      ...submission,
      committedPlanId: commitResult?.committedPlanId || submission.committedPlanId,
      taskRevisionBindings: bindings,
      unchangedTaskIds: bindings
        .filter((item) => !changedByTask.has(item.trainingTaskId))
        .map((item) => item.trainingTaskId),
      taskResults: submission.taskResults.map((result) => {
        const binding = changedByTask.get(result.trainingTaskId);
        return binding
          ? {
            ...result,
            revisionCreated: true,
            revision: binding.toRevision,
            completedStages: unique([...result.completedStages, 'revision_created']),
            failedStage: result.failedStage === 'revision_creation'
              ? undefined
              : result.failedStage,
            nextCommand: result.failedStage === 'revision_creation'
              ? undefined
              : result.nextCommand,
          }
          : failedTaskIds.has(result.trainingTaskId)
            ? {
              ...result,
              failedStage: 'revision_creation',
              nextCommand: 'retry_revision_creation',
            }
          : {
            ...result,
            completedStages: unique([...result.completedStages, 'no_changes']),
            failedStage: undefined,
            nextCommand: undefined,
          };
      }),
      status: 'committed',
      groupAssessment: {
        ...submission.groupAssessment,
        taskRevisionBindings: bindings.map((item) => ({
          trainingTaskId: item.trainingTaskId,
          draftId: item.draftId,
          revision: item.toRevision,
        })),
      },
    });
    await Promise.all(changed.map((item) => (
      dependencies.discardWorkingContent(item.trainingTaskId)
    )));
  }

  submission = await runPendingChecks(dependencies, submission);
  return toResult(submission);
}

async function runPendingChecks(
  dependencies: CommitTaskGroupChangesDependencies,
  current: TaskGroupSubmission,
): Promise<TaskGroupSubmission> {
  let submission = await saveSubmission(dependencies, {
    ...current,
    status: 'checking',
    groupAssessment: {
      ...current.groupAssessment,
      status: current.groupAssessment.status === 'completed' ? 'completed' : 'running',
    },
  });

  const taskResults: TaskGroupSubmissionTaskResult[] = [];
  for (const taskResult of submission.taskResults) {
    const binding = submission.taskRevisionBindings.find(
      (item) => item.trainingTaskId === taskResult.trainingTaskId,
    );
    if (!taskResult.revisionCreated || taskResult.completedStages.includes('quality_assessment')) {
      taskResults.push(taskResult);
      continue;
    }
    try {
      if (!binding) throw new Error(`Task revision binding not found: ${taskResult.trainingTaskId}`);
      await dependencies.completeTaskAssessment(binding.draftId, binding.toRevision);
      taskResults.push({
        ...taskResult,
        completedStages: unique([...taskResult.completedStages, 'quality_assessment']),
        failedStage: undefined,
        nextCommand: undefined,
      });
    } catch {
      taskResults.push({
        ...taskResult,
        failedStage: 'quality_assessment',
        nextCommand: 'retry_task_assessment',
      });
    }
  }

  let groupAssessment = submission.groupAssessment;
  const hasRevisionCreationFailure = taskResults.some(
    (item) => item.failedStage === 'revision_creation',
  );
  if (hasRevisionCreationFailure) {
    groupAssessment = { ...groupAssessment, status: 'not_started' };
  } else if (groupAssessment.status !== 'completed') {
    try {
      await dependencies.completeGroupAssessment(
        submission.taskRevisionBindings,
        submission,
      );
      groupAssessment = { ...groupAssessment, status: 'completed' };
    } catch {
      groupAssessment = { ...groupAssessment, status: 'failed' };
    }
  }

  const hasTaskFailure = taskResults.some((item) => Boolean(item.failedStage));
  submission = await saveSubmission(dependencies, {
    ...submission,
    taskResults,
    groupAssessment,
    status: hasTaskFailure || groupAssessment.status !== 'completed'
      ? 'partially_failed'
      : 'completed',
  });
  return submission;
}

function saveSubmission(
  dependencies: CommitTaskGroupChangesDependencies,
  submission: TaskGroupSubmission,
): Promise<TaskGroupSubmission> {
  return dependencies.submissionRepository.save({
    ...submission,
    updatedAt: new Date().toISOString(),
  });
}

function toResult(submission: TaskGroupSubmission): CommitTaskGroupChangesResult {
  return {
    submissionId: submission.submissionId,
    committedPlanId: submission.committedPlanId,
    status: submission.status,
    taskResults: submission.taskResults,
    groupAssessmentStatus: submission.groupAssessment.status,
  };
}

function createSubmissionId(planId: string, now: string): string {
  const suffix = `${now}-${Math.random().toString(36).slice(2, 8)}`
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-20);
  return `task-group-submission-${planId}-${suffix}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
