import { generateNextLearningStrategy } from '../agents/nextLearningStrategyAgent.ts';
import { isNextLearningStrategy } from '../schemas/nextLearningStrategy.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildGrowthMemorySummaryFixture,
  buildStudentAbilityProfileFixture,
  phase83MappingCases,
  phase83RunAt,
} from './nextLearningStrategyDebugFixtures.ts';

function runPhase831NextLearningStrategyDebug(): void {
  const failures: string[] = [];
  const profile = buildStudentAbilityProfileFixture();

  console.log('\nPhase 8.3.1 Next Learning Strategy Debug');
  console.log('========================================');

  for (const item of phase83MappingCases) {
    const summary = buildGrowthMemorySummaryFixture(item.trend);
    const context = buildCurrentLearningContextFixture(item.context);
    const strategy = generateNextLearningStrategy({
      growthMemorySummary: summary,
      studentAbilityProfile: profile,
      currentLearningContext: context,
      createdAt: phase83RunAt,
    });

    console.log(`\n${item.name}`);
    console.log('------------------------------');
    console.log(`action: ${strategy.action}`);
    console.log(`recommendedTaskRole: ${strategy.recommendedTaskRole}`);
    console.log(`validationGoal: ${strategy.validationGoal}`);

    if (!isNextLearningStrategy(strategy)) failures.push(`${item.name}: strategy should match schema.`);
    if (strategy.action !== item.expectedAction) failures.push(`${item.name}: expected action ${item.expectedAction}, got ${strategy.action}.`);
    if (strategy.recommendedTaskRole !== item.expectedRole) failures.push(`${item.name}: expected role ${item.expectedRole}, got ${strategy.recommendedTaskRole}.`);
    if (strategy.evidenceLinks.length === 0) failures.push(`${item.name}: evidenceLinks should not be empty.`);
    if (strategy.growthMemoryRecordIds.length === 0 && item.trend !== 'insufficient_evidence') {
      failures.push(`${item.name}: growthMemoryRecordIds should not be empty.`);
    }
  }

  printAcceptance(failures, 'Phase 8.3.1 next learning strategy debug passed.');
}

function printAcceptance(failures: string[], passMessage: string): void {
  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log(`[PASS] ${passMessage}`);
    return;
  }

  console.log('[FAIL] Phase 8.3.1 debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 8.3.1 debug check failed.');
}

runPhase831NextLearningStrategyDebug();
