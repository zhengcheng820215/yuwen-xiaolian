import { buildStudentFeedbackActionPlan } from '../agents/studentFeedbackActionPlanAgent.ts';
import { buildStudentFeedbackGrounding } from '../agents/studentFeedbackGroundingAgent.ts';
import { buildStudentThinkingAnalysis } from '../agents/studentThinkingAnalysisAgent.ts';
import type {
  StudentLearningFeedback,
  TaskRequirementCoverage,
} from '../schemas/studentLearningFeedback.schema.ts';

type Report = { name: string; passed: boolean; detail: string };
const reports: Report[] = [];

function main(): void {
  const evidenceFeedback = feedback([
    coverage('conclusion', 'covered', {
      studentEvidence: ['父亲珍惜这片树叶'],
    }),
    coverage('text_evidence', 'missing', {
      requirementId: 'requirement-evidence',
      requirementText: '使用文中的具体内容作为依据',
      taskEvidence: ['能提取“捏着树叶站了很久”“小心地夹回原处”等动作线索'],
      gapMessage: '还需要从文中找出人物的具体动作或语句。',
      gapReasonCode: 'missing_text_evidence',
    }),
  ], 'requirement-evidence', '还需要从文中找出人物的具体动作或语句。');
  const evidencePlan = plan(evidenceFeedback);
  check('FA01 用学生原话确认已经完成的答案动作',
    evidencePlan.acknowledgedAction === '你写出了“父亲珍惜这片树叶”这一想法。' &&
    evidencePlan.whyItMatters?.includes('回应题目') === true,
    `${evidencePlan.acknowledgedAction} ${evidencePlan.whyItMatters}`);
  check('FA02 问题机制指出思考链在哪里中断',
    evidencePlan.problemMechanism?.includes('父亲珍惜这片树叶') === true &&
    evidencePlan.problemMechanism.includes('没有呈现人物做了什么'),
    evidencePlan.problemMechanism);
  check('FA03 首次正式反馈只提供思考问题，不默认提供句式支架',
    evidencePlan.feedbackDepth === 4 &&
    evidencePlan.hintLevel === 'paraphrase' &&
    evidencePlan.nextOperations.length === 1 &&
    evidencePlan.nextOperations[0]?.includes('这个动作说明父亲当时在想什么') === true &&
    evidencePlan.scaffoldTemplate === undefined,
    JSON.stringify({ operations: evidencePlan.nextOperations, scaffold: evidencePlan.scaffoldTemplate }));

  const relationFeedback = feedback([
    coverage('conclusion', 'covered', { studentEvidence: ['父亲很珍惜这片树叶'] }),
    coverage('text_evidence', 'covered', {
      requirementId: 'requirement-evidence',
      studentEvidence: ['把树叶小心地夹回原处'],
      taskEvidence: ['“把树叶小心地夹回原处”'],
    }),
    coverage('reasoning_relation', 'missing', {
      requirementId: 'requirement-relation',
      requirementText: '说明动作与人物心理之间的联系',
      gapMessage: '还没有说明动作与心理之间的联系。',
      gapReasonCode: 'missing_reasoning_relation',
    }),
  ], 'requirement-relation', '还没有说明动作与心理之间的联系。');
  const relationPlan = plan(relationFeedback);
  check('FA04 推理缺口同时点名已有依据和已有判断',
    relationPlan.missingAnswerPart?.includes('把树叶小心地夹回原处') === true &&
    relationPlan.missingAnswerPart.includes('父亲很珍惜这片树叶'),
    relationPlan.missingAnswerPart);

  const invalidFeedback = feedback([
    coverage('conclusion', 'insufficient_to_judge', {
      studentEvidence: [],
      taskEvidence: [],
      gapMessage: '这次回答还没有提供足够内容。',
      gapReasonCode: 'insufficient_to_judge',
    }),
  ], 'requirement-conclusion', '这次回答还没有提供足够内容。');
  const invalidPlan = plan(invalidFeedback);
  check('FA05 无效作答不虚构优点或泄露答案',
    invalidPlan.feedbackDepth === 1 &&
    invalidPlan.hintLevel === 'none' &&
    invalidPlan.acknowledgedAction === undefined &&
    invalidPlan.nextOperations.length === 1,
    JSON.stringify(invalidPlan));

  const retryPlan = plan({ ...evidenceFeedback, canRetry: true });
  check('FA06 可重试反馈降低披露深度且不提供完整支架',
    retryPlan.feedbackDepth === 3 &&
    retryPlan.hintLevel === 'paraphrase' &&
    retryPlan.scaffoldTemplate === undefined &&
    retryPlan.nextOperations.length === 1,
    JSON.stringify({ depth: retryPlan.feedbackDepth, operations: retryPlan.nextOperations }));

  const mismatchFeedback = feedback([
    coverage('conclusion', 'missing', {
      taskEvidence: ['材料重点呈现“在留言旁停留”这一动作'],
      gapMessage: '答案中的人物心理结论与材料表现出的意思不一致。',
      gapReasonCode: 'conclusion_inconsistent',
    }),
  ], 'requirement-conclusion', '答案中的人物心理结论与材料表现出的意思不一致。');
  const mismatchPlan = plan(mismatchFeedback, '周老师只是想休息。');
  check('FA07 结论偏差同时锚定学生原判断和材料线索',
    mismatchPlan.problemMechanism?.includes('周老师只是想休息') === true &&
    mismatchPlan.problemMechanism.includes('在留言旁停留') &&
    mismatchPlan.nextOperations.length === 1 &&
    mismatchPlan.nextOperations[0]?.includes('真的能说明') === true &&
    mismatchPlan.nextOperations[0]?.includes('先别急着改结论') === true &&
    mismatchPlan.scaffoldTemplate === undefined,
    JSON.stringify({ mechanism: mismatchPlan.problemMechanism, operations: mismatchPlan.nextOperations }));

  check('FA08 所有动作计划通过来源、具体性和披露校验',
    [evidencePlan, relationPlan, invalidPlan, retryPlan, mismatchPlan].every((item) => item.validation.passed),
    [evidencePlan, relationPlan, invalidPlan, retryPlan, mismatchPlan]
      .flatMap((item) => item.validation.issues).join('|') || 'none');

  console.log('\nStudent Feedback Action Plan Debug');
  console.log('='.repeat(76));
  reports.forEach((report) => {
    console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`);
    console.log(`       ${report.detail || 'ok'}`);
  });
  const passed = reports.filter((item) => item.passed).length;
  console.log('-'.repeat(76));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  if (passed !== reports.length) throw new Error('Student Feedback Action Plan Debug failed.');
}

function plan(value: StudentLearningFeedback, answerText?: string) {
  const grounding = buildStudentFeedbackGrounding(value);
  const studentResponse = answerText ? {
    responseId: 'response-feedback-action-plan',
    executionSessionId: 'session-feedback-action-plan',
    studentId: value.studentId,
    taskId: 'task-feedback-action-plan',
    answerText,
    submittedAt: '2026-07-22T00:00:00.000Z',
    usedHint: false,
    hintCount: 0,
  } : undefined;
  const thinkingAnalysis = buildStudentThinkingAnalysis(value, grounding, studentResponse);
  return buildStudentFeedbackActionPlan({
    feedback: value,
    grounding,
    thinkingAnalysis,
    studentResponse,
    taskRole: 'observation',
  });
}

function feedback(
  requirementCoverage: TaskRequirementCoverage[],
  primaryGapRequirementId: string,
  primaryGap: string,
): StudentLearningFeedback {
  return {
    learningRoundId: 'round-feedback-action-plan',
    studentId: 'student-demo',
    stage: 'result',
    resultStatus: 'completed',
    headline: '反馈',
    summary: '本轮反馈已经形成。',
    whatYouDidWell: [],
    whatNeedsAttention: [primaryGap],
    nextActionText: '修改当前答案。',
    guidance: { detailsToReview: [], revisionActions: ['修改当前答案。'] },
    thinkingReview: {
      requirementCoverage,
      coveredPoints: [],
      primaryGapRequirementId,
      primaryGap,
      missingPoints: [primaryGap],
    },
    canRetry: false,
    canFinishRound: true,
    source: 'learning_round',
  };
}

function coverage(
  requirementType: TaskRequirementCoverage['requirementType'],
  status: TaskRequirementCoverage['status'],
  overrides: Partial<TaskRequirementCoverage> = {},
): TaskRequirementCoverage {
  return {
    requirementId: `requirement-${requirementType}`,
    requirementType,
    requirementText: requirementType === 'conclusion' ? '写出人物心理' : '完成题目要求',
    required: true,
    status,
    studentEvidence: [],
    taskEvidence: ['正式任务要求'],
    source: 'rubric',
    ...overrides,
  };
}

function check(name: string, passed: boolean, detail?: string): void {
  reports.push({ name, passed, detail: detail || 'ok' });
}

main();
