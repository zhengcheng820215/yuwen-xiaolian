import {
  createRevisionFromRejectedQuestionResourceDraft,
  createNextQuestionResourceVersionDraft,
  createQuestionMaterial,
  createStructuredQuestionDraft,
  updateStructuredQuestionDraft,
  validateResourceRegistryConsistency,
  validateStructuredQuestionDraft,
  type CreateStructuredQuestionDraftInput,
  type StructuredQuestionDraftPatch,
} from '../ai/agents/questionResourceAdmissionAgent.ts';
import {
  freezeQuestionResourceDraftWithQuality,
  getOrAssessCurrentQuestionDraftQuality,
  reviewQuestionResourceDraftWithQuality,
  submitQuestionResourceForQualityReview,
} from '../ai/agents/questionQualityReviewGate.ts';
import { linkFrozenResourceToObservationTask } from '../ai/agents/materialObservationApplicationService.ts';
import { InMemoryQuestionQualityAssessmentRepository } from '../ai/repositories/inMemoryQuestionQualityAssessmentRepository.ts';
import {
  createBrowserMaterialObservationRepository,
  createBrowserQuestionResourceAdmissionRepository,
} from '../ai/repositories/formalResourceRepositoryRouter.ts';
import type {
  FrozenQuestionResourceVersion,
  QuestionMaterialVersion,
  ResourceRegistryEntry,
  ResourceReviewAction,
  ResourceReviewDecision,
  ResourceValidationResult,
  StructuredQuestionDraft,
} from '../ai/schemas/questionResourceAdmission.schema.ts';
import type {
  QuestionQualityAssessment,
} from '../ai/schemas/questionQualityAssessment.schema.ts';

const repository = createBrowserQuestionResourceAdmissionRepository();
const observationRepository = createBrowserMaterialObservationRepository();
const qualityRepository = new InMemoryQuestionQualityAssessmentRepository();

export type QuestionResourceWorkbenchSnapshot = {
  drafts: StructuredQuestionDraft[];
  materials: QuestionMaterialVersion[];
  registryEntries: ResourceRegistryEntry[];
  versions: FrozenQuestionResourceVersion[];
  registryConsistency: Awaited<ReturnType<typeof validateResourceRegistryConsistency>>;
};

export type QuestionResourceWorkbenchSnapshotOptions = {
  observationPlanId?: string;
};

export type QuestionResourceWorkbenchContext = {
  draft: StructuredQuestionDraft;
  material: QuestionMaterialVersion | null;
  validation: ResourceValidationResult | null;
  review: ResourceReviewDecision | null;
  qualityAssessment: QuestionQualityAssessment | null;
  frozenVersion: FrozenQuestionResourceVersion | null;
  registryEntry: ResourceRegistryEntry | null;
  versionHistory: FrozenQuestionResourceVersion[];
};

export async function getQuestionResourceWorkbenchSnapshot(
  options: QuestionResourceWorkbenchSnapshotOptions = {},
): Promise<QuestionResourceWorkbenchSnapshot> {
  const [drafts, materials, registryEntries, versions, registryConsistency] = await Promise.all([
    repository.listDrafts(),
    repository.listMaterials(),
    repository.listRegistryEntries(),
    repository.listVersions(),
    validateResourceRegistryConsistency(repository),
  ]);

  if (options.observationPlanId) {
    const plan = await observationRepository.getPlan(options.observationPlanId);
    const scopedDrafts = plan
      ? plan.taskPlans
        .map((task) => drafts
          .filter((draft) => (
            draft.tags.includes(`observation_plan:${plan.materialObservationPlanId}`) &&
            draft.tags.includes(`observation_task:${task.observationTaskPlanId}`)
          ))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null)
        .filter((draft): draft is StructuredQuestionDraft => Boolean(draft))
      : [];
    const resourceIds = new Set(scopedDrafts.map((draft) => draft.resourceId));
    const materialVersionIds = new Set(scopedDrafts
      .map((draft) => draft.materialVersionId)
      .filter((value): value is string => Boolean(value)));
    return {
      drafts: scopedDrafts,
      materials: materials.filter((material) => materialVersionIds.has(material.materialVersionId)),
      registryEntries: registryEntries
        .filter((entry) => resourceIds.has(entry.resourceId))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      versions: versions
        .filter((version) => resourceIds.has(version.resourceId))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      registryConsistency,
    };
  }

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

  const [material, validation, review, qualityAssessment, frozenVersion, registryEntry, versionHistory] = await Promise.all([
    draft.materialVersionId ? repository.getMaterial(draft.materialVersionId) : Promise.resolve(null),
    draft.latestValidationId ? repository.getValidation(draft.latestValidationId) : Promise.resolve(null),
    draft.latestReviewId ? repository.getReview(draft.latestReviewId) : Promise.resolve(null),
    getOrAssessCurrentQuestionDraftQuality(repository, qualityRepository, draft.draftId),
    repository.getVersionByDraftId(draft.draftId),
    repository.getRegistryEntry(draft.resourceId),
    repository.listVersions(draft.resourceId),
  ]);

  return {
    draft,
    material,
    validation,
    review,
    qualityAssessment,
    frozenVersion,
    registryEntry,
    versionHistory,
  };
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
  const validation = await validateStructuredQuestionDraft(repository, draftId);
  if (validation.passed) {
    await getOrAssessCurrentQuestionDraftQuality(
      repository,
      qualityRepository,
      draftId,
    );
  }
  return validation;
}

export async function submitQuestionResourceWorkbenchReview(draftId: string) {
  return submitQuestionResourceForQualityReview(
    repository,
    qualityRepository,
    draftId,
  );
}

export async function decideQuestionResourceWorkbenchReview(input: {
  draftId: string;
  action: ResourceReviewAction;
  reviewerId: string;
  notes: string;
}) {
  return reviewQuestionResourceDraftWithQuality(
    repository,
    qualityRepository,
    input,
  );
}

export async function freezeQuestionResourceWorkbenchDraft(draftId: string) {
  const result = await freezeQuestionResourceDraftWithQuality(
    repository,
    qualityRepository,
    draftId,
  );
  const draft = await repository.getDraft(draftId);
  const planId = readTagValue(draft?.tags, 'observation_plan:');
  const observationTaskPlanId = readTagValue(draft?.tags, 'observation_task:');
  if (!planId || !observationTaskPlanId) return result;
  try {
    const linked = await linkFrozenResourceToObservationTask(repository, observationRepository, {
      planId,
      observationTaskPlanId,
      resourceVersionId: result.version.resourceVersionId,
    });
    return { ...result, observationLink: linked.link, observationLinkIssues: linked.issues };
  } catch (error) {
    return {
      ...result,
      observationLinkIssues: [error instanceof Error ? error.message : String(error)],
    };
  }
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

function readTagValue(tags: string[] | undefined, prefix: string): string | null {
  return tags?.find((tag) => tag.startsWith(prefix))?.slice(prefix.length) || null;
}
