import { branchTaskFulfillment } from '../agents/taskFulfillmentBranchingAgent.ts';
import { matchTaskResources } from '../agents/taskResourceMatchingAgent.ts';
import {
  isExecutableLearningTask,
  isTaskGenerationRequest,
} from '../schemas/taskFulfillment.schema.ts';
import {
  buildFulfillmentRequestFixture,
  buildMockTaskResources,
  phase84RunAt,
} from './taskFulfillmentDebugFixtures.ts';

function runPhase843TaskFulfillmentBranchingDebug(): void {
  const failures: string[] = [];
  const resources = buildMockTaskResources();
  const matchedRequest = buildFulfillmentRequestFixture();
  const partialRequest = buildFulfillmentRequestFixture({
    recentTaskIds: ['task_matched_retest_reasoning'],
  });
  const noMatchRequest = buildFulfillmentRequestFixture({
    targetAbilityId: '概括',
    requiredCapabilities: ['open_response', 'ability_observation', 'summary_extraction'],
  });
  const matchedResult = matchTaskResources({ fulfillmentRequest: matchedRequest, availableTaskResources: resources });
  const partialResult = matchTaskResources({ fulfillmentRequest: partialRequest, availableTaskResources: resources });
  const noMatchResult = matchTaskResources({ fulfillmentRequest: noMatchRequest, availableTaskResources: resources });

  const matchedBranch = branchTaskFulfillment({
    fulfillmentRequest: matchedRequest,
    matchResult: matchedResult,
    availableTaskResources: resources,
    createdAt: phase84RunAt,
  });
  const partialBranch = branchTaskFulfillment({
    fulfillmentRequest: partialRequest,
    matchResult: partialResult,
    availableTaskResources: resources,
    createdAt: phase84RunAt,
  });
  const noMatchBranch = branchTaskFulfillment({
    fulfillmentRequest: noMatchRequest,
    matchResult: noMatchResult,
    availableTaskResources: resources,
    createdAt: phase84RunAt,
  });

  console.log('\nPhase 8.4.3 Task Fulfillment Branching Debug');
  console.log('============================================');
  console.log(`matched executable: ${matchedBranch.executableTask?.executableTaskId || 'null'}`);
  console.log(`partial executable: ${partialBranch.executableTask?.executableTaskId || 'null'}`);
  console.log(`partial generation: ${partialBranch.generationRequest?.generationRequestId || 'null'}`);
  console.log(`noMatch generation: ${noMatchBranch.generationRequest?.generationRequestId || 'null'}`);

  if (!matchedBranch.executableTask || !isExecutableLearningTask(matchedBranch.executableTask)) failures.push('matched should create ExecutableLearningTask.');
  if (matchedBranch.generationRequest !== null) failures.push('matched should not create TaskGenerationRequest.');
  if (partialBranch.executableTask !== null) failures.push('partial_match must not create ExecutableLearningTask.');
  if (!partialBranch.generationRequest || !isTaskGenerationRequest(partialBranch.generationRequest)) failures.push('partial_match should create TaskGenerationRequest.');
  if (!partialBranch.blockedReason) failures.push('partial_match should include blockedReason.');
  if (noMatchBranch.executableTask !== null) failures.push('no_match must not create ExecutableLearningTask.');
  if (!noMatchBranch.generationRequest || !isTaskGenerationRequest(noMatchBranch.generationRequest)) failures.push('no_match should create TaskGenerationRequest.');
  if (matchedBranch.executableTask?.sourceTaskRequestId !== matchedRequest.sourceTaskRequestId) failures.push('ExecutableLearningTask should keep sourceTaskRequestId.');
  if (noMatchBranch.generationRequest?.sourceFulfillmentRequestId !== noMatchRequest.requestId) failures.push('TaskGenerationRequest should keep sourceFulfillmentRequestId.');

  printAcceptance(failures);
}

function printAcceptance(failures: string[]): void {
  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 8.4.3 task fulfillment branching debug passed.');
    return;
  }

  console.log('[FAIL] Phase 8.4.3 debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 8.4.3 debug check failed.');
}

runPhase843TaskFulfillmentBranchingDebug();
