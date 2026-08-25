import {
  CONVERGENCE_STAGE4_BENEFIT_CODES,
  CONVERGENCE_STAGE4_CAPABILITIES,
  CONVERGENCE_STAGE4_LIFECYCLE_STAGES,
  CONVERGENCE_STAGE4_OUTCOME_CODES,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION,
  stableConvergenceHash,
  stableConvergenceSerialize,
  type ComplexityConvergenceCapability,
  type ComplexityConvergenceExpectedBenefitCode,
  type ComplexityConvergenceLifecycleStage,
  type ComplexityConvergenceObservedOutcomeCode,
  type ComplexityConvergenceStage4ObservationMode,
  type ComplexityConvergenceTrialWindow,
} from './productComplexityConvergenceObservation.schema.ts';

export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_SOURCE_REGISTRY_ENTRY_VERSION =
  'product_complexity_convergence_stage4_source_registry_entry_v1' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_SOURCE_REGISTRY_VERSION =
  'product_complexity_convergence_stage4_source_registry_v1' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_VERSION =
  'product_complexity_convergence_stage4_activation_state_v1' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_LAUNCH_RECORD_VERSION =
  'product_complexity_convergence_stage4_trial_launch_v1' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PREFLIGHT_REPORT_VERSION =
  'product_complexity_convergence_stage4_preflight_report_v1' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_AUDIT_VERSION =
  'product_complexity_convergence_stage4_activation_audit_v1' as const;

export const CONVERGENCE_STAGE4_PREFLIGHT_CHECK_IDS = Array.from(
  { length: 18 },
  (_, index) => `RTW-S${String(index + 1).padStart(2, '0')}`,
) as readonly string[];

export type ConvergenceObservationSourceRegistryEntry = {
  registryEntryVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_SOURCE_REGISTRY_ENTRY_VERSION;
  capability: ComplexityConvergenceCapability;
  ownerDomain: string;
  ownerFactType: string;
  ownerSchemaVersions: string[];
  adapterVersion: string;
  expectedBenefitCode: ComplexityConvergenceExpectedBenefitCode;
  allowedLifecycleStages: ComplexityConvergenceLifecycleStage[];
  allowedOutcomeCodes: ComplexityConvergenceObservedOutcomeCode[];
  requiredIdentityFields: string[];
  enabledForIsolatedAcceptance: boolean;
  enabledForRealTrial: boolean;
};

export type ConvergenceObservationSourceRegistrySnapshot = {
  registryVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_SOURCE_REGISTRY_VERSION;
  sourceRegistryVersion: string;
  entries: ConvergenceObservationSourceRegistryEntry[];
  sourcePolicySnapshotHash: string;
  generatedAt: string;
};

export type RealTrialWindowLaunchRecord = {
  launchRecordVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_LAUNCH_RECORD_VERSION;
  launchRecordId: string;
  trialWindowId: string;
  status: 'approved_to_activate' | 'activation_cancelled';
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
  unresolvedIssues: string[];
  recordedAt: string;
};

export type RealTrialWindowPreflightCheckResult = {
  checkId: string;
  status: 'passed' | 'failed' | 'not_run';
  evidenceCodes: string[];
  issueCodes: string[];
};

export type RealTrialWindowPreflightReport = {
  reportVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PREFLIGHT_REPORT_VERSION;
  reportId: string;
  trialWindowId: string;
  gitCommit: string;
  buildVersion: string;
  startedAt: string;
  completedAt: string;
  checkResults: RealTrialWindowPreflightCheckResult[];
  formalResourceWriteCount: number;
  attemptWriteCount: number;
  evidenceWriteCount: number;
  profileWriteCount: number;
  realDenominatorWriteCount: number;
  eligibleForActivation: boolean;
};

export type ConvergenceObservationActivationState = {
  activationStateVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_VERSION;
  activationStateId: 'product-complexity-convergence-stage4-current';
  requestedMode: ComplexityConvergenceStage4ObservationMode;
  effectiveMode: ComplexityConvergenceStage4ObservationMode;
  trialWindowId?: string;
  launchRecordId?: string;
  registrySnapshotHash?: string;
  policySnapshotHash?: string;
  buildVersion?: string;
  activatedAt?: string;
  deactivatedAt?: string;
  reasonCodes: string[];
  updatedAt: string;
};

export type ConvergenceObservationActivationAudit = {
  auditVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_AUDIT_VERSION;
  auditId: string;
  action: 'requested' | 'approved' | 'activated' | 'deactivated' | 'rejected' | 'recovered_off';
  requestedMode: ComplexityConvergenceStage4ObservationMode;
  effectiveMode: ComplexityConvergenceStage4ObservationMode;
  trialWindowId?: string;
  launchRecordId?: string;
  reasonCodes: string[];
  occurredAt: string;
};

export function buildConvergenceSourceRegistrySnapshot(input: {
  sourceRegistryVersion?: string;
  entries: ConvergenceObservationSourceRegistryEntry[];
  generatedAt: string;
}): ConvergenceObservationSourceRegistrySnapshot {
  const entries = [...input.entries].sort((left, right) => left.capability.localeCompare(right.capability));
  const sourceRegistryVersion = input.sourceRegistryVersion
    || PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_SOURCE_REGISTRY_VERSION;
  return {
    registryVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_SOURCE_REGISTRY_VERSION,
    sourceRegistryVersion,
    entries,
    sourcePolicySnapshotHash: stableConvergenceHash({ sourceRegistryVersion, entries }),
    generatedAt: input.generatedAt,
  };
}

export function createDefaultConvergenceActivationState(now: string): ConvergenceObservationActivationState {
  return {
    activationStateVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_VERSION,
    activationStateId: 'product-complexity-convergence-stage4-current',
    requestedMode: 'off',
    effectiveMode: 'off',
    reasonCodes: ['default_off'],
    updatedAt: now,
  };
}

export function buildConvergenceActivationAudit(input: Omit<ConvergenceObservationActivationAudit,
  'auditVersion' | 'auditId'>): ConvergenceObservationActivationAudit {
  const identity = stableConvergenceSerialize(input);
  return {
    ...input,
    auditVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_AUDIT_VERSION,
    auditId: `convergence-activation-audit-${stableConvergenceHash(identity)}`,
  };
}

export function validateConvergenceSourceRegistryEntry(
  entry: ConvergenceObservationSourceRegistryEntry,
): string[] {
  const issues: string[] = [];
  if (entry.registryEntryVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_SOURCE_REGISTRY_ENTRY_VERSION) issues.push('registry_entry_version_invalid');
  if (!CONVERGENCE_STAGE4_CAPABILITIES.includes(entry.capability)) issues.push('capability_invalid');
  if (!nonEmpty(entry.ownerDomain) || !nonEmpty(entry.ownerFactType) || !nonEmpty(entry.adapterVersion)) issues.push('owner_identity_invalid');
  if (!stringArray(entry.ownerSchemaVersions) || entry.ownerSchemaVersions.length === 0) issues.push('owner_schema_versions_missing');
  if (!CONVERGENCE_STAGE4_BENEFIT_CODES.includes(entry.expectedBenefitCode)) issues.push('benefit_code_invalid');
  if (!Array.isArray(entry.allowedLifecycleStages) || entry.allowedLifecycleStages.length === 0
    || entry.allowedLifecycleStages.some((value) => !CONVERGENCE_STAGE4_LIFECYCLE_STAGES.includes(value))) issues.push('lifecycle_stages_invalid');
  if (!Array.isArray(entry.allowedOutcomeCodes) || entry.allowedOutcomeCodes.length === 0
    || entry.allowedOutcomeCodes.some((value) => !CONVERGENCE_STAGE4_OUTCOME_CODES.includes(value))) issues.push('outcome_codes_invalid');
  if (!stringArray(entry.requiredIdentityFields) || entry.requiredIdentityFields.length === 0) issues.push('required_identity_fields_missing');
  return unique(issues);
}

export function validateConvergenceSourceRegistrySnapshot(
  snapshot: ConvergenceObservationSourceRegistrySnapshot,
): string[] {
  const issues: string[] = [];
  if (snapshot.registryVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_SOURCE_REGISTRY_VERSION) issues.push('registry_version_invalid');
  if (!nonEmpty(snapshot.sourceRegistryVersion) || !timestamp(snapshot.generatedAt)) issues.push('registry_identity_invalid');
  if (!Array.isArray(snapshot.entries) || snapshot.entries.length !== CONVERGENCE_STAGE4_CAPABILITIES.length) issues.push('registry_capability_count_invalid');
  const capabilities = new Set(snapshot.entries?.map((entry) => entry.capability) || []);
  if (CONVERGENCE_STAGE4_CAPABILITIES.some((capability) => !capabilities.has(capability))) issues.push('registry_capability_missing');
  snapshot.entries?.forEach((entry) => issues.push(...validateConvergenceSourceRegistryEntry(entry)));
  const expectedHash = stableConvergenceHash({
    sourceRegistryVersion: snapshot.sourceRegistryVersion,
    entries: [...snapshot.entries].sort((left, right) => left.capability.localeCompare(right.capability)),
  });
  if (snapshot.sourcePolicySnapshotHash !== expectedHash) issues.push('registry_hash_invalid');
  return unique(issues);
}

export function validateRealTrialWindowLaunchRecord(record: RealTrialWindowLaunchRecord): string[] {
  const issues: string[] = [];
  if (record.launchRecordVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_LAUNCH_RECORD_VERSION) issues.push('launch_record_version_invalid');
  if (!nonEmpty(record.launchRecordId) || !nonEmpty(record.trialWindowId)) issues.push('launch_identity_invalid');
  if (!['approved_to_activate', 'activation_cancelled'].includes(record.status)) issues.push('launch_status_invalid');
  if (!nonEmpty(record.gitCommit) || !nonEmpty(record.buildVersion)) issues.push('build_identity_missing');
  if (!timestamp(record.startsAt) || !timestamp(record.plannedEndsAt) || !timestamp(record.recordedAt)) issues.push('launch_time_invalid');
  if (!nonEmpty(record.timezone) || !stringArray(record.participatingStudentIds)
    || record.participatingStudentIds.length === 0) issues.push('participant_scope_invalid');
  if (record.observationPolicyVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION
    || record.decisionPolicyVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION) issues.push('policy_version_invalid');
  if (!nonEmpty(record.sourceRegistryVersion) || !nonEmpty(record.sourcePolicySnapshotHash)) issues.push('source_snapshot_missing');
  if (!record.enabledCapabilityModes || CONVERGENCE_STAGE4_CAPABILITIES.some((capability) => !nonEmpty(record.enabledCapabilityModes[capability]))) issues.push('capability_modes_incomplete');
  if (!stringArray(record.preflightCheckIds) || CONVERGENCE_STAGE4_PREFLIGHT_CHECK_IDS.some((id) => !record.preflightCheckIds.includes(id))) issues.push('preflight_checks_incomplete');
  if (!Array.isArray(record.unresolvedIssues) || !record.unresolvedIssues.every(nonEmpty)) issues.push('unresolved_issues_invalid');
  if (record.status === 'approved_to_activate' && record.unresolvedIssues.length > 0) issues.push('approval_with_unresolved_issues');
  return unique(issues);
}

export function validateRealTrialWindowPreflightReport(report: RealTrialWindowPreflightReport): string[] {
  const issues: string[] = [];
  if (report.reportVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PREFLIGHT_REPORT_VERSION) issues.push('preflight_report_version_invalid');
  if (!nonEmpty(report.reportId) || !nonEmpty(report.trialWindowId)
    || !nonEmpty(report.gitCommit) || !nonEmpty(report.buildVersion)) issues.push('preflight_identity_invalid');
  if (!timestamp(report.startedAt) || !timestamp(report.completedAt)) issues.push('preflight_time_invalid');
  if (!Array.isArray(report.checkResults) || report.checkResults.length !== CONVERGENCE_STAGE4_PREFLIGHT_CHECK_IDS.length) issues.push('preflight_check_count_invalid');
  const byId = new Map(report.checkResults.map((result) => [result.checkId, result]));
  if (CONVERGENCE_STAGE4_PREFLIGHT_CHECK_IDS.some((id) => byId.get(id)?.status !== 'passed')) issues.push('preflight_checks_not_all_passed');
  report.checkResults.forEach((result) => {
    if (!['passed', 'failed', 'not_run'].includes(result.status)
      || !stringArray(result.evidenceCodes) || !Array.isArray(result.issueCodes)
      || !result.issueCodes.every(nonEmpty)) issues.push('preflight_check_result_invalid');
  });
  const writeCounts = [report.formalResourceWriteCount, report.attemptWriteCount,
    report.evidenceWriteCount, report.profileWriteCount, report.realDenominatorWriteCount];
  if (writeCounts.some((count) => !nonNegativeInteger(count))) issues.push('write_counts_invalid');
  const shouldBeEligible = !issues.includes('preflight_checks_not_all_passed') && writeCounts.every((count) => count === 0);
  if (report.eligibleForActivation !== shouldBeEligible) issues.push('activation_eligibility_inconsistent');
  return unique(issues);
}

export function validateConvergenceActivationState(state: ConvergenceObservationActivationState): string[] {
  const issues: string[] = [];
  if (state.activationStateVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_VERSION
    || state.activationStateId !== 'product-complexity-convergence-stage4-current') issues.push('activation_state_version_invalid');
  if (!['off', 'isolated_acceptance', 'real_trial'].includes(state.requestedMode)
    || !['off', 'isolated_acceptance', 'real_trial'].includes(state.effectiveMode)) issues.push('activation_mode_invalid');
  if (!stringArray(state.reasonCodes) || !timestamp(state.updatedAt)) issues.push('activation_state_metadata_invalid');
  if (state.effectiveMode === 'real_trial'
    && (!nonEmpty(state.trialWindowId) || !nonEmpty(state.launchRecordId)
      || !nonEmpty(state.registrySnapshotHash) || !nonEmpty(state.policySnapshotHash)
      || !nonEmpty(state.buildVersion) || !timestamp(state.activatedAt))) issues.push('real_trial_activation_incomplete');
  return unique(issues);
}

export function validateConvergenceActivationAudit(audit: ConvergenceObservationActivationAudit): string[] {
  const issues: string[] = [];
  if (audit.auditVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_AUDIT_VERSION
    || !nonEmpty(audit.auditId)) issues.push('activation_audit_identity_invalid');
  if (!['requested', 'approved', 'activated', 'deactivated', 'rejected', 'recovered_off'].includes(audit.action)) issues.push('activation_audit_action_invalid');
  if (!['off', 'isolated_acceptance', 'real_trial'].includes(audit.requestedMode)
    || !['off', 'isolated_acceptance', 'real_trial'].includes(audit.effectiveMode)) issues.push('activation_audit_mode_invalid');
  if (!stringArray(audit.reasonCodes) || !timestamp(audit.occurredAt)) issues.push('activation_audit_metadata_invalid');
  return unique(issues);
}

export function launchRecordMatchesWindow(
  record: RealTrialWindowLaunchRecord,
  window: ComplexityConvergenceTrialWindow,
): boolean {
  return record.status === 'approved_to_activate'
    && record.trialWindowId === window.trialWindowId
    && record.startsAt === window.startsAt
    && record.plannedEndsAt === window.plannedEndsAt
    && record.sourceRegistryVersion === window.sourceRegistryVersion
    && record.sourcePolicySnapshotHash === window.sourcePolicySnapshotHash
    && stableConvergenceSerialize(record.participatingStudentIds)
      === stableConvergenceSerialize(window.participatingStudentIds)
    && stableConvergenceSerialize(record.enabledCapabilityModes)
      === stableConvergenceSerialize(window.enabledCapabilityModes);
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
function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}
function unique(values: string[]): string[] { return [...new Set(values)]; }
