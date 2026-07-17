export type Phase15DemoStage = {
  name: string;
  status: 'passed' | 'blocked' | 'review' | 'fallback' | 'not_created';
  result: string;
  objectId?: string;
};

export type Phase15IntegrationDemoCase = {
  id: string;
  label: string;
  title: string;
  description: string;
  expected: string;
  providerMode: 'scripted';
  stages: Phase15DemoStage[];
  acceptancePoints: string[];
};

const cases: Phase15IntegrationDemoCase[] = [
  {
    id: 'complete_chain',
    label: '完整成功链路',
    title: '正式 Diagnosis 进入 Existing Evidence Runtime',
    description: '合法作答通过 Scripted Provider 生成结构化结果，完成 Formal Commit，并继续进入 Evidence、Evaluation、GrowthMemory 和学生反馈。',
    expected: '所有正式对象生成且保持可追溯，表达层不新增教育结论。',
    providerMode: 'scripted',
    stages: [
      { name: 'Answer Validity', status: 'passed', result: '有效作答，可以进入 Diagnosis。', objectId: 'response-exec-phase15-integration-task' },
      { name: 'LLM Provider', status: 'passed', result: 'Scripted Provider 返回合法结构化 Diagnosis Candidate。', objectId: 'scripted-request-1' },
      { name: 'Formal Diagnosis', status: 'passed', result: 'Candidate 已通过身份、Schema 与语义边界校验并原子提交。', objectId: 'formal-diagnosis-phase15-integration-success' },
      { name: 'Ability Evidence', status: 'passed', result: '正式 Diagnosis 通过 Phase 9.3 回流为一条 Evidence。', objectId: 'evidence-formal-diagnosis-phase15-integration-success' },
      { name: 'Evaluation / Memory', status: 'passed', result: '复用 Phase 8 形成 EvaluationResult、ProfileUpdateDecision 与 GrowthMemoryRecord。', objectId: 'evaluation-phase15-integration-student-推理' },
      { name: 'Evidence Quality', status: 'passed', result: 'Phase 14.1 评估为 high / eligible。', objectId: 'evidence-quality-phase15-integration' },
      { name: 'Student Feedback', status: 'passed', result: '只基于可追溯事实生成确定性学生反馈。', objectId: 'phase15-integration-feedback' },
    ],
    acceptancePoints: [
      'Formal Diagnosis、Evidence 与反馈对象均有稳定 ID。',
      'Evidence 可以追溯到 Evaluation 与 GrowthMemory。',
      '重复请求不会产生第二份正式结果。',
    ],
  },
  {
    id: 'invalid_answer',
    label: '无效作答阻断',
    title: '无效作答不会调用 LLM',
    description: '学生输入“不知道”等占位内容时，Answer Validity Gate 在 Provider 调用前阻断。',
    expected: 'Provider 调用次数为 0，不产生 Formal Diagnosis、Evidence 或 Profile 更新。',
    providerMode: 'scripted',
    stages: [
      { name: 'Answer Validity', status: 'blocked', result: 'submitted_invalid，不能进入 Diagnosis。', objectId: 'response-exec-phase15-integration-task' },
      { name: 'LLM Provider', status: 'not_created', result: '未调用 Provider。' },
      { name: 'Formal Diagnosis', status: 'not_created', result: '未生成。' },
      { name: 'Ability Evidence', status: 'not_created', result: '未生成。' },
      { name: 'Evaluation / Memory', status: 'not_created', result: '未更新。' },
      { name: 'Student Feedback', status: 'blocked', result: '只允许显示重新作答提示。' },
    ],
    acceptancePoints: [
      '无效输入不形成 weakness Evidence。',
      '阻断发生在产生模型费用之前。',
      '下游正式状态保持不变。',
    ],
  },
  {
    id: 'ability_mismatch',
    label: '能力错位复核',
    title: 'Diagnosis 能力错位进入人工复核',
    description: '任务目标是“推理”，Provider Candidate 却输出“表达”，Runtime 不自动改写语义字段。',
    expected: '状态进入 review_required，不 Commit，也不进入 Evidence Return。',
    providerMode: 'scripted',
    stages: [
      { name: 'Answer Validity', status: 'passed', result: '有效作答，可以进入 Diagnosis。' },
      { name: 'LLM Provider', status: 'passed', result: 'Provider 返回 Candidate，mainAbility=表达。', objectId: 'scripted-request-1' },
      { name: 'Formal Diagnosis', status: 'review', result: '目标能力不一致，进入 review_required。' },
      { name: 'Ability Evidence', status: 'not_created', result: '未进入 Evidence Return。' },
      { name: 'Evaluation / Memory', status: 'not_created', result: '未更新。' },
      { name: 'Student Feedback', status: 'blocked', result: '不表达未经确认的能力判断。' },
    ],
    acceptancePoints: [
      'mainAbility 不进入自动 Repair 白名单。',
      '没有 Formal Commit 就不能生成正式 Evidence。',
      '表达层不能掩盖上游复核状态。',
    ],
  },
  {
    id: 'feedback_fallback',
    label: '反馈安全回退',
    title: '表达 Provider 失败不影响正式教育事实',
    description: 'Diagnosis、Evidence 与 Evaluation 已经正式形成，但可选反馈表达 Provider 暂时不可用。',
    expected: '反馈状态为 template_fallback，继续展示确定性模板；正式对象不回滚、不重算。',
    providerMode: 'scripted',
    stages: [
      { name: 'Formal Diagnosis', status: 'passed', result: '正式 Diagnosis 已提交。', objectId: 'formal-diagnosis-phase15-integration-success' },
      { name: 'Ability Evidence', status: 'passed', result: 'Evidence 已完成回流。', objectId: 'evidence-formal-diagnosis-phase15-integration-success' },
      { name: 'Evaluation / Memory', status: 'passed', result: 'Evaluation 与 GrowthMemory 已形成。' },
      { name: 'Feedback Provider', status: 'fallback', result: 'Provider unavailable，停止增强表达。' },
      { name: 'Student Feedback', status: 'passed', result: '采用 deterministic_template 安全回退。', objectId: 'phase15-integration-feedback-fallback' },
    ],
    acceptancePoints: [
      '表达失败不会修改 Diagnosis 或 Evidence。',
      '模板反馈仍然只消费可追溯事实。',
      '失败原因被记录，但不向学生泄露内部字段。',
    ],
  },
];

export const phase15LiveConnectionRecord = {
  provider: 'DeepSeek Chat Completions',
  model: 'deepseek-v4-flash',
  adapterStatus: '已接入',
  liveSmoke: '4 / 4 PASS',
  supportedModes: ['Live', 'Shadow'],
  formalCommit: '已验证',
  promptPolicy: '版本化配置；默认切换仍受控',
  rawOutputPolicy: '隔离保存，不在 Demo 展示',
  browserSecretPolicy: 'API Key 不进入浏览器',
  currentBoundary: '真实 Provider 已完成专项 Live Smoke；完整产品整链当前以 Scripted Provider 完成 11 / 11 验收。',
};

export function getPhase15IntegrationDemoData() {
  return {
    cases,
    defaultCaseId: cases[0].id,
    liveConnection: phase15LiveConnectionRecord,
  };
}
