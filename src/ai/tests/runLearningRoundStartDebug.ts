import { startLearningRound } from '../agents/learningRoundStartAgent.ts';
import { isLearningRoundStartResult } from '../schemas/learningRound.schema.ts';
import type { GrowthMemorySummary } from '../schemas/growthMemory.schema.ts';
import type {
  CurrentLearningContext,
  NextLearningStrategy,
} from '../schemas/nextLearningStrategy.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import type { AvailableTaskResource } from '../schemas/taskFulfillment.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildGrowthMemorySummaryFixture,
  buildStudentAbilityProfileFixture,
  phase83RunAt,
} from './nextLearningStrategyDebugFixtures.ts';
import { buildMockTaskResources } from './taskFulfillmentDebugFixtures.ts';

type DebugCase = {
  name: string;
  profile?: StudentAbilityProfile;
  growthMemory?: GrowthMemorySummary;
  context?: CurrentLearningContext;
  resources?: AvailableTaskResource[];
  strategyOverride?: NextLearningStrategy;
  simulateNoTaskFulfillment?: boolean;
  concreteTaskOverrides?: Parameters<typeof startLearningRound>[0]['concreteTaskOverrides'];
  expectedStatus: 'ready_for_execution' | 'blocked' | 'review_required';
  expectedNextAction: 'start_task_execution' | 'regenerate_strategy' | 'regenerate_task' | 'human_review' | 'stop';
};

const studentId = 'demo-student';
const targetAbility = '推理';

const baseProfile = buildStudentAbilityProfileFixture();
const baseGrowthMemory = buildGrowthMemorySummaryFixture('retest_pending');
const baseContext = buildCurrentLearningContextFixture({
  currentPhase: 'retest',
  targetAbilityId: targetAbility,
  allowRetest: true,
});
const baseResources = buildMockTaskResources();

const debugCases: DebugCase[] = [
  {
    name: 'Case 1 正常启动：生成 ready_for_execution',
    expectedStatus: 'ready_for_execution',
    expectedNextAction: 'start_task_execution',
  },
  {
    name: 'Case 2 成长记忆不足：阻断在策略生成前',
    growthMemory: buildGrowthMemorySummaryFixture('insufficient_evidence', {
      latestRecordId: undefined,
      recordCount: 0,
      evidenceLinks: [],
    }),
    expectedStatus: 'blocked',
    expectedNextAction: 'regenerate_strategy',
  },
  {
    name: 'Case 3 策略校验失败：当前上下文不允许复测',
    context: buildCurrentLearningContextFixture({
      currentPhase: 'training',
      targetAbilityId: targetAbility,
      allowRetest: false,
      allowTraining: true,
    }),
    expectedStatus: 'blocked',
    expectedNextAction: 'stop',
  },
  {
    name: 'Case 4 任务履约无可用任务：要求重新生成任务',
    simulateNoTaskFulfillment: true,
    expectedStatus: 'blocked',
    expectedNextAction: 'regenerate_task',
  },
  {
    name: 'Case 5 任务不可执行：Readiness 失败',
    concreteTaskOverrides: {
      readingText: '',
      referenceAnswer: '',
      scoringPoints: [],
      rubric: [],
      questionMetadata: {
        subject: '语文',
        grade: '初中',
        questionType: '推理',
        assessmentMode: 'reasoning_chain',
        mainAbility: '理解',
        relatedAbilities: ['信息提取'],
        abilityPath: [],
        difficulty: 'same',
        rubric: [],
      },
    },
    expectedStatus: 'blocked',
    expectedNextAction: 'regenerate_task',
  },
  {
    name: 'Case 6 studentId 不一致：进入人工复核',
    context: buildCurrentLearningContextFixture({
      studentId: 'other-student',
      currentPhase: 'retest',
      targetAbilityId: targetAbility,
    }),
    expectedStatus: 'review_required',
    expectedNextAction: 'human_review',
  },
];

type CaseReport = {
  name: string;
  status: string;
  nextAction: string;
  hasStrategy: boolean;
  hasTaskRequest: boolean;
  hasFulfillmentRequest: boolean;
  hasConcreteTask: boolean;
  readinessCanExecute?: boolean;
  issues: string[];
  passed: boolean;
  failReasons: string[];
};

const reports = debugCases.map(runCase);
const failedReports = reports.filter((report) => !report.passed);

printReport(reports);

if (failedReports.length > 0) {
  console.error('[FAIL] Phase 10.1 Learning Round Start debug failed.');
  process.exit(1);
}

console.log('[PASS] Phase 10.1 Learning Round Start debug passed.');

function runCase(debugCase: DebugCase): CaseReport {
  const result = startLearningRound({
    studentAbilityProfile: debugCase.profile || baseProfile,
    growthMemorySummary: debugCase.growthMemory || baseGrowthMemory,
    currentLearningContext: debugCase.context || baseContext,
    availableTaskResources: debugCase.resources || baseResources,
    strategyOverride: debugCase.strategyOverride,
    simulateNoTaskFulfillment: debugCase.simulateNoTaskFulfillment,
    concreteTaskOverrides: debugCase.concreteTaskOverrides,
    learningRoundId: `learning-round-debug-${debugCase.name.match(/Case \d+/)?.[0]?.replace(' ', '-').toLowerCase() || 'case'}`,
    createdAt: phase83RunAt,
  });

  const failReasons: string[] = [];

  if (!isLearningRoundStartResult(result)) failReasons.push('LearningRoundStartResult schema validation failed.');
  if (result.studentId !== studentId && debugCase.name !== 'Case 6 studentId 不一致：进入人工复核') {
    failReasons.push(`Unexpected studentId: ${result.studentId}`);
  }
  if (result.status !== debugCase.expectedStatus) {
    failReasons.push(`Expected status ${debugCase.expectedStatus}, got ${result.status}.`);
  }
  if (result.nextAction !== debugCase.expectedNextAction) {
    failReasons.push(`Expected nextAction ${debugCase.expectedNextAction}, got ${result.nextAction}.`);
  }
  if (result.status === 'ready_for_execution') {
    if (!result.nextLearningStrategy) failReasons.push('ready_for_execution should include nextLearningStrategy.');
    if (!result.taskRequest) failReasons.push('ready_for_execution should include taskRequest.');
    if (!result.taskFulfillmentRequest) failReasons.push('ready_for_execution should include taskFulfillmentRequest.');
    if (!result.concreteTask) failReasons.push('ready_for_execution should include concreteTask.');
    if (!result.taskReadinessValidation?.canExecute) failReasons.push('ready_for_execution should include executable readiness.');
  }
  if (result.status !== 'ready_for_execution' && result.issues.length === 0) {
    failReasons.push('Blocked/review result should include issues.');
  }
  if (debugCase.name.includes('策略校验失败') && result.taskRequest) {
    failReasons.push('Strategy validation failure should not create taskRequest.');
  }
  if (debugCase.name.includes('成长记忆不足') && result.nextLearningStrategy) {
    failReasons.push('Insufficient growth memory should not generate strategy.');
  }

  return {
    name: debugCase.name,
    status: result.status,
    nextAction: result.nextAction,
    hasStrategy: Boolean(result.nextLearningStrategy),
    hasTaskRequest: Boolean(result.taskRequest),
    hasFulfillmentRequest: Boolean(result.taskFulfillmentRequest),
    hasConcreteTask: Boolean(result.concreteTask),
    readinessCanExecute: result.taskReadinessValidation?.canExecute,
    issues: result.issues,
    passed: failReasons.length === 0,
    failReasons,
  };
}

function printReport(caseReports: CaseReport[]): void {
  console.log('Phase 10.1 Learning Round Start Debug Report');
  console.log('============================================');
  console.log(`total: ${caseReports.length}`);
  console.log(`pass: ${caseReports.filter((report) => report.passed).length}`);
  console.log(`fail: ${caseReports.filter((report) => !report.passed).length}`);
  console.log('');

  for (const report of caseReports) {
    console.log(`${report.passed ? '[PASS]' : '[FAIL]'} ${report.name}`);
    console.log(`status: ${report.status}`);
    console.log(`nextAction: ${report.nextAction}`);
    console.log(`hasStrategy: ${report.hasStrategy}`);
    console.log(`hasTaskRequest: ${report.hasTaskRequest}`);
    console.log(`hasFulfillmentRequest: ${report.hasFulfillmentRequest}`);
    console.log(`hasConcreteTask: ${report.hasConcreteTask}`);
    console.log(`readinessCanExecute: ${String(report.readinessCanExecute)}`);
    console.log(`issues: ${report.issues.length > 0 ? report.issues.join(' | ') : 'none'}`);
    if (report.failReasons.length > 0) console.log(`failReasons: ${report.failReasons.join(' | ')}`);
    console.log('');
  }
}
