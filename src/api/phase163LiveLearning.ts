import { prepareConcreteLearningTaskFromFrozenResource } from '../ai/agents/frozenQuestionResourceTaskAdapter.ts';
import {
  appendLearningRoundToSession,
  queryLearningSessionHistory,
  saveLearningSessionRecord,
} from '../ai/agents/learningSessionHistoryAgent.ts';
import {
  createPhase163MultiDayRun,
  recordPhase163DailyOperation,
} from '../ai/agents/phase163MultiDayOperationAgent.ts';
import { runPhase163RealLearningChain } from '../ai/agents/phase163RealLearningChainAgent.ts';
import {
  resolveStudentRuntimePausePresentation,
  type StudentRuntimePauseReason,
} from '../ai/content/studentRuntimeMessages.ts';
import { toStudentFeedbackSummary } from '../ai/content/studentFeedbackPresentation.ts';
import { buildStudentThinkingReview } from '../ai/agents/studentThinkingReviewAgent.ts';
import { buildStudentLearningNarrativeProjection } from '../ai/agents/studentLearningNarrativeAgent.ts';
import { createFeedbackExpressionConfigSnapshot } from '../ai/agents/controlledFeedbackExpressionAgent.ts';
import {
  buildStructuredFeedbackFacts,
  buildStudentFeedbackTeachingPlan,
} from '../ai/agents/structuredFeedbackFactsAgent.ts';
import { runTaskExecutionAgent } from '../ai/agents/taskExecutionAgent.ts';
import { scheduleDelayedRetest } from '../ai/agents/delayedRetestSchedulingAgent.ts';
import { createDiagnosisProviderConfigSnapshot } from '../ai/agents/realLLMRuntimeFoundationAgent.ts';
import { REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION } from '../ai/prompts/buildRealAIDiagnosisPromptV4.ts';
import { InMemoryControlledFeedbackRepository } from '../ai/repositories/inMemoryControlledFeedbackRepository.ts';
import { InMemoryFormalDiagnosisRepository } from '../ai/repositories/inMemoryFormalDiagnosisRepository.ts';
import { IndexedDBLearningPersistenceRepository } from '../ai/repositories/indexedDBLearningPersistenceRepository.ts';
import { IndexedDBLearningSessionRepository } from '../ai/repositories/indexedDBLearningSessionRepository.ts';
import { IndexedDBPhase163MultiDayRunRepository } from '../ai/repositories/indexedDBPhase163MultiDayRunRepository.ts';
import { IndexedDBRealLearningOperationRepository } from '../ai/repositories/indexedDBRealLearningOperationRepository.ts';
import { LocalStorageUnifiedLearningEntryRepository } from '../ai/repositories/localStorageUnifiedLearningEntryRepository.ts';
import type { LearningPersistenceRecord } from '../ai/schemas/learningPersistence.schema.ts';
import type { DelayedRetestPlan } from '../ai/schemas/delayedRetestScheduling.schema.ts';
import type { CurrentLearningContext, TaskRequest } from '../ai/schemas/nextLearningStrategy.schema.ts';
import type { FrozenQuestionResourceVersion } from '../ai/schemas/questionResourceAdmission.schema.ts';
import type { NextFormalTaskResolution } from '../ai/schemas/realLearningOperation.schema.ts';
import type { QualityGatedExecutableTask } from '../ai/schemas/resourceMatchQuality.schema.ts';
import type { ControlledFeedbackExpressionInput } from '../ai/schemas/controlledFeedbackExpression.schema.ts';
import type {
  StudentLearningFeedback,
  StudentThinkingReview,
} from '../ai/schemas/studentLearningFeedback.schema.ts';
import {
  toStudentLearningPresentation,
  type StudentLearningPresentation,
} from '../ai/schemas/studentLearningNarrative.schema.ts';
import { getPhase163FormalResourcePoolData } from './phase161To162IntegrationDemo.ts';
import { runDiagnosisThroughPhase163Boundary } from './phase163DiagnosisBoundary.ts';
import {
  assertPhase163ProductRuntimeIdentity,
  PHASE163_LEARNING_STUDENT_ID,
  PHASE163_LEARNING_TIMEZONE,
} from './phase163LearningIdentity.ts';

const TIMEZONE = PHASE163_LEARNING_TIMEZONE;
const operationRepository = new IndexedDBRealLearningOperationRepository();
const persistenceRepository = new IndexedDBLearningPersistenceRepository();
const sessionRepository = new IndexedDBLearningSessionRepository();
const activityRepository = new LocalStorageUnifiedLearningEntryRepository();
const multiDayRepository = new IndexedDBPhase163MultiDayRunRepository();

export type Phase163LiveWorkspaceState = {
  status: 'ready' | 'submitting' | 'completed' | 'retry_required' | 'review_required' | 'blocked';
  sessionId: string;
  roundId: string;
  roundNumber: number;
  task: {
    title: string;
    focus: string;
    readingText: string;
    questionText: string;
  };
  answerDraft: string;
  feedback?: {
    headline: string;
    summary: string;
    whatYouDidWell: string[];
    whatNeedsAttention: string[];
    nextActionText: string;
    thinkingReview?: StudentThinkingReview;
    guidance?: {
      understandingNotice?: string;
      detailsToReview: string[];
      revisionActions: string[];
    };
  };
  learningPresentation?: StudentLearningPresentation;
  canAdvance: boolean;
  canRetry: boolean;
  isRetest: boolean;
  primaryAction: 'submit_answer' | 'resume_processing' | 'retry_resource' | 'start_next_task' | 'return_to_entry';
  pauseReason?: StudentRuntimePauseReason;
  studentTitle?: string;
  studentMessage?: string;
};

export async function loadPhase163LiveWorkspace(): Promise<Phase163LiveWorkspaceState> {
  const descriptor = await buildCurrentRoundDescriptor();
  const checkpoint = await operationRepository.getByOperationId(descriptor.input.operationId);
  const persisted = await persistenceRepository.loadByRound(PHASE163_LEARNING_STUDENT_ID, descriptor.input.learningRoundId);
  if (persisted) {
    assertPhase163ProductRuntimeIdentity({
      studentId: persisted.studentId,
      learningRoundId: persisted.learningRoundId,
    });
  }
  if (checkpoint) assertPhase163ProductRuntimeIdentity(checkpoint);
  if (!checkpoint) return readyState(descriptor, persisted?.answerDraft || '');
  return stateFromCheckpoint(descriptor, checkpoint, persisted?.answerDraft || '');
}

export async function savePhase163LiveDraft(answerDraft: string): Promise<void> {
  const descriptor = await buildCurrentRoundDescriptor();
  const existing = await persistenceRepository.loadByRound(PHASE163_LEARNING_STUDENT_ID, descriptor.input.learningRoundId);
  await persistenceRepository.save({
    recordId: existing?.recordId || `${PHASE163_LEARNING_STUDENT_ID}::${descriptor.input.learningRoundId}`,
    studentId: PHASE163_LEARNING_STUDENT_ID,
    learningRoundId: descriptor.input.learningRoundId,
    savedAt: existing?.savedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 'phase12_1_v1',
    schemaVersion: 'learning_persistence_v1',
    concreteTask: descriptor.concreteTask,
    answerDraft,
    status: 'saved',
    issues: [],
  });
}

export async function submitPhase163LiveAnswer(answerText: string): Promise<Phase163LiveWorkspaceState> {
  const descriptor = await buildCurrentRoundDescriptor();
  const submittedAt = new Date().toISOString();
  const validityPreflight = runTaskExecutionAgent({
    concreteTask: descriptor.concreteTask,
    readiness: descriptor.readiness,
    studentAnswer: { answerText: answerText.trim(), submittedAt },
    startedAt: submittedAt,
  });
  if (!validityPreflight.taskExecutionResult?.canEnterDiagnosisRuntime) {
    const validity = validityPreflight.taskExecutionResult?.responseValidity;
    const copiedMaterial = validity?.reasons.some((reason) => reason.includes('复制阅读材料'));
    await savePhase163LiveDraft(answerText);
    return {
      ...readyState(descriptor, answerText),
      status: 'retry_required',
      canRetry: true,
      studentMessage: validity?.status === 'empty'
        ? '请先写下你的判断和理由。'
        : copiedMaterial
          ? '这次回答主要复制了阅读材料，还没有回答题目。请先用自己的话写出判断，再选择一处材料说明理由。'
        : '这次回答的信息还不够，请补充你的判断，并结合材料说明理由。',
    };
  }
  const input = {
    ...descriptor.input,
    answerText: answerText.trim(),
    submittedAt,
  };
  const result = await runPhase163RealLearningChain(input, {
    formalDiagnosisRepository: new InMemoryFormalDiagnosisRepository(),
    controlledFeedbackRepository: new InMemoryControlledFeedbackRepository(),
    learningPersistenceRepository: persistenceRepository,
    operationRepository,
    runDiagnosisRuntime: runDiagnosisThroughPhase163Boundary,
    resolveNextTask: ({ taskRequest, previousResourceVersion }) => resolveNextFormalTask(taskRequest, previousResourceVersion),
    now: () => submittedAt,
  });

  if (result.checkpoint.nextAction === 'submit_answer') {
    await savePhase163LiveDraft(answerText);
  }

  const persistence = await persistenceRepository.loadByRound(PHASE163_LEARNING_STUDENT_ID, input.learningRoundId);
  if (persistence?.learningRoundResult) await appendRoundToCurrentSession(persistence);
  await recordNaturalDay(result, descriptor.retestPlan);
  return stateFromCheckpoint(descriptor, result.checkpoint, answerText);
}

export async function advancePhase163LiveRound(): Promise<void> {
  const context = await requireActiveContext();
  const current = roundNumber(context.currentLearningRoundId);
  const nextRoundId = `${context.learningSessionId}-round-${current + 1}`;
  await activityRepository.save({
    ...context,
    currentLearningRoundId: nextRoundId,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadPhase163DueRetestPlans(): Promise<DelayedRetestPlan[]> {
  const records = await persistenceRepository.listByStudent(PHASE163_LEARNING_STUDENT_ID);
  const latest = records.filter((item) => item.growthMemorySummary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!latest?.growthMemorySummary) return [];
  const history = await queryLearningSessionHistory(sessionRepository, { studentId: PHASE163_LEARNING_STUDENT_ID });
  const evidence = records.flatMap((item) => item.learningRoundResult?.taskEvidenceReturnResult?.abilityEvidence || []);
  const result = scheduleDelayedRetest({
    studentId: PHASE163_LEARNING_STUDENT_ID,
    targetAbilityId: latest.growthMemorySummary.abilityId,
    growthMemorySummary: latest.growthMemorySummary,
    sessionHistory: history,
    abilityEvidence: evidence,
    currentTime: new Date().toISOString(),
    timezone: TIMEZONE,
    policy: {
      policyVersion: 'delayed_retest_policy_v1',
      growthIntervalDays: 3,
      positiveIntervalDays: 3,
      requireNewMaterial: true,
      allowHint: false,
    },
  });
  return result.plan?.status === 'available' ? [result.plan] : [];
}

async function buildCurrentRoundDescriptor() {
  const context = await requireActiveContext();
  const roundId = context.currentLearningRoundId || `${context.learningSessionId}-round-1`;
  const number = roundNumber(roundId);
  const records = await persistenceRepository.listByStudent(PHASE163_LEARNING_STUDENT_ID);
  const latest = records.filter((item) => item.learningRoundResult?.status === 'completed').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const currentCheckpoint = await operationRepository.getByOperationId(`phase16-3-live-operation-${roundId}`);
  const plans = await loadPhase163DueRetestPlans();
  const retestPlan = plans[0];
  const pool = await loadFormalPool();
  const previousResourceVersionId = latest?.concreteTask?.questionMetadata.questionId;
  const previousRoundId = number > 1 ? replaceRoundNumber(roundId, number - 1) : undefined;
  const previousCheckpoint = previousRoundId
    ? await operationRepository.getByOperationId(`phase16-3-live-operation-${previousRoundId}`)
    : undefined;
  const plannedResolution = previousCheckpoint?.nextTaskResolution?.status === 'matched'
    ? previousCheckpoint.nextTaskResolution
    : undefined;
  const plannedVersionId = plannedResolution?.resourceVersion?.resourceVersionId;
  const role = retestPlan
    ? 'retest'
    : plannedResolution?.resourceVersion?.abilityMetadata.taskRole || 'training';
  const eligiblePool = pool.filter((item) => (
    item.version.abilityMetadata.abilityId === 'inference' &&
    item.version.abilityMetadata.taskRole === role &&
    item.task.executableTask.taskRole === role
  ));
  const selected = currentCheckpoint?.sourceResourceVersionId
    ? pool.find((item) => item.version.resourceVersionId === currentCheckpoint.sourceResourceVersionId)
    : plannedVersionId
      ? eligiblePool.find((item) => item.version.resourceVersionId === plannedVersionId)
      : eligiblePool.find((item) => item.version.resourceVersionId !== previousResourceVersionId) ||
        eligiblePool[(number - 1) % eligiblePool.length];
  if (!selected) throw new Error(role === 'retest' ? '暂无符合复测要求的正式任务。' : '暂无符合当前要求的正式任务。');
  const version = selected.version;
  const qualityTask = selected.task;
  const preparation = prepareConcreteLearningTaskFromFrozenResource({
    resourceVersion: version,
    qualityGatedTask: qualityTask,
    createdAt: new Date().toISOString(),
  });
  if (preparation.status !== 'prepared' || !preparation.concreteTaskResult.concreteTask) {
    throw new Error('当前正式任务尚未准备完成。');
  }
  const base = await import('./phase163RealLearningChainDemo.ts').then((module) => (
    module.createPhase163DemoEnvironment('complete_chain', '')
  ));
  const currentProfile = latest?.studentAbilityProfile || {
    ...base.input.currentProfile,
    studentId: PHASE163_LEARNING_STUDENT_ID,
  };
  const currentGrowthMemorySummary = latest?.growthMemorySummary || {
    ...base.input.currentGrowthMemorySummary,
    studentId: PHASE163_LEARNING_STUDENT_ID,
  };
  const existingGrowthMemoryRecords = records.flatMap((item) => item.growthMemoryRecord ? [item.growthMemoryRecord] : []);
  const previousEvidence = records.flatMap((item) => item.learningRoundResult?.taskEvidenceReturnResult?.abilityEvidence || []);
  const startedAt = new Date().toISOString();
  const currentLearningContext: CurrentLearningContext = {
    ...base.input.currentLearningContext,
    studentId: PHASE163_LEARNING_STUDENT_ID,
    recentTaskRole: role,
  };
  return {
    retestPlan,
    concreteTask: preparation.concreteTaskResult.concreteTask,
    readiness: preparation.concreteTaskResult.readiness,
    roundNumber: number,
    input: {
      ...base.input,
      operationId: `phase16-3-live-operation-${roundId}`,
      learningSessionId: context.learningSessionId,
      learningRoundId: roundId,
      diagnosisRequestId: `phase16-3-live-diagnosis-${roundId}`,
      studentId: PHASE163_LEARNING_STUDENT_ID,
      resourceVersion: version,
      qualityGatedTask: qualityTask,
      answerText: '',
      startedAt,
      submittedAt: startedAt,
      currentProfile,
      currentGrowthMemorySummary,
      existingGrowthMemoryRecords,
      previousEvidence,
      currentLearningContext,
      providerConfig: createDiagnosisProviderConfigSnapshot({
        provider: 'deepseek_chat',
        model: 'deepseek-v4-flash',
        providerConfigId: 'phase16-3-local-application-boundary-v1',
        promptVersion: REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION,
        maxAttempts: 2,
        timeoutMs: 30_000,
        createdAt: startedAt,
      }),
      timezone: TIMEZONE,
    },
  };
}

async function resolveNextFormalTask(
  taskRequest: TaskRequest,
  previousResourceVersion: FrozenQuestionResourceVersion,
): Promise<NextFormalTaskResolution> {
  const pool = await loadFormalPool();
  const selected = pool.find((item) => (
    item.version.resourceId !== previousResourceVersion.resourceId &&
    item.version.abilityMetadata.abilityId === taskRequest.targetAbilityId &&
    item.version.abilityMetadata.taskRole === taskRequest.taskRole &&
    item.task.executableTask.taskRole === taskRequest.taskRole
  ));
  if (!selected) return { status: 'no_match', taskRequestId: taskRequest.taskRequestId, issues: ['no_aligned_frozen_resource'] };
  return {
    status: 'matched',
    taskRequestId: taskRequest.taskRequestId,
    resourceVersion: selected.version,
    qualityGatedTask: selected.task,
    issues: [],
  };
}

async function loadFormalPool(): Promise<Array<{ version: FrozenQuestionResourceVersion; task: QualityGatedExecutableTask }>> {
  return getPhase163FormalResourcePoolData(PHASE163_LEARNING_STUDENT_ID);
}

async function appendRoundToCurrentSession(record: LearningPersistenceRecord): Promise<void> {
  const context = await requireActiveContext();
  const session = await sessionRepository.getById(PHASE163_LEARNING_STUDENT_ID, context.learningSessionId);
  if (!session || session.status !== 'in_progress') return;
  await saveLearningSessionRecord(sessionRepository, appendLearningRoundToSession(session, { persistenceRecord: record }));
}

async function recordNaturalDay(result: Awaited<ReturnType<typeof runPhase163RealLearningChain>>, plan?: DelayedRetestPlan): Promise<void> {
  const now = new Date().toISOString();
  const existing = await multiDayRepository.getByStudent(PHASE163_LEARNING_STUDENT_ID);
  const state = existing || createPhase163MultiDayRun({
    runId: `phase16-3-natural-${PHASE163_LEARNING_STUDENT_ID}`,
    studentId: PHASE163_LEARNING_STUDENT_ID,
    timezone: TIMEZONE,
    targetNaturalDayCount: 5,
    startedAt: now,
  });
  await multiDayRepository.save(recordPhase163DailyOperation(state, {
    result,
    observedAt: now,
    dayKey: localDayKey(now),
    timeSource: 'natural',
    retestPlanId: plan?.planId,
    retestCompleted: Boolean(plan && result.status === 'completed'),
    anomalyCodes: result.status === 'completed' ? [] : [`runtime_${result.status}`],
  }));
}

async function requireActiveContext() {
  const context = await activityRepository.getByStudent(PHASE163_LEARNING_STUDENT_ID);
  if (!context || context.status === 'ended') throw new Error('请先从学习入口开始本次学习。');
  assertPhase163ProductRuntimeIdentity(context);
  return context;
}

function readyState(descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>, answerDraft: string): Phase163LiveWorkspaceState {
  const task = descriptor.concreteTask;
  const learningPresentation = toStudentLearningPresentation(buildStudentLearningNarrativeProjection({
    studentId: descriptor.input.studentId,
    currentTask: task,
    delayedRetestPlan: descriptor.retestPlan,
  }));
  return {
    status: 'ready',
    sessionId: descriptor.input.learningSessionId,
    roundId: descriptor.input.learningRoundId,
    roundNumber: descriptor.roundNumber,
    task: {
      title: `${task.targetAbilityName}${task.taskRole === 'retest' ? '复测' : '练习'}`,
      focus: task.targetAbilityName,
      readingText: task.readingText || '',
      questionText: task.question,
    },
    answerDraft,
    learningPresentation,
    canAdvance: false,
    canRetry: false,
    isRetest: task.taskRole === 'retest',
    primaryAction: 'submit_answer',
  };
}

function stateFromCheckpoint(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  checkpoint: NonNullable<Awaited<ReturnType<IndexedDBRealLearningOperationRepository['getByOperationId']>>>,
  answerDraft: string,
): Phase163LiveWorkspaceState {
  const restoredAnswer = checkpoint.taskExecutionResult?.studentResponse?.answerText || answerDraft;
  const base = readyState(descriptor, restoredAnswer);
  const feedback = resolvePhase163LiveStudentFeedback(checkpoint);
  const learningPresentation = toStudentLearningPresentation(buildStudentLearningNarrativeProjection({
    studentId: checkpoint.studentId,
    currentTask: checkpoint.concreteTask || descriptor.concreteTask,
    studentResponse: checkpoint.taskExecutionResult?.studentResponse,
    feedback,
    evidenceQualityAssessment: checkpoint.evidenceQualityAssessment,
    growthMemorySummary: checkpoint.updatedGrowthMemorySummary,
    nextLearningStrategy: checkpoint.nextLearningStrategy,
    nextTaskResolution: checkpoint.nextTaskResolution,
    delayedRetestPlan: descriptor.retestPlan,
  }));
  const canAdvance = checkpoint.status === 'completed' && checkpoint.nextTaskResolution?.status === 'matched';
  const primaryAction = canAdvance
    ? 'start_next_task'
    : checkpoint.status === 'review_required'
      ? 'return_to_entry'
      : checkpoint.status === 'blocked'
        ? checkpoint.nextAction === 'prepare_resource' && Boolean(checkpoint.learningPersistenceRecordId)
          ? 'retry_resource'
          : 'return_to_entry'
        : checkpoint.nextAction === 'submit_answer'
          ? 'submit_answer'
          : checkpoint.status === 'retry_required'
            ? 'resume_processing'
            : 'return_to_entry';
  const resourceUnavailable = checkpoint.nextAction === 'prepare_resource';
  const pausePresentation = checkpoint.status === 'review_required' || checkpoint.status === 'blocked'
    ? resolveStudentRuntimePausePresentation({
      status: checkpoint.status,
      nextAction: checkpoint.nextAction,
      hasFormalRoundResult: Boolean(checkpoint.learningPersistenceRecordId),
    })
    : undefined;
  return {
    ...base,
    status: checkpoint.status === 'completed' ? 'completed' : checkpoint.status,
    learningPresentation,
    feedback: feedback ? {
      headline: feedback.headline,
      summary: feedback.summary,
      whatYouDidWell: feedback.whatYouDidWell,
      whatNeedsAttention: feedback.guidance ? feedback.whatNeedsAttention : [],
      nextActionText: feedback.nextActionText,
      guidance: feedback.guidance,
      thinkingReview: feedback.thinkingReview ? {
        coveredPoints: feedback.thinkingReview.coveredPoints,
        primaryGap: feedback.thinkingReview.primaryGap,
        missingPoints: feedback.thinkingReview.primaryGap
          ? [feedback.thinkingReview.primaryGap]
          : feedback.thinkingReview.missingPoints.slice(0, 1),
      } : undefined,
    } : undefined,
    canAdvance,
    canRetry: checkpoint.status === 'retry_required',
    primaryAction,
    pauseReason: pausePresentation?.reason,
    studentTitle: pausePresentation?.title,
    studentMessage: pausePresentation
      ? pausePresentation.message
      : checkpoint.status === 'blocked'
        ? resourceUnavailable && checkpoint.learningPersistenceRecordId
          ? '本轮学习已经完成。下一任务需要先准备，准备完成后可以从学习入口继续。'
          : '当前任务暂时无法继续，已有学习记录已经保留。'
        : checkpoint.status === 'retry_required'
          ? checkpoint.nextAction === 'submit_answer'
            ? checkpoint.issues.includes('semantic_answer_validity_insufficient')
              ? '这段内容没有回应当前题目。请围绕题目写出你的判断，并结合材料说明理由。'
              : '请补充回答后重新提交。'
            : '已提交的回答正在恢复处理，不需要重新作答。'
          : undefined,
  };
}

export function resolvePhase163LiveStudentFeedback(
  checkpoint: NonNullable<Awaited<ReturnType<IndexedDBRealLearningOperationRepository['getByOperationId']>>>,
): StudentLearningFeedback | undefined {
  const result = checkpoint.controlledFeedbackResult;
  const feedback = result?.studentLearningFeedback;
  if (!feedback) return undefined;
  if (
    !result.structuredFacts ||
    !checkpoint.concreteTask ||
    !checkpoint.taskExecutionResult?.studentResponse ||
    !checkpoint.realDiagnosisRuntimeResult ||
    !checkpoint.taskEvidenceReturnResult
  ) return feedback;

  const task = checkpoint.concreteTask;
  const response = checkpoint.taskExecutionResult.studentResponse;
  const request: ControlledFeedbackExpressionInput = {
    feedbackRequestId: result.feedbackRequestId,
    learningRoundId: checkpoint.learningRoundId,
    studentId: checkpoint.studentId,
    taskId: task.taskId,
    executionSessionId: checkpoint.taskExecutionResult.executionSessionId,
    responseId: response.responseId,
    studentResponseText: response.answerText,
    taskContext: {
      readingText: task.readingText,
      questionText: task.question,
      answerRequirements: task.answerRequirements,
    },
    realDiagnosisRuntimeResult: checkpoint.realDiagnosisRuntimeResult,
    taskEvidenceReturnResult: checkpoint.taskEvidenceReturnResult,
    expressionConfig: createFeedbackExpressionConfigSnapshot({
      expressionPolicy: 'deterministic_only',
      createdAt: checkpoint.updatedAt,
    }),
    requestedAt: checkpoint.updatedAt,
  };
  const refreshedFacts = buildStructuredFeedbackFacts({
    request,
    admissionDecision: result.admissionDecision,
  });
  if (!refreshedFacts.validation.passed) {
    return { ...feedback, whatYouDidWell: [], whatNeedsAttention: [] };
  }
  const thinkingReview = buildStudentThinkingReview(request, {
    safeStrengths: refreshedFacts.observedStrengths
      .map((fact) => fact.safeExpressions[0])
      .filter(Boolean),
  });
  const plan = buildStudentFeedbackTeachingPlan({
    request,
    facts: refreshedFacts,
    thinkingReview,
  });
  if (!plan.validation.passed) return { ...feedback, whatNeedsAttention: [] };
  return {
    ...feedback,
    summary: toStudentFeedbackSummary(feedback.summary),
    whatYouDidWell: refreshedFacts.observedStrengths
      .map((fact) => fact.safeExpressions[0])
      .filter(Boolean),
    whatNeedsAttention: plan.understandingNotice ? [plan.understandingNotice.text] : [],
    guidance: {
      understandingNotice: plan.understandingNotice?.text,
      detailsToReview: plan.detailsToReview.map((item) => item.text),
      revisionActions: plan.revisionActions.map((item) => item.text),
    },
    thinkingReview,
  };
}

function roundNumber(roundId?: string): number {
  const match = roundId?.match(/round-(\d+)$/);
  return match ? Number(match[1]) : 1;
}

function replaceRoundNumber(roundId: string, number: number): string {
  return roundId.replace(/round-\d+$/, `round-${number}`);
}

function localDayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
