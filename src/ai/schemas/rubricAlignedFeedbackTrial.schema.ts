import type { RecommendedTaskRole } from './nextLearningStrategy.schema.ts';
import type { QuestionResponseFormat } from './questionResourceAdmission.schema.ts';

export const RUBRIC_ALIGNED_FEEDBACK_TRIAL_ACTIVATION_VERSION =
  'rubric_aligned_feedback_trial_activation_v1' as const;
export const RUBRIC_ALIGNED_FEEDBACK_TRIAL_OBSERVATION_VERSION =
  'rubric_aligned_feedback_trial_observation_v1' as const;
export const RUBRIC_ALIGNED_FEEDBACK_TRIAL_DECISION_POLICY_VERSION =
  'rubric_aligned_feedback_trial_decision_policy_v1' as const;
export const RUBRIC_ALIGNED_FEEDBACK_TRIAL_ROLLBACK_POLICY_VERSION =
  'rubric_aligned_feedback_trial_rollback_v1' as const;

export const RUBRIC_ALIGNED_FEEDBACK_TRIAL_PREFLIGHT_CHECK_IDS = Array.from(
  { length: 24 },
  (_, index) => `RF4-A${String(index + 1).padStart(2, '0')}`,
) as readonly string[];

export type RubricAlignedFeedbackTrialStatus =
  | 'shadow_ready'
  | 'student_visible_active'
  | 'paused'
  | 'rolled_back'
  | 'completed'
  | 'expired'
  | 'invalidated';

export type RubricAlignedFeedbackTrialActivation = {
  schemaVersion: typeof RUBRIC_ALIGNED_FEEDBACK_TRIAL_ACTIVATION_VERSION;
  trialId: string;
  status: RubricAlignedFeedbackTrialStatus;
  stage3Acceptance: {
    reportRef: string;
    acceptanceDigest: string;
    acceptedAt: string;
  };
  scope: {
    studentIds: string[];
    learningRoundIds?: string[];
    maxSessions: number;
  };
  runtimeIdentityDigest: string;
  gitCommit: string;
  formalResourceRevision: number;
  sourcePolicyVersion: string;
  feedbackMode: 'student_visible';
  startsAt: string;
  expiresAt: string;
  rollbackPolicyVersion: typeof RUBRIC_ALIGNED_FEEDBACK_TRIAL_ROLLBACK_POLICY_VERSION;
  activatedBy: string;
  activatedAt: string;
};

export type RubricAlignedFeedbackTrialAdmissionReasonCode =
  | 'trial_activation_missing'
  | 'trial_not_active'
  | 'stage3_acceptance_missing'
  | 'stage3_acceptance_stale'
  | 'runtime_identity_mismatch'
  | 'formal_resource_revision_mismatch'
  | 'provider_not_ready'
  | 'student_scope_missing'
  | 'learning_round_scope_mismatch'
  | 'trial_window_invalid'
  | 'trial_expired'
  | 'session_limit_reached'
  | 'feedback_identity_not_aligned'
  | 'rollback_not_ready'
  | 'unresolved_critical_issue';

export type RubricAlignedFeedbackTrialPreflightCheck = {
  checkId: string;
  status: 'passed' | 'failed';
  evidenceCodes: string[];
  issueCodes: RubricAlignedFeedbackTrialAdmissionReasonCode[];
};

export type RubricAlignedFeedbackTrialPreflightReport = {
  schemaVersion: 'rubric_aligned_feedback_trial_preflight_v1';
  reportId: string;
  trialId: string;
  generatedAt: string;
  checkResults: RubricAlignedFeedbackTrialPreflightCheck[];
  eligibleForActivation: boolean;
  reasonCodes: RubricAlignedFeedbackTrialAdmissionReasonCode[];
  protectedWriteCounts: RubricAlignedFeedbackTrialProtectedWriteCounts;
};

export type TrialObservationOrigin = 'internal_debug' | 'browser_acceptance' | 'real_student';

export type RubricAlignedFeedbackObservationCode =
  | 'feedback_matches_original_response'
  | 'feedback_mismatches_original_response'
  | 'student_understands_completed_part'
  | 'student_understands_primary_gap'
  | 'student_understands_next_action'
  | 'student_executes_revision_action'
  | 'revision_reduces_primary_gap'
  | 'revision_does_not_reduce_primary_gap'
  | 'independent_revalidation_reduces_gap'
  | 'answer_leakage_detected'
  | 'false_positive_praise_detected'
  | 'task_type_crossover_detected'
  | 'feedback_reading_load_high'
  | 'fixed_group_continuity_preserved'
  | 'fixed_group_continuity_broken'
  | 'fallback_recovery_succeeded'
  | 'fallback_recovery_failed';

export type RubricAlignedFeedbackTrialObservation = {
  schemaVersion: typeof RUBRIC_ALIGNED_FEEDBACK_TRIAL_OBSERVATION_VERSION;
  observationId: string;
  trialId: string;
  origin: TrialObservationOrigin;
  countsTowardCalibration: boolean;
  identity: {
    studentId: string;
    sessionId: string;
    roundId: string;
    attemptId: string;
    questionId: string;
    questionVersion: string;
    formalResourceRevision: number;
    runtimeIdentityDigest: string;
  };
  taskContext: {
    responseFormat: Extract<QuestionResponseFormat, 'short_text' | 'long_text' | 'single_choice'>;
    taskRole: RecommendedTaskRole;
    projectionStatus: 'ready' | 'limited' | 'not_assessable';
    feedbackSource: 'rubric_aligned' | 'legacy_fallback';
  };
  observationCodes: RubricAlignedFeedbackObservationCode[];
  severity: 'info' | 'advisory' | 'blocking';
  occurredAt: string;
};

export type RubricAlignedFeedbackTrialDecision =
  | 'continue_shadow'
  | 'continue_limited_trial'
  | 'ready_for_scoped_enablement'
  | 'pause_and_fix'
  | 'rollback';

export type RubricAlignedFeedbackTrialProtectedWriteCounts = {
  formalResourceWriteCount: number;
  diagnosisWriteCount: number;
  evidenceWriteCount: number;
  profileWriteCount: number;
  realCalibrationDenominatorWriteCount: number;
};

export function validateRubricAlignedFeedbackTrialActivation(
  value: unknown,
): RubricAlignedFeedbackTrialAdmissionReasonCode[] {
  if (!value || typeof value !== 'object') return ['trial_activation_missing'];
  const activation = value as RubricAlignedFeedbackTrialActivation;
  const issues: RubricAlignedFeedbackTrialAdmissionReasonCode[] = [];
  if (activation.schemaVersion !== RUBRIC_ALIGNED_FEEDBACK_TRIAL_ACTIVATION_VERSION
    || !nonEmpty(activation.trialId)
    || !nonEmpty(activation.gitCommit)
    || !nonEmpty(activation.sourcePolicyVersion)
    || activation.feedbackMode !== 'student_visible') issues.push('feedback_identity_not_aligned');
  if (!activation.stage3Acceptance
    || !nonEmpty(activation.stage3Acceptance.reportRef)
    || !nonEmpty(activation.stage3Acceptance.acceptanceDigest)
    || !timestamp(activation.stage3Acceptance.acceptedAt)) issues.push('stage3_acceptance_missing');
  if (!activation.scope
    || !uniqueNonEmpty(activation.scope.studentIds)
    || !Number.isInteger(activation.scope.maxSessions)
    || activation.scope.maxSessions < 1) issues.push('student_scope_missing');
  if (activation.scope?.learningRoundIds && !uniqueNonEmpty(activation.scope.learningRoundIds)) {
    issues.push('learning_round_scope_mismatch');
  }
  if (!nonEmpty(activation.runtimeIdentityDigest)) issues.push('runtime_identity_mismatch');
  if (!Number.isInteger(activation.formalResourceRevision) || activation.formalResourceRevision < 0) {
    issues.push('formal_resource_revision_mismatch');
  }
  if (!timestamp(activation.startsAt) || !timestamp(activation.expiresAt)
    || Date.parse(activation.expiresAt) <= Date.parse(activation.startsAt)
    || !timestamp(activation.activatedAt)) issues.push('trial_window_invalid');
  if (activation.rollbackPolicyVersion !== RUBRIC_ALIGNED_FEEDBACK_TRIAL_ROLLBACK_POLICY_VERSION) {
    issues.push('rollback_not_ready');
  }
  return unique(issues);
}

export function validateRubricAlignedFeedbackTrialObservation(
  value: unknown,
): string[] {
  if (!value || typeof value !== 'object') return ['observation_missing'];
  const observation = value as RubricAlignedFeedbackTrialObservation;
  const issues: string[] = [];
  if (observation.schemaVersion !== RUBRIC_ALIGNED_FEEDBACK_TRIAL_OBSERVATION_VERSION
    || !nonEmpty(observation.observationId) || !nonEmpty(observation.trialId)) {
    issues.push('observation_identity_invalid');
  }
  const identity = observation.identity;
  if (!identity || ![
    identity.studentId, identity.sessionId, identity.roundId, identity.attemptId,
    identity.questionId, identity.questionVersion, identity.runtimeIdentityDigest,
  ].every(nonEmpty) || !Number.isInteger(identity.formalResourceRevision)) {
    issues.push('observation_learning_identity_invalid');
  }
  if (!['internal_debug', 'browser_acceptance', 'real_student'].includes(observation.origin)) {
    issues.push('observation_origin_invalid');
  }
  const shouldCount = observation.origin === 'real_student';
  if (observation.countsTowardCalibration !== shouldCount) {
    issues.push('observation_denominator_boundary_invalid');
  }
  if (!Array.isArray(observation.observationCodes) || observation.observationCodes.length === 0) {
    issues.push('observation_code_missing');
  }
  if (!timestamp(observation.occurredAt)) issues.push('observation_time_invalid');
  return unique(issues);
}

export function emptyRubricAlignedFeedbackTrialProtectedWriteCounts():
RubricAlignedFeedbackTrialProtectedWriteCounts {
  return {
    formalResourceWriteCount: 0,
    diagnosisWriteCount: 0,
    evidenceWriteCount: 0,
    profileWriteCount: 0,
    realCalibrationDenominatorWriteCount: 0,
  };
}

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function timestamp(value: unknown): boolean {
  return nonEmpty(value) && Number.isFinite(Date.parse(String(value)));
}

function uniqueNonEmpty(values: unknown): boolean {
  return Array.isArray(values) && values.length > 0
    && values.every(nonEmpty) && new Set(values).size === values.length;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
