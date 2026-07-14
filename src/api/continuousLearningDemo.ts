import { summarizeGrowthMemory } from '../ai/agents/growthMemorySummaryAgent.ts';
import { createLearningPersistenceRecord } from '../ai/agents/learningPersistenceAgent.ts';
import { completeLearningRound } from '../ai/agents/learningRoundCompletionAgent.ts';
import { executeLearningRound } from '../ai/agents/learningRoundExecutionAgent.ts';
import { startLearningRound } from '../ai/agents/learningRoundStartAgent.ts';
import { applyProfileUpdateDecision } from '../ai/agents/profileUpdateExecutor.ts';
import { buildStudentLearningFeedback } from '../ai/agents/studentFeedbackAdapter.ts';
import { buildStudentLearningEntryState } from '../ai/agents/studentLearningEntryAgent.ts';
import { buildStudentRoundSummary } from '../ai/agents/studentRoundSummaryAdapter.ts';
import {
  prepareConcreteLearningTaskFromResource,
} from '../ai/agents/taskResourcePreparationAgent.ts';
import { IndexedDBLearningPersistenceRepository } from '../ai/repositories/indexedDBLearningPersistenceRepository.ts';
import type { AbilityEvidence } from '../ai/schemas/abilityEvidence.schema.ts';
import type { DiagnosisResult } from '../ai/schemas/diagnosis.schema.ts';
import type { GrowthMemoryRecord, GrowthMemorySummary } from '../ai/schemas/growthMemory.schema.ts';
import type { LearningPersistenceRecord } from '../ai/schemas/learningPersistence.schema.ts';
import type { LearningRoundStartResult } from '../ai/schemas/learningRound.schema.ts';
import type { StudentAbilityProfile } from '../ai/schemas/studentAbilityProfile.schema.ts';
import type { StudentLearningEntryState } from '../ai/schemas/studentLearningEntry.schema.ts';
import type { StudentLearningFeedback } from '../ai/schemas/studentLearningFeedback.schema.ts';
import type { StudentRoundSummary } from '../ai/schemas/studentRoundSummary.schema.ts';
import {
  buildCurrentLearningContextFixture,
  buildGrowthMemorySummaryFixture,
  buildStudentAbilityProfileFixture,
} from '../ai/tests/nextLearningStrategyDebugFixtures.ts';
import { ensurePhase12IntegrationResources } from './taskResourcePreparation.ts';
import { taskResourceRepository } from './taskResourceRepository.ts';

const STUDENT_ID = 'phase12-3-demo-student';
const ROUND_PREFIX = 'phase12-3-demo-round-';
const MAX_ROUNDS = 3;
const TARGET_ABILITY = '推理';
const repository = new IndexedDBLearningPersistenceRepository();

export type ContinuousLearningDemoMode = 'task' | 'feedback' | 'finished' | 'error';

export type ContinuousLearningDemoState = {
  mode: ContinuousLearningDemoMode;
  roundIndex: number;
  maxRounds: number;
  completedRoundCount: number;
  answerDraft: string;
  entryState?: StudentLearningEntryState;
  startResult?: LearningRoundStartResult;
  feedback?: StudentLearningFeedback;
  roundSummary?: StudentRoundSummary;
  persistenceRecordId?: string;
  canContinue: boolean;
  message: string;
  debug: {
    recordCount: number;
    completedRoundIds: string[];
    currentRoundId?: string;
    latestGrowthMemoryRecordId?: string;
    latestStrategyId?: string;
    latestTaskRequestId?: string;
    issues: string[];
  };
};

export async function startContinuousLearningDemo(): Promise<ContinuousLearningDemoState> {
  const records = await listDemoRecords();
  if (records.length > 0) return loadContinuousLearningDemo();
  return prepareRound(1, '');
}

export async function loadContinuousLearningDemo(): Promise<ContinuousLearningDemoState> {
  const records = await listDemoRecords();
  if (records.length === 0) return prepareRound(1, '');

  const currentRecord = highestRoundRecord(records);
  const roundIndex = roundIndexFromId(currentRecord.learningRoundId);
  const completed = completedRecords(records);

  if (!currentRecord.learningRoundResult) {
    return prepareRound(roundIndex, currentRecord.answerDraft || '');
  }
  if (roundIndex >= MAX_ROUNDS && currentRecord.learningRoundResult.status === 'completed') {
    return stateFromCompletedRecord(currentRecord, records, true);
  }
  return stateFromCompletedRecord(currentRecord, records, false);
}

export async function saveContinuousLearningDraft(answerDraft: string): Promise<ContinuousLearningDemoState> {
  const records = await listDemoRecords();
  const current = highestRoundRecord(records);
  const roundIndex = current && !current.learningRoundResult
    ? roundIndexFromId(current.learningRoundId)
    : Math.min(completedRecords(records).length + 1, MAX_ROUNDS);
  const context = await buildRoundContext(roundIndex, records, answerDraft);
  const now = new Date().toISOString();
  const draftRecord = createLearningPersistenceRecord({
    studentId: STUDENT_ID,
    learningRoundId: context.startResult.learningRoundId,
    savedAt: current?.savedAt || now,
    updatedAt: now,
    sourceVersion: 'phase12_3_demo_v1',
    concreteTask: context.startResult.concreteTask,
    answerDraft,
    growthMemorySummary: context.growthSummary,
    studentAbilityProfile: context.profile,
  });
  await repository.save(draftRecord);
  return buildTaskState(context, records, answerDraft, draftRecord.recordId);
}

export async function submitContinuousLearningAnswer(input: {
  answerText: string;
  simulatePersistenceFailure?: boolean;
}): Promise<ContinuousLearningDemoState> {
  const records = await listDemoRecords();
  const current = highestRoundRecord(records);
  const roundIndex = current && !current.learningRoundResult
    ? roundIndexFromId(current.learningRoundId)
    : Math.min(completedRecords(records).length + 1, MAX_ROUNDS);
  const context = await buildRoundContext(roundIndex, records, input.answerText);
  const execution = executeLearningRound({
    startResult: context.startResult,
    studentAnswer: {
      answerText: input.answerText,
      usedHint: false,
      hintCount: 0,
      elapsedSeconds: 90,
    },
  });
  const completedAt = new Date().toISOString();

  if (execution.status !== 'evidence_return_ready') {
    const roundResult = completeLearningRound({
      executionResult: execution,
      concreteTask: context.startResult.concreteTask!,
      completedAt,
    });
    const feedback = buildStudentLearningFeedback({
      entryState: context.entryState,
      learningRoundExecutionResult: execution,
      taskExecutionResult: execution.taskExecutionResult,
      learningRoundResult: roundResult,
    });
    return {
      ...buildTaskState(context, records, input.answerText, current?.recordId),
      feedback,
      message: feedback.summary,
    };
  }

  const roundResult = completeLearningRound({
    executionResult: execution,
    concreteTask: context.startResult.concreteTask!,
    previousEvidence: context.evidence,
    currentProfile: context.profile,
    diagnosisResult: buildDiagnosisResult(input.answerText, context.startResult.concreteTask!.targetAbilityId),
    diagnosisResultId: `phase12-3-demo-diagnosis-${roundIndex}-${Date.now()}`,
    completedAt,
  });
  const returned = roundResult.taskEvidenceReturnResult;
  if (roundResult.status !== 'completed' || !returned?.profileUpdateDecision || !returned.growthMemoryRecord) {
    const feedback = buildStudentLearningFeedback({
      entryState: context.entryState,
      learningRoundExecutionResult: execution,
      taskEvidenceReturnResult: returned,
      learningRoundResult: roundResult,
    });
    return {
      mode: 'error',
      roundIndex,
      maxRounds: MAX_ROUNDS,
      completedRoundCount: completedRecords(records).length,
      answerDraft: input.answerText,
      entryState: context.entryState,
      startResult: context.startResult,
      feedback,
      canContinue: false,
      message: '本轮结果需要进一步确认，暂时不会进入下一轮。',
      debug: debugState(records, context.startResult, roundResult.issues),
    };
  }

  const nextProfile = applyProfileUpdateDecision({
    currentProfile: context.profile,
    decision: returned.profileUpdateDecision,
    appliedAt: completedAt,
  }).afterProfile;
  const nextGrowthRecords = dedupeGrowthRecords([...context.growthRecords, returned.growthMemoryRecord]);
  const nextGrowthSummary = summarizeGrowthMemory({
    studentId: STUDENT_ID,
    abilityId: returned.growthMemoryRecord.abilityId,
    records: nextGrowthRecords,
  });
  const feedback = buildStudentLearningFeedback({
    entryState: context.entryState,
    taskExecutionResult: execution.taskExecutionResult,
    learningRoundExecutionResult: execution,
    taskEvidenceReturnResult: returned,
    learningRoundResult: roundResult,
  });
  const roundSummary = buildStudentRoundSummary({
    learningRoundResult: roundResult,
    studentLearningFeedback: feedback,
    studentLearningEntryState: context.entryState,
  });
  const record = createLearningPersistenceRecord({
    studentId: STUDENT_ID,
    learningRoundId: context.startResult.learningRoundId,
    savedAt: current?.savedAt || completedAt,
    updatedAt: completedAt,
    sourceVersion: 'phase12_3_demo_v1',
    learningRoundResult: roundResult,
    concreteTask: context.startResult.concreteTask,
    studentResponse: execution.studentResponse,
    studentLearningFeedback: feedback,
    studentRoundSummary: roundSummary,
    growthMemoryRecord: returned.growthMemoryRecord,
    growthMemorySummary: nextGrowthSummary,
    studentAbilityProfile: nextProfile,
  });

  if (input.simulatePersistenceFailure) {
    return {
      mode: 'error',
      roundIndex,
      maxRounds: MAX_ROUNDS,
      completedRoundCount: completedRecords(records).length,
      answerDraft: input.answerText,
      entryState: context.entryState,
      startResult: context.startResult,
      feedback,
      roundSummary,
      canContinue: false,
      message: '本轮分析已经完成，但保存失败。请重试提交；系统不会启动下一轮。',
      debug: debugState(records, context.startResult, ['Simulated persistence failure; record was not written.']),
    };
  }

  await repository.save(record);
  const saved = await repository.loadByRound(STUDENT_ID, record.learningRoundId);
  if (!saved || saved.recordId !== record.recordId) {
    throw new Error('本轮结果未能完成保存与恢复校验。');
  }
  const nextRecords = await listDemoRecords();
  return stateFromCompletedRecord(saved, nextRecords, roundIndex >= MAX_ROUNDS);
}

export async function continueContinuousLearningDemo(): Promise<ContinuousLearningDemoState> {
  const records = await listDemoRecords();
  const completedCount = completedRecords(records).length;
  if (completedCount >= MAX_ROUNDS) return loadContinuousLearningDemo();
  return prepareRound(completedCount + 1, '');
}

export async function clearContinuousLearningDemo(): Promise<ContinuousLearningDemoState> {
  await repository.clear(STUDENT_ID);
  return prepareRound(1, '');
}

async function prepareRound(roundIndex: number, answerDraft: string): Promise<ContinuousLearningDemoState> {
  const records = await listDemoRecords();
  const context = await buildRoundContext(roundIndex, records, answerDraft);
  const now = new Date().toISOString();
  const record = createLearningPersistenceRecord({
    studentId: STUDENT_ID,
    learningRoundId: context.startResult.learningRoundId,
    savedAt: now,
    updatedAt: now,
    sourceVersion: 'phase12_3_demo_v1',
    concreteTask: context.startResult.concreteTask,
    answerDraft,
    growthMemorySummary: context.growthSummary,
    studentAbilityProfile: context.profile,
  });
  await repository.save(record);
  return buildTaskState(context, await listDemoRecords(), answerDraft, record.recordId);
}

async function buildRoundContext(
  roundIndex: number,
  records: LearningPersistenceRecord[],
  answerDraft: string,
): Promise<{
  startResult: LearningRoundStartResult;
  entryState: StudentLearningEntryState;
  growthSummary: GrowthMemorySummary;
  profile: StudentAbilityProfile;
  evidence: AbilityEvidence[];
  growthRecords: GrowthMemoryRecord[];
}> {
  const completed = completedRecords(records);
  const latestCompleted = completed[completed.length - 1];
  const growthSummary = latestCompleted?.growthMemorySummary || buildGrowthMemorySummaryFixture('continued_observation', {
    studentId: STUDENT_ID,
    abilityId: TARGET_ABILITY,
  });
  const profile = latestCompleted?.studentAbilityProfile || withStudentId(buildStudentAbilityProfileFixture(), STUDENT_ID);
  const evidence = dedupeEvidence([
    buildInitialEvidence(),
    ...completed.flatMap((item) => item.learningRoundResult?.taskEvidenceReturnResult?.abilityEvidence || []),
  ]);
  const growthRecords = dedupeGrowthRecords(
    completed.flatMap((item) => item.growthMemoryRecord ? [item.growthMemoryRecord] : []),
  );
  await ensurePhase12IntegrationResources();
  const usedResourceIds = completed
    .map((item) => item.concreteTask?.questionMetadata.questionId)
    .filter((item): item is string => Boolean(item));
  const allResources = await taskResourceRepository.listResources();
  const usedExternalResourceIds = allResources
    .filter((item) => usedResourceIds.includes(item.resourceId))
    .map((item) => item.externalResourceId)
    .filter((item): item is string => Boolean(item));
  const resources = await taskResourceRepository.findMatchingResources({
    targetAbilityId: growthSummary.abilityId,
    excludedResourceIds: usedResourceIds,
    excludedExternalResourceIds: usedExternalResourceIds,
    questionType: 'reading_open_response',
  });
  const start = startLearningRound({
    studentAbilityProfile: profile,
    growthMemorySummary: growthSummary,
    currentLearningContext: buildCurrentLearningContextFixture({
      contextId: `phase12-3-demo-context-${roundIndex}`,
      studentId: STUDENT_ID,
      currentPhase: growthSummary.recentTrend === 'retest_pending' ? 'retest' : 'observation',
      targetAbilityId: growthSummary.abilityId,
      allowTraining: true,
      allowRetest: true,
      allowTransfer: true,
    }),
    availableTaskResources: resources.map((item) => item.availableTaskResource),
    learningRoundId: `${ROUND_PREFIX}${roundIndex}`,
    createdAt: `2026-07-14T${16 + roundIndex}:00:00.000Z`,
  });
  if (!start.taskFulfillmentRequest) throw new Error(`第 ${roundIndex} 轮任务准备失败：${start.issues.join('；')}`);
  const selectedId = start.taskResourceMatchResult?.selectedTaskId;
  const resource = resources.find((item) => item.resourceId === selectedId);
  if (!resource) throw new Error(`第 ${roundIndex} 轮未匹配到正式 TaskResource。`);
  const prepared = prepareConcreteLearningTaskFromResource({
    resource,
    fulfillmentRequest: start.taskFulfillmentRequest,
    createdAt: `2026-07-14T${16 + roundIndex}:00:00.000Z`,
  });
  if (!prepared.concreteTaskResult.concreteTask || !prepared.concreteTaskResult.readiness.canExecute) {
    throw new Error(`第 ${roundIndex} 轮 ConcreteLearningTask 未通过 readiness。`);
  }
  const startResult: LearningRoundStartResult = {
    ...start,
    concreteTask: prepared.concreteTaskResult.concreteTask,
    taskReadinessValidation: prepared.concreteTaskResult.readiness,
    issues: [],
  };
  const entryState = buildStudentLearningEntryState({ startResult, answerDraft });
  return { startResult, entryState, growthSummary, profile, evidence, growthRecords };
}

function stateFromCompletedRecord(
  record: LearningPersistenceRecord,
  records: LearningPersistenceRecord[],
  finished: boolean,
): ContinuousLearningDemoState {
  const roundIndex = roundIndexFromId(record.learningRoundId);
  return {
    mode: finished ? 'finished' : 'feedback',
    roundIndex,
    maxRounds: MAX_ROUNDS,
    completedRoundCount: completedRecords(records).length,
    answerDraft: record.studentResponse?.answerText || record.answerDraft || '',
    feedback: record.studentLearningFeedback,
    roundSummary: record.studentRoundSummary,
    persistenceRecordId: record.recordId,
    canContinue: !finished && record.learningRoundResult?.status === 'completed',
    message: finished
      ? '三轮学习已经完成并保存。本次结束只表示达到计划轮数，不代表能力已经掌握。'
      : '本轮结果已保存并通过恢复校验，可以安全进入下一轮。',
    debug: debugState(records, record.learningRoundResult?.startResult, record.issues),
  };
}

function buildTaskState(
  context: Awaited<ReturnType<typeof buildRoundContext>>,
  records: LearningPersistenceRecord[],
  answerDraft: string,
  persistenceRecordId?: string,
): ContinuousLearningDemoState {
  const roundIndex = roundIndexFromId(context.startResult.learningRoundId);
  return {
    mode: 'task',
    roundIndex,
    maxRounds: MAX_ROUNDS,
    completedRoundCount: completedRecords(records).length,
    answerDraft,
    entryState: context.entryState,
    startResult: context.startResult,
    persistenceRecordId,
    canContinue: false,
    message: answerDraft ? '已恢复本轮答案草稿，可以继续作答。' : '本轮任务已经准备好，请阅读材料后作答。',
    debug: debugState(records, context.startResult, []),
  };
}

function debugState(
  records: LearningPersistenceRecord[],
  startResult?: LearningRoundStartResult,
  issues: string[] = [],
): ContinuousLearningDemoState['debug'] {
  const completed = completedRecords(records);
  const latestCompleted = completed[completed.length - 1];
  return {
    recordCount: records.length,
    completedRoundIds: completed.map((item) => item.learningRoundId),
    currentRoundId: startResult?.learningRoundId,
    latestGrowthMemoryRecordId: latestCompleted?.growthMemoryRecord?.recordId,
    latestStrategyId: startResult?.nextLearningStrategy?.strategyId,
    latestTaskRequestId: startResult?.taskRequest?.taskRequestId,
    issues,
  };
}

function buildDiagnosisResult(answer: string, mainAbility: string): DiagnosisResult {
  const normalized = answer.replace(/\s+/g, '');
  const hasClue = /旧书|树叶|站了很久|小心|杯子|洗了又洗|包好|号码牌|球场|回头|文中|行为/.test(normalized);
  const hasInference = /怀念|不舍|牵挂|珍惜|留恋|想起|回忆|心理/.test(normalized);
  const hasLink = /说明|因此|所以|反映|可见|因为/.test(normalized);
  const fullyMeets = hasClue && hasInference && hasLink;
  const partiallyMeets = hasClue || hasInference;
  const answerStatus = fullyMeets ? 'fully_meets' : partiallyMeets ? 'partially_meets' : 'does_not_meet';
  return {
    taskType: 'open_response',
    correct: fullyMeets,
    strategyUsed: 'phase12_3_demo_mock_diagnosis',
    answerStatus,
    scoreBand: fullyMeets ? 'high' : partiallyMeets ? 'medium' : 'low',
    rubricItems: [],
    matchedRubricItems: [
      ...(hasClue ? ['文本线索'] : []),
      ...(hasInference ? ['心理推断'] : []),
      ...(hasLink ? ['推理说明'] : []),
    ],
    missingRubricItems: [
      ...(!hasClue ? ['文本线索'] : []),
      ...(!hasInference ? ['心理推断'] : []),
      ...(!hasLink ? ['推理说明'] : []),
    ],
    mainAbility,
    relatedAbilities: ['信息提取', '理解', '表达'],
    surfaceError: fullyMeets ? '本次回答已回应任务要求。' : '答案还需要更清楚地连接文本行为和人物心理。',
    rootCause: fullyMeets ? '学生能够完成文本线索到人物心理的推理说明。' : '学生尚未完整建立“文本线索 -> 人物心理 -> 结论表达”的推理链。',
    errorType: fullyMeets ? '待验证' : '推理错误',
    abilityEvidence: fullyMeets ? ['学生能够结合文本行为说明人物心理。'] : ['学生的推理依据或推理说明仍不完整。'],
    diagnosisSummary: fullyMeets ? '本次回答基本满足推理任务要求。' : '本次回答形成继续练习推理链的依据。',
    nextTraining: fullyMeets ? '保存本轮结果，并根据成长记忆决定下一轮。' : '继续练习文本线索到人物心理的推理说明。',
    confidence: fullyMeets ? 0.82 : partiallyMeets ? 0.72 : 0.64,
  };
}

function buildInitialEvidence(): AbilityEvidence {
  return {
    id: 'phase12-3-demo-initial-evidence',
    studentId: STUDENT_ID,
    ability: TARGET_ABILITY,
    evidenceType: 'weakness',
    reason: 'reasoning_error',
    detail: '学生此前缺少文本线索到人物心理的完整推理说明。',
    source: 'diagnosis',
    observation: '回答容易停留在表层行为描述。',
    rootCause: '推理链不完整。',
    confidence: 0.72,
    createdAt: '2026-07-14T15:00:00.000Z',
    taskId: 'phase12-3-demo-initial-task',
    diagnosisId: 'phase12-3-demo-initial-diagnosis',
  };
}

function withStudentId(profile: StudentAbilityProfile, studentId: string): StudentAbilityProfile {
  return JSON.parse(JSON.stringify({ ...profile, studentId })) as StudentAbilityProfile;
}

async function listDemoRecords(): Promise<LearningPersistenceRecord[]> {
  return (await repository.listByStudent(STUDENT_ID))
    .filter((item) => item.learningRoundId.startsWith(ROUND_PREFIX))
    .sort((a, b) => roundIndexFromId(a.learningRoundId) - roundIndexFromId(b.learningRoundId));
}

function completedRecords(records: LearningPersistenceRecord[]): LearningPersistenceRecord[] {
  return records.filter((item) => item.learningRoundResult?.status === 'completed');
}

function highestRoundRecord(records: LearningPersistenceRecord[]): LearningPersistenceRecord {
  return records.slice().sort((a, b) => roundIndexFromId(b.learningRoundId) - roundIndexFromId(a.learningRoundId))[0];
}

function roundIndexFromId(roundId: string): number {
  const parsed = Number(roundId.replace(ROUND_PREFIX, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function dedupeEvidence(items: AbilityEvidence[]): AbilityEvidence[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function dedupeGrowthRecords(items: GrowthMemoryRecord[]): GrowthMemoryRecord[] {
  return [...new Map(items.map((item) => [item.recordId, item])).values()];
}
