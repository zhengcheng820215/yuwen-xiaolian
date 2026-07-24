import {
  PHASE17_BATCH_A_CREATED_AT,
  PHASE17_BATCH_A_EXPECTED,
  PHASE17_BATCH_A_MATERIALS,
  PHASE17_BATCH_A_VERSION,
  type BatchAMaterialDefinition,
  type BatchAResourceDefinition,
} from '../../data/phase17BatchAFormalResources.ts';
import type { MaterialObservationRepository } from '../repositories/materialObservationRepository.ts';
import type { QuestionResourceAdmissionRepository } from '../repositories/questionResourceAdmissionRepository.ts';
import type {
  MaterialObservationPlan,
  ResourceObservationLink,
} from '../schemas/materialObservation.schema.ts';
import type {
  FrozenQuestionResourceVersion,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  createMaterialProductionPlan,
  createQuestionDraftFromObservationTask,
  linkFrozenResourceToObservationTask,
  reviewMaterialObservationPlan,
  submitMaterialObservationPlanForReview,
} from './materialObservationApplicationService.ts';
import {
  createQuestionMaterial,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  validateResourceRegistryConsistency,
  validateStructuredQuestionDraft,
} from './questionResourceAdmissionAgent.ts';
import { generateCurrentResourceCoverage } from './resourceCoverageApplicationService.ts';

export type Phase17BatchATargetState =
  | 'plans_pending_review'
  | 'drafts_pending_review'
  | 'controlled_frozen';

export type Phase17BatchAProductionResult = {
  targetState: Phase17BatchATargetState;
  materialVersionIds: string[];
  materialObservationPlanIds: string[];
  draftIds: string[];
  resourceVersionIds: string[];
  resourceObservationLinkIds: string[];
  activeRegistryCount: number;
  runtimeVerifiedCount: number;
  abilityIds: string[];
  taskRoleBreakdown: {
    training: number;
    retest: number;
    transfer: number;
  };
  registryConsistencyPassed: boolean;
  coverageReportId?: string;
  issues: string[];
};

export type Phase17BatchAProductionInput = {
  resourceRepository: QuestionResourceAdmissionRepository;
  observationRepository: MaterialObservationRepository;
  targetState: Phase17BatchATargetState;
  materialVersionIds?: string[];
  reviewerId?: string;
  reviewNote?: string;
  now?: string;
};

export async function producePhase17BatchA(
  input: Phase17BatchAProductionInput,
): Promise<Phase17BatchAProductionResult> {
  if (input.targetState === 'controlled_frozen' && (!input.reviewerId?.trim() || !input.reviewNote?.trim())) {
    throw new Error('Controlled formalization requires an explicit reviewerId and reviewNote.');
  }

  const now = input.now || PHASE17_BATCH_A_CREATED_AT;
  const plans: MaterialObservationPlan[] = [];
  const drafts: StructuredQuestionDraft[] = [];
  const versions: FrozenQuestionResourceVersion[] = [];
  const links: ResourceObservationLink[] = [];
  const issues: string[] = [];

  const selectedMaterials = input.materialVersionIds?.length
    ? PHASE17_BATCH_A_MATERIALS.filter((material) => input.materialVersionIds!.includes(material.materialVersionId))
    : PHASE17_BATCH_A_MATERIALS;
  if (selectedMaterials.length === 0) throw new Error('No Batch A Material matched the requested selection.');

  for (const materialDefinition of selectedMaterials) {
    const material = await ensureMaterial(input.resourceRepository, materialDefinition, now);
    const plan = await ensurePlan(
      input.resourceRepository,
      input.observationRepository,
      materialDefinition,
      now,
    );
    plans.push(plan);

    const readyPlan = await advancePlan(
      input.resourceRepository,
      input.observationRepository,
      plan,
      input,
      now,
    );
    if (input.targetState === 'plans_pending_review') continue;
    if (readyPlan.status !== 'reviewed') {
      throw new Error(`Batch A Plan requires review before Draft production: ${readyPlan.materialObservationPlanId}`);
    }

    for (let index = 0; index < materialDefinition.tasks.length; index += 1) {
      const definition = materialDefinition.tasks[index];
      const task = readyPlan.taskPlans[index];
      if (!task) throw new Error(`Batch A Observation Task is missing at index ${index}.`);
      assertTaskAlignment(task, definition);

      const draft = await ensureDraft(
        input.resourceRepository,
        input.observationRepository,
        readyPlan,
        task.observationTaskPlanId,
        definition,
        now,
      );
      const validated = ['drafted', 'validation_failed', 'revision_required'].includes(draft.status)
        ? await validateStructuredQuestionDraft(input.resourceRepository, draft.draftId, now)
        : draft.latestValidationId
          ? await input.resourceRepository.getValidation(draft.latestValidationId)
          : null;
      if (!validated) {
        issues.push(`${definition.resourceKey}:current_validation_missing`);
        continue;
      }
      if (!validated.passed) {
        issues.push(...validated.issues.map((issue) => `${definition.resourceKey}:${issue.code}`));
        continue;
      }

      const currentDraft = await requireDraft(input.resourceRepository, draft.draftId);
      const submitted = currentDraft.status === 'drafted'
        ? await submitQuestionResourceForReview(input.resourceRepository, draft.draftId, now)
        : currentDraft;
      drafts.push(submitted);

      if (input.targetState === 'drafts_pending_review') continue;
      const reviewed = submitted.status === 'pending_review'
        ? await reviewAndRequireApproval(input.resourceRepository, submitted.draftId, input, now)
        : submitted;
      if (reviewed.status !== 'reviewed') {
        throw new Error(`Batch A Draft requires approval before Freeze: ${reviewed.draftId}`);
      }

      const frozen = await freezeQuestionResourceDraft(input.resourceRepository, reviewed.draftId, now);
      versions.push(frozen.version);
      const linked = await linkFrozenResourceToObservationTask(
        input.resourceRepository,
        input.observationRepository,
        {
          planId: readyPlan.materialObservationPlanId,
          observationTaskPlanId: task.observationTaskPlanId,
          resourceVersionId: frozen.version.resourceVersionId,
          linkedAt: now,
        },
      );
      links.push(linked.link);
      issues.push(...linked.issues.map((issue) => `${definition.resourceKey}:${issue}`));
    }
  }

  const [registryEntries, allVersions, allLinks, consistency, coverage] = await Promise.all([
    input.resourceRepository.listRegistryEntries(),
    input.resourceRepository.listVersions(),
    input.observationRepository.listLinks(),
    validateResourceRegistryConsistency(input.resourceRepository),
    generateCurrentResourceCoverage({
      repository: input.resourceRepository,
      generatedAt: now,
    }),
  ]);
  const batchResourceIds = new Set(flatDefinitions().map((definition) => resourceId(definition.resourceKey)));
  const batchRegistry = registryEntries.filter((entry) => batchResourceIds.has(entry.resourceId) && entry.status === 'active');
  const currentVersionIds = new Set(batchRegistry.map((entry) => entry.currentFrozenVersionId).filter(Boolean));
  const batchVersions = allVersions.filter((version) => currentVersionIds.has(version.resourceVersionId));
  const activeLinks = allLinks.filter((link) => (
    link.status === 'active' &&
    batchResourceIds.has(link.resourceId) &&
    currentVersionIds.has(link.resourceVersionId)
  ));

  return {
    targetState: input.targetState,
    materialVersionIds: selectedMaterials.map((material) => material.materialVersionId),
    materialObservationPlanIds: plans.map((plan) => plan.materialObservationPlanId),
    draftIds: unique(drafts.map((draft) => draft.draftId)),
    resourceVersionIds: unique([...versions, ...batchVersions].map((version) => version.resourceVersionId)),
    resourceObservationLinkIds: unique([...links, ...activeLinks].map((link) => link.resourceObservationLinkId)),
    activeRegistryCount: batchRegistry.length,
    runtimeVerifiedCount: activeLinks.length,
    abilityIds: unique(batchVersions.map((version) => version.abilityMetadata.abilityId)),
    taskRoleBreakdown: {
      training: batchVersions.filter((version) => version.abilityMetadata.taskRole === 'training').length,
      retest: batchVersions.filter((version) => version.abilityMetadata.taskRole === 'retest').length,
      transfer: batchVersions.filter((version) => version.abilityMetadata.taskRole === 'transfer').length,
    },
    registryConsistencyPassed: consistency.passed,
    coverageReportId: coverage.status === 'complete' ? coverage.report.reportId : undefined,
    issues: unique([
      ...issues,
      ...consistency.issues,
      ...(coverage.status === 'blocked' ? coverage.issues : []),
    ]),
  };
}

async function ensureMaterial(
  repository: QuestionResourceAdmissionRepository,
  definition: BatchAMaterialDefinition,
  now: string,
) {
  const existing = await repository.getMaterial(definition.materialVersionId);
  if (existing) {
    if (
      existing.materialId !== definition.materialId ||
      existing.title !== definition.title ||
      existing.content !== definition.content
    ) {
      throw new Error(`Batch A Material identity or content conflict: ${definition.materialVersionId}`);
    }
    return existing;
  }
  return createQuestionMaterial(repository, {
    materialId: definition.materialId,
    materialVersionId: definition.materialVersionId,
    versionNumber: 1,
    title: definition.title,
    content: definition.content,
    source: {
      sourceType: 'ai_assisted',
      description: definition.sourceDescription,
      copyrightNote: definition.copyrightNote,
    },
    createdAt: now,
    updatedAt: now,
  });
}

async function ensurePlan(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  definition: BatchAMaterialDefinition,
  now: string,
): Promise<MaterialObservationPlan> {
  const existing = (await observationRepository.listPlans(definition.materialVersionId))
    .sort((left, right) => right.revision - left.revision)[0];
  if (existing) {
    if (existing.taskPlans.length !== definition.tasks.length) {
      throw new Error(`Batch A Plan task count conflict: ${definition.materialVersionId}`);
    }
    existing.taskPlans.forEach((task, index) => assertTaskAlignment(task, definition.tasks[index]));
    return existing;
  }
  const created = await createMaterialProductionPlan(
    resourceRepository,
    observationRepository,
    {
      materialVersionId: definition.materialVersionId,
      tasks: definition.tasks.map(toProductionTask),
      now,
    },
  );
  if (!created.validation.passed) {
    throw new Error(`Batch A Material Observation Plan validation failed: ${definition.materialVersionId}`);
  }
  return created.plan;
}

async function advancePlan(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  plan: MaterialObservationPlan,
  input: Phase17BatchAProductionInput,
  now: string,
): Promise<MaterialObservationPlan> {
  let current = plan;
  if (['draft', 'revision_required'].includes(current.status)) {
    current = await submitMaterialObservationPlanForReview(
      resourceRepository,
      observationRepository,
      current.materialObservationPlanId,
      now,
    );
  }
  if (input.targetState !== 'plans_pending_review' && current.status === 'pending_review') {
    if (!input.reviewerId?.trim() || !input.reviewNote?.trim()) {
      throw new Error('Draft production requires an explicitly reviewed Material Observation Plan.');
    }
    await reviewMaterialObservationPlan(observationRepository, {
      planId: current.materialObservationPlanId,
      action: 'approve',
      reviewerId: input.reviewerId,
      notes: input.reviewNote,
      now,
    });
    current = (await observationRepository.getPlan(current.materialObservationPlanId)) || current;
  }
  return current;
}

async function ensureDraft(
  resourceRepository: QuestionResourceAdmissionRepository,
  observationRepository: MaterialObservationRepository,
  plan: MaterialObservationPlan,
  observationTaskPlanId: string,
  definition: BatchAResourceDefinition,
  now: string,
): Promise<StructuredQuestionDraft> {
  const stableDraftId = draftId(definition.resourceKey);
  const existing = await resourceRepository.getDraft(stableDraftId);
  if (existing) {
    if (
      existing.resourceId !== resourceId(definition.resourceKey) ||
      existing.materialVersionId !== plan.materialVersionId ||
      existing.questionStem !== definition.questionStem ||
      existing.abilityMetadata.abilityId !== definition.abilityId ||
      existing.abilityMetadata.taskRole !== definition.taskRole
    ) {
      throw new Error(`Batch A Draft identity or content conflict: ${stableDraftId}`);
    }
    return existing;
  }

  return createQuestionDraftFromObservationTask(resourceRepository, observationRepository, {
    planId: plan.materialObservationPlanId,
    observationTaskPlanId,
    content: {
      draftId: stableDraftId,
      resourceId: resourceId(definition.resourceKey),
      taskId: taskId(definition.resourceKey),
      title: definition.title,
      questionStem: definition.questionStem,
      questionType: 'reading_comprehension',
      responseFormat: definition.responseFormat,
      assessmentMode: definition.assessmentMode,
      answerAcceptance: definition.answerAcceptance,
      rubric: definition.rubric,
      minimumAnswerRequirement: definition.minimumAnswerRequirement,
      source: {
        sourceType: 'ai_assisted',
        description: `Phase 17 Batch A 正式资源：${definition.resourceKey}。已按材料观测目标进行受控设计。`,
        copyrightNote: '沿用关联学习材料的项目原创版权声明；正式对外使用前需完成内容负责人复核。',
      },
      tags: [
        'phase17',
        'phase17.2',
        'phase17-batch-a',
        definition.taskRole === 'retest'
          ? 'hint_policy:no_hint'
          : 'hint_policy:limited_hint',
        `material_relation:${definition.materialRelationIntent || 'same_context'}`,
        `batch_a_resource:${definition.resourceKey}`,
        ...(definition.planningChainKey ? [`planning_chain:${definition.planningChainKey}`] : []),
      ],
      now,
    },
  });
}

async function reviewAndRequireApproval(
  repository: QuestionResourceAdmissionRepository,
  draftIdValue: string,
  input: Phase17BatchAProductionInput,
  now: string,
): Promise<StructuredQuestionDraft> {
  await reviewQuestionResourceDraft(repository, {
    draftId: draftIdValue,
    action: 'approve',
    reviewerId: input.reviewerId!,
    notes: input.reviewNote!,
    now,
  });
  return requireDraft(repository, draftIdValue);
}

async function requireDraft(
  repository: QuestionResourceAdmissionRepository,
  id: string,
): Promise<StructuredQuestionDraft> {
  const draft = await repository.getDraft(id);
  if (!draft) throw new Error(`Batch A Draft not found: ${id}`);
  return draft;
}

function assertTaskAlignment(
  task: MaterialObservationPlan['taskPlans'][number],
  definition: BatchAResourceDefinition,
): void {
  if (
    task.primaryDimension !== definition.primaryDimension ||
    task.abilityId !== definition.abilityId ||
    task.taskRole !== definition.taskRole ||
    task.difficulty !== definition.difficulty ||
    task.observationGoal !== definition.questionStem
  ) {
    throw new Error(`Batch A Task Plan drifted from frozen blueprint: ${definition.resourceKey}`);
  }
}

function toProductionTask(definition: BatchAResourceDefinition) {
  return {
    primaryDimension: definition.primaryDimension,
    abilityId: definition.abilityId,
    taskRole: definition.taskRole,
    difficulty: definition.difficulty,
    startParagraph: definition.startParagraph,
    endParagraph: definition.endParagraph,
    questionStem: definition.questionStem,
    expectedStudentAction: definition.expectedStudentAction,
    designReason: definition.designReason,
    intendedComparisonGroupId: definition.planningChainKey,
    materialRelationIntent: definition.materialRelationIntent,
  };
}

function flatDefinitions(): BatchAResourceDefinition[] {
  return PHASE17_BATCH_A_MATERIALS.flatMap((material) => material.tasks);
}

export function validatePhase17BatchABlueprint(): string[] {
  const definitions = flatDefinitions();
  const issues: string[] = [];
  if (PHASE17_BATCH_A_MATERIALS.length !== PHASE17_BATCH_A_EXPECTED.materialCount) issues.push('material_count_mismatch');
  if (definitions.length !== PHASE17_BATCH_A_EXPECTED.resourceCount) issues.push('resource_count_mismatch');
  if (new Set(definitions.map((definition) => definition.resourceKey)).size !== definitions.length) issues.push('duplicate_resource_key');
  if (new Set(definitions.map((definition) => definition.questionStem)).size !== definitions.length) issues.push('duplicate_question_stem');
  const abilities = unique(definitions.map((definition) => definition.abilityId));
  if (abilities.length !== PHASE17_BATCH_A_EXPECTED.abilities.length || PHASE17_BATCH_A_EXPECTED.abilities.some((ability) => !abilities.includes(ability))) {
    issues.push('ability_coverage_mismatch');
  }
  if (definitions.filter((definition) => definition.taskRole === 'training').length !== PHASE17_BATCH_A_EXPECTED.trainingCount) issues.push('training_count_mismatch');
  if (definitions.filter((definition) => definition.taskRole === 'retest').length !== PHASE17_BATCH_A_EXPECTED.retestCount) issues.push('retest_count_mismatch');
  if (definitions.filter((definition) => definition.taskRole === 'transfer').length !== PHASE17_BATCH_A_EXPECTED.transferCount) issues.push('transfer_count_mismatch');
  for (const chainKey of PHASE17_BATCH_A_EXPECTED.coreChainKeys) {
    const chain = definitions.filter((definition) => definition.planningChainKey === chainKey);
    if (chain.length !== 2 || new Set(chain.map((definition) => definition.abilityId)).size !== 1) {
      issues.push(`invalid_core_chain:${chainKey}`);
    }
  }
  return unique(issues);
}

export function isPhase17BatchAMaterial(materialVersionId: string): boolean {
  return PHASE17_BATCH_A_MATERIALS.some((material) => material.materialVersionId === materialVersionId);
}

export function batchAResourceDefinitions(): BatchAResourceDefinition[] {
  return flatDefinitions().map((definition) => JSON.parse(JSON.stringify(definition)) as BatchAResourceDefinition);
}

function draftId(key: string): string {
  return `phase17-batch-a-draft-${key}`;
}

function resourceId(key: string): string {
  return `phase17-batch-a-resource-${key}`;
}

function taskId(key: string): string {
  return `phase17-batch-a-task-${key}`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export const PHASE17_BATCH_A_PRODUCTION_VERSION = PHASE17_BATCH_A_VERSION;
