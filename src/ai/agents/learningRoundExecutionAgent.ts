import { runTaskExecutionAgent } from './taskExecutionAgent.ts';
import type {
  LearningRoundExecutionNextAction,
  LearningRoundExecutionResult,
  LearningRoundExecutionStatus,
  LearningRoundStartResult,
} from '../schemas/learningRound.schema.ts';
import type { StudentAnswerInput, StudentResponse, TaskExecutionSession } from '../schemas/taskExecution.schema.ts';

export type LearningRoundExecutionInput = {
  startResult: LearningRoundStartResult;
  studentAnswer?: StudentAnswerInput;
  responseOverrides?: Partial<StudentResponse>;
  abandon?: boolean;
  abandonedAt?: string;
};

export function executeLearningRound(
  input: LearningRoundExecutionInput,
): LearningRoundExecutionResult {
  const base = {
    learningRoundId: input.startResult.learningRoundId,
    studentId: input.startResult.studentId,
    startResult: input.startResult,
  };

  const startIssues = validateStartResult(input.startResult);
  if (startIssues.length > 0) {
    return {
      ...base,
      status: 'blocked',
      canEnterEvidenceReturn: false,
      nextAction: 'stop',
      issues: startIssues,
    };
  }

  if (input.abandon) {
    const taskExecutionSession = buildAbandonedSession(input.startResult, input.abandonedAt);
    return {
      ...base,
      status: 'abandoned',
      taskExecutionSession,
      canEnterEvidenceReturn: false,
      nextAction: 'stop',
      issues: ['Student abandoned current learning round before valid submission.'],
    };
  }

  if (!input.studentAnswer) {
    return {
      ...base,
      status: 'retry_required',
      canEnterEvidenceReturn: false,
      nextAction: 'supplement_response',
      issues: ['StudentAnswerInput is missing.'],
    };
  }

  const executionResult = runTaskExecutionAgent({
    concreteTask: input.startResult.concreteTask!,
    readiness: input.startResult.taskReadinessValidation!,
    studentAnswer: input.studentAnswer,
    responseOverrides: input.responseOverrides,
  });

  if (executionResult.blockedReason || !executionResult.taskExecutionResult) {
    return {
      ...base,
      status: 'blocked',
      taskExecutionSession: executionResult.taskExecutionSession || undefined,
      studentResponse: executionResult.studentResponse || undefined,
      responseValidityResult: executionResult.responseValidity || undefined,
      taskExecutionResult: executionResult.taskExecutionResult || undefined,
      canEnterEvidenceReturn: false,
      nextAction: 'stop',
      issues: [executionResult.blockedReason || 'Task execution did not produce TaskExecutionResult.'],
    };
  }

  const consistencyIssues = validateExecutionConsistency(input.startResult, executionResult.taskExecutionResult.studentResponse);
  if (consistencyIssues.length > 0) {
    return {
      ...base,
      status: 'review_required',
      taskExecutionSession: executionResult.taskExecutionSession || undefined,
      studentResponse: executionResult.studentResponse || undefined,
      responseValidityResult: executionResult.responseValidity || undefined,
      taskExecutionResult: executionResult.taskExecutionResult,
      canEnterEvidenceReturn: false,
      nextAction: 'human_review',
      issues: consistencyIssues,
    };
  }

  const status = statusFromTaskExecution(executionResult.taskExecutionResult.status, executionResult.taskExecutionResult.canEnterDiagnosisRuntime);
  const nextAction = nextActionFromStatus(status, executionResult.responseValidity?.status);

  return {
    ...base,
    status,
    taskExecutionSession: executionResult.taskExecutionSession || undefined,
    studentResponse: executionResult.studentResponse || undefined,
    responseValidityResult: executionResult.responseValidity || undefined,
    taskExecutionResult: executionResult.taskExecutionResult,
    canEnterEvidenceReturn: status === 'evidence_return_ready',
    nextAction,
    issues: status === 'evidence_return_ready'
      ? []
      : executionResult.responseValidity?.reasons || ['Task execution cannot enter evidence return.'],
  };
}

function validateStartResult(startResult: LearningRoundStartResult): string[] {
  const issues: string[] = [];

  if (startResult.status !== 'ready_for_execution') {
    issues.push(`LearningRoundStartResult.status is ${startResult.status}, not ready_for_execution.`);
  }
  if (!startResult.concreteTask) {
    issues.push('LearningRoundStartResult.concreteTask is missing.');
  }
  if (!startResult.taskReadinessValidation) {
    issues.push('LearningRoundStartResult.taskReadinessValidation is missing.');
  }
  if (startResult.taskReadinessValidation && !startResult.taskReadinessValidation.canExecute) {
    issues.push('LearningRoundStartResult.taskReadinessValidation.canExecute=false.');
  }
  if (startResult.concreteTask && startResult.concreteTask.studentId !== startResult.studentId) {
    issues.push('ConcreteLearningTask.studentId does not match LearningRoundStartResult.studentId.');
  }

  return issues;
}

function validateExecutionConsistency(
  startResult: LearningRoundStartResult,
  response?: StudentResponse,
): string[] {
  const issues: string[] = [];

  if (!response) {
    issues.push('StudentResponse is missing.');
    return issues;
  }
  if (response.studentId !== startResult.studentId) {
    issues.push('StudentResponse.studentId does not match LearningRoundStartResult.studentId.');
  }
  if (response.taskId !== startResult.concreteTask?.taskId) {
    issues.push('StudentResponse.taskId does not match ConcreteLearningTask.taskId.');
  }

  return issues;
}

function statusFromTaskExecution(
  taskExecutionStatus: string,
  canEnterDiagnosisRuntime: boolean,
): LearningRoundExecutionStatus {
  if (taskExecutionStatus === 'abandoned' || taskExecutionStatus === 'interrupted') return 'abandoned';
  if (taskExecutionStatus === 'submitted_valid' && canEnterDiagnosisRuntime) return 'evidence_return_ready';
  return 'retry_required';
}

function nextActionFromStatus(
  status: LearningRoundExecutionStatus,
  validityStatus?: string,
): LearningRoundExecutionNextAction {
  if (status === 'evidence_return_ready') return 'enter_evidence_return';
  if (status === 'review_required') return 'human_review';
  if (status === 'blocked' || status === 'abandoned') return 'stop';
  if (validityStatus === 'empty' || validityStatus === 'placeholder' || validityStatus === 'insufficient') return 'supplement_response';
  return 'retry_task';
}

function buildAbandonedSession(
  startResult: LearningRoundStartResult,
  abandonedAt = '2026-07-13T10:12:00.000Z',
): TaskExecutionSession {
  return {
    executionSessionId: `exec-${startResult.concreteTask!.taskId}`,
    studentId: startResult.studentId,
    taskId: startResult.concreteTask!.taskId,
    status: 'abandoned',
    startedAt: abandonedAt,
    interruptedAt: abandonedAt,
    usedHint: false,
    hintCount: 0,
  };
}
