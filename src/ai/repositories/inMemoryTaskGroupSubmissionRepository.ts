import type { TaskGroupSubmissionRepository } from './taskGroupSubmissionRepository.ts';
import {
  cloneTaskGroupSubmission,
  type TaskGroupSubmission,
} from '../schemas/taskGroupSubmission.schema.ts';

export class InMemoryTaskGroupSubmissionRepository
implements TaskGroupSubmissionRepository {
  private readonly submissions = new Map<string, TaskGroupSubmission>();

  async save(submission: TaskGroupSubmission): Promise<TaskGroupSubmission> {
    this.submissions.set(
      submission.submissionId,
      cloneTaskGroupSubmission(submission),
    );
    return cloneTaskGroupSubmission(submission);
  }

  async get(submissionId: string): Promise<TaskGroupSubmission | null> {
    const submission = this.submissions.get(submissionId);
    return submission ? cloneTaskGroupSubmission(submission) : null;
  }

  async getByIdempotencyKey(idempotencyKey: string): Promise<TaskGroupSubmission | null> {
    const submission = [...this.submissions.values()].find(
      (item) => item.idempotencyKey === idempotencyKey,
    );
    return submission ? cloneTaskGroupSubmission(submission) : null;
  }

  async list(planId?: string): Promise<TaskGroupSubmission[]> {
    return [...this.submissions.values()]
      .filter((item) => !planId || item.planId === planId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(cloneTaskGroupSubmission);
  }

  async delete(submissionId: string): Promise<void> {
    this.submissions.delete(submissionId);
  }

  async clear(): Promise<void> {
    this.submissions.clear();
  }
}
