import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_POLICY_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_SCHEMA_VERSION,
  buildConvergenceConditionalDecisionIdentity,
  validateConvergenceConditionalPolicyDecision,
  type ConvergenceConditionalDecisionOutcome,
  type ConvergenceConditionalExpectedBenefitCode,
  type ConvergenceConditionalExitConditionCode,
  type ConvergenceConditionalFallbackCode,
  type ConvergenceConditionalLoopGuard,
  type ConvergenceConditionalOwnerDecisionRef,
  type ConvergenceConditionalPolicyDecision,
  type ConvergenceConditionalPolicyMode,
  type ConvergenceConditionalReasonCode,
  type ConvergenceConditionalSourceFactRef,
} from '../schemas/productComplexityConvergenceConditionalPolicy.schema.ts';

type CommonInput = {
  mode: ConvergenceConditionalPolicyMode;
  studentId: string;
  learningSessionId?: string;
  learningRoundId?: string;
  sourceAttemptId?: string;
  sourceResourceVersionId?: string;
  sourceFactRefs: ConvergenceConditionalSourceFactRef[];
  sourceEvidenceIds?: string[];
  ownerDecision: ConvergenceConditionalOwnerDecisionRef;
  loopGuard: ConvergenceConditionalLoopGuard;
  identitiesAligned: boolean;
  evaluatedAt: string;
  expectedBenefitDescription?: string;
};

export type RevisionConvergencePolicyInput = CommonInput & {
  capability: 'revision';
  facts: {
    taskRole: 'training' | 'retest' | 'transfer' | 'diagnosis' | 'observation';
    formalFeedbackReady: boolean;
    hasActionableGap: boolean;
    revisionNeeded: boolean;
    alreadyUsed: boolean;
    requiresFullRedo: boolean;
  };
};

export type TargetedConvergencePolicyInput = CommonInput & {
  capability: 'targeted';
  facts: {
    atomicGapConfirmed: boolean;
    formalResourceAvailable: boolean;
    duplicateObservation: boolean;
    sessionSuitable: boolean;
    revisionActive: boolean;
    alreadyUsedForGap: boolean;
    recursiveDepth: number;
  };
};

export type RetestConvergencePolicyInput = CommonInput & {
  capability: 'retest';
  facts: {
    due: boolean;
    evidenceSufficient: boolean;
    formalResourceAvailable: boolean;
    alreadyScheduled: boolean;
  };
};

export type TransferConvergencePolicyInput = CommonInput & {
  capability: 'transfer';
  facts: {
    stableIndependentEvidence: boolean;
    newContextAvailable: boolean;
    formalResourceAvailable: boolean;
    alreadyScheduled: boolean;
  };
};

export type ConvergenceConditionalPolicyInput =
  | RevisionConvergencePolicyInput
  | TargetedConvergencePolicyInput
  | RetestConvergencePolicyInput
  | TransferConvergencePolicyInput;

type PolicyConclusion = {
  outcome: ConvergenceConditionalDecisionOutcome;
  reasonCode: ConvergenceConditionalReasonCode;
  secondaryReasonCodes?: ConvergenceConditionalReasonCode[];
  benefitCode?: ConvergenceConditionalExpectedBenefitCode;
  exitConditionCode?: ConvergenceConditionalExitConditionCode;
  fallbackCode: ConvergenceConditionalFallbackCode;
};

export function evaluateConvergenceConditionalPolicy(
  input: ConvergenceConditionalPolicyInput,
): ConvergenceConditionalPolicyDecision {
  const conclusion = decide(input);
  const effectiveOutcome = input.mode === 'shadow'
    ? input.ownerDecision.ownerMappedOutcome
    : conclusion.outcome;
  const identity = buildConvergenceConditionalDecisionIdentity({
    capability: input.capability,
    studentId: input.studentId,
    ownerId: input.ownerDecision.ownerId,
    ownerPolicyVersion: input.ownerDecision.ownerPolicyVersion,
    stableInput: {
      capability: input.capability,
      studentId: input.studentId,
      learningSessionId: input.learningSessionId || null,
      learningRoundId: input.learningRoundId || null,
      sourceAttemptId: input.sourceAttemptId || null,
      sourceResourceVersionId: input.sourceResourceVersionId || null,
      sourceFactRefs: uniqueFactRefs(input.sourceFactRefs),
      sourceEvidenceIds: uniqueStrings(input.sourceEvidenceIds || []),
      ownerDecision: input.ownerDecision,
      loopGuard: input.loopGuard,
      identitiesAligned: input.identitiesAligned,
      facts: input.facts,
    },
  });
  const base = {
    schemaVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_SCHEMA_VERSION,
    policyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_POLICY_VERSION,
    ...identity,
    persistenceRole: 'audit_projection' as const,
    mode: input.mode,
    capability: input.capability,
    studentId: input.studentId,
    ...(input.learningSessionId ? { learningSessionId: input.learningSessionId } : {}),
    ...(input.learningRoundId ? { learningRoundId: input.learningRoundId } : {}),
    ...(input.sourceAttemptId ? { sourceAttemptId: input.sourceAttemptId } : {}),
    ...(input.sourceResourceVersionId ? { sourceResourceVersionId: input.sourceResourceVersionId } : {}),
    sourceFactRefs: uniqueFactRefs(input.sourceFactRefs),
    sourceEvidenceIds: uniqueStrings(input.sourceEvidenceIds || []),
    ownerDecision: input.ownerDecision,
    convergedOutcome: conclusion.outcome,
    effectiveOutcome,
    reasonCode: conclusion.reasonCode,
    secondaryReasonCodes: uniqueReasonCodes(conclusion.secondaryReasonCodes || []),
    ...(conclusion.benefitCode ? { expectedBenefitCode: conclusion.benefitCode } : {}),
    ...(input.expectedBenefitDescription?.trim()
      ? { expectedBenefitDescription: input.expectedBenefitDescription.trim() } : {}),
    ...(conclusion.exitConditionCode ? { exitConditionCode: conclusion.exitConditionCode } : {}),
    fallbackCode: conclusion.fallbackCode,
    loopGuard: input.loopGuard,
    evaluatedAt: input.evaluatedAt,
  };
  const validationIssues = validateConvergenceConditionalPolicyDecision({
    ...base,
    validation: { passed: true, issues: [] },
  });
  return {
    ...base,
    validation: { passed: validationIssues.length === 0, issues: validationIssues },
  };
}

function decide(input: ConvergenceConditionalPolicyInput): PolicyConclusion {
  if (!input.identitiesAligned) return blocked('identity_mismatch', input);
  if (!input.sourceFactRefs.length) return blocked('source_fact_missing', input);
  if (!input.loopGuard.passed) {
    return blocked(input.loopGuard.currentDepth > input.loopGuard.maximumDepth
      ? 'recursive_chain_blocked'
      : limitReason(input.capability), input);
  }
  if (input.capability === 'revision') return decideRevision(input);
  if (input.capability === 'targeted') return decideTargeted(input);
  if (input.capability === 'retest') return decideRetest(input);
  return decideTransfer(input);
}

function decideRevision(input: RevisionConvergencePolicyInput): PolicyConclusion {
  if (input.facts.taskRole !== 'training') return noAction('revision_role_ineligible');
  if (input.facts.alreadyUsed) return noAction('revision_already_used');
  if (!input.facts.formalFeedbackReady || !input.facts.hasActionableGap || input.facts.requiresFullRedo) {
    return noAction('revision_no_actionable_gap');
  }
  if (!input.facts.revisionNeeded) return noAction('revision_not_needed');
  return ownerBackedTrigger(input, {
    reasonCode: 'revision_actionable_gap', benefitCode: 'resolve_revision_gap',
    exitConditionCode: 'revision_submitted_or_declined', fallbackCode: 'continue_core_queue',
  });
}

function decideTargeted(input: TargetedConvergencePolicyInput): PolicyConclusion {
  if (input.facts.revisionActive) return noAction('targeted_intervention_conflict');
  if (input.facts.recursiveDepth > 0) return blocked('recursive_chain_blocked', input);
  if (input.facts.alreadyUsedForGap) return noAction('targeted_limit_reached');
  if (!input.facts.atomicGapConfirmed || input.facts.duplicateObservation) return noAction('targeted_gap_not_atomic');
  if (!input.facts.sessionSuitable) return noAction('targeted_session_unsuitable');
  if (!input.facts.formalResourceAvailable) return noAction('targeted_resource_unavailable');
  return ownerBackedTrigger(input, {
    reasonCode: 'targeted_atomic_gap_confirmed', benefitCode: 'isolate_atomic_gap',
    exitConditionCode: 'targeted_completed_skipped_or_unavailable', fallbackCode: 'continue_core_queue',
  });
}

function decideRetest(input: RetestConvergencePolicyInput): PolicyConclusion {
  if (input.facts.alreadyScheduled) return noAction('retest_already_scheduled', 'keep_existing_schedule');
  if (!input.facts.evidenceSufficient) return noAction('retest_evidence_insufficient');
  if (!input.facts.due) return {
    outcome: 'defer', reasonCode: 'retest_not_due', fallbackCode: 'wait_until_due',
  };
  if (!input.facts.formalResourceAvailable) return noAction('retest_resource_unavailable');
  return ownerBackedTrigger(input, {
    reasonCode: 'retest_due', benefitCode: 'verify_independent_retention',
    exitConditionCode: 'retest_completed_cancelled_or_rescheduled', fallbackCode: 'continue_core_queue',
  });
}

function decideTransfer(input: TransferConvergencePolicyInput): PolicyConclusion {
  if (input.facts.alreadyScheduled) return noAction('transfer_already_scheduled', 'keep_existing_schedule');
  if (!input.facts.stableIndependentEvidence) return noAction('transfer_foundation_not_stable');
  if (!input.facts.newContextAvailable || !input.facts.formalResourceAvailable) {
    return noAction('transfer_new_context_unavailable');
  }
  return ownerBackedTrigger(input, {
    reasonCode: 'transfer_stable_basis_ready', benefitCode: 'verify_transfer',
    exitConditionCode: 'transfer_completed_cancelled_or_superseded', fallbackCode: 'continue_core_queue',
  });
}

function ownerBackedTrigger(
  input: ConvergenceConditionalPolicyInput,
  conclusion: Omit<PolicyConclusion, 'outcome'>,
): PolicyConclusion {
  if (input.ownerDecision.ownerMappedOutcome !== 'trigger') {
    return {
      outcome: 'no_action', reasonCode: 'policy_input_invalid',
      secondaryReasonCodes: [conclusion.reasonCode], fallbackCode: 'continue_core_queue',
    };
  }
  return { outcome: 'trigger', ...conclusion };
}

function blocked(
  reasonCode: ConvergenceConditionalReasonCode,
  input: ConvergenceConditionalPolicyInput,
): PolicyConclusion {
  return {
    outcome: 'blocked', reasonCode,
    fallbackCode: input.ownerDecision.ownerMappedOutcome === 'trigger'
      ? 'preserve_active_owner_flow' : 'continue_core_queue',
  };
}

function noAction(
  reasonCode: ConvergenceConditionalReasonCode,
  fallbackCode: ConvergenceConditionalFallbackCode = 'continue_core_queue',
): PolicyConclusion { return { outcome: 'no_action', reasonCode, fallbackCode }; }

function limitReason(capability: ConvergenceConditionalPolicyInput['capability']): ConvergenceConditionalReasonCode {
  if (capability === 'revision') return 'revision_already_used';
  if (capability === 'targeted') return 'targeted_limit_reached';
  if (capability === 'retest') return 'retest_already_scheduled';
  return 'transfer_already_scheduled';
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueReasonCodes(values: ConvergenceConditionalReasonCode[]): ConvergenceConditionalReasonCode[] {
  return [...new Set(values)];
}

function uniqueFactRefs(values: ConvergenceConditionalSourceFactRef[]): ConvergenceConditionalSourceFactRef[] {
  const result = new Map<string, ConvergenceConditionalSourceFactRef>();
  values.forEach((item) => {
    const key = `${item.factType}:${item.factId}:${item.factSchemaVersion || ''}`;
    if (!result.has(key)) result.set(key, item);
  });
  return [...result.values()];
}
