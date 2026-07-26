import {
  cloneSemanticQualityValue,
  type QuestionQualityAssessmentBundle,
  type QuestionSemanticQualityAssessment,
} from './questionSemanticQualityAssessment.schema.ts';
import type {
  QuestionQualityAssessment,
} from './questionQualityAssessment.schema.ts';
import type {
  QuestionGenerationBatchQualitySummary,
  QuestionGenerationQualityBatchManifest,
} from './questionQualityBatchSummary.schema.ts';
import type {
  TenMaterialCalibrationManifest,
  TenMaterialCalibrationReport,
} from './questionQualityCalibration.schema.ts';

export const QUESTION_QUALITY_PERSISTENCE_SCHEMA_VERSION =
  'question_quality_persistence_v1' as const;

export type FrozenQuestionQualityTrace = {
  traceId: string;
  resourceId: string;
  resourceVersionId: string;
  sourceDraftId: string;
  frozenDraftRevision: number;
  validationId: string;
  reviewId: string;
  deterministicAssessmentId: string;
  semanticAssessmentId: string;
  bundleId: string;
  deterministicRuleVersion: string;
  semanticRuleVersion: string;
  mergeRuleVersion: string;
  tracedAt: string;
  schemaVersion: typeof QUESTION_QUALITY_PERSISTENCE_SCHEMA_VERSION;
};

export type SharedQuestionQualityState = {
  deterministicAssessments: QuestionQualityAssessment[];
  semanticAssessments: QuestionSemanticQualityAssessment[];
  assessmentBundles: QuestionQualityAssessmentBundle[];
  frozenQualityTraces: FrozenQuestionQualityTrace[];
  batchManifests: QuestionGenerationQualityBatchManifest[];
  batchSummaries: QuestionGenerationBatchQualitySummary[];
  calibrationManifests: TenMaterialCalibrationManifest[];
  calibrationReports: TenMaterialCalibrationReport[];
};

export function createEmptySharedQuestionQualityState(): SharedQuestionQualityState {
  return {
    deterministicAssessments: [],
    semanticAssessments: [],
    assessmentBundles: [],
    frozenQualityTraces: [],
    batchManifests: [],
    batchSummaries: [],
    calibrationManifests: [],
    calibrationReports: [],
  };
}

export function isFrozenQuestionQualityTrace(
  value: unknown,
): value is FrozenQuestionQualityTrace {
  if (!value || typeof value !== 'object') return false;
  const trace = value as FrozenQuestionQualityTrace;
  return (
    nonEmpty(trace.traceId) &&
    nonEmpty(trace.resourceId) &&
    nonEmpty(trace.resourceVersionId) &&
    nonEmpty(trace.sourceDraftId) &&
    Number.isInteger(trace.frozenDraftRevision) &&
    trace.frozenDraftRevision > 0 &&
    nonEmpty(trace.validationId) &&
    nonEmpty(trace.reviewId) &&
    nonEmpty(trace.deterministicAssessmentId) &&
    nonEmpty(trace.semanticAssessmentId) &&
    nonEmpty(trace.bundleId) &&
    nonEmpty(trace.deterministicRuleVersion) &&
    nonEmpty(trace.semanticRuleVersion) &&
    nonEmpty(trace.mergeRuleVersion) &&
    nonEmpty(trace.tracedAt) &&
    trace.schemaVersion === QUESTION_QUALITY_PERSISTENCE_SCHEMA_VERSION
  );
}

export function cloneQuestionQualityPersistenceValue<T>(value: T): T {
  return cloneSemanticQualityValue(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
