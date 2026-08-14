import {
  QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  QUESTION_RESOURCE_ADMISSION_VERSION,
  normalizeQuestionRuntimePolicyTags,
  type FrozenQuestionResourceVersion,
  type ResourceRegistryEntry,
  type ResourceReviewDecision,
  type ResourceValidationResult,
  type StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  cloneSharedFormalResourceValue,
  type SharedFormalResourceData,
} from '../schemas/sharedFormalResourcePersistence.schema.ts';
import type {
  MaterialObservationPlan,
  ObservationDimension,
} from '../schemas/materialObservation.schema.ts';
import {
  buildMaterialObservationPlan,
  createMaterialSourceAnchor,
  deriveResourceObservationLink,
  validateMaterialObservationPlan,
} from './materialObservationAgent.ts';
import { buildStableId } from './reviewedResourceCandidateAdapter.ts';
import { createQualityArtifacts } from './materialCorpusOptimizationAgent.ts';
import type { QuestionPortfolioSupplementCandidateReport } from
  './questionPortfolioSupplementCandidateAgent.ts';
import {
  QUESTION_PORTFOLIO_SUPPLEMENT_PUBLICATION_MARKER,
} from './questionPortfolioSupplementPlanningAgent.ts';

export type QuestionPortfolioSupplementPublicationReport = {
  alreadyApplied: boolean;
  publishedMaterialTitles: string[];
  resourceVersionIds: string[];
  planIds: string[];
  activeMaterialCount: number;
  currentQuestionCount: number;
  currentTraceCount: number;
};

export function prepareQuestionPortfolioSupplementPublication(
  source: SharedFormalResourceData,
  candidateReport: QuestionPortfolioSupplementCandidateReport | null,
  now: string,
): { data: SharedFormalResourceData; report: QuestionPortfolioSupplementPublicationReport } {
  const data = cloneSharedFormalResourceValue(source);
  const activeMarkerVersions = currentMarkerVersions(data);
  if (activeMarkerVersions.length === 4) {
    return { data, report: summarize(data, true, activeMarkerVersions, []) };
  }
  if (activeMarkerVersions.length > 0) {
    throw new Error(`P2-03 partial publication state detected: ${activeMarkerVersions.length}/4.`);
  }
  if (!candidateReport || candidateReport.candidateCount !== 4 || candidateReport.issues.length) {
    throw new Error('P2-03 requires the complete, accepted P2-02 candidate set.');
  }

  const resourceVersionIds: string[] = [];
  const planIds: string[] = [];
  for (const candidateResult of candidateReport.candidates) {
    const material = data.questionResources.materials.find((item) => (
      item.materialVersionId === candidateResult.materialVersionId && item.status !== 'retired'
    ));
    if (!material) throw new Error(`P2-03 active material missing: ${candidateResult.materialTitle}`);
    const oldPlan = currentPlan(data, material.materialVersionId);
    const structure = data.materialObservations.structures.find((item) => (
      item.materialStructureSnapshotId === oldPlan.materialStructureSnapshotId
    ));
    if (!structure) throw new Error(`P2-03 structure missing: ${material.materialVersionId}`);
    const anchor = createMaterialSourceAnchor({
      material,
      structure,
      anchorType: candidateResult.candidate.materialAnchor.anchorType,
      startParagraph: candidateResult.candidate.materialAnchor.startParagraph,
      endParagraph: candidateResult.candidate.materialAnchor.endParagraph,
    });
    if (!data.materialObservations.anchors.some((item) => item.sourceAnchorId === anchor.sourceAnchorId)) {
      data.materialObservations.anchors.push(anchor);
    }

    const existingTaskInputs = oldPlan.taskPlans.map((task) => ({
      observationTaskPlanId: task.observationTaskPlanId,
      taskRevisionRootId: task.taskRevisionRootId,
      parentObservationTaskPlanId: task.parentObservationTaskPlanId,
      regenerationAttemptId: task.regenerationAttemptId,
      primaryDimension: task.primaryDimension,
      observationFocus: task.observationFocus,
      abilityId: task.abilityId,
      taskRole: task.taskRole,
      difficulty: task.difficulty,
      sourceAnchorIds: task.sourceAnchorIds,
      observationGoal: task.observationGoal,
      expectedStudentAction: task.expectedStudentAction,
      designReason: task.designReason,
      intendedComparisonGroupId: task.intendedComparisonGroupId,
      materialRelationIntent: task.materialRelationIntent,
      resourceDraftSpecification: task.resourceDraftSpecification,
      calibrationCases: task.calibrationCases,
    }));
    const newCandidate = candidateResult.candidate;
    const newTaskInput = {
      primaryDimension: newCandidate.observationDimension,
      observationFocus: {
        focusCode: `p2-03-${newCandidate.observationDimension}-${buildStableId('focus', [material.materialId, newCandidate.candidateId])}`,
        displayName: newCandidate.observationFocus.displayName,
        definition: newCandidate.observationFocus.definition,
        scope: 'plan_local' as const,
      },
      abilityId: newCandidate.primaryAbilityId,
      taskRole: 'training' as const,
      difficulty: newCandidate.difficultySuggestion,
      sourceAnchorIds: [anchor.sourceAnchorId],
      observationGoal: newCandidate.questionStem,
      expectedStudentAction: newCandidate.expectedStudentAction,
      designReason: newCandidate.designRationale,
      materialRelationIntent: 'same_context' as const,
      resourceDraftSpecification: {
        title: candidateResult.completeContent.title,
        questionType: newCandidate.questionDraft.questionType,
        responseFormat: newCandidate.questionDraft.responseFormat,
        assessmentMode: newCandidate.assessmentMode,
        answerAcceptance: candidateResult.completeContent.answerAcceptance,
        rubric: candidateResult.completeContent.rubric,
        minimumAnswerRequirement: newCandidate.minimumAnswerRequirement,
        supportingAbilityIds: newCandidate.supportingAbilityIds,
        prerequisiteAbilityIds: [],
        gradeRange: candidateResult.completeContent.abilityMetadata.gradeRange,
        tags: candidateResult.completeContent.tags.filter((tag) => !tag.startsWith('candidate_only:')),
      },
      calibrationCases: newCandidate.calibrationAnswers.map((item) => ({
        calibrationCaseId: buildStableId('p2-03-calibration', [newCandidate.candidateId, item.category]),
        category: item.category,
        answerText: item.answerText,
        expectedAnswerStatus: item.expectedAnswerStatus,
        reviewNote: item.expectedDiagnosisBoundary,
      })),
    };
    const dimensionReviews = oldPlan.dimensionReviews.map((review) => (
      review.dimension === newCandidate.observationDimension
        ? {
          ...review,
          decision: 'selected' as const,
          reason: `${review.reason} P2-03新增基础能力观察，不以机械配额扩题。`,
          sourceAnchorIds: [...new Set([...review.sourceAnchorIds, anchor.sourceAnchorId])],
        }
        : cloneSharedFormalResourceValue(review)
    ));
    const plan = buildMaterialObservationPlan({
      materialId: material.materialId,
      materialVersionId: material.materialVersionId,
      materialStructureSnapshotId: structure.materialStructureSnapshotId,
      revision: oldPlan.revision + 1,
      parentPlanId: oldPlan.materialObservationPlanId,
      dimensionReviews,
      taskPlans: [...existingTaskInputs, newTaskInput],
      now,
    });
    plan.taskPlans = plan.taskPlans.map((task, index) => index < oldPlan.taskPlans.length
      ? {
        ...task,
        linkedDraftId: oldPlan.taskPlans[index].linkedDraftId,
        linkedResourceId: oldPlan.taskPlans[index].linkedResourceId,
        status: oldPlan.taskPlans[index].status,
      }
      : task);
    const newTaskIndex = plan.taskPlans.length - 1;
    const newTask = plan.taskPlans[newTaskIndex];
    const artifacts = createNewQuestionArtifacts({
      material,
      plan,
      task: newTask,
      content: candidateResult.completeContent,
      now,
    });
    plan.taskPlans[newTaskIndex] = {
      ...newTask,
      linkedDraftId: artifacts.draft.draftId,
      linkedResourceId: artifacts.version.resourceId,
      status: 'frozen_linked',
    };
    plan.status = 'reviewed';
    plan.reviewerId = 'codex-p2-03-reviewer';
    plan.reviewNote = 'P2-03：在不替换既有正式题的前提下，采用一项具有新增观察价值的基础能力补充题。';
    plan.reviewedAt = now;
    plan.updatedAt = now;
    const planValidation = validateMaterialObservationPlan({
      plan,
      material,
      structure,
      anchors: data.materialObservations.anchors.filter((item) => (
        item.materialVersionId === material.materialVersionId
      )),
      checkedAt: now,
    });
    if (!planValidation.passed) {
      throw new Error(`${material.title} P2-03 plan invalid: ${planValidation.issues.map((item) => item.code).join(',')}`);
    }

    const peerDrafts = data.materialObservations.links.filter((item) => (
      item.status === 'active' && item.materialVersionId === material.materialVersionId
    )).map((item) => data.questionResources.versions.find((version) => (
      version.resourceVersionId === item.resourceVersionId
    ))).filter((item): item is FrozenQuestionResourceVersion => Boolean(item))
      .map((version) => data.questionResources.drafts.find((draft) => (
        draft.draftId === version.sourceDraftId
      ))).filter((item): item is StructuredQuestionDraft => Boolean(item));
    const quality = createQualityArtifacts({
      ...artifacts,
      material,
      peerDrafts: [...peerDrafts, artifacts.draft],
      now,
    });
    artifacts.review.qualityAssessmentBundleId = quality.bundle.bundleId;
    artifacts.review.deterministicAssessmentId = quality.deterministic.assessmentId;
    artifacts.review.semanticAssessmentId = quality.semantic.semanticAssessmentId;
    artifacts.review.qualityMergeRuleVersion = quality.bundle.mergeRuleVersion;
    artifacts.review.warningDecisions = quality.deterministic.warnings.map((warning) => ({
      warningDecisionId: `${artifacts.draft.draftId}:${warning.code}:accepted`,
      draftId: artifacts.draft.draftId,
      draftRevision: artifacts.draft.revision,
      assessmentId: quality.deterministic.assessmentId,
      warningCode: warning.code,
      decision: 'accepted',
      reviewedBy: 'codex-p2-03-reviewer',
      reviewedAt: now,
    }));
    const registry: ResourceRegistryEntry = {
      resourceId: artifacts.version.resourceId,
      currentFrozenVersionId: artifacts.version.resourceVersionId,
      status: 'active',
      latestReviewId: artifacts.review.reviewId,
      latestValidationId: artifacts.validation.validationId,
      materialId: material.materialId,
      taskId: newTask.observationTaskPlanId,
      abilityId: newTask.abilityId,
      taskRole: newTask.taskRole,
      difficulty: newTask.difficulty,
      tags: [...artifacts.version.tags],
      createdAt: now,
      updatedAt: now,
      schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
    };
    const derived = deriveResourceObservationLink({
      plan,
      task: plan.taskPlans[newTaskIndex],
      version: artifacts.version,
      registryEntry: registry,
      validation: artifacts.validation,
      review: artifacts.review,
      linkedAt: now,
    });
    if (derived.issues.length) {
      throw new Error(`${material.title} P2-03 link invalid: ${derived.issues.join(',')}`);
    }

    oldPlan.status = 'superseded';
    oldPlan.updatedAt = now;
    data.materialObservations.plans.push(plan);
    data.materialObservations.validations.push(planValidation);
    data.materialObservations.reviews.push({
      reviewId: `${plan.materialObservationPlanId}:review:r${plan.revision}`,
      materialObservationPlanId: plan.materialObservationPlanId,
      planRevision: plan.revision,
      validationId: planValidation.validationId,
      action: 'approve',
      reviewerId: 'codex-p2-03-reviewer',
      notes: plan.reviewNote,
      reviewedAt: now,
    });
    data.questionResources.drafts.push(artifacts.draft);
    data.questionResources.validations.push(artifacts.validation);
    data.questionResources.reviews.push(artifacts.review);
    data.questionResources.versions.push(artifacts.version);
    data.questionResources.registryEntries.push(registry);
    data.materialObservations.links.push(derived.link);
    data.questionQuality.deterministicAssessments.push(quality.deterministic);
    data.questionQuality.semanticAssessments.push(quality.semantic);
    data.questionQuality.assessmentBundles.push(quality.bundle);
    data.questionQuality.frozenQualityTraces.push(quality.trace);
    resourceVersionIds.push(artifacts.version.resourceVersionId);
    planIds.push(plan.materialObservationPlanId);
  }
  return {
    data,
    report: summarize(data, false, currentMarkerVersions(data), planIds, resourceVersionIds),
  };
}

function createNewQuestionArtifacts(input: {
  material: SharedFormalResourceData['questionResources']['materials'][number];
  plan: MaterialObservationPlan;
  task: MaterialObservationPlan['taskPlans'][number];
  content: QuestionPortfolioSupplementCandidateReport['candidates'][number]['completeContent'];
  now: string;
}) {
  const { material, task, content, now } = input;
  const resourceId = `question-${task.observationTaskPlanId}`;
  const draftId = `${resourceId}:draft:r1`;
  const validationId = `${draftId}:validation:r1`;
  const reviewId = `${draftId}:review:r1`;
  const tags = normalizeQuestionRuntimePolicyTags([
    ...content.tags.filter((tag) => !tag.startsWith('candidate_only:')
      && !tag.startsWith('observation_task:')),
    `observation_plan:${input.plan.materialObservationPlanId}`,
    `observation_task:${task.observationTaskPlanId}`,
    `observation_task_root:${task.taskRevisionRootId || task.observationTaskPlanId}`,
    `observation_dimension:${task.primaryDimension}`,
    QUESTION_PORTFOLIO_SUPPLEMENT_PUBLICATION_MARKER,
  ], task.taskRole);
  const draft: StructuredQuestionDraft = {
    draftId,
    resourceId,
    taskId: task.observationTaskPlanId,
    proposedVersionNumber: 1,
    materialVersionId: material.materialVersionId,
    title: content.title,
    questionStem: content.questionStem,
    questionType: content.questionType,
    responseFormat: content.responseFormat,
    options: content.options,
    assessmentMode: content.assessmentMode,
    answerAcceptance: cloneSharedFormalResourceValue(content.answerAcceptance),
    rubric: cloneSharedFormalResourceValue(content.rubric),
    minimumAnswerRequirement: cloneSharedFormalResourceValue(content.minimumAnswerRequirement),
    abilityMetadata: cloneSharedFormalResourceValue(content.abilityMetadata),
    source: cloneSharedFormalResourceValue(content.source),
    tags,
    status: 'reviewed',
    revision: 1,
    latestValidationId: validationId,
    latestReviewId: reviewId,
    reviewSubmittedAt: now,
    reviewSubmittedBy: 'codex-p2-03-author',
    reviewSubmissionCount: 1,
    reviewSubmissionHistory: [{
      eventId: `${draftId}:submitted:1`,
      action: 'submitted',
      draftRevision: 1,
      actorId: 'codex-p2-03-author',
      occurredAt: now,
    }],
    warningAcknowledgements: [],
    createdAt: now,
    updatedAt: now,
    version: QUESTION_RESOURCE_ADMISSION_VERSION,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
  const validation: ResourceValidationResult = {
    validationId,
    draftId,
    resourceId,
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
    resourceId,
    reviewedDraftRevision: 1,
    validationId,
    action: 'approve',
    reviewerId: 'codex-p2-03-reviewer',
    notes: 'P2-03：候选新增观察价值、材料事实、作答负荷、Rubric和答案接受范围已完成受控核对。',
    reviewedAt: now,
  };
  const version: FrozenQuestionResourceVersion = {
    resourceId,
    resourceVersionId: `${resourceId}:v1`,
    versionNumber: 1,
    sourceDraftId: draftId,
    materialId: material.materialId,
    materialVersionId: material.materialVersionId,
    materialSnapshot: cloneSharedFormalResourceValue(material),
    taskId: task.observationTaskPlanId,
    title: draft.title,
    questionStem: draft.questionStem,
    questionType: draft.questionType,
    responseFormat: draft.responseFormat,
    options: draft.options,
    assessmentMode: draft.assessmentMode,
    answerAcceptance: cloneSharedFormalResourceValue(draft.answerAcceptance),
    rubric: cloneSharedFormalResourceValue(draft.rubric),
    minimumAnswerRequirement: cloneSharedFormalResourceValue(draft.minimumAnswerRequirement),
    abilityMetadata: cloneSharedFormalResourceValue(draft.abilityMetadata),
    source: cloneSharedFormalResourceValue(draft.source),
    tags,
    validationId,
    reviewId,
    status: 'frozen',
    frozenAt: now,
    updatedAt: now,
    version: QUESTION_RESOURCE_ADMISSION_VERSION,
    schemaVersion: QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION,
  };
  return { draft, validation, review, version };
}

function currentPlan(data: SharedFormalResourceData, materialVersionId: string): MaterialObservationPlan {
  const plan = data.materialObservations.plans.filter((item) => (
    item.materialVersionId === materialVersionId && item.status !== 'superseded'
  )).sort((left, right) => right.revision - left.revision)[0];
  if (!plan) throw new Error(`P2-03 current plan missing: ${materialVersionId}`);
  return plan;
}

function currentMarkerVersions(data: SharedFormalResourceData): FrozenQuestionResourceVersion[] {
  const activeVersionIds = new Set(data.questionResources.registryEntries.filter((item) => (
    item.status === 'active' && item.currentFrozenVersionId
  )).map((item) => item.currentFrozenVersionId));
  return data.questionResources.versions.filter((item) => (
    item.status === 'frozen'
    && activeVersionIds.has(item.resourceVersionId)
    && item.tags.includes(QUESTION_PORTFOLIO_SUPPLEMENT_PUBLICATION_MARKER)
  ));
}

function summarize(
  data: SharedFormalResourceData,
  alreadyApplied: boolean,
  versions: FrozenQuestionResourceVersion[],
  planIds: string[],
  resourceVersionIds = versions.map((item) => item.resourceVersionId),
): QuestionPortfolioSupplementPublicationReport {
  const activeMaterials = data.questionResources.materials.filter((item) => item.status !== 'retired');
  const activeMaterialVersionIds = new Set(activeMaterials.map((item) => item.materialVersionId));
  const links = data.materialObservations.links.filter((item) => (
    item.status === 'active' && activeMaterialVersionIds.has(item.materialVersionId)
  ));
  const traceVersionIds = new Set(data.questionQuality.frozenQualityTraces.map((item) => (
    item.resourceVersionId
  )));
  return {
    alreadyApplied,
    publishedMaterialTitles: versions.map((version) => version.materialSnapshot?.title || version.title),
    resourceVersionIds,
    planIds,
    activeMaterialCount: activeMaterials.length,
    currentQuestionCount: links.length,
    currentTraceCount: links.filter((item) => traceVersionIds.has(item.resourceVersionId)).length,
  };
}
