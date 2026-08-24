import type { ProgressionSupportMode } from
  './progressionPerformanceObservation.schema.ts';

export const PROGRESSION_EVIDENCE_CONTEXT_SCHEMA_VERSION =
  'progression_evidence_context_v1' as const;
export const PROGRESSION_EVIDENCE_ADMISSION_SCHEMA_VERSION =
  'progression_evidence_admission_v1' as const;

export const PROGRESSION_EVIDENCE_REASON_CODES = [
  'identity_aligned',
  'independent_attempt',
  'provisional_boundary_only',
  'feedback_supported',
  'targeted_support_context',
  'task_load_risk',
  'cross_thread_not_comparable',
  'legacy_projection_only',
  'missing_lower_load_reference',
  'retest_or_transfer_corroborated',
  'identity_mismatch',
] as const;

export type ProgressionEvidenceAdmissionReasonCode =
  typeof PROGRESSION_EVIDENCE_REASON_CODES[number];

export type ProgressionEvidenceContext = {
  schemaVersion: typeof PROGRESSION_EVIDENCE_CONTEXT_SCHEMA_VERSION;
  evidenceId: string;
  studentId: string;
  taskId: string;
  learningTaskAttemptId: string;
  responseId: string;
  diagnosisId: string;
  progressionContextSnapshotHash: string;
  progressionObservationId: string;
  instabilityAssessmentId?: string;
  supportMode: ProgressionSupportMode;
  inferenceScope: 'task_only' | 'current_group_provisional'
    | 'cross_task_corroborated' | 'independent_validation';
  createdAt: string;
};

export type ProgressionEvidenceAdmissionDecision = {
  schemaVersion: typeof PROGRESSION_EVIDENCE_ADMISSION_SCHEMA_VERSION;
  decisionId: string;
  evidenceId: string;
  decision: 'admit_existing_evidence' | 'admit_as_insufficient_only'
    | 'hold_for_more_evidence' | 'exclude_from_profile_evaluation';
  reasonCodes: ProgressionEvidenceAdmissionReasonCode[];
  allowProfileEvaluation: boolean;
  decidedAt: string;
};

export function isProgressionEvidenceContext(
  value: unknown,
): value is ProgressionEvidenceContext {
  if (!value || typeof value !== 'object') return false;
  const context = value as ProgressionEvidenceContext;
  return context.schemaVersion === PROGRESSION_EVIDENCE_CONTEXT_SCHEMA_VERSION
    && [context.evidenceId, context.studentId, context.taskId,
      context.learningTaskAttemptId, context.responseId, context.diagnosisId,
      context.progressionContextSnapshotHash, context.progressionObservationId,
      context.createdAt].every(nonEmpty)
    && ['independent_initial', 'hint_supported_initial', 'feedback_revision',
      'targeted_training', 'retest_independent', 'transfer_independent']
      .includes(context.supportMode)
    && ['task_only', 'current_group_provisional', 'cross_task_corroborated',
      'independent_validation'].includes(context.inferenceScope);
}

export function isProgressionEvidenceAdmissionDecision(
  value: unknown,
): value is ProgressionEvidenceAdmissionDecision {
  if (!value || typeof value !== 'object') return false;
  const decision = value as ProgressionEvidenceAdmissionDecision;
  return decision.schemaVersion === PROGRESSION_EVIDENCE_ADMISSION_SCHEMA_VERSION
    && nonEmpty(decision.decisionId)
    && nonEmpty(decision.evidenceId)
    && ['admit_existing_evidence', 'admit_as_insufficient_only',
      'hold_for_more_evidence', 'exclude_from_profile_evaluation']
      .includes(decision.decision)
    && Array.isArray(decision.reasonCodes)
    && decision.reasonCodes.length > 0
    && decision.reasonCodes.every((code) => (
      (PROGRESSION_EVIDENCE_REASON_CODES as readonly string[]).includes(code)
    ))
    && typeof decision.allowProfileEvaluation === 'boolean'
    && nonEmpty(decision.decidedAt);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
