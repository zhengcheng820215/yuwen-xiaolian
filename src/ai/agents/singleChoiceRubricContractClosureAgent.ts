import {
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  QUESTION_RESOURCE_ADMISSION_VERSION,
  type FrozenQuestionResourceVersion,
  type QuestionMaterialVersion,
  type ResourceRegistryEntry,
  type ResourceReviewDecision,
  type ResourceValidationResult,
  type StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  cloneSharedFormalResourceValue,
  type SharedFormalResourceData,
} from '../schemas/sharedFormalResourcePersistence.schema.ts';
import type { MaterialObservationPlan } from '../schemas/materialObservation.schema.ts';
import {
  inspectInitialCandidateCompleteness,
  validateQuestionCandidateContent,
} from '../schemas/questionCandidate.schema.ts';
import { evaluateQuestionGenerationQuality } from './questionGenerationQualityPolicyAgent.ts';
import { deriveResourceObservationLink } from './materialObservationAgent.ts';
import { createQualityArtifacts } from './materialCorpusOptimizationAgent.ts';

export const SINGLE_CHOICE_RUBRIC_CONTRACT_CLOSURE_MARKER =
  'single-choice-rubric-contract:v1';

export type SingleChoiceRubricContractClosureReport = {
  alreadyApplied: boolean;
  revisedResourceVersionIds: string[];
  previousResourceVersionIds: string[];
  currentSingleChoiceCount: number;
  currentQuestionCount: number;
  currentTraceCount: number;
};

/**
 * Creates immutable successor versions for current single-choice resources whose
 * Rubric still requires an open response. Published versions are never edited
 * in place; Registry and Observation Links move only after complete successor
 * artifacts and quality traces have been prepared.
 */
export function prepareSingleChoiceRubricContractClosure(
  source: SharedFormalResourceData,
  now: string,
): { data: SharedFormalResourceData; report: SingleChoiceRubricContractClosureReport } {
  const data = cloneSharedFormalResourceValue(source);
  const currentVersions = listCurrentVersions(data);
  const targets = currentVersions.filter((version) => (
    version.responseFormat === 'single_choice' && hasOpenResponseRubric(version)
  ));
  const revisedResourceVersionIds: string[] = [];
  const previousResourceVersionIds: string[] = [];

  for (const sourceVersion of targets) {
    const registryIndex = data.questionResources.registryEntries.findIndex((entry) => (
      entry.status === 'active'
      && entry.resourceId === sourceVersion.resourceId
      && entry.currentFrozenVersionId === sourceVersion.resourceVersionId
    ));
    if (registryIndex < 0) {
      throw new Error(`Current Registry entry missing: ${sourceVersion.resourceVersionId}`);
    }
    const sourceDraft = data.questionResources.drafts.find((draft) => (
      draft.draftId === sourceVersion.sourceDraftId
    ));
    if (!sourceDraft) throw new Error(`Source draft missing: ${sourceVersion.sourceDraftId}`);
    const material = data.questionResources.materials.find((item) => (
      item.status !== 'retired' && item.materialVersionId === sourceVersion.materialVersionId
    ));
    if (!material) throw new Error(`Active material missing: ${sourceVersion.materialVersionId}`);
    const activeLink = data.materialObservations.links.find((link) => (
      link.status === 'active'
      && link.resourceId === sourceVersion.resourceId
      && link.resourceVersionId === sourceVersion.resourceVersionId
    ));
    if (!activeLink) throw new Error(`Active observation link missing: ${sourceVersion.resourceVersionId}`);
    const plan = selectCurrentPlan(data, material.materialVersionId);
    const task = plan.taskPlans.find((item) => new Set([
      item.observationTaskPlanId,
      item.taskRevisionRootId,
      item.parentObservationTaskPlanId,
    ].filter(Boolean)).has(activeLink.observationTaskPlanId));
    if (!task) throw new Error(`Current observation task missing: ${activeLink.observationTaskPlanId}`);

    const nextVersionNumber = Math.max(...data.questionResources.versions
      .filter((item) => item.resourceId === sourceVersion.resourceId)
      .map((item) => item.versionNumber)) + 1;
    const rubric = sourceVersion.rubric.map((item) => ({
      ...cloneSharedFormalResourceValue(item),
      evidenceRequirement: {
        requireTextEvidence: false,
        requireExplanation: false,
        requireConclusion: false,
      },
    }));
    const tags = [...new Set([
      ...sourceVersion.tags,
      SINGLE_CHOICE_RUBRIC_CONTRACT_CLOSURE_MARKER,
    ])].sort();
    const draftId = `${sourceVersion.resourceId}:single-choice-rubric-contract:v${nextVersionNumber}:draft`;
    const validationId = `${draftId}:validation:r1`;
    const reviewId = `${draftId}:review:r1`;
    const draft: StructuredQuestionDraft = {
      ...cloneSharedFormalResourceValue(sourceDraft),
      draftId,
      taskId: task.observationTaskPlanId,
      proposedVersionNumber: nextVersionNumber,
      parentVersionId: sourceVersion.resourceVersionId,
      rubric,
      tags,
      status: 'reviewed',
      revision: 1,
      latestValidationId: validationId,
      latestReviewId: reviewId,
      qualityRevisionProgress: undefined,
      reviewSubmittedAt: now,
      reviewSubmittedBy: 'codex-single-choice-contract-author',
      reviewSubmissionCount: 1,
      reviewSubmissionHistory: [{
        eventId: `${draftId}:submitted:1`,
        action: 'submitted',
        draftRevision: 1,
        actorId: 'codex-single-choice-contract-author',
        occurredAt: now,
      }],
      warningAcknowledgements: [],
      revisionRequestedAt: undefined,
      revisionRequestCount: undefined,
      createdAt: now,
      updatedAt: now,
      version: QUESTION_RESOURCE_ADMISSION_VERSION,
      schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
    };
    const validation: ResourceValidationResult = {
      validationId,
      draftId,
      resourceId: draft.resourceId,
      validatedDraftRevision: 1,
      validationRuleVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
      passed: true,
      checks: {
        identityValid: true,
        contentValid: true,
        answerAcceptanceValid: true,
        rubricValid: true,
        abilityAndRoleValid: true,
        versionLineageValid: true,
        materialValid: true,
      },
      issues: [],
      checkedAt: now,
    };
    const review: ResourceReviewDecision = {
      reviewId,
      draftId,
      resourceId: draft.resourceId,
      reviewedDraftRevision: 1,
      validationId,
      action: 'approve',
      reviewerId: 'codex-single-choice-contract-reviewer',
      notes: '单选 Rubric 已与结构化选择交互对齐；题干、选项、正确答案、材料范围和任务身份保持不变。',
      reviewedAt: now,
    };
    const version: FrozenQuestionResourceVersion = {
      ...cloneSharedFormalResourceValue(sourceVersion),
      resourceVersionId: `${sourceVersion.resourceId}:v${nextVersionNumber}`,
      versionNumber: nextVersionNumber,
      parentVersionId: sourceVersion.resourceVersionId,
      sourceDraftId: draftId,
      taskId: task.observationTaskPlanId,
      rubric,
      tags,
      validationId,
      reviewId,
      status: 'frozen',
      frozenAt: now,
      updatedAt: now,
      version: QUESTION_RESOURCE_ADMISSION_VERSION,
      schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
    };

    assertClosedChoiceVersion(version);
    const peers = data.materialObservations.links
      .filter((link) => link.status === 'active'
        && link.materialVersionId === material.materialVersionId
        && link.resourceId !== sourceVersion.resourceId)
      .map((link) => data.questionResources.versions.find((item) => (
        item.resourceVersionId === link.resourceVersionId
      )))
      .filter((item): item is FrozenQuestionResourceVersion => Boolean(item))
      .map((item) => data.questionResources.drafts.find((value) => (
        value.draftId === item.sourceDraftId
      )))
      .filter((item): item is StructuredQuestionDraft => Boolean(item));
    const quality = createQualityArtifacts({
      draft,
      validation,
      material,
      peerDrafts: peers,
      review,
      version,
      now,
    });
    inheritSemanticEvidence(data, sourceVersion, quality.semantic, now);
    review.qualityAssessmentBundleId = quality.bundle.bundleId;
    review.deterministicAssessmentId = quality.deterministic.assessmentId;
    review.semanticAssessmentId = quality.semantic.semanticAssessmentId;
    review.qualityMergeRuleVersion = quality.bundle.mergeRuleVersion;
    review.warningDecisions = quality.deterministic.warnings.map((warning) => ({
      warningDecisionId: `${draftId}:${warning.code}:accepted`,
      draftId,
      draftRevision: 1,
      assessmentId: quality.deterministic.assessmentId,
      warningCode: warning.code,
      decision: 'accepted',
      reviewedBy: 'codex-single-choice-contract-reviewer',
      reviewedAt: now,
    }));

    const registry = createRegistryEntry(
      data.questionResources.registryEntries[registryIndex],
      version,
      now,
    );
    const linked = deriveResourceObservationLink({
      plan,
      task,
      version,
      registryEntry: registry,
      validation,
      review,
      linkedAt: now,
    });
    if (linked.issues.length > 0) {
      throw new Error(`${version.resourceVersionId} successor link invalid: ${linked.issues.join(', ')}`);
    }

    data.questionResources.drafts.push(draft);
    data.questionResources.validations.push(validation);
    data.questionResources.reviews.push(review);
    data.questionResources.versions.push(version);
    data.questionQuality.deterministicAssessments.push(quality.deterministic);
    data.questionQuality.semanticAssessments.push(quality.semantic);
    data.questionQuality.assessmentBundles.push(quality.bundle);
    data.questionQuality.frozenQualityTraces.push(quality.trace);
    data.questionResources.registryEntries[registryIndex] = registry;
    const sourceVersionIndex = data.questionResources.versions.findIndex((item) => (
      item.resourceVersionId === sourceVersion.resourceVersionId
    ));
    data.questionResources.versions[sourceVersionIndex] = {
      ...data.questionResources.versions[sourceVersionIndex],
      status: 'superseded',
      updatedAt: now,
    };
    const sourceLinkIndex = data.materialObservations.links.findIndex((item) => (
      item.resourceObservationLinkId === activeLink.resourceObservationLinkId
    ));
    data.materialObservations.links[sourceLinkIndex] = {
      ...data.materialObservations.links[sourceLinkIndex],
      status: 'superseded',
    };
    data.materialObservations.links.push(linked.link);
    previousResourceVersionIds.push(sourceVersion.resourceVersionId);
    revisedResourceVersionIds.push(version.resourceVersionId);
  }

  const summary = summarize(data);
  return {
    data,
    report: {
      alreadyApplied: targets.length === 0,
      revisedResourceVersionIds,
      previousResourceVersionIds,
      ...summary,
    },
  };
}

function hasOpenResponseRubric(version: FrozenQuestionResourceVersion): boolean {
  return version.rubric.some((item) => item.required && (
    item.evidenceRequirement?.requireTextEvidence
    || item.evidenceRequirement?.requireExplanation
    || item.evidenceRequirement?.requireConclusion
  ));
}

function assertClosedChoiceVersion(version: FrozenQuestionResourceVersion): void {
  const contentValidation = validateQuestionCandidateContent(version);
  if (!contentValidation.passed) {
    throw new Error(`${version.resourceVersionId} Candidate contract invalid: ${contentValidation.issues.map((item) => item.code).join(', ')}`);
  }
  if (!inspectInitialCandidateCompleteness(version).complete) {
    throw new Error(`${version.resourceVersionId} remains incomplete after contract closure.`);
  }
  const quality = evaluateQuestionGenerationQuality({
    candidate: version,
    includePortfolioGuidance: false,
  });
  if (quality.status === 'blocked') {
    throw new Error(`${version.resourceVersionId} remains quality-blocked: ${quality.blockerCodes.join(', ')}`);
  }
}

function inheritSemanticEvidence(
  data: SharedFormalResourceData,
  sourceVersion: FrozenQuestionResourceVersion,
  semantic: ReturnType<typeof createQualityArtifacts>['semantic'],
  now: string,
): void {
  const previousTrace = data.questionQuality.frozenQualityTraces.find((item) => (
    item.resourceVersionId === sourceVersion.resourceVersionId
  ));
  const previousSemantic = previousTrace && data.questionQuality.semanticAssessments.find((item) => (
    item.semanticAssessmentId === previousTrace.semanticAssessmentId
  ));
  if (previousSemantic?.status !== 'completed') return;
  semantic.findings = cloneSharedFormalResourceValue(previousSemantic.findings);
  semantic.limitations = [
    ...cloneSharedFormalResourceValue(previousSemantic.limitations),
    `仅将单选 Rubric 的作答要求对齐结构化选择；题干、选项、答案和材料事实未改变，沿用上一正式版本语义证据（${now}）。`,
  ];
  semantic.providerId = 'quality-evidence-inheritance';
  semantic.modelId = previousSemantic.semanticAssessmentId;
}

function createRegistryEntry(
  existing: ResourceRegistryEntry,
  version: FrozenQuestionResourceVersion,
  now: string,
): ResourceRegistryEntry {
  return {
    ...existing,
    currentFrozenVersionId: version.resourceVersionId,
    latestReviewId: version.reviewId,
    latestValidationId: version.validationId,
    materialId: version.materialId,
    taskId: version.taskId,
    abilityId: version.abilityMetadata.abilityId,
    taskRole: version.abilityMetadata.taskRole,
    difficulty: version.abilityMetadata.difficulty,
    tags: [...version.tags],
    status: 'active',
    updatedAt: now,
  };
}

function listCurrentVersions(data: SharedFormalResourceData): FrozenQuestionResourceVersion[] {
  const currentIds = new Set(data.questionResources.registryEntries
    .filter((entry) => entry.status === 'active' && entry.currentFrozenVersionId)
    .map((entry) => entry.currentFrozenVersionId!));
  return data.questionResources.versions.filter((version) => (
    version.status === 'frozen' && currentIds.has(version.resourceVersionId)
  ));
}

function selectCurrentPlan(
  data: SharedFormalResourceData,
  materialVersionId: string,
): MaterialObservationPlan {
  const plan = data.materialObservations.plans
    .filter((item) => item.status !== 'superseded'
      && item.materialVersionId === materialVersionId)
    .sort((left, right) => right.revision - left.revision
      || right.updatedAt.localeCompare(left.updatedAt))[0];
  if (!plan) throw new Error(`Current observation plan missing: ${materialVersionId}`);
  return plan;
}

function summarize(data: SharedFormalResourceData) {
  const currentVersions = listCurrentVersions(data);
  const currentVersionIds = new Set(currentVersions.map((item) => item.resourceVersionId));
  const traceVersionIds = new Set(data.questionQuality.frozenQualityTraces
    .map((item) => item.resourceVersionId));
  return {
    currentSingleChoiceCount: currentVersions.filter((item) => (
      item.responseFormat === 'single_choice'
    )).length,
    currentQuestionCount: currentVersions.length,
    currentTraceCount: [...currentVersionIds].filter((id) => traceVersionIds.has(id)).length,
  };
}
