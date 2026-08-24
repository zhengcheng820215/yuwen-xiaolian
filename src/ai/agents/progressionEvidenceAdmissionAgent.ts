import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type { LearningProgressionContextSnapshot } from
  '../schemas/learningProgressionContext.schema.ts';
import {
  PROGRESSION_EVIDENCE_ADMISSION_SCHEMA_VERSION,
  PROGRESSION_EVIDENCE_CONTEXT_SCHEMA_VERSION,
  type ProgressionEvidenceAdmissionDecision,
  type ProgressionEvidenceAdmissionReasonCode,
  type ProgressionEvidenceContext,
} from '../schemas/progressionEvidenceAdmission.schema.ts';
import type { ProgressionInstabilityAssessment } from
  '../schemas/progressionInstabilityAssessment.schema.ts';
import type { ProgressionPerformanceObservation } from
  '../schemas/progressionPerformanceObservation.schema.ts';

export function decideProgressionEvidenceAdmission(input: {
  evidence: AbilityEvidence;
  context: LearningProgressionContextSnapshot;
  observation: ProgressionPerformanceObservation;
  assessment?: ProgressionInstabilityAssessment;
  taskId: string;
  responseId: string;
  diagnosisId: string;
  decidedAt?: string;
}): {
  context: ProgressionEvidenceContext;
  decision: ProgressionEvidenceAdmissionDecision;
} {
  const decidedAt = input.decidedAt || new Date().toISOString();
  const identityAligned = input.evidence.studentId === input.context.studentId
    && input.evidence.taskId === input.taskId
    && input.evidence.diagnosisId === input.diagnosisId
    && input.observation.responseId === input.responseId
    && input.observation.progressionContextSnapshotHash === input.context.snapshotHash;
  const reasonCodes: ProgressionEvidenceAdmissionReasonCode[] = [];
  if (!identityAligned) reasonCodes.push('identity_mismatch');
  else reasonCodes.push('identity_aligned');
  if (input.context.authoritySource === 'legacy_projection') {
    reasonCodes.push('legacy_projection_only');
  }
  if (input.context.predecessor?.threadRelation === 'cross_thread') {
    reasonCodes.push('cross_thread_not_comparable');
  }
  if (!input.context.predecessor && Number(input.context.sequenceRank) > 1) {
    reasonCodes.push('missing_lower_load_reference');
  }
  if (input.observation.supportMode === 'feedback_revision'
    || input.observation.supportMode === 'hint_supported_initial') {
    reasonCodes.push('feedback_supported');
  } else if (input.observation.supportMode === 'targeted_training') {
    reasonCodes.push('targeted_support_context');
  } else {
    reasonCodes.push('independent_attempt');
  }
  if (input.assessment?.status === 'task_load_risk') reasonCodes.push('task_load_risk');
  if (input.assessment?.status === 'provisional_boundary') reasonCodes.push('provisional_boundary_only');
  if (input.assessment?.status === 'corroborated_boundary'
    && ['retest_independent', 'transfer_independent'].includes(input.observation.supportMode)) {
    reasonCodes.push('retest_or_transfer_corroborated');
  }

  const decision = resolveDecision(reasonCodes, input.context.authoritySource);
  const evidenceContext: ProgressionEvidenceContext = {
    schemaVersion: PROGRESSION_EVIDENCE_CONTEXT_SCHEMA_VERSION,
    evidenceId: input.evidence.id,
    studentId: input.evidence.studentId,
    taskId: input.taskId,
    learningTaskAttemptId: input.context.learningTaskAttemptId,
    responseId: input.responseId,
    diagnosisId: input.diagnosisId,
    progressionContextSnapshotHash: input.context.snapshotHash,
    progressionObservationId: input.observation.observationId,
    instabilityAssessmentId: input.assessment?.assessmentId,
    supportMode: input.observation.supportMode,
    inferenceScope: input.assessment?.status === 'corroborated_boundary'
      ? 'cross_task_corroborated'
      : input.assessment?.status === 'provisional_boundary'
        ? 'current_group_provisional'
        : ['retest_independent', 'transfer_independent'].includes(input.observation.supportMode)
          ? 'independent_validation'
          : 'task_only',
    createdAt: decidedAt,
  };
  return {
    context: evidenceContext,
    decision: {
      schemaVersion: PROGRESSION_EVIDENCE_ADMISSION_SCHEMA_VERSION,
      decisionId: `progression-admission:${input.evidence.id}:${input.assessment?.assessmentId || 'task-only'}`,
      evidenceId: input.evidence.id,
      decision: decision.name,
      reasonCodes: [...new Set(reasonCodes)],
      allowProfileEvaluation: decision.allowProfileEvaluation,
      decidedAt,
    },
  };
}

function resolveDecision(
  reasons: ProgressionEvidenceAdmissionReasonCode[],
  authority: LearningProgressionContextSnapshot['authoritySource'],
): { name: ProgressionEvidenceAdmissionDecision['decision']; allowProfileEvaluation: boolean } {
  if (reasons.includes('identity_mismatch') || reasons.includes('task_load_risk')) {
    return { name: 'exclude_from_profile_evaluation', allowProfileEvaluation: false };
  }
  if (reasons.includes('feedback_supported') || reasons.includes('targeted_support_context')) {
    return { name: 'exclude_from_profile_evaluation', allowProfileEvaluation: false };
  }
  if (reasons.includes('provisional_boundary_only')) {
    return { name: 'hold_for_more_evidence', allowProfileEvaluation: false };
  }
  if (reasons.includes('missing_lower_load_reference')
    && authority === 'native_authority') {
    return { name: 'admit_as_insufficient_only', allowProfileEvaluation: false };
  }
  // Legacy and absent progression authority preserve the pre-stage-3 evidence path.
  return { name: 'admit_existing_evidence', allowProfileEvaluation: true };
}
