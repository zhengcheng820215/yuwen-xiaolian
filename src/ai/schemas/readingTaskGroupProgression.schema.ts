import {
  OBSERVATION_DIMENSIONS,
  type ObservationDimension,
} from './materialObservation.schema.ts';
import {
  PRIMARY_ABILITY_IDS,
  QUESTION_RESPONSE_FORMATS,
  type PrimaryAbilityId,
  type QuestionResponseFormat,
} from './questionResourceAdmission.schema.ts';
import {
  RECOMMENDED_TASK_ROLES,
  type RecommendedTaskRole,
} from './nextLearningStrategy.schema.ts';
import {
  isCanonicalTextResponseAction,
  isTextResponseLoadProfile,
  type CanonicalTextResponseAction,
  type TextResponseLoadProfile,
} from './readingOpenResponseInputLoad.schema.ts';
import {
  READING_LOAD_RESPONSIBILITIES,
  type ReadingLoadResponsibility,
} from './readingTrainingProgressionAudit.schema.ts';
import {
  READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
} from './readingTrainingProgressionAudit.schema.ts';
import {
  calculateTaskLoadSemanticsHash,
  isTaskLoadSemantics,
  type TaskLoadSemantics,
} from './readingTaskLoadSemantics.schema.ts';
import {
  isTrainingTaskSequenceReason,
  isTrainingTaskSequenceStrategy,
  type TrainingTaskSequenceReason,
  type TrainingTaskSequenceStrategy,
} from './trainingTaskSequencePlanning.schema.ts';
import {
  isReadingCurriculumCalibrationContext,
  isReadingCurriculumCalibrationRole,
  type ReadingCurriculumCalibrationContext,
  type ReadingCurriculumCalibrationRole,
} from './readingCurriculumCalibration.schema.ts';

export const TASK_GROUP_PROGRESSION_PLAN_SCHEMA_VERSION =
  'task_group_progression_plan_v1' as const;
export const READING_TASK_GROUP_PROGRESSION_GATE_VERSION =
  'reading_task_group_progression_gate_v1' as const;
export const READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION =
  'reading-training-progressive-load-stage2-v1' as const;

export type ReadingTaskMaterialAnchor = {
  anchorType: 'paragraph' | 'paragraph_range' | 'full_text';
  startParagraph?: number;
  endParagraph?: number;
};

export type ReadingTaskPlanningSeed = {
  planningTaskKey: string;
  observationDimension: ObservationDimension;
  observationObject: string;
  materialAnchor: ReadingTaskMaterialAnchor;
  primaryAbilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
  responseFormat: QuestionResponseFormat;
  curriculumCalibrationRole?: ReadingCurriculumCalibrationRole;
  loadIntent: {
    primaryAction: CanonicalTextResponseAction;
    supportingAction?: CanonicalTextResponseAction;
    responsibilities: ReadingLoadResponsibility[];
    textResponseLoadProfile?: TextResponseLoadProfile;
  };
};

export type TaskGroupProgressionReasonCode =
  | Exclude<TrainingTaskSequenceReason, 'no_qualified_single_choice'>
  | 'no_qualified_foundation_task';

export type TaskGroupProgressionTransition = {
  transitionId: string;
  fromPlanningTaskKey: string;
  toPlanningTaskKey: string;
  threadRelation: 'same_thread' | 'cross_thread';
  transitionKind:
    | 'progressive'
    | 'bridge'
    | 'legitimate_skip'
    | 'cross_thread'
    | 'independent_validation';
  addedResponsibilities: ReadingLoadResponsibility[];
  retainedResponsibilities: ReadingLoadResponsibility[];
  loadDirection: 'same' | 'increase' | 'decrease' | 'independent';
  rationaleCode:
    | 'adjacent_responsibility_growth'
    | 'foundation_already_observed'
    | 'material_does_not_support_bridge'
    | 'holistic_judgment_before_local_cue'
    | 'preserve_independent_expression_baseline'
    | 'switch_observation_thread'
    | 'retest_after_training'
    | 'transfer_in_new_context';
  rationale: string;
};

export type TaskGroupProgressionPlan = {
  schemaVersion: typeof TASK_GROUP_PROGRESSION_PLAN_SCHEMA_VERSION;
  policyVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION;
  stageRuleVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION;
  materialVersionId: string;
  observationPlanRevisionId: string;
  strategy: TrainingTaskSequenceStrategy;
  reasonCode: TaskGroupProgressionReasonCode;
  orderedTasks: Array<{
    planningTaskKey: string;
    taskLoadSemanticsHash: string;
    sequenceRank: number;
    curriculumCalibrationRole?: ReadingCurriculumCalibrationRole;
  }>;
  accessibleEntryTaskKeys: string[];
  protectedHigherOrderTaskKeys: string[];
  transitions: TaskGroupProgressionTransition[];
  exceptionReason?: string;
  planHash: string;
  derivationSource: 'planned' | 'legacy_projection';
  curriculumCalibration?: ReadingCurriculumCalibrationContext;
};

export type TaskGroupProgressionPlanningResult = {
  plannedTasks: Array<{
    planningTaskKey: string;
    taskLoadSemantics: TaskLoadSemantics;
    taskLoadSemanticsHash: string;
  }>;
  progressionPlan: TaskGroupProgressionPlan;
};

export const READING_TASK_GROUP_PROGRESSION_BLOCKER_CODES = [
  'progression_plan_missing_or_stale',
  'ordered_task_identity_mismatch',
  'task_semantics_hash_mismatch',
  'candidate_plan_context_mismatch',
  'unexplained_responsibility_jump',
  'invalid_strategy_exception',
  'duplicate_observation_value',
  'protected_higher_order_observation_missing',
  'required_whole_text_orientation_missing',
  'local_close_reading_before_whole_text_orientation',
] as const;

export const READING_TASK_GROUP_PROGRESSION_ADVISORY_CODES = [
  'accessible_entry_underfilled',
  'single_step_bridge_absent',
  'cross_thread_sequence_not_comparable',
  'load_direction_decreases',
  'higher_order_coverage_thin',
  'legacy_peer_context',
  'whole_text_orientation_missing',
  'local_close_reading_precedes_orientation',
] as const;

export type ReadingTaskGroupProgressionBlockerCode =
  typeof READING_TASK_GROUP_PROGRESSION_BLOCKER_CODES[number];
export type ReadingTaskGroupProgressionAdvisoryCode =
  typeof READING_TASK_GROUP_PROGRESSION_ADVISORY_CODES[number];

export type ReadingTaskGroupProgressionGateAssessment = {
  schemaVersion: typeof READING_TASK_GROUP_PROGRESSION_GATE_VERSION;
  policyVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION;
  stageRuleVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION;
  materialVersionId: string;
  observationPlanRevisionId: string;
  taskGroupProgressionPlanHash: string;
  projectedGroupSnapshotHash: string;
  orderedSubjectIdentities: Array<{
    planningTaskKey: string;
    subjectId: string;
    taskLoadSemanticsHash: string;
  }>;
  decision: 'pass' | 'pass_with_advisory' | 'blocked' | 'insufficient_input';
  blockerCodes: ReadingTaskGroupProgressionBlockerCode[];
  advisoryCodes: ReadingTaskGroupProgressionAdvisoryCode[];
  assessedAt: string;
};

export function calculateTaskGroupProgressionPlanHash(
  plan: Omit<TaskGroupProgressionPlan, 'planHash'> | TaskGroupProgressionPlan,
): string {
  return stableHash(stableStringify({
    schemaVersion: plan.schemaVersion,
    policyVersion: plan.policyVersion,
    stageRuleVersion: plan.stageRuleVersion,
    materialVersionId: plan.materialVersionId,
    observationPlanRevisionId: plan.observationPlanRevisionId,
    strategy: plan.strategy,
    reasonCode: plan.reasonCode,
    orderedTasks: plan.orderedTasks,
    accessibleEntryTaskKeys: [...plan.accessibleEntryTaskKeys].sort(),
    protectedHigherOrderTaskKeys: [...plan.protectedHigherOrderTaskKeys].sort(),
    transitions: plan.transitions.map((transition) => ({
      transitionId: transition.transitionId,
      fromPlanningTaskKey: transition.fromPlanningTaskKey,
      toPlanningTaskKey: transition.toPlanningTaskKey,
      threadRelation: transition.threadRelation,
      transitionKind: transition.transitionKind,
      addedResponsibilities: [...transition.addedResponsibilities].sort(),
      retainedResponsibilities: [...transition.retainedResponsibilities].sort(),
      loadDirection: transition.loadDirection,
      rationaleCode: transition.rationaleCode,
    })),
    exceptionReason: plan.exceptionReason,
    derivationSource: plan.derivationSource,
    ...(plan.curriculumCalibration
      ? { curriculumCalibration: plan.curriculumCalibration }
      : {}),
  }));
}

export function isReadingTaskPlanningSeed(value: unknown): value is ReadingTaskPlanningSeed {
  if (!value || typeof value !== 'object') return false;
  const seed = value as ReadingTaskPlanningSeed;
  return Boolean(seed.planningTaskKey?.trim())
    && (OBSERVATION_DIMENSIONS as readonly string[]).includes(seed.observationDimension)
    && Boolean(seed.observationObject?.trim())
    && isMaterialAnchor(seed.materialAnchor)
    && (PRIMARY_ABILITY_IDS as readonly string[]).includes(seed.primaryAbilityId)
    && (RECOMMENDED_TASK_ROLES as readonly string[]).includes(seed.taskRole)
    && (QUESTION_RESPONSE_FORMATS as readonly string[]).includes(seed.responseFormat)
    && isCanonicalTextResponseAction(seed.loadIntent?.primaryAction)
    && (seed.loadIntent?.supportingAction === undefined
      || (isCanonicalTextResponseAction(seed.loadIntent.supportingAction)
        && seed.loadIntent.supportingAction !== seed.loadIntent.primaryAction))
    && Array.isArray(seed.loadIntent?.responsibilities)
    && seed.loadIntent.responsibilities.length > 0
    && new Set(seed.loadIntent.responsibilities).size === seed.loadIntent.responsibilities.length
    && seed.loadIntent.responsibilities.every((responsibility) => (
      (READING_LOAD_RESPONSIBILITIES as readonly string[]).includes(responsibility)
    ))
    && (seed.responseFormat === 'short_text' || seed.responseFormat === 'long_text'
      ? isTextResponseLoadProfile(seed.loadIntent.textResponseLoadProfile)
      : seed.loadIntent.textResponseLoadProfile === undefined)
    && (seed.curriculumCalibrationRole === undefined
      || isReadingCurriculumCalibrationRole(seed.curriculumCalibrationRole));
}

export function isTaskGroupProgressionPlan(value: unknown): value is TaskGroupProgressionPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as TaskGroupProgressionPlan;
  if (plan.schemaVersion !== TASK_GROUP_PROGRESSION_PLAN_SCHEMA_VERSION
    || plan.policyVersion !== READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION
    || plan.stageRuleVersion !== READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION
    || !plan.materialVersionId?.trim()
    || !plan.observationPlanRevisionId?.trim()
    || !isTrainingTaskSequenceStrategy(plan.strategy)
    || !isProgressionReason(plan.reasonCode)
    || !Array.isArray(plan.orderedTasks)
    || !Array.isArray(plan.accessibleEntryTaskKeys)
    || !Array.isArray(plan.protectedHigherOrderTaskKeys)
    || !Array.isArray(plan.transitions)
    || (plan.curriculumCalibration !== undefined
      && !isReadingCurriculumCalibrationContext(plan.curriculumCalibration))) return false;
  const keys = plan.orderedTasks.map((item) => item.planningTaskKey);
  if (new Set(keys).size !== keys.length
    || plan.orderedTasks.some((item, index) => (
      !item.planningTaskKey?.trim()
      || !item.taskLoadSemanticsHash?.trim()
      || item.sequenceRank !== index + 1
      || (item.curriculumCalibrationRole !== undefined
        && !isReadingCurriculumCalibrationRole(item.curriculumCalibrationRole))
    ))) return false;
  if (new Set(plan.accessibleEntryTaskKeys).size !== plan.accessibleEntryTaskKeys.length
    || new Set(plan.protectedHigherOrderTaskKeys).size
      !== plan.protectedHigherOrderTaskKeys.length
    || plan.accessibleEntryTaskKeys.some((key) => !keys.includes(key))) return false;
  if (plan.transitions.length !== Math.max(plan.orderedTasks.length - 1, 0)) return false;
  if (plan.transitions.some((transition, index) => (
    !isTransition(transition)
    ||
    transition.fromPlanningTaskKey !== plan.orderedTasks[index]?.planningTaskKey
    || transition.toPlanningTaskKey !== plan.orderedTasks[index + 1]?.planningTaskKey
    || (transition.threadRelation === 'cross_thread'
      && transition.transitionKind === 'progressive')
    || (transition.transitionKind === 'legitimate_skip'
      && !plan.exceptionReason?.trim()
      && !transition.rationale?.trim())
  ))) return false;
  return plan.planHash === calculateTaskGroupProgressionPlanHash(plan);
}

export function isReadingTaskGroupProgressionGateAssessment(
  value: unknown,
): value is ReadingTaskGroupProgressionGateAssessment {
  if (!value || typeof value !== 'object') return false;
  const assessment = value as ReadingTaskGroupProgressionGateAssessment;
  return assessment.schemaVersion === READING_TASK_GROUP_PROGRESSION_GATE_VERSION
    && assessment.policyVersion === READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION
    && assessment.stageRuleVersion === READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION
    && Boolean(assessment.materialVersionId?.trim())
    && Boolean(assessment.observationPlanRevisionId?.trim())
    && Boolean(assessment.taskGroupProgressionPlanHash?.trim())
    && Boolean(assessment.projectedGroupSnapshotHash?.trim())
    && Array.isArray(assessment.orderedSubjectIdentities)
    && assessment.orderedSubjectIdentities.every((item) => (
      Boolean(item.planningTaskKey?.trim())
      && Boolean(item.subjectId?.trim())
      && Boolean(item.taskLoadSemanticsHash?.trim())
    ))
    && ['pass', 'pass_with_advisory', 'blocked', 'insufficient_input']
      .includes(assessment.decision)
    && Array.isArray(assessment.blockerCodes)
    && assessment.blockerCodes.every((code) => (
      (READING_TASK_GROUP_PROGRESSION_BLOCKER_CODES as readonly string[]).includes(code)
    ))
    && Array.isArray(assessment.advisoryCodes)
    && assessment.advisoryCodes.every((code) => (
      (READING_TASK_GROUP_PROGRESSION_ADVISORY_CODES as readonly string[]).includes(code)
    ))
    && Boolean(assessment.assessedAt?.trim());
}

export function validateProgressionPlanAgainstSemantics(input: {
  plan: TaskGroupProgressionPlan;
  semanticsByTaskKey: Map<string, TaskLoadSemantics>;
}): string[] {
  const issues: string[] = [];
  if (!isTaskGroupProgressionPlan(input.plan)) issues.push('progression_plan_invalid');
  input.plan.orderedTasks.forEach((item) => {
    const semantics = input.semanticsByTaskKey.get(item.planningTaskKey);
    if (!semantics || !isTaskLoadSemantics(semantics)) {
      issues.push(`task_semantics_missing:${item.planningTaskKey}`);
    } else if (calculateTaskLoadSemanticsHash(semantics) !== item.taskLoadSemanticsHash) {
      issues.push(`task_semantics_hash_mismatch:${item.planningTaskKey}`);
    }
  });
  input.plan.transitions.forEach((transition) => {
    const from = input.semanticsByTaskKey.get(transition.fromPlanningTaskKey);
    const to = input.semanticsByTaskKey.get(transition.toPlanningTaskKey);
    if (!from || !to) return;
    const actualRelation = from.observationThreadId === to.observationThreadId
      ? 'same_thread' : 'cross_thread';
    if (actualRelation !== transition.threadRelation) {
      issues.push(`transition_thread_relation_mismatch:${transition.transitionId}`);
    }
  });
  return issues;
}

export function stableProgressionIdentity(value: unknown): string {
  return stableHash(stableStringify(value));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `progression-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function isMaterialAnchor(value: unknown): value is ReadingTaskMaterialAnchor {
  if (!value || typeof value !== 'object') return false;
  const anchor = value as ReadingTaskMaterialAnchor;
  if (!['paragraph', 'paragraph_range', 'full_text'].includes(anchor.anchorType)) return false;
  if (anchor.anchorType === 'full_text') return true;
  if (!Number.isInteger(anchor.startParagraph) || Number(anchor.startParagraph) < 1) return false;
  if (anchor.anchorType === 'paragraph') {
    return anchor.endParagraph === undefined || anchor.endParagraph === anchor.startParagraph;
  }
  return Number.isInteger(anchor.endParagraph)
    && Number(anchor.endParagraph) >= Number(anchor.startParagraph);
}

function isProgressionReason(value: unknown): value is TaskGroupProgressionReasonCode {
  return value === 'no_qualified_foundation_task' || (
    isTrainingTaskSequenceReason(value) && value !== 'no_qualified_single_choice'
  );
}

function isTransition(value: unknown): value is TaskGroupProgressionTransition {
  if (!value || typeof value !== 'object') return false;
  const transition = value as TaskGroupProgressionTransition;
  return Boolean(transition.transitionId?.trim())
    && Boolean(transition.fromPlanningTaskKey?.trim())
    && Boolean(transition.toPlanningTaskKey?.trim())
    && ['same_thread', 'cross_thread'].includes(transition.threadRelation)
    && ['progressive', 'bridge', 'legitimate_skip', 'cross_thread', 'independent_validation']
      .includes(transition.transitionKind)
    && Array.isArray(transition.addedResponsibilities)
    && Array.isArray(transition.retainedResponsibilities)
    && [...transition.addedResponsibilities, ...transition.retainedResponsibilities]
      .every((responsibility) => (
        (READING_LOAD_RESPONSIBILITIES as readonly string[]).includes(responsibility)
      ))
    && new Set(transition.addedResponsibilities).size
      === transition.addedResponsibilities.length
    && new Set(transition.retainedResponsibilities).size
      === transition.retainedResponsibilities.length
    && ['same', 'increase', 'decrease', 'independent'].includes(transition.loadDirection)
    && [
      'adjacent_responsibility_growth',
      'foundation_already_observed',
      'material_does_not_support_bridge',
      'holistic_judgment_before_local_cue',
      'preserve_independent_expression_baseline',
      'switch_observation_thread',
      'retest_after_training',
      'transfer_in_new_context',
    ].includes(transition.rationaleCode)
    && Boolean(transition.rationale?.trim());
}
