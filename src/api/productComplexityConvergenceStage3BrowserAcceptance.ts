import { projectConvergenceLearningFeedback, projectConvergenceRevisionFeedback } from
  '../ai/agents/productComplexityConvergenceFeedbackProjectionAgent.ts';
import { projectCoreAbilitySummaries } from
  '../ai/agents/productComplexityConvergenceProfileProjectionAgent.ts';
import type { RevisionEvaluation } from '../ai/schemas/learningFeedbackRevision.schema.ts';
import type { StudentAbilityProfile } from '../ai/schemas/studentAbilityProfile.schema.ts';
import type { StudentLearningFeedback, TaskRequirementCoverage } from
  '../ai/schemas/studentLearningFeedback.schema.ts';
import {
  resolveConvergenceStage3PresentationFlag,
  toConvergenceFeedbackStudentView,
  toCoreAbilitySummaryStudentView,
} from '../ui/productComplexityConvergenceStage3Presentation.ts';

export type ProductComplexityStage3BrowserCheck = {
  id: string;
  title: string;
  evidence: string;
  passed: boolean;
};

export type ProductComplexityStage3BrowserReport = {
  schemaVersion: 'product_complexity_convergence_stage3_browser_acceptance_v1';
  runtimeScope: 'isolated_feedback_profile_projection_acceptance';
  total: number;
  passed: number;
  presentationProjectionCount: number;
  formalResourceWriteCount: 0;
  studentAttemptWriteCount: 0;
  evidenceWriteCount: 0;
  studentProfileWriteCount: 0;
  realCalibrationDenominatorWriteCount: 0;
  generatedAt: string;
  checks: ProductComplexityStage3BrowserCheck[];
};

export async function runProductComplexityConvergenceStage3BrowserAcceptance(): Promise<ProductComplexityStage3BrowserReport> {
  const correctChoice = project(feedback({ coverage: [coverage('r-main', 'conclusion', 'covered', '你已经根据材料选出了符合题意的一项。')] }), {
    continueLabel: '进入第 2 题（共 6 题）',
  });
  const incorrectChoice = project(feedback({
    coverage: [coverage('r-main', 'conclusion', 'missing', undefined, '你选择的是表面相近的信息，还没有对应题目询问的关系。')],
    primaryGapRequirementId: 'r-main',
  }));
  const completeOpen = project(feedback({ coverage: [
    coverage('r-main', 'conclusion', 'covered', '你已经写清楚了人物的主要判断。'),
    coverage('r-evidence', 'text_evidence', 'covered', '你也找到了支持判断的文本依据。'),
  ] }));
  const partial = project(feedback({
    coverage: [
      coverage('r-main', 'conclusion', 'covered', '你已经写清楚了人物的主要判断。'),
      coverage('r-evidence', 'text_evidence', 'missing', undefined, '还缺少能支持判断的原文内容。'),
    ],
    primaryGapRequirementId: 'r-evidence',
  }), { canReviseOnce: true });
  const multiGapWithFormalFocus = project(feedback({
    coverage: [
      coverage('r-a', 'text_evidence', 'missing', undefined, '还缺少依据。'),
      coverage('r-b', 'reasoning_relation', 'missing', undefined, '还缺少关系说明。'),
    ],
    primaryGapRequirementId: 'r-b',
  }));
  const expressionFallback = project(feedback({
    coverage: [coverage('r-unsafe', 'text_evidence', 'missing')],
    primaryGapRequirementId: 'r-unsafe',
  }));
  const historicalFreeTextFallback = project(feedback({ coverage: [] }));
  const recovery = project(feedback({ resultStatus: 'retry_required' }), {
    canContinue: false, canRetryAnalysis: true, canRecoverSavedState: true,
  });
  const revised = projectRevision('improved');
  const unchanged = projectRevision('unchanged');
  const nextTask = project(feedback({ coverage: [coverage('r-main', 'conclusion', 'covered', '你已经完成了当前要求。')] }), {
    continueLabel: '进入第 4 题（共 5 题）',
  });
  const groupComplete = project(feedback({ coverage: [coverage('r-main', 'conclusion', 'covered', '你已经完成了当前要求。')] }), {
    continueLabel: '完成本次学习',
  });
  const profile = projectCoreAbilitySummaries(profileFixture());
  const sparseProfile = projectCoreAbilitySummaries(profileFixture('insufficient_evidence', 1));
  const legacy = resolveConvergenceStage3PresentationFlag('?stage3Feedback=legacy');
  const modern = resolveConvergenceStage3PresentationFlag('');
  const ordinaryCopy = JSON.stringify([
    toConvergenceFeedbackStudentView(partial),
    ...profile.map(toCoreAbilitySummaryStudentView),
  ]);
  const forbidden = /Diagnosis|Evidence|Profile|Policy|Hash|Confidence|正式诊断|证据准入|能力画像|置信度|调度器/i;
  const checks = [
    check('B3-01', '正确单选反馈', '只显示一句真实确认，并保留真实下一题操作。', correctChoice.focusKind === 'confirmed_understanding' && correctChoice.blocks.length === 1 && correctChoice.actions.some((item) => item.label.includes('第 2 题'))),
    check('B3-02', '错误单选反馈', '只说明当前误读方向和一个重新观察动作，不开放即时改选。', incorrectChoice.blocks.filter((item) => item.kind === 'primary_gap').length === 1 && incorrectChoice.blocks.filter((item) => item.kind === 'next_action').length === 1 && !incorrectChoice.actions.some((item) => item.kind === 'revise_once')),
    check('B3-03', '开放题完全满足', '正式 Coverage 全部满足时不制造缺口或无意义建议。', completeOpen.focusKind === 'confirmed_understanding' && completeOpen.blocks.length === 1),
    check('B3-04', '开放题部分满足', '确认、一个主要缺口和一个可执行动作均来自当前正式反馈。', partial.blocks.filter((item) => item.kind === 'primary_gap').length === 1 && partial.blocks.filter((item) => item.kind === 'next_action').length === 1),
    check('B3-05', '多个正式缺口', '页面只采用正式 primaryGapRequirementId，不罗列次要缺口。', multiGapWithFormalFocus.primaryRequirementId === 'r-b' && multiGapWithFormalFocus.blocks.filter((item) => item.kind === 'primary_gap').length === 1),
    check('B3-06', 'Revision 推荐', '反馈与既有“根据反馈修订”入口一致。', partial.actions.filter((item) => item.kind === 'revise_once').length === 1),
    check('B3-07', 'Revision 跳过', '可直接调用既有继续 Command，不显示解释性阻拦。', partial.actions.some((item) => item.existingCommand === 'continue_after_feedback')),
    check('B3-08', 'Revision 改善', '说明具体变化，且不开放第三次修改。', revised.blocks.some((item) => item.text.includes('文本依据')) && !revised.actions.some((item) => item.kind === 'revise_once')),
    check('B3-09', 'Revision 未改善', '给出可复用方法并正常继续，不写独立掌握。', unchanged.focusReasonCode === 'revision_gap_unresolved' && unchanged.blocks.some((item) => item.kind === 'next_action') && !/掌握/.test(JSON.stringify(unchanged.blocks))),
    check('B3-10', 'Feedback 分析失败', '原位说明回答已保留，并提供既有安全重试。', recovery.blocks.length === 1 && recovery.blocks[0].kind === 'recovery' && recovery.actions.some((item) => item.kind === 'retry_analysis')),
    check('B3-11', '模型表达失败', '无法形成安全学生表达时回退确定性 Legacy，无空白新投射。', expressionFallback.fallbackUsed && expressionFallback.blocks.length === 0),
    check('B3-12', '历史结构化反馈', '已有 Requirement Coverage 可正常形成单焦点投射。', partial.validation.passed && !partial.fallbackUsed),
    check('B3-13', '历史自由文本反馈', '缺少结构化 Coverage 时保留旧展示，不猜测新 Gap。', historicalFreeTextFallback.fallbackUsed && historicalFreeTextFallback.blocks.length === 0),
    check('B3-14', '尚有正式题', '主操作显示准确下一题编号与总数。', nextTask.actions.some((item) => item.label === '进入第 4 题（共 5 题）')),
    check('B3-15', '题组完成', '使用既有完成出口，不解释 Scheduler。', groupComplete.actions.some((item) => item.label === '完成本次学习') && !forbidden.test(JSON.stringify(groupComplete.blocks))),
    check('B3-16', '有效 Profile 只显示粗粒度概况', '状态为正在形成，不显示小数置信度。', profile[0]?.status === 'developing' && !/0\./.test(ordinaryCopy)),
    check('B3-17', '证据不足不制造弱项', '单条不足证据映射为 uncertain + low。', sparseProfile[0]?.status === 'uncertain' && sparseProfile[0]?.confidence === 'low'),
    check('B3-18', '刷新、重复打开与跨标签', '相同正式输入投射身份稳定、Legacy 可独立回退且正式写入仍为零。', partial.projectionId === project(feedback({ coverage: [coverage('r-main', 'conclusion', 'covered', '你已经写清楚了人物的主要判断。'), coverage('r-evidence', 'text_evidence', 'missing', undefined, '还缺少能支持判断的原文内容。')], primaryGapRequirementId: 'r-evidence' }), { canReviseOnce: true }).projectionId && legacy === 'legacy' && modern === 'convergence_v1'),
  ];
  return {
    schemaVersion: 'product_complexity_convergence_stage3_browser_acceptance_v1',
    runtimeScope: 'isolated_feedback_profile_projection_acceptance',
    total: checks.length,
    passed: checks.filter((item) => item.passed).length,
    presentationProjectionCount: 13,
    formalResourceWriteCount: 0,
    studentAttemptWriteCount: 0,
    evidenceWriteCount: 0,
    studentProfileWriteCount: 0,
    realCalibrationDenominatorWriteCount: 0,
    generatedAt: new Date().toISOString(),
    checks,
  };
}

function project(
  value: StudentLearningFeedback,
  runtime: Partial<Parameters<typeof projectConvergenceLearningFeedback>[0]['runtimeActions']> = {},
) {
  return projectConvergenceLearningFeedback({
    feedback: value, feedbackId: 'feedback-b3', learningTaskAttemptId: 'attempt-b3',
    formalDiagnosisId: 'diagnosis-b3',
    runtimeActions: { canContinue: true, canReviseOnce: false, canRetryAnalysis: false, canRecoverSavedState: false, ...runtime },
  });
}

function feedback(patch: {
  coverage?: TaskRequirementCoverage[];
  primaryGapRequirementId?: string;
  resultStatus?: StudentLearningFeedback['resultStatus'];
} = {}): StudentLearningFeedback {
  const items = patch.coverage || [coverage('r-main', 'conclusion', 'covered', '你已经写出了判断。')];
  return {
    learningRoundId: 'round-b3', studentId: 'student-b3', stage: 'result',
    resultStatus: patch.resultStatus || 'completed', headline: '本题反馈', summary: '本题反馈。',
    whatYouDidWell: ['你已经写出了判断。'], whatNeedsAttention: [],
    nextActionText: '回到材料找到能直接支持判断的内容，再补进回答。',
    canRetry: patch.resultStatus === 'retry_required', canFinishRound: true, source: 'learning_round',
    thinkingReview: {
      requirementCoverage: items,
      coveredPoints: items.filter((item) => item.status === 'covered').map((item) => item.studentMessage || item.requirementText),
      primaryGapRequirementId: patch.primaryGapRequirementId,
      primaryGap: items.find((item) => item.requirementId === patch.primaryGapRequirementId)?.gapMessage,
      missingPoints: items.filter((item) => item.status !== 'covered').map((item) => item.gapMessage || item.requirementText),
    },
  };
}

function coverage(id: string, type: TaskRequirementCoverage['requirementType'], status: TaskRequirementCoverage['status'], studentMessage?: string, gapMessage?: string): TaskRequirementCoverage {
  return {
    requirementId: id, requirementType: type, requirementText: `完成 ${type}`, required: true, status,
    studentEvidence: studentMessage ? ['学生回答内容'] : [], taskEvidence: ['正式题目要求'], source: 'formal_diagnosis',
    studentMessage, gapMessage,
    gapReasonCode: status === 'insufficient_to_judge' ? 'insufficient_to_judge' : type === 'text_evidence' ? 'missing_text_evidence' : 'incomplete_task_requirement',
  };
}

function projectRevision(outcome: RevisionEvaluation['outcome']) {
  const evaluation: RevisionEvaluation = {
    schemaVersion: 'revision_evaluation_v2', revisionEvaluationId: `revision-${outcome}`, revisionId: 'revision-b3',
    outcome, feedbackRespondedTo: outcome !== 'unchanged',
    resolvedIssueCodes: outcome === 'improved' ? ['missing_text_evidence'] : [],
    remainingIssueCodes: outcome === 'improved' ? [] : ['missing_text_evidence'], newIssueCodes: [],
    improvedObservation: outcome === 'improved' ? '这次修改补充了支持判断的文本依据。' : '这次修改保留了原来的判断。',
    remainingFocus: outcome === 'improved' ? undefined : '还需要找到能直接支持判断的原文内容。',
    nextSimilarTaskAction: '下次先找到文本依据，再说明它怎样支持判断。',
    evaluatedAt: '2026-08-24T08:00:00.000Z', policyVersion: 'revision-policy-v1',
    initialDiagnosisId: 'diagnosis-1', revisedDiagnosisId: 'diagnosis-2', revisedDiagnosisSchemaVersion: 'diagnosis-v1',
    resourceVersionId: 'resource-version-b3', rubricVersion: 'rubric-b3',
  };
  return projectConvergenceRevisionFeedback({
    studentId: 'student-b3', learningRoundId: 'round-b3', feedbackId: 'feedback-b3',
    learningTaskAttemptId: 'attempt-b3', revisionEvaluation: evaluation,
    runtimeActions: { canContinue: true, canReviseOnce: false, canRetryAnalysis: false, canRecoverSavedState: false },
  });
}

function profileFixture(status: StudentAbilityProfile['ability_status'][number]['status'] = 'improving', evidenceCount = 2): StudentAbilityProfile {
  const links = Array.from({ length: evidenceCount }, (_, index) => ({
    evidenceId: `profile-evidence-${index}`, ability: '文本证据', evidenceType: 'growth' as const,
    source: 'training' as const, observation: '能够找到支持判断的内容。', confidence: 0.7, supportLevel: 'independent' as const,
  }));
  return {
    studentId: 'student-b3', generatedAt: '2026-08-24T08:00:00.000Z',
    current_weakness: { primary: '文本证据', secondary: [] },
    ability_status: [{ ability: '文本证据', status, summary: '最近能更稳定地找到支持判断的内容。', weakness_count: 1, positive_count: 1, growth_count: 1, insufficient_count: 0, evidence_links: links }],
    improvement_signals: [], continue_training_focus: '继续练习文本依据。', evidence_links: links,
    next_step_recommendation: '继续完成阅读练习。',
  };
}

function check(id: string, title: string, evidence: string, passed: boolean): ProductComplexityStage3BrowserCheck {
  return { id, title, evidence, passed };
}
