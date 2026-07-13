import { executeLearningRound } from '../agents/learningRoundExecutionAgent.ts';
import { startLearningRound } from '../agents/learningRoundStartAgent.ts';
import type { LearningRoundExecutionStatus } from '../schemas/learningRound.schema.ts';
import { isLearningRoundExecutionResult } from '../schemas/learningRound.schema.ts';
import type { ResponseValidityStatus } from '../schemas/taskExecution.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildGrowthMemorySummaryFixture,
  buildStudentAbilityProfileFixture,
  phase83RunAt,
} from './nextLearningStrategyDebugFixtures.ts';
import { buildMockTaskResources } from './taskFulfillmentDebugFixtures.ts';

type DebugCase = {
  name: string;
  startReady: boolean;
  answerText?: string;
  responseOverrides?: Parameters<typeof executeLearningRound>[0]['responseOverrides'];
  abandon?: boolean;
  expectedStatus: LearningRoundExecutionStatus;
  expectedValidity?: ResponseValidityStatus;
  expectedCanEnterEvidenceReturn: boolean;
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
  learningRoundId: 'learning-round-debug-ready',
  createdAt: phase83RunAt,
});

const blockedStartResult = startLearningRound({
  studentAbilityProfile: buildStudentAbilityProfileFixture(),
  growthMemorySummary: buildGrowthMemorySummaryFixture('insufficient_evidence', {
    latestRecordId: undefined,
    recordCount: 0,
    evidenceLinks: [],
  }),
  currentLearningContext: buildCurrentLearningContextFixture({
    currentPhase: 'retest',
    targetAbilityId: '推理',
  }),
  availableTaskResources: buildMockTaskResources(),
  learningRoundId: 'learning-round-debug-blocked',
  createdAt: phase83RunAt,
});

const debugCases: DebugCase[] = [
  {
    name: 'Case 1 正常执行：有效作答进入 Evidence Return',
    startReady: true,
    answerText: '父亲看到旧书和树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。',
    expectedStatus: 'evidence_return_ready',
    expectedValidity: 'valid',
    expectedCanEnterEvidenceReturn: true,
  },
  {
    name: 'Case 2 启动结果未 ready：阻断执行',
    startReady: false,
    answerText: '父亲很怀念过去。',
    expectedStatus: 'blocked',
    expectedCanEnterEvidenceReturn: false,
  },
  {
    name: 'Case 3 空答案：要求补充作答',
    startReady: true,
    answerText: '',
    expectedStatus: 'retry_required',
    expectedValidity: 'empty',
    expectedCanEnterEvidenceReturn: false,
  },
  {
    name: 'Case 4 占位回答：要求补充作答',
    startReady: true,
    answerText: '不知道',
    expectedStatus: 'retry_required',
    expectedValidity: 'placeholder',
    expectedCanEnterEvidenceReturn: false,
  },
  {
    name: 'Case 5 ID 不一致：进入人工复核',
    startReady: true,
    answerText: '父亲舍不得和孩子一起读书的回忆。',
    responseOverrides: {
      studentId: 'wrong-student',
    },
    expectedStatus: 'review_required',
    expectedValidity: 'insufficient',
    expectedCanEnterEvidenceReturn: false,
  },
  {
    name: 'Case 6 学生中断：回合执行 abandoned',
    startReady: true,
    abandon: true,
    expectedStatus: 'abandoned',
    expectedCanEnterEvidenceReturn: false,
  },
];

type CaseReport = {
  name: string;
  startStatus: string;
  finalStatus: string;
  validityStatus?: string;
  executionStatus?: string;
  canEnterEvidenceReturn: boolean;
  nextAction: string;
  issues: string[];
  passed: boolean;
  failReasons: string[];
};

const reports = debugCases.map(runCase);
const failedReports = reports.filter((report) => !report.passed);

printReport(reports);

if (failedReports.length > 0) {
  console.error('[FAIL] Phase 10.2 Learning Round Execution debug failed.');
  process.exit(1);
}

console.log('[PASS] Phase 10.2 Learning Round Execution debug passed.');

function runCase(debugCase: DebugCase): CaseReport {
  const startResult = debugCase.startReady ? readyStartResult : blockedStartResult;
  const result = executeLearningRound({
    startResult,
    studentAnswer: debugCase.answerText === undefined
      ? undefined
      : {
        answerText: debugCase.answerText,
        usedHint: false,
        hintCount: 0,
      },
    responseOverrides: debugCase.responseOverrides,
    abandon: debugCase.abandon,
  });
  const failReasons: string[] = [];

  if (!isLearningRoundExecutionResult(result)) {
    failReasons.push('LearningRoundExecutionResult schema validation failed.');
  }
  if (result.learningRoundId !== startResult.learningRoundId) {
    failReasons.push('learningRoundId was not preserved.');
  }
  if (result.status !== debugCase.expectedStatus) {
    failReasons.push(`Expected status ${debugCase.expectedStatus}, got ${result.status}.`);
  }
  if (result.canEnterEvidenceReturn !== debugCase.expectedCanEnterEvidenceReturn) {
    failReasons.push(`Expected canEnterEvidenceReturn=${debugCase.expectedCanEnterEvidenceReturn}, got ${result.canEnterEvidenceReturn}.`);
  }
  if (debugCase.expectedValidity && result.responseValidityResult?.status !== debugCase.expectedValidity) {
    failReasons.push(`Expected validity ${debugCase.expectedValidity}, got ${result.responseValidityResult?.status}.`);
  }
  if (result.status === 'evidence_return_ready') {
    if (result.nextAction !== 'enter_evidence_return') failReasons.push('evidence_return_ready should enter evidence return.');
    if (!result.taskExecutionResult?.canEnterDiagnosisRuntime) failReasons.push('ready result should be able to enter Diagnosis Runtime.');
  }
  if (result.status !== 'evidence_return_ready' && result.canEnterEvidenceReturn) {
    failReasons.push('Non-ready result must not enter evidence return.');
  }
  if (result.status !== 'evidence_return_ready' && result.issues.length === 0) {
    failReasons.push('Non-ready result should include issues.');
  }
  if (debugCase.name.includes('启动结果未 ready') && result.taskExecutionResult) {
    failReasons.push('Blocked start result should not create TaskExecutionResult.');
  }

  return {
    name: debugCase.name,
    startStatus: startResult.status,
    finalStatus: result.status,
    validityStatus: result.responseValidityResult?.status,
    executionStatus: result.taskExecutionResult?.status,
    canEnterEvidenceReturn: result.canEnterEvidenceReturn,
    nextAction: result.nextAction,
    issues: result.issues,
    passed: failReasons.length === 0,
    failReasons,
  };
}

function printReport(caseReports: CaseReport[]): void {
  console.log('Phase 10.2 Learning Round Execution Debug Report');
  console.log('==============================================');
  console.log(`total: ${caseReports.length}`);
  console.log(`pass: ${caseReports.filter((report) => report.passed).length}`);
  console.log(`fail: ${caseReports.filter((report) => !report.passed).length}`);
  console.log('');

  for (const report of caseReports) {
    console.log(`${report.passed ? '[PASS]' : '[FAIL]'} ${report.name}`);
    console.log(`startStatus: ${report.startStatus}`);
    console.log(`finalStatus: ${report.finalStatus}`);
    console.log(`validityStatus: ${report.validityStatus || 'none'}`);
    console.log(`executionStatus: ${report.executionStatus || 'none'}`);
    console.log(`canEnterEvidenceReturn: ${report.canEnterEvidenceReturn}`);
    console.log(`nextAction: ${report.nextAction}`);
    console.log(`issues: ${report.issues.length > 0 ? report.issues.join(' | ') : 'none'}`);
    if (report.failReasons.length > 0) console.log(`failReasons: ${report.failReasons.join(' | ')}`);
    console.log('');
  }
}
