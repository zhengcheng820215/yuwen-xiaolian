import {
  createRevisionFromRejectedQuestionResourceDraft,
  createNextQuestionResourceVersionDraft,
  createQuestionMaterial,
  createStructuredQuestionDraft,
  findActiveQuestionResourceRevisionDraft,
  submitQuestionResourceForReview,
  updateStructuredQuestionDraft,
  validateResourceRegistryConsistency,
  validateStructuredQuestionDraft,
  type CreateStructuredQuestionDraftInput,
  type StructuredQuestionDraftPatch,
} from '../ai/agents/questionResourceAdmissionAgent.ts';
import {
  alignQuestionDraftInputWithPlan,
  assessAuthoringFieldResponsibilities,
  findObservationTaskPlan,
  getAuthoringFieldAdaptation,
  getPlanControlledQuestionSettings,
  readObservationTaskReference,
  type AuthoringFieldProvenance,
  type AuthoringFieldResponsibilityIssue,
  type AuthoringFieldValues,
} from '../ai/contracts/authoringFieldContract.ts';
import {
  getCurrentAssessmentState,
  getOrAssessCurrentQuestionDraftQuality,
} from '../ai/agents/questionQualityReviewGate.ts';
import {
  summarizeQuestionReviewBatchObservability,
  type QuestionReviewBatchObservability,
} from '../ai/agents/questionReviewBatchObservability.ts';
import {
  freezeQuestionResourceDraftWithPersistedQuality,
  prepareQuestionResourceFreezeWithPersistedQuality,
  persistQuestionQualityBundle,
  requireCurrentPersistedQualityContext,
  reviewQuestionResourceDraftWithPersistedQuality,
} from '../ai/agents/questionQualityPersistenceService.ts';
import {
  mergeQuestionQualityAssessments,
} from '../ai/agents/questionSemanticQualityAssessmentAgent.ts';
import {
  getQuestionSemanticQualityBoundaryStatus,
  requestQuestionSemanticQualityAssessment,
} from './questionSemanticQualityAssessment.ts';
import {
  prepareFrozenResourceObservationLink,
} from '../ai/agents/materialObservationApplicationService.ts';
import {
  recoverQuestionPublicationFromFrozenVersion,
} from '../ai/agents/questionPublicationRecoveryService.ts';
import { LocalApiQuestionQualityPersistenceRepository } from '../ai/repositories/localApiQuestionQualityPersistenceRepository.ts';
import { createStructuredRuntimeError } from '../ai/errors/structuredRuntimeError.ts';
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
import {
  QUESTION_QUALITY_RULE_VERSION,
  type QuestionQualityAssessment,
} from '../ai/schemas/questionQualityAssessment.schema.ts';
import {
  QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
  QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
  QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
  QUESTION_QUALITY_MERGE_RULE_VERSION,
  type QuestionQualityAssessmentBundle,
  type QuestionSemanticQualityAssessment,
} from '../ai/schemas/questionSemanticQualityAssessment.schema.ts';

const repository = createBrowserQuestionResourceAdmissionRepository();
const observationRepository = createBrowserMaterialObservationRepository();
const qualityRepository = new LocalApiQuestionQualityPersistenceRepository();

export type QuestionResourceWorkbenchSnapshot = {
  drafts: StructuredQuestionDraft[];
  materials: QuestionMaterialVersion[];
  registryEntries: ResourceRegistryEntry[];
  versions: FrozenQuestionResourceVersion[];
  observationLinks: ResourceObservationLink[];
  registryConsistency: Awaited<ReturnType<typeof validateResourceRegistryConsistency>>;
  batchObservability: QuestionReviewBatchObservability;
};

export type QuestionResourceWorkbenchSnapshotOptions = {
  observationPlanId?: string;
};

export type QuestionResourceWorkbenchContext = {
  draft: StructuredQuestionDraft;
  authoringFields: AuthoringFieldValues;
  authoringFieldProvenance: Record<keyof AuthoringFieldValues, AuthoringFieldProvenance>;
  authoringResponsibilityIssues: AuthoringFieldResponsibilityIssue[];
  material: QuestionMaterialVersion | null;
  validation: ResourceValidationResult | null;
  review: ResourceReviewDecision | null;
  qualityAssessment: QuestionQualityAssessment | null;
  semanticQualityAssessment: QuestionSemanticQualityAssessment | null;
  qualityAssessmentBundle: QuestionQualityAssessmentBundle | null;
  assessmentState: ReturnType<typeof getCurrentAssessmentState>;
  publicationPreflight: QuestionPublicationPreflight;
  frozenVersion: FrozenQuestionResourceVersion | null;
  registryEntry: ResourceRegistryEntry | null;
  versionHistory: FrozenQuestionResourceVersion[];
};

export type QuestionPublicationPreflight = {
  scoped: boolean;
  passed: boolean;
  issue?:
    | 'plan_missing'
    | 'plan_not_reviewed'
    | 'task_missing'
    | 'material_missing'
    | 'material_not_found'
    | 'material_mismatch';
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
    const scopedVersions = versions
      .filter((version) => resourceIds.has(version.resourceId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      drafts: scopedDrafts,
      materials: materials.filter((material) => materialVersionIds.has(material.materialVersionId)),
      registryEntries: registryEntries
        .filter((entry) => resourceIds.has(entry.resourceId))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      versions: scopedVersions,
      observationLinks: observationLinks
        .filter((link) => link.materialObservationPlanId === options.observationPlanId)
        .sort((a, b) => b.linkedAt.localeCompare(a.linkedAt)),
      registryConsistency,
      batchObservability: await buildQuestionReviewBatchObservability(
        scopedDrafts,
        scopedVersions,
      ),
    };
  }

  const sortedDrafts = activeDrafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sortedVersions = versions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    drafts: sortedDrafts,
    materials,
    registryEntries: registryEntries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    versions: sortedVersions,
    observationLinks: observationLinks.sort((a, b) => b.linkedAt.localeCompare(a.linkedAt)),
    registryConsistency,
    batchObservability: await buildQuestionReviewBatchObservability(
      sortedDrafts,
      sortedVersions,
    ),
  };
}

async function buildQuestionReviewBatchObservability(
  drafts: StructuredQuestionDraft[],
  versions: FrozenQuestionResourceVersion[],
): Promise<QuestionReviewBatchObservability> {
  const records = await Promise.all(drafts.map(async (draft) => {
    const [validation, review] = await Promise.all([
      draft.latestValidationId
        ? repository.getValidation(draft.latestValidationId)
        : Promise.resolve(null),
      draft.latestReviewId
        ? repository.getReview(draft.latestReviewId)
        : Promise.resolve(null),
    ]);
    return {
      draft,
      validation,
      review,
      frozenVersion: versions.find((version) => version.sourceDraftId === draft.draftId) || null,
    };
  }));

  return summarizeQuestionReviewBatchObservability(records);
}

export async function getQuestionResourceWorkbenchContext(
  draftId: string,
): Promise<QuestionResourceWorkbenchContext> {
  const draft = await repository.getDraft(draftId);
  if (!draft) throw new Error(`Draft not found: ${draftId}`);
  const observationTask = await getObservationTaskForDraft(draft);
  const authoringFieldAdaptation = getAuthoringFieldAdaptation(draft, observationTask);

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
  const persistedQuality = await readPersistedQualityContext(draft.draftId);

  return {
    draft,
    authoringFields: authoringFieldAdaptation.values,
    authoringFieldProvenance: authoringFieldAdaptation.provenance,
    authoringResponsibilityIssues: assessAuthoringFieldResponsibilities(
      authoringFieldAdaptation.values,
    ),
    material,
    validation,
    review,
    qualityAssessment,
    semanticQualityAssessment: persistedQuality?.semantic || null,
    qualityAssessmentBundle: persistedQuality?.bundle || null,
    assessmentState: getCurrentAssessmentState(draft, qualityAssessment),
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
  expectedDraftRevision?: number;
  resourceId?: string;
  taskId?: string;
  draft: Omit<CreateStructuredQuestionDraftInput, 'draftId' | 'resourceId' | 'taskId'>;
  qualityRevisionProgress?: StructuredQuestionDraft['qualityRevisionProgress'];
}): Promise<StructuredQuestionDraft> {
  const normalizedDraft = await alignDraftInputWithObservationPlan(input.draft);
  if (input.draftId) {
    const existing = await repository.getDraft(input.draftId);
    if (existing) {
      const patch: StructuredQuestionDraftPatch = {
        materialVersionId: normalizedDraft.materialVersionId,
        title: normalizedDraft.title,
        questionStem: normalizedDraft.questionStem,
        questionType: normalizedDraft.questionType,
        responseFormat: normalizedDraft.responseFormat,
        options: normalizedDraft.options,
        assessmentMode: normalizedDraft.assessmentMode,
        answerAcceptance: normalizedDraft.answerAcceptance,
        rubric: normalizedDraft.rubric,
        minimumAnswerRequirement: normalizedDraft.minimumAnswerRequirement,
        abilityMetadata: normalizedDraft.abilityMetadata,
        source: normalizedDraft.source,
        tags: normalizedDraft.tags,
        qualityRevisionProgress: input.qualityRevisionProgress,
      };
      return updateStructuredQuestionDraft(
        repository,
        input.draftId,
        patch,
        new Date().toISOString(),
        { expectedRevision: input.expectedDraftRevision },
      );
    }
  }

  const suffix = createIdSuffix();
  return createStructuredQuestionDraft(repository, {
    ...normalizedDraft,
    draftId: input.draftId || `draft-${suffix}`,
    resourceId: input.resourceId || `resource-${suffix}`,
    taskId: input.taskId || `task-${suffix}`,
  });
}

export async function validateQuestionResourceWorkbenchDraft(
  draftId: string,
  expectedDraftRevision?: number,
) {
  const validation = await validateStructuredQuestionDraft(
    repository,
    draftId,
    new Date().toISOString(),
    expectedDraftRevision,
  );
  if (validation.passed) {
    await ensureCurrentPersistedQualityBundle(draftId);
  }
  return validation;
}

export async function submitQuestionResourceWorkbenchReview(
  draftId: string,
  expectedDraftRevision?: number,
) {
  await requireExpectedDraftRevision(draftId, expectedDraftRevision, 'submit_review');
  await requireQuestionPublicationPreflight(draftId, 'question_review.submit');
  await requireCurrentPersistedQualityContext(repository, qualityRepository, draftId);
  return submitQuestionResourceForReview(repository, draftId);
}

export async function decideQuestionResourceWorkbenchReview(input: {
  draftId: string;
  expectedDraftRevision?: number;
  action: ResourceReviewAction;
  reviewerId: string;
  notes: string;
  acceptedWarningCodes?: string[];
}) {
  await requireExpectedDraftRevision(
    input.draftId,
    input.expectedDraftRevision,
    'record_review_decision',
  );
  return reviewQuestionResourceDraftWithPersistedQuality(
    repository,
    qualityRepository,
    {
      draftId: input.draftId,
      action: input.action,
      reviewerId: input.reviewerId,
      notes: input.notes,
      acceptedWarningCodes: input.acceptedWarningCodes,
    },
  );
}

export async function freezeQuestionResourceWorkbenchDraft(
  draftId: string,
  expectedDraftRevision?: number,
) {
  await requireExpectedDraftRevision(draftId, expectedDraftRevision, 'freeze');
  await requireQuestionPublicationPreflight(draftId, 'question_publication.freeze');
  const draft = await repository.getDraft(draftId);
  const planId = readTagValue(draft?.tags, 'observation_plan:');
  const observationTaskPlanId = readTagValue(draft?.tags, 'observation_task:');
  if (!planId || !observationTaskPlanId) {
    const result = await freezeQuestionResourceDraftWithPersistedQuality(
      repository,
      qualityRepository,
      draftId,
    );
    return {
      ...result,
      publicationStatus: 'completed' as const,
      observationLinkIssues: [],
    };
  }

  const existingVersion = await repository.getVersionByDraftId(draftId);
  if (existingVersion) {
    return retryQuestionResourceWorkbenchPublication(draftId, expectedDraftRevision);
  }

  const commit = await prepareQuestionResourceFreezeWithPersistedQuality(
    repository,
    qualityRepository,
    draftId,
  );
  const linked = await prepareFrozenResourceObservationLink(
    repository,
    observationRepository,
    {
      planId,
      observationTaskPlanId,
      version: commit.resourceCommit.version,
      registryEntry: commit.resourceCommit.registryEntry,
    },
  );
  if (linked.issues.length > 0) {
    throw createStructuredRuntimeError({
      code: 'PUBLICATION_RECOVERY_REQUIRED',
      message: `发布前一致性检查未通过：${linked.issues.join('、')}。尚未创建正式题目版本。`,
      operation: 'question_publication.freeze',
      objectId: draftId,
      recoverability: 'user_action_required',
    });
  }
  const result = await qualityRepository.commitPublicationWithObservationLink({
    ...commit,
    observationLink: linked.link,
  });
  return {
    ...result,
    publicationStatus: 'completed' as const,
    observationLink: result.observationLink,
    observationLinkIssues: [],
  };
}

export async function retryQuestionResourceWorkbenchPublication(
  draftId: string,
  expectedDraftRevision?: number,
) {
  await requireExpectedDraftRevision(draftId, expectedDraftRevision, 'retry_publication');
  await requireQuestionPublicationPreflight(draftId, 'question_publication.retry');
  const draft = await repository.getDraft(draftId);
  if (!draft) throw new Error(`Draft not found: ${draftId}`);
  const planId = readTagValue(draft.tags, 'observation_plan:');
  const observationTaskPlanId = readTagValue(draft.tags, 'observation_task:');
  if (!planId || !observationTaskPlanId) {
    throw createStructuredRuntimeError({
      code: 'PUBLICATION_RECOVERY_REQUIRED',
      message: '当前题目没有可恢复的训练计划关联，请重新执行正式发布。',
      operation: 'question_publication.retry',
      objectId: draftId,
      recoverability: 'user_action_required',
    });
  }
  return recoverQuestionPublicationFromFrozenVersion(
    repository,
    observationRepository,
    { draftId, planId, observationTaskPlanId },
  );
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
  const repairRootDraftId = readTagValue(sourceDraft.tags, 'publication_repair_source:') || sourceDraftId;
  const repairSourceTag = `publication_repair_source:${repairRootDraftId}`;
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
    const observationTaskTag = sourceDraft.tags.find((tag) => tag.startsWith('observation_task:'));
    repairDraft = drafts
      .filter((draft) => (
        ['drafted', 'validation_failed', 'revision_required'].includes(draft.status) &&
        draft.tags.includes(repairSourceTag) &&
        (!observationTaskTag || draft.tags.includes(observationTaskTag))
      ))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
    if (
      !repairDraft &&
      ['drafted', 'validation_failed', 'revision_required'].includes(sourceDraft.status) &&
      sourceDraft.tags.includes(repairSourceTag)
    ) {
      repairDraft = sourceDraft;
    }
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
        tags: [
          ...sourceDraft.tags.filter((tag) => !tag.startsWith('publication_repair_source:')),
          repairSourceTag,
        ],
      });
  }

  const normalizedRepairTags = [
    ...repairDraft.tags.filter((tag) => !tag.startsWith('publication_repair_source:')),
    repairSourceTag,
  ];
  const alreadyAligned = (
    repairDraft.abilityMetadata.abilityId === expectedSettings.abilityId &&
    repairDraft.abilityMetadata.difficulty === expectedSettings.difficulty &&
    repairDraft.abilityMetadata.taskRole === expectedSettings.taskRole &&
    repairDraft.tags.length === normalizedRepairTags.length &&
    repairDraft.tags.every((tag, index) => tag === normalizedRepairTags[index])
  );
  if (alreadyAligned) {
    await assertPublicationRepairAligned(repairDraft);
    return repairDraft;
  }

  const previousAbilityId = repairDraft.abilityMetadata.abilityId;
  const updatedDraft = await updateStructuredQuestionDraft(repository, repairDraft.draftId, {
    tags: normalizedRepairTags,
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
  await assertPublicationRepairAligned(updatedDraft);
  return updatedDraft;
}

export async function getQuestionResourceWorkbenchPublicationPreflight(
  draftOrId: StructuredQuestionDraft | string,
): Promise<QuestionPublicationPreflight> {
  const draft = typeof draftOrId === 'string'
    ? await repository.getDraft(draftOrId)
    : draftOrId;
  if (!draft) throw new Error(`Draft not found: ${draftOrId}`);

  const { planId, observationTaskPlanId } = readObservationTaskReference(draft.tags);
  if (!planId || !observationTaskPlanId) {
    return { scoped: false, passed: true, differences: [] };
  }

  const plan = await observationRepository.getPlan(planId);
  if (!plan) {
    return { scoped: true, passed: false, issue: 'plan_missing', differences: [] };
  }
  if (plan.status !== 'reviewed') {
    return { scoped: true, passed: false, issue: 'plan_not_reviewed', differences: [] };
  }
  const task = findObservationTaskPlan(plan, { planId, observationTaskPlanId });
  if (!task) {
    return { scoped: true, passed: false, issue: 'task_missing', differences: [] };
  }
  if (!draft.materialVersionId) {
    return { scoped: true, passed: false, issue: 'material_missing', differences: [] };
  }
  const material = await repository.getMaterial(draft.materialVersionId);
  if (!material) {
    return { scoped: true, passed: false, issue: 'material_not_found', differences: [] };
  }
  if (
    plan.materialVersionId !== draft.materialVersionId ||
    task.materialVersionId !== draft.materialVersionId
  ) {
    return { scoped: true, passed: false, issue: 'material_mismatch', differences: [] };
  }

  const expectedSettings = getPlanControlledQuestionSettings(task);
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

async function requireQuestionPublicationPreflight(
  draftId: string,
  operation: string,
): Promise<QuestionPublicationPreflight> {
  const preflight = await getQuestionResourceWorkbenchPublicationPreflight(draftId);
  if (preflight.passed) return preflight;

  throw createStructuredRuntimeError({
    code: 'PUBLICATION_PREFLIGHT_FAILED',
    message: publicationPreflightMessage(preflight),
    operation,
    objectId: draftId,
    recoverability: 'user_action_required',
  });
}

function publicationPreflightMessage(preflight: QuestionPublicationPreflight): string {
  switch (preflight.issue) {
    case 'plan_missing':
      return '无法找到题目关联的训练计划，请返回素材资源录入平台重新确认当前训练任务。';
    case 'plan_not_reviewed':
      return '题目关联的训练计划尚未完成审核，不能提交题目审核或发布。请先在素材资源录入平台完成训练计划审核。';
    case 'task_missing':
      return '训练计划中已找不到题目关联的任务，请返回素材资源录入平台重新选择或生成任务。';
    case 'material_missing':
      return '题目尚未绑定学习材料，不能提交审核或发布。请返回素材资源录入平台补充材料。';
    case 'material_not_found':
      return '题目绑定的学习材料已不存在或不可用，请返回素材资源录入平台重新选择学习材料。';
    case 'material_mismatch':
      return '题目绑定的学习材料与当前训练计划不一致，请返回素材资源录入平台重新同步当前任务。';
    default:
      return '题目的能力、难度或任务用途与当前训练计划不一致，请先同步训练设置并重新检查。';
  }
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

function createIdSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 12);
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function readTagValue(tags: string[] | undefined, prefix: string): string | null {
  return tags?.find((tag) => tag.startsWith(prefix))?.slice(prefix.length) || null;
}

async function alignDraftInputWithObservationPlan(
  draft: Omit<CreateStructuredQuestionDraftInput, 'draftId' | 'resourceId' | 'taskId'>,
): Promise<Omit<CreateStructuredQuestionDraftInput, 'draftId' | 'resourceId' | 'taskId'>> {
  const { planId, observationTaskPlanId } = readObservationTaskReference(draft.tags);
  if (!planId || !observationTaskPlanId) return draft;

  const plan = await observationRepository.getPlan(planId);
  const task = findObservationTaskPlan(plan, { planId, observationTaskPlanId });
  if (!task) return draft;

  return alignQuestionDraftInputWithPlan(draft, task);
}

async function getObservationTaskForDraft(
  draft: StructuredQuestionDraft,
) {
  const reference = readObservationTaskReference(draft.tags);
  if (!reference.planId || !reference.observationTaskPlanId) return null;
  const plan = await observationRepository.getPlan(reference.planId);
  return findObservationTaskPlan(plan, reference);
}

async function assertPublicationRepairAligned(draft: StructuredQuestionDraft): Promise<void> {
  const preflight = await getQuestionResourceWorkbenchPublicationPreflight(draft);
  if (!preflight.passed) {
    throw new Error('训练设置同步未完成，请重试；系统不会创建新的修订稿。');
  }
}

async function ensureCurrentPersistedQualityBundle(
  draftId: string,
): Promise<QuestionQualityAssessmentBundle> {
  const draft = await repository.getDraft(draftId);
  if (!draft?.latestValidationId || !draft.materialVersionId) {
    throw new Error('Current validated Draft and Material are required.');
  }
  const [validation, material, deterministic, boundary] = await Promise.all([
    repository.getValidation(draft.latestValidationId),
    repository.getMaterial(draft.materialVersionId),
    getOrAssessCurrentQuestionDraftQuality(
      repository,
      qualityRepository,
      draftId,
    ),
    getQuestionSemanticQualityBoundaryStatus(),
  ]);
  if (
    !validation?.passed ||
    validation.validatedDraftRevision !== draft.revision ||
    !material ||
    !deterministic
  ) {
    throw new Error('Current quality assessment inputs are incomplete.');
  }

  const existingSemantic = await qualityRepository.getCurrentCompletedSemantic({
    draftId: draft.draftId,
    draftRevision: draft.revision,
    validationId: validation.validationId,
    deterministicAssessmentId: deterministic.assessmentId,
    providerId: boundary.providerId,
    modelId: boundary.modelId,
    promptVersion: QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION,
    semanticRuleVersion: QUESTION_SEMANTIC_QUALITY_RULE_VERSION,
    outputSchemaVersion: QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION,
  });
  const semantic = existingSemantic || await requestQuestionSemanticQualityAssessment({
    requestId: `question-quality-${draft.draftId}-r${draft.revision}-${Date.now()}`,
    draft,
    validation,
    material,
    deterministicAssessment: deterministic,
  });
  const bundle = mergeQuestionQualityAssessments({
    deterministic,
    semantic,
  });
  return (await persistQuestionQualityBundle(qualityRepository, {
    deterministic,
    semantic,
    bundle,
  })).bundle;
}

async function readPersistedQualityContext(draftId: string) {
  const draft = await repository.getDraft(draftId);
  if (!draft?.latestValidationId) return null;
  const validation = await repository.getValidation(draft.latestValidationId);
  if (
    !validation?.passed ||
    validation.validatedDraftRevision !== draft.revision
  ) return null;
  const deterministic = (
    await qualityRepository.listDeterministicForDraft(draftId)
  ).find((item) => (
    item.assessedDraftRevision === draft.revision &&
    item.validationId === validation.validationId &&
    item.ruleVersion === QUESTION_QUALITY_RULE_VERSION
  ));
  if (!deterministic) return null;
  const semantic = (
    await qualityRepository.listSemanticForDraft(draftId)
  ).find((item) => (
    item.assessedDraftRevision === draft.revision &&
    item.validationId === validation.validationId &&
    item.deterministicAssessmentId === deterministic.assessmentId &&
    item.promptVersion === QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION &&
    item.semanticRuleVersion === QUESTION_SEMANTIC_QUALITY_RULE_VERSION &&
    item.outputSchemaVersion === QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION
  ));
  if (!semantic) return null;
  const bundle = await qualityRepository.getCurrentBundle({
    draftId,
    draftRevision: draft.revision,
    validationId: validation.validationId,
    deterministicAssessmentId: deterministic.assessmentId,
    semanticAssessmentId: semantic.semanticAssessmentId,
    mergeRuleVersion: QUESTION_QUALITY_MERGE_RULE_VERSION,
  });
  return bundle ? { draft, deterministic, semantic, bundle } : null;
}

async function requireExpectedDraftRevision(
  draftId: string,
  expectedDraftRevision: number | undefined,
  operation: string,
): Promise<StructuredQuestionDraft> {
  const draft = await repository.getDraft(draftId);
  if (!draft) throw new Error(`Draft not found: ${draftId}`);
  if (
    expectedDraftRevision !== undefined &&
    draft.revision !== expectedDraftRevision
  ) {
    throw createStructuredRuntimeError({
      code: 'QUESTION_DRAFT_REVISION_CONFLICT',
      message: '当前题目版本已变化，请刷新后再继续。',
      operation: `question_resource_workbench.${operation}`,
      objectId: draftId,
      recoverability: 'reload_required',
    });
  }
  return draft;
}
