import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION,
  stableConvergenceHash,
  stableConvergenceSerialize,
  validateConvergenceTrialWindow,
  type ComplexityConvergenceCapability,
  type ComplexityConvergenceTrialWindow,
} from './productComplexityConvergenceObservation.schema.ts';
import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_V2_VERSION,
  type ConvergenceObservationActivationStateV2,
} from './productComplexityConvergenceTrialPreflight.schema.ts';
import {
  PRODUCT_RUNTIME_IDENTITY_VERSION,
  REAL_TRIAL_RUNTIME_IDENTITY_BINDING_VERSION,
  isSha256Digest,
  validateRealTrialRuntimeIdentityBinding,
  type RealTrialRuntimeIdentityBinding,
  type Sha256Digest,
} from './productRuntimeIdentity.schema.ts';

export const PRODUCT_RUNTIME_RELIABILITY_WP_R4_PREFLIGHT_POLICY_VERSION =
  'product_runtime_reliability_wp_r4_preflight_policy_v1' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PREFLIGHT_REPORT_V2_VERSION =
  'product_complexity_convergence_stage4_preflight_report_v2' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_LAUNCH_RECORD_V2_VERSION =
  'product_complexity_convergence_stage4_trial_launch_v2' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_AUDIT_V3_VERSION =
  'product_complexity_convergence_stage4_activation_audit_v3' as const;
export const PRODUCT_RUNTIME_RELIABILITY_WP_R4_PREFLIGHT_TTL_MS = 30 * 60 * 1000;

export const REAL_TRIAL_REENTRY_PREFLIGHT_CHECK_IDS = Array.from(
  { length: 24 },
  (_, index) => `R4-P${String(index + 1).padStart(2, '0')}`,
) as readonly string[];

export type RealTrialReentryPreflightCheckResult = {
  checkId: string;
  status: 'passed' | 'failed' | 'not_run';
  evidenceCodes: string[];
  issueCodes: string[];
};

export type RealTrialReentryPreflightReportV2 = {
  reportVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PREFLIGHT_REPORT_V2_VERSION;
  preflightPolicyVersion: typeof PRODUCT_RUNTIME_RELIABILITY_WP_R4_PREFLIGHT_POLICY_VERSION;
  reportId: string;
  trialWindowId: string;
  plannedLaunchRecordId: string;
  plannedRuntimeIdentityBindingId: string;
  runtimeIdentityVersion: typeof PRODUCT_RUNTIME_IDENTITY_VERSION;
  runtimeIdentityDigest: Sha256Digest;
  formalResourceSnapshotDigest: Sha256Digest;
  executablePolicyBundleDigest: Sha256Digest;
  trialPolicyBundleDigest: Sha256Digest;
  providerBoundaryDigest: Sha256Digest;
  gitCommit: string;
  worktreeState: 'clean' | 'dirty' | 'unknown';
  buildVersion: string;
  sourceRegistryVersion: string;
  sourcePolicySnapshotHash: string;
  observationPolicyVersion: string;
  decisionPolicyVersion: string;
  startedAt: string;
  completedAt: string;
  expiresAt: string;
  checkResults: RealTrialReentryPreflightCheckResult[];
  formalResourceWriteCount: number;
  sessionWriteCount: number;
  attemptWriteCount: number;
  evidenceWriteCount: number;
  profileWriteCount: number;
  realDenominatorWriteCount: number;
  trialObservationWriteCount: number;
  trialControlWriteCount: number;
  eligibleForActivation: boolean;
  issueCodes: string[];
};

export type RealTrialWindowLaunchRecordV2 = {
  launchRecordVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_LAUNCH_RECORD_V2_VERSION;
  launchRecordId: string;
  trialWindowId: string;
  status: 'approved_to_activate';
  preflightReportId: string;
  runtimeIdentityBindingId: string;
  runtimeIdentityDigest: Sha256Digest;
  gitCommit: string;
  buildVersion: string;
  startsAt: string;
  plannedEndsAt: string;
  timezone: string;
  participatingStudentIds: string[];
  observationPolicyVersion: string;
  decisionPolicyVersion: string;
  sourceRegistryVersion: string;
  sourcePolicySnapshotHash: string;
  enabledCapabilityModes: Record<ComplexityConvergenceCapability, string>;
  preflightCheckIds: string[];
  unresolvedIssues: [];
  recordedAt: string;
};

export type ConvergenceObservationActivationAuditV3 = {
  auditVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_AUDIT_V3_VERSION;
  auditId: string;
  action: 'activated';
  requestedMode: 'real_trial';
  effectiveMode: 'real_trial';
  trialWindowId: string;
  launchRecordId: string;
  runtimeIdentityBindingId: string;
  runtimeIdentityDigest: Sha256Digest;
  reasonCodes: ['real_trial_reentry_approved'];
  occurredAt: string;
};

export type RealTrialReentryApprovalBundle = {
  trialWindow: ComplexityConvergenceTrialWindow;
  preflightReport: RealTrialReentryPreflightReportV2;
  launchRecord: RealTrialWindowLaunchRecordV2;
  runtimeIdentityBinding: RealTrialRuntimeIdentityBinding;
};

export type RealTrialReentryApprovalBundleCommitResult = {
  status: 'committed' | 'duplicate';
  trialWindowId: string;
  preflightReportId: string;
  launchRecordId: string;
  runtimeIdentityBindingId: string;
};

export type RealTrialReentryAtomicActivation = {
  trialWindow: ComplexityConvergenceTrialWindow;
  activationState: ConvergenceObservationActivationStateV2;
  activationAudit: ConvergenceObservationActivationAuditV3;
};

export function buildRealTrialRuntimeIdentityBinding(input: {
  launchRecordId: string;
  trialWindowId: string;
  runtimeIdentityDigest: Sha256Digest;
  formalResourceSnapshotDigest: Sha256Digest;
  executablePolicyBundleDigest: Sha256Digest;
  trialPolicyBundleDigest: Sha256Digest;
  boundAt: string;
}): RealTrialRuntimeIdentityBinding {
  const bindingId = `trial-runtime-binding-${stableConvergenceHash(stableConvergenceSerialize({
    trialWindowId: input.trialWindowId,
    launchRecordId: input.launchRecordId,
    runtimeIdentityDigest: input.runtimeIdentityDigest,
  }))}`;
  return {
    bindingVersion: REAL_TRIAL_RUNTIME_IDENTITY_BINDING_VERSION,
    bindingId,
    runtimeIdentityVersion: PRODUCT_RUNTIME_IDENTITY_VERSION,
    ...input,
  };
}

export function validateRealTrialReentryPreflightReport(
  report: RealTrialReentryPreflightReportV2,
): string[] {
  const issues: string[] = [];
  if (report.reportVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PREFLIGHT_REPORT_V2_VERSION
    || report.preflightPolicyVersion !== PRODUCT_RUNTIME_RELIABILITY_WP_R4_PREFLIGHT_POLICY_VERSION) issues.push('preflight_version_invalid');
  if (![report.reportId, report.trialWindowId, report.plannedLaunchRecordId,
    report.plannedRuntimeIdentityBindingId, report.gitCommit, report.buildVersion,
    report.sourceRegistryVersion, report.sourcePolicySnapshotHash].every(nonEmpty)) issues.push('preflight_identity_invalid');
  if (report.runtimeIdentityVersion !== PRODUCT_RUNTIME_IDENTITY_VERSION
    || [report.runtimeIdentityDigest, report.formalResourceSnapshotDigest,
      report.executablePolicyBundleDigest, report.trialPolicyBundleDigest,
      report.providerBoundaryDigest].some((value) => !isSha256Digest(value))) issues.push('preflight_digest_invalid');
  if (report.worktreeState !== 'clean') issues.push('preflight_worktree_not_clean');
  if (report.observationPolicyVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION
    || report.decisionPolicyVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION) issues.push('preflight_policy_invalid');
  if (![report.startedAt, report.completedAt, report.expiresAt].every(timestamp)
    || Date.parse(report.completedAt) < Date.parse(report.startedAt)
    || Date.parse(report.expiresAt) <= Date.parse(report.completedAt)) issues.push('preflight_time_invalid');
  const ids = report.checkResults?.map((item) => item.checkId) || [];
  if (ids.length !== REAL_TRIAL_REENTRY_PREFLIGHT_CHECK_IDS.length
    || new Set(ids).size !== ids.length
    || REAL_TRIAL_REENTRY_PREFLIGHT_CHECK_IDS.some((id) => !ids.includes(id))) issues.push('preflight_checks_incomplete');
  report.checkResults?.forEach((item) => {
    if (!['passed', 'failed', 'not_run'].includes(item.status)
      || !stringArray(item.evidenceCodes) || !stringArray(item.issueCodes)) issues.push('preflight_check_invalid');
  });
  const writeCounts = [report.formalResourceWriteCount, report.sessionWriteCount,
    report.attemptWriteCount, report.evidenceWriteCount, report.profileWriteCount,
    report.realDenominatorWriteCount, report.trialObservationWriteCount,
    report.trialControlWriteCount];
  if (writeCounts.some((count) => !Number.isInteger(count) || count < 0)) issues.push('preflight_write_count_invalid');
  if (writeCounts.some((count) => count !== 0)) issues.push('trial_reentry_zero_write_violation');
  const allPassed = report.checkResults?.every((item) => item.status === 'passed') === true;
  if (report.eligibleForActivation !== (allPassed && report.issueCodes.length === 0
    && writeCounts.every((count) => count === 0))) issues.push('preflight_eligibility_inconsistent');
  if (!stringArray(report.issueCodes)) issues.push('preflight_issue_codes_invalid');
  return unique(issues);
}

export function validateRealTrialWindowLaunchRecordV2(record: RealTrialWindowLaunchRecordV2): string[] {
  const issues: string[] = [];
  if (record.launchRecordVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_LAUNCH_RECORD_V2_VERSION
    || record.status !== 'approved_to_activate') issues.push('launch_version_or_status_invalid');
  if (![record.launchRecordId, record.trialWindowId, record.preflightReportId,
    record.runtimeIdentityBindingId, record.gitCommit, record.buildVersion,
    record.timezone, record.sourceRegistryVersion, record.sourcePolicySnapshotHash].every(nonEmpty)) issues.push('launch_identity_invalid');
  if (!isSha256Digest(record.runtimeIdentityDigest)) issues.push('launch_runtime_identity_invalid');
  if (![record.startsAt, record.plannedEndsAt, record.recordedAt].every(timestamp)
    || Date.parse(record.plannedEndsAt) <= Date.parse(record.startsAt)) issues.push('launch_time_invalid');
  if (!stringArray(record.participatingStudentIds) || record.participatingStudentIds.length === 0) issues.push('launch_participants_invalid');
  if (record.observationPolicyVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION
    || record.decisionPolicyVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION) issues.push('launch_policy_invalid');
  if (record.preflightCheckIds.length !== REAL_TRIAL_REENTRY_PREFLIGHT_CHECK_IDS.length
    || new Set(record.preflightCheckIds).size !== record.preflightCheckIds.length
    || REAL_TRIAL_REENTRY_PREFLIGHT_CHECK_IDS.some((id) => !record.preflightCheckIds.includes(id))) issues.push('launch_preflight_checks_invalid');
  if (record.unresolvedIssues.length !== 0) issues.push('launch_unresolved_issues');
  return unique(issues);
}

export function validateRealTrialReentryApprovalBundle(bundle: RealTrialReentryApprovalBundle): string[] {
  const issues = [
    ...validateConvergenceTrialWindow(bundle.trialWindow),
    ...validateRealTrialReentryPreflightReport(bundle.preflightReport),
    ...validateRealTrialWindowLaunchRecordV2(bundle.launchRecord),
    ...validateRealTrialRuntimeIdentityBinding(bundle.runtimeIdentityBinding),
  ];
  const { trialWindow: window, preflightReport: report, launchRecord: launch,
    runtimeIdentityBinding: binding } = bundle;
  if (window.status !== 'draft') issues.push('trial_reentry_window_invalid');
  if (!report.eligibleForActivation || report.issueCodes.length > 0) issues.push('trial_reentry_preflight_failed');
  if (![report.trialWindowId, launch.trialWindowId, binding.trialWindowId]
    .every((value) => value === window.trialWindowId)) issues.push('trial_reentry_window_identity_mismatch');
  if (report.plannedLaunchRecordId !== launch.launchRecordId
    || report.plannedRuntimeIdentityBindingId !== binding.bindingId
    || launch.preflightReportId !== report.reportId
    || launch.runtimeIdentityBindingId !== binding.bindingId
    || binding.launchRecordId !== launch.launchRecordId) issues.push('trial_reentry_cross_reference_invalid');
  if (![report.runtimeIdentityDigest, launch.runtimeIdentityDigest, binding.runtimeIdentityDigest]
    .every((value) => value === report.runtimeIdentityDigest)) issues.push('trial_reentry_runtime_identity_changed');
  if (binding.formalResourceSnapshotDigest !== report.formalResourceSnapshotDigest) issues.push('trial_reentry_formal_snapshot_changed');
  if (binding.executablePolicyBundleDigest !== report.executablePolicyBundleDigest
    || binding.trialPolicyBundleDigest !== report.trialPolicyBundleDigest) issues.push('trial_reentry_policy_changed');
  if (stableConvergenceSerialize(window.participatingStudentIds)
      !== stableConvergenceSerialize(launch.participatingStudentIds)
    || window.startsAt !== launch.startsAt || window.plannedEndsAt !== launch.plannedEndsAt
    || window.sourceRegistryVersion !== launch.sourceRegistryVersion
    || window.sourcePolicySnapshotHash !== launch.sourcePolicySnapshotHash
    || stableConvergenceSerialize(window.enabledCapabilityModes)
      !== stableConvergenceSerialize(launch.enabledCapabilityModes)) issues.push('trial_reentry_launch_invalid');
  return unique(issues);
}

export function validateRealTrialReentryAtomicActivation(input: RealTrialReentryAtomicActivation): string[] {
  const issues = validateConvergenceTrialWindow(input.trialWindow);
  const { trialWindow: window, activationState: state, activationAudit: audit } = input;
  if (window.status !== 'active') issues.push('activation_window_not_active');
  if (state.activationStateVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_V2_VERSION
    || state.requestedMode !== 'real_trial' || state.effectiveMode !== 'real_trial') issues.push('activation_state_invalid');
  if (audit.auditVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_AUDIT_V3_VERSION
    || audit.action !== 'activated') issues.push('activation_audit_invalid');
  if (state.trialWindowId !== window.trialWindowId || audit.trialWindowId !== window.trialWindowId
    || state.launchRecordId !== audit.launchRecordId
    || state.runtimeIdentityBindingId !== audit.runtimeIdentityBindingId
    || state.activatedRuntimeIdentityDigest !== audit.runtimeIdentityDigest) issues.push('activation_identity_mismatch');
  if (state.activatedAt !== state.updatedAt || state.activatedAt !== audit.occurredAt) issues.push('activation_time_mismatch');
  return unique(issues);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function timestamp(value: unknown): value is string {
  return nonEmpty(value) && !Number.isNaN(Date.parse(value));
}
function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty);
}
function unique(values: string[]): string[] { return [...new Set(values)]; }
