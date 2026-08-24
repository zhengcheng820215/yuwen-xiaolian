import type {
  PrimaryAbilityId,
  QuestionResponseFormat,
} from './questionResourceAdmission.schema.ts';
import type { RecommendedTaskRole } from './nextLearningStrategy.schema.ts';
import type {
  CanonicalTextResponseAction,
  TextResponseLoadLevel,
} from './readingOpenResponseInputLoad.schema.ts';
import type {
  TrainingTaskSequenceReason,
  TrainingTaskSequenceStrategy,
} from './trainingTaskSequencePlanning.schema.ts';

export const READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION =
  'reading_training_progressive_load_policy_v2' as const;
export const READING_TRAINING_PROGRESSIVE_LOAD_STAGE0_AUDIT_VERSION =
  'reading_training_progressive_load_stage0_audit_v1' as const;

export const TASK_LOAD_SEQUENCE_ROLES = [
  'foundation_entry',
  'bridge',
  'development',
  'integration',
  'independent_validation',
] as const;

export type TaskLoadSequenceRole = typeof TASK_LOAD_SEQUENCE_ROLES[number];
export type TaskLoadProjectionConfidence = 'high' | 'medium' | 'low';
export type TaskLoadProjectionCompleteness = 'complete' | 'partial' | 'insufficient';

export const READING_LOAD_RESPONSIBILITIES = [
  'basic_understanding',
  'text_evidence',
  'relation_explanation',
  'inference_integration',
  'expression_organization',
] as const;

export type ReadingLoadResponsibility = typeof READING_LOAD_RESPONSIBILITIES[number];

export type TaskLoadSemanticsProjection = {
  policyVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION;
  projectionVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_STAGE0_AUDIT_VERSION;
  questionVersionId: string;
  materialVersionId?: string;
  observationTaskPlanId?: string;
  responseFormat: QuestionResponseFormat;
  taskRole: RecommendedTaskRole;
  abilityId: PrimaryAbilityId;
  sourceAnchorIds: string[];
  sequenceRole: TaskLoadSequenceRole;
  primaryAction: CanonicalTextResponseAction;
  supportingAction?: CanonicalTextResponseAction;
  textLoadLevel?: TextResponseLoadLevel;
  responsibilities: ReadingLoadResponsibility[];
  derivationSource: 'legacy_projection';
  confidence: TaskLoadProjectionConfidence;
  completeness: TaskLoadProjectionCompleteness;
  evidencePaths: string[];
  limitations: string[];
};

export const PROGRESSION_AUDIT_FINDING_CODES = [
  'projection_incomplete',
  'projection_low_confidence',
  'missing_accessible_entry',
  'unexplained_responsibility_jump',
  'duplicate_observation_scope',
  'cross_thread_comparison_invalid',
  'breakpoint_not_inferable',
  'task_overload_attribution_risk',
  'legacy_sequence_reason_missing',
] as const;

export type ProgressionAuditFindingCode =
  typeof PROGRESSION_AUDIT_FINDING_CODES[number];

export type ProgressionAuditFinding = {
  code: ProgressionAuditFindingCode;
  severity: 'info' | 'warning' | 'high_risk';
  questionVersionIds: string[];
  explanation: string;
};

export type ProgressionTransitionAudit = {
  fromQuestionVersionId: string;
  toQuestionVersionId: string;
  fromSequenceRole: TaskLoadSequenceRole;
  toSequenceRole: TaskLoadSequenceRole;
  addedResponsibilities: ReadingLoadResponsibility[];
  removedResponsibilities: ReadingLoadResponsibility[];
  status: 'progressive' | 'level' | 'exception' | 'unexplained_jump';
  rationale: string;
};

export type ProgressionBreakPointObservability =
  | 'traceable'
  | 'partial'
  | 'not_assessable';

export type ReadingTaskGroupProgressionAudit = {
  materialId: string;
  materialVersionId: string;
  materialTitle: string;
  usageType: 'core_reading' | 'targeted_excerpt';
  strategy: TrainingTaskSequenceStrategy;
  sequenceReason?: TrainingTaskSequenceReason;
  orderedQuestionVersionIds: string[];
  projections: TaskLoadSemanticsProjection[];
  transitions: ProgressionTransitionAudit[];
  findings: ProgressionAuditFinding[];
  observedResponsibilities: ReadingLoadResponsibility[];
  breakPointObservability: ProgressionBreakPointObservability;
  auditScope: 'core_task_group' | 'targeted_excerpt_single_task';
};

export type ReadingTrainingProgressionStage0Report = {
  schemaVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_STAGE0_AUDIT_VERSION;
  policyVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION;
  storeRevision: number;
  storeUpdatedAt: string;
  counts: {
    activeMaterials: number;
    activeCoreMaterials: number;
    activeTargetedExcerptMaterials: number;
    activeFormalQuestions: number;
    projectedQuestions: number;
    completeProjections: number;
    partialProjections: number;
    insufficientProjections: number;
    coreTaskGroups: number;
    targetedExcerptGroups: number;
    traceableGroups: number;
    partialGroups: number;
    notAssessableGroups: number;
  };
  findingBreakdown: Record<ProgressionAuditFindingCode, number>;
  groups: ReadingTaskGroupProgressionAudit[];
  issues: string[];
  limitations: string[];
  sourceDigest: string;
  auditDigest: string;
};

export function isTaskLoadSemanticsProjection(
  value: unknown,
): value is TaskLoadSemanticsProjection {
  if (!value || typeof value !== 'object') return false;
  const projection = value as TaskLoadSemanticsProjection;
  return projection.policyVersion === READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION
    && projection.projectionVersion
      === READING_TRAINING_PROGRESSIVE_LOAD_STAGE0_AUDIT_VERSION
    && Boolean(projection.questionVersionId?.trim())
    && (TASK_LOAD_SEQUENCE_ROLES as readonly string[]).includes(projection.sequenceRole)
    && projection.derivationSource === 'legacy_projection'
    && ['high', 'medium', 'low'].includes(projection.confidence)
    && ['complete', 'partial', 'insufficient'].includes(projection.completeness)
    && Array.isArray(projection.responsibilities)
    && projection.responsibilities.every((item) => (
      (READING_LOAD_RESPONSIBILITIES as readonly string[]).includes(item)
    ))
    && Array.isArray(projection.evidencePaths)
    && Array.isArray(projection.limitations);
}
