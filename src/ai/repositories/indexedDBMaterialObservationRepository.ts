import type { MaterialObservationRepository } from './materialObservationRepository.ts';
import type {
  FirstFrozenResourcePackManifest,
  MaterialObservationPlan,
  MaterialObservationPlanValidation,
  MaterialObservationReviewDecision,
  MaterialSourceAnchor,
  MaterialStructureSnapshot,
  ResourceObservationLink,
} from '../schemas/materialObservation.schema.ts';
import type { SharedMaterialObservationState } from '../schemas/sharedFormalResourcePersistence.schema.ts';

const DB_NAME = 'yuwen_xiaolian_material_observation';
const DB_VERSION = 1;

export class IndexedDBMaterialObservationRepository implements MaterialObservationRepository {
  async exportSharedState(): Promise<SharedMaterialObservationState> {
    const [structures, anchors, plans, validations, reviews, links, manifests] = await Promise.all([
      all<MaterialStructureSnapshot>('structures'),
      all<MaterialSourceAnchor>('anchors'),
      all<MaterialObservationPlan>('plans'),
      all<MaterialObservationPlanValidation>('validations'),
      all<MaterialObservationReviewDecision>('reviews'),
      all<ResourceObservationLink>('links'),
      all<FirstFrozenResourcePackManifest>('manifests'),
    ]);
    return { structures, anchors, plans, validations, reviews, links, manifests };
  }

  saveStructure(value: MaterialStructureSnapshot) { return put('structures', value, 'materialStructureSnapshotId'); }
  getStructure(id: string) { return get<MaterialStructureSnapshot>('structures', id); }
  async listStructures(materialVersionId?: string) { return filter(await all<MaterialStructureSnapshot>('structures'), (v) => !materialVersionId || v.materialVersionId === materialVersionId); }
  saveAnchor(value: MaterialSourceAnchor) { return put('anchors', value, 'sourceAnchorId'); }
  getAnchor(id: string) { return get<MaterialSourceAnchor>('anchors', id); }
  async listAnchors(materialVersionId?: string) { return filter(await all<MaterialSourceAnchor>('anchors'), (v) => !materialVersionId || v.materialVersionId === materialVersionId); }
  async savePlan(value: MaterialObservationPlan) {
    const existing = await this.getPlan(value.materialObservationPlanId);
    const workingDraftUpdate = existing
      && ['draft', 'revision_required'].includes(existing.status)
      && ['draft', 'revision_required'].includes(value.status)
      && value.revision === existing.revision;
    const lifecycleTransition = existing && isAllowedLifecycleTransition(existing, value);
    if (
      existing
      && !workingDraftUpdate
      && !lifecycleTransition
      && ['pending_review', 'reviewed', 'rejected', 'superseded'].includes(existing.status)
      && JSON.stringify(existing) !== JSON.stringify(value)
    ) {
      throw new Error('Submitted MaterialObservationPlan is immutable. Create a working draft.');
    }
    return put('plans', value, 'materialObservationPlanId');
  }
  getPlan(id: string) { return get<MaterialObservationPlan>('plans', id); }
  async listPlans(materialVersionId?: string) { return filter(await all<MaterialObservationPlan>('plans'), (v) => !materialVersionId || v.materialVersionId === materialVersionId); }
  saveValidation(value: MaterialObservationPlanValidation) { return put('validations', value, 'validationId'); }
  getValidation(id: string) { return get<MaterialObservationPlanValidation>('validations', id); }
  async listValidations(planId?: string) { return filter(await all<MaterialObservationPlanValidation>('validations'), (v) => !planId || v.materialObservationPlanId === planId); }
  async saveReview(value: MaterialObservationReviewDecision) { return (await this.getReview(value.reviewId)) || put('reviews', value, 'reviewId'); }
  getReview(id: string) { return get<MaterialObservationReviewDecision>('reviews', id); }
  saveLink(value: ResourceObservationLink) { return put('links', value, 'resourceObservationLinkId'); }
  getLink(id: string) { return get<ResourceObservationLink>('links', id); }
  async listLinks(resourceId?: string) { return filter(await all<ResourceObservationLink>('links'), (v) => !resourceId || v.resourceId === resourceId); }
  async saveManifest(value: FirstFrozenResourcePackManifest) { return (await this.getManifest(value.resourcePackId)) || put('manifests', value, 'resourcePackId'); }
  getManifest(id: string) { return get<FirstFrozenResourcePackManifest>('manifests', id); }
  listManifests() { return all<FirstFrozenResourcePackManifest>('manifests'); }
  async clear() {
    const db = await openDb();
    const tx = db.transaction(STORES.map((item) => item[0]), 'readwrite');
    STORES.forEach(([name]) => tx.objectStore(name).clear());
    await transactionDone(tx);
    db.close();
  }
}

const STORES = [
  ['structures', 'materialStructureSnapshotId'], ['anchors', 'sourceAnchorId'],
  ['plans', 'materialObservationPlanId'], ['validations', 'validationId'],
  ['reviews', 'reviewId'], ['links', 'resourceObservationLinkId'], ['manifests', 'resourcePackId'],
] as const;

function isAllowedLifecycleTransition(
  existing: MaterialObservationPlan,
  incoming: MaterialObservationPlan,
): boolean {
  if (existing.revision !== incoming.revision || !samePlanContent(existing, incoming)) return false;
  return (
    (['draft', 'revision_required'].includes(existing.status) && incoming.status === 'pending_review')
    || (existing.status === 'pending_review' && ['reviewed', 'revision_required', 'rejected'].includes(incoming.status))
    || (existing.status === 'reviewed' && incoming.status === 'superseded')
  );
}

function samePlanContent(left: MaterialObservationPlan, right: MaterialObservationPlan): boolean {
  const omitLifecycle = (value: MaterialObservationPlan) => {
    const {
      status: _status,
      reviewerId: _reviewerId,
      reviewNote: _reviewNote,
      reviewedAt: _reviewedAt,
      updatedAt: _updatedAt,
      ...content
    } = value;
    return content;
  };
  return JSON.stringify(omitLifecycle(left)) === JSON.stringify(omitLifecycle(right));
}

async function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is unavailable.');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => STORES.forEach(([name, keyPath]) => {
      if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath });
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open Material Observation DB.'));
  });
}

async function put<T extends object>(storeName: string, value: T, _key: string): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(clone(value));
  await transactionDone(tx);
  db.close();
  return clone(value);
}

async function get<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  const value = await requestResult<T | undefined>(tx.objectStore(storeName).get(key));
  await transactionDone(tx);
  db.close();
  return value ? clone(value) : null;
}

async function all<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  const values = await requestResult<T[]>(tx.objectStore(storeName).getAll());
  await transactionDone(tx);
  db.close();
  return values.map(clone);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function filter<T>(values: T[], predicate: (value: T) => boolean): T[] { return values.filter(predicate).map(clone); }
