import type { ProductComplexityConvergenceObservationRepository } from
  '../repositories/productComplexityConvergenceObservationRepository.ts';
import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_AUDIT_V3_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_LAUNCH_RECORD_V2_VERSION,
  REAL_TRIAL_REENTRY_PREFLIGHT_CHECK_IDS,
  buildRealTrialRuntimeIdentityBinding,
  validateRealTrialReentryApprovalBundle,
  validateRealTrialReentryPreflightReport,
  validateRealTrialWindowLaunchRecordV2,
  type ConvergenceObservationActivationAuditV3,
  type RealTrialReentryApprovalBundle,
  type RealTrialReentryApprovalBundleCommitResult,
  type RealTrialReentryPreflightReportV2,
  type RealTrialWindowLaunchRecordV2,
} from '../schemas/productRuntimeTrialReentry.schema.ts';
import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_V2_VERSION,
  type ConvergenceObservationActivationStateV2,
} from '../schemas/productComplexityConvergenceTrialPreflight.schema.ts';
import {
  stableConvergenceHash,
  stableConvergenceSerialize,
  type ComplexityConvergenceTrialWindow,
} from '../schemas/productComplexityConvergenceObservation.schema.ts';
import type { ProductRuntimeIdentity, RealTrialRuntimeIdentityBinding, Sha256Digest } from
  '../schemas/productRuntimeIdentity.schema.ts';
import { compareTrialRuntimeIdentity, resolveProductRuntimeIdentityStatus } from
  './productRuntimeIdentityService.ts';
import { applyProductRuntimeTrialInvalidation } from './productRuntimeTrialIdentityService.ts';

export type RealTrialReentryActivationResult = {
  status: 'activated' | 'already_activated' | 'rejected';
  effectiveMode: 'off' | 'real_trial';
  reasonCodes: string[];
};

export function planRealTrialReentryIdentities(input: {
  trialWindowId: string;
  runtimeIdentity: ProductRuntimeIdentity;
}): { launchRecordId: string; runtimeIdentityBindingId: string } {
  const launchRecordId = `trial-reentry-launch-${stableConvergenceHash(stableConvergenceSerialize({
    trialWindowId: input.trialWindowId,
    runtimeIdentityDigest: input.runtimeIdentity.runtimeIdentityDigest,
  }))}`;
  const binding = buildRealTrialRuntimeIdentityBinding({
    launchRecordId,
    trialWindowId: input.trialWindowId,
    runtimeIdentityDigest: input.runtimeIdentity.runtimeIdentityDigest,
    formalResourceSnapshotDigest: input.runtimeIdentity.identityInputs.formalResourceSnapshotDigest,
    executablePolicyBundleDigest: input.runtimeIdentity.identityInputs.executablePolicyBundleDigest,
    trialPolicyBundleDigest: input.runtimeIdentity.identityInputs.trialPolicyBundleDigest,
    boundAt: input.runtimeIdentity.evidence.generatedAt,
  });
  return { launchRecordId, runtimeIdentityBindingId: binding.bindingId };
}

export function buildRealTrialReentryApprovalBundle(input: {
  trialWindow: ComplexityConvergenceTrialWindow;
  preflightReport: RealTrialReentryPreflightReportV2;
  runtimeIdentity: ProductRuntimeIdentity;
  timezone: string;
  recordedAt: string;
}): RealTrialReentryApprovalBundle {
  const report = input.preflightReport;
  const binding = buildRealTrialRuntimeIdentityBinding({
    launchRecordId: report.plannedLaunchRecordId,
    trialWindowId: input.trialWindow.trialWindowId,
    runtimeIdentityDigest: input.runtimeIdentity.runtimeIdentityDigest,
    formalResourceSnapshotDigest: input.runtimeIdentity.identityInputs.formalResourceSnapshotDigest,
    executablePolicyBundleDigest: input.runtimeIdentity.identityInputs.executablePolicyBundleDigest,
    trialPolicyBundleDigest: input.runtimeIdentity.identityInputs.trialPolicyBundleDigest,
    boundAt: input.recordedAt,
  });
  const launchRecord: RealTrialWindowLaunchRecordV2 = {
    launchRecordVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_LAUNCH_RECORD_V2_VERSION,
    launchRecordId: report.plannedLaunchRecordId,
    trialWindowId: input.trialWindow.trialWindowId,
    status: 'approved_to_activate',
    preflightReportId: report.reportId,
    runtimeIdentityBindingId: binding.bindingId,
    runtimeIdentityDigest: input.runtimeIdentity.runtimeIdentityDigest,
    gitCommit: report.gitCommit,
    buildVersion: report.buildVersion,
    startsAt: input.trialWindow.startsAt,
    plannedEndsAt: input.trialWindow.plannedEndsAt,
    timezone: input.timezone,
    participatingStudentIds: [...input.trialWindow.participatingStudentIds],
    observationPolicyVersion: input.trialWindow.observationPolicyVersion,
    decisionPolicyVersion: input.trialWindow.decisionPolicyVersion,
    sourceRegistryVersion: input.trialWindow.sourceRegistryVersion,
    sourcePolicySnapshotHash: input.trialWindow.sourcePolicySnapshotHash,
    enabledCapabilityModes: structuredClone(input.trialWindow.enabledCapabilityModes),
    preflightCheckIds: [...REAL_TRIAL_REENTRY_PREFLIGHT_CHECK_IDS],
    unresolvedIssues: [],
    recordedAt: input.recordedAt,
  };
  return { trialWindow: structuredClone(input.trialWindow), preflightReport: structuredClone(report),
    launchRecord, runtimeIdentityBinding: binding };
}

export async function commitRealTrialReentryApprovalBundle(input: {
  repository: ProductComplexityConvergenceObservationRepository;
  bundle: RealTrialReentryApprovalBundle;
  currentIdentity?: ProductRuntimeIdentity;
  now: string;
}): Promise<RealTrialReentryApprovalBundleCommitResult> {
  const issues = validateRealTrialReentryApprovalBundle(input.bundle);
  if (issues.length) throw new Error(`trial_reentry_bundle_invalid:${issues.join(',')}`);
  const identity = compareTrialRuntimeIdentity({ currentIdentity: input.currentIdentity,
    binding: input.bundle.runtimeIdentityBinding });
  if (identity.alignment !== 'aligned') throw new Error(`trial_reentry_runtime_identity_changed:${identity.reasonCodes.join(',')}`);
  if (Date.parse(input.bundle.preflightReport.expiresAt) <= Date.parse(input.now)) {
    throw new Error('trial_reentry_preflight_expired');
  }
  return input.repository.commitRealTrialReentryApprovalBundle(input.bundle);
}

export async function activateRealTrialReentry(input: {
  repository: ProductComplexityConvergenceObservationRepository;
  launchRecordId: string;
  currentIdentity?: ProductRuntimeIdentity;
  runtimeHealthReady: boolean;
  providerReady: boolean;
  currentProviderBoundaryDigest?: Sha256Digest;
  currentSourceRegistryVersion: string;
  currentSourcePolicySnapshotHash: string;
  currentObservationPolicyVersion: string;
  currentDecisionPolicyVersion: string;
  protectedWritesSincePreflight: number;
  explicitOperatorConfirmation: boolean;
  now: string;
}): Promise<RealTrialReentryActivationResult> {
  if (!input.explicitOperatorConfirmation) return rejected('trial_reentry_explicit_confirmation_required');
  const launch = await input.repository.getRealTrialReentryLaunchRecord(input.launchRecordId);
  if (!launch) return rejected('trial_reentry_launch_invalid');
  const [window, report, binding, state, windows] = await Promise.all([
    input.repository.getTrialWindow(launch.trialWindowId),
    input.repository.getRealTrialReentryPreflightReport(launch.preflightReportId),
    input.repository.getRealTrialRuntimeIdentityBinding(launch.runtimeIdentityBindingId),
    input.repository.getActivationState(),
    input.repository.listTrialWindows(),
  ]);
  if (state?.effectiveMode === 'real_trial' && state.launchRecordId === launch.launchRecordId
    && state.trialWindowId === launch.trialWindowId) return {
    status: 'already_activated', effectiveMode: 'real_trial', reasonCodes: ['trial_reentry_approved'],
  };
  const reasons: string[] = [];
  if (!input.runtimeHealthReady) reasons.push('trial_reentry_runtime_not_ready');
  const runtimeStatus = resolveProductRuntimeIdentityStatus(input.currentIdentity);
  if (runtimeStatus.status !== 'available') reasons.push(...runtimeStatus.issueCodes);
  if (!window || window.status !== 'draft') reasons.push('trial_reentry_window_invalid');
  if (!report || validateRealTrialReentryPreflightReport(report).length
    || !report?.eligibleForActivation) reasons.push('trial_reentry_preflight_failed');
  if (report && Date.parse(report.expiresAt) <= Date.parse(input.now)) reasons.push('trial_reentry_preflight_expired');
  if (!binding) reasons.push('trial_reentry_binding_invalid');
  if (validateRealTrialWindowLaunchRecordV2(launch).length) reasons.push('trial_reentry_launch_invalid');
  if (binding) {
    const comparison = compareTrialRuntimeIdentity({ currentIdentity: input.currentIdentity, binding });
    if (comparison.alignment !== 'aligned') reasons.push('trial_reentry_runtime_identity_changed');
  }
  if (!input.providerReady || !report
    || input.currentProviderBoundaryDigest !== report.providerBoundaryDigest) reasons.push('trial_reentry_provider_unavailable');
  if (state && (state.requestedMode !== 'off' || state.effectiveMode !== 'off')) reasons.push('trial_reentry_activation_conflict');
  if (windows.some((item) => item.status === 'active' && item.trialWindowId !== launch.trialWindowId)) {
    reasons.push('trial_reentry_window_conflict');
  }
  if (input.protectedWritesSincePreflight !== 0) reasons.push('trial_reentry_zero_write_violation');
  if (report && (report.sourceRegistryVersion !== input.currentSourceRegistryVersion
    || report.sourcePolicySnapshotHash !== input.currentSourcePolicySnapshotHash
    || report.observationPolicyVersion !== input.currentObservationPolicyVersion
    || report.decisionPolicyVersion !== input.currentDecisionPolicyVersion)) reasons.push('trial_reentry_policy_changed');
  if (window && launch && stableConvergenceSerialize(window.participatingStudentIds)
    !== stableConvergenceSerialize(launch.participatingStudentIds)) reasons.push('trial_reentry_launch_invalid');
  if (reasons.length) return rejected(...reasons);
  const activatedWindow: ComplexityConvergenceTrialWindow = { ...window!, status: 'active' };
  const activationState: ConvergenceObservationActivationStateV2 = {
    activationStateVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_V2_VERSION,
    activationStateId: 'product-complexity-convergence-stage4-current',
    requestedMode: 'real_trial', effectiveMode: 'real_trial',
    trialWindowId: window!.trialWindowId, launchRecordId: launch.launchRecordId,
    runtimeIdentityBindingId: binding!.bindingId,
    activatedRuntimeIdentityDigest: input.currentIdentity!.runtimeIdentityDigest,
    registrySnapshotHash: report!.sourcePolicySnapshotHash,
    policySnapshotHash: input.currentIdentity!.identityInputs.trialPolicyBundleDigest,
    buildVersion: launch.buildVersion, activatedAt: input.now,
    reasonCodes: ['real_trial_reentry_approved'], updatedAt: input.now,
  };
  const audit = buildActivationAudit({ window: activatedWindow, launch, binding: binding!,
    runtimeIdentityDigest: input.currentIdentity!.runtimeIdentityDigest, now: input.now });
  try {
    const status = await input.repository.activateRealTrialReentryAtomically({
      trialWindow: activatedWindow, activationState, activationAudit: audit,
    });
    const [confirmedWindow, confirmedState, confirmedAudits] = await Promise.all([
      input.repository.getTrialWindow(window!.trialWindowId),
      input.repository.getActivationState(),
      input.repository.listRealTrialReentryActivationAudits(window!.trialWindowId),
    ]);
    const confirmed = confirmedWindow?.status === 'active'
      && confirmedState?.effectiveMode === 'real_trial'
      && confirmedState.launchRecordId === launch.launchRecordId
      && confirmedAudits.some((item) => item.auditId === audit.auditId);
    if (!confirmed) {
      await applyProductRuntimeTrialInvalidation({ repository: input.repository,
        currentIdentity: undefined, binding, now: input.now });
      return rejected('trial_reentry_activation_confirmation_failed');
    }
    return { status, effectiveMode: 'real_trial', reasonCodes: ['trial_reentry_approved'] };
  } catch {
    return rejected('trial_reentry_activation_commit_failed');
  }
}

function buildActivationAudit(input: {
  window: ComplexityConvergenceTrialWindow;
  launch: RealTrialWindowLaunchRecordV2;
  binding: RealTrialRuntimeIdentityBinding;
  runtimeIdentityDigest: Sha256Digest;
  now: string;
}): ConvergenceObservationActivationAuditV3 {
  const facts = { action: 'activated' as const, requestedMode: 'real_trial' as const,
    effectiveMode: 'real_trial' as const, trialWindowId: input.window.trialWindowId,
    launchRecordId: input.launch.launchRecordId, runtimeIdentityBindingId: input.binding.bindingId,
    runtimeIdentityDigest: input.runtimeIdentityDigest,
    reasonCodes: ['real_trial_reentry_approved'] as ['real_trial_reentry_approved'], occurredAt: input.now };
  return { auditVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_AUDIT_V3_VERSION,
    auditId: `trial-reentry-activation-${stableConvergenceHash(stableConvergenceSerialize(facts))}`,
    ...facts };
}

function rejected(...reasonCodes: string[]): RealTrialReentryActivationResult {
  return { status: 'rejected', effectiveMode: 'off', reasonCodes: [...new Set(reasonCodes)] };
}
