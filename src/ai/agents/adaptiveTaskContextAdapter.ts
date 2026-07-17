import type {
  AdaptiveHintPolicy,
  AdaptiveTaskContextSnapshot,
} from '../schemas/adaptiveTaskConstraints.schema.ts';
import { ADAPTIVE_TASK_CONTEXT_SCHEMA_VERSION } from '../schemas/adaptiveTaskConstraints.schema.ts';
import type { CurrentLearningContext, RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import { isCurrentLearningContext } from '../schemas/nextLearningStrategy.schema.ts';

export type AdaptiveTaskContextInput = {
  currentLearningContext: CurrentLearningContext;
  studentId: string;
  targetAbilityId: string;
  currentDifficultyLevel?: string;
  recentTaskIds?: string[];
  recentMaterialIds?: string[];
  activeSessionId?: string;
  timezone: string;
};

export function buildAdaptiveTaskContextSnapshot(
  input: AdaptiveTaskContextInput,
): AdaptiveTaskContextSnapshot {
  const issues: string[] = [];
  const context = input.currentLearningContext;

  if (!isCurrentLearningContext(context)) issues.push('CurrentLearningContext failed schema validation.');
  if (context.studentId !== input.studentId) issues.push('studentId does not match CurrentLearningContext.');
  if (context.targetAbilityId && context.targetAbilityId !== input.targetAbilityId) {
    issues.push('targetAbilityId does not match CurrentLearningContext.');
  }
  if (!input.targetAbilityId?.trim()) issues.push('targetAbilityId is required.');
  if (!input.timezone?.trim()) issues.push('timezone is required.');
  if (context.reviewRequired) issues.push('CurrentLearningContext requires review.');

  const allowedTaskRoles = deriveAllowedTaskRoles(context);
  const allowedHintPolicies = deriveAllowedHintPolicies(context);
  if (allowedTaskRoles.length === 0) issues.push('CurrentLearningContext allows no task roles.');
  if (allowedHintPolicies.length === 0) issues.push('CurrentLearningContext allows no hint policies.');

  const recentTaskIds = uniqueSorted(input.recentTaskIds || []);
  const recentMaterialIds = uniqueSorted(input.recentMaterialIds || []);
  const contextId = buildStableId('adaptive-context', [
    context.contextId,
    input.studentId,
    input.targetAbilityId,
    input.currentDifficultyLevel || 'unknown',
    ...recentTaskIds,
    ...recentMaterialIds,
    ...allowedTaskRoles,
    ...allowedHintPolicies,
    input.activeSessionId || 'no-session',
    input.timezone,
  ]);

  return {
    contextId,
    studentId: input.studentId,
    targetAbilityId: input.targetAbilityId,
    currentDifficultyLevel: input.currentDifficultyLevel,
    recentTaskIds,
    recentMaterialIds,
    allowedTaskRoles,
    allowedHintPolicies,
    sourceLearningContextId: context.contextId,
    activeSessionId: input.activeSessionId,
    timezone: input.timezone,
    schemaVersion: ADAPTIVE_TASK_CONTEXT_SCHEMA_VERSION,
    validation: {
      passed: issues.length === 0,
      issues: uniqueSorted(issues),
    },
  };
}

function deriveAllowedTaskRoles(context: CurrentLearningContext): RecommendedTaskRole[] {
  const roles: RecommendedTaskRole[] = ['diagnosis', 'observation'];
  if (context.allowTraining) roles.push('training');
  if (context.allowRetest) roles.push('retest');
  if (context.allowTransfer) roles.push('transfer');
  return uniqueSorted(roles) as RecommendedTaskRole[];
}

function deriveAllowedHintPolicies(context: CurrentLearningContext): AdaptiveHintPolicy[] {
  if (context.reviewRequired) return [];
  if (context.cognitiveLoad === 'high') return ['allow_guidance', 'limited_hint'];
  return ['allow_guidance', 'limited_hint', 'no_hint'];
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
