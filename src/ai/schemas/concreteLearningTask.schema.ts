import type { QuestionMetadata, QuestionMetadataRubricItem } from './diagnosis.schema.ts';
import type {
  ExecutableLearningTask,
  TaskGenerationRequest,
} from './taskFulfillment.schema.ts';
import type { RecommendedTaskRole } from './nextLearningStrategy.schema.ts';
import type {
  SingleChoiceInteraction,
  StudentSingleChoiceDelivery,
} from './singleChoiceInteraction.schema.ts';
import {
  isLearningProgressionContextSnapshot,
  type LearningProgressionContextSnapshot,
} from './learningProgressionContext.schema.ts';

export type ConcreteLearningTaskSourceType =
  | 'matched_resource'
  | 'generated_request'
  | 'mock';

export type ConcreteLearningTaskIntent = {
  sourceObservationTaskPlanId: string;
  observationGoal: string;
  expectedStudentAction: string;
  designReason: string;
  isFoundationEntry: boolean;
};

export type ConcreteLearningTask = {
  taskId: string;
  studentId: string;
  sourceType: ConcreteLearningTaskSourceType;
  sourceTaskRequestId?: string;
  sourceFulfillmentRequestId?: string;
  sourceExecutableTaskId?: string;
  sourceTaskGenerationRequestId?: string;
  sourceStrategyId?: string;
  targetAbilityId: string;
  targetAbilityName: string;
  taskRole: RecommendedTaskRole;
  validationGoal: string;
  /** Frozen per attempt; never recompute after the attempt starts. */
  progressionContextSnapshot?: LearningProgressionContextSnapshot;
  learningIntent?: ConcreteLearningTaskIntent;
  readingText?: string;
  responseFormat?: 'text' | 'single_choice';
  singleChoiceDelivery?: StudentSingleChoiceDelivery;
  /** Internal evaluation basis. Never expose this field in the student workspace projection. */
  singleChoiceEvaluation?: SingleChoiceInteraction;
  question: string;
  answerRequirements: string[];
  referenceAnswer?: string;
  scoringPoints: string[];
  rubric: QuestionMetadataRubricItem[];
  questionMetadata: QuestionMetadata;
  expectedDiagnosisFocus: string[];
  createdAt: string;
};

export type TaskReadinessIssueCode =
  | 'MISSING_DISPLAY_CONTENT'
  | 'MISSING_RESPONSE_REQUIREMENTS'
  | 'MISSING_ASSESSMENT_BASIS'
  | 'INCOMPLETE_METADATA'
  | 'TARGET_ABILITY_MISMATCH'
  | 'TASK_ROLE_MISMATCH'
  | 'VALIDATION_GOAL_MISSING'
  | 'SOURCE_NOT_TRACEABLE'
  | 'DIAGNOSIS_RUNTIME_NOT_READY';

export type TaskReadinessIssue = {
  code: TaskReadinessIssueCode;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
};

export type TaskReadinessValidationChecks = {
  canDisplay: boolean;
  canAcceptResponse: boolean;
  hasAssessmentBasis: boolean;
  metadataComplete: boolean;
  targetAbilityAligned: boolean;
  taskRoleAligned: boolean;
  validationGoalPreserved: boolean;
  sourceTraceable: boolean;
  canEnterDiagnosisRuntime: boolean;
};

export type TaskReadinessValidation = {
  taskId: string;
  canExecute: boolean;
  checks: TaskReadinessValidationChecks;
  issues: TaskReadinessIssue[];
};

export type ConcreteLearningTaskInstantiationInput = {
  executableTask?: ExecutableLearningTask | null;
  generationRequest?: TaskGenerationRequest | null;
  studentId?: string;
  createdAt?: string;
  overrides?: Partial<ConcreteLearningTask>;
};

export type ConcreteLearningTaskInstantiationResult = {
  inputType: 'executable_task' | 'generation_request' | 'invalid';
  concreteTask: ConcreteLearningTask | null;
  readiness: TaskReadinessValidation;
};

export function isConcreteLearningTask(value: unknown): value is ConcreteLearningTask {
  if (!value || typeof value !== 'object') return false;

  const task = value as ConcreteLearningTask;
  return (
    isNonEmptyString(task.taskId) &&
    isNonEmptyString(task.studentId) &&
    ['matched_resource', 'generated_request', 'mock'].includes(task.sourceType) &&
    isNonEmptyString(task.targetAbilityId) &&
    isNonEmptyString(task.targetAbilityName) &&
    isNonEmptyString(task.taskRole) &&
    isNonEmptyString(task.validationGoal) &&
    (!task.progressionContextSnapshot ||
      isLearningProgressionContextSnapshot(task.progressionContextSnapshot)) &&
    (!task.learningIntent || isConcreteLearningTaskIntent(task.learningIntent)) &&
    isNonEmptyString(task.question) &&
    (
      task.responseFormat !== 'single_choice' ||
      Boolean(task.singleChoiceDelivery && task.singleChoiceEvaluation)
    ) &&
    Array.isArray(task.answerRequirements) &&
    task.answerRequirements.length > 0 &&
    task.answerRequirements.every(isNonEmptyString) &&
    Array.isArray(task.scoringPoints) &&
    Array.isArray(task.rubric) &&
    typeof task.questionMetadata === 'object' &&
    task.questionMetadata !== null &&
    Array.isArray(task.expectedDiagnosisFocus) &&
    task.expectedDiagnosisFocus.length > 0 &&
    task.expectedDiagnosisFocus.every(isNonEmptyString) &&
    isNonEmptyString(task.createdAt)
  );
}

function isConcreteLearningTaskIntent(value: unknown): value is ConcreteLearningTaskIntent {
  if (!value || typeof value !== 'object') return false;
  const intent = value as ConcreteLearningTaskIntent;
  return (
    isNonEmptyString(intent.sourceObservationTaskPlanId) &&
    isNonEmptyString(intent.observationGoal) &&
    isNonEmptyString(intent.expectedStudentAction) &&
    isNonEmptyString(intent.designReason) &&
    typeof intent.isFoundationEntry === 'boolean'
  );
}

export function isTaskReadinessValidation(value: unknown): value is TaskReadinessValidation {
  if (!value || typeof value !== 'object') return false;

  const validation = value as TaskReadinessValidation;
  return (
    isNonEmptyString(validation.taskId) &&
    typeof validation.canExecute === 'boolean' &&
    isReadinessChecks(validation.checks) &&
    Array.isArray(validation.issues) &&
    validation.issues.every(isReadinessIssue)
  );
}

function isReadinessChecks(value: unknown): value is TaskReadinessValidationChecks {
  if (!value || typeof value !== 'object') return false;

  const checks = value as TaskReadinessValidationChecks;
  return [
    checks.canDisplay,
    checks.canAcceptResponse,
    checks.hasAssessmentBasis,
    checks.metadataComplete,
    checks.targetAbilityAligned,
    checks.taskRoleAligned,
    checks.validationGoalPreserved,
    checks.sourceTraceable,
    checks.canEnterDiagnosisRuntime,
  ].every((item) => typeof item === 'boolean');
}

function isReadinessIssue(value: unknown): value is TaskReadinessIssue {
  if (!value || typeof value !== 'object') return false;

  const issue = value as TaskReadinessIssue;
  return (
    isNonEmptyString(issue.code) &&
    isNonEmptyString(issue.message) &&
    typeof issue.recoverable === 'boolean'
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
