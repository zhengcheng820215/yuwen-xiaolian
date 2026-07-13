import type { ConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import type {
  ResponseValidityResult,
  StudentResponse,
  TaskExecutionAgentResult,
  TaskExecutionInput,
  TaskExecutionResult,
  TaskExecutionSession,
} from '../schemas/taskExecution.schema.ts';

const DEFAULT_STARTED_AT = '2026-07-13T09:15:00.000Z';
const DEFAULT_SUBMITTED_AT = '2026-07-13T09:18:00.000Z';

export function runTaskExecutionAgent(
  input: TaskExecutionInput,
): TaskExecutionAgentResult {
  if (!input.readiness.canExecute) {
    return {
      taskExecutionSession: null,
      studentResponse: null,
      responseValidity: null,
      taskExecutionResult: null,
      blockedReason: 'TaskReadinessValidation.canExecute=false，不能创建正式任务执行 Session。',
    };
  }

  const usedHint = Boolean(input.studentAnswer.usedHint);
  const hintCount = Math.max(0, input.studentAnswer.hintCount || 0);
  const startedAt = input.startedAt || DEFAULT_STARTED_AT;
  const submittedAt = input.studentAnswer.submittedAt || DEFAULT_SUBMITTED_AT;
  const executionSessionId = `exec-${input.concreteTask.taskId}`;

  const taskExecutionSession: TaskExecutionSession = {
    executionSessionId,
    studentId: input.concreteTask.studentId,
    taskId: input.concreteTask.taskId,
    status: 'submitted',
    startedAt,
    submittedAt,
    usedHint,
    hintCount,
    elapsedSeconds: input.studentAnswer.elapsedSeconds ?? inferElapsedSeconds(startedAt, submittedAt),
  };

  const studentResponse: StudentResponse = {
    responseId: `response-${executionSessionId}`,
    executionSessionId,
    studentId: input.concreteTask.studentId,
    taskId: input.concreteTask.taskId,
    answerText: input.studentAnswer.answerText,
    submittedAt,
    usedHint,
    hintCount,
    ...input.responseOverrides,
  };

  const responseValidity = evaluateResponseValidity(
    studentResponse,
    taskExecutionSession,
    input.concreteTask,
  );
  const taskExecutionResult = buildTaskExecutionResult(
    taskExecutionSession,
    studentResponse,
    responseValidity,
  );

  return {
    taskExecutionSession,
    studentResponse,
    responseValidity,
    taskExecutionResult,
  };
}

export function evaluateResponseValidity(
  response: StudentResponse,
  session: TaskExecutionSession,
  task: ConcreteLearningTask,
): ResponseValidityResult {
  const consistencyIssues = validateResponseConsistency(response, session);
  if (consistencyIssues.length > 0) {
    return {
      responseId: response.responseId,
      status: 'insufficient',
      canDiagnose: false,
      reasons: consistencyIssues,
    };
  }

  const answer = response.answerText.trim();
  const compactAnswer = compact(answer);

  if (!compactAnswer) {
    return {
      responseId: response.responseId,
      status: 'empty',
      canDiagnose: false,
      reasons: ['答案为空，无法形成可观察表现。'],
    };
  }

  if (isPlaceholderAnswer(compactAnswer)) {
    return {
      responseId: response.responseId,
      status: 'placeholder',
      canDiagnose: false,
      reasons: ['答案属于占位或无意义回答，不进入诊断。'],
    };
  }

  if (isCopiedQuestion(compactAnswer, task)) {
    return {
      responseId: response.responseId,
      status: 'insufficient',
      canDiagnose: false,
      reasons: ['答案基本复制题干，缺少独立作答表现。'],
    };
  }

  if (isHighConfidenceIrrelevantAnswer(compactAnswer)) {
    return {
      responseId: response.responseId,
      status: 'irrelevant',
      canDiagnose: false,
      reasons: ['答案为高确定性无关输入，不进入诊断。'],
    };
  }

  if (compactAnswer.length < 2) {
    return {
      responseId: response.responseId,
      status: 'insufficient',
      canDiagnose: false,
      reasons: ['答案无法形成最低限度可观察表现。'],
    };
  }

  return {
    responseId: response.responseId,
    status: 'valid',
    canDiagnose: true,
    reasons: response.usedHint
      ? ['答案与任务相关，具备最低可观察表现；本次作答使用了提示。']
      : ['答案与任务相关，具备最低可观察表现。'],
  };
}

function buildTaskExecutionResult(
  session: TaskExecutionSession,
  response: StudentResponse,
  validity: ResponseValidityResult,
): TaskExecutionResult {
  return {
    executionSessionId: session.executionSessionId,
    studentId: session.studentId,
    taskId: session.taskId,
    status: validity.canDiagnose ? 'submitted_valid' : 'submitted_invalid',
    studentResponse: response,
    responseValidity: validity,
    usedHint: response.usedHint,
    hintCount: response.hintCount,
    canEnterDiagnosisRuntime: validity.canDiagnose,
  };
}

function validateResponseConsistency(
  response: StudentResponse,
  session: TaskExecutionSession,
): string[] {
  const issues: string[] = [];

  if (response.executionSessionId !== session.executionSessionId) {
    issues.push('StudentResponse.executionSessionId 与 TaskExecutionSession 不一致。');
  }
  if (response.studentId !== session.studentId) {
    issues.push('StudentResponse.studentId 与 TaskExecutionSession 不一致。');
  }
  if (response.taskId !== session.taskId) {
    issues.push('StudentResponse.taskId 与 TaskExecutionSession 不一致。');
  }

  return issues;
}

function isPlaceholderAnswer(value: string): boolean {
  const placeholders = new Set([
    '不知道',
    '不会',
    '不懂',
    '没看懂',
    '无',
    '没有',
    '略',
    '随便',
    '哈哈',
    '呵呵',
    '不知道。',
  ]);

  if (placeholders.has(value)) return true;
  if (/^\d+$/.test(value)) return true;
  if (/^[^\p{L}\p{N}]+$/u.test(value)) return true;
  return false;
}

function isCopiedQuestion(value: string, task: ConcreteLearningTask): boolean {
  const question = compact(task.question);
  return value === question || (question.length > 8 && value.includes(question));
}

function isHighConfidenceIrrelevantAnswer(value: string): boolean {
  const irrelevantSamples = [
    '今天天气很好',
    '我喜欢打篮球',
    '我今天吃了苹果',
    '这道题和语文没有关系',
    'abcdefg',
    'qwerty',
  ];

  if (irrelevantSamples.includes(value)) return true;
  if (/^[a-z]{6,}$/i.test(value)) return true;
  return false;
}

function compact(value: string): string {
  return value.replace(/\s+/g, '').replace(/[，。！？、,.!?]/g, '').trim();
}

function inferElapsedSeconds(startedAt: string, submittedAt: string): number | undefined {
  const started = Date.parse(startedAt);
  const submitted = Date.parse(submittedAt);
  if (Number.isNaN(started) || Number.isNaN(submitted)) return undefined;
  return Math.max(0, Math.round((submitted - started) / 1000));
}
