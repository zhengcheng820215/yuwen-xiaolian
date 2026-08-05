import type { WorkingTaskContentRepository } from './workingTaskContentRepository.ts';
import {
  cloneWorkingTaskContent,
  type WorkingTaskContent,
} from '../schemas/workingTaskContent.schema.ts';

export class InMemoryWorkingTaskContentRepository
implements WorkingTaskContentRepository {
  private readonly contents = new Map<string, WorkingTaskContent>();

  async save(content: WorkingTaskContent): Promise<WorkingTaskContent> {
    this.contents.set(content.trainingTaskId, cloneWorkingTaskContent(content));
    return cloneWorkingTaskContent(content);
  }

  async get(trainingTaskId: string): Promise<WorkingTaskContent | null> {
    const content = this.contents.get(trainingTaskId);
    return content ? cloneWorkingTaskContent(content) : null;
  }

  async list(): Promise<WorkingTaskContent[]> {
    return [...this.contents.values()]
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .map(cloneWorkingTaskContent);
  }

  async delete(trainingTaskId: string): Promise<void> {
    this.contents.delete(trainingTaskId);
  }

  async clear(): Promise<void> {
    this.contents.clear();
  }
}
