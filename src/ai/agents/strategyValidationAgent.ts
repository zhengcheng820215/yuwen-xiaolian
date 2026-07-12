import type {
  CurrentLearningContext,
  NextLearningAction,
  NextLearningStrategy,
  RecommendedTaskRole,
  StrategyValidationResult,
} from '../schemas/nextLearningStrategy.schema.ts';
import {
  NEXT_LEARNING_ACTIONS,
  RECOMMENDED_TASK_ROLES,
} from '../schemas/nextLearningStrategy.schema.ts';

export type StrategyValidationInput = {
  strategy: NextLearningStrategy;
  currentLearningContext: CurrentLearningContext;
  validatedAt?: string;
};

export function validateNextLearningStrategy(
  input: StrategyValidationInput,
): StrategyValidationResult {
  const validationErrors: string[] = [];
  const warnings: string[] = [];
  const { strategy, currentLearningContext } = input;

  if (!strategy.strategyId?.trim()) validationErrors.push('strategyId is required.');
  if (!strategy.studentId?.trim()) validationErrors.push('studentId is required.');
  if (!strategy.targetAbilityId?.trim()) validationErrors.push('targetAbilityId is required.');
  if (!NEXT_LEARNING_ACTIONS.includes(strategy.action)) validationErrors.push('action is not allowed.');
  if (!strategy.reason?.trim()) validationErrors.push('reason is required.');
  if (!Array.isArray(strategy.evidenceLinks) || strategy.evidenceLinks.length === 0) validationErrors.push('evidenceLinks are required.');
  if (!Array.isArray(strategy.growthMemoryRecordIds) || strategy.growthMemoryRecordIds.length === 0) validationErrors.push('growthMemoryRecordIds are required.');
  if (!strategy.validationGoal?.trim()) validationErrors.push('validationGoal is required.');
  if (!RECOMMENDED_TASK_ROLES.includes(strategy.recommendedTaskRole)) validationErrors.push('recommendedTaskRole is not allowed.');

  if (!isActionRoleCompatible(strategy.action, strategy.recommendedTaskRole)) {
    validationErrors.push(`action ${strategy.action} is not compatible with role ${strategy.recommendedTaskRole}.`);
  }

  if (strategy.studentId !== currentLearningContext.studentId) {
    validationErrors.push('strategy studentId does not match current learning context.');
  }

  if (strategy.action === 'independent_retest' && !currentLearningContext.allowRetest) {
    validationErrors.push('current context does not allow retest.');
  }

  if (strategy.action === 'transfer_test' && !currentLearningContext.allowTransfer) {
    validationErrors.push('current context does not allow transfer test.');
  }

  if ((strategy.action === 'continue_training' || strategy.action === 'lower_difficulty_training') && !currentLearningContext.allowTraining) {
    validationErrors.push('current context does not allow training.');
  }

  if (strategy.action === 'human_review') {
    validationErrors.push('human_review requires review and must not create a normal TaskRequest.');
  }

  if (strategy.limitations.length > 0) warnings.push(...strategy.limitations.slice(0, 3));

  const isValid = validationErrors.length === 0;
  const nextStep = isValid ? 'create_task_request' : inferBlockedNextStep(strategy.action, validationErrors);

  return {
    strategyId: strategy.strategyId,
    isValid,
    validationErrors,
    warnings: unique(warnings),
    blockedReason: isValid ? undefined : validationErrors[0],
    nextStep,
    validatedAt: input.validatedAt || new Date().toISOString(),
  };
}

function isActionRoleCompatible(
  action: NextLearningAction,
  role: RecommendedTaskRole,
): boolean {
  const compatibleRoles: Record<NextLearningAction, RecommendedTaskRole[]> = {
    continue_training: ['training'],
    lower_difficulty_training: ['training'],
    independent_retest: ['retest'],
    transfer_test: ['transfer'],
    diagnostic_verification: ['diagnosis'],
    collect_more_evidence: ['observation', 'diagnosis'],
    maintenance_validation: ['retest', 'transfer'],
    switch_ability: ['training', 'diagnosis'],
    human_review: ['observation'],
  };

  return compatibleRoles[action]?.includes(role) || false;
}

function inferBlockedNextStep(
  action: NextLearningAction,
  validationErrors: string[],
): StrategyValidationResult['nextStep'] {
  if (action === 'human_review') return 'review_required';
  if (validationErrors.some((error) => error.includes('not compatible'))) return 'regenerate_strategy';
  if (validationErrors.some((error) => error.includes('required'))) return 'regenerate_strategy';
  return 'blocked';
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
