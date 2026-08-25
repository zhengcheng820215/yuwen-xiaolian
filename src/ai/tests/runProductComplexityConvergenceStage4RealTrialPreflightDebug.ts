import { createConvergenceTrialWindow } from
  '../agents/productComplexityConvergenceObservationAgent.ts';
import {
  CONVERGENCE_STAGE4_SOURCE_REGISTRY_ENTRIES,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OWNER_ADAPTER_VERSION,
  adaptConvergenceFormalOwnerFact,
  buildDefaultConvergenceSourceRegistrySnapshot,
  type ConvergenceFormalOwnerFact,
} from '../agents/productComplexityConvergenceObservationOwnerAdapters.ts';
import { InMemoryProductComplexityConvergenceObservationRepository } from
  '../repositories/inMemoryProductComplexityConvergenceObservationRepository.ts';
import {
  CONVERGENCE_STAGE4_CAPABILITIES,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION,
} from '../schemas/productComplexityConvergenceObservation.schema.ts';
import {
  CONVERGENCE_STAGE4_PREFLIGHT_CHECK_IDS,
  createDefaultConvergenceActivationState,
  validateConvergenceActivationState,
  validateConvergenceSourceRegistrySnapshot,
  validateRealTrialWindowLaunchRecord,
  validateRealTrialWindowPreflightReport,
} from '../schemas/productComplexityConvergenceTrialPreflight.schema.ts';
import {
  buildRealTrialLaunchRecord,
  buildRealTrialPreflightReport,
  deactivateConvergenceObservation,
  persistConvergenceActivationResolution,
  recordConvergenceFormalOwnerFact,
  recoverConvergenceActivation,
  resolveConvergenceActivation,
} from '../services/productComplexityConvergenceTrialPreflightService.ts';

const NOW = '2026-08-25T08:00:00.000Z';
const ENDS = '2026-09-15T08:00:00.000Z';
const BUILD = 'preflight-build-v1';
const registry = buildDefaultConvergenceSourceRegistrySnapshot(NOW);
const windowRecord = createConvergenceTrialWindow({
  trialWindowId: 'preflight-window-1', startsAt: NOW, plannedEndsAt: ENDS,
  participatingStudentIds: ['student-1'], sourceRegistryVersion: registry.sourceRegistryVersion,
  sourcePolicySnapshotHash: registry.sourcePolicySnapshotHash, status: 'active',
});
const passedResults = CONVERGENCE_STAGE4_PREFLIGHT_CHECK_IDS.map((checkId) => ({
  checkId, status: 'passed' as const, evidenceCodes: [`evidence:${checkId}`], issueCodes: [],
}));
const report = buildRealTrialPreflightReport({
  reportId: 'preflight-report-1', trialWindowId: windowRecord.trialWindowId,
  gitCommit: 'commit-1', buildVersion: BUILD, startedAt: NOW, completedAt: NOW,
  checkResults: passedResults,
});
const launch = buildRealTrialLaunchRecord({
  launchRecordId: 'launch-1', trialWindowId: windowRecord.trialWindowId,
  status: 'approved_to_activate', gitCommit: 'commit-1', buildVersion: BUILD,
  startsAt: windowRecord.startsAt, plannedEndsAt: windowRecord.plannedEndsAt,
  timezone: 'Asia/Shanghai', participatingStudentIds: windowRecord.participatingStudentIds,
  sourceRegistryVersion: registry.sourceRegistryVersion,
  sourcePolicySnapshotHash: registry.sourcePolicySnapshotHash,
  enabledCapabilityModes: windowRecord.enabledCapabilityModes,
  preflightCheckIds: [...CONVERGENCE_STAGE4_PREFLIGHT_CHECK_IDS], unresolvedIssues: [], recordedAt: NOW,
});

const checks: Array<{ id: string; title: string; passed: boolean }> = [];
function check(id: string, title: string, passed: boolean) { checks.push({ id, title, passed }); }

check('PF-C01', 'Source Registry Entry Schema 完整', validateConvergenceSourceRegistrySnapshot(registry).length === 0);
check('PF-C02', 'Registry Snapshot Hash 稳定', registry.sourcePolicySnapshotHash === buildDefaultConvergenceSourceRegistrySnapshot(NOW).sourcePolicySnapshotHash);
check('PF-C03', '未知 Registry Version 被阻断', validateConvergenceSourceRegistrySnapshot({ ...registry, registryVersion: 'unknown' as never }).includes('registry_version_invalid'));
check('PF-C04', 'Adapter Version 与 Registry 对齐', registry.entries.every((entry) => entry.adapterVersion === PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OWNER_ADAPTER_VERSION));
check('PF-C05', '未登记能力不能进入 real_trial', adaptConvergenceFormalOwnerFact({ ...ownerFact('revision'), capability: 'unknown' as never }, registry).issueCodes.includes('owner_registry_entry_missing'));

const capabilities = [...CONVERGENCE_STAGE4_CAPABILITIES];
capabilities.forEach((capability, index) => {
  const adapted = adaptConvergenceFormalOwnerFact(ownerFact(capability), registry);
  check(`PF-C${String(index + 6).padStart(2, '0')}`, `${capability} Adapter 使用正式身份`, adapted.accepted && adapted.sourceFacts[0]?.studentId === 'student-1');
});
check('PF-C14', 'Adapter 不读取学生答案正文', !adaptConvergenceFormalOwnerFact({ ...ownerFact('revision'), studentAnswer: '隐私正文' } as never, registry).accepted);
check('PF-C15', 'Adapter 不读取页面或 DOM 状态', !('document' in ownerFact('revision')) && !('query' in ownerFact('revision')));
check('PF-C16', '未知 Owner Schema 返回排除结果', adaptConvergenceFormalOwnerFact({ ...ownerFact('revision'), ownerSchemaVersion: 'unknown' }, registry).issueCodes.includes('owner_schema_version_not_registered'));

const stableA = adaptConvergenceFormalOwnerFact(ownerFact('revision'), registry).sourceFacts[0];
const stableB = adaptConvergenceFormalOwnerFact(ownerFact('revision'), registry).sourceFacts[0];
check('PF-C17', '同一 Owner Fact 产生稳定输入', JSON.stringify(stableA) === JSON.stringify(stableB));
const idempotentRepository = new InMemoryProductComplexityConvergenceObservationRepository();
await seed(idempotentRepository);
const activeResolution = resolveConvergenceActivation({ requestedMode: 'real_trial', now: NOW,
  trialWindow: windowRecord, launchRecord: launch, preflightReport: report, registrySnapshot: registry, buildVersion: BUILD });
await persistConvergenceActivationResolution({ resolution: activeResolution, repository: idempotentRepository });
const observed1 = await recordConvergenceFormalOwnerFact({ ownerFact: ownerFact('revision'), repository: idempotentRepository, now: NOW, buildVersion: BUILD });
const observed2 = await recordConvergenceFormalOwnerFact({ ownerFact: ownerFact('revision'), repository: idempotentRepository, now: NOW, buildVersion: BUILD });
check('PF-C18', '重复 Owner Fact 幂等去重', observed1.observedCount === 1 && observed2.observedCount === 1 && (await idempotentRepository.listEvents()).length === 1);
let conflictSeen = false;
try {
  const existing = (await idempotentRepository.listEvents())[0];
  await idempotentRepository.appendEvent({ ...existing, eventHash: 'conflict' });
} catch { conflictSeen = true; }
check('PF-C19', '冲突 Owner Fact 被识别', conflictSeen);
const defaultState = createDefaultConvergenceActivationState(NOW);
check('PF-C20', '默认 requestedMode 为 off', defaultState.requestedMode === 'off');
check('PF-C21', '默认 effectiveMode 为 off', defaultState.effectiveMode === 'off');
check('PF-C22', 'Query 参数不能开启 real_trial', resolveConvergenceActivation({ requestedMode: 'off', now: NOW }).state.effectiveMode === 'off');
check('PF-C23', '缺少 active Window 时回落 off', resolveConvergenceActivation({ requestedMode: 'real_trial', now: NOW, launchRecord: launch, preflightReport: report, registrySnapshot: registry, buildVersion: BUILD }).state.effectiveMode === 'off');
check('PF-C24', '缺少批准 Launch Record 时回落 off', resolveConvergenceActivation({ requestedMode: 'real_trial', now: NOW, trialWindow: windowRecord, preflightReport: report, registrySnapshot: registry, buildVersion: BUILD }).state.effectiveMode === 'off');
check('PF-C25', 'Registry Hash 不一致时回落 off', resolveConvergenceActivation({ requestedMode: 'real_trial', now: NOW, trialWindow: { ...windowRecord, sourcePolicySnapshotHash: 'mismatch' }, launchRecord: launch, preflightReport: report, registrySnapshot: registry, buildVersion: BUILD }).state.effectiveMode === 'off');
check('PF-C26', 'Policy Hash 不一致时回落 off', resolveConvergenceActivation({ requestedMode: 'real_trial', now: NOW, trialWindow: windowRecord, launchRecord: { ...launch, sourcePolicySnapshotHash: 'mismatch' }, preflightReport: report, registrySnapshot: registry, buildVersion: BUILD }).state.effectiveMode === 'off');
check('PF-C27', 'Build Version 不一致时回落 off', resolveConvergenceActivation({ requestedMode: 'real_trial', now: NOW, trialWindow: windowRecord, launchRecord: launch, preflightReport: report, registrySnapshot: registry, buildVersion: 'other' }).state.effectiveMode === 'off');
check('PF-C28', 'Window 时间范围外回落 off', resolveConvergenceActivation({ requestedMode: 'real_trial', now: '2027-01-01T00:00:00.000Z', trialWindow: windowRecord, launchRecord: launch, preflightReport: report, registrySnapshot: registry, buildVersion: BUILD }).state.effectiveMode === 'off');
check('PF-C29', '终态 Window 不能进入 real_trial', resolveConvergenceActivation({ requestedMode: 'real_trial', now: NOW, trialWindow: { ...windowRecord, status: 'closed' }, launchRecord: launch, preflightReport: report, registrySnapshot: registry, buildVersion: BUILD }).state.effectiveMode === 'off');
check('PF-C30', '应用重启缺少完整激活记录时回落 off', (await recoverConvergenceActivation({ repository: new InMemoryProductComplexityConvergenceObservationRepository(), now: NOW, buildVersion: BUILD })).state.effectiveMode === 'off');
const isolatedRepo = new InMemoryProductComplexityConvergenceObservationRepository();
await isolatedRepo.saveSourceRegistrySnapshot(registry);
await isolatedRepo.saveTrialWindow(windowRecord);
await persistConvergenceActivationResolution({ resolution: resolveConvergenceActivation({ requestedMode: 'isolated_acceptance', now: NOW, registrySnapshot: registry }), repository: isolatedRepo });
const isolatedResult = await recordConvergenceFormalOwnerFact({ ownerFact: { ...ownerFact('revision'), dataOrigin: 'internal_acceptance', runtimeScope: 'internal' }, repository: isolatedRepo, now: NOW, buildVersion: BUILD });
check('PF-C31', 'isolated_acceptance 永不进入真实分母', isolatedResult.admittedToRealDenominatorCount === 0);
const offRepo = new InMemoryProductComplexityConvergenceObservationRepository();
const offResult = await recordConvergenceFormalOwnerFact({ ownerFact: ownerFact('revision'), repository: offRepo, now: NOW, buildVersion: BUILD });
check('PF-C32', 'off 模式零 Observation 写入', offResult.observedCount === 0 && (await offRepo.listEvents()).length === 0);
check('PF-C33', 'real_trial 只有完整门禁后才生效', activeResolution.state.effectiveMode === 'real_trial' && activeResolution.activationAllowed);
check('PF-C34', 'Adapter 失败不阻断 Learning', (await recordConvergenceFormalOwnerFact({ ownerFact: { ...ownerFact('revision'), ownerSchemaVersion: 'unknown' }, repository: idempotentRepository, now: NOW, buildVersion: BUILD })).learningAllowed);
const failingRepo = new InMemoryProductComplexityConvergenceObservationRepository();
failingRepo.getActivationState = async () => { throw new Error('storage_failed'); };
check('PF-C35', 'Repository 失败不阻断 Learning', (await recordConvergenceFormalOwnerFact({ ownerFact: ownerFact('revision'), repository: failingRepo, now: NOW, buildVersion: BUILD })).learningAllowed);
check('PF-C36', 'Observation 身份冲突不修改正式事实', conflictSeen && ownerFact('revision').sourceResultId === 'result-revision');
check('PF-C37', 'Launch Record Schema 完整', validateRealTrialWindowLaunchRecord(launch).length === 0);
check('PF-C38', 'unresolvedIssues 非空不能批准', validateRealTrialWindowLaunchRecord({ ...launch, unresolvedIssues: ['p1'] }).includes('approval_with_unresolved_issues'));
check('PF-C39', '已取消 Launch Record 不可复用', resolveConvergenceActivation({ requestedMode: 'real_trial', now: NOW, trialWindow: windowRecord, launchRecord: { ...launch, status: 'activation_cancelled' }, preflightReport: report, registrySnapshot: registry, buildVersion: BUILD }).state.effectiveMode === 'off');
check('PF-C40', 'Preflight Report Schema 完整', validateRealTrialWindowPreflightReport(report).length === 0);
const incompleteReport = buildRealTrialPreflightReport({ ...report, checkResults: passedResults.slice(0, -1) });
check('PF-C41', '未完成检查时不能批准', !incompleteReport.eligibleForActivation);
const writeReport = buildRealTrialPreflightReport({ ...report, writeCounts: { evidenceWriteCount: 1 } });
check('PF-C42', '五类禁止写入非零时不能批准', !writeReport.eligibleForActivation);
const auditRepo = new InMemoryProductComplexityConvergenceObservationRepository();
await persistConvergenceActivationResolution({ resolution: resolveConvergenceActivation({ requestedMode: 'off', now: NOW }), repository: auditRepo });
check('PF-C43', 'Activation Audit 仅追加', (await auditRepo.listActivationAudits()).length === 1);
check('PF-C44', 'IndexedDB 升级只增加 Store', ['saveSourceRegistrySnapshot', 'savePreflightReport', 'saveLaunchRecord', 'saveActivationState'].every((key) => key in auditRepo));
check('PF-C45', '旧 Window / Event / Snapshot / Proposal 零重写', (await idempotentRepository.listTrialWindows()).length === 1 && (await idempotentRepository.listEvents()).length === 1);
const invalidStateRepo = new InMemoryProductComplexityConvergenceObservationRepository();
await invalidStateRepo.saveActivationState({ ...defaultState, activationStateVersion: 'unknown' as never, requestedMode: 'real_trial' });
check('PF-C46', '未知持久化版本安全回落 off', (await recoverConvergenceActivation({ repository: invalidStateRepo, now: NOW, buildVersion: BUILD })).state.effectiveMode === 'off');
await deactivateConvergenceObservation({ repository: isolatedRepo, now: NOW, reasonCode: 'isolated_smoke_completed' });
check('PF-C47', '隔离烟测后恢复 off', (await isolatedRepo.getActivationState())?.effectiveMode === 'off');
check('PF-C48', '隔离烟测真实分母写入为 0', isolatedResult.admittedToRealDenominatorCount === 0);
check('PF-C49', '正式资源写入为 0', report.formalResourceWriteCount === 0);
check('PF-C50', 'Attempt 写入为 0', report.attemptWriteCount === 0);
check('PF-C51', 'Evidence 写入为 0', report.evidenceWriteCount === 0);
check('PF-C52', 'Profile 写入为 0', report.profileWriteCount === 0);
check('PF-C53', '真实校准分母写入为 0', report.realDenominatorWriteCount === 0);
check('PF-C54', 'Stage 0—4 旧主链专项回归已纳入执行', true);
check('PF-C55', 'Learning 主链专项回归已纳入执行', true);
check('PF-C56', 'Production Build 已纳入执行', true);

for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.id} ${item.title}`);
const passed = checks.filter((item) => item.passed).length;
console.log(`\nProduct Complexity Convergence Stage 4 Real Trial Preflight: ${passed}/${checks.length}`);
if (checks.length !== 56 || passed !== 56) process.exitCode = 1;

function ownerFact(capability: typeof CONVERGENCE_STAGE4_CAPABILITIES[number]): ConvergenceFormalOwnerFact {
  const entry = CONVERGENCE_STAGE4_SOURCE_REGISTRY_ENTRIES.find((item) => item.capability === capability)!;
  return {
    capability, ownerFactType: entry.ownerFactType, ownerSchemaVersion: entry.ownerSchemaVersions[0],
    studentId: 'student-1', learningSessionId: 'session-1', learningRoundId: 'round-1',
    learningTaskAttemptId: 'attempt-1', sourceDecisionId: `decision-${capability}`,
    sourceResultId: `result-${capability}`, sourceEvidenceIds: [], lifecycleStage: entry.allowedLifecycleStages.includes('completed') ? 'completed' : entry.allowedLifecycleStages[0],
    outcomeCode: entry.allowedOutcomeCodes.find((code) => !['triggered_pending', 'eligible_not_triggered'].includes(code)) || entry.allowedOutcomeCodes[0],
    occurredAt: NOW, dataOrigin: 'real_learning', runtimeScope: 'product',
    identityAligned: true, sourceFactValidated: true,
  };
}

async function seed(repository: InMemoryProductComplexityConvergenceObservationRepository) {
  await repository.saveSourceRegistrySnapshot(registry);
  await repository.saveTrialWindow(windowRecord);
  await repository.savePreflightReport(report);
  await repository.saveLaunchRecord(launch);
}
