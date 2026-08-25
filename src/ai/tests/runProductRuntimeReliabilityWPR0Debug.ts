import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  PRODUCT_RUNTIME_BASELINE_AUDIT_VERSION,
  PRODUCT_RUNTIME_REASON_CODES,
  RUNTIME_DEPENDENCY_STATUSES,
  isProductRuntimeBaselineAudit,
  validateRuntimeReasonRegistry,
  type ProductRuntimeBaselineAudit,
  type ProductRuntimeProtectedSnapshot,
  type RuntimeDependencyInventoryItem,
  type RuntimeRouteAudit,
} from '../schemas/productRuntimeBaselineAudit.schema.ts';
import {
  buildDefaultProductRuntimeReasonRegistry,
  buildDynamicFormalResourceBaseline,
  buildProductRuntimeBaselineAudit,
  buildProductRuntimeProtectedSnapshot,
  buildRuntimeIdentityInputAudit,
  renderProductRuntimeBaselineAuditMarkdown,
  stableHash,
} from '../services/productRuntimeBaselineAuditService.ts';

const FIXED_TIME = '2026-08-25T12:00:00.000Z';
const store = new SharedFormalResourceStore();
const snapshot = await store.read();
const protectedSnapshot = buildProductRuntimeProtectedSnapshot(snapshot, {
  learningDigest: 'learning:unchanged',
  calibrationDigest: 'calibration:unchanged',
  trialDigest: 'trial:unchanged',
});
const input = baseInput();
const report = buildProductRuntimeBaselineAudit(input);
const baseline = report.formalResourceBaseline;

const cases: Array<{ id: string; name: string; run: () => void | Promise<void> }> = [
  { id: 'R0-C01', name: 'Audit Schema accepts valid report', run: () => assert(isProductRuntimeBaselineAudit(report)) },
  { id: 'R0-C02', name: 'unknown audit schema is rejected', run: () => assert(!isProductRuntimeBaselineAudit({ ...report, schemaVersion: 'unknown' })) },
  { id: 'R0-C03', name: 'audit mode is read-only only', run: () => assert(!isProductRuntimeBaselineAudit({ ...report, mode: 'apply' })) },
  { id: 'R0-C04', name: 'seven dependency states remain frozen', run: () => assert.equal(RUNTIME_DEPENDENCY_STATUSES.length, 7) },
  { id: 'R0-C05', name: 'Reason Registry is complete and unique', run: () => {
    const registry = buildDefaultProductRuntimeReasonRegistry();
    assert.equal(registry.length, PRODUCT_RUNTIME_REASON_CODES.length);
    assert.deepEqual(validateRuntimeReasonRegistry(registry), []);
  } },
  { id: 'R0-C06', name: 'invalid or duplicate Reason Code is rejected', run: () => {
    const registry = buildDefaultProductRuntimeReasonRegistry();
    const invalid = [{ ...registry[0], code: 'Bad-Code' as any }, ...registry.slice(1), registry[1]];
    assert(validateRuntimeReasonRegistry(invalid).some((issue) => issue.includes('reason_code_name_invalid')));
    assert(validateRuntimeReasonRegistry(invalid).some((issue) => issue.includes('reason_code_duplicate')));
  } },
  { id: 'R0-C07', name: 'runtime unreachable is distinct from store failure', run: () => {
    const next = buildProductRuntimeBaselineAudit(baseInput({ dependencies: [dependency('runtime', 'not_running', 'runtime_unreachable')] }));
    assert(next.reasonCodes.includes('runtime_unreachable'));
    assert(!next.reasonCodes.includes('formal_store_unreadable'));
  } },
  { id: 'R0-C08', name: 'runtime timeout keeps dedicated reason', run: () => {
    const next = buildProductRuntimeBaselineAudit(baseInput({ dependencies: [dependency('runtime', 'blocked', 'runtime_health_timeout')] }));
    assert(next.reasonCodes.includes('runtime_health_timeout'));
  } },
  { id: 'R0-C09', name: 'store unreadable is not no-task', run: () => {
    const next = buildProductRuntimeBaselineAudit(baseInput({ dependencies: [dependency('store', 'blocked', 'formal_store_unreadable')] }));
    assert(next.reasonCodes.includes('formal_store_unreadable'));
    assert(!next.reasonCodes.includes('no_learning_task_available'));
  } },
  { id: 'R0-C10', name: 'no-task remains informational and runtime-ready compatible', run: () => {
    const registry = buildDefaultProductRuntimeReasonRegistry();
    const item = registry.find((entry) => entry.code === 'no_learning_task_available');
    assert.equal(item?.severity, 'information'); assert.equal(item?.coreLearningImpact, 'none');
  } },
  { id: 'R0-C11', name: 'AI missing is conditional and contains no key', run: () => {
    const item = buildDefaultProductRuntimeReasonRegistry().find((entry) => entry.code === 'ai_provider_not_configured');
    assert.equal(item?.coreLearningImpact, 'conditional');
    assert(!JSON.stringify(item).includes('sk-'));
  } },
  { id: 'R0-C12', name: 'Trial mismatch requires re-entry but allows Learning', run: () => {
    const audit = buildRuntimeIdentityInputAudit({ gitCommit: 'new', worktreeState: 'clean', launchGitCommit: 'old', currentBuildVersion: 'v1', launchBuildVersion: 'v1', buildVersionContentAddressed: false });
    assert.equal(audit.status, 'mismatch'); assert(audit.trialReentryRequired); assert(audit.learningAllowed);
  } },
  { id: 'R0-C13', name: 'material baseline is dynamic', run: () => {
    const next = buildDynamicFormalResourceBaseline(snapshot, FIXED_TIME);
    const expected = snapshot.data.questionResources.materials.filter((item) => item.status !== 'retired').length;
    assert.equal(next.activeMaterialCount, expected);
  } },
  { id: 'R0-C14', name: 'question baseline is dynamic', run: () => {
    const expected = baseline.activeRegistryEntryCount;
    assert.equal(baseline.currentTaskCount, expected);
    assert(expected > 0);
  } },
  { id: 'R0-C15', name: 'formal identity collections conserve current task count', run: () => {
    const counts = [baseline.activeRegistryEntryCount, baseline.currentFormalVersionCount,
      baseline.activeObservationLinkCount, baseline.frozenQualityTraceCount,
      baseline.learningConsumableQuestionCount];
    assert(counts.every((value) => value === baseline.currentTaskCount));
  } },
  { id: 'R0-C16', name: 'inconsistent baseline reports issue and never repairs', run: () => {
    const corrupted = structuredClone(snapshot);
    const firstActive = corrupted.data.questionResources.registryEntries.find((item) => item.status === 'active');
    corrupted.data.questionResources.registryEntries = corrupted.data.questionResources.registryEntries
      .filter((item) => item.resourceId !== firstActive?.resourceId);
    const next = buildDynamicFormalResourceBaseline(corrupted, FIXED_TIME);
    assert(next.issueCodes.length > 0);
    assert.equal(snapshot.revision, protectedSnapshot.formalResourceRevision);
  } },
  { id: 'R0-C17', name: 'response-format breakdown equals current head', run: () => assert.equal(sum(baseline.responseFormatBreakdown), baseline.currentTaskCount) },
  { id: 'R0-C18', name: 'difficulty breakdown equals current head', run: () => assert.equal(sum(baseline.difficultyBreakdown), baseline.currentTaskCount) },
  { id: 'R0-C19', name: 'quality breakdown equals current head', run: () => assert.equal(baseline.latestQuality.ready + baseline.latestQuality.guided + baseline.latestQuality.blocked, baseline.currentTaskCount) },
  { id: 'R0-C20', name: 'stable digest ignores object key order', run: () => assert.equal(stableHash({ a: 1, b: 2 }), stableHash({ b: 2, a: 1 })) },
  { id: 'R0-C21', name: 'Git identity is represented', run: () => assert.equal(report.git.commit, '4d016c6-fixture') },
  { id: 'R0-C22', name: 'dirty worktree is disclosed without mutation', run: () => {
    const next = buildProductRuntimeBaselineAudit(baseInput({ worktreeState: 'dirty' }));
    assert.equal(next.git.worktreeState, 'dirty');
  } },
  { id: 'R0-C23', name: 'fixed Build Version is insufficient identity', run: () => {
    const audit = buildRuntimeIdentityInputAudit({ gitCommit: 'abc', worktreeState: 'clean', launchGitCommit: 'abc', currentBuildVersion: 'fixed-v1', launchBuildVersion: 'fixed-v1', buildVersionContentAddressed: false });
    assert.equal(audit.buildVersionUniqueness, 'fixed_or_unverified'); assert(audit.reasonCodes.includes('runtime_identity_insufficient'));
  } },
  { id: 'R0-C24', name: 'Launch commit mismatch requires re-entry', run: () => assert(report.identityInputAudit.reasonCodes.includes('trial_reentry_required')) },
  { id: 'R0-C25', name: 'missing Launch identity is insufficient evidence', run: () => {
    const audit = buildRuntimeIdentityInputAudit({ gitCommit: 'abc', worktreeState: 'clean' });
    assert.equal(audit.status, 'insufficient_evidence'); assert(audit.trialReentryRequired);
  } },
  { id: 'R0-C26', name: 'every Finding routes only to an authorized WP', run: () => assert(report.findings.every((item) => /^WP-R[1-6]$/.test(item.authorizedNextWorkPackage))) },
  { id: 'R0-C27', name: 'formal snapshot is unchanged', run: () => {
    assert(report.zeroWriteComparison.verified); assert.equal(report.zeroWriteComparison.formalResourceWriteCount, 0);
  } },
  { id: 'R0-C28', name: 'Learning facts are unchanged', run: () => {
    assert.equal(report.zeroWriteComparison.attemptWriteCount, 0);
    assert.equal(report.zeroWriteComparison.evidenceWriteCount, 0);
    assert.equal(report.zeroWriteComparison.profileWriteCount, 0);
  } },
  { id: 'R0-C29', name: 'Calibration denominator is unchanged', run: () => assert.equal(report.zeroWriteComparison.realCalibrationDenominatorWriteCount, 0) },
  { id: 'R0-C30', name: 'Trial state is unchanged', run: () => assert.equal(report.zeroWriteComparison.trialStateWriteCount, 0) },
  { id: 'R0-C31', name: 'report summary and evidence are internally consistent', run: () => {
    assert.equal(report.reasonCodes.length, new Set(report.reasonCodes).size);
    assert(renderProductRuntimeBaselineAuditMarkdown(report).includes('零写入'));
  } },
  { id: 'R0-C32', name: 'same facts produce same report digest', run: () => {
    const first = buildProductRuntimeBaselineAudit(baseInput());
    const secondInput = structuredClone(baseInput());
    secondInput.startedAt = '2026-08-25T09:00:00.000Z';
    secondInput.completedAt = '2026-08-25T09:00:01.000Z';
    secondInput.dependencies = secondInput.dependencies.map((item) => ({
      ...item,
      checkedAt: '2026-08-25T09:00:01.000Z',
    }));
    const second = buildProductRuntimeBaselineAudit(secondInput);
    assert.equal(first.reportDigest, second.reportDigest);
    assert.equal(first.formalResourceBaseline.baselineDigest, second.formalResourceBaseline.baselineDigest);
  } },
];

let passed = 0;
for (const item of cases) {
  try { await item.run(); passed += 1; console.log(`PASS ${item.id} ${item.name}`); }
  catch (error) { console.error(`FAIL ${item.id} ${item.name}`); throw error; }
}
console.log(`\nProduct Runtime Reliability WP-R0 Debug: ${passed}/${cases.length}`);
if (process.argv.includes('--report')) console.log(`\n${renderProductRuntimeBaselineAuditMarkdown(report)}`);

function baseInput(patch: Partial<Parameters<typeof buildProductRuntimeBaselineAudit>[0]> = {}) {
  const identityInputAudit = buildRuntimeIdentityInputAudit({
    gitCommit: '4d016c6-fixture', worktreeState: 'clean', launchGitCommit: '119a019-fixture',
    currentBuildVersion: 'fixed-v1', launchBuildVersion: 'fixed-v1', buildVersionContentAddressed: false,
  });
  return {
    auditId: 'wp-r0-debug-fixture', startedAt: FIXED_TIME, completedAt: FIXED_TIME,
    gitCommit: '4d016c6-fixture', worktreeState: 'clean' as const,
    snapshotBefore: snapshot, snapshotAfter: snapshot,
    protectedBefore: protectedSnapshot, protectedAfter: protectedSnapshot,
    dependencies: [dependency('runtime', 'not_running', 'runtime_unreachable')],
    identityInputAudit,
    routeAudits: [route('learning', false, ['runtime_unreachable'])],
    fixedBaselineEvidence: ['fixed-baseline:test-fixture'],
    ...patch,
  };
}

function dependency(
  dependencyId: string,
  status: RuntimeDependencyInventoryItem['status'],
  reasonCode?: RuntimeDependencyInventoryItem['reasonCode'],
): RuntimeDependencyInventoryItem {
  return { dependencyId, role: dependencyId, requiredFor: ['learning_read'], status, reasonCode,
    evidenceCodes: [`${dependencyId}:${status}`], checkedAt: FIXED_TIME };
}

function route(
  routeId: RuntimeRouteAudit['routeId'],
  reachable: boolean,
  reasonCodes: RuntimeRouteAudit['reasonCodes'],
): RuntimeRouteAudit {
  return { routeId, url: `http://localhost/${routeId}`, reachable,
    visibleState: reachable ? 'ready' : 'runtime_unreachable',
    runtimeBoundaryReachable: reachable, formalResourceBoundaryReachable: reachable,
    reasonCodes, evidenceCodes: [`route:${routeId}`] };
}

function sum(values: Record<string, number>): number {
  return Object.values(values).reduce((total, value) => total + value, 0);
}
