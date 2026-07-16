import type { AbilityEvidence } from './abilityEvidence.schema.ts';
import type { GrowthMemorySummary } from './growthMemory.schema.ts';
import type { LearningSessionHistoryResult } from './learningSessionHistory.schema.ts';

export const DELAYED_RETEST_SCHEDULING_SCHEMA_VERSION =
  'delayed_retest_scheduling_v1' as const;
export const DELAYED_RETEST_POLICY_VERSION = 'delayed_retest_policy_v1' as const;

export type DelayedRetestPolicy = {
  policyVersion: typeof DELAYED_RETEST_POLICY_VERSION;
  growthIntervalDays: number;
  positiveIntervalDays: number;
  requireNewMaterial: true;
  allowHint: false;
};

export type DelayedRetestCandidateStatus =
  | 'not_due'
  | 'due'
  | 'not_eligible'
  | 'already_scheduled'
  | 'review_required'
  | 'blocked';

export type DelayedRetestPlanStatus =
  | 'pending'
  | 'available'
  | 'completed'
  | 'cancelled'
  | 'review_required';

export type DelayedRetestSchedulingNextStep =
  | 'wait_until_due'
  | 'create_task_request'
  | 'already_scheduled'
  | 'review_required'
  | 'blocked';

export type DelayedRetestCandidate = {
  candidateId: string;
  studentId: string;
  targetAbilityId: string;
  sourceSessionIds: string[];
  sourceEvidenceIds: string[];
  baselineEvidenceId?: string;
  baselineEvidenceType?: 'growth' | 'positive';
  baselineEvidenceAt?: string;
  plannedRetestAt?: string;
  currentTime: string;
  intervalDays?: number;
  status: DelayedRetestCandidateStatus;
  eligibilityReason: string;
  limitations: string[];
  policyVersion: typeof DELAYED_RETEST_POLICY_VERSION;
  schemaVersion: typeof DELAYED_RETEST_SCHEDULING_SCHEMA_VERSION;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type DelayedRetestPlan = {
  planId: string;
  replacesPlanId?: string;
  rescheduleRevision?: number;
  candidateId: string;
  studentId: string;
  targetAbilityId: string;
  sourceSessionIds: string[];
  sourceEvidenceIds: string[];
  baselineEvidenceId: string;
  scheduledAt: string;
  plannedRetestAt: string;
  status: DelayedRetestPlanStatus;
  whyRetestNow: string;
  retestGoal: string;
  validationGoal: string;
  requestedTaskRole: 'retest';
  requireNewMaterial: true;
  allowHint: false;
  constraints: string[];
  policyVersion: typeof DELAYED_RETEST_POLICY_VERSION;
  schemaVersion: typeof DELAYED_RETEST_SCHEDULING_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type DelayedRetestSchedulingInput = {
  studentId: string;
  targetAbilityId: string;
  growthMemorySummary: GrowthMemorySummary;
  sessionHistory: LearningSessionHistoryResult;
  abilityEvidence: AbilityEvidence[];
  existingPlans?: DelayedRetestPlan[];
  currentTime: string;
  timezone: string;
  policy: DelayedRetestPolicy;
};

export type DelayedRetestSchedulingResult = {
  studentId: string;
  targetAbilityId: string;
  candidate: DelayedRetestCandidate;
  plan?: DelayedRetestPlan;
  nextStep: DelayedRetestSchedulingNextStep;
  reason: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export const DELAYED_RETEST_CANDIDATE_STATUSES: DelayedRetestCandidateStatus[] = [
  'not_due',
  'due',
  'not_eligible',
  'already_scheduled',
  'review_required',
  'blocked',
];

export const DELAYED_RETEST_PLAN_STATUSES: DelayedRetestPlanStatus[] = [
  'pending',
  'available',
  'completed',
  'cancelled',
  'review_required',
];

export const DELAYED_RETEST_SCHEDULING_NEXT_STEPS: DelayedRetestSchedulingNextStep[] = [
  'wait_until_due',
  'create_task_request',
  'already_scheduled',
  'review_required',
  'blocked',
];

export function isDelayedRetestPolicy(value: unknown): value is DelayedRetestPolicy {
  if (!value || typeof value !== 'object') return false;
  const policy = value as DelayedRetestPolicy;
  return (
    policy.policyVersion === DELAYED_RETEST_POLICY_VERSION &&
    isPositiveInteger(policy.growthIntervalDays) &&
    isPositiveInteger(policy.positiveIntervalDays) &&
    policy.requireNewMaterial === true &&
    policy.allowHint === false
  );
}

export function isDelayedRetestCandidate(
  value: unknown,
): value is DelayedRetestCandidate {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as DelayedRetestCandidate;
  const requiresBaseline = ['not_due', 'due', 'already_scheduled'].includes(candidate.status);
  const hasBaseline = (
    isNonEmptyString(candidate.baselineEvidenceId) &&
    (candidate.baselineEvidenceType === 'growth' || candidate.baselineEvidenceType === 'positive') &&
    isTimestamp(candidate.baselineEvidenceAt) &&
    isTimestamp(candidate.plannedRetestAt) &&
    isPositiveInteger(candidate.intervalDays) &&
    candidate.sourceSessionIds.length > 0 &&
    candidate.sourceEvidenceIds.includes(candidate.baselineEvidenceId)
  );

  return (
    isNonEmptyString(candidate.candidateId) &&
    isNonEmptyString(candidate.studentId) &&
    isNonEmptyString(candidate.targetAbilityId) &&
    isUniqueStringArray(candidate.sourceSessionIds) &&
    isUniqueStringArray(candidate.sourceEvidenceIds) &&
    (!requiresBaseline || hasBaseline) &&
    isTimestamp(candidate.currentTime) &&
    DELAYED_RETEST_CANDIDATE_STATUSES.includes(candidate.status) &&
    isNonEmptyString(candidate.eligibilityReason) &&
    isStringArray(candidate.limitations) &&
    candidate.policyVersion === DELAYED_RETEST_POLICY_VERSION &&
    candidate.schemaVersion === DELAYED_RETEST_SCHEDULING_SCHEMA_VERSION &&
    isValidation(candidate.validation)
  );
}

export function isDelayedRetestPlan(value: unknown): value is DelayedRetestPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as DelayedRetestPlan;
  const rescheduleValid = (
    (plan.replacesPlanId === undefined && (plan.rescheduleRevision === undefined || plan.rescheduleRevision === 0)) ||
    (isNonEmptyString(plan.replacesPlanId) && isPositiveInteger(plan.rescheduleRevision))
  );
  return (
    isNonEmptyString(plan.planId) &&
    rescheduleValid &&
    isNonEmptyString(plan.candidateId) &&
    isNonEmptyString(plan.studentId) &&
    isNonEmptyString(plan.targetAbilityId) &&
    isUniqueNonEmptyStringArray(plan.sourceSessionIds) &&
    isUniqueNonEmptyStringArray(plan.sourceEvidenceIds) &&
    isNonEmptyString(plan.baselineEvidenceId) &&
    plan.sourceEvidenceIds.includes(plan.baselineEvidenceId) &&
    isTimestamp(plan.scheduledAt) &&
    isTimestamp(plan.plannedRetestAt) &&
    DELAYED_RETEST_PLAN_STATUSES.includes(plan.status) &&
    isNonEmptyString(plan.whyRetestNow) &&
    isNonEmptyString(plan.retestGoal) &&
    isNonEmptyString(plan.validationGoal) &&
    plan.requestedTaskRole === 'retest' &&
    plan.requireNewMaterial === true &&
    plan.allowHint === false &&
    isUniqueNonEmptyStringArray(plan.constraints) &&
    plan.policyVersion === DELAYED_RETEST_POLICY_VERSION &&
    plan.schemaVersion === DELAYED_RETEST_SCHEDULING_SCHEMA_VERSION &&
    isTimestamp(plan.createdAt) &&
    isTimestamp(plan.updatedAt) &&
    isValidation(plan.validation)
  );
}

export function isDelayedRetestSchedulingResult(
  value: unknown,
): value is DelayedRetestSchedulingResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as DelayedRetestSchedulingResult;
  const planValid = result.plan === undefined || isDelayedRetestPlan(result.plan);
  const planAligned = result.plan === undefined || (
    result.plan.candidateId === result.candidate.candidateId &&
    result.plan.studentId === result.studentId &&
    result.plan.targetAbilityId === result.targetAbilityId
  );
  const nextStepAligned = isNextStepAligned(result.candidate.status, result.nextStep);
  return (
    isNonEmptyString(result.studentId) &&
    isNonEmptyString(result.targetAbilityId) &&
    isDelayedRetestCandidate(result.candidate) &&
    planValid &&
    planAligned &&
    DELAYED_RETEST_SCHEDULING_NEXT_STEPS.includes(result.nextStep) &&
    nextStepAligned &&
    isNonEmptyString(result.reason) &&
    isValidation(result.validation)
  );
}

function isNextStepAligned(
  status: DelayedRetestCandidateStatus,
  nextStep: DelayedRetestSchedulingNextStep,
): boolean {
  if (status === 'not_due') return nextStep === 'wait_until_due';
  if (status === 'due') return nextStep === 'create_task_request';
  if (status === 'already_scheduled') return nextStep === 'already_scheduled';
  if (status === 'review_required') return nextStep === 'review_required';
  return nextStep === 'blocked';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && value > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isUniqueStringArray(value: unknown): value is string[] {
  return isStringArray(value) && new Set(value).size === value.length;
}

function isUniqueNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isNonEmptyString) &&
    new Set(value).size === value.length
  );
}

function isValidation(
  value: unknown,
): value is DelayedRetestSchedulingResult['validation'] {
  if (!value || typeof value !== 'object') return false;
  const validation = value as DelayedRetestSchedulingResult['validation'];
  return (
    typeof validation.passed === 'boolean' &&
    Array.isArray(validation.issues) &&
    validation.issues.every((issue) => typeof issue === 'string')
  );
}
