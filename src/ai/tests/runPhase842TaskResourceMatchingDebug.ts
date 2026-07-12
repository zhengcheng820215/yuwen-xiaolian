import { matchTaskResources } from '../agents/taskResourceMatchingAgent.ts';
import { isTaskResourceMatchResult } from '../schemas/taskFulfillment.schema.ts';
import {
  buildFulfillmentRequestFixture,
  buildMockTaskResources,
} from './taskFulfillmentDebugFixtures.ts';

function runPhase842TaskResourceMatchingDebug(): void {
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

  const matched = matchTaskResources({
    fulfillmentRequest: matchedRequest,
    availableTaskResources: resources,
  });
  const partial = matchTaskResources({
    fulfillmentRequest: partialRequest,
    availableTaskResources: resources,
  });
  const noMatch = matchTaskResources({
    fulfillmentRequest: noMatchRequest,
    availableTaskResources: resources,
  });

  console.log('\nPhase 8.4.2 Task Resource Matching Debug');
  console.log('========================================');
  console.log(`matched status: ${matched.status}, selected: ${matched.selectedTaskId || 'none'}`);
  console.log(`partial status: ${partial.status}, selected: ${partial.selectedTaskId || 'none'}`);
  console.log(`noMatch status: ${noMatch.status}, selected: ${noMatch.selectedTaskId || 'none'}`);

  if (!isTaskResourceMatchResult(matched)) failures.push('matched result should match schema.');
  if (!isTaskResourceMatchResult(partial)) failures.push('partial result should match schema.');
  if (!isTaskResourceMatchResult(noMatch)) failures.push('noMatch result should match schema.');
  if (matched.status !== 'matched') failures.push(`Expected matched, got ${matched.status}.`);
  if (!matched.selectedTaskId) failures.push('matched should include selectedTaskId.');
  if (partial.status !== 'partial_match') failures.push(`Expected partial_match, got ${partial.status}.`);
  if (partial.selectedTaskId) failures.push('partial_match should not include selectedTaskId.');
  if (partial.unmetPreferences.length === 0) failures.push('partial_match should include unmetPreferences.');
  if (noMatch.status !== 'no_match') failures.push(`Expected no_match, got ${noMatch.status}.`);
  if (noMatch.selectedTaskId) failures.push('no_match should not include selectedTaskId.');
  if (noMatch.unmetConstraints.length === 0) failures.push('no_match should include unmetConstraints.');

  printAcceptance(failures);
}

function printAcceptance(failures: string[]): void {
  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 8.4.2 task resource matching debug passed.');
    return;
  }

  console.log('[FAIL] Phase 8.4.2 debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 8.4.2 debug check failed.');
}

runPhase842TaskResourceMatchingDebug();
