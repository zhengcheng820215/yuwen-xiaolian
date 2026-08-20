import type { MaterialObservationRepository } from '../repositories/materialObservationRepository.ts';
import type { QuestionResourceAdmissionRepository } from '../repositories/questionResourceAdmissionRepository.ts';
import type {
  DimensionReview,
  FirstFrozenResourcePackManifest,
  MaterialObservationPlan,
  MaterialObservationPlanValidation,
  MaterialObservationReviewAction,
  MaterialObservationReviewDecision,
  MaterialSourceAnchor,
  MaterialStructureSnapshot,
  ObservationCalibrationCase,
  ObservationDimension,
  ObservationDiversityView,
  ObservationFocus,
  ObservationResourceDraftSpecification,
  ObservationTaskPlan,
  ResourceObservationLink,
} from '../schemas/materialObservation.schema.ts';
import type {
  FrozenQuestionResourceVersion,
  PrimaryAbilityId,
  ResourceRegistryEntry,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import type { CreateStructuredQuestionDraftInput } from './questionResourceAdmissionAgent.ts';
import { projectTargetedMaterialUsage } from '../schemas/targetedMicroTraining.schema.ts';
import {
  createStructuredQuestionDraft,
  updateStructuredQuestionDraft,
  validateStructuredQuestionDraft,
} from './questionResourceAdmissionAgent.ts';
import {
  adaptObservationTaskToQuestionDraft,
  buildMaterialObservationPlan,
  buildFirstFrozenResourcePackManifest,
  buildObservationDiversityView,
  createMaterialSourceAnchor,
  deriveMaterialStructureSnapshot,
  deriveResourceObservationLink,
  validateMaterialObservationPlan,
} from './materialObservationAgent.ts';

export type MaterialProductionTaskInput = {
  observationTaskPlanId?: string;
  taskRevisionRootId?: string;
  parentObservationTaskPlanId?: string;
  primaryDimension: ObservationDimension;
  observationFocus?: ObservationFocus;
  abilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
  difficulty: ObservationTaskPlan['difficulty'];
  targetedTrainingMetadata?: ObservationTaskPlan['targetedTrainingMetadata'];
  anchorType?: MaterialSourceAnchor['anchorType'];
  startParagraph?: number;
  endParagraph?: number;
  questionStem: string;
  expectedStudentAction: string;
  designReason: string;
  intendedComparisonGroupId?: string;
  materialRelationIntent?: ObservationTaskPlan['materialRelationIntent'];
  resourceDraftSpecification?: ObservationResourceDraftSpecification;
  calibrationCases?: ObservationCalibrationCase[];
};

export type MaterialProductionDraftResult = {
  observationTaskPlanId: string;
  draftId: string;
  status: 'created' | 'reused' | 'failed';
  validationPassed?: boolean;
  issues: string[];
};

export type SingleTaskRegenerationResult = {
  plan: MaterialObservationPlan;
  validation: MaterialObservationPlanValidation;
  changed: boolean;
  reused: boolean;
  sourceObservationTaskPlanId: string;
  observationTaskPlanId: string;
};

export type MaterialProductionDraftSynchronizationResult = {
  observationTaskPlanId: string;
  draftId: string;
  changed: boolean;
  revision: number;
};

export async function createMaterialStructure(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  materialVersionId: string,
  now = new Date().toISOString(),
): Promise<MaterialStructureSnapshot> {
  const material = await resourceRepository.getMaterial(materialVersionId);
  if (!material) throw new Error(`Material Version not found: ${materialVersionId}`);
  return observationRepository.saveStructure(deriveMaterialStructureSnapshot(material, now));
}

export async function createMaterialAnchor(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  input: {
    materialVersionId: string;
    materialStructureSnapshotId: string;
    anchorType: MaterialSourceAnchor['anchorType'];
    startParagraph?: number;
    endParagraph?: number;
  },
): Promise<MaterialSourceAnchor> {
  const [material, structure] = await Promise.all([
    resourceRepository.getMaterial(input.materialVersionId),
    observationRepository.getStructure(input.materialStructureSnapshotId),
  ]);
  if (!material) throw new Error(`Material Version not found: ${input.materialVersionId}`);
  if (!structure) throw new Error(`Material Structure not found: ${input.materialStructureSnapshotId}`);
  return observationRepository.saveAnchor(createMaterialSourceAnchor({
    material,
    structure,
    anchorType: input.anchorType,
    startParagraph: input.startParagraph,
    endParagraph: input.endParagraph,
  }));
}

export async function createMaterialProductionPlan(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  input: {
    materialVersionId: string;
    tasks: MaterialProductionTaskInput[];
    sourcePlanId?: string;
    now?: string;
  },
): Promise<{ plan: MaterialObservationPlan; validation: MaterialObservationPlanValidation }> {
  const material = await resourceRepository.getMaterial(input.materialVersionId);
  if (!material) throw new Error(`Material Version not found: ${input.materialVersionId}`);
  const usage = projectTargetedMaterialUsage(material);
  if (usage.usageType === 'targeted_excerpt') {
    if (input.tasks.length < 1 || input.tasks.length > 2) {
      throw new Error('Targeted excerpt production requires 1 to 2 Training Tasks.');
    }
    input.tasks.forEach((task) => {
      if (task.taskRole !== 'training') {
        throw new Error('Targeted excerpt Observation Tasks must use the training role.');
      }
      if (!task.targetedTrainingMetadata) {
        throw new Error('Targeted excerpt Observation Task requires a structured primary Gap identity.');
      }
      if (task.targetedTrainingMetadata.targetedMaterialVersionId !== material.materialVersionId) {
        throw new Error('Targeted Observation Task references a different Material Version.');
      }
      if (!usage.targetedExcerptMetadata?.supportedGapReasonCodes.includes(
        task.targetedTrainingMetadata.primaryGapReasonCode,
      )) {
        throw new Error('Targeted Observation Task primary Gap is outside Material support scope.');
      }
      if (!usage.targetedExcerptMetadata?.targetAbilityIds.includes(task.abilityId)) {
        throw new Error('Targeted Observation Task Ability is outside Material support scope.');
      }
    });
  } else {
    if (input.tasks.length < 2 || input.tasks.length > 6) {
      throw new Error('One core Material production batch requires 2 to 6 Observation Tasks.');
    }
    if (input.tasks.some((task) => task.targetedTrainingMetadata !== undefined)) {
      throw new Error('Core Observation Tasks cannot carry targeted training metadata.');
    }
  }
  if (new Set(input.tasks.map((task) => normalize(task.questionStem))).size !== input.tasks.length) {
    throw new Error('Observation Tasks in one batch require distinct question stems.');
  }
  const now = input.now || new Date().toISOString();
  const existingStructures = await observationRepository.listStructures(input.materialVersionId);
  const structure = existingStructures[0]
    || await createMaterialStructure(resourceRepository, observationRepository, input.materialVersionId, now);
  const anchors: MaterialSourceAnchor[] = [];
  for (const task of input.tasks) {
    const anchorType = task.anchorType
      || (task.startParagraph && task.endParagraph && task.endParagraph !== task.startParagraph
        ? 'paragraph_range'
        : 'paragraph');
    anchors.push(await createMaterialAnchor(resourceRepository, observationRepository, {
      materialVersionId: input.materialVersionId,
      materialStructureSnapshotId: structure.materialStructureSnapshotId,
      anchorType,
      startParagraph: task.startParagraph,
      endParagraph: task.endParagraph,
    }));
  }
  const selectedDimensions = new Set(input.tasks.map((task) => task.primaryDimension));
  const dimensionReviews: DimensionReview[] = (['fact', 'character', 'plot', 'causality', 'structure', 'language', 'theme'] as ObservationDimension[])
    .map((dimension) => ({
      dimension,
      decision: selectedDimensions.has(dimension) ? 'selected' : 'not_suitable',
      reason: selectedDimensions.has(dimension)
        ? `本批任务使用 ${dimension} 作为材料观测维度，需在人工复核中确认。`
        : `本批资源暂不使用 ${dimension}，不为填满矩阵强行创建任务。`,
      sourceAnchorIds: selectedDimensions.has(dimension)
        ? unique(input.tasks.flatMap((task, index) => task.primaryDimension === dimension ? [anchors[index].sourceAnchorId] : []))
        : [],
    }));
  const previousPlans = (await observationRepository.listPlans(input.materialVersionId))
    .sort((left, right) => right.revision - left.revision);
  const requestedSourcePlan = input.sourcePlanId
    ? previousPlans.find((item) => item.materialObservationPlanId === input.sourcePlanId)
    : undefined;
  if (input.sourcePlanId && !requestedSourcePlan) {
    throw new Error(`Material Observation Plan not found: ${input.sourcePlanId}`);
  }
  const sourcePlan = requestedSourcePlan || previousPlans[0];
  const mutableSourcePlan = (
    sourcePlan && ['draft', 'revision_required'].includes(sourcePlan.status)
      ? sourcePlan
      : previousPlans.find((item) => ['draft', 'revision_required'].includes(item.status))
  );
  const plan = buildMaterialObservationPlan({
    materialObservationPlanId: mutableSourcePlan?.materialObservationPlanId,
    materialId: material.materialId,
    materialVersionId: material.materialVersionId,
    materialStructureSnapshotId: structure.materialStructureSnapshotId,
    revision: mutableSourcePlan?.revision || (previousPlans[0]?.revision || 0) + 1,
    parentPlanId: mutableSourcePlan?.parentPlanId || sourcePlan?.materialObservationPlanId,
    createdAt: mutableSourcePlan?.createdAt,
    dimensionReviews,
    taskPlans: input.tasks.map((task, index) => ({
      // ObservationTask identity is stable across group-level Plan revisions. Existing
      // tasks keep their id so an adopted supplement cannot detach already-published
      // Formal Resources; newly generated tasks arrive without an id and still receive
      // a fresh identity in buildMaterialObservationPlan.
      observationTaskPlanId: task.observationTaskPlanId,
      taskRevisionRootId: task.taskRevisionRootId || task.observationTaskPlanId,
      parentObservationTaskPlanId: task.parentObservationTaskPlanId,
      primaryDimension: task.primaryDimension,
      observationFocus: task.observationFocus,
      abilityId: task.abilityId,
      taskRole: task.taskRole,
      difficulty: task.difficulty,
      targetedTrainingMetadata: task.targetedTrainingMetadata,
      sourceAnchorIds: [anchors[index].sourceAnchorId],
      observationGoal: task.questionStem,
      expectedStudentAction: task.expectedStudentAction,
      designReason: task.designReason,
      intendedComparisonGroupId: task.intendedComparisonGroupId,
      materialRelationIntent: task.materialRelationIntent,
      resourceDraftSpecification: task.resourceDraftSpecification,
      calibrationCases: task.calibrationCases,
    })),
    now,
  });
  await observationRepository.savePlan(plan);
  const validation = await validateAndSaveMaterialObservationPlan(
    resourceRepository,
    observationRepository,
    plan.materialObservationPlanId,
    now,
  );
  return { plan: (await observationRepository.getPlan(plan.materialObservationPlanId)) || plan, validation };
}

export async function createSingleTaskRegenerationRevision(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  input: {
    sourcePlanId: string;
    sourceObservationTaskPlanId: string;
    regenerationAttemptId: string;
    replacement: MaterialProductionTaskInput;
    now?: string;
  },
): Promise<SingleTaskRegenerationResult> {
  const attemptId = input.regenerationAttemptId.trim();
  if (!attemptId) throw new Error('Single-task regeneration requires a stable attempt id.');

  const sourcePlan = await requirePlan(observationRepository, input.sourcePlanId);
  const sourceTaskIndex = sourcePlan.taskPlans.findIndex(
    (task) => task.observationTaskPlanId === input.sourceObservationTaskPlanId,
  );
  if (sourceTaskIndex < 0) {
    throw new Error(`Observation Task Plan not found: ${input.sourceObservationTaskPlanId}`);
  }
  const sourceTask = sourcePlan.taskPlans[sourceTaskIndex];
  const plans = await observationRepository.listPlans(sourcePlan.materialVersionId);
  const existingAttempt = plans.find((plan) => (
    plan.regenerationContext?.attemptId === attemptId
    && plan.regenerationContext.sourcePlanId === sourcePlan.materialObservationPlanId
    && plan.regenerationContext.sourceObservationTaskPlanId === sourceTask.observationTaskPlanId
  ));
  if (existingAttempt) {
    const validation = await validateAndSaveMaterialObservationPlan(
      resourceRepository,
      observationRepository,
      existingAttempt.materialObservationPlanId,
      input.now,
    );
    const target = existingAttempt.taskPlans[sourceTaskIndex];
    return {
      plan: existingAttempt,
      validation,
      changed: true,
      reused: true,
      sourceObservationTaskPlanId: sourceTask.observationTaskPlanId,
      observationTaskPlanId: target.observationTaskPlanId,
    };
  }

  const sourceAnchor = await requireSingleTaskAnchor(observationRepository, sourceTask);
  assertSingleTaskLockedFields(sourceTask, sourceAnchor, input.replacement);
  const replacementTask = productionTaskInputToObservationTaskInput(input.replacement, sourceTask.sourceAnchorIds);
  const sourceComparable = observationTaskComparable(sourceTask);
  const replacementComparable = observationTaskComparable({
    ...sourceTask,
    ...replacementTask,
  });
  if (sourceComparable === replacementComparable) {
    const validation = await validateAndSaveMaterialObservationPlan(
      resourceRepository,
      observationRepository,
      sourcePlan.materialObservationPlanId,
      input.now,
    );
    return {
      plan: sourcePlan,
      validation,
      changed: false,
      reused: true,
      sourceObservationTaskPlanId: sourceTask.observationTaskPlanId,
      observationTaskPlanId: sourceTask.observationTaskPlanId,
    };
  }

  const material = await resourceRepository.getMaterial(sourcePlan.materialVersionId);
  if (!material) throw new Error(`Material Version not found: ${sourcePlan.materialVersionId}`);
  const now = input.now || new Date().toISOString();
  const latestRevision = plans.reduce((maximum, plan) => Math.max(maximum, plan.revision), 0);
  const taskRevisionRootId = sourceTask.taskRevisionRootId || sourceTask.observationTaskPlanId;
  const taskPlans = sourcePlan.taskPlans.map((task, index) => {
    if (index !== sourceTaskIndex) return observationTaskToInput(task, true);
    return {
      ...replacementTask,
      taskRevisionRootId,
      parentObservationTaskPlanId: sourceTask.observationTaskPlanId,
      regenerationAttemptId: attemptId,
    };
  });
  const plan = buildMaterialObservationPlan({
    materialId: sourcePlan.materialId,
    materialVersionId: sourcePlan.materialVersionId,
    materialStructureSnapshotId: sourcePlan.materialStructureSnapshotId,
    revision: latestRevision + 1,
    parentPlanId: sourcePlan.materialObservationPlanId,
    regenerationContext: {
      attemptId,
      sourcePlanId: sourcePlan.materialObservationPlanId,
      sourceObservationTaskPlanId: sourceTask.observationTaskPlanId,
      taskRevisionRootId,
    },
    dimensionReviews: sourcePlan.dimensionReviews,
    taskPlans,
    now,
  });
  await observationRepository.savePlan(plan);
  const validation = await validateAndSaveMaterialObservationPlan(
    resourceRepository,
    observationRepository,
    plan.materialObservationPlanId,
    now,
  );
  const saved = (await observationRepository.getPlan(plan.materialObservationPlanId)) || plan;
  return {
    plan: saved,
    validation,
    changed: true,
    reused: false,
    sourceObservationTaskPlanId: sourceTask.observationTaskPlanId,
    observationTaskPlanId: saved.taskPlans[sourceTaskIndex].observationTaskPlanId,
  };
}

export async function createAndValidateQuestionDraftBatch(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  input: {
    planId: string;
    sourceDescription?: string;
    now?: string;
  },
): Promise<MaterialProductionDraftResult[]> {
  const plan = await requirePlan(observationRepository, input.planId);
  if (plan.status !== 'reviewed') throw new Error('Only a reviewed Material Observation Plan can create a Draft batch.');
  const results: MaterialProductionDraftResult[] = [];
  for (const task of plan.taskPlans) {
    try {
      results.push(await createAndValidateQuestionDraftForTask(
        resourceRepository,
        observationRepository,
        {
          planId: plan.materialObservationPlanId,
          observationTaskPlanId: task.observationTaskPlanId,
          sourceDescription: input.sourceDescription,
          now: input.now,
        },
      ));
    } catch (error) {
      results.push({
        observationTaskPlanId: task.observationTaskPlanId,
        draftId: productionDraftId(task.observationTaskPlanId),
        status: 'failed',
        issues: [error instanceof Error ? error.message : String(error)],
      });
    }
  }
  return results;
}

export async function createAndValidateQuestionDraftForTask(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  input: {
    planId: string;
    observationTaskPlanId: string;
    sourceDescription?: string;
    now?: string;
  },
): Promise<MaterialProductionDraftResult> {
  const plan = await requirePlan(observationRepository, input.planId);
  if (plan.status !== 'reviewed') throw new Error('Only a reviewed Material Observation Plan can create a Draft.');
  const task = plan.taskPlans.find((value) => value.observationTaskPlanId === input.observationTaskPlanId);
  if (!task) throw new Error(`Observation Task Plan not found: ${input.observationTaskPlanId}`);

  const existingDrafts = await resourceRepository.listDrafts();
  const baseDraftId = productionDraftId(task.observationTaskPlanId);
  const existing = findActiveDraftForObservationTask(existingDrafts, task)
    || existingDrafts.find((draft) => draft.status !== 'archived' && draft.draftId === baseDraftId);
  const draftId = existing
    ? existing.draftId
    : existingDrafts.some((draft) => draft.status === 'archived' && draft.draftId === baseDraftId)
      ? archivedRevisionDraftId(baseDraftId)
      : baseDraftId;

  if (existing && !['drafted', 'validation_failed', 'revision_required'].includes(existing.status)) {
    const validation = existing.latestValidationId
      ? await resourceRepository.getValidation(existing.latestValidationId)
      : null;
    return {
      observationTaskPlanId: task.observationTaskPlanId,
      draftId: existing.draftId,
      status: 'reused',
      validationPassed: validation?.passed,
      issues: validation?.issues.map((issue) => issue.code) || [],
    };
  }

  const draft = existing
    ? await synchronizeEditableQuestionDraft(resourceRepository, plan, task, existing, input.sourceDescription, input.now)
    : await createQuestionDraftFromObservationTask(resourceRepository, observationRepository, {
    planId: plan.materialObservationPlanId,
    observationTaskPlanId: task.observationTaskPlanId,
    content: buildProductionQuestionDraftContent(task, draftId, input.sourceDescription, input.now),
  });
  const validation = await validateStructuredQuestionDraft(resourceRepository, draft.draftId, input.now);
  return {
    observationTaskPlanId: task.observationTaskPlanId,
    draftId: draft.draftId,
    status: existing ? 'reused' : 'created',
    validationPassed: validation.passed,
    issues: validation.issues.map((issue) => issue.code),
  };
}

export async function synchronizeQuestionDraftsFromObservationPlan(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  planId: string,
  now = new Date().toISOString(),
): Promise<MaterialProductionDraftSynchronizationResult[]> {
  const plan = await requirePlan(observationRepository, planId);
  const drafts = await resourceRepository.listDrafts();
  const results: MaterialProductionDraftSynchronizationResult[] = [];

  for (const task of plan.taskPlans) {
    const existing = findActiveDraftForObservationTask(drafts, task);
    if (!existing || !['drafted', 'validation_failed', 'revision_required'].includes(existing.status)) continue;

    const synchronized = await synchronizeEditableQuestionDraft(
      resourceRepository,
      plan,
      task,
      existing,
      undefined,
      now,
    );
    results.push({
      observationTaskPlanId: task.observationTaskPlanId,
      draftId: synchronized.draftId,
      changed: synchronized.revision !== existing.revision,
      revision: synchronized.revision,
    });
  }

  return results;
}

export async function validateAndSaveMaterialObservationPlan(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  planId: string,
  now = new Date().toISOString(),
): Promise<MaterialObservationPlanValidation> {
  const plan = await requirePlan(observationRepository, planId);
  const [material, structure, anchors] = await Promise.all([
    resourceRepository.getMaterial(plan.materialVersionId),
    observationRepository.getStructure(plan.materialStructureSnapshotId),
    observationRepository.listAnchors(plan.materialVersionId),
  ]);
  const validation = validateMaterialObservationPlan({ plan, material, structure, anchors, checkedAt: now });
  const existing = await observationRepository.getValidation(validation.validationId);
  if (existing) return existing;
  await observationRepository.saveValidation(validation);
  if (!validation.passed && plan.status !== 'reviewed') {
    await observationRepository.savePlan({ ...plan, status: 'revision_required', updatedAt: now });
  }
  return validation;
}

export async function submitMaterialObservationPlanForReview(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  planId: string,
  now = new Date().toISOString(),
): Promise<MaterialObservationPlan> {
  const plan = await requirePlan(observationRepository, planId);
  if (!['draft', 'revision_required'].includes(plan.status)) {
    throw new Error(`Material Observation Plan cannot be submitted from status: ${plan.status}`);
  }
  const validation = await validateAndSaveMaterialObservationPlan(resourceRepository, observationRepository, planId, now);
  if (!validation.passed) throw new Error('Material Observation Plan validation failed.');
  return observationRepository.savePlan({ ...plan, status: 'pending_review', updatedAt: now });
}

export async function reviewMaterialObservationPlan(
  observationRepository: MaterialObservationRepository,
  input: {
    planId: string;
    action: MaterialObservationReviewAction;
    reviewerId: string;
    notes: string;
    now?: string;
  },
): Promise<MaterialObservationReviewDecision> {
  const plan = await requirePlan(observationRepository, input.planId);
  const validation = await findCurrentValidation(observationRepository, plan);
  if (!validation?.passed) throw new Error('Current passed Material Observation Plan validation is required.');
  const reviewId = `${plan.materialObservationPlanId}:review:r${plan.revision}:${validation.validationId}`;
  const existing = await observationRepository.getReview(reviewId);
  if (existing) return existing;
  if (plan.status !== 'pending_review') throw new Error(`Material Observation Plan cannot be reviewed from status: ${plan.status}`);
  if (!input.reviewerId.trim() || !input.notes.trim()) throw new Error('Reviewer identity and notes are required.');
  const now = input.now || new Date().toISOString();
  const decision: MaterialObservationReviewDecision = {
    reviewId,
    materialObservationPlanId: plan.materialObservationPlanId,
    planRevision: plan.revision,
    validationId: validation.validationId,
    action: input.action,
    reviewerId: input.reviewerId.trim(),
    notes: input.notes.trim(),
    reviewedAt: now,
  };
  await observationRepository.saveReview(decision);
  await observationRepository.savePlan({
    ...plan,
    status: input.action === 'approve'
      ? 'reviewed'
      : input.action === 'revision_required'
        ? 'revision_required'
        : 'rejected',
    reviewerId: decision.reviewerId,
    reviewNote: decision.notes,
    reviewedAt: now,
    updatedAt: now,
  });
  return decision;
}

export async function createQuestionDraftFromObservationTask(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  input: {
    planId: string;
    observationTaskPlanId: string;
    content: Omit<CreateStructuredQuestionDraftInput, 'materialVersionId' | 'abilityMetadata' | 'tags'> & { tags?: string[] };
  },
) {
  const plan = await requirePlan(observationRepository, input.planId);
  const task = plan.taskPlans.find((value) => value.observationTaskPlanId === input.observationTaskPlanId);
  if (!task) throw new Error(`Observation Task Plan not found: ${input.observationTaskPlanId}`);
  const draftInput = adaptObservationTaskToQuestionDraft(plan, task, input.content);
  return createStructuredQuestionDraft(resourceRepository, draftInput);
}

export async function linkFrozenResourceToObservationTask(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  input: {
    planId: string;
    observationTaskPlanId: string;
    resourceVersionId: string;
    linkedAt?: string;
  },
): Promise<{ link: ResourceObservationLink; issues: string[] }> {
  const version = await resourceRepository.getVersion(input.resourceVersionId);
  if (!version) throw new Error(`Frozen Resource Version not found: ${input.resourceVersionId}`);
  const registryEntry = await resourceRepository.getRegistryEntry(version.resourceId);
  if (!registryEntry) throw new Error(`Resource Registry Entry not found: ${version.resourceId}`);
  const result = await prepareFrozenResourceObservationLink(
    resourceRepository,
    observationRepository,
    {
      planId: input.planId,
      observationTaskPlanId: input.observationTaskPlanId,
      version,
      registryEntry,
      linkedAt: input.linkedAt,
    },
  );

  if (result.link.status === 'active') {
    const previous = await observationRepository.listLinks(result.link.resourceId);
    for (const link of previous) {
      if (link.status === 'active' && link.resourceObservationLinkId !== result.link.resourceObservationLinkId) {
        await observationRepository.saveLink({ ...link, status: 'superseded' });
      }
    }
  }
  await observationRepository.saveLink(result.link);
  return result;
}

export async function prepareFrozenResourceObservationLink(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  input: {
    planId: string;
    observationTaskPlanId: string;
    version: FrozenQuestionResourceVersion;
    registryEntry: ResourceRegistryEntry;
    linkedAt?: string;
  },
): Promise<{ link: ResourceObservationLink; issues: string[] }> {
  const plan = await requirePlan(observationRepository, input.planId);
  const task = plan.taskPlans.find((value) => value.observationTaskPlanId === input.observationTaskPlanId);
  if (!task) throw new Error(`Observation Task Plan not found: ${input.observationTaskPlanId}`);
  const [validation, review] = await Promise.all([
    resourceRepository.getValidation(input.version.validationId),
    resourceRepository.getReview(input.version.reviewId),
  ]);
  return deriveResourceObservationLink({
    plan,
    task,
    version: input.version,
    registryEntry: input.registryEntry,
    validation,
    review,
    linkedAt: input.linkedAt,
  });
}

export async function createAndSaveFirstFrozenResourcePackManifest(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  input: {
    resourcePackVersion: string;
    coverageReportIdBefore: string;
    coverageReportIdAfter: string;
    frozenAt?: string;
  },
): Promise<FirstFrozenResourcePackManifest> {
  const [plans, links, versions, registryEntries] = await Promise.all([
    observationRepository.listPlans(),
    observationRepository.listLinks(),
    resourceRepository.listVersions(),
    resourceRepository.listRegistryEntries(),
  ]);
  const manifest = buildFirstFrozenResourcePackManifest({ ...input, plans, links, versions, registryEntries });
  return observationRepository.saveManifest(manifest);
}

export async function createObservationDiversityReadModel(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  input: {
    resourcePackId: string;
    registrySnapshotId: string;
    generatedAt?: string;
  },
): Promise<ObservationDiversityView> {
  const manifest = await observationRepository.getManifest(input.resourcePackId);
  if (!manifest) throw new Error(`Resource Pack Manifest not found: ${input.resourcePackId}`);
  const [executableVersions, registryEntries, links] = await Promise.all([
    resourceRepository.listVersions(),
    resourceRepository.listRegistryEntries(),
    observationRepository.listLinks(),
  ]);
  return buildObservationDiversityView({ manifest, executableVersions, registryEntries, links, registrySnapshotId: input.registrySnapshotId, generatedAt: input.generatedAt });
}

async function requirePlan(repository: MaterialObservationRepository, planId: string): Promise<MaterialObservationPlan> {
  const plan = await repository.getPlan(planId);
  if (!plan) throw new Error(`Material Observation Plan not found: ${planId}`);
  return plan;
}

async function findCurrentValidation(
  repository: MaterialObservationRepository,
  plan: MaterialObservationPlan,
): Promise<MaterialObservationPlanValidation | null> {
  const validations = await repository.listValidations(plan.materialObservationPlanId);
  return validations
    .filter((value) => value.planRevision === plan.revision)
    .sort((left, right) => right.checkedAt.localeCompare(left.checkedAt))[0] || null;
}

function productionDraftId(taskId: string): string { return `draft-${taskId}`; }
function productionResourceId(taskId: string): string { return `resource-${taskId}`; }
function productionQuestionId(taskId: string): string { return `question-${taskId}`; }
function buildProductionQuestionDraftContent(
  task: ObservationTaskPlan,
  draftId: string,
  sourceDescription?: string,
  now?: string,
): Omit<CreateStructuredQuestionDraftInput, 'materialVersionId' | 'abilityMetadata' | 'tags'> & { tags?: string[] } {
  const aiAssisted = Boolean(task.resourceDraftSpecification?.tags.includes('ai-assisted'));
  return {
    draftId,
    resourceId: productionResourceId(task.observationTaskPlanId),
    taskId: productionQuestionId(task.observationTaskPlanId),
    title: task.resourceDraftSpecification?.title
      || `${abilityLabel(task.abilityId)} · ${dimensionLabel(task.primaryDimension)}`,
    questionStem: task.observationGoal,
    questionType: task.resourceDraftSpecification?.questionType || 'reading_comprehension',
    responseFormat: task.resourceDraftSpecification?.responseFormat || 'long_text',
    choiceInteraction: task.resourceDraftSpecification?.choiceInteraction,
    assessmentMode: task.resourceDraftSpecification?.assessmentMode || 'reasoning_chain',
    answerAcceptance: task.resourceDraftSpecification?.answerAcceptance
      || { semanticEquivalentAllowed: true, normalizationRules: ['trim', 'ignore_punctuation'] },
    rubric: task.resourceDraftSpecification?.rubric || [{
      itemId: 'primary-observation',
      name: '主要能力动作',
      description: task.expectedStudentAction,
      abilityId: task.abilityId,
      importance: 'critical',
      required: true,
      evidenceRequirement: {
        requireTextEvidence: true,
        requireExplanation: task.abilityId !== 'extraction',
        requireConclusion: true,
      },
      acceptedSignals: [task.expectedStudentAction],
    }],
    minimumAnswerRequirement: task.resourceDraftSpecification?.minimumAnswerRequirement || {
      minLength: task.abilityId === 'extraction' ? 6 : 12,
      requireTextEvidence: true,
      requireExplanation: task.abilityId !== 'extraction',
    },
    source: {
      sourceType: aiAssisted ? 'ai_assisted' : 'manual',
      description: sourceDescription || (aiAssisted
        ? '由人工审核通过的材料观测计划生成。'
        : '由已审核的材料观测计划生成。'),
      copyrightNote: '沿用关联学习材料的来源与版权审核结果。',
    },
    tags: [
      'phase17.2',
      'material-observation',
      ...(task.resourceDraftSpecification?.tags || []),
    ],
    now,
  };
}

function buildProductionQuestionDraftInput(
  plan: MaterialObservationPlan,
  task: ObservationTaskPlan,
  draftId: string,
  sourceDescription?: string,
  now?: string,
): CreateStructuredQuestionDraftInput {
  const content = buildProductionQuestionDraftContent(task, draftId, sourceDescription, now);
  return {
    ...content,
    materialVersionId: plan.materialVersionId,
    abilityMetadata: {
      abilityId: task.abilityId,
      supportingAbilityIds: task.resourceDraftSpecification?.supportingAbilityIds || [],
      prerequisiteAbilityIds: task.resourceDraftSpecification?.prerequisiteAbilityIds || [],
      taskRole: task.taskRole,
      difficulty: task.difficulty,
      gradeRange: task.resourceDraftSpecification?.gradeRange,
      targetedTrainingMetadata: task.targetedTrainingMetadata,
    },
    tags: unique([
      ...(content.tags || []),
      task.taskRole === 'retest' ? 'hint_policy:no_hint' : 'hint_policy:limited_hint',
      `observation_plan:${plan.materialObservationPlanId}`,
      `observation_task:${task.observationTaskPlanId}`,
      `observation_task_root:${task.taskRevisionRootId}`,
      ...(task.parentObservationTaskPlanId
        ? [`observation_task_parent:${task.parentObservationTaskPlanId}`]
        : []),
      `observation_dimension:${task.primaryDimension}`,
      ...(task.observationFocus ? [`observation_focus:${task.observationFocus.focusCode}`] : []),
      ...(task.intendedComparisonGroupId ? [`comparison_group:${task.intendedComparisonGroupId}`] : []),
    ]),
  };
}

async function synchronizeEditableQuestionDraft(
  repository: QuestionResourceAdmissionRepository,
  plan: MaterialObservationPlan,
  task: ObservationTaskPlan,
  draft: StructuredQuestionDraft,
  sourceDescription?: string,
  now?: string,
) {
  if (!draft) throw new Error('Question Draft not found while synchronizing the training task.');
  const desired = buildProductionQuestionDraftInput(plan, task, draft.draftId, sourceDescription, now);
  return updateStructuredQuestionDraft(repository, draft.draftId, {
    materialVersionId: desired.materialVersionId,
    title: desired.title,
    questionStem: desired.questionStem,
    questionType: desired.questionType,
    responseFormat: desired.responseFormat,
    options: desired.options,
    choiceInteraction: desired.choiceInteraction,
    assessmentMode: desired.assessmentMode,
    answerAcceptance: desired.answerAcceptance,
    rubric: desired.rubric,
    minimumAnswerRequirement: desired.minimumAnswerRequirement,
    abilityMetadata: desired.abilityMetadata,
    source: desired.source,
    tags: desired.tags,
  }, now || new Date().toISOString(), { expectedRevision: draft.revision });
}

function findActiveDraftForObservationTask(
  drafts: StructuredQuestionDraft[],
  task: ObservationTaskPlan,
): StructuredQuestionDraft | undefined {
  const lineageTags = unique([
    `observation_task:${task.observationTaskPlanId}`,
    `observation_task_root:${task.taskRevisionRootId}`,
    ...(task.parentObservationTaskPlanId
      ? [`observation_task:${task.parentObservationTaskPlanId}`]
      : []),
  ]);
  return drafts
    .filter((draft) => draft.status !== 'archived' && lineageTags.some((tag) => draft.tags.includes(tag)))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}
function archivedRevisionDraftId(baseDraftId: string): string {
  const randomSuffix = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36);
  return `${baseDraftId}-revision-${randomSuffix}`;
}
function normalize(value: string): string { return value.trim().replace(/\s+/g, ' ').toLowerCase(); }
function unique(values: string[]): string[] { return [...new Set(values)].sort(); }
function abilityLabel(value: PrimaryAbilityId): string {
  return ({ extraction: '信息提取', comprehension: '理解', summarization: '概括', analysis: '分析', inference: '推理', expression: '表达' })[value];
}
function dimensionLabel(value: ObservationDimension): string {
  return ({ fact: '事实', character: '人物', plot: '情节', causality: '因果', structure: '结构', language: '语言', theme: '主题' })[value];
}

function productionTaskInputToObservationTaskInput(
  task: MaterialProductionTaskInput,
  sourceAnchorIds: string[],
) {
  return {
    primaryDimension: task.primaryDimension,
    observationFocus: task.observationFocus,
    abilityId: task.abilityId,
    taskRole: task.taskRole,
    difficulty: task.difficulty,
    sourceAnchorIds,
    observationGoal: task.questionStem,
    expectedStudentAction: task.expectedStudentAction,
    designReason: task.designReason,
    intendedComparisonGroupId: task.intendedComparisonGroupId,
    materialRelationIntent: task.materialRelationIntent,
    resourceDraftSpecification: task.resourceDraftSpecification,
    calibrationCases: task.calibrationCases,
  };
}

function observationTaskToInput(task: ObservationTaskPlan, preserveIdentity: boolean) {
  return {
    observationTaskPlanId: preserveIdentity ? task.observationTaskPlanId : undefined,
    taskRevisionRootId: task.taskRevisionRootId || task.observationTaskPlanId,
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
  };
}

async function requireSingleTaskAnchor(
  repository: MaterialObservationRepository,
  task: ObservationTaskPlan,
): Promise<MaterialSourceAnchor> {
  if (task.sourceAnchorIds.length !== 1) {
    throw new Error('Single-task regeneration requires exactly one locked material anchor.');
  }
  const anchor = await repository.getAnchor(task.sourceAnchorIds[0]);
  if (!anchor) throw new Error(`Material Source Anchor not found: ${task.sourceAnchorIds[0]}`);
  return anchor;
}

function assertSingleTaskLockedFields(
  sourceTask: ObservationTaskPlan,
  sourceAnchor: MaterialSourceAnchor,
  replacement: MaterialProductionTaskInput,
): void {
  const mismatches: string[] = [];
  if (replacement.primaryDimension !== sourceTask.primaryDimension) mismatches.push('primaryDimension');
  if (replacement.abilityId !== sourceTask.abilityId) mismatches.push('abilityId');
  if (replacement.taskRole !== sourceTask.taskRole) mismatches.push('taskRole');
  if (replacement.difficulty !== sourceTask.difficulty) mismatches.push('difficulty');
  if (replacement.anchorType && replacement.anchorType !== sourceAnchor.anchorType) mismatches.push('anchorType');
  if (sourceAnchor.anchorType !== 'full_text') {
    if (replacement.startParagraph && replacement.startParagraph !== sourceAnchor.startParagraph) mismatches.push('startParagraph');
    if (
      sourceAnchor.anchorType === 'paragraph_range'
      && replacement.endParagraph
      && replacement.endParagraph !== sourceAnchor.endParagraph
    ) mismatches.push('endParagraph');
  }
  if (mismatches.length) {
    throw new Error(`Single-task regeneration cannot change locked fields: ${unique(mismatches).join(', ')}`);
  }
}

function observationTaskComparable(task: Partial<ObservationTaskPlan>): string {
  return JSON.stringify({
    observationFocus: task.observationFocus || null,
    observationGoal: normalize(task.observationGoal || ''),
    expectedStudentAction: normalize(task.expectedStudentAction || ''),
    designReason: normalize(task.designReason || ''),
    intendedComparisonGroupId: task.intendedComparisonGroupId || '',
    materialRelationIntent: task.materialRelationIntent || '',
    resourceDraftSpecification: task.resourceDraftSpecification || null,
    calibrationCases: task.calibrationCases || null,
  });
}
