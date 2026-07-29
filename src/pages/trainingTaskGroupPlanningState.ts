export type TrainingTaskGroupOperationType = 'replace_group' | 'supplement_group';

export type TrainingTaskGroupCandidate = {
  localId?: string;
  candidateId?: string;
  abilityId?: string;
  primaryDimension?: string;
  questionStem?: string;
};

export type TrainingTaskGroupCandidateSession<T extends TrainingTaskGroupCandidate> = {
  candidateGroupId: string;
  operationType: TrainingTaskGroupOperationType;
  basedOnPlanRevision: number;
  generatedAt: string;
  candidateTasks: T[];
  selectedCandidateTaskIds: string[];
};

export type TrainingTaskGroupCoverage = {
  taskCount: number;
  abilityIds: string[];
  dimensionIds: string[];
};

export function createTrainingTaskGroupCandidateSession<T extends TrainingTaskGroupCandidate>({
  candidateGroupId,
  operationType,
  basedOnPlanRevision,
  candidateTasks,
  generatedAt = new Date().toISOString(),
}: {
  candidateGroupId: string;
  operationType: TrainingTaskGroupOperationType;
  basedOnPlanRevision: number;
  candidateTasks: T[];
  generatedAt?: string;
}): TrainingTaskGroupCandidateSession<T> {
  return {
    candidateGroupId,
    operationType,
    basedOnPlanRevision,
    generatedAt,
    candidateTasks,
    selectedCandidateTaskIds: operationType === 'replace_group'
      ? candidateTasks.map(candidateTaskId)
      : [],
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
  maxTasks = 6,
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
