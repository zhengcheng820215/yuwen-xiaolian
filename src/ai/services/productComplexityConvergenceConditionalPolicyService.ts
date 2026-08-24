import { evaluateConvergenceConditionalPolicy, type ConvergenceConditionalPolicyInput } from '../agents/productComplexityConvergenceConditionalPolicyAgent.ts';
import type { ProductComplexityConvergenceConditionalPolicyAuditRepository } from '../repositories/productComplexityConvergenceConditionalPolicyAuditRepository.ts';
import type {
  ConvergenceConditionalCapabilityFlags,
  ConvergenceConditionalPolicyAuditResult,
  ConvergenceConditionalPolicyRuntimeResult,
  ConvergenceConditionalSessionPolicySnapshot,
} from '../schemas/productComplexityConvergenceConditionalPolicy.schema.ts';

type WithoutMode<T> = T extends unknown ? Omit<T, 'mode'> : never;
export type ConvergenceConditionalPolicyRuntimeInput = WithoutMode<ConvergenceConditionalPolicyInput>;

export async function runConvergenceConditionalPolicy(input: {
  flags: ConvergenceConditionalCapabilityFlags;
  policyInput: ConvergenceConditionalPolicyRuntimeInput;
  sessionPolicySnapshot?: ConvergenceConditionalSessionPolicySnapshot;
  auditRepository?: ProductComplexityConvergenceConditionalPolicyAuditRepository;
}): Promise<ConvergenceConditionalPolicyRuntimeResult> {
  const snapshotMatches = !input.sessionPolicySnapshot
    || !input.policyInput.learningSessionId
    || input.sessionPolicySnapshot.learningSessionId === input.policyInput.learningSessionId;
  const effectiveFlags = snapshotMatches && input.sessionPolicySnapshot
    ? input.sessionPolicySnapshot.flags
    : input.flags;
  const flag = effectiveFlags[input.policyInput.capability];
  if (!snapshotMatches) {
    return {
      flag,
      effectiveOutcome: input.policyInput.ownerDecision.ownerMappedOutcome,
      ownerRemainsAuthority: true,
      runtimeIssue: 'session_policy_identity_mismatch',
    };
  }
  if (flag === 'legacy') {
    return {
      flag,
      effectiveOutcome: input.policyInput.ownerDecision.ownerMappedOutcome,
      ownerRemainsAuthority: true,
    };
  }
  let decision;
  try {
    decision = evaluateConvergenceConditionalPolicy({
      ...input.policyInput,
      mode: flag,
    } as ConvergenceConditionalPolicyInput);
  } catch (error) {
    return {
      flag,
      effectiveOutcome: input.policyInput.ownerDecision.ownerMappedOutcome,
      ownerRemainsAuthority: true,
      runtimeIssue: `policy_evaluation_failed:${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const audit = buildAudit(decision);
  if (input.auditRepository) {
    try { await input.auditRepository.save(decision); }
    catch (error) {
      audit.issues.push(`audit_write_failed:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return {
    flag,
    decision,
    audit,
    effectiveOutcome: decision.effectiveOutcome,
    ownerRemainsAuthority: true,
  };
}

function buildAudit(
  decision: ReturnType<typeof evaluateConvergenceConditionalPolicy>,
): ConvergenceConditionalPolicyAuditResult {
  const ownerMapped = decision.ownerDecision.ownerMappedOutcome;
  const behaviorAligned = ownerMapped === decision.convergedOutcome;
  const reasonAligned = !decision.ownerDecision.ownerReasonCode
    || decision.ownerDecision.ownerReasonCode === decision.reasonCode;
  const legacy = decision.reasonCode === 'legacy_unobserved';
  return {
    decisionId: decision.decisionId,
    capability: decision.capability,
    alignment: legacy ? 'insufficient_legacy_fact'
      : !behaviorAligned ? 'behavior_divergence'
        : !reasonAligned ? 'reason_divergence' : 'aligned',
    ownerOutcome: decision.ownerDecision.ownerOutcome,
    convergedOutcome: decision.convergedOutcome,
    effectiveOutcome: decision.effectiveOutcome,
    behaviorChanged: decision.mode === 'enforced' && ownerMapped !== decision.effectiveOutcome,
    protectedWriteCount: 0,
    issues: [...decision.validation.issues],
  };
}
