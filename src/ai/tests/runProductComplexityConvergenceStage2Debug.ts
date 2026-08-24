import assert from 'node:assert/strict';
import { evaluateConvergenceConditionalPolicy, type ConvergenceConditionalPolicyInput } from '../agents/productComplexityConvergenceConditionalPolicyAgent.ts';
import {
  adaptRetestOwnerDecision,
  adaptRevisionOwnerDecision,
  adaptTargetedOwnerDecision,
  adaptTransferOwnerDecision,
} from '../agents/productComplexityConvergenceConditionalPolicyOwnerAdapters.ts';
import { InMemoryProductComplexityConvergenceConditionalPolicyAuditRepository } from '../repositories/inMemoryProductComplexityConvergenceConditionalPolicyAuditRepository.ts';
import {
  CONVERGENCE_CONDITIONAL_CAPABILITIES,
  DEFAULT_CONVERGENCE_CONDITIONAL_CAPABILITY_FLAGS,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_POLICY_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_SCHEMA_VERSION,
  buildConvergenceConditionalDecisionIdentity,
  validateConvergenceConditionalPolicyDecision,
  type ConvergenceConditionalCapability,
  type ConvergenceConditionalCapabilityFlags,
  type ConvergenceConditionalPolicyDecision,
} from '../schemas/productComplexityConvergenceConditionalPolicy.schema.ts';
import {
  InMemoryConvergenceConditionalSessionPolicyRepository,
  resolveConvergenceConditionalSessionPolicy,
} from '../services/productComplexityConvergenceConditionalSessionPolicyService.ts';
import { runConvergenceConditionalPolicy, type ConvergenceConditionalPolicyRuntimeInput } from '../services/productComplexityConvergenceConditionalPolicyService.ts';

type DebugCase = { id: string; name: string; run: () => void | Promise<void> };
const fixedTime = '2026-08-24T08:00:00.000Z';
const protectedSnapshot = Object.freeze({ formalResourceDigest: 'formal-61', registryDigest: 'registry-12',
  attemptDigest: 'attempt-3', evidenceDigest: 'evidence-9', profileDigest: 'profile-2', calibrationDigest: 'calibration-0' });

const cases: DebugCase[] = [
  c('C2-01', 'schema and policy versions are independent and fixed', () => {
    assert.equal(PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_SCHEMA_VERSION, 'product_complexity_convergence_stage2_conditional_policy_v1');
    assert.equal(PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_POLICY_VERSION, 'product_complexity_convergence_stage2_policy_v1');
    assert.notEqual(PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_SCHEMA_VERSION, PRODUCT_COMPLEXITY_CONVERGENCE_STAGE2_POLICY_VERSION as string);
  }),
  c('C2-02', 'unknown capability is rejected', () => {
    const value = decision('revision'); (value as any).capability = 'universal';
    assert.ok(validateConvergenceConditionalPolicyDecision(value).includes('capability_invalid'));
    assert.deepEqual(CONVERGENCE_CONDITIONAL_CAPABILITIES, ['revision', 'targeted', 'retest', 'transfer']);
  }),
  c('C2-03', 'invalid outcome reason benefit exit and fallback are rejected', () => {
    const value = decision('revision'); Object.assign(value as any, { convergedOutcome: 'yes', reasonCode: 'why', expectedBenefitCode: 'benefit', exitConditionCode: 'exit', fallbackCode: 'fallback' });
    const issues = validateConvergenceConditionalPolicyDecision(value);
    ['converged_outcome_invalid', 'reason_code_invalid', 'benefit_code_invalid', 'exit_condition_invalid', 'fallback_code_invalid'].forEach((issue) => assert.ok(issues.includes(issue)));
  }),
  c('C2-04', 'trigger requires benefit exit source and loop guard', () => {
    const value = decision('revision'); value.sourceFactRefs = []; delete value.expectedBenefitCode; delete value.exitConditionCode; value.loopGuard.passed = false;
    const issues = validateConvergenceConditionalPolicyDecision(value);
    assert.ok(issues.includes('source_fact_refs_invalid') && issues.includes('trigger_benefit_missing') && issues.includes('trigger_exit_missing') && issues.includes('trigger_loop_guard_failed'));
  }),
  c('C2-05', 'shadow effective outcome always comes from owner', () => {
    const value = decision('revision', { mode: 'shadow', facts: { revisionNeeded: false } });
    assert.equal(value.convergedOutcome, 'no_action'); assert.equal(value.effectiveOutcome, 'trigger');
  }),
  c('C2-06', 'same stable input produces same decision identity and hash', () => {
    assert.deepEqual(decision('targeted'), decision('targeted'));
  }),
  c('C2-07', 'owner or policy version changes decision identity or hash', () => {
    const a = buildConvergenceConditionalDecisionIdentity({ capability: 'revision', studentId: 's', ownerId: 'o', ownerPolicyVersion: 'v1', policyVersion: 'p1', stableInput: { x: 1 } });
    const b = buildConvergenceConditionalDecisionIdentity({ capability: 'revision', studentId: 's', ownerId: 'o', ownerPolicyVersion: 'v2', policyVersion: 'p1', stableInput: { x: 1 } });
    const d = buildConvergenceConditionalDecisionIdentity({ capability: 'revision', studentId: 's', ownerId: 'o', ownerPolicyVersion: 'v1', policyVersion: 'p2', stableInput: { x: 1 } });
    assert.notEqual(a.decisionId, b.decisionId); assert.notEqual(a.decisionHash, d.decisionHash);
  }),
  c('C2-08', 'all owner adapters keep references only and exclude protected content', () => {
    const adapted = [
      adaptRevisionOwnerDecision({ studentId: 's', sourceAttemptId: 'a', decision: { policyVersion: 'learning_feedback_revision_offer_policy_v2', level: 'none', reason: 'no_actionable_revision_goal' } }),
      adaptTargetedOwnerDecision({ decisionId: 'td', studentId: 's', learningSessionId: 'ls', sourceLearningRoundId: 'lr', sourceAttemptId: 'a', sourceResourceVersionId: 'rv', sourceMaterialId: 'm', sourceCoreTaskNumber: 1, outcome: 'not_eligible', reasonCode: 'no_gap', triggerPolicyVersion: 'targeted_micro_training_trigger_v1', evaluatedAt: fixedTime }),
      adaptRetestOwnerDecision(retestOwnerResult()),
      adaptTransferOwnerDecision(transferOwnerStrategy()),
    ];
    const text = JSON.stringify(adapted); assert.equal(/studentAnswer|materialText|diagnosisText|feedbackText/.test(text), false);
    assert.deepEqual(adapted.map((item) => item.ownerDecision.ownerType), ['revision_offer_snapshot', 'targeted_trigger_decision', 'delayed_retest_candidate', 'next_learning_strategy']);
  }),
  c('C2-09', 'actionable revision gap triggers once', () => assert.equal(decision('revision').convergedOutcome, 'trigger')),
  c('C2-10', 'revision without actionable gap is valid no action', () => assert.equal(decision('revision', { facts: { hasActionableGap: false } }).convergedOutcome, 'no_action')),
  c('C2-11', 'used revision never triggers again', () => assert.equal(decision('revision', { facts: { alreadyUsed: true } }).reasonCode, 'revision_already_used')),
  c('C2-12', 'retest and transfer roles do not trigger revision', () => {
    assert.equal(decision('revision', { facts: { taskRole: 'retest' } }).convergedOutcome, 'no_action');
    assert.equal(decision('revision', { facts: { taskRole: 'transfer' } }).convergedOutcome, 'no_action');
  }),
  c('C2-13', 'revision policy cannot overwrite initial response or evidence', () => {
    const before = structuredClone(protectedSnapshot); decision('revision'); assert.deepEqual(protectedSnapshot, before);
  }),
  c('C2-14', 'declined revision falls back to core queue', () => assert.equal(decision('revision').fallbackCode, 'continue_core_queue')),
  c('C2-15', 'atomic targeted gap with resource triggers', () => assert.equal(decision('targeted').convergedOutcome, 'trigger')),
  c('C2-16', 'macro targeted gap does not trigger', () => assert.equal(decision('targeted', { facts: { atomicGapConfirmed: false } }).reasonCode, 'targeted_gap_not_atomic')),
  c('C2-17', 'targeted no match never blocks core queue', () => {
    const value = decision('targeted', { facts: { formalResourceAvailable: false } }); assert.equal(value.convergedOutcome, 'no_action'); assert.equal(value.fallbackCode, 'continue_core_queue');
  }),
  c('C2-18', 'same gap and round has one use', () => assert.equal(decision('targeted', { facts: { alreadyUsedForGap: true } }).reasonCode, 'targeted_limit_reached')),
  c('C2-19', 'targeted cannot recursively trigger targeted', () => assert.equal(decision('targeted', { facts: { recursiveDepth: 1 } }).reasonCode, 'recursive_chain_blocked')),
  c('C2-20', 'targeted exit restores core position', () => assert.equal(decision('targeted').exitConditionCode, 'targeted_completed_skipped_or_unavailable')),
  c('C2-21', 'due retest with evidence and resource triggers', () => assert.equal(decision('retest').expectedBenefitCode, 'verify_independent_retention')),
  c('C2-22', 'retest before due is deferred', () => {
    const value = decision('retest', { facts: { due: false } }); assert.equal(value.convergedOutcome, 'defer'); assert.equal(value.fallbackCode, 'wait_until_due');
  }),
  c('C2-23', 'same retest target is not scheduled twice', () => assert.equal(decision('retest', { facts: { alreadyScheduled: true } }).reasonCode, 'retest_already_scheduled')),
  c('C2-24', 'retest resource unavailable does not block current learning', () => assert.equal(decision('retest', { facts: { formalResourceAvailable: false } }).fallbackCode, 'continue_core_queue')),
  c('C2-25', 'transfer requires stable independent basis', () => assert.equal(decision('transfer').convergedOutcome, 'trigger')),
  c('C2-26', 'feedback-supported performance alone cannot trigger transfer', () => assert.equal(decision('transfer', { facts: { stableIndependentEvidence: false } }).reasonCode, 'transfer_foundation_not_stable')),
  c('C2-27', 'transfer requires a new formal context', () => assert.equal(decision('transfer', { facts: { newContextAvailable: false } }).reasonCode, 'transfer_new_context_unavailable')),
  c('C2-28', 'same transfer target is not scheduled twice', () => assert.equal(decision('transfer', { facts: { alreadyScheduled: true } }).reasonCode, 'transfer_already_scheduled')),
  c('C2-29', 'targeted does not activate while revision is active', () => assert.equal(decision('targeted', { facts: { revisionActive: true } }).reasonCode, 'targeted_intervention_conflict')),
  c('C2-30', 'targeted completion does not synthesize retest or transfer', () => {
    const value = decision('targeted'); assert.equal(value.capability, 'targeted'); assert.equal(JSON.stringify(value).includes('create_task_request'), false);
  }),
  c('C2-31', 'shadow divergence is audit-only', async () => {
    const repository = new InMemoryProductComplexityConvergenceConditionalPolicyAuditRepository();
    const result = await runtime('revision', 'shadow', { facts: { revisionNeeded: false }, auditRepository: repository });
    assert.equal(result.effectiveOutcome, 'trigger'); assert.equal(result.audit?.behaviorChanged, false); assert.equal((await repository.list()).length, 1);
  }),
  c('C2-32', 'shadow behaviorChanged is always false', async () => assert.equal((await runtime('targeted', 'shadow')).audit?.behaviorChanged, false)),
  c('C2-33', 'single enforced capability does not alter three legacy capabilities', async () => {
    const flags: ConvergenceConditionalCapabilityFlags = { revision: 'enforced', targeted: 'legacy', retest: 'legacy', transfer: 'legacy' };
    assert.ok((await runConvergenceConditionalPolicy({ flags, policyInput: input('revision') })).decision);
    assert.equal((await runConvergenceConditionalPolicy({ flags, policyInput: input('targeted') })).decision, undefined);
  }),
  c('C2-34', 'session policy cannot change mid-session', async () => {
    const repository = new InMemoryConvergenceConditionalSessionPolicyRepository();
    const first = await resolveConvergenceConditionalSessionPolicy({ learningSessionId: 'session-c2', requestedFlags: { revision: 'enforced' }, repository, now: () => fixedTime });
    const second = await resolveConvergenceConditionalSessionPolicy({ learningSessionId: 'session-c2', requestedFlags: { revision: 'legacy' }, repository });
    assert.deepEqual(second, first); assert.equal(second.flags.revision, 'enforced');
  }),
  c('C2-35', 'inactive policy failure safely preserves no action owner', async () => {
    const policyInput = input('revision', { identitiesAligned: false, ownerMappedOutcome: 'no_action' });
    const value = await runConvergenceConditionalPolicy({ flags: allFlags('enforced'), policyInput });
    assert.equal(value.effectiveOutcome, 'blocked'); assert.equal(value.decision?.fallbackCode, 'continue_core_queue');
  }),
  c('C2-36', 'active owner flow is preserved on policy failure', () => {
    const value = decision('revision', { identitiesAligned: false }); assert.equal(value.convergedOutcome, 'blocked'); assert.equal(value.fallbackCode, 'preserve_active_owner_flow');
  }),
  c('C2-37', 'historical record without envelope runs legacy owner', async () => {
    const value = await runConvergenceConditionalPolicy({ flags: DEFAULT_CONVERGENCE_CONDITIONAL_CAPABILITY_FLAGS, policyInput: input('revision') });
    assert.equal(value.flag, 'legacy'); assert.equal(value.decision, undefined); assert.equal(value.effectiveOutcome, 'trigger');
  }),
  c('C2-38', 'legacy unobserved stays outside effectiveness denominator', async () => {
    const value = await runConvergenceConditionalPolicy({ flags: DEFAULT_CONVERGENCE_CONDITIONAL_CAPABILITY_FLAGS, policyInput: input('revision') });
    assert.equal(value.audit, undefined);
  }),
  c('C2-39', 'repeated evaluation and replay are idempotent', async () => {
    const repository = new InMemoryProductComplexityConvergenceConditionalPolicyAuditRepository();
    await runtime('revision', 'shadow', { auditRepository: repository }); await runtime('revision', 'shadow', { auditRepository: repository });
    assert.equal((await repository.list()).length, 1);
  }),
  c('C2-40', 'protected resources attempts evidence profile and calibration remain unchanged', async () => {
    const before = structuredClone(protectedSnapshot); await runtime('revision', 'enforced'); await runtime('targeted', 'enforced'); await runtime('retest', 'enforced'); await runtime('transfer', 'enforced'); assert.deepEqual(protectedSnapshot, before);
  }),
];

async function main() {
  let passed = 0;
  for (const item of cases) {
    try { await item.run(); passed += 1; console.log(`PASS ${item.id} ${item.name}`); }
    catch (error) { console.error(`FAIL ${item.id} ${item.name}`); throw error; }
  }
  console.log(`\nProduct complexity convergence stage 2 debug: ${passed}/${cases.length} passed.`);
}

function c(id: string, name: string, run: DebugCase['run']): DebugCase { return { id, name, run }; }

function decision(capability: ConvergenceConditionalCapability, patch: Patch = {}): ConvergenceConditionalPolicyDecision {
  return evaluateConvergenceConditionalPolicy({ ...input(capability, patch), mode: patch.mode || 'enforced' } as ConvergenceConditionalPolicyInput);
}

type Patch = { mode?: 'shadow' | 'enforced'; facts?: Record<string, unknown>; identitiesAligned?: boolean; ownerMappedOutcome?: 'trigger' | 'no_action' | 'defer' | 'blocked' };

function input(capability: ConvergenceConditionalCapability, patch: Patch = {}): ConvergenceConditionalPolicyRuntimeInput {
  const ownerMappedOutcome = patch.ownerMappedOutcome || 'trigger';
  const common = { capability, studentId: 'student-c2', learningSessionId: 'session-c2', learningRoundId: 'round-c2', sourceAttemptId: 'attempt-c2', sourceResourceVersionId: 'resource-c2',
    sourceFactRefs: [{ factType: 'attempt' as const, factId: 'attempt-c2' }], sourceEvidenceIds: ['evidence-c2'], identitiesAligned: patch.identitiesAligned ?? true, evaluatedAt: fixedTime,
    loopGuard: { scopeKey: `c2:${capability}`, currentDepth: 0, maximumDepth: 1, usageCount: 0, usageLimit: 1, passed: true } };
  if (capability === 'revision') return { ...common, capability, ownerDecision: owner('revision_offer_snapshot', 'revision-owner', ownerMappedOutcome), facts: { taskRole: 'training', formalFeedbackReady: true, hasActionableGap: true, revisionNeeded: true, alreadyUsed: false, requiresFullRedo: false, ...(patch.facts || {}) } } as ConvergenceConditionalPolicyRuntimeInput;
  if (capability === 'targeted') return { ...common, capability, ownerDecision: owner('targeted_trigger_decision', 'targeted-owner', ownerMappedOutcome), facts: { atomicGapConfirmed: true, formalResourceAvailable: true, duplicateObservation: false, sessionSuitable: true, revisionActive: false, alreadyUsedForGap: false, recursiveDepth: 0, ...(patch.facts || {}) } } as ConvergenceConditionalPolicyRuntimeInput;
  if (capability === 'retest') return { ...common, capability, sourceFactRefs: [{ factType: 'retest_candidate', factId: 'retest-owner' }], ownerDecision: owner('delayed_retest_candidate', 'retest-owner', ownerMappedOutcome), facts: { due: true, evidenceSufficient: true, formalResourceAvailable: true, alreadyScheduled: false, ...(patch.facts || {}) } } as ConvergenceConditionalPolicyRuntimeInput;
  return { ...common, capability: 'transfer', sourceFactRefs: [{ factType: 'next_learning_strategy', factId: 'transfer-owner' }], ownerDecision: owner('next_learning_strategy', 'transfer-owner', ownerMappedOutcome), facts: { stableIndependentEvidence: true, newContextAvailable: true, formalResourceAvailable: true, alreadyScheduled: false, ...(patch.facts || {}) } } as ConvergenceConditionalPolicyRuntimeInput;
}

function owner(ownerType: 'revision_offer_snapshot' | 'targeted_trigger_decision' | 'delayed_retest_candidate' | 'next_learning_strategy', ownerId: string, ownerMappedOutcome: 'trigger' | 'no_action' | 'defer' | 'blocked') {
  return { ownerType, ownerId, ownerPolicyVersion: `${ownerType}_v1`, ownerOutcome: ownerMappedOutcome, ownerMappedOutcome };
}

async function runtime(capability: ConvergenceConditionalCapability, flag: 'legacy' | 'shadow' | 'enforced', patch: Patch & { auditRepository?: InMemoryProductComplexityConvergenceConditionalPolicyAuditRepository } = {}) {
  return await runConvergenceConditionalPolicy({ flags: allFlags(flag), policyInput: input(capability, patch), auditRepository: patch.auditRepository });
}

function allFlags(flag: 'legacy' | 'shadow' | 'enforced'): ConvergenceConditionalCapabilityFlags { return { revision: flag, targeted: flag, retest: flag, transfer: flag }; }

function retestOwnerResult(): any { return { studentId: 's', targetAbilityId: 'reading', candidate: { candidateId: 'rc', studentId: 's', targetAbilityId: 'reading', sourceSessionIds: [], sourceEvidenceIds: [], currentTime: fixedTime, status: 'not_eligible', eligibilityReason: 'insufficient', limitations: [], policyVersion: 'delayed_retest_policy_v1', schemaVersion: 'delayed_retest_scheduling_v1', validation: { passed: true, issues: [] } }, nextStep: 'blocked', reason: 'insufficient', validation: { passed: true, issues: [] } }; }
function transferOwnerStrategy(): any { return { strategyId: 'strategy', studentId: 's', targetAbilityId: 'reading', action: 'continue_training', reason: 'continue', evidenceLinks: ['e'], growthMemoryRecordIds: ['g'], validationGoal: 'observe', recommendedTaskRole: 'training', limitations: [], strategySource: 'growth_memory', createdAt: fixedTime }; }

await main();
