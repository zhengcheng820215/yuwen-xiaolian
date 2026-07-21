import type { ControlledFeedbackResult } from './controlledFeedbackExpression.schema.ts';
import type { RealLLMDiagnosisRuntimeResult } from './diagnosisRunRecord.schema.ts';
import type { EvidenceQualityAssessment } from './evidenceQualityAssessment.schema.ts';
import type { GrowthMemorySummary } from './growthMemory.schema.ts';
import type { LearningRoundResult } from './learningRound.schema.ts';
import type { NextLearningStrategy, TaskRequest } from './nextLearningStrategy.schema.ts';
import type { FrozenQuestionResourceVersion } from './questionResourceAdmission.schema.ts';
import type {
  QualityGatedExecutableTask,
  ResourceMatchQualityEvaluation,
} from './resourceMatchQuality.schema.ts';
import type { StudentAbilityProfile } from './studentAbilityProfile.schema.ts';
import type { ConcreteLearningTask, TaskReadinessValidation } from './concreteLearningTask.schema.ts';
import type { TaskExecutionResult } from './taskExecution.schema.ts';
import type { TaskEvidenceReturnResult } from './taskEvidenceReturn.schema.ts';

export const REAL_LEARNING_OPERATION_SCHEMA_VERSION = 'real_learning_operation_v1' as const;

export type RealLearningOperationStage =
  | 'task_prepared'
  | 'response_validated'
  | 'diagnosis_committed'
  | 'evidence_returned'
  | 'persisted'
  | 'next_task_ready';

export type RealLearningOperationStatus =
  | 'completed'
  | 'retry_required'
  | 'review_required'
  | 'blocked';

export type RealLearningOperationNextAction =
  | 'submit_answer'
  | 'retry_provider'
  | 'retry_persistence'
  | 'human_review'
  | 'prepare_resource'
  | 'start_next_task'
  | 'stop';

export type DiagnosisAdmissionDecision = {
  status: 'accepted' | 'questionable' | 'blocked';
  basis: 'formal_runtime_validation' | 'quality_policy';
  sourceIds: string[];
  limitations: string[];
  issues: string[];
};

export type NextFormalTaskResolution = {
  status: 'matched' | 'partial_match' | 'no_match' | 'review_required' | 'blocked';
  taskRequestId: string;
  resourceVersion?: FrozenQuestionResourceVersion;
  qualityGatedTask?: QualityGatedExecutableTask;
  concreteTask?: ConcreteLearningTask;
  taskReadiness?: TaskReadinessValidation;
  matchEvaluation?: ResourceMatchQualityEvaluation;
  issues: string[];
};

export type RealLearningOperationCheckpoint = {
  schemaVersion: typeof REAL_LEARNING_OPERATION_SCHEMA_VERSION;
  operationId: string;
  learningSessionId: string;
  learningRoundId: string;
  studentId: string;
  stage: RealLearningOperationStage;
  status: RealLearningOperationStatus;
  nextAction: RealLearningOperationNextAction;
  sourceResourceId: string;
  sourceResourceVersionId: string;
  sourceTaskId: string;
  diagnosisRequestId: string;
  concreteTask?: ConcreteLearningTask;
  taskReadiness?: TaskReadinessValidation;
  taskExecutionResult?: TaskExecutionResult;
  realDiagnosisRuntimeResult?: RealLLMDiagnosisRuntimeResult;
  diagnosisAdmission?: DiagnosisAdmissionDecision;
  taskEvidenceReturnResult?: TaskEvidenceReturnResult;
  evidenceQualityAssessment?: EvidenceQualityAssessment;
  controlledFeedbackResult?: ControlledFeedbackResult;
  updatedStudentAbilityProfile?: StudentAbilityProfile;
  updatedGrowthMemorySummary?: GrowthMemorySummary;
  nextLearningStrategy?: NextLearningStrategy;
  nextTaskRequest?: TaskRequest;
  nextTaskResolution?: NextFormalTaskResolution;
  learningRoundResult?: LearningRoundResult;
  learningPersistenceRecordId?: string;
  issues: string[];
  createdAt: string;
  updatedAt: string;
};

export type RealLearningChainAcceptanceReport = {
  acceptanceRunId: string;
  studentId: string;
  startedAt: string;
  completedAt?: string;
  status: RealLearningOperationStatus;
  firstRound: {
    learningSessionId: string;
    learningRoundId: string;
    resourceId: string;
    resourceVersionId: string;
    taskId: string;
    executionSessionId?: string;
    responseId?: string;
    formalDiagnosisId?: string;
    evidenceIds: string[];
  };
  persistence: {
    formalResultSaved: boolean;
    recoveredFromCheckpoint: boolean;
    diagnosisReexecutedDuringRecovery: boolean;
    duplicateFormalWrites: string[];
  };
  nextTask?: {
    strategyId: string;
    taskRequestId: string;
    resourceId: string;
    resourceVersionId: string;
    taskId: string;
  };
  checks: Record<string, boolean>;
  issues: string[];
};

export type Phase163RealLearningChainResult = {
  status: RealLearningOperationStatus;
  checkpoint: RealLearningOperationCheckpoint;
  acceptanceReport: RealLearningChainAcceptanceReport;
};

export function isRealLearningOperationCheckpoint(
  value: unknown,
): value is RealLearningOperationCheckpoint {
  if (!value || typeof value !== 'object') return false;
  const checkpoint = value as RealLearningOperationCheckpoint;
  return (
    checkpoint.schemaVersion === REAL_LEARNING_OPERATION_SCHEMA_VERSION &&
    isNonEmptyString(checkpoint.operationId) &&
    isNonEmptyString(checkpoint.learningSessionId) &&
    isNonEmptyString(checkpoint.learningRoundId) &&
    isNonEmptyString(checkpoint.studentId) &&
    ['task_prepared', 'response_validated', 'diagnosis_committed', 'evidence_returned', 'persisted', 'next_task_ready'].includes(checkpoint.stage) &&
    ['completed', 'retry_required', 'review_required', 'blocked'].includes(checkpoint.status) &&
    ['submit_answer', 'retry_provider', 'retry_persistence', 'human_review', 'prepare_resource', 'start_next_task', 'stop'].includes(checkpoint.nextAction) &&
    isNonEmptyString(checkpoint.sourceResourceId) &&
    isNonEmptyString(checkpoint.sourceResourceVersionId) &&
    isNonEmptyString(checkpoint.sourceTaskId) &&
    isNonEmptyString(checkpoint.diagnosisRequestId) &&
    Array.isArray(checkpoint.issues) &&
    checkpoint.issues.every((item) => typeof item === 'string') &&
    isTimestamp(checkpoint.createdAt) &&
    isTimestamp(checkpoint.updatedAt)
  );
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
