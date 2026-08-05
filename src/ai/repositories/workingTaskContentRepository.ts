import type {
  WorkingTaskContent,
} from '../schemas/workingTaskContent.schema.ts';

export interface WorkingTaskContentRepository {
  save(content: WorkingTaskContent): Promise<WorkingTaskContent>;
  get(trainingTaskId: string): Promise<WorkingTaskContent | null>;
  list(): Promise<WorkingTaskContent[]>;
  delete(trainingTaskId: string): Promise<void>;
  clear(): Promise<void>;
}
