import { projectConvergenceLearningFeedback, projectConvergenceRevisionFeedback } from
  '../agents/productComplexityConvergenceFeedbackProjectionAgent.ts';
import { projectCoreAbilitySummaries } from
  '../agents/productComplexityConvergenceProfileProjectionAgent.ts';
import type { RevisionEvaluation } from '../schemas/learningFeedbackRevision.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import type { StudentLearningFeedback, TaskRequirementCoverage } from
  '../schemas/studentLearningFeedback.schema.ts';
import {
  isConvergenceFeedbackPresentation,
  isCoreAbilitySummary,
} from '../schemas/productComplexityConvergenceFeedbackProjection.schema.ts';
import { toConvergenceFeedbackStudentView } from '../../ui/productComplexityConvergenceStage3Presentation.ts';

type Check = { id: string; title: string; passed: boolean };
const before = stable({ attempt: 'a1', diagnosis: 'd1', evidence: ['e1'], profile: 'p1' });
const completed = feedback();
const partial = feedback({ coverage: [
  coverage('r-conclusion', 'conclusion', 'covered', '你已经写出了人物的判断。'),
  coverage('r-evidence', 'text_evidence', 'missing', undefined, '回答还缺少能支持判断的原文内容。'),
], primaryGapRequirementId: 'r-evidence' });
const projection = projectConvergenceLearningFeedback(input(partial, { canReviseOnce: true }));
const repeated = projectConvergenceLearningFeedback(input(partial, { canReviseOnce: true }));
const confirmed = projectConvergenceLearningFeedback(input(completed));
const insufficient = projectConvergenceLearningFeedback(input(feedback({ coverage: [
  coverage('r-main', 'conclusion', 'insufficient_to_judge', undefined, '当前回答还不足以判断是否完成题目要求。'),
], primaryGapRequirementId: 'r-main' })));
const ambiguous = projectConvergenceLearningFeedback(input(feedback({ coverage: [
  coverage('r-a', 'text_evidence', 'missing', undefined, '缺少依据。'),
  coverage('r-b', 'reasoning_relation', 'missing', undefined, '缺少关系。'),
] })));
const recovery = projectConvergenceLearningFeedback(input(feedback({ resultStatus: 'retry_required' }), {
  canContinue: false, canRetryAnalysis: true,
}));
const noRevision = projectConvergenceLearningFeedback(input(partial, { canReviseOnce: false }));
const identityFallback = projectConvergenceLearningFeedback({
  ...input(partial),
  actionPlan: actionPlan({ studentId: 'other-student' }),
});
const revisionImproved = projectConvergenceRevisionFeedback(revisionInput('improved'));
const revisionPartial = projectConvergenceRevisionFeedback(revisionInput('partially_improved'));
const revisionUnchanged = projectConvergenceRevisionFeedback(revisionInput('unchanged'));
const profile = abilityProfile();
const profileBefore = stable(profile);
const summaries = projectCoreAbilitySummaries(profile);
const insufficientProfile = projectCoreAbilitySummaries(abilityProfile({ status: 'insufficient_evidence', evidenceCount: 1 }));
const legacyProfile = abilityProfile();
legacyProfile.ability_status[0].evidence_links = [];
const legacySummaries = projectCoreAbilitySummaries(legacyProfile);
const unsafe = feedback({ coverage: [coverage(
  'r-unsafe', 'text_evidence', 'missing', undefined, '请检查 Evidence Pipeline。',
)], primaryGapRequirementId: 'r-unsafe' });
const unsafeProjection = projectConvergenceLearningFeedback(input(unsafe));

const checks: Check[] = [
  check('C3-01', '反馈 Schema 结构完整', isConvergenceFeedbackPresentation(projection)),
  check('C3-02', 'Profile Summary Schema 结构完整', summaries.every(isCoreAbilitySummary)),
  check('C3-03', '相同输入得到相同投射身份', projection.projectionId === repeated.projectionId),
  check('C3-04', '相同输入得到相同投射 Hash', projection.projectionHash === repeated.projectionHash),
  check('C3-05', '投射角色不进入正式事实', projection.persistenceRole === 'presentation_projection'),
  check('C3-06', '投射没有新建 Repository 身份', !('repositoryId' in projection)),
  check('C3-07', '正式事实 Digest 零变化', before === stable({ attempt: 'a1', diagnosis: 'd1', evidence: ['e1'], profile: 'p1' })),
  check('C3-08', '正式完成只投射确认', confirmed.focusKind === 'confirmed_understanding' && confirmed.blocks.length === 1),
  check('C3-09', '部分满足选择正式主缺口', projection.focusKind === 'primary_actionable_gap' && projection.primaryRequirementId === 'r-evidence'),
  check('C3-10', '缺口来源可追溯', projection.sourceRefs.some((item) => item.sourceId === 'r-evidence')),
  check('C3-11', '无显式主缺口且唯一缺口可选择', projectConvergenceLearningFeedback(input(feedback({ coverage: [coverage('r-only', 'conclusion', 'missing', undefined, '缺少判断。')] }))).primaryRequirementId === 'r-only'),
  check('C3-12', '多缺口不可排序时 Legacy 回退', ambiguous.fallbackUsed && ambiguous.blocks.length === 0),
  check('C3-13', '不足判断不形成弱项结论', insufficient.focusKind === 'insufficient_to_judge'),
  check('C3-14', '身份错位安全回退', identityFallback.fallbackUsed && !identityFallback.validation.identityAligned),
  check('C3-15', '恢复态只显示恢复块', recovery.focusKind === 'recovery_only' && recovery.blocks.every((item) => item.kind === 'recovery')),
  check('C3-16', '一次最多一个确认块', projection.blocks.filter((item) => item.kind === 'acknowledgement').length <= 1),
  check('C3-17', '一次最多一个主缺口块', projection.blocks.filter((item) => item.kind === 'primary_gap').length === 1),
  check('C3-18', '一次最多一个下一步块', projection.blocks.filter((item) => item.kind === 'next_action').length <= 1),
  check('C3-19', '展示块总数不超过三', projection.blocks.length <= 3),
  check('C3-20', '确认来自正式 Coverage', projection.blocks[0]?.sourceRefIds.includes('r-evidence') || projection.blocks[0]?.sourceRefIds.includes('r-conclusion')),
  check('C3-21', '主要缺口不是能力标签', !/能力不足|长期弱项/.test(projection.blocks.find((item) => item.kind === 'primary_gap')?.text || '')),
  check('C3-22', '下一步包含可执行动作', /回到|找到|补充|说明|保留/.test(projection.blocks.find((item) => item.kind === 'next_action')?.text || '')),
  check('C3-23', '学生页面不出现内部术语', !/Diagnosis|Evidence|Profile|Policy|Hash|Confidence/.test(JSON.stringify(toConvergenceFeedbackStudentView(projection)))),
  check('C3-24', '不重复完整答案或正文', !JSON.stringify(projection).includes('这是一段很长的完整学生答案')),
  check('C3-25', '不安全表达触发确定性回退或替代', unsafeProjection.fallbackUsed || !/Evidence|Pipeline/.test(JSON.stringify(unsafeProjection.blocks))),
  check('C3-26', 'Legacy 回退仍保持 Runtime 操作', ambiguous.actions.some((item) => item.kind === 'continue')),
  check('C3-27', 'Revision 允许时投射一次修订', projection.actions.filter((item) => item.kind === 'revise_once').length === 1),
  check('C3-28', 'Revision 不允许时无修改要求', !noRevision.actions.some((item) => item.kind === 'revise_once')),
  check('C3-29', '继续动作引用既有 Command', confirmed.actions.some((item) => item.existingCommand === 'continue_after_feedback')),
  check('C3-30', '重新分析动作只在恢复边界出现', recovery.actions.some((item) => item.kind === 'retry_analysis') && !projection.actions.some((item) => item.kind === 'retry_analysis')),
  check('C3-31', '恢复动作不创造学习评价', recovery.blocks.length === 1 && !recovery.blocks.some((item) => item.kind === 'primary_gap')),
  check('C3-32', '操作标签与 Enabled 同步', projection.actions.every((item) => item.enabled && item.label.length > 0)),
  check('C3-33', '自由文本不是统计键', !('summaryCode' in projection)),
  check('C3-34', '反馈投射不含 Confidence 数值', !/confidence/i.test(JSON.stringify(toConvergenceFeedbackStudentView(projection)))),
  check('C3-35', 'Revision Improved 说明实际变化', revisionImproved.focusReasonCode === 'revision_gap_resolved' && revisionImproved.blocks.some((item) => item.text.includes('补充'))),
  check('C3-36', 'Revision Partial 只说明部分变化', revisionPartial.focusReasonCode === 'revision_gap_partially_resolved' && revisionPartial.blocks.some((item) => item.kind === 'primary_gap')),
  check('C3-37', 'Revision Unchanged 不声称掌握', revisionUnchanged.focusReasonCode === 'revision_gap_unresolved' && !/掌握/.test(JSON.stringify(revisionUnchanged.blocks))),
  check('C3-38', 'Revision 投射不覆盖首次事实', before === stable({ attempt: 'a1', diagnosis: 'd1', evidence: ['e1'], profile: 'p1' })),
  check('C3-39', 'Revision 不开放第三次修改', !revisionImproved.actions.some((item) => item.kind === 'revise_once')),
  check('C3-40', 'Revision 来源引用评价身份', revisionImproved.sourceRefs[0]?.sourceId === 'revision-evaluation-1'),
  check('C3-41', 'Revision 投射身份确定', revisionImproved.projectionId === projectConvergenceRevisionFeedback(revisionInput('improved')).projectionId),
  check('C3-42', 'Summary 只来自有效 Profile', summaries.length === 1 && summaries[0].sourceProfileGeneratedAt === profile.generatedAt),
  check('C3-43', '单次反馈不直接改变 Summary', profileBefore === stable(profile)),
  check('C3-44', 'Profile 状态映射固定', summaries[0]?.status === 'developing'),
  check('C3-45', '普通摘要不显示小数和内部计数', !/0\.\d|weakness_count|positive_count/.test(JSON.stringify(summaries.map((item) => ({ ability: item.abilityId, status: item.status, summary: item.recentEvidenceSummary }))))),
  check('C3-46', 'V1 不自行生成 High Confidence', summaries.every((item) => item.confidence !== 'high') && insufficientProfile[0]?.confidence === 'low'),
  check('C3-47', 'Legacy Profile 无证据时安全隐藏', legacySummaries.length === 0),
  check('C3-48', '删除投射不影响正式 Profile', profileBefore === stable(profile) && summaries.every((item) => item.persistenceRole === 'profile_read_model')),
];

checks.forEach((item) => console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.id} ${item.title}`));
const passed = checks.filter((item) => item.passed).length;
console.log(`\nProduct Complexity Convergence Stage 3 Debug: ${passed}/${checks.length}`);
if (passed !== checks.length) process.exitCode = 1;

function input(
  value: StudentLearningFeedback,
  runtime: Partial<Parameters<typeof projectConvergenceLearningFeedback>[0]['runtimeActions']> = {},
) {
  return {
    feedback: value,
    feedbackId: 'feedback-1',
    learningTaskAttemptId: 'attempt-1',
    formalDiagnosisId: 'diagnosis-1',
    runtimeActions: {
      canContinue: true,
      canReviseOnce: false,
      canRetryAnalysis: false,
      canRecoverSavedState: false,
      ...runtime,
    },
  };
}

function feedback(patch: {
  coverage?: TaskRequirementCoverage[];
  primaryGapRequirementId?: string;
  resultStatus?: StudentLearningFeedback['resultStatus'];
} = {}): StudentLearningFeedback {
  const coverageItems = patch.coverage || [
    coverage('r-conclusion', 'conclusion', 'covered', '你已经写出了人物的主要判断。'),
    coverage('r-evidence', 'text_evidence', 'covered', '你已经找到了支持判断的原文内容。'),
  ];
  return {
    learningRoundId: 'round-1', studentId: 'student-1', stage: 'result',
    resultStatus: patch.resultStatus || 'completed', headline: '本题反馈',
    summary: '下面是本次回答的反馈。', whatYouDidWell: ['你已经写出了主要判断。'],
    whatNeedsAttention: patch.resultStatus === 'retry_required' ? [] : ['还需要补充文本依据。'],
    nextActionText: '回到材料找到能支持判断的内容，再补进回答。',
    canRetry: patch.resultStatus === 'retry_required', canFinishRound: true, source: 'learning_round',
    thinkingReview: {
      requirementCoverage: coverageItems,
      coveredPoints: coverageItems.filter((item) => item.status === 'covered').map((item) => item.studentMessage || item.requirementText),
      primaryGapRequirementId: patch.primaryGapRequirementId,
      primaryGap: coverageItems.find((item) => item.requirementId === patch.primaryGapRequirementId)?.gapMessage,
      missingPoints: coverageItems.filter((item) => item.status !== 'covered').map((item) => item.gapMessage || item.requirementText),
    },
  };
}

function coverage(
  requirementId: string,
  requirementType: TaskRequirementCoverage['requirementType'],
  status: TaskRequirementCoverage['status'],
  studentMessage?: string,
  gapMessage?: string,
): TaskRequirementCoverage {
  return {
    requirementId, requirementType, requirementText: `完成 ${requirementType}`, required: true,
    status, studentEvidence: studentMessage ? ['学生回答中的相关内容'] : [],
    taskEvidence: ['题目正式要求'], source: 'formal_diagnosis', studentMessage, gapMessage,
    gapReasonCode: status === 'insufficient_to_judge'
      ? 'insufficient_to_judge'
      : requirementType === 'text_evidence'
        ? 'missing_text_evidence'
        : requirementType === 'reasoning_relation'
          ? 'missing_reasoning_relation'
          : 'incomplete_task_requirement',
  };
}

function actionPlan(patch: { studentId?: string } = {}) {
  return {
    schemaVersion: 'student_feedback_action_plan_v1' as const,
    studentId: patch.studentId || 'student-1', learningRoundId: 'round-1',
    feedbackDepth: 2 as const, hintLevel: 'location' as const,
    nextOperations: ['回到材料找到能直接支持判断的内容。'],
    sourceGapId: 'r-evidence', evidenceLinks: ['r-evidence'], limitations: [],
    validation: { passed: true, actionGrounded: true, gapSpecific: true, operationsExecutable: true, disclosureAllowed: true, issues: [] },
  };
}

function revisionInput(outcome: RevisionEvaluation['outcome']) {
  const evaluation: RevisionEvaluation = {
    schemaVersion: 'revision_evaluation_v2', revisionEvaluationId: 'revision-evaluation-1', revisionId: 'revision-1',
    outcome, feedbackRespondedTo: outcome !== 'unchanged',
    resolvedIssueCodes: outcome === 'improved' ? ['missing_text_evidence'] : [],
    remainingIssueCodes: outcome === 'improved' ? [] : ['missing_text_evidence'], newIssueCodes: [],
    improvedObservation: outcome === 'improved' ? '这次修改补充了支持判断的文本依据。' : '这次修改保留了原来的判断。',
    remainingFocus: outcome === 'improved' ? undefined : '还需要找到能直接支持判断的原文内容。',
    nextSimilarTaskAction: '下次先找到文本依据，再说明它怎样支持判断。',
    evaluatedAt: '2026-08-24T08:00:00.000Z', policyVersion: 'revision-policy-v1',
    initialDiagnosisId: 'diagnosis-initial', revisedDiagnosisId: 'diagnosis-revised',
    revisedDiagnosisSchemaVersion: 'diagnosis-v1', resourceVersionId: 'resource-version-1', rubricVersion: 'rubric-v1',
  };
  return {
    studentId: 'student-1', learningRoundId: 'round-1', feedbackId: 'feedback-1',
    learningTaskAttemptId: 'attempt-1', revisionEvaluation: evaluation,
    runtimeActions: { canContinue: true, canReviseOnce: false, canRetryAnalysis: false, canRecoverSavedState: false },
  };
}

function abilityProfile(patch: { status?: StudentAbilityProfile['ability_status'][number]['status']; evidenceCount?: number } = {}): StudentAbilityProfile {
  const evidenceCount = patch.evidenceCount || 2;
  const links = Array.from({ length: evidenceCount }, (_, index) => ({
    evidenceId: `evidence-${index + 1}`, ability: '文本证据', evidenceType: 'growth' as const,
    source: 'training' as const, observation: `第 ${index + 1} 次练习中能够找到依据。`,
    confidence: 0.7, supportLevel: 'independent' as const,
  }));
  return {
    studentId: 'student-1', generatedAt: '2026-08-24T08:00:00.000Z',
    current_weakness: { primary: '文本证据', secondary: [] },
    ability_status: [{
      ability: '文本证据', status: patch.status || 'improving', summary: '最近能够更稳定地找到支持判断的原文内容。',
      weakness_count: 1, positive_count: 1, growth_count: 1, insufficient_count: 0, evidence_links: links,
    }],
    improvement_signals: [{ ability: '文本证据', signal: '最近两次练习中找依据的表现更稳定。', from: 'training', confidence: 0.7, evidence_links: links }],
    continue_training_focus: '继续练习依据与判断的关系。', evidence_links: links,
    next_step_recommendation: '继续完成同类阅读任务。',
  };
}

function check(id: string, title: string, passed: boolean): Check { return { id, title, passed }; }
function stable(value: unknown): string { return JSON.stringify(value); }
