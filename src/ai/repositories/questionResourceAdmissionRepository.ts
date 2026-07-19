import type {
  FrozenQuestionResourceVersion,
  QuestionMaterialVersion,
  ResourceFreezeCommit,
  ResourceFreezeResult,
  ResourceRegistryEntry,
  ResourceReviewDecision,
  ResourceValidationResult,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';

export type QuestionResourceAdmissionRepository = {
  saveMaterial(material: QuestionMaterialVersion): Promise<QuestionMaterialVersion>;
  getMaterial(materialVersionId: string): Promise<QuestionMaterialVersion | null>;
  listMaterials(): Promise<QuestionMaterialVersion[]>;

  saveDraft(draft: StructuredQuestionDraft): Promise<StructuredQuestionDraft>;
  getDraft(draftId: string): Promise<StructuredQuestionDraft | null>;
  listDrafts(): Promise<StructuredQuestionDraft[]>;

  saveValidation(result: ResourceValidationResult): Promise<ResourceValidationResult>;
  getValidation(validationId: string): Promise<ResourceValidationResult | null>;

  saveReview(decision: ResourceReviewDecision): Promise<ResourceReviewDecision>;
  getReview(reviewId: string): Promise<ResourceReviewDecision | null>;

  getVersion(resourceVersionId: string): Promise<FrozenQuestionResourceVersion | null>;
  getVersionByDraftId(draftId: string): Promise<FrozenQuestionResourceVersion | null>;
  listVersions(resourceId?: string): Promise<FrozenQuestionResourceVersion[]>;

  getRegistryEntry(resourceId: string): Promise<ResourceRegistryEntry | null>;
  listRegistryEntries(): Promise<ResourceRegistryEntry[]>;
  saveRegistryEntry(entry: ResourceRegistryEntry): Promise<ResourceRegistryEntry>;
  replaceRegistry(entries: ResourceRegistryEntry[]): Promise<void>;

  commitFreeze(commit: ResourceFreezeCommit): Promise<ResourceFreezeResult>;
  clear(): Promise<void>;
};
