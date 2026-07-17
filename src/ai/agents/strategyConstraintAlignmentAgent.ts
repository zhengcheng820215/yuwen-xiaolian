import type {
  AdaptiveTaskConstraints,
  AdaptiveTaskContextSnapshot,
  StrategyConstraintAlignmentResult,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import {
  isAdaptiveTaskConstraints,
  isAdaptiveTaskContextSnapshot,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import type {
  NextLearningStrategy,
  StrategyValidationResult,
} from '../schemas/nextLearningStrategy.schema.ts';
import {
  isNextLearningStrategy,
  isStrategyValidationResult,
} from '../schemas/nextLearningStrategy.schema.ts';

export type StrategyConstraintAlignmentInput = {
  strategy: NextLearningStrategy;
  strategyValidationResult: StrategyValidationResult;
  adaptiveTaskContext: AdaptiveTaskContextSnapshot;
  constraints: AdaptiveTaskConstraints;
  alignedAt: string;
};

export function validateStrategyConstraintAlignment(
  input: StrategyConstraintAlignmentInput,
): StrategyConstraintAlignmentResult {
  const structuralIssues: string[] = [];
  if (!isNextLearningStrategy(input.strategy)) structuralIssues.push('NextLearningStrategy failed schema validation.');
  if (!isStrategyValidationResult(input.strategyValidationResult)) structuralIssues.push('StrategyValidationResult failed schema validation.');
  if (!isAdaptiveTaskContextSnapshot(input.adaptiveTaskContext)) structuralIssues.push('AdaptiveTaskContextSnapshot failed schema validation.');
  if (!isAdaptiveTaskConstraints(input.constraints)) structuralIssues.push('AdaptiveTaskConstraints failed schema validation.');
  if (!input.alignedAt || Number.isNaN(Date.parse(input.alignedAt))) structuralIssues.push('alignedAt must be a valid timestamp.');

  const checks = {
    identityAligned:
      input.strategy.studentId === input.constraints.studentId &&
      input.strategy.studentId === input.adaptiveTaskContext.studentId,
    strategyValidationPassed:
      input.strategyValidationResult.strategyId === input.strategy.strategyId &&
      input.strategyValidationResult.isValid &&
      input.strategyValidationResult.nextStep === 'create_task_request',
    sourceStrategyAligned: input.constraints.sourceStrategyId === input.strategy.strategyId,
    targetAbilityAligned:
      input.constraints.targetAbilityId === input.strategy.targetAbilityId &&
      input.adaptiveTaskContext.targetAbilityId === input.strategy.targetAbilityId,
    taskRoleAligned:
      input.constraints.recommendedTaskRole === input.strategy.recommendedTaskRole &&
      input.constraints.sourceStrategyTaskRole === input.strategy.recommendedTaskRole,
    validationGoalAligned: input.constraints.sourceValidationGoal === input.strategy.validationGoal,
    difficultyAllowed: isDifficultyAllowed(input.strategy, input.constraints),
    materialAllowed: isMaterialAllowed(input.strategy, input.constraints),
    hintPolicyAllowed: isHintPolicyAllowed(input.strategy, input.constraints),
    contextAllowed:
      input.adaptiveTaskContext.validation.passed &&
      input.adaptiveTaskContext.allowedTaskRoles.includes(input.strategy.recommendedTaskRole) &&
      input.adaptiveTaskContext.allowedHintPolicies.includes(input.constraints.hintPolicy) &&
      input.constraints.sourceContextSnapshotId === input.adaptiveTaskContext.contextId,
    conflictAllowed:
      input.constraints.sourceConflictStatus !== 'review_required' &&
      !(
        input.constraints.sourceConflictStatus === 'unresolved_conflict' &&
        !['collect_more_evidence', 'diagnostic_verification'].includes(input.strategy.action)
      ),
  };

  const issues = [...structuralIssues, ...Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `${name} check failed.`)];
  const status = inferStatus(input, structuralIssues, checks);
  const canCreateTaskRequest = status === 'aligned' && issues.length === 0;
  const warnings = uniqueSorted(input.constraints.limitations);

  return {
    alignmentId: buildStableId('strategy-constraint-alignment', [
      input.strategy.strategyId,
      input.constraints.constraintsId,
      input.adaptiveTaskContext.contextId,
      ...Object.entries(checks).map(([name, passed]) => `${name}:${passed}`).sort(),
    ]),
    strategyId: input.strategy.strategyId,
    constraintsId: input.constraints.constraintsId,
    contextSnapshotId: input.adaptiveTaskContext.contextId,
    status,
    checks,
    canCreateTaskRequest,
    nextStep: status === 'aligned'
      ? 'create_task_request'
      : status === 'strategy_mismatch'
        ? 'regenerate_strategy'
        : status === 'review_required'
          ? 'human_review'
          : 'blocked',
    issues: uniqueSorted(issues),
    warnings,
    alignedAt: input.alignedAt,
    validation: {
      passed: structuralIssues.length === 0,
      issues: uniqueSorted(structuralIssues),
    },
  };
}

function inferStatus(
  input: StrategyConstraintAlignmentInput,
  structuralIssues: string[],
  checks: StrategyConstraintAlignmentResult['checks'],
): StrategyConstraintAlignmentResult['status'] {
  if (structuralIssues.length > 0 || !checks.identityAligned || !checks.targetAbilityAligned) return 'blocked';
  if (input.constraints.sourceConflictStatus === 'review_required') return 'review_required';
  if (!checks.strategyValidationPassed || !checks.sourceStrategyAligned || !checks.taskRoleAligned || !checks.validationGoalAligned) {
    return 'strategy_mismatch';
  }
  if (!checks.difficultyAllowed || !checks.materialAllowed || !checks.hintPolicyAllowed || !checks.contextAllowed || !checks.conflictAllowed) {
    return 'strategy_mismatch';
  }
  return 'aligned';
}

function isDifficultyAllowed(strategy: NextLearningStrategy, constraints: AdaptiveTaskConstraints): boolean {
  if (constraints.difficultyDirection === 'increase') return false;
  if (strategy.action === 'lower_difficulty_training') return constraints.difficultyDirection === 'decrease';
  return constraints.difficultyDirection === 'maintain';
}

function isMaterialAllowed(strategy: NextLearningStrategy, constraints: AdaptiveTaskConstraints): boolean {
  if (strategy.action === 'transfer_test') return constraints.materialNovelty === 'new_context';
  if (strategy.action === 'maintenance_validation' && strategy.recommendedTaskRole === 'transfer') {
    return constraints.materialNovelty === 'new_context';
  }
  return true;
}

function isHintPolicyAllowed(strategy: NextLearningStrategy, constraints: AdaptiveTaskConstraints): boolean {
  if (strategy.action === 'independent_retest') return constraints.hintPolicy === 'no_hint';
  if (strategy.action === 'transfer_test') return constraints.hintPolicy === 'no_hint';
  return true;
}

function buildStableId(prefix: string, parts: string[]): string {
  const text = parts.join('|');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0))].sort();
}
