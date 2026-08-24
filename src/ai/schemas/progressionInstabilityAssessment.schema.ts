import type { ReadingLoadResponsibility } from
  './readingTrainingProgressionAudit.schema.ts';
import { READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION } from
  './readingTrainingProgressionAudit.schema.ts';

export const PROGRESSION_INSTABILITY_ASSESSMENT_SCHEMA_VERSION =
  'progression_instability_assessment_v1' as const;

export const READING_INSTABILITY_LAYERS = [
  'basic_understanding_not_established',
  'text_evidence_not_established',
  'relation_explanation_not_established',
  'inference_integration_not_established',
  'expression_organization_not_established',
] as const;

export type ReadingInstabilityLayer = typeof READING_INSTABILITY_LAYERS[number];

export type ProgressionInstabilityAssessment = {
  schemaVersion: typeof PROGRESSION_INSTABILITY_ASSESSMENT_SCHEMA_VERSION;
  policyVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION;
  assessmentId: string;
  studentId: string;
  observationThreadId?: string;
  taskGroupProgressionPlanHash?: string;
  comparedObservationIds: string[];
  status: 'not_assessable' | 'no_instability_observed' | 'provisional_boundary'
    | 'corroborated_boundary' | 'task_load_risk';
  instabilityLayer?: ReadingInstabilityLayer;
  attribution: 'student_performance_hypothesis' | 'task_load_risk_only'
    | 'insufficient_comparable_evidence' | 'no_negative_attribution';
  confidence: 'low' | 'medium' | 'high';
  basis: Array<{
    lowerObservationId?: string;
    higherObservationId: string;
    retainedResponsibilities: ReadingLoadResponsibility[];
    addedResponsibilities: ReadingLoadResponsibility[];
    interpretation: string;
  }>;
  limitations: string[];
  assessedAt: string;
};

export function isProgressionInstabilityAssessment(
  value: unknown,
): value is ProgressionInstabilityAssessment {
  if (!value || typeof value !== 'object') return false;
  const assessment = value as ProgressionInstabilityAssessment;
  const boundary = ['provisional_boundary', 'corroborated_boundary']
    .includes(assessment.status);
  return assessment.schemaVersion === PROGRESSION_INSTABILITY_ASSESSMENT_SCHEMA_VERSION
    && assessment.policyVersion === READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION
    && [assessment.assessmentId, assessment.studentId, assessment.assessedAt].every(nonEmpty)
    && Array.isArray(assessment.comparedObservationIds)
    && new Set(assessment.comparedObservationIds).size
      === assessment.comparedObservationIds.length
    && ['not_assessable', 'no_instability_observed', 'provisional_boundary',
      'corroborated_boundary', 'task_load_risk'].includes(assessment.status)
    && ['student_performance_hypothesis', 'task_load_risk_only',
      'insufficient_comparable_evidence', 'no_negative_attribution']
      .includes(assessment.attribution)
    && ['low', 'medium', 'high'].includes(assessment.confidence)
    && (!boundary || (assessment.instabilityLayer !== undefined
      && (READING_INSTABILITY_LAYERS as readonly string[])
        .includes(assessment.instabilityLayer)))
    && Array.isArray(assessment.basis)
    && assessment.basis.every((item) => nonEmpty(item.higherObservationId)
      && Array.isArray(item.retainedResponsibilities)
      && Array.isArray(item.addedResponsibilities)
      && nonEmpty(item.interpretation))
    && Array.isArray(assessment.limitations)
    && assessment.limitations.every(nonEmpty);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
