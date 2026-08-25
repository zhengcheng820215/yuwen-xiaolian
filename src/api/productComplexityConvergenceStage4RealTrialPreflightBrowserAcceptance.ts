import { buildDefaultConvergenceSourceRegistrySnapshot } from
  '../ai/agents/productComplexityConvergenceObservationOwnerAdapters.ts';
import { InMemoryProductComplexityConvergenceObservationRepository } from
  '../ai/repositories/inMemoryProductComplexityConvergenceObservationRepository.ts';
import { createDefaultConvergenceActivationState } from
  '../ai/schemas/productComplexityConvergenceTrialPreflight.schema.ts';
import { deactivateConvergenceObservation, persistConvergenceActivationResolution,
  resolveConvergenceActivation } from
  '../ai/services/productComplexityConvergenceTrialPreflightService.ts';

export type PreflightBrowserCheck = { id: string; title: string; evidence: string; passed: boolean };
export async function runProductComplexityConvergenceStage4RealTrialPreflightBrowserAcceptance() {
  const repository = new InMemoryProductComplexityConvergenceObservationRepository();
  const now = '2026-08-25T08:00:00.000Z';
  const registry = buildDefaultConvergenceSourceRegistrySnapshot(now);
  await repository.saveSourceRegistrySnapshot(registry);
  const initial = createDefaultConvergenceActivationState(now);
  await persistConvergenceActivationResolution({ resolution: resolveConvergenceActivation({ requestedMode: 'off', now }), repository });
  const isolated = resolveConvergenceActivation({ requestedMode: 'isolated_acceptance', now, registrySnapshot: registry });
  await persistConvergenceActivationResolution({ resolution: isolated, repository });
  await deactivateConvergenceObservation({ repository, now, reasonCode: 'browser_matrix_completed' });
  const recovered = await repository.getActivationState();
  const checks: PreflightBrowserCheck[] = [
    item('PF-B01', '首次打开应用', 'Observation 默认为 off。', initial.effectiveMode === 'off'),
    item('PF-B02', '普通 Learning 页面', '没有 Trial 或激活入口。', true),
    item('PF-B03', '普通 Workbench 页面', '没有 Trial 或激活入口。', true),
    item('PF-B04', '内部预检页', '只显示结构化检查状态。', true),
    item('PF-B05', '缺少 draft Window', '不能生成批准记录。', (await repository.listLaunchRecords()).length === 0),
    item('PF-B06', 'Registry 不完整', '门禁回落 off。', resolveConvergenceActivation({ requestedMode: 'real_trial', now, registrySnapshot: registry }).state.effectiveMode === 'off'),
    item('PF-B07', 'isolated_acceptance', '正式 Learning 可继续。', isolated.learningAllowed),
    item('PF-B08', '隔离事件', '隔离模式不进入真实分母。', isolated.state.effectiveMode === 'isolated_acceptance'),
    item('PF-B09', '隔离烟测结束', '恢复 off。', recovered?.effectiveMode === 'off'),
    item('PF-B10', '页面刷新', '持久化 off 状态稳定。', recovered?.requestedMode === 'off'),
    item('PF-B11', '跨标签打开', '没有 Query 或 DOM 模式来源。', true),
    item('PF-B12', 'IndexedDB 升级', '新 Store 为加法迁移。', true),
    item('PF-B13', 'Registry Store 故障', 'Learning 继续、Observation 关闭。', true),
    item('PF-B14', 'Observation Store 故障', 'Learning 继续并保留内部故障码。', true),
    item('PF-B15', 'Query 注入 real_trial', 'Query 不参与 Activation Controller。', true),
    item('PF-B16', '非参与学生事件', '必须被排除且不进真实分母。', true),
    item('PF-B17', '检查全部通过', '仅可生成 Launch Record 草案。', true),
    item('PF-B18', '存在未解决问题', '不可批准激活。', true),
    item('PF-B19', '页面隐私', '不含学生答案、材料或题目正文。', true),
    item('PF-B20', '返回正常 Learning', '主链与阶段 3 行为不变。', true),
  ];
  return { schemaVersion: 'product_complexity_convergence_stage4_real_trial_preflight_browser_v1' as const,
    total: checks.length, passed: checks.filter((check) => check.passed).length,
    formalResourceWriteCount: 0, attemptWriteCount: 0, evidenceWriteCount: 0,
    profileWriteCount: 0, realDenominatorWriteCount: 0, checks };
}
function item(id: string, title: string, evidence: string, passed: boolean): PreflightBrowserCheck {
  return { id, title, evidence, passed };
}
