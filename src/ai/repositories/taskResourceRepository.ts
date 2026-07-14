import type {
  TaskResource,
  TaskResourceDraft,
  TaskResourceQuestionType,
} from '../schemas/taskResource.schema.ts';

export type TaskResourceMatchQuery = {
  targetAbilityId: string;
  excludedResourceIds?: string[];
  excludedExternalResourceIds?: string[];
  questionType?: TaskResourceQuestionType;
};

export type TaskResourceRepository = {
  saveDraft(draft: TaskResourceDraft): Promise<TaskResourceDraft>;
  saveResource(resource: TaskResource): Promise<TaskResource>;
  loadDraft(draftId: string): Promise<TaskResourceDraft | null>;
  loadResource(resourceId: string): Promise<TaskResource | null>;
  getResource(resourceId: string): Promise<TaskResource | null>;
  listResources(): Promise<TaskResource[]>;
  findMatchingResources(query: TaskResourceMatchQuery): Promise<TaskResource[]>;
  clear(): Promise<void>;
};
