export const FEEDBACK_OBSERVATION_TARGET_PROJECTION_SCHEMA_VERSION =
  'feedback_observation_target_projection_v1' as const;

export const FEEDBACK_OBSERVATION_TARGET_CODES = [
  'character_psychology',
  'character_trait',
  'scene_or_object_state',
  'fact_or_evidence',
  'event_process_or_change',
  'event_cause',
  'relationship_or_comparison',
  'main_content',
  'expression_effect',
  'structure_relation',
  'theme_or_meaning',
  'requirement_completion',
  'generic_content',
] as const;

export type FeedbackObservationTargetCode =
  typeof FEEDBACK_OBSERVATION_TARGET_CODES[number];

export type FeedbackObservationTargetFallbackReason =
  | 'insufficient_question_signal'
  | 'question_rubric_mismatch'
  | 'unsupported_target_pattern';

export type FeedbackObservationTargetProjection = {
  schemaVersion: typeof FEEDBACK_OBSERVATION_TARGET_PROJECTION_SCHEMA_VERSION;
  targetCode: FeedbackObservationTargetCode;
  subject?: string;
  displayLabel: string;
  confidence: 'high' | 'medium' | 'low';
  evidenceSignals: string[];
  fallbackReason?: FeedbackObservationTargetFallbackReason;
};

export function isFeedbackObservationTargetProjection(
  value: unknown,
): value is FeedbackObservationTargetProjection {
  if (!value || typeof value !== 'object') return false;
  const projection = value as FeedbackObservationTargetProjection;
  return (
    projection.schemaVersion === FEEDBACK_OBSERVATION_TARGET_PROJECTION_SCHEMA_VERSION
    && FEEDBACK_OBSERVATION_TARGET_CODES.includes(projection.targetCode)
    && ['high', 'medium', 'low'].includes(projection.confidence)
    && typeof projection.displayLabel === 'string'
    && projection.displayLabel.trim().length > 0
    && Array.isArray(projection.evidenceSignals)
    && projection.evidenceSignals.every((item) => typeof item === 'string' && item.trim().length > 0)
    && (
      projection.confidence !== 'low'
      || (
        projection.targetCode === 'generic_content'
        && typeof projection.fallbackReason === 'string'
      )
    )
  );
}
