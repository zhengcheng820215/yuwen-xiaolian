import type { TaskResource, TaskResourceDraft } from '../schemas/taskResource.schema.ts';
import type { TaskResourceRepository } from './taskResourceRepository.ts';

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

  async listResources(): Promise<TaskResource[]> {
    return [...this.resources.values()];
  }

  async clear(): Promise<void> {
    this.drafts.clear();
    this.resources.clear();
  }
}
