import {
  buildPhase163MultiDayAcceptance,
  createPhase163MultiDayRun,
  recordPhase163DailyOperation,
} from '../ai/agents/phase163MultiDayOperationAgent.ts';
import {
  appendLearningRoundToSession,
  closeLearningSessionRecord,
  createLearningSessionRecord,
  queryLearningSessionHistory,
  saveLearningSessionRecord,
} from '../ai/agents/learningSessionHistoryAgent.ts';
import { runPhase163RealLearningChain } from '../ai/agents/phase163RealLearningChainAgent.ts';
import { scheduleDelayedRetest } from '../ai/agents/delayedRetestSchedulingAgent.ts';
import { InMemoryLearningSessionRepository } from '../ai/repositories/inMemoryLearningSessionRepository.ts';
import { InMemoryPhase163MultiDayRunRepository } from '../ai/repositories/inMemoryPhase163MultiDayRunRepository.ts';
import { ScriptedDiagnosisProviderAdapter } from '../ai/providers/diagnosisProviderAdapter.ts';
import type { LearningPersistenceRecord } from '../ai/schemas/learningPersistence.schema.ts';
import type { Phase163RealLearningChainResult } from '../ai/schemas/realLearningOperation.schema.ts';
import type { RecommendedTaskRole } from '../ai/schemas/nextLearningStrategy.schema.ts';
import type { Phase163FormalResourcePoolItem } from './phase161To162IntegrationDemo.ts';
import { getPhase163FormalResourcePoolData } from './phase161To162IntegrationDemo.ts';
import { createPhase163DemoEnvironment } from './phase163RealLearningChainDemo.ts';

const ANSWER = '父亲捏着褪色的树叶站了很久，又小心地夹回原处，说明他想起过去，因此感到怀念和不舍。';
const TIMEZONE = 'Asia/Shanghai';

export type Phase163MultiDayDemoCaseId = 'overview' | 'recovery' | 'retest' | 'provider_failure';

export type Phase163MultiDayDemoCase = {
  id: Phase163MultiDayDemoCaseId;
  label: string;
  description: string;
  expected: string;
};

export type Phase163MultiDayDemoCheck = {
  label: string;
  detail: string;
  passed: boolean;
};

export type Phase163MultiDayDemoResult = {
  mode: 'simulated_engineering_preflight';
  headline: string;
  summary: string;
  engineeringReady: boolean;
  naturalRunComplete: boolean;
  counts: {
    simulatedDays: number;
    naturalDays: number;
    sessions: number;
    rounds: number;
    resources: number;
    evidence: number;
    completedRetests: number;
    recoveries: number;
    anomalyExercises: number;
  };
  timeline: Array<{
    day: string;
    title: string;
    detail: string;
    tone: 'success' | 'info' | 'warning';
  }>;
  cases: Record<Phase163MultiDayDemoCaseId, {
    status: 'passed' | 'blocked_as_expected';
    headline: string;
    summary: string;
    checks: Phase163MultiDayDemoCheck[];
  }>;
  debug: {
    providerCallsForRecoveredRound: number;
    providerFailureStatus: string;
    duplicateFormalWriteCount: number;
    sessionHistoryValid: boolean;
    retestPlanCreated: boolean;
  };
};

const cases: Phase163MultiDayDemoCase[] = [
  {
    id: 'overview',
    label: '多日运行总览',
    description: '受控运行三轮正式任务，并跨两个 Session 形成多日历史。',
    expected: '三轮、两类以上正式资源、多条 Evidence 和 GrowthMemory 均形成；模拟时间不会冒充自然日验收。',
  },
  {
    id: 'recovery',
    label: '恢复与幂等',
    description: '使用同一持久化结果恢复第一轮，检查是否重复调用 Diagnosis 或重复写入 Evidence。',
    expected: '恢复同一轮结果，Provider 仍只调用一次，正式写入无重复。',
  },
  {
    id: 'retest',
    label: '延迟复测',
    description: '从正式 Session History、Evidence 和 GrowthMemory 生成复测计划并完成复测任务。',
    expected: '复测计划来源完整，消费正式 retest Frozen Resource，并形成新的 Evidence。',
  },
  {
    id: 'provider_failure',
    label: '异常安全阻断',
    description: '模拟 Diagnosis Provider 不可用，检查失败分支是否污染正式学习状态。',
    expected: '进入可恢复的中断状态，不生成 Evidence，不更新 Profile。',
  },
];

let cachedRun: Promise<Phase163MultiDayDemoResult> | undefined;

export function getPhase163MultiDayDemoCases(): Phase163MultiDayDemoCase[] {
  return cases;
}

export function runPhase163MultiDayOperationDemo(): Promise<Phase163MultiDayDemoResult> {
  cachedRun ||= buildDemoRun().catch((error) => {
    cachedRun = undefined;
    throw error;
  });
  return cachedRun;
}

async function buildDemoRun(): Promise<Phase163MultiDayDemoResult> {
  const pool = await getPhase163FormalResourcePoolData();
  const trainingResources = pool.filter((item) => item.version.abilityMetadata.taskRole === 'training');
  const retestResource = requireResource(pool, 'retest');
  if (trainingResources.length < 2) throw new Error('Phase 16.3C Demo requires two formal training resources.');

  const round1 = await runRound({
    suffix: 'demo-day1',
    sessionId: 'phase163c-demo-session-1',
    roundId: 'phase163c-demo-round-1',
    startedAt: '2026-07-01T09:00:00.000Z',
    submittedAt: '2026-07-01T09:05:00.000Z',
    resource: trainingResources[0],
  });
  const recoveredRound1 = await runPhase163RealLearningChain(round1.environment.input, round1.environment.dependencies);

  const round2 = await runRound({
    suffix: 'demo-day3',
    sessionId: 'phase163c-demo-session-1',
    roundId: 'phase163c-demo-round-2',
    startedAt: '2026-07-03T09:00:00.000Z',
    submittedAt: '2026-07-03T09:05:00.000Z',
    resource: trainingResources[1],
    previous: round1.result,
  });

  const failure = await runProviderFailure(trainingResources[1]);
  const historyRepository = new InMemoryLearningSessionRepository();
  const session1 = await buildCompletedSession(historyRepository, 'phase163c-demo-session-1', [round1.record, round2.record]);
  const historyAtDay5 = await queryLearningSessionHistory(historyRepository, { studentId: round1.environment.input.studentId });
  const evidenceBeforeRetest = [round1.result, round2.result]
    .flatMap((item) => item.checkpoint.taskEvidenceReturnResult?.abilityEvidence || []);
  const retest = scheduleDelayedRetest({
    studentId: round1.environment.input.studentId,
    targetAbilityId: 'inference',
    growthMemorySummary: round2.result.checkpoint.updatedGrowthMemorySummary!,
    sessionHistory: historyAtDay5,
    abilityEvidence: evidenceBeforeRetest,
    currentTime: '2026-07-05T09:00:00.000Z',
    timezone: TIMEZONE,
    policy: {
      policyVersion: 'delayed_retest_policy_v1',
      growthIntervalDays: 1,
      positiveIntervalDays: 1,
      requireNewMaterial: true,
      allowHint: false,
    },
  });

  const round3 = await runRound({
    suffix: 'demo-day5-retest',
    sessionId: 'phase163c-demo-session-2',
    roundId: 'phase163c-demo-round-3',
    startedAt: '2026-07-05T09:00:00.000Z',
    submittedAt: '2026-07-05T09:05:00.000Z',
    resource: retestResource,
    previous: round2.result,
  });
  const session2 = await buildCompletedSession(historyRepository, 'phase163c-demo-session-2', [round3.record]);
  const finalHistory = await queryLearningSessionHistory(historyRepository, { studentId: round1.environment.input.studentId });

  let state = createPhase163MultiDayRun({
    runId: 'phase163c-controlled-demo-run',
    studentId: round1.environment.input.studentId,
    timezone: TIMEZONE,
    targetNaturalDayCount: 5,
    startedAt: '2026-07-01T09:00:00.000Z',
  });
  state = recordPhase163DailyOperation(state, {
    result: round1.result,
    dayKey: '2026-07-01',
    observedAt: '2026-07-01T09:05:00.000Z',
    timeSource: 'simulated',
  });
  state = recordPhase163DailyOperation(state, {
    result: recoveredRound1,
    dayKey: '2026-07-02',
    observedAt: '2026-07-02T09:00:00.000Z',
    timeSource: 'simulated',
    recoveredFromCheckpoint: true,
  });
  state = recordPhase163DailyOperation(state, {
    result: round2.result,
    dayKey: '2026-07-03',
    observedAt: '2026-07-03T09:05:00.000Z',
    timeSource: 'simulated',
  });
  state = recordPhase163DailyOperation(state, {
    result: failure,
    dayKey: '2026-07-04',
    observedAt: '2026-07-04T09:05:00.000Z',
    timeSource: 'simulated',
    anomalyCodes: ['provider_unavailable_exercise'],
  });
  state = recordPhase163DailyOperation(state, {
    result: round3.result,
    dayKey: '2026-07-05',
    observedAt: '2026-07-05T09:05:00.000Z',
    timeSource: 'simulated',
    retestPlanId: retest.plan?.planId,
    retestCompleted: true,
  });

  const repository = new InMemoryPhase163MultiDayRunRepository();
  await repository.save(state);
  const restored = await repository.getByStudent(state.studentId);
  if (!restored) throw new Error('Phase 16.3C Demo run could not be restored.');
  const acceptance = buildPhase163MultiDayAcceptance(restored);
  const duplicateFormalWriteCount = state.days.reduce((sum, item) => sum + item.duplicateFormalWrites.length, 0);
  const historyValid = finalHistory.sessions.every((item) => item.validation.passed);
  const totalRounds = finalHistory.sessions.reduce((sum, item) => sum + item.completedRoundCount, 0);
  const retestEvidenceCount = round3.result.checkpoint.taskEvidenceReturnResult?.abilityEvidence.length || 0;

  const overviewChecks: Phase163MultiDayDemoCheck[] = [
    check('跨 Session 完成三轮任务', finalHistory.total === 2 && totalRounds === 3, `已形成 ${finalHistory.total} 个 Session、${totalRounds} 轮正式结果。`),
    check('消费不同 Frozen Resource', acceptance.counts.resources >= 2, `共消费 ${acceptance.counts.resources} 个正式资源版本。`),
    check('Evidence 与 GrowthMemory 已形成', acceptance.counts.evidence >= 2 && Boolean(round3.result.checkpoint.updatedGrowthMemorySummary), `共形成 ${acceptance.counts.evidence} 条去重 Evidence。`),
    check('模拟时间未冒充自然日', acceptance.counts.naturalDays === 0 && !acceptance.naturalRunComplete, '工程预演为 5 个模拟日期，自然日仍为 0 / 5。'),
  ];
  const recoveryChecks: Phase163MultiDayDemoCheck[] = [
    check('恢复同一轮正式结果', recoveredRound1.acceptanceReport.persistence.recoveredFromCheckpoint, '第二次运行从持久化 Checkpoint 恢复。'),
    check('Diagnosis 未重复调用', round1.environment.provider.callCount === 1, `恢复前后 Provider 总调用次数为 ${round1.environment.provider.callCount}。`),
    check('正式写入保持幂等', duplicateFormalWriteCount === 0 && acceptance.checks.formalWritesIdempotent, '未发现重复 Evidence、Profile 或 GrowthMemory 写入。'),
  ];
  const retestChecks: Phase163MultiDayDemoCheck[] = [
    check('正式复测计划已生成', retest.nextStep === 'create_task_request' && Boolean(retest.plan), '计划由 History、Evidence、Memory 与时间规则生成。'),
    check('正式复测资源已消费', retestResource.version.abilityMetadata.taskRole === 'retest' && round3.result.checkpoint.concreteTask?.taskRole === 'retest', '复测任务来自审核冻结的 retest 资源。'),
    check('复测形成新的 Evidence', retestEvidenceCount > 0 && acceptance.counts.completedRetests === 1, `复测新增 ${retestEvidenceCount} 条 Evidence，并记录为已完成。`),
  ];
  const failureChecks: Phase163MultiDayDemoCheck[] = [
    check('Provider 失败被安全阻断', failure.status === 'retry_required', '运行进入可重试状态，没有伪装成完成。'),
    check('异常不生成 Evidence', !failure.checkpoint.taskEvidenceReturnResult, '失败分支没有正式 Evidence Return。'),
    check('异常不更新 Profile', !failure.checkpoint.updatedStudentAbilityProfile, '失败分支没有能力画像更新。'),
  ];

  const allEngineeringChecks = [...overviewChecks, ...recoveryChecks, ...retestChecks, ...failureChecks];
  if (!acceptance.engineeringReady || !historyValid || allEngineeringChecks.some((item) => !item.passed)) {
    const failed = allEngineeringChecks.filter((item) => !item.passed).map((item) => item.label);
    throw new Error(`Phase 16.3C controlled Demo facts failed engineering acceptance: ${[
      ...failed,
      ...(acceptance.engineeringReady ? [] : ['engineering_ready=false']),
      ...(historyValid ? [] : ['session_history_invalid']),
      ...acceptance.issues,
      ...(!retest.plan ? [`retest=${retest.nextStep}`, ...retest.validation.issues, `retest_reason=${retest.reason}`] : []),
    ].join(', ')}`);
  }

  return {
    mode: 'simulated_engineering_preflight',
    headline: '多日连续学习的工程链路已经准备好',
    summary: '三轮正式任务跨两个 Session 完成，恢复、延迟复测和 Provider 异常均按既定边界处理。自然日验收仍需真实使用完成。',
    engineeringReady: acceptance.engineeringReady,
    naturalRunComplete: acceptance.naturalRunComplete,
    counts: {
      simulatedDays: acceptance.counts.totalDays,
      naturalDays: acceptance.counts.naturalDays,
      sessions: acceptance.counts.sessions,
      rounds: totalRounds,
      resources: acceptance.counts.resources,
      evidence: acceptance.counts.evidence,
      completedRetests: acceptance.counts.completedRetests,
      recoveries: acceptance.counts.recoveries,
      anomalyExercises: acceptance.counts.anomalyExercises,
    },
    timeline: [
      { day: '第 1 天', title: '完成第一轮正式任务', detail: '正式作答形成 Diagnosis、Evidence 与 GrowthMemory。', tone: 'success' },
      { day: '第 2 天', title: '恢复上次学习结果', detail: '从同一 Checkpoint 恢复，没有重新诊断或重复写入。', tone: 'info' },
      { day: '第 3 天', title: '完成第二轮新任务', detail: '消费另一份 Frozen Resource，并继续累积正式 Evidence。', tone: 'success' },
      { day: '第 4 天', title: 'Provider 异常演练', detail: '链路安全停止，Evidence 与 Profile 均未被污染。', tone: 'warning' },
      { day: '第 5 天', title: '完成延迟复测', detail: '正式复测计划匹配 retest 资源并产生新的 Evidence。', tone: 'success' },
    ],
    cases: {
      overview: { status: 'passed', headline: '多日工程事实完整', summary: '多 Session、多轮、不同资源与正式回流均已形成。', checks: overviewChecks },
      recovery: { status: 'passed', headline: '恢复与幂等成立', summary: '刷新或重新进入不会重跑 Diagnosis，也不会重复写入正式结果。', checks: recoveryChecks },
      retest: { status: 'passed', headline: '延迟复测链路成立', summary: '复测由正式历史和证据触发，并消费审核冻结的复测资源。', checks: retestChecks },
      provider_failure: { status: 'blocked_as_expected', headline: '异常在正确位置停止', summary: 'Provider 不可用时保留可恢复状态，不形成错误教育事实。', checks: failureChecks },
    },
    debug: {
      providerCallsForRecoveredRound: round1.environment.provider.callCount,
      providerFailureStatus: failure.status,
      duplicateFormalWriteCount,
      sessionHistoryValid: historyValid && session1.validation.passed && session2.validation.passed,
      retestPlanCreated: Boolean(retest.plan),
    },
  };
}

async function runRound(input: {
  suffix: string;
  sessionId: string;
  roundId: string;
  startedAt: string;
  submittedAt: string;
  resource: Phase163FormalResourcePoolItem;
  previous?: Phase163RealLearningChainResult;
}) {
  const environment = await createPhase163DemoEnvironment('complete_chain', ANSWER);
  const priorMemoryRecord = input.previous?.checkpoint.taskEvidenceReturnResult?.growthMemoryRecord;
  const priorEvidence = input.previous?.checkpoint.taskEvidenceReturnResult?.abilityEvidence || [];
  environment.input = {
    ...environment.input,
    operationId: `phase163c-demo-operation-${input.suffix}`,
    learningSessionId: input.sessionId,
    learningRoundId: input.roundId,
    diagnosisRequestId: `phase163c-demo-diagnosis-${input.suffix}`,
    resourceVersion: input.resource.version,
    qualityGatedTask: input.resource.task,
    startedAt: input.startedAt,
    submittedAt: input.submittedAt,
    currentProfile: input.previous?.checkpoint.updatedStudentAbilityProfile || environment.input.currentProfile,
    currentGrowthMemorySummary: input.previous?.checkpoint.updatedGrowthMemorySummary || environment.input.currentGrowthMemorySummary,
    existingGrowthMemoryRecords: priorMemoryRecord ? [priorMemoryRecord] : [],
    previousEvidence: priorEvidence,
    currentLearningContext: {
      ...environment.input.currentLearningContext,
      recentTaskRole: input.resource.version.abilityMetadata.taskRole,
    },
  };
  environment.dependencies = { ...environment.dependencies, now: () => input.submittedAt };
  const result = await runPhase163RealLearningChain(environment.input, environment.dependencies);
  const record = await environment.dependencies.learningPersistenceRepository.loadLatest(environment.input.studentId);
  if (!record) throw new Error(`Persistence record missing for ${input.suffix}.`);
  return { environment, result, record };
}

async function runProviderFailure(resource: Phase163FormalResourcePoolItem): Promise<Phase163RealLearningChainResult> {
  const environment = await createPhase163DemoEnvironment('complete_chain', ANSWER);
  environment.input = {
    ...environment.input,
    operationId: 'phase163c-demo-operation-provider-failure',
    learningSessionId: 'phase163c-demo-session-2',
    learningRoundId: 'phase163c-demo-round-anomaly',
    diagnosisRequestId: 'phase163c-demo-diagnosis-provider-failure',
    resourceVersion: resource.version,
    qualityGatedTask: resource.task,
    startedAt: '2026-07-04T09:00:00.000Z',
    submittedAt: '2026-07-04T09:05:00.000Z',
  };
  environment.dependencies.provider = new ScriptedDiagnosisProviderAdapter([{
    type: 'error',
    category: 'provider_unavailable',
    retryable: false,
  }]);
  environment.dependencies.now = () => environment.input.submittedAt;
  return runPhase163RealLearningChain(environment.input, environment.dependencies);
}

async function buildCompletedSession(
  repository: InMemoryLearningSessionRepository,
  sessionId: string,
  records: LearningPersistenceRecord[],
) {
  let session = createLearningSessionRecord({
    sessionId,
    studentId: records[0].studentId,
    startedAt: records[0].savedAt,
    timezone: TIMEZONE,
    primaryAbilityId: 'inference',
  });
  for (const persistenceRecord of records) {
    session = appendLearningRoundToSession(session, { persistenceRecord });
  }
  session = closeLearningSessionRecord(session, {
    status: 'completed',
    endReason: 'student_finished',
    endedAt: records[records.length - 1].updatedAt,
  });
  return saveLearningSessionRecord(repository, session);
}

function requireResource(pool: Phase163FormalResourcePoolItem[], taskRole: RecommendedTaskRole): Phase163FormalResourcePoolItem {
  const resource = pool.find((item) => item.version.abilityMetadata.taskRole === taskRole);
  if (!resource) throw new Error(`Phase 16.3C Demo ${taskRole} resource is unavailable.`);
  return resource;
}

function check(label: string, passed: boolean, detail: string): Phase163MultiDayDemoCheck {
  return { label, passed, detail };
}
