import { createTaskFulfillmentRequest } from '../agents/taskFulfillmentRequestAgent.ts';
import { isTaskFulfillmentRequest } from '../schemas/taskFulfillment.schema.ts';
import { buildTaskRequestFixture, phase84RunAt } from './taskFulfillmentDebugFixtures.ts';

function runPhase841TaskFulfillmentRequestDebug(): void {
  const failures: string[] = [];
  const taskRequest = buildTaskRequestFixture();
  const validResult = createTaskFulfillmentRequest({
    taskRequest,
    recentTaskIds: ['task_old_001'],
    createdAt: phase84RunAt,
  });
  const invalidResult = createTaskFulfillmentRequest({
    taskRequest: { taskRequestId: '' },
    createdAt: phase84RunAt,
  });

  console.log('\nPhase 8.4.1 Task Fulfillment Request Debug');
  console.log('===========================================');
  console.log(`valid requestId: ${validResult.request?.requestId || 'null'}`);
  console.log(`invalid blockedReason: ${invalidResult.blockedReason || 'none'}`);

  if (!validResult.request) failures.push('Valid TaskRequest should create TaskFulfillmentRequest.');
  if (validResult.request && !isTaskFulfillmentRequest(validResult.request)) failures.push('TaskFulfillmentRequest should match schema.');
  if (validResult.request?.sourceTaskRequestId !== taskRequest.taskRequestId) failures.push('sourceTaskRequestId should be preserved.');
  if (validResult.request?.sourceStrategyId !== taskRequest.strategyId) failures.push('sourceStrategyId should be preserved.');
  if (!validResult.request?.recentTaskIds?.includes('task_old_001')) failures.push('recentTaskIds should be preserved.');
  if (invalidResult.request !== null) failures.push('Invalid TaskRequest should be blocked.');
  if (!invalidResult.blockedReason) failures.push('Invalid TaskRequest should include blockedReason.');

  printAcceptance(failures);
}

function printAcceptance(failures: string[]): void {
  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 8.4.1 task fulfillment request debug passed.');
    return;
  }

  console.log('[FAIL] Phase 8.4.1 debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 8.4.1 debug check failed.');
}

runPhase841TaskFulfillmentRequestDebug();
