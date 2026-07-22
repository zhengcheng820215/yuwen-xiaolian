import { buildStudentFeedbackGrounding } from '../agents/studentFeedbackGroundingAgent.ts';
import type {
  StudentLearningFeedback,
  TaskRequirementCoverage,
} from '../schemas/studentLearningFeedback.schema.ts';

type Report = { name: string; passed: boolean; detail: string };

const reports: Report[] = [];

function main(): void {
  const evidenceGap = buildStudentFeedbackGrounding(feedback({
    coverage: [
      coverage('conclusion', 'covered', {
        studentEvidence: ['父亲喜欢这片树叶'],
        studentMessage: '你已经写出了人物的心理判断。',
      }),
      coverage('text_evidence', 'missing', {
        requirementId: 'requirement-evidence',
        requirementText: '结合人物的具体动作或语句',
        gapMessage: '还没有引用父亲的具体动作来支撑这个判断。',
        gapReasonCode: 'missing_text_evidence',
      }),
    ],
    primaryGapRequirementId: 'requirement-evidence',
    primaryGap: '还没有引用父亲的具体动作来支撑这个判断。',
    actions: ['找出父亲的一个具体动作。', '说明这个动作为什么能体现珍惜。'],
  }));
  check('FG01 正向反馈来自学生答案与正式 Requirement',
    evidenceGap.validation.passed &&
    evidenceGap.achievedPoints[0]?.text === '你已经写出了人物的心理判断。' &&
    evidenceGap.achievedPoints[0]?.evidenceLinks.some((item) => item.startsWith('student-evidence:')) === true &&
    !JSON.stringify(evidenceGap.achievedPoints[0]?.evidenceLinks).includes('父亲喜欢这片树叶'),
    JSON.stringify(evidenceGap.achievedPoints));
  check('FG02 文本依据缺口映射到 LG04',
    evidenceGap.primaryGap?.gapCode === 'LG04_TEXT_EVIDENCE_MISSING' &&
    evidenceGap.primaryGap.missingRequirement === '结合人物的具体动作或语句',
    JSON.stringify(evidenceGap.primaryGap));
  check('FG03 改进动作绑定同一主要 Gap',
    evidenceGap.actions.length === 2 &&
    evidenceGap.actions.every((item) => item.targetGapId === evidenceGap.primaryGap?.gapId) &&
    evidenceGap.validation.actionsBoundToGap,
    JSON.stringify(evidenceGap.actions));

  const reasoningGap = buildStudentFeedbackGrounding(feedback({
    coverage: [
      coverage('text_evidence', 'covered', {
        requirementId: 'requirement-evidence',
        requirementText: '找出人物动作',
        studentEvidence: ['捏着树叶站了很久'],
        studentMessage: '你已经找到了父亲的具体动作。',
      }),
      coverage('reasoning_relation', 'missing', {
        requirementId: 'requirement-relation',
        requirementText: '说明动作与人物心理之间的关系',
        gapMessage: '还没有说明这个动作为什么能体现父亲的珍惜。',
        gapReasonCode: 'missing_reasoning_relation',
      }),
    ],
    primaryGapRequirementId: 'requirement-relation',
    primaryGap: '还没有说明这个动作为什么能体现父亲的珍惜。',
    actions: ['补充动作与人物心理之间的解释。'],
  }));
  check('FG04 推理关系缺口映射到 LG05',
    reasoningGap.primaryGap?.gapCode === 'LG05_REASONING_RELATION_MISSING',
    JSON.stringify(reasoningGap.primaryGap));

  const invalid = buildStudentFeedbackGrounding(feedback({
    coverage: [coverage('conclusion', 'insufficient_to_judge', {
      studentEvidence: [],
      gapMessage: '这次回答还没有提供足够内容，请先写出人物心理并说明理由。',
      gapReasonCode: 'insufficient_to_judge',
    })],
    primaryGapRequirementId: 'requirement-conclusion',
    primaryGap: '这次回答还没有提供足够内容，请先写出人物心理并说明理由。',
    actions: ['先完成一次有效作答。'],
  }));
  check('FG05 无效答案不生成具体 Learning Gap 或虚构优点',
    invalid.status === 'cannot_assess' &&
    invalid.primaryGap?.gapCode === undefined &&
    invalid.primaryGap?.verificationStatus === 'needs_verification' &&
    invalid.achievedPoints.length === 0,
    JSON.stringify(invalid));

  const attempted = buildStudentFeedbackGrounding(feedback({
    coverage: [coverage('conclusion', 'insufficient_to_judge', {
      studentEvidence: ['父亲喜欢这片树叶'],
      gapMessage: '目前还不能确认这个判断是否充分。',
      gapReasonCode: undefined,
    })],
    primaryGapRequirementId: 'requirement-conclusion',
    primaryGap: '目前还不能确认这个判断是否充分。',
    actions: ['从文中找出一个具体动作。'],
  }));
  check('FG06 未确认完成的尝试不进入做得好的地方',
    attempted.achievedPoints.length === 0,
    JSON.stringify(attempted.achievedPoints));

  console.log('\nStudent Feedback Grounding Debug');
  console.log('='.repeat(72));
  reports.forEach((report) => {
    console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`);
    console.log(`       ${report.detail}`);
  });
  const passed = reports.filter((item) => item.passed).length;
  console.log('-'.repeat(72));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  if (passed !== reports.length) throw new Error('Student Feedback Grounding Debug failed.');
}

function feedback(input: {
  coverage: TaskRequirementCoverage[];
  primaryGapRequirementId?: string;
  primaryGap?: string;
  actions: string[];
}): StudentLearningFeedback {
  return {
    learningRoundId: 'round-feedback-grounding',
    studentId: 'student-demo',
    stage: 'result',
    resultStatus: 'completed',
    headline: '反馈',
    summary: '本轮反馈已经形成。',
    whatYouDidWell: [],
    whatNeedsAttention: input.primaryGap ? [input.primaryGap] : [],
    nextActionText: input.actions.join(' '),
    guidance: {
      detailsToReview: [],
      revisionActions: input.actions,
    },
    thinkingReview: {
      requirementCoverage: input.coverage,
      coveredPoints: input.coverage.map((item) => item.studentMessage).filter(isString),
      primaryGapRequirementId: input.primaryGapRequirementId,
      primaryGap: input.primaryGap,
      missingPoints: input.primaryGap ? [input.primaryGap] : [],
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

function check(name: string, passed: boolean, detail: string): void {
  reports.push({ name, passed, detail });
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

main();
