import type {
  READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
  TaskGroupProgressionPlan,
} from '../ai/schemas/readingTaskGroupProgression.schema.ts';

export type TrainingTaskGroupOperationType = 'replace_group' | 'supplement_group';

export const INITIAL_TRAINING_TASK_RECOMMENDATION = 3;
export const MIN_INITIAL_TRAINING_TASK_COUNT = 2;
export const MAX_TRAINING_TASK_COUNT = 6;
export const MAX_SUPPLEMENT_CANDIDATE_COUNT = 2;

export type TrainingTaskSequenceMetadata = {
  strategy?: 'entry_first' | 'holistic_first' | 'role_driven';
  reason?: string;
  rank?: number;
  isPrelude: boolean;
  preludeCount?: number;
};

export function readTrainingTaskSequenceMetadata(
  tags: string[] = [],
): TrainingTaskSequenceMetadata {
  const strategy = tagValue(tags, 'sequence-strategy');
  const rank = positiveIntegerTag(tags, 'sequence-rank');
  const preludeCount = nonNegativeIntegerTag(tags, 'sequence-prelude-count');
  return {
    strategy: strategy === 'entry_first' ||
      strategy === 'holistic_first' ||
      strategy === 'role_driven'
      ? strategy
      : undefined,
    reason: tagValue(tags, 'sequence-reason'),
    rank,
    isPrelude: tagValue(tags, 'sequence-prelude') === 'true',
    preludeCount,
  };
}

export function buildTrainingTaskSequenceTags(
  metadata: TrainingTaskSequenceMetadata,
): string[] {
  if (!metadata.strategy) return [];
  return [
    `sequence-strategy:${metadata.strategy}`,
    ...(metadata.reason ? [`sequence-reason:${metadata.reason}`] : []),
    ...(metadata.rank ? [`sequence-rank:${metadata.rank}`] : []),
    `sequence-prelude:${metadata.isPrelude === true}`,
    ...(Number.isInteger(metadata.preludeCount)
      ? [`sequence-prelude-count:${metadata.preludeCount}`]
      : []),
  ];
}

function tagValue(tags: string[], prefix: string): string | undefined {
  return tags.find((tag) => tag.startsWith(`${prefix}:`))?.slice(prefix.length + 1);
}

function positiveIntegerTag(tags: string[], prefix: string): number | undefined {
  const value = Number(tagValue(tags, prefix));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function nonNegativeIntegerTag(tags: string[], prefix: string): number | undefined {
  const value = Number(tagValue(tags, prefix));
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

export function resolveTrainingTaskGenerationRequest(
  operationType: TrainingTaskGroupOperationType,
  currentTaskCount: number,
): {
  candidateCount: number;
  planningIntent: 'initial' | 'replacement' | 'supplement';
} {
  if (operationType === 'supplement_group') {
    return {
      candidateCount: Math.min(
        MAX_SUPPLEMENT_CANDIDATE_COUNT,
        Math.max(0, MAX_TRAINING_TASK_COUNT - currentTaskCount),
      ),
      planningIntent: 'supplement',
    };
  }
  return {
    candidateCount: INITIAL_TRAINING_TASK_RECOMMENDATION,
    planningIntent: currentTaskCount === 0 ? 'initial' : 'replacement',
  };
}

export type TrainingTaskGroupCandidate = {
  localId?: string;
  candidateId?: string;
  abilityId?: string;
  primaryDimension?: string;
  questionStem?: string;
  responseFormat?: string;
};

export type SingleChoiceTargetPreference = 'default' | 'expanded';

export type SingleChoiceTargetRange = {
  defaultTarget: number;
  maximum: number;
};

export type SingleChoiceQuantityPlan = {
  currentEffectiveTaskCount: number;
  currentSingleChoiceCount: number;
  intendedSupplementTaskCount: number;
  boundedSupplementTaskCount: number;
  targetEffectiveTaskCount: number;
  targetPreference: SingleChoiceTargetPreference;
  defaultSingleChoiceTarget: number;
  maximumSingleChoiceCount: number;
  targetSingleChoiceCount: number;
  singleChoiceGap: number;
  availableTaskCapacity: number;
  qualifiedIndependentSingleChoiceObservationCount: number;
  requestedSupplementSingleChoiceCount: number;
  singleChoiceLimitExceeded: boolean;
};

export function resolveSingleChoiceTargetRange(
  targetEffectiveTaskCount: number,
): SingleChoiceTargetRange {
  assertNonNegativeInteger(targetEffectiveTaskCount, 'target_effective_task_count_invalid');
  if (targetEffectiveTaskCount > MAX_TRAINING_TASK_COUNT) {
    throw new Error('target_effective_task_count_exceeds_capacity');
  }
  if (targetEffectiveTaskCount <= 1) return { defaultTarget: 0, maximum: 0 };
  if (targetEffectiveTaskCount === 2) return { defaultTarget: 0, maximum: 1 };
  if (targetEffectiveTaskCount === 3) return { defaultTarget: 1, maximum: 2 };
  if (targetEffectiveTaskCount === 4) return { defaultTarget: 1, maximum: 2 };
  if (targetEffectiveTaskCount === 5) return { defaultTarget: 2, maximum: 3 };
  return { defaultTarget: 2, maximum: 3 };
}

export function resolveSingleChoiceQuantityPlan({
  currentEffectiveTaskCount,
  currentSingleChoiceCount,
  intendedSupplementTaskCount,
  qualifiedIndependentSingleChoiceObservationCount,
  targetPreference = 'default',
}: {
  currentEffectiveTaskCount: number;
  currentSingleChoiceCount: number;
  intendedSupplementTaskCount: number;
  qualifiedIndependentSingleChoiceObservationCount: number;
  targetPreference?: SingleChoiceTargetPreference;
}): SingleChoiceQuantityPlan {
  assertNonNegativeInteger(currentEffectiveTaskCount, 'current_effective_task_count_invalid');
  assertNonNegativeInteger(currentSingleChoiceCount, 'current_single_choice_count_invalid');
  assertNonNegativeInteger(intendedSupplementTaskCount, 'intended_supplement_task_count_invalid');
  assertNonNegativeInteger(
    qualifiedIndependentSingleChoiceObservationCount,
    'qualified_single_choice_observation_count_invalid',
  );
  if (currentEffectiveTaskCount > MAX_TRAINING_TASK_COUNT) {
    throw new Error('current_effective_task_count_exceeds_capacity');
  }
  if (currentSingleChoiceCount > currentEffectiveTaskCount) {
    throw new Error('current_single_choice_count_exceeds_task_count');
  }

  const availableTaskCapacity = Math.max(
    0,
    MAX_TRAINING_TASK_COUNT - currentEffectiveTaskCount,
  );
  const boundedSupplementTaskCount = Math.min(
    intendedSupplementTaskCount,
    availableTaskCapacity,
  );
  const targetEffectiveTaskCount = currentEffectiveTaskCount + boundedSupplementTaskCount;
  const targetRange = resolveSingleChoiceTargetRange(targetEffectiveTaskCount);
  const targetSingleChoiceCount = targetPreference === 'expanded'
    ? targetRange.maximum
    : targetRange.defaultTarget;
  const singleChoiceGap = Math.max(0, targetSingleChoiceCount - currentSingleChoiceCount);
  const requestedSupplementSingleChoiceCount = Math.min(
    singleChoiceGap,
    intendedSupplementTaskCount,
    availableTaskCapacity,
    qualifiedIndependentSingleChoiceObservationCount,
  );

  return {
    currentEffectiveTaskCount,
    currentSingleChoiceCount,
    intendedSupplementTaskCount,
    boundedSupplementTaskCount,
    targetEffectiveTaskCount,
    targetPreference,
    defaultSingleChoiceTarget: targetRange.defaultTarget,
    maximumSingleChoiceCount: targetRange.maximum,
    targetSingleChoiceCount,
    singleChoiceGap,
    availableTaskCapacity,
    qualifiedIndependentSingleChoiceObservationCount,
    requestedSupplementSingleChoiceCount,
    singleChoiceLimitExceeded: currentSingleChoiceCount > targetRange.maximum,
  };
}

export function resolveSupplementSingleChoiceCandidateTarget<T extends TrainingTaskGroupCandidate>(
  tasks: T[],
  candidateCount: number,
): number {
  return resolveSupplementSingleChoiceQuantityPlan(tasks, candidateCount)
    .requestedSupplementSingleChoiceCount;
}

export function resolveSupplementSingleChoiceQuantityPlan<T extends TrainingTaskGroupCandidate>(
  tasks: T[],
  intendedSupplementTaskCount: number,
  targetPreference: SingleChoiceTargetPreference = 'default',
): SingleChoiceQuantityPlan {
  const currentSingleChoiceCount = tasks.filter(
    (task) => task.responseFormat === 'single_choice',
  ).length;
  return resolveSingleChoiceQuantityPlan({
    currentEffectiveTaskCount: tasks.length,
    currentSingleChoiceCount,
    intendedSupplementTaskCount,
    // The generator is responsible for proving which requested observations are
    // actually qualified. At request time the supplement batch size is only the
    // deterministic upper bound; quality shortfall handling remains downstream.
    qualifiedIndependentSingleChoiceObservationCount: intendedSupplementTaskCount,
    targetPreference,
  });
}

export type TrainingTaskGroupCandidateSession<T extends TrainingTaskGroupCandidate> = {
  candidateGroupId: string;
  operationType: TrainingTaskGroupOperationType;
  basedOnPlanRevision: number;
  generatedAt: string;
  candidateTasks: T[];
  selectedCandidateTaskIds: string[];
  progressionStageRuleVersion?: typeof READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION;
  taskGroupProgressionPlan?: TaskGroupProgressionPlan;
};

export type TrainingTaskGroupCoverage = {
  taskCount: number;
  abilityIds: string[];
  dimensionIds: string[];
};

export type DuplicateTrainingTaskStem = {
  normalizedStem: string;
  firstIndex: number;
  duplicateIndex: number;
};

export function findDuplicateTrainingTaskStems<T extends TrainingTaskGroupCandidate>(
  tasks: T[],
): DuplicateTrainingTaskStem[] {
  const firstIndexByStem = new Map<string, number>();
  const duplicates: DuplicateTrainingTaskStem[] = [];
  tasks.forEach((task, index) => {
    const normalizedStem = normalizeText(task.questionStem || '');
    if (!normalizedStem) return;
    const firstIndex = firstIndexByStem.get(normalizedStem);
    if (firstIndex === undefined) {
      firstIndexByStem.set(normalizedStem, index);
      return;
    }
    duplicates.push({ normalizedStem, firstIndex, duplicateIndex: index });
  });
  return duplicates;
}

export function createTrainingTaskGroupCandidateSession<T extends TrainingTaskGroupCandidate>({
  candidateGroupId,
  operationType,
  basedOnPlanRevision,
  candidateTasks,
  progressionStageRuleVersion,
  taskGroupProgressionPlan,
  generatedAt = new Date().toISOString(),
}: {
  candidateGroupId: string;
  operationType: TrainingTaskGroupOperationType;
  basedOnPlanRevision: number;
  candidateTasks: T[];
  progressionStageRuleVersion?: typeof READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION;
  taskGroupProgressionPlan?: TaskGroupProgressionPlan;
  generatedAt?: string;
}): TrainingTaskGroupCandidateSession<T> {
  return {
    candidateGroupId,
    operationType,
    basedOnPlanRevision,
    generatedAt,
    candidateTasks,
    progressionStageRuleVersion,
    taskGroupProgressionPlan,
    selectedCandidateTaskIds: candidateTasks.map(candidateTaskId),
  };
}

export function toggleSupplementCandidateSelection<T extends TrainingTaskGroupCandidate>(
  session: TrainingTaskGroupCandidateSession<T>,
  candidateId: string,
): TrainingTaskGroupCandidateSession<T> {
  if (session.operationType !== 'supplement_group') return session;
  const selected = session.selectedCandidateTaskIds.includes(candidateId);
  return {
    ...session,
    selectedCandidateTaskIds: selected
      ? session.selectedCandidateTaskIds.filter((id) => id !== candidateId)
      : [...session.selectedCandidateTaskIds, candidateId],
  };
}

export function adoptTrainingTaskGroupCandidate<T extends TrainingTaskGroupCandidate>({
  session,
  currentTasks,
  currentPlanRevision,
  protectedTaskIds = [],
  maxTasks = MAX_TRAINING_TASK_COUNT,
}: {
  session: TrainingTaskGroupCandidateSession<T>;
  currentTasks: T[];
  currentPlanRevision: number;
  protectedTaskIds?: string[];
  maxTasks?: number;
}): {
  tasks: T[];
  changed: boolean;
  adoptedCandidateTaskIds: string[];
} {
  if (session.basedOnPlanRevision !== currentPlanRevision) {
    throw new Error('candidate_revision_stale');
  }

  if (session.operationType === 'replace_group') {
    const protectedIds = new Set(protectedTaskIds);
    const protectedTasks = currentTasks.filter((task) => protectedIds.has(candidateTaskId(task)));
    const replacementCapacity = Math.max(0, maxTasks - protectedTasks.length);
    const protectedSignatures = new Set(protectedTasks.map(taskCandidateSignature));
    const replacementTasks = session.candidateTasks
      .filter((task) => !protectedSignatures.has(taskCandidateSignature(task)))
      .slice(0, replacementCapacity);
    const tasks = [...protectedTasks, ...replacementTasks];
    return {
      tasks,
      changed: !sameTaskGroup(currentTasks, tasks),
      adoptedCandidateTaskIds: replacementTasks.map(candidateTaskId),
    };
  }

  const selectedIds = new Set(session.selectedCandidateTaskIds);
  const existingSignatures = new Set(currentTasks.map(taskCandidateSignature));
  const adoptedTasks: T[] = [];
  for (const candidate of session.candidateTasks) {
    if (!selectedIds.has(candidateTaskId(candidate))) continue;
    const signature = taskCandidateSignature(candidate);
    if (existingSignatures.has(signature)) continue;
    existingSignatures.add(signature);
    adoptedTasks.push(candidate);
  }
  const remainingCapacity = Math.max(0, maxTasks - currentTasks.length);
  const acceptedTasks = adoptedTasks.slice(0, remainingCapacity);
  return {
    tasks: [...currentTasks, ...acceptedTasks],
    changed: acceptedTasks.length > 0,
    adoptedCandidateTaskIds: acceptedTasks.map(candidateTaskId),
  };
}

export function summarizeTrainingTaskGroupCoverage<T extends TrainingTaskGroupCandidate>(
  tasks: T[],
): TrainingTaskGroupCoverage {
  return {
    taskCount: tasks.length,
    abilityIds: uniqueValues(tasks.map((task) => task.abilityId)),
    dimensionIds: uniqueValues(tasks.map((task) => task.primaryDimension)),
  };
}

export function taskCandidateSignature(task: TrainingTaskGroupCandidate): string {
  return [
    task.abilityId || '',
    task.primaryDimension || '',
    normalizeText(task.questionStem || ''),
  ].join('|');
}

function uniqueValues(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function candidateTaskId(task: TrainingTaskGroupCandidate): string {
  const id = task.localId || task.candidateId;
  if (!id) throw new Error('candidate_task_id_missing');
  return id;
}

function sameTaskGroup<T extends TrainingTaskGroupCandidate>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((task, index) => taskCandidateSignature(task) === taskCandidateSignature(right[index]));
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, '').replace(/[，。！？；：、“”‘’]/g, '');
}

function assertNonNegativeInteger(value: number, errorCode: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(errorCode);
  }
}
