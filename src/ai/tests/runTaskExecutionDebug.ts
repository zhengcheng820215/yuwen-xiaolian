import { instantiateConcreteLearningTask } from '../agents/concreteLearningTaskAgent.ts';
import { runTaskExecutionAgent } from '../agents/taskExecutionAgent.ts';
import { branchTaskFulfillment } from '../agents/taskFulfillmentBranchingAgent.ts';
import { matchTaskResources } from '../agents/taskResourceMatchingAgent.ts';
import type {
  ConcreteLearningTask,
  TaskReadinessValidation,
} from '../schemas/concreteLearningTask.schema.ts';
import {
  isResponseValidityResult,
  isStudentResponse,
  isTaskExecutionResult,
  isTaskExecutionSession,
  type ResponseValidityStatus,
  type TaskExecutionAgentResult,
  type TaskExecutionResultStatus,
} from '../schemas/taskExecution.schema.ts';
import {
  buildFulfillmentRequestFixture,
  buildMockTaskResources,
  phase84RunAt,
} from './taskFulfillmentDebugFixtures.ts';

type DebugCase = {
  id: string;
  title: string;
  result: TaskExecutionAgentResult;
  expectedResultStatus?: TaskExecutionResultStatus;
  expectedValidityStatus?: ResponseValidityStatus;
  expectedCanEnterDiagnosis: boolean;
  expectedBlocked?: boolean;
  expectedUsedHint?: boolean;
};

function runTaskExecutionDebug(): void {
  const { task, readiness } = buildReadyConcreteTask();
  const blockedReadiness: TaskReadinessValidation = {
    ...readiness,
    canExecute: false,
    checks: {
      ...readiness.checks,
      canDisplay: false,
      canEnterDiagnosisRuntime: false,
    },
    issues: [
      {
        code: 'MISSING_DISPLAY_CONTENT',
        message: 'Debug blocked readiness.',
        recoverable: true,
      },
    ],
  };

  const cases: DebugCase[] = [
    {
      id: 'case_1_valid_answer',
      title: 'normal valid answer',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: '父亲看到旧书和树叶时停了很久，说明他想起以前和孩子一起读书的时光，所以内心有不舍、怀念和牵挂。',
          usedHint: false,
          hintCount: 0,
        },
      }),
      expectedResultStatus: 'submitted_valid',
      expectedValidityStatus: 'valid',
      expectedCanEnterDiagnosis: true,
    },
    {
      id: 'case_2_empty_answer',
      title: 'empty answer',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: '',
        },
      }),
      expectedResultStatus: 'submitted_invalid',
      expectedValidityStatus: 'empty',
      expectedCanEnterDiagnosis: false,
    },
    {
      id: 'case_3_placeholder_answer',
      title: 'placeholder answer',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: '不知道',
        },
      }),
      expectedResultStatus: 'submitted_invalid',
      expectedValidityStatus: 'placeholder',
      expectedCanEnterDiagnosis: false,
    },
    {
      id: 'case_4_irrelevant_answer',
      title: 'high-confidence irrelevant answer',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: '我喜欢打篮球',
        },
      }),
      expectedResultStatus: 'submitted_invalid',
      expectedValidityStatus: 'irrelevant',
      expectedCanEnterDiagnosis: false,
    },
    {
      id: 'case_5_valid_with_hint',
      title: 'valid answer with hint usage',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: '父亲舍不得以前和孩子一起读书的回忆，也很牵挂孩子。',
          usedHint: true,
          hintCount: 2,
        },
      }),
      expectedResultStatus: 'submitted_valid',
      expectedValidityStatus: 'valid',
      expectedCanEnterDiagnosis: true,
      expectedUsedHint: true,
    },
    {
      id: 'case_6_id_mismatch',
      title: 'student / task / session id mismatch',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: '父亲很怀念过去，也舍不得和孩子共同读书的时光。',
        },
        responseOverrides: {
          studentId: 'wrong-student',
        },
      }),
      expectedResultStatus: 'submitted_invalid',
      expectedValidityStatus: 'insufficient',
      expectedCanEnterDiagnosis: false,
    },
    {
      id: 'case_7_readiness_blocked',
      title: 'readiness is false',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness: blockedReadiness,
        studentAnswer: {
          answerText: '父亲舍不得过去的回忆。',
        },
      }),
      expectedCanEnterDiagnosis: false,
      expectedBlocked: true,
    },
    {
      id: 'case_8_short_but_valid',
      title: 'short but valid answer',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: '父亲舍不得过去和孩子一起读书的时光。',
        },
      }),
      expectedResultStatus: 'submitted_valid',
      expectedValidityStatus: 'valid',
      expectedCanEnterDiagnosis: true,
    },
    {
      id: 'case_9_copied_reading_material',
      title: 'substantial reading material copy',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: task.readingText || '',
        },
      }),
      expectedResultStatus: 'submitted_invalid',
      expectedValidityStatus: 'insufficient',
      expectedCanEnterDiagnosis: false,
    },
    {
      id: 'case_10_copied_material_excerpt',
      title: 'verbatim material excerpt without an independent response',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: (task.readingText || '').slice(0, 24),
        },
      }),
      expectedResultStatus: 'submitted_invalid',
      expectedValidityStatus: 'insufficient',
      expectedCanEnterDiagnosis: false,
    },
    {
      id: 'case_11_material_excerpt_with_explanation',
      title: 'material excerpt followed by an independent explanation',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: '父亲把旧书一本本擦干净，说明他珍惜这些旧书承载的回忆，也舍不得过去的时光。',
        },
      }),
      expectedResultStatus: 'submitted_valid',
      expectedValidityStatus: 'valid',
      expectedCanEnterDiagnosis: true,
    },
    {
      id: 'case_12_unrelated_pasted_paragraph',
      title: 'unrelated pasted paragraph with no task anchors',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: '春天到了，校园里的花陆续开放。同学们在操场上参加运动会，大家都非常高兴。',
        },
      }),
      expectedResultStatus: 'submitted_invalid',
      expectedValidityStatus: 'irrelevant',
      expectedCanEnterDiagnosis: false,
    },
    {
      id: 'case_13_long_random_input_with_accidental_overlap',
      title: 'long random input with one accidental task overlap',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: '喝酒完事瑞尔会哦还让我iuUI撒电话问候侨电视剧还款日u二回极速达作者',
        },
      }),
      expectedResultStatus: 'submitted_invalid',
      expectedValidityStatus: 'irrelevant',
      expectedCanEnterDiagnosis: false,
    },
    {
      id: 'case_14_random_input_with_multiple_accidental_overlaps',
      title: 'input-method noise with two accidental task overlaps',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: '父亲喝酒完事瑞尔会哦还让我iuUI撒电话问候侨电视剧旧书还款日二回极速达作者',
        },
      }),
      expectedResultStatus: 'submitted_invalid',
      expectedValidityStatus: 'irrelevant',
      expectedCanEnterDiagnosis: false,
    },
    {
      id: 'case_15_pure_chinese_random_input',
      title: 'pure Chinese random input without task anchors',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: '南瓜铁路窗帘河岸纸箱雨伞台灯清晨晚霞轮流跳进玻璃杯里唱歌。',
        },
      }),
      expectedResultStatus: 'submitted_invalid',
      expectedValidityStatus: 'irrelevant',
      expectedCanEnterDiagnosis: false,
    },
    {
      id: 'case_16_valid_answer_with_english_term',
      title: 'normal relevant answer containing an English term',
      result: runTaskExecutionAgent({
        concreteTask: task,
        readiness,
        studentAnswer: {
          answerText: '父亲的 emotional attachment 表现为对往日亲子时光的珍惜和牵挂，这种情绪是真实而克制的。',
        },
      }),
      expectedResultStatus: 'submitted_valid',
      expectedValidityStatus: 'valid',
      expectedCanEnterDiagnosis: true,
    },
  ];

  const failures = validateCases(cases);
  printReport(cases, failures);
}

function buildReadyConcreteTask(): {
  task: ConcreteLearningTask;
  readiness: TaskReadinessValidation;
} {
  const resources = buildMockTaskResources();
  const fulfillmentRequest = buildFulfillmentRequestFixture();
  const matchResult = matchTaskResources({
    fulfillmentRequest,
    availableTaskResources: resources,
  });
  const branchResult = branchTaskFulfillment({
    fulfillmentRequest,
    matchResult,
    availableTaskResources: resources,
    createdAt: phase84RunAt,
  });

  if (!branchResult.executableTask) {
    throw new Error('Phase 9.2 debug fixture failed: missing executableTask.');
  }

  const concreteResult = instantiateConcreteLearningTask({
    executableTask: branchResult.executableTask,
    createdAt: phase84RunAt,
  });

  if (!concreteResult.concreteTask || !concreteResult.readiness.canExecute) {
    throw new Error('Phase 9.2 debug fixture failed: ConcreteLearningTask is not ready.');
  }

  return {
    task: concreteResult.concreteTask,
    readiness: concreteResult.readiness,
  };
}

function validateCases(cases: DebugCase[]): string[] {
  const failures: string[] = [];

  for (const item of cases) {
    const { result } = item;

    if (item.expectedBlocked) {
      if (!result.blockedReason) failures.push(`${item.id}: expected blockedReason.`);
      if (result.taskExecutionSession !== null) failures.push(`${item.id}: blocked case should not create session.`);
      if (result.taskExecutionResult !== null) failures.push(`${item.id}: blocked case should not create execution result.`);
      continue;
    }

    if (!result.taskExecutionSession || !isTaskExecutionSession(result.taskExecutionSession)) {
      failures.push(`${item.id}: expected valid TaskExecutionSession.`);
    }
    if (!result.studentResponse || !isStudentResponse(result.studentResponse)) {
      failures.push(`${item.id}: expected valid StudentResponse.`);
    }
    if (!result.responseValidity || !isResponseValidityResult(result.responseValidity)) {
      failures.push(`${item.id}: expected valid ResponseValidityResult.`);
    }
    if (!result.taskExecutionResult || !isTaskExecutionResult(result.taskExecutionResult)) {
      failures.push(`${item.id}: expected valid TaskExecutionResult.`);
    }
    if (result.responseValidity?.status !== item.expectedValidityStatus) {
      failures.push(`${item.id}: expected validity ${item.expectedValidityStatus}, got ${result.responseValidity?.status}.`);
    }
    if (result.taskExecutionResult?.status !== item.expectedResultStatus) {
      failures.push(`${item.id}: expected execution status ${item.expectedResultStatus}, got ${result.taskExecutionResult?.status}.`);
    }
    if (result.taskExecutionResult?.canEnterDiagnosisRuntime !== item.expectedCanEnterDiagnosis) {
      failures.push(`${item.id}: expected canEnterDiagnosis=${item.expectedCanEnterDiagnosis}, got ${result.taskExecutionResult?.canEnterDiagnosisRuntime}.`);
    }
    if (result.taskExecutionResult?.canEnterDiagnosisRuntime !== result.responseValidity?.canDiagnose) {
      failures.push(`${item.id}: canEnterDiagnosisRuntime must match responseValidity.canDiagnose.`);
    }
    if (item.expectedUsedHint && !result.taskExecutionResult?.usedHint) {
      failures.push(`${item.id}: expected usedHint=true.`);
    }
    if (item.expectedUsedHint && (result.taskExecutionResult?.hintCount || 0) <= 0) {
      failures.push(`${item.id}: expected hintCount > 0.`);
    }
  }

  return failures;
}

function printReport(cases: DebugCase[], failures: string[]): void {
  console.log('\nPhase 9.2 Task Execution Debug');
  console.log('==============================');

  for (const item of cases) {
    const result = item.result;
    const session = result.taskExecutionSession;
    const response = result.studentResponse;
    const validity = result.responseValidity;
    const execution = result.taskExecutionResult;
    const passed = item.expectedBlocked
      ? Boolean(result.blockedReason && !session && !execution)
      : execution?.canEnterDiagnosisRuntime === item.expectedCanEnterDiagnosis &&
        validity?.status === item.expectedValidityStatus &&
        execution?.status === item.expectedResultStatus;

    console.log(`\n[${passed ? 'PASS' : 'FAIL'}] ${item.id}`);
    console.log(`title: ${item.title}`);
    console.log(`taskId: ${session?.taskId || 'none'}`);
    console.log(`studentId: ${session?.studentId || 'none'}`);
    console.log(`executionSessionId: ${session?.executionSessionId || 'none'}`);
    console.log(`sessionStatus: ${session?.status || 'blocked'}`);
    console.log(`answerText: ${summarize(response?.answerText || '')}`);
    console.log(`usedHint: ${execution?.usedHint ?? response?.usedHint ?? false}`);
    console.log(`hintCount: ${execution?.hintCount ?? response?.hintCount ?? 0}`);
    console.log(`responseValidity.status: ${validity?.status || 'none'}`);
    console.log(`responseValidity.canDiagnose: ${validity?.canDiagnose ?? false}`);
    console.log(`responseValidity.reasons: ${(validity?.reasons || []).join(' / ') || result.blockedReason || 'none'}`);
    console.log(`taskExecutionResult.status: ${execution?.status || 'none'}`);
    console.log(`canEnterDiagnosisRuntime: ${execution?.canEnterDiagnosisRuntime ?? false}`);
  }

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 9.2 task execution debug passed.');
    return;
  }

  console.log('[FAIL] Phase 9.2 debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 9.2 debug check failed.');
}

function summarize(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return '(empty)';
  return text.length > 60 ? `${text.slice(0, 60)}...` : text;
}

runTaskExecutionDebug();
