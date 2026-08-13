import assert from 'node:assert/strict';
import { FormalResourceCommandQueue } from '../../pages/formalResourceCommandQueue.ts';

async function main() {
  const queue = new FormalResourceCommandQueue();
  const events: string[] = [];
  const snapshots: string[] = [];
  queue.subscribe((snapshot) => {
    snapshots.push(`${snapshot.activeKey || '-'}|${snapshot.queuedKeys.join(',')}`);
  });

  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const first = queue.enqueue('task-1:publish', async () => {
    events.push('first:start');
    await firstGate;
    events.push('first:end');
    return 'first-result';
  });
  const duplicate = queue.enqueue('task-1:publish', async () => {
    throw new Error('duplicate command must not execute');
  });
  const second = queue.enqueue('task-2:publish', async () => {
    events.push('second:start');
    throw new Error('expected failure');
  });
  const third = queue.enqueue('task-3:publish', async () => {
    events.push('third:start');
    return 'third-result';
  });

  assert.equal(first, duplicate, 'same command key must reuse the original Promise');
  await Promise.resolve();
  assert.deepEqual(events, ['first:start']);
  assert.deepEqual(queue.getSnapshot(), {
    activeKey: 'task-1:publish',
    queuedKeys: ['task-2:publish', 'task-3:publish'],
  });
  releaseFirst();
  assert.equal(await first, 'first-result');
  await assert.rejects(second, /expected failure/);
  assert.equal(await third, 'third-result');
  assert.deepEqual(events, [
    'first:start',
    'first:end',
    'second:start',
    'third:start',
  ]);
  assert.deepEqual(queue.getSnapshot(), { activeKey: null, queuedKeys: [] });
  assert(snapshots.some((snapshot) => snapshot === 'task-1:publish|task-2:publish,task-3:publish'));

  console.log('Formal resource command queue debug: 5/5 passed');
  console.log('- FIFO execution');
  console.log('- same-key Promise reuse');
  console.log('- queued-state projection');
  console.log('- failure isolation');
  console.log('- idle-state recovery');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
