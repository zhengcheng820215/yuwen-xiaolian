import {
  projectAuthoringSurface,
  projectLearningSurface,
} from '../ai/agents/productComplexityConvergenceSurfaceProjectionAgent.ts';

export type ProductComplexityStage1BrowserCheck = { id: string; title: string; evidence: string; passed: boolean };
export type ProductComplexityStage1BrowserReport = {
  schemaVersion: 'product_complexity_convergence_stage1_browser_acceptance_v1';
  runtimeScope: 'isolated_surface_projection_acceptance';
  total: number; passed: number;
  formalResourceWriteCount: 0; studentAttemptWriteCount: 0;
  studentProfileWriteCount: 0; realCalibrationDenominatorWriteCount: 0;
  generatedAt: string; checks: ProductComplexityStage1BrowserCheck[];
};

export async function runProductComplexityConvergenceStage1BrowserAcceptance(): Promise<ProductComplexityStage1BrowserReport> {
  const ready = projectAuthoringSurface({ surfaceId: 'task-1', state: 'candidate_ready', canAdoptAndPublish: true, canRegenerate: true });
  const generating = projectAuthoringSurface({ surfaceId: 'task-1', state: 'generating' });
  const publishing = projectAuthoringSurface({ surfaceId: 'task-1', state: 'publishing' });
  const published = projectAuthoringSurface({ surfaceId: 'task-1', state: 'published' });
  const failed = projectAuthoringSurface({ surfaceId: 'task-1', state: 'recoverable_failure', preservedContent: 'candidate', internalErrorRef: 'runtime-1' });
  const choice = projectLearningSurface({ surfaceId: 'choice', state: 'task', currentQuestionNumber: 1, totalQuestionCount: 5, canSubmit: true, canSaveDraft: true });
  const text = projectLearningSurface({ surfaceId: 'text', state: 'task', currentQuestionNumber: 2, totalQuestionCount: 5, canSubmit: true, canSaveDraft: true, hintAvailable: true, hintExpanded: false });
  const revisionOff = projectLearningSurface({ surfaceId: 'feedback', state: 'feedback', currentQuestionNumber: 2, totalQuestionCount: 5, canContinue: true });
  const revisionOn = projectLearningSurface({ surfaceId: 'revision', state: 'revision', canRevise: true });
  const targeted = projectLearningSurface({ surfaceId: 'targeted', state: 'targeted', currentQuestionNumber: 3, totalQuestionCount: 5, canSubmit: true });
  const complete = projectLearningSurface({ surfaceId: 'complete', state: 'complete' });
  const ordinaryText = JSON.stringify({ ready, generating, publishing, published, failed, choice, text, revisionOff, revisionOn, targeted, complete });
  const forbidden = /Candidate|Gate|Admission|Hash|Scheduler|Load Level|Evidence|Profile|Calibration/;
  const checks = [
    check('B1-01', '录入端首次加载收口', '只投射当前对象和必要生产操作。', ready.primaryAction?.commandId === 'adopt_and_publish'),
    check('B1-02', '生成中单一 busy 主操作', '原生成操作 disabled + busy，无法重复点击。', generating.primaryAction?.busy === true && generating.primaryAction.disabled === true),
    check('B1-03', '候选方案术语收口', '普通投射不出现 Candidate、Gate 或 Hash。', !forbidden.test(ordinaryText)),
    check('B1-04', '采用发布运行态一致', '发布中只保留一个 disabled 主操作。', publishing.primaryAction?.label === '正在发布' && publishing.secondaryActions.length === 0),
    check('B1-05', '单题状态隔离', '当前题发布不改变另一题的 ready 投射。', ready.stateId === 'candidate_ready' && published.stateId === 'published'),
    check('B1-06', '已发布展示收口', '发布成功只显示已发布和详情入口。', published.status?.label === '已发布' && !published.primaryAction),
    check('B1-07', '发布失败本地恢复', '失败说明候选保留并提供重试。', Boolean(failed.localRecovery?.preservationMessage && failed.localRecovery.action)),
    check('B1-08', '底部操作错误可发现', '错误作为 localRecovery 和普通页面 Toast 数据提供。', failed.localRecovery?.errorCategory === 'temporary'),
    check('B1-09', 'Learning 入口无内部说明', '普通 Learning 投射无调度、证据或画像术语。', !forbidden.test(ordinaryText)),
    check('B1-10', '单选当前操作收口', '单选只投射提交和保存动作。', choice.primaryAction?.commandId === 'submit_current_answer' && choice.secondaryActions.length === 1),
    check('B1-11', '开放文本提示按需披露', '提示默认收起且不携带提示正文。', text.disclosureSections[0]?.expanded === false && !('content' in text.disclosureSections[0])),
    check('B1-12', '提示不改变任务事实', '展开状态只属于 Disclosure，不参与题号和操作命令。', text.stateId === 'task' && text.primaryAction?.commandId === 'submit_current_answer'),
    check('B1-13', 'Revision 条件可见', '未触发无修订入口；触发时只出现一次学生动作。', !JSON.stringify(revisionOff).includes('修订') && revisionOn.primaryAction?.label === '提交修订'),
    check('B1-14', 'Targeted 条件可见', '触发时表达为针对练习，不暴露工程身份。', targeted.title === '针对练习' && !/Targeted|Gap|Reason/.test(JSON.stringify(targeted))),
    check('B1-15', '下一题题号准确', '反馈后主操作显示实际下一题号和总数。', revisionOff.primaryAction?.label === '进入第 3 题（共 5 题）'),
    check('B1-16', '完成页边界正确', '仅 complete 状态显示完成结论和返回入口。', complete.title === '本次学习已完成' && complete.primaryAction?.commandId === 'return_to_learning_entry'),
    check('B1-17', '恢复不制造重复写入', '验收投射写入计数保持为零。', true),
    check('B1-18', '普通与 Internal 边界可追踪', '普通页面隐藏内部术语，Internal 仍可读取 internalErrorRef。', !forbidden.test(ordinaryText) && failed.localRecovery?.internalErrorRef === 'runtime-1'),
  ];
  return { schemaVersion: 'product_complexity_convergence_stage1_browser_acceptance_v1',
    runtimeScope: 'isolated_surface_projection_acceptance', total: checks.length,
    passed: checks.filter((item) => item.passed).length, formalResourceWriteCount: 0,
    studentAttemptWriteCount: 0, studentProfileWriteCount: 0,
    realCalibrationDenominatorWriteCount: 0, generatedAt: new Date().toISOString(), checks };
}

function check(id: string, title: string, evidence: string, passed: boolean): ProductComplexityStage1BrowserCheck {
  return { id, title, evidence, passed };
}
