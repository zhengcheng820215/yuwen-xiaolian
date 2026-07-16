import { scheduleDelayedRetest } from '../agents/delayedRetestSchedulingAgent.ts';
import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import {
  DELAYED_RETEST_POLICY_VERSION,
  type DelayedRetestPlan,
  type DelayedRetestSchedulingInput,
} from '../schemas/delayedRetestScheduling.schema.ts';
import type { GrowthMemorySummary } from '../schemas/growthMemory.schema.ts';
import {
  LEARNING_SESSION_HISTORY_SCHEMA_VERSION,
  type LearningSessionHistoryResult,
  type LearningSessionRecord,
} from '../schemas/learningSessionHistory.schema.ts';

type CheckResult = {
  passed: boolean;
  detail: string;
};

type CaseReport = {
  name: string;
  passed: boolean;
  details: string[];
  failReasons: string[];
};

const studentId = 'phase13-delayed-retest-student';
const targetAbilityId = '推理';
const policy = {
  policyVersion: DELAYED_RETEST_POLICY_VERSION,
  growthIntervalDays: 3,
  positiveIntervalDays: 7,
  requireNewMaterial: true as const,
  allowHint: false as const,
};

const cases: Array<{ name: string; run: () => CaseReport }> = [
  {
    name: 'Case 1 growth Evidence 满 3 天：available / create_task_request',
    run: () => {
      const evidence = buildEvidence('case1-growth', 'growth', '2026-07-01T08:00:00.000Z');
      const result = scheduleDelayedRetest(buildInput(evidence, '2026-07-04T08:00:00.000Z'));
      return report('Case 1 growth Evidence 满 3 天：available / create_task_request', [
        check(result.validation.passed, `validation=${formatIssues(result.validation.issues)}`),
        check(result.candidate.status === 'due', `candidate=${result.candidate.status}`),
        check(result.plan?.status === 'available', `plan=${result.plan?.status}`),
        check(result.nextStep === 'create_task_request', `nextStep=${result.nextStep}`),
        check(result.plan?.requestedTaskRole === 'retest', `taskRole=${result.plan?.requestedTaskRole}`),
      ]);
    },
  },
  {
    name: 'Case 2 positive Evidence 未满 7 天：pending / wait_until_due',
    run: () => {
      const evidence = buildEvidence('case2-positive', 'positive', '2026-07-01T08:00:00.000Z');
      const result = scheduleDelayedRetest(buildInput(evidence, '2026-07-06T08:00:00.000Z'));
      return report('Case 2 positive Evidence 未满 7 天：pending / wait_until_due', [
        check(result.candidate.status === 'not_due', `candidate=${result.candidate.status}`),
        check(result.plan?.status === 'pending', `plan=${result.plan?.status}`),
        check(result.nextStep === 'wait_until_due', `nextStep=${result.nextStep}`),
        check(result.plan?.plannedRetestAt === '2026-07-08T08:00:00.000Z', `planned=${result.plan?.plannedRetestAt}`),
      ]);
    },
  },
  {
    name: 'Case 3 positive Evidence 满 7 天：available',
    run: () => {
      const evidence = buildEvidence('case3-positive', 'positive', '2026-07-01T08:00:00.000Z');
      const result = scheduleDelayedRetest(buildInput(evidence, '2026-07-08T08:00:00.000Z'));
      return report('Case 3 positive Evidence 满 7 天：available', [
        check(result.candidate.status === 'due', `candidate=${result.candidate.status}`),
        check(result.plan?.status === 'available', `plan=${result.plan?.status}`),
        check(result.nextStep === 'create_task_request', `nextStep=${result.nextStep}`),
      ]);
    },
  },
  {
    name: 'Case 4 Evidence 时间较旧：只安排复测，不输出能力下降结论',
    run: () => {
      const evidence = buildEvidence('case4-old-positive', 'positive', '2026-06-01T08:00:00.000Z');
      const result = scheduleDelayedRetest(buildInput(evidence, '2026-07-16T08:00:00.000Z'));
      const candidateKeys = Object.keys(result.candidate);
      return report('Case 4 Evidence 时间较旧：只安排复测，不输出能力下降结论', [
        check(result.candidate.status === 'due', `candidate=${result.candidate.status}`),
        check(!candidateKeys.includes('abilityChange'), `candidateKeys=${candidateKeys.join(',')}`),
        check(!candidateKeys.includes('declined'), `candidateKeys=${candidateKeys.join(',')}`),
        check(result.plan?.retestGoal.includes('重新观察') === true, result.plan?.retestGoal || 'missing goal'),
      ]);
    },
  },
  {
    name: 'Case 5 只有 weakness Evidence：not_eligible',
    run: () => {
      const evidence = buildEvidence('case5-weakness', 'weakness', '2026-07-01T08:00:00.000Z');
      const result = scheduleDelayedRetest(buildInput(evidence, '2026-07-16T08:00:00.000Z'));
      return report('Case 5 只有 weakness Evidence：not_eligible', [
        check(result.validation.passed, `validation=${formatIssues(result.validation.issues)}`),
        check(result.candidate.status === 'not_eligible', `candidate=${result.candidate.status}`),
        check(result.plan === undefined, `plan=${result.plan?.planId || 'none'}`),
        check(result.nextStep === 'blocked', `nextStep=${result.nextStep}`),
      ]);
    },
  },
  {
    name: 'Case 6 只有 insufficient Evidence：not_eligible',
    run: () => {
      const evidence = buildEvidence('case6-insufficient', 'insufficient', '2026-07-01T08:00:00.000Z');
      const result = scheduleDelayedRetest(buildInput(evidence, '2026-07-16T08:00:00.000Z'));
      return report('Case 6 只有 insufficient Evidence：not_eligible', [
        check(result.candidate.status === 'not_eligible', `candidate=${result.candidate.status}`),
        check(result.plan === undefined, `plan=${result.plan?.planId || 'none'}`),
      ]);
    },
  },
  {
    name: 'Case 7 studentId / ability 不一致：blocked',
    run: () => {
      const evidence = {
        ...buildEvidence('case7-mismatch', 'growth', '2026-07-01T08:00:00.000Z'),
        ability: '表达',
      };
      const result = scheduleDelayedRetest(buildInput(evidence, '2026-07-04T08:00:00.000Z'));
      return report('Case 7 studentId / ability 不一致：blocked', [
        check(result.candidate.status === 'blocked', `candidate=${result.candidate.status}`),
        check(!result.validation.passed, `validation=${result.validation.passed}`),
        check(result.validation.issues.some((issue) => issue.includes('ability mismatch')), formatIssues(result.validation.issues)),
        check(result.plan === undefined, `plan=${result.plan?.planId || 'none'}`),
      ]);
    },
  },
  {
    name: 'Case 8 Evidence 未关联正式 Session：review_required',
    run: () => {
      const evidence = buildEvidence('case8-unlinked', 'growth', '2026-07-01T08:00:00.000Z');
      const input = buildInput(evidence, '2026-07-04T08:00:00.000Z');
      input.sessionHistory = buildHistory([], input.sessionHistory.sessions[0].sessionId);
      const result = scheduleDelayedRetest(input);
      return report('Case 8 Evidence 未关联正式 Session：review_required', [
        check(result.candidate.status === 'review_required', `candidate=${result.candidate.status}`),
        check(result.nextStep === 'review_required', `nextStep=${result.nextStep}`),
        check(result.plan === undefined, `plan=${result.plan?.planId || 'none'}`),
      ]);
    },
  },
  {
    name: 'Case 9 Session History 含 rejectedRecords：review_required',
    run: () => {
      const evidence = buildEvidence('case9-rejected-history', 'positive', '2026-07-01T08:00:00.000Z');
      const input = buildInput(evidence, '2026-07-08T08:00:00.000Z');
      input.sessionHistory = {
        ...input.sessionHistory,
        rejectedRecords: [{
          sessionId: 'rejected-session',
          studentId,
          schemaVersion: 'unsupported',
          reasons: ['Unsupported schema version.'],
          rejectedAt: '2026-07-16T08:00:00.000Z',
        }],
        rejectedTotal: 1,
        validation: { passed: false, issues: ['Unsupported schema version.'] },
      };
      const result = scheduleDelayedRetest(input);
      return report('Case 9 Session History 含 rejectedRecords：review_required', [
        check(result.candidate.status === 'review_required', `candidate=${result.candidate.status}`),
        check(result.plan === undefined, `plan=${result.plan?.planId || 'none'}`),
        check(result.validation.issues.some((issue) => issue.includes('rejected records')), formatIssues(result.validation.issues)),
      ]);
    },
  },
  {
    name: 'Case 10 重复调度：返回同一计划且不重复创建',
    run: () => {
      const evidence = buildEvidence('case10-idempotent', 'growth', '2026-07-01T08:00:00.000Z');
      const first = scheduleDelayedRetest(buildInput(evidence, '2026-07-04T08:00:00.000Z'));
      const secondInput = buildInput(evidence, '2026-07-05T08:00:00.000Z');
      secondInput.existingPlans = first.plan ? [first.plan] : [];
      const second = scheduleDelayedRetest(secondInput);
      return report('Case 10 重复调度：返回同一计划且不重复创建', [
        check(first.plan?.planId === second.plan?.planId, `first=${first.plan?.planId}, second=${second.plan?.planId}`),
        check(first.candidate.candidateId === second.candidate.candidateId, `first=${first.candidate.candidateId}, second=${second.candidate.candidateId}`),
        check(second.candidate.status === 'already_scheduled', `candidate=${second.candidate.status}`),
        check(second.nextStep === 'already_scheduled', `nextStep=${second.nextStep}`),
      ]);
    },
  },
  {
    name: 'Case 11 Evidence 时间晚于 currentTime：review_required',
    run: () => {
      const evidence = buildEvidence('case11-future', 'positive', '2026-07-10T08:00:00.000Z');
      const result = scheduleDelayedRetest(buildInput(evidence, '2026-07-09T08:00:00.000Z'));
      return report('Case 11 Evidence 时间晚于 currentTime：review_required', [
        check(result.candidate.status === 'review_required', `candidate=${result.candidate.status}`),
        check(result.plan === undefined, `plan=${result.plan?.planId || 'none'}`),
        check(result.validation.issues.some((issue) => issue.includes('after currentTime')), formatIssues(result.validation.issues)),
      ]);
    },
  },
  {
    name: 'Case 12 available Plan 只交接任务链路，不直接生成题目',
    run: () => {
      const evidence = buildEvidence('case12-no-task', 'growth', '2026-07-01T08:00:00.000Z');
      const result = scheduleDelayedRetest(buildInput(evidence, '2026-07-04T08:00:00.000Z'));
      const keys = Object.keys(result);
      return report('Case 12 available Plan 只交接任务链路，不直接生成题目', [
        check(result.plan?.status === 'available', `plan=${result.plan?.status}`),
        check(result.nextStep === 'create_task_request', `nextStep=${result.nextStep}`),
        check(!keys.includes('taskRequest'), `resultKeys=${keys.join(',')}`),
        check(!keys.includes('concreteLearningTask'), `resultKeys=${keys.join(',')}`),
      ]);
    },
  },
];

const reports = cases.map((item) => item.run());
const passed = reports.filter((item) => item.passed).length;

console.log('Phase 13.2 Delayed Retest Scheduling Debug Report');
console.log('==================================================');
for (const item of reports) {
  console.log(`\n[${item.passed ? 'PASS' : 'FAIL'}] ${item.name}`);
  for (const detail of item.details) console.log(`- ${detail}`);
  for (const reason of item.failReasons) console.log(`- FAIL: ${reason}`);
}
console.log('\nSummary');
console.log('-------');
console.log(`Cases: ${reports.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${reports.length - passed}`);
console.log(`Result: ${passed === reports.length ? 'PASS' : 'FAIL'}`);

if (passed !== reports.length) process.exitCode = 1;

function buildInput(
  evidence: AbilityEvidence,
  currentTime: string,
  existingPlans?: DelayedRetestPlan[],
): DelayedRetestSchedulingInput {
  return {
    studentId,
    targetAbilityId,
    growthMemorySummary: buildGrowthSummary(evidence.id),
    sessionHistory: buildHistory([evidence.id]),
    abilityEvidence: [evidence],
    existingPlans,
    currentTime,
    timezone: 'Asia/Shanghai',
    policy,
  };
}

function buildEvidence(
  id: string,
  evidenceType: AbilityEvidence['evidenceType'],
  createdAt: string,
): AbilityEvidence {
  return {
    id,
    studentId,
    ability: targetAbilityId,
    evidenceType,
    reason: evidenceType === 'weakness' ? 'reasoning_error' : undefined,
    detail: `用于 ${evidenceType} 调度测试的正式证据。`,
    source: evidenceType === 'growth' ? 'training' : 'retest',
    observation: `学生在目标能力上形成 ${evidenceType} 观察。`,
    confidence: 0.8,
    createdAt,
    taskId: `task-${id}`,
    diagnosisId: `diagnosis-${id}`,
  };
}

function buildGrowthSummary(evidenceId: string): GrowthMemorySummary {
  return {
    studentId,
    abilityId: targetAbilityId,
    abilityLabel: targetAbilityId,
    recordCount: 1,
    recentActions: [],
    recentTrend: 'retest_pending',
    pendingActions: ['等待延迟复测调度。'],
    evidenceLinks: [evidenceId],
    limitations: ['单条 Evidence 不代表长期掌握。'],
    summary: '目标能力已有正式观察，可根据时间规则安排延迟复测。',
  };
}

function buildHistory(
  evidenceIds: string[],
  sessionId = 'phase13-delayed-retest-session',
): LearningSessionHistoryResult {
  const session = buildSession(sessionId, evidenceIds);
  return {
    studentId,
    sessions: [session],
    total: 1,
    rejectedRecords: [],
    rejectedTotal: 0,
    latestSessionId: session.sessionId,
    latestLearningAt: session.lastActivityAt,
    validation: { passed: true, issues: [] },
  };
}

function buildSession(sessionId: string, evidenceIds: string[]): LearningSessionRecord {
  return {
    sessionId,
    studentId,
    startedAt: '2026-07-01T07:30:00.000Z',
    endedAt: '2026-07-01T08:10:00.000Z',
    lastActivityAt: '2026-07-01T08:10:00.000Z',
    timezone: 'Asia/Shanghai',
    learningRoundIds: ['phase13-delayed-retest-round'],
    persistenceRecordIds: ['phase13-delayed-retest-persistence'],
    evidenceIds,
    primaryAbilityId: targetAbilityId,
    targetAbilityIds: [targetAbilityId],
    status: 'completed',
    endReason: 'student_finished',
    roundCount: 1,
    completedRoundCount: 1,
    schemaVersion: LEARNING_SESSION_HISTORY_SCHEMA_VERSION,
    createdAt: '2026-07-01T07:30:00.000Z',
    updatedAt: '2026-07-01T08:10:00.000Z',
    validation: { passed: true, issues: [] },
  };
}

function check(passed: boolean, detail: string): CheckResult {
  return { passed, detail };
}

function report(name: string, checks: CheckResult[]): CaseReport {
  return {
    name,
    passed: checks.every((item) => item.passed),
    details: checks.map((item) => item.detail),
    failReasons: checks.filter((item) => !item.passed).map((item) => item.detail),
  };
}

function formatIssues(issues: string[]): string {
  return issues.length > 0 ? issues.join('; ') : 'none';
}
