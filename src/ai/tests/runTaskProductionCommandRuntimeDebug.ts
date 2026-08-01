import assert from 'node:assert/strict';
import {
  buildTaskProductionCommandKey,
  executeTaskProductionCommand,
  executeTaskProductionOnce,
  TaskProductionCommandStageError,
} from '../../pages/taskProductionCommandRuntime.ts';

const baseIdentity = {
  command: 'runTaskCheck' as const,
  targetId: 'draft-1',
  expectedRevision: 3,
};

{
  let executionCount = 0;
  let releaseExecution: (() => void) | undefined;
  const waitForRelease = new Promise<void>((resolve) => {
    releaseExecution = resolve;
  });
  const action = async () => {
    executionCount += 1;
    await waitForRelease;
    return { revision: 3 };
  };

  const idempotencyKey = buildTaskProductionCommandKey(baseIdentity);
  const first = executeTaskProductionOnce(idempotencyKey, action);
  const second = executeTaskProductionOnce(idempotencyKey, action);
  assert.equal(first, second);
  releaseExecution?.();

  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(executionCount, 1);
  assert.deepEqual(firstResult, { revision: 3 });
  assert.deepEqual(secondResult, { revision: 3 });
  console.log('PASS 相同命令重复点击只执行一次并复用进行中的结果');
}

{
  const completedStages: string[] = [];
  let partialValue = { draftId: 'draft-1' };
  let capturedError: TaskProductionCommandStageError<typeof partialValue> | null = null;

  try {
    await executeTaskProductionCommand({
      ...baseIdentity,
      command: 'submitTaskForFinalConfirmation',
      stages: [
        {
          stage: 'save_current_revision',
          execute: async () => {
            completedStages.push('save_current_revision');
            return partialValue;
          },
        },
        {
          stage: 'submit_confirmation',
          execute: async () => {
            throw new Error('review service unavailable');
          },
        },
      ],
      resolveValue: () => partialValue,
    });
  } catch (error) {
    assert.ok(error instanceof TaskProductionCommandStageError);
    capturedError = error;
  }

  assert.ok(capturedError);
  assert.equal(capturedError.status, 'partially_completed');
  assert.equal(capturedError.failedStage, 'submit_confirmation');
  assert.deepEqual(capturedError.completedStages, ['save_current_revision']);
  assert.deepEqual(capturedError.partialValue, { draftId: 'draft-1' });
  assert.deepEqual(completedStages, ['save_current_revision']);
  console.log('PASS 阶段失败保留已完成阶段和部分结果');
}

{
  let executionCount = 0;
  const identity = {
    ...baseIdentity,
    command: 'publishConfirmedTask' as const,
  };
  const idempotencyKey = buildTaskProductionCommandKey(identity);

  await assert.rejects(
    executeTaskProductionOnce(idempotencyKey, async () => {
      executionCount += 1;
      throw new Error('temporary publication failure');
    }),
    /temporary publication failure/,
  );

  const retryResult = await executeTaskProductionOnce(idempotencyKey, async () => {
    executionCount += 1;
    return { publicationStatus: 'published' };
  });

  assert.equal(executionCount, 2);
  assert.deepEqual(retryResult, { publicationStatus: 'published' });
  console.log('PASS 失败命令会释放运行锁并允许同一幂等键重试');
}

{
  const revisionThreeKey = buildTaskProductionCommandKey(baseIdentity);
  const revisionFourKey = buildTaskProductionCommandKey({
    ...baseIdentity,
    expectedRevision: 4,
  });
  assert.notEqual(revisionThreeKey, revisionFourKey);
  console.log('PASS 不同 Revision 使用不同命令幂等键');
}

console.log('Task production command runtime debug: 4/4 passed.');
