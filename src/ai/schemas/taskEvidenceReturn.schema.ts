import type { AbilityEvidence } from './abilityEvidence.schema.ts';
import type { ConcreteLearningTask } from './concreteLearningTask.schema.ts';
import type { DiagnosisResult } from './diagnosis.schema.ts';
import type { EvaluationResult } from './evaluationResult.schema.ts';
import type { GrowthMemoryRecord } from './growthMemory.schema.ts';
import type { ProfileUpdateDecision } from './profileUpdateDecision.schema.ts';
import type { TaskExecutionResult } from './taskExecution.schema.ts';
import type { LearningProgressionContextSnapshot } from './learningProgressionContext.schema.ts';
import type { ProgressionPerformanceObservation } from './progressionPerformanceObservation.schema.ts';
import type { ProgressionInstabilityAssessment } from './progressionInstabilityAssessment.schema.ts';
import type {
  ProgressionEvidenceAdmissionDecision,
  ProgressionEvidenceContext,
} from './progressionEvidenceAdmission.schema.ts';

export type TaskEvidenceReturnStatus =
  | 'blocked_invalid_execution'
  | 'diagnosis_failed'
  | 'review_required'
  | 'evidence_returned';

export type TaskEvidenceTraceLink = {
  taskId: string;
  executionSessionId: string;
  responseId: string;
  diagnosisResultId: string;
};

export type TaskEvidenceReturnResult = {
  returnId: string;
  status: TaskEvidenceReturnStatus;
  studentId: string;
  taskId: string;
  executionSessionId: string;
  responseId?: string;
  concreteTask: ConcreteLearningTask;
  taskExecutionResult: TaskExecutionResult;
  diagnosisResult?: DiagnosisResult;
  diagnosisResultId?: string;
  abilityEvidence: AbilityEvidence[];
  evidenceTraceLinks: TaskEvidenceTraceLink[];
  evaluationResult?: EvaluationResult;
  profileUpdateDecision?: ProfileUpdateDecision;
  growthMemoryRecord?: GrowthMemoryRecord;
  progressionContextSnapshot?: LearningProgressionContextSnapshot;
  progressionObservation?: ProgressionPerformanceObservation;
  progressionInstabilityAssessment?: ProgressionInstabilityAssessment;
  progressionEvidenceContext?: ProgressionEvidenceContext;
  progressionEvidenceAdmissionDecision?: ProgressionEvidenceAdmissionDecision;
  supportContext: {
    usedHint: boolean;
    hintCount: number;
  };
  validation: {
    passed: boolean;
    diagnosisSchemaValid: boolean;
    taskDiagnosisAligned: boolean;
    studentIdConsistent: boolean;
    traceabilityComplete: boolean;
    reviewRequired: boolean;
    issues: string[];
  };
};

export function isTaskEvidenceReturnResult(value: unknown): value is TaskEvidenceReturnResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as TaskEvidenceReturnResult;
  return (
    isNonEmptyString(result.returnId) &&
    ['blocked_invalid_execution', 'diagnosis_failed', 'review_required', 'evidence_returned'].includes(result.status) &&
    isNonEmptyString(result.studentId) &&
    isNonEmptyString(result.taskId) &&
    isNonEmptyString(result.executionSessionId) &&
    Array.isArray(result.abilityEvidence) &&
    Array.isArray(result.evidenceTraceLinks) &&
    (!result.progressionEvidenceAdmissionDecision ||
      typeof result.progressionEvidenceAdmissionDecision.allowProfileEvaluation === 'boolean') &&
    typeof result.supportContext === 'object' &&
    result.supportContext !== null &&
    typeof result.supportContext.usedHint === 'boolean' &&
    typeof result.supportContext.hintCount === 'number' &&
    typeof result.validation === 'object' &&
    result.validation !== null &&
    typeof result.validation.passed === 'boolean' &&
    typeof result.validation.diagnosisSchemaValid === 'boolean' &&
    typeof result.validation.taskDiagnosisAligned === 'boolean' &&
    typeof result.validation.studentIdConsistent === 'boolean' &&
    typeof result.validation.traceabilityComplete === 'boolean' &&
    typeof result.validation.reviewRequired === 'boolean' &&
    Array.isArray(result.validation.issues) &&
    result.validation.issues.every((item) => typeof item === 'string')
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
