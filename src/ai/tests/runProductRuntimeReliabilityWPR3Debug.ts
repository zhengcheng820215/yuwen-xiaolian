import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import { InMemoryProductComplexityConvergenceObservationRepository } from '../repositories/inMemoryProductComplexityConvergenceObservationRepository.ts';
import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_VERSION,
  type ConvergenceObservationActivationState,
} from '../schemas/productComplexityConvergenceTrialPreflight.schema.ts';
import {
  REAL_TRIAL_RUNTIME_IDENTITY_BINDING_VERSION,
  type ProductRuntimeIdentity,
  type RealTrialRuntimeIdentityBinding,
} from '../schemas/productRuntimeIdentity.schema.ts';
import {
  buildFormalResourceSnapshotDigest,
  buildManifestDigest,
  buildProductRuntimeIdentity,
  compareTrialRuntimeIdentity,
  normalizeRuntimeIdentityText,
  resolveProductRuntimeIdentityStatus,
  sha256,
  stableRuntimeIdentitySerialize,
} from '../services/productRuntimeIdentityService.ts';
import {
  applyProductRuntimeTrialInvalidation,
  resolveProductRuntimeTrialIdentity,
} from '../services/productRuntimeTrialIdentityService.ts';

const NOW = '2026-08-26T10:00:00.000Z';
const snapshot = await new SharedFormalResourceStore().readOnly();
const digest = (name: string) => sha256(name);
const inputs = {
  applicationContentDigest: digest('application'), dependencyLockDigest: digest('lock'),
  buildConfigurationDigest: digest('config'), buildArtifactManifestDigest: digest('artifact'),
  formalResourceSnapshotDigest: buildFormalResourceSnapshotDigest(snapshot),
  executablePolicyBundleDigest: digest('executable-policy'), trialPolicyBundleDigest: digest('trial-policy'),
  providerBoundaryDigest: digest('provider'),
};
const identity = (patch: Partial<ProductRuntimeIdentity['evidence']> = {}) => buildProductRuntimeIdentity({
  identityInputs: inputs,
  evidence: { gitCommit: 'commit-a', worktreeState: 'clean', sourceFileCount: 10,
    artifactFileCount: 3, formalStoreRevision: snapshot.revision, generatedAt: NOW, ...patch },
});
const binding = (current = identity()): RealTrialRuntimeIdentityBinding => ({
  bindingVersion: REAL_TRIAL_RUNTIME_IDENTITY_BINDING_VERSION,
  bindingId: 'binding-1', launchRecordId: 'launch-1', trialWindowId: 'window-1',
  runtimeIdentityVersion: current.runtimeIdentityVersion,
  runtimeIdentityDigest: current.runtimeIdentityDigest,
  formalResourceSnapshotDigest: current.identityInputs.formalResourceSnapshotDigest,
  executablePolicyBundleDigest: current.identityInputs.executablePolicyBundleDigest,
  trialPolicyBundleDigest: current.identityInputs.trialPolicyBundleDigest, boundAt: NOW,
});
const activeState = (): ConvergenceObservationActivationState => ({
  activationStateVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_VERSION,
  activationStateId: 'product-complexity-convergence-stage4-current', requestedMode: 'real_trial',
  effectiveMode: 'real_trial', trialWindowId: 'window-1', launchRecordId: 'launch-1',
  registrySnapshotHash: 'registry', policySnapshotHash: 'policy', buildVersion: 'legacy-fixed-v1',
  activatedAt: NOW, reasonCodes: ['real_trial_activation_approved'], updatedAt: NOW,
});
const cases: Array<{ id: string; name: string; run: () => void | Promise<void> }> = [
  c('R3-C01', 'same inputs are reproducible', () => assert.equal(identity().runtimeIdentityDigest, identity().runtimeIdentityDigest)),
  c('R3-C02', 'manifest order is stable', () => assert.equal(buildManifestDigest([{ path: 'b', digest: digest('b') }, { path: 'a', digest: digest('a') }]), buildManifestDigest([{ path: 'a', digest: digest('a') }, { path: 'b', digest: digest('b') }]))),
  c('R3-C03', 'line endings normalize', () => assert.equal(normalizeRuntimeIdentityText('a\r\nb'), normalizeRuntimeIdentityText('a\nb'))),
  c('R3-C04', 'unicode normalizes', () => assert.equal(normalizeRuntimeIdentityText('e\u0301'), normalizeRuntimeIdentityText('é'))),
  c('R3-C05', 'evidence counts do not change identity', () => assert.equal(identity().runtimeIdentityDigest, identity({ sourceFileCount: 99 }).runtimeIdentityDigest)),
  c('R3-C06', 'git evidence does not change identity', () => assert.equal(identity().runtimeIdentityDigest, identity({ gitCommit: 'commit-b' }).runtimeIdentityDigest)),
  c('R3-C07', 'application changes identity', () => assert.notEqual(identity().runtimeIdentityDigest, buildProductRuntimeIdentity({ identityInputs: { ...inputs, applicationContentDigest: digest('changed') }, evidence: identity().evidence }).runtimeIdentityDigest)),
  c('R3-C08', 'lock changes identity', () => changed('dependencyLockDigest')),
  c('R3-C09', 'config changes identity', () => changed('buildConfigurationDigest')),
  c('R3-C10', 'artifact changes identity', () => changed('buildArtifactManifestDigest')),
  c('R3-C11', 'candidate draft does not change formal digest', () => { const clone = structuredClone(snapshot); clone.data.questionResources.drafts.push({ debug: true } as never); assert.equal(buildFormalResourceSnapshotDigest(clone), inputs.formalResourceSnapshotDigest); }),
  c('R3-C12', 'frozen question changes formal digest', () => {
    const clone = structuredClone(snapshot);
    const currentFrozenVersionId = clone.data.questionResources.registryEntries
      .find((entry) => entry.status === 'active')?.currentFrozenVersionId;
    const activeVersion = clone.data.questionResources.versions
      .find((version) => version.resourceVersionId === currentFrozenVersionId);
    assert(activeVersion);
    activeVersion.questionStem += '（身份验收变更）';
    assert.notEqual(buildFormalResourceSnapshotDigest(clone), inputs.formalResourceSnapshotDigest);
  }),
  c('R3-C13', 'revision does not change formal digest', () => { const clone = { ...snapshot, revision: snapshot.revision + 1 }; assert.equal(buildFormalResourceSnapshotDigest(clone), inputs.formalResourceSnapshotDigest); }),
  c('R3-C14', 'executable policy changes identity', () => changed('executablePolicyBundleDigest')),
  c('R3-C15', 'generated time does not change identity', () => assert.equal(identity().runtimeIdentityDigest, identity({ generatedAt: '2027-01-01T00:00:00.000Z' }).runtimeIdentityDigest)),
  c('R3-C16', 'trial policy changes identity', () => changed('trialPolicyBundleDigest')),
  c('R3-C17', 'provider changes identity', () => changed('providerBoundaryDigest')),
  c('R3-C18', 'secret is absent from identity serialization', () => assert(!stableRuntimeIdentitySerialize(identity()).includes('DEEPSEEK_API_KEY'))),
  c('R3-C19', 'envelope does not enter its own inputs', () => assert.equal(Object.keys(identity().identityInputs).length, 8)),
  c('R3-C20', 'missing input is invalid', () => { const broken = structuredClone(identity()) as any; delete broken.identityInputs.providerBoundaryDigest; assert.equal(resolveProductRuntimeIdentityStatus(broken).status, 'invalid'); }),
  c('R3-C21', 'tampered digest is invalid', () => { const broken = { ...identity(), runtimeIdentityDigest: digest('tampered') }; assert.equal(resolveProductRuntimeIdentityStatus(broken).status, 'invalid'); }),
  c('R3-C22', 'missing identity', () => assert.equal(resolveProductRuntimeIdentityStatus().status, 'missing')),
  c('R3-C23', 'dirty identity', () => assert.equal(resolveProductRuntimeIdentityStatus(identity({ worktreeState: 'dirty' })).status, 'dirty')),
  c('R3-C24', 'aligned binding', () => assert.equal(compareTrialRuntimeIdentity({ currentIdentity: identity(), binding: binding() }).alignment, 'aligned')),
  c('R3-C25', 'mismatched binding', () => assert.equal(compareTrialRuntimeIdentity({ currentIdentity: identity(), binding: { ...binding(), runtimeIdentityDigest: digest('other') } }).alignment, 'mismatch')),
  c('R3-C26', 'legacy binding is unverifiable', () => assert.equal(compareTrialRuntimeIdentity({ currentIdentity: identity() }).alignment, 'legacy_unverifiable')),
  c('R3-C27', 'off mismatch is zero write decision', () => { const state = { ...activeState(), requestedMode: 'off' as const, effectiveMode: 'off' as const }; assert(!resolveProductRuntimeTrialIdentity({ activationState: state, currentIdentity: identity(), now: NOW }).invalidationRequired); }),
  c('R3-C28', 'real trial mismatch projects off', () => { const result = resolveProductRuntimeTrialIdentity({ activationState: activeState(), currentIdentity: identity(), now: NOW }); assert.equal(result.projectedState.effectiveMode, 'off'); assert.equal(result.projectedState.requestedMode, 'real_trial'); }),
  c('R3-C29', 'isolated invalid projects off', () => { const state = { ...activeState(), requestedMode: 'isolated_acceptance' as const, effectiveMode: 'isolated_acceptance' as const }; assert.equal(resolveProductRuntimeTrialIdentity({ activationState: state, currentIdentity: { ...identity(), runtimeIdentityDigest: digest('bad') }, now: NOW }).projectedState.effectiveMode, 'off'); }),
  c('R3-C30', 'missing compare fails safe', () => assert.equal(resolveProductRuntimeTrialIdentity({ activationState: activeState(), now: NOW }).observationAllowed, false)),
  c('R3-C31', 'first invalidation writes once', async () => { const repo = await activeRepo(); const result = await applyProductRuntimeTrialInvalidation({ repository: repo, currentIdentity: identity(), now: NOW }); assert.deepEqual([result.stateWriteCount, result.auditWriteCount], [1, 1]); }),
  c('R3-C32', 'repeat invalidation is idempotent', async () => { const repo = await activeRepo(); await applyProductRuntimeTrialInvalidation({ repository: repo, currentIdentity: identity(), now: NOW }); const result = await applyProductRuntimeTrialInvalidation({ repository: repo, currentIdentity: identity(), now: NOW }); assert.deepEqual([result.stateWriteCount, result.auditWriteCount], [0, 0]); }),
  c('R3-C33', 'already off is unchanged', async () => { const repo = new InMemoryProductComplexityConvergenceObservationRepository(); await repo.saveActivationState({ ...activeState(), effectiveMode: 'off' }); const result = await applyProductRuntimeTrialInvalidation({ repository: repo, currentIdentity: identity(), now: NOW }); assert.equal(result.stateWriteCount, 0); }),
  c('R3-C34', 'aligned identity remains active', async () => { const repo = await activeRepo(); const result = await applyProductRuntimeTrialInvalidation({ repository: repo, currentIdentity: identity(), binding: binding(), now: NOW }); assert.equal(result.projectedState.effectiveMode, 'real_trial'); }),
  c('R3-C35', 'invalidation keeps learning allowed', () => assert(resolveProductRuntimeTrialIdentity({ activationState: activeState(), currentIdentity: identity(), now: NOW }).learningAllowed)),
  c('R3-C36', 'historical launch identity stays intact', async () => { const repo = await activeRepo(); const before = await repo.getActivationState(); await applyProductRuntimeTrialInvalidation({ repository: repo, currentIdentity: identity(), now: NOW }); assert.equal((await repo.getActivationState())?.launchRecordId, before?.launchRecordId); }),
  c('R3-C37', 'identity generation does not mutate formal snapshot', () => { const before = JSON.stringify(snapshot); buildFormalResourceSnapshotDigest(snapshot); assert.equal(JSON.stringify(snapshot), before); }),
  c('R3-C38', 'status reads are deterministic', () => assert.deepEqual(resolveProductRuntimeIdentityStatus(identity()), resolveProductRuntimeIdentityStatus(identity()))),
  c('R3-C39', 'matching content does not reactivate off state', () => { const state = { ...activeState(), effectiveMode: 'off' as const }; assert.equal(resolveProductRuntimeTrialIdentity({ activationState: state, currentIdentity: identity(), binding: binding(), now: NOW }).projectedState.effectiveMode, 'off'); }),
  c('R3-C40', 'unknown identity schema is invalid', () => assert.equal(resolveProductRuntimeIdentityStatus({ ...identity(), runtimeIdentityVersion: 'unknown' } as never).status, 'invalid')),
];

for (const test of cases) { await test.run(); console.log(`PASS ${test.id} ${test.name}`); }
console.log(`WP-R3 DEBUG ACCEPTED ${cases.length}/${cases.length}`);

function c(id: string, name: string, run: () => void | Promise<void>) { return { id, name, run }; }
function changed(key: keyof typeof inputs) {
  assert.notEqual(identity().runtimeIdentityDigest, buildProductRuntimeIdentity({
    identityInputs: { ...inputs, [key]: digest(`changed-${key}`) }, evidence: identity().evidence,
  }).runtimeIdentityDigest);
}
async function activeRepo() {
  const repo = new InMemoryProductComplexityConvergenceObservationRepository();
  await repo.saveActivationState(activeState()); return repo;
}
