export const MIN_TRAINING_TASK_COUNT = 3;

export type RemovedTrainingTask<T> = {
  index: number;
  task: T;
  wasEditable: boolean;
};

export function canRemoveTrainingTask(taskCount: number): boolean {
  return taskCount > MIN_TRAINING_TASK_COUNT;
}

export function removeTrainingTaskAt<T>(
  tasks: T[],
  index: number,
  wasEditable = false,
): { tasks: T[]; removed: RemovedTrainingTask<T> } {
  if (!canRemoveTrainingTask(tasks.length)) {
    throw new Error(`每个训练任务组至少保留 ${MIN_TRAINING_TASK_COUNT} 个任务。`);
  }
  if (index < 0 || index >= tasks.length) {
    throw new Error('未找到需要删除的训练任务。');
  }

  return {
    tasks: tasks.filter((_, taskIndex) => taskIndex !== index),
    removed: {
      index,
      task: tasks[index],
      wasEditable,
    },
  };
}

export function restoreRemovedTrainingTask<T>(
  tasks: T[],
  removed: RemovedTrainingTask<T>,
): T[] {
  const next = [...tasks];
  next.splice(Math.min(removed.index, next.length), 0, removed.task);
  return next;
}
