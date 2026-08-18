import {
  TRAINING_TASK_SEQUENCE_PLANNING_VERSION,
  type TrainingTaskSequencePlanningPreference,
  type TrainingTaskSequencePlanningResult,
} from '../schemas/trainingTaskSequencePlanning.schema.ts';

export type SequencePlannableTrainingTask = {
  candidateId?: string;
  localId?: string;
  responseFormat?: string;
  questionDraft?: { responseFormat?: string };
  difficulty?: string;
  difficultySuggestion?: string;
  taskRole?: string;
  safetyBoundary?: { taskRole?: string };
};

export function resolvePreferredPreludeChoiceCount(taskCount: number): number {
  if (!Number.isInteger(taskCount) || taskCount < 0) {
    throw new Error('task_count_invalid');
  }
  if (taskCount < 2) return 0;
  return taskCount >= 5 ? 2 : 1;
}

export function createDefaultTrainingTaskSequencePreference(
  taskCount: number,
): TrainingTaskSequencePlanningPreference {
  return {
    strategy: 'entry_first',
    reason: 'default_foundation_entry',
    preferredPreludeChoiceCount: resolvePreferredPreludeChoiceCount(taskCount),
  };
}

export function planTrainingTaskSequence<T extends SequencePlannableTrainingTask>({
  tasks,
  preference = createDefaultTrainingTaskSequencePreference(tasks.length),
}: {
  tasks: T[];
  preference?: TrainingTaskSequencePlanningPreference;
}): {
  tasks: T[];
  result: TrainingTaskSequencePlanningResult;
} {
  validatePreference(preference);
  if (tasks.length === 0) {
    return {
      tasks: [...tasks],
      result: buildResult({
        tasks,
        preference,
        expectedPreludeChoiceCount: 0,
        actualPreludeChoiceCount: 0,
        preludeTasks: [],
        status: 'not_applicable',
      }),
    };
  }

  if (preference.strategy === 'holistic_first') {
    const firstTextTask = tasks.find(isTextResponseTask);
    const orderedTasks = firstTextTask
      ? [firstTextTask, ...tasks.filter((task) => task !== firstTextTask)]
      : [...tasks];
    return {
      tasks: orderedTasks,
      result: buildResult({
        tasks: orderedTasks,
        preference,
        expectedPreludeChoiceCount: 0,
        actualPreludeChoiceCount: 0,
        preludeTasks: [],
        status: 'adjusted',
      }),
    };
  }

  if (preference.strategy === 'role_driven') {
    return {
      tasks: [...tasks],
      result: buildResult({
        tasks,
        preference,
        expectedPreludeChoiceCount: 0,
        actualPreludeChoiceCount: 0,
        preludeTasks: [],
        status: 'adjusted',
      }),
    };
  }

  if (preference.preferredPreludeChoiceCount === 0) {
    return {
      tasks: [...tasks],
      result: buildResult({
        tasks,
        preference,
        expectedPreludeChoiceCount: 0,
        actualPreludeChoiceCount: 0,
        preludeTasks: [],
        status: 'not_applicable',
      }),
    };
  }

  const selectedPreludeTasks = tasks
    .filter(isFoundationEntrySingleChoice)
    .slice(0, preference.preferredPreludeChoiceCount);
  const selected = new Set(selectedPreludeTasks);
  const remainingTasks = tasks.filter((task) => !selected.has(task));
  const firstTextTask = remainingTasks.find(isTextResponseTask);
  const orderedTail = firstTextTask
    ? [firstTextTask, ...remainingTasks.filter((task) => task !== firstTextTask)]
    : remainingTasks;
  const orderedTasks = [...selectedPreludeTasks, ...orderedTail];
  const actualPreludeChoiceCount = selectedPreludeTasks.length;
  const underfilled = actualPreludeChoiceCount < preference.preferredPreludeChoiceCount;
  const effectivePreference = underfilled && actualPreludeChoiceCount === 0
    ? { ...preference, reason: 'no_qualified_single_choice' as const }
    : preference;

  return {
    tasks: orderedTasks,
    result: buildResult({
      tasks: orderedTasks,
      preference: effectivePreference,
      expectedPreludeChoiceCount: preference.preferredPreludeChoiceCount,
      actualPreludeChoiceCount,
      preludeTasks: selectedPreludeTasks,
      status: underfilled ? 'underfilled' : 'met',
    }),
  };
}

export function isFoundationEntrySingleChoice(
  task: SequencePlannableTrainingTask,
): boolean {
  const responseFormat = task.responseFormat || task.questionDraft?.responseFormat;
  const difficulty = task.difficulty || task.difficultySuggestion;
  const taskRole = task.taskRole || task.safetyBoundary?.taskRole;
  return responseFormat === 'single_choice' &&
    difficulty !== 'advanced' &&
    taskRole !== 'retest' &&
    taskRole !== 'transfer';
}

export function isTextResponseTask(task: SequencePlannableTrainingTask): boolean {
  const responseFormat = task.responseFormat || task.questionDraft?.responseFormat;
  return responseFormat === 'short_text' || responseFormat === 'long_text';
}

function validatePreference(preference: TrainingTaskSequencePlanningPreference) {
  if (
    !Number.isInteger(preference.preferredPreludeChoiceCount) ||
    preference.preferredPreludeChoiceCount < 0 ||
    preference.preferredPreludeChoiceCount > 2
  ) {
    throw new Error('preferred_prelude_choice_count_invalid');
  }
  if (
    preference.strategy === 'entry_first' &&
    !['default_foundation_entry', 'no_qualified_single_choice'].includes(preference.reason)
  ) {
    throw new Error('entry_first_reason_invalid');
  }
  if (
    preference.strategy === 'holistic_first' &&
    !['holistic_judgment_required', 'independent_expression_baseline'].includes(preference.reason)
  ) {
    throw new Error('holistic_first_reason_invalid');
  }
  if (
    preference.strategy === 'role_driven' &&
    !['retest_after_training', 'transfer_in_new_context'].includes(preference.reason)
  ) {
    throw new Error('role_driven_reason_invalid');
  }
}

function buildResult<T extends SequencePlannableTrainingTask>({
  tasks,
  preference,
  expectedPreludeChoiceCount,
  actualPreludeChoiceCount,
  preludeTasks,
  status,
}: {
  tasks: T[];
  preference: TrainingTaskSequencePlanningPreference;
  expectedPreludeChoiceCount: number;
  actualPreludeChoiceCount: number;
  preludeTasks: T[];
  status: TrainingTaskSequencePlanningResult['status'];
}): TrainingTaskSequencePlanningResult {
  return {
    strategy: preference.strategy,
    reason: preference.reason,
    expectedPreludeChoiceCount,
    actualPreludeChoiceCount,
    preludeCandidateIds: preludeTasks.map((task, index) => (
      task.candidateId || task.localId || `candidate-${index + 1}`
    )),
    status,
    orderedCandidateIds: tasks.map((task, index) => (
      task.candidateId || task.localId || `candidate-${index + 1}`
    )),
    version: TRAINING_TASK_SEQUENCE_PLANNING_VERSION,
  };
}
