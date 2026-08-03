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
  withdrawQuestionResourceReviewSubmission,
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
  isCompletedQuestionQualityContext,
  resolvePersistedQuestionQualityCheckState,
  selectPreferredPersistedQuestionQualityContext,
  type PersistedQuestionQualityCheckState,
} from '../ai/agents/questionQualityContextSelection.ts';
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
  AuthorWarningAcknowledgement,
  FrozenQuestionResourceVersion,
  QuestionMaterialVersion,
  ResourceRegistryEntry,
  ResourceReviewAction,
  ResourceReviewDecision,
  ResourceReviewReturnRequest,
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
  reviewHistory: ResourceReviewDecision[];
  qualityAssessment: QuestionQualityAssessment | null;
  semanticQualityAssessment: QuestionSemanticQualityAssessment | null;
  qualityAssessmentBundle: QuestionQualityAssessmentBundle | null;
  assessmentState: ReturnType<typeof getCurrentAssessmentState>;
  qualityCheckState: PersistedQuestionQualityCheckState;
  publicationPreflight: QuestionPublicationPreflight;
  frozenVersion: FrozenQuestionResourceVersion | null;
  registryEntry: ResourceRegistryEntry | null;
  versionHistory: FrozenQuestionResourceVersion[];
};

export type QuestionResourceWorkbenchQualityReadiness = Pick<
  QuestionResourceWorkbenchContext,
  'qualityAssessment' | 'semanticQualityAssessment' | 'qualityAssessmentBundle' | 'qualityCheckState'
>;

export async function getQuestionResourceWorkbenchQualityReadiness(
  draftId: string,
): Promise<QuestionResourceWorkbenchQualityReadiness> {
  const persistedQuality = await readPersistedQualityContext(draftId);
  return {
    qualityAssessment: persistedQuality?.deterministic || null,
    semanticQualityAssessment: persistedQuality?.semantic || null,
    qualityAssessmentBundle: persistedQuality?.bundle || null,
    qualityCheckState: resolvePersistedQuestionQualityCheckState(persistedQuality),
  };
}

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
    const persistedQuality = await readPersistedQualityContext(draft.draftId);
    const [validation, review, qualityAssessment] = await Promise.all([
      draft.latestValidationId
        ? repository.getValidation(draft.latestValidationId)
        : Promise.resolve(null),
      draft.latestReviewId
        ? repository.getReview(draft.latestReviewId)
        : Promise.resolve(null),
      persistedQuality?.deterministic
        ? Promise.resolve(persistedQuality.deterministic)
        : getOrAssessCurrentQuestionDraftQuality(
          repository,
          qualityRepository,
          draft.draftId,
        ),
    ]);
    return {
      draft,
      validation,
      review,
      qualityAssessment,
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
  const persistedQuality = await readPersistedQualityContext(draft.draftId);

  const [material, validation, review, reviewHistory, qualityAssessment, publicationPreflight, frozenVersion, registryEntry, versionHistory] = await Promise.all([
    draft.materialVersionId ? repository.getMaterial(draft.materialVersionId) : Promise.resolve(null),
    draft.latestValidationId ? repository.getValidation(draft.latestValidationId) : Promise.resolve(null),
    draft.latestReviewId ? repository.getReview(draft.latestReviewId) : Promise.resolve(null),
    repository.listReviews(draft.resourceId),
    persistedQuality?.deterministic
      ? Promise.resolve(persistedQuality.deterministic)
      : getOrAssessCurrentQuestionDraftQuality(
        repository,
        qualityRepository,
        draft.draftId,
      ),
    getQuestionResourceWorkbenchPublicationPreflight(draft),
    repository.getVersionByDraftId(draft.draftId),
    repository.getRegistryEntry(draft.resourceId),
    repository.listVersions(draft.resourceId),
  ]);
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
    reviewHistory,
    qualityAssessment,
    semanticQualityAssessment: persistedQuality?.semantic || null,
    qualityAssessmentBundle: persistedQuality?.bundle || null,
    assessmentState: getCurrentAssessmentState(draft, qualityAssessment),
    qualityCheckState: resolvePersistedQuestionQualityCheckState(persistedQuality),
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
  const validation = await validateQuestionResourceWorkbenchStructure(
    draftId,
    expectedDraftRevision,
  );
  if (validation.passed) {
    await completeQuestionResourceWorkbenchQualityCheck(
      draftId,
      expectedDraftRevision,
    );
  }
  return validation;
}

export async function validateQuestionResourceWorkbenchStructure(
  draftId: string,
  expectedDraftRevision?: number,
) {
  return validateStructuredQuestionDraft(
    repository,
    draftId,
    new Date().toISOString(),
    expectedDraftRevision,
  );
}

export async function completeQuestionResourceWorkbenchQualityCheck(
  draftId: string,
  expectedDraftRevision?: number,
): Promise<QuestionQualityAssessmentBundle> {
  await requireExpectedDraftRevision(
    draftId,
    expectedDraftRevision,
    'complete_quality_check',
  );
  const current = await readPersistedQualityContext(draftId);
  if (isCompletedQuestionQualityContext(current)) return current.bundle;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await ensureCurrentPersistedQualityBundle(draftId);
      const persisted = await readPersistedQualityContext(draftId);
      if (isCompletedQuestionQualityContext(persisted)) {
        return persisted.bundle;
      }
      lastError = createStructuredRuntimeError({
        code: 'RUNTIME_OPERATION_FAILED',
        message: '完整质量检查尚未完成，请稍后重试。',
        operation: 'question_quality.complete',
        objectId: draftId,
        recoverability: 'retry_safe',
      });
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
  throw lastError;
}

export async function submitQuestionResourceWorkbenchReview(
  draftId: string,
  expectedDraftRevision?: number,
  warningAcknowledgements: Array<{
    warningCode: string;
    rationale: string;
  }> = [],
) {
  const currentDraft = await requireExpectedDraftRevision(
    draftId,
    expectedDraftRevision,
    'submit_review',
  );
  if (['pending_review', 'reviewed'].includes(currentDraft.status)) {
    return currentDraft;
  }
  await requireQuestionPublicationPreflight(draftId, 'question_review.submit');
  const context = await requireCurrentPersistedQualityContext(
    repository,
    qualityRepository,
    draftId,
  );
  const acknowledgementByCode = new Map(
    warningAcknowledgements.map((item) => [item.warningCode, item.rationale.trim()]),
  );
  const missingAcknowledgement = context.deterministic.warnings.find(
    (warning) => !acknowledgementByCode.get(warning.code),
  );
  if (missingAcknowledgement) {
    throw new Error('提交审核前，请说明保留当前设置的理由。');
  }
  const acknowledgedAt = new Date().toISOString();
  const records: AuthorWarningAcknowledgement[] = context.deterministic.warnings.map(
    (warning) => ({
      acknowledgementId: `${draftId}:r${context.draft.revision}:${context.deterministic.assessmentId}:${warning.code}:author`,
      draftId,
      draftRevision: context.draft.revision,
      assessmentId: context.deterministic.assessmentId,
      warningCode: warning.code,
      action: 'accepted_current_design',
      rationale: acknowledgementByCode.get(warning.code) || '',
      acknowledgedBy: 'local-author',
      acknowledgedAt,
    }),
  );
  return submitQuestionResourceForReview(
    repository,
    draftId,
    acknowledgedAt,
    records,
    'local-author',
  );
}

export async function withdrawQuestionResourceWorkbenchReview(
  draftId: string,
  expectedDraftRevision?: number,
) {
  await requireExpectedDraftRevision(draftId, expectedDraftRevision, 'withdraw_review');
  return withdrawQuestionResourceReviewSubmission(repository, {
    draftId,
    actorId: 'local-author',
  });
}

export async function decideQuestionResourceWorkbenchReview(input: {
  draftId: string;
  expectedDraftRevision?: number;
  action: ResourceReviewAction;
  reviewerId: string;
  notes: string;
  returnRequest?: ResourceReviewReturnRequest;
  acceptedWarningCodes?: string[];
}) {
  if (
    input.action === 'revision_required' &&
    (
      !input.returnRequest?.problem.trim() ||
      !input.returnRequest.requirement.trim()
    )
  ) {
    throw new Error('退回修改时必须填写具体问题和修改要求。');
  }
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
      returnRequest: input.returnRequest,
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
  const deterministicCandidates = (
    await qualityRepository.listDeterministicForDraft(draftId)
  ).filter((item) => (
    item.assessedDraftRevision === draft.revision &&
    item.validationId === validation.validationId &&
    item.ruleVersion === QUESTION_QUALITY_RULE_VERSION
  ));
  if (deterministicCandidates.length === 0) return null;
  const semanticCandidates = (
    await qualityRepository.listSemanticForDraft(draftId)
  ).filter((item) => (
    item.assessedDraftRevision === draft.revision &&
    item.validationId === validation.validationId &&
    item.promptVersion === QUESTION_SEMANTIC_QUALITY_PROMPT_VERSION &&
    item.semanticRuleVersion === QUESTION_SEMANTIC_QUALITY_RULE_VERSION &&
    item.outputSchemaVersion === QUESTION_SEMANTIC_QUALITY_OUTPUT_SCHEMA_VERSION
  ));
  const contexts = [];
  for (const deterministic of deterministicCandidates) {
    const matchingSemantics = semanticCandidates.filter(
      (item) => item.deterministicAssessmentId === deterministic.assessmentId,
    );
    for (const semantic of matchingSemantics) {
      const bundle = await qualityRepository.getCurrentBundle({
        draftId,
        draftRevision: draft.revision,
        validationId: validation.validationId,
        deterministicAssessmentId: deterministic.assessmentId,
        semanticAssessmentId: semantic.semanticAssessmentId,
        mergeRuleVersion: QUESTION_QUALITY_MERGE_RULE_VERSION,
      });
      if (bundle) {
        contexts.push({ draft, deterministic, semantic, bundle });
      }
    }
  }
  return selectPreferredPersistedQuestionQualityContext(contexts);
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
