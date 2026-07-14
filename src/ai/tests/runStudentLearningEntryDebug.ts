import { buildStudentLearningEntryState } from '../agents/studentLearningEntryAgent.ts';
import { isStudentLearningEntryState } from '../schemas/studentLearningEntry.schema.ts';
import { startLearningRound } from '../agents/learningRoundStartAgent.ts';
import {
  buildCurrentLearningContextFixture,
  buildGrowthMemorySummaryFixture,
  buildStudentAbilityProfileFixture,
  phase83RunAt,
} from './nextLearningStrategyDebugFixtures.ts';
import { buildMockTaskResources } from './taskFulfillmentDebugFixtures.ts';

type DebugCase = {
  id: string;
  title: string;
  startResult: ReturnType<typeof startLearningRound>;
  answerDraft: string;
  expectedStatus: string;
  expectedCanAnswer: boolean;
  expectedCanSubmit: boolean;
};

const cases: DebugCase[] = [
  {
    id: 'ready_empty_answer',
    title: '任务已准备好，但空答案不能提交',
    startResult: buildStartResult('ready_empty_answer'),
    answerDraft: '',
    expectedStatus: 'ready_to_answer',
    expectedCanAnswer: true,
    expectedCanSubmit: false,
  },
  {
    id: 'ready_with_answer',
    title: '任务已准备好，答案草稿满足最低提交条件',
    startResult: buildStartResult('ready_with_answer'),
    answerDraft: '父亲舍不得这些旧书，也想起和孩子一起读书的时光。',
    expectedStatus: 'ready_to_answer',
    expectedCanAnswer: true,
    expectedCanSubmit: true,
  },
  {
    id: 'start_blocked',
    title: '启动阶段阻断时不展示可作答状态',
    startResult: buildStartResult('start_blocked'),
    answerDraft: '我想回答。',
    expectedStatus: 'retry_required',
    expectedCanAnswer: false,
    expectedCanSubmit: false,
  },
  {
    id: 'readiness_blocked',
    title: 'readiness 失败时不展示残缺任务',
    startResult: buildStartResult('readiness_blocked'),
    answerDraft: '我想回答。',
    expectedStatus: 'retry_required',
    expectedCanAnswer: false,
    expectedCanSubmit: false,
  },
];

const reports = cases.map((item) => {
  const state = buildStudentLearningEntryState({
    startResult: item.startResult,
    answerDraft: item.answerDraft,
  });
  const issues = validateCase(item, state);

  return {
    id: item.id,
    title: item.title,
    status: issues.length === 0 ? 'PASS' : 'FAIL',
    issues,
    state,
  };
});

console.log('Phase 11.1 Student Learning Entry Debug Report');
console.log('================================================');

for (const report of reports) {
  console.log(`\n[${report.status}] ${report.id}`);
  console.log(`title: ${report.title}`);
  console.log(`studentId: ${report.state.studentId}`);
  console.log(`learningRoundId: ${report.state.learningRoundId}`);
  console.log(`entryStatus: ${report.state.status}`);
  console.log(`viewStatus: ${report.state.viewStatus}`);
  console.log(`taskTitle: ${report.state.taskTitle}`);
  console.log(`questionText: ${report.state.questionText}`);
  console.log(`answerRequirements: ${report.state.answerRequirements.join(' / ')}`);
  console.log(`studentRoundFocus: ${report.state.studentRoundFocus.title} - ${report.state.studentRoundFocus.description}`);
  console.log(`canAnswer: ${report.state.canAnswer}`);
  console.log(`canSubmit: ${report.state.canSubmit}`);
  console.log(`message: ${report.state.message}`);
  console.log(`debugState: ${JSON.stringify(report.state.debugState)}`);

  if (report.issues.length > 0) {
    console.log(`issues: ${report.issues.join('; ')}`);
  }
}

const failed = reports.filter((item) => item.status === 'FAIL');
console.log('\nSummary');
console.log('-------');
console.log(`total: ${reports.length}`);
console.log(`PASS: ${reports.length - failed.length}`);
console.log(`FAIL: ${failed.length}`);

if (failed.length > 0) {
  throw new Error('Phase 11.1 Student Learning Entry debug failed.');
}

console.log('\n[PASS] Phase 11.1 Student Learning Entry debug passed.');

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
    learningRoundId: `phase11-entry-${caseId}`,
    createdAt: phase83RunAt,
    concreteTaskOverrides: caseId === 'readiness_blocked'
      ? {
        answerRequirements: [],
      }
      : undefined,
  });
}

function validateCase(
  item: DebugCase,
  state: ReturnType<typeof buildStudentLearningEntryState>,
): string[] {
  const issues: string[] = [];

  if (!isStudentLearningEntryState(state)) {
    issues.push('StudentLearningEntryState schema validation failed.');
  }
  if (state.status !== item.expectedStatus) {
    issues.push(`Expected status ${item.expectedStatus}, got ${state.status}.`);
  }
  if (state.canAnswer !== item.expectedCanAnswer) {
    issues.push(`Expected canAnswer ${item.expectedCanAnswer}, got ${state.canAnswer}.`);
  }
  if (state.canSubmit !== item.expectedCanSubmit) {
    issues.push(`Expected canSubmit ${item.expectedCanSubmit}, got ${state.canSubmit}.`);
  }
  if (item.expectedCanAnswer && state.answerRequirements.length === 0) {
    issues.push('Ready entry must preserve answerRequirements.');
  }
  if (item.expectedCanAnswer && state.debugState && 'learningRoundStartResult' in state.debugState) {
    issues.push('debugState must not contain full Runtime objects.');
  }
  if (item.expectedCanAnswer && !state.taskTitle.includes('推理')) {
    issues.push('taskTitle should be based on ability label and task role.');
  }
  if (!item.expectedCanAnswer && state.questionText !== '当前任务暂时无法展示，请稍后重试。') {
    issues.push('Non executable task must not expose stale question content.');
  }

  return issues;
}
