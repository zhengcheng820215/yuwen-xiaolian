import { generateNextLearningStrategy } from '../agents/nextLearningStrategyAgent.ts';
import { createTaskRequest } from '../agents/taskRequestAgent.ts';
import { validateNextLearningStrategy } from '../agents/strategyValidationAgent.ts';
import { isNextLearningStrategy, isStrategyValidationResult, isTaskRequest } from '../schemas/nextLearningStrategy.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildGrowthMemorySummaryFixture,
  buildStudentAbilityProfileFixture,
  phase83RunAt,
} from './nextLearningStrategyDebugFixtures.ts';

function runPhase83Debug(): void {
  const failures: string[] = [];
  const profile = buildStudentAbilityProfileFixture();
  const validSummary = buildGrowthMemorySummaryFixture('retest_pending');
  const validContext = buildCurrentLearningContextFixture();
  const validStrategy = generateNextLearningStrategy({
    growthMemorySummary: validSummary,
    studentAbilityProfile: profile,
    currentLearningContext: validContext,
    createdAt: phase83RunAt,
  });
  const validValidation = validateNextLearningStrategy({
    strategy: validStrategy,
    currentLearningContext: validContext,
    validatedAt: phase83RunAt,
  });
  const validTaskRequest = createTaskRequest({
    strategy: validStrategy,
    validationResult: validValidation,
    createdAt: phase83RunAt,
  });

  const reviewSummary = buildGrowthMemorySummaryFixture('mixed');
  const reviewContext = buildCurrentLearningContextFixture({ reviewRequired: true });
  const reviewStrategy = generateNextLearningStrategy({
    growthMemorySummary: reviewSummary,
    studentAbilityProfile: profile,
    currentLearningContext: reviewContext,
    createdAt: phase83RunAt,
  });
  const reviewValidation = validateNextLearningStrategy({
    strategy: reviewStrategy,
    currentLearningContext: reviewContext,
    validatedAt: phase83RunAt,
  });
  const reviewTaskRequest = createTaskRequest({
    strategy: reviewStrategy,
    validationResult: reviewValidation,
    createdAt: phase83RunAt,
  });

  console.log('\nPhase 8.3 Next Learning Strategy Minimum Loop Debug');
  console.log('===================================================');
  console.log(`valid action: ${validStrategy.action}`);
  console.log(`valid validation: ${validValidation.isValid}`);
  console.log(`valid taskRequest: ${validTaskRequest.taskRequest?.taskRequestId || 'null'}`);
  console.log(`review action: ${reviewStrategy.action}`);
  console.log(`review validation: ${reviewValidation.isValid}`);
  console.log(`review taskRequest: ${reviewTaskRequest.taskRequest?.taskRequestId || 'null'}`);

  if (!isNextLearningStrategy(validStrategy)) failures.push('Valid strategy should match schema.');
  if (!isStrategyValidationResult(validValidation)) failures.push('Valid validation result should match schema.');
  if (!validValidation.isValid) failures.push('Retest strategy should pass validation.');
  if (!validTaskRequest.taskRequest || !isTaskRequest(validTaskRequest.taskRequest)) failures.push('Valid strategy should create TaskRequest.');
  if (reviewStrategy.action !== 'human_review') failures.push('Mixed trend should create human_review strategy.');
  if (reviewValidation.isValid) failures.push('Human review strategy should not pass validation for TaskRequest.');
  if (reviewTaskRequest.taskRequest !== null) failures.push('Invalid human_review strategy must not create TaskRequest.');

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 8.3 next learning strategy minimum loop debug passed.');
    return;
  }

  console.log('[FAIL] Phase 8.3 debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 8.3 debug check failed.');
}

runPhase83Debug();
