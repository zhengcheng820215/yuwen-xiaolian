import { buildStableId } from './reviewedResourceCandidateAdapter.ts';
import {
  PRIMARY_ABILITY_IDS,
  QUESTION_RESOURCE_DIFFICULTIES,
  QUESTION_RESOURCE_TASK_ROLES,
  isPrimaryAbilityId,
  isQuestionResourceDifficulty,
  isQuestionResourceTaskRole,
  isMinimumAnswerRequirement,
  type FrozenQuestionResourceVersion,
  type PrimaryAbilityId,
  type QuestionMaterialVersion,
  type ResourceRegistryEntry,
  type ResourceReviewDecision,
  type ResourceValidationResult,
  type StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import {
  isSingleChoiceInteraction,
  isSingleChoiceMinimumResponseRequirement,
} from '../schemas/singleChoiceInteraction.schema.ts';
import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import type { CreateStructuredQuestionDraftInput } from './questionResourceAdmissionAgent.ts';
import {
  projectTargetedMaterialUsage,
  validateTargetedTrainingResourceMetadata,
} from '../schemas/targetedMicroTraining.schema.ts';
import {
  FIRST_FROZEN_RESOURCE_PACK_SCHEMA_VERSION,
  MATERIAL_OBSERVATION_PLAN_SCHEMA_VERSION,
  OBSERVATION_DIMENSIONS,
  RESOURCE_OBSERVATION_LINK_SCHEMA_VERSION,
  emptyAbilityBreakdown,
  emptyDifficultyBreakdown,
  emptyDimensionBreakdown,
  emptyTaskRoleBreakdown,
  isObservationDimension,
  type AbilityObservationDiversity,
  type DimensionReview,
  type FirstFrozenResourcePackManifest,
  type MaterialObservationPlan,
  type MaterialObservationPlanValidation,
  type MaterialSourceAnchor,
  type MaterialStructureSnapshot,
  type ObservationDimension,
  type ObservationDiversityView,
  type ObservationCalibrationCase,
  type ObservationFocus,
  type ObservationResourceDraftSpecification,
  type ObservationTaskPlan,
  type ResourceObservationLink,
} from '../schemas/materialObservation.schema.ts';
import {
  cloneTaskLoadSemantics,
  isTaskLoadSemantics,
  type TaskLoadSemantics,
} from '../schemas/readingTaskLoadSemantics.schema.ts';
import { READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION } from
  '../schemas/readingTrainingProgressionAudit.schema.ts';
import {
  READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
  isTaskGroupProgressionPlan,
  validateProgressionPlanAgainstSemantics,
  type TaskGroupProgressionPlan,
} from '../schemas/readingTaskGroupProgression.schema.ts';

export type ObservationTaskPlanInput = {
  observationTaskPlanId?: string;
  taskRevisionRootId?: string;
  parentObservationTaskPlanId?: string;
  regenerationAttemptId?: string;
  primaryDimension: ObservationDimension;
  observationFocus?: ObservationFocus;
  abilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
  difficulty: ObservationTaskPlan['difficulty'];
  targetedTrainingMetadata?: ObservationTaskPlan['targetedTrainingMetadata'];
  sourceAnchorIds: string[];
  observationGoal: string;
  expectedStudentAction: string;
  designReason: string;
  intendedComparisonGroupId?: string;
  materialRelationIntent?: ObservationTaskPlan['materialRelationIntent'];
  resourceDraftSpecification?: ObservationResourceDraftSpecification;
  calibrationCases?: ObservationCalibrationCase[];
  taskLoadSemantics?: TaskLoadSemantics;
  planningTaskKey?: string;
  taskGroupProgressionPlanHash?: string;
};

export function deriveMaterialStructureSnapshot(
  material: QuestionMaterialVersion,
  createdAt = new Date().toISOString(),
): MaterialStructureSnapshot {
  const paragraphs = normalizeParagraphs(material.content);
  const paragraphHashes = paragraphs.map((paragraph, index) => (
    buildStableId('material-paragraph', [material.materialVersionId, String(index + 1), paragraph])
  ));
  const contentHash = buildStableId('material-content', [material.materialVersionId, ...paragraphHashes]);
  return {
    materialStructureSnapshotId: buildStableId('material-structure', [
      material.materialId,
      material.materialVersionId,
      contentHash,
    ]),
    materialId: material.materialId,
    materialVersionId: material.materialVersionId,
    paragraphCount: paragraphs.length,
    paragraphHashes,
    contentHash,
    createdAt,
  };
}

export function createMaterialSourceAnchor(input: {
  material: QuestionMaterialVersion;
  structure: MaterialStructureSnapshot;
  anchorType: MaterialSourceAnchor['anchorType'];
  startParagraph?: number;
  endParagraph?: number;
}): MaterialSourceAnchor {
  const { material, structure } = input;
  if (structure.materialId !== material.materialId || structure.materialVersionId !== material.materialVersionId) {
    throw new Error('Source Anchor Material identity mismatch.');
  }
  const current = deriveMaterialStructureSnapshot(material, structure.createdAt);
  if (current.contentHash !== structure.contentHash) throw new Error('Source Anchor contentHash is stale.');
  const paragraphs = normalizeParagraphs(material.content);
  const range = normalizeAnchorRange(input.anchorType, input.startParagraph, input.endParagraph, paragraphs.length);
  const excerpt = input.anchorType === 'full_text'
    ? undefined
    : paragraphs.slice(range.start - 1, range.end).join('\n');
  return {
    sourceAnchorId: buildStableId('material-source-anchor', [
      structure.materialStructureSnapshotId,
      input.anchorType,
      String(range.start),
      String(range.end),
    ]),
    materialId: material.materialId,
    materialVersionId: material.materialVersionId,
    anchorType: input.anchorType,
    startParagraph: input.anchorType === 'full_text' ? undefined : range.start,
    endParagraph: input.anchorType === 'paragraph_range' ? range.end : undefined,
    excerpt,
    contentHash: structure.contentHash,
  };
}

export function buildMaterialObservationPlan(input: {
  materialObservationPlanId?: string;
  materialId: string;
  materialVersionId: string;
  materialStructureSnapshotId: string;
  revision?: number;
  parentPlanId?: string;
  createdAt?: string;
  regenerationContext?: MaterialObservationPlan['regenerationContext'];
  trainingModelPolicyVersion?: MaterialObservationPlan['trainingModelPolicyVersion'];
  progressionStageRuleVersion?: MaterialObservationPlan['progressionStageRuleVersion'];
  taskGroupProgressionPlan?: TaskGroupProgressionPlan;
  dimensionReviews: DimensionReview[];
  taskPlans: ObservationTaskPlanInput[];
  now?: string;
}): MaterialObservationPlan {
  const revision = input.revision || 1;
  const now = input.now || new Date().toISOString();
  const planId = input.materialObservationPlanId || buildStableId('material-observation-plan', [
    input.materialId,
    input.materialVersionId,
    String(revision),
    input.parentPlanId || 'root',
  ]);
  const taskPlans = input.taskPlans.map((task, index): ObservationTaskPlan => {
    const observationTaskPlanId = task.observationTaskPlanId || buildStableId('observation-task-plan', [
      planId,
      String(index),
      stableStringify(task),
    ]);
    return {
      ...clone(task),
      observationTaskPlanId,
      taskRevisionRootId: task.taskRevisionRootId || observationTaskPlanId,
      materialObservationPlanId: planId,
      materialId: input.materialId,
      materialVersionId: input.materialVersionId,
      sourceAnchorIds: uniqueSorted(task.sourceAnchorIds),
      observationGoal: task.observationGoal.trim(),
      expectedStudentAction: task.expectedStudentAction.trim(),
      designReason: task.designReason.trim(),
      status: 'planned',
      taskLoadSemantics: cloneTaskLoadSemantics(task.taskLoadSemantics),
      planningTaskKey: task.planningTaskKey,
      taskGroupProgressionPlanHash: task.taskGroupProgressionPlanHash,
    };
  });
  return {
    materialObservationPlanId: planId,
    materialId: input.materialId,
    materialVersionId: input.materialVersionId,
    materialStructureSnapshotId: input.materialStructureSnapshotId,
    revision,
    status: 'draft',
    dimensionReviews: clone(input.dimensionReviews).map((review) => ({
      ...review,
      reason: review.reason.trim(),
      sourceAnchorIds: uniqueSorted(review.sourceAnchorIds),
    })),
    taskPlans,
    parentPlanId: input.parentPlanId,
    regenerationContext: input.regenerationContext,
    trainingModelPolicyVersion: input.trainingModelPolicyVersion,
    progressionStageRuleVersion: input.progressionStageRuleVersion,
    taskGroupProgressionPlan: input.taskGroupProgressionPlan
      ? clone(input.taskGroupProgressionPlan)
      : undefined,
    createdAt: input.createdAt || now,
    updatedAt: now,
    schemaVersion: MATERIAL_OBSERVATION_PLAN_SCHEMA_VERSION,
  };
}

export function validateMaterialObservationPlan(input: {
  plan: MaterialObservationPlan;
  material?: QuestionMaterialVersion | null;
  structure?: MaterialStructureSnapshot | null;
  anchors: MaterialSourceAnchor[];
  checkedAt?: string;
}): MaterialObservationPlanValidation {
  const { plan, material, structure } = input;
  const issues: MaterialObservationPlanValidation['issues'] = [];
  if (!material) error(issues, 'material.missing', 'materialVersionId', 'Referenced Material Version is missing.');
  else if (material.materialId !== plan.materialId || material.materialVersionId !== plan.materialVersionId) {
    error(issues, 'material.identity_mismatch', 'materialVersionId', 'Material identity does not match the Plan.');
  }
  if (!structure) error(issues, 'structure.missing', 'materialStructureSnapshotId', 'Material Structure Snapshot is missing.');
  else {
    if (structure.materialStructureSnapshotId !== plan.materialStructureSnapshotId || structure.materialVersionId !== plan.materialVersionId) {
      error(issues, 'structure.identity_mismatch', 'materialStructureSnapshotId', 'Structure Snapshot does not match the Plan.');
    }
    if (material && deriveMaterialStructureSnapshot(material, structure.createdAt).contentHash !== structure.contentHash) {
      error(issues, 'structure.content_stale', 'materialStructureSnapshotId', 'Structure Snapshot content is stale.');
    }
  }
  const dimensionValues = plan.dimensionReviews.map((review) => review.dimension);
  if (dimensionValues.length !== OBSERVATION_DIMENSIONS.length || new Set(dimensionValues).size !== OBSERVATION_DIMENSIONS.length || OBSERVATION_DIMENSIONS.some((value) => !dimensionValues.includes(value))) {
    error(issues, 'dimension_review.incomplete', 'dimensionReviews', 'All V1 Observation Dimensions must be reviewed exactly once.');
  }
  plan.dimensionReviews.forEach((review, index) => {
    if (!isObservationDimension(review.dimension)) error(issues, 'dimension.invalid', `dimensionReviews.${index}.dimension`, 'Observation Dimension is not registered.');
    if (!['selected', 'not_suitable', 'not_reviewed'].includes(review.decision)) error(issues, 'dimension_decision.invalid', `dimensionReviews.${index}.decision`, 'Dimension decision is invalid.');
    if (!nonEmpty(review.reason)) error(issues, 'dimension_reason.missing', `dimensionReviews.${index}.reason`, 'Dimension review reason is required.');
    if (review.decision === 'selected' && review.sourceAnchorIds.length === 0) error(issues, 'dimension_anchor.missing', `dimensionReviews.${index}.sourceAnchorIds`, 'Selected Dimension requires a Source Anchor.');
  });
  const anchorMap = new Map(input.anchors.map((anchor) => [anchor.sourceAnchorId, anchor]));
  const referencedAnchorIds = uniqueSorted([
    ...plan.dimensionReviews.flatMap((review) => review.sourceAnchorIds),
    ...plan.taskPlans.flatMap((task) => task.sourceAnchorIds),
  ]);
  referencedAnchorIds.forEach((anchorId) => {
    const anchor = anchorMap.get(anchorId);
    if (!anchor) error(issues, 'anchor.missing', 'sourceAnchorIds', `Source Anchor is missing: ${anchorId}`);
    else if (!structure || anchor.materialVersionId !== plan.materialVersionId || anchor.materialId !== plan.materialId || anchor.contentHash !== structure.contentHash) {
      error(issues, 'anchor.identity_mismatch', 'sourceAnchorIds', `Source Anchor is stale or mismatched: ${anchorId}`);
    }
  });
  plan.taskPlans.forEach((task, index) => validateTaskPlan(plan, task, index, issues));
  if (plan.progressionStageRuleVersion === READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION) {
    if (!plan.taskGroupProgressionPlan || !isTaskGroupProgressionPlan(plan.taskGroupProgressionPlan)) {
      error(issues, 'progression.plan_missing_or_invalid', 'taskGroupProgressionPlan', 'Stage 2 Plan requires one complete authoritative Task Group Progression Plan.');
    } else {
      if (plan.taskGroupProgressionPlan.observationPlanRevisionId
        !== `observation-plan:${plan.revision}`) {
        error(
          issues,
          'progression.plan_revision_mismatch',
          'taskGroupProgressionPlan.observationPlanRevisionId',
          'Task Group Progression Plan revision identity must match the saved Observation Plan revision.',
        );
      }
      const semanticsByTaskKey = new Map(plan.taskPlans
        .filter((task) => task.planningTaskKey && task.taskLoadSemantics)
        .map((task) => [task.planningTaskKey!, task.taskLoadSemantics!]));
      validateProgressionPlanAgainstSemantics({
        plan: plan.taskGroupProgressionPlan,
        semanticsByTaskKey,
      }).forEach((issue) => error(
        issues,
        'progression.plan_semantics_mismatch',
        'taskGroupProgressionPlan',
        issue,
      ));
      plan.taskPlans.forEach((task, index) => {
        if (!task.planningTaskKey?.trim()) {
          error(issues, 'progression.task_key_missing', `taskPlans.${index}.planningTaskKey`, 'Stage 2 Task requires a Planning Task Key.');
        }
        if (task.taskGroupProgressionPlanHash !== plan.taskGroupProgressionPlan?.planHash) {
          error(issues, 'progression.task_plan_hash_mismatch', `taskPlans.${index}.taskGroupProgressionPlanHash`, 'Task Plan Hash must match its authoritative group progression plan.');
        }
      });
    }
  }
  if (material) {
    const usage = projectTargetedMaterialUsage(material);
    if (usage.usageType === 'targeted_excerpt') {
      if (plan.taskPlans.length < 1 || plan.taskPlans.length > 2) {
        error(issues, 'targeted.task_count', 'taskPlans', 'Targeted excerpt Plan requires one or two tasks.');
      }
      plan.taskPlans.forEach((task, index) => {
        const validation = validateTargetedTrainingResourceMetadata(
          task.targetedTrainingMetadata,
          material.materialVersionId,
        );
        validation.issues.forEach((issue) => error(
          issues,
          issue.code,
          `taskPlans.${index}.${issue.field}`,
          issue.message,
        ));
        if (task.taskRole !== 'training') {
          error(issues, 'targeted.task_role', `taskPlans.${index}.taskRole`, 'Targeted excerpt tasks must use the training role.');
        }
        if (
          task.targetedTrainingMetadata
          && !usage.targetedExcerptMetadata?.supportedGapReasonCodes.includes(
            task.targetedTrainingMetadata.primaryGapReasonCode,
          )
        ) {
          error(issues, 'targeted.gap_scope', `taskPlans.${index}.targetedTrainingMetadata.primaryGapReasonCode`, 'Task primary Gap is outside the Material support scope.');
        }
        if (!usage.targetedExcerptMetadata?.targetAbilityIds.includes(task.abilityId)) {
          error(issues, 'targeted.ability_scope', `taskPlans.${index}.abilityId`, 'Task Ability is outside the Material support scope.');
        }
      });
    } else if (plan.taskPlans.some((task) => task.targetedTrainingMetadata !== undefined)) {
      error(issues, 'core.targeted_metadata', 'taskPlans', 'Core Material tasks cannot carry targeted training metadata.');
    }
  }
  validateTaskDistinctness(plan.taskPlans, issues);
  const checkedAt = input.checkedAt || new Date().toISOString();
  return {
    validationId: buildStableId('material-observation-validation', [
      plan.materialObservationPlanId,
      String(plan.revision),
      stableStringify({
        materialStructureSnapshotId: plan.materialStructureSnapshotId,
        dimensionReviews: plan.dimensionReviews,
        taskPlans: plan.taskPlans,
      }),
      stableStringify(issues),
    ]),
    materialObservationPlanId: plan.materialObservationPlanId,
    planRevision: plan.revision,
    passed: issues.every((issue) => issue.severity !== 'error'),
    issues,
    checkedAt,
  };
}

export function adaptObservationTaskToQuestionDraft(
  plan: MaterialObservationPlan,
  task: ObservationTaskPlan,
  content: Omit<CreateStructuredQuestionDraftInput, 'materialVersionId' | 'abilityMetadata' | 'tags'> & { tags?: string[] },
): CreateStructuredQuestionDraftInput {
  requireReviewedTask(plan, task);
  return {
    ...clone(content),
    materialVersionId: task.materialVersionId,
    abilityMetadata: {
      abilityId: task.abilityId,
      supportingAbilityIds: task.resourceDraftSpecification?.supportingAbilityIds || [],
      prerequisiteAbilityIds: task.resourceDraftSpecification?.prerequisiteAbilityIds || [],
      taskRole: task.taskRole,
      difficulty: task.difficulty,
      gradeRange: task.resourceDraftSpecification?.gradeRange,
      targetedTrainingMetadata: task.targetedTrainingMetadata,
    },
    tags: uniqueSorted([
      ...(content.tags || []),
      task.taskRole === 'retest' ? 'hint_policy:no_hint' : 'hint_policy:limited_hint',
      `observation_plan:${plan.materialObservationPlanId}`,
      `observation_task:${task.observationTaskPlanId}`,
      `observation_dimension:${task.primaryDimension}`,
      ...(task.observationFocus ? [`observation_focus:${task.observationFocus.focusCode}`] : []),
      ...(task.intendedComparisonGroupId ? [`comparison_group:${task.intendedComparisonGroupId}`] : []),
    ]),
  };
}

export function deriveResourceObservationLink(input: {
  plan: MaterialObservationPlan;
  task: ObservationTaskPlan;
  version: FrozenQuestionResourceVersion;
  registryEntry?: ResourceRegistryEntry | null;
  validation?: ResourceValidationResult | null;
  review?: ResourceReviewDecision | null;
  linkedAt?: string;
}): { link: ResourceObservationLink; issues: string[] } {
  const { plan, task, version, registryEntry, validation, review } = input;
  const issues: string[] = [];
  if (plan.status !== 'reviewed') issues.push('plan.not_reviewed');
  if (!plan.taskPlans.some((item) => item.observationTaskPlanId === task.observationTaskPlanId)) issues.push('task.not_in_plan');
  if (version.resourceId !== task.linkedResourceId && task.linkedResourceId) issues.push('resource.id_mismatch');
  if (version.materialId !== plan.materialId || version.materialVersionId !== plan.materialVersionId) issues.push('resource.material_mismatch');
  if (version.abilityMetadata.abilityId !== task.abilityId) issues.push('resource.ability_mismatch');
  if (version.abilityMetadata.taskRole !== task.taskRole) issues.push('resource.task_role_mismatch');
  if (version.abilityMetadata.difficulty !== task.difficulty) issues.push('resource.difficulty_mismatch');
  if (JSON.stringify(version.abilityMetadata.targetedTrainingMetadata || null)
    !== JSON.stringify(task.targetedTrainingMetadata || null)) issues.push('resource.targeted_metadata_mismatch');
  if (version.status !== 'frozen' || registryEntry?.status !== 'active' || registryEntry.currentFrozenVersionId !== version.resourceVersionId) issues.push('resource.not_current');
  if (!validation?.passed || validation.validationId !== version.validationId || validation.resourceId !== version.resourceId) issues.push('resource.validation_untraceable');
  if (review?.action !== 'approve' || review.reviewId !== version.reviewId || review.validationId !== version.validationId || review.resourceId !== version.resourceId) issues.push('resource.review_untraceable');
  const linkedAt = input.linkedAt || new Date().toISOString();
  const link: ResourceObservationLink = {
    resourceObservationLinkId: buildStableId('resource-observation-link', [
      plan.materialObservationPlanId,
      task.observationTaskPlanId,
      version.resourceVersionId,
    ]),
    materialObservationPlanId: plan.materialObservationPlanId,
    observationTaskPlanId: task.observationTaskPlanId,
    resourceId: version.resourceId,
    resourceVersionId: version.resourceVersionId,
    materialId: plan.materialId,
    materialVersionId: plan.materialVersionId,
    primaryDimension: task.primaryDimension,
    abilityId: task.abilityId,
    taskRole: task.taskRole,
    difficulty: task.difficulty,
    targetedTrainingMetadata: task.targetedTrainingMetadata
      ? clone(task.targetedTrainingMetadata)
      : undefined,
    status: issues.length === 0 ? 'active' : 'invalid',
    linkedAt,
    schemaVersion: RESOURCE_OBSERVATION_LINK_SCHEMA_VERSION,
  };
  return { link, issues: uniqueSorted(issues) };
}

export function buildFirstFrozenResourcePackManifest(input: {
  resourcePackVersion: string;
  coverageReportIdBefore: string;
  coverageReportIdAfter: string;
  plans: MaterialObservationPlan[];
  links: ResourceObservationLink[];
  versions: FrozenQuestionResourceVersion[];
  registryEntries: ResourceRegistryEntry[];
  frozenAt?: string;
}): FirstFrozenResourcePackManifest {
  const versionMap = new Map(input.versions.map((value) => [value.resourceVersionId, value]));
  const registryMap = new Map(input.registryEntries.map((value) => [value.resourceId, value]));
  const activeLinks = input.links.filter((link) => {
    const version = versionMap.get(link.resourceVersionId);
    const entry = registryMap.get(link.resourceId);
    return link.status === 'active' && version?.status === 'frozen' && entry?.status === 'active' && entry.currentFrozenVersionId === link.resourceVersionId;
  });
  const abilityBreakdown = emptyAbilityBreakdown();
  const taskRoleBreakdown = emptyTaskRoleBreakdown();
  const difficultyBreakdown = emptyDifficultyBreakdown();
  const observationDimensionBreakdown = emptyDimensionBreakdown();
  activeLinks.forEach((link) => {
    abilityBreakdown[link.abilityId] += 1;
    taskRoleBreakdown[link.taskRole] += 1;
    difficultyBreakdown[link.difficulty] += 1;
    observationDimensionBreakdown[link.primaryDimension] += 1;
  });
  const materialVersionIds = uniqueSorted(activeLinks.map((link) => link.materialVersionId));
  const limitations = buildPackLimitations(activeLinks, materialVersionIds.length);
  const resourcePackId = buildStableId('first-frozen-resource-pack', [
    input.resourcePackVersion,
    input.coverageReportIdBefore,
    input.coverageReportIdAfter,
    ...activeLinks.map((link) => link.resourceObservationLinkId).sort(),
  ]);
  return {
    resourcePackId,
    resourcePackVersion: input.resourcePackVersion,
    coverageReportIdBefore: input.coverageReportIdBefore,
    coverageReportIdAfter: input.coverageReportIdAfter,
    materialObservationPlanIds: uniqueSorted(activeLinks.map((link) => link.materialObservationPlanId)),
    materialVersionIds,
    resourceVersionIds: uniqueSorted(activeLinks.map((link) => link.resourceVersionId)),
    resourceObservationLinkIds: uniqueSorted(activeLinks.map((link) => link.resourceObservationLinkId)),
    abilityBreakdown,
    taskRoleBreakdown,
    difficultyBreakdown,
    observationDimensionBreakdown,
    limitations,
    frozenAt: input.frozenAt || new Date().toISOString(),
    schemaVersion: FIRST_FROZEN_RESOURCE_PACK_SCHEMA_VERSION,
  };
}

export function buildObservationDiversityView(input: {
  manifest: FirstFrozenResourcePackManifest;
  registrySnapshotId: string;
  executableVersions: FrozenQuestionResourceVersion[];
  registryEntries: ResourceRegistryEntry[];
  links: ResourceObservationLink[];
  generatedAt?: string;
}): ObservationDiversityView {
  const currentVersionIds = new Set(input.registryEntries
    .filter((entry) => entry.status === 'active' && entry.currentFrozenVersionId)
    .map((entry) => entry.currentFrozenVersionId));
  const currentVersions = input.executableVersions.filter((version) => version.status === 'frozen' && currentVersionIds.has(version.resourceVersionId));
  const activeLinks = input.links.filter((link) => link.status === 'active' && currentVersionIds.has(link.resourceVersionId));
  const abilities: AbilityObservationDiversity[] = PRIMARY_ABILITY_IDS.map((abilityId) => {
    const versions = currentVersions.filter((version) => version.abilityMetadata.abilityId === abilityId);
    const links = activeLinks.filter((link) => link.abilityId === abilityId && versions.some((version) => version.resourceVersionId === link.resourceVersionId));
    const dimensions = emptyDimensionBreakdown();
    links.forEach((link) => { dimensions[link.primaryDimension] += 1; });
    const nonZeroDimensions = OBSERVATION_DIMENSIONS.filter((value) => dimensions[value] > 0);
    const status = links.length === 0 || nonZeroDimensions.length === 0
      ? 'insufficient'
      : nonZeroDimensions.length === 1
        ? 'single_dimension'
        : nonZeroDimensions.length === 2
          ? 'limited'
          : 'diverse';
    const limitations: string[] = [];
    if (versions.length > links.length) limitations.push('unlinked_executable_resources');
    if (status === 'single_dimension') limitations.push('ability_observation_concentrated');
    if (status === 'insufficient') limitations.push('insufficient_linked_observation');
    return {
      abilityId,
      executableResourceCount: versions.length,
      linkedResourceCount: links.length,
      dimensionBreakdown: Object.fromEntries(nonZeroDimensions.map((value) => [value, dimensions[value]])),
      materialClusterCount: new Set(links.map((link) => link.materialId)).size,
      diversityStatus: status,
      limitations,
    };
  });
  return {
    resourcePackId: input.manifest.resourcePackId,
    registrySnapshotId: input.registrySnapshotId,
    abilities,
    generatedAt: input.generatedAt || new Date().toISOString(),
  };
}

function validateTaskPlan(
  plan: MaterialObservationPlan,
  task: ObservationTaskPlan,
  index: number,
  issues: MaterialObservationPlanValidation['issues'],
): void {
  const prefix = `taskPlans.${index}`;
  if (task.materialObservationPlanId !== plan.materialObservationPlanId || task.materialId !== plan.materialId || task.materialVersionId !== plan.materialVersionId) error(issues, 'task.identity_mismatch', prefix, 'Task Plan identity does not match Material Observation Plan.');
  if (!isObservationDimension(task.primaryDimension)) error(issues, 'task.dimension_invalid', `${prefix}.primaryDimension`, 'Task primary Dimension is invalid.');
  const review = plan.dimensionReviews.find((value) => value.dimension === task.primaryDimension);
  if (!review || review.decision !== 'selected') error(issues, 'task.dimension_not_selected', `${prefix}.primaryDimension`, 'Task Dimension is not selected by the Plan.');
  if (!isPrimaryAbilityId(task.abilityId)) error(issues, 'task.ability_invalid', `${prefix}.abilityId`, 'Task Ability is not registered.');
  if (!isQuestionResourceTaskRole(task.taskRole)) error(issues, 'task.role_invalid', `${prefix}.taskRole`, 'TaskRole is not registered.');
  if (!isQuestionResourceDifficulty(task.difficulty)) error(issues, 'task.difficulty_invalid', `${prefix}.difficulty`, 'Difficulty is not registered.');
  if (task.sourceAnchorIds.length === 0) error(issues, 'task.anchor_missing', `${prefix}.sourceAnchorIds`, 'Task Plan requires a Source Anchor.');
  if (!nonEmpty(task.observationGoal) || !nonEmpty(task.expectedStudentAction) || !nonEmpty(task.designReason)) error(issues, 'task.design_incomplete', prefix, 'Task design facts are incomplete.');
  if (task.observationFocus && (!nonEmpty(task.observationFocus.focusCode) || !nonEmpty(task.observationFocus.displayName) || !nonEmpty(task.observationFocus.definition) || task.observationFocus.scope !== 'plan_local')) error(issues, 'task.focus_invalid', `${prefix}.observationFocus`, 'Observation Focus must be a plan-local structured object.');
  if (['retest', 'transfer'].includes(task.taskRole) && !nonEmpty(task.intendedComparisonGroupId)) {
    error(issues, 'task.comparison_group_missing', `${prefix}.intendedComparisonGroupId`, 'Retest and Transfer require an explicit comparison group.');
  }
  if (task.taskRole === 'transfer' && task.materialRelationIntent !== 'new_context') {
    error(issues, 'task.transfer_context_invalid', `${prefix}.materialRelationIntent`, 'Transfer requires a new-context intent.');
  }
  if (task.resourceDraftSpecification) {
    validateResourceDraftSpecification(task, index, issues);
  }
  if (task.calibrationCases) {
    validateCalibrationCases(task.calibrationCases, index, issues);
  }
  const responseFormat = task.resourceDraftSpecification?.responseFormat;
  if (task.taskLoadSemantics
    && !isTaskLoadSemantics(task.taskLoadSemantics, responseFormat)) {
    error(issues, 'task.load_semantics_invalid', `${prefix}.taskLoadSemantics`, 'Task load semantics are invalid or incompatible with the response format.');
  }
  if (plan.trainingModelPolicyVersion === READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION
    && task.status !== 'cancelled'
    && !task.taskLoadSemantics) {
    error(issues, 'task.load_semantics_missing', `${prefix}.taskLoadSemantics`, 'Native progressive-load Plans require Task load semantics.');
  }
  if (plan.trainingModelPolicyVersion === READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION
    && task.status !== 'cancelled'
    && task.taskLoadSemantics
    && task.taskLoadSemantics.derivationSource !== 'planned') {
    error(issues, 'task.load_semantics_not_native', `${prefix}.taskLoadSemantics.derivationSource`, 'Native progressive-load Plans cannot use legacy or recomputed semantics as their authority.');
  }
}

function validateResourceDraftSpecification(
  task: ObservationTaskPlan,
  index: number,
  issues: MaterialObservationPlanValidation['issues'],
): void {
  const specification = task.resourceDraftSpecification!;
  const prefix = `taskPlans.${index}.resourceDraftSpecification`;
  if (specification.rubric.length === 0) {
    error(issues, 'task.rubric_missing', `${prefix}.rubric`, 'A production-ready Task requires at least one Rubric item.');
  }
  const declaredAbilities = new Set([task.abilityId, ...specification.supportingAbilityIds]);
  specification.rubric.forEach((item, rubricIndex) => {
    if (!nonEmpty(item.itemId) || !nonEmpty(item.name) || item.acceptedSignals.length === 0) {
      error(issues, 'task.rubric_incomplete', `${prefix}.rubric.${rubricIndex}`, 'Rubric identity, name and accepted signals are required.');
    }
    if (!declaredAbilities.has(item.abilityId)) {
      error(issues, 'task.rubric_ability_undeclared', `${prefix}.rubric.${rubricIndex}.abilityId`, 'Rubric Ability must be the primary or a declared supporting Ability.');
    }
  });
  if (!isMinimumAnswerRequirement(specification.minimumAnswerRequirement)) {
    error(issues, 'task.minimum_answer_invalid', `${prefix}.minimumAnswerRequirement`, 'Minimum answer requirement is invalid for its response format.');
  } else if (specification.responseFormat !== 'single_choice' && specification.minimumAnswerRequirement.minLength < 1) {
    error(issues, 'task.minimum_answer_invalid', `${prefix}.minimumAnswerRequirement.minLength`, 'Minimum answer length must be positive.');
  }
  if (specification.responseFormat === 'single_choice') {
    if (!isSingleChoiceInteraction(specification.choiceInteraction)) {
      error(issues, 'task.choice_interaction_invalid', `${prefix}.choiceInteraction`, 'Single-choice task requires a complete choice interaction.');
    }
    if (!isSingleChoiceMinimumResponseRequirement(specification.minimumAnswerRequirement)) {
      error(issues, 'task.choice_minimum_invalid', `${prefix}.minimumAnswerRequirement`, 'Single-choice task requires exactly one structured selection.');
    }
    if (specification.assessmentMode !== 'exact_match') {
      error(issues, 'task.choice_assessment_invalid', `${prefix}.assessmentMode`, 'Single-choice task must use exact_match.');
    }
    if (specification.answerAcceptance?.acceptedOptionIds?.[0]
      !== specification.choiceInteraction?.correctOptionIds?.[0]) {
      error(issues, 'task.choice_answer_mismatch', `${prefix}.answerAcceptance.acceptedOptionIds`, 'Accepted option must match the correct option identity.');
    }
  } else if (specification.choiceInteraction !== undefined) {
    error(issues, 'task.choice_interaction_unused', `${prefix}.choiceInteraction`, 'Choice interaction is only valid for single_choice.');
  }
  if (specification.supportingAbilityIds.includes(task.abilityId)) {
    error(issues, 'task.supporting_ability_duplicates_primary', `${prefix}.supportingAbilityIds`, 'Primary Ability cannot also be a supporting Ability.');
  }
}

function validateCalibrationCases(
  cases: ObservationCalibrationCase[],
  taskIndex: number,
  issues: MaterialObservationPlanValidation['issues'],
): void {
  const prefix = `taskPlans.${taskIndex}.calibrationCases`;
  const allowedCategories = new Set([
    'fully_meets',
    'partially_meets',
    'typical_error',
    'reasonable_alternative',
    'concise_valid',
    'irrelevant',
  ]);
  const allowedAnswerStatuses = new Set([
    'fully_meets',
    'partially_meets',
    'does_not_meet',
    'insufficient_evidence',
  ]);
  if (new Set(cases.map((item) => item.calibrationCaseId)).size !== cases.length) {
    error(issues, 'task.calibration_case_duplicate', prefix, 'Calibration case IDs must be unique inside one Task.');
  }
  cases.forEach((item, caseIndex) => {
    if (!nonEmpty(item.calibrationCaseId) || !nonEmpty(item.answerText) || !nonEmpty(item.reviewNote)) {
      error(issues, 'task.calibration_case_incomplete', `${prefix}.${caseIndex}`, 'Calibration answer, expected status and review note are required.');
    }
    if (!allowedCategories.has(item.category)) {
      error(issues, 'task.calibration_case_category_invalid', `${prefix}.${caseIndex}.category`, 'Calibration case category is outside the controlled set.');
    }
    if (!allowedAnswerStatuses.has(item.expectedAnswerStatus)) {
      error(issues, 'task.calibration_case_status_invalid', `${prefix}.${caseIndex}.expectedAnswerStatus`, 'Calibration expected answer status is outside the Diagnosis contract.');
    }
  });
}

function validateTaskDistinctness(tasks: ObservationTaskPlan[], issues: MaterialObservationPlanValidation['issues']): void {
  for (let left = 0; left < tasks.length; left += 1) {
    for (let right = left + 1; right < tasks.length; right += 1) {
      const a = tasks[left];
      const b = tasks[right];
      if (a.primaryDimension !== b.primaryDimension || a.abilityId === b.abilityId) continue;
      if (normalizeText(a.observationGoal) === normalizeText(b.observationGoal) && normalizeText(a.expectedStudentAction) === normalizeText(b.expectedStudentAction)) {
        error(issues, 'task.cognitive_action_not_distinct', `taskPlans.${right}`, 'Different Abilities on one Dimension require distinct goals and student actions.');
      }
    }
  }
}

function requireReviewedTask(plan: MaterialObservationPlan, task: ObservationTaskPlan): void {
  if (plan.status !== 'reviewed') throw new Error('Only a reviewed Material Observation Plan can create Question Drafts.');
  if (!plan.taskPlans.some((item) => item.observationTaskPlanId === task.observationTaskPlanId)) throw new Error('Observation Task Plan does not belong to the reviewed Plan.');
}

function buildPackLimitations(links: ResourceObservationLink[], materialCount: number): string[] {
  const limitations: string[] = [];
  if (links.length < 24) limitations.push('resource_pack_below_24');
  if (links.length > 28) limitations.push('resource_pack_above_28');
  if (materialCount < 5) limitations.push('material_cluster_below_5');
  if (materialCount > 6) limitations.push('material_cluster_above_6');
  const abilityTargets: Record<PrimaryAbilityId, { min: number; max: number }> = {
    extraction: { min: 3, max: 4 },
    comprehension: { min: 4, max: 5 },
    summarization: { min: 4, max: 5 },
    analysis: { min: 4, max: 5 },
    inference: { min: 4, max: 5 },
    expression: { min: 3, max: 4 },
  };
  PRIMARY_ABILITY_IDS.forEach((ability) => {
    const count = links.filter((link) => link.abilityId === ability).length;
    if (count < abilityTargets[ability].min) limitations.push(`ability_target_below_min:${ability}`);
    if (count > abilityTargets[ability].max) limitations.push(`ability_target_above_max:${ability}`);
  });
  if (countCrossMaterialRoleChains(links, 'retest') < 2) limitations.push('training_retest_chain_below_2');
  if (countCrossMaterialRoleChains(links, 'transfer') < 2) limitations.push('training_transfer_chain_below_2');
  return uniqueSorted(limitations);
}

function countCrossMaterialRoleChains(
  links: ResourceObservationLink[],
  targetRole: 'retest' | 'transfer',
): number {
  return PRIMARY_ABILITY_IDS.filter((ability) => {
    const trainingMaterials = new Set(
      links
        .filter((link) => link.abilityId === ability && link.taskRole === 'training')
        .map((link) => link.materialId),
    );
    return links.some((link) => (
      link.abilityId === ability &&
      link.taskRole === targetRole &&
      [...trainingMaterials].some((materialId) => materialId !== link.materialId)
    ));
  }).length;
}

function normalizeParagraphs(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) throw new Error('Material content is empty.');
  return normalized.split(/\n\s*\n|\n/).map((value) => value.trim()).filter(Boolean);
}

function normalizeAnchorRange(type: MaterialSourceAnchor['anchorType'], start: number | undefined, end: number | undefined, count: number) {
  if (type === 'full_text') return { start: 1, end: count };
  const normalizedStart = start || 0;
  const normalizedEnd = type === 'paragraph' ? normalizedStart : (end || 0);
  if (!Number.isInteger(normalizedStart) || !Number.isInteger(normalizedEnd) || normalizedStart < 1 || normalizedEnd < normalizedStart || normalizedEnd > count) throw new Error('Source Anchor paragraph range is invalid.');
  return { start: normalizedStart, end: normalizedEnd };
}

function error(issues: MaterialObservationPlanValidation['issues'], code: string, field: string, message: string) {
  issues.push({ code, field, severity: 'error', message });
}
function nonEmpty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function normalizeText(value: string): string { return value.trim().replace(/\s+/g, ' ').toLowerCase(); }
function uniqueSorted(values: string[]): string[] { return [...new Set(values.filter(nonEmpty))].sort(); }
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
