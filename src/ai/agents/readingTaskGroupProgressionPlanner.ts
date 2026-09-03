import type { MaterialObservationPlanningCandidate } from
  '../schemas/materialObservationDraftGenerator.schema.ts';
import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import type {
  ReadingLoadResponsibility,
  TaskLoadSequenceRole,
} from '../schemas/readingTrainingProgressionAudit.schema.ts';
import {
  TASK_LOAD_SEMANTICS_SCHEMA_VERSION,
  calculateTaskLoadSemanticsHash,
  cloneTaskLoadSemantics,
  isTaskLoadSemantics,
  type TaskLoadSemantics,
} from '../schemas/readingTaskLoadSemantics.schema.ts';
import {
  READING_TASK_GROUP_PROGRESSION_GATE_VERSION,
  READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
  TASK_GROUP_PROGRESSION_PLAN_SCHEMA_VERSION,
  calculateTaskGroupProgressionPlanHash,
  isReadingTaskPlanningSeed,
  isTaskGroupProgressionPlan,
  stableProgressionIdentity,
  validateProgressionPlanAgainstSemantics,
  type ReadingTaskGroupProgressionAdvisoryCode,
  type ReadingTaskGroupProgressionBlockerCode,
  type ReadingTaskGroupProgressionGateAssessment,
  type ReadingTaskPlanningSeed,
  type TaskGroupProgressionPlan,
  type TaskGroupProgressionPlanningResult,
  type TaskGroupProgressionTransition,
} from '../schemas/readingTaskGroupProgression.schema.ts';
import {
  READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
} from '../schemas/readingTrainingProgressionAudit.schema.ts';
import type {
  TrainingTaskSequencePlanningPreference,
  TrainingTaskSequencePlanningResult,
} from '../schemas/trainingTaskSequencePlanning.schema.ts';
import {
  planTrainingTaskSequence,
} from './trainingTaskSequencePlanner.ts';
import { buildPlannedTaskLoadSemantics } from './readingTaskLoadSemanticsAgent.ts';
import type {
  ReadingCurriculumCalibrationContext,
  ReadingCurriculumCalibrationRole,
} from '../schemas/readingCurriculumCalibration.schema.ts';

const ROLE_RANK: Record<TaskLoadSequenceRole, number> = {
  foundation_entry: 0,
  bridge: 1,
  development: 2,
  integration: 3,
  independent_validation: 4,
};

const CURRICULUM_ROLE_RANK: Record<ReadingCurriculumCalibrationRole, number> = {
  whole_text_orientation: 0,
  local_close_reading: 1,
  relation_explanation: 2,
  integrated_understanding: 3,
  optional_transfer: 4,
};

function sequenceRoleForSeed(
  seed: ReadingTaskPlanningSeed,
  sequence: TrainingTaskSequencePlanningResult,
): TaskLoadSequenceRole {
  if (seed.taskRole === 'retest' || seed.taskRole === 'transfer') {
    return 'independent_validation';
  }
  if (seed.responseFormat === 'single_choice') {
    return sequence.preludeCandidateIds.includes(seed.planningTaskKey)
      ? 'foundation_entry' : 'bridge';
  }
  const level = seed.loadIntent.textResponseLoadProfile?.loadLevel;
  if (level === 'entry_short') return 'foundation_entry';
  if (level === 'focused_short') return 'bridge';
  if (level === 'developing') return 'development';
  return 'integration';
}

function taskLoadSemanticsForSeed(
  seed: ReadingTaskPlanningSeed,
  materialVersionId: string,
  sequence: TrainingTaskSequencePlanningResult,
): TaskLoadSemantics {
  const semantics: TaskLoadSemantics = {
    schemaVersion: TASK_LOAD_SEMANTICS_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    observationThreadId: `thread:${stableProgressionIdentity({
      materialVersionId,
      abilityId: seed.primaryAbilityId,
      dimension: seed.observationDimension,
      object: seed.observationObject,
      anchor: seed.materialAnchor,
    })}`,
    sequenceRole: sequenceRoleForSeed(seed, sequence),
    primaryAction: seed.loadIntent.primaryAction,
    supportingAction: seed.loadIntent.supportingAction,
    responsibilities: [...seed.loadIntent.responsibilities],
    textResponseLoadProfile: seed.loadIntent.textResponseLoadProfile,
    derivationSource: 'planned',
    confidence: 'high',
  };
  if (!isTaskLoadSemantics(semantics, seed.responseFormat)) {
    throw new Error(`task_load_semantics_seed_planning_failed:${seed.planningTaskKey}`);
  }
  return semantics;
}

export type PlannedMaterialObservationTask = {
  candidate: MaterialObservationPlanningCandidate;
  planningTaskKey: string;
  taskLoadSemantics: TaskLoadSemantics;
  taskLoadSemanticsHash: string;
  curriculumCalibrationRole?: ReadingCurriculumCalibrationRole;
};

export function planReadingTaskGroupProgressionSeeds(input: {
  materialVersionId: string;
  observationPlanRevisionId: string;
  seeds: ReadingTaskPlanningSeed[];
  preference: TrainingTaskSequencePlanningPreference;
  protectedHigherOrderTaskKeys?: string[];
  curriculumCalibration?: ReadingCurriculumCalibrationContext;
}): {
  orderedSeeds: ReadingTaskPlanningSeed[];
  sequencePlanningResult: TrainingTaskSequencePlanningResult;
  planningResult: TaskGroupProgressionPlanningResult;
} {
  if (input.seeds.some((seed) => !isReadingTaskPlanningSeed(seed))) {
    throw new Error('reading_task_planning_seed_invalid');
  }
  const canonicalSeeds = [...input.seeds].sort((left, right) => (
    left.planningTaskKey.localeCompare(right.planningTaskKey)
  ));
  const preliminary = planTrainingTaskSequence({
    tasks: canonicalSeeds.map((seed) => ({
      ...seed,
      candidateId: seed.planningTaskKey,
      questionDraft: { responseFormat: seed.responseFormat },
      taskRole: seed.taskRole,
    })),
    preference: input.preference,
  });
  const preliminaryRoles = new Map(preliminary.tasks.map((item) => [
    item.planningTaskKey,
    sequenceRoleForSeed(item, preliminary.result),
  ]));
  const orderedSeeds = input.preference.strategy === 'entry_first'
    ? [...preliminary.tasks].sort((left, right) => (
        curriculumRoleOrder(left.curriculumCalibrationRole, input.curriculumCalibration)
        - curriculumRoleOrder(right.curriculumCalibrationRole, input.curriculumCalibration)
        ||
        ROLE_RANK[preliminaryRoles.get(left.planningTaskKey) || 'integration']
        - ROLE_RANK[preliminaryRoles.get(right.planningTaskKey) || 'integration']
        || left.planningTaskKey.localeCompare(right.planningTaskKey)
      ))
    : preliminary.tasks;
  const compatibilityProjection = planTrainingTaskSequence({
    tasks: orderedSeeds.map((seed) => ({
      ...seed,
      candidateId: seed.planningTaskKey,
      questionDraft: { responseFormat: seed.responseFormat },
      taskRole: seed.taskRole,
    })),
    preference: input.preference,
  });
  const plannedTasks: PlannedMaterialObservationTask[] = compatibilityProjection.tasks.map((seed) => {
    const taskLoadSemantics = taskLoadSemanticsForSeed(
      seed,
      input.materialVersionId,
      compatibilityProjection.result,
    );
    return {
      candidate: undefined as unknown as MaterialObservationPlanningCandidate,
      planningTaskKey: seed.planningTaskKey,
      taskLoadSemantics,
      taskLoadSemanticsHash: calculateTaskLoadSemanticsHash(taskLoadSemantics),
      curriculumCalibrationRole: seed.curriculumCalibrationRole,
    };
  });
  const progressionPlan = buildProgressionPlan({
    materialVersionId: input.materialVersionId,
    observationPlanRevisionId: input.observationPlanRevisionId,
    plannedTasks,
    sequencePlanningResult: compatibilityProjection.result,
    protectedHigherOrderTaskKeys: input.protectedHigherOrderTaskKeys,
    curriculumCalibration: input.curriculumCalibration,
  });
  const seedByKey = new Map(input.seeds.map((seed) => [seed.planningTaskKey, seed]));
  return {
    orderedSeeds: progressionPlan.orderedTasks.map((item) => seedByKey.get(item.planningTaskKey)!),
    sequencePlanningResult: compatibilityProjection.result,
    planningResult: {
      plannedTasks: plannedTasks.map((item) => ({
        planningTaskKey: item.planningTaskKey,
        taskLoadSemantics: cloneTaskLoadSemantics(item.taskLoadSemantics)!,
        taskLoadSemanticsHash: item.taskLoadSemanticsHash,
      })),
      progressionPlan,
    },
  };
}

export function planReadingTaskGroupProgression(input: {
  materialVersionId: string;
  observationPlanRevisionId: string;
  candidates: MaterialObservationPlanningCandidate[];
  preference: TrainingTaskSequencePlanningPreference;
  taskRole?: RecommendedTaskRole;
  protectedHigherOrderTaskKeys?: string[];
  existingFixedTaskKeys?: string[];
  curriculumCalibration?: ReadingCurriculumCalibrationContext;
}): {
  orderedCandidates: MaterialObservationPlanningCandidate[];
  sequencePlanningResult: TrainingTaskSequencePlanningResult;
  planningResult: TaskGroupProgressionPlanningResult;
  seeds: ReadingTaskPlanningSeed[];
} {
  const canonicalCandidates = [...input.candidates].sort(
    (left, right) => buildPlanningTaskKey(input.materialVersionId, left)
      .localeCompare(buildPlanningTaskKey(input.materialVersionId, right)),
  );
  const preliminary = planTrainingTaskSequence({
    tasks: canonicalCandidates,
    preference: input.preference,
  });
  const preliminarySemantics = new Map(preliminary.tasks.map((candidate) => [
    candidate.candidateId,
    buildPlannedTaskLoadSemantics({
      candidate,
      materialVersionId: input.materialVersionId,
      sequencePlanningResult: preliminary.result,
      taskRole: input.taskRole,
    }),
  ]));
  const ordered = orderCandidatesByProgression({
    candidates: preliminary.tasks,
    semanticsByCandidateId: preliminarySemantics,
    preference: input.preference,
    preludeCandidateIds: preliminary.result.preludeCandidateIds,
    curriculumCalibration: input.curriculumCalibration,
  });
  const compatibilityProjection = planTrainingTaskSequence({
    tasks: ordered,
    preference: input.preference,
  });
  const taskRole = input.taskRole || 'training';
  const plannedTasks: PlannedMaterialObservationTask[] = compatibilityProjection.tasks.map((candidate) => {
    const planningTaskKey = buildPlanningTaskKey(input.materialVersionId, candidate);
    const taskLoadSemantics = alignObservationThread(
      buildPlannedTaskLoadSemantics({
        candidate,
        materialVersionId: input.materialVersionId,
        sequencePlanningResult: compatibilityProjection.result,
        taskRole,
      }),
      candidate,
      input.materialVersionId,
    );
    return {
      candidate,
      planningTaskKey,
      taskLoadSemantics,
      taskLoadSemanticsHash: calculateTaskLoadSemanticsHash(taskLoadSemantics),
      curriculumCalibrationRole: candidate.curriculumCalibrationRole,
    };
  });
  const seeds = plannedTasks.map((item) => createSeed(item, taskRole));
  if (seeds.some((seed) => !isReadingTaskPlanningSeed(seed))) {
    throw new Error('reading_task_planning_seed_invalid');
  }
  const progressionPlan = buildProgressionPlan({
    materialVersionId: input.materialVersionId,
    observationPlanRevisionId: input.observationPlanRevisionId,
    plannedTasks,
    sequencePlanningResult: compatibilityProjection.result,
    protectedHigherOrderTaskKeys: input.protectedHigherOrderTaskKeys,
    curriculumCalibration: input.curriculumCalibration,
  });
  return {
    orderedCandidates: plannedTasks.map((item) => ({
      ...item.candidate,
      planningTaskKey: item.planningTaskKey,
      taskGroupProgressionPlanHash: progressionPlan.planHash,
      taskLoadSemantics: cloneTaskLoadSemantics(item.taskLoadSemantics),
    })),
    sequencePlanningResult: compatibilityProjection.result,
    planningResult: {
      plannedTasks: plannedTasks.map((item) => ({
        planningTaskKey: item.planningTaskKey,
        taskLoadSemantics: cloneTaskLoadSemantics(item.taskLoadSemantics)!,
        taskLoadSemanticsHash: item.taskLoadSemanticsHash,
      })),
      progressionPlan,
    },
    seeds,
  };
}

export function assessReadingTaskGroupProgression(input: {
  plan?: TaskGroupProgressionPlan;
  materialVersionId: string;
  observationPlanRevisionId: string;
  subjects: Array<{
    planningTaskKey?: string;
    subjectId: string;
    taskLoadSemantics?: TaskLoadSemantics;
    taskLoadSemanticsHash?: string;
    taskGroupProgressionPlanHash?: string;
    observationObject: string;
    sourceAnchorIdentity: string;
    scoringTargetIds: string[];
    curriculumCalibrationRole?: ReadingCurriculumCalibrationRole;
  }>;
  assessedAt?: string;
}): ReadingTaskGroupProgressionGateAssessment {
  const blockers: ReadingTaskGroupProgressionBlockerCode[] = [];
  const advisories: ReadingTaskGroupProgressionAdvisoryCode[] = [];
  const plan = input.plan;
  if (!plan || !isTaskGroupProgressionPlan(plan)) {
    blockers.push('progression_plan_missing_or_stale');
  }
  const subjectByKey = new Map(input.subjects
    .filter((subject) => subject.planningTaskKey)
    .map((subject) => [subject.planningTaskKey!, subject]));
  const orderedSubjects = plan?.orderedTasks.map((item) => {
    const subject = subjectByKey.get(item.planningTaskKey);
    return {
      planningTaskKey: item.planningTaskKey,
      subjectId: subject?.subjectId || 'missing',
      taskLoadSemanticsHash: subject?.taskLoadSemanticsHash || 'missing',
    };
  }) || [];
  if (plan) {
    if (plan.materialVersionId !== input.materialVersionId
      || plan.observationPlanRevisionId !== input.observationPlanRevisionId) {
      blockers.push('candidate_plan_context_mismatch');
    }
    const planKeys = plan.orderedTasks.map((item) => item.planningTaskKey);
    const subjectKeys = input.subjects.map((item) => item.planningTaskKey).filter(Boolean);
    if (planKeys.length !== subjectKeys.length
      || planKeys.some((key) => !subjectByKey.has(key))) {
      blockers.push('ordered_task_identity_mismatch');
    }
    plan.orderedTasks.forEach((item) => {
      const subject = subjectByKey.get(item.planningTaskKey);
      if (!subject?.taskLoadSemantics
        || calculateTaskLoadSemanticsHash(subject.taskLoadSemantics) !== item.taskLoadSemanticsHash
        || subject.taskLoadSemanticsHash !== item.taskLoadSemanticsHash) {
        blockers.push('task_semantics_hash_mismatch');
      }
      if (subject?.taskGroupProgressionPlanHash !== plan.planHash) {
        blockers.push('candidate_plan_context_mismatch');
      }
    });
    if (!validStrategyException(plan)) blockers.push('invalid_strategy_exception');
    if (plan.protectedHigherOrderTaskKeys.some((key) => !subjectByKey.has(key))) {
      blockers.push('protected_higher_order_observation_missing');
    }
    if (plan.accessibleEntryTaskKeys.length === 0 && plan.orderedTasks.length > 1) {
      advisories.push('accessible_entry_underfilled');
    }
    plan.transitions.forEach((transition) => {
      if (transition.threadRelation === 'cross_thread') {
        advisories.push('cross_thread_sequence_not_comparable');
      }
      if (transition.loadDirection === 'decrease') advisories.push('load_direction_decreases');
      if (transition.transitionKind === 'legitimate_skip'
        && transition.rationaleCode === 'material_does_not_support_bridge') {
        advisories.push('single_step_bridge_absent');
      }
      if (transition.threadRelation === 'same_thread'
        && transition.loadDirection === 'increase'
        && transitionSequenceRoleGap(transition, subjectByKey) > 1
        && transition.transitionKind !== 'legitimate_skip') {
        blockers.push('unexplained_responsibility_jump');
      }
    });
    const duplicateKeys = duplicateObservationValueKeys(input.subjects);
    if (duplicateKeys.length > 0) blockers.push('duplicate_observation_value');
    if (plan.protectedHigherOrderTaskKeys.length === 0 && plan.orderedTasks.length >= 4) {
      advisories.push('higher_order_coverage_thin');
    }
    assessCurriculumCalibration({ plan, blockers, advisories });
  }
  const uniqueBlockers = [...new Set(blockers)];
  const uniqueAdvisories = [...new Set(advisories)];
  const projectedGroupSnapshotHash = stableProgressionIdentity({
    planHash: plan?.planHash || 'missing',
    orderedSubjects,
    materialVersionId: input.materialVersionId,
    observationPlanRevisionId: input.observationPlanRevisionId,
  });
  return {
    schemaVersion: READING_TASK_GROUP_PROGRESSION_GATE_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    stageRuleVersion: READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
    materialVersionId: input.materialVersionId,
    observationPlanRevisionId: input.observationPlanRevisionId,
    taskGroupProgressionPlanHash: plan?.planHash || 'missing',
    projectedGroupSnapshotHash,
    orderedSubjectIdentities: orderedSubjects,
    decision: !plan
      ? 'insufficient_input'
      : uniqueBlockers.length > 0
        ? 'blocked'
        : uniqueAdvisories.length > 0 ? 'pass_with_advisory' : 'pass',
    blockerCodes: uniqueBlockers,
    advisoryCodes: uniqueAdvisories,
    assessedAt: input.assessedAt || new Date().toISOString(),
  };
}

function buildProgressionPlan(input: {
  materialVersionId: string;
  observationPlanRevisionId: string;
  plannedTasks: PlannedMaterialObservationTask[];
  sequencePlanningResult: TrainingTaskSequencePlanningResult;
  protectedHigherOrderTaskKeys?: string[];
  curriculumCalibration?: ReadingCurriculumCalibrationContext;
}): TaskGroupProgressionPlan {
  const transitions = input.plannedTasks.slice(1).map((current, index) => (
    buildTransition(input.plannedTasks[index]!, current, input.sequencePlanningResult)
  ));
  const reasonCode = input.sequencePlanningResult.reason === 'no_qualified_single_choice'
    ? 'no_qualified_foundation_task'
    : input.sequencePlanningResult.reason;
  const planWithoutHash: Omit<TaskGroupProgressionPlan, 'planHash'> = {
    schemaVersion: TASK_GROUP_PROGRESSION_PLAN_SCHEMA_VERSION,
    policyVersion: READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
    stageRuleVersion: READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
    materialVersionId: input.materialVersionId,
    observationPlanRevisionId: input.observationPlanRevisionId,
    strategy: input.sequencePlanningResult.strategy,
    reasonCode,
    orderedTasks: input.plannedTasks.map((item, index) => ({
      planningTaskKey: item.planningTaskKey,
      taskLoadSemanticsHash: item.taskLoadSemanticsHash,
      sequenceRank: index + 1,
      ...(item.curriculumCalibrationRole
        ? { curriculumCalibrationRole: item.curriculumCalibrationRole }
        : {}),
    })),
    accessibleEntryTaskKeys: input.plannedTasks
      .filter((item) => ['foundation_entry', 'bridge'].includes(item.taskLoadSemantics.sequenceRole))
      .map((item) => item.planningTaskKey),
    protectedHigherOrderTaskKeys: input.protectedHigherOrderTaskKeys?.length
      ? [...input.protectedHigherOrderTaskKeys]
      : input.plannedTasks
        .filter((item) => item.taskLoadSemantics.sequenceRole === 'integration')
        .map((item) => item.planningTaskKey),
    transitions,
    ...(input.sequencePlanningResult.strategy === 'holistic_first'
      ? { exceptionReason: input.sequencePlanningResult.reason }
      : {}),
    derivationSource: 'planned',
    ...(input.curriculumCalibration
      ? { curriculumCalibration: structuredClone(input.curriculumCalibration) }
      : {}),
  };
  const plan: TaskGroupProgressionPlan = {
    ...planWithoutHash,
    planHash: calculateTaskGroupProgressionPlanHash(planWithoutHash),
  };
  const semanticsByTaskKey = new Map(input.plannedTasks.map((item) => [
    item.planningTaskKey,
    item.taskLoadSemantics,
  ]));
  const issues = validateProgressionPlanAgainstSemantics({ plan, semanticsByTaskKey });
  if (issues.length > 0) throw new Error(`task_group_progression_plan_invalid:${issues.join(',')}`);
  return plan;
}

function buildTransition(
  from: PlannedMaterialObservationTask,
  to: PlannedMaterialObservationTask,
  sequence: TrainingTaskSequencePlanningResult,
): TaskGroupProgressionTransition {
  const sameThread = from.taskLoadSemantics.observationThreadId
    === to.taskLoadSemantics.observationThreadId;
  const fromSet = new Set(from.taskLoadSemantics.responsibilities);
  const toSet = new Set(to.taskLoadSemantics.responsibilities);
  const added = to.taskLoadSemantics.responsibilities.filter((item) => !fromSet.has(item));
  const retained = to.taskLoadSemantics.responsibilities.filter((item) => fromSet.has(item));
  const removed = from.taskLoadSemantics.responsibilities.filter((item) => !toSet.has(item));
  if (!sameThread) {
    return transitionBase(from, to, {
      threadRelation: 'cross_thread',
      transitionKind: 'cross_thread',
      addedResponsibilities: [],
      retainedResponsibilities: [],
      loadDirection: 'independent',
      rationaleCode: 'switch_observation_thread',
      rationale: '任务切换了观察线程，顺序只表达学习路径，不作为同线能力递进比较。',
    });
  }
  if (to.taskLoadSemantics.sequenceRole === 'independent_validation') {
    const transfer = sequence.reason === 'transfer_in_new_context';
    return transitionBase(from, to, {
      threadRelation: 'same_thread',
      transitionKind: 'independent_validation',
      addedResponsibilities: added,
      retainedResponsibilities: retained,
      loadDirection: 'independent',
      rationaleCode: transfer ? 'transfer_in_new_context' : 'retest_after_training',
      rationale: transfer ? '在新证据情境中独立验证迁移。' : '在训练后独立验证保持。',
    });
  }
  const direction = removed.length > 0 && added.length === 0
    ? 'decrease' : added.length > 0 ? 'increase' : 'same';
  return transitionBase(from, to, {
    threadRelation: 'same_thread',
    transitionKind: added.length > 0 ? 'progressive' : 'bridge',
    addedResponsibilities: added,
    retainedResponsibilities: retained,
    loadDirection: direction,
    rationaleCode: added.length > 0
      ? 'adjacent_responsibility_growth' : 'foundation_already_observed',
    rationale: added.length > 0
      ? '相邻任务增加作答责任；若一次增加多项责任，题组门禁将要求重新规划。'
      : '相邻任务保持已建立的基础责任。',
  });
}

function transitionBase(
  from: PlannedMaterialObservationTask,
  to: PlannedMaterialObservationTask,
  value: Omit<TaskGroupProgressionTransition,
    'transitionId' | 'fromPlanningTaskKey' | 'toPlanningTaskKey'>,
): TaskGroupProgressionTransition {
  return {
    transitionId: stableProgressionIdentity([
      from.planningTaskKey,
      to.planningTaskKey,
      value.transitionKind,
    ]),
    fromPlanningTaskKey: from.planningTaskKey,
    toPlanningTaskKey: to.planningTaskKey,
    ...value,
  };
}

function orderCandidatesByProgression(input: {
  candidates: MaterialObservationPlanningCandidate[];
  semanticsByCandidateId: Map<string, TaskLoadSemantics>;
  preference: TrainingTaskSequencePlanningPreference;
  preludeCandidateIds: string[];
  curriculumCalibration?: ReadingCurriculumCalibrationContext;
}): MaterialObservationPlanningCandidate[] {
  if (input.preference.strategy !== 'entry_first') return [...input.candidates];
  const prelude = new Set(input.preludeCandidateIds);
  return [...input.candidates].sort((left, right) => {
    const curriculumRank = curriculumRoleOrder(
      left.curriculumCalibrationRole,
      input.curriculumCalibration,
    ) - curriculumRoleOrder(
      right.curriculumCalibrationRole,
      input.curriculumCalibration,
    );
    if (curriculumRank !== 0) return curriculumRank;
    const leftPrelude = prelude.has(left.candidateId) ? 0 : 1;
    const rightPrelude = prelude.has(right.candidateId) ? 0 : 1;
    if (leftPrelude !== rightPrelude) return leftPrelude - rightPrelude;
    const leftRole = input.semanticsByCandidateId.get(left.candidateId)?.sequenceRole || 'integration';
    const rightRole = input.semanticsByCandidateId.get(right.candidateId)?.sequenceRole || 'integration';
    return ROLE_RANK[leftRole] - ROLE_RANK[rightRole]
      || left.candidateId.localeCompare(right.candidateId);
  });
}

function createSeed(
  task: PlannedMaterialObservationTask,
  taskRole: RecommendedTaskRole,
): ReadingTaskPlanningSeed {
  return {
    planningTaskKey: task.planningTaskKey,
    observationDimension: task.candidate.observationDimension,
    observationObject: task.candidate.observationFocus.displayName,
    materialAnchor: { ...task.candidate.materialAnchor },
    primaryAbilityId: task.candidate.primaryAbilityId,
    taskRole,
    responseFormat: task.candidate.questionDraft.responseFormat,
    curriculumCalibrationRole: task.curriculumCalibrationRole,
    loadIntent: {
      primaryAction: task.taskLoadSemantics.primaryAction,
      supportingAction: task.taskLoadSemantics.supportingAction,
      responsibilities: [...task.taskLoadSemantics.responsibilities],
      textResponseLoadProfile: task.taskLoadSemantics.textResponseLoadProfile,
    },
  };
}

function curriculumRoleOrder(
  role: ReadingCurriculumCalibrationRole | undefined,
  context: ReadingCurriculumCalibrationContext | undefined,
): number {
  if (!context || !role) return context ? 5 : 0;
  return CURRICULUM_ROLE_RANK[role];
}

function assessCurriculumCalibration(input: {
  plan: TaskGroupProgressionPlan;
  blockers: ReadingTaskGroupProgressionBlockerCode[];
  advisories: ReadingTaskGroupProgressionAdvisoryCode[];
}): void {
  const context = input.plan.curriculumCalibration;
  if (!context?.requiresWholeTextOrientation) return;
  const orientationIndex = input.plan.orderedTasks.findIndex(
    (task) => task.curriculumCalibrationRole === 'whole_text_orientation',
  );
  const firstDependentIndex = input.plan.orderedTasks.findIndex((task) => (
    ['local_close_reading', 'relation_explanation', 'integrated_understanding']
      .includes(task.curriculumCalibrationRole || '')
  ));
  if (orientationIndex < 0) {
    if (context.enforcementMode === 'enforced') {
      input.blockers.push('required_whole_text_orientation_missing');
    } else {
      input.advisories.push('whole_text_orientation_missing');
    }
    return;
  }
  if (firstDependentIndex >= 0 && firstDependentIndex < orientationIndex) {
    if (context.enforcementMode === 'enforced') {
      input.blockers.push('local_close_reading_before_whole_text_orientation');
    } else {
      input.advisories.push('local_close_reading_precedes_orientation');
    }
  }
}

function buildPlanningTaskKey(
  materialVersionId: string,
  candidate: MaterialObservationPlanningCandidate,
): string {
  return stableProgressionIdentity({
    materialVersionId,
    candidateId: candidate.candidateId,
    dimension: candidate.observationDimension,
    abilityId: candidate.primaryAbilityId,
    anchor: candidate.materialAnchor,
  });
}

function alignObservationThread(
  semantics: TaskLoadSemantics,
  candidate: MaterialObservationPlanningCandidate,
  materialVersionId: string,
): TaskLoadSemantics {
  return {
    ...cloneTaskLoadSemantics(semantics)!,
    observationThreadId: `thread:${stableProgressionIdentity({
      materialVersionId,
      abilityId: candidate.primaryAbilityId,
      dimension: candidate.observationDimension,
      anchorType: candidate.materialAnchor.anchorType,
      start: candidate.materialAnchor.startParagraph,
      end: candidate.materialAnchor.endParagraph,
    })}`,
  };
}

function validStrategyException(plan: TaskGroupProgressionPlan): boolean {
  if (plan.strategy === 'entry_first') {
    return ['default_foundation_entry', 'no_qualified_foundation_task'].includes(plan.reasonCode);
  }
  if (plan.strategy === 'holistic_first') {
    return ['holistic_judgment_required', 'independent_expression_baseline'].includes(plan.reasonCode)
      && Boolean(plan.exceptionReason?.trim());
  }
  return ['retest_after_training', 'transfer_in_new_context'].includes(plan.reasonCode);
}

function duplicateObservationValueKeys(input: Array<{
  planningTaskKey?: string;
  observationObject: string;
  sourceAnchorIdentity: string;
  scoringTargetIds: string[];
}>): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  input.forEach((item) => {
    const identity = stableProgressionIdentity({
      object: normalize(item.observationObject),
      anchor: normalize(item.sourceAnchorIdentity),
      targets: [...item.scoringTargetIds].map(normalize).sort(),
    });
    if (seen.has(identity)) duplicates.push(item.planningTaskKey || identity);
    seen.add(identity);
  });
  return duplicates;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function transitionSequenceRoleGap(
  transition: TaskGroupProgressionTransition,
  subjectByKey: Map<string, {
    taskLoadSemantics?: TaskLoadSemantics;
  }>,
): number {
  const from = subjectByKey.get(transition.fromPlanningTaskKey)?.taskLoadSemantics;
  const to = subjectByKey.get(transition.toPlanningTaskKey)?.taskLoadSemantics;
  if (!from || !to) return Number.POSITIVE_INFINITY;
  return ROLE_RANK[to.sequenceRole] - ROLE_RANK[from.sequenceRole];
}
