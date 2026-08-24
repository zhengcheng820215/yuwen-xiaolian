export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_SCHEMA_VERSION =
  'product_complexity_convergence_stage2_conditional_policy_v1' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_POLICY_VERSION =
  'product_complexity_convergence_stage2_policy_v1' as const;

export const CONVERGENCE_CONDITIONAL_CAPABILITIES = [
  'revision', 'targeted', 'retest', 'transfer',
] as const;
export type ConvergenceConditionalCapability = typeof CONVERGENCE_CONDITIONAL_CAPABILITIES[number];

export const CONVERGENCE_CONDITIONAL_POLICY_MODES = ['shadow', 'enforced'] as const;
export type ConvergenceConditionalPolicyMode = typeof CONVERGENCE_CONDITIONAL_POLICY_MODES[number];

export const CONVERGENCE_CONDITIONAL_DECISION_OUTCOMES = [
  'trigger', 'no_action', 'defer', 'blocked',
] as const;
export type ConvergenceConditionalDecisionOutcome = typeof CONVERGENCE_CONDITIONAL_DECISION_OUTCOMES[number];

export const CONVERGENCE_CONDITIONAL_EXPECTED_BENEFIT_CODES = [
  'resolve_revision_gap',
  'isolate_atomic_gap',
  'verify_independent_retention',
  'verify_transfer',
] as const;
export type ConvergenceConditionalExpectedBenefitCode =
  typeof CONVERGENCE_CONDITIONAL_EXPECTED_BENEFIT_CODES[number];

export const CONVERGENCE_CONDITIONAL_REASON_CODES = [
  'revision_actionable_gap', 'revision_no_actionable_gap', 'revision_not_needed',
  'revision_already_used', 'revision_role_ineligible',
  'targeted_atomic_gap_confirmed', 'targeted_gap_not_atomic', 'targeted_resource_unavailable',
  'targeted_limit_reached', 'targeted_session_unsuitable', 'targeted_intervention_conflict',
  'retest_due', 'retest_not_due', 'retest_evidence_insufficient',
  'retest_already_scheduled', 'retest_resource_unavailable',
  'transfer_stable_basis_ready', 'transfer_foundation_not_stable',
  'transfer_new_context_unavailable', 'transfer_already_scheduled',
  'source_fact_missing', 'identity_mismatch', 'policy_input_invalid',
  'recursive_chain_blocked', 'legacy_unobserved',
] as const;
export type ConvergenceConditionalReasonCode = typeof CONVERGENCE_CONDITIONAL_REASON_CODES[number];

export const CONVERGENCE_CONDITIONAL_EXIT_CONDITION_CODES = [
  'revision_submitted_or_declined',
  'targeted_completed_skipped_or_unavailable',
  'retest_completed_cancelled_or_rescheduled',
  'transfer_completed_cancelled_or_superseded',
] as const;
export type ConvergenceConditionalExitConditionCode =
  typeof CONVERGENCE_CONDITIONAL_EXIT_CONDITION_CODES[number];

export const CONVERGENCE_CONDITIONAL_FALLBACK_CODES = [
  'continue_core_queue', 'preserve_active_owner_flow', 'wait_until_due', 'keep_existing_schedule',
] as const;
export type ConvergenceConditionalFallbackCode = typeof CONVERGENCE_CONDITIONAL_FALLBACK_CODES[number];

export const CONVERGENCE_CONDITIONAL_SOURCE_FACT_TYPES = [
  'attempt', 'diagnosis', 'feedback', 'revision_evaluation', 'targeted_gap',
  'ability_evidence', 'growth_memory', 'retest_candidate', 'retest_plan', 'next_learning_strategy',
] as const;
export type ConvergenceConditionalSourceFactType = typeof CONVERGENCE_CONDITIONAL_SOURCE_FACT_TYPES[number];

export const CONVERGENCE_CONDITIONAL_OWNER_TYPES = [
  'revision_offer_snapshot', 'targeted_trigger_decision',
  'delayed_retest_candidate', 'next_learning_strategy',
] as const;
export type ConvergenceConditionalOwnerType = typeof CONVERGENCE_CONDITIONAL_OWNER_TYPES[number];

export type ConvergenceConditionalSourceFactRef = {
  factType: ConvergenceConditionalSourceFactType;
  factId: string;
  factSchemaVersion?: string;
};

export type ConvergenceConditionalOwnerDecisionRef = {
  ownerType: ConvergenceConditionalOwnerType;
  ownerId: string;
  ownerPolicyVersion: string;
  ownerOutcome: string;
  ownerMappedOutcome: ConvergenceConditionalDecisionOutcome;
  ownerReasonCode?: string;
};

export type ConvergenceConditionalLoopGuard = {
  scopeKey: string;
  currentDepth: number;
  maximumDepth: number;
  usageCount: number;
  usageLimit: number;
  passed: boolean;
};

export type ConvergenceConditionalPolicyDecision = {
  schemaVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_SCHEMA_VERSION;
  policyVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_POLICY_VERSION;
  decisionId: string;
  decisionHash: string;
  persistenceRole: 'audit_projection';
  mode: ConvergenceConditionalPolicyMode;
  capability: ConvergenceConditionalCapability;
  studentId: string;
  learningSessionId?: string;
  learningRoundId?: string;
  sourceAttemptId?: string;
  sourceResourceVersionId?: string;
  sourceFactRefs: ConvergenceConditionalSourceFactRef[];
  sourceEvidenceIds: string[];
  ownerDecision: ConvergenceConditionalOwnerDecisionRef;
  convergedOutcome: ConvergenceConditionalDecisionOutcome;
  effectiveOutcome: ConvergenceConditionalDecisionOutcome;
  reasonCode: ConvergenceConditionalReasonCode;
  secondaryReasonCodes: ConvergenceConditionalReasonCode[];
  expectedBenefitCode?: ConvergenceConditionalExpectedBenefitCode;
  expectedBenefitDescription?: string;
  exitConditionCode?: ConvergenceConditionalExitConditionCode;
  fallbackCode: ConvergenceConditionalFallbackCode;
  loopGuard: ConvergenceConditionalLoopGuard;
  evaluatedAt: string;
  validation: { passed: boolean; issues: string[] };
};

export type ConvergenceConditionalDecisionAlignment =
  | 'aligned'
  | 'behavior_divergence'
  | 'reason_divergence'
  | 'insufficient_legacy_fact'
  | 'not_compared';

export type ConvergenceConditionalPolicyAuditResult = {
  decisionId: string;
  capability: ConvergenceConditionalCapability;
  alignment: ConvergenceConditionalDecisionAlignment;
  ownerOutcome: string;
  convergedOutcome: ConvergenceConditionalDecisionOutcome;
  effectiveOutcome: ConvergenceConditionalDecisionOutcome;
  behaviorChanged: boolean;
  protectedWriteCount: 0;
  issues: string[];
};

export type ConvergenceConditionalCapabilityFlag = 'legacy' | 'shadow' | 'enforced';
export type ConvergenceConditionalCapabilityFlags = Record<
  ConvergenceConditionalCapability,
  ConvergenceConditionalCapabilityFlag
>;

export const DEFAULT_CONVERGENCE_CONDITIONAL_CAPABILITY_FLAGS: ConvergenceConditionalCapabilityFlags = {
  revision: 'legacy', targeted: 'legacy', retest: 'legacy', transfer: 'legacy',
};

export type ConvergenceConditionalPolicyRuntimeResult = {
  flag: ConvergenceConditionalCapabilityFlag;
  decision?: ConvergenceConditionalPolicyDecision;
  audit?: ConvergenceConditionalPolicyAuditResult;
  effectiveOutcome: ConvergenceConditionalDecisionOutcome;
  ownerRemainsAuthority: true;
  runtimeIssue?: string;
};

export type ConvergenceConditionalSessionPolicySnapshot = {
  schemaVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_SCHEMA_VERSION;
  learningSessionId: string;
  flags: ConvergenceConditionalCapabilityFlags;
  policyVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_POLICY_VERSION;
  frozenAt: string;
};

export function freezeConvergenceConditionalSessionPolicy(input: {
  learningSessionId: string;
  flags?: Partial<ConvergenceConditionalCapabilityFlags>;
  frozenAt: string;
}): ConvergenceConditionalSessionPolicySnapshot {
  if (!nonEmpty(input.learningSessionId)) throw new Error('learning_session_id_missing');
  if (!timestamp(input.frozenAt)) throw new Error('frozen_at_invalid');
  return Object.freeze({
    schemaVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_SCHEMA_VERSION,
    learningSessionId: input.learningSessionId,
    flags: Object.freeze({
      ...DEFAULT_CONVERGENCE_CONDITIONAL_CAPABILITY_FLAGS,
      ...(input.flags || {}),
    }),
    policyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_POLICY_VERSION,
    frozenAt: input.frozenAt,
  });
}

export function isConvergenceConditionalPolicyDecision(
  value: unknown,
): value is ConvergenceConditionalPolicyDecision {
  if (!value || typeof value !== 'object') return false;
  const item = value as ConvergenceConditionalPolicyDecision;
  const issues = validateConvergenceConditionalPolicyDecision(item);
  return issues.length === 0 && item.validation?.passed === true && item.validation.issues.length === 0;
}

export function validateConvergenceConditionalPolicyDecision(
  item: ConvergenceConditionalPolicyDecision,
): string[] {
  const issues: string[] = [];
  if (item.schemaVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_SCHEMA_VERSION) issues.push('schema_version_invalid');
  if (item.policyVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_POLICY_VERSION) issues.push('policy_version_invalid');
  if (!nonEmpty(item.decisionId)) issues.push('decision_id_missing');
  if (!nonEmpty(item.decisionHash)) issues.push('decision_hash_missing');
  if (item.persistenceRole !== 'audit_projection') issues.push('persistence_role_invalid');
  if (!CONVERGENCE_CONDITIONAL_POLICY_MODES.includes(item.mode)) issues.push('mode_invalid');
  if (!CONVERGENCE_CONDITIONAL_CAPABILITIES.includes(item.capability)) issues.push('capability_invalid');
  if (!nonEmpty(item.studentId)) issues.push('student_id_missing');
  if (!timestamp(item.evaluatedAt)) issues.push('evaluated_at_invalid');
  if (!Array.isArray(item.sourceFactRefs) || item.sourceFactRefs.length === 0
    || !item.sourceFactRefs.every(isSourceFactRef)) issues.push('source_fact_refs_invalid');
  if (!stringArray(item.sourceEvidenceIds)) issues.push('source_evidence_ids_invalid');
  if (!isOwnerDecisionRef(item.ownerDecision)) issues.push('owner_decision_invalid');
  if (!CONVERGENCE_CONDITIONAL_DECISION_OUTCOMES.includes(item.convergedOutcome)) issues.push('converged_outcome_invalid');
  if (!CONVERGENCE_CONDITIONAL_DECISION_OUTCOMES.includes(item.effectiveOutcome)) issues.push('effective_outcome_invalid');
  if (!CONVERGENCE_CONDITIONAL_REASON_CODES.includes(item.reasonCode)) issues.push('reason_code_invalid');
  if (!Array.isArray(item.secondaryReasonCodes)
    || !item.secondaryReasonCodes.every((code) => CONVERGENCE_CONDITIONAL_REASON_CODES.includes(code))) {
    issues.push('secondary_reason_codes_invalid');
  }
  if (item.expectedBenefitCode !== undefined
    && !CONVERGENCE_CONDITIONAL_EXPECTED_BENEFIT_CODES.includes(item.expectedBenefitCode)) issues.push('benefit_code_invalid');
  if (item.exitConditionCode !== undefined
    && !CONVERGENCE_CONDITIONAL_EXIT_CONDITION_CODES.includes(item.exitConditionCode)) issues.push('exit_condition_invalid');
  if (!CONVERGENCE_CONDITIONAL_FALLBACK_CODES.includes(item.fallbackCode)) issues.push('fallback_code_invalid');
  if (!isLoopGuard(item.loopGuard)) issues.push('loop_guard_invalid');
  if (item.convergedOutcome === 'trigger') {
    if (!item.expectedBenefitCode) issues.push('trigger_benefit_missing');
    if (!item.exitConditionCode) issues.push('trigger_exit_missing');
    if (!item.loopGuard?.passed) issues.push('trigger_loop_guard_failed');
    if (item.ownerDecision?.ownerMappedOutcome !== 'trigger') issues.push('trigger_without_owner_action');
  }
  if (item.mode === 'shadow' && item.effectiveOutcome !== item.ownerDecision?.ownerMappedOutcome) {
    issues.push('shadow_behavior_changed');
  }
  return unique(issues);
}

export function buildConvergenceConditionalDecisionIdentity(input: {
  capability: ConvergenceConditionalCapability;
  studentId: string;
  ownerId: string;
  ownerPolicyVersion: string;
  policyVersion?: string;
  stableInput?: unknown;
}): { decisionId: string; decisionHash: string } {
  const identitySource = stableSerialize({
    capability: input.capability,
    studentId: input.studentId,
    ownerId: input.ownerId,
    ownerPolicyVersion: input.ownerPolicyVersion,
    policyVersion: input.policyVersion || PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_POLICY_VERSION,
  });
  const identityHash = stableHash(identitySource);
  const decisionHash = stableHash(stableSerialize({ identitySource, stableInput: input.stableInput || null }));
  return {
    decisionId: `convergence-condition-${input.capability}-${identityHash}`,
    decisionHash,
  };
}

function isSourceFactRef(value: unknown): value is ConvergenceConditionalSourceFactRef {
  if (!value || typeof value !== 'object') return false;
  const item = value as ConvergenceConditionalSourceFactRef;
  return CONVERGENCE_CONDITIONAL_SOURCE_FACT_TYPES.includes(item.factType)
    && nonEmpty(item.factId)
    && (item.factSchemaVersion === undefined || nonEmpty(item.factSchemaVersion));
}

function isOwnerDecisionRef(value: unknown): value is ConvergenceConditionalOwnerDecisionRef {
  if (!value || typeof value !== 'object') return false;
  const item = value as ConvergenceConditionalOwnerDecisionRef;
  return CONVERGENCE_CONDITIONAL_OWNER_TYPES.includes(item.ownerType)
    && nonEmpty(item.ownerId)
    && nonEmpty(item.ownerPolicyVersion)
    && nonEmpty(item.ownerOutcome)
    && CONVERGENCE_CONDITIONAL_DECISION_OUTCOMES.includes(item.ownerMappedOutcome)
    && (item.ownerReasonCode === undefined || nonEmpty(item.ownerReasonCode));
}

function isLoopGuard(value: unknown): value is ConvergenceConditionalLoopGuard {
  if (!value || typeof value !== 'object') return false;
  const item = value as ConvergenceConditionalLoopGuard;
  return nonEmpty(item.scopeKey)
    && nonNegativeInteger(item.currentDepth)
    && nonNegativeInteger(item.maximumDepth)
    && nonNegativeInteger(item.usageCount)
    && nonNegativeInteger(item.usageLimit)
    && typeof item.passed === 'boolean'
    && item.currentDepth <= item.maximumDepth
    && item.usageCount <= item.usageLimit;
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
function nonNegativeInteger(value: unknown): value is number { return Number.isInteger(value) && Number(value) >= 0; }
function stringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every(nonEmpty); }
function timestamp(value: unknown): value is string { return nonEmpty(value) && !Number.isNaN(Date.parse(value)); }
function unique(values: string[]): string[] { return [...new Set(values)]; }
