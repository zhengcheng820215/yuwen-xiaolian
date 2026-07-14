import { buildStudentLearningEntryState } from '../ai/agents/studentLearningEntryAgent.ts';
import { buildStudentLearningFeedback } from '../ai/agents/studentFeedbackAdapter.ts';
import { buildStudentRoundSummary } from '../ai/agents/studentRoundSummaryAdapter.ts';
import {
  restoreLatestLearningState,
  saveLearningPersistenceRecord,
} from '../ai/agents/learningPersistenceAgent.ts';
import { completeLearningRound } from '../ai/agents/learningRoundCompletionAgent.ts';
import { executeLearningRound } from '../ai/agents/learningRoundExecutionAgent.ts';
import { startLearningRound } from '../ai/agents/learningRoundStartAgent.ts';
import { IndexedDBLearningPersistenceRepository } from '../ai/repositories/indexedDBLearningPersistenceRepository.ts';
import type { DiagnosisResult } from '../ai/schemas/diagnosis.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildGrowthMemorySummaryFixture,
  buildStudentAbilityProfileFixture,
  phase83RunAt,
} from '../ai/tests/nextLearningStrategyDebugFixtures.ts';
import { buildMockTaskResources } from '../ai/tests/taskFulfillmentDebugFixtures.ts';

const CASES = [
  {
    id: 'ready',
    label: '正常进入学习',
    description: '学习回合可以启动，并展示完整任务。',
    defaultAnswer: '',
  },
  {
    id: 'blocked',
    label: '启动阻断',
    description: '成长记忆不足时，不展示残缺任务。',
    defaultAnswer: '',
  },
  {
    id: 'readiness_failed',
    label: '任务未准备完整',
    description: 'readiness 失败时不允许进入作答。',
    defaultAnswer: '',
  },
];
const DEMO_STUDENT_ID = 'demo-student';
const persistenceRepository = new IndexedDBLearningPersistenceRepository();

export function getStudentLearningEntryDemoData() {
  return {
    cases: CASES,
    defaultCaseId: 'ready',
  };
}

export function runStudentLearningEntryDemo(caseId = 'ready', answerDraft = '') {
  const selectedCase = CASES.find((item) => item.id === caseId) || CASES[0];
  const startResult = buildStartResult(selectedCase.id);
  const entryState = buildStudentLearningEntryState({
    startResult,
    answerDraft,
  });

  return {
    selectedCase,
    startResult,
    entryState,
  };
}

export function runStudentLearningFeedbackDemo(caseId = 'ready', answerDraft = '') {
  const entryResult = runStudentLearningEntryDemo(caseId, answerDraft);
  const { startResult, entryState } = entryResult;

  if (!entryState.canAnswer) {
    const learningRoundResult = {
      learningRoundId: startResult.learningRoundId,
      studentId: startResult.studentId,
      status: 'blocked',
      startResult,
      executionResult: {
        learningRoundId: startResult.learningRoundId,
        studentId: startResult.studentId,
        status: 'blocked',
        startResult,
        canEnterEvidenceReturn: false,
        nextAction: 'stop',
        issues: startResult.issues.length ? startResult.issues : ['本轮任务未准备完整。'],
      },
      nextStep: 'stop',
      nextStepReason: '本轮任务未准备完整，暂时不能提交。',
      issues: startResult.issues.length ? startResult.issues : ['本轮任务未准备完整。'],
    } as const;
    const feedback = buildStudentLearningFeedback({
      entryState,
      learningRoundResult,
    });

    return {
      ...entryResult,
      executionResult: null,
      learningRoundResult,
      feedback,
    };
  }

  const executionResult = executeLearningRound({
    startResult,
    studentAnswer: {
      answerText: answerDraft,
      usedHint: false,
      hintCount: 0,
    },
  });

  if (executionResult.status !== 'evidence_return_ready') {
    const learningRoundResult = completeLearningRound({
      executionResult,
      concreteTask: startResult.concreteTask!,
      completedAt: '2026-07-14T11:20:00.000Z',
    });
    const feedback = buildStudentLearningFeedback({
      entryState,
      learningRoundResult,
      learningRoundExecutionResult: executionResult,
      taskExecutionResult: executionResult.taskExecutionResult,
    });

    return {
      ...entryResult,
      executionResult,
      learningRoundResult,
      feedback,
    };
  }

  const learningRoundResult = completeLearningRound({
    executionResult,
    concreteTask: startResult.concreteTask!,
    diagnosisResult: buildFeedbackDiagnosisResult(answerDraft, startResult.concreteTask!.targetAbilityId),
    completedAt: '2026-07-14T11:20:00.000Z',
  });
  const feedback = buildStudentLearningFeedback({
    entryState,
    taskExecutionResult: executionResult.taskExecutionResult,
    learningRoundExecutionResult: executionResult,
    taskEvidenceReturnResult: learningRoundResult.taskEvidenceReturnResult,
    learningRoundResult,
  });

  return {
    ...entryResult,
    executionResult,
    learningRoundResult,
    feedback,
  };
}

export function runStudentRoundSummaryDemo(caseId = 'ready', answerDraft = '') {
  const feedbackResult = runStudentLearningFeedbackDemo(caseId, answerDraft);

  if (!feedbackResult.learningRoundResult) {
    return {
      ...feedbackResult,
      roundSummary: null,
    };
  }

  const roundSummary = buildStudentRoundSummary({
    learningRoundResult: feedbackResult.learningRoundResult,
    studentLearningFeedback: feedbackResult.feedback,
    studentLearningEntryState: feedbackResult.entryState,
  });

  return {
    ...feedbackResult,
    roundSummary,
  };
}

export async function saveStudentLearningPersistenceDemo(input: {
  caseId?: string;
  answerDraft?: string;
  feedbackResult?: ReturnType<typeof runStudentLearningFeedbackDemo> | null;
  roundSummaryResult?: ReturnType<typeof runStudentRoundSummaryDemo> | null;
}) {
  const caseId = input.caseId || 'ready';
  const answerDraft = input.answerDraft || '';
  const entryResult = runStudentLearningEntryDemo(caseId, answerDraft);
  const learningRoundId = entryResult.startResult.learningRoundId;
  const completedRoundSummary = input.roundSummaryResult?.roundSummary;
  const completedRoundResult = input.roundSummaryResult?.learningRoundResult;
  const completedFeedback = input.roundSummaryResult?.feedback;

  return saveLearningPersistenceRecord(persistenceRepository, {
    studentId: DEMO_STUDENT_ID,
    learningRoundId,
    concreteTask: entryResult.startResult.concreteTask,
    answerDraft,
    studentResponse: input.feedbackResult?.executionResult?.taskExecutionResult?.studentResponse,
    studentLearningFeedback: completedFeedback,
    studentRoundSummary: completedRoundSummary,
    learningRoundResult: completedRoundSummary ? completedRoundResult : undefined,
    growthMemorySummary: completedRoundSummary
      ? entryResult.startResult.growthMemorySummary
      : undefined,
    studentAbilityProfile: entryResult.startResult.studentAbilityProfile,
  });
}

export async function restoreStudentLearningPersistenceDemo() {
  return restoreLatestLearningState(persistenceRepository, DEMO_STUDENT_ID);
}

export async function clearStudentLearningPersistenceDemo() {
  await persistenceRepository.clear(DEMO_STUDENT_ID);
}

function buildStartResult(caseId: string) {
  const growthMemorySummary = caseId === 'blocked'
    ? buildGrowthMemorySummaryFixture('insufficient_evidence', {
      latestRecordId: undefined,
      recordCount: 0,
      evidenceLinks: [],
    })
    : buildGrowthMemorySummaryFixture('retest_pending');

  return startLearningRound({
    studentAbilityProfile: buildStudentAbilityProfileFixture(),
    growthMemorySummary,
    currentLearningContext: buildCurrentLearningContextFixture({
      currentPhase: 'retest',
      targetAbilityId: growthMemorySummary.abilityId,
      allowRetest: true,
    }),
    availableTaskResources: buildMockTaskResources(),
    learningRoundId: `phase11-entry-demo-${caseId}`,
    createdAt: phase83RunAt,
    concreteTaskOverrides: caseId === 'readiness_failed'
      ? {
        readingText: '',
      }
      : undefined,
  });
}

function buildFeedbackDiagnosisResult(answerDraft: string, mainAbility: string): DiagnosisResult {
  const normalizedAnswer = answerDraft.replace(/\s+/g, '');
  const hasTextClue = /旧书|树叶|停了很久|文中|看到/.test(normalizedAnswer);
  const hasMentalInference = /不舍|怀念|牵挂|想起|回忆|心理|舍不得/.test(normalizedAnswer);
  const fullyMeets = hasTextClue && hasMentalInference;
  const partiallyMeets = hasTextClue || hasMentalInference;
  const answerStatus = fullyMeets
    ? 'fully_meets'
    : partiallyMeets
      ? 'partially_meets'
      : 'does_not_meet';

  return {
    taskType: 'open_response',
    correct: fullyMeets ? true : false,
    strategyUsed: 'phase11_2_demo_mock_diagnosis',
    answerStatus,
    scoreBand: fullyMeets ? 'high' : partiallyMeets ? 'medium' : 'low',
    rubricItems: [],
    matchedRubricItems: [
      ...(hasTextClue ? ['文本线索'] : []),
      ...(hasMentalInference ? ['心理推断'] : []),
    ],
    missingRubricItems: [
      ...(!hasTextClue ? ['文本线索'] : []),
      ...(!hasMentalInference ? ['心理推断'] : []),
    ],
    mainAbility,
    relatedAbilities: ['信息提取', '理解', '表达'],
    surfaceError: fullyMeets
      ? '本次作答能够回应任务要求。'
      : '答案仍需要更清楚地连接文本线索与人物心理。',
    rootCause: fullyMeets
      ? '学生能够从文本线索推出人物心理。'
      : '学生尚未完整建立“文本线索 -> 人物心理 -> 结论表达”的推理链。',
    errorType: fullyMeets ? '待验证' : '推理错误',
    abilityEvidence: fullyMeets
      ? ['学生能够结合文本线索说明人物心理。']
      : ['学生需要补充文本线索与心理之间的关系说明。'],
    diagnosisSummary: fullyMeets
      ? '本次作答基本满足推理任务要求。'
      : '本次作答可以形成继续练习的依据，重点是把文本线索和心理判断连接起来。',
    nextTraining: fullyMeets
      ? '进入本轮结果页，等待下一步学习安排。'
      : '继续练习“文本线索 -> 人物心理 -> 结论表达”。',
    confidence: fullyMeets ? 0.82 : partiallyMeets ? 0.72 : 0.64,
  };
}
