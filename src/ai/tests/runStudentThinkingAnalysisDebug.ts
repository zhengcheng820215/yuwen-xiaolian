import { buildStudentFeedbackGrounding } from '../agents/studentFeedbackGroundingAgent.ts';
import { buildStudentThinkingAnalysis } from '../agents/studentThinkingAnalysisAgent.ts';
import type { StudentLearningFeedback, TaskRequirementCoverage } from '../schemas/studentLearningFeedback.schema.ts';

type Report = { name: string; passed: boolean; detail: string };
const reports: Report[] = [];

function main(): void {
  const evidenceMissing = analyze(feedback([
    coverage('conclusion', 'covered', { studentEvidence: ['父亲很喜欢这片旧叶子'] }),
    coverage('text_evidence', 'missing', {
      requirementId: 'requirement-evidence',
      gapMessage: '缺少材料依据。',
      gapReasonCode: 'missing_text_evidence',
    }),
  ], 'requirement-evidence', '缺少材料依据。'));
  check('TA01 已完成思考动作说明完成内容和价值',
    evidenceMissing.completedSteps[0]?.action.includes('父亲很喜欢这片旧叶子') === true &&
    evidenceMissing.completedSteps[0]?.whyItMatters.includes('回应题目') === true,
    JSON.stringify(evidenceMissing.completedSteps));
  check('TA02 文本依据缺口定位动作到心理的可观察断点',
    evidenceMissing.interruptedTransition?.fromStep === '材料中的人物动作或语句' &&
    evidenceMissing.interruptedTransition.toStep === '人物心理判断' &&
    evidenceMissing.interruptedTransition.observedProblem.includes('直接写出了') &&
    evidenceMissing.interruptedTransition.observedProblem.includes('没有呈现人物做了什么'),
    JSON.stringify(evidenceMissing.interruptedTransition));

  const relationMissing = analyze(feedback([
    coverage('conclusion', 'covered', { studentEvidence: ['父亲很珍惜这片树叶'] }),
    coverage('text_evidence', 'covered', { studentEvidence: ['把树叶小心地夹回原处'] }),
    coverage('reasoning_relation', 'missing', {
      requirementId: 'requirement-relation',
      gapMessage: '还没有说明依据和心理的联系。',
      gapReasonCode: 'missing_reasoning_relation',
    }),
  ], 'requirement-relation', '还没有说明依据和心理的联系。'));
  check('TA03 推理断点同时引用已有依据和已有结论',
    relationMissing.interruptedTransition?.observedProblem.includes('把树叶小心地夹回原处') === true &&
    relationMissing.interruptedTransition.observedProblem.includes('父亲很珍惜这片树叶'),
    JSON.stringify(relationMissing.interruptedTransition));

  const invalid = analyze(feedback([
    coverage('conclusion', 'insufficient_to_judge', {
      studentEvidence: [],
      gapMessage: '这次回答还没有提供足够内容。',
      gapReasonCode: 'insufficient_to_judge',
    }),
  ], 'requirement-conclusion', '这次回答还没有提供足够内容。'));
  check('TA04 无效答案不生成完成步骤和思考断点',
    invalid.status === 'cannot_assess' && invalid.completedSteps.length === 0 &&
    invalid.interruptedTransition === undefined && invalid.unresolvedQuestions.length === 1,
    JSON.stringify(invalid));
  check('TA05 分析不包含能力标签或长期结论',
    [evidenceMissing, relationMissing, invalid].every((item) => item.validation.passed) &&
    !/(能力差|能力弱|不会推理|已经提升|已经掌握)/.test(JSON.stringify([evidenceMissing, relationMissing, invalid])),
    [evidenceMissing, relationMissing, invalid].flatMap((item) => item.validation.issues).join('|') || 'none');

  console.log('\nStudent Thinking Analysis Debug');
  console.log('='.repeat(76));
  reports.forEach((report) => {
    console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`);
    console.log(`       ${report.detail}`);
  });
  const passed = reports.filter((item) => item.passed).length;
  console.log('-'.repeat(76));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  if (passed !== reports.length) throw new Error('Student Thinking Analysis Debug failed.');
}

function analyze(value: StudentLearningFeedback) {
  const grounding = buildStudentFeedbackGrounding(value);
  return buildStudentThinkingAnalysis(value, grounding);
}

function feedback(
  requirementCoverage: TaskRequirementCoverage[],
  primaryGapRequirementId: string,
  primaryGap: string,
): StudentLearningFeedback {
  return {
    learningRoundId: 'round-thinking-analysis', studentId: 'student-demo', stage: 'result',
    resultStatus: 'completed', headline: '反馈', summary: '本轮反馈已经形成。',
    whatYouDidWell: [], whatNeedsAttention: [primaryGap], nextActionText: '修改当前答案。',
    guidance: { detailsToReview: [], revisionActions: ['修改当前答案。'] },
    thinkingReview: { requirementCoverage, coveredPoints: [], primaryGapRequirementId, primaryGap, missingPoints: [primaryGap] },
    canRetry: false, canFinishRound: true, source: 'learning_round',
  };
}

function coverage(
  requirementType: TaskRequirementCoverage['requirementType'],
  status: TaskRequirementCoverage['status'],
  overrides: Partial<TaskRequirementCoverage> = {},
): TaskRequirementCoverage {
  return {
    requirementId: `requirement-${requirementType}`, requirementType,
    requirementText: requirementType === 'conclusion' ? '写出人物心理' : '完成题目要求',
    required: true, status, studentEvidence: [], taskEvidence: ['正式任务要求'], source: 'rubric',
    ...overrides,
  };
}

function check(name: string, passed: boolean, detail: string): void {
  reports.push({ name, passed, detail });
}

main();
