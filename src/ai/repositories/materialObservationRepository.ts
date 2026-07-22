import type {
  FirstFrozenResourcePackManifest,
  MaterialObservationPlan,
  MaterialObservationPlanValidation,
  MaterialObservationReviewDecision,
  MaterialSourceAnchor,
  MaterialStructureSnapshot,
  ResourceObservationLink,
} from '../schemas/materialObservation.schema.ts';

export type MaterialObservationRepository = {
  saveStructure(snapshot: MaterialStructureSnapshot): Promise<MaterialStructureSnapshot>;
  getStructure(snapshotId: string): Promise<MaterialStructureSnapshot | null>;
  listStructures(materialVersionId?: string): Promise<MaterialStructureSnapshot[]>;

  saveAnchor(anchor: MaterialSourceAnchor): Promise<MaterialSourceAnchor>;
  getAnchor(anchorId: string): Promise<MaterialSourceAnchor | null>;
  listAnchors(materialVersionId?: string): Promise<MaterialSourceAnchor[]>;

  savePlan(plan: MaterialObservationPlan): Promise<MaterialObservationPlan>;
  getPlan(planId: string): Promise<MaterialObservationPlan | null>;
  listPlans(materialVersionId?: string): Promise<MaterialObservationPlan[]>;

  saveValidation(validation: MaterialObservationPlanValidation): Promise<MaterialObservationPlanValidation>;
  getValidation(validationId: string): Promise<MaterialObservationPlanValidation | null>;
  listValidations(planId?: string): Promise<MaterialObservationPlanValidation[]>;

  saveReview(review: MaterialObservationReviewDecision): Promise<MaterialObservationReviewDecision>;
  getReview(reviewId: string): Promise<MaterialObservationReviewDecision | null>;

  saveLink(link: ResourceObservationLink): Promise<ResourceObservationLink>;
  getLink(linkId: string): Promise<ResourceObservationLink | null>;
  listLinks(resourceId?: string): Promise<ResourceObservationLink[]>;

  saveManifest(manifest: FirstFrozenResourcePackManifest): Promise<FirstFrozenResourcePackManifest>;
  getManifest(resourcePackId: string): Promise<FirstFrozenResourcePackManifest | null>;
  listManifests(): Promise<FirstFrozenResourcePackManifest[]>;

  clear(): Promise<void>;
};
