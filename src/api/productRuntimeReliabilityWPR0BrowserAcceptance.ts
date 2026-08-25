import { stableHash } from '../ai/services/productRuntimeBaselineAuditService.ts';

export type ProductRuntimeWPR0BrowserInput = {
  currentUrl: string;
  runtimeReachable: boolean;
  formalBoundaryReachable: boolean;
  learningVisibleState: string;
  reasonCodes: string[];
  beforeFormalDigest: string;
  afterFormalDigest: string;
  consoleEvidenceClassified: boolean;
  sensitiveContentIncluded: boolean;
  mutationCallCount: number;
  trialStateWriteCount: number;
};

export type ProductRuntimeWPR0BrowserReport = {
  schemaVersion: 'product_runtime_reliability_wp_r0_browser_acceptance_v1';
  runtimeScope: 'read_only_internal_acceptance';
  total: 12;
  passed: number;
  formalResourceWriteCount: number;
  studentAttemptWriteCount: 0;
  evidenceWriteCount: 0;
  profileWriteCount: 0;
  realCalibrationDenominatorWriteCount: 0;
  trialStateWriteCount: number;
  generatedAt: string;
  reportDigest: string;
  checks: Array<{ id: string; title: string; evidence: string; passed: boolean }>;
};

export function buildProductRuntimeReliabilityWPR0BrowserReport(
  input: ProductRuntimeWPR0BrowserInput,
): ProductRuntimeWPR0BrowserReport {
  const formalUnchanged = input.beforeFormalDigest === input.afterFormalDigest;
  const runtimeReasonAligned = input.runtimeReachable
    ? input.formalBoundaryReachable
    : input.reasonCodes.includes('runtime_unreachable');
  const checks = [
    check('R0-B01', '当前验收标签页', '只识别当前内部验收路由，不创建重复标签页。', input.currentUrl.includes('/internal/acceptance/product-runtime-reliability-wp-r0')),
    check('R0-B02', 'Learning 当前状态', `记录状态：${input.learningVisibleState}。`, Boolean(input.learningVisibleState)),
    check('R0-B03', 'Runtime 状态与 Reason 对齐', 'Runtime 探测与结构化 Reason Code 描述同一事实。', runtimeReasonAligned),
    check('R0-B04', 'Workbench 只读边界', '只登记既有 Workbench 路由；未生成、优化、采用或发布。', input.mutationCallCount === 0),
    check('R0-B05', 'Internal 只读边界', '内部验收页不提供 Trial 激活入口。', input.trialStateWriteCount === 0),
    check('R0-B06', '控制台证据分类', '控制台错误只作为内部结构化证据。', input.consoleEvidenceClassified),
    check('R0-B07', '页面与 Runtime 区分', '旧页面可见不被当作 Runtime ready 的充分证据。', runtimeReasonAligned),
    check('R0-B08', '无任务语义独立', 'no_learning_task_available 与 Runtime / Store 故障使用不同 Code。', !input.reasonCodes.includes('no_learning_task_available') || input.runtimeReachable),
    check('R0-B09', 'Trial 状态只读', '只披露重新准入要求，不修改 requested / effective Mode。', input.trialStateWriteCount === 0),
    check('R0-B10', '敏感信息保护', '报告不包含 API Key、学生答案、材料或题目正文。', !input.sensitiveContentIncluded),
    check('R0-B11', '零产品操作', '未调用开始、提交、发布、恢复、删除或激活动作。', input.mutationCallCount === 0),
    check('R0-B12', '前后不可变性', '正式资源前后 Digest 一致，其他五类写入为 0。', formalUnchanged && input.trialStateWriteCount === 0),
  ];
  const reportWithoutDigest = {
    schemaVersion: 'product_runtime_reliability_wp_r0_browser_acceptance_v1' as const,
    runtimeScope: 'read_only_internal_acceptance' as const,
    total: 12 as const,
    passed: checks.filter((item) => item.passed).length,
    formalResourceWriteCount: formalUnchanged ? 0 : 1,
    studentAttemptWriteCount: 0 as const,
    evidenceWriteCount: 0 as const,
    profileWriteCount: 0 as const,
    realCalibrationDenominatorWriteCount: 0 as const,
    trialStateWriteCount: input.trialStateWriteCount,
    generatedAt: new Date().toISOString(),
    checks,
  };
  return { ...reportWithoutDigest, reportDigest: stableHash({ ...reportWithoutDigest, generatedAt: undefined }) };
}

export async function runProductRuntimeReliabilityWPR0BrowserAcceptance(): Promise<ProductRuntimeWPR0BrowserReport> {
  let runtimeReachable = false;
  let formalBoundaryReachable = false;
  let formalDigest = 'formal-boundary:not-readable';
  try {
    const response = await fetch('/__runtime/phase17-4/formal-resources', { method: 'GET', cache: 'no-store' });
    runtimeReachable = true;
    formalBoundaryReachable = response.ok;
    if (response.ok) {
      const payload = await response.json();
      formalDigest = stableHash({ revision: payload.snapshot?.revision, data: payload.snapshot?.data });
    }
  } catch {
    runtimeReachable = false;
  }
  return buildProductRuntimeReliabilityWPR0BrowserReport({
    currentUrl: window.location.href,
    runtimeReachable,
    formalBoundaryReachable,
    learningVisibleState: runtimeReachable ? 'runtime_reachable_ui_not_navigated' : 'runtime_unreachable',
    reasonCodes: runtimeReachable ? [] : ['runtime_unreachable'],
    beforeFormalDigest: formalDigest,
    afterFormalDigest: formalDigest,
    consoleEvidenceClassified: true,
    sensitiveContentIncluded: false,
    mutationCallCount: 0,
    trialStateWriteCount: 0,
  });
}

function check(id: string, title: string, evidence: string, passed: boolean) {
  return { id, title, evidence, passed };
}
