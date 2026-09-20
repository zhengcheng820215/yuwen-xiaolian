import { readFile } from 'node:fs/promises';
import {
  Phase163DiagnosisBoundaryError,
  getPhase163DiagnosisBoundaryStatus,
  runDiagnosisThroughPhase163Boundary,
} from '../../api/phase163DiagnosisBoundary.ts';
import type { RealLLMRuntimeFoundationInput } from '../agents/realLLMRuntimeFoundationAgent.ts';
import { LearningSubmissionDeadlineError, waitForLearningSubmission } from '../../ui/learningSubmissionDeadline.ts';

type Check = { name: string; passed: boolean; details: string };
const checks: Check[] = [];
const originalFetch = globalThis.fetch;

try {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    result: { requestId: 'diagnosis-success', status: 'formal_result_committed' },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  const success = await runDiagnosisThroughPhase163Boundary(openResponseInput(), { timeoutMs: 100 });
  checks.push(check(
    'T01 正常响应在上限内保持原成功行为',
    success.requestId === 'diagnosis-success' && success.status === 'formal_result_committed',
    `requestId=${success.requestId}, status=${success.status}`,
  ));

  let postAborted = false;
  globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      postAborted = true;
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  })) as typeof fetch;

  let timeoutError: unknown;
  try {
    await runDiagnosisThroughPhase163Boundary(openResponseInput(), { timeoutMs: 15 });
  } catch (error) {
    timeoutError = error;
  }
  checks.push(check(
    'T02/T03 开放回答达到外层上限后中止等待并返回可重试错误',
    postAborted &&
      timeoutError instanceof Phase163DiagnosisBoundaryError &&
      timeoutError.code === 'diagnosis_request_timeout' &&
      timeoutError.retryable,
    timeoutError instanceof Phase163DiagnosisBoundaryError
      ? `aborted=${postAborted}, code=${timeoutError.code}, retryable=${timeoutError.retryable}`
      : `aborted=${postAborted}, error=${String(timeoutError)}`,
  ));

  globalThis.fetch = (async () => new Response(JSON.stringify({
    error: '临时服务故障。',
    code: 'provider_temporarily_unavailable',
    retryable: true,
  }), { status: 503, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  let boundaryError: unknown;
  try {
    await runDiagnosisThroughPhase163Boundary(openResponseInput(), { timeoutMs: 100 });
  } catch (error) {
    boundaryError = error;
  }
  checks.push(check(
    'T04 HTTP 错误保留服务端结构化错误语义',
    boundaryError instanceof Phase163DiagnosisBoundaryError &&
      boundaryError.code === 'provider_temporarily_unavailable' &&
      boundaryError.retryable,
    boundaryError instanceof Phase163DiagnosisBoundaryError
      ? `code=${boundaryError.code}, retryable=${boundaryError.retryable}`
      : String(boundaryError),
  ));

  let statusAborted = false;
  globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      statusAborted = true;
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  })) as typeof fetch;
  const status = await getPhase163DiagnosisBoundaryStatus({ timeoutMs: 15 });
  checks.push(check(
    '状态探测有限等待并安全降级为 unavailable',
    statusAborted && status.status === 'unavailable',
    `aborted=${statusAborted}, status=${status.status}`,
  ));

  let singleChoiceFetchCalls = 0;
  globalThis.fetch = (async () => {
    singleChoiceFetchCalls += 1;
    throw new Error('single choice must not call fetch');
  }) as typeof fetch;
  const singleChoiceResult = await runDiagnosisThroughPhase163Boundary(singleChoiceInput(), { timeoutMs: 15 });
  checks.push(check(
    'T05 单选继续使用本地确定性 Diagnosis',
    singleChoiceFetchCalls === 0 && singleChoiceResult.status === 'blocked',
    `fetchCalls=${singleChoiceFetchCalls}, status=${singleChoiceResult.status}`,
  ));

  const pageSource = await readFile(new URL('../../pages/Phase163LiveLearningWorkspace.jsx', import.meta.url), 'utf8');
  const apiSource = await readFile(new URL('../../api/phase163LiveLearning.ts', import.meta.url), 'utf8');
  checks.push(check(
    'T06 已提交作答进入独立恢复，缺少 checkpoint 时保留草稿重提',
    pageSource.includes("recovered.primaryAction !== 'submit_answer'") &&
      pageSource.includes('await waitForLearningSubmission(resumePhase163LiveSubmission())') &&
      pageSource.includes('waitForLearningSubmission(savePhase163LiveDraft(answer, choiceAnswer), 5_000)') &&
      apiSource.includes('export async function resumePhase163LiveSubmission()') &&
      apiSource.includes('const response = checkpoint?.taskExecutionResult?.studentResponse'),
    'checkpoint recovery is separate from draft resubmission',
  ));
  let submissionDeadlineError: unknown;
  try {
    await waitForLearningSubmission(new Promise<never>(() => {}), 10);
  } catch (error) {
    submissionDeadlineError = error;
  }
  const fastSubmission = await waitForLearningSubmission(Promise.resolve('completed'), 100);
  checks.push(check(
    'T07 整条提交流程有有限等待且正常完成不受影响',
    submissionDeadlineError instanceof LearningSubmissionDeadlineError && fastSubmission === 'completed',
    `timeout=${submissionDeadlineError instanceof LearningSubmissionDeadlineError}, fast=${fastSubmission}`,
  ));
  checks.push(check(
    'T08 不足最低字数时在调用 AI 前提示补充',
    pageSource.includes('Array.from(answer.trim()).length < state.task.minimumAnswerLength') &&
      pageSource.includes('await waitForLearningSubmission(submitPhase163LiveAnswer(choiceAnswer || answer))'),
    'minimum length is checked before bounded submission',
  ));
  checks.push(check(
    'T09 非关键补偿不阻塞页面恢复与提交结果',
    apiSource.includes('void recoverPhase163LearningObservations(descriptor, checkpoint, persisted).catch') &&
      apiSource.includes('void progressiveLoadCalibrationService.retryDue().catch') &&
      apiSource.includes('void observationService.retryDue().catch(() => undefined)') &&
      pageSource.includes('await waitForLearningSubmission(resumePhase163LiveSubmission())'),
    'observation retries run outside the critical UI path',
  ));
} finally {
  globalThis.fetch = originalFetch;
}

console.log('\nPhase 16.3 Diagnosis Boundary Timeout Recovery Debug');
console.log('='.repeat(78));
for (const item of checks) {
  console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.name}`);
  console.log(`       ${item.details}`);
}
console.log('-'.repeat(78));
console.log(`Result: ${checks.filter((item) => item.passed).length} / ${checks.length} PASS`);
if (checks.some((item) => !item.passed)) process.exitCode = 1;

function openResponseInput(): RealLLMRuntimeFoundationInput {
  return {
    concreteTask: { responseFormat: 'long_text' },
  } as RealLLMRuntimeFoundationInput;
}

function singleChoiceInput(): RealLLMRuntimeFoundationInput {
  return {
    concreteTask: {
      taskId: 'single-choice-timeout-boundary-test',
      studentId: 'student-timeout-boundary-test',
      targetAbilityId: '理解',
      responseFormat: 'single_choice',
    },
    taskExecutionResult: {},
    executionMode: 'live',
    providerConfig: { diagnosisSchemaVersion: 'diagnosis_result_v1' },
  } as RealLLMRuntimeFoundationInput;
}

function check(name: string, passed: boolean, details: string): Check {
  return { name, passed, details };
}
