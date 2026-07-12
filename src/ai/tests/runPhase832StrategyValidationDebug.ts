import { validateNextLearningStrategy } from '../agents/strategyValidationAgent.ts';
import { isStrategyValidationResult } from '../schemas/nextLearningStrategy.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildStrategyFixture,
  phase83RunAt,
} from './nextLearningStrategyDebugFixtures.ts';

function runPhase832StrategyValidationDebug(): void {
  const failures: string[] = [];
  const context = buildCurrentLearningContextFixture();
  const cases = [
    {
      name: 'valid retest strategy',
      strategy: buildStrategyFixture(),
      expectValid: true,
      expectNextStep: 'create_task_request',
    },
    {
      name: 'missing evidence links',
      strategy: buildStrategyFixture({ evidenceLinks: [] }),
      expectValid: false,
      expectNextStep: 'regenerate_strategy',
    },
    {
      name: 'incompatible action and role',
      strategy: buildStrategyFixture({ action: 'transfer_test', recommendedTaskRole: 'training' }),
      expectValid: false,
      expectNextStep: 'regenerate_strategy',
    },
    {
      name: 'human review blocks task request',
      strategy: buildStrategyFixture({ action: 'human_review', recommendedTaskRole: 'observation' }),
      expectValid: false,
      expectNextStep: 'review_required',
    },
  ] as const;

  console.log('\nPhase 8.3.2 Strategy Validation Debug');
  console.log('=====================================');

  for (const item of cases) {
    const result = validateNextLearningStrategy({
      strategy: item.strategy,
      currentLearningContext: context,
      validatedAt: phase83RunAt,
    });

    console.log(`\n${item.name}`);
    console.log('------------------------------');
    console.log(`isValid: ${result.isValid}`);
    console.log(`nextStep: ${result.nextStep}`);
    console.log(`errors: ${result.validationErrors.join(' | ') || 'none'}`);

    if (!isStrategyValidationResult(result)) failures.push(`${item.name}: validation result should match schema.`);
    if (result.isValid !== item.expectValid) failures.push(`${item.name}: expected isValid ${item.expectValid}, got ${result.isValid}.`);
    if (result.nextStep !== item.expectNextStep) failures.push(`${item.name}: expected nextStep ${item.expectNextStep}, got ${result.nextStep}.`);
    if (!result.isValid && result.validationErrors.length === 0) failures.push(`${item.name}: invalid strategy should include validation errors.`);
  }

  printAcceptance(failures);
}

function printAcceptance(failures: string[]): void {
  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 8.3.2 strategy validation debug passed.');
    return;
  }

  console.log('[FAIL] Phase 8.3.2 debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 8.3.2 debug check failed.');
}

runPhase832StrategyValidationDebug();
