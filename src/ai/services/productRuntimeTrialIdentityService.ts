import type { ProductComplexityConvergenceObservationRepository } from
  '../repositories/productComplexityConvergenceObservationRepository.ts';
import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_AUDIT_V2_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_V2_VERSION,
  validateConvergenceActivationState,
  type ConvergenceObservationActivationAuditV2,
  type ConvergenceObservationActivationState,
  type ConvergenceObservationActivationStateV2,
} from '../schemas/productComplexityConvergenceTrialPreflight.schema.ts';
import type {
  ProductRuntimeIdentity,
  RealTrialRuntimeIdentityBinding,
  TrialRuntimeIdentityAlignment,
} from '../schemas/productRuntimeIdentity.schema.ts';
import {
  validateProductRuntimeIdentity,
  validateRealTrialRuntimeIdentityBinding,
} from '../schemas/productRuntimeIdentity.schema.ts';
import { stableConvergenceHash, stableConvergenceSerialize } from
  '../schemas/productComplexityConvergenceObservation.schema.ts';

export type ProductRuntimeTrialIdentityDecision = {
  alignment: TrialRuntimeIdentityAlignment;
  learningAllowed: true;
  observationAllowed: boolean;
  invalidationRequired: boolean;
  reasonCodes: string[];
  projectedState: ConvergenceObservationActivationState;
};

export type ProductRuntimeTrialInvalidationResult = ProductRuntimeTrialIdentityDecision & {
  stateWriteCount: 0 | 1;
  auditWriteCount: 0 | 1;
};

export function resolveProductRuntimeTrialIdentity(input: {
  activationState: ConvergenceObservationActivationState;
  currentIdentity?: ProductRuntimeIdentity;
  binding?: RealTrialRuntimeIdentityBinding;
  now: string;
}): ProductRuntimeTrialIdentityDecision {
  const comparison = compareIdentity({
    currentIdentity: input.currentIdentity,
    binding: input.binding,
  });
  if (input.activationState.effectiveMode === 'off') return {
    alignment: comparison.alignment,
    learningAllowed: true,
    observationAllowed: false,
    invalidationRequired: false,
    reasonCodes: comparison.reasonCodes,
    projectedState: input.activationState,
  };
  if (comparison.alignment === 'aligned') return {
    alignment: 'aligned', learningAllowed: true, observationAllowed: true,
    invalidationRequired: false, reasonCodes: [], projectedState: input.activationState,
  };
  const reasonCodes = [...new Set([...comparison.reasonCodes, 'trial_runtime_identity_invalidated'])];
  const projectedState: ConvergenceObservationActivationStateV2 = {
    ...input.activationState,
    activationStateVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_V2_VERSION,
    effectiveMode: 'off',
    invalidatedRuntimeIdentityDigest: input.currentIdentity?.runtimeIdentityDigest,
    deactivatedAt: input.now,
    invalidatedAt: input.now,
    reasonCodes,
    updatedAt: input.now,
  };
  return {
    alignment: comparison.alignment,
    learningAllowed: true,
    observationAllowed: false,
    invalidationRequired: true,
    reasonCodes,
    projectedState,
  };
}

export async function applyProductRuntimeTrialInvalidation(input: {
  repository: ProductComplexityConvergenceObservationRepository;
  currentIdentity?: ProductRuntimeIdentity;
  binding?: RealTrialRuntimeIdentityBinding;
  now: string;
}): Promise<ProductRuntimeTrialInvalidationResult> {
  const current = await input.repository.getActivationState();
  if (!current) return {
    alignment: input.currentIdentity ? 'legacy_unverifiable' : 'missing',
    learningAllowed: true, observationAllowed: false, invalidationRequired: false,
    reasonCodes: ['activation_state_missing'],
    projectedState: defaultOff(input.now), stateWriteCount: 0, auditWriteCount: 0,
  };
  const decision = resolveProductRuntimeTrialIdentity({
    activationState: current,
    currentIdentity: input.currentIdentity,
    binding: input.binding,
    now: input.now,
  });
  if (!decision.invalidationRequired) return { ...decision, stateWriteCount: 0, auditWriteCount: 0 };
  const latest = await input.repository.getActivationState();
  if (!latest || latest.effectiveMode === 'off'
    || latest.launchRecordId !== current.launchRecordId
    || latest.updatedAt !== current.updatedAt) return {
    ...decision,
    projectedState: latest || decision.projectedState,
    invalidationRequired: false,
    stateWriteCount: 0,
    auditWriteCount: 0,
  };
  const issues = validateConvergenceActivationState(decision.projectedState);
  if (issues.length) throw new Error(`runtime_identity_invalidation_state_invalid:${issues.join(',')}`);
  await input.repository.saveActivationState(decision.projectedState);
  const audit = buildInvalidationAudit({
    state: decision.projectedState,
    previousRuntimeIdentityDigest: input.binding?.runtimeIdentityDigest,
    currentRuntimeIdentityDigest: input.currentIdentity?.runtimeIdentityDigest,
    reasonCodes: decision.reasonCodes,
    now: input.now,
  });
  const auditResult = await input.repository.appendActivationAudit(audit);
  return { ...decision, stateWriteCount: 1, auditWriteCount: auditResult === 'inserted' ? 1 : 0 };
}

function buildInvalidationAudit(input: {
  state: ConvergenceObservationActivationState;
  previousRuntimeIdentityDigest?: string;
  currentRuntimeIdentityDigest?: string;
  reasonCodes: string[];
  now: string;
}): ConvergenceObservationActivationAuditV2 {
  const facts = {
    action: 'invalidated' as const,
    requestedMode: input.state.requestedMode,
    effectiveMode: 'off' as const,
    trialWindowId: input.state.trialWindowId,
    launchRecordId: input.state.launchRecordId,
    previousRuntimeIdentityDigest: input.previousRuntimeIdentityDigest,
    currentRuntimeIdentityDigest: input.currentRuntimeIdentityDigest,
    reasonCodes: input.reasonCodes,
    occurredAt: input.now,
  };
  return {
    auditVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_AUDIT_V2_VERSION,
    auditId: `runtime-identity-invalidation-${stableConvergenceHash(stableConvergenceSerialize(facts))}`,
    ...facts,
  };
}

function compareIdentity(input: {
  currentIdentity?: ProductRuntimeIdentity;
  binding?: RealTrialRuntimeIdentityBinding;
}): { alignment: TrialRuntimeIdentityAlignment; reasonCodes: string[] } {
  if (!input.currentIdentity) return { alignment: 'missing', reasonCodes: ['runtime_identity_missing'] };
  const identityIssues = validateProductRuntimeIdentity(input.currentIdentity);
  if (identityIssues.length) return { alignment: 'invalid', reasonCodes: identityIssues };
  if (input.currentIdentity.evidence.worktreeState !== 'clean') return { alignment: 'dirty', reasonCodes: ['runtime_identity_dirty'] };
  if (!input.binding) return { alignment: 'legacy_unverifiable', reasonCodes: ['trial_runtime_identity_binding_missing', 'legacy_launch_identity_unverifiable'] };
  const bindingIssues = validateRealTrialRuntimeIdentityBinding(input.binding);
  if (bindingIssues.length) return { alignment: 'invalid', reasonCodes: bindingIssues };
  const aligned = input.binding.runtimeIdentityDigest === input.currentIdentity.runtimeIdentityDigest
    && input.binding.runtimeIdentityVersion === input.currentIdentity.runtimeIdentityVersion
    && input.binding.formalResourceSnapshotDigest
      === input.currentIdentity.identityInputs.formalResourceSnapshotDigest
    && input.binding.executablePolicyBundleDigest
      === input.currentIdentity.identityInputs.executablePolicyBundleDigest
    && input.binding.trialPolicyBundleDigest
      === input.currentIdentity.identityInputs.trialPolicyBundleDigest;
  return aligned
    ? { alignment: 'aligned', reasonCodes: [] }
    : { alignment: 'mismatch', reasonCodes: ['runtime_identity_mismatch'] };
}

function defaultOff(now: string): ConvergenceObservationActivationStateV2 {
  return {
    activationStateVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_V2_VERSION,
    activationStateId: 'product-complexity-convergence-stage4-current',
    requestedMode: 'off', effectiveMode: 'off', reasonCodes: ['default_off'], updatedAt: now,
  };
}
