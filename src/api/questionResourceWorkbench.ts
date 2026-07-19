import {
  createRevisionFromRejectedQuestionResourceDraft,
  createNextQuestionResourceVersionDraft,
  createQuestionMaterial,
  createStructuredQuestionDraft,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  updateStructuredQuestionDraft,
  validateResourceRegistryConsistency,
  validateStructuredQuestionDraft,
  type CreateStructuredQuestionDraftInput,
  type StructuredQuestionDraftPatch,
} from '../ai/agents/questionResourceAdmissionAgent.ts';
import { IndexedDBQuestionResourceAdmissionRepository } from '../ai/repositories/indexedDBQuestionResourceAdmissionRepository.ts';
import type {
  FrozenQuestionResourceVersion,
  QuestionMaterialVersion,
  ResourceRegistryEntry,
  ResourceReviewAction,
  ResourceReviewDecision,
  ResourceValidationResult,
  StructuredQuestionDraft,
} from '../ai/schemas/questionResourceAdmission.schema.ts';

const repository = new IndexedDBQuestionResourceAdmissionRepository();

export type QuestionResourceWorkbenchSnapshot = {
  drafts: StructuredQuestionDraft[];
  materials: QuestionMaterialVersion[];
  registryEntries: ResourceRegistryEntry[];
  versions: FrozenQuestionResourceVersion[];
  registryConsistency: Awaited<ReturnType<typeof validateResourceRegistryConsistency>>;
};

export type QuestionResourceWorkbenchContext = {
  draft: StructuredQuestionDraft;
  material: QuestionMaterialVersion | null;
  validation: ResourceValidationResult | null;
  review: ResourceReviewDecision | null;
  frozenVersion: FrozenQuestionResourceVersion | null;
  registryEntry: ResourceRegistryEntry | null;
  versionHistory: FrozenQuestionResourceVersion[];
};

export async function getQuestionResourceWorkbenchSnapshot(): Promise<QuestionResourceWorkbenchSnapshot> {
  const [drafts, materials, registryEntries, versions, registryConsistency] = await Promise.all([
    repository.listDrafts(),
    repository.listMaterials(),
    repository.listRegistryEntries(),
    repository.listVersions(),
    validateResourceRegistryConsistency(repository),
  ]);

  return {
    drafts: drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    materials,
    registryEntries: registryEntries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    versions: versions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    registryConsistency,
  };
}

export async function getQuestionResourceWorkbenchContext(
  draftId: string,
): Promise<QuestionResourceWorkbenchContext> {
  const draft = await repository.getDraft(draftId);
  if (!draft) throw new Error(`Draft not found: ${draftId}`);

  const [material, validation, review, frozenVersion, registryEntry, versionHistory] = await Promise.all([
    draft.materialVersionId ? repository.getMaterial(draft.materialVersionId) : Promise.resolve(null),
    draft.latestValidationId ? repository.getValidation(draft.latestValidationId) : Promise.resolve(null),
    draft.latestReviewId ? repository.getReview(draft.latestReviewId) : Promise.resolve(null),
    repository.getVersionByDraftId(draft.draftId),
    repository.getRegistryEntry(draft.resourceId),
    repository.listVersions(draft.resourceId),
  ]);

  return { draft, material, validation, review, frozenVersion, registryEntry, versionHistory };
}

export async function createWorkbenchMaterial(input: {
  title: string;
  content: string;
  sourceType: QuestionMaterialVersion['source']['sourceType'];
  description: string;
  copyrightNote?: string;
  externalReference?: string;
}): Promise<QuestionMaterialVersion> {
  const suffix = createIdSuffix();
  return createQuestionMaterial(repository, {
    materialId: `material-${suffix}`,
    materialVersionId: `material-${suffix}:v1`,
    versionNumber: 1,
    title: input.title,
    content: input.content,
    source: {
      sourceType: input.sourceType,
      description: input.description,
      copyrightNote: input.copyrightNote,
      externalReference: input.externalReference,
    },
  });
}

export async function saveQuestionResourceWorkbenchDraft(input: {
  draftId?: string;
  resourceId?: string;
  taskId?: string;
  draft: Omit<CreateStructuredQuestionDraftInput, 'draftId' | 'resourceId' | 'taskId'>;
}): Promise<StructuredQuestionDraft> {
  if (input.draftId) {
    const existing = await repository.getDraft(input.draftId);
    if (existing) {
      const patch: StructuredQuestionDraftPatch = {
        materialVersionId: input.draft.materialVersionId,
        title: input.draft.title,
        questionStem: input.draft.questionStem,
        questionType: input.draft.questionType,
        responseFormat: input.draft.responseFormat,
        options: input.draft.options,
        assessmentMode: input.draft.assessmentMode,
        answerAcceptance: input.draft.answerAcceptance,
        rubric: input.draft.rubric,
        minimumAnswerRequirement: input.draft.minimumAnswerRequirement,
        abilityMetadata: input.draft.abilityMetadata,
        source: input.draft.source,
        tags: input.draft.tags,
      };
      return updateStructuredQuestionDraft(repository, input.draftId, patch);
    }
  }

  const suffix = createIdSuffix();
  return createStructuredQuestionDraft(repository, {
    ...input.draft,
    draftId: input.draftId || `draft-${suffix}`,
    resourceId: input.resourceId || `resource-${suffix}`,
    taskId: input.taskId || `task-${suffix}`,
  });
}

export async function validateQuestionResourceWorkbenchDraft(draftId: string) {
  return validateStructuredQuestionDraft(repository, draftId);
}

export async function submitQuestionResourceWorkbenchReview(draftId: string) {
  return submitQuestionResourceForReview(repository, draftId);
}

export async function decideQuestionResourceWorkbenchReview(input: {
  draftId: string;
  action: ResourceReviewAction;
  reviewerId: string;
  notes: string;
}) {
  return reviewQuestionResourceDraft(repository, input);
}

export async function freezeQuestionResourceWorkbenchDraft(draftId: string) {
  return freezeQuestionResourceDraft(repository, draftId);
}

export async function createQuestionResourceWorkbenchNextVersion(resourceId: string) {
  return createNextQuestionResourceVersionDraft(repository, {
    resourceId,
    draftId: `draft-${createIdSuffix()}`,
  });
}

export async function createQuestionResourceWorkbenchRejectedRevision(sourceDraftId: string) {
  return createRevisionFromRejectedQuestionResourceDraft(repository, {
    sourceDraftId,
    draftId: `draft-${createIdSuffix()}`,
  });
}

export async function clearQuestionResourceWorkbench(): Promise<void> {
  await repository.clear();
}

function createIdSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 12);
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
