import {
  buildPhase163MultiDayAcceptance,
  createPhase163MultiDayRun,
  recordPhase163DailyOperation,
} from '../agents/phase163MultiDayOperationAgent.ts';
import {
  appendLearningRoundToSession,
  closeLearningSessionRecord,
  createLearningSessionRecord,
  queryLearningSessionHistory,
  saveLearningSessionRecord,
} from '../agents/learningSessionHistoryAgent.ts';
import { runPhase163RealLearningChain } from '../agents/phase163RealLearningChainAgent.ts';
import { scheduleDelayedRetest } from '../agents/delayedRetestSchedulingAgent.ts';
import { InMemoryLearningSessionRepository } from '../repositories/inMemoryLearningSessionRepository.ts';
import { InMemoryPhase163MultiDayRunRepository } from '../repositories/inMemoryPhase163MultiDayRunRepository.ts';
import { ScriptedDiagnosisProviderAdapter } from '../providers/diagnosisProviderAdapter.ts';
import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';
import type { Phase163RealLearningChainResult } from '../schemas/realLearningOperation.schema.ts';
import type { QualityGatedExecutableTask } from '../schemas/resourceMatchQuality.schema.ts';
import type { FrozenQuestionResourceVersion } from '../schemas/questionResourceAdmission.schema.ts';
import { createPhase163DemoEnvironment } from '../../api/phase163RealLearningChainDemo.ts';

const ANSWER = '父亲捏着褪色的树叶站了很久，又小心地夹回原处，说明他想起过去，因此感到怀念和不舍。';
const TIMEZONE = 'Asia/Shanghai';
type Check = { name: string; passed: boolean; detail: string };
const checks: Check[] = [];

async function main(): Promise<void> {
  const round1 = await runRound({
    suffix: 'day1', sessionId: 'multiday-session-1', roundId: 'multiday-round-1',
    startedAt: '2026-07-01T09:00:00.000Z', submittedAt: '2026-07-01T09:05:00.000Z',
  });
  const recoveredRound1 = await runPhase163RealLearningChain(round1.environment.input, round1.environment.dependencies);

  const round2 = await runRound({
    suffix: 'day3', sessionId: 'multiday-session-1', roundId: 'multiday-round-2',
    startedAt: '2026-07-03T09:00:00.000Z', submittedAt: '2026-07-03T09:05:00.000Z',
    previous: round1.result,
    usePreviousNextResource: true,
  });

  const failure = await runProviderFailure();
  const historyRepository = new InMemoryLearningSessionRepository();
  const session1 = await buildCompletedSession(historyRepository, 'multiday-session-1', [round1.record, round2.record]);
  const historyAtDay5 = await queryLearningSessionHistory(historyRepository, { studentId: round1.environment.input.studentId });
  const evidence = [round1.result, round2.result].flatMap((item) => item.checkpoint.taskEvidenceReturnResult?.abilityEvidence || []);
  const retest = scheduleDelayedRetest({
    studentId: round1.environment.input.studentId,
    targetAbilityId: 'inference',
    growthMemorySummary: round2.result.checkpoint.updatedGrowthMemorySummary!,
    sessionHistory: historyAtDay5,
    abilityEvidence: evidence,
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
    suffix: 'day5-retest', sessionId: 'multiday-session-2', roundId: 'multiday-round-3',
    startedAt: '2026-07-05T09:00:00.000Z', submittedAt: '2026-07-05T09:05:00.000Z',
    previous: round2.result,
    taskRole: 'retest',
  });
  const session2 = await buildCompletedSession(historyRepository, 'multiday-session-2', [round3.record]);
  const finalHistory = await queryLearningSessionHistory(historyRepository, { studentId: round1.environment.input.studentId });

  let state = createPhase163MultiDayRun({
    runId: 'phase16-3-multiday-engineering-run',
    studentId: round1.environment.input.studentId,
    timezone: TIMEZONE,
    targetNaturalDayCount: 5,
    startedAt: '2026-07-01T09:00:00.000Z',
  });
  state = recordPhase163DailyOperation(state, {
    result: round1.result, dayKey: '2026-07-01', observedAt: '2026-07-01T09:05:00.000Z', timeSource: 'simulated',
  });
  state = recordPhase163DailyOperation(state, {
    result: recoveredRound1, dayKey: '2026-07-02', observedAt: '2026-07-02T09:00:00.000Z', timeSource: 'simulated', recoveredFromCheckpoint: true,
  });
  state = recordPhase163DailyOperation(state, {
    result: round2.result, dayKey: '2026-07-03', observedAt: '2026-07-03T09:05:00.000Z', timeSource: 'simulated',
  });
  state = recordPhase163DailyOperation(state, {
    result: failure, dayKey: '2026-07-04', observedAt: '2026-07-04T09:05:00.000Z', timeSource: 'simulated', anomalyCodes: ['provider_unavailable_exercise'],
  });
  state = recordPhase163DailyOperation(state, {
    result: round3.result, dayKey: '2026-07-05', observedAt: '2026-07-05T09:05:00.000Z', timeSource: 'simulated',
    retestPlanId: retest.plan?.planId, retestCompleted: true,
  });

  const repository = new InMemoryPhase163MultiDayRunRepository();
  await repository.save(state);
  const restored = await repository.getByStudent(state.studentId);
  const acceptance = buildPhase163MultiDayAcceptance(restored!);

  record('C1 三轮正式结果跨两个 Session 保存',
    finalHistory.total === 2 && finalHistory.sessions.reduce((sum, item) => sum + item.completedRoundCount, 0) === 3,
    `sessions=${finalHistory.total}, rounds=${finalHistory.sessions.reduce((sum, item) => sum + item.completedRoundCount, 0)}`);
  record('C2 至少两份 Frozen Resource 被正式消费',
    acceptance.counts.resources >= 2,
    `resources=${acceptance.counts.resources}`);
  record('C3 多条 Evidence 与 GrowthMemory 正式形成',
    acceptance.counts.evidence >= 2 && round3.result.checkpoint.updatedGrowthMemorySummary !== undefined,
    `evidence=${acceptance.counts.evidence}, memory=${Boolean(round3.result.checkpoint.updatedGrowthMemorySummary)}`);
  record('C4 延迟复测由正式 History、Evidence 与 Memory 生成并完成',
    retest.nextStep === 'create_task_request' && Boolean(retest.plan) && acceptance.counts.completedRetests === 1,
    `retest=${retest.nextStep}, completed=${acceptance.counts.completedRetests}`);
  record('C5 Repository 恢复同一运行且不重复 Diagnosis/Evidence',
    recoveredRound1.acceptanceReport.persistence.recoveredFromCheckpoint && acceptance.counts.recoveries >= 1 &&
      round1.environment.provider.callCount === 1,
    `recoveries=${acceptance.counts.recoveries}, providerCalls=${round1.environment.provider.callCount}`);
  record('C6 Provider 异常演练未生成 Evidence 或 Profile 更新',
    failure.status === 'retry_required' && !failure.checkpoint.taskEvidenceReturnResult &&
      !failure.checkpoint.updatedStudentAbilityProfile && acceptance.counts.anomalyExercises === 1,
    `status=${failure.status}, anomalies=${acceptance.counts.anomalyExercises}`);
  record('C7 正式写入幂等且身份稳定',
    acceptance.checks.formalWritesIdempotent && acceptance.checks.identitiesStable,
    `idempotent=${acceptance.checks.formalWritesIdempotent}, identity=${acceptance.checks.identitiesStable}`);
  record('C8 多日工程最低事实量已达到',
    acceptance.engineeringReady && Object.entries(acceptance.checks)
      .filter(([key]) => key !== 'naturalDayTargetReached')
      .every(([, value]) => value),
    `engineeringReady=${acceptance.engineeringReady}`);
  record('C9 时间模拟不冒充自然日验收',
    acceptance.counts.totalDays === 5 && acceptance.counts.naturalDays === 0 &&
      !acceptance.naturalRunComplete && !acceptance.checks.naturalDayTargetReached,
    `simulatedDays=${acceptance.counts.totalDays}, naturalDays=${acceptance.counts.naturalDays}`);
  record('C10 Session History 可完整回放资源与 Evidence 关系',
    session1.evidenceIds.length >= 2 && session2.evidenceIds.length >= 1 &&
      finalHistory.sessions.every((item) => item.validation.passed),
    `session1Evidence=${session1.evidenceIds.length}, session2Evidence=${session2.evidenceIds.length}`);

  console.log('\nPhase 16.3C Multi-day Engineering Simulation Debug');
  console.log('='.repeat(82));
  for (const item of checks) {
    console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.name}`);
    console.log(`       ${item.detail}`);
  }
  const passed = checks.filter((item) => item.passed).length;
  console.log('-'.repeat(82));
  console.log(`Result: ${passed} / ${checks.length} PASS`);
  console.log('Time mode: simulated engineering preflight; natural-day acceptance remains pending.');
  if (passed !== checks.length) throw new Error('Phase 16.3C multi-day simulation failed.');
}

async function runRound(input: {
  suffix: string;
  sessionId: string;
  roundId: string;
  startedAt: string;
  submittedAt: string;
  previous?: Phase163RealLearningChainResult;
  usePreviousNextResource?: boolean;
  taskRole?: 'training' | 'retest';
}) {
  const environment = await createPhase163DemoEnvironment('complete_chain', ANSWER);
  let resourceVersion: FrozenQuestionResourceVersion = input.usePreviousNextResource
    ? input.previous!.checkpoint.nextTaskResolution!.resourceVersion!
    : environment.input.resourceVersion;
  let qualityGatedTask: QualityGatedExecutableTask = input.usePreviousNextResource
    ? input.previous!.checkpoint.nextTaskResolution!.qualityGatedTask!
    : environment.input.qualityGatedTask;
  if (input.taskRole === 'retest') {
    resourceVersion = {
      ...resourceVersion,
      abilityMetadata: { ...resourceVersion.abilityMetadata, taskRole: 'retest' },
    };
    qualityGatedTask = {
      ...qualityGatedTask,
      executableTask: { ...qualityGatedTask.executableTask, taskRole: 'retest' },
    };
  }
  const priorMemoryRecord = input.previous?.checkpoint.taskEvidenceReturnResult?.growthMemoryRecord;
  const priorEvidence = input.previous?.checkpoint.taskEvidenceReturnResult?.abilityEvidence || [];
  environment.input = {
    ...environment.input,
    operationId: `multiday-operation-${input.suffix}`,
    learningSessionId: input.sessionId,
    learningRoundId: input.roundId,
    diagnosisRequestId: `multiday-diagnosis-${input.suffix}`,
    resourceVersion,
    qualityGatedTask,
    startedAt: input.startedAt,
    submittedAt: input.submittedAt,
    currentProfile: input.previous?.checkpoint.updatedStudentAbilityProfile || environment.input.currentProfile,
    currentGrowthMemorySummary: input.previous?.checkpoint.updatedGrowthMemorySummary || environment.input.currentGrowthMemorySummary,
    existingGrowthMemoryRecords: priorMemoryRecord ? [priorMemoryRecord] : [],
    previousEvidence: priorEvidence,
    currentLearningContext: {
      ...environment.input.currentLearningContext,
      recentTaskRole: input.taskRole || 'training',
    },
  };
  environment.dependencies = {
    ...environment.dependencies,
    now: () => input.submittedAt,
  };
  const result = await runPhase163RealLearningChain(environment.input, environment.dependencies);
  const record = await environment.dependencies.learningPersistenceRepository.loadLatest(environment.input.studentId);
  if (!record) throw new Error(`Persistence record missing for ${input.suffix}.`);
  return { environment, result, record };
}

async function runProviderFailure(): Promise<Phase163RealLearningChainResult> {
  const environment = await createPhase163DemoEnvironment('complete_chain', ANSWER);
  environment.input = {
    ...environment.input,
    operationId: 'multiday-operation-provider-failure',
    learningSessionId: 'multiday-session-2',
    learningRoundId: 'multiday-round-anomaly',
    diagnosisRequestId: 'multiday-diagnosis-provider-failure',
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

function record(name: string, passed: boolean, detail: string): void {
  checks.push({ name, passed, detail });
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
