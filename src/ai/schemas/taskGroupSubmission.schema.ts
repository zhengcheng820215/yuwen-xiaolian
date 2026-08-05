export const TASK_GROUP_SUBMISSION_SCHEMA_VERSION = 'task-group-submission-v2' as const;

export type TaskGroupSubmissionStatus =
  | 'committing'
  | 'committed'
  | 'checking'
  | 'partially_failed'
  | 'completed';

export type TaskGroupAssessmentStatus =
  | 'not_started'
  | 'running'
  | 'completed'
  | 'failed';

export type TaskRevisionBinding = {
  trainingTaskId: string;
  fromDraftId: string;
  draftId: string;
  fromRevision: number;
  toRevision: number;
  contentHash: string;
};

export type TaskGroupSubmissionTaskResult = {
  trainingTaskId: string;
  revisionCreated: boolean;
  revision?: number;
  completedStages: string[];
  failedStage?: string;
  nextCommand?: string;
};

export type TaskGroupAssessment = {
  submissionId: string;
  taskRevisionBindings: Array<{
    trainingTaskId: string;
    draftId: string;
    revision: number;
  }>;
  ruleVersion: string;
  status: TaskGroupAssessmentStatus;
};

export type TaskGroupSubmission = {
  submissionId: string;
  planId: string;
  committedPlanId?: string;
  idempotencyKey: string;
  requestedTaskIds: string[];
  taskRevisionBindings: TaskRevisionBinding[];
  unchangedTaskIds: string[];
  taskResults: TaskGroupSubmissionTaskResult[];
  status: TaskGroupSubmissionStatus;
  groupAssessment: TaskGroupAssessment;
  createdAt: string;
  updatedAt: string;
  schemaVersion: typeof TASK_GROUP_SUBMISSION_SCHEMA_VERSION;
};

export type CommitTaskGroupChangesResult = {
  submissionId?: string;
  committedPlanId?: string;
  status: TaskGroupSubmissionStatus | 'no_changes';
  taskResults: TaskGroupSubmissionTaskResult[];
  groupAssessmentStatus: TaskGroupAssessmentStatus;
};

export function cloneTaskGroupSubmission<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
