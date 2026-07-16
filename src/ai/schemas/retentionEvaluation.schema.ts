import type { AbilityEvidence } from './abilityEvidence.schema.ts';
import type { ConcreteLearningTask } from './concreteLearningTask.schema.ts';
import type { DelayedRetestPlan } from './delayedRetestScheduling.schema.ts';
import type { TaskEvidenceReturnResult } from './taskEvidenceReturn.schema.ts';
import type { TaskExecutionResult } from './taskExecution.schema.ts';

export const RETENTION_EVALUATION_SCHEMA_VERSION = 'retention_evaluation_v1' as const;

export type RetentionMaterialRelation =
  | 'same_material'
  | 'similar_material'
  | 'new_material'
  | 'unknown';

export type RetentionDifficultyRelation =
  | 'lower'
  | 'comparable'
  | 'higher'
  | 'unknown';

export type RetentionComparabilityStatus =
  | 'comparable'
  | 'limited'
  | 'not_comparable'
  | 'review_required';

export type RetentionEvaluationStatus =
  | 'retained'
  | 'partially_retained'
  | 'performance_fluctuated'
  | 'declined_observation'
  | 'insufficient_evidence'
  | 'review_required';

export type RetentionEvaluationFollowUp =
  | 'continue_observation'
  | 'independent_retest'
  | 'continue_training'
  | 'collect_more_evidence'
  | 'human_review';

export type RetentionComparisonFacts = {
  contextId: string;
  planId: string;
  studentId: string;
  targetAbilityId: string;
  baselineTaskId: string;
  delayedTaskId: string;
  delayedExecutionSessionId: string;
  delayedResponseId: string;
  delayedDiagnosisResultId: string;
  delayedTaskRole: 'retest' | 'transfer';
  materialRelation: RetentionMaterialRelation;
  difficultyRelation: RetentionDifficultyRelation;
  responseValid: boolean;
  diagnosisAligned: boolean;
  traceabilityComplete: boolean;
  usedHint: boolean;
  hintCount: number;
  baselineAt: string;
  delayedEvidenceAt: string;
  elapsedDays: number;
  comparedAt: string;
};

export type RetentionComparabilityResult = {
  status: RetentionComparabilityStatus;
  reasons: string[];
  limitations: string[];
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type ExistingPhase8ResultLink = {
  mode: 'reuse_existing' | 'blocked';
  evidenceIds: string[];
  evaluationResultId?: string;
  profileUpdateDecisionId?: string;
  growthMemoryRecordId?: string;
  idempotencyKey: string;
  reason: string;
};

export type RetentionTaskComparisonSource = {
  materialRelation: RetentionMaterialRelation;
  difficultyRelation: RetentionDifficultyRelation;
  source: 'task_fulfillment' | 'comparison_adapter';
};

export type RetentionEvaluationInput = {
  studentId: string;
  targetAbilityId: string;
  delayedRetestPlan: DelayedRetestPlan;
  baselineEvidence: AbilityEvidence[];
  baselineTask: ConcreteLearningTask;
  delayedTask: ConcreteLearningTask;
  delayedTaskExecutionResult: TaskExecutionResult;
  delayedTaskEvidenceReturnResult: TaskEvidenceReturnResult;
  taskComparisonSource: RetentionTaskComparisonSource;
  evaluatedAt: string;
  timezone: string;
};

export type RetentionEvaluationResult = {
  retentionEvaluationId: string;
  studentId: string;
  targetAbilityId: string;
  planId: string;
  baselineEvidenceIds: string[];
  delayedEvidenceIds: string[];
  comparisonFacts: RetentionComparisonFacts;
  comparability: RetentionComparabilityResult;
  status: RetentionEvaluationStatus;
  observations: string[];
  limitations: string[];
  confidence: number;
  followUp: RetentionEvaluationFollowUp;
  followUpReason: string;
  existingPhase8ResultLink: ExistingPhase8ResultLink;
  schemaVersion: typeof RETENTION_EVALUATION_SCHEMA_VERSION;
  createdAt: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export const RETENTION_MATERIAL_RELATIONS: RetentionMaterialRelation[] = [
  'same_material',
  'similar_material',
  'new_material',
  'unknown',
];

export const RETENTION_DIFFICULTY_RELATIONS: RetentionDifficultyRelation[] = [
  'lower',
  'comparable',
  'higher',
  'unknown',
];

export const RETENTION_COMPARABILITY_STATUSES: RetentionComparabilityStatus[] = [
  'comparable',
  'limited',
  'not_comparable',
  'review_required',
];

export const RETENTION_EVALUATION_STATUSES: RetentionEvaluationStatus[] = [
  'retained',
  'partially_retained',
  'performance_fluctuated',
  'declined_observation',
  'insufficient_evidence',
  'review_required',
];

export const RETENTION_EVALUATION_FOLLOW_UPS: RetentionEvaluationFollowUp[] = [
  'continue_observation',
  'independent_retest',
  'continue_training',
  'collect_more_evidence',
  'human_review',
];

export function isRetentionTaskComparisonSource(
  value: unknown,
): value is RetentionTaskComparisonSource {
  if (!value || typeof value !== 'object') return false;
  const source = value as RetentionTaskComparisonSource;
  return (
    RETENTION_MATERIAL_RELATIONS.includes(source.materialRelation) &&
    RETENTION_DIFFICULTY_RELATIONS.includes(source.difficultyRelation) &&
    ['task_fulfillment', 'comparison_adapter'].includes(source.source)
  );
}

export function isRetentionComparisonFacts(
  value: unknown,
): value is RetentionComparisonFacts {
  if (!value || typeof value !== 'object') return false;
  const facts = value as RetentionComparisonFacts;
  return (
    isNonEmptyString(facts.contextId) &&
    isNonEmptyString(facts.planId) &&
    isNonEmptyString(facts.studentId) &&
    isNonEmptyString(facts.targetAbilityId) &&
    isNonEmptyString(facts.baselineTaskId) &&
    isNonEmptyString(facts.delayedTaskId) &&
    isNonEmptyString(facts.delayedExecutionSessionId) &&
    isNonEmptyString(facts.delayedResponseId) &&
    isNonEmptyString(facts.delayedDiagnosisResultId) &&
    ['retest', 'transfer'].includes(facts.delayedTaskRole) &&
    RETENTION_MATERIAL_RELATIONS.includes(facts.materialRelation) &&
    RETENTION_DIFFICULTY_RELATIONS.includes(facts.difficultyRelation) &&
    typeof facts.responseValid === 'boolean' &&
    typeof facts.diagnosisAligned === 'boolean' &&
    typeof facts.traceabilityComplete === 'boolean' &&
    typeof facts.usedHint === 'boolean' &&
    isNonNegativeInteger(facts.hintCount) &&
    isTimestamp(facts.baselineAt) &&
    isTimestamp(facts.delayedEvidenceAt) &&
    isNonNegativeNumber(facts.elapsedDays) &&
    isTimestamp(facts.comparedAt)
  );
}

export function isRetentionComparabilityResult(
  value: unknown,
): value is RetentionComparabilityResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as RetentionComparabilityResult;
  return (
    RETENTION_COMPARABILITY_STATUSES.includes(result.status) &&
    isStringArray(result.reasons) &&
    isStringArray(result.limitations) &&
    isValidation(result.validation)
  );
}

export function isRetentionEvaluationResult(
  value: unknown,
): value is RetentionEvaluationResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as RetentionEvaluationResult;
  return (
    isNonEmptyString(result.retentionEvaluationId) &&
    isNonEmptyString(result.studentId) &&
    isNonEmptyString(result.targetAbilityId) &&
    isNonEmptyString(result.planId) &&
    isUniqueStringArray(result.baselineEvidenceIds) &&
    isUniqueStringArray(result.delayedEvidenceIds) &&
    isRetentionComparisonFacts(result.comparisonFacts) &&
    isRetentionComparabilityResult(result.comparability) &&
    RETENTION_EVALUATION_STATUSES.includes(result.status) &&
    isStringArray(result.observations) &&
    isStringArray(result.limitations) &&
    isConfidence(result.confidence) &&
    RETENTION_EVALUATION_FOLLOW_UPS.includes(result.followUp) &&
    isNonEmptyString(result.followUpReason) &&
    isExistingPhase8ResultLink(result.existingPhase8ResultLink) &&
    result.schemaVersion === RETENTION_EVALUATION_SCHEMA_VERSION &&
    isTimestamp(result.createdAt) &&
    isValidation(result.validation)
  );
}

function isExistingPhase8ResultLink(value: unknown): value is ExistingPhase8ResultLink {
  if (!value || typeof value !== 'object') return false;
  const link = value as ExistingPhase8ResultLink;
  const idsAligned = link.mode === 'blocked' || (
    isNonEmptyString(link.evaluationResultId) &&
    isNonEmptyString(link.profileUpdateDecisionId) &&
    isNonEmptyString(link.growthMemoryRecordId)
  );
  return (
    ['reuse_existing', 'blocked'].includes(link.mode) &&
    isUniqueStringArray(link.evidenceIds) &&
    isNonEmptyString(link.idempotencyKey) &&
    isNonEmptyString(link.reason) &&
    idsAligned
  );
}

function isValidation(value: unknown): value is { passed: boolean; issues: string[] } {
  if (!value || typeof value !== 'object') return false;
  const validation = value as { passed: boolean; issues: string[] };
  return typeof validation.passed === 'boolean' && isStringArray(validation.issues);
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isUniqueStringArray(value: unknown): value is string[] {
  return isStringArray(value) && new Set(value).size === value.length;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && value >= 0;
}

function isConfidence(value: unknown): value is number {
  return isNonNegativeNumber(value) && value <= 1;
}
