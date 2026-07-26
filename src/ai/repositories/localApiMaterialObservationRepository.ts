import type { MaterialObservationRepository } from './materialObservationRepository.ts';
import { LocalApiFormalResourceClient } from './localApiFormalResourceClient.ts';
import type {
  FirstFrozenResourcePackManifest,
  MaterialObservationPlan,
  MaterialObservationPlanValidation,
  MaterialObservationReviewDecision,
  MaterialSourceAnchor,
  MaterialStructureSnapshot,
  ResourceObservationLink,
} from '../schemas/materialObservation.schema.ts';

export class LocalApiMaterialObservationRepository implements MaterialObservationRepository {
  private readonly client: LocalApiFormalResourceClient;

  constructor(client = new LocalApiFormalResourceClient()) {
    this.client = client;
  }

  saveStructure(value: MaterialStructureSnapshot) {
    return this.saveMutable('structures', 'materialStructureSnapshotId', value);
  }
  getStructure(id: string) { return this.get('structures', 'materialStructureSnapshotId', id); }
  listStructures(materialVersionId?: string) {
    return this.list('structures', (value) => !materialVersionId || value.materialVersionId === materialVersionId);
  }

  saveAnchor(value: MaterialSourceAnchor) {
    return this.saveMutable('anchors', 'sourceAnchorId', value);
  }
  getAnchor(id: string) { return this.get('anchors', 'sourceAnchorId', id); }
  listAnchors(materialVersionId?: string) {
    return this.list('anchors', (value) => !materialVersionId || value.materialVersionId === materialVersionId);
  }

  async savePlan(value: MaterialObservationPlan) {
    const existing = await this.getPlan(value.materialObservationPlanId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(value)) {
      if (existing.status === 'reviewed') {
        throw new Error('Reviewed MaterialObservationPlan is immutable. Create a new revision.');
      }
      if (
        value.revision < existing.revision
        || (value.revision === existing.revision && !samePlanContent(existing, value))
      ) {
        throw new Error(`Material Observation Plan revision conflict: ${value.materialObservationPlanId}`);
      }
    }
    return this.saveMutable('plans', 'materialObservationPlanId', value);
  }
  getPlan(id: string) { return this.get('plans', 'materialObservationPlanId', id); }
  listPlans(materialVersionId?: string) {
    return this.list('plans', (value) => !materialVersionId || value.materialVersionId === materialVersionId);
  }

  saveValidation(value: MaterialObservationPlanValidation) {
    return this.saveImmutable('validations', 'validationId', value);
  }
  getValidation(id: string) { return this.get('validations', 'validationId', id); }
  listValidations(planId?: string) {
    return this.list('validations', (value) => !planId || value.materialObservationPlanId === planId);
  }

  saveReview(value: MaterialObservationReviewDecision) {
    return this.saveImmutable('reviews', 'reviewId', value);
  }
  getReview(id: string) { return this.get('reviews', 'reviewId', id); }

  saveLink(value: ResourceObservationLink) {
    return this.saveMutable('links', 'resourceObservationLinkId', value);
  }
  getLink(id: string) { return this.get('links', 'resourceObservationLinkId', id); }
  listLinks(resourceId?: string) {
    return this.list('links', (value) => !resourceId || value.resourceId === resourceId);
  }

  saveManifest(value: FirstFrozenResourcePackManifest) {
    return this.saveImmutable('manifests', 'resourcePackId', value);
  }
  getManifest(id: string) { return this.get('manifests', 'resourcePackId', id); }
  listManifests() { return this.list('manifests', () => true); }

  async clear(): Promise<void> {
    throw new Error('Shared formal resource store cannot be cleared from the workbench.');
  }

  private async saveMutable<
    K extends keyof ObservationCollections,
    T extends ObservationCollections[K][number],
    P extends keyof T,
  >(collectionName: K, key: P, value: T): Promise<T> {
    return this.client.mutate((data) => {
      const collection = data.materialObservations[collectionName] as T[];
      const index = collection.findIndex((item) => item[key] === value[key]);
      if (index >= 0) collection[index] = clone(value);
      else collection.push(clone(value));
      return value;
    });
  }

  private async saveImmutable<
    K extends keyof ObservationCollections,
    T extends ObservationCollections[K][number],
    P extends keyof T,
  >(collectionName: K, key: P, value: T): Promise<T> {
    const existing = await this.get(collectionName, key, String(value[key]));
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(value)) {
        throw new Error(`Immutable record conflict: ${String(value[key])}`);
      }
      return clone(existing as T);
    }
    return this.saveMutable(collectionName, key, value);
  }

  private async get<
    K extends keyof ObservationCollections,
    T extends ObservationCollections[K][number],
    P extends keyof T,
  >(collectionName: K, key: P, id: string): Promise<T | null> {
    const collection = (await this.client.read()).snapshot.data
      .materialObservations[collectionName] as T[];
    const value = collection.find((item) => item[key] === id);
    return value ? clone(value) : null;
  }

  private async list<
    K extends keyof ObservationCollections,
    T extends ObservationCollections[K][number],
  >(collectionName: K, predicate: (value: T) => boolean): Promise<T[]> {
    return ((await this.client.read()).snapshot.data.materialObservations[collectionName] as T[])
      .filter(predicate)
      .map(clone);
  }
}

type ObservationCollections = {
  structures: MaterialStructureSnapshot[];
  anchors: MaterialSourceAnchor[];
  plans: MaterialObservationPlan[];
  validations: MaterialObservationPlanValidation[];
  reviews: MaterialObservationReviewDecision[];
  links: ResourceObservationLink[];
  manifests: FirstFrozenResourcePackManifest[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
