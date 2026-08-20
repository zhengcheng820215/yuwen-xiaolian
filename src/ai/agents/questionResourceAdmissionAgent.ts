import type { QuestionResourceAdmissionRepository } from '../repositories/questionResourceAdmissionRepository.ts';
import { createStructuredRuntimeError } from '../errors/structuredRuntimeError.ts';
import {
  getAuthoringValidationPath,
  getPlanControlledValidationPath,
} from '../contracts/authoringFieldContract.ts';
import {
  PRIMARY_ABILITY_IDS,
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  QUESTION_RESOURCE_ADMISSION_VERSION,
  cloneQuestionResourceValue,
  isPrimaryAbilityId,
  isQuestionResourceDifficulty,
  isQuestionResourceTaskRole,
  isQuestionResponseFormat,
  isStructuredQuestionType,
  normalizeQuestionRuntimePolicyTags,
  type FrozenQuestionResourceVersion,
  type QuestionAbilityMetadata,
  type AuthorWarningAcknowledgement,
  type QuestionMaterialMetadata,
  type QuestionMaterialVersion,
  type QuestionResourceDifficulty,
  type QuestionResourceRubricItem,
  type QuestionResponseFormat,
  type QuestionSource,
  type ResourceFreezeCommit,
  type ResourceFreezeResult,
  type ResourceRegistryConsistencyResult,
  type ResourceRegistryEntry,
  type ResourceReviewAction,
  type ResourceReviewDecision,
  type ResourceValidationChecks,
  type ResourceValidationIssue,
  type ResourceValidationResult,
  type StructuredQuestionDraft,
  type StructuredQuestionType,
} from '../schemas/questionResourceAdmission.schema.ts';
import type { AnswerAcceptance, AssessmentMode } from '../schemas/diagnosis.schema.ts';
import {
  isSingleChoiceMinimumResponseRequirement,
  validateSingleChoiceInteraction,
  type SingleChoiceInteraction,
} from '../schemas/singleChoiceInteraction.schema.ts';
import {
  buildMaterialContentHash,
  CURRENT_MATERIAL_CONTENT_NORMALIZATION_POLICY_VERSION,
  projectTargetedMaterialUsage,
  validateTargetedMaterialUsage,
  validateTargetedTrainingResourceMetadata,
} from '../schemas/targetedMicroTraining.schema.ts';

export type CreateQuestionMaterialInput = Omit<
  QuestionMaterialVersion,
  'schemaVersion' | 'createdAt' | 'updatedAt'
> & {
  createdAt?: string;
  updatedAt?: string;
};

export type CreateQuestionMaterialRevisionInput = {
  sourceMaterialVersionId: string;
  title?: string;
  content?: string;
  source?: QuestionMaterialVersion['source'];
  metadata?: QuestionMaterialMetadata;
  usageType?: QuestionMaterialVersion['usageType'];
  targetedExcerptMetadata?: QuestionMaterialVersion['targetedExcerptMetadata'];
  contentNormalizationPolicyVersion?: QuestionMaterialVersion['contentNormalizationPolicyVersion'];
  revisionNote: string;
  now?: string;
};

export type CreateStructuredQuestionDraftInput = {
  draftId: string;
  resourceId: string;
  taskId: string;
  proposedVersionNumber?: number;
  parentVersionId?: string;
  materialVersionId?: string;
  title: string;
  questionStem: string;
  questionType: StructuredQuestionType;
  responseFormat: QuestionResponseFormat;
  options?: string[];
  choiceInteraction?: SingleChoiceInteraction;
  assessmentMode: AssessmentMode;
  answerAcceptance?: AnswerAcceptance;
  rubric: QuestionResourceRubricItem[];
  minimumAnswerRequirement: StructuredQuestionDraft['minimumAnswerRequirement'];
  abilityMetadata: QuestionAbilityMetadata;
  source: QuestionSource;
  tags?: string[];
  now?: string;
};

export type StructuredQuestionDraftPatch = Partial<Pick<
  StructuredQuestionDraft,
  | 'materialVersionId'
  | 'title'
  | 'questionStem'
  | 'questionType'
  | 'responseFormat'
  | 'options'
  | 'choiceInteraction'
  | 'assessmentMode'
  | 'answerAcceptance'
  | 'rubric'
  | 'minimumAnswerRequirement'
  | 'abilityMetadata'
  | 'source'
  | 'tags'
  | 'qualityRevisionProgress'
>>;

export async function createQuestionMaterial(
  repository: QuestionResourceAdmissionRepository,
  input: CreateQuestionMaterialInput,
): Promise<QuestionMaterialVersion> {
  const now = input.updatedAt || input.createdAt || new Date().toISOString();
  const content = input.content.trim();
  const usage = projectTargetedMaterialUsage(input);
  const contentNormalizationPolicyVersion = usage.usageType === 'targeted_excerpt'
    ? input.contentNormalizationPolicyVersion
      || CURRENT_MATERIAL_CONTENT_NORMALIZATION_POLICY_VERSION
    : input.contentNormalizationPolicyVersion;
  const contentHash = usage.usageType === 'targeted_excerpt'
    ? buildMaterialContentHash(content, contentNormalizationPolicyVersion)
    : input.contentHash;
  if (input.contentHash && input.contentHash !== contentHash) {
    throw new Error('Material contentHash does not match normalized content.');
  }
  const material: QuestionMaterialVersion = {
    materialId: input.materialId,
    materialVersionId: input.materialVersionId,
    versionNumber: input.versionNumber,
    status: input.status || 'active',
    parentMaterialVersionId: input.parentMaterialVersionId,
    revisionNote: input.revisionNote?.trim(),
    title: input.title.trim(),
    content,
    usageType: input.usageType,
    contentHash,
    contentNormalizationPolicyVersion,
    targetedExcerptMetadata: input.targetedExcerptMetadata
      ? clone(input.targetedExcerptMetadata)
      : undefined,
    source: clone(input.source),
    metadata: input.metadata ? normalizeMaterialMetadata(input.metadata) : undefined,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };

  if (!nonEmpty(material.materialId) || !nonEmpty(material.materialVersionId)) {
    throw new Error('Material identity is required.');
  }
  if (!nonEmpty(material.title)) {
    throw new Error('Material title is required.');
  }
  if (!Number.isInteger(material.versionNumber) || material.versionNumber < 1) {
    throw new Error('Material versionNumber must be a positive integer.');
  }
  if (!nonEmpty(material.content)) {
    throw new Error('Material content is required.');
  }
  if (!nonEmpty(material.source.description)) {
    throw new Error('Material source description is required.');
  }
  const targetedValidation = validateTargetedMaterialUsage(material);
  if (!targetedValidation.passed) {
    throw new Error(
      `Material usage is invalid: ${targetedValidation.issues.map((issue) => issue.code).join(', ')}`,
    );
  }

  return repository.saveMaterial(material);
}

export async function createQuestionMaterialRevision(
  repository: QuestionResourceAdmissionRepository,
  input: CreateQuestionMaterialRevisionInput,
): Promise<QuestionMaterialVersion> {
  const source = await repository.getMaterial(input.sourceMaterialVersionId);
  if (!source) throw new Error(`Material Version not found: ${input.sourceMaterialVersionId}`);
  if (!input.revisionNote.trim()) throw new Error('Material revisionNote is required.');
  const siblings = (await repository.listMaterials())
    .filter((material) => material.materialId === source.materialId);
  const existing = siblings
    .filter((material) => material.parentMaterialVersionId === source.materialVersionId)
    .sort((left, right) => right.versionNumber - left.versionNumber)[0];
  if (existing) {
    const expectedMetadata = input.metadata
      ? normalizeMaterialMetadata(input.metadata)
      : source.metadata;
    const requestedContent = (input.content ?? source.content).trim();
    const requestedUsageType = input.usageType ?? source.usageType;
    if (requestedUsageType !== source.usageType) {
      throw new Error('Material usage type cannot change in an ordinary revision. Create a new Material identity.');
    }
    const requestedPolicy = input.contentNormalizationPolicyVersion
      ?? source.contentNormalizationPolicyVersion;
    const requestedTargetedMetadata = input.targetedExcerptMetadata
      ?? source.targetedExcerptMetadata;
    const requestedContentHash = requestedUsageType === 'targeted_excerpt'
      ? buildMaterialContentHash(
          requestedContent,
          requestedPolicy || CURRENT_MATERIAL_CONTENT_NORMALIZATION_POLICY_VERSION,
        )
      : source.contentHash;
    const sameRequestedRevision =
      existing.parentMaterialVersionId === source.materialVersionId &&
      existing.revisionNote === input.revisionNote.trim() &&
      existing.title === (input.title ?? source.title).trim() &&
      existing.content === requestedContent &&
      JSON.stringify(existing.source) === JSON.stringify(input.source ?? source.source) &&
      JSON.stringify(existing.metadata) === JSON.stringify(expectedMetadata) &&
      existing.usageType === requestedUsageType &&
      existing.contentHash === requestedContentHash &&
      existing.contentNormalizationPolicyVersion === requestedPolicy &&
      JSON.stringify(existing.targetedExcerptMetadata) === JSON.stringify(requestedTargetedMetadata);
    if (!sameRequestedRevision) {
      throw new Error(`Material revision already exists with different content: ${existing.materialVersionId}`);
    }
    return existing;
  }
  const versionNumber = Math.max(...siblings.map((material) => material.versionNumber)) + 1;
  const materialVersionId = `${source.materialId}:v${versionNumber}`;
  const now = input.now || new Date().toISOString();
  const requestedUsageType = input.usageType ?? source.usageType;
  if (requestedUsageType !== source.usageType) {
    throw new Error('Material usage type cannot change in an ordinary revision. Create a new Material identity.');
  }
  return createQuestionMaterial(repository, {
    materialId: source.materialId,
    materialVersionId,
    versionNumber,
    status: 'retired',
    parentMaterialVersionId: source.materialVersionId,
    revisionNote: input.revisionNote,
    title: input.title ?? source.title,
    content: input.content ?? source.content,
    source: input.source ?? source.source,
    metadata: input.metadata ?? source.metadata,
    usageType: requestedUsageType,
    contentNormalizationPolicyVersion: input.contentNormalizationPolicyVersion
      ?? source.contentNormalizationPolicyVersion,
    targetedExcerptMetadata: input.targetedExcerptMetadata
      ?? source.targetedExcerptMetadata,
    createdAt: now,
    updatedAt: now,
  });
}

export async function createStructuredQuestionDraft(
  repository: QuestionResourceAdmissionRepository,
  input: CreateStructuredQuestionDraftInput,
): Promise<StructuredQuestionDraft> {
  if (await repository.getDraft(input.draftId)) {
    throw new Error(`Draft already exists: ${input.draftId}`);
  }

  const now = input.now || new Date().toISOString();
  const draft: StructuredQuestionDraft = {
    draftId: input.draftId,
    resourceId: input.resourceId,
    taskId: input.taskId,
    proposedVersionNumber: input.proposedVersionNumber || 1,
    parentVersionId: input.parentVersionId,
    materialVersionId: input.materialVersionId,
    title: input.title,
    questionStem: input.questionStem,
    questionType: input.questionType,
    responseFormat: input.responseFormat,
    options: input.options ? [...input.options] : undefined,
    choiceInteraction: input.choiceInteraction ? clone(input.choiceInteraction) : undefined,
    assessmentMode: input.assessmentMode,
    answerAcceptance: input.answerAcceptance ? clone(input.answerAcceptance) : undefined,
    rubric: clone(input.rubric),
    minimumAnswerRequirement: clone(input.minimumAnswerRequirement),
    abilityMetadata: clone(input.abilityMetadata),
    source: clone(input.source),
    tags: [...(input.tags || [])],
    status: 'drafted',
    revision: 1,
    createdAt: now,
    updatedAt: now,
    version: QUESTION_RESOURCE_ADMISSION_VERSION,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };

  const material = draft.materialVersionId
    ? await repository.getMaterial(draft.materialVersionId)
    : null;
  const materialUsage = material ? projectTargetedMaterialUsage(material) : null;
  if (materialUsage?.usageType === 'targeted_excerpt') {
    const targetedValidation = validateTargetedTrainingResourceMetadata(
      draft.abilityMetadata.targetedTrainingMetadata,
      draft.materialVersionId,
    );
    if (!targetedValidation.passed) {
      throw new Error(
        `Targeted Question Draft is invalid: ${targetedValidation.issues.map((issue) => issue.code).join(', ')}`,
      );
    }
    if (draft.abilityMetadata.taskRole !== 'training') {
      throw new Error('Targeted Question Draft must use the training role.');
    }
  } else if (draft.abilityMetadata.targetedTrainingMetadata !== undefined) {
    throw new Error('Core Question Draft cannot carry targeted training metadata.');
  }

  return repository.saveDraft(draft);
}

export async function createRevisionFromRejectedQuestionResourceDraft(
  repository: QuestionResourceAdmissionRepository,
  input: {
    sourceDraftId: string;
    draftId: string;
    now?: string;
  },
): Promise<StructuredQuestionDraft> {
  const source = await requireDraft(repository, input.sourceDraftId);
  if (source.status !== 'rejected') {
    throw new Error('Only a rejected draft can create a revision draft.');
  }

  const siblings = await repository.listDrafts();
  const activeSibling = siblings.find((draft) => (
    draft.draftId !== source.draftId &&
    draft.resourceId === source.resourceId &&
    draft.proposedVersionNumber === source.proposedVersionNumber &&
    !['rejected', 'archived'].includes(draft.status)
  ));
  if (activeSibling) {
    return activeSibling;
  }

  return createStructuredQuestionDraft(repository, {
    draftId: input.draftId,
    resourceId: source.resourceId,
    taskId: source.taskId,
    proposedVersionNumber: source.proposedVersionNumber,
    parentVersionId: source.parentVersionId,
    materialVersionId: source.materialVersionId,
    title: source.title,
    questionStem: source.questionStem,
    questionType: source.questionType,
    responseFormat: source.responseFormat,
    options: source.options,
    choiceInteraction: source.choiceInteraction,
    assessmentMode: source.assessmentMode,
    answerAcceptance: source.answerAcceptance,
    rubric: source.rubric,
    minimumAnswerRequirement: source.minimumAnswerRequirement,
    abilityMetadata: source.abilityMetadata,
    source: source.source,
    tags: [...source.tags, `rejected_revision_source:${source.draftId}`],
    now: input.now,
  });
}

export function findActiveQuestionResourceRevisionDraft(
  drafts: StructuredQuestionDraft[],
  input: {
    resourceId: string;
    parentVersionId: string;
  },
): StructuredQuestionDraft | null {
  return drafts
    .filter((draft) => (
      draft.resourceId === input.resourceId &&
      draft.parentVersionId === input.parentVersionId &&
      !['rejected', 'archived'].includes(draft.status)
    ))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
}

export async function updateStructuredQuestionDraft(
  repository: QuestionResourceAdmissionRepository,
  draftId: string,
  patch: StructuredQuestionDraftPatch,
  now = new Date().toISOString(),
  options: {
    expectedRevision?: number;
  } = {},
): Promise<StructuredQuestionDraft> {
  const draft = await requireDraft(repository, draftId);
  if (isDraftPatchUnchanged(draft, patch)) {
    return clone(draft);
  }
  if (
    options.expectedRevision !== undefined &&
    draft.revision !== options.expectedRevision
  ) {
    throw createStructuredRuntimeError({
      code: 'QUESTION_DRAFT_REVISION_CONFLICT',
      message: '当前题目已被其他操作更新，请刷新后再继续。',
      operation: 'question_resource.update_draft',
      objectId: draftId,
      recoverability: 'reload_required',
    });
  }
  if (!['drafted', 'validation_failed', 'revision_required'].includes(draft.status)) {
    throw new Error(`Draft cannot be edited from status: ${draft.status}`);
  }
  if (await repository.getVersionByDraftId(draftId)) {
    throw new Error('Frozen resource drafts cannot be edited. Create a new version instead.');
  }

  const updated: StructuredQuestionDraft = {
    ...draft,
    ...clone(patch),
    draftId: draft.draftId,
    resourceId: draft.resourceId,
    taskId: draft.taskId,
    proposedVersionNumber: draft.proposedVersionNumber,
    parentVersionId: draft.parentVersionId,
    status: 'drafted',
    revision: draft.revision + 1,
    latestValidationId: undefined,
    latestReviewId: undefined,
    createdAt: draft.createdAt,
    updatedAt: now,
    version: QUESTION_RESOURCE_ADMISSION_VERSION,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };

  return repository.saveDraft(updated);
}

export async function validateStructuredQuestionDraft(
  repository: QuestionResourceAdmissionRepository,
  draftId: string,
  now = new Date().toISOString(),
  expectedRevision?: number,
): Promise<ResourceValidationResult> {
  const draft = await requireDraft(repository, draftId);
  if (
    expectedRevision !== undefined &&
    draft.revision !== expectedRevision
  ) {
    throw createStructuredRuntimeError({
      code: 'QUESTION_DRAFT_REVISION_CONFLICT',
      message: '当前题目版本已变化，请刷新后重新检查。',
      operation: 'question_resource.validate_draft',
      objectId: draftId,
      recoverability: 'reload_required',
    });
  }
  const issues: ResourceValidationIssue[] = [];
  const material = draft.materialVersionId
    ? await repository.getMaterial(draft.materialVersionId)
    : null;
  const registry = await repository.getRegistryEntry(draft.resourceId);

  validateIdentity(draft, issues);
  validateContent(draft, issues);
  validateAnswerAcceptance(draft, issues);
  validateRubric(draft, issues);
  validateAbilityAndRole(draft, issues);
  validateMaterial(draft, material, issues);
  validateVersionLineage(draft, registry, issues);

  if (draft.tags.length === 0) {
    warning(issues, 'tags.empty', 'tags', 'Resource has no searchable tags.');
  }
  if (!nonEmpty(draft.source.copyrightNote)) {
    warning(issues, 'source.copyright_note_missing', 'source.copyrightNote', 'Copyright note is not recorded.');
  }

  const checks: ResourceValidationChecks = {
    identityValid: !hasErrorFor(issues, ['draftId', 'resourceId', 'taskId', 'proposedVersionNumber']),
    contentValid: !hasErrorPrefix(issues, ['title', 'questionStem', 'questionType', 'responseFormat', 'options', 'choiceInteraction', 'assessmentMode', 'minimumAnswerRequirement']),
    answerAcceptanceValid: !hasErrorPrefix(issues, ['answerAcceptance']),
    rubricValid: !hasErrorPrefix(issues, ['rubric']),
    abilityAndRoleValid: !hasErrorPrefix(issues, ['abilityMetadata']),
    versionLineageValid: !hasErrorPrefix(issues, ['parentVersionId', 'proposedVersionNumber']),
    materialValid: !hasErrorPrefix(issues, ['materialVersionId']),
  };
  const passed = issues.every((issue) => issue.severity !== 'error');
  const validationId = `${draft.draftId}:validation:r${draft.revision}`;
  const result: ResourceValidationResult = {
    validationId,
    draftId: draft.draftId,
    resourceId: draft.resourceId,
    validatedDraftRevision: draft.revision,
    validationRuleVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
    passed,
    checks,
    issues,
    checkedAt: now,
  };

  const existing = await repository.getValidation(validationId);
  if (existing) {
    if (draft.latestValidationId !== validationId) {
      await repository.saveDraft({
        ...draft,
        status: existing.passed ? 'drafted' : 'validation_failed',
        latestValidationId: validationId,
        latestReviewId: undefined,
        updatedAt: now,
      });
    }
    return clone(existing);
  }

  await repository.saveValidation(result);
  await repository.saveDraft({
    ...draft,
    status: passed ? 'drafted' : 'validation_failed',
    latestValidationId: validationId,
    latestReviewId: undefined,
    updatedAt: now,
  });

  return clone(result);
}

export async function submitQuestionResourceForReview(
  repository: QuestionResourceAdmissionRepository,
  draftId: string,
  now = new Date().toISOString(),
  warningAcknowledgements?: AuthorWarningAcknowledgement[],
  submitterId = 'local-author',
): Promise<StructuredQuestionDraft> {
  const draft = await requireDraft(repository, draftId);
  if (draft.status === 'pending_review') {
    await requireCurrentPassedValidation(repository, draft);
    return clone(draft);
  }
  if (!['drafted', 'validation_failed'].includes(draft.status)) {
    throw new Error(`Draft cannot be submitted for review from status: ${draft.status}`);
  }
  const validation = await requireCurrentPassedValidation(repository, draft);

  return repository.saveDraft({
    ...draft,
    status: 'pending_review',
    latestValidationId: validation.validationId,
    latestReviewId: undefined,
    reviewSubmittedAt: now,
    reviewSubmittedBy: submitterId,
    reviewSubmissionCount: (draft.reviewSubmissionCount || 0) + 1,
    reviewSubmissionHistory: [
      ...(draft.reviewSubmissionHistory || []),
      {
        eventId: `${draft.draftId}:r${draft.revision}:submitted:${(draft.reviewSubmissionCount || 0) + 1}`,
        action: 'submitted',
        draftRevision: draft.revision,
        actorId: submitterId,
        occurredAt: now,
      },
    ],
    warningAcknowledgements: warningAcknowledgements
      ? clone(warningAcknowledgements)
      : draft.warningAcknowledgements,
    updatedAt: now,
  });
}

export async function withdrawQuestionResourceReviewSubmission(
  repository: QuestionResourceAdmissionRepository,
  input: {
    draftId: string;
    actorId: string;
    now?: string;
  },
): Promise<StructuredQuestionDraft> {
  const draft = await requireDraft(repository, input.draftId);
  if (draft.status !== 'pending_review') {
    throw new Error(`Draft cannot withdraw review submission from status: ${draft.status}`);
  }
  if (!nonEmpty(input.actorId)) throw new Error('actorId is required.');
  const now = input.now || new Date().toISOString();
  const withdrawalCount = (draft.reviewSubmissionHistory || [])
    .filter((event) => event.action === 'withdrawn').length + 1;

  return repository.saveDraft({
    ...draft,
    status: 'drafted',
    reviewSubmittedAt: undefined,
    reviewSubmittedBy: undefined,
    reviewSubmissionHistory: [
      ...(draft.reviewSubmissionHistory || []),
      {
        eventId: `${draft.draftId}:r${draft.revision}:withdrawn:${withdrawalCount}`,
        action: 'withdrawn',
        draftRevision: draft.revision,
        actorId: input.actorId,
        occurredAt: now,
      },
    ],
    updatedAt: now,
  });
}

export async function reviewQuestionResourceDraft(
  repository: QuestionResourceAdmissionRepository,
  input: {
    draftId: string;
    action: ResourceReviewAction;
    reviewerId: string;
    notes: string;
    returnRequest?: ResourceReviewDecision['returnRequest'];
    warningDecisions?: ResourceReviewDecision['warningDecisions'];
    qualityAssessmentBundleId?: string;
    deterministicAssessmentId?: string;
    semanticAssessmentId?: string;
    qualityMergeRuleVersion?: string;
    now?: string;
  },
): Promise<ResourceReviewDecision> {
  const draft = await requireDraft(repository, input.draftId);
  const reviewId = `${draft.draftId}:review:r${draft.revision}`;
  const existing = await repository.getReview(reviewId);
  if (existing) {
    if (reviewOutcomeMatchesExisting(existing, input)) {
      const expectedStatus = existing.action === 'approve'
        ? 'reviewed'
        : existing.action === 'revision_required'
          ? 'revision_required'
          : 'rejected';
      if (draft.status !== expectedStatus || draft.latestReviewId !== existing.reviewId) {
        await repository.saveDraft({
          ...draft,
          status: expectedStatus,
          latestReviewId: existing.reviewId,
          revisionRequestedAt: existing.action === 'revision_required'
            ? existing.reviewedAt
            : draft.revisionRequestedAt,
          revisionRequestCount: existing.action === 'revision_required'
            ? Math.max(1, draft.revisionRequestCount || 0)
            : draft.revisionRequestCount,
          updatedAt: existing.reviewedAt,
        });
      }
      return existing;
    }
    throw createStructuredRuntimeError({
      code: 'QUESTION_REVIEW_IMMUTABLE_CONFLICT',
      message: '当前修订版已经形成不同的人工审核决定，不能静默覆盖。',
      operation: 'question_resource.review',
      objectId: reviewId,
      recoverability: 'new_revision_required',
    });
  }

  if (draft.status !== 'pending_review') {
    throw new Error(`Draft cannot be reviewed from status: ${draft.status}`);
  }
  if (!nonEmpty(input.reviewerId)) throw new Error('reviewerId is required.');
  if (input.action === 'reject' && !nonEmpty(input.notes)) {
    throw new Error('Review notes are required when rejecting a draft.');
  }
  const validation = await requireCurrentPassedValidation(repository, draft);
  const now = input.now || new Date().toISOString();
  const decision: ResourceReviewDecision = {
    reviewId,
    draftId: draft.draftId,
    resourceId: draft.resourceId,
    reviewedDraftRevision: draft.revision,
    validationId: validation.validationId,
    qualityAssessmentBundleId: input.qualityAssessmentBundleId,
    deterministicAssessmentId: input.deterministicAssessmentId,
    semanticAssessmentId: input.semanticAssessmentId,
    qualityMergeRuleVersion: input.qualityMergeRuleVersion,
    action: input.action,
    reviewerId: input.reviewerId,
    notes: input.notes.trim(),
    returnRequest: input.returnRequest
      ? clone(input.returnRequest)
      : undefined,
    reviewedAt: now,
    warningDecisions: input.warningDecisions
      ? clone(input.warningDecisions)
      : undefined,
  };
  await repository.saveReview(decision);
  await repository.saveDraft({
    ...draft,
    status: input.action === 'approve'
      ? 'reviewed'
      : input.action === 'revision_required'
        ? 'revision_required'
        : 'rejected',
    latestReviewId: decision.reviewId,
    revisionRequestedAt: input.action === 'revision_required'
      ? now
      : draft.revisionRequestedAt,
    revisionRequestCount: input.action === 'revision_required'
      ? (draft.revisionRequestCount || 0) + 1
      : draft.revisionRequestCount,
    updatedAt: now,
  });

  return clone(decision);
}

function reviewOutcomeMatchesExisting(
  existing: ResourceReviewDecision,
  input: {
    action: ResourceReviewAction;
    returnRequest?: ResourceReviewDecision['returnRequest'];
    warningDecisions?: ResourceReviewDecision['warningDecisions'];
    qualityAssessmentBundleId?: string;
    deterministicAssessmentId?: string;
    semanticAssessmentId?: string;
    qualityMergeRuleVersion?: string;
  },
): boolean {
  return (
    existing.action === input.action &&
    JSON.stringify(existing.returnRequest || null) ===
      JSON.stringify(input.returnRequest || null) &&
    existing.qualityAssessmentBundleId === input.qualityAssessmentBundleId &&
    existing.deterministicAssessmentId === input.deterministicAssessmentId &&
    existing.semanticAssessmentId === input.semanticAssessmentId &&
    existing.qualityMergeRuleVersion === input.qualityMergeRuleVersion &&
    JSON.stringify(comparableWarningDecisions(existing.warningDecisions)) ===
      JSON.stringify(comparableWarningDecisions(input.warningDecisions))
  );
}

function comparableWarningDecisions(
  decisions: ResourceReviewDecision['warningDecisions'],
) {
  return (decisions || []).map((decision) => ({
    warningDecisionId: decision.warningDecisionId,
    draftId: decision.draftId,
    draftRevision: decision.draftRevision,
    assessmentId: decision.assessmentId,
    warningCode: decision.warningCode,
    decision: decision.decision,
  }));
}

export async function freezeQuestionResourceDraft(
  repository: QuestionResourceAdmissionRepository,
  draftId: string,
  now = new Date().toISOString(),
): Promise<ResourceFreezeResult> {
  const existing = await repository.getVersionByDraftId(draftId);
  if (existing) {
    const registryEntry = await ensureRegistryEntryForFrozenVersion(
      repository,
      existing,
      now,
    );
    return { version: existing, registryEntry, inserted: false };
  }

  const commit = await prepareQuestionResourceFreezeCommit(
    repository,
    draftId,
    now,
  );
  return repository.commitFreeze(commit);
}

export async function ensureRegistryEntryForFrozenVersion(
  repository: QuestionResourceAdmissionRepository,
  version: FrozenQuestionResourceVersion,
  now = new Date().toISOString(),
): Promise<ResourceRegistryEntry> {
  const existing = await repository.getRegistryEntry(version.resourceId);
  if (existing) return existing;

  const versions = await repository.listVersions(version.resourceId);
  const current = versions
    .filter((item) => item.status === 'frozen')
    .sort((left, right) => right.versionNumber - left.versionNumber)[0];
  if (!current) {
    throw new Error('Frozen version exists without a recoverable current version.');
  }
  const recovered = buildRegistryEntry(current, null, now);
  return repository.saveRegistryEntry({
    ...recovered,
    createdAt: current.frozenAt,
  });
}

export async function prepareQuestionResourceFreezeCommit(
  repository: QuestionResourceAdmissionRepository,
  draftId: string,
  now = new Date().toISOString(),
): Promise<ResourceFreezeCommit> {
  const draft = await requireDraft(repository, draftId);
  if (draft.status !== 'reviewed') {
    throw new Error(`Only reviewed drafts can be frozen. Current status: ${draft.status}`);
  }
  const validation = await requireCurrentPassedValidation(repository, draft);
  const review = await requireCurrentApprovedReview(repository, draft, validation.validationId);
  const material = draft.materialVersionId
    ? await repository.getMaterial(draft.materialVersionId)
    : null;
  if (draft.materialVersionId && !material) {
    throw new Error('Referenced Material Version is missing.');
  }

  const currentRegistry = await repository.getRegistryEntry(draft.resourceId);
  if (draft.proposedVersionNumber === 1 && currentRegistry?.currentFrozenVersionId) {
    throw new Error('Resource already has a frozen version. Create a new version draft.');
  }
  if (draft.proposedVersionNumber > 1) {
    if (!currentRegistry?.currentFrozenVersionId) {
      throw new Error('New version requires an existing current frozen version.');
    }
    if (draft.parentVersionId !== currentRegistry.currentFrozenVersionId) {
      throw new Error('Draft parentVersionId is not the current registry head.');
    }
  }

  const resourceVersionId = `${draft.resourceId}:v${draft.proposedVersionNumber}`;
  const version: FrozenQuestionResourceVersion = {
    resourceId: draft.resourceId,
    resourceVersionId,
    versionNumber: draft.proposedVersionNumber,
    parentVersionId: draft.parentVersionId,
    sourceDraftId: draft.draftId,
    materialId: material?.materialId,
    materialVersionId: material?.materialVersionId,
    materialSnapshot: material ? clone(material) : undefined,
    taskId: draft.taskId,
    title: draft.title.trim(),
    questionStem: draft.questionStem.trim(),
    questionType: draft.questionType,
    responseFormat: draft.responseFormat,
    options: draft.options ? [...draft.options] : undefined,
    choiceInteraction: draft.choiceInteraction ? clone(draft.choiceInteraction) : undefined,
    assessmentMode: draft.assessmentMode,
    answerAcceptance: draft.answerAcceptance ? clone(draft.answerAcceptance) : undefined,
    rubric: clone(draft.rubric),
    minimumAnswerRequirement: clone(draft.minimumAnswerRequirement),
    abilityMetadata: clone(draft.abilityMetadata),
    source: clone(draft.source),
    tags: normalizeQuestionRuntimePolicyTags(
      draft.tags,
      draft.abilityMetadata.taskRole,
    ),
    validationId: validation.validationId,
    reviewId: review.reviewId,
    status: 'frozen',
    frozenAt: now,
    updatedAt: now,
    version: QUESTION_RESOURCE_ADMISSION_VERSION,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
  const registryEntry = buildRegistryEntry(version, currentRegistry, now);

  return {
    version,
    registryEntry,
    previousVersionId: currentRegistry?.currentFrozenVersionId,
  };
}

export async function createNextQuestionResourceVersionDraft(
  repository: QuestionResourceAdmissionRepository,
  input: {
    resourceId: string;
    draftId: string;
    now?: string;
  },
): Promise<StructuredQuestionDraft> {
  const registry = await repository.getRegistryEntry(input.resourceId);
  if (!registry || registry.status !== 'active' || !registry.currentFrozenVersionId) {
    throw new Error('Resource has no active current frozen version.');
  }
  const current = await repository.getVersion(registry.currentFrozenVersionId);
  if (!current) throw new Error('Registry head version is missing.');

  return createStructuredQuestionDraft(repository, {
    draftId: input.draftId,
    resourceId: current.resourceId,
    taskId: current.taskId,
    proposedVersionNumber: current.versionNumber + 1,
    parentVersionId: current.resourceVersionId,
    materialVersionId: current.materialVersionId,
    title: current.title,
    questionStem: current.questionStem,
    questionType: current.questionType,
    responseFormat: current.responseFormat,
    options: current.options,
    choiceInteraction: current.choiceInteraction,
    assessmentMode: current.assessmentMode,
    answerAcceptance: current.answerAcceptance,
    rubric: current.rubric,
    minimumAnswerRequirement: current.minimumAnswerRequirement,
    abilityMetadata: current.abilityMetadata,
    source: current.source,
    tags: current.tags,
    now: input.now,
  });
}

export async function createEditableSuccessorQuestionResourceDraft(
  repository: QuestionResourceAdmissionRepository,
  input: {
    sourceDraftId: string;
    draftId: string;
    now?: string;
  },
): Promise<StructuredQuestionDraft> {
  const source = await requireDraft(repository, input.sourceDraftId);
  if (['drafted', 'validation_failed', 'revision_required'].includes(source.status)) {
    return clone(source);
  }

  const frozenVersion = await repository.getVersionByDraftId(source.draftId);
  if (frozenVersion) {
    const existing = findActiveQuestionResourceRevisionDraft(
      await repository.listDrafts(),
      {
        resourceId: source.resourceId,
        parentVersionId: frozenVersion.resourceVersionId,
      },
    );
    return existing || createNextQuestionResourceVersionDraft(repository, {
      resourceId: source.resourceId,
      draftId: input.draftId,
      now: input.now,
    });
  }

  const existing = (await repository.listDrafts())
    .filter((draft) => (
      draft.draftId !== source.draftId
      && draft.resourceId === source.resourceId
      && ['drafted', 'validation_failed', 'revision_required'].includes(draft.status)
      && draft.tags.includes(`editable_successor_source:${source.draftId}`)
    ))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  if (existing) return existing;

  return createStructuredQuestionDraft(repository, {
    draftId: input.draftId,
    resourceId: source.resourceId,
    taskId: source.taskId,
    proposedVersionNumber: source.proposedVersionNumber,
    parentVersionId: source.parentVersionId,
    materialVersionId: source.materialVersionId,
    title: source.title,
    questionStem: source.questionStem,
    questionType: source.questionType,
    responseFormat: source.responseFormat,
    options: source.options,
    choiceInteraction: source.choiceInteraction,
    assessmentMode: source.assessmentMode,
    answerAcceptance: source.answerAcceptance,
    rubric: source.rubric,
    minimumAnswerRequirement: source.minimumAnswerRequirement,
    abilityMetadata: source.abilityMetadata,
    source: source.source,
    tags: [...source.tags, `editable_successor_source:${source.draftId}`],
    now: input.now,
  });
}

export async function validateResourceRegistryConsistency(
  repository: QuestionResourceAdmissionRepository,
): Promise<ResourceRegistryConsistencyResult> {
  const issues: string[] = [];
  const entries = await repository.listRegistryEntries();
  const versions = await repository.listVersions();

  for (const entry of entries) {
    if (entry.status === 'active') {
      if (!entry.currentFrozenVersionId) {
        issues.push(`Active registry entry has no head: ${entry.resourceId}`);
        continue;
      }
      const head = versions.find((version) => version.resourceVersionId === entry.currentFrozenVersionId);
      if (!head) {
        issues.push(`Registry head is missing: ${entry.currentFrozenVersionId}`);
        continue;
      }
      if (head.resourceId !== entry.resourceId || head.status !== 'frozen') {
        issues.push(`Registry head is not the current frozen version: ${entry.resourceId}`);
      }
      if (
        head.taskId !== entry.taskId ||
        head.abilityMetadata.abilityId !== entry.abilityId ||
        head.abilityMetadata.taskRole !== entry.taskRole
      ) {
        issues.push(`Registry metadata does not match head: ${entry.resourceId}`);
      }
    }
  }

  const resourceIds = new Set(versions.map((version) => version.resourceId));
  for (const resourceId of resourceIds) {
    const currentVersions = versions.filter((version) => (
      version.resourceId === resourceId && version.status === 'frozen'
    ));
    const entry = entries.find((item) => item.resourceId === resourceId);
    if (currentVersions.length !== 1) {
      issues.push(`Resource must have exactly one current frozen version: ${resourceId}`);
    }
    if (!entry || entry.currentFrozenVersionId !== currentVersions[0]?.resourceVersionId) {
      issues.push(`Registry head does not match frozen version history: ${resourceId}`);
    }
  }

  return { passed: issues.length === 0, issues: unique(issues) };
}

export async function rebuildResourceRegistry(
  repository: QuestionResourceAdmissionRepository,
  now = new Date().toISOString(),
): Promise<ResourceRegistryEntry[]> {
  const versions = await repository.listVersions();
  const byResource = new Map<string, FrozenQuestionResourceVersion[]>();
  versions.forEach((version) => {
    const group = byResource.get(version.resourceId) || [];
    group.push(version);
    byResource.set(version.resourceId, group);
  });

  const entries: ResourceRegistryEntry[] = [];
  for (const [resourceId, resourceVersions] of byResource.entries()) {
    const current = resourceVersions
      .filter((version) => version.status === 'frozen')
      .sort((a, b) => b.versionNumber - a.versionNumber)[0];
    if (!current) continue;
    const existing = await repository.getRegistryEntry(resourceId);
    entries.push(buildRegistryEntry(current, existing, now));
  }

  await repository.replaceRegistry(entries);
  return entries.map(clone);
}

function validateIdentity(draft: StructuredQuestionDraft, issues: ResourceValidationIssue[]): void {
  if (!nonEmpty(draft.draftId)) error(issues, 'identity.draft_id', 'draftId', 'draftId is required.');
  if (!nonEmpty(draft.resourceId)) error(issues, 'identity.resource_id', 'resourceId', 'resourceId is required.');
  if (!nonEmpty(draft.taskId)) error(issues, 'identity.task_id', 'taskId', 'taskId is required.');
  if (!Number.isInteger(draft.proposedVersionNumber) || draft.proposedVersionNumber < 1) {
    error(issues, 'identity.version_number', 'proposedVersionNumber', 'Version number must be a positive integer.');
  }
}

function validateContent(draft: StructuredQuestionDraft, issues: ResourceValidationIssue[]): void {
  if (!nonEmpty(draft.title)) error(issues, 'content.title', 'title', 'Title is required.');
  if (!nonEmpty(draft.questionStem)) {
    error(
      issues,
      'content.question_stem',
      getAuthoringValidationPath('questionStem'),
      'Question stem is required.',
    );
  }
  if (!isStructuredQuestionType(draft.questionType)) {
    error(issues, 'content.question_type', 'questionType', 'Question type is not registered.');
  }
  if (!isQuestionResponseFormat(draft.responseFormat)) {
    error(issues, 'content.response_format', 'responseFormat', 'Response format is not registered.');
  }

  const expectedFormats: Record<StructuredQuestionType, QuestionResponseFormat[]> = {
    multiple_choice: ['single_choice'],
    true_false: ['boolean'],
    fill_blank: ['short_text'],
    open_short_answer: ['short_text', 'long_text'],
    reading_comprehension: ['short_text', 'long_text'],
  };
  if (
    isStructuredQuestionType(draft.questionType) &&
    isQuestionResponseFormat(draft.responseFormat) &&
    !expectedFormats[draft.questionType].includes(draft.responseFormat)
  ) {
    error(issues, 'content.response_mismatch', 'responseFormat', 'Response format does not match question type.');
  }

  if (draft.responseFormat === 'single_choice') {
    if (!draft.choiceInteraction && (!draft.options || draft.options.length === 0)) {
      error(
        issues,
        'content.options_required',
        'choiceInteraction.options',
        'Single-choice options are required.',
      );
    }
    const choiceValidation = validateSingleChoiceInteraction(draft.choiceInteraction);
    choiceValidation.issues.forEach((issue) => {
      error(issues, issue.code, issue.field, issue.message);
    });
    if (draft.options && draft.options.length > 0) {
      error(
        issues,
        'choice.legacy_options_not_allowed',
        'options',
        'New single-choice resources must use stable option objects instead of legacy string options.',
      );
    }
    if (draft.assessmentMode !== 'exact_match') {
      error(
        issues,
        'choice.assessment_mode',
        'assessmentMode',
        'Single-choice assessment mode must be exact_match.',
      );
    }
    if (!isSingleChoiceMinimumResponseRequirement(draft.minimumAnswerRequirement)) {
      error(
        issues,
        'choice.minimum_response_requirement',
        'minimumAnswerRequirement',
        'Single-choice requires one structured selection and no text-length requirement.',
      );
    }
  } else if (draft.choiceInteraction !== undefined) {
    error(
      issues,
      'choice.interaction_unused',
      'choiceInteraction',
      'Choice interaction is only valid when responseFormat is single_choice.',
    );
  }
  if (draft.questionType !== 'multiple_choice' && draft.options && draft.options.length > 0) {
    warning(issues, 'content.options_unused', 'options', 'Options are ignored for this question type.');
  }

  const minimum = draft.minimumAnswerRequirement;
  if (
    draft.responseFormat !== 'single_choice' &&
    (!minimum || !Number.isInteger(minimum.minLength) || minimum.minLength < 1)
  ) {
    error(issues, 'content.minimum_answer', 'minimumAnswerRequirement.minLength', 'Minimum answer length must be a positive integer.');
  }
  if (!['manual', 'imported', 'ai_assisted', 'ocr_assisted'].includes(draft.source?.sourceType)) {
    error(issues, 'content.source_type', 'source.sourceType', 'Question source type is not registered.');
  }
  if (!nonEmpty(draft.source?.description)) {
    error(issues, 'content.source_description', 'source.description', 'Question source description is required.');
  }
}

function validateAnswerAcceptance(draft: StructuredQuestionDraft, issues: ResourceValidationIssue[]): void {
  const objective = ['multiple_choice', 'true_false', 'fill_blank'].includes(draft.questionType);
  const acceptedAnswers = normalizedStrings(draft.answerAcceptance?.acceptedAnswers || []);
  const acceptedKeywords = normalizedStrings(draft.answerAcceptance?.acceptedKeywords || []);
  const acceptedOptionIds = normalizedStrings(draft.answerAcceptance?.acceptedOptionIds || []);

  if (objective && draft.responseFormat !== 'single_choice' && acceptedAnswers.length === 0) {
    error(issues, 'answer_acceptance.answers_required', 'answerAcceptance.acceptedAnswers', 'Objective question requires accepted answers.');
  }
  if (draft.responseFormat === 'single_choice') {
    const correctOptionIds = draft.choiceInteraction?.correctOptionIds || [];
    if (
      acceptedOptionIds.length !== 1 ||
      correctOptionIds.length !== 1 ||
      acceptedOptionIds[0] !== correctOptionIds[0]
    ) {
      error(
        issues,
        'answer_acceptance.choice_option_mismatch',
        'answerAcceptance.acceptedOptionIds',
        'Accepted option ID must match the single correct option ID.',
      );
    }
    if (acceptedAnswers.length > 0) {
      error(
        issues,
        'answer_acceptance.choice_legacy_answer',
        'answerAcceptance.acceptedAnswers',
        'Single-choice answer acceptance must use stable option IDs, not display letters or option text.',
      );
    }
  } else if (acceptedOptionIds.length > 0) {
    error(
      issues,
      'answer_acceptance.option_ids_unused',
      'answerAcceptance.acceptedOptionIds',
      'Accepted option IDs are only valid for single-choice responses.',
    );
  }
  if (acceptedAnswers.length !== new Set(acceptedAnswers).size) {
    error(issues, 'answer_acceptance.duplicate_answers', 'answerAcceptance.acceptedAnswers', 'Accepted answers contain duplicates.');
  }
  if (acceptedKeywords.length !== new Set(acceptedKeywords).size) {
    error(issues, 'answer_acceptance.duplicate_keywords', 'answerAcceptance.acceptedKeywords', 'Accepted keywords contain duplicates.');
  }
  if (acceptedOptionIds.length !== new Set(acceptedOptionIds).size) {
    error(issues, 'answer_acceptance.duplicate_option_ids', 'answerAcceptance.acceptedOptionIds', 'Accepted option IDs contain duplicates.');
  }

  const openQuestion = ['open_short_answer', 'reading_comprehension'].includes(draft.questionType);
  if (
    openQuestion &&
    draft.assessmentMode === 'exact_match' &&
    acceptedAnswers.length <= 1 &&
    draft.answerAcceptance?.semanticEquivalentAllowed !== true
  ) {
    error(issues, 'answer_acceptance.open_exact_match', 'answerAcceptance', 'Open response cannot use a single strict answer boundary.');
  }

  if (containsDiagnosisClaim([
    ...acceptedAnswers,
    ...acceptedKeywords,
  ])) {
    error(issues, 'answer_acceptance.diagnosis_claim', 'answerAcceptance', 'Answer acceptance must not contain diagnosis conclusions.');
  }
}

function validateRubric(draft: StructuredQuestionDraft, issues: ResourceValidationIssue[]): void {
  if (!Array.isArray(draft.rubric) || draft.rubric.length === 0) {
    error(issues, 'rubric.required', 'rubric', 'At least one rubric item is required.');
    return;
  }
  const ids = draft.rubric.map((item) => item.itemId.trim()).filter(Boolean);
  if (ids.length !== draft.rubric.length || new Set(ids).size !== ids.length) {
    error(issues, 'rubric.item_id', 'rubric', 'Rubric item IDs must be non-empty and unique.');
  }
  if (!draft.rubric.some((item) => item.abilityId === draft.abilityMetadata.abilityId)) {
    error(issues, 'rubric.main_ability_missing', 'rubric', 'Rubric must observe the target ability.');
  }
  if (!draft.rubric.some((item) => item.importance === 'critical' && item.required)) {
    error(issues, 'rubric.critical_required_missing', 'rubric', 'Rubric requires at least one critical required item.');
  }

  draft.rubric.forEach((item, index) => {
    if (!nonEmpty(item.name)) error(issues, 'rubric.name', `rubric.${index}.name`, 'Rubric item name is required.');
    if (!isPrimaryAbilityId(item.abilityId)) {
      error(issues, 'rubric.ability', `rubric.${index}.abilityId`, 'Rubric abilityId is not registered.');
    }
    if (containsDiagnosisClaim([item.name, item.description || '', ...item.acceptedSignals])) {
      error(issues, 'rubric.diagnosis_claim', `rubric.${index}`, 'Rubric must not contain fixed student diagnosis conclusions.');
    }
    if (draft.responseFormat === 'single_choice' && item.required && (
      item.evidenceRequirement?.requireTextEvidence
      || item.evidenceRequirement?.requireExplanation
      || item.evidenceRequirement?.requireConclusion
    )) {
      error(
        issues,
        'rubric.choice_open_response_not_allowed',
        `rubric.${index}.evidenceRequirement`,
        'Single-choice Rubric cannot require a written explanation, conclusion, or text evidence.',
      );
    }
  });
}

function validateAbilityAndRole(draft: StructuredQuestionDraft, issues: ResourceValidationIssue[]): void {
  const metadata = draft.abilityMetadata;
  if (!isPrimaryAbilityId(metadata?.abilityId)) {
    error(
      issues,
      'ability.main',
      getPlanControlledValidationPath('abilityId'),
      'abilityId is not registered.',
    );
  }
  if (!isQuestionResourceTaskRole(metadata?.taskRole)) {
    error(
      issues,
      'ability.task_role',
      getPlanControlledValidationPath('taskRole'),
      'taskRole is not registered.',
    );
  }
  if (!isQuestionResourceDifficulty(metadata?.difficulty)) {
    error(
      issues,
      'ability.difficulty',
      getPlanControlledValidationPath('difficulty'),
      'difficulty is not registered.',
    );
  }
  for (const [field, values] of [
    ['supportingAbilityIds', metadata?.supportingAbilityIds],
    ['prerequisiteAbilityIds', metadata?.prerequisiteAbilityIds],
  ] as const) {
    if (!Array.isArray(values) || values.some((value) => !isPrimaryAbilityId(value))) {
      error(issues, 'ability.related', `abilityMetadata.${field}`, `${field} contains an unregistered abilityId.`);
    }
  }
}

function validateMaterial(
  draft: StructuredQuestionDraft,
  material: QuestionMaterialVersion | null,
  issues: ResourceValidationIssue[],
): void {
  if (draft.questionType === 'reading_comprehension' && !draft.materialVersionId) {
    error(issues, 'material.required', 'materialVersionId', 'Reading comprehension requires a Material Version.');
  }
  if (draft.materialVersionId && !material) {
    error(issues, 'material.missing', 'materialVersionId', 'Referenced Material Version does not exist.');
  }
  if (!material) return;
  const materialUsage = projectTargetedMaterialUsage(material);
  const targetedMetadata = draft.abilityMetadata.targetedTrainingMetadata;
  if (materialUsage.usageType === 'targeted_excerpt') {
    const validation = validateTargetedTrainingResourceMetadata(
      targetedMetadata,
      material.materialVersionId,
    );
    validation.issues.forEach((issue) => {
      error(issues, issue.code, issue.field, issue.message);
    });
    if (draft.abilityMetadata.taskRole !== 'training') {
      error(issues, 'resource.targeted_task_role', 'abilityMetadata.taskRole', 'Targeted excerpt resources must use the training role.');
    }
    if (
      targetedMetadata
      && !material.targetedExcerptMetadata?.supportedGapReasonCodes.includes(
        targetedMetadata.primaryGapReasonCode,
      )
    ) {
      error(issues, 'resource.primary_gap_out_of_scope', 'abilityMetadata.targetedTrainingMetadata.primaryGapReasonCode', 'Question primary Gap is not supported by its targeted Material.');
    }
    if (
      targetedMetadata
      && !material.targetedExcerptMetadata?.targetAbilityIds.includes(draft.abilityMetadata.abilityId)
    ) {
      error(issues, 'resource.ability_out_of_scope', 'abilityMetadata.abilityId', 'Question Ability is not supported by its targeted Material.');
    }
  } else if (targetedMetadata !== undefined) {
    error(issues, 'resource.core_has_targeted_metadata', 'abilityMetadata.targetedTrainingMetadata', 'Core resources cannot carry targeted training metadata.');
  }
}

function validateVersionLineage(
  draft: StructuredQuestionDraft,
  registry: ResourceRegistryEntry | null,
  issues: ResourceValidationIssue[],
): void {
  if (draft.proposedVersionNumber === 1 && draft.parentVersionId) {
    error(issues, 'version.first_parent', 'parentVersionId', 'Version 1 must not have a parent version.');
  }
  if (draft.proposedVersionNumber > 1) {
    if (!draft.parentVersionId) {
      error(issues, 'version.parent_required', 'parentVersionId', 'New version requires parentVersionId.');
    }
    if (!registry?.currentFrozenVersionId) {
      error(issues, 'version.registry_head_missing', 'parentVersionId', 'New version requires a current registry head.');
    } else if (draft.parentVersionId !== registry.currentFrozenVersionId) {
      error(issues, 'version.stale_parent', 'parentVersionId', 'New version must be based on the current registry head.');
    }
  }
}

async function requireCurrentPassedValidation(
  repository: QuestionResourceAdmissionRepository,
  draft: StructuredQuestionDraft,
): Promise<ResourceValidationResult> {
  if (!draft.latestValidationId) {
    throw createStructuredRuntimeError({
      code: 'VALIDATION_REQUIRED',
      message: '当前题目尚未完成结构化校验。',
      operation: 'question_resource.require_validation',
      objectId: draft.draftId,
      recoverability: 'user_action_required',
    });
  }
  const validation = await repository.getValidation(draft.latestValidationId);
  if (!validation || !validation.passed) {
    throw createStructuredRuntimeError({
      code: 'VALIDATION_FAILED',
      message: '当前题目校验未通过，不能继续审核或冻结。',
      operation: 'question_resource.require_validation',
      objectId: draft.draftId,
      recoverability: 'user_action_required',
    });
  }
  if (validation.validatedDraftRevision !== draft.revision) {
    throw createStructuredRuntimeError({
      code: 'VALIDATION_STALE',
      message: '题目已被修改，原校验结果已失效，请重新校验。',
      operation: 'question_resource.require_validation',
      objectId: draft.draftId,
      recoverability: 'user_action_required',
    });
  }
  return validation;
}

async function requireCurrentApprovedReview(
  repository: QuestionResourceAdmissionRepository,
  draft: StructuredQuestionDraft,
  validationId: string,
): Promise<ResourceReviewDecision> {
  if (!draft.latestReviewId) throw new Error('Draft has not been reviewed.');
  const review = await repository.getReview(draft.latestReviewId);
  if (!review || review.action !== 'approve') throw new Error('Draft review is not approved.');
  if (review.reviewedDraftRevision !== draft.revision || review.validationId !== validationId) {
    throw new Error('Draft review is stale.');
  }
  return review;
}

async function requireDraft(
  repository: QuestionResourceAdmissionRepository,
  draftId: string,
): Promise<StructuredQuestionDraft> {
  const draft = await repository.getDraft(draftId);
  if (!draft) throw new Error(`Draft not found: ${draftId}`);
  return draft;
}

function buildRegistryEntry(
  version: FrozenQuestionResourceVersion,
  existing: ResourceRegistryEntry | null,
  now: string,
): ResourceRegistryEntry {
  return {
    resourceId: version.resourceId,
    currentFrozenVersionId: version.resourceVersionId,
    status: 'active',
    latestReviewId: version.reviewId,
    latestValidationId: version.validationId,
    materialId: version.materialId,
    taskId: version.taskId,
    abilityId: version.abilityMetadata.abilityId,
    taskRole: version.abilityMetadata.taskRole,
    difficulty: version.abilityMetadata.difficulty,
    targetedTrainingMetadata: version.abilityMetadata.targetedTrainingMetadata
      ? clone(version.abilityMetadata.targetedTrainingMetadata)
      : undefined,
    tags: [...version.tags],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
}

function error(issues: ResourceValidationIssue[], code: string, field: string, message: string): void {
  issues.push({ code, field, severity: 'error', message });
}

function warning(issues: ResourceValidationIssue[], code: string, field: string, message: string): void {
  issues.push({ code, field, severity: 'warning', message });
}

function hasErrorFor(issues: ResourceValidationIssue[], fields: string[]): boolean {
  return issues.some((issue) => issue.severity === 'error' && fields.includes(issue.field));
}

function hasErrorPrefix(issues: ResourceValidationIssue[], prefixes: string[]): boolean {
  return issues.some((issue) => (
    issue.severity === 'error' && prefixes.some((prefix) => issue.field.startsWith(prefix))
  ));
}

function normalizedStrings(values: string[]): string[] {
  return values.map((value) => value.trim().toLocaleLowerCase()).filter(Boolean);
}

function containsDiagnosisClaim(values: string[]): boolean {
  const pattern = /(能力.{0,4}(薄弱|较差|不足|已掌握|已提升)|root\s*cause|长期能力|学生一定)/i;
  return values.some((value) => pattern.test(value));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeMaterialMetadata(
  metadata: QuestionMaterialMetadata,
): QuestionMaterialMetadata {
  return {
    ...(metadata.author?.trim() ? { author: metadata.author.trim() } : {}),
    ...(metadata.translator?.trim() ? { translator: metadata.translator.trim() } : {}),
    ...(metadata.genre ? { genre: metadata.genre } : {}),
    ...(metadata.gradeRange?.trim() ? { gradeRange: metadata.gradeRange.trim() } : {}),
    ...(metadata.curriculumUnit?.trim()
      ? { curriculumUnit: metadata.curriculumUnit.trim() }
      : {}),
    ...(metadata.edition?.trim() ? { edition: metadata.edition.trim() } : {}),
    tags: unique(metadata.tags.map((tag) => tag.trim()).filter(Boolean)).sort(),
    provenanceStatus: metadata.provenanceStatus,
    ...(metadata.provenanceReview ? {
      provenanceReview: {
        textVerificationStatus: metadata.provenanceReview.textVerificationStatus,
        rightsStatus: metadata.provenanceReview.rightsStatus,
        ...(metadata.provenanceReview.sourceLocator?.trim()
          ? { sourceLocator: metadata.provenanceReview.sourceLocator.trim() }
          : {}),
        ...(metadata.provenanceReview.textSourceLocator?.trim()
          ? { textSourceLocator: metadata.provenanceReview.textSourceLocator.trim() }
          : {}),
        ...(metadata.provenanceReview.rightsEvidenceLocator?.trim()
          ? { rightsEvidenceLocator: metadata.provenanceReview.rightsEvidenceLocator.trim() }
          : {}),
        ...(metadata.provenanceReview.verifiedBy?.trim()
          ? { verifiedBy: metadata.provenanceReview.verifiedBy.trim() }
          : {}),
        ...(metadata.provenanceReview.verifiedAt?.trim()
          ? { verifiedAt: metadata.provenanceReview.verifiedAt.trim() }
          : {}),
        ...(metadata.provenanceReview.notes?.trim()
          ? { notes: metadata.provenanceReview.notes.trim() }
          : {}),
      },
    } : {}),
  };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function clone<T>(value: T): T {
  return cloneQuestionResourceValue(value);
}

function isDraftPatchUnchanged(
  draft: StructuredQuestionDraft,
  patch: StructuredQuestionDraftPatch,
): boolean {
  return Object.entries(patch).every(([key, value]) => (
    JSON.stringify(draft[key as keyof StructuredQuestionDraft]) ===
    JSON.stringify(value)
  ));
}

export const QUESTION_RESOURCE_PRIMARY_ABILITY_IDS = PRIMARY_ABILITY_IDS;
export type { QuestionResourceDifficulty };
