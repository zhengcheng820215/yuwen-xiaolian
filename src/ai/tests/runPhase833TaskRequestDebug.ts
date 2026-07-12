import { createTaskRequest } from '../agents/taskRequestAgent.ts';
import { validateNextLearningStrategy } from '../agents/strategyValidationAgent.ts';
import { isTaskRequest } from '../schemas/nextLearningStrategy.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildStrategyFixture,
  phase83RunAt,
} from './nextLearningStrategyDebugFixtures.ts';

function runPhase833TaskRequestDebug(): void {
  const failures: string[] = [];
  const context = buildCurrentLearningContextFixture();
  const validStrategy = buildStrategyFixture();
  const validResult = validateNextLearningStrategy({
    strategy: validStrategy,
    currentLearningContext: context,
    validatedAt: phase83RunAt,
  });
  const validConversion = createTaskRequest({
    strategy: validStrategy,
    validationResult: validResult,
    createdAt: phase83RunAt,
  });

  const invalidStrategy = buildStrategyFixture({ evidenceLinks: [] });
  const invalidResult = validateNextLearningStrategy({
    strategy: invalidStrategy,
    currentLearningContext: context,
    validatedAt: phase83RunAt,
  });
  const invalidConversion = createTaskRequest({
    strategy: invalidStrategy,
    validationResult: invalidResult,
    createdAt: phase83RunAt,
  });

  console.log('\nPhase 8.3.3 Strategy to TaskRequest Debug');
  console.log('=========================================');
  console.log(`valid taskRequest: ${validConversion.taskRequest?.taskRequestId || 'null'}`);
  console.log(`invalid taskRequest: ${invalidConversion.taskRequest?.taskRequestId || 'null'}`);
  console.log(`invalid blockedReason: ${invalidConversion.blockedReason || 'none'}`);

  if (!validConversion.taskRequest) failures.push('Valid strategy should create TaskRequest.');
  if (validConversion.taskRequest && !isTaskRequest(validConversion.taskRequest)) failures.push('TaskRequest should match schema.');
  if (validConversion.taskRequest?.strategyId !== validStrategy.strategyId) failures.push('TaskRequest should keep strategyId.');
  if (validConversion.taskRequest?.taskRole !== validStrategy.recommendedTaskRole) failures.push('TaskRequest should use recommendedTaskRole.');
  if (invalidConversion.taskRequest !== null) failures.push('Invalid strategy must not create TaskRequest.');
  if (!invalidConversion.blockedReason) failures.push('Invalid conversion should include blockedReason.');

  printAcceptance(failures);
}

function printAcceptance(failures: string[]): void {
  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 8.3.3 strategy to TaskRequest debug passed.');
    return;
  }

  console.log('[FAIL] Phase 8.3.3 debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 8.3.3 debug check failed.');
}

runPhase833TaskRequestDebug();
