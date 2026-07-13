import type {
  ConcreteLearningTask,
  TaskReadinessValidation,
} from './concreteLearningTask.schema.ts';

export type TaskExecutionSessionStatus =
  | 'started'
  | 'submitted'
  | 'interrupted'
  | 'abandoned';

export type TaskExecutionSession = {
  executionSessionId: string;
  studentId: string;
  taskId: string;
  status: TaskExecutionSessionStatus;
  startedAt: string;
  submittedAt?: string;
  interruptedAt?: string;
  usedHint: boolean;
  hintCount: number;
  elapsedSeconds?: number;
};

export type StudentResponse = {
  responseId: string;
  executionSessionId: string;
  studentId: string;
  taskId: string;
  answerText: string;
  submittedAt: string;
  usedHint: boolean;
  hintCount: number;
};

export type ResponseValidityStatus =
  | 'valid'
  | 'empty'
  | 'placeholder'
  | 'irrelevant'
  | 'insufficient';

export type ResponseValidityResult = {
  responseId: string;
  status: ResponseValidityStatus;
  canDiagnose: boolean;
  reasons: string[];
};

export type TaskExecutionResultStatus =
  | 'submitted_valid'
  | 'submitted_invalid'
  | 'interrupted'
  | 'abandoned';

export type TaskExecutionResult = {
  executionSessionId: string;
  studentId: string;
  taskId: string;
  status: TaskExecutionResultStatus;
  studentResponse?: StudentResponse;
  responseValidity: ResponseValidityResult;
  usedHint: boolean;
  hintCount: number;
  canEnterDiagnosisRuntime: boolean;
};

export type StudentAnswerInput = {
  answerText: string;
  usedHint?: boolean;
  hintCount?: number;
  submittedAt?: string;
  elapsedSeconds?: number;
};

export type TaskExecutionInput = {
  concreteTask: ConcreteLearningTask;
  readiness: TaskReadinessValidation;
  studentAnswer: StudentAnswerInput;
  startedAt?: string;
  responseOverrides?: Partial<StudentResponse>;
};

export type TaskExecutionAgentResult = {
  taskExecutionSession: TaskExecutionSession | null;
  studentResponse: StudentResponse | null;
  responseValidity: ResponseValidityResult | null;
  taskExecutionResult: TaskExecutionResult | null;
  blockedReason?: string;
};

export function isTaskExecutionSession(value: unknown): value is TaskExecutionSession {
  if (!value || typeof value !== 'object') return false;

  const session = value as TaskExecutionSession;
  return (
    isNonEmptyString(session.executionSessionId) &&
    isNonEmptyString(session.studentId) &&
    isNonEmptyString(session.taskId) &&
    ['started', 'submitted', 'interrupted', 'abandoned'].includes(session.status) &&
    isNonEmptyString(session.startedAt) &&
    typeof session.usedHint === 'boolean' &&
    typeof session.hintCount === 'number'
  );
}

export function isStudentResponse(value: unknown): value is StudentResponse {
  if (!value || typeof value !== 'object') return false;

  const response = value as StudentResponse;
  return (
    isNonEmptyString(response.responseId) &&
    isNonEmptyString(response.executionSessionId) &&
    isNonEmptyString(response.studentId) &&
    isNonEmptyString(response.taskId) &&
    typeof response.answerText === 'string' &&
    isNonEmptyString(response.submittedAt) &&
    typeof response.usedHint === 'boolean' &&
    typeof response.hintCount === 'number'
  );
}

export function isResponseValidityResult(value: unknown): value is ResponseValidityResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as ResponseValidityResult;
  return (
    isNonEmptyString(result.responseId) &&
    ['valid', 'empty', 'placeholder', 'irrelevant', 'insufficient'].includes(result.status) &&
    typeof result.canDiagnose === 'boolean' &&
    Array.isArray(result.reasons) &&
    result.reasons.every(isNonEmptyString)
  );
}

export function isTaskExecutionResult(value: unknown): value is TaskExecutionResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as TaskExecutionResult;
  return (
    isNonEmptyString(result.executionSessionId) &&
    isNonEmptyString(result.studentId) &&
    isNonEmptyString(result.taskId) &&
    ['submitted_valid', 'submitted_invalid', 'interrupted', 'abandoned'].includes(result.status) &&
    isResponseValidityResult(result.responseValidity) &&
    typeof result.usedHint === 'boolean' &&
    typeof result.hintCount === 'number' &&
    typeof result.canEnterDiagnosisRuntime === 'boolean'
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
