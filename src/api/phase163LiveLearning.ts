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
import { resolveRestoredFormalResourceVersionId } from '../ai/agents/learningPersistenceAgent.ts';
import {
  decideLearningFeedbackRevisionOffer,
  type LearningFeedbackRevisionOfferDecision,
} from '../ai/agents/learningFeedbackRevisionOfferPolicy.ts';
import { evaluateLearningFeedbackRevision } from '../ai/agents/learningFeedbackRevisionEvaluationAgent.ts';
import {
  auditLearningFeedbackRevisionObservations,
  buildLearningFeedbackRevisionMetrics,
  type LearningFeedbackRevisionAuditReport,
  type LearningFeedbackRevisionMetrics,
} from '../ai/agents/learningFeedbackRevisionObservationAuditAgent.ts';
import { buildStudentLearningNarrativeProjection } from '../ai/agents/studentLearningNarrativeAgent.ts';
import { createFeedbackExpressionConfigSnapshot } from '../ai/agents/controlledFeedbackExpressionAgent.ts';
import {
  buildStructuredFeedbackFacts,
  buildStudentFeedbackTeachingPlan,
} from '../ai/agents/structuredFeedbackFactsAgent.ts';
import { runTaskExecutionAgent } from '../ai/agents/taskExecutionAgent.ts';
import { scheduleDelayedRetest } from '../ai/agents/delayedRetestSchedulingAgent.ts';
import { createDiagnosisProviderConfigSnapshot } from '../ai/agents/realLLMRuntimeFoundationAgent.ts';
import {
  filterCurrentFormalResourcesForNewLearningSession,
  loadCurrentFormalResourceVersions,
  matchCurrentFormalResource,
  resolveFormalResourceBootstrapMatch,
} from '../ai/agents/phase173FormalResourceMatchingService.ts';
import { buildScopedFormalResourceHistory } from '../ai/agents/formalResourceHistoryScope.ts';
import { selectFormalResourceForLearningSequence } from '../ai/agents/learningTaskSequenceScheduler.ts';
import {
  createLearningSessionTaskQueue,
  resolveLearningSessionTaskQueueProgress,
} from '../ai/agents/learningSessionTaskQueueAgent.ts';
import { REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION } from '../ai/prompts/buildRealAIDiagnosisPromptV4.ts';
import { InMemoryControlledFeedbackRepository } from '../ai/repositories/inMemoryControlledFeedbackRepository.ts';
import { InMemoryFormalDiagnosisRepository } from '../ai/repositories/inMemoryFormalDiagnosisRepository.ts';
import { IndexedDBLearningPersistenceRepository } from '../ai/repositories/indexedDBLearningPersistenceRepository.ts';
import { IndexedDBLearningSessionRepository } from '../ai/repositories/indexedDBLearningSessionRepository.ts';
import { IndexedDBLearningProgressionRepository } from
  '../ai/repositories/indexedDBLearningProgressionRepository.ts';
import { IndexedDBProgressiveLoadStage4Repository } from
  '../ai/repositories/indexedDBProgressiveLoadStage4Repository.ts';
import { IndexedDBPhase163MultiDayRunRepository } from '../ai/repositories/indexedDBPhase163MultiDayRunRepository.ts';
import {
  createBrowserMaterialObservationRepository,
  createBrowserQuestionResourceAdmissionRepository,
} from '../ai/repositories/formalResourceRepositoryRouter.ts';
import { IndexedDBRealLearningOperationRepository } from '../ai/repositories/indexedDBRealLearningOperationRepository.ts';
import { IndexedDBReadingOpenResponseProcessFactRepository } from
  '../ai/repositories/indexedDBReadingOpenResponseProcessFactRepository.ts';
import {
  IndexedDBLearningObservationOutboxRepository,
  IndexedDBLearningObservationRepository,
  IndexedDBLearningTaskAttemptRepository,
  IndexedDBQuestionCalibrationProjectionRepository,
} from '../ai/repositories/indexedDBLearningCollectionRepositories.ts';
import { LocalStorageUnifiedLearningEntryRepository } from '../ai/repositories/localStorageUnifiedLearningEntryRepository.ts';
import { LearningObservationService } from '../ai/services/learningObservationService.ts';
import { QuestionCalibrationProjectionService } from '../ai/services/questionCalibrationProjectionService.ts';
import { LearningFeedbackRevisionPersistenceService } from '../ai/services/learningFeedbackRevisionPersistenceService.ts';
import { LearningProgressionRuntimeService } from
  '../ai/services/learningProgressionRuntimeService.ts';
import { ProgressiveLoadCalibrationService } from
  '../ai/services/progressiveLoadCalibrationService.ts';
import {
  PROGRESSIVE_LOAD_CALIBRATION_EVENT_SCHEMA_VERSION,
  stableProgressiveLoadId,
  type ProgressiveLoadCalibrationEventType,
  type ProgressiveLoadSupportMode,
} from '../ai/schemas/progressiveLoadStage4.schema.ts';
import { resolveLearningProgressionContext } from
  '../ai/agents/learningProgressionContextResolver.ts';
import type { FormalTaskGroupProgressionArtifact } from
  '../ai/schemas/formalTaskProgressionMetadata.schema.ts';
import type { ProgressionSupportMode } from
  '../ai/schemas/progressionPerformanceObservation.schema.ts';
import { ReadingOpenResponseProcessFactService } from
  '../ai/services/readingOpenResponseProcessFactService.ts';
import {
  buildLearningCalibrationAttemptId,
  buildLearningObservationEventId,
  buildLearningSubmissionIntentId,
  buildQuestionPresentationId,
} from '../ai/agents/learningObservationIdentity.ts';
import {
  LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION,
  type LearningObservationEvent,
  type LearningObservationEventPayload,
  type LearningObservationEventType,
} from '../ai/schemas/learningObservationEvent.schema.ts';
import { CURRENT_LEARNING_COLLECTION_GENERATION } from '../ai/schemas/learningCollectionGeneration.ts';
import type { LearningPersistenceRecord } from '../ai/schemas/learningPersistence.schema.ts';
import type {
  LearningTaskAttemptRecord,
  RevisionEvaluation,
  RevisionEvaluationIssue,
  RevisionGoal,
} from '../ai/schemas/learningFeedbackRevision.schema.ts';
import type { RealLearningOperationCheckpoint } from '../ai/schemas/realLearningOperation.schema.ts';
import type { DelayedRetestPlan } from '../ai/schemas/delayedRetestScheduling.schema.ts';
import type {
  CurrentLearningContext,
  NextLearningAction,
  TaskRequest,
} from '../ai/schemas/nextLearningStrategy.schema.ts';
import type { FrozenQuestionResourceVersion } from '../ai/schemas/questionResourceAdmission.schema.ts';
import type { UnifiedLearningActivityContext } from '../ai/schemas/unifiedLearningEntry.schema.ts';
import type {
  SingleChoiceStudentAnswerValue,
  StudentSingleChoiceDelivery,
} from '../ai/schemas/singleChoiceInteraction.schema.ts';
import type { StudentResponse } from '../ai/schemas/taskExecution.schema.ts';
import type { NextFormalTaskResolution } from '../ai/schemas/realLearningOperation.schema.ts';
import type {
  QualityGatedExecutableTask,
  ResourceMatchRecentHistory,
} from '../ai/schemas/resourceMatchQuality.schema.ts';
import type { ControlledFeedbackExpressionInput } from '../ai/schemas/controlledFeedbackExpression.schema.ts';
import type {
  StudentLearningFeedback,
  StudentThinkingReview,
} from '../ai/schemas/studentLearningFeedback.schema.ts';
import {
  toStudentLearningPresentation,
  type StudentLearningPresentation,
} from '../ai/schemas/studentLearningNarrative.schema.ts';
import { runDiagnosisThroughPhase163Boundary } from './phase163DiagnosisBoundary.ts';
import {
  assertPhase163ProductRuntimeIdentity,
  PHASE163_LEARNING_TIMEZONE,
  resolvePhase163LearningStudentId,
} from './phase163LearningIdentity.ts';
import {
  completeTargetedTraining,
  getTargetedTrainingResourceVersion,
  loadTargetedTrainingTransition,
  scheduleTargetedTrainingAfterCoreResult,
  skipTargetedTraining,
  startTargetedTraining,
  type TargetedMicroTrainingLearningTransition,
} from './targetedMicroTrainingLearning.ts';

const TIMEZONE = PHASE163_LEARNING_TIMEZONE;
const PHASE163_RUNTIME_STUDENT_ID = resolvePhase163LearningStudentId();
const operationRepository = new IndexedDBRealLearningOperationRepository();
const persistenceRepository = new IndexedDBLearningPersistenceRepository();
const sessionRepository = new IndexedDBLearningSessionRepository();
const activityRepository = new LocalStorageUnifiedLearningEntryRepository();
const multiDayRepository = new IndexedDBPhase163MultiDayRunRepository();
const formalResourceRepository = createBrowserQuestionResourceAdmissionRepository();
const materialObservationRepository = createBrowserMaterialObservationRepository();
const learningObservationRepository = new IndexedDBLearningObservationRepository();
const learningObservationOutboxRepository = new IndexedDBLearningObservationOutboxRepository();
const questionCalibrationProjectionRepository = new IndexedDBQuestionCalibrationProjectionRepository();
const observationService = new LearningObservationService(
  learningObservationRepository,
  learningObservationOutboxRepository,
);
const calibrationProjectionService = new QuestionCalibrationProjectionService(
  questionCalibrationProjectionRepository,
);
const readingOpenResponseProcessFactRepository =
  new IndexedDBReadingOpenResponseProcessFactRepository();
const readingOpenResponseProcessFactService = new ReadingOpenResponseProcessFactService(
  readingOpenResponseProcessFactRepository,
);
const learningTaskAttemptRepository = new IndexedDBLearningTaskAttemptRepository();
const learningProgressionRepository = new IndexedDBLearningProgressionRepository();
const learningProgressionRuntimeService = new LearningProgressionRuntimeService(
  learningProgressionRepository,
);
const progressiveLoadStage4Repository = new IndexedDBProgressiveLoadStage4Repository();
const progressiveLoadCalibrationService = new ProgressiveLoadCalibrationService(
  progressiveLoadStage4Repository,
);
const feedbackRevisionPersistenceService = new LearningFeedbackRevisionPersistenceService(
  learningTaskAttemptRepository,
);
const LEARNING_APP_VERSION = CURRENT_LEARNING_COLLECTION_GENERATION;

export type Phase163LiveWorkspaceState = {
  status: 'ready' | 'submitting' | 'completed' | 'retry_required' | 'review_required' | 'blocked';
  sessionId: string;
  roundId: string;
  roundNumber: number;
  sessionTaskCount: number;
  sessionComplete: boolean;
  task: {
    title: string;
    materialTitle?: string;
    materialAuthor?: string;
    abilityId: string;
    focus: string;
    readingText: string;
    questionText: string;
    responseFormat: 'text' | 'single_choice';
    minimumAnswerLength: number;
    singleChoice?: StudentSingleChoiceDelivery;
  };
  answerDraft: string;
  singleChoiceDraft?: SingleChoiceStudentAnswerValue;
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
  isTargetedMicroTraining?: boolean;
  targetedMicroTraining?: TargetedMicroTrainingLearningTransition;
  primaryAction: 'submit_answer' | 'resume_processing' | 'retry_resource' | 'start_next_task' | 'return_to_entry';
  pauseReason?: StudentRuntimePauseReason;
  studentTitle?: string;
  studentMessage?: string;
  revision?: {
    learningTaskAttemptId: string;
    status:
      | 'offered'
      | 'draft'
      | 'submitted'
      | 'evaluating'
      | 'evaluated'
      | 'evaluation_pending_retry';
    offerLevel?: 'optional' | 'recommended';
    actionLabel?: '根据反馈修订' | '完善回答';
    revisionGoal: RevisionGoal;
    initialAnswer: string;
    draftAnswer?: string;
    draftUpdatedAt?: string;
    evaluation?: RevisionEvaluation;
    evaluationIssue?: RevisionEvaluationIssue;
    evaluationAttemptCount?: number;
  };
};

export type Phase163LearningTaskAvailability = {
  state: 'available' | 'no_formal_resource' | 'no_eligible_match' | 'already_used' | 'stale_session' | 'read_failed';
  available: boolean;
  message: string;
};

export type Phase163FeedbackRevisionObservationReport = {
  audit: LearningFeedbackRevisionAuditReport;
  metrics: LearningFeedbackRevisionMetrics;
};

export async function loadPhase163FeedbackRevisionObservationReport(options: {
  recoverPending?: boolean;
} = {}): Promise<Phase163FeedbackRevisionObservationReport> {
  if (options.recoverPending !== false) {
    await observationService.retryDue().catch(() => undefined);
  }
  const [attempts, events, outboxEntries, projections] = await Promise.all([
    learningTaskAttemptRepository.listByStudent(PHASE163_RUNTIME_STUDENT_ID),
    learningObservationRepository.listByStudent(PHASE163_RUNTIME_STUDENT_ID),
    learningObservationOutboxRepository.listAll(),
    questionCalibrationProjectionRepository.listByStudent(PHASE163_RUNTIME_STUDENT_ID),
  ]);
  return {
    audit: auditLearningFeedbackRevisionObservations({ attempts, events, outboxEntries, projections }),
    metrics: buildLearningFeedbackRevisionMetrics({ attempts, events }),
  };
}

export async function loadPhase163LiveWorkspace(): Promise<Phase163LiveWorkspaceState> {
  const descriptor = await buildCurrentRoundDescriptor();
  const checkpoint = await operationRepository.getByOperationId(descriptor.input.operationId);
  const persisted = await persistenceRepository.loadByRound(PHASE163_RUNTIME_STUDENT_ID, descriptor.input.learningRoundId);
  if (persisted) {
    assertPhase163ProductRuntimeIdentity({
      studentId: persisted.studentId,
      learningRoundId: persisted.learningRoundId,
    });
  }
  if (checkpoint) assertPhase163ProductRuntimeIdentity(checkpoint);
  await recoverPhase163LearningObservations(descriptor, checkpoint, persisted).catch(() => {
    // Observation recovery is non-critical and must never block workspace loading.
  });
  await progressiveLoadCalibrationService.retryDue().catch(() => {
    // Progressive-load calibration recovery is also non-critical.
  });
  if (!checkpoint) return readyState(descriptor, persisted?.answerDraft || '', persisted?.singleChoiceDraft);
  return await stateFromCheckpoint(descriptor, checkpoint, persisted?.answerDraft || '', persisted?.singleChoiceDraft);
}

export async function startPhase163TargetedMicroTraining(
  assignmentId: string,
): Promise<Phase163LiveWorkspaceState> {
  await startTargetedTraining(PHASE163_RUNTIME_STUDENT_ID, assignmentId);
  return loadPhase163LiveWorkspace();
}

export async function skipPhase163TargetedMicroTraining(
  assignmentId: string,
): Promise<Phase163LiveWorkspaceState> {
  await skipTargetedTraining(PHASE163_RUNTIME_STUDENT_ID, assignmentId);
  return loadPhase163LiveWorkspace();
}

export async function resumePhase163CoreAfterTargetedMicroTraining(): Promise<Phase163LiveWorkspaceState> {
  return loadPhase163LiveWorkspace();
}

export async function recordPhase163QuestionPresented(roundId: string): Promise<void> {
  const descriptor = await buildCurrentRoundDescriptor();
  if (descriptor.input.learningRoundId !== roundId) return;
  const presentationId = buildQuestionPresentationId({
    studentId: descriptor.input.studentId,
    learningRoundId: roundId,
    resourceVersionId: descriptor.input.resourceVersion.resourceVersionId,
  });
  await recordObservation(descriptor, 'question_presented', presentationId, {
    kind: 'question_presented',
    presentationId,
  });
  const current = readHintMarker(roundId);
  writeHintMarker(roundId, {
    presentedAt: current?.presentedAt || new Date().toISOString(),
    firstInputAt: current?.firstInputAt,
    hintOpened: current?.hintOpened || false,
  });
}

export function recordPhase163PreAnswerHintOpened(roundId: string): void {
  const current = readHintMarker(roundId);
  writeHintMarker(roundId, {
    presentedAt: current?.presentedAt || new Date().toISOString(),
    firstInputAt: current?.firstInputAt,
    hintOpened: true,
  });
  void recordDirectProgressiveLoadEventForRound(roundId, 'hint_opened', `hint:${roundId}`);
}

export function recordPhase163FirstInputObserved(roundId: string): void {
  const current = readHintMarker(roundId);
  if (current?.firstInputAt) return;
  writeHintMarker(roundId, {
    presentedAt: current?.presentedAt || new Date().toISOString(),
    firstInputAt: new Date().toISOString(),
    hintOpened: current?.hintOpened || false,
  });
}

export async function recordPhase163FeedbackPresented(roundId: string): Promise<void> {
  const descriptor = await buildCurrentRoundDescriptor();
  if (descriptor.input.learningRoundId !== roundId) return;
  const checkpoint = await operationRepository.getByOperationId(descriptor.input.operationId);
  const response = checkpoint?.taskExecutionResult?.studentResponse;
  const feedback = checkpoint?.controlledFeedbackResult;
  if (!checkpoint || !response || !feedback?.studentLearningFeedback) return;
  const submissionIntentId = submissionIntentForResponse(response);
  const attemptId = attemptIdFor(descriptor, submissionIntentId);
  await recordObservation(descriptor, 'feedback_presented', feedback.feedbackRequestId, {
    kind: 'feedback_presented',
    responseId: response.responseId,
    attemptId,
    feedbackRequestId: feedback.feedbackRequestId,
    feedbackSchemaVersion: feedback.schemaVersion,
  }, checkpoint.updatedAt);
}

export async function savePhase163LiveDraft(
  answerDraft: string,
  singleChoiceDraft?: SingleChoiceStudentAnswerValue,
): Promise<void> {
  const descriptor = await buildCurrentRoundDescriptor();
  const existing = await persistenceRepository.loadByRound(PHASE163_RUNTIME_STUDENT_ID, descriptor.input.learningRoundId);
  await persistenceRepository.save({
    recordId: existing?.recordId || `${PHASE163_RUNTIME_STUDENT_ID}::${descriptor.input.learningRoundId}`,
    studentId: PHASE163_RUNTIME_STUDENT_ID,
    learningRoundId: descriptor.input.learningRoundId,
    savedAt: existing?.savedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 'phase12_1_v1',
    schemaVersion: 'learning_persistence_v1',
    concreteTask: descriptor.concreteTask,
    answerDraft,
    singleChoiceDraft,
    status: 'saved',
    issues: [],
  });
}

export async function submitPhase163LiveAnswer(
  answer: string | SingleChoiceStudentAnswerValue,
): Promise<Phase163LiveWorkspaceState> {
  const descriptor = await buildCurrentRoundDescriptor();
  const answerText = typeof answer === 'string' ? answer : '';
  const singleChoiceAnswer = typeof answer === 'string' ? undefined : answer;
  const existingCheckpoint = await operationRepository.getByOperationId(descriptor.input.operationId);
  const submittedAt = existingCheckpoint?.taskExecutionResult?.studentResponse?.submittedAt
    || new Date().toISOString();
  const validityPreflight = runTaskExecutionAgent({
    concreteTask: descriptor.concreteTask,
    readiness: descriptor.readiness,
    studentAnswer: { answerText: answerText.trim(), singleChoiceAnswer, submittedAt },
    startedAt: submittedAt,
  });
  const preflightResponse = validityPreflight.taskExecutionResult?.studentResponse;
  if (preflightResponse) {
    const submissionIntentId = submissionIntentForResponse(preflightResponse);
    const attemptId = attemptIdFor(descriptor, submissionIntentId);
    await recordObservation(descriptor, 'answer_submitted', submissionIntentId, {
      kind: 'answer_submitted',
      responseId: preflightResponse.responseId,
      attemptId,
      submittedAt: preflightResponse.submittedAt,
      responseFormat: preflightResponse.responseFormat || 'text',
      selectedOptionIds: preflightResponse.singleChoiceAnswer?.selectedOptionIds,
      optionSetVersion: preflightResponse.singleChoiceAnswer?.optionSetVersion,
      displayedOptionOrder: preflightResponse.singleChoiceAnswer?.displayedOptionOrder,
    }, preflightResponse.submittedAt,
    validityPreflight.taskExecutionResult?.canEnterDiagnosisRuntime
      ? 'valid_response_submitted' : 'invalid_response_rejected');
    await synchronizeReadingOpenResponseProcessFact(
      descriptor,
      attemptId,
      preflightResponse.submittedAt,
      validityPreflight.taskExecutionResult?.responseValidity.status || 'insufficient',
      false,
    ).catch(() => undefined);
    if (!validityPreflight.taskExecutionResult?.canEnterDiagnosisRuntime) {
      await projectPhase163CalibrationAttempt(
        descriptor,
        validityPreflight.taskExecutionResult,
        undefined,
        undefined,
      );
    }
  }
  if (!validityPreflight.taskExecutionResult?.canEnterDiagnosisRuntime) {
    const validity = validityPreflight.taskExecutionResult?.responseValidity;
    const copiedMaterial = validity?.reasons.some((reason) => reason.includes('复制阅读材料'));
    await savePhase163LiveDraft(answerText, singleChoiceAnswer);
    await observationService.retryDue().catch(() => undefined);
    return {
      ...readyState(descriptor, answerText, singleChoiceAnswer),
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
    singleChoiceAnswer,
    submittedAt,
  };
  const result = await runPhase163RealLearningChain(input, {
    formalDiagnosisRepository: new InMemoryFormalDiagnosisRepository(),
    controlledFeedbackRepository: new InMemoryControlledFeedbackRepository(),
    learningPersistenceRepository: persistenceRepository,
    operationRepository,
    learningProgressionRuntimeService,
    runDiagnosisRuntime: runDiagnosisThroughPhase163Boundary,
    resolveNextTask: ({ taskRequest, previousResourceVersion }) => descriptor.isTargetedMicroTraining
      ? Promise.resolve({
          status: 'session_complete' as const,
          taskRequestId: taskRequest.taskRequestId,
          issues: [],
        })
      : resolveNextFormalTask(taskRequest, previousResourceVersion),
    now: () => submittedAt,
  });

  if (result.checkpoint.nextAction === 'submit_answer') {
    await savePhase163LiveDraft(answerText, singleChoiceAnswer);
  }

  const persistence = await persistenceRepository.loadByRound(PHASE163_RUNTIME_STUDENT_ID, input.learningRoundId);
  await recordRuntimeCompletionObservations(descriptor, result.checkpoint, persistence);
  await projectPhase163CalibrationAttempt(descriptor, result.checkpoint.taskExecutionResult, result.checkpoint, persistence);
  await observationService.retryDue().catch(() => undefined);
  if (persistence?.learningRoundResult) await appendRoundToCurrentSession(persistence);
  await recordNaturalDay(result, descriptor.retestPlan);
  return await stateFromCheckpoint(descriptor, result.checkpoint, answerText, singleChoiceAnswer);
}

async function recoverPhase163LearningObservations(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  checkpoint: RealLearningOperationCheckpoint | undefined,
  persistence: LearningPersistenceRecord | undefined,
): Promise<void> {
  await observationService.retryDue();
  const response = checkpoint?.taskExecutionResult?.studentResponse;
  if (!checkpoint || !response) return;
  const submissionIntentId = submissionIntentForResponse(response);
  const attemptId = attemptIdFor(descriptor, submissionIntentId);
  const events: LearningObservationEvent[] = [];
  const submitted = buildObservation(descriptor, 'answer_submitted', submissionIntentId, {
    kind: 'answer_submitted',
    responseId: response.responseId,
    attemptId,
    submittedAt: response.submittedAt,
  }, response.submittedAt);
  if (submitted) events.push(submitted);
  const formalCommit = checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit;
  if (formalCommit?.status === 'committed' && formalCommit.committedAt) {
    const diagnosis = buildObservation(descriptor, 'diagnosis_completed', formalCommit.formalDiagnosisId, {
      kind: 'diagnosis_completed',
      responseId: response.responseId,
      attemptId,
      formalDiagnosisId: formalCommit.formalDiagnosisId,
      diagnosisSchemaVersion: formalCommit.schemaVersion,
    }, formalCommit.committedAt);
    if (diagnosis) events.push(diagnosis);
  }
  if (persistence?.learningRoundResult?.status === 'completed') {
    const completed = buildObservation(descriptor, 'learning_round_completed', persistence.recordId, {
      kind: 'learning_round_completed',
      responseId: response.responseId,
      attemptId,
      persistenceRecordId: persistence.recordId,
      completedAt: persistence.updatedAt,
    }, persistence.updatedAt);
    if (completed) events.push(completed);
  }
  await observationService.reconcileRound(descriptor.input.learningRoundId, events);
  const revisionAttempt = await learningTaskAttemptRepository.getByInitialAttemptId(attemptId);
  if (revisionAttempt) await synchronizeFeedbackRevisionObservations(descriptor, revisionAttempt);
  await projectPhase163CalibrationAttempt(descriptor, checkpoint.taskExecutionResult, checkpoint, persistence);
}

async function projectPhase163CalibrationAttempt(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  execution: RealLearningOperationCheckpoint['taskExecutionResult'],
  checkpoint: RealLearningOperationCheckpoint | undefined,
  persistence: LearningPersistenceRecord | undefined,
): Promise<void> {
  const response = execution?.studentResponse;
  if (!response) return;
  const submissionIntentId = submissionIntentForResponse(response);
  const formalCommit = checkpoint?.realDiagnosisRuntimeResult?.formalDiagnosisCommit;
  const version = descriptor.input.resourceVersion;
  const identityIssues = [
    response.studentId !== descriptor.input.studentId ? 'projection_response_student_mismatch' : undefined,
    response.taskId !== descriptor.concreteTask.taskId ? 'projection_response_task_mismatch' : undefined,
    checkpoint && checkpoint.learningRoundId !== descriptor.input.learningRoundId ? 'projection_round_mismatch' : undefined,
    checkpoint && checkpoint.sourceResourceVersionId !== version.resourceVersionId ? 'projection_resource_version_mismatch' : undefined,
    formalCommit && checkpoint?.realDiagnosisRuntimeResult?.runRecord.responseId !== response.responseId
      ? 'projection_diagnosis_response_mismatch'
      : undefined,
  ].filter((issue): issue is string => Boolean(issue));
  const completed = persistence?.learningRoundResult?.status === 'completed';
  await synchronizeReadingOpenResponseProcessFact(
    descriptor,
    attemptIdFor(descriptor, submissionIntentId),
    response.submittedAt,
    execution?.responseValidity.status || 'insufficient',
    completed,
    completed ? persistence.updatedAt : undefined,
  ).catch(() => undefined);
  await calibrationProjectionService.project({
    attemptId: attemptIdFor(descriptor, submissionIntentId),
    runtimeScope: 'product',
    studentId: descriptor.input.studentId,
    operationId: descriptor.input.operationId,
    learningSessionId: descriptor.input.learningSessionId,
    learningRoundId: descriptor.input.learningRoundId,
    responseId: response.responseId,
    responseValidityStatus: execution?.responseValidity.status,
    roundCompleted: completed,
    completedAt: completed ? persistence.updatedAt : undefined,
    formalDiagnosisId: formalCommit?.formalDiagnosisId,
    formalDiagnosisCommitted: formalCommit?.status === 'committed',
    rubricItems: formalCommit?.diagnosisResult?.rubricItems,
    responseFormat: response.responseFormat || 'text',
    choiceOutcome: response.singleChoiceAnswer ? {
      correct: formalCommit?.diagnosisResult?.correct === true,
      selectedOptionIds: response.singleChoiceAnswer.selectedOptionIds,
      optionSetVersion: response.singleChoiceAnswer.optionSetVersion,
      displayedOptionOrder: response.singleChoiceAnswer.displayedOptionOrder,
      misconceptionCode: formalCommit?.diagnosisResult?.strategyUsed.replace('single_choice_distractor_', ''),
    } : undefined,
    resourceVersionId: version.resourceVersionId,
    projectedAt: persistence?.updatedAt || formalCommit?.committedAt || response.submittedAt,
    identityIssues,
  });
}

async function recordRuntimeCompletionObservations(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  checkpoint: Awaited<ReturnType<typeof runPhase163RealLearningChain>>['checkpoint'],
  persistence: LearningPersistenceRecord | undefined,
): Promise<void> {
  const response = checkpoint.taskExecutionResult?.studentResponse;
  if (!response) return;
  const submissionIntentId = submissionIntentForResponse(response);
  const attemptId = attemptIdFor(descriptor, submissionIntentId);
  const formalCommit = checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit;
  if (formalCommit?.status === 'committed' && formalCommit.committedAt) {
    await recordObservation(descriptor, 'diagnosis_completed', formalCommit.formalDiagnosisId, {
      kind: 'diagnosis_completed',
      responseId: response.responseId,
      attemptId,
      formalDiagnosisId: formalCommit.formalDiagnosisId,
      diagnosisSchemaVersion: formalCommit.schemaVersion,
    }, formalCommit.committedAt);
  }
  if (persistence?.learningRoundResult?.status === 'completed') {
    await recordObservation(descriptor, 'learning_round_completed', persistence.recordId, {
      kind: 'learning_round_completed',
      responseId: response.responseId,
      attemptId,
      persistenceRecordId: persistence.recordId,
      completedAt: persistence.updatedAt,
    }, persistence.updatedAt);
  }
}

async function recordObservation(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  eventType: LearningObservationEventType,
  sourceEntityId: string,
  payload: LearningObservationEventPayload,
  occurredAt = new Date().toISOString(),
  calibrationEventType?: ProgressiveLoadCalibrationEventType,
): Promise<void> {
  const event = buildObservation(descriptor, eventType, sourceEntityId, payload, occurredAt);
  if (!event) return;
  await observationService.record(event);
  await progressiveLoadCalibrationService.recordFromLearningObservation({
    observation: event,
    context: descriptor.input.progressionContextSnapshot,
    supportMode: descriptor.input.progressionSupportMode,
    responseFormat: descriptor.input.resourceVersion.responseFormat === 'single_choice'
      ? 'single_choice' : 'text',
    taskLoadRisk: descriptor.input.progressionTaskLoadRisk,
    eventTypeOverride: calibrationEventType,
  });
}

async function recordDirectProgressiveLoadEventForRound(
  roundId: string,
  eventType: ProgressiveLoadCalibrationEventType,
  sourceEntityId: string,
): Promise<void> {
  try {
    const descriptor = await buildCurrentRoundDescriptor();
    if (descriptor.input.learningRoundId !== roundId) return;
    await recordDirectProgressiveLoadEvent(descriptor, eventType, sourceEntityId);
  } catch {
    // Progressive-load collection is observational and cannot block Learning UI actions.
  }
}

async function recordDirectProgressiveLoadEvent(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  eventType: ProgressiveLoadCalibrationEventType,
  sourceEntityId: string,
  occurredAt = new Date().toISOString(),
): Promise<void> {
  const context = descriptor.input.progressionContextSnapshot;
  const supportMode = normalizeProgressiveSupportMode(descriptor.input.progressionSupportMode);
  await progressiveLoadCalibrationService.recordEvent({
    schemaVersion: PROGRESSIVE_LOAD_CALIBRATION_EVENT_SCHEMA_VERSION,
    eventId: stableProgressiveLoadId('progressive-calibration-direct-event', [
      descriptor.input.learningSessionId,
      descriptor.input.learningRoundId,
      descriptor.input.resourceVersion.resourceVersionId,
      eventType,
      sourceEntityId,
      supportMode,
      context.snapshotHash,
    ]),
    eventType,
    runtimeScope: 'product',
    studentId: descriptor.input.studentId,
    learningSessionId: descriptor.input.learningSessionId,
    learningRoundId: descriptor.input.learningRoundId,
    learningTaskAttemptId: context.learningTaskAttemptId,
    resourceVersionId: descriptor.input.resourceVersion.resourceVersionId,
    materialVersionId: descriptor.input.resourceVersion.materialVersionId
      || context.materialVersionId,
    progressionPlanHash: context.taskGroupProgressionPlanHash,
    taskLoadSemanticsHash: context.taskLoadSemanticsHash,
    observationThreadId: context.taskLoadSemantics?.observationThreadId,
    sequenceRank: context.sequenceRank,
    supportMode,
    responseFormat: descriptor.input.resourceVersion.responseFormat === 'single_choice'
      ? 'single_choice' : 'text',
    taskLoadRisk: descriptor.input.progressionTaskLoadRisk,
    occurredAt,
    source: 'real_learning',
  });
}

function normalizeProgressiveSupportMode(
  value: ProgressionSupportMode | ProgressiveLoadSupportMode | undefined,
): ProgressiveLoadSupportMode {
  if (value === 'independent_initial') return 'initial_independent';
  if (value === 'hint_supported_initial') return 'hint_supported';
  return value || 'initial_independent';
}

async function synchronizeFeedbackRevisionObservations(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  attempt: LearningTaskAttemptRecord,
): Promise<void> {
  const revision = attempt.revision;
  if (!revision) return;
  const events: LearningObservationEvent[] = [];
  const started = buildObservation(descriptor, 'revision_started', revision.revisionId, {
    kind: 'revision_started',
    responseId: attempt.initialResponse.responseId,
    attemptId: attempt.initialAttemptId,
    learningTaskAttemptId: attempt.learningTaskAttemptId,
    revisionId: revision.revisionId,
    startedAt: revision.createdAt,
  }, revision.createdAt);
  if (started) events.push(started);

  if (revision.revisedResponse) {
    const submitted = buildObservation(
      descriptor,
      'revision_submitted',
      revision.revisedResponse.responseId,
      {
        kind: 'revision_submitted',
        responseId: revision.revisedResponse.responseId,
        attemptId: attempt.initialAttemptId,
        learningTaskAttemptId: attempt.learningTaskAttemptId,
        revisionId: revision.revisionId,
        initialResponseId: attempt.initialResponse.responseId,
        submittedAt: revision.revisedResponse.submittedAt,
      },
      revision.revisedResponse.submittedAt,
    );
    if (submitted) events.push(submitted);
  }

  if (revision.evaluation && revision.feedbackSupportedEvidence) {
    const completed = buildObservation(
      descriptor,
      'revision_evaluation_completed',
      revision.evaluation.revisionEvaluationId,
      {
        kind: 'revision_evaluation_completed',
        responseId: revision.revisedResponse!.responseId,
        attemptId: attempt.initialAttemptId,
        learningTaskAttemptId: attempt.learningTaskAttemptId,
        revisionId: revision.revisionId,
        revisionEvaluationId: revision.evaluation.revisionEvaluationId,
        feedbackSupportedEvidenceId: revision.feedbackSupportedEvidence.evidenceId,
        outcome: revision.evaluation.outcome,
        policyVersion: revision.evaluation.policyVersion,
        completedAt: revision.evaluation.evaluatedAt,
      },
      revision.evaluation.evaluatedAt,
    );
    if (completed) events.push(completed);
  }

  await observationService.reconcileRound(descriptor.input.learningRoundId, events);
}

function buildObservation(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  eventType: LearningObservationEventType,
  sourceEntityId: string,
  payload: LearningObservationEventPayload,
  occurredAt = new Date().toISOString(),
): LearningObservationEvent | undefined {
  const version = descriptor.input.resourceVersion;
  if (!version.materialVersionId) return undefined;
  const event: LearningObservationEvent = {
    schemaVersion: LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION,
    eventId: buildLearningObservationEventId({
      schemaVersion: LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION,
      eventType,
      studentId: descriptor.input.studentId,
      learningSessionId: descriptor.input.learningSessionId,
      learningRoundId: descriptor.input.learningRoundId,
      sourceEntityId,
    }),
    eventType,
    occurredAt,
    recordedAt: new Date().toISOString(),
    runtimeScope: 'product',
    studentId: PHASE163_RUNTIME_STUDENT_ID,
    operationId: descriptor.input.operationId,
    learningSessionId: descriptor.input.learningSessionId,
    learningRoundId: descriptor.input.learningRoundId,
    materialVersionId: version.materialVersionId,
    resourceId: version.resourceId,
    resourceVersionId: version.resourceVersionId,
    taskId: version.taskId,
    sourceEntityId,
    appVersion: LEARNING_APP_VERSION,
    payload,
  };
  return event;
}

function attemptIdFor(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  submissionIntentId: string,
): string {
  return buildLearningCalibrationAttemptId({
    studentId: descriptor.input.studentId,
    learningSessionId: descriptor.input.learningSessionId,
    learningRoundId: descriptor.input.learningRoundId,
    submissionIntentId,
  });
}

export async function advancePhase163LiveRound(): Promise<Phase163LiveWorkspaceState> {
  const descriptor = await buildCurrentRoundDescriptor();
  const context = await requireActiveContext();
  const current = roundNumber(context.currentLearningRoundId);
  if (context.taskQueue && current >= context.taskQueue.targetTaskCount) {
    throw new Error('当前题组已经完成，不能继续创建下一题。');
  }
  const nextRoundId = `${context.learningSessionId}-round-${current + 1}`;
  const write = await activityRepository.save({
    ...context,
    currentLearningRoundId: nextRoundId,
    updatedAt: new Date().toISOString(),
  });
  if (write.status === 'conflict') {
    throw new Error('当前学习会话已经变化，请重新打开学习入口。');
  }
  await recordDirectProgressiveLoadEvent(
    descriptor,
    'next_task_entered',
    `${descriptor.input.learningRoundId}:next:${nextRoundId}`,
  );
  try {
    return await loadPhase163LiveWorkspace();
  } catch (error) {
    await activityRepository.save({
      ...context,
      updatedAt: new Date().toISOString(),
    });
    throw error;
  }
}

export async function loadPhase163DueRetestPlans(): Promise<DelayedRetestPlan[]> {
  const records = await persistenceRepository.listByStudent(PHASE163_RUNTIME_STUDENT_ID);
  const latest = records.filter((item) => item.growthMemorySummary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!latest?.growthMemorySummary) return [];
  const history = await queryLearningSessionHistory(sessionRepository, { studentId: PHASE163_RUNTIME_STUDENT_ID });
  const evidence = records.flatMap((item) => item.learningRoundResult?.taskEvidenceReturnResult?.abilityEvidence || []);
  const result = scheduleDelayedRetest({
    studentId: PHASE163_RUNTIME_STUDENT_ID,
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

export async function resolveCurrentLearningTaskAvailability(): Promise<Phase163LearningTaskAvailability> {
  try {
    const selection = await resolveCurrentFormalTaskSelection(false);
    if (selection.currentVersions.length === 0) {
      if (selection.identityCurrentVersionCount > 0) {
        return {
          state: 'no_eligible_match',
          available: false,
          message: '当前正式题目正在按最新质量规范优化，暂时没有可开始的新任务。',
        };
      }
      return {
        state: 'no_formal_resource',
        available: false,
        message: '当前还没有可用的正式任务。',
      };
    }
    if (
      selection.matched.status === 'matched' &&
      selection.matched.resourceVersion &&
      selection.matched.qualityGatedTask
    ) {
      return {
        state: 'available',
        available: true,
        message: '任务已经准备好，可以开始本次学习。',
      };
    }
    const identityCandidates = selection.currentVersions.filter((version) => (
      version.abilityMetadata.abilityId === selection.taskRequest.targetAbilityId &&
      version.abilityMetadata.taskRole === selection.taskRequest.taskRole
    ));
    const usedVersionIds = new Set(selection.recentHistory.recentResourceVersionIds);
    const usedMaterialIds = new Set(selection.recentHistory.recentMaterialIds);
    const exhausted = identityCandidates.length > 0 && identityCandidates.every((version) => (
      usedVersionIds.has(version.resourceVersionId) ||
      (
        selection.taskRequest.taskRole === 'transfer' &&
        Boolean(version.materialId && usedMaterialIds.has(version.materialId))
      )
    ));
    return exhausted
      ? {
          state: 'already_used',
          available: false,
          message: '当前符合学习目标的正式任务已经使用过，请稍后再来。',
        }
      : {
          state: 'no_eligible_match',
          available: false,
          message: '当前没有同时符合能力和任务要求的正式任务。',
        };
  } catch (error) {
    const message = error instanceof Error ? error.message : '正式任务读取失败。';
    if (/正式版本已不可用/.test(message)) {
      return {
        state: 'stale_session',
        available: false,
        message: '当前旧题组引用的正式题目已经更新，无法安全继续。已有学习结果已经保留，请结束本次学习后重新开始。',
      };
    }
    return {
      state: 'read_failed',
      available: false,
      message,
    };
  }
}

async function ensureActiveSessionTaskQueue(
  context: UnifiedLearningActivityContext,
  currentVersions: FrozenQuestionResourceVersion[],
  firstResourceVersion: FrozenQuestionResourceVersion,
  createdAt: string,
  currentTaskNumber: number,
): Promise<UnifiedLearningActivityContext> {
  const queuedCurrentResourceVersionId = context.taskQueue
    ?.resourceVersionIds[currentTaskNumber - 1];
  if (
    context.taskQueue &&
    context.taskQueue.materialId === firstResourceVersion.materialId &&
    queuedCurrentResourceVersionId === firstResourceVersion.resourceVersionId
  ) {
    return context;
  }
  const taskQueue = createLearningSessionTaskQueue({
    firstResourceVersion,
    currentVersions,
    progressionArtifacts: await loadProgressionArtifacts(currentVersions),
    createdAt,
    currentTaskNumber,
  });
  const nextContext: UnifiedLearningActivityContext = {
    ...context,
    taskQueue,
    updatedAt: createdAt,
  };
  const write = await activityRepository.save(nextContext);
  if (write.status === 'conflict') {
    throw new Error('当前学习会话已经变化，请返回学习入口后继续。');
  }
  return write.context;
}

async function buildCurrentRoundDescriptor() {
  const selection = await resolveCurrentFormalTaskSelection(true);
  const {
    context,
    roundId,
    number,
    records,
    latest,
    currentCheckpoint,
    retestPlan,
    currentVersions,
    taskRequest,
    matched,
    isTargetedMicroTraining,
    targetedAssignmentId,
  } = selection;
  if (!context || !roundId) throw new Error('请先从学习入口开始本次学习。');
  if (
    matched.status !== 'matched' ||
    !matched.resourceVersion ||
    !matched.qualityGatedTask
  ) {
    const role = taskRequest.taskRole;
    throw new Error(role === 'retest'
      ? '暂无符合复测要求的正式任务。'
      : '暂无符合当前能力和任务要求的正式任务。');
  }
  const version = matched.resourceVersion;
  const taskQueueContext = isTargetedMicroTraining
    ? context
    : await ensureActiveSessionTaskQueue(
        context,
        currentVersions,
        version,
        selection.descriptorAt,
        number,
      );
  const queueProgress = resolveLearningSessionTaskQueueProgress(
    taskQueueContext.taskQueue,
    number,
  );
  const qualityTask = matched.qualityGatedTask;
  const progressionArtifact = version.progressionMetadata
    ? await learningProgressionRepository.getArtifact(
        version.progressionMetadata.taskGroupProgressionPlanHash,
      ).catch(() => null)
    : null;
  const progressionContextSnapshot = await learningProgressionRuntimeService.freezeAttemptContext(
    resolveLearningProgressionContext({
      studentId: PHASE163_RUNTIME_STUDENT_ID,
      learningSessionId: taskQueueContext.learningSessionId,
      learningRoundId: roundId,
      learningTaskAttemptId: buildProgressionAttemptId({
        studentId: PHASE163_RUNTIME_STUDENT_ID,
        learningSessionId: taskQueueContext.learningSessionId,
        learningRoundId: roundId,
        resourceVersionId: version.resourceVersionId,
      }),
      resourceVersion: version,
      activeResourceVersions: currentVersions,
      progressionArtifact,
      capturedAt: selection.descriptorAt,
    }),
  );
  const preparation = prepareConcreteLearningTaskFromFrozenResource({
    resourceVersion: version,
    qualityGatedTask: qualityTask,
    progressionContextSnapshot,
    createdAt: selection.descriptorAt,
  });
  const concreteTask = preparation.concreteTaskResult.concreteTask;
  const readiness = preparation.concreteTaskResult.readiness;
  if (!concreteTask || !readiness?.canExecute) {
    throw new Error('当前正式任务尚未准备完成。');
  }
  const base = await import('./phase163RealLearningChainDemo.ts').then((module) => (
    module.createPhase163DemoEnvironment('complete_chain', '')
  ));
  const currentProfile = latest?.studentAbilityProfile || {
    ...base.input.currentProfile,
    studentId: PHASE163_RUNTIME_STUDENT_ID,
  };
  const currentGrowthMemorySummary = latest?.growthMemorySummary || {
    ...base.input.currentGrowthMemorySummary,
    studentId: PHASE163_RUNTIME_STUDENT_ID,
  };
  const revisionAttempts = await learningTaskAttemptRepository.listByStudent(PHASE163_RUNTIME_STUDENT_ID);
  const latestRevisionProfile = [...revisionAttempts]
    .reverse()
    .find((item) => item.status === 'completed_with_revision' && item.revision?.profileAfterRevision)
    ?.revision?.profileAfterRevision;
  const controlledCurrentProfile = latestRevisionProfile || currentProfile;
  const existingGrowthMemoryRecords = uniqueById([
    ...records.flatMap((item) => item.growthMemoryRecord ? [item.growthMemoryRecord] : []),
    ...revisionAttempts.flatMap((item) => item.revision?.growthMemoryRecord ? [item.revision.growthMemoryRecord] : []),
  ], (item) => item.recordId);
  const previousEvidence = records.flatMap((item) => item.learningRoundResult?.taskEvidenceReturnResult?.abilityEvidence || []);
  const previousProgressionObservations = await learningProgressionRepository.listObservations(
    PHASE163_RUNTIME_STUDENT_ID,
    progressionContextSnapshot.taskLoadSemantics?.observationThreadId,
  );
  const startedAt = new Date().toISOString();
  const currentLearningContext: CurrentLearningContext = {
    ...base.input.currentLearningContext,
    studentId: PHASE163_RUNTIME_STUDENT_ID,
    targetAbilityId: version.abilityMetadata.abilityId,
    recentTaskRole: version.abilityMetadata.taskRole,
  };
  return {
    isTargetedMicroTraining,
    targetedAssignmentId,
    retestPlan,
    concreteTask,
    readiness,
    roundNumber: number,
    taskQueue: taskQueueContext.taskQueue,
    queueProgress,
    input: {
      ...base.input,
      operationId: `phase16-3-live-operation-${roundId}`,
      learningSessionId: taskQueueContext.learningSessionId,
      learningRoundId: roundId,
      diagnosisRequestId: `phase16-3-live-diagnosis-${roundId}`,
      studentId: PHASE163_RUNTIME_STUDENT_ID,
      resourceVersion: version,
      qualityGatedTask: qualityTask,
      answerText: '',
      startedAt,
      submittedAt: startedAt,
      currentProfile: controlledCurrentProfile,
      currentGrowthMemorySummary,
      existingGrowthMemoryRecords,
      previousEvidence,
      progressionContextSnapshot,
      previousProgressionObservations,
      progressionSupportMode: isTargetedMicroTraining
        ? 'targeted_training'
        : version.abilityMetadata.taskRole === 'retest'
          ? 'retest_independent'
          : version.abilityMetadata.taskRole === 'transfer'
            ? 'transfer_independent'
            : undefined,
      currentLearningContext,
      providerConfig: createDiagnosisProviderConfigSnapshot({
        provider: 'deepseek_chat',
        model: 'deepseek-v4-flash',
        providerConfigId: 'phase16-3-local-application-boundary-v1',
        promptVersion: REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION,
        temperature: 0.1,
        maxAttempts: 2,
        timeoutMs: 30_000,
        createdAt: startedAt,
      }),
      timezone: TIMEZONE,
    },
  };
}

async function resolveCurrentFormalTaskSelection(requireContext: boolean) {
  const descriptorAt = new Date().toISOString();
  const storedContext = await activityRepository.getByStudent(PHASE163_RUNTIME_STUDENT_ID);
  let context = storedContext?.status !== 'ended' ? storedContext : undefined;
  if (requireContext && !context) throw new Error('请先从学习入口开始本次学习。');
  if (context) assertPhase163ProductRuntimeIdentity(context);
  const targetedTransition = context
    ? await loadTargetedTrainingTransition(PHASE163_RUNTIME_STUDENT_ID).catch(() => null)
    : null;
  const targetedAssignmentId = targetedTransition?.mode === 'in_progress'
    ? targetedTransition.assignmentId
    : undefined;
  const targetedVersion = targetedAssignmentId
    ? await getTargetedTrainingResourceVersion(targetedAssignmentId)
    : undefined;
  const coreRoundId = context?.currentLearningRoundId || (
    context ? `${context.learningSessionId}-round-1` : undefined
  );
  const roundId = targetedAssignmentId
    ? `${context!.learningSessionId}-targeted-${targetedAssignmentId}`
    : coreRoundId;
  const number = targetedTransition
    ? Math.max(1, targetedTransition.returnToCoreTaskNumber - 1)
    : roundId ? roundNumber(roundId) : 1;
  const records = await persistenceRepository.listByStudent(PHASE163_RUNTIME_STUDENT_ID);
  const latest = records
    .filter((item) => item.learningRoundResult?.status === 'completed')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const currentCheckpoint = roundId
    ? await operationRepository.getByOperationId(`phase16-3-live-operation-${roundId}`)
    : undefined;
  const plans = await loadPhase163DueRetestPlans();
  const retestPlan = plans[0];
  const currentHeadVersions = await loadCurrentFormalResourceVersions(
    formalResourceRepository,
    materialObservationRepository,
  );
  const allCurrentVersions = await includeFrozenSessionResourceVersions(
    context,
    currentHeadVersions,
  );
  const eligibleNewSessionVersions = filterCurrentFormalResourcesForNewLearningSession(
    currentHeadVersions,
  );
  const previousRoundId = !targetedAssignmentId && roundId && number > 1
    ? replaceRoundNumber(roundId, number - 1)
    : undefined;
  const previousCheckpoint = previousRoundId
    ? await operationRepository.getByOperationId(`phase16-3-live-operation-${previousRoundId}`)
    : undefined;
  const previousVersion = previousCheckpoint?.sourceResourceVersionId
    ? allCurrentVersions.find((version) => (
        version.resourceVersionId === previousCheckpoint.sourceResourceVersionId
      ))
    : undefined;
  if (context?.taskQueue && previousVersion && number > 1) {
    const queuedPreviousResourceVersionId = context.taskQueue.resourceVersionIds[number - 2];
    if (
      context.taskQueue.materialId !== previousVersion.materialId ||
      queuedPreviousResourceVersionId !== previousVersion.resourceVersionId
    ) {
      context = await ensureActiveSessionTaskQueue(
        context,
        allCurrentVersions,
        previousVersion,
        descriptorAt,
        number - 1,
      );
    }
  }
  const currentPersistenceRecord = roundId
    ? records.find((item) => item.learningRoundId === roundId)
    : undefined;
  const plannedResolution = previousCheckpoint?.nextTaskResolution?.status === 'matched'
    ? previousCheckpoint.nextTaskResolution
    : undefined;
  const restoredResourceVersionId = resolveRestoredFormalResourceVersionId({
    checkpointSourceResourceVersionId: currentCheckpoint?.sourceResourceVersionId,
    persistenceRecord: currentPersistenceRecord,
  });
  const queuedResourceVersionId = context?.taskQueue?.resourceVersionIds[number - 1];
  const pinnedResourceVersionId = targetedVersion?.resourceVersionId
    || restoredResourceVersionId
    || queuedResourceVersionId;
  const preservesFrozenSessionVersions = Boolean(
    context?.taskQueue || restoredResourceVersionId || currentCheckpoint?.sourceResourceVersionId,
  );
  const currentVersions = preservesFrozenSessionVersions
    ? allCurrentVersions
    : eligibleNewSessionVersions;
  const progressionArtifacts = await loadProgressionArtifacts(currentVersions);
  const currentVersion = pinnedResourceVersionId
    ? allCurrentVersions.find((item) => (
      item.resourceVersionId === pinnedResourceVersionId
    ))
    : undefined;
  if (pinnedResourceVersionId && !currentVersion) {
    throw new Error(queuedResourceVersionId === pinnedResourceVersionId
      ? '本轮下一题的正式版本已不可用，已完成结果仍然保留。'
      : '上次学习任务的正式版本已不可用，请结束本次学习后重新开始。');
  }
  const recentHistory = buildScopedFormalResourceHistory({
    studentId: PHASE163_RUNTIME_STUDENT_ID,
    records,
    currentVersions,
    activeLearningSessionId: context?.learningSessionId,
    historyWindowEndedAt: descriptorAt,
  });
  const effectiveHistory = currentVersion
    ? withoutCurrentResource(recentHistory, currentVersion)
    : recentHistory;
  let effectiveRetestPlan = currentVersion ? undefined : retestPlan;
  let bootstrapResolution = !effectiveRetestPlan && !plannedResolution && !currentVersion
    ? await resolveFormalResourceBootstrapMatch({
        studentId: PHASE163_RUNTIME_STUDENT_ID,
        versions: currentVersions,
        resourceRepository: formalResourceRepository,
        observationRepository: materialObservationRepository,
        recentHistory: effectiveHistory,
        evaluatedAt: descriptorAt,
        reusePreviouslyUsedWhenExhausted: true,
      })
    : undefined;
  let taskRequest = currentVersion
    ? taskRequestForExistingVersion(currentVersion, descriptorAt)
    : effectiveRetestPlan
      ? taskRequestFromRetestPlan(effectiveRetestPlan, descriptorAt)
      : previousCheckpoint?.nextTaskRequest && plannedResolution
        ? previousCheckpoint.nextTaskRequest
        : bootstrapResolution!.taskRequest;
  let matched = bootstrapResolution?.matched || await matchCurrentFormalResource({
    taskRequest,
    studentId: PHASE163_RUNTIME_STUDENT_ID,
    resourceRepository: formalResourceRepository,
    observationRepository: materialObservationRepository,
    recentHistory: effectiveHistory,
    bootstrapMaterialId: currentVersion?.materialId || selectBootstrapMaterialId(
      currentVersions,
      taskRequest,
      effectiveHistory.recentResourceVersionIds,
      progressionArtifacts,
    ),
    requiredResourceVersionId: currentVersion?.resourceVersionId,
    frozenSessionResourceVersionId: queuedResourceVersionId === currentVersion?.resourceVersionId
      ? queuedResourceVersionId
      : undefined,
    eligibleResourceVersionIds: currentVersions.map((version) => version.resourceVersionId),
    evaluatedAt: descriptorAt,
  });
  if (
    matched.status !== 'matched' &&
    effectiveRetestPlan &&
    !plannedResolution &&
    !currentVersion
  ) {
    bootstrapResolution = await resolveFormalResourceBootstrapMatch({
      studentId: PHASE163_RUNTIME_STUDENT_ID,
      versions: currentVersions,
      resourceRepository: formalResourceRepository,
      observationRepository: materialObservationRepository,
      recentHistory: effectiveHistory,
      evaluatedAt: descriptorAt,
      reusePreviouslyUsedWhenExhausted: true,
    });
    if (bootstrapResolution.matched.status === 'matched') {
      effectiveRetestPlan = undefined;
      taskRequest = bootstrapResolution.taskRequest;
      matched = bootstrapResolution.matched;
    }
  }
  return {
    descriptorAt,
    context,
    roundId,
    number,
    records,
    latest,
    currentCheckpoint,
    retestPlan: effectiveRetestPlan,
    currentVersions,
    identityCurrentVersionCount: allCurrentVersions.length,
    taskRequest,
    recentHistory: effectiveHistory,
    matched,
    isTargetedMicroTraining: Boolean(targetedAssignmentId),
    targetedAssignmentId,
  };
}

async function resolveNextFormalTask(
  taskRequest: TaskRequest,
  previousResourceVersion: FrozenQuestionResourceVersion,
): Promise<NextFormalTaskResolution> {
  const records = await persistenceRepository.listByStudent(PHASE163_RUNTIME_STUDENT_ID);
  const currentHeadVersions = await loadCurrentFormalResourceVersions(
    formalResourceRepository,
    materialObservationRepository,
  );
  const storedContext = await activityRepository.getByStudent(PHASE163_RUNTIME_STUDENT_ID);
  const allVersions = await includeFrozenSessionResourceVersions(
    storedContext?.status !== 'ended' ? storedContext : undefined,
    currentHeadVersions,
  );
  const versions = storedContext?.status !== 'ended' && storedContext?.taskQueue
    ? allVersions
    : filterCurrentFormalResourcesForNewLearningSession(currentHeadVersions);
  const progressionArtifacts = await loadProgressionArtifacts(versions);
  const currentRoundNumber = roundNumber(storedContext?.currentLearningRoundId);
  const queueProgress = resolveLearningSessionTaskQueueProgress(
    storedContext?.status !== 'ended' ? storedContext?.taskQueue : undefined,
    currentRoundNumber,
  );
  if (storedContext?.taskQueue && queueProgress.isComplete) {
    return {
      status: 'session_complete',
      taskRequestId: taskRequest.taskRequestId,
      issues: [],
    };
  }
  const queuedNextVersion = queueProgress.nextResourceVersionId
    ? versions.find((version) => version.resourceVersionId === queueProgress.nextResourceVersionId)
    : undefined;
  if (queueProgress.nextResourceVersionId && !queuedNextVersion) {
    return {
      status: 'blocked',
      taskRequestId: taskRequest.taskRequestId,
      issues: ['session_task_queue_next_version_unavailable'],
    };
  }
  const activeLearningSessionId = storedContext?.status !== 'ended'
    ? storedContext?.learningSessionId
    : undefined;
  const history = buildScopedFormalResourceHistory({
    studentId: PHASE163_RUNTIME_STUDENT_ID,
    records,
    currentVersions: versions,
    activeLearningSessionId,
    historyWindowEndedAt: new Date().toISOString(),
  });
  const effectiveRecentVersionIds = uniqueStrings([
    ...history.recentResourceVersionIds,
    previousResourceVersion.resourceVersionId,
  ]);
  if (queuedNextVersion) {
    const queuedTaskRequest = taskRequestForExistingVersion(queuedNextVersion, new Date().toISOString());
    const queuedResolution = await matchCurrentFormalResource({
      taskRequest: queuedTaskRequest,
      studentId: PHASE163_RUNTIME_STUDENT_ID,
      resourceRepository: formalResourceRepository,
      observationRepository: materialObservationRepository,
      recentHistory: {
        ...history,
        recentTaskIds: uniqueStrings([...history.recentTaskIds, previousResourceVersion.taskId]),
        recentResourceIds: uniqueStrings([...history.recentResourceIds, previousResourceVersion.resourceId]),
        recentResourceVersionIds: effectiveRecentVersionIds,
      },
      bootstrapMaterialId: queuedNextVersion.materialId,
      requiredResourceVersionId: queuedNextVersion.resourceVersionId,
      frozenSessionResourceVersionId: queuedNextVersion.resourceVersionId,
      eligibleResourceVersionIds: versions.map((version) => version.resourceVersionId),
      evaluatedAt: new Date().toISOString(),
    });
    return {
      ...queuedResolution,
      resolvedTaskRequest: queuedTaskRequest,
    };
  }
  const preferredVersion = selectFormalResourceForLearningSequence(versions, {
    taskRole: taskRequest.taskRole,
    targetAbilityId: taskRequest.targetAbilityId,
    recentResourceVersionIds: effectiveRecentVersionIds,
    materialId: previousResourceVersion.materialId,
    progressionArtifacts,
  }) || selectFormalResourceForLearningSequence(versions, {
    taskRole: taskRequest.taskRole,
    targetAbilityId: taskRequest.targetAbilityId,
    recentResourceVersionIds: effectiveRecentVersionIds,
    progressionArtifacts,
  });
  return matchCurrentFormalResource({
    taskRequest,
    studentId: PHASE163_RUNTIME_STUDENT_ID,
    resourceRepository: formalResourceRepository,
    observationRepository: materialObservationRepository,
    recentHistory: {
      ...history,
      recentTaskIds: uniqueStrings([...history.recentTaskIds, previousResourceVersion.taskId]),
      recentResourceIds: uniqueStrings([...history.recentResourceIds, previousResourceVersion.resourceId]),
      recentResourceVersionIds: uniqueStrings([
        ...history.recentResourceVersionIds,
        previousResourceVersion.resourceVersionId,
      ]),
      recentMaterialIds: uniqueStrings([
        ...history.recentMaterialIds,
        ...(previousResourceVersion.materialId ? [previousResourceVersion.materialId] : []),
      ]),
    },
    bootstrapMaterialId: preferredVersion?.materialId,
    requiredResourceVersionId: preferredVersion?.resourceVersionId,
    eligibleResourceVersionIds: versions.map((version) => version.resourceVersionId),
    evaluatedAt: new Date().toISOString(),
  });
}

async function includeFrozenSessionResourceVersions(
  context: UnifiedLearningActivityContext | undefined,
  currentHeadVersions: FrozenQuestionResourceVersion[],
): Promise<FrozenQuestionResourceVersion[]> {
  if (!context?.taskQueue) return currentHeadVersions;
  const queuedVersions = await Promise.all(context.taskQueue.resourceVersionIds.map((id) => (
    formalResourceRepository.getVersion(id)
  )));
  return uniqueById([
    ...currentHeadVersions,
    ...queuedVersions.filter((version): version is FrozenQuestionResourceVersion => Boolean(
      version &&
      version.status === 'frozen' &&
      version.materialId === context.taskQueue?.materialId,
    )),
  ], (version) => version.resourceVersionId);
}

function selectBootstrapMaterialId(
  versions: FrozenQuestionResourceVersion[],
  taskRequest: TaskRequest,
  recentResourceVersionIds: string[],
  progressionArtifacts: FormalTaskGroupProgressionArtifact[] = [],
): string | undefined {
  return selectFormalResourceForLearningSequence(versions, {
    taskRole: taskRequest.taskRole,
    targetAbilityId: taskRequest.targetAbilityId,
    recentResourceVersionIds,
    progressionArtifacts,
  })?.materialId;
}

async function appendRoundToCurrentSession(record: LearningPersistenceRecord): Promise<void> {
  const context = await requireActiveContext();
  const session = await sessionRepository.getById(PHASE163_RUNTIME_STUDENT_ID, context.learningSessionId);
  if (!session || session.status !== 'in_progress') return;
  await saveLearningSessionRecord(sessionRepository, appendLearningRoundToSession(session, { persistenceRecord: record }));
}

async function recordNaturalDay(result: Awaited<ReturnType<typeof runPhase163RealLearningChain>>, plan?: DelayedRetestPlan): Promise<void> {
  const now = new Date().toISOString();
  const existing = await multiDayRepository.getByStudent(PHASE163_RUNTIME_STUDENT_ID);
  const state = existing || createPhase163MultiDayRun({
    runId: `phase16-3-natural-${PHASE163_RUNTIME_STUDENT_ID}`,
    studentId: PHASE163_RUNTIME_STUDENT_ID,
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
  const context = await activityRepository.getByStudent(PHASE163_RUNTIME_STUDENT_ID);
  if (!context || context.status === 'ended') throw new Error('请先从学习入口开始本次学习。');
  assertPhase163ProductRuntimeIdentity(context);
  return context;
}

function readyState(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  answerDraft: string,
  singleChoiceDraft?: SingleChoiceStudentAnswerValue,
): Phase163LiveWorkspaceState {
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
    sessionTaskCount: descriptor.queueProgress.totalTaskCount,
    sessionComplete: false,
    task: {
      title: descriptor.input.resourceVersion.title,
      materialTitle: descriptor.input.resourceVersion.materialSnapshot?.title,
      materialAuthor: descriptor.input.resourceVersion.materialSnapshot?.metadata?.author,
      abilityId: task.targetAbilityId,
      focus: task.targetAbilityName,
      readingText: task.readingText || '',
      questionText: task.question,
      responseFormat: task.responseFormat === 'single_choice' ? 'single_choice' : 'text',
      minimumAnswerLength: descriptor.input.resourceVersion.minimumAnswerRequirement.minLength,
      singleChoice: task.singleChoiceDelivery,
    },
    answerDraft,
    singleChoiceDraft,
    learningPresentation,
    canAdvance: false,
    canRetry: false,
    isRetest: task.taskRole === 'retest',
    isTargetedMicroTraining: descriptor.isTargetedMicroTraining,
    primaryAction: 'submit_answer',
  };
}

function taskRequestForExistingVersion(
  version: FrozenQuestionResourceVersion,
  createdAt: string,
): TaskRequest {
  const role = version.abilityMetadata.taskRole;
  const action: NextLearningAction = role === 'retest'
    ? 'independent_retest'
    : role === 'transfer'
      ? 'transfer_test'
      : role === 'diagnosis'
        ? 'diagnostic_verification'
        : role === 'observation'
          ? 'collect_more_evidence'
          : 'continue_training';
  return {
    taskRequestId: `phase17-3-resume-request-${version.resourceVersionId}`,
    strategyId: `phase17-3-resume-strategy-${version.resourceVersionId}`,
    studentId: PHASE163_RUNTIME_STUDENT_ID,
    targetAbilityId: version.abilityMetadata.abilityId,
    taskRole: role,
    action,
    validationGoal: `恢复并继续观察 ${version.abilityMetadata.abilityId} 的正式作答表现。`,
    evidenceLinks: [`phase17-3-resume-evidence-${version.resourceVersionId}`],
    growthMemoryRecordIds: [`phase17-3-resume-memory-${version.resourceVersionId}`],
    constraints: [],
    createdAt,
  };
}

function taskRequestFromRetestPlan(
  plan: DelayedRetestPlan,
  createdAt: string,
): TaskRequest {
  return {
    taskRequestId: `phase17-3-retest-request-${plan.planId}`,
    strategyId: `phase17-3-retest-strategy-${plan.planId}`,
    studentId: plan.studentId,
    targetAbilityId: plan.targetAbilityId,
    taskRole: 'retest',
    action: 'independent_retest',
    validationGoal: plan.validationGoal,
    evidenceLinks: plan.sourceEvidenceIds,
    growthMemoryRecordIds: [`phase17-3-retest-memory-${plan.planId}`],
    constraints: plan.constraints,
    createdAt,
  };
}

function withoutCurrentResource(
  history: ResourceMatchRecentHistory,
  current: FrozenQuestionResourceVersion,
): ResourceMatchRecentHistory {
  return {
    ...history,
    recentTaskIds: history.recentTaskIds.filter((id) => id !== current.taskId),
    recentResourceIds: history.recentResourceIds.filter((id) => id !== current.resourceId),
    recentResourceVersionIds: history.recentResourceVersionIds.filter((id) => (
      id !== current.resourceVersionId
    )),
    recentMaterialIds: current.materialId
      ? uniqueStrings([...history.recentMaterialIds, current.materialId])
      : history.recentMaterialIds,
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function uniqueById<T>(values: T[], getId: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const id = getId(value);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function stateFromCheckpoint(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  checkpoint: NonNullable<Awaited<ReturnType<IndexedDBRealLearningOperationRepository['getByOperationId']>>>,
  answerDraft: string,
  singleChoiceDraft?: SingleChoiceStudentAnswerValue,
): Promise<Phase163LiveWorkspaceState> {
  const restoredAnswer = checkpoint.taskExecutionResult?.studentResponse?.answerText || answerDraft;
  const restoredChoice = checkpoint.taskExecutionResult?.studentResponse?.singleChoiceAnswer || singleChoiceDraft;
  const base = readyState(descriptor, restoredAnswer, restoredChoice);
  const feedback = resolvePhase163LiveStudentFeedback(checkpoint);
  const queueProgress = descriptor.queueProgress;
  const hasFormalRoundResult = Boolean(checkpoint.learningPersistenceRecordId);
  const sessionQueueBlocked = checkpoint.issues.includes(
    'session_task_queue_next_version_unavailable',
  );
  const canAdvance = hasFormalRoundResult && queueProgress.hasNextTask && !sessionQueueBlocked;
  const sessionComplete = hasFormalRoundResult && queueProgress.isComplete;
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
  }), {
    continuationMode: canAdvance ? 'fixed_task_queue' : 'adaptive',
  });
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
  const revision = await resolveFeedbackRevisionState(descriptor, checkpoint, feedback);
  let targetedMicroTraining: TargetedMicroTrainingLearningTransition | undefined;
  if (descriptor.isTargetedMicroTraining && descriptor.targetedAssignmentId && hasFormalRoundResult) {
    await completeTargetedTraining(
      PHASE163_RUNTIME_STUDENT_ID,
      descriptor.targetedAssignmentId,
    );
  } else if (
    hasFormalRoundResult
    && checkpoint.status === 'completed'
    && checkpoint.taskExecutionResult?.studentResponse
    && !revision
    && descriptor.input.resourceVersion.abilityMetadata.taskRole === 'training'
  ) {
    const response = checkpoint.taskExecutionResult.studentResponse;
    targetedMicroTraining = await scheduleTargetedTrainingAfterCoreResult({
      studentId: descriptor.input.studentId,
      learningSessionId: descriptor.input.learningSessionId,
      learningRoundId: descriptor.input.learningRoundId,
      sourceAttemptId: attemptIdFor(descriptor, submissionIntentForResponse(response)),
      sourceCoreTaskNumber: descriptor.roundNumber,
      sourceVersion: descriptor.input.resourceVersion,
      feedback,
      persistenceCompleted: true,
      revisionAvailable: false,
      now: checkpoint.updatedAt,
    }).catch(() => null) || undefined;
  }
  const targetedReturnTaskNumber = descriptor.isTargetedMicroTraining
    ? descriptor.queueProgress.currentTaskNumber + 1
    : undefined;
  const targetedCanAdvance = Boolean(
    descriptor.isTargetedMicroTraining
    && targetedReturnTaskNumber
    && targetedReturnTaskNumber <= descriptor.queueProgress.totalTaskCount,
  );
  const targetedSessionComplete = Boolean(
    descriptor.isTargetedMicroTraining
    && targetedReturnTaskNumber
    && targetedReturnTaskNumber > descriptor.queueProgress.totalTaskCount,
  );
  return {
    ...base,
    status: canAdvance || sessionComplete || checkpoint.status === 'completed'
      ? 'completed'
      : checkpoint.status,
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
    canAdvance: descriptor.isTargetedMicroTraining ? targetedCanAdvance : canAdvance,
    sessionComplete: descriptor.isTargetedMicroTraining ? targetedSessionComplete : sessionComplete,
    canRetry: checkpoint.status === 'retry_required',
    primaryAction,
    pauseReason: pausePresentation?.reason,
    studentTitle: pausePresentation?.title,
    studentMessage: pausePresentation
      ? pausePresentation.message
      : checkpoint.status === 'blocked'
        ? sessionQueueBlocked
          ? '本题结果已经保存，但下一题的正式版本已不可用。请返回学习入口后重新开始本轮学习。'
          : resourceUnavailable && checkpoint.learningPersistenceRecordId
            ? '本题学习已经完成。下一题需要先准备，准备完成后可以从学习入口继续。'
          : '当前任务暂时无法继续，已有学习记录已经保留。'
        : checkpoint.status === 'retry_required'
          ? checkpoint.nextAction === 'submit_answer'
            ? checkpoint.issues.includes('semantic_answer_validity_insufficient')
              ? '这段内容没有回应当前题目。请围绕题目写出你的判断，并结合材料说明理由。'
              : '请补充回答后重新提交。'
            : '已提交的回答正在恢复处理，不需要重新作答。'
          : undefined,
    revision: descriptor.isTargetedMicroTraining ? undefined : revision,
    isTargetedMicroTraining: descriptor.isTargetedMicroTraining,
    targetedMicroTraining,
  };
}

export async function startPhase163FeedbackRevision(): Promise<Phase163LiveWorkspaceState> {
  const context = await currentFeedbackRevisionContext();
  const revision = context.state.revision;
  if (!revision || revision.status !== 'offered') {
    throw new Error('当前回答不满足反馈后修订条件。');
  }
  const attempt = await feedbackRevisionPersistenceService.startRevision(
    revision.learningTaskAttemptId,
    revision.revisionGoal,
  );
  await synchronizeFeedbackRevisionObservations(context.descriptor, attempt);
  await readingOpenResponseProcessFactService.recordRevision({
    attemptId: attempt.initialAttemptId,
    offered: true,
  }).catch(() => undefined);
  return await stateFromCheckpoint(
    context.descriptor,
    context.checkpoint,
    context.checkpoint.taskExecutionResult?.studentResponse?.answerText || '',
  );
}

export async function savePhase163FeedbackRevisionDraft(
  draftAnswer: string,
): Promise<Phase163LiveWorkspaceState> {
  const context = await currentFeedbackRevisionContext();
  const revision = context.state.revision;
  if (!revision || revision.status !== 'draft') throw new Error('当前没有可保存的修订草稿。');
  await feedbackRevisionPersistenceService.saveRevisionDraft(
    revision.learningTaskAttemptId,
    draftAnswer,
  );
  return await stateFromCheckpoint(context.descriptor, context.checkpoint, draftAnswer);
}

export async function submitPhase163FeedbackRevision(
  revisedAnswer: string,
): Promise<Phase163LiveWorkspaceState> {
  const context = await currentFeedbackRevisionContext();
  const revision = context.state.revision;
  if (!revision || revision.status !== 'draft') throw new Error('当前没有可提交的修订。');
  const preflight = buildRevisionTaskExecution(
    context.descriptor,
    revisedAnswer,
    `revision-preflight-${revision.learningTaskAttemptId}`,
    new Date().toISOString(),
  );
  if (!preflight.canEnterDiagnosisRuntime) {
    throw new Error(preflight.responseValidity.reasons[0] || '修订内容还不足以进行评价，请补充后再提交。');
  }
  const submitted = await feedbackRevisionPersistenceService.submitRevision(
    revision.learningTaskAttemptId,
    revisedAnswer,
  );
  await synchronizeFeedbackRevisionObservations(context.descriptor, submitted);
  await readingOpenResponseProcessFactService.recordRevision({
    attemptId: submitted.initialAttemptId,
    offered: true,
    submitted: true,
  }).catch(() => undefined);
  return await evaluateSubmittedFeedbackRevision(
    context.descriptor,
    context.checkpoint,
    revision.learningTaskAttemptId,
    revisedAnswer,
  );
}

async function evaluateSubmittedFeedbackRevision(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  checkpoint: RealLearningOperationCheckpoint,
  learningTaskAttemptId: string,
  fallbackAnswer: string,
): Promise<Phase163LiveWorkspaceState> {
  try {
    const started = await feedbackRevisionPersistenceService.startRevisionEvaluation(learningTaskAttemptId);
    const revision = started.revision;
    const revisedResponse = revision?.revisedResponse;
    const initialCommit = checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit;
    if (!revision || !revisedResponse || !initialCommit?.diagnosisResult) {
      throw new Error('revision_evaluation_formal_input_missing');
    }
    const execution = buildRevisionTaskExecution(
      descriptor,
      revisedResponse.answerText,
      revisedResponse.responseId,
      revisedResponse.submittedAt,
    );
    if (!execution.canEnterDiagnosisRuntime) {
      throw new Error('revision_evaluation_response_not_diagnosable');
    }
    const runtime = await runDiagnosisThroughPhase163Boundary({
      concreteTask: descriptor.concreteTask,
      taskExecutionResult: execution,
      executionMode: 'live',
      requestId: `revision-diagnosis-${revision.revisionId}`,
      providerConfig: descriptor.input.providerConfig,
      commitOnSuccess: true,
      evidenceReturnAlreadyCompleted: false,
      startedAt: revisedResponse.submittedAt,
    });
    const revisedCommit = runtime.formalDiagnosisCommit;
    if (
      runtime.status !== 'formal_result_committed'
      || !runtime.validation.passed
      || revisedCommit?.status !== 'committed'
      || !revisedCommit.diagnosisResult
    ) {
      throw new Error(`revision_evaluation_formal_diagnosis_unavailable:${runtime.status}`);
    }
    const bundle = evaluateLearningFeedbackRevision({
      revisionId: revision.revisionId,
      studentId: started.studentId,
      taskId: started.taskId,
      abilityId: descriptor.concreteTask.targetAbilityId,
      abilityLabel: descriptor.concreteTask.targetAbilityName,
      resourceVersionId: started.resourceVersionId,
      rubricVersion: started.rubricVersion,
      initialAnswer: started.initialResponse.answerText,
      revisedAnswer: revisedResponse.answerText,
      revisionGoal: revision.revisionGoal,
      initialDiagnosisId: initialCommit.formalDiagnosisId,
      initialDiagnosis: initialCommit.diagnosisResult,
      revisedDiagnosisId: revisedCommit.formalDiagnosisId,
      revisedDiagnosisSchemaVersion: runtime.runRecord.diagnosisSchemaVersion,
      revisedDiagnosis: revisedCommit.diagnosisResult,
      currentProfile: descriptor.input.currentProfile,
    });
    const completed = await feedbackRevisionPersistenceService.completeRevisionEvaluation(
      learningTaskAttemptId,
      bundle,
    );
    await synchronizeFeedbackRevisionObservations(descriptor, completed);
  } catch (error) {
    const issue = toRevisionEvaluationIssue(error);
    await feedbackRevisionPersistenceService.markRevisionEvaluationPendingRetry(
      learningTaskAttemptId,
      issue,
    );
  }
  return await stateFromCheckpoint(descriptor, checkpoint, fallbackAnswer);
}

function buildRevisionTaskExecution(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  answerText: string,
  responseId: string,
  submittedAt: string,
) {
  const result = runTaskExecutionAgent({
    concreteTask: descriptor.concreteTask,
    readiness: descriptor.readiness,
    studentAnswer: {
      answerText,
      usedHint: true,
      hintCount: 1,
      submittedAt,
    },
    startedAt: submittedAt,
    responseOverrides: { responseId },
  }).taskExecutionResult;
  if (!result) throw new Error('revision_evaluation_task_execution_unavailable');
  return result;
}

function toRevisionEvaluationIssue(
  error: unknown,
): Omit<RevisionEvaluationIssue, 'attemptCount' | 'lastFailedAt'> {
  const code = error instanceof Error
    ? error.message.split(':')[0] || 'revision_evaluation_unavailable'
    : 'revision_evaluation_unavailable';
  return {
    code,
    message: '修订回答已经保存，评价暂时不可用；系统会在恢复后自动补充。',
    retryable: true,
  };
}

export async function resumePhase163FeedbackRevisionEvaluation(): Promise<Phase163LiveWorkspaceState> {
  const context = await currentFeedbackRevisionContext();
  const revision = context.state.revision;
  if (!revision || !['submitted', 'evaluating', 'evaluation_pending_retry'].includes(revision.status)) {
    return context.state;
  }
  return await evaluateSubmittedFeedbackRevision(
    context.descriptor,
    context.checkpoint,
    revision.learningTaskAttemptId,
    context.state.revision?.draftAnswer || context.state.revision?.initialAnswer || '',
  );
}

export async function skipPhase163FeedbackRevision(): Promise<void> {
  const context = await currentFeedbackRevisionContext();
  const revision = context.state.revision;
  if (!revision || (revision.status !== 'offered' && revision.status !== 'draft')) return;
  const attempt = await learningTaskAttemptRepository.getById(revision.learningTaskAttemptId);
  if (attempt?.status === 'feedback_presented') {
    await feedbackRevisionPersistenceService.completeInitialOnly(attempt.learningTaskAttemptId);
  } else if (attempt?.status === 'revision_draft') {
    await feedbackRevisionPersistenceService.abandonRevision(attempt.learningTaskAttemptId);
  }
}

async function currentFeedbackRevisionContext() {
  const descriptor = await buildCurrentRoundDescriptor();
  const checkpoint = await operationRepository.getByOperationId(descriptor.input.operationId);
  if (!checkpoint) throw new Error('当前还没有可以修订的正式反馈。');
  const state = await stateFromCheckpoint(
    descriptor,
    checkpoint,
    checkpoint.taskExecutionResult?.studentResponse?.answerText || '',
  );
  return { descriptor, checkpoint, state };
}

async function resolveFeedbackRevisionState(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  checkpoint: RealLearningOperationCheckpoint,
  feedback: StudentLearningFeedback | undefined,
): Promise<Phase163LiveWorkspaceState['revision']> {
  const response = checkpoint.taskExecutionResult?.studentResponse;
  const commit = checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit;
  const feedbackResult = checkpoint.controlledFeedbackResult;
  if (!response || !commit?.diagnosisResult || !feedbackResult?.studentLearningFeedback) return undefined;

  // Single-choice feedback remains a diagnosis and next-task signal. It must not
  // be projected as a text revision workflow.
  if (descriptor.concreteTask.responseFormat === 'single_choice') return undefined;

  const submissionIntentId = submissionIntentForResponse(response);
  const initialAttemptId = attemptIdFor(descriptor, submissionIntentId);
  let attempt = await feedbackRevisionPersistenceService.createInitialAttempt({
    initialAttemptId,
    studentId: descriptor.input.studentId,
    learningSessionId: descriptor.input.learningSessionId,
    learningRoundId: descriptor.input.learningRoundId,
    operationId: descriptor.input.operationId,
    materialVersionId: descriptor.input.resourceVersion.materialVersionId || 'material-version-unavailable',
    resourceId: descriptor.input.resourceVersion.resourceId,
    resourceVersionId: descriptor.input.resourceVersion.resourceVersionId,
    taskRole: descriptor.concreteTask.taskRole,
    rubricVersion: `${descriptor.input.resourceVersion.resourceVersionId}:rubric`,
    initialResponse: response,
    initialDiagnosisId: commit.formalDiagnosisId,
    initialDiagnosisSchemaVersion: commit.schemaVersion,
    initialFeedbackId: feedbackResult.feedbackRequestId,
    initialFeedbackSchemaVersion: feedbackResult.schemaVersion,
    createdAt: response.submittedAt,
  });
  if (attempt.status === 'completed_initial_only') return undefined;
  const offer = decideLearningFeedbackRevisionOffer({
    taskRole: descriptor.concreteTask.taskRole,
    answerStatus: commit.diagnosisResult.answerStatus,
    formalDiagnosisId: commit.formalDiagnosisId,
    formalFeedbackId: feedbackResult.feedbackRequestId,
    formalFeedbackReady: Boolean(
      feedbackResult.validation.passed
      && feedbackResult.studentLearningFeedback
      && feedback,
    ),
    requirementCoverage: feedback?.thinkingReview?.requirementCoverage,
    guidance: feedback?.guidance,
  });
  if (!attempt.revisionOfferDecision) {
    attempt = await feedbackRevisionPersistenceService.recordRevisionOfferDecision(
      attempt.learningTaskAttemptId,
      offer,
      checkpoint.updatedAt,
    );
  } else if (!attempt.revisionOfferDecision.eligible) {
    return undefined;
  }

  if (offer.level === 'none' && attempt.status === 'feedback_presented') {
    await feedbackRevisionPersistenceService.completeInitialOnly(attempt.learningTaskAttemptId);
    return undefined;
  }
  return toFeedbackRevisionPresentation(attempt, offer);
}

function toFeedbackRevisionPresentation(
  attempt: LearningTaskAttemptRecord,
  offer: LearningFeedbackRevisionOfferDecision,
): Phase163LiveWorkspaceState['revision'] {
  if (attempt.revision) {
    const statusMap: Record<NonNullable<LearningTaskAttemptRecord['revision']>['status'], NonNullable<Phase163LiveWorkspaceState['revision']>['status']> = {
      draft: 'draft',
      abandoned: 'submitted',
      submitted: 'submitted',
      evaluating: 'evaluating',
      evaluated: 'evaluated',
      evaluation_pending_retry: 'evaluation_pending_retry',
    };
    return {
      learningTaskAttemptId: attempt.learningTaskAttemptId,
      status: statusMap[attempt.revision.status],
      revisionGoal: attempt.revision.revisionGoal,
      initialAnswer: attempt.initialResponse.answerText,
      draftAnswer: attempt.revision.draftAnswer,
      draftUpdatedAt: attempt.revision.draftUpdatedAt,
      evaluation: attempt.revision.evaluation,
      evaluationIssue: attempt.revision.evaluationIssue,
      evaluationAttemptCount: attempt.revision.evaluationAttemptCount,
    };
  }
  if (offer.level === 'none' || !offer.revisionGoal || !offer.actionLabel) return undefined;
  return {
    learningTaskAttemptId: attempt.learningTaskAttemptId,
    status: 'offered',
    offerLevel: offer.level,
    actionLabel: offer.actionLabel,
    revisionGoal: offer.revisionGoal,
    initialAnswer: attempt.initialResponse.answerText,
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
    studentResponseText: responseDisplayText(task, response),
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

async function loadProgressionArtifacts(
  versions: FrozenQuestionResourceVersion[],
): Promise<FormalTaskGroupProgressionArtifact[]> {
  const planHashes = uniqueStrings(versions.flatMap((version) => (
    version.progressionMetadata?.taskGroupProgressionPlanHash
      ? [version.progressionMetadata.taskGroupProgressionPlanHash]
      : []
  )));
  const artifacts = await Promise.all(planHashes.map((planHash) => (
    learningProgressionRepository.getArtifact(planHash).catch(() => null)
  )));
  return artifacts.filter((artifact): artifact is FormalTaskGroupProgressionArtifact => (
    Boolean(artifact)
  ));
}

function buildProgressionAttemptId(input: {
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  resourceVersionId: string;
}): string {
  return [
    'learning-progression-attempt',
    input.studentId,
    input.learningSessionId,
    input.learningRoundId,
    input.resourceVersionId,
  ].join(':');
}

function replaceRoundNumber(roundId: string, number: number): string {
  return roundId.replace(/round-\d+$/, `round-${number}`);
}

function localDayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

function submissionIntentForResponse(response: StudentResponse): string {
  return buildLearningSubmissionIntentId({
    responseId: response.responseId,
    answerText: response.answerText,
    singleChoiceAnswer: response.singleChoiceAnswer,
  });
}

function responseDisplayText(
  task: { responseFormat?: 'text' | 'single_choice'; singleChoiceDelivery?: StudentSingleChoiceDelivery },
  response: StudentResponse,
): string {
  if (task.responseFormat !== 'single_choice' || !response.singleChoiceAnswer) return response.answerText;
  const selectedOptionId = response.singleChoiceAnswer.selectedOptionIds[0];
  return task.singleChoiceDelivery?.options.find((option) => option.optionId === selectedOptionId)?.content
    || '已完成单项选择作答';
}

type ReadingOpenResponseHintMarker = {
  presentedAt: string;
  firstInputAt?: string;
  hintOpened: boolean;
};

const READING_OPEN_RESPONSE_HINT_MARKER_PREFIX =
  'qingzhou:reading-open-response-process:';

function readHintMarker(roundId: string): ReadingOpenResponseHintMarker | undefined {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    const value = sessionStorage.getItem(`${READING_OPEN_RESPONSE_HINT_MARKER_PREFIX}${roundId}`);
    if (!value) return undefined;
    const parsed = JSON.parse(value) as Partial<ReadingOpenResponseHintMarker>;
    if (!parsed.presentedAt || !Number.isFinite(Date.parse(parsed.presentedAt))) return undefined;
    return {
      presentedAt: parsed.presentedAt,
      ...(parsed.firstInputAt && Number.isFinite(Date.parse(parsed.firstInputAt))
        ? { firstInputAt: parsed.firstInputAt }
        : {}),
      hintOpened: parsed.hintOpened === true,
    };
  } catch {
    return undefined;
  }
}

function writeHintMarker(roundId: string, marker: ReadingOpenResponseHintMarker): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      `${READING_OPEN_RESPONSE_HINT_MARKER_PREFIX}${roundId}`,
      JSON.stringify(marker),
    );
  } catch {
    // Process-fact collection is non-critical and must never block Learning.
  }
}

async function synchronizeReadingOpenResponseProcessFact(
  descriptor: Awaited<ReturnType<typeof buildCurrentRoundDescriptor>>,
  attemptId: string,
  submittedAt: string,
  responseValidity: 'valid' | 'empty' | 'placeholder' | 'irrelevant' | 'insufficient',
  completed: boolean,
  completedAt?: string,
): Promise<void> {
  const marker = readHintMarker(descriptor.input.learningRoundId);
  const persisted = await persistenceRepository.loadByRound(
    descriptor.input.studentId,
    descriptor.input.learningRoundId,
  );
  const presentedAt = marker?.presentedAt || persisted?.savedAt || submittedAt;
  await readingOpenResponseProcessFactService.recordPresented({
    attemptId,
    runtimeScope: 'product',
    studentId: descriptor.input.studentId,
    learningSessionId: descriptor.input.learningSessionId,
    learningRoundId: descriptor.input.learningRoundId,
    materialVersionId: descriptor.input.resourceVersion.materialVersionId
      || 'material-version-unavailable',
    resourceVersionId: descriptor.input.resourceVersion.resourceVersionId,
    presentedAt,
  });
  const firstInputAt = marker?.firstInputAt || persisted?.savedAt;
  if (
    firstInputAt
    && Date.parse(firstInputAt) >= Date.parse(presentedAt)
    && Date.parse(firstInputAt) <= Date.parse(submittedAt)
  ) {
    await readingOpenResponseProcessFactService.recordFirstInput(attemptId, firstInputAt);
  }
  if (marker?.hintOpened) {
    await readingOpenResponseProcessFactService.recordHintOpened(attemptId, submittedAt);
  }
  await readingOpenResponseProcessFactService.recordSubmitted({
    attemptId,
    submittedAt,
    responseValidity,
  });
  if (completed) {
    await readingOpenResponseProcessFactService.recordCompleted({
      attemptId,
      completedAt: completedAt || submittedAt,
      followUpRole: descriptor.concreteTask.taskRole,
    });
  }
}
