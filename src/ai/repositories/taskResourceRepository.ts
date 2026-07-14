import type { TaskResource, TaskResourceDraft } from '../schemas/taskResource.schema.ts';

export type TaskResourceRepository = {
  saveDraft(draft: TaskResourceDraft): Promise<TaskResourceDraft>;
  saveResource(resource: TaskResource): Promise<TaskResource>;
  loadDraft(draftId: string): Promise<TaskResourceDraft | null>;
  loadResource(resourceId: string): Promise<TaskResource | null>;
  listResources(): Promise<TaskResource[]>;
  clear(): Promise<void>;
};
