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

  if (isHighConfidenceTaskIrrelevantAnswer(compactAnswer, task)) {
    return {
      responseId: response.responseId,
      status: 'irrelevant',
      canDiagnose: false,
      reasons: ['答案内容与当前题目和阅读材料没有可识别的关键关联，不进入诊断。'],
    };
  }

  if (isMaterialOnlyResponse(compactAnswer, task)) {
    return {
      responseId: response.responseId,
      status: 'insufficient',
      canDiagnose: false,
      reasons: ['答案只复制阅读材料内容，但尚未形成对题目要求的独立回应，不进入诊断。'],
    };
  }

  if (requiresSubstantiveOpenResponse(task) && compactAnswer.length < 8) {
    return {
      responseId: response.responseId,
      status: 'insufficient',
      canDiagnose: false,
      reasons: ['答案过短，尚未提供可分析的判断、依据或说明。'],
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

function isMaterialOnlyResponse(value: string, task: ConcreteLearningTask): boolean {
  const material = compact(task.readingText || '');
  if (!requiresSubstantiveOpenResponse(task) || value.length < 8 || material.length < 8) return false;

  // An exact excerpt is valid evidence material, but it is not an independent
  // answer to a task that explicitly requires judgment or explanation.
  if (material.includes(value)) return true;

  if (value.length < 48 || material.length < 48) return false;

  const minimumCopiedLength = Math.max(48, Math.floor(material.length * 0.45));
  if (value.length < minimumCopiedLength) return false;
  if (value.includes(material)) return true;

  const chunkSize = 12;
  let checked = 0;
  let matched = 0;
  for (let index = 0; index + chunkSize <= value.length; index += chunkSize) {
    checked += 1;
    if (material.includes(value.slice(index, index + chunkSize))) matched += 1;
  }
  return checked >= 4 && matched / checked >= 0.8;
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

function isHighConfidenceTaskIrrelevantAnswer(value: string, task: ConcreteLearningTask): boolean {
  if (!requiresSubstantiveOpenResponse(task) || value.length < 18) return false;
  const context = compact(`${task.question}${task.readingText || ''}`);
  if (context.length < 12) return false;

  const contextAnchors = meaningfulBigrams(context);
  if (contextAnchors.size === 0) return false;
  const answerAnchors = [...meaningfulBigrams(value)];
  const matchedAnchors = answerAnchors.filter((anchor) => contextAnchors.has(anchor));

  if (matchedAnchors.length === 0) return true;

  // A small number of accidental two-character overlaps is common in
  // input-method noise. Keep this deterministic gate conservative: the answer
  // must also carry a high-confidence noise pattern and the matching anchors
  // must account for only a tiny part of the response.
  const matchedRatio = matchedAnchors.length / Math.max(answerAnchors.length, 1);
  return (
    matchedAnchors.length <= 2 &&
    matchedRatio <= 0.08 &&
    isMixedInputMethodNoise(value)
  );
}

function isMixedInputMethodNoise(value: string): boolean {
  const latinRuns = value.match(/[a-z]{2,}/gi) || [];
  const hanCount = [...value].filter((char) => /\p{Script=Han}/u.test(char)).length;
  const hasSuspiciousMixedCaseRun = latinRuns.some((run) => (
    run.length >= 3 && /[a-z]/.test(run) && /[A-Z]/.test(run)
  ));
  const hasFragmentedLatinRuns = latinRuns.filter((run) => run.length <= 4).length >= 3;

  // A normal term such as “AI” or “emotional attachment” is not noise by
  // itself. Require either an input-method-like mixed-case run or several
  // short Latin fragments embedded in a sufficiently long Chinese response.
  return hanCount >= 12 && (hasSuspiciousMixedCaseRun || hasFragmentedLatinRuns);
}

function meaningfulBigrams(value: string): Set<string> {
  const ignored = new Set([
    '一个', '一些', '这个', '那个', '这样', '已经', '没有', '还是', '可以',
    '需要', '因为', '所以', '但是', '然后', '进行', '表示', '说明', '内容',
  ]);
  const chars = [...value].filter((char) => /[\p{L}\p{N}]/u.test(char));
  const result = new Set<string>();
  for (let index = 0; index < chars.length - 1; index += 1) {
    const anchor = `${chars[index]}${chars[index + 1]}`;
    if (!ignored.has(anchor)) result.add(anchor);
  }
  return result;
}

function requiresSubstantiveOpenResponse(task: ConcreteLearningTask): boolean {
  const assessmentMode = task.questionMetadata.assessmentMode || '';
  const questionType = task.questionMetadata.questionType || '';

  return (
    assessmentMode === 'reasoning_chain' ||
    assessmentMode === 'key_points' ||
    questionType === '推理' ||
    questionType === '分析' ||
    questionType === '概括' ||
    questionType === '开放表达'
  );
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
