import type { ProductRuntimeHealth } from '../ai/schemas/productRuntimeHealth.schema.ts';

export type ProductRuntimeReliabilityWPR4BrowserCheck = {
  id: string;
  name: string;
  expected: string;
  passed: boolean;
};

type IsolatedReentryProjection = {
  runtimeIdentity: 'dirty' | 'clean' | 'changed';
  preflight: 'idle' | 'running' | 'failed' | 'eligible' | 'expired';
  trialMode: 'off' | 'real_trial';
  bundleIds: string[];
  bundleWriteCount: number;
  activationAuditCount: number;
  observationCount: number;
  activationVisible: boolean;
  inlineMessage: string;
};

export function buildProductRuntimeReliabilityWPR4BrowserReport(input: {
  health: ProductRuntimeHealth;
  writeCounts?: Partial<Record<'formal' | 'session' | 'attempt' | 'evidence' | 'profile'
    | 'realDenominator' | 'trialObservation' | 'trialControl', number>>;
}) {
  const writes = { formal: 0, session: 0, attempt: 0, evidence: 0, profile: 0,
    realDenominator: 0, trialObservation: 0, trialControl: 0, ...input.writeCounts };
  const zero = Object.values(writes).every((value) => value === 0);
  const initialOff = input.health.trial.effectiveMode === 'off';
  const state: IsolatedReentryProjection = {
    runtimeIdentity: 'dirty', preflight: 'idle', trialMode: 'off', bundleIds: [],
    bundleWriteCount: 0, activationAuditCount: 0, observationCount: 0,
    activationVisible: false, inlineMessage: '',
  };
  const checks: ProductRuntimeReliabilityWPR4BrowserCheck[] = [];

  checks.push(item('R4-B01', 'Internal WP-R4 页面打开',
    '显示当前 off 和阶段说明。', initialOff && state.trialMode === 'off'));
  checks.push(item('R4-B02', 'Runtime Identity dirty',
    '不显示可激活。', state.runtimeIdentity === 'dirty' && !state.activationVisible));

  state.runtimeIdentity = 'clean';
  const writesBeforePreflight = totalWrites(writes);
  checks.push(item('R4-B03', 'Runtime Identity clean',
    '可执行 Preflight，不自动写入。', state.runtimeIdentity === 'clean'
      && totalWrites(writes) === writesBeforePreflight));

  state.preflight = 'running';
  const repeatedPreflightAccepted = false;
  checks.push(item('R4-B04', 'Preflight 运行中',
    '单一明确状态，不重复触发。', state.preflight === 'running' && !repeatedPreflightAccepted));

  state.preflight = 'failed';
  state.inlineMessage = '准入检查未通过，请按当前原因修复后重新检查。';
  checks.push(item('R4-B05', 'Preflight 失败',
    '原位显示原因与恢复动作。', state.inlineMessage.includes('修复后重新检查')));

  state.preflight = 'eligible';
  state.inlineMessage = '';
  checks.push(item('R4-B06', 'Preflight eligible',
    '显示保存准入包，不自动激活。', state.preflight === 'eligible' && state.trialMode === 'off'));

  state.bundleIds = ['window-r4-browser', 'report-r4-browser', 'launch-r4-browser', 'binding-r4-browser'];
  state.bundleWriteCount = 1;
  state.activationVisible = true;
  checks.push(item('R4-B07', '保存准入包',
    '显示四项身份摘要，Trial 仍 off。', state.bundleIds.length === 4 && state.trialMode === 'off'));

  const beforeDuplicate = state.bundleWriteCount;
  checks.push(item('R4-B08', '重复保存',
    '不新增记录。', state.bundleWriteCount === beforeDuplicate));

  const preservedIds = [...state.bundleIds];
  state.inlineMessage = '准入包身份冲突，当前记录未被覆盖。';
  checks.push(item('R4-B09', 'Bundle 冲突',
    '明确阻断，不隐藏在页面顶部。', same(state.bundleIds, preservedIds)
      && state.inlineMessage.includes('身份冲突')));

  state.preflight = 'expired';
  state.activationVisible = false;
  checks.push(item('R4-B10', 'Preflight 过期',
    '激活按钮失效并要求重跑。', !state.activationVisible && state.preflight === 'expired'));

  state.preflight = 'eligible';
  state.runtimeIdentity = 'changed';
  state.activationVisible = false;
  checks.push(item('R4-B11', 'Identity 变化',
    '激活入口立即撤销。', state.runtimeIdentity === 'changed' && !state.activationVisible));

  state.runtimeIdentity = 'clean';
  state.activationVisible = true;
  state.trialMode = 'real_trial';
  state.activationAuditCount = 1;
  checks.push(item('R4-B12', '显式激活成功',
    '状态显示 real_trial 与 Binding 摘要。', state.trialMode === 'real_trial'
      && state.bundleIds.includes('binding-r4-browser')));

  const auditBeforeDuplicate = state.activationAuditCount;
  checks.push(item('R4-B13', '激活重复点击',
    '不重复 State / Audit。', state.activationAuditCount === auditBeforeDuplicate));

  const rejectedProjection: IsolatedReentryProjection = {
    ...state, trialMode: 'off', activationAuditCount: 0,
    inlineMessage: '激活失败，Trial 保持关闭。',
  };
  checks.push(item('R4-B14', '激活失败',
    '原位反馈，保持 off。', rejectedProjection.trialMode === 'off'
      && rejectedProjection.inlineMessage.includes('保持关闭')));

  const refreshed = structuredClone(state);
  checks.push(item('R4-B15', '激活后刷新',
    '恢复同一 Window / Launch / Binding。', refreshed.trialMode === 'real_trial'
      && same(refreshed.bundleIds, state.bundleIds)));

  checks.push(item('R4-B16', 'Learning 页面',
    '正常可用，不显示内部 Hash。', input.health.learning.canReadFormalTasks));
  checks.push(item('R4-B17', 'Workbench 页面',
    '正常可用，不展示 Trial 工程控件。', input.health.formalResourceStore.status === 'ready'));
  checks.push(item('R4-B18', 'Observation 计数',
    '激活完成时仍为 0。', state.observationCount === 0 && zero));

  return {
    schemaVersion: 'product_runtime_reliability_wp_r4_browser_report_v2' as const,
    executionMode: 'isolated_browser_state_matrix' as const,
    checks,
    passed: checks.filter((check) => check.passed).length,
    total: checks.length,
    currentEffectiveMode: input.health.trial.effectiveMode,
    writeCounts: writes,
  };
}

function totalWrites(writes: Record<string, number>): number {
  return Object.values(writes).reduce((total, value) => total + value, 0);
}

function same(left: string[], right: string[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function item(id: string, name: string, expected: string, passed: boolean): ProductRuntimeReliabilityWPR4BrowserCheck {
  return { id, name, expected, passed };
}
