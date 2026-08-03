import type { TaskResource, TaskResourceDraft } from '../schemas/taskResource.schema.ts';
import type {
  TaskResourceMatchQuery,
  TaskResourceRepository,
} from './taskResourceRepository.ts';

const DB_NAME = 'yuwen_xiaolian_task_resources';
const DB_VERSION = 1;
const DRAFT_STORE = 'task_resource_drafts';
const RESOURCE_STORE = 'task_resources';

export class IndexedDBTaskResourceRepository implements TaskResourceRepository {
  async saveDraft(draft: TaskResourceDraft): Promise<TaskResourceDraft> {
    const db = await openDatabase();
    await requestToPromise(db.transaction(DRAFT_STORE, 'readwrite').objectStore(DRAFT_STORE).put(draft));
    db.close();
    return draft;
  }

  async saveResource(resource: TaskResource): Promise<TaskResource> {
    const existing = await this.loadResource(resource.resourceId);
    if (existing) throw new Error(`TaskResource already exists: ${resource.resourceId}`);

    const db = await openDatabase();
    await requestToPromise(db.transaction(RESOURCE_STORE, 'readwrite').objectStore(RESOURCE_STORE).add(resource));
    db.close();
    return resource;
  }

  async loadDraft(draftId: string): Promise<TaskResourceDraft | null> {
    const db = await openDatabase();
    const result = await requestToPromise<TaskResourceDraft | undefined>(
      db.transaction(DRAFT_STORE, 'readonly').objectStore(DRAFT_STORE).get(draftId),
    );
    db.close();
    return result || null;
  }

  async loadResource(resourceId: string): Promise<TaskResource | null> {
    const db = await openDatabase();
    const result = await requestToPromise<TaskResource | undefined>(
      db.transaction(RESOURCE_STORE, 'readonly').objectStore(RESOURCE_STORE).get(resourceId),
    );
    db.close();
    return result || null;
  }

  async getResource(resourceId: string): Promise<TaskResource | null> {
    return this.loadResource(resourceId);
  }

  async listResources(): Promise<TaskResource[]> {
    const db = await openDatabase();
    const resources = await requestToPromise<TaskResource[]>(
      db.transaction(RESOURCE_STORE, 'readonly').objectStore(RESOURCE_STORE).getAll(),
    );
    db.close();
    return resources;
  }

  async findMatchingResources(query: TaskResourceMatchQuery): Promise<TaskResource[]> {
    const excluded = new Set(query.excludedResourceIds || []);
    const excludedExternal = new Set(query.excludedExternalResourceIds || []);
    return (await this.listResources()).filter((resource) => (
      resource.status === 'ready' &&
      resource.targetAbilityId === query.targetAbilityId &&
      !excluded.has(resource.resourceId) &&
      (!resource.externalResourceId || !excludedExternal.has(resource.externalResourceId)) &&
      (!query.questionType || resource.questionType === query.questionType)
    ));
  }

  async clear(): Promise<void> {
    const db = await openDatabase();
    const transaction = db.transaction([DRAFT_STORE, RESOURCE_STORE], 'readwrite');
    await Promise.all([
      requestToPromise(transaction.objectStore(DRAFT_STORE).clear()),
      requestToPromise(transaction.objectStore(RESOURCE_STORE).clear()),
    ]);
    db.close();
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this runtime.'));
  }

  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE, { keyPath: 'draftId' });
      }
      if (!db.objectStoreNames.contains(RESOURCE_STORE)) {
        const store = db.createObjectStore(RESOURCE_STORE, { keyPath: 'resourceId' });
        store.createIndex('targetAbilityId', 'targetAbilityId', { unique: false });
        store.createIndex('questionType', 'questionType', { unique: false });
      }
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Task resource database is blocked.'));
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
