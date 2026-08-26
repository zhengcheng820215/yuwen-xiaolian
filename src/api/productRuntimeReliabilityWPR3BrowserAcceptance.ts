import type { ProductRuntimeHealth } from '../ai/schemas/productRuntimeHealth.schema.ts';

export type ProductRuntimeReliabilityWPR3BrowserCheck = {
  id: string;
  name: string;
  expected: string;
  passed: boolean;
};

export function buildProductRuntimeReliabilityWPR3BrowserReport(input: {
  health: ProductRuntimeHealth;
  writeCounts?: Partial<Record<'formal' | 'session' | 'attempt' | 'evidence' | 'profile' | 'calibration' | 'trialWindow' | 'launch' | 'binding' | 'observation', number>>;
}) {
  const writes = { formal: 0, session: 0, attempt: 0, evidence: 0, profile: 0,
    calibration: 0, trialWindow: 0, launch: 0, binding: 0, observation: 0, ...input.writeCounts };
  const zero = Object.values(writes).every((count) => count === 0);
  const identityStatus = input.health.instance.runtimeIdentityStatus || 'missing';
  const alignment = input.health.trial.identityAlignment || input.health.trial.identityStatus;
  const trialOffWhenUnaligned = alignment === 'aligned'
    || input.health.trial.effectiveMode === 'off';
  const checks: ProductRuntimeReliabilityWPR3BrowserCheck[] = [
    item('R3-B01', 'Runtime Identity', 'Health 返回结构化身份状态。', ['available', 'missing', 'invalid', 'dirty'].includes(identityStatus)),
    item('R3-B02', '只读刷新', '重复 GET 不写正式数据。', zero),
    item('R3-B03', 'Internal 摘要', '只显示短 Hash 与状态。', !input.health.instance.buildIdentity || input.health.instance.buildIdentity.startsWith('sha256:')),
    item('R3-B04', 'Learning fail-open', '身份未准入不阻断正式资源读取。', input.health.learning.canReadFormalTasks),
    item('R3-B05', '普通页面隔离', '身份问题不改变 Learning 状态语义。', input.health.learning.status !== 'blocked' || input.health.formalResourceStore.status === 'blocked'),
    item('R3-B06', 'Missing', '缺少身份时 Trial 为 off。', identityStatus !== 'missing' || input.health.trial.effectiveMode === 'off'),
    item('R3-B07', 'Invalid', '身份损坏时 Trial 为 off。', identityStatus !== 'invalid' || input.health.trial.effectiveMode === 'off'),
    item('R3-B08', 'Dirty', 'Dirty 时 Trial 为 off。', identityStatus !== 'dirty' || input.health.trial.effectiveMode === 'off'),
    item('R3-B09', 'Legacy', '旧身份不可冒充 aligned。', alignment !== 'legacy_unverifiable' || input.health.trial.effectiveMode === 'off'),
    item('R3-B10', 'Mismatch', 'Digest 不一致时 Trial 为 off。', trialOffWhenUnaligned),
    item('R3-B11', '幂等', '只读重复执行不写 Audit。', zero),
    item('R3-B12', 'Learning 连续性', 'Trial off 不阻断 Learning。', input.health.trial.effectiveMode !== 'off' || input.health.learning.canReadFormalTasks),
    item('R3-B13', '真实分母隔离', '只读验收不写 Observation。', writes.observation === 0 && writes.calibration === 0),
    item('R3-B14', '重新准入说明', '非 aligned 状态提供 Trial reason。', alignment === 'aligned' || input.health.trial.reasonCodes.length > 0),
    item('R3-B15', '无激活入口', '页面报告不提供 Trial 写入口。', writes.trialWindow === 0 && writes.launch === 0 && writes.binding === 0),
    item('R3-B16', 'WP-R4 边界', '恢复身份不会由本报告激活 Trial。', zero),
  ];
  return { schemaVersion: 'product_runtime_reliability_wp_r3_browser_report_v1' as const,
    checks, passed: checks.filter((check) => check.passed).length, total: checks.length, writeCounts: writes };
}

function item(id: string, name: string, expected: string, passed: boolean): ProductRuntimeReliabilityWPR3BrowserCheck {
  return { id, name, expected, passed };
}
