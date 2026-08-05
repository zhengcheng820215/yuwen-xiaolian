import type { TaskGroupSubmission } from '../schemas/taskGroupSubmission.schema.ts';

export interface TaskGroupSubmissionRepository {
  save(submission: TaskGroupSubmission): Promise<TaskGroupSubmission>;
  get(submissionId: string): Promise<TaskGroupSubmission | null>;
  getByIdempotencyKey(idempotencyKey: string): Promise<TaskGroupSubmission | null>;
  list(planId?: string): Promise<TaskGroupSubmission[]>;
  delete(submissionId: string): Promise<void>;
  clear(): Promise<void>;
}
