import type { ReadingLoadResponsibility } from
  './readingTrainingProgressionAudit.schema.ts';

export const PROGRESSION_PERFORMANCE_OBSERVATION_SCHEMA_VERSION =
  'progression_performance_observation_v1' as const;

export const PROGRESSION_SUPPORT_MODES = [
  'independent_initial',
  'hint_supported_initial',
  'feedback_revision',
  'targeted_training',
  'retest_independent',
  'transfer_independent',
] as const;

export type ProgressionSupportMode = typeof PROGRESSION_SUPPORT_MODES[number];

export type ProgressionPerformanceObservation = {
  schemaVersion: typeof PROGRESSION_PERFORMANCE_OBSERVATION_SCHEMA_VERSION;
  observationId: string;
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  learningTaskAttemptId: string;
  resourceVersionId: string;
  materialVersionId: string;
  responseId: string;
  formalDiagnosisId: string;
  progressionContextSnapshotHash: string;
  observationThreadId?: string;
  taskGroupProgressionPlanHash?: string;
  sequenceRank?: number;
  responsibilities: ReadingLoadResponsibility[];
  outcome: 'meets' | 'partially_meets' | 'does_not_meet' | 'invalid';
  requiredRubricItemCount: number;
  matchedRequiredRubricItemCount: number;
  supportMode: ProgressionSupportMode;
  comparisonEligibility: 'eligible' | 'hold' | 'excluded';
  exclusionReasons: string[];
  observedAt: string;
};

export function isProgressionPerformanceObservation(
  value: unknown,
): value is ProgressionPerformanceObservation {
  if (!value || typeof value !== 'object') return false;
  const observation = value as ProgressionPerformanceObservation;
  return observation.schemaVersion === PROGRESSION_PERFORMANCE_OBSERVATION_SCHEMA_VERSION
    && [observation.observationId, observation.studentId,
      observation.learningSessionId, observation.learningRoundId,
      observation.learningTaskAttemptId, observation.resourceVersionId,
      observation.materialVersionId, observation.responseId,
      observation.formalDiagnosisId, observation.progressionContextSnapshotHash,
      observation.observedAt].every(nonEmpty)
    && Array.isArray(observation.responsibilities)
    && observation.responsibilities.length > 0
    && ['meets', 'partially_meets', 'does_not_meet', 'invalid']
      .includes(observation.outcome)
    && Number.isInteger(observation.requiredRubricItemCount)
    && observation.requiredRubricItemCount >= 0
    && Number.isInteger(observation.matchedRequiredRubricItemCount)
    && observation.matchedRequiredRubricItemCount >= 0
    && observation.matchedRequiredRubricItemCount <= observation.requiredRubricItemCount
    && (PROGRESSION_SUPPORT_MODES as readonly string[]).includes(observation.supportMode)
    && ['eligible', 'hold', 'excluded'].includes(observation.comparisonEligibility)
    && Array.isArray(observation.exclusionReasons)
    && observation.exclusionReasons.every(nonEmpty);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
