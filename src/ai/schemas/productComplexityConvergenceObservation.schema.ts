export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_EVENT_SCHEMA_VERSION =
  'product_complexity_convergence_stage4_observation_event_v1' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_WINDOW_SCHEMA_VERSION =
  'product_complexity_convergence_stage4_trial_window_v1' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_AGGREGATE_SCHEMA_VERSION =
  'product_complexity_convergence_stage4_aggregate_snapshot_v1' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PROPOSAL_SCHEMA_VERSION =
  'product_complexity_convergence_stage4_decision_proposal_v1' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION =
  'product_complexity_convergence_stage4_observation_policy_v1' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION =
  'product_complexity_convergence_stage4_decision_policy_v1' as const;

export const CONVERGENCE_STAGE4_CAPABILITIES = [
  'revision',
  'targeted_micro_training',
  'retest',
  'transfer',
  'successor_governance',
  'calibration_review',
  'feedback_projection',
  'core_ability_summary',
] as const;
export type ComplexityConvergenceCapability = typeof CONVERGENCE_STAGE4_CAPABILITIES[number];

export const CONVERGENCE_STAGE4_BENEFIT_CODES = [
  'resolve_revision_gap',
  'isolate_atomic_gap',
  'verify_independent_retention',
  'verify_transfer',
  'repair_resource_risk',
  'review_calibration_evidence',
  'clarify_primary_feedback_focus',
  'summarize_stable_profile',
] as const;
export type ComplexityConvergenceExpectedBenefitCode =
  typeof CONVERGENCE_STAGE4_BENEFIT_CODES[number];

export const CONVERGENCE_STAGE4_DATA_ORIGINS = [
  'real_learning',
  'internal_acceptance',
  'fixture',
  'demo',
  'debug',
  'browser_acceptance',
  'legacy_unobserved',
] as const;
export type ConvergenceObservationDataOrigin = typeof CONVERGENCE_STAGE4_DATA_ORIGINS[number];

export const CONVERGENCE_STAGE4_LIFECYCLE_STAGES = [
  'eligible', 'not_triggered', 'triggered', 'completed', 'interrupted', 'fallback',
  'follow_up_observed',
] as const;
export type ComplexityConvergenceLifecycleStage = typeof CONVERGENCE_STAGE4_LIFECYCLE_STAGES[number];

export const CONVERGENCE_STAGE4_OUTCOME_CODES = [
  'eligible_not_triggered',
  'triggered_pending',
  'completed_without_outcome',
  'revision_gap_resolved_supported',
  'revision_gap_partially_resolved_supported',
  'revision_gap_unresolved',
  'targeted_gap_resolved_supported',
  'targeted_gap_unresolved',
  'retest_independent_retained',
  'retest_independent_not_retained',
  'transfer_independent_succeeded',
  'transfer_independent_not_succeeded',
  'resource_risk_repaired',
  'resource_risk_unresolved',
  'calibration_review_completed',
  'feedback_action_followed',
  'feedback_projection_fallback',
  'profile_summary_available',
  'profile_summary_insufficient_evidence',
  'runtime_interrupted',
  'integrity_blocked',
  'observation_unavailable',
] as const;
export type ComplexityConvergenceObservedOutcomeCode =
  typeof CONVERGENCE_STAGE4_OUTCOME_CODES[number];

export const CONVERGENCE_STAGE4_SAMPLE_STATUSES = [
  'no_opportunity', 'collecting', 'insufficient_sample', 'review_ready', 'integrity_blocked',
] as const;
export type ComplexityConvergenceSampleStatus = typeof CONVERGENCE_STAGE4_SAMPLE_STATUSES[number];

export const CONVERGENCE_STAGE4_MAINTENANCE_BANDS = [
  'low', 'moderate', 'high', 'not_available',
] as const;
export type ComplexityConvergenceMaintenanceBand = typeof CONVERGENCE_STAGE4_MAINTENANCE_BANDS[number];

export const CONVERGENCE_STAGE4_DECISIONS = [
  'retain_core',
  'retain_conditional',
  'optimize_policy',
  'default_disable_candidate',
  'deprecation_candidate',
  'insufficient_evidence',
] as const;
export type ComplexityConvergenceCapabilityDecision = typeof CONVERGENCE_STAGE4_DECISIONS[number];

export const CONVERGENCE_STAGE4_DECISION_REASON_CODES = [
  'high_frequency_clear_benefit',
  'low_frequency_critical_benefit',
  'high_frequency_limited_benefit',
  'low_frequency_limited_benefit',
  'low_frequency_no_observed_benefit_high_maintenance',
  'sample_insufficient',
  'no_trigger_opportunity',
  'data_integrity_blocked',
  'benefit_requires_independent_validation',
  'maintenance_cost_unavailable',
] as const;
export type ComplexityConvergenceDecisionReasonCode =
  typeof CONVERGENCE_STAGE4_DECISION_REASON_CODES[number];

export type ComplexityConvergenceStage4ObservationMode =
  | 'off'
  | 'isolated_acceptance'
  | 'real_trial';

export type ComplexityConvergenceObservationEvent = {
  schemaVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_EVENT_SCHEMA_VERSION;
  observationPolicyVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION;
  eventId: string;
  eventHash: string;
  persistenceRole: 'append_only_observation';
  capability: ComplexityConvergenceCapability;
  expectedBenefitCode: ComplexityConvergenceExpectedBenefitCode;
  studentId: string;
  learningSessionId?: string;
  learningRoundId?: string;
  learningTaskAttemptId?: string;
  sourceDecisionId?: string;
  sourceResultId?: string;
  sourceEvidenceIds: string[];
  sourceSchemaVersions: string[];
  dataOrigin: ConvergenceObservationDataOrigin;
  runtimeScope: 'product' | 'internal';
  lifecycleStage: ComplexityConvergenceLifecycleStage;
  outcomeCode: ComplexityConvergenceObservedOutcomeCode;
  occurredAt: string;
  trialWindowId: string;
  validation: {
    passed: boolean;
    identityAligned: boolean;
    sourceFactValidated: boolean;
    dataOriginAdmitted: boolean;
    noStudentContentStored: boolean;
    issues: string[];
  };
};

export type ComplexityConvergenceTrialWindow = {
  schemaVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_WINDOW_SCHEMA_VERSION;
  trialWindowId: string;
  observationPolicyVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION;
  decisionPolicyVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION;
  status: 'draft' | 'active' | 'closed' | 'invalidated';
  startsAt: string;
  plannedEndsAt: string;
  closedAt?: string;
  participatingStudentIds: string[];
  enabledCapabilityModes: Record<ComplexityConvergenceCapability, string>;
  sourceRegistryVersion: string;
  sourcePolicySnapshotHash: string;
  invalidationReasons: string[];
};

export type ComplexityConvergenceRatio = {
  numerator: number;
  denominator: number;
  value: number | 'not_available';
};

export type ComplexityConvergenceCapabilityAggregate = {
  capability: ComplexityConvergenceCapability;
  expectedBenefitCode: ComplexityConvergenceExpectedBenefitCode;
  eligibleCount: number;
  notTriggeredCount: number;
  triggeredCount: number;
  completedCount: number;
  interruptedCount: number;
  fallbackCount: number;
  benefitObservedCount: number;
  benefitNotObservedCount: number;
  integrityBlockedCount: number;
  recoveryCount: number;
  distinctSessionCount: number;
  distinctActiveDayCount: number;
  firstObservedAt?: string;
  lastObservedAt?: string;
  triggerRate: ComplexityConvergenceRatio;
  completionRate: ComplexityConvergenceRatio;
  interruptionRate: ComplexityConvergenceRatio;
  fallbackRate: ComplexityConvergenceRatio;
  benefitObservedRate: ComplexityConvergenceRatio;
  integrityBlockedRate: ComplexityConvergenceRatio;
  sampleStatus: ComplexityConvergenceSampleStatus;
};

export type ComplexityConvergenceAggregateSnapshot = {
  schemaVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_AGGREGATE_SCHEMA_VERSION;
  observationPolicyVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION;
  snapshotId: string;
  snapshotHash: string;
  persistenceRole: 'rebuildable_read_model';
  trialWindowId: string;
  generatedAt: string;
  windowStartsAt: string;
  windowEndsAt: string;
  sourceEventIds: string[];
  admittedEventCount: number;
  excludedOriginCounts: Partial<Record<ConvergenceObservationDataOrigin, number>>;
  sourceSchemaVersionCounts: Record<string, number>;
  aggregates: ComplexityConvergenceCapabilityAggregate[];
  integrityIssues: string[];
};

export type ComplexityConvergenceMaintenanceFacts = {
  identityMismatchCount: number;
  integrityBlockCount: number;
  recoveryCount: number;
  duplicateConflictCount: number;
  fallbackCount: number;
  interruptionCount: number;
  manualRecoveryCount: number;
  policyFallbackCount: number;
  compatibilityErrorCount: number;
};

export type ComplexityConvergenceDecisionProposal = {
  schemaVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PROPOSAL_SCHEMA_VERSION;
  decisionPolicyVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION;
  proposalId: string;
  capability: ComplexityConvergenceCapability;
  trialWindowId: string;
  expectedBenefitCode: ComplexityConvergenceExpectedBenefitCode;
  sampleStatus: ComplexityConvergenceSampleStatus;
  aggregateSnapshotId: string;
  maintenanceBand: ComplexityConvergenceMaintenanceBand;
  proposedDecision: ComplexityConvergenceCapabilityDecision;
  decisionReasonCodes: ComplexityConvergenceDecisionReasonCode[];
  limitations: string[];
  generatedAt: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'superseded';
};

const FORBIDDEN_CONTENT_KEYS = [
  'studentAnswer', 'studentResponse', 'revisedAnswer', 'materialText', 'questionText',
  'modelOutput', 'rawOutput', 'feedbackText', 'freeText',
] as const;

export function buildConvergenceObservationIdentity(input: {
  capability: ComplexityConvergenceCapability;
  lifecycleStage: ComplexityConvergenceLifecycleStage;
  sourceDecisionId?: string;
  sourceResultId?: string;
  studentId: string;
  learningSessionId?: string;
  learningRoundId?: string;
  learningTaskAttemptId?: string;
  stableInput: unknown;
}): { eventId: string; eventHash: string } {
  const identity = stableSerialize({
    capability: input.capability,
    lifecycleStage: input.lifecycleStage,
    sourceDecisionId: input.sourceDecisionId || null,
    sourceResultId: input.sourceResultId || null,
    studentId: input.studentId,
    learningSessionId: input.learningSessionId || null,
    learningRoundId: input.learningRoundId || null,
    learningTaskAttemptId: input.learningTaskAttemptId || null,
    observationPolicyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION,
  });
  return {
    eventId: `convergence-observation-${stableHash(identity)}`,
    eventHash: stableHash(stableSerialize({ identity, stableInput: input.stableInput })),
  };
}

export function validateConvergenceObservationEvent(
  event: ComplexityConvergenceObservationEvent,
): string[] {
  const issues: string[] = [];
  if (event.schemaVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_EVENT_SCHEMA_VERSION) issues.push('schema_version_invalid');
  if (event.observationPolicyVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION) issues.push('observation_policy_version_invalid');
  if (!nonEmpty(event.eventId) || !nonEmpty(event.eventHash)) issues.push('event_identity_invalid');
  if (event.persistenceRole !== 'append_only_observation') issues.push('persistence_role_invalid');
  if (!CONVERGENCE_STAGE4_CAPABILITIES.includes(event.capability)) issues.push('capability_invalid');
  if (!CONVERGENCE_STAGE4_BENEFIT_CODES.includes(event.expectedBenefitCode)) issues.push('benefit_code_invalid');
  if (!nonEmpty(event.studentId)) issues.push('student_id_missing');
  if (!event.sourceDecisionId && !event.sourceResultId) issues.push('source_identity_missing');
  if (!stringArray(event.sourceEvidenceIds) || !stringArray(event.sourceSchemaVersions)
    || event.sourceSchemaVersions.length === 0) issues.push('source_refs_invalid');
  if (!CONVERGENCE_STAGE4_DATA_ORIGINS.includes(event.dataOrigin)) issues.push('data_origin_invalid');
  if (!['product', 'internal'].includes(event.runtimeScope)) issues.push('runtime_scope_invalid');
  if (!CONVERGENCE_STAGE4_LIFECYCLE_STAGES.includes(event.lifecycleStage)) issues.push('lifecycle_stage_invalid');
  if (!CONVERGENCE_STAGE4_OUTCOME_CODES.includes(event.outcomeCode)) issues.push('outcome_code_invalid');
  if (!timestamp(event.occurredAt) || !nonEmpty(event.trialWindowId)) issues.push('window_or_time_invalid');
  if (containsForbiddenContentKey(event)) issues.push('student_content_forbidden');
  if (!event.validation || !Array.isArray(event.validation.issues)) issues.push('validation_missing');
  return unique(issues);
}

export function isConvergenceObservationEvent(value: unknown): value is ComplexityConvergenceObservationEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as ComplexityConvergenceObservationEvent;
  return validateConvergenceObservationEvent(event).length === 0
    && event.validation.passed
    && event.validation.noStudentContentStored;
}

export function validateConvergenceTrialWindow(window: ComplexityConvergenceTrialWindow): string[] {
  const issues: string[] = [];
  if (window.schemaVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_WINDOW_SCHEMA_VERSION) issues.push('schema_version_invalid');
  if (window.observationPolicyVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION) issues.push('observation_policy_version_invalid');
  if (window.decisionPolicyVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION) issues.push('decision_policy_version_invalid');
  if (!nonEmpty(window.trialWindowId) || !['draft', 'active', 'closed', 'invalidated'].includes(window.status)) issues.push('window_identity_invalid');
  if (!timestamp(window.startsAt) || !timestamp(window.plannedEndsAt)
    || Date.parse(window.plannedEndsAt) <= Date.parse(window.startsAt)) issues.push('window_range_invalid');
  const durationDays = (Date.parse(window.plannedEndsAt) - Date.parse(window.startsAt)) / 86_400_000;
  if (durationDays < 14 || durationDays > 28) issues.push('window_duration_out_of_range');
  if (!stringArray(window.participatingStudentIds) || window.participatingStudentIds.length === 0) issues.push('participants_missing');
  if (!nonEmpty(window.sourceRegistryVersion) || !nonEmpty(window.sourcePolicySnapshotHash)) issues.push('source_snapshot_missing');
  if (!window.enabledCapabilityModes || CONVERGENCE_STAGE4_CAPABILITIES.some((item) => !nonEmpty(window.enabledCapabilityModes[item]))) issues.push('capability_modes_incomplete');
  if (!stringArray(window.invalidationReasons)) issues.push('invalidation_reasons_invalid');
  if (window.status === 'invalidated' && window.invalidationReasons.length === 0) issues.push('invalidation_reason_missing');
  if (['closed', 'invalidated'].includes(window.status) && !timestamp(window.closedAt)) issues.push('closed_at_missing');
  if (!['closed', 'invalidated'].includes(window.status) && window.closedAt) issues.push('closed_at_unexpected');
  return unique(issues);
}

export function validateConvergenceAggregateSnapshot(
  snapshot: ComplexityConvergenceAggregateSnapshot,
): string[] {
  const issues: string[] = [];
  if (snapshot.schemaVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_AGGREGATE_SCHEMA_VERSION) issues.push('schema_version_invalid');
  if (snapshot.observationPolicyVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION) issues.push('policy_version_invalid');
  if (!nonEmpty(snapshot.snapshotId) || !nonEmpty(snapshot.snapshotHash)) issues.push('snapshot_identity_invalid');
  if (snapshot.persistenceRole !== 'rebuildable_read_model') issues.push('persistence_role_invalid');
  if (!nonEmpty(snapshot.trialWindowId) || !timestamp(snapshot.generatedAt)) issues.push('snapshot_source_invalid');
  if (!Array.isArray(snapshot.aggregates) || !snapshot.aggregates.every(validAggregate)) issues.push('aggregates_invalid');
  if (!stringArray(snapshot.sourceEventIds) || !stringArray(snapshot.integrityIssues)) issues.push('snapshot_arrays_invalid');
  return unique(issues);
}

export function validateConvergenceDecisionProposal(
  proposal: ComplexityConvergenceDecisionProposal,
): string[] {
  const issues: string[] = [];
  if (proposal.schemaVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PROPOSAL_SCHEMA_VERSION) issues.push('schema_version_invalid');
  if (proposal.decisionPolicyVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION) issues.push('decision_policy_version_invalid');
  if (!nonEmpty(proposal.proposalId) || !nonEmpty(proposal.aggregateSnapshotId)
    || !nonEmpty(proposal.trialWindowId)) issues.push('proposal_identity_invalid');
  if (!CONVERGENCE_STAGE4_CAPABILITIES.includes(proposal.capability)) issues.push('capability_invalid');
  if (!CONVERGENCE_STAGE4_BENEFIT_CODES.includes(proposal.expectedBenefitCode)) issues.push('benefit_code_invalid');
  if (!CONVERGENCE_STAGE4_SAMPLE_STATUSES.includes(proposal.sampleStatus)) issues.push('sample_status_invalid');
  if (!CONVERGENCE_STAGE4_MAINTENANCE_BANDS.includes(proposal.maintenanceBand)) issues.push('maintenance_band_invalid');
  if (!CONVERGENCE_STAGE4_DECISIONS.includes(proposal.proposedDecision)) issues.push('decision_invalid');
  if (!proposal.decisionReasonCodes.length || !proposal.decisionReasonCodes.every((item) => CONVERGENCE_STAGE4_DECISION_REASON_CODES.includes(item))) issues.push('reason_codes_invalid');
  if (!stringArray(proposal.limitations)) issues.push('limitations_invalid');
  if (proposal.sampleStatus !== 'review_ready' && proposal.proposedDecision !== 'insufficient_evidence') issues.push('decision_without_ready_sample');
  if (!timestamp(proposal.generatedAt) || !['proposed', 'accepted', 'rejected', 'superseded'].includes(proposal.status)) issues.push('proposal_status_invalid');
  return unique(issues);
}

export function stableConvergenceSerialize(value: unknown): string { return stableSerialize(value); }
export function stableConvergenceHash(value: unknown): string { return stableHash(stableSerialize(value)); }

function validAggregate(item: ComplexityConvergenceCapabilityAggregate): boolean {
  return CONVERGENCE_STAGE4_CAPABILITIES.includes(item.capability)
    && CONVERGENCE_STAGE4_BENEFIT_CODES.includes(item.expectedBenefitCode)
    && CONVERGENCE_STAGE4_SAMPLE_STATUSES.includes(item.sampleStatus)
    && [item.eligibleCount, item.notTriggeredCount, item.triggeredCount, item.completedCount,
      item.interruptedCount, item.fallbackCount, item.benefitObservedCount,
      item.benefitNotObservedCount, item.integrityBlockedCount, item.recoveryCount,
      item.distinctSessionCount, item.distinctActiveDayCount].every(nonNegativeInteger);
}

function containsForbiddenContentKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value as Record<string, unknown>).some((key) => FORBIDDEN_CONTENT_KEYS.includes(key as typeof FORBIDDEN_CONTENT_KEYS[number]))
    || Object.values(value as Record<string, unknown>).some(containsForbiddenContentKey);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function nonEmpty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function timestamp(value: unknown): value is string { return nonEmpty(value) && !Number.isNaN(Date.parse(value)); }
function nonNegativeInteger(value: unknown): value is number { return Number.isInteger(value) && Number(value) >= 0; }
function stringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every(nonEmpty); }
function unique(values: string[]): string[] { return [...new Set(values)]; }
