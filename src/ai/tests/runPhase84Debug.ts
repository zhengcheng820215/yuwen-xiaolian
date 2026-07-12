import { createTaskFulfillmentRequest } from '../agents/taskFulfillmentRequestAgent.ts';
import { matchTaskResources } from '../agents/taskResourceMatchingAgent.ts';
import { branchTaskFulfillment } from '../agents/taskFulfillmentBranchingAgent.ts';
import {
  isExecutableLearningTask,
  isTaskFulfillmentRequest,
  isTaskResourceMatchResult,
} from '../schemas/taskFulfillment.schema.ts';
import {
  buildMockTaskResources,
  buildTaskRequestFixture,
  phase84RunAt,
} from './taskFulfillmentDebugFixtures.ts';

function runPhase84Debug(): void {
  const failures: string[] = [];
  const taskRequest = buildTaskRequestFixture();
  const fulfillmentResult = createTaskFulfillmentRequest({
    taskRequest,
    createdAt: phase84RunAt,
  });

  if (!fulfillmentResult.request) {
    throw new Error('Phase 8.4 debug requires a valid fulfillment request.');
  }

  const matchResult = matchTaskResources({
    fulfillmentRequest: fulfillmentResult.request,
    availableTaskResources: buildMockTaskResources(),
  });
  const branchResult = branchTaskFulfillment({
    fulfillmentRequest: fulfillmentResult.request,
    matchResult,
    availableTaskResources: buildMockTaskResources(),
    createdAt: phase84RunAt,
  });

  console.log('\nPhase 8.4 Task Request Fulfillment Minimum Loop Debug');
  console.log('=====================================================');
  console.log(`fulfillmentRequest: ${fulfillmentResult.request.requestId}`);
  console.log(`match status: ${matchResult.status}`);
  console.log(`selectedTaskId: ${matchResult.selectedTaskId || 'none'}`);
  console.log(`executableTask: ${branchResult.executableTask?.executableTaskId || 'null'}`);
  console.log(`generationRequest: ${branchResult.generationRequest?.generationRequestId || 'null'}`);

  if (!isTaskFulfillmentRequest(fulfillmentResult.request)) failures.push('TaskFulfillmentRequest should match schema.');
  if (!isTaskResourceMatchResult(matchResult)) failures.push('TaskResourceMatchResult should match schema.');
  if (matchResult.status !== 'matched') failures.push(`Expected matched in main loop, got ${matchResult.status}.`);
  if (!branchResult.executableTask || !isExecutableLearningTask(branchResult.executableTask)) failures.push('Matched main loop should create ExecutableLearningTask.');
  if (branchResult.generationRequest !== null) failures.push('Matched main loop should not create generation request.');
  if (branchResult.executableTask?.sourceTaskRequestId !== taskRequest.taskRequestId) failures.push('Source TaskRequest should be traceable.');

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 8.4 task request fulfillment minimum loop debug passed.');
    return;
  }

  console.log('[FAIL] Phase 8.4 debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 8.4 debug check failed.');
}

runPhase84Debug();
