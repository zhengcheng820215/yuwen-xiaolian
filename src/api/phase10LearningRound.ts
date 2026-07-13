import { completeLearningRound } from '../ai/agents/learningRoundCompletionAgent.ts';
import { executeLearningRound } from '../ai/agents/learningRoundExecutionAgent.ts';
import { startLearningRound } from '../ai/agents/learningRoundStartAgent.ts';
import type { DiagnosisResult } from '../ai/schemas/diagnosis.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildGrowthMemorySummaryFixture,
  buildStudentAbilityProfileFixture,
  phase83RunAt,
} from '../ai/tests/nextLearningStrategyDebugFixtures.ts';
import { buildMockTaskResources } from '../ai/tests/taskFulfillmentDebugFixtures.ts';

const DEFAULT_ANSWER =
  '父亲整理旧书、把童话书放回书架，还站在门口看了很久。可以推断他舍不得过去和孩子一起读书的回忆，也有牵挂。';

const CASES = [
  {
    id: 'normal_round',
    label: '正常学习回合',
    description: '启动学习回合，生成任务，学生提交答案，答案有效后进入 Evidence 回流。',
    defaultAnswer: DEFAULT_ANSWER,
  },
  {
    id: 'invalid_answer',
    label: '无效作答阻断',
    description: '任务可以启动，但学生答案无效，本轮不进入 Evidence 回流。',
    defaultAnswer: '5',
  },
  {
    id: 'start_blocked',
    label: '启动阶段阻断',
    description: '成长记忆不足，不能生成可信下一步策略，因此不生成具体任务。',
    defaultAnswer: DEFAULT_ANSWER,
  },
  {
    id: 'diagnosis_failed',
    label: '诊断失败复核',
    description: '作答有效，但 Diagnosis Runtime 失败，本轮进入人工复核，不写入成长结论。',
    defaultAnswer: DEFAULT_ANSWER,
  },
];

export function getPhase10LearningRoundDemoData() {
  return {
    cases: CASES,
    defaultCaseId: 'normal_round',
    defaultAnswer: DEFAULT_ANSWER,
  };
}

export function runPhase10LearningRoundDemo(caseId = 'normal_round', answerText = DEFAULT_ANSWER) {
  const caseConfig = CASES.find((item) => item.id === caseId) || CASES[0];
  const startResult = buildStartResult(caseConfig.id);
  const canExecute = startResult.status === 'ready_for_execution';
  const executionResult = canExecute
    ? executeLearningRound({
      startResult,
      studentAnswer: {
        answerText,
        usedHint: false,
        hintCount: 0,
      },
    })
    : null;
  const completionResult = executionResult && startResult.concreteTask
    ? completeLearningRound({
      executionResult,
      concreteTask: startResult.concreteTask,
      diagnosisResult: buildDiagnosisResult(startResult.concreteTask.targetAbilityId),
      diagnosisFailed: caseConfig.id === 'diagnosis_failed',
      completedAt: '2026-07-13T13:20:00.000Z',
    })
    : null;

  return {
    caseConfig,
    startResult,
    executionResult,
    completionResult,
    display: buildDisplay({
      startResult,
      executionResult,
      completionResult,
      caseId: caseConfig.id,
    }),
  };
}

function buildStartResult(caseId: string) {
  const growthMemorySummary = caseId === 'start_blocked'
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
    learningRoundId: `phase10-demo-${caseId}`,
    createdAt: phase83RunAt,
  });
}

function buildDiagnosisResult(mainAbility: string): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: null,
    strategyUsed: 'phase10_demo_mock_diagnosis',
    answerStatus: 'partially_meets',
    scoreBand: 'medium',
    rubricItems: [],
    matchedRubricItems: ['文本线索', '结论表达'],
    missingRubricItems: ['推理链说明'],
    mainAbility,
    relatedAbilities: ['信息提取', '理解', '表达'],
    surfaceError: '答案能提到文本线索和人物心理，但依据与结论之间的说明还不够完整。',
    rootCause: '推理链仍需继续验证和训练。',
    errorType: 'reasoning_chain_incomplete',
    abilityEvidence: [
      '学生能够找到部分文本线索，但还需要更完整说明线索如何支持结论。',
    ],
    diagnosisSummary: '本次作答可以形成一条推理相关的 Ability Evidence。',
    nextTraining: '继续围绕文本依据与推理链表达进行训练或复测。',
    confidence: 0.76,
  };
}

function buildDisplay(input: {
  startResult: ReturnType<typeof startLearningRound>;
  executionResult: ReturnType<typeof executeLearningRound> | null;
  completionResult: ReturnType<typeof completeLearningRound> | null;
  caseId: string;
}) {
  const evidenceReturn = input.completionResult?.taskEvidenceReturnResult;
  const canEnterEvidenceReturn = Boolean(input.executionResult?.canEnterEvidenceReturn);
  const evidenceReturned = evidenceReturn?.status === 'evidence_returned';

  return {
    roundStatus: formatRoundStatus(input.completionResult?.status, input.executionResult?.status, input.startResult.status),
    startStatus: formatStartStatus(input.startResult.status),
    executionStatus: input.executionResult
      ? formatExecutionStatus(input.executionResult.status)
      : '未进入执行',
    responseValidity: input.executionResult?.responseValidityResult
      ? formatValidity(input.executionResult.responseValidityResult.status)
      : '暂无',
    canEnterEvidenceReturn: canEnterEvidenceReturn ? '可以进入 Evidence 回流' : '不能进入 Evidence 回流',
    evidenceReturnStatus: evidenceReturn ? formatEvidenceReturnStatus(evidenceReturn.status) : '未发生',
    diagnosisStatus: formatDiagnosisStatus(evidenceReturn?.diagnosisResult?.answerStatus),
    diagnosisGap: buildDiagnosisGap(evidenceReturn?.diagnosisResult),
    nextStep: input.completionResult ? formatNextStep(input.completionResult.nextStep) : formatStartNextAction(input.startResult.nextAction),
    nextStepReason: buildNextStepReason(input),
    taskTitle: input.startResult.concreteTask?.question || '未生成任务',
    validationGoal: input.startResult.concreteTask?.validationGoal || input.startResult.nextLearningStrategy?.validationGoal || '暂无',
    targetAbility: '推理',
    strategyAction: input.startResult.nextLearningStrategy?.action || '未生成',
    taskRole: input.startResult.concreteTask?.taskRole || input.startResult.taskRequest?.taskRole || '暂无',
    evidenceCount: evidenceReturn?.abilityEvidence.length || 0,
    evaluationResultId: evidenceReturn?.evaluationResult?.evaluationId || '暂无',
    profileUpdateDecisionId: evidenceReturn?.profileUpdateDecision?.decisionId || '暂无',
    growthMemoryRecordId: evidenceReturn?.growthMemoryRecord?.recordId || '暂无',
    issues: collectIssues(input),
    acceptance: [
      input.startResult.status === 'ready_for_execution'
        ? '学习回合可以启动，并生成可执行任务。'
        : '启动阶段被阻断，没有强行生成任务。',
      input.executionResult
        ? '学生答案已经经过有效性检查。'
        : '未进入学生作答执行。',
      canEnterEvidenceReturn
        ? '有效答案可以进入 Evidence 回流。'
        : '无效或异常结果不会进入 Evidence 回流。',
      evidenceReturned
        ? '本轮流程已完成，并生成 AbilityEvidence、EvaluationResult、ProfileUpdateDecision 和 GrowthMemoryRecord。'
        : '本轮没有生成长期能力结论。',
    ],
  };
}

function buildNextStepReason(input: {
  startResult: ReturnType<typeof startLearningRound>;
  executionResult: ReturnType<typeof executeLearningRound> | null;
  completionResult: ReturnType<typeof completeLearningRound> | null;
  caseId: string;
}) {
  if (input.caseId === 'start_blocked') {
    return '成长记忆证据不足，系统应先补足可追溯证据，而不是直接安排任务。';
  }
  if (input.executionResult?.status === 'retry_required') {
    return '作答没有达到最低可诊断条件，需要学生补充有效答案。';
  }
  if (input.completionResult?.status === 'completed') {
    return '本轮流程已完成证据回流；这不等于答案完全正确，也不等于能力已经提升。下一轮应由新的 GrowthMemorySummary 重新进入 Phase 8.3 决定。';
  }
  if (input.completionResult?.status === 'review_required') {
    return '本轮出现诊断失败或结构不一致，需要人工复核，不自动更新长期结论。';
  }
  return '当前回合尚未满足继续推进条件。';
}

function collectIssues(input: {
  startResult: ReturnType<typeof startLearningRound>;
  executionResult: ReturnType<typeof executeLearningRound> | null;
  completionResult: ReturnType<typeof completeLearningRound> | null;
}) {
  const issues = [
    ...input.startResult.issues,
    ...(input.executionResult?.issues || []),
    ...(input.completionResult?.issues || []),
  ];

  return issues.length > 0 ? issues : ['暂无阻断问题'];
}

function formatStartStatus(status: string) {
  const labels = {
    ready_for_execution: '可执行',
    blocked: '已阻断',
    review_required: '需要复核',
  };

  return labels[status] || status;
}

function formatExecutionStatus(status?: string) {
  const labels = {
    evidence_return_ready: '作答有效，可回流证据',
    retry_required: '需要补充作答',
    blocked: '执行阻断',
    review_required: '需要复核',
    abandoned: '已中断',
  };

  return labels[status || ''] || status || '暂无';
}

function formatRoundStatus(roundStatus?: string, executionStatus?: string, startStatus?: string) {
  if (roundStatus) {
    const labels = {
      completed: '本轮流程完成',
      blocked: '本轮阻断',
      retry_required: '需要补充作答',
      review_required: '需要人工复核',
      abandoned: '本轮中断',
    };
    return labels[roundStatus] || roundStatus;
  }

  if (executionStatus) return formatExecutionStatus(executionStatus);
  return formatStartStatus(startStatus || '');
}

function formatDiagnosisStatus(status?: string) {
  const labels = {
    fully_meets: '答案基本满足',
    partially_meets: '答案部分满足',
    does_not_meet: '答案未满足',
    cannot_assess: '暂无法判断',
  };

  return labels[status || ''] || '暂无诊断结果';
}

function buildDiagnosisGap(diagnosisResult?: DiagnosisResult) {
  if (!diagnosisResult) return '暂无';
  if (diagnosisResult.answerStatus === 'fully_meets') {
    return '本次答案基本回应任务要求，但仍需后续独立复测确认稳定性。';
  }
  if (diagnosisResult.answerStatus === 'partially_meets') {
    return diagnosisResult.surfaceError || '答案可诊断，但仍缺少关键依据、推理过程或完整说明。';
  }
  if (diagnosisResult.answerStatus === 'does_not_meet') {
    return diagnosisResult.surfaceError || '答案没有满足本题核心要求。';
  }
  return '当前答案不足以形成具体能力判断。';
}

function formatValidity(status: string) {
  const labels = {
    valid: '有效作答',
    empty: '空答案',
    placeholder: '无效或占位回答',
    irrelevant: '无关回答',
    insufficient: '证据不足',
  };

  return labels[status] || status;
}

function formatEvidenceReturnStatus(status: string) {
  const labels = {
    blocked_invalid_execution: '执行结果无效，已阻断',
    diagnosis_failed: '诊断失败，需复核',
    review_required: '需要人工复核',
    evidence_returned: '已完成 Evidence 回流',
  };

  return labels[status] || status;
}

function formatNextStep(step: string) {
  const labels = {
    continue: '进入下一轮策略判断',
    supplement_response: '补充有效作答',
    regenerate_task: '重新生成任务',
    human_review: '人工复核',
    stop: '停止本轮',
  };

  return labels[step] || step;
}

function formatStartNextAction(action: string) {
  const labels = {
    start_task_execution: '开始任务执行',
    regenerate_strategy: '重新生成策略',
    regenerate_task: '重新生成任务',
    human_review: '人工复核',
    stop: '停止',
  };

  return labels[action] || action;
}
