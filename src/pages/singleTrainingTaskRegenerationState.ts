export type EditableTrainingTask = {
  localId?: string;
  observationTaskPlanId?: string;
  editorDirty?: boolean;
  [key: string]: unknown;
};

export function adoptSingleTrainingTaskCandidate<T extends EditableTrainingTask>(input: {
  currentTasks: T[];
  sourceTaskId: string;
  candidateTask: T;
}) {
  const targetIndex = input.currentTasks.findIndex(
    (task) => task.observationTaskPlanId === input.sourceTaskId,
  );
  if (targetIndex < 0) {
    throw new Error('single_task_candidate_stale');
  }

  const sourceTask = input.currentTasks[targetIndex];
  const {
    localId: _candidateLocalId,
    editorDirty: _candidateEditorDirty,
    ...candidateContent
  } = input.candidateTask;
  const {
    localId: _sourceLocalId,
    editorDirty: _sourceEditorDirty,
    ...sourceContent
  } = sourceTask;
  const changed = JSON.stringify(sourceContent) !== JSON.stringify(candidateContent);
  if (!changed) {
    return {
      tasks: input.currentTasks,
      adoptedTask: sourceTask,
      changed: false,
    };
  }

  const adoptedTask = {
    ...input.candidateTask,
    localId: sourceTask.localId || input.candidateTask.localId,
    observationTaskPlanId: sourceTask.observationTaskPlanId,
    editorDirty: true,
  };
  const tasks = input.currentTasks.map((task, index) => (
    index === targetIndex ? adoptedTask : task
  )) as T[];

  return {
    tasks,
    adoptedTask: adoptedTask as T,
    changed: true,
  };
}
