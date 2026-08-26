import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PREFLIGHT_REPORT_V2_VERSION,
  PRODUCT_RUNTIME_RELIABILITY_WP_R4_PREFLIGHT_POLICY_VERSION,
  PRODUCT_RUNTIME_RELIABILITY_WP_R4_PREFLIGHT_TTL_MS,
  REAL_TRIAL_REENTRY_PREFLIGHT_CHECK_IDS,
  type RealTrialReentryPreflightCheckResult,
  type RealTrialReentryPreflightReportV2,
} from '../schemas/productRuntimeTrialReentry.schema.ts';
import type { ProductRuntimeIdentity } from '../schemas/productRuntimeIdentity.schema.ts';
import { PRODUCT_RUNTIME_IDENTITY_VERSION, type Sha256Digest } from '../schemas/productRuntimeIdentity.schema.ts';
import { resolveProductRuntimeIdentityStatus } from './productRuntimeIdentityService.ts';
import { stableConvergenceHash, stableConvergenceSerialize } from
  '../schemas/productComplexityConvergenceObservation.schema.ts';

export type RealTrialReentryProtectedWriteCounts = {
  formalResourceWriteCount: number;
  sessionWriteCount: number;
  attemptWriteCount: number;
  evidenceWriteCount: number;
  profileWriteCount: number;
  realDenominatorWriteCount: number;
  trialObservationWriteCount: number;
  trialControlWriteCount: number;
};

export type RealTrialReentryPreflightSignals = {
  runtimeHealthReady: boolean;
  artifactIdentityAligned: boolean;
  formalSnapshotAligned: boolean;
  formalStoreReady: boolean;
  executablePolicyAligned: boolean;
  trialPolicyAligned: boolean;
  providerBoundaryAligned: boolean;
  providerReady: boolean;
  sourceRegistryAligned: boolean;
  ownerSchemasSupported: boolean;
  observationPolicyAligned: boolean;
  decisionPolicyAligned: boolean;
  learningRegressionPassed: boolean;
  workbenchRegressionPassed: boolean;
  activationStateOff: boolean;
  windowIdentityAvailable: boolean;
  historicalIsolationPassed: boolean;
  noActiveWindowConflict: boolean;
  unresolvedP0P1Count: number;
  idsUnique: boolean;
};

export function runRealTrialReentryPreflight(input: {
  trialWindowId: string;
  plannedLaunchRecordId: string;
  plannedRuntimeIdentityBindingId: string;
  runtimeIdentity?: ProductRuntimeIdentity;
  gitCommit: string;
  buildVersion: string;
  sourceRegistryVersion: string;
  sourcePolicySnapshotHash: string;
  observationPolicyVersion: string;
  decisionPolicyVersion: string;
  startedAt: string;
  completedAt: string;
  signals: RealTrialReentryPreflightSignals;
  writeCounts: RealTrialReentryProtectedWriteCounts;
}): RealTrialReentryPreflightReportV2 {
  const identityStatus = resolveProductRuntimeIdentityStatus(input.runtimeIdentity);
  const identity = input.runtimeIdentity;
  const missingDigest = `sha256:${'0'.repeat(64)}` as Sha256Digest;
  const expiresAt = new Date(Date.parse(input.completedAt)
    + PRODUCT_RUNTIME_RELIABILITY_WP_R4_PREFLIGHT_TTL_MS).toISOString();
  const zeroWrite = Object.values(input.writeCounts).every((value) => value === 0);
  const checks = [
    check('R4-P01', input.signals.runtimeHealthReady, 'runtime_ready', 'trial_reentry_runtime_not_ready'),
    check('R4-P02', Boolean(identity), 'runtime_identity_present', 'runtime_identity_missing'),
    check('R4-P03', identityStatus.status === 'available' || identityStatus.status === 'dirty',
      'runtime_identity_valid', identityStatus.issueCodes[0] || 'runtime_identity_invalid'),
    check('R4-P04', identityStatus.status === 'available', 'runtime_identity_clean', 'trial_reentry_runtime_identity_not_clean'),
    check('R4-P05', input.signals.artifactIdentityAligned, 'artifact_identity_aligned', 'runtime_artifact_identity_mismatch'),
    check('R4-P06', input.signals.formalSnapshotAligned, 'formal_snapshot_aligned', 'trial_reentry_formal_snapshot_changed'),
    check('R4-P07', input.signals.formalStoreReady, 'formal_store_ready', 'formal_store_not_ready'),
    check('R4-P08', input.signals.executablePolicyAligned, 'executable_policy_aligned', 'trial_reentry_policy_changed'),
    check('R4-P09', input.signals.trialPolicyAligned, 'trial_policy_aligned', 'trial_reentry_policy_changed'),
    check('R4-P10', input.signals.providerBoundaryAligned, 'provider_boundary_aligned', 'provider_boundary_mismatch'),
    check('R4-P11', input.signals.providerReady, 'provider_ready', 'trial_reentry_provider_unavailable'),
    check('R4-P12', input.signals.sourceRegistryAligned, 'source_registry_aligned', 'source_registry_mismatch'),
    check('R4-P13', input.signals.ownerSchemasSupported, 'owner_schemas_supported', 'owner_schema_unsupported'),
    check('R4-P14', input.signals.observationPolicyAligned, 'observation_policy_aligned', 'trial_reentry_policy_changed'),
    check('R4-P15', input.signals.decisionPolicyAligned, 'decision_policy_aligned', 'trial_reentry_policy_changed'),
    check('R4-P16', input.signals.learningRegressionPassed, 'learning_regression_passed', 'learning_regression_failed'),
    check('R4-P17', input.signals.workbenchRegressionPassed, 'workbench_regression_passed', 'workbench_regression_failed'),
    check('R4-P18', input.signals.activationStateOff, 'trial_state_off', 'trial_reentry_activation_conflict'),
    check('R4-P19', input.signals.windowIdentityAvailable, 'window_identity_available', 'trial_reentry_window_invalid'),
    check('R4-P20', input.signals.historicalIsolationPassed, 'historical_isolation_passed', 'trial_history_reuse_forbidden'),
    check('R4-P21', input.signals.noActiveWindowConflict, 'no_active_window_conflict', 'trial_reentry_window_conflict'),
    check('R4-P22', input.signals.unresolvedP0P1Count === 0, 'no_unresolved_p0_p1', 'trial_reentry_unresolved_critical_risk'),
    check('R4-P23', zeroWrite, 'protected_write_counts_zero', 'trial_reentry_zero_write_violation'),
    check('R4-P24', input.signals.idsUnique && Date.parse(expiresAt) > Date.parse(input.completedAt),
      'preflight_complete_and_current', 'trial_reentry_preflight_incomplete'),
  ];
  const issueCodes = [...new Set(checks.flatMap((item) => item.issueCodes))];
  const eligibleForActivation = Boolean(identity)
    && checks.every((item) => item.status === 'passed') && issueCodes.length === 0;
  const facts = {
    trialWindowId: input.trialWindowId,
    plannedLaunchRecordId: input.plannedLaunchRecordId,
    plannedRuntimeIdentityBindingId: input.plannedRuntimeIdentityBindingId,
    runtimeIdentityDigest: identity?.runtimeIdentityDigest,
    completedAt: input.completedAt,
    checkResults: checks,
  };
  return {
    reportVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PREFLIGHT_REPORT_V2_VERSION,
    preflightPolicyVersion: PRODUCT_RUNTIME_RELIABILITY_WP_R4_PREFLIGHT_POLICY_VERSION,
    reportId: `trial-reentry-preflight-${stableConvergenceHash(stableConvergenceSerialize(facts))}`,
    trialWindowId: input.trialWindowId,
    plannedLaunchRecordId: input.plannedLaunchRecordId,
    plannedRuntimeIdentityBindingId: input.plannedRuntimeIdentityBindingId,
    runtimeIdentityVersion: identity?.runtimeIdentityVersion || PRODUCT_RUNTIME_IDENTITY_VERSION,
    runtimeIdentityDigest: identity?.runtimeIdentityDigest || missingDigest,
    formalResourceSnapshotDigest: identity?.identityInputs.formalResourceSnapshotDigest || missingDigest,
    executablePolicyBundleDigest: identity?.identityInputs.executablePolicyBundleDigest || missingDigest,
    trialPolicyBundleDigest: identity?.identityInputs.trialPolicyBundleDigest || missingDigest,
    providerBoundaryDigest: identity?.identityInputs.providerBoundaryDigest || missingDigest,
    gitCommit: input.gitCommit,
    worktreeState: identity?.evidence.worktreeState || 'unknown',
    buildVersion: input.buildVersion,
    sourceRegistryVersion: input.sourceRegistryVersion,
    sourcePolicySnapshotHash: input.sourcePolicySnapshotHash,
    observationPolicyVersion: input.observationPolicyVersion,
    decisionPolicyVersion: input.decisionPolicyVersion,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    expiresAt,
    checkResults: checks,
    ...input.writeCounts,
    eligibleForActivation,
    issueCodes,
  };
}

function check(
  checkId: string,
  passed: boolean,
  evidenceCode: string,
  issueCode: string,
): RealTrialReentryPreflightCheckResult {
  return { checkId, status: passed ? 'passed' : 'failed',
    evidenceCodes: passed ? [evidenceCode] : [], issueCodes: passed ? [] : [issueCode] };
}

export function emptyRealTrialReentryWriteCounts(): RealTrialReentryProtectedWriteCounts {
  return { formalResourceWriteCount: 0, sessionWriteCount: 0, attemptWriteCount: 0,
    evidenceWriteCount: 0, profileWriteCount: 0, realDenominatorWriteCount: 0,
    trialObservationWriteCount: 0, trialControlWriteCount: 0 };
}

export function allPassingRealTrialReentrySignals(): RealTrialReentryPreflightSignals {
  return { runtimeHealthReady: true, artifactIdentityAligned: true, formalSnapshotAligned: true,
    formalStoreReady: true, executablePolicyAligned: true, trialPolicyAligned: true,
    providerBoundaryAligned: true, providerReady: true, sourceRegistryAligned: true,
    ownerSchemasSupported: true, observationPolicyAligned: true, decisionPolicyAligned: true,
    learningRegressionPassed: true, workbenchRegressionPassed: true, activationStateOff: true,
    windowIdentityAvailable: true, historicalIsolationPassed: true, noActiveWindowConflict: true,
    unresolvedP0P1Count: 0, idsUnique: true };
}

export function preflightCheckIdsAreFrozen(report: RealTrialReentryPreflightReportV2): boolean {
  return REAL_TRIAL_REENTRY_PREFLIGHT_CHECK_IDS.every((id) =>
    report.checkResults.some((result) => result.checkId === id));
}
