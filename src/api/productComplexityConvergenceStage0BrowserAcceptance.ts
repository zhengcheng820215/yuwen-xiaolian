import {
  buildDefaultProductComplexityStage0AuditSource,
  buildProductComplexityConvergenceStage0Audit,
} from '../ai/services/productComplexityConvergenceStage0AuditService.ts';

export type ProductComplexityStage0BrowserCheck = {
  id: string;
  title: string;
  evidence: string;
  passed: boolean;
};

export type ProductComplexityStage0BrowserReport = {
  schemaVersion: 'product_complexity_convergence_stage0_browser_acceptance_v1';
  runtimeScope: 'read_only_internal_acceptance';
  total: number;
  passed: number;
  formalResourceWriteCount: 0;
  studentAttemptWriteCount: 0;
  studentProfileWriteCount: 0;
  realCalibrationDenominatorWriteCount: 0;
  auditDigest: string;
  generatedAt: string;
  checks: ProductComplexityStage0BrowserCheck[];
};

export async function runProductComplexityConvergenceStage0BrowserAcceptance(): Promise<ProductComplexityStage0BrowserReport> {
  const source = buildDefaultProductComplexityStage0AuditSource();
  const sourceBefore = structuredClone(source);
  const first = buildProductComplexityConvergenceStage0Audit(source);
  const second = buildProductComplexityConvergenceStage0Audit(structuredClone(source));
  const surfaces = new Map(first.surfaceResults.map((item) => [item.surfaceId, item]));
  const paths = new Map(first.capabilityResults.map((item) => [item.capability, item]));
  const authoring = surfaces.get('authoring-workbench-ready');
  const authoringError = surfaces.get('authoring-workbench-error');
  const learningEntry = surfaces.get('learning-entry');
  const learningChoice = surfaces.get('learning-single-choice');
  const learningText = surfaces.get('learning-open-text');
  const learningFeedback = surfaces.get('learning-feedback');
  const learningComplete = surfaces.get('learning-complete');
  const internal = surfaces.get('internal-acceptance');
  const sourceUnchanged = JSON.stringify(sourceBefore) === JSON.stringify(source);

  const checks = [
    check('CB0-01', '录入端加载只读', '工作台 ready 状态进入审计，但当前材料与审计源对象不变。',
      authoring?.route === '/material-resource-workbench' && sourceUnchanged),
    check('CB0-02', '生成与发布状态只读记录', '状态、采用并发布和重新生成均仅作为 Surface Element 读取。',
      authoring?.findings.length === 0),
    check('CB0-03', '卡片披露不写正式资源', '展开探针只改变验收页局部 UI；审计前后正式资源摘要一致。',
      first.beforeSnapshot.formalResourceDigest === first.afterSnapshot.formalResourceDigest),
    check('CB0-04', '错误原位可操作', '发布错误位于当前操作附近，并提供“继续发布”。',
      authoringError?.findings.length === 0),
    check('CB0-05', 'Learning 入口保持原状态', '入口只读取开始学习动作，不启动或结束真实 Session。',
      learningEntry?.stateId === 'ready' && learningEntry.findings.length === 0),
    check('CB0-06', '作答组件不提交', '单选与开放文本页面仅识别提交动作，没有调用提交接口。',
      learningChoice?.findings.length === 0 && learningText?.findings.length === 0),
    check('CB0-07', '提示反馈与 Revision 隔离', '反馈负担与 Revision 路径只读审计，不生成 Attempt 或 Evidence。',
      learningFeedback?.findings.length === 0 && paths.get('revision')?.findings.length === 0),
    check('CB0-08', 'Targeted、Retest、Transfer 隔离', '三类路径均完成触发、退出与恢复边界审计。',
      ['targeted', 'retest', 'transfer'].every((key) => paths.get(key as any)?.findings.length === 0)),
    check('CB0-09', '下一题和完成页隔离', '下一题与返回入口均只作为页面投射检查。',
      learningFeedback?.stateId === 'feedback' && learningComplete?.stateId === 'group_complete'),
    check('CB0-10', '普通与 Internal 术语边界', 'Internal 页面允许 Candidate/Gate/Hash；普通冻结表面未暴露内部术语。',
      internal?.findings.length === 0 && first.surfaceResults.filter((item) => item.audience !== 'internal').every((item) => !item.findings.some((finding) => finding.code === 'internal_term_exposed'))),
    check('CB0-11', '报告恢复确定性', '相同只读事实重复运行得到相同 Audit Digest。',
      first.auditDigest === second.auditDigest),
    check('CB0-12', '四类正式写入为零', '正式资源、Attempt、Profile、真实校准分母均未写入。',
      first.zeroWriteVerified),
  ];
  return {
    schemaVersion: 'product_complexity_convergence_stage0_browser_acceptance_v1',
    runtimeScope: 'read_only_internal_acceptance', total: checks.length,
    passed: checks.filter((item) => item.passed).length,
    formalResourceWriteCount: 0, studentAttemptWriteCount: 0,
    studentProfileWriteCount: 0, realCalibrationDenominatorWriteCount: 0,
    auditDigest: first.auditDigest, generatedAt: new Date().toISOString(), checks,
  };
}

function check(id: string, title: string, evidence: string, passed: boolean): ProductComplexityStage0BrowserCheck {
  return { id, title, evidence, passed };
}
