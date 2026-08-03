import assert from 'node:assert/strict';
import {
  executePublishConfirmedTaskBatchCommand,
  type TaskPublicationBatchItem,
} from '../../pages/taskPublicationBatch.ts';

const empty = await executePublishConfirmedTaskBatchCommand({
  items: [],
  publishItem: async () => {
    throw new Error('empty batch must not execute');
  },
});
assert.deepEqual(empty, {
  status: 'no_eligible_tasks',
  total: 0,
  completed: 0,
  failed: 0,
  items: [],
});

const firstBatch: TaskPublicationBatchItem[] = [
  task('task-ready', 'draft-ready', 'publish'),
  task('task-failed', 'draft-failed', 'retry_publication'),
];
const executionOrder: string[] = [];
const retryFlags: boolean[] = [];
const callbackOrder: string[] = [];
const mixed = await executePublishConfirmedTaskBatchCommand({
  items: firstBatch,
  onItemStart: (item) => callbackOrder.push(`start:${item.draftId}`),
  onItemComplete: (item) => callbackOrder.push(`complete:${item.draftId}:${item.status}`),
  publishItem: async (input) => {
    executionOrder.push(input.draftId);
    retryFlags.push(input.retryExistingPublication);
    if (input.draftId === 'draft-failed') {
      throw new Error('registry unavailable');
    }
    return commandResult(input.draftId, input.retryExistingPublication);
  },
});

assert.equal(mixed.status, 'partially_completed');
assert.equal(mixed.completed, 1);
assert.equal(mixed.failed, 1);
assert.deepEqual(executionOrder, ['draft-ready', 'draft-failed']);
assert.deepEqual(retryFlags, [false, true]);
assert.deepEqual(callbackOrder, [
  'start:draft-ready',
  'complete:draft-ready:published',
  'start:draft-failed',
  'complete:draft-failed:failed',
]);
assert.equal(mixed.items[0]?.retryable, false);
assert.equal(mixed.items[1]?.retryable, true);

const retryExecutionOrder: string[] = [];
const retryOnly = await executePublishConfirmedTaskBatchCommand({
  items: mixed.items
    .filter((item) => item.status === 'failed')
    .map(({ trainingTaskId, draftId, expectedDraftRevision }) => ({
      trainingTaskId,
      draftId,
      expectedDraftRevision,
      action: 'retry_publication' as const,
    })),
  publishItem: async (input) => {
    retryExecutionOrder.push(input.draftId);
    assert.equal(input.retryExistingPublication, true);
    return commandResult(input.draftId, true);
  },
});

assert.equal(retryOnly.status, 'completed');
assert.equal(retryOnly.completed, 1);
assert.equal(retryOnly.failed, 0);
assert.deepEqual(retryExecutionOrder, ['draft-failed']);

let observerFailureDidNotAbort = false;
const observerSafe = await executePublishConfirmedTaskBatchCommand({
  items: [task('task-observer', 'draft-observer', 'publish')],
  onItemStart: () => {
    throw new Error('observer failure');
  },
  publishItem: async (input) => {
    observerFailureDidNotAbort = true;
    return commandResult(input.draftId, false);
  },
});
assert.equal(observerFailureDidNotAbort, true);
assert.equal(observerSafe.status, 'completed');

console.log('Task publication orchestration debug passed.');

function task(
  trainingTaskId: string,
  draftId: string,
  action: TaskPublicationBatchItem['action'],
): TaskPublicationBatchItem {
  return {
    trainingTaskId,
    draftId,
    expectedDraftRevision: 4,
    action,
  };
}

function commandResult(draftId: string, reused: boolean) {
  return {
    command: reused ? 'retryTaskPublication' : 'publishConfirmedTask',
    commandId: `command:${draftId}`,
    idempotencyKey: `publication:${draftId}`,
    targetId: draftId,
    expectedRevision: 4,
    status: reused ? 'reused' : 'completed',
    completedStages: ['publication_completed'],
  } as const;
}
