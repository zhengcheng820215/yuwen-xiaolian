import assert from 'node:assert/strict';
import {
  createRecoveredLearningSessionTaskQueue,
  createLearningSessionTaskQueue,
  LEARNING_SESSION_TASK_QUEUE_MAX_COUNT,
  resolveLearningSessionTaskQueueProgress,
} from '../agents/learningSessionTaskQueueAgent.ts';
import {
  isLearningSessionTaskQueue,
  LEARNING_SESSION_TASK_QUEUE_VERSION,
} from '../schemas/unifiedLearningEntry.schema.ts';
import type { FrozenQuestionResourceVersion } from
  '../schemas/questionResourceAdmission.schema.ts';
import {
  formatNextTaskAction,
  formatNextTaskContinuation,
} from '../../ui/learningSessionProgressCopy.ts';

const NOW = '2026-08-19T09:00:00.000Z';
const choice1 = version('choice-1', 'single_choice', 1);
const choice2 = version('choice-2', 'single_choice', 2);
const text1 = version('text-1', 'long_text', 3);
const text2 = version('text-2', 'long_text', 4);
const text3 = version('text-3', 'long_text', 5);
const text4 = version('text-4', 'long_text', 6);
const overflow = version('overflow', 'long_text', 7);

const queue = createLearningSessionTaskQueue({
  firstResourceVersion: choice1,
  currentVersions: [text3, overflow, choice2, text1, choice1, text4, text2],
  createdAt: NOW,
});
assert.equal(queue.targetTaskCount, LEARNING_SESSION_TASK_QUEUE_MAX_COUNT);
assert.deepEqual(queue.resourceVersionIds, [
  'choice-1', 'choice-2', 'text-1', 'text-2', 'text-3', 'text-4',
]);
assert.ok(isLearningSessionTaskQueue(queue));

const first = resolveLearningSessionTaskQueueProgress(queue, 1);
assert.equal(first.currentResourceVersionId, 'choice-1');
assert.equal(first.nextResourceVersionId, 'choice-2');
assert.equal(first.hasNextTask, true);
assert.equal(first.isComplete, false);

const fourth = resolveLearningSessionTaskQueueProgress(queue, 4);
assert.equal(fourth.currentResourceVersionId, 'text-2');
assert.equal(fourth.nextResourceVersionId, 'text-3');
assert.equal(fourth.hasNextTask, true);

const fifth = resolveLearningSessionTaskQueueProgress(queue, 5);
assert.equal(fifth.currentResourceVersionId, 'text-3');
assert.equal(fifth.nextResourceVersionId, 'text-4');
assert.equal(fifth.hasNextTask, true);

const sixth = resolveLearningSessionTaskQueueProgress(queue, 6);
assert.equal(sixth.currentResourceVersionId, 'text-4');
assert.equal(sixth.hasNextTask, false);
assert.equal(sixth.isComplete, true);

const restoredAtThird = createLearningSessionTaskQueue({
  firstResourceVersion: text1,
  currentVersions: [text3, choice2, text1, choice1, text2],
  currentTaskNumber: 3,
  createdAt: NOW,
});
assert.equal(restoredAtThird.resourceVersionIds[2], 'text-1');
assert.equal(
  resolveLearningSessionTaskQueueProgress(restoredAtThird, 3).currentResourceVersionId,
  'text-1',
);

const retest = version('retest-1', 'long_text', 1, 'retest');
const retestQueue = createLearningSessionTaskQueue({
  firstResourceVersion: retest,
  currentVersions: [choice1, choice2, retest],
  createdAt: NOW,
});
assert.deepEqual(retestQueue.resourceVersionIds, ['retest-1']);

const previousFrozen = version('text-1-v1', 'long_text', 1);
const successorHead = {
  ...version('text-1-v2', 'long_text', 1),
  resourceId: previousFrozen.resourceId,
};
const recoveredLegacyQueue = createRecoveredLearningSessionTaskQueue({
  previousResourceVersion: previousFrozen,
  currentVersions: [successorHead, choice2, text2, text3],
  currentTaskNumber: 1,
  createdAt: NOW,
});
assert.equal(recoveredLegacyQueue.resourceVersionIds[0], previousFrozen.resourceVersionId);
assert.equal(recoveredLegacyQueue.resourceVersionIds.includes(successorHead.resourceVersionId), false);
assert.equal(recoveredLegacyQueue.resourceVersionIds[1], choice2.resourceVersionId);

assert.equal(isLearningSessionTaskQueue({
  queueVersion: LEARNING_SESSION_TASK_QUEUE_VERSION,
  materialId: 'material-1',
  resourceVersionIds: ['choice-1', 'choice-1'],
  targetTaskCount: 2,
  createdAt: NOW,
}), false);

assert.equal(formatNextTaskAction(2, 6), '进入第 2 题（共 6 题）');
assert.equal(
  formatNextTaskContinuation(2, 6),
  '本题结果已经保存，接下来进入第 2 题（共 6 题）。',
);

console.log('Learning session task queue debug: 24/24 passed.');

function version(
  resourceVersionId: string,
  responseFormat: 'single_choice' | 'long_text',
  rank: number,
  taskRole: 'training' | 'retest' = 'training',
): FrozenQuestionResourceVersion {
  return {
    resourceVersionId,
    resourceId: `resource-${resourceVersionId}`,
    taskId: `task-${resourceVersionId}`,
    materialId: 'material-1',
    status: 'frozen',
    responseFormat,
    tags: [
      'sequence-strategy:entry_first',
      `sequence-rank:${rank}`,
      `sequence-prelude:${responseFormat === 'single_choice' ? 'true' : 'false'}`,
      'sequence-prelude-count:2',
    ],
    abilityMetadata: {
      abilityId: 'comprehension',
      supportingAbilityIds: [],
      prerequisiteAbilityIds: [],
      taskRole,
      difficulty: 'basic',
    },
  } as FrozenQuestionResourceVersion;
}
