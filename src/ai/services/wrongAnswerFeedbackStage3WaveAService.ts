import { createHash } from 'node:crypto';
import {
  createNextQuestionResourceVersionDraft,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  updateStructuredQuestionDraft,
  validateStructuredQuestionDraft,
} from '../agents/questionResourceAdmissionAgent.ts';
import { createQualityArtifacts } from '../agents/materialCorpusOptimizationAgent.ts';
import { deriveResourceObservationLink } from '../agents/materialObservationAgent.ts';
import { InMemoryQuestionResourceAdmissionRepository } from
  '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  RUBRIC_FEEDBACK_ACTION_CONTRACT_SCHEMA_VERSION,
  cloneQuestionResourceValue,
  isRubricFeedbackActionContract,
  type FrozenQuestionResourceVersion,
  type QuestionResourceRubricItem,
  type StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  cloneSharedFormalResourceValue,
  type SharedFormalResourceData,
} from '../schemas/sharedFormalResourcePersistence.schema.ts';

export const WRONG_ANSWER_STAGE3_WAVE_A_RESOURCE_ID =
  'resource-observation-task-plan-1q9udud' as const;
export const WRONG_ANSWER_STAGE3_WAVE_A_SOURCE_VERSION_ID =
  'resource-observation-task-plan-1q9udud:v1' as const;
export const WRONG_ANSWER_STAGE3_WAVE_A_MATERIAL_VERSION_ID =
  'targeted-v3-requirement-3:v1' as const;
export const WRONG_ANSWER_STAGE3_WAVE_A_RUBRIC_ITEM_ID = 'primary-action' as const;
export const WRONG_ANSWER_STAGE3_WAVE_A_COMMAND_ID =
  'wrong-answer-feedback-stage3-wave-a-2026-09-10-v1' as const;

export type WrongAnswerStage3WaveAReport = {
  alreadyApplied: boolean;
  sourceResourceVersionId: string;
  successorResourceVersionId: string;
  successorDraftId: string;
  validationId: string;
  reviewId: string;
  qualityTraceId: string;
  previousResourceContentDigest: string;
  successorResourceContentDigest: string;
  activeResourceObservationLinkId: string;
};

export async function prepareWrongAnswerFeedbackStage3WaveA(
  source: SharedFormalResourceData,
  now: string,
): Promise<{ data: SharedFormalResourceData; report: WrongAnswerStage3WaveAReport }> {
  const data = cloneSharedFormalResourceValue(source);
  const registryIndex = data.questionResources.registryEntries.findIndex((entry) => (
    entry.resourceId === WRONG_ANSWER_STAGE3_WAVE_A_RESOURCE_ID && entry.status === 'active'
  ));
  if (registryIndex < 0) throw new Error('Stage 3 Wave A Registry entry is missing.');
  const sourceRegistry = data.questionResources.registryEntries[registryIndex]!;
  const currentVersion = requireVersion(data, sourceRegistry.currentFrozenVersionId);
  const material = data.questionResources.materials.find((item) => (
    item.materialVersionId === WRONG_ANSWER_STAGE3_WAVE_A_MATERIAL_VERSION_ID
  ));
  assertEligibleMaterial(material);

  if (isAppliedSuccessor(currentVersion)) {
    const trace = data.questionQuality.frozenQualityTraces.find((item) => (
      item.resourceVersionId === currentVersion.resourceVersionId
    ));
    const activeLink = data.materialObservations.links.find((item) => (
      item.status === 'active' && item.resourceVersionId === currentVersion.resourceVersionId
    ));
    if (!trace || !activeLink) throw new Error('Stage 3 Wave A is only partially applied.');
    return {
      data,
      report: reportFromVersion(data, currentVersion, trace.traceId, activeLink.resourceObservationLinkId, true),
    };
  }
  if (currentVersion.resourceVersionId !== WRONG_ANSWER_STAGE3_WAVE_A_SOURCE_VERSION_ID) {
    throw new Error(`Stage 3 Wave A source is stale: ${currentVersion.resourceVersionId}`);
  }

  const sourceDraft = data.questionResources.drafts.find((item) => (
    item.draftId === currentVersion.sourceDraftId
  ));
  if (!sourceDraft) throw new Error(`Stage 3 Wave A source draft is missing: ${currentVersion.sourceDraftId}`);
  const sourceValidation = data.questionResources.validations.find((item) => (
    item.validationId === currentVersion.validationId
  ));
  const sourceReview = data.questionResources.reviews.find((item) => (
    item.reviewId === currentVersion.reviewId
  ));
  if (!sourceValidation?.passed || sourceReview?.action !== 'approve') {
    throw new Error('Stage 3 Wave A source validation or review is not admissible.');
  }

  const repository = new InMemoryQuestionResourceAdmissionRepository();
  await repository.saveMaterial(material!);
  await repository.saveDraft(sourceDraft);
  await repository.saveValidation(sourceValidation);
  await repository.saveReview(sourceReview);
  await repository.commitFreeze({
    version: currentVersion,
    registryEntry: sourceRegistry,
  });

  const draftId = `${WRONG_ANSWER_STAGE3_WAVE_A_RESOURCE_ID}:stage3-wave-a:draft`;
  const generated = await createNextQuestionResourceVersionDraft(repository, {
    resourceId: WRONG_ANSWER_STAGE3_WAVE_A_RESOURCE_ID,
    draftId,
    now,
  });
  const targetIndex = generated.rubric.findIndex((item) => (
    item.itemId === WRONG_ANSWER_STAGE3_WAVE_A_RUBRIC_ITEM_ID
  ));
  if (targetIndex < 0) throw new Error('Stage 3 Wave A target Rubric item is missing.');
  const rubric = cloneQuestionResourceValue(generated.rubric);
  rubric[targetIndex] = {
    ...rubric[targetIndex]!,
    feedbackActionContract: {
      schemaVersion: RUBRIC_FEEDBACK_ACTION_CONTRACT_SCHEMA_VERSION,
      actionCode: 'add_required_dimension',
      disclosurePolicy: 'operation_only',
    },
  };
  const updated = await updateStructuredQuestionDraft(repository, draftId, { rubric }, now);
  assertOnlyActionContractChanged(currentVersion, updated);

  const validation = await validateStructuredQuestionDraft(
    repository,
    draftId,
    now,
    updated.revision,
  );
  if (!validation.passed) {
    throw new Error(`Stage 3 Wave A validation failed: ${validation.issues.map((item) => item.code).join(',')}`);
  }
  await submitQuestionResourceForReview(
    repository,
    draftId,
    now,
    [],
    'stage3-wave-a-content-operator',
  );
  const review = await reviewQuestionResourceDraft(repository, {
    draftId,
    action: 'approve',
    reviewerId: 'product-owner-authorized-stage3-wave-a',
    notes: '仅批准 primary-action 的 operation-only add_required_dimension 契约；题干、答案边界、评分信号与学生可见边界保持不变。',
    now,
  });
  const frozen = await freezeQuestionResourceDraft(repository, draftId, now);
  if (frozen.version.resourceVersionId === currentVersion.resourceVersionId) {
    throw new Error('Stage 3 Wave A version service reused the source identity.');
  }

  const finalDraft = await requireDraft(repository, draftId);
  const anchor = data.materialObservations.anchors.find((item) => (
    item.materialVersionId === material!.materialVersionId && item.anchorType === 'full_text'
  ));
  const peerDrafts = currentMaterialDrafts(data, material!.materialVersionId)
    .filter((item) => item.resourceId !== currentVersion.resourceId);
  const quality = createQualityArtifacts({
    draft: finalDraft,
    validation,
    material: material!,
    materialAnchor: anchor,
    peerDrafts,
    review,
    version: frozen.version,
    now,
  });
  const finalReview = {
    ...review,
    qualityAssessmentBundleId: quality.bundle.bundleId,
    deterministicAssessmentId: quality.deterministic.assessmentId,
    semanticAssessmentId: quality.semantic.semanticAssessmentId,
    qualityMergeRuleVersion: quality.bundle.mergeRuleVersion,
    warningDecisions: quality.deterministic.warnings.map((warning) => ({
      warningDecisionId: `${draftId}:${warning.code}:accepted`,
      draftId,
      draftRevision: finalDraft.revision,
      assessmentId: quality.deterministic.assessmentId,
      warningCode: warning.code,
      decision: 'accepted' as const,
      reviewedBy: 'product-owner-authorized-stage3-wave-a',
      reviewedAt: now,
    })),
  };

  const sourceVersionIndex = data.questionResources.versions.findIndex((item) => (
    item.resourceVersionId === currentVersion.resourceVersionId
  ));
  const repositorySource = await repository.getVersion(currentVersion.resourceVersionId);
  if (!repositorySource || repositorySource.status !== 'superseded') {
    throw new Error('Stage 3 Wave A version service did not preserve the predecessor lineage.');
  }
  data.questionResources.versions[sourceVersionIndex] = repositorySource;
  data.questionResources.drafts.push(finalDraft);
  data.questionResources.validations.push(validation);
  data.questionResources.reviews.push(finalReview);
  data.questionResources.versions.push(frozen.version);
  data.questionResources.registryEntries[registryIndex] = frozen.registryEntry;
  data.questionQuality.deterministicAssessments.push(quality.deterministic);
  data.questionQuality.semanticAssessments.push(quality.semantic);
  data.questionQuality.assessmentBundles.push(quality.bundle);
  data.questionQuality.frozenQualityTraces.push(quality.trace);

  const oldLinkIndex = data.materialObservations.links.findIndex((item) => (
    item.status === 'active'
    && item.resourceId === currentVersion.resourceId
    && item.resourceVersionId === currentVersion.resourceVersionId
  ));
  if (oldLinkIndex < 0) throw new Error('Stage 3 Wave A active source link is missing.');
  const oldLink = data.materialObservations.links[oldLinkIndex]!;
  const plan = data.materialObservations.plans.find((item) => (
    item.materialObservationPlanId === oldLink.materialObservationPlanId
  ));
  const task = plan?.taskPlans.find((item) => (
    item.observationTaskPlanId === oldLink.observationTaskPlanId
  ));
  if (!plan || !task) throw new Error('Stage 3 Wave A observation binding is missing.');
  const derived = deriveResourceObservationLink({
    plan,
    task,
    version: frozen.version,
    registryEntry: frozen.registryEntry,
    validation,
    review: finalReview,
    linkedAt: now,
  });
  if (derived.issues.length > 0) {
    throw new Error(`Stage 3 Wave A successor link is invalid: ${derived.issues.join(',')}`);
  }
  data.materialObservations.links[oldLinkIndex] = { ...oldLink, status: 'superseded' };
  data.materialObservations.links.push(derived.link);

  return {
    data,
    report: reportFromVersion(
      data,
      frozen.version,
      quality.trace.traceId,
      derived.link.resourceObservationLinkId,
      false,
    ),
  };
}

function assertEligibleMaterial(
  material: SharedFormalResourceData['questionResources']['materials'][number] | undefined,
): void {
  if (!material || material.status === 'retired') throw new Error('Stage 3 Wave A material is not active.');
  if (material.metadata?.provenanceStatus !== 'verified') {
    throw new Error('Stage 3 Wave A material provenance is not verified.');
  }
  if (material.usageType !== 'targeted_excerpt') {
    throw new Error('Stage 3 Wave A material is not a targeted excerpt.');
  }
  if (material.targetedExcerptMetadata?.sourceRelation !== 'controlled_original') {
    throw new Error('Stage 3 Wave A material is not controlled original.');
  }
  if (!material.targetedExcerptMetadata.supportedGapReasonCodes.includes('incomplete_task_requirement')) {
    throw new Error('Stage 3 Wave A material does not support incomplete_task_requirement.');
  }
}

function isAppliedSuccessor(version: FrozenQuestionResourceVersion): boolean {
  const target = version.rubric.find((item) => item.itemId === WRONG_ANSWER_STAGE3_WAVE_A_RUBRIC_ITEM_ID);
  return version.parentVersionId === WRONG_ANSWER_STAGE3_WAVE_A_SOURCE_VERSION_ID
    && target?.feedbackActionContract?.actionCode === 'add_required_dimension'
    && isRubricFeedbackActionContract(target.feedbackActionContract);
}

function assertOnlyActionContractChanged(
  source: FrozenQuestionResourceVersion,
  successorDraft: StructuredQuestionDraft,
): void {
  const sourceContent = comparableEducationalContent(source);
  const successorContent = comparableEducationalContent(successorDraft);
  const sourceRubric = sourceContent.rubric as QuestionResourceRubricItem[];
  const successorRubric = successorContent.rubric as QuestionResourceRubricItem[];
  const sourceTarget = sourceRubric.find((item) => item.itemId === WRONG_ANSWER_STAGE3_WAVE_A_RUBRIC_ITEM_ID);
  const successorTarget = successorRubric.find((item) => item.itemId === WRONG_ANSWER_STAGE3_WAVE_A_RUBRIC_ITEM_ID);
  if (!sourceTarget || !successorTarget) throw new Error('Stage 3 Wave A Rubric target is missing.');
  delete successorTarget.feedbackActionContract;
  if (JSON.stringify(sourceContent) !== JSON.stringify(successorContent)) {
    throw new Error('Stage 3 Wave A changed fields outside feedbackActionContract.');
  }
}

function comparableEducationalContent(value: FrozenQuestionResourceVersion | StructuredQuestionDraft) {
  return cloneQuestionResourceValue({
    materialVersionId: value.materialVersionId,
    progressionMetadata: value.progressionMetadata,
    taskId: value.taskId,
    title: value.title,
    questionStem: value.questionStem,
    questionType: value.questionType,
    responseFormat: value.responseFormat,
    options: value.options,
    choiceInteraction: value.choiceInteraction,
    assessmentMode: value.assessmentMode,
    answerAcceptance: value.answerAcceptance,
    rubric: value.rubric,
    minimumAnswerRequirement: value.minimumAnswerRequirement,
    abilityMetadata: value.abilityMetadata,
    source: value.source,
    tags: value.tags,
  });
}

function reportFromVersion(
  data: SharedFormalResourceData,
  successor: FrozenQuestionResourceVersion,
  qualityTraceId: string,
  activeResourceObservationLinkId: string,
  alreadyApplied: boolean,
): WrongAnswerStage3WaveAReport {
  const source = requireVersion(data, WRONG_ANSWER_STAGE3_WAVE_A_SOURCE_VERSION_ID);
  return {
    alreadyApplied,
    sourceResourceVersionId: source.resourceVersionId,
    successorResourceVersionId: successor.resourceVersionId,
    successorDraftId: successor.sourceDraftId,
    validationId: successor.validationId,
    reviewId: successor.reviewId,
    qualityTraceId,
    previousResourceContentDigest: digest(comparableEducationalContent(source)),
    successorResourceContentDigest: digest(comparableEducationalContent(successor)),
    activeResourceObservationLinkId,
  };
}

function currentMaterialDrafts(data: SharedFormalResourceData, materialVersionId: string) {
  return data.questionResources.registryEntries
    .filter((entry) => entry.status === 'active' && entry.currentFrozenVersionId)
    .map((entry) => requireVersion(data, entry.currentFrozenVersionId))
    .filter((version) => version.materialVersionId === materialVersionId)
    .map((version) => data.questionResources.drafts.find((draft) => draft.draftId === version.sourceDraftId))
    .filter((draft): draft is StructuredQuestionDraft => Boolean(draft));
}

function requireVersion(data: SharedFormalResourceData, resourceVersionId?: string) {
  if (!resourceVersionId) throw new Error('Stage 3 Wave A current version identity is missing.');
  const version = data.questionResources.versions.find((item) => (
    item.resourceVersionId === resourceVersionId
  ));
  if (!version) throw new Error(`Stage 3 Wave A version is missing: ${resourceVersionId}`);
  return version;
}

async function requireDraft(
  repository: InMemoryQuestionResourceAdmissionRepository,
  draftId: string,
): Promise<StructuredQuestionDraft> {
  const draft = await repository.getDraft(draftId);
  if (!draft) throw new Error(`Stage 3 Wave A draft is missing: ${draftId}`);
  return draft;
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}
