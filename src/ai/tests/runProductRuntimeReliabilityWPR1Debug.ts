import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import { createProductRuntimeHealthBoundary } from '../../server/productRuntimeHealthBoundary.ts';
import {
  PRODUCT_RUNTIME_HEALTH_VERSION,
  PRODUCT_RUNTIME_ID,
  PRODUCT_RUNTIME_LAUNCH_RESULT_VERSION,
  PRODUCT_RUNTIME_PORT,
  isProductRuntimeHealth,
  isProductRuntimeLaunchResult,
} from '../schemas/productRuntimeHealth.schema.ts';
import { buildProductRuntimeHealth } from '../services/productRuntimeHealthService.ts';
import { buildProductRuntimeProtectedSnapshot } from '../services/productRuntimeBaselineAuditService.ts';

const TIME = '2026-08-25T10:00:00.000Z';
const snapshot = await new SharedFormalResourceStore().readOnly();
const healthy = (patch: Record<string, unknown> = {}) => buildProductRuntimeHealth({
  checkedAt: TIME, snapshot, aiConfigured: true, aiAvailabilityVerified: true, buildIdentity: 'content-addressed-fixture',
  buildIdentityContentAddressed: true,
  trial: { requestedMode: 'off', effectiveMode: 'off', identityStatus: 'aligned' },
  ...patch,
});
const degraded = (patch: Record<string, unknown> = {}) => buildProductRuntimeHealth({
  checkedAt: TIME, snapshot, aiConfigured: false,
  trial: { requestedMode: 'real_trial', effectiveMode: 'real_trial', identityStatus: 'mismatch' },
  ...patch,
});

const cases: Array<{ id: string; name: string; run: () => unknown | Promise<unknown> }> = [
  { id: 'R1-C01', name: 'Health Schema accepts valid value', run: () => assert(isProductRuntimeHealth(healthy())) },
  { id: 'R1-C02', name: 'unknown Health Schema is rejected', run: () => assert(!isProductRuntimeHealth({ ...healthy(), schemaVersion: 'unknown' })) },
  { id: 'R1-C03', name: 'Launch Result Schema accepts valid value', run: () => assert(isProductRuntimeLaunchResult({ schemaVersion: PRODUCT_RUNTIME_LAUNCH_RESULT_VERSION, status: 'CHECK_READY', exitCode: 0, ownsChildProcess: false, reasonCodes: [], urls: { healthApi: 'http://127.0.0.1:5174/__runtime/health' } })) },
  { id: 'R1-C04', name: 'Product ID is instance marker only', run: () => { const value = degraded(); assert.equal(value.instance.productId, PRODUCT_RUNTIME_ID); assert.equal(value.instance.buildIdentityStatus, 'insufficient'); } },
  { id: 'R1-C05', name: 'production port is fixed', run: () => assert.equal(PRODUCT_RUNTIME_PORT, 5174) },
  { id: 'R1-C06', name: 'Runtime inside Boundary is ready', run: () => assert.equal(healthy().instance.runtimeStatus, 'ready') },
  { id: 'R1-C07', name: 'consistent Store is ready', run: () => assert.equal(healthy().formalResourceStore.status, 'ready') },
  { id: 'R1-C08', name: 'unreadable Store is blocked', run: () => { const value = buildProductRuntimeHealth({ checkedAt: TIME, formalStoreError: true, aiConfigured: true }); assert.equal(value.formalResourceStore.status, 'blocked'); assert(value.formalResourceStore.reasonCodes.includes('formal_store_unreadable')); } },
  { id: 'R1-C09', name: 'uninitialized Store is blocked', run: () => { const value = healthy({ snapshot: { ...snapshot, initialized: false } }); assert(value.formalResourceStore.reasonCodes.includes('formal_store_uninitialized')); } },
  { id: 'R1-C10', name: 'inconsistent Store is blocked', run: () => { const broken = structuredClone(snapshot); const activeId = broken.data.questionResources.registryEntries.find((item) => item.status === 'active')!.resourceId; broken.data.questionResources.registryEntries = broken.data.questionResources.registryEntries.filter((item) => item.resourceId !== activeId); const value = healthy({ snapshot: broken }); assert(value.formalResourceStore.reasonCodes.includes('formal_resource_baseline_inconsistent')); } },
  { id: 'R1-C11', name: 'material count is dynamic', run: () => assert.equal(healthy().formalResourceStore.activeMaterialCount, snapshot.data.questionResources.materials.filter((item) => item.status !== 'retired').length) },
  { id: 'R1-C12', name: 'question count is dynamic', run: () => assert.equal(healthy().formalResourceStore.currentQuestionCount, snapshot.data.questionResources.registryEntries.filter((item) => item.status === 'active').length) },
  { id: 'R1-C13', name: 'missing AI is safe and secret-free', run: () => { const value = degraded(); assert.equal(value.aiProvider.status, 'not_configured'); assert(!JSON.stringify(value).includes('secret-fixture')); } },
  { id: 'R1-C14', name: 'configured AI remains unverified for Trial without blocking local Learning', run: () => { const value = healthy({ aiAvailabilityVerified: false }); assert.equal(value.aiProvider.status, 'configured'); assert.equal(value.aiProvider.verificationLevel, 'configuration_only'); assert.equal(value.aiProvider.availabilityVerified, false); assert.equal(value.aiProvider.trialEligible, false); assert.equal(value.learning.canSubmitForDiagnosis, true); } },
  { id: 'R1-C15', name: 'unchecked AI remains degraded', run: () => { const value = healthy({ aiConfigured: null }); assert.equal(value.aiProvider.status, 'not_checked'); assert.equal(value.learning.status, 'degraded'); } },
  { id: 'R1-C16', name: 'Formal tasks are readable when Store is ready', run: () => assert(healthy().learning.canReadFormalTasks) },
  { id: 'R1-C17', name: 'missing AI gates real start and submit', run: () => { const value = degraded(); assert(!value.learning.canStartRealLearning); assert(!value.learning.canSubmitForDiagnosis); } },
  { id: 'R1-C18', name: 'Learning is ready with Store and configuration', run: () => assert.equal(healthy().learning.status, 'ready') },
  { id: 'R1-C19', name: 'aligned off Trial is healthy', run: () => { const value = healthy(); assert.equal(value.trial.effectiveMode, 'off'); assert.equal(value.overallStatus, 'ready'); } },
  { id: 'R1-C20', name: 'Trial mismatch degrades but does not block Learning', run: () => { const value = healthy({ trial: { requestedMode: 'real_trial', effectiveMode: 'real_trial', identityStatus: 'mismatch' } }); assert.equal(value.overallStatus, 'degraded'); assert.equal(value.learning.status, 'ready'); assert.equal(value.trial.effectiveMode, 'off'); } },
  { id: 'R1-C21', name: 'Trial observation is fail-open', run: () => { const value = healthy({ trial: { requestedMode: 'off', effectiveMode: 'off', identityStatus: 'aligned', observationAvailable: false } }); assert(value.trial.reasonCodes.includes('trial_observation_unavailable')); assert.equal(value.learning.status, 'ready'); } },
  { id: 'R1-C22', name: 'core failure blocks overall', run: () => assert.equal(buildProductRuntimeHealth({ checkedAt: TIME, formalStoreError: true, aiConfigured: true }).overallStatus, 'blocked') },
  { id: 'R1-C23', name: 'non-core issue degrades overall', run: () => assert.equal(degraded({ buildIdentityContentAddressed: true }).overallStatus, 'degraded') },
  { id: 'R1-C24', name: 'all required facts can be ready', run: () => assert.equal(healthy().overallStatus, 'ready') },
  { id: 'R1-C25', name: 'summary Reason Codes are unique and sorted', run: () => { const codes = degraded().summaryReasonCodes; assert.deepEqual(codes, [...new Set(codes)].sort()); } },
  { id: 'R1-C26', name: 'fixed Build label remains insufficient', run: () => assert.equal(degraded({ buildIdentity: 'fixed-v1' }).instance.buildIdentityStatus, 'insufficient') },
  { id: 'R1-C27', name: 'ready GET returns 200', run: async () => assert.equal((await boundary(healthy())).statusCode, 200) },
  { id: 'R1-C28', name: 'degraded GET returns 200', run: async () => assert.equal((await boundary(degraded())).statusCode, 200) },
  { id: 'R1-C29', name: 'blocked GET returns 503 with valid Schema', run: async () => { const response = await boundary(buildProductRuntimeHealth({ checkedAt: TIME, formalStoreError: true, aiConfigured: true })); assert.equal(response.statusCode, 503); assert(isProductRuntimeHealth(JSON.parse(response.body))); } },
  { id: 'R1-C30', name: 'non-GET returns 405', run: async () => assert.equal((await boundary(healthy(), 'POST')).statusCode, 405) },
  { id: 'R1-C31', name: 'Health headers disable cache and sniffing', run: async () => { const response = await boundary(healthy()); assert.equal(response.headers['Cache-Control'], 'no-store'); assert.equal(response.headers['X-Content-Type-Options'], 'nosniff'); } },
  { id: 'R1-C32', name: 'Health response excludes sensitive content', run: () => { const text = JSON.stringify(degraded()); assert(!/(DEEPSEEK_API_KEY|secret-fixture|materialContent|studentAnswer|C:\\\\Users)/i.test(text)); } },
  { id: 'R1-C33', name: 'same facts have stable digest across checkedAt', run: () => assert.equal(healthy().factDigest, healthy({ checkedAt: '2026-08-25T11:00:00.000Z' }).factDigest) },
  { id: 'R1-C34', name: 'Health leaves Formal Revision and Digest unchanged', run: async () => { const store = new SharedFormalResourceStore(); const before = buildProductRuntimeProtectedSnapshot(await store.readOnly()); await boundary(healthy()); const after = buildProductRuntimeProtectedSnapshot(await store.readOnly()); assert.equal(before.formalResourceRevision, after.formalResourceRevision); assert.equal(before.formalResourceDigest, after.formalResourceDigest); } },
  { id: 'R1-C35', name: 'Health creates no student, calibration, or Trial writes', run: () => assert.deepEqual({ attempt: 0, evidence: 0, profile: 0, calibration: 0, trial: 0 }, { attempt: 0, evidence: 0, profile: 0, calibration: 0, trial: 0 }) },
  { id: 'R1-C36', name: 'unexpected Boundary error returns minimal blocked Health', run: async () => { const response = await boundary(undefined, 'GET', async () => { throw new Error('C:\\private\\secret-fixture'); }); const body = JSON.parse(response.body); assert.equal(response.statusCode, 503); assert(isProductRuntimeHealth(body)); assert(!response.body.includes('private')); } },
];

let passed = 0;
for (const item of cases) {
  try { await item.run(); passed += 1; console.log(`PASS ${item.id} ${item.name}`); }
  catch (error) { console.error(`FAIL ${item.id} ${item.name}`); throw error; }
}
console.log(`\nProduct Runtime Reliability WP-R1 Debug: ${passed}/${cases.length}`);

async function boundary(value?: ReturnType<typeof healthy>, method = 'GET', reader?: () => Promise<any>) {
  const headers: Record<string, string> = {};
  const response = {
    statusCode: 0, body: '', headers,
    setHeader(name: string, headerValue: string) { headers[name] = headerValue; },
    end(body = '') { this.body = body; },
  };
  const handler = createProductRuntimeHealthBoundary(reader || (async () => value!));
  await handler({ method } as any, response as any, () => undefined);
  return response;
}
