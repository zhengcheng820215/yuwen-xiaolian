import assert from 'node:assert/strict';
import {
  canRemoveTrainingTask,
  MIN_TRAINING_TASK_COUNT,
  removeTrainingTaskAt,
  restoreRemovedTrainingTask,
} from '../../pages/trainingTaskEditingState.ts';

const tasks = [
  { id: 'task-1' },
  { id: 'task-2' },
  { id: 'task-3' },
  { id: 'task-4' },
];

assert.equal(canRemoveTrainingTask(MIN_TRAINING_TASK_COUNT), false);
assert.equal(canRemoveTrainingTask(MIN_TRAINING_TASK_COUNT + 1), true);

const removal = removeTrainingTaskAt(tasks, 1, true);
assert.deepEqual(removal.tasks.map((task) => task.id), ['task-1', 'task-3', 'task-4']);
assert.equal(removal.removed.task.id, 'task-2');
assert.equal(removal.removed.wasEditable, true);

const restored = restoreRemovedTrainingTask(removal.tasks, removal.removed);
assert.deepEqual(restored, tasks);

assert.throws(
  () => removeTrainingTaskAt(tasks.slice(0, MIN_TRAINING_TASK_COUNT), 0),
  /至少保留 2 个任务/,
);

console.log('Training task editing state debug: 4/4 passed.');
