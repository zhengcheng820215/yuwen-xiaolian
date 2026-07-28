import {
  createRevisionFromRejectedQuestionResourceDraft,
  createNextQuestionResourceVersionDraft,
  createQuestionMaterial,
  createStructuredQuestionDraft,
  findActiveQuestionResourceRevisionDraft,
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
  ResourceObservationLink,
} from '../ai/schemas/materialObservation.schema.ts';
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
  observationLinks: ResourceObservationLink[];
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
  publicationPreflight: QuestionPublicationPreflight;
  frozenVersion: FrozenQuestionResourceVersion | null;
  registryEntry: ResourceRegistryEntry | null;
  versionHistory: FrozenQuestionResourceVersion[];
};

export type QuestionPublicationPreflight = {
  scoped: boolean;
  passed: boolean;
  issue?: 'plan_missing' | 'task_missing';
  expectedSettings?: {
    abilityId: StructuredQuestionDraft['abilityMetadata']['abilityId'];
    difficulty: StructuredQuestionDraft['abilityMetadata']['difficulty'];
    taskRole: StructuredQuestionDraft['abilityMetadata']['taskRole'];
  };
  differences: Array<{
    field: 'abilityId' | 'difficulty' | 'taskRole';
    questionValue: string;
    planValue: string;
  }>;
};

export async function getQuestionResourceWorkbenchSnapshot(
  options: QuestionResourceWorkbenchSnapshotOptions = {},
): Promise<QuestionResourceWorkbenchSnapshot> {
  const [drafts, materials, registryEntries, versions, observationLinks, registryConsistency] = await Promise.all([
    repository.listDrafts(),
    repository.listMaterials(),
    repository.listRegistryEntries(),
    repository.listVersions(),
    observationRepository.listLinks(),
    validateResourceRegistryConsistency(repository),
  ]);
  const activeDrafts = drafts.filter((draft) => draft.status !== 'archived');

  if (options.observationPlanId) {
    const plan = await observationRepository.getPlan(options.observationPlanId);
    const scopedDrafts = plan
      ? plan.taskPlans
        .map((task) => activeDrafts
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
      observationLinks: observationLinks
        .filter((link) => link.materialObservationPlanId === options.observationPlanId)
        .sort((a, b) => b.linkedAt.localeCompare(a.linkedAt)),
      registryConsistency,
    };
  }

  return {
    drafts: activeDrafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    materials,
    registryEntries: registryEntries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    versions: versions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    observationLinks: observationLinks.sort((a, b) => b.linkedAt.localeCompare(a.linkedAt)),
    registryConsistency,
  };
}

export async function getQuestionResourceWorkbenchContext(
  draftId: string,
): Promise<QuestionResourceWorkbenchContext> {
  const draft = await repository.getDraft(draftId);
  if (!draft) throw new Error(`Draft not found: ${draftId}`);

  const [material, validation, review, qualityAssessment, publicationPreflight, frozenVersion, registryEntry, versionHistory] = await Promise.all([
    draft.materialVersionId ? repository.getMaterial(draft.materialVersionId) : Promise.resolve(null),
    draft.latestValidationId ? repository.getValidation(draft.latestValidationId) : Promise.resolve(null),
    draft.latestReviewId ? repository.getReview(draft.latestReviewId) : Promise.resolve(null),
    getOrAssessCurrentQuestionDraftQuality(repository, qualityRepository, draft.draftId),
    getQuestionResourceWorkbenchPublicationPreflight(draft),
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
    publicationPreflight,
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
  qualityRevisionProgress?: StructuredQuestionDraft['qualityRevisionProgress'];
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
        qualityRevisionProgress: input.qualityRevisionProgress,
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
  const publicationPreflight = await getQuestionResourceWorkbenchPublicationPreflight(draftId);
  if (!publicationPreflight.passed) {
    throw new Error(publicationPreflight.issue
      ? '发布前检查未通过：当前题目关联的训练计划信息不可用，请返回素材资源录入平台重新确认训练任务。'
      : '发布前检查未通过：题目设置与训练计划不一致，请先同步训练设置并重新完成检查与人工审核。');
  }
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

export async function createQuestionResourceWorkbenchPublicationRepair(sourceDraftId: string) {
  const sourceDraft = await repository.getDraft(sourceDraftId);
  if (!sourceDraft) throw new Error(`Draft not found: ${sourceDraftId}`);

  const sourceVersion = await repository.getVersionByDraftId(sourceDraftId);
  const drafts = await repository.listDrafts();
  const repairSourceTag = `publication_repair_source:${sourceDraftId}`;
  let expectedSettings: QuestionPublicationPreflight['expectedSettings'];
  let repairDraft: StructuredQuestionDraft | null = null;

  if (sourceVersion) {
    const links = await observationRepository.listLinks(sourceVersion.resourceId);
    expectedSettings = links.find((link) => (
      link.resourceVersionId === sourceVersion.resourceVersionId &&
      link.status === 'invalid'
    ));
    repairDraft = findActiveQuestionResourceRevisionDraft(drafts, {
      resourceId: sourceVersion.resourceId,
      parentVersionId: sourceVersion.resourceVersionId,
    });
  } else {
    const preflight = await getQuestionResourceWorkbenchPublicationPreflight(sourceDraft);
    expectedSettings = preflight.expectedSettings;
    if (preflight.passed || !expectedSettings) {
      throw new Error('当前题目没有需要修复的发布设置差异。');
    }
    repairDraft = drafts
      .filter((draft) => draft.tags.includes(repairSourceTag) && draft.status !== 'archived')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
  }

  if (!expectedSettings) throw new Error('当前题目没有可同步的训练计划设置。');

  if (!repairDraft) {
    repairDraft = sourceVersion
      ? await createNextQuestionResourceVersionDraft(repository, {
        resourceId: sourceVersion.resourceId,
        draftId: `draft-${createIdSuffix()}`,
      })
      : await createStructuredQuestionDraft(repository, {
        draftId: `draft-${createIdSuffix()}`,
        resourceId: sourceDraft.resourceId,
        taskId: sourceDraft.taskId,
        proposedVersionNumber: sourceDraft.proposedVersionNumber,
        parentVersionId: sourceDraft.parentVersionId,
        materialVersionId: sourceDraft.materialVersionId,
        title: sourceDraft.title,
        questionStem: sourceDraft.questionStem,
        questionType: sourceDraft.questionType,
        responseFormat: sourceDraft.responseFormat,
        options: sourceDraft.options,
        assessmentMode: sourceDraft.assessmentMode,
        answerAcceptance: sourceDraft.answerAcceptance,
        rubric: sourceDraft.rubric,
        minimumAnswerRequirement: sourceDraft.minimumAnswerRequirement,
        abilityMetadata: sourceDraft.abilityMetadata,
        source: sourceDraft.source,
        tags: [...sourceDraft.tags, repairSourceTag],
      });
  }

  const alreadyAligned = (
    repairDraft.abilityMetadata.abilityId === expectedSettings.abilityId &&
    repairDraft.abilityMetadata.difficulty === expectedSettings.difficulty &&
    repairDraft.abilityMetadata.taskRole === expectedSettings.taskRole
  );
  if (alreadyAligned) return repairDraft;

  const previousAbilityId = repairDraft.abilityMetadata.abilityId;
  return updateStructuredQuestionDraft(repository, repairDraft.draftId, {
    abilityMetadata: {
      ...repairDraft.abilityMetadata,
      abilityId: expectedSettings.abilityId,
      difficulty: expectedSettings.difficulty,
      taskRole: expectedSettings.taskRole,
    },
    rubric: repairDraft.rubric.map((item) => (
      item.abilityId === previousAbilityId
        ? { ...item, abilityId: expectedSettings.abilityId }
        : item
    )),
  });
}

export async function getQuestionResourceWorkbenchPublicationPreflight(
  draftOrId: StructuredQuestionDraft | string,
): Promise<QuestionPublicationPreflight> {
  const draft = typeof draftOrId === 'string'
    ? await repository.getDraft(draftOrId)
    : draftOrId;
  if (!draft) throw new Error(`Draft not found: ${draftOrId}`);

  const planId = readTagValue(draft.tags, 'observation_plan:');
  const observationTaskPlanId = readTagValue(draft.tags, 'observation_task:');
  if (!planId || !observationTaskPlanId) {
    return { scoped: false, passed: true, differences: [] };
  }

  const plan = await observationRepository.getPlan(planId);
  if (!plan) {
    return { scoped: true, passed: false, issue: 'plan_missing', differences: [] };
  }
  const task = plan.taskPlans.find((item) => item.observationTaskPlanId === observationTaskPlanId);
  if (!task) {
    return { scoped: true, passed: false, issue: 'task_missing', differences: [] };
  }

  const expectedSettings = {
    abilityId: task.abilityId,
    difficulty: task.difficulty,
    taskRole: task.taskRole,
  };
  const differences = ([
    ['abilityId', draft.abilityMetadata.abilityId, expectedSettings.abilityId],
    ['difficulty', draft.abilityMetadata.difficulty, expectedSettings.difficulty],
    ['taskRole', draft.abilityMetadata.taskRole, expectedSettings.taskRole],
  ] as const)
    .filter(([, questionValue, planValue]) => questionValue !== planValue)
    .map(([field, questionValue, planValue]) => ({ field, questionValue, planValue }));

  return {
    scoped: true,
    passed: differences.length === 0,
    expectedSettings,
    differences,
  };
}

export async function createQuestionResourceWorkbenchRejectedRevision(sourceDraftId: string) {
  return createRevisionFromRejectedQuestionResourceDraft(repository, {
    sourceDraftId,
    draftId: `draft-${createIdSuffix()}`,
  });
}

export async function discardQuestionResourceWorkbenchDraft(draftId: string): Promise<{
  action: 'deleted' | 'archived';
}> {
  const draft = await repository.getDraft(draftId);
  if (!draft) throw new Error(`Draft not found: ${draftId}`);

  const frozenVersion = await repository.getVersionByDraftId(draftId);
  const requiresAuditRetention = Boolean(
    frozenVersion ||
    draft.latestReviewId ||
    ['pending_review', 'revision_required', 'reviewed', 'rejected'].includes(draft.status),
  );

  if (requiresAuditRetention) {
    await repository.saveDraft({
      ...draft,
      status: 'archived',
      updatedAt: new Date().toISOString(),
    });
    return { action: 'archived' };
  }

  await repository.deleteDraft(draftId);
  return { action: 'deleted' };
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
