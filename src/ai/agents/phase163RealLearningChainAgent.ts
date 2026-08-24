import { assessEvidenceQuality } from './evidenceQualityAssessmentAgent.ts';
import { prepareConcreteLearningTaskFromFrozenResource } from './frozenQuestionResourceTaskAdapter.ts';
import { summarizeGrowthMemory } from './growthMemorySummaryAgent.ts';
import { saveLearningPersistenceRecord } from './learningPersistenceAgent.ts';
import { generateNextLearningStrategy } from './nextLearningStrategyAgent.ts';
import { applyProfileUpdateDecision } from './profileUpdateExecutor.ts';
import { runRealLLMRuntimeFoundation } from './realLLMRuntimeFoundationAgent.ts';
import { buildStudentRoundSummary } from './studentRoundSummaryAdapter.ts';
import { validateNextLearningStrategy } from './strategyValidationAgent.ts';
import { createTaskRequest } from './taskRequestAgent.ts';
import { runTaskEvidenceReturnAgent } from './taskEvidenceReturnAgent.ts';
import { runTaskExecutionAgent } from './taskExecutionAgent.ts';
import {
  createFeedbackExpressionConfigSnapshot,
  runControlledFeedbackExpression,
} from './controlledFeedbackExpressionAgent.ts';
import type { DiagnosisProviderAdapter } from '../providers/diagnosisProviderAdapter.ts';
import type { ControlledFeedbackRepository } from '../repositories/controlledFeedbackRepository.ts';
import type { FormalDiagnosisRepository } from '../repositories/formalDiagnosisRepository.ts';
import type { LearningPersistenceRepository } from '../repositories/learningPersistenceRepository.ts';
import type { LearningProgressionRuntimeService } from
  '../services/learningProgressionRuntimeService.ts';
import type { RealLearningOperationRepository } from '../repositories/realLearningOperationRepository.ts';
import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type {
  DiagnosisProviderConfigSnapshot,
  RealLLMDiagnosisRuntimeResult,
} from '../schemas/diagnosisRunRecord.schema.ts';
import type { RealLLMRuntimeFoundationInput } from './realLLMRuntimeFoundationAgent.ts';
import type { GrowthMemoryRecord, GrowthMemorySummary } from '../schemas/growthMemory.schema.ts';
import type {
  LearningRoundExecutionResult,
  LearningRoundResult,
  LearningRoundStartResult,
} from '../schemas/learningRound.schema.ts';
import type { CurrentLearningContext, TaskRequest } from '../schemas/nextLearningStrategy.schema.ts';
import type { FrozenQuestionResourceVersion } from '../schemas/questionResourceAdmission.schema.ts';
import {
  REAL_LEARNING_OPERATION_SCHEMA_VERSION,
  type DiagnosisAdmissionDecision,
  type NextFormalTaskResolution,
  type Phase163RealLearningChainResult,
  type RealLearningChainAcceptanceReport,
  type RealLearningOperationCheckpoint,
  type RealLearningOperationNextAction,
  type RealLearningOperationStage,
  type RealLearningOperationStatus,
} from '../schemas/realLearningOperation.schema.ts';
import type { QualityGatedExecutableTask } from '../schemas/resourceMatchQuality.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import type { SingleChoiceStudentAnswerValue } from '../schemas/singleChoiceInteraction.schema.ts';
import type { LearningProgressionContextSnapshot } from
  '../schemas/learningProgressionContext.schema.ts';
import type {
  ProgressionPerformanceObservation,
  ProgressionSupportMode,
} from '../schemas/progressionPerformanceObservation.schema.ts';

export type Phase163RealLearningChainInput = {
  operationId: string;
  learningSessionId: string;
  learningRoundId: string;
  diagnosisRequestId: string;
  studentId: string;
  resourceVersion: FrozenQuestionResourceVersion;
  qualityGatedTask: QualityGatedExecutableTask;
  answerText: string;
  singleChoiceAnswer?: SingleChoiceStudentAnswerValue;
  usedHint?: boolean;
  hintCount?: number;
  startedAt: string;
  submittedAt: string;
  currentProfile: StudentAbilityProfile;
  currentGrowthMemorySummary: GrowthMemorySummary;
  existingGrowthMemoryRecords?: GrowthMemoryRecord[];
  previousEvidence?: AbilityEvidence[];
  progressionContextSnapshot?: LearningProgressionContextSnapshot;
  previousProgressionObservations?: ProgressionPerformanceObservation[];
  progressionSupportMode?: ProgressionSupportMode;
  progressionTaskLoadRisk?: boolean;
  currentLearningContext: CurrentLearningContext;
  providerConfig: DiagnosisProviderConfigSnapshot;
  timezone: string;
};

export type Phase163RealLearningChainDependencies = {
  provider?: DiagnosisProviderAdapter;
  formalDiagnosisRepository: FormalDiagnosisRepository;
  controlledFeedbackRepository: ControlledFeedbackRepository;
  learningPersistenceRepository: LearningPersistenceRepository;
  operationRepository: RealLearningOperationRepository;
  learningProgressionRuntimeService?: LearningProgressionRuntimeService;
  runDiagnosisRuntime?: (
    input: RealLLMRuntimeFoundationInput,
  ) => Promise<RealLLMDiagnosisRuntimeResult>;
  resolveNextTask(input: {
    taskRequest: TaskRequest;
    previousResourceVersion: FrozenQuestionResourceVersion;
    previousQualityGatedTask: QualityGatedExecutableTask;
    updatedProfile: StudentAbilityProfile;
    updatedGrowthMemorySummary: GrowthMemorySummary;
  }): Promise<NextFormalTaskResolution>;
  assessDiagnosisAdmission?: (
    checkpoint: RealLearningOperationCheckpoint,
  ) => DiagnosisAdmissionDecision | Promise<DiagnosisAdmissionDecision>;
  now?: () => string;
};

export async function runPhase163RealLearningChain(
  input: Phase163RealLearningChainInput,
  dependencies: Phase163RealLearningChainDependencies,
): Promise<Phase163RealLearningChainResult> {
  const now = dependencies.now || (() => new Date().toISOString());
  const existing = await dependencies.operationRepository.getByOperationId(input.operationId);
  const identityIssues = existing ? validateOperationIdentity(input, existing) : [];
  if (identityIssues.length > 0) {
    return resultFromCheckpoint(
      input,
      blockCheckpoint(existing!, identityIssues, now()),
      true,
    );
  }
  if (existing?.stage === 'next_task_ready' && existing.status === 'completed') {
    return resultFromCheckpoint(input, existing, true);
  }

  let checkpoint = existing || await prepareInitialCheckpoint(input, dependencies, now());
  const recoverableResourceGap = checkpoint.status === 'blocked' &&
    Boolean(checkpoint.learningPersistenceRecordId) &&
    checkpoint.nextTaskResolution?.status !== 'matched' &&
    (
      checkpoint.nextAction === 'prepare_resource' ||
      checkpoint.issues.every((issue) => (
        issue.startsWith('operation_identity_mismatch:') ||
        checkpoint.nextTaskResolution?.issues.includes(issue)
      ))
    );
  if ((checkpoint.status === 'blocked' && !recoverableResourceGap) || !checkpoint.concreteTask || !checkpoint.taskReadiness) {
    return resultFromCheckpoint(input, checkpoint, Boolean(existing));
  }

  if (!checkpoint.taskExecutionResult) {
    const execution = runTaskExecutionAgent({
      concreteTask: checkpoint.concreteTask,
      readiness: checkpoint.taskReadiness,
      studentAnswer: {
        answerText: input.answerText,
        singleChoiceAnswer: input.singleChoiceAnswer,
        usedHint: input.usedHint,
        hintCount: input.hintCount,
        submittedAt: input.submittedAt,
      },
      startedAt: input.startedAt,
    });
    if (!execution.taskExecutionResult) {
      checkpoint = await persistCheckpoint(dependencies.operationRepository, {
        ...checkpoint,
        status: 'blocked',
        nextAction: 'stop',
        issues: unique([...checkpoint.issues, execution.blockedReason || 'task_execution_failed']),
        updatedAt: now(),
      });
      return resultFromCheckpoint(input, checkpoint, Boolean(existing));
    }
    checkpoint = await persistCheckpoint(dependencies.operationRepository, {
      ...checkpoint,
      stage: 'response_validated',
      status: execution.taskExecutionResult.canEnterDiagnosisRuntime ? 'retry_required' : 'retry_required',
      nextAction: execution.taskExecutionResult.canEnterDiagnosisRuntime ? 'retry_provider' : 'submit_answer',
      taskExecutionResult: execution.taskExecutionResult,
      issues: execution.taskExecutionResult.canEnterDiagnosisRuntime
        ? []
        : execution.taskExecutionResult.responseValidity.reasons,
      updatedAt: now(),
    });
  }
  if (!checkpoint.taskExecutionResult?.canEnterDiagnosisRuntime) {
    return resultFromCheckpoint(input, checkpoint, Boolean(existing));
  }

  if (!checkpoint.realDiagnosisRuntimeResult) {
    const diagnosisInput: RealLLMRuntimeFoundationInput = {
      concreteTask: checkpoint.concreteTask,
      taskExecutionResult: checkpoint.taskExecutionResult,
      executionMode: 'live',
      requestId: input.diagnosisRequestId,
      providerConfig: input.providerConfig,
      commitOnSuccess: true,
      evidenceReturnAlreadyCompleted: false,
      startedAt: input.startedAt,
    };
    const runtime = dependencies.runDiagnosisRuntime
      ? await dependencies.runDiagnosisRuntime(diagnosisInput)
      : await runDiagnosisDirectly(diagnosisInput, dependencies, now);
    if (
      runtime.status !== 'formal_result_committed' ||
      !runtime.canEnterEvidenceReturn ||
      !runtime.formalDiagnosisCommit?.diagnosisResult
    ) {
      const review = runtime.status === 'review_required' || runtime.formalizationStatus === 'review_required';
      checkpoint = await persistCheckpoint(dependencies.operationRepository, {
        ...checkpoint,
        status: review ? 'review_required' : runtime.status === 'failed' ? 'retry_required' : 'blocked',
        nextAction: review ? 'human_review' : runtime.status === 'failed' ? 'retry_provider' : 'stop',
        realDiagnosisRuntimeResult: runtime,
        issues: unique([...runtime.validation.issues, ...runtime.runRecord.issues]),
        updatedAt: now(),
      });
      return resultFromCheckpoint(input, checkpoint, Boolean(existing));
    }
    const diagnosis = runtime.formalDiagnosisCommit.diagnosisResult;
    if (diagnosis.answerStatus === 'insufficient_evidence' && diagnosis.scoreBand === 'invalid') {
      checkpoint = await persistCheckpoint(dependencies.operationRepository, {
        ...checkpoint,
        stage: 'response_validated',
        status: 'retry_required',
        nextAction: 'submit_answer',
        taskExecutionResult: undefined,
        realDiagnosisRuntimeResult: undefined,
        issues: ['semantic_answer_validity_insufficient'],
        updatedAt: now(),
      });
      return resultFromCheckpoint(input, checkpoint, Boolean(existing));
    }
    checkpoint = await persistCheckpoint(dependencies.operationRepository, {
      ...checkpoint,
      stage: 'diagnosis_committed',
      status: 'retry_required',
      nextAction: 'human_review',
      realDiagnosisRuntimeResult: runtime,
      issues: [],
      updatedAt: now(),
    });
  }

  if (!checkpoint.diagnosisAdmission) {
    const admission = dependencies.assessDiagnosisAdmission
      ? await dependencies.assessDiagnosisAdmission(checkpoint)
      : defaultDiagnosisAdmission(checkpoint);
    checkpoint = await persistCheckpoint(dependencies.operationRepository, {
      ...checkpoint,
      diagnosisAdmission: admission,
      status: admission.status === 'accepted' ? 'retry_required' : admission.status === 'questionable' ? 'review_required' : 'blocked',
      nextAction: admission.status === 'accepted' ? 'human_review' : admission.status === 'questionable' ? 'human_review' : 'stop',
      issues: admission.issues,
      updatedAt: now(),
    });
  }
  if (checkpoint.diagnosisAdmission.status !== 'accepted') {
    return resultFromCheckpoint(input, checkpoint, Boolean(existing));
  }

  if (!checkpoint.taskEvidenceReturnResult) {
    const runtime = checkpoint.realDiagnosisRuntimeResult!;
    const evidenceReturn = runTaskEvidenceReturnAgent({
      concreteTask: checkpoint.concreteTask,
      taskExecutionResult: checkpoint.taskExecutionResult,
      previousEvidence: input.previousEvidence,
      currentProfile: input.currentProfile,
      diagnosisResult: runtime.formalDiagnosisCommit?.diagnosisResult,
      diagnosisResultId: runtime.formalDiagnosisCommit?.formalDiagnosisId,
      progressionContextSnapshot: input.progressionContextSnapshot,
      previousProgressionObservations: input.previousProgressionObservations,
      progressionSupportMode: input.progressionSupportMode,
      progressionTaskLoadRisk: input.progressionTaskLoadRisk,
      returnedAt: input.submittedAt,
    });
    if (evidenceReturn.status !== 'evidence_returned' || !evidenceReturn.validation.passed) {
      checkpoint = await persistCheckpoint(dependencies.operationRepository, {
        ...checkpoint,
        status: evidenceReturn.status === 'review_required' ? 'review_required' : 'blocked',
        nextAction: evidenceReturn.status === 'review_required' ? 'human_review' : 'stop',
        taskEvidenceReturnResult: evidenceReturn,
        issues: evidenceReturn.validation.issues,
        updatedAt: now(),
      });
      return resultFromCheckpoint(input, checkpoint, Boolean(existing));
    }
    const profileEvaluationAllowed = evidenceReturn.progressionEvidenceAdmissionDecision
      ?.allowProfileEvaluation !== false;
    const profileExecution = profileEvaluationAllowed && evidenceReturn.profileUpdateDecision
      ? applyProfileUpdateDecision({
          currentProfile: input.currentProfile,
          decision: evidenceReturn.profileUpdateDecision,
          appliedAt: input.submittedAt,
        })
      : { afterProfile: input.currentProfile };
    const memoryRecords = uniqueById([
      ...(input.existingGrowthMemoryRecords || []),
      ...(profileEvaluationAllowed && evidenceReturn.growthMemoryRecord
        ? [evidenceReturn.growthMemoryRecord]
        : []),
    ], (record) => record.recordId);
    const memorySummary = profileEvaluationAllowed && evidenceReturn.growthMemoryRecord
      ? summarizeGrowthMemory({
          studentId: input.studentId,
          abilityId: checkpoint.concreteTask.targetAbilityId,
          records: memoryRecords,
        })
      : input.currentGrowthMemorySummary;
    const evidence = evidenceReturn.abilityEvidence[0];
    const quality = assessEvidenceQuality({
      studentId: input.studentId,
      targetAbilityId: checkpoint.concreteTask.targetAbilityId,
      abilityEvidence: evidence,
      concreteLearningTask: checkpoint.concreteTask,
      taskExecutionResult: checkpoint.taskExecutionResult,
      taskEvidenceReturnResult: evidenceReturn,
      retentionContext: {
        baselineTaskId: input.currentGrowthMemorySummary.latestRecordId || checkpoint.concreteTask.taskId,
        baselineEvidenceAt: input.startedAt,
        materialRelation: checkpoint.concreteTask.taskRole === 'transfer' ? 'new_material' : 'similar_material',
        difficultyRelation: 'comparable',
        source: 'comparison_adapter',
        validationPassed: true,
      },
      assessedAt: input.submittedAt,
      timezone: input.timezone,
    });
    const feedback = await runControlledFeedbackExpression({
      feedbackRequestId: `phase16-3-feedback-${input.operationId}`,
      learningRoundId: input.learningRoundId,
      studentId: input.studentId,
      taskId: checkpoint.concreteTask.taskId,
      executionSessionId: checkpoint.taskExecutionResult.executionSessionId,
      responseId: checkpoint.taskExecutionResult.studentResponse!.responseId,
      studentResponseText: responseDisplayText(
        checkpoint.concreteTask,
        checkpoint.taskExecutionResult.studentResponse!,
      ),
      taskContext: {
        readingText: checkpoint.concreteTask.readingText,
        questionText: checkpoint.concreteTask.question,
        answerRequirements: checkpoint.concreteTask.answerRequirements,
      },
      realDiagnosisRuntimeResult: runtime,
      taskEvidenceReturnResult: evidenceReturn,
      expressionConfig: createFeedbackExpressionConfigSnapshot({
        expressionPolicy: 'deterministic_only',
        createdAt: input.submittedAt,
      }),
      requestedAt: input.submittedAt,
    }, {
      repository: dependencies.controlledFeedbackRepository,
    });
    checkpoint = await persistCheckpoint(dependencies.operationRepository, {
      ...checkpoint,
      stage: 'evidence_returned',
      status: 'retry_required',
      nextAction: 'retry_persistence',
      taskEvidenceReturnResult: evidenceReturn,
      evidenceQualityAssessment: quality,
      controlledFeedbackResult: feedback,
      updatedStudentAbilityProfile: profileExecution.afterProfile,
      updatedGrowthMemorySummary: memorySummary,
      issues: unique([...quality.validation.issues, ...feedback.validation.issues]),
      updatedAt: now(),
    });
  }

  if (checkpoint.taskEvidenceReturnResult && dependencies.learningProgressionRuntimeService) {
    try {
      await dependencies.learningProgressionRuntimeService.persistEvidenceSidecar(
        checkpoint.taskEvidenceReturnResult,
      );
    } catch (error) {
      checkpoint = await persistCheckpoint(dependencies.operationRepository, {
        ...checkpoint,
        status: 'retry_required',
        nextAction: 'retry_persistence',
        issues: unique([
          ...checkpoint.issues,
          `learning_progression_sidecar_persistence_failed:${error instanceof Error
            ? error.message : String(error)}`,
        ]),
        updatedAt: now(),
      });
      return resultFromCheckpoint(input, checkpoint, Boolean(existing));
    }
  }

  if (!checkpoint.learningPersistenceRecordId) {
    checkpoint = await persistFormalRound(input, dependencies, checkpoint, now());
    if (!checkpoint.learningPersistenceRecordId) {
      return resultFromCheckpoint(input, checkpoint, Boolean(existing));
    }
  }

  const shouldResolveNextTask = !checkpoint.nextTaskResolution || (
    recoverableResourceGap && checkpoint.nextTaskResolution.status !== 'matched'
  );
  if (shouldResolveNextTask) {
    const strategy = checkpoint.nextLearningStrategy || generateNextLearningStrategy({
      growthMemorySummary: checkpoint.updatedGrowthMemorySummary!,
      studentAbilityProfile: checkpoint.updatedStudentAbilityProfile!,
      currentLearningContext: input.currentLearningContext,
      createdAt: input.submittedAt,
    });
    let taskRequest = checkpoint.nextTaskRequest;
    if (!taskRequest) {
      const strategyValidation = validateNextLearningStrategy({
        strategy,
        currentLearningContext: input.currentLearningContext,
        validatedAt: input.submittedAt,
      });
      const taskRequestResult = createTaskRequest({
        strategy,
        validationResult: strategyValidation,
        createdAt: input.submittedAt,
      });
      taskRequest = taskRequestResult.taskRequest || undefined;
      if (!taskRequest) {
        checkpoint = await persistCheckpoint(dependencies.operationRepository, {
          ...checkpoint,
          status: strategyValidation.nextStep === 'review_required' ? 'review_required' : 'blocked',
          nextAction: strategyValidation.nextStep === 'review_required' ? 'human_review' : 'stop',
          nextLearningStrategy: strategy,
          issues: unique(strategyValidation.validationErrors),
          updatedAt: now(),
        });
        return resultFromCheckpoint(input, checkpoint, Boolean(existing));
      }
    }
    if (!taskRequest) {
      checkpoint = await persistCheckpoint(dependencies.operationRepository, {
        ...checkpoint,
        status: 'blocked',
        nextAction: 'stop',
        nextLearningStrategy: strategy,
        issues: unique([...checkpoint.issues, 'next_task_request_missing']),
        updatedAt: now(),
      });
      return resultFromCheckpoint(input, checkpoint, Boolean(existing));
    }
    const rawResolution = await dependencies.resolveNextTask({
      taskRequest,
      previousResourceVersion: input.resourceVersion,
      previousQualityGatedTask: input.qualityGatedTask,
      updatedProfile: checkpoint.updatedStudentAbilityProfile!,
      updatedGrowthMemorySummary: checkpoint.updatedGrowthMemorySummary!,
    });
    if (rawResolution.resolvedTaskRequest) {
      taskRequest = rawResolution.resolvedTaskRequest;
    }
    let resolution = rawResolution;
    if (rawResolution.status === 'matched' && rawResolution.resourceVersion && rawResolution.qualityGatedTask) {
      const preparation = prepareConcreteLearningTaskFromFrozenResource({
        resourceVersion: rawResolution.resourceVersion,
        qualityGatedTask: rawResolution.qualityGatedTask,
        createdAt: now(),
      });
      resolution = preparation.status === 'prepared' && preparation.concreteTaskResult.concreteTask
        ? {
          ...rawResolution,
          concreteTask: preparation.concreteTaskResult.concreteTask,
          taskReadiness: preparation.concreteTaskResult.readiness,
        }
        : {
          ...rawResolution,
          status: 'blocked',
          issues: unique([...rawResolution.issues, ...preparation.issues, 'next_concrete_task_not_ready']),
        };
    }
    const successful = resolution.status === 'matched' && resolution.resourceVersion &&
      resolution.qualityGatedTask && resolution.concreteTask && resolution.taskReadiness?.canExecute;
    const sessionComplete = resolution.status === 'session_complete';
    checkpoint = await persistCheckpoint(dependencies.operationRepository, {
      ...checkpoint,
      stage: successful ? 'next_task_ready' : 'persisted',
      status: successful || sessionComplete
        ? 'completed'
        : resolution.status === 'review_required'
          ? 'review_required'
          : 'blocked',
      nextAction: successful
        ? 'start_next_task'
        : sessionComplete
          ? 'stop'
          : resolution.status === 'review_required'
            ? 'human_review'
            : 'prepare_resource',
      nextLearningStrategy: strategy,
      nextTaskRequest: taskRequest,
      nextTaskResolution: resolution,
      issues: resolution.issues,
      updatedAt: now(),
    });
  }

  return resultFromCheckpoint(input, checkpoint, Boolean(existing));
}

async function runDiagnosisDirectly(
  input: RealLLMRuntimeFoundationInput,
  dependencies: Phase163RealLearningChainDependencies,
  now: () => string,
): Promise<RealLLMDiagnosisRuntimeResult> {
  if (!dependencies.provider) {
    throw new Error('Diagnosis provider or application boundary is required.');
  }
  return runRealLLMRuntimeFoundation(input, {
    provider: dependencies.provider,
    formalDiagnosisRepository: dependencies.formalDiagnosisRepository,
    now,
  });
}

async function prepareInitialCheckpoint(
  input: Phase163RealLearningChainInput,
  dependencies: Phase163RealLearningChainDependencies,
  createdAt: string,
): Promise<RealLearningOperationCheckpoint> {
  const preparation = prepareConcreteLearningTaskFromFrozenResource({
    resourceVersion: input.resourceVersion,
    qualityGatedTask: input.qualityGatedTask,
    progressionContextSnapshot: input.progressionContextSnapshot,
    createdAt,
  });
  const concreteTask = preparation.concreteTaskResult.concreteTask || undefined;
  const checkpoint: RealLearningOperationCheckpoint = {
    schemaVersion: REAL_LEARNING_OPERATION_SCHEMA_VERSION,
    operationId: input.operationId,
    learningSessionId: input.learningSessionId,
    learningRoundId: input.learningRoundId,
    studentId: input.studentId,
    stage: 'task_prepared',
    status: preparation.status === 'prepared' ? 'retry_required' : 'blocked',
    nextAction: preparation.status === 'prepared' ? 'submit_answer' : 'stop',
    sourceResourceId: input.resourceVersion.resourceId,
    sourceResourceVersionId: input.resourceVersion.resourceVersionId,
    sourceTaskId: input.resourceVersion.taskId,
    diagnosisRequestId: input.diagnosisRequestId,
    concreteTask,
    taskReadiness: preparation.concreteTaskResult.readiness,
    issues: preparation.issues,
    createdAt,
    updatedAt: createdAt,
  };
  return persistCheckpoint(dependencies.operationRepository, checkpoint);
}

async function persistFormalRound(
  input: Phase163RealLearningChainInput,
  dependencies: Phase163RealLearningChainDependencies,
  checkpoint: RealLearningOperationCheckpoint,
  updatedAt: string,
): Promise<RealLearningOperationCheckpoint> {
  const roundResult = buildLearningRoundResult(input, checkpoint);
  const feedback = checkpoint.controlledFeedbackResult!.studentLearningFeedback;
  const entryState = {
    learningRoundId: input.learningRoundId,
    studentId: input.studentId,
    status: 'ready_to_answer' as const,
    viewStatus: 'feedback_ready' as const,
    taskTitle: `${checkpoint.concreteTask!.targetAbilityName}练习`,
    readingText: checkpoint.concreteTask!.readingText,
    questionText: checkpoint.concreteTask!.question,
    answerRequirements: checkpoint.concreteTask!.answerRequirements,
    successCriteriaText: checkpoint.concreteTask!.scoringPoints,
    studentRoundFocus: {
      title: checkpoint.concreteTask!.targetAbilityName,
      description: checkpoint.concreteTask!.validationGoal,
    },
    canAnswer: false,
    canSubmit: false,
  };
  const summary = buildStudentRoundSummary({
    learningRoundResult: roundResult,
    studentLearningFeedback: feedback,
    studentLearningEntryState: entryState,
  });
  try {
    const record = await saveLearningPersistenceRecord(dependencies.learningPersistenceRepository, {
      studentId: input.studentId,
      learningRoundId: input.learningRoundId,
      savedAt: updatedAt,
      updatedAt,
      sourceVersion: REAL_LEARNING_OPERATION_SCHEMA_VERSION,
      learningRoundResult: roundResult,
      concreteTask: checkpoint.concreteTask,
      progressionContextSnapshot: checkpoint.concreteTask?.progressionContextSnapshot,
      studentResponse: checkpoint.taskExecutionResult?.studentResponse,
      studentLearningFeedback: feedback,
      studentRoundSummary: summary,
      growthMemoryRecord: checkpoint.taskEvidenceReturnResult?.growthMemoryRecord,
      growthMemorySummary: checkpoint.updatedGrowthMemorySummary,
      studentAbilityProfile: checkpoint.updatedStudentAbilityProfile,
    });
    if (record.status !== 'saved') throw new Error(record.issues.join(', ') || 'persistence_record_invalid');
    return persistCheckpoint(dependencies.operationRepository, {
      ...checkpoint,
      stage: 'persisted',
      status: 'retry_required',
      nextAction: 'prepare_resource',
      learningRoundResult: roundResult,
      learningPersistenceRecordId: record.recordId,
      issues: [],
      updatedAt,
    });
  } catch (error) {
    return persistCheckpoint(dependencies.operationRepository, {
      ...checkpoint,
      status: 'retry_required',
      nextAction: 'retry_persistence',
      learningRoundResult: roundResult,
      issues: [error instanceof Error ? error.message : String(error)],
      updatedAt,
    });
  }
}

function buildLearningRoundResult(
  input: Phase163RealLearningChainInput,
  checkpoint: RealLearningOperationCheckpoint,
): LearningRoundResult {
  const startResult: LearningRoundStartResult = {
    learningRoundId: input.learningRoundId,
    studentId: input.studentId,
    status: 'ready_for_execution',
    growthMemorySummary: input.currentGrowthMemorySummary,
    studentAbilityProfile: input.currentProfile,
    currentLearningContext: input.currentLearningContext,
    executableTask: input.qualityGatedTask.executableTask,
    concreteTask: checkpoint.concreteTask,
    taskReadinessValidation: checkpoint.taskReadiness,
    nextAction: 'start_task_execution',
    issues: [],
  };
  const executionResult: LearningRoundExecutionResult = {
    learningRoundId: input.learningRoundId,
    studentId: input.studentId,
    status: 'evidence_return_ready',
    startResult,
    studentResponse: checkpoint.taskExecutionResult?.studentResponse,
    responseValidityResult: checkpoint.taskExecutionResult?.responseValidity,
    taskExecutionResult: checkpoint.taskExecutionResult,
    canEnterEvidenceReturn: true,
    nextAction: 'enter_evidence_return',
    issues: [],
  };
  return {
    learningRoundId: input.learningRoundId,
    studentId: input.studentId,
    status: 'completed',
    startResult,
    executionResult,
    taskEvidenceReturnResult: checkpoint.taskEvidenceReturnResult,
    nextStep: 'continue',
    nextStepReason: '本轮正式结果已经保存，可以生成下一轮任务。',
    issues: [],
  };
}

function defaultDiagnosisAdmission(checkpoint: RealLearningOperationCheckpoint): DiagnosisAdmissionDecision {
  const runtime = checkpoint.realDiagnosisRuntimeResult;
  const commit = runtime?.formalDiagnosisCommit;
  const accepted = Boolean(
    runtime?.status === 'formal_result_committed' &&
    runtime.validation.passed &&
    runtime.canEnterEvidenceReturn &&
    commit?.status === 'committed' &&
    commit.validation.passed &&
    commit.diagnosisResult,
  );
  return {
    status: accepted ? 'accepted' : 'blocked',
    basis: 'formal_runtime_validation',
    sourceIds: [runtime?.requestId || '', commit?.formalDiagnosisId || ''].filter(Boolean),
    limitations: ['not_individually_human_annotated'],
    issues: accepted ? [] : ['formal_diagnosis_admission_failed'],
  };
}

async function persistCheckpoint(
  repository: RealLearningOperationRepository,
  checkpoint: RealLearningOperationCheckpoint,
): Promise<RealLearningOperationCheckpoint> {
  const write = await repository.save(checkpoint);
  if (write.status === 'conflict') {
    return blockCheckpoint(write.checkpoint, write.issues, checkpoint.updatedAt);
  }
  return write.checkpoint;
}

function blockCheckpoint(
  checkpoint: RealLearningOperationCheckpoint,
  issues: string[],
  updatedAt: string,
): RealLearningOperationCheckpoint {
  return {
    ...checkpoint,
    status: 'blocked',
    nextAction: 'stop',
    issues: unique([...checkpoint.issues, ...issues]),
    updatedAt,
  };
}

function validateOperationIdentity(
  input: Phase163RealLearningChainInput,
  checkpoint: RealLearningOperationCheckpoint,
): string[] {
  const pairs: Array<[string, string, string]> = [
    ['studentId', input.studentId, checkpoint.studentId],
    ['learningSessionId', input.learningSessionId, checkpoint.learningSessionId],
    ['learningRoundId', input.learningRoundId, checkpoint.learningRoundId],
    ['diagnosisRequestId', input.diagnosisRequestId, checkpoint.diagnosisRequestId],
    ['resourceId', input.resourceVersion.resourceId, checkpoint.sourceResourceId],
    ['resourceVersionId', input.resourceVersion.resourceVersionId, checkpoint.sourceResourceVersionId],
    ['taskId', input.resourceVersion.taskId, checkpoint.sourceTaskId],
  ];
  const issues = pairs.filter(([, actual, expected]) => actual !== expected).map(([key]) => `operation_identity_mismatch:${key}`);
  const storedResponse = checkpoint.taskExecutionResult?.studentResponse;
  if (storedResponse && responseIdentity(storedResponse.answerText, storedResponse.singleChoiceAnswer) !== responseIdentity(input.answerText, input.singleChoiceAnswer)) {
    issues.push('operation_identity_mismatch:studentResponse');
  }
  if (storedResponse && storedResponse.usedHint !== Boolean(input.usedHint)) {
    issues.push('operation_identity_mismatch:usedHint');
  }
  if (storedResponse && storedResponse.hintCount !== Math.max(0, input.hintCount || 0)) {
    issues.push('operation_identity_mismatch:hintCount');
  }
  return issues;
}

function responseIdentity(answerText: string, choice?: SingleChoiceStudentAnswerValue): string {
  return choice
    ? `${choice.optionSetVersion}:${choice.selectedOptionIds.join(',')}:${choice.displayedOptionOrder.join(',')}`
    : answerText.trim();
}

function responseDisplayText(
  task: NonNullable<RealLearningOperationCheckpoint['concreteTask']>,
  response: NonNullable<NonNullable<RealLearningOperationCheckpoint['taskExecutionResult']>['studentResponse']>,
): string {
  if (task.responseFormat !== 'single_choice' || !response.singleChoiceAnswer) return response.answerText;
  const selected = response.singleChoiceAnswer.selectedOptionIds[0];
  return task.singleChoiceDelivery?.options.find((option) => option.optionId === selected)?.content
    || '已完成单项选择作答';
}

function resultFromCheckpoint(
  input: Phase163RealLearningChainInput,
  checkpoint: RealLearningOperationCheckpoint,
  recovered: boolean,
): Phase163RealLearningChainResult {
  return {
    status: checkpoint.status,
    checkpoint,
    acceptanceReport: buildAcceptanceReport(input, checkpoint, recovered),
  };
}

function buildAcceptanceReport(
  input: Phase163RealLearningChainInput,
  checkpoint: RealLearningOperationCheckpoint,
  recovered: boolean,
): RealLearningChainAcceptanceReport {
  const execution = checkpoint.taskExecutionResult;
  const evidenceReturn = checkpoint.taskEvidenceReturnResult;
  const next = checkpoint.nextTaskResolution;
  const nextVersion = next?.resourceVersion;
  const nextTask = next?.qualityGatedTask;
  const trace = evidenceReturn?.evidenceTraceLinks[0];
  const formal = checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit;
  const checks = {
    sourceResourceFrozen: input.resourceVersion.status === 'frozen',
    taskIdentityAligned: checkpoint.sourceTaskId === input.qualityGatedTask.executableTask.sourceTaskId &&
      checkpoint.concreteTask?.sourceExecutableTaskId === input.qualityGatedTask.executableTask.executableTaskId,
    responseIdentityAligned: execution?.studentId === input.studentId && execution?.taskId === checkpoint.concreteTask?.taskId,
    formalDiagnosisCommitted: formal?.status === 'committed',
    evidenceReturnedOnce: evidenceReturn?.status === 'evidence_returned' && evidenceReturn.abilityEvidence.length === 1,
    traceabilityComplete: Boolean(trace && trace.taskId && trace.executionSessionId && trace.responseId && trace.diagnosisResultId),
    formalResultSaved: Boolean(checkpoint.learningPersistenceRecordId),
    nextTaskUsesFormalResource: Boolean(nextVersion?.status === 'frozen' && nextTask?.resourceVersionId === nextVersion?.resourceVersionId),
    nextConcreteTaskReady: Boolean(next?.concreteTask && next.taskReadiness?.canExecute),
    nextTaskDerivedFromMemory: Boolean(checkpoint.nextTaskRequest?.growthMemoryRecordIds.includes(evidenceReturn?.growthMemoryRecord?.recordId || '')),
  };
  return {
    acceptanceRunId: `phase16-3-acceptance-${input.operationId}`,
    studentId: input.studentId,
    startedAt: checkpoint.createdAt,
    completedAt: checkpoint.stage === 'next_task_ready' ? checkpoint.updatedAt : undefined,
    status: checkpoint.status,
    firstRound: {
      learningSessionId: input.learningSessionId,
      learningRoundId: input.learningRoundId,
      resourceId: input.resourceVersion.resourceId,
      resourceVersionId: input.resourceVersion.resourceVersionId,
      taskId: input.resourceVersion.taskId,
      executionSessionId: execution?.executionSessionId,
      responseId: execution?.studentResponse?.responseId,
      formalDiagnosisId: formal?.formalDiagnosisId,
      evidenceIds: evidenceReturn?.abilityEvidence.map((item) => item.id) || [],
    },
    persistence: {
      formalResultSaved: Boolean(checkpoint.learningPersistenceRecordId),
      recoveredFromCheckpoint: recovered,
      diagnosisReexecutedDuringRecovery: false,
      duplicateFormalWrites: [],
    },
    nextTask: nextVersion && nextTask && checkpoint.nextLearningStrategy && checkpoint.nextTaskRequest
      ? {
        strategyId: checkpoint.nextLearningStrategy.strategyId,
        taskRequestId: checkpoint.nextTaskRequest.taskRequestId,
        resourceId: nextVersion.resourceId,
        resourceVersionId: nextVersion.resourceVersionId,
        taskId: nextTask.taskId,
      }
      : undefined,
    checks,
    issues: checkpoint.issues,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueById<T>(items: T[], getId: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [getId(item), item])).values()];
}
