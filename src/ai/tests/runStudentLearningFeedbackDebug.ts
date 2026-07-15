import { buildStudentLearningEntryState } from '../agents/studentLearningEntryAgent.ts';
import { buildStudentLearningFeedback } from '../agents/studentFeedbackAdapter.ts';
import { completeLearningRound } from '../agents/learningRoundCompletionAgent.ts';
import { executeLearningRound } from '../agents/learningRoundExecutionAgent.ts';
import { startLearningRound } from '../agents/learningRoundStartAgent.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { LearningRoundResult } from '../schemas/learningRound.schema.ts';
import { isStudentLearningFeedback } from '../schemas/studentLearningFeedback.schema.ts';
import type { StudentLearningFeedback } from '../schemas/studentLearningFeedback.schema.ts';
import type { TaskEvidenceReturnResult } from '../schemas/taskEvidenceReturn.schema.ts';
import type { TaskExecutionResult } from '../schemas/taskExecution.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildGrowthMemorySummaryFixture,
  buildStudentAbilityProfileFixture,
  phase83RunAt,
} from './nextLearningStrategyDebugFixtures.ts';
import { buildMockTaskResources } from './taskFulfillmentDebugFixtures.ts';

type DebugCase = {
  name: string;
  input: Parameters<typeof buildStudentLearningFeedback>[0];
  expected: {
    stage: StudentLearningFeedback['stage'];
    resultStatus: StudentLearningFeedback['resultStatus'];
    source: StudentLearningFeedback['source'];
    canRetry?: boolean;
    canFinishRound?: boolean;
    positiveFeedbackEmpty?: boolean;
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
  learningRoundId: 'learning-round-feedback-debug',
  createdAt: phase83RunAt,
});

if (!readyStartResult.concreteTask) {
  throw new Error('Phase 11.2 debug fixture failed: missing concreteTask.');
}

const entryState = buildStudentLearningEntryState({
  startResult: readyStartResult,
  answerDraft: '父亲很怀念过去时光。',
});

const emptyExecution = executeLearningRound({
  startResult: readyStartResult,
  studentAnswer: { answerText: '' },
});
const placeholderExecution = executeLearningRound({
  startResult: readyStartResult,
  studentAnswer: { answerText: '不知道' },
});
const shortValidExecution = executeLearningRound({
  startResult: readyStartResult,
  studentAnswer: { answerText: '父亲很怀念过去时光。' },
});
const analyzingExecution = executeLearningRound({
  startResult: readyStartResult,
  studentAnswer: {
    answerText: '父亲看到旧书和树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。',
  },
});
const diagnosisFailedRound = completeLearningRound({
  executionResult: analyzingExecution,
  concreteTask: readyStartResult.concreteTask,
  diagnosisFailed: true,
  diagnosisResult: null,
  completedAt: '2026-07-14T10:00:00.000Z',
});
const successfulRound = completeLearningRound({
  executionResult: analyzingExecution,
  concreteTask: readyStartResult.concreteTask,
  diagnosisResult: buildDiagnosisResult('推理', 'fully_meets', {
    matchedRubricItems: ['文本线索', '心理推断'],
    abilityEvidence: [
      '学生写出了“想起”“不舍”“怀念”的心理内容，并结合“旧书”和“树叶”说明了理由。',
    ],
  }),
  completedAt: '2026-07-14T10:05:00.000Z',
});
const mismatchRound = completeLearningRound({
  executionResult: analyzingExecution,
  concreteTask: readyStartResult.concreteTask,
  diagnosisResult: buildDiagnosisResult('表达', 'partially_meets'),
  completedAt: '2026-07-14T10:10:00.000Z',
});
const weakEvidenceRound = completeLearningRound({
  executionResult: analyzingExecution,
  concreteTask: readyStartResult.concreteTask,
  diagnosisResult: buildDiagnosisResult('推理', 'does_not_meet', {
    matchedRubricItems: [],
    abilityEvidence: ['学生没有说明文本线索与人物心理之间的关系。'],
  }),
  completedAt: '2026-07-14T10:15:00.000Z',
});
const noPositiveEvidenceReturn = buildNoPositiveEvidenceReturn(weakEvidenceRound);

const cases: DebugCase[] = [
  {
    name: 'Case 1 空答案：提示填写，不输出能力评价',
    input: {
      entryState,
      taskExecutionResult: requireTaskExecutionResult(emptyExecution.taskExecutionResult),
    },
    expected: {
      stage: 'submission',
      resultStatus: 'retry_required',
      source: 'task_execution',
      canRetry: true,
      positiveFeedbackEmpty: true,
      mustContainAttention: '填写',
      mustNotContain: ['能力不足', '推理链不完整'],
    },
  },
  {
    name: 'Case 2 占位回答：提示补充想法或依据',
    input: {
      entryState,
      taskExecutionResult: requireTaskExecutionResult(placeholderExecution.taskExecutionResult),
    },
    expected: {
      stage: 'submission',
      resultStatus: 'retry_required',
      source: 'task_execution',
      canRetry: true,
      positiveFeedbackEmpty: true,
      mustContainAttention: '判断',
      mustNotContain: ['能力不足'],
    },
  },
  {
    name: 'Case 3 简短但有效：允许分析',
    input: {
      entryState,
      taskExecutionResult: requireTaskExecutionResult(shortValidExecution.taskExecutionResult),
    },
    expected: {
      stage: 'submission',
      resultStatus: 'completed',
      source: 'task_execution',
      canRetry: false,
      mustNotContain: ['答案还太少', '不能分析'],
    },
  },
  {
    name: 'Case 4 有效作答分析中：不提前输出结论',
    input: {
      entryState,
      learningRoundExecutionResult: analyzingExecution,
    },
    expected: {
      stage: 'analysis',
      resultStatus: 'completed',
      source: 'task_execution',
      canFinishRound: false,
      mustNotContain: ['掌握', '提升', '薄弱点已经解决'],
    },
  },
  {
    name: 'Case 5 Evidence 回流成功：基于正式结果展示反馈',
    input: {
      entryState,
      taskEvidenceReturnResult: requireTaskEvidenceReturnResult(successfulRound.taskEvidenceReturnResult),
    },
    expected: {
      stage: 'result',
      resultStatus: 'completed',
      source: 'evidence_return',
      canFinishRound: true,
      mustNotContain: ['掌握', '能力已经提升'],
    },
  },
  {
    name: 'Case 6 Diagnosis 失败：不展示底层错误',
    input: {
      entryState,
      taskEvidenceReturnResult: requireTaskEvidenceReturnResult(diagnosisFailedRound.taskEvidenceReturnResult),
    },
    expected: {
      stage: 'result',
      resultStatus: 'review_required',
      source: 'evidence_return',
      canRetry: true,
      positiveFeedbackEmpty: true,
      mustNotContain: ['Schema', 'Diagnosis Runtime', 'diagnosis_failed'],
    },
  },
  {
    name: 'Case 7 能力不一致：进入复核，不输出目标能力改善',
    input: {
      entryState,
      taskEvidenceReturnResult: requireTaskEvidenceReturnResult(mismatchRound.taskEvidenceReturnResult),
    },
    expected: {
      stage: 'result',
      resultStatus: 'review_required',
      source: 'evidence_return',
      positiveFeedbackEmpty: true,
      mustNotContain: ['改善', '提升', '掌握'],
    },
  },
  {
    name: 'Case 8 多结果状态冲突：使用最靠后的 LearningRoundResult',
    input: {
      entryState,
      taskExecutionResult: requireTaskExecutionResult(analyzingExecution.taskExecutionResult),
      taskEvidenceReturnResult: requireTaskEvidenceReturnResult(diagnosisFailedRound.taskEvidenceReturnResult),
      learningRoundResult: diagnosisFailedRound,
    },
    expected: {
      stage: 'result',
      resultStatus: 'review_required',
      source: 'learning_round',
      positiveFeedbackEmpty: true,
      mustNotContain: ['答案已提交，正在分析', 'submitted_valid'],
    },
  },
  {
    name: 'Case 9 无可靠正向证据：whatYouDidWell 允许为空',
    input: {
      entryState,
      taskEvidenceReturnResult: noPositiveEvidenceReturn,
    },
    expected: {
      stage: 'result',
      resultStatus: 'completed',
      source: 'evidence_return',
      positiveFeedbackEmpty: true,
      mustContainAttention: '关系',
    },
  },
  {
    name: 'Case 10 本轮完成：不使用答对、掌握、提升',
    input: {
      entryState,
      learningRoundResult: successfulRound,
    },
    expected: {
      stage: 'result',
      resultStatus: 'completed',
      source: 'learning_round',
      canFinishRound: true,
      mustNotContain: ['答对', '掌握', '提升', '薄弱点已经解决'],
    },
  },
];

type CaseReport = {
  name: string;
  stage: string;
  resultStatus: string;
  source: string;
  headline: string;
  summary: string;
  whatYouDidWell: string[];
  whatNeedsAttention: string[];
  nextActionText: string;
  canRetry: boolean;
  canFinishRound: boolean;
  sourceStatus?: string;
  passed: boolean;
  failReasons: string[];
};

const reports = cases.map(runCase);
const failedReports = reports.filter((report) => !report.passed);

printReport(reports);

if (failedReports.length > 0) {
  console.error('[FAIL] Phase 11.2 Student Learning Feedback debug failed.');
  process.exit(1);
}

console.log('[PASS] Phase 11.2 Student Learning Feedback debug passed.');

function runCase(debugCase: DebugCase): CaseReport {
  const feedback = buildStudentLearningFeedback(debugCase.input);
  const failReasons: string[] = [];
  const combinedText = [
    feedback.headline,
    feedback.summary,
    ...feedback.whatYouDidWell,
    ...feedback.whatNeedsAttention,
    feedback.nextActionText,
  ].join('\n');

  if (!isStudentLearningFeedback(feedback)) failReasons.push('StudentLearningFeedback schema validation failed.');
  if (feedback.stage !== debugCase.expected.stage) {
    failReasons.push(`Expected stage ${debugCase.expected.stage}, got ${feedback.stage}.`);
  }
  if (feedback.resultStatus !== debugCase.expected.resultStatus) {
    failReasons.push(`Expected resultStatus ${debugCase.expected.resultStatus}, got ${feedback.resultStatus}.`);
  }
  if (feedback.source !== debugCase.expected.source) {
    failReasons.push(`Expected source ${debugCase.expected.source}, got ${feedback.source}.`);
  }
  if (
    debugCase.expected.canRetry !== undefined &&
    feedback.canRetry !== debugCase.expected.canRetry
  ) {
    failReasons.push(`Expected canRetry=${debugCase.expected.canRetry}, got ${feedback.canRetry}.`);
  }
  if (
    debugCase.expected.canFinishRound !== undefined &&
    feedback.canFinishRound !== debugCase.expected.canFinishRound
  ) {
    failReasons.push(`Expected canFinishRound=${debugCase.expected.canFinishRound}, got ${feedback.canFinishRound}.`);
  }
  if (debugCase.expected.positiveFeedbackEmpty && feedback.whatYouDidWell.length !== 0) {
    failReasons.push('Expected whatYouDidWell to be empty.');
  }
  if (
    debugCase.expected.mustContainAttention &&
    !feedback.whatNeedsAttention.join('\n').includes(debugCase.expected.mustContainAttention)
  ) {
    failReasons.push(`Expected attention to contain ${debugCase.expected.mustContainAttention}.`);
  }
  for (const forbidden of debugCase.expected.mustNotContain || []) {
    if (combinedText.includes(forbidden)) {
      failReasons.push(`Feedback must not contain ${forbidden}.`);
    }
  }

  const sourceAnswer = getSourceAnswer(debugCase.input);
  for (const item of feedback.whatYouDidWell) {
    if (!item.includes('你写出了')) continue;
    const quotedValues = Array.from(item.matchAll(/“([^”]+)”/g), (match) => match[1]);
    for (const quotedValue of quotedValues) {
      if (!sourceAnswer.includes(quotedValue)) {
        failReasons.push(`Quoted feedback must exist in student answer: ${quotedValue}.`);
      }
    }
  }

  return {
    name: debugCase.name,
    stage: feedback.stage,
    resultStatus: feedback.resultStatus,
    source: feedback.source,
    headline: feedback.headline,
    summary: feedback.summary,
    whatYouDidWell: feedback.whatYouDidWell,
    whatNeedsAttention: feedback.whatNeedsAttention,
    nextActionText: feedback.nextActionText,
    canRetry: feedback.canRetry,
    canFinishRound: feedback.canFinishRound,
    sourceStatus: feedback.debugState?.sourceStatus,
    passed: failReasons.length === 0,
    failReasons,
  };
}

function getSourceAnswer(input: DebugCase['input']): string {
  return input.learningRoundResult?.taskEvidenceReturnResult?.taskExecutionResult.studentResponse?.answerText ||
    input.taskEvidenceReturnResult?.taskExecutionResult.studentResponse?.answerText ||
    input.learningRoundExecutionResult?.taskExecutionResult?.studentResponse?.answerText ||
    input.taskExecutionResult?.studentResponse?.answerText ||
    '';
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
    strategyUsed: 'phase11_2_mock_diagnosis',
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

function buildNoPositiveEvidenceReturn(roundResult: LearningRoundResult): TaskEvidenceReturnResult {
  const result = requireTaskEvidenceReturnResult(roundResult.taskEvidenceReturnResult);
  const taskExecutionResult: TaskExecutionResult = {
    ...result.taskExecutionResult,
    studentResponse: undefined,
  };

  return {
    ...result,
    taskExecutionResult,
    abilityEvidence: result.abilityEvidence.map((evidence) => ({
      ...evidence,
      evidenceType: 'weakness',
      observation: '学生没有说明文本线索与人物心理之间的关系。',
      detail: '学生没有说明文本线索与人物心理之间的关系。',
      rootCause: '缺少从文本线索到人物心理的关系说明。',
    })),
    diagnosisResult: result.diagnosisResult
      ? {
        ...result.diagnosisResult,
        matchedRubricItems: [],
        abilityEvidence: [],
        rootCause: '缺少从文本线索到人物心理的关系说明。',
      }
      : result.diagnosisResult,
  };
}

function requireTaskExecutionResult(result?: TaskExecutionResult): TaskExecutionResult {
  if (!result) throw new Error('Expected TaskExecutionResult fixture.');
  return result;
}

function requireTaskEvidenceReturnResult(result?: TaskEvidenceReturnResult): TaskEvidenceReturnResult {
  if (!result) throw new Error('Expected TaskEvidenceReturnResult fixture.');
  return result;
}

function printReport(caseReports: CaseReport[]): void {
  console.log('Phase 11.2 Student Learning Feedback Debug Report');
  console.log('=================================================');
  console.log(`total: ${caseReports.length}`);
  console.log(`pass: ${caseReports.filter((report) => report.passed).length}`);
  console.log(`fail: ${caseReports.filter((report) => !report.passed).length}`);
  console.log('');

  for (const report of caseReports) {
    console.log(`${report.passed ? '[PASS]' : '[FAIL]'} ${report.name}`);
    console.log(`stage: ${report.stage}`);
    console.log(`resultStatus: ${report.resultStatus}`);
    console.log(`source: ${report.source}`);
    console.log(`sourceStatus: ${report.sourceStatus || 'none'}`);
    console.log(`headline: ${report.headline}`);
    console.log(`summary: ${report.summary}`);
    console.log(`whatYouDidWell: ${report.whatYouDidWell.length ? report.whatYouDidWell.join(' | ') : 'none'}`);
    console.log(`whatNeedsAttention: ${report.whatNeedsAttention.length ? report.whatNeedsAttention.join(' | ') : 'none'}`);
    console.log(`nextActionText: ${report.nextActionText}`);
    console.log(`canRetry: ${report.canRetry}`);
    console.log(`canFinishRound: ${report.canFinishRound}`);
    if (report.failReasons.length > 0) console.log(`failReasons: ${report.failReasons.join(' | ')}`);
    console.log('');
  }
}
