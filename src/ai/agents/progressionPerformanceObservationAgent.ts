import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { LearningProgressionContextSnapshot } from
  '../schemas/learningProgressionContext.schema.ts';
import {
  PROGRESSION_PERFORMANCE_OBSERVATION_SCHEMA_VERSION,
  type ProgressionPerformanceObservation,
  type ProgressionSupportMode,
} from '../schemas/progressionPerformanceObservation.schema.ts';

export function createProgressionPerformanceObservation(input: {
  context: LearningProgressionContextSnapshot;
  responseId: string;
  formalDiagnosisId: string;
  diagnosis: DiagnosisResult;
  supportMode?: ProgressionSupportMode;
  usedHint?: boolean;
  observedAt?: string;
}): ProgressionPerformanceObservation {
  const required = (input.diagnosis.rubricItems || []).filter((item) => item.required);
  const matched = required.filter((item) => item.matched);
  const supportMode = input.supportMode || (input.usedHint
    ? 'hint_supported_initial'
    : 'independent_initial');
  const exclusionReasons: string[] = [];
  if (input.context.comparisonEligibility !== 'eligible') {
    exclusionReasons.push(...input.context.comparisonLimitations);
  }
  if (!['independent_initial', 'retest_independent', 'transfer_independent']
    .includes(supportMode)) {
    exclusionReasons.push(`support_mode:${supportMode}`);
  }
  const outcome = mapOutcome(input.diagnosis);
  if (outcome === 'invalid') exclusionReasons.push('diagnosis_outcome_invalid');
  const comparisonEligibility = exclusionReasons.length > 0
    ? (supportMode === 'hint_supported_initial' ? 'hold' : 'excluded')
    : 'eligible';
  return {
    schemaVersion: PROGRESSION_PERFORMANCE_OBSERVATION_SCHEMA_VERSION,
    observationId: stableId('progression-observation', [
      input.context.learningTaskAttemptId,
      input.responseId,
      input.formalDiagnosisId,
      input.context.snapshotHash,
    ]),
    studentId: input.context.studentId,
    learningSessionId: input.context.learningSessionId,
    learningRoundId: input.context.learningRoundId,
    learningTaskAttemptId: input.context.learningTaskAttemptId,
    resourceVersionId: input.context.resourceVersionId,
    materialVersionId: input.context.materialVersionId,
    responseId: input.responseId,
    formalDiagnosisId: input.formalDiagnosisId,
    progressionContextSnapshotHash: input.context.snapshotHash,
    observationThreadId: input.context.taskLoadSemantics?.observationThreadId,
    taskGroupProgressionPlanHash: input.context.taskGroupProgressionPlanHash,
    sequenceRank: input.context.sequenceRank,
    responsibilities: [...(input.context.taskLoadSemantics?.responsibilities
      || ['basic_understanding'])],
    outcome,
    requiredRubricItemCount: required.length,
    matchedRequiredRubricItemCount: matched.length,
    supportMode,
    comparisonEligibility,
    exclusionReasons: [...new Set(exclusionReasons)],
    observedAt: input.observedAt || new Date().toISOString(),
  };
}

function mapOutcome(diagnosis: DiagnosisResult): ProgressionPerformanceObservation['outcome'] {
  if (diagnosis.answerStatus === 'fully_meets' || diagnosis.correct === true) return 'meets';
  if (diagnosis.answerStatus === 'partially_meets') return 'partially_meets';
  if (diagnosis.answerStatus === 'does_not_meet' || diagnosis.correct === false) {
    return 'does_not_meet';
  }
  return 'invalid';
}

function stableId(prefix: string, values: string[]): string {
  const value = values.join('|');
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
