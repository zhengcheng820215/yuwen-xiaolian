import type { QuestionResourceAdmissionRepository } from './questionResourceAdmissionRepository.ts';
import {
  cloneQuestionResourceValue,
  type FrozenQuestionResourceVersion,
  type QuestionMaterialVersion,
  type ResourceFreezeCommit,
  type ResourceFreezeResult,
  type ResourceRegistryEntry,
  type ResourceReviewDecision,
  type ResourceValidationResult,
  type StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';

const DB_NAME = 'yuwen_xiaolian_question_resource_admission';
const DB_VERSION = 1;
const MATERIAL_STORE = 'materials';
const DRAFT_STORE = 'drafts';
const VALIDATION_STORE = 'validations';
const REVIEW_STORE = 'reviews';
const VERSION_STORE = 'versions';
const REGISTRY_STORE = 'registry';

export class IndexedDBQuestionResourceAdmissionRepository
implements QuestionResourceAdmissionRepository {
  async saveMaterial(material: QuestionMaterialVersion): Promise<QuestionMaterialVersion> {
    const existing = await this.getMaterial(material.materialVersionId);
    if (existing) {
      if (!sameMaterialVersion(existing, material)) {
        throw new Error('Material Version is immutable. Create a new version.');
      }
      return existing;
    }
    await putRecord(MATERIAL_STORE, material);
    return clone(material);
  }

  async getMaterial(materialVersionId: string): Promise<QuestionMaterialVersion | null> {
    return getRecord<QuestionMaterialVersion>(MATERIAL_STORE, materialVersionId);
  }

  async listMaterials(): Promise<QuestionMaterialVersion[]> {
    const materials = await getAllRecords<QuestionMaterialVersion>(MATERIAL_STORE);
    return materials.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveDraft(draft: StructuredQuestionDraft): Promise<StructuredQuestionDraft> {
    await putRecord(DRAFT_STORE, draft);
    return clone(draft);
  }

  async getDraft(draftId: string): Promise<StructuredQuestionDraft | null> {
    return getRecord<StructuredQuestionDraft>(DRAFT_STORE, draftId);
  }

  async listDrafts(): Promise<StructuredQuestionDraft[]> {
    return getAllRecords<StructuredQuestionDraft>(DRAFT_STORE);
  }

  async saveValidation(result: ResourceValidationResult): Promise<ResourceValidationResult> {
    await putRecord(VALIDATION_STORE, result);
    return clone(result);
  }

  async getValidation(validationId: string): Promise<ResourceValidationResult | null> {
    return getRecord<ResourceValidationResult>(VALIDATION_STORE, validationId);
  }

  async saveReview(decision: ResourceReviewDecision): Promise<ResourceReviewDecision> {
    const existing = await this.getReview(decision.reviewId);
    if (existing) return existing;
    await addRecord(REVIEW_STORE, decision);
    return clone(decision);
  }

  async getReview(reviewId: string): Promise<ResourceReviewDecision | null> {
    return getRecord<ResourceReviewDecision>(REVIEW_STORE, reviewId);
  }

  async getVersion(resourceVersionId: string): Promise<FrozenQuestionResourceVersion | null> {
    return getRecord<FrozenQuestionResourceVersion>(VERSION_STORE, resourceVersionId);
  }

  async getVersionByDraftId(draftId: string): Promise<FrozenQuestionResourceVersion | null> {
    const db = await openDatabase();
    const transaction = db.transaction(VERSION_STORE, 'readonly');
    const result = await requestToPromise<FrozenQuestionResourceVersion | undefined>(
      transaction.objectStore(VERSION_STORE).index('sourceDraftId').get(draftId),
    );
    await transactionToPromise(transaction);
    db.close();
    return result ? clone(result) : null;
  }

  async listVersions(resourceId?: string): Promise<FrozenQuestionResourceVersion[]> {
    const versions = await getAllRecords<FrozenQuestionResourceVersion>(VERSION_STORE);
    return versions
      .filter((version) => !resourceId || version.resourceId === resourceId)
      .sort((a, b) => a.versionNumber - b.versionNumber);
  }

  async getRegistryEntry(resourceId: string): Promise<ResourceRegistryEntry | null> {
    return getRecord<ResourceRegistryEntry>(REGISTRY_STORE, resourceId);
  }

  async listRegistryEntries(): Promise<ResourceRegistryEntry[]> {
    return getAllRecords<ResourceRegistryEntry>(REGISTRY_STORE);
  }

  async saveRegistryEntry(entry: ResourceRegistryEntry): Promise<ResourceRegistryEntry> {
    await putRecord(REGISTRY_STORE, entry);
    return clone(entry);
  }

  async replaceRegistry(entries: ResourceRegistryEntry[]): Promise<void> {
    const db = await openDatabase();
    const transaction = db.transaction(REGISTRY_STORE, 'readwrite');
    const store = transaction.objectStore(REGISTRY_STORE);
    store.clear();
    entries.forEach((entry) => store.put(clone(entry)));
    await transactionToPromise(transaction);
    db.close();
  }

  async commitFreeze(commit: ResourceFreezeCommit): Promise<ResourceFreezeResult> {
    const db = await openDatabase();
    const transaction = db.transaction([VERSION_STORE, REGISTRY_STORE], 'readwrite');
    const versionStore = transaction.objectStore(VERSION_STORE);
    const registryStore = transaction.objectStore(REGISTRY_STORE);

    try {
      const existing = await requestToPromise<FrozenQuestionResourceVersion | undefined>(
        versionStore.index('sourceDraftId').get(commit.version.sourceDraftId),
      );
      if (existing) {
        const registry = await requestToPromise<ResourceRegistryEntry | undefined>(
          registryStore.get(existing.resourceId),
        );
        if (!registry) throw new Error('Frozen version exists without a registry entry.');
        await transactionToPromise(transaction);
        db.close();
        return { version: clone(existing), registryEntry: clone(registry), inserted: false };
      }

      const duplicateVersion = await requestToPromise<FrozenQuestionResourceVersion | undefined>(
        versionStore.get(commit.version.resourceVersionId),
      );
      if (duplicateVersion) {
        throw new Error(`Resource version already exists: ${commit.version.resourceVersionId}`);
      }

      let previous: FrozenQuestionResourceVersion | undefined;
      if (commit.previousVersionId) {
        previous = await requestToPromise<FrozenQuestionResourceVersion | undefined>(
          versionStore.get(commit.previousVersionId),
        );
        if (!previous) throw new Error(`Previous frozen version not found: ${commit.previousVersionId}`);
      }

      versionStore.add(clone(commit.version));
      registryStore.put(clone(commit.registryEntry));
      if (previous) {
        versionStore.put({
          ...clone(previous),
          status: 'superseded',
          updatedAt: commit.version.frozenAt,
        });
      }

      await transactionToPromise(transaction);
      db.close();
      return {
        version: clone(commit.version),
        registryEntry: clone(commit.registryEntry),
        inserted: true,
      };
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have aborted because of an IndexedDB request failure.
      }
      db.close();
      throw error;
    }
  }

  async clear(): Promise<void> {
    const db = await openDatabase();
    const stores = [
      MATERIAL_STORE,
      DRAFT_STORE,
      VALIDATION_STORE,
      REVIEW_STORE,
      VERSION_STORE,
      REGISTRY_STORE,
    ];
    const transaction = db.transaction(stores, 'readwrite');
    stores.forEach((storeName) => transaction.objectStore(storeName).clear());
    await transactionToPromise(transaction);
    db.close();
  }
}

function sameMaterialVersion(
  left: QuestionMaterialVersion,
  right: QuestionMaterialVersion,
): boolean {
  return left.materialId === right.materialId &&
    left.materialVersionId === right.materialVersionId &&
    left.versionNumber === right.versionNumber &&
    left.title === right.title &&
    left.content === right.content &&
    left.source.sourceType === right.source.sourceType &&
    left.source.description === right.source.description &&
    left.source.copyrightNote === right.source.copyrightNote &&
    left.source.externalReference === right.source.externalReference &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.schemaVersion === right.schemaVersion;
}

async function putRecord<T>(storeName: string, value: T): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(clone(value));
  await transactionToPromise(transaction);
  db.close();
}

async function addRecord<T>(storeName: string, value: T): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).add(clone(value));
  await transactionToPromise(transaction);
  db.close();
}

async function getRecord<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, 'readonly');
  const result = await requestToPromise<T | undefined>(transaction.objectStore(storeName).get(key));
  await transactionToPromise(transaction);
  db.close();
  return result ? clone(result) : null;
}

async function getAllRecords<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, 'readonly');
  const result = await requestToPromise<T[]>(transaction.objectStore(storeName).getAll());
  await transactionToPromise(transaction);
  db.close();
  return result.map(clone);
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this runtime.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      createStore(db, MATERIAL_STORE, 'materialVersionId');
      createStore(db, DRAFT_STORE, 'draftId');
      createStore(db, VALIDATION_STORE, 'validationId');
      createStore(db, REVIEW_STORE, 'reviewId');
      if (!db.objectStoreNames.contains(VERSION_STORE)) {
        const store = db.createObjectStore(VERSION_STORE, { keyPath: 'resourceVersionId' });
        store.createIndex('sourceDraftId', 'sourceDraftId', { unique: true });
        store.createIndex('resourceId', 'resourceId', { unique: false });
      }
      createStore(db, REGISTRY_STORE, 'resourceId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createStore(db: IDBDatabase, name: string, keyPath: string): void {
  if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'));
  });
}

function clone<T>(value: T): T {
  return cloneQuestionResourceValue(value);
}
