import assert from 'node:assert/strict';
import { createConvergenceTrialWindow } from '../agents/productComplexityConvergenceObservationAgent.ts';
import { InMemoryProductComplexityConvergenceObservationRepository } from
  '../repositories/inMemoryProductComplexityConvergenceObservationRepository.ts';
import {
  REAL_TRIAL_REENTRY_PREFLIGHT_CHECK_IDS,
  validateRealTrialReentryApprovalBundle,
  validateRealTrialReentryPreflightReport,
  validateRealTrialWindowLaunchRecordV2,
} from '../schemas/productRuntimeTrialReentry.schema.ts';
import { buildProductRuntimeIdentity, sha256 } from '../services/productRuntimeIdentityService.ts';
import {
  allPassingRealTrialReentrySignals,
  emptyRealTrialReentryWriteCounts,
  runRealTrialReentryPreflight,
} from '../services/productRuntimeTrialReentryPreflightService.ts';
import {
  activateRealTrialReentry,
  buildRealTrialReentryApprovalBundle,
  commitRealTrialReentryApprovalBundle,
  planRealTrialReentryIdentities,
} from '../services/productRuntimeTrialReentryService.ts';

const PREFLIGHT_START = '2026-08-26T09:45:00.000Z';
const PREFLIGHT_END = '2026-08-26T09:50:00.000Z';
const ACTIVATION_TIME = '2026-08-26T10:00:00.000Z';
const WINDOW_END = '2026-09-16T10:00:00.000Z';
const digest = (value: string) => sha256(value);
const runtimeIdentity = (suffix = 'current', worktreeState: 'clean' | 'dirty' = 'clean') =>
  buildProductRuntimeIdentity({
    identityInputs: {
      applicationContentDigest: digest(`application-${suffix}`),
      dependencyLockDigest: digest('lock'),
      buildConfigurationDigest: digest('config'),
      buildArtifactManifestDigest: digest('artifact'),
      formalResourceSnapshotDigest: digest('formal'),
      executablePolicyBundleDigest: digest('executable-policy'),
      trialPolicyBundleDigest: digest('trial-policy'),
      providerBoundaryDigest: digest('provider'),
    },
    evidence: { gitCommit: 'commit-r4', worktreeState, sourceFileCount: 12,
      artifactFileCount: 4, formalStoreRevision: 1, generatedAt: PREFLIGHT_END },
  });

function fixtures(id = '1') {
  const identity = runtimeIdentity();
  const window = createConvergenceTrialWindow({
    trialWindowId: `r4-window-${id}`, startsAt: ACTIVATION_TIME, plannedEndsAt: WINDOW_END,
    participatingStudentIds: ['student-1'], sourceRegistryVersion: 'registry-v1',
    sourcePolicySnapshotHash: 'registry-hash-v1', status: 'draft',
  });
  const planned = planRealTrialReentryIdentities({ trialWindowId: window.trialWindowId,
    runtimeIdentity: identity });
  const report = runRealTrialReentryPreflight({
    trialWindowId: window.trialWindowId,
    plannedLaunchRecordId: planned.launchRecordId,
    plannedRuntimeIdentityBindingId: planned.runtimeIdentityBindingId,
    runtimeIdentity: identity, gitCommit: 'commit-r4', buildVersion: 'build-r4',
    sourceRegistryVersion: window.sourceRegistryVersion,
    sourcePolicySnapshotHash: window.sourcePolicySnapshotHash,
    observationPolicyVersion: window.observationPolicyVersion,
    decisionPolicyVersion: window.decisionPolicyVersion,
    startedAt: PREFLIGHT_START, completedAt: PREFLIGHT_END,
    signals: allPassingRealTrialReentrySignals(), writeCounts: emptyRealTrialReentryWriteCounts(),
  });
  const bundle = buildRealTrialReentryApprovalBundle({ trialWindow: window,
    preflightReport: report, runtimeIdentity: identity, timezone: 'Asia/Shanghai',
    recordedAt: PREFLIGHT_END });
  return { identity, window, report, bundle };
}

const tests: Array<{ id: string; title: string; run: () => void | Promise<void> }> = [];
const test = (id: string, title: string, run: () => void | Promise<void>) => tests.push({ id, title, run });
const base = fixtures();

test('R4-C01', 'Preflight v2 Schema 有效', () => assert.deepEqual(validateRealTrialReentryPreflightReport(base.report), []));
test('R4-C02', 'R4-P01—R4-P24 完整', () => assert.deepEqual(base.report.checkResults.map((x) => x.checkId), [...REAL_TRIAL_REENTRY_PREFLIGHT_CHECK_IDS]));
test('R4-C03', '全通过时允许形成准入包', () => assert.equal(base.report.eligibleForActivation, true));
test('R4-C04', 'Preflight 默认 30 分钟有效', () => assert.equal(Date.parse(base.report.expiresAt) - Date.parse(base.report.completedAt), 1_800_000));
test('R4-C05', '报告身份稳定', () => assert.equal(fixtures().report.reportId, base.report.reportId));
test('R4-C06', '缺 Runtime Identity 阻断', () => assert.equal(failedReport({ runtimeIdentity: undefined }).eligibleForActivation, false));
test('R4-C07', 'Dirty Identity 阻断', () => assert(failedReport({ runtimeIdentity: runtimeIdentity('current', 'dirty') }).issueCodes.includes('trial_reentry_runtime_identity_not_clean')));
test('R4-C08', 'Runtime 未 ready 阻断', () => assert(failedReport({ signal: ['runtimeHealthReady', false] }).issueCodes.includes('trial_reentry_runtime_not_ready')));
test('R4-C09', 'Artifact 不一致阻断', () => assert.equal(failedReport({ signal: ['artifactIdentityAligned', false] }).eligibleForActivation, false));
test('R4-C10', 'Formal Snapshot 不一致阻断', () => assert(failedReport({ signal: ['formalSnapshotAligned', false] }).issueCodes.includes('trial_reentry_formal_snapshot_changed')));
test('R4-C11', 'Formal Store 不完整阻断', () => assert.equal(failedReport({ signal: ['formalStoreReady', false] }).eligibleForActivation, false));
test('R4-C12', 'Executable Policy 不一致阻断', () => assert(failedReport({ signal: ['executablePolicyAligned', false] }).issueCodes.includes('trial_reentry_policy_changed')));
test('R4-C13', 'Trial Policy 不一致阻断', () => assert(failedReport({ signal: ['trialPolicyAligned', false] }).issueCodes.includes('trial_reentry_policy_changed')));
test('R4-C14', 'Provider Boundary 不一致阻断', () => assert.equal(failedReport({ signal: ['providerBoundaryAligned', false] }).eligibleForActivation, false));
test('R4-C15', 'Provider 不可用阻断', () => assert(failedReport({ signal: ['providerReady', false] }).issueCodes.includes('trial_reentry_provider_unavailable')));
test('R4-C16', 'Registry 不一致阻断', () => assert.equal(failedReport({ signal: ['sourceRegistryAligned', false] }).eligibleForActivation, false));
test('R4-C17', 'Owner Schema 不受支持阻断', () => assert.equal(failedReport({ signal: ['ownerSchemasSupported', false] }).eligibleForActivation, false));
test('R4-C18', 'Learning 回归失败阻断', () => assert.equal(failedReport({ signal: ['learningRegressionPassed', false] }).eligibleForActivation, false));
test('R4-C19', 'Workbench 回归失败阻断', () => assert.equal(failedReport({ signal: ['workbenchRegressionPassed', false] }).eligibleForActivation, false));
test('R4-C20', '当前 Trial 非 off 阻断', () => assert.equal(failedReport({ signal: ['activationStateOff', false] }).eligibleForActivation, false));
test('R4-C21', '历史身份复用阻断', () => assert.equal(failedReport({ signal: ['historicalIsolationPassed', false] }).eligibleForActivation, false));
test('R4-C22', '活动 Window 冲突阻断', () => assert(failedReport({ signal: ['noActiveWindowConflict', false] }).issueCodes.includes('trial_reentry_window_conflict')));
test('R4-C23', 'P0/P1 未清零阻断', () => assert.equal(failedReport({ unresolved: 1 }).eligibleForActivation, false));
test('R4-C24', 'Preflight 期间写入非零阻断', () => assert(failedReport({ write: ['attemptWriteCount', 1] }).issueCodes.includes('trial_reentry_zero_write_violation')));
test('R4-C25', 'Bundle Schema 与交叉引用有效', () => assert.deepEqual(validateRealTrialReentryApprovalBundle(base.bundle), []));
test('R4-C26', 'Launch v2 有效', () => assert.deepEqual(validateRealTrialWindowLaunchRecordV2(base.bundle.launchRecord), []));
test('R4-C27', 'Binding ID 稳定派生', () => assert.equal(fixtures().bundle.runtimeIdentityBinding.bindingId, base.bundle.runtimeIdentityBinding.bindingId));
test('R4-C28', '首次 Bundle 原子提交', async () => { const repo = repoFresh(); assert.equal((await commit(repo, fixtures('28'))).status, 'committed'); });
test('R4-C29', 'Bundle 幂等重试零新增', async () => { const repo = repoFresh(); const f = fixtures('29'); await commit(repo, f); assert.equal((await commit(repo, f)).status, 'duplicate'); });
test('R4-C30', '相同 ID 不同内容冲突', async () => { const repo = repoFresh(); const f = fixtures('30'); await commit(repo, f); await assert.rejects(() => repo.commitRealTrialReentryApprovalBundle({ ...f.bundle, launchRecord: { ...f.bundle.launchRecord, timezone: 'UTC' } }), /bundle_conflict/); });
test('R4-C31', '无效 Bundle 四项零写入', async () => { const repo = repoFresh(); const f = fixtures('31'); await assert.rejects(() => repo.commitRealTrialReentryApprovalBundle({ ...f.bundle, trialWindow: { ...f.window, status: 'active' } }), /bundle_invalid/); assert.equal((await repo.listTrialWindows()).length, 0); });
test('R4-C32', 'Bundle 保存不激活 Trial', async () => { const repo = repoFresh(); await commit(repo, fixtures('32')); assert.equal((await repo.getActivationState())?.effectiveMode, undefined); });
test('R4-C33', '明确确认缺失时拒绝', async () => { const f = fixtures('33'); const repo = repoFresh(); await commit(repo, f); assert.equal((await activate(repo, f, { explicitOperatorConfirmation: false })).status, 'rejected'); });
test('R4-C34', 'Preflight 过期时拒绝', async () => { const f = fixtures('34'); const repo = repoFresh(); await commit(repo, f); assert((await activate(repo, f, { now: '2026-08-26T11:00:00.000Z' })).reasonCodes.includes('trial_reentry_preflight_expired')); });
test('R4-C35', 'Identity 漂移时拒绝', async () => { const f = fixtures('35'); const repo = repoFresh(); await commit(repo, f); assert((await activate(repo, f, { currentIdentity: runtimeIdentity('changed') })).reasonCodes.includes('trial_reentry_runtime_identity_changed')); });
test('R4-C36', 'Provider 不可用时拒绝', async () => { const f = fixtures('36'); const repo = repoFresh(); await commit(repo, f); assert((await activate(repo, f, { providerReady: false })).reasonCodes.includes('trial_reentry_provider_unavailable')); });
test('R4-C37', '受保护域写入后拒绝', async () => { const f = fixtures('37'); const repo = repoFresh(); await commit(repo, f); assert((await activate(repo, f, { protectedWritesSincePreflight: 1 })).reasonCodes.includes('trial_reentry_zero_write_violation')); });
test('R4-C38', '显式激活成功', async () => { const f = fixtures('38'); const repo = repoFresh(); await commit(repo, f); assert.equal((await activate(repo, f)).status, 'activated'); });
test('R4-C39', '成功后 Window 为 active', async () => { const f = fixtures('39'); const repo = repoFresh(); await commit(repo, f); await activate(repo, f); assert.equal((await repo.getTrialWindow(f.window.trialWindowId))?.status, 'active'); });
test('R4-C40', '成功后 State 为 real_trial', async () => { const f = fixtures('40'); const repo = repoFresh(); await commit(repo, f); await activate(repo, f); assert.equal((await repo.getActivationState())?.effectiveMode, 'real_trial'); });
test('R4-C41', '成功后只有一条 Audit v3', async () => { const f = fixtures('41'); const repo = repoFresh(); await commit(repo, f); await activate(repo, f); assert.equal((await repo.listRealTrialReentryActivationAudits()).length, 1); });
test('R4-C42', '重复激活幂等', async () => { const f = fixtures('42'); const repo = repoFresh(); await commit(repo, f); await activate(repo, f); assert.equal((await activate(repo, f)).status, 'already_activated'); });
test('R4-C43', '不同 Window 并发只能一个生效', async () => { const a = fixtures('43a'); const b = fixtures('43b'); const repo = repoFresh(); await commit(repo, a); await commit(repo, b); const results = await Promise.all([activate(repo, a), activate(repo, b)]); assert.equal(results.filter((x) => x.effectiveMode === 'real_trial').length, 1); });
test('R4-C44', '激活不创建 Observation', async () => { const f = fixtures('44'); const repo = repoFresh(); await commit(repo, f); await activate(repo, f); assert.equal((await repo.listEvents()).length, 0); });
test('R4-C45', '激活不创建真实分母', async () => { const f = fixtures('45'); const repo = repoFresh(); await commit(repo, f); await activate(repo, f); assert.equal((await repo.listSnapshots()).length, 0); });
test('R4-C46', '旧 Preflight Store 保持不变', async () => { const repo = repoFresh(); await commit(repo, fixtures('46')); assert.equal((await repo.listPreflightReports()).length, 0); });
test('R4-C47', '旧 Launch Store 保持不变', async () => { const repo = repoFresh(); await commit(repo, fixtures('47')); assert.equal((await repo.listLaunchRecords()).length, 0); });
test('R4-C48', 'Learning 主链不受拒绝影响', async () => { const f = fixtures('48'); const repo = repoFresh(); await commit(repo, f); const result = await activate(repo, f, { runtimeHealthReady: false }); assert.equal(result.effectiveMode, 'off'); assert.equal((await repo.listEvents()).length, 0); });

for (const current of tests) { await current.run(); console.log(`PASS ${current.id} ${current.title}`); }
console.log(`WP-R4 DEBUG ACCEPTED ${tests.length}/${tests.length}`);

function repoFresh() { return new InMemoryProductComplexityConvergenceObservationRepository(); }
function failedReport(input: { runtimeIdentity?: ReturnType<typeof runtimeIdentity>;
  signal?: [keyof ReturnType<typeof allPassingRealTrialReentrySignals>, boolean];
  write?: [keyof ReturnType<typeof emptyRealTrialReentryWriteCounts>, number]; unresolved?: number } = {}) {
  const f = fixtures('failed');
  const signals = allPassingRealTrialReentrySignals();
  if (input.signal) (signals[input.signal[0]] as boolean | number) = input.signal[1];
  if (input.unresolved !== undefined) signals.unresolvedP0P1Count = input.unresolved;
  const writes = emptyRealTrialReentryWriteCounts();
  if (input.write) writes[input.write[0]] = input.write[1];
  return runRealTrialReentryPreflight({
    trialWindowId: f.window.trialWindowId,
    plannedLaunchRecordId: f.bundle.launchRecord.launchRecordId,
    plannedRuntimeIdentityBindingId: f.bundle.runtimeIdentityBinding.bindingId,
    runtimeIdentity: Object.prototype.hasOwnProperty.call(input, 'runtimeIdentity') ? input.runtimeIdentity : f.identity,
    gitCommit: 'commit-r4', buildVersion: 'build-r4',
    sourceRegistryVersion: f.window.sourceRegistryVersion,
    sourcePolicySnapshotHash: f.window.sourcePolicySnapshotHash,
    observationPolicyVersion: f.window.observationPolicyVersion,
    decisionPolicyVersion: f.window.decisionPolicyVersion,
    startedAt: PREFLIGHT_START, completedAt: PREFLIGHT_END, signals, writeCounts: writes,
  });
}
async function commit(repo: InMemoryProductComplexityConvergenceObservationRepository,
  f: ReturnType<typeof fixtures>) {
  return commitRealTrialReentryApprovalBundle({ repository: repo, bundle: f.bundle,
    currentIdentity: f.identity, now: ACTIVATION_TIME });
}
async function activate(repo: InMemoryProductComplexityConvergenceObservationRepository,
  f: ReturnType<typeof fixtures>, patch: Partial<Parameters<typeof activateRealTrialReentry>[0]> = {}) {
  return activateRealTrialReentry({ repository: repo,
    launchRecordId: f.bundle.launchRecord.launchRecordId,
    currentIdentity: f.identity, runtimeHealthReady: true, providerReady: true,
    currentProviderBoundaryDigest: f.identity.identityInputs.providerBoundaryDigest,
    currentSourceRegistryVersion: f.window.sourceRegistryVersion,
    currentSourcePolicySnapshotHash: f.window.sourcePolicySnapshotHash,
    currentObservationPolicyVersion: f.window.observationPolicyVersion,
    currentDecisionPolicyVersion: f.window.decisionPolicyVersion,
    protectedWritesSincePreflight: 0, explicitOperatorConfirmation: true,
    now: ACTIVATION_TIME, ...patch });
}
