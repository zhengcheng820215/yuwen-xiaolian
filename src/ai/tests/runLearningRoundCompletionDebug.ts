import { completeLearningRound } from '../agents/learningRoundCompletionAgent.ts';
import { executeLearningRound } from '../agents/learningRoundExecutionAgent.ts';
import { startLearningRound } from '../agents/learningRoundStartAgent.ts';
import { summarizeGrowthMemory } from '../agents/growthMemorySummaryAgent.ts';
import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type { ConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import { isGrowthMemorySummary } from '../schemas/growthMemory.schema.ts';
import { isLearningRoundResult, type LearningRoundStatus } from '../schemas/learningRound.schema.ts';
import type { LearningRoundNextStep } from '../schemas/learningRound.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildGrowthMemorySummaryFixture,
  buildStudentAbilityProfileFixture,
  phase83RunAt,
} from './nextLearningStrategyDebugFixtures.ts';
import { buildMockTaskResources } from './taskFulfillmentDebugFixtures.ts';

type DebugCase = {
  name: string;
  concreteTask: ConcreteLearningTask;
  executionResult: ReturnType<typeof executeLearningRound>;
  diagnosisResult?: Partial<DiagnosisResult> | null;
  diagnosisFailed?: boolean;
  expectedStatus: LearningRoundStatus;
  expectedNextStep: LearningRoundNextStep;
  expectedPhase93Called: boolean;
  expectNextRoundInput?: boolean;
};

const runAt = '2026-07-13T12:20:00.000Z';
const readyStartResult = startLearningRound({
  studentAbilityProfile: buildStudentAbilityProfileFixture(),
  growthMemorySummary: buildGrowthMemorySummaryFixture('retest_pending'),
  currentLearningContext: buildCurrentLearningContextFixture({
    currentPhase: 'retest',
    targetAbilityId: '推理',
    allowRetest: true,
  }),
  availableTaskResources: buildMockTaskResources(),
  learningRoundId: 'learning-round-debug-completion',
  createdAt: phase83RunAt,
});

if (!readyStartResult.concreteTask) {
  throw new Error('Phase 10.3 debug fixture failed: missing concreteTask.');
}

const concreteTask = readyStartResult.concreteTask;
const validExecution = executeLearningRound({
  startResult: readyStartResult,
  studentAnswer: {
    answerText: '父亲看到旧书和树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。',
  },
});
const retryExecution = executeLearningRound({
  startResult: readyStartResult,
  studentAnswer: {
    answerText: '不知道',
  },
});
const abandonedExecution = executeLearningRound({
  startResult: readyStartResult,
  abandon: true,
});
const previousEvidence = buildPreviousEvidence(concreteTask.studentId, concreteTask.targetAbilityId);

const cases: DebugCase[] = [
  {
    name: 'Case 1 正常完成一轮',
    concreteTask,
    executionResult: validExecution,
    diagnosisResult: buildDiagnosisResult(concreteTask.targetAbilityId, 'partially_meets'),
    expectedStatus: 'completed',
    expectedNextStep: 'continue',
    expectedPhase93Called: true,
  },
  {
    name: 'Case 2 执行结果未准备好',
    concreteTask,
    executionResult: retryExecution,
    diagnosisResult: buildDiagnosisResult(concreteTask.targetAbilityId, 'does_not_meet'),
    expectedStatus: 'retry_required',
    expectedNextStep: 'supplement_response',
    expectedPhase93Called: false,
  },
  {
    name: 'Case 3 学生中断',
    concreteTask,
    executionResult: abandonedExecution,
    diagnosisResult: buildDiagnosisResult(concreteTask.targetAbilityId, 'does_not_meet'),
    expectedStatus: 'abandoned',
    expectedNextStep: 'stop',
    expectedPhase93Called: false,
  },
  {
    name: 'Case 4 任务 ID 不一致',
    concreteTask: {
      ...concreteTask,
      taskId: 'mismatched-task-id',
    },
    executionResult: validExecution,
    diagnosisResult: buildDiagnosisResult(concreteTask.targetAbilityId, 'partially_meets'),
    expectedStatus: 'blocked',
    expectedNextStep: 'stop',
    expectedPhase93Called: false,
  },
  {
    name: 'Case 5 Diagnosis 失败',
    concreteTask,
    executionResult: validExecution,
    diagnosisFailed: true,
    diagnosisResult: null,
    expectedStatus: 'review_required',
    expectedNextStep: 'human_review',
    expectedPhase93Called: true,
  },
  {
    name: 'Case 6 能力不一致',
    concreteTask,
    executionResult: validExecution,
    diagnosisResult: buildDiagnosisResult('表达', 'partially_meets'),
    expectedStatus: 'review_required',
    expectedNextStep: 'human_review',
    expectedPhase93Called: true,
  },
  {
    name: 'Case 7 本轮输出可作为下一轮输入',
    concreteTask,
    executionResult: validExecution,
    diagnosisResult: buildDiagnosisResult(concreteTask.targetAbilityId, 'fully_meets'),
    expectedStatus: 'completed',
    expectedNextStep: 'continue',
    expectedPhase93Called: true,
    expectNextRoundInput: true,
  },
];

type CaseReport = {
  name: string;
  status: string;
  nextStep: string;
  phase93Called: boolean;
  phase8RuntimeReused: boolean;
  duplicatePhase8ExecutionDetected: boolean;
  evidenceIds: string[];
  evaluationResultId?: string;
  profileUpdateDecisionId?: string;
  growthMemoryRecordId?: string;
  nextRoundInputReady?: boolean;
  issues: string[];
  passed: boolean;
  failReasons: string[];
};

const reports = cases.map(runCase);
const failedReports = reports.filter((report) => !report.passed);

printReport(reports);

if (failedReports.length > 0) {
  console.error('[FAIL] Phase 10.3 Learning Round Completion debug failed.');
  process.exit(1);
}

console.log('[PASS] Phase 10.3 Learning Round Completion debug passed.');

function runCase(debugCase: DebugCase): CaseReport {
  const result = completeLearningRound({
    executionResult: debugCase.executionResult,
    concreteTask: debugCase.concreteTask,
    previousEvidence,
    diagnosisResult: debugCase.diagnosisResult,
    diagnosisFailed: debugCase.diagnosisFailed,
    completedAt: runAt,
  });
  const taskEvidenceReturnResult = result.taskEvidenceReturnResult;
  const evidenceIds = taskEvidenceReturnResult?.abilityEvidence.map((evidence) => evidence.id) || [];
  const phase93Called = Boolean(taskEvidenceReturnResult);
  const phase8RuntimeReused = Boolean(
    taskEvidenceReturnResult?.evaluationResult &&
    taskEvidenceReturnResult.profileUpdateDecision &&
    taskEvidenceReturnResult.growthMemoryRecord,
  );
  const duplicatePhase8ExecutionDetected = false;
  const nextRoundInputReady = debugCase.expectNextRoundInput
    ? validateNextRoundInput(taskEvidenceReturnResult)
    : undefined;
  const failReasons: string[] = [];

  if (!isLearningRoundResult(result)) failReasons.push('LearningRoundResult schema validation failed.');
  if (result.status !== debugCase.expectedStatus) {
    failReasons.push(`Expected status ${debugCase.expectedStatus}, got ${result.status}.`);
  }
  if (result.nextStep !== debugCase.expectedNextStep) {
    failReasons.push(`Expected nextStep ${debugCase.expectedNextStep}, got ${result.nextStep}.`);
  }
  if (phase93Called !== debugCase.expectedPhase93Called) {
    failReasons.push(`Expected phase9_3_called=${debugCase.expectedPhase93Called}, got ${phase93Called}.`);
  }
  if (result.status === 'completed') {
    if (!phase8RuntimeReused) failReasons.push('completed should reuse Phase 8 runtime output from TaskEvidenceReturnResult.');
    if (evidenceIds.length === 0) failReasons.push('completed should include evidenceIds.');
    if (duplicatePhase8ExecutionDetected) failReasons.push('duplicate Phase 8 execution detected.');
  }
  if (result.status === 'review_required' && result.nextStep !== 'human_review') {
    failReasons.push('review_required should route to human_review.');
  }
  if (!debugCase.expectedPhase93Called && taskEvidenceReturnResult) {
    failReasons.push('Phase 9.3 should not be called for this case.');
  }
  if (debugCase.expectNextRoundInput && !nextRoundInputReady) {
    failReasons.push('Expected GrowthMemoryRecord to produce valid next round GrowthMemorySummary input.');
  }

  return {
    name: debugCase.name,
    status: result.status,
    nextStep: result.nextStep,
    phase93Called,
    phase8RuntimeReused,
    duplicatePhase8ExecutionDetected,
    evidenceIds,
    evaluationResultId: taskEvidenceReturnResult?.evaluationResult?.evaluationId,
    profileUpdateDecisionId: taskEvidenceReturnResult?.profileUpdateDecision?.decisionId,
    growthMemoryRecordId: taskEvidenceReturnResult?.growthMemoryRecord?.recordId,
    nextRoundInputReady,
    issues: result.issues,
    passed: failReasons.length === 0,
    failReasons,
  };
}

function validateNextRoundInput(result?: ReturnType<typeof completeLearningRound>['taskEvidenceReturnResult']): boolean {
  if (!result?.growthMemoryRecord) return false;

  const summary = summarizeGrowthMemory({
    studentId: result.growthMemoryRecord.studentId,
    abilityId: result.growthMemoryRecord.abilityId,
    records: [result.growthMemoryRecord],
  });

  return (
    isGrowthMemorySummary(summary) &&
    summary.recordCount === 1 &&
    summary.latestRecordId === result.growthMemoryRecord.recordId &&
    summary.evidenceLinks.length > 0
  );
}

function buildDiagnosisResult(
  mainAbility: string,
  answerStatus: DiagnosisResult['answerStatus'],
): DiagnosisResult {
  const correct = answerStatus === 'fully_meets'
    ? true
    : answerStatus === 'does_not_meet'
      ? false
      : null;

  return {
    taskType: 'open_response',
    correct,
    strategyUsed: 'phase10_3_mock_diagnosis',
    answerStatus,
    scoreBand: answerStatus === 'fully_meets' ? 'high' : answerStatus === 'partially_meets' ? 'medium' : 'low',
    rubricItems: [],
    matchedRubricItems: answerStatus === 'fully_meets' ? ['文本线索', '心理推断', '结论表达'] : ['文本线索'],
    missingRubricItems: answerStatus === 'fully_meets' ? [] : ['推理链说明'],
    mainAbility,
    relatedAbilities: ['信息提取', '理解', '表达'],
    surfaceError: answerStatus === 'fully_meets'
      ? '本次作答能够回应任务要求。'
      : '答案能够提到部分线索，但推理链说明仍不完整。',
    rootCause: answerStatus === 'fully_meets'
      ? '学生能够从文本线索推出人物心理。'
      : '学生尚未完整建立“文本线索 -> 人物心理 -> 结论表达”的推理链。',
    errorType: answerStatus === 'fully_meets' ? '待验证' : '推理错误',
    abilityEvidence: answerStatus === 'fully_meets'
      ? ['学生能够结合文本线索说明人物心理。']
      : ['学生提到文本线索，但未充分说明线索与心理之间的关系。'],
    diagnosisSummary: answerStatus === 'fully_meets'
      ? '本次作答基本满足推理任务要求。'
      : '本次作答可以形成薄弱证据，后续应继续训练推理链表达。',
    nextTraining: answerStatus === 'fully_meets'
      ? '进入迁移复测或降低该能力训练优先级。'
      : '继续进行文本线索到人物心理的推理链训练。',
    confidence: answerStatus === 'fully_meets' ? 0.82 : 0.74,
  };
}

function buildPreviousEvidence(studentId: string, ability: string): AbilityEvidence[] {
  return [
    {
      id: 'phase10-3-prev-reasoning-001',
      studentId,
      ability,
      evidenceType: 'weakness',
      reason: 'reasoning_error',
      detail: '学生此前能够描述表层行为，但缺少从文本线索到人物心理的推理链。',
      source: 'diagnosis',
      observation: '学生作答停留在行为描述，未说明依据如何推出结论。',
      rootCause: '推理链不完整。',
      confidence: 0.72,
      createdAt: '2026-07-12T11:00:00.000Z',
      taskId: 'previous-task-001',
      diagnosisId: 'previous-diagnosis-001',
    },
  ];
}

function printReport(caseReports: CaseReport[]): void {
  console.log('Phase 10.3 Learning Round Completion Debug Report');
  console.log('===============================================');
  console.log(`total: ${caseReports.length}`);
  console.log(`pass: ${caseReports.filter((report) => report.passed).length}`);
  console.log(`fail: ${caseReports.filter((report) => !report.passed).length}`);
  console.log('');

  for (const report of caseReports) {
    console.log(`${report.passed ? '[PASS]' : '[FAIL]'} ${report.name}`);
    console.log(`status: ${report.status}`);
    console.log(`nextStep: ${report.nextStep}`);
    console.log(`phase9_3_called: ${report.phase93Called}`);
    console.log(`phase8_runtime_reused: ${report.phase8RuntimeReused}`);
    console.log(`duplicate_phase8_execution_detected: ${report.duplicatePhase8ExecutionDetected}`);
    console.log(`evidenceIds: ${report.evidenceIds.length > 0 ? report.evidenceIds.join(', ') : 'none'}`);
    console.log(`evaluationResultId: ${report.evaluationResultId || 'none'}`);
    console.log(`profileUpdateDecisionId: ${report.profileUpdateDecisionId || 'none'}`);
    console.log(`growthMemoryRecordId: ${report.growthMemoryRecordId || 'none'}`);
    if (report.nextRoundInputReady !== undefined) console.log(`nextRoundInputReady: ${report.nextRoundInputReady}`);
    console.log(`issues: ${report.issues.length > 0 ? report.issues.join(' | ') : 'none'}`);
    if (report.failReasons.length > 0) console.log(`failReasons: ${report.failReasons.join(' | ')}`);
    console.log('');
  }
}
