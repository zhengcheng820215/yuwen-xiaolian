import { summarizeGrowthMemory } from './growthMemorySummaryAgent.ts';
import {
  createLearningPersistenceRecord,
  restoreLearningState,
} from './learningPersistenceAgent.ts';
import { completeLearningRound } from './learningRoundCompletionAgent.ts';
import { executeLearningRound } from './learningRoundExecutionAgent.ts';
import { startLearningRound } from './learningRoundStartAgent.ts';
import { applyProfileUpdateDecision } from './profileUpdateExecutor.ts';
import { buildStudentLearningFeedback } from './studentFeedbackAdapter.ts';
import { buildStudentLearningEntryState } from './studentLearningEntryAgent.ts';
import { buildStudentRoundSummary } from './studentRoundSummaryAdapter.ts';
import { prepareConcreteLearningTaskFromResource } from './taskResourcePreparationAgent.ts';
import type { LearningPersistenceRepository } from '../repositories/learningPersistenceRepository.ts';
import type { TaskResourceRepository } from '../repositories/taskResourceRepository.ts';
import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type {
  ContinuousLearningRoundSnapshot,
  ContinuousLearningRunEndReason,
  ContinuousLearningRunNextStep,
  ContinuousLearningRunOutput,
  ContinuousLearningRunResult,
  ContinuousLearningRunStatus,
  LearningRoundTransition,
  LearningRoundTransitionType,
  PendingContinuousLearningPersistence,
} from '../schemas/continuousLearningRun.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { GrowthMemoryRecord, GrowthMemorySummary } from '../schemas/growthMemory.schema.ts';
import type { RestoredLearningState } from '../schemas/learningPersistence.schema.ts';
import type {
  CurrentLearningContext,
  NextLearningAction,
  RecommendedTaskRole,
} from '../schemas/nextLearningStrategy.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import type { StudentAnswerInput, StudentResponse } from '../schemas/taskExecution.schema.ts';
import type { TaskResource } from '../schemas/taskResource.schema.ts';

export type ContinuousLearningRoundSubmission = {
  studentAnswer?: StudentAnswerInput;
  responseOverrides?: Partial<StudentResponse>;
  diagnosisResult?: Partial<DiagnosisResult> | null;
  diagnosisResultId?: string;
  diagnosisFailed?: boolean;
  abandon?: boolean;
  completedAt?: string;
};

export type ContinuousLearningRunInput = {
  runId?: string;
  studentId: string;
  restoredLearningState: RestoredLearningState;
  growthMemoryRecords: GrowthMemoryRecord[];
  growthMemorySummary: GrowthMemorySummary;
  studentAbilityProfile: StudentAbilityProfile;
  currentLearningContext: CurrentLearningContext;
  availableTaskResources: TaskResource[];
  taskResourceRepository?: TaskResourceRepository;
  submissions: ContinuousLearningRoundSubmission[];
  previousEvidence?: AbilityEvidence[];
  maxRounds: 2 | 3;
  repository: LearningPersistenceRepository;
  startedAt?: string;
};

export type ContinuousLearningPersistenceRetryResult = {
  saved: boolean;
  restoredState?: RestoredLearningState;
  recordId?: string;
  issues: string[];
};

export async function runContinuousLearning(
  input: ContinuousLearningRunInput,
): Promise<ContinuousLearningRunOutput> {
  const startedAt = input.startedAt || new Date().toISOString();
  const runId = input.runId || `continuous-run-${stableId(`${input.studentId}-${startedAt}`)}`;
  const inputIssues = validateInput(input);
  let evidence = dedupeEvidence(input.previousEvidence || []);
  let profile = input.studentAbilityProfile;
  let growthSummary = input.growthMemorySummary;
  let growthRecords = dedupeGrowthRecords(input.growthMemoryRecords);
  let previousState = input.restoredLearningState;
  let latestPersistenceRecordId = previousState.restoredRecord?.recordId;
  const rounds: ContinuousLearningRoundSnapshot[] = [];
  const transitions: LearningRoundTransition[] = [];
  const recentTaskIds: string[] = [];
  const recentExternalResourceIds: string[] = [];
  const processedResponseIds = new Set<string>([
    input.restoredLearningState.restoredRecord?.studentResponse?.responseId || '',
  ].filter(Boolean));
  const restoredResourceId = input.restoredLearningState.restoredRecord?.concreteTask?.questionMetadata.questionId;
  if (input.taskResourceRepository && restoredResourceId) {
    const restoredResource = await input.taskResourceRepository.getResource(restoredResourceId);
    if (restoredResource?.externalResourceId) recentExternalResourceIds.push(restoredResource.externalResourceId);
  }

  if (inputIssues.length > 0) {
    return buildOutput({
      runId,
      input,
      startedAt,
      status: inputIssues.some((issue) => issue.includes('studentId')) ? 'review_required' : 'blocked',
      endReason: inputIssues.some((issue) => issue.includes('studentId')) ? 'review_required' : 'blocked',
      rounds,
      transitions,
      evidence,
      profile,
      growthSummary,
      latestPersistenceRecordId,
      issues: inputIssues,
    });
  }

  for (let roundIndex = 1; roundIndex <= input.maxRounds; roundIndex += 1) {
    const roundAt = timestampForRound(startedAt, roundIndex);
    const learningRoundId = `${runId}-round-${roundIndex}`;
    const roundResources = input.taskResourceRepository
      ? await input.taskResourceRepository.findMatchingResources({
        targetAbilityId: growthSummary.abilityId,
        excludedResourceIds: recentTaskIds,
        excludedExternalResourceIds: recentExternalResourceIds,
      })
      : input.availableTaskResources.filter((item) => !recentTaskIds.includes(item.resourceId));
    const startResult = startLearningRound({
      studentAbilityProfile: profile,
      growthMemorySummary: growthSummary,
      currentLearningContext: {
        ...input.currentLearningContext,
        targetAbilityId: growthSummary.abilityId,
      },
      availableTaskResources: roundResources.map((item) => item.availableTaskResource),
      learningRoundId,
      createdAt: roundAt,
      recentTaskIds,
    });

    if (startResult.status !== 'ready_for_execution' || !startResult.taskFulfillmentRequest) {
      const snapshot = buildStartFailureSnapshot(roundIndex, startResult);
      rounds.push(snapshot);
      const noTask = startResult.nextAction === 'regenerate_task';
      return buildOutput({
        runId,
        input,
        startedAt,
        status: startResult.status === 'review_required' ? 'review_required' : 'blocked',
        endReason: startResult.status === 'review_required' ? 'review_required' : noTask ? 'no_available_task' : 'blocked',
        rounds,
        transitions,
        evidence,
        profile,
        growthSummary,
        latestPersistenceRecordId,
        issues: startResult.issues,
      });
    }

    const selectedResource = findSelectedResource(startResult.taskResourceMatchResult?.selectedTaskId, roundResources);
    if (!selectedResource) {
      rounds.push(buildStartFailureSnapshot(roundIndex, {
        ...startResult,
        status: 'blocked',
        nextAction: 'regenerate_task',
        issues: ['Selected formal TaskResource is missing; generated fallback is not accepted by Phase 12.3.'],
      }));
      return buildOutput({
        runId,
        input,
        startedAt,
        status: 'blocked',
        endReason: 'no_available_task',
        rounds,
        transitions,
        evidence,
        profile,
        growthSummary,
        latestPersistenceRecordId,
        issues: ['Selected formal TaskResource is missing.'],
      });
    }

    const prepared = prepareConcreteLearningTaskFromResource({
      resource: selectedResource,
      fulfillmentRequest: startResult.taskFulfillmentRequest,
      createdAt: roundAt,
    });
    const concreteTask = prepared.concreteTaskResult.concreteTask;
    const readiness = prepared.concreteTaskResult.readiness;
    if (!concreteTask || !readiness.canExecute) {
      rounds.push(buildStartFailureSnapshot(roundIndex, {
        ...startResult,
        status: 'blocked',
        nextAction: 'regenerate_task',
        issues: readiness.issues.map((issue) => issue.message),
      }));
      return buildOutput({
        runId,
        input,
        startedAt,
        status: 'blocked',
        endReason: 'no_available_task',
        rounds,
        transitions,
        evidence,
        profile,
        growthSummary,
        latestPersistenceRecordId,
        issues: readiness.issues.map((issue) => issue.message),
      });
    }

    const hydratedStart = {
      ...startResult,
      concreteTask,
      taskReadinessValidation: readiness,
      executableTask: prepared.concreteTaskResult.inputType === 'executable_task'
        ? startResult.executableTask
        : undefined,
      issues: [],
    };
    const transition = buildTransition({
      previousState,
      previousGrowthRecords: growthRecords,
      growthSummary,
      startResult: hydratedStart,
    });
    if (!transition.traceable) {
      transitions.push(transition);
      rounds.push(buildStartFailureSnapshot(roundIndex, {
        ...hydratedStart,
        status: 'review_required',
        nextAction: 'human_review',
        issues: transition.issues,
      }));
      return buildOutput({
        runId,
        input,
        startedAt,
        status: 'review_required',
        endReason: 'review_required',
        rounds,
        transitions,
        evidence,
        profile,
        growthSummary,
        latestPersistenceRecordId,
        issues: transition.issues,
      });
    }
    transitions.push(transition);

    const submission = input.submissions[roundIndex - 1] || {};
    const executionResult = executeLearningRound({
      startResult: hydratedStart,
      studentAnswer: submission.studentAnswer,
      responseOverrides: submission.responseOverrides,
      abandon: submission.abandon,
      abandonedAt: submission.completedAt,
    });
    const responseId = executionResult.studentResponse?.responseId;
    if (responseId && processedResponseIds.has(responseId)) {
      const snapshot = buildRoundSnapshot(roundIndex, completeLearningRound({
        executionResult: {
          ...executionResult,
          status: 'retry_required',
          canEnterEvidenceReturn: false,
          nextAction: 'supplement_response',
          issues: ['duplicate_response: StudentResponse.responseId has already been processed.'],
        },
        concreteTask,
        completedAt: submission.completedAt || roundAt,
      }), selectedResource.resourceId);
      rounds.push(snapshot);
      return buildOutput({
        runId,
        input,
        startedAt,
        status: 'retry_required',
        endReason: 'response_retry_required',
        rounds,
        transitions,
        evidence,
        profile,
        growthSummary,
        latestPersistenceRecordId,
        issues: ['duplicate_response: StudentResponse.responseId has already been processed.'],
      });
    }
    const roundResult = completeLearningRound({
      executionResult,
      concreteTask,
      previousEvidence: evidence,
      currentProfile: profile,
      diagnosisResult: submission.diagnosisResult,
      diagnosisResultId: submission.diagnosisResultId,
      diagnosisFailed: submission.diagnosisFailed,
      completedAt: submission.completedAt || roundAt,
    });
    const snapshot = buildRoundSnapshot(roundIndex, roundResult, selectedResource.resourceId);
    rounds.push(snapshot);

    if (roundResult.status !== 'completed' || !roundResult.taskEvidenceReturnResult) {
      const mapped = mapIncompleteRound(roundResult.status);
      return buildOutput({
        runId,
        input,
        startedAt,
        status: mapped.status,
        endReason: mapped.endReason,
        rounds,
        transitions,
        evidence,
        profile,
        growthSummary,
        latestPersistenceRecordId,
        issues: roundResult.issues,
      });
    }

    const evidenceReturn = roundResult.taskEvidenceReturnResult;
    evidence = dedupeEvidence([...evidence, ...evidenceReturn.abilityEvidence]);
    if (!evidenceReturn.profileUpdateDecision || !evidenceReturn.growthMemoryRecord) {
      snapshot.issues.push('Completed round is missing ProfileUpdateDecision or GrowthMemoryRecord.');
      return buildOutput({
        runId,
        input,
        startedAt,
        status: 'review_required',
        endReason: 'review_required',
        rounds,
        transitions,
        evidence,
        profile,
        growthSummary,
        latestPersistenceRecordId,
        issues: snapshot.issues,
      });
    }

    profile = applyProfileUpdateDecision({
      currentProfile: profile,
      decision: evidenceReturn.profileUpdateDecision,
      appliedAt: submission.completedAt || roundAt,
    }).afterProfile;
    growthRecords = dedupeGrowthRecords([...growthRecords, evidenceReturn.growthMemoryRecord]);
    growthSummary = summarizeGrowthMemory({
      studentId: input.studentId,
      abilityId: evidenceReturn.growthMemoryRecord.abilityId,
      records: growthRecords,
    });

    const entryState = buildStudentLearningEntryState({
      startResult: hydratedStart,
      answerDraft: submission.studentAnswer?.answerText || '',
    });
    const feedback = buildStudentLearningFeedback({
      entryState,
      learningRoundResult: roundResult,
    });
    const roundSummary = buildStudentRoundSummary({
      learningRoundResult: roundResult,
      studentLearningFeedback: feedback,
      studentLearningEntryState: entryState,
    });
    const persistenceRecord = createLearningPersistenceRecord({
      studentId: input.studentId,
      learningRoundId,
      savedAt: submission.completedAt || roundAt,
      updatedAt: submission.completedAt || roundAt,
      sourceVersion: 'phase12_3_v1',
      learningRoundResult: roundResult,
      concreteTask,
      studentResponse: executionResult.studentResponse,
      studentLearningFeedback: feedback,
      studentRoundSummary: roundSummary,
      growthMemoryRecord: evidenceReturn.growthMemoryRecord,
      growthMemorySummary: growthSummary,
      studentAbilityProfile: profile,
    });

    try {
      const saved = await input.repository.save(persistenceRecord);
      const loaded = await input.repository.loadByRound(input.studentId, learningRoundId);
      const restored = restoreLearningState(loaded, input.studentId);
      if (!restored.canResume || !restored.validation.passed || restored.resumeMode !== 'start_next_round') {
        throw new Error(`Saved round cannot be restored for next round: ${restored.validation.issues.join(' ')}`);
      }
      snapshot.persistenceStatus = 'saved';
      snapshot.persistenceRecordId = saved.recordId;
      latestPersistenceRecordId = saved.recordId;
      previousState = restored;
      recentTaskIds.push(selectedResource.resourceId);
      if (selectedResource.externalResourceId) recentExternalResourceIds.push(selectedResource.externalResourceId);
      if (responseId) processedResponseIds.add(responseId);
    } catch (error) {
      snapshot.persistenceStatus = 'retry_required';
      snapshot.issues.push(error instanceof Error ? error.message : String(error));
      return buildOutput({
        runId,
        input,
        startedAt,
        status: 'retry_required',
        endReason: 'persistence_failed',
        rounds,
        transitions,
        evidence,
        profile,
        growthSummary,
        latestPersistenceRecordId,
        issues: snapshot.issues,
        pendingPersistence: {
          runId,
          roundIndex,
          record: persistenceRecord,
        },
      });
    }
  }

  return buildOutput({
    runId,
    input,
    startedAt,
    status: 'completed',
    endReason: 'max_rounds_reached',
    rounds,
    transitions,
    evidence,
    profile,
    growthSummary,
    latestPersistenceRecordId,
    issues: [],
  });
}

export async function retryContinuousLearningPersistence(
  repository: LearningPersistenceRepository,
  pending: PendingContinuousLearningPersistence,
): Promise<ContinuousLearningPersistenceRetryResult> {
  try {
    const saved = await repository.save(pending.record);
    const loaded = await repository.loadByRound(saved.studentId, saved.learningRoundId);
    const restoredState = restoreLearningState(loaded, saved.studentId);
    const issues = restoredState.validation.issues;
    return {
      saved: restoredState.canResume && restoredState.validation.passed,
      restoredState,
      recordId: saved.recordId,
      issues,
    };
  } catch (error) {
    return {
      saved: false,
      issues: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function validateInput(input: ContinuousLearningRunInput): string[] {
  const issues: string[] = [];
  if (!input.restoredLearningState.canResume || !input.restoredLearningState.validation.passed) {
    issues.push('RestoredLearningState is not valid for continuous learning.');
  }
  const studentIds = [
    input.studentId,
    input.restoredLearningState.studentId,
    input.growthMemorySummary.studentId,
    input.studentAbilityProfile.studentId,
    input.currentLearningContext.studentId,
  ];
  if (new Set(studentIds).size !== 1) issues.push('studentId mismatch across continuous learning inputs.');
  if (input.restoredLearningState.resumeMode !== 'start_next_round') {
    issues.push('RestoredLearningState.resumeMode must be start_next_round.');
  }
  if (!input.restoredLearningState.restoredRecord?.recordId) {
    issues.push('RestoredLearningState is missing a traceable persistence record.');
  }
  if (input.submissions.length < input.maxRounds) {
    issues.push('Submissions do not cover maxRounds.');
  }
  return issues;
}

function buildTransition(input: {
  previousState: RestoredLearningState;
  previousGrowthRecords: GrowthMemoryRecord[];
  growthSummary: GrowthMemorySummary;
  startResult: ReturnType<typeof startLearningRound>;
}): LearningRoundTransition {
  const strategy = input.startResult.nextLearningStrategy;
  const request = input.startResult.taskRequest;
  const task = input.startResult.concreteTask;
  const issues: string[] = [];
  const record = input.previousState.restoredRecord;
  if (!record?.recordId) issues.push('Previous persistence record is missing.');
  if (!strategy) issues.push('NextLearningStrategy is missing.');
  if (!request) issues.push('TaskRequest is missing.');
  if (!task) issues.push('ConcreteLearningTask is missing.');
  if (!input.growthSummary.latestRecordId) issues.push('GrowthMemorySummary.latestRecordId is missing.');
  if (!input.previousGrowthRecords.some((item) => item.recordId === input.growthSummary.latestRecordId)) {
    issues.push('GrowthMemorySummary.latestRecordId is not present in GrowthMemoryRecord history.');
  }

  return {
    transitionId: `transition-${input.previousState.learningRoundId}-${input.startResult.learningRoundId}`,
    studentId: input.startResult.studentId,
    fromLearningRoundId: input.previousState.learningRoundId,
    fromPersistenceRecordId: record?.recordId || 'missing-persistence-record',
    fromGrowthMemoryRecordIds: input.previousGrowthRecords.map((item) => item.recordId),
    fromGrowthMemorySummaryLatestRecordId: input.growthSummary.latestRecordId,
    toLearningRoundId: input.startResult.learningRoundId,
    nextLearningStrategyId: strategy?.strategyId || 'missing-strategy',
    taskRequestId: request?.taskRequestId || 'missing-task-request',
    concreteTaskId: task?.taskId || 'missing-task',
    targetAbilityId: request?.targetAbilityId || 'missing-ability',
    sourceStrategyAction: strategy?.action || 'human_review',
    sourceTaskRole: request?.taskRole || 'observation',
    transitionType: mapTransitionType(strategy?.action, request?.taskRole),
    traceable: issues.length === 0,
    issues,
  };
}

function mapTransitionType(
  action?: NextLearningAction,
  taskRole?: RecommendedTaskRole,
): LearningRoundTransitionType {
  if (action === 'switch_ability') return 'switch_ability';
  if (action === 'independent_retest' || taskRole === 'retest') return 'retest';
  if (action === 'transfer_test' || taskRole === 'transfer') return 'transfer';
  if (action === 'diagnostic_verification' || taskRole === 'diagnosis') return 'diagnostic_verification';
  if (action === 'collect_more_evidence' || taskRole === 'observation') return 'collect_more_evidence';
  return 'continue_same_ability';
}

function buildRoundSnapshot(
  roundIndex: number,
  roundResult: ReturnType<typeof completeLearningRound>,
  resourceId?: string,
): ContinuousLearningRoundSnapshot {
  const start = roundResult.startResult;
  const execution = roundResult.executionResult;
  const returned = roundResult.taskEvidenceReturnResult;
  return {
    roundIndex,
    learningRoundId: roundResult.learningRoundId,
    status: roundResult.status,
    strategyId: start.nextLearningStrategy?.strategyId,
    taskRequestId: start.taskRequest?.taskRequestId,
    resourceId,
    concreteTaskId: start.concreteTask?.taskId,
    executionSessionId: execution.taskExecutionResult?.executionSessionId,
    responseId: execution.studentResponse?.responseId,
    targetAbilityId: start.concreteTask?.targetAbilityId,
    evidenceIds: returned?.abilityEvidence.map((item) => item.id) || [],
    growthMemoryRecordId: returned?.growthMemoryRecord?.recordId,
    persistenceStatus: 'not_started',
    nextStep: roundResult.nextStep,
    issues: [...roundResult.issues],
  };
}

function buildStartFailureSnapshot(
  roundIndex: number,
  startResult: ReturnType<typeof startLearningRound>,
): ContinuousLearningRoundSnapshot {
  return {
    roundIndex,
    learningRoundId: startResult.learningRoundId,
    status: startResult.status === 'review_required' ? 'review_required' : 'blocked',
    strategyId: startResult.nextLearningStrategy?.strategyId,
    taskRequestId: startResult.taskRequest?.taskRequestId,
    concreteTaskId: startResult.concreteTask?.taskId,
    targetAbilityId: startResult.taskRequest?.targetAbilityId,
    evidenceIds: [],
    persistenceStatus: 'not_started',
    nextStep: startResult.status === 'review_required' ? 'human_review' : 'regenerate_task',
    issues: [...startResult.issues],
  };
}

function mapIncompleteRound(status: string): {
  status: ContinuousLearningRunStatus;
  endReason: ContinuousLearningRunEndReason;
} {
  if (status === 'retry_required') return { status: 'retry_required', endReason: 'response_retry_required' };
  if (status === 'review_required') return { status: 'review_required', endReason: 'review_required' };
  if (status === 'abandoned') return { status: 'stopped', endReason: 'student_stopped' };
  return { status: 'blocked', endReason: 'blocked' };
}

function buildOutput(input: {
  runId: string;
  input: ContinuousLearningRunInput;
  startedAt: string;
  status: ContinuousLearningRunStatus;
  endReason: ContinuousLearningRunEndReason;
  rounds: ContinuousLearningRoundSnapshot[];
  transitions: LearningRoundTransition[];
  evidence: AbilityEvidence[];
  profile: StudentAbilityProfile;
  growthSummary: GrowthMemorySummary;
  latestPersistenceRecordId?: string;
  issues: string[];
  pendingPersistence?: PendingContinuousLearningPersistence;
}): ContinuousLearningRunOutput {
  const validation = validateRunResult({
    studentId: input.input.studentId,
    rounds: input.rounds,
    transitions: input.transitions,
    evidence: input.evidence,
    status: input.status,
    issues: input.issues,
  });
  const next = mapNextStep(input.status, input.endReason);
  const result: ContinuousLearningRunResult = {
    runId: input.runId,
    studentId: input.input.studentId,
    startedAt: input.startedAt,
    endedAt: new Date().toISOString(),
    status: input.status,
    endReason: input.endReason,
    maxRounds: input.input.maxRounds,
    completedRoundCount: input.rounds.filter((item) => item.status === 'completed').length,
    rounds: input.rounds,
    transitions: input.transitions,
    latestGrowthMemorySummary: input.growthSummary,
    latestStudentAbilityProfile: input.profile,
    latestPersistenceRecordId: input.latestPersistenceRecordId,
    nextStep: next.nextStep,
    nextStepReason: next.reason,
    validation,
  };

  return {
    result,
    updatedEvidence: input.evidence,
    pendingPersistence: input.pendingPersistence,
  };
}

function validateRunResult(input: {
  studentId: string;
  rounds: ContinuousLearningRoundSnapshot[];
  transitions: LearningRoundTransition[];
  evidence: AbilityEvidence[];
  status: ContinuousLearningRunStatus;
  issues: string[];
}): ContinuousLearningRunResult['validation'] {
  const roundIds = input.rounds.map((item) => item.learningRoundId);
  const evidenceIds = input.evidence.map((item) => item.id);
  const noDuplicateRoundIds = new Set(roundIds).size === roundIds.length;
  const noDuplicateEvidenceIds = new Set(evidenceIds).size === evidenceIds.length;
  const transitionsTraceable = input.transitions.every((item) => item.traceable);
  const persistedBetweenRounds = input.rounds.every((item, index) => (
    index === input.rounds.length - 1 && item.status !== 'completed'
      ? true
      : item.persistenceStatus === 'saved'
  ));
  const studentIdConsistent = input.transitions.every((item) => item.studentId === input.studentId);
  const validationIssues = [
    ...input.issues,
    ...(noDuplicateRoundIds ? [] : ['Duplicate learningRoundId detected.']),
    ...(noDuplicateEvidenceIds ? [] : ['Duplicate AbilityEvidence.id detected.']),
    ...(transitionsTraceable ? [] : ['Untraceable round transition detected.']),
    ...(studentIdConsistent ? [] : ['studentId mismatch detected in transitions.']),
  ];
  const runtimeFailureExpected = input.status !== 'completed';

  return {
    passed: runtimeFailureExpected ? true : validationIssues.length === 0 && persistedBetweenRounds,
    noDuplicateRoundIds,
    noDuplicateEvidenceIds,
    transitionsTraceable,
    persistedBetweenRounds,
    studentIdConsistent,
    issues: uniqueStrings(validationIssues),
  };
}

function mapNextStep(
  status: ContinuousLearningRunStatus,
  endReason: ContinuousLearningRunEndReason,
): { nextStep: ContinuousLearningRunNextStep; reason: string } {
  if (status === 'completed') {
    return {
      nextStep: 'finish_run',
      reason: endReason === 'max_rounds_reached'
        ? '本次连续运行已达到计划轮数；这不代表训练目标已经完成。'
        : '本次连续运行已结束。',
    };
  }
  if (endReason === 'response_retry_required') {
    return { nextStep: 'supplement_response', reason: '当前作答需要补充，完成有效作答后再继续本轮。' };
  }
  if (endReason === 'no_available_task') {
    return { nextStep: 'regenerate_task', reason: '当前没有可执行的正式任务资源，需补充或重新准备任务。' };
  }
  if (status === 'review_required') {
    return { nextStep: 'human_review', reason: '当前结果需要人工复核，不能自动启动下一轮。' };
  }
  if (endReason === 'persistence_failed') {
    return { nextStep: 'continue_next_round', reason: '本轮 Runtime 已完成，但保存失败；只允许重试持久化，保存成功后再继续。' };
  }
  return { nextStep: 'finish_run', reason: '当前连续运行已停止或被阻断。' };
}

function findSelectedResource(
  resourceId: string | undefined,
  resources: TaskResource[],
): TaskResource | undefined {
  if (!resourceId) return undefined;
  return resources.find((item) => item.resourceId === resourceId || item.availableTaskResource.taskId === resourceId);
}

function timestampForRound(startedAt: string, roundIndex: number): string {
  const time = Date.parse(startedAt);
  if (Number.isNaN(time)) return startedAt;
  return new Date(time + roundIndex * 60_000).toISOString();
}

function dedupeEvidence(items: AbilityEvidence[]): AbilityEvidence[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function dedupeGrowthRecords(items: GrowthMemoryRecord[]): GrowthMemoryRecord[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.recordId)) return false;
    seen.add(item.recordId);
    return true;
  });
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function stableId(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}
