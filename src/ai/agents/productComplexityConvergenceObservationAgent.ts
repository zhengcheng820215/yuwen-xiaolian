import {
  CONVERGENCE_STAGE4_CAPABILITIES,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_AGGREGATE_SCHEMA_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_EVENT_SCHEMA_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PROPOSAL_SCHEMA_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_WINDOW_SCHEMA_VERSION,
  buildConvergenceObservationIdentity,
  stableConvergenceHash,
  validateConvergenceAggregateSnapshot,
  validateConvergenceDecisionProposal,
  validateConvergenceObservationEvent,
  validateConvergenceTrialWindow,
  type ComplexityConvergenceAggregateSnapshot,
  type ComplexityConvergenceCapability,
  type ComplexityConvergenceCapabilityAggregate,
  type ComplexityConvergenceCapabilityDecision,
  type ComplexityConvergenceDecisionProposal,
  type ComplexityConvergenceDecisionReasonCode,
  type ComplexityConvergenceExpectedBenefitCode,
  type ComplexityConvergenceLifecycleStage,
  type ComplexityConvergenceMaintenanceBand,
  type ComplexityConvergenceMaintenanceFacts,
  type ComplexityConvergenceObservationEvent,
  type ComplexityConvergenceObservedOutcomeCode,
  type ComplexityConvergenceRatio,
  type ComplexityConvergenceSampleStatus,
  type ComplexityConvergenceTrialWindow,
  type ConvergenceObservationDataOrigin,
} from '../schemas/productComplexityConvergenceObservation.schema.ts';

export type ConvergenceObservationSourceFact = {
  capability: ComplexityConvergenceCapability;
  expectedBenefitCode: ComplexityConvergenceExpectedBenefitCode;
  lifecycleStage: ComplexityConvergenceLifecycleStage;
  outcomeCode: ComplexityConvergenceObservedOutcomeCode;
  studentId: string;
  learningSessionId?: string;
  learningRoundId?: string;
  learningTaskAttemptId?: string;
  sourceDecisionId?: string;
  sourceResultId?: string;
  sourceEvidenceIds?: string[];
  sourceSchemaVersions: string[];
  dataOrigin: ConvergenceObservationDataOrigin;
  runtimeScope: 'product' | 'internal';
  occurredAt: string;
  studentIdentityAligned: boolean;
  sessionIdentityAligned: boolean;
  sourceFactValidated: boolean;
};

const BENEFIT_OBSERVED = new Set<ComplexityConvergenceObservedOutcomeCode>([
  'revision_gap_resolved_supported',
  'targeted_gap_resolved_supported',
  'retest_independent_retained',
  'transfer_independent_succeeded',
  'resource_risk_repaired',
  'calibration_review_completed',
  'feedback_action_followed',
  'profile_summary_available',
]);

const BENEFIT_NOT_OBSERVED = new Set<ComplexityConvergenceObservedOutcomeCode>([
  'revision_gap_unresolved',
  'targeted_gap_unresolved',
  'retest_independent_not_retained',
  'transfer_independent_not_succeeded',
  'resource_risk_unresolved',
  'feedback_projection_fallback',
  'profile_summary_insufficient_evidence',
]);

export function createConvergenceTrialWindow(input: {
  trialWindowId: string;
  startsAt: string;
  plannedEndsAt: string;
  participatingStudentIds: string[];
  sourceRegistryVersion: string;
  sourcePolicySnapshotHash: string;
  enabledCapabilityModes?: Partial<Record<ComplexityConvergenceCapability, string>>;
  status?: ComplexityConvergenceTrialWindow['status'];
  closedAt?: string;
  invalidationReasons?: string[];
}): ComplexityConvergenceTrialWindow {
  const modes = Object.fromEntries(CONVERGENCE_STAGE4_CAPABILITIES.map((capability) => [
    capability, input.enabledCapabilityModes?.[capability] || 'observe_only',
  ])) as Record<ComplexityConvergenceCapability, string>;
  const window: ComplexityConvergenceTrialWindow = {
    schemaVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_WINDOW_SCHEMA_VERSION,
    trialWindowId: input.trialWindowId,
    observationPolicyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION,
    decisionPolicyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION,
    status: input.status || 'active',
    startsAt: input.startsAt,
    plannedEndsAt: input.plannedEndsAt,
    closedAt: input.closedAt,
    participatingStudentIds: [...new Set(input.participatingStudentIds)].sort(),
    enabledCapabilityModes: modes,
    sourceRegistryVersion: input.sourceRegistryVersion,
    sourcePolicySnapshotHash: input.sourcePolicySnapshotHash,
    invalidationReasons: [...new Set(input.invalidationReasons || [])],
  };
  const issues = validateConvergenceTrialWindow(window);
  if (issues.length) throw new Error(`trial_window_invalid:${issues.join(',')}`);
  Object.freeze(window.participatingStudentIds);
  Object.freeze(window.enabledCapabilityModes);
  Object.freeze(window.invalidationReasons);
  return Object.freeze(window);
}

export function transitionConvergenceTrialWindow(
  window: ComplexityConvergenceTrialWindow,
  input: {
    status: ComplexityConvergenceTrialWindow['status'];
    closedAt?: string;
    invalidationReasons?: string[];
  },
): ComplexityConvergenceTrialWindow {
  const allowed: Record<ComplexityConvergenceTrialWindow['status'],
  ComplexityConvergenceTrialWindow['status'][]> = {
    draft: ['draft', 'active', 'invalidated'],
    active: ['active', 'closed', 'invalidated'],
    closed: ['closed'],
    invalidated: ['invalidated'],
  };
  if (!allowed[window.status].includes(input.status)) throw new Error('trial_window_status_regression');
  const next: ComplexityConvergenceTrialWindow = {
    ...window,
    status: input.status,
    closedAt: ['closed', 'invalidated'].includes(input.status)
      ? input.closedAt || window.closedAt : undefined,
    invalidationReasons: input.status === 'invalidated'
      ? [...new Set(input.invalidationReasons || window.invalidationReasons)] : [],
  };
  const issues = validateConvergenceTrialWindow(next);
  if (issues.length) throw new Error(`trial_window_invalid:${issues.join(',')}`);
  Object.freeze(next.participatingStudentIds);
  Object.freeze(next.enabledCapabilityModes);
  Object.freeze(next.invalidationReasons);
  return Object.freeze(next);
}

export function adaptConvergenceObservationFact(input: {
  source: ConvergenceObservationSourceFact;
  trialWindow: ComplexityConvergenceTrialWindow;
  forceExcludeReason?: string;
}): ComplexityConvergenceObservationEvent {
  const source = input.source;
  const identityAligned = source.studentIdentityAligned && source.sessionIdentityAligned;
  const inWindow = Date.parse(source.occurredAt) >= Date.parse(input.trialWindow.startsAt)
    && Date.parse(source.occurredAt) <= Date.parse(input.trialWindow.plannedEndsAt);
  const participant = input.trialWindow.participatingStudentIds.includes(source.studentId);
  const admitted = source.dataOrigin === 'real_learning'
    && source.runtimeScope === 'product'
    && identityAligned
    && source.sourceFactValidated
    && inWindow
    && participant
    && input.trialWindow.status === 'active'
    && !input.forceExcludeReason;
  const issues = [
    ...(!identityAligned ? ['identity_mismatch'] : []),
    ...(!source.sourceFactValidated ? ['source_fact_invalid'] : []),
    ...(!inWindow ? ['outside_trial_window'] : []),
    ...(!participant ? ['student_outside_trial'] : []),
    ...(input.trialWindow.status !== 'active' ? ['trial_window_not_active'] : []),
    ...(input.forceExcludeReason ? [input.forceExcludeReason] : []),
  ];
  const identity = buildConvergenceObservationIdentity({
    capability: source.capability,
    lifecycleStage: source.lifecycleStage,
    sourceDecisionId: source.sourceDecisionId,
    sourceResultId: source.sourceResultId,
    studentId: source.studentId,
    learningSessionId: source.learningSessionId,
    learningRoundId: source.learningRoundId,
    learningTaskAttemptId: source.learningTaskAttemptId,
    stableInput: {
      expectedBenefitCode: source.expectedBenefitCode,
      outcomeCode: source.outcomeCode,
      sourceEvidenceIds: [...new Set(source.sourceEvidenceIds || [])].sort(),
      sourceSchemaVersions: [...new Set(source.sourceSchemaVersions)].sort(),
      dataOrigin: source.dataOrigin,
      runtimeScope: source.runtimeScope,
      studentIdentityAligned: source.studentIdentityAligned,
      sessionIdentityAligned: source.sessionIdentityAligned,
      sourceFactValidated: source.sourceFactValidated,
      forceExcludeReason: input.forceExcludeReason || null,
      occurredAt: source.occurredAt,
      trialWindowId: input.trialWindow.trialWindowId,
    },
  });
  const event: ComplexityConvergenceObservationEvent = {
    schemaVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_EVENT_SCHEMA_VERSION,
    observationPolicyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION,
    ...identity,
    persistenceRole: 'append_only_observation',
    capability: source.capability,
    expectedBenefitCode: source.expectedBenefitCode,
    studentId: source.studentId,
    learningSessionId: source.learningSessionId,
    learningRoundId: source.learningRoundId,
    learningTaskAttemptId: source.learningTaskAttemptId,
    sourceDecisionId: source.sourceDecisionId,
    sourceResultId: source.sourceResultId,
    sourceEvidenceIds: [...new Set(source.sourceEvidenceIds || [])].sort(),
    sourceSchemaVersions: [...new Set(source.sourceSchemaVersions)].sort(),
    dataOrigin: source.dataOrigin,
    runtimeScope: source.runtimeScope,
    lifecycleStage: source.lifecycleStage,
    outcomeCode: source.outcomeCode,
    occurredAt: source.occurredAt,
    trialWindowId: input.trialWindow.trialWindowId,
    validation: {
      passed: true,
      identityAligned,
      sourceFactValidated: source.sourceFactValidated,
      dataOriginAdmitted: admitted,
      noStudentContentStored: true,
      issues,
    },
  };
  const structuralIssues = validateConvergenceObservationEvent(event);
  if (structuralIssues.length) throw new Error(`observation_event_invalid:${structuralIssues.join(',')}`);
  return event;
}

export function buildConvergenceAggregateSnapshot(input: {
  trialWindow: ComplexityConvergenceTrialWindow;
  events: ComplexityConvergenceObservationEvent[];
  generatedAt: string;
}): ComplexityConvergenceAggregateSnapshot {
  const allWindowEvents = dedupeEvents(input.events)
    .filter((event) => event.trialWindowId === input.trialWindow.trialWindowId);
  const admitted = allWindowEvents.filter((event) => event.validation.dataOriginAdmitted
    && validateConvergenceObservationEvent(event).length === 0);
  const excludedOriginCounts: Partial<Record<ConvergenceObservationDataOrigin, number>> = {};
  allWindowEvents.filter((event) => !event.validation.dataOriginAdmitted).forEach((event) => {
    excludedOriginCounts[event.dataOrigin] = (excludedOriginCounts[event.dataOrigin] || 0) + 1;
  });
  const sourceSchemaVersionCounts: Record<string, number> = {};
  admitted.forEach((event) => event.sourceSchemaVersions.forEach((version) => {
    sourceSchemaVersionCounts[version] = (sourceSchemaVersionCounts[version] || 0) + 1;
  }));
  const keys = [...new Set(admitted.map((event) => `${event.capability}|${event.expectedBenefitCode}`))].sort();
  const aggregates = keys.map((key) => {
    const [capability, expectedBenefitCode] = key.split('|') as [
      ComplexityConvergenceCapability, ComplexityConvergenceExpectedBenefitCode,
    ];
    return aggregateCapability(
      admitted.filter((event) => event.capability === capability
        && event.expectedBenefitCode === expectedBenefitCode),
      capability,
      expectedBenefitCode,
      input.trialWindow,
      input.generatedAt,
    );
  });
  const sourceEventIds = admitted.map((event) => event.eventId).sort();
  const stableSource = {
    trialWindowId: input.trialWindow.trialWindowId,
    observationPolicyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION,
    sourceEventIds,
    aggregates,
    excludedOriginCounts,
    sourceSchemaVersionCounts,
    integrityIssues: input.trialWindow.status === 'invalidated' ? ['trial_window_invalidated'] : [],
  };
  const hash = stableConvergenceHash(stableSource);
  const snapshot: ComplexityConvergenceAggregateSnapshot = {
    schemaVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_AGGREGATE_SCHEMA_VERSION,
    observationPolicyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION,
    snapshotId: `convergence-aggregate-${hash}`,
    snapshotHash: hash,
    persistenceRole: 'rebuildable_read_model',
    trialWindowId: input.trialWindow.trialWindowId,
    generatedAt: input.generatedAt,
    windowStartsAt: input.trialWindow.startsAt,
    windowEndsAt: input.trialWindow.plannedEndsAt,
    sourceEventIds,
    admittedEventCount: admitted.length,
    excludedOriginCounts,
    sourceSchemaVersionCounts,
    aggregates,
    integrityIssues: input.trialWindow.status === 'invalidated' ? ['trial_window_invalidated'] : [],
  };
  const issues = validateConvergenceAggregateSnapshot(snapshot);
  if (issues.length) throw new Error(`aggregate_snapshot_invalid:${issues.join(',')}`);
  return snapshot;
}

export function calculateConvergenceMaintenanceBand(
  facts: ComplexityConvergenceMaintenanceFacts,
): ComplexityConvergenceMaintenanceBand {
  const values = Object.values(facts);
  if (!values.every((value) => Number.isInteger(value) && value >= 0)) return 'not_available';
  const weighted = facts.identityMismatchCount * 3 + facts.integrityBlockCount * 3
    + facts.duplicateConflictCount * 3 + facts.manualRecoveryCount * 2
    + facts.compatibilityErrorCount * 2 + facts.recoveryCount + facts.fallbackCount
    + facts.interruptionCount + facts.policyFallbackCount;
  if (weighted >= 12) return 'high';
  if (weighted >= 4) return 'moderate';
  return 'low';
}

export function proposeConvergenceCapabilityDecision(input: {
  snapshot: ComplexityConvergenceAggregateSnapshot;
  aggregate: ComplexityConvergenceCapabilityAggregate;
  maintenanceBand: ComplexityConvergenceMaintenanceBand;
  generatedAt: string;
}): ComplexityConvergenceDecisionProposal {
  const aggregate = input.aggregate;
  let decision: ComplexityConvergenceCapabilityDecision = 'insufficient_evidence';
  let reasons: ComplexityConvergenceDecisionReasonCode[] = [];
  if (aggregate.sampleStatus === 'integrity_blocked') reasons = ['data_integrity_blocked'];
  else if (aggregate.sampleStatus === 'no_opportunity') reasons = ['no_trigger_opportunity'];
  else if (aggregate.sampleStatus !== 'review_ready') reasons = ['sample_insufficient'];
  else {
    const benefit = aggregate.benefitObservedRate.value === 'not_available'
      ? 0 : aggregate.benefitObservedRate.value;
    const trigger = aggregate.triggerRate.value === 'not_available' ? 0 : aggregate.triggerRate.value;
    if (trigger >= 0.5 && benefit >= 0.6) {
      decision = requiresIndependentValidation(aggregate) ? 'retain_conditional' : 'retain_core';
      reasons = [requiresIndependentValidation(aggregate)
        ? 'benefit_requires_independent_validation' : 'high_frequency_clear_benefit'];
    } else if (trigger < 0.5 && benefit >= 0.6) {
      decision = 'retain_conditional';
      reasons = ['low_frequency_critical_benefit'];
    } else if (trigger >= 0.5) {
      decision = 'optimize_policy';
      reasons = ['high_frequency_limited_benefit'];
    } else if (input.maintenanceBand === 'high' && benefit === 0) {
      decision = 'deprecation_candidate';
      reasons = ['low_frequency_no_observed_benefit_high_maintenance'];
    } else {
      decision = 'default_disable_candidate';
      reasons = ['low_frequency_limited_benefit'];
    }
  }
  if (input.maintenanceBand === 'not_available') reasons.push('maintenance_cost_unavailable');
  const proposalHash = stableConvergenceHash({
    aggregateSnapshotId: input.snapshot.snapshotId,
    capability: aggregate.capability,
    expectedBenefitCode: aggregate.expectedBenefitCode,
    decisionPolicyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION,
  });
  const proposal: ComplexityConvergenceDecisionProposal = {
    schemaVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PROPOSAL_SCHEMA_VERSION,
    decisionPolicyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION,
    proposalId: `convergence-proposal-${proposalHash}`,
    capability: aggregate.capability,
    trialWindowId: input.snapshot.trialWindowId,
    expectedBenefitCode: aggregate.expectedBenefitCode,
    sampleStatus: aggregate.sampleStatus,
    aggregateSnapshotId: input.snapshot.snapshotId,
    maintenanceBand: input.maintenanceBand,
    proposedDecision: decision,
    decisionReasonCodes: [...new Set(reasons)],
    limitations: proposalLimitations(aggregate),
    generatedAt: input.generatedAt,
    status: 'proposed',
  };
  const issues = validateConvergenceDecisionProposal(proposal);
  if (issues.length) throw new Error(`decision_proposal_invalid:${issues.join(',')}`);
  return proposal;
}

export function transitionConvergenceProposal(
  proposal: ComplexityConvergenceDecisionProposal,
  status: ComplexityConvergenceDecisionProposal['status'],
): ComplexityConvergenceDecisionProposal {
  if (proposal.status !== 'proposed' && proposal.status !== status) return proposal;
  if (!['accepted', 'rejected', 'superseded', 'proposed'].includes(status)) return proposal;
  return { ...proposal, status };
}

function aggregateCapability(
  events: ComplexityConvergenceObservationEvent[],
  capability: ComplexityConvergenceCapability,
  expectedBenefitCode: ComplexityConvergenceExpectedBenefitCode,
  window: ComplexityConvergenceTrialWindow,
  generatedAt: string,
): ComplexityConvergenceCapabilityAggregate {
  const count = (stage: ComplexityConvergenceLifecycleStage) => events.filter((event) => event.lifecycleStage === stage).length;
  const eligibleCount = count('eligible');
  const triggeredCount = count('triggered');
  const completedCount = count('completed');
  const interruptedCount = count('interrupted');
  const fallbackCount = count('fallback');
  const integrityBlockedCount = events.filter((event) => event.outcomeCode === 'integrity_blocked').length;
  const dates = events.map((event) => event.occurredAt).sort();
  const base = {
    capability,
    expectedBenefitCode,
    eligibleCount,
    notTriggeredCount: count('not_triggered'),
    triggeredCount,
    completedCount,
    interruptedCount,
    fallbackCount,
    benefitObservedCount: events.filter((event) => BENEFIT_OBSERVED.has(event.outcomeCode)).length,
    benefitNotObservedCount: events.filter((event) => BENEFIT_NOT_OBSERVED.has(event.outcomeCode)).length,
    integrityBlockedCount,
    recoveryCount: events.filter((event) => event.outcomeCode === 'runtime_interrupted').length,
    distinctSessionCount: new Set(events.map((event) => event.learningSessionId).filter(Boolean)).size,
    distinctActiveDayCount: new Set(events.map((event) => event.occurredAt.slice(0, 10))).size,
    firstObservedAt: dates[0],
    lastObservedAt: dates.at(-1),
  };
  return {
    ...base,
    triggerRate: ratio(triggeredCount, eligibleCount),
    completionRate: ratio(completedCount, triggeredCount),
    interruptionRate: ratio(interruptedCount, triggeredCount),
    fallbackRate: ratio(fallbackCount, eligibleCount),
    benefitObservedRate: ratio(base.benefitObservedCount, completedCount),
    integrityBlockedRate: ratio(integrityBlockedCount, eligibleCount),
    sampleStatus: sampleStatus({ ...base, window, generatedAt }),
  };
}

function sampleStatus(input: {
  eligibleCount: number;
  completedCount: number;
  distinctActiveDayCount: number;
  integrityBlockedCount: number;
  window: ComplexityConvergenceTrialWindow;
  generatedAt: string;
}): ComplexityConvergenceSampleStatus {
  if (input.integrityBlockedCount > 0 || input.window.status === 'invalidated') return 'integrity_blocked';
  if (input.eligibleCount === 0) return 'no_opportunity';
  const elapsedDays = (Math.min(Date.parse(input.generatedAt), Date.parse(input.window.plannedEndsAt))
    - Date.parse(input.window.startsAt)) / 86_400_000;
  if (elapsedDays < 14) return 'collecting';
  if (input.distinctActiveDayCount < 6 || input.eligibleCount < 10 || input.completedCount < 5) return 'insufficient_sample';
  return 'review_ready';
}

function ratio(numerator: number, denominator: number): ComplexityConvergenceRatio {
  return { numerator, denominator, value: denominator === 0 ? 'not_available' : numerator / denominator };
}

function requiresIndependentValidation(aggregate: ComplexityConvergenceCapabilityAggregate): boolean {
  return ['revision', 'targeted_micro_training'].includes(aggregate.capability);
}

function proposalLimitations(aggregate: ComplexityConvergenceCapabilityAggregate): string[] {
  const limitations = ['该提案只作用于未来版本，不自动修改当前能力。'];
  if (requiresIndependentValidation(aggregate)) limitations.push('当前收益属于支持下改善，仍需独立 Retest 或 Transfer 验证。');
  if (aggregate.sampleStatus !== 'review_ready') limitations.push('当前样本不足以形成能力去留结论。');
  return limitations;
}

function dedupeEvents(events: ComplexityConvergenceObservationEvent[]): ComplexityConvergenceObservationEvent[] {
  const byId = new Map<string, ComplexityConvergenceObservationEvent>();
  events.forEach((event) => { if (!byId.has(event.eventId)) byId.set(event.eventId, event); });
  return [...byId.values()];
}
