import type { QuestionResourceAdmissionRepository } from '../repositories/questionResourceAdmissionRepository.ts';
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
  type FrozenQuestionResourceVersion,
  type QuestionAbilityMetadata,
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

export type CreateQuestionMaterialInput = Omit<
  QuestionMaterialVersion,
  'schemaVersion' | 'createdAt' | 'updatedAt'
> & {
  createdAt?: string;
  updatedAt?: string;
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
  | 'assessmentMode'
  | 'answerAcceptance'
  | 'rubric'
  | 'minimumAnswerRequirement'
  | 'abilityMetadata'
  | 'source'
  | 'tags'
>>;

export async function createQuestionMaterial(
  repository: QuestionResourceAdmissionRepository,
  input: CreateQuestionMaterialInput,
): Promise<QuestionMaterialVersion> {
  const now = input.updatedAt || input.createdAt || new Date().toISOString();
  const material: QuestionMaterialVersion = {
    materialId: input.materialId,
    materialVersionId: input.materialVersionId,
    versionNumber: input.versionNumber,
    title: input.title.trim(),
    content: input.content.trim(),
    source: clone(input.source),
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

  return repository.saveMaterial(material);
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
    draft.status !== 'rejected'
  ));
  if (activeSibling) {
    throw new Error(`An active revision draft already exists: ${activeSibling.draftId}`);
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
    assessmentMode: source.assessmentMode,
    answerAcceptance: source.answerAcceptance,
    rubric: source.rubric,
    minimumAnswerRequirement: source.minimumAnswerRequirement,
    abilityMetadata: source.abilityMetadata,
    source: source.source,
    tags: source.tags,
    now: input.now,
  });
}

export async function updateStructuredQuestionDraft(
  repository: QuestionResourceAdmissionRepository,
  draftId: string,
  patch: StructuredQuestionDraftPatch,
  now = new Date().toISOString(),
): Promise<StructuredQuestionDraft> {
  const draft = await requireDraft(repository, draftId);
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
): Promise<ResourceValidationResult> {
  const draft = await requireDraft(repository, draftId);
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
    contentValid: !hasErrorPrefix(issues, ['title', 'questionStem', 'questionType', 'responseFormat', 'options', 'minimumAnswerRequirement']),
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
): Promise<StructuredQuestionDraft> {
  const draft = await requireDraft(repository, draftId);
  if (!['drafted', 'validation_failed'].includes(draft.status)) {
    throw new Error(`Draft cannot be submitted for review from status: ${draft.status}`);
  }
  const validation = await requireCurrentPassedValidation(repository, draft);

  return repository.saveDraft({
    ...draft,
    status: 'pending_review',
    latestValidationId: validation.validationId,
    latestReviewId: undefined,
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
    now?: string;
  },
): Promise<ResourceReviewDecision> {
  const draft = await requireDraft(repository, input.draftId);
  const reviewId = `${draft.draftId}:review:r${draft.revision}`;
  const existing = await repository.getReview(reviewId);
  if (existing) return existing;

  if (draft.status !== 'pending_review') {
    throw new Error(`Draft cannot be reviewed from status: ${draft.status}`);
  }
  if (!nonEmpty(input.reviewerId)) throw new Error('reviewerId is required.');
  if (!nonEmpty(input.notes)) throw new Error('Review notes are required.');
  const validation = await requireCurrentPassedValidation(repository, draft);
  const now = input.now || new Date().toISOString();
  const decision: ResourceReviewDecision = {
    reviewId,
    draftId: draft.draftId,
    resourceId: draft.resourceId,
    reviewedDraftRevision: draft.revision,
    validationId: validation.validationId,
    action: input.action,
    reviewerId: input.reviewerId,
    notes: input.notes.trim(),
    reviewedAt: now,
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
    updatedAt: now,
  });

  return clone(decision);
}

export async function freezeQuestionResourceDraft(
  repository: QuestionResourceAdmissionRepository,
  draftId: string,
  now = new Date().toISOString(),
): Promise<ResourceFreezeResult> {
  const existing = await repository.getVersionByDraftId(draftId);
  if (existing) {
    const registryEntry = await repository.getRegistryEntry(existing.resourceId);
    if (!registryEntry) throw new Error('Frozen version exists without ResourceRegistry entry.');
    return { version: existing, registryEntry, inserted: false };
  }

  const commit = await prepareQuestionResourceFreezeCommit(
    repository,
    draftId,
    now,
  );
  return repository.commitFreeze(commit);
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
    assessmentMode: draft.assessmentMode,
    answerAcceptance: draft.answerAcceptance ? clone(draft.answerAcceptance) : undefined,
    rubric: clone(draft.rubric),
    minimumAnswerRequirement: clone(draft.minimumAnswerRequirement),
    abilityMetadata: clone(draft.abilityMetadata),
    source: clone(draft.source),
    tags: [...draft.tags],
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
  if (!nonEmpty(draft.questionStem)) error(issues, 'content.question_stem', 'questionStem', 'Question stem is required.');
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

  if (draft.questionType === 'multiple_choice') {
    const normalizedOptions = (draft.options || []).map((item) => item.trim()).filter(Boolean);
    if (normalizedOptions.length < 2 || new Set(normalizedOptions).size !== normalizedOptions.length) {
      error(issues, 'content.options_required', 'options', 'Multiple choice requires at least two unique options.');
    }
  }
  if (draft.questionType !== 'multiple_choice' && draft.options && draft.options.length > 0) {
    warning(issues, 'content.options_unused', 'options', 'Options are ignored for this question type.');
  }

  const minimum = draft.minimumAnswerRequirement;
  if (!minimum || !Number.isInteger(minimum.minLength) || minimum.minLength < 1) {
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

  if (objective && acceptedAnswers.length === 0) {
    error(issues, 'answer_acceptance.answers_required', 'answerAcceptance.acceptedAnswers', 'Objective question requires accepted answers.');
  }
  if (acceptedAnswers.length !== new Set(acceptedAnswers).size) {
    error(issues, 'answer_acceptance.duplicate_answers', 'answerAcceptance.acceptedAnswers', 'Accepted answers contain duplicates.');
  }
  if (acceptedKeywords.length !== new Set(acceptedKeywords).size) {
    error(issues, 'answer_acceptance.duplicate_keywords', 'answerAcceptance.acceptedKeywords', 'Accepted keywords contain duplicates.');
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
  });
}

function validateAbilityAndRole(draft: StructuredQuestionDraft, issues: ResourceValidationIssue[]): void {
  const metadata = draft.abilityMetadata;
  if (!isPrimaryAbilityId(metadata?.abilityId)) {
    error(issues, 'ability.main', 'abilityMetadata.abilityId', 'abilityId is not registered.');
  }
  if (!isQuestionResourceTaskRole(metadata?.taskRole)) {
    error(issues, 'ability.task_role', 'abilityMetadata.taskRole', 'taskRole is not registered.');
  }
  if (!isQuestionResourceDifficulty(metadata?.difficulty)) {
    error(issues, 'ability.difficulty', 'abilityMetadata.difficulty', 'difficulty is not registered.');
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
  if (!draft.latestValidationId) throw new Error('Draft has not been validated.');
  const validation = await repository.getValidation(draft.latestValidationId);
  if (!validation || !validation.passed) throw new Error('Draft validation has not passed.');
  if (validation.validatedDraftRevision !== draft.revision) {
    throw new Error('Draft validation is stale.');
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

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function clone<T>(value: T): T {
  return cloneQuestionResourceValue(value);
}

export const QUESTION_RESOURCE_PRIMARY_ABILITY_IDS = PRIMARY_ABILITY_IDS;
export type { QuestionResourceDifficulty };
