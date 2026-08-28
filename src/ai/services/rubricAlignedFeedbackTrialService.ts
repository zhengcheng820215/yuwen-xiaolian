import type { RubricAlignedFeedbackSurfaceMode } from
  '../agents/rubricAlignedNarrativeAdapter.ts';
import {
  RUBRIC_ALIGNED_FEEDBACK_TRIAL_DECISION_POLICY_VERSION,
  RUBRIC_ALIGNED_FEEDBACK_TRIAL_PREFLIGHT_CHECK_IDS,
  emptyRubricAlignedFeedbackTrialProtectedWriteCounts,
  validateRubricAlignedFeedbackTrialActivation,
  validateRubricAlignedFeedbackTrialObservation,
  type RubricAlignedFeedbackObservationCode,
  type RubricAlignedFeedbackTrialActivation,
  type RubricAlignedFeedbackTrialAdmissionReasonCode,
  type RubricAlignedFeedbackTrialDecision,
  type RubricAlignedFeedbackTrialObservation,
  type RubricAlignedFeedbackTrialPreflightReport,
  type RubricAlignedFeedbackTrialProtectedWriteCounts,
} from '../schemas/rubricAlignedFeedbackTrial.schema.ts';

export type RubricAlignedFeedbackTrialRuntimeContext = {
  studentId: string;
  learningRoundId: string;
  runtimeIdentityDigest: string;
  formalResourceRevision: number;
  sessionCount: number;
  now: string;
};

export type RubricAlignedFeedbackTrialModeResolution = {
  mode: RubricAlignedFeedbackSurfaceMode;
  trialId?: string;
  countsTowardCalibration: boolean;
  reasonCodes: RubricAlignedFeedbackTrialAdmissionReasonCode[];
};

export type RubricAlignedFeedbackTrialPreflightSignals = {
  stage3AcceptancePresent: boolean;
  stage3AcceptanceFresh: boolean;
  stage3BrowserMatrixPassed: boolean;
  browserConsoleClean: boolean;
  runtimeIdentityAligned: boolean;
  formalResourceRevisionAligned: boolean;
  providerReady: boolean;
  defaultModeShadow: boolean;
  studentScopeFrozen: boolean;
  trialWindowValid: boolean;
  unresolvedCriticalIssueCount: number;
  feedbackIdentityAligned: boolean;
  singleChoiceFallbackReady: boolean;
  historicalFallbackReady: boolean;
  independentValidationBoundaryReady: boolean;
  notAssessableFallbackReady: boolean;
  rollbackReady: boolean;
  protectedBaselineRecorded: boolean;
  saveAndActivateSeparated: boolean;
  runtimeFailureAtomicFallbackReady: boolean;
  fixedQueueContinuityReady: boolean;
  refreshRecoveryReady: boolean;
  observationOriginIsolationReady: boolean;
  observationIdempotencyReady: boolean;
  noProtectedWrites: boolean;
};

export function resolveRubricAlignedFeedbackTrialMode(input: {
  activation?: RubricAlignedFeedbackTrialActivation;
  context: RubricAlignedFeedbackTrialRuntimeContext;
}): RubricAlignedFeedbackTrialModeResolution {
  const { activation, context } = input;
  if (!activation) return shadow('trial_activation_missing');
  const validationIssues = validateRubricAlignedFeedbackTrialActivation(activation);
  if (validationIssues.length) return shadow(...validationIssues);
  if (activation.status !== 'student_visible_active') return shadow('trial_not_active');
  const now = Date.parse(context.now);
  if (!Number.isFinite(now) || now < Date.parse(activation.startsAt)) {
    return shadow('trial_window_invalid');
  }
  if (now >= Date.parse(activation.expiresAt)) return shadow('trial_expired');
  if (activation.runtimeIdentityDigest !== context.runtimeIdentityDigest) {
    return shadow('runtime_identity_mismatch');
  }
  if (activation.formalResourceRevision !== context.formalResourceRevision) {
    return shadow('formal_resource_revision_mismatch');
  }
  if (!activation.scope.studentIds.includes(context.studentId)) return shadow('student_scope_missing');
  if (activation.scope.learningRoundIds?.length
    && !activation.scope.learningRoundIds.includes(context.learningRoundId)) {
    return shadow('learning_round_scope_mismatch');
  }
  if (context.sessionCount >= activation.scope.maxSessions) return shadow('session_limit_reached');
  return {
    mode: 'student_visible',
    trialId: activation.trialId,
    countsTowardCalibration: true,
    reasonCodes: [],
  };
}

export function runRubricAlignedFeedbackTrialPreflight(input: {
  activation: RubricAlignedFeedbackTrialActivation;
  signals: RubricAlignedFeedbackTrialPreflightSignals;
  generatedAt: string;
  protectedWriteCounts?: RubricAlignedFeedbackTrialProtectedWriteCounts;
}): RubricAlignedFeedbackTrialPreflightReport {
  const signalEntries: Array<[boolean, RubricAlignedFeedbackTrialAdmissionReasonCode, string]> = [
    [input.signals.stage3AcceptancePresent, 'stage3_acceptance_missing', 'stage3_acceptance_present'],
    [input.signals.stage3AcceptanceFresh, 'stage3_acceptance_stale', 'stage3_acceptance_fresh'],
    [input.signals.stage3BrowserMatrixPassed, 'stage3_acceptance_stale', 'stage3_browser_matrix_16_of_16'],
    [input.signals.browserConsoleClean, 'unresolved_critical_issue', 'browser_console_clean'],
    [input.signals.runtimeIdentityAligned, 'runtime_identity_mismatch', 'runtime_identity_aligned'],
    [input.signals.formalResourceRevisionAligned, 'formal_resource_revision_mismatch', 'formal_revision_aligned'],
    [input.signals.providerReady, 'provider_not_ready', 'provider_ready'],
    [input.signals.defaultModeShadow, 'feedback_identity_not_aligned', 'default_mode_shadow'],
    [input.signals.studentScopeFrozen, 'student_scope_missing', 'student_scope_frozen'],
    [input.signals.trialWindowValid, 'trial_window_invalid', 'trial_window_valid'],
    [input.signals.unresolvedCriticalIssueCount === 0, 'unresolved_critical_issue', 'no_unresolved_p0_p1'],
    [input.signals.feedbackIdentityAligned, 'feedback_identity_not_aligned', 'feedback_identity_aligned'],
    [input.signals.singleChoiceFallbackReady, 'feedback_identity_not_aligned', 'single_choice_fallback_ready'],
    [input.signals.historicalFallbackReady, 'feedback_identity_not_aligned', 'historical_fallback_ready'],
    [input.signals.independentValidationBoundaryReady, 'feedback_identity_not_aligned', 'independent_validation_boundary_ready'],
    [input.signals.notAssessableFallbackReady, 'feedback_identity_not_aligned', 'not_assessable_fallback_ready'],
    [input.signals.rollbackReady, 'rollback_not_ready', 'rollback_ready'],
    [input.signals.protectedBaselineRecorded, 'unresolved_critical_issue', 'protected_baseline_recorded'],
    [input.signals.saveAndActivateSeparated, 'unresolved_critical_issue', 'save_activate_separated'],
    [input.signals.runtimeFailureAtomicFallbackReady, 'rollback_not_ready', 'runtime_failure_atomic_fallback_ready'],
    [input.signals.fixedQueueContinuityReady, 'unresolved_critical_issue', 'fixed_queue_continuity_ready'],
    [input.signals.refreshRecoveryReady, 'unresolved_critical_issue', 'refresh_recovery_ready'],
    [input.signals.observationOriginIsolationReady, 'unresolved_critical_issue', 'observation_origin_isolation_ready'],
    [input.signals.observationIdempotencyReady && input.signals.noProtectedWrites,
      'unresolved_critical_issue', 'idempotency_and_zero_write_ready'],
  ];
  const activationIssues = validateRubricAlignedFeedbackTrialActivation(input.activation);
  const checkResults = RUBRIC_ALIGNED_FEEDBACK_TRIAL_PREFLIGHT_CHECK_IDS.map((checkId, index) => {
    const [passed, issue, evidence] = signalEntries[index];
    return {
      checkId,
      status: passed ? 'passed' as const : 'failed' as const,
      evidenceCodes: passed ? [evidence] : [],
      issueCodes: passed ? [] : [issue],
    };
  });
  const protectedWriteCounts = input.protectedWriteCounts
    || emptyRubricAlignedFeedbackTrialProtectedWriteCounts();
  const writeViolation = Object.values(protectedWriteCounts).some((count) => count !== 0);
  const reasonCodes = unique([
    ...activationIssues,
    ...checkResults.flatMap((item) => item.issueCodes),
    ...(writeViolation ? ['unresolved_critical_issue' as const] : []),
  ]);
  return {
    schemaVersion: 'rubric_aligned_feedback_trial_preflight_v1',
    reportId: `rubric-feedback-preflight:${input.activation.trialId}:${input.generatedAt}`,
    trialId: input.activation.trialId,
    generatedAt: input.generatedAt,
    checkResults,
    eligibleForActivation: reasonCodes.length === 0,
    reasonCodes,
    protectedWriteCounts,
  };
}

export function buildRubricAlignedFeedbackTrialObservation(input: Omit<
  RubricAlignedFeedbackTrialObservation,
  'schemaVersion' | 'countsTowardCalibration'
>): RubricAlignedFeedbackTrialObservation {
  const observation: RubricAlignedFeedbackTrialObservation = {
    ...input,
    schemaVersion: 'rubric_aligned_feedback_trial_observation_v1',
    countsTowardCalibration: input.origin === 'real_student',
  };
  const issues = validateRubricAlignedFeedbackTrialObservation(observation);
  if (issues.length) throw new Error(`rubric_feedback_trial_observation_invalid:${issues.join(',')}`);
  return observation;
}

export function resolveRubricAlignedFeedbackTrialDecision(input: {
  observations: RubricAlignedFeedbackTrialObservation[];
  active: boolean;
  unresolvedCriticalIssueCount: number;
}): { policyVersion: typeof RUBRIC_ALIGNED_FEEDBACK_TRIAL_DECISION_POLICY_VERSION;
  decision: RubricAlignedFeedbackTrialDecision; reasonCodes: string[] } {
  const real = input.observations.filter((item) => item.countsTowardCalibration);
  const codes = new Set(real.flatMap((item) => item.observationCodes));
  const zeroTolerance: RubricAlignedFeedbackObservationCode[] = [
    'answer_leakage_detected', 'false_positive_praise_detected',
    'task_type_crossover_detected', 'fixed_group_continuity_broken',
    'feedback_mismatches_original_response', 'fallback_recovery_failed',
  ];
  const blocking = zeroTolerance.filter((code) => codes.has(code));
  let decision: RubricAlignedFeedbackTrialDecision;
  if (blocking.length) decision = 'rollback';
  else if (input.unresolvedCriticalIssueCount > 0) decision = 'pause_and_fix';
  else if (!input.active) decision = 'continue_shadow';
  else if (real.length < 12) decision = 'continue_limited_trial';
  else decision = 'ready_for_scoped_enablement';
  return {
    policyVersion: RUBRIC_ALIGNED_FEEDBACK_TRIAL_DECISION_POLICY_VERSION,
    decision,
    reasonCodes: blocking.length ? blocking : real.length < 12 ? ['real_sample_below_trial_threshold'] : [],
  };
}

export function allPassingRubricAlignedFeedbackTrialPreflightSignals():
RubricAlignedFeedbackTrialPreflightSignals {
  return {
    stage3AcceptancePresent: true,
    stage3AcceptanceFresh: true,
    stage3BrowserMatrixPassed: true,
    browserConsoleClean: true,
    runtimeIdentityAligned: true,
    formalResourceRevisionAligned: true,
    providerReady: true,
    defaultModeShadow: true,
    studentScopeFrozen: true,
    trialWindowValid: true,
    unresolvedCriticalIssueCount: 0,
    feedbackIdentityAligned: true,
    singleChoiceFallbackReady: true,
    historicalFallbackReady: true,
    independentValidationBoundaryReady: true,
    notAssessableFallbackReady: true,
    rollbackReady: true,
    protectedBaselineRecorded: true,
    saveAndActivateSeparated: true,
    runtimeFailureAtomicFallbackReady: true,
    fixedQueueContinuityReady: true,
    refreshRecoveryReady: true,
    observationOriginIsolationReady: true,
    observationIdempotencyReady: true,
    noProtectedWrites: true,
  };
}

function shadow(
  ...reasonCodes: RubricAlignedFeedbackTrialAdmissionReasonCode[]
): RubricAlignedFeedbackTrialModeResolution {
  return { mode: 'shadow', countsTowardCalibration: false, reasonCodes: unique(reasonCodes) };
}

function unique<T>(values: T[]): T[] { return [...new Set(values)]; }
