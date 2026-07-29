import {
  PRIMARY_ABILITY_IDS,
  QUESTION_RESOURCE_DIFFICULTIES,
  QUESTION_RESOURCE_TASK_ROLES,
  isPrimaryAbilityId,
  isQuestionResourceDifficulty,
  isQuestionResourceTaskRole,
  type MinimumAnswerRequirement,
  type PrimaryAbilityId,
  type QuestionResourceDifficulty,
  type QuestionResourceRubricItem,
  type QuestionResponseFormat,
  type StructuredQuestionType,
} from './questionResourceAdmission.schema.ts';
import type {
  AnswerAcceptance,
  AssessmentMode,
  OpenResponseAnswerStatus,
} from './diagnosis.schema.ts';
import type { RecommendedTaskRole } from './nextLearningStrategy.schema.ts';

export const MATERIAL_OBSERVATION_PLAN_SCHEMA_VERSION = 'material_observation_plan_v1' as const;
export const RESOURCE_OBSERVATION_LINK_SCHEMA_VERSION = 'resource_observation_link_v1' as const;
export const FIRST_FROZEN_RESOURCE_PACK_SCHEMA_VERSION = 'first_frozen_resource_pack_v1' as const;

export const OBSERVATION_DIMENSIONS = [
  'fact',
  'character',
  'plot',
  'causality',
  'structure',
  'language',
  'theme',
] as const;

export type ObservationDimension = typeof OBSERVATION_DIMENSIONS[number];

export type ObservationFocus = {
  focusCode: string;
  displayName: string;
  definition: string;
  scope: 'plan_local';
};

export type ObservationCalibrationCaseCategory =
  | 'fully_meets'
  | 'partially_meets'
  | 'typical_error'
  | 'reasonable_alternative'
  | 'concise_valid'
  | 'irrelevant';

export type ObservationCalibrationCase = {
  calibrationCaseId: string;
  category: ObservationCalibrationCaseCategory;
  answerText: string;
  expectedAnswerStatus: OpenResponseAnswerStatus;
  reviewNote: string;
};

export type ObservationResourceDraftSpecification = {
  title?: string;
  questionType: StructuredQuestionType;
  responseFormat: QuestionResponseFormat;
  assessmentMode: AssessmentMode;
  answerAcceptance?: AnswerAcceptance;
  rubric: QuestionResourceRubricItem[];
  minimumAnswerRequirement: MinimumAnswerRequirement;
  supportingAbilityIds: PrimaryAbilityId[];
  prerequisiteAbilityIds: PrimaryAbilityId[];
  gradeRange?: string;
  tags: string[];
};

export type MaterialStructureSnapshot = {
  materialStructureSnapshotId: string;
  materialId: string;
  materialVersionId: string;
  paragraphCount: number;
  paragraphHashes: string[];
  contentHash: string;
  createdAt: string;
};

export type MaterialSourceAnchor = {
  sourceAnchorId: string;
  materialId: string;
  materialVersionId: string;
  anchorType: 'paragraph' | 'paragraph_range' | 'full_text';
  startParagraph?: number;
  endParagraph?: number;
  excerpt?: string;
  contentHash: string;
};

export type DimensionReview = {
  dimension: ObservationDimension;
  decision: 'selected' | 'not_suitable' | 'not_reviewed';
  reason: string;
  sourceAnchorIds: string[];
};

export type ObservationTaskPlanStatus =
  | 'planned'
  | 'draft_linked'
  | 'frozen_linked'
  | 'revision_required'
  | 'cancelled';

export type ObservationTaskPlan = {
  observationTaskPlanId: string;
  taskRevisionRootId?: string;
  parentObservationTaskPlanId?: string;
  regenerationAttemptId?: string;
  materialObservationPlanId: string;
  materialId: string;
  materialVersionId: string;
  primaryDimension: ObservationDimension;
  observationFocus?: ObservationFocus;
  abilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
  difficulty: QuestionResourceDifficulty;
  sourceAnchorIds: string[];
  observationGoal: string;
  expectedStudentAction: string;
  designReason: string;
  intendedComparisonGroupId?: string;
  materialRelationIntent?: 'same_context' | 'similar_context' | 'new_context';
  resourceDraftSpecification?: ObservationResourceDraftSpecification;
  calibrationCases?: ObservationCalibrationCase[];
  linkedDraftId?: string;
  linkedResourceId?: string;
  status: ObservationTaskPlanStatus;
};

export type MaterialObservationPlanStatus =
  | 'draft'
  | 'pending_review'
  | 'revision_required'
  | 'reviewed'
  | 'superseded'
  | 'rejected';

export type MaterialObservationPlan = {
  materialObservationPlanId: string;
  materialId: string;
  materialVersionId: string;
  materialStructureSnapshotId: string;
  revision: number;
  status: MaterialObservationPlanStatus;
  dimensionReviews: DimensionReview[];
  taskPlans: ObservationTaskPlan[];
  reviewerId?: string;
  reviewNote?: string;
  reviewedAt?: string;
  parentPlanId?: string;
  regenerationContext?: {
    attemptId: string;
    sourcePlanId: string;
    sourceObservationTaskPlanId: string;
    taskRevisionRootId: string;
  };
  createdAt: string;
  updatedAt: string;
  schemaVersion: typeof MATERIAL_OBSERVATION_PLAN_SCHEMA_VERSION;
};

export type MaterialObservationValidationIssue = {
  code: string;
  field: string;
  severity: 'error' | 'warning';
  message: string;
};

export type MaterialObservationPlanValidation = {
  validationId: string;
  materialObservationPlanId: string;
  planRevision: number;
  passed: boolean;
  issues: MaterialObservationValidationIssue[];
  checkedAt: string;
};

export type MaterialObservationReviewAction = 'approve' | 'revision_required' | 'reject';

export type MaterialObservationReviewDecision = {
  reviewId: string;
  materialObservationPlanId: string;
  planRevision: number;
  validationId: string;
  action: MaterialObservationReviewAction;
  reviewerId: string;
  notes: string;
  reviewedAt: string;
};

export type ResourceObservationLink = {
  resourceObservationLinkId: string;
  materialObservationPlanId: string;
  observationTaskPlanId: string;
  resourceId: string;
  resourceVersionId: string;
  materialId: string;
  materialVersionId: string;
  primaryDimension: ObservationDimension;
  abilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
  difficulty: QuestionResourceDifficulty;
  status: 'active' | 'superseded' | 'invalid';
  linkedAt: string;
  schemaVersion: typeof RESOURCE_OBSERVATION_LINK_SCHEMA_VERSION;
};

export type FirstFrozenResourcePackManifest = {
  resourcePackId: string;
  resourcePackVersion: string;
  coverageReportIdBefore: string;
  coverageReportIdAfter: string;
  materialObservationPlanIds: string[];
  materialVersionIds: string[];
  resourceVersionIds: string[];
  resourceObservationLinkIds: string[];
  abilityBreakdown: Record<PrimaryAbilityId, number>;
  taskRoleBreakdown: Record<RecommendedTaskRole, number>;
  difficultyBreakdown: Record<QuestionResourceDifficulty, number>;
  observationDimensionBreakdown: Record<ObservationDimension, number>;
  limitations: string[];
  frozenAt: string;
  schemaVersion: typeof FIRST_FROZEN_RESOURCE_PACK_SCHEMA_VERSION;
};

export type AbilityObservationDiversity = {
  abilityId: PrimaryAbilityId;
  executableResourceCount: number;
  linkedResourceCount: number;
  dimensionBreakdown: Partial<Record<ObservationDimension, number>>;
  materialClusterCount: number;
  diversityStatus: 'diverse' | 'limited' | 'single_dimension' | 'insufficient';
  limitations: string[];
};

export type ObservationDiversityView = {
  resourcePackId: string;
  registrySnapshotId: string;
  abilities: AbilityObservationDiversity[];
  generatedAt: string;
};

export function isObservationDimension(value: unknown): value is ObservationDimension {
  return typeof value === 'string' && OBSERVATION_DIMENSIONS.includes(value as ObservationDimension);
}

export function isMaterialObservationPlan(value: unknown): value is MaterialObservationPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as MaterialObservationPlan;
  return (
    nonEmpty(plan.materialObservationPlanId) &&
    nonEmpty(plan.materialId) &&
    nonEmpty(plan.materialVersionId) &&
    nonEmpty(plan.materialStructureSnapshotId) &&
    Number.isInteger(plan.revision) && plan.revision > 0 &&
    ['draft', 'pending_review', 'revision_required', 'reviewed', 'superseded', 'rejected'].includes(plan.status) &&
    Array.isArray(plan.dimensionReviews) &&
    Array.isArray(plan.taskPlans) &&
    plan.schemaVersion === MATERIAL_OBSERVATION_PLAN_SCHEMA_VERSION
  );
}

export function isObservationTaskPlan(value: unknown): value is ObservationTaskPlan {
  if (!value || typeof value !== 'object') return false;
  const task = value as ObservationTaskPlan;
  return (
    nonEmpty(task.observationTaskPlanId) &&
    nonEmpty(task.materialObservationPlanId) &&
    nonEmpty(task.materialId) &&
    nonEmpty(task.materialVersionId) &&
    isObservationDimension(task.primaryDimension) &&
    isPrimaryAbilityId(task.abilityId) &&
    isQuestionResourceTaskRole(task.taskRole) &&
    isQuestionResourceDifficulty(task.difficulty) &&
    Array.isArray(task.sourceAnchorIds) &&
    nonEmpty(task.observationGoal) &&
    nonEmpty(task.expectedStudentAction) &&
    nonEmpty(task.designReason) &&
    ['planned', 'draft_linked', 'frozen_linked', 'revision_required', 'cancelled'].includes(task.status)
  );
}

export function isResourceObservationLink(value: unknown): value is ResourceObservationLink {
  if (!value || typeof value !== 'object') return false;
  const link = value as ResourceObservationLink;
  return (
    nonEmpty(link.resourceObservationLinkId) &&
    nonEmpty(link.materialObservationPlanId) &&
    nonEmpty(link.observationTaskPlanId) &&
    nonEmpty(link.resourceId) &&
    nonEmpty(link.resourceVersionId) &&
    nonEmpty(link.materialId) &&
    nonEmpty(link.materialVersionId) &&
    isObservationDimension(link.primaryDimension) &&
    isPrimaryAbilityId(link.abilityId) &&
    isQuestionResourceTaskRole(link.taskRole) &&
    isQuestionResourceDifficulty(link.difficulty) &&
    ['active', 'superseded', 'invalid'].includes(link.status) &&
    nonEmpty(link.linkedAt) &&
    link.schemaVersion === RESOURCE_OBSERVATION_LINK_SCHEMA_VERSION
  );
}

export function emptyAbilityBreakdown(): Record<PrimaryAbilityId, number> {
  return Object.fromEntries(PRIMARY_ABILITY_IDS.map((value) => [value, 0])) as Record<PrimaryAbilityId, number>;
}

export function emptyTaskRoleBreakdown(): Record<RecommendedTaskRole, number> {
  return Object.fromEntries(QUESTION_RESOURCE_TASK_ROLES.map((value) => [value, 0])) as Record<RecommendedTaskRole, number>;
}

export function emptyDifficultyBreakdown(): Record<QuestionResourceDifficulty, number> {
  return Object.fromEntries(QUESTION_RESOURCE_DIFFICULTIES.map((value) => [value, 0])) as Record<QuestionResourceDifficulty, number>;
}

export function emptyDimensionBreakdown(): Record<ObservationDimension, number> {
  return Object.fromEntries(OBSERVATION_DIMENSIONS.map((value) => [value, 0])) as Record<ObservationDimension, number>;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
