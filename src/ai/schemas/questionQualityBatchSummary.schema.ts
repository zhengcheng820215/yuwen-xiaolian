import {
  PRIMARY_ABILITY_IDS,
  QUESTION_RESOURCE_DIFFICULTIES,
  type PrimaryAbilityId,
  type QuestionResourceDifficulty,
} from './questionResourceAdmission.schema.ts';
import type {
  QuestionQualityBundleDecision,
} from './questionSemanticQualityAssessment.schema.ts';

export const QUESTION_QUALITY_BATCH_MANIFEST_VERSION =
  'question_quality_batch_manifest_v1' as const;
export const QUESTION_QUALITY_BATCH_SUMMARY_VERSION =
  'question_quality_batch_summary_v1' as const;
export const QUESTION_QUALITY_BATCH_SUMMARY_RULE_VERSION =
  'question_quality_batch_summary_rules_v1' as const;

export type QuestionGenerationQualityBatchDraftRef = {
  draftId: string;
  resourceId: string;
  draftRevision: number;
  validationId: string;
};

export type QuestionGenerationQualityBatchManifest = {
  manifestId: string;
  batchId: string;
  batchVersion: string;
  materialVersionIds: string[];
  generationRequestIds: string[];
  generatedCandidateCount: number;
  draftRefs: QuestionGenerationQualityBatchDraftRef[];
  createdAt: string;
  frozenAt: string;
  version: typeof QUESTION_QUALITY_BATCH_MANIFEST_VERSION;
};

export type BatchSummaryStatus =
  | 'complete'
  | 'incomplete'
  | 'mixed_versions'
  | 'blocked';

export type QuestionQualityMetric = {
  numerator: number;
  denominator: number;
  value: number | null;
};

export type QuestionGenerationBatchQualitySummary = {
  summaryId: string;
  batchId: string;
  batchVersion: string;
  manifestId: string;
  reviewIds: string[];
  materialVersionIds: string[];
  bundleIds: string[];
  status: BatchSummaryStatus;
  counts: {
    materialCount: number;
    draftCount: number;
    currentBundleCount: number;
    missingAssessmentCount: number;
    staleAssessmentCount: number;
    reviewedCount: number;
  };
  decisionDistribution: Record<QuestionQualityBundleDecision, number>;
  warningDistribution: Record<string, number>;
  abilityDistribution: Partial<Record<PrimaryAbilityId, number>>;
  difficultyDistribution: Partial<Record<QuestionResourceDifficulty, number>>;
  humanDecisionDistribution: {
    approve: number;
    revisionRequired: number;
    reject: number;
    pending: number;
  };
  metrics: {
    contractValidationPassRate: QuestionQualityMetric;
    semanticCompletionRate: QuestionQualityMetric;
    currentAssessmentCoverage: QuestionQualityMetric;
    duplicateObservationRate: QuestionQualityMetric;
    humanRetentionRate: QuestionQualityMetric;
    humanModificationRate: QuestionQualityMetric;
    humanRejectionRate: QuestionQualityMetric;
    averageReviewDurationMs: QuestionQualityMetric;
  };
  issues: string[];
  deterministicRuleVersions: string[];
  semanticRuleVersions: string[];
  promptVersions: string[];
  mergeRuleVersions: string[];
  summaryRuleVersion: string;
  generatedAt: string;
  version: typeof QUESTION_QUALITY_BATCH_SUMMARY_VERSION;
};

export function isQuestionGenerationQualityBatchManifest(
  value: unknown,
): value is QuestionGenerationQualityBatchManifest {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as QuestionGenerationQualityBatchManifest;
  return (
    nonEmpty(manifest.manifestId) &&
    nonEmpty(manifest.batchId) &&
    nonEmpty(manifest.batchVersion) &&
    stringArray(manifest.materialVersionIds) &&
    stringArray(manifest.generationRequestIds) &&
    Number.isInteger(manifest.generatedCandidateCount) &&
    manifest.generatedCandidateCount >= 0 &&
    Array.isArray(manifest.draftRefs) &&
    manifest.draftRefs.every((ref) => (
      nonEmpty(ref.draftId) &&
      nonEmpty(ref.resourceId) &&
      Number.isInteger(ref.draftRevision) &&
      ref.draftRevision > 0 &&
      nonEmpty(ref.validationId)
    )) &&
    nonEmpty(manifest.createdAt) &&
    nonEmpty(manifest.frozenAt) &&
    manifest.version === QUESTION_QUALITY_BATCH_MANIFEST_VERSION
  );
}

export function isQuestionGenerationBatchQualitySummary(
  value: unknown,
): value is QuestionGenerationBatchQualitySummary {
  if (!value || typeof value !== 'object') return false;
  const summary = value as QuestionGenerationBatchQualitySummary;
  return (
    nonEmpty(summary.summaryId) &&
    nonEmpty(summary.batchId) &&
    nonEmpty(summary.batchVersion) &&
    nonEmpty(summary.manifestId) &&
    stringArray(summary.reviewIds) &&
    stringArray(summary.materialVersionIds) &&
    stringArray(summary.bundleIds) &&
    ['complete', 'incomplete', 'mixed_versions', 'blocked'].includes(summary.status) &&
    countRecord(summary.counts) &&
    countRecord(summary.decisionDistribution) &&
    countRecord(summary.warningDistribution) &&
    countRecord(summary.abilityDistribution) &&
    Object.keys(summary.abilityDistribution).every((key) => (
      PRIMARY_ABILITY_IDS.includes(key as PrimaryAbilityId)
    )) &&
    countRecord(summary.difficultyDistribution) &&
    Object.keys(summary.difficultyDistribution).every((key) => (
      QUESTION_RESOURCE_DIFFICULTIES.includes(key as QuestionResourceDifficulty)
    )) &&
    countRecord(summary.humanDecisionDistribution) &&
    Object.values(summary.metrics).every(isQuestionQualityMetric) &&
    stringArray(summary.issues) &&
    stringArray(summary.deterministicRuleVersions) &&
    stringArray(summary.semanticRuleVersions) &&
    stringArray(summary.promptVersions) &&
    stringArray(summary.mergeRuleVersions) &&
    nonEmpty(summary.summaryRuleVersion) &&
    nonEmpty(summary.generatedAt) &&
    summary.version === QUESTION_QUALITY_BATCH_SUMMARY_VERSION
  );
}

export function createQuestionQualityMetric(
  numerator: number,
  denominator: number,
): QuestionQualityMetric {
  return {
    numerator,
    denominator,
    value: denominator === 0 ? null : numerator / denominator,
  };
}

function isQuestionQualityMetric(value: unknown): value is QuestionQualityMetric {
  if (!value || typeof value !== 'object') return false;
  const metric = value as QuestionQualityMetric;
  return (
    finiteNonNegative(metric.numerator) &&
    finiteNonNegative(metric.denominator) &&
    (
      metric.value === null ||
      (typeof metric.value === 'number' && Number.isFinite(metric.value))
    )
  );
}

function countRecord(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Object.values(value).every(finiteNonNegative),
  );
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
