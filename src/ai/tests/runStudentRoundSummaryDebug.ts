import { completeLearningRound } from '../agents/learningRoundCompletionAgent.ts';
import { executeLearningRound } from '../agents/learningRoundExecutionAgent.ts';
import { startLearningRound } from '../agents/learningRoundStartAgent.ts';
import { buildStudentLearningFeedback } from '../agents/studentFeedbackAdapter.ts';
import { buildStudentLearningEntryState } from '../agents/studentLearningEntryAgent.ts';
import { buildStudentRoundSummary } from '../agents/studentRoundSummaryAdapter.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { LearningRoundResult } from '../schemas/learningRound.schema.ts';
import { isStudentRoundSummary } from '../schemas/studentRoundSummary.schema.ts';
import type { StudentRoundSummary, StudentRoundSummaryInput } from '../schemas/studentRoundSummary.schema.ts';
import type { StudentLearningFeedback } from '../schemas/studentLearningFeedback.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildGrowthMemorySummaryFixture,
  buildStudentAbilityProfileFixture,
  phase83RunAt,
} from './nextLearningStrategyDebugFixtures.ts';
import { buildMockTaskResources } from './taskFulfillmentDebugFixtures.ts';

type DebugCase = {
  name: string;
  input: StudentRoundSummaryInput;
  expected: {
    status: StudentRoundSummary['status'];
    nextAction?: StudentRoundSummary['nextAction'];
    positiveTakeawayEmpty?: boolean;
    mustContainIssue?: string;
    mustContainAttention?: string;
    mustNotContain?: string[];
  };
};

const readyStartResult = startLearningRound({
  studentAbilityProfile: buildStudentAbilityProfileFixture(),
  growthMemorySummary: buildGrowthMemorySummaryFixture('retest_pending'),
  currentLearningContext: buildCurrentLearningContextFixture({
    currentPhase: 'retest',
    targetAbilityId: '推理',
    allowRetest: true,
  }),
  availableTaskResources: buildMockTaskResources(),
  learningRoundId: 'learning-round-summary-debug',
  createdAt: phase83RunAt,
});

if (!readyStartResult.concreteTask) {
  throw new Error('Phase 11.3 debug fixture failed: missing concreteTask.');
}

const entryState = buildStudentLearningEntryState({
  startResult: readyStartResult,
  answerDraft: '父亲看到旧书和树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。',
});

const validExecution = executeLearningRound({
  startResult: readyStartResult,
  studentAnswer: {
    answerText: '父亲看到旧书和树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。',
  },
});

const emptyExecution = executeLearningRound({
  startResult: readyStartResult,
  studentAnswer: { answerText: '' },
});

const completedRound = completeLearningRound({
  executionResult: validExecution,
  concreteTask: readyStartResult.concreteTask,
  diagnosisResult: buildDiagnosisResult('推理', 'fully_meets', {
    matchedRubricItems: ['文本线索', '心理推断'],
    abilityEvidence: ['学生能够结合文本线索说明人物心理。'],
  }),
  completedAt: '2026-07-14T11:00:00.000Z',
});

const retryRound = completeLearningRound({
  executionResult: emptyExecution,
  concreteTask: readyStartResult.concreteTask,
  completedAt: '2026-07-14T11:05:00.000Z',
});

const reviewRound = completeLearningRound({
  executionResult: validExecution,
  concreteTask: readyStartResult.concreteTask,
  diagnosisFailed: true,
  diagnosisResult: null,
  completedAt: '2026-07-14T11:10:00.000Z',
});

const blockedRound = {
  ...completedRound,
  status: 'blocked',
  nextStep: 'stop',
  nextStepReason: '本轮任务数据不完整，暂时无法完成。',
  issues: ['Task readiness failed.'],
} satisfies LearningRoundResult;

const abandonedRound = {
  ...completedRound,
  status: 'abandoned',
  nextStep: 'stop',
  nextStepReason: '学生主动中断本轮任务。',
  issues: ['Student abandoned current round.'],
} satisfies LearningRoundResult;

const completedFeedback = buildStudentLearningFeedback({
  entryState,
  learningRoundResult: completedRound,
});
const retryFeedback = buildStudentLearningFeedback({
  entryState,
  learningRoundResult: retryRound,
});
const reviewFeedback = buildStudentLearningFeedback({
  entryState,
  learningRoundResult: reviewRound,
});
const blockedFeedback = buildStudentLearningFeedback({
  entryState,
  learningRoundResult: blockedRound,
});
const noPositiveFeedback: StudentLearningFeedback = {
  ...completedFeedback,
  whatYouDidWell: [],
  whatNeedsAttention: ['还需要把文本线索和心理结论连接得更清楚。'],
};

const cases: DebugCase[] = [
  {
    name: 'Case 1 本轮完成：展示完成摘要，不宣称掌握或提升',
    input: {
      learningRoundResult: completedRound,
      studentLearningFeedback: completedFeedback,
      studentLearningEntryState: entryState,
    },
    expected: {
      status: 'completed',
      nextAction: 'continue_learning',
      mustNotContain: ['答对', '掌握', '提升', '能力已经提升'],
    },
  },
  {
    name: 'Case 2 需要补充回答：不输出能力结论',
    input: {
      learningRoundResult: retryRound,
      studentLearningFeedback: retryFeedback,
      studentLearningEntryState: entryState,
    },
    expected: {
      status: 'retry_required',
      nextAction: 'supplement_answer',
      positiveTakeawayEmpty: true,
      mustContainAttention: '判断',
      mustNotContain: ['能力不足', '推理链不完整'],
    },
  },
  {
    name: 'Case 3 需要复核：温和说明等待确认',
    input: {
      learningRoundResult: reviewRound,
      studentLearningFeedback: reviewFeedback,
      studentLearningEntryState: entryState,
    },
    expected: {
      status: 'review_required',
      nextAction: 'wait_for_review',
      positiveTakeawayEmpty: true,
      mustNotContain: ['Schema', 'Diagnosis Runtime', 'diagnosis_failed'],
    },
  },
  {
    name: 'Case 4 流程阻断：说明暂时无法完成',
    input: {
      learningRoundResult: blockedRound,
      studentLearningFeedback: blockedFeedback,
      studentLearningEntryState: entryState,
    },
    expected: {
      status: 'blocked',
      nextAction: 'restart_later',
      positiveTakeawayEmpty: true,
      mustContainAttention: '暂时无法继续',
    },
  },
  {
    name: 'Case 5 学生中断：不形成正式学习结果',
    input: {
      learningRoundResult: abandonedRound,
      studentLearningFeedback: completedFeedback,
      studentLearningEntryState: entryState,
      exitState: {
        abandoned: true,
        reason: 'student_clicked_exit',
      },
    },
    expected: {
      status: 'abandoned',
      nextAction: 'finish_round',
      mustContainAttention: '已经停止',
      mustNotContain: ['掌握', '提升'],
    },
  },
  {
    name: 'Case 6 无正向反馈：positiveTakeaway 允许为空',
    input: {
      learningRoundResult: completedRound,
      studentLearningFeedback: noPositiveFeedback,
      studentLearningEntryState: entryState,
    },
    expected: {
      status: 'completed',
      positiveTakeawayEmpty: true,
      mustContainAttention: '线索',
    },
  },
  {
    name: 'Case 7 状态冲突：输出保守状态并记录 status_conflict',
    input: {
      learningRoundResult: completedRound,
      studentLearningFeedback: reviewFeedback,
      studentLearningEntryState: entryState,
    },
    expected: {
      status: 'review_required',
      nextAction: 'wait_for_review',
      mustContainIssue: 'status_conflict',
      mustNotContain: ['本轮学习已完成'],
    },
  },
  {
    name: 'Case 8 身份不一致：阻断并记录 identity_mismatch',
    input: {
      learningRoundResult: completedRound,
      studentLearningFeedback: {
        ...completedFeedback,
        learningRoundId: 'other-learning-round',
      },
      studentLearningEntryState: entryState,
    },
    expected: {
      status: 'blocked',
      nextAction: 'restart_later',
      mustContainIssue: 'identity_mismatch',
      mustContainAttention: '数据不一致',
    },
  },
  {
    name: 'Case 9 原始字段隔离：学生摘要不暴露 Runtime 字段',
    input: {
      learningRoundResult: completedRound,
      studentLearningFeedback: completedFeedback,
      studentLearningEntryState: entryState,
    },
    expected: {
      status: 'completed',
      mustNotContain: [
        'LearningRoundResult',
        'TaskEvidenceReturnResult',
        'AbilityEvidence',
        'GrowthMemoryRecord',
        'ProfileUpdateDecision',
        'confidence',
        'Prompt',
      ],
    },
  },
];

type CaseReport = {
  name: string;
  status: string;
  title: string;
  completionSummary: string;
  studentReadableResult: string;
  positiveTakeaway: string[];
  continueAttention: string[];
  nextAction: string;
  nextActionText: string;
  canContinue: boolean;
  canRetry: boolean;
  canFinish: boolean;
  debugIssues: string[];
  passed: boolean;
  failReasons: string[];
};

const reports = cases.map(runCase);
const failedReports = reports.filter((report) => !report.passed);

printReport(reports);

if (failedReports.length > 0) {
  console.error('[FAIL] Phase 11.3 Student Round Summary debug failed.');
  process.exit(1);
}

console.log('[PASS] Phase 11.3 Student Round Summary debug passed.');

function runCase(debugCase: DebugCase): CaseReport {
  const summary = buildStudentRoundSummary(debugCase.input);
  const failReasons: string[] = [];
  const studentVisibleText = [
    summary.title,
    summary.completedTaskTitle,
    summary.roundFocus.title,
    summary.roundFocus.description,
    summary.completionSummary,
    summary.studentReadableResult,
    ...summary.positiveTakeaway,
    ...summary.continueAttention,
    summary.nextActionText,
  ].join('\n');
  const debugIssues = summary.debugState?.issues || [];

  if (!isStudentRoundSummary(summary)) failReasons.push('StudentRoundSummary schema validation failed.');
  if (summary.status !== debugCase.expected.status) {
    failReasons.push(`Expected status ${debugCase.expected.status}, got ${summary.status}.`);
  }
  if (
    debugCase.expected.nextAction &&
    summary.nextAction !== debugCase.expected.nextAction
  ) {
    failReasons.push(`Expected nextAction ${debugCase.expected.nextAction}, got ${summary.nextAction}.`);
  }
  if (debugCase.expected.positiveTakeawayEmpty && summary.positiveTakeaway.length !== 0) {
    failReasons.push('Expected positiveTakeaway to be empty.');
  }
  if (
    debugCase.expected.mustContainAttention &&
    !summary.continueAttention.join('\n').includes(debugCase.expected.mustContainAttention)
  ) {
    failReasons.push(`Expected continueAttention to contain ${debugCase.expected.mustContainAttention}.`);
  }
  if (
    debugCase.expected.mustContainIssue &&
    !debugIssues.join('\n').includes(debugCase.expected.mustContainIssue)
  ) {
    failReasons.push(`Expected debug issues to contain ${debugCase.expected.mustContainIssue}.`);
  }
  for (const forbidden of debugCase.expected.mustNotContain || []) {
    if (studentVisibleText.includes(forbidden)) {
      failReasons.push(`Student visible summary must not contain ${forbidden}.`);
    }
  }
  if (summary.completionSummary === summary.studentReadableResult) {
    failReasons.push('completionSummary and studentReadableResult should not be identical.');
  }

  return {
    name: debugCase.name,
    status: summary.status,
    title: summary.title,
    completionSummary: summary.completionSummary,
    studentReadableResult: summary.studentReadableResult,
    positiveTakeaway: summary.positiveTakeaway,
    continueAttention: summary.continueAttention,
    nextAction: summary.nextAction,
    nextActionText: summary.nextActionText,
    canContinue: summary.canContinue,
    canRetry: summary.canRetry,
    canFinish: summary.canFinish,
    debugIssues,
    passed: failReasons.length === 0,
    failReasons,
  };
}

function buildDiagnosisResult(
  mainAbility: string,
  answerStatus: DiagnosisResult['answerStatus'],
  overrides: Partial<DiagnosisResult> = {},
): DiagnosisResult {
  const correct = answerStatus === 'fully_meets'
    ? true
    : answerStatus === 'does_not_meet'
      ? false
      : null;

  return {
    taskType: 'open_response',
    correct,
    strategyUsed: 'phase11_3_mock_diagnosis',
    answerStatus,
    scoreBand: answerStatus === 'fully_meets' ? 'high' : answerStatus === 'partially_meets' ? 'medium' : 'low',
    rubricItems: [],
    matchedRubricItems: answerStatus === 'fully_meets' ? ['文本线索', '心理推断'] : [],
    missingRubricItems: answerStatus === 'fully_meets' ? [] : ['推理链说明'],
    mainAbility,
    relatedAbilities: ['信息提取', '理解', '表达'],
    surfaceError: answerStatus === 'fully_meets'
      ? '本次作答能够回应任务要求。'
      : '答案未充分说明文本线索与人物心理之间的关系。',
    rootCause: answerStatus === 'fully_meets'
      ? '学生能够从文本线索推出人物心理。'
      : '学生尚未完整建立“文本线索 -> 人物心理 -> 结论表达”的推理链。',
    errorType: answerStatus === 'fully_meets' ? '待验证' : '推理错误',
    abilityEvidence: answerStatus === 'fully_meets'
      ? ['学生能够结合文本线索说明人物心理。']
      : ['学生没有说明文本线索与人物心理之间的关系。'],
    diagnosisSummary: answerStatus === 'fully_meets'
      ? '本次作答基本满足推理任务要求。'
      : '本次作答可以形成薄弱证据，后续应继续训练推理链表达。',
    nextTraining: answerStatus === 'fully_meets'
      ? '进入迁移复测或降低该能力训练优先级。'
      : '继续进行文本线索到人物心理的推理链训练。',
    confidence: answerStatus === 'fully_meets' ? 0.82 : 0.74,
    ...overrides,
  };
}

function printReport(caseReports: CaseReport[]): void {
  console.log('Phase 11.3 Student Round Summary Debug Report');
  console.log('=============================================');
  console.log(`total: ${caseReports.length}`);
  console.log(`pass: ${caseReports.filter((report) => report.passed).length}`);
  console.log(`fail: ${caseReports.filter((report) => !report.passed).length}`);
  console.log('');

  for (const report of caseReports) {
    console.log(`${report.passed ? '[PASS]' : '[FAIL]'} ${report.name}`);
    console.log(`status: ${report.status}`);
    console.log(`title: ${report.title}`);
    console.log(`completionSummary: ${report.completionSummary}`);
    console.log(`studentReadableResult: ${report.studentReadableResult}`);
    console.log(`positiveTakeaway: ${report.positiveTakeaway.length ? report.positiveTakeaway.join(' | ') : 'none'}`);
    console.log(`continueAttention: ${report.continueAttention.length ? report.continueAttention.join(' | ') : 'none'}`);
    console.log(`nextAction: ${report.nextAction}`);
    console.log(`nextActionText: ${report.nextActionText}`);
    console.log(`canContinue: ${report.canContinue}`);
    console.log(`canRetry: ${report.canRetry}`);
    console.log(`canFinish: ${report.canFinish}`);
    console.log(`debugIssues: ${report.debugIssues.length ? report.debugIssues.join(' | ') : 'none'}`);
    if (report.failReasons.length > 0) console.log(`failReasons: ${report.failReasons.join(' | ')}`);
    console.log('');
  }
}
