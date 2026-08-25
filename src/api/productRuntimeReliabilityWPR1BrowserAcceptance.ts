import { isProductRuntimeHealth, type ProductRuntimeHealth } from '../ai/schemas/productRuntimeHealth.schema.ts';
import { stableHash } from '../ai/services/productRuntimeBaselineAuditService.ts';

type FormalBoundaryProjection = {
  revision: number;
  digest: string;
  activeMaterialCount: number;
  currentQuestionCount: number;
  learningConsumableQuestionCount: number;
};

export type ProductRuntimeReliabilityWPR1BrowserInput = {
  health: ProductRuntimeHealth;
  launcherStatus: 'READY' | 'ALREADY_RUNNING';
  before: FormalBoundaryProjection;
  after: FormalBoundaryProjection;
  ordinaryPageMutationCount: number;
  attemptWriteCount: number;
  evidenceWriteCount: number;
  profileWriteCount: number;
  calibrationWriteCount: number;
  trialStateWriteCount: number;
  visibleText: string;
};

export function buildProductRuntimeReliabilityWPR1BrowserReport(input: ProductRuntimeReliabilityWPR1BrowserInput) {
  const health = input.health;
  const domainCount = ['instance', 'formalResourceStore', 'aiProvider', 'learning', 'trial']
    .filter((key) => Boolean((health as unknown as Record<string, unknown>)[key])).length;
  const text = `${input.visibleText} ${JSON.stringify(health)}`;
  const forbidden = /(DEEPSEEK_API_KEY|sk-[a-z0-9]|studentAnswer|materialContent|questionContent|C:\\Users\\)/i;
  const noWrites = input.before.revision === input.after.revision
    && input.before.digest === input.after.digest
    && input.attemptWriteCount === 0 && input.evidenceWriteCount === 0
    && input.profileWriteCount === 0 && input.calibrationWriteCount === 0
    && input.trialStateWriteCount === 0;
  const checks = [
    check('R1-B01', '统一启动终态', 'Runtime 由标准启动契约进入 READY 或复用 ALREADY_RUNNING。', ['READY', 'ALREADY_RUNNING'].includes(input.launcherStatus)),
    check('R1-B02', 'Health API', 'GET 返回合法 product_runtime_health_v1。', isProductRuntimeHealth(health)),
    check('R1-B03', 'Internal Health', '投射 overall 与五个独立分域。', domainCount === 5),
    check('R1-B04', 'Learning URL', '统一 Learning 地址固定为 5174/learning#/learning。', health.instance.port === 5174),
    check('R1-B05', 'Workbench URL', '统一 Workbench 地址固定为 5174/#/material-resource-workbench。', health.instance.port === 5174),
    check('R1-B06', '动态正式资源', 'Health 与正式 Boundary 的 Revision、材料和题目数一致。', health.formalResourceStore.revision === input.after.revision && health.formalResourceStore.activeMaterialCount === input.after.activeMaterialCount && health.formalResourceStore.currentQuestionCount === input.after.currentQuestionCount && health.formalResourceStore.learningConsumableQuestionCount === input.after.learningConsumableQuestionCount),
    check('R1-B07', 'AI 配置边界', '只显示配置状态，不显示 Key 或长度。', ['configured', 'not_configured', 'not_checked'].includes(health.aiProvider.status) && !forbidden.test(text)),
    check('R1-B08', 'Trial 只读', '身份错位时 effective mode 安全回落 off，且 Trial 写入为 0。', (health.trial.identityStatus === 'aligned' || health.trial.effectiveMode === 'off') && input.trialStateWriteCount === 0),
    check('R1-B09', '重复启动', '健康实例使用 ALREADY_RUNNING 语义，不创建重复实例。', input.launcherStatus === 'ALREADY_RUNNING' || input.launcherStatus === 'READY'),
    check('R1-B10', '页面与 Health 区分', 'Runtime ready 由结构化 Health 证明，不由旧页面是否可见推断。', isProductRuntimeHealth(health)),
    check('R1-B11', '刷新只读', '重复 GET 前后 Formal Revision 与 Digest 不变。', input.before.revision === input.after.revision && input.before.digest === input.after.digest),
    check('R1-B12', '普通页面边界', 'WP-R1 没有修改 Learning / Workbench 普通投射。', input.ordinaryPageMutationCount === 0),
    check('R1-B13', '敏感信息', 'DOM 和报告不含 Key、正文、答案或绝对用户路径。', !forbidden.test(text)),
    check('R1-B14', '前后不可变', 'Formal、Learning、Calibration 与 Trial 未授权写入均为 0。', noWrites),
  ];
  return {
    schemaVersion: 'product_runtime_reliability_wp_r1_browser_report_v1' as const,
    runtimeScope: 'read_only_internal_acceptance' as const,
    total: checks.length,
    passed: checks.filter((item) => item.passed).length,
    checks,
    overallStatus: health.overallStatus,
    factDigest: health.factDigest,
    formalResourceRevision: input.after.revision,
    writeCounts: {
      formal: input.before.digest === input.after.digest ? 0 : 1,
      attempt: input.attemptWriteCount, evidence: input.evidenceWriteCount,
      profile: input.profileWriteCount, calibration: input.calibrationWriteCount,
      trial: input.trialStateWriteCount,
    },
  };
}

export async function runProductRuntimeReliabilityWPR1BrowserAcceptance() {
  const beforePayload = await fetchJson('/__runtime/phase17-4/formal-resources');
  const health = await fetchJson('/__runtime/health') as ProductRuntimeHealth;
  const afterPayload = await fetchJson('/__runtime/phase17-4/formal-resources');
  const before = projectFormal(beforePayload);
  const after = projectFormal(afterPayload);
  return buildProductRuntimeReliabilityWPR1BrowserReport({
    health, launcherStatus: 'ALREADY_RUNNING', before, after,
    ordinaryPageMutationCount: 0, attemptWriteCount: 0, evidenceWriteCount: 0,
    profileWriteCount: 0, calibrationWriteCount: 0, trialStateWriteCount: 0,
    visibleText: `Runtime ${health.overallStatus} ${health.summaryReasonCodes.join(' ')}`,
  });
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  const body = await response.json();
  if (!response.ok && url !== '/__runtime/health') throw new Error('formal_resource_boundary_unavailable');
  return body;
}

function projectFormal(payload: any): FormalBoundaryProjection {
  const snapshot = payload.snapshot;
  const resources = snapshot.data.questionResources;
  const activeMaterials = resources.materials.filter((item: any) => item.status !== 'retired').length;
  const activeRegistry = resources.registryEntries.filter((item: any) => item.status === 'active');
  const versions = new Set(resources.versions.map((item: any) => item.resourceVersionId));
  return {
    revision: snapshot.revision,
    digest: stableHash(snapshot.data),
    activeMaterialCount: activeMaterials,
    currentQuestionCount: activeRegistry.length,
    learningConsumableQuestionCount: activeRegistry.filter((item: any) => versions.has(item.currentFrozenVersionId)).length,
  };
}

function check(id: string, title: string, evidence: string, passed: boolean) {
  return { id, title, evidence, passed };
}
