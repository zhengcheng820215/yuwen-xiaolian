import type { TaskResource, TaskResourceDraft } from '../schemas/taskResource.schema.ts';
import type {
  TaskResourceMatchQuery,
  TaskResourceRepository,
} from './taskResourceRepository.ts';

export class InMemoryTaskResourceRepository implements TaskResourceRepository {
  private drafts = new Map<string, TaskResourceDraft>();
  private resources = new Map<string, TaskResource>();

  async saveDraft(draft: TaskResourceDraft): Promise<TaskResourceDraft> {
    this.drafts.set(draft.draftId, draft);
    return draft;
  }

  async saveResource(resource: TaskResource): Promise<TaskResource> {
    if (this.resources.has(resource.resourceId)) {
      throw new Error(`TaskResource already exists: ${resource.resourceId}`);
    }
    this.resources.set(resource.resourceId, resource);
    return resource;
  }

  async loadDraft(draftId: string): Promise<TaskResourceDraft | null> {
    return this.drafts.get(draftId) || null;
  }

  async loadResource(resourceId: string): Promise<TaskResource | null> {
    return this.resources.get(resourceId) || null;
  }

  async getResource(resourceId: string): Promise<TaskResource | null> {
    return this.loadResource(resourceId);
  }

  async listResources(): Promise<TaskResource[]> {
    return [...this.resources.values()];
  }

  async findMatchingResources(query: TaskResourceMatchQuery): Promise<TaskResource[]> {
    const excluded = new Set(query.excludedResourceIds || []);
    const excludedExternal = new Set(query.excludedExternalResourceIds || []);
    return [...this.resources.values()].filter((resource) => (
      resource.status === 'ready' &&
      resource.targetAbilityId === query.targetAbilityId &&
      !excluded.has(resource.resourceId) &&
      (!resource.externalResourceId || !excludedExternal.has(resource.externalResourceId)) &&
      (!query.questionType || resource.questionType === query.questionType)
    ));
  }

  async clear(): Promise<void> {
    this.drafts.clear();
    this.resources.clear();
  }
}
