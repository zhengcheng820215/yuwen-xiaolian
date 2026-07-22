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

export class InMemoryMaterialObservationRepository implements MaterialObservationRepository {
  private readonly structures = new Map<string, MaterialStructureSnapshot>();
  private readonly anchors = new Map<string, MaterialSourceAnchor>();
  private readonly plans = new Map<string, MaterialObservationPlan>();
  private readonly validations = new Map<string, MaterialObservationPlanValidation>();
  private readonly reviews = new Map<string, MaterialObservationReviewDecision>();
  private readonly links = new Map<string, ResourceObservationLink>();
  private readonly manifests = new Map<string, FirstFrozenResourcePackManifest>();

  async saveStructure(value: MaterialStructureSnapshot) { return save(this.structures, value.materialStructureSnapshotId, value); }
  async getStructure(id: string) { return get(this.structures, id); }
  async listStructures(materialVersionId?: string) { return list(this.structures, (value) => !materialVersionId || value.materialVersionId === materialVersionId); }

  async saveAnchor(value: MaterialSourceAnchor) { return save(this.anchors, value.sourceAnchorId, value); }
  async getAnchor(id: string) { return get(this.anchors, id); }
  async listAnchors(materialVersionId?: string) { return list(this.anchors, (value) => !materialVersionId || value.materialVersionId === materialVersionId); }

  async savePlan(value: MaterialObservationPlan) {
    const existing = this.plans.get(value.materialObservationPlanId);
    if (existing?.status === 'reviewed' && JSON.stringify(existing) !== JSON.stringify(value)) {
      throw new Error('Reviewed MaterialObservationPlan is immutable. Create a new revision.');
    }
    return save(this.plans, value.materialObservationPlanId, value);
  }
  async getPlan(id: string) { return get(this.plans, id); }
  async listPlans(materialVersionId?: string) { return list(this.plans, (value) => !materialVersionId || value.materialVersionId === materialVersionId); }

  async saveValidation(value: MaterialObservationPlanValidation) { return save(this.validations, value.validationId, value); }
  async getValidation(id: string) { return get(this.validations, id); }
  async listValidations(planId?: string) { return list(this.validations, (value) => !planId || value.materialObservationPlanId === planId); }

  async saveReview(value: MaterialObservationReviewDecision) {
    const existing = await this.getReview(value.reviewId);
    return existing || save(this.reviews, value.reviewId, value);
  }
  async getReview(id: string) { return get(this.reviews, id); }

  async saveLink(value: ResourceObservationLink) { return save(this.links, value.resourceObservationLinkId, value); }
  async getLink(id: string) { return get(this.links, id); }
  async listLinks(resourceId?: string) { return list(this.links, (value) => !resourceId || value.resourceId === resourceId); }

  async saveManifest(value: FirstFrozenResourcePackManifest) {
    const existing = await this.getManifest(value.resourcePackId);
    return existing || save(this.manifests, value.resourcePackId, value);
  }
  async getManifest(id: string) { return get(this.manifests, id); }
  async listManifests() { return list(this.manifests, () => true); }

  async clear() {
    this.structures.clear();
    this.anchors.clear();
    this.plans.clear();
    this.validations.clear();
    this.reviews.clear();
    this.links.clear();
    this.manifests.clear();
  }
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function save<T>(store: Map<string, T>, key: string, value: T): T {
  store.set(key, clone(value));
  return clone(value);
}

function get<T>(store: Map<string, T>, key: string): T | null {
  const value = store.get(key);
  return value ? clone(value) : null;
}

function list<T>(store: Map<string, T>, predicate: (value: T) => boolean): T[] {
  return [...store.values()].filter(predicate).map(clone);
}
