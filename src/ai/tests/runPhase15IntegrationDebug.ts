import { assessEvidenceQuality } from '../agents/evidenceQualityAssessmentAgent.ts';
import {
  createFeedbackExpressionConfigSnapshot,
  runControlledFeedbackExpression,
} from '../agents/controlledFeedbackExpressionAgent.ts';
import {
  createDiagnosisProviderConfigSnapshot,
  runRealLLMRuntimeFoundation,
} from '../agents/realLLMRuntimeFoundationAgent.ts';
import { runTaskEvidenceReturnAgent } from '../agents/taskEvidenceReturnAgent.ts';
import { runTaskExecutionAgent } from '../agents/taskExecutionAgent.ts';
import { REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION } from '../prompts/buildRealAIDiagnosisPromptV4.ts';
import {
  ScriptedDiagnosisProviderAdapter,
  type ScriptedDiagnosisProviderStep,
} from '../providers/diagnosisProviderAdapter.ts';
import { InMemoryControlledFeedbackRepository } from '../repositories/inMemoryControlledFeedbackRepository.ts';
import { InMemoryFormalDiagnosisRepository } from '../repositories/inMemoryFormalDiagnosisRepository.ts';
import type {
  ConcreteLearningTask,
  TaskReadinessValidation,
} from '../schemas/concreteLearningTask.schema.ts';
import { DIAGNOSIS_ERROR_TYPES, type DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import { isEvidenceQualityAssessment } from '../schemas/evidenceQualityAssessment.schema.ts';
import type { TaskExecutionResult } from '../schemas/taskExecution.schema.ts';

const NOW = '2026-07-17T18:00:00.000Z';
const STUDENT_ID = 'phase15-integration-student';
const ABILITY_ID = '推理';

type Check = { name: string; passed: boolean; detail: string };
const checks: Check[] = [];

function check(name: string, passed: boolean, detail: string): void {
  checks.push({ name, passed, detail });
}

async function main(): Promise<void> {
  const task = buildTask();
  const validExecution = execute(task, '父亲可能很怀念过去，也有些不舍，因为他站了很久，还把树叶小心地夹回原处。');
  const invalidExecution = execute(task, '不知道');

  await verifyFullChain(task, validExecution);
  await verifyInvalidAnswerBlocked(task, invalidExecution);
  await verifyAbilityMismatchBlocked(task, validExecution);
  printReport();

  if (checks.some((item) => !item.passed)) {
    throw new Error('Phase 15 integration debug failed.');
  }
}

async function verifyFullChain(task: ConcreteLearningTask, execution: TaskExecutionResult): Promise<void> {
  const diagnosisProvider = new ScriptedDiagnosisProviderAdapter([
    responseStep(buildDiagnosis()),
  ]);
  const diagnosisRepository = new InMemoryFormalDiagnosisRepository();
  const runtimeInput = {
    concreteTask: task,
    taskExecutionResult: execution,
    executionMode: 'live' as const,
    requestId: 'phase15-integration-success',
    providerConfig: createDiagnosisProviderConfigSnapshot({
      provider: diagnosisProvider.providerName,
      model: 'phase15-integration-model',
      promptVersion: REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION,
      maxAttempts: 1,
      timeoutMs: 100,
      createdAt: NOW,
    }),
    commitOnSuccess: true,
    evidenceReturnAlreadyCompleted: false,
    startedAt: NOW,
  };
  const runtime = await runRealLLMRuntimeFoundation(runtimeInput, {
    provider: diagnosisProvider,
    formalDiagnosisRepository: diagnosisRepository,
    now: () => NOW,
  });
  const diagnosis = runtime.formalDiagnosisCommit?.diagnosisResult;
  const diagnosisId = runtime.formalDiagnosisCommit?.formalDiagnosisId;

  check(
    'formal diagnosis commits before Evidence Return',
    runtime.status === 'formal_result_committed' && Boolean(diagnosis && diagnosisId) && runtime.canEnterEvidenceReturn,
    `runtime=${runtime.status}, canEnterEvidence=${runtime.canEnterEvidenceReturn}`,
  );

  const failedReturn = runTaskEvidenceReturnAgent({
    concreteTask: task,
    taskExecutionResult: execution,
    diagnosisFailed: true,
    returnedAt: NOW,
  });
  const evidenceReturn = runTaskEvidenceReturnAgent({
    concreteTask: task,
    taskExecutionResult: execution,
    diagnosisResult: diagnosis,
    diagnosisResultId: diagnosisId,
    returnedAt: NOW,
  });
  const repeatedReturn = runTaskEvidenceReturnAgent({
    concreteTask: task,
    taskExecutionResult: execution,
    diagnosisResult: diagnosis,
    diagnosisResultId: diagnosisId,
    returnedAt: NOW,
  });
  const evidence = evidenceReturn.abilityEvidence[0];

  check(
    'failed Evidence Return does not corrupt retry',
    failedReturn.status === 'diagnosis_failed' && evidenceReturn.status === 'evidence_returned' && Boolean(evidence),
    `first=${failedReturn.status}, retry=${evidenceReturn.status}`,
  );
  check(
    'Phase 8 evaluation, decision and memory are reused',
    Boolean(evidenceReturn.evaluationResult && evidenceReturn.profileUpdateDecision && evidenceReturn.growthMemoryRecord),
    `evaluation=${Boolean(evidenceReturn.evaluationResult)}, decision=${Boolean(evidenceReturn.profileUpdateDecision)}, memory=${Boolean(evidenceReturn.growthMemoryRecord)}`,
  );
  check(
    'Evidence Return is idempotent',
    Boolean(evidence) && repeatedReturn.abilityEvidence[0]?.id === evidence.id,
    `evidenceId=${evidence?.id || 'missing'}`,
  );

  if (!evidence) throw new Error('Successful Evidence Return did not produce AbilityEvidence.');
  const quality = assessEvidenceQuality({
    studentId: STUDENT_ID,
    targetAbilityId: ABILITY_ID,
    abilityEvidence: evidence,
    concreteLearningTask: task,
    taskExecutionResult: execution,
    taskEvidenceReturnResult: evidenceReturn,
    retentionContext: {
      baselineTaskId: 'phase15-integration-baseline-task',
      baselineEvidenceAt: '2026-07-10T18:00:00.000Z',
      materialRelation: 'new_material',
      difficultyRelation: 'comparable',
      source: 'comparison_adapter',
      validationPassed: true,
    },
    assessedAt: NOW,
    timezone: 'Asia/Shanghai',
  });
  check(
    'Phase 14 quality assessment consumes returned Evidence',
    isEvidenceQualityAssessment(quality) && quality.evidenceId === evidence.id,
    `quality=${quality.qualityLevel}, eligibility=${quality.evaluationEligibility}`,
  );

  const feedbackRepository = new InMemoryControlledFeedbackRepository();
  const feedbackInput = {
    feedbackRequestId: 'phase15-integration-feedback',
    learningRoundId: 'phase15-integration-round',
    studentId: STUDENT_ID,
    taskId: task.taskId,
    executionSessionId: execution.executionSessionId,
    responseId: execution.studentResponse?.responseId || 'missing-response',
    studentResponseText: execution.studentResponse?.answerText || '',
    realDiagnosisRuntimeResult: runtime,
    taskEvidenceReturnResult: evidenceReturn,
    expressionConfig: createFeedbackExpressionConfigSnapshot({
      expressionPolicy: 'deterministic_only',
      createdAt: NOW,
    }),
    requestedAt: NOW,
  };
  const feedback = await runControlledFeedbackExpression(feedbackInput, {
    repository: feedbackRepository,
  });
  const repeatedFeedback = await runControlledFeedbackExpression(feedbackInput, {
    repository: feedbackRepository,
  });
  check(
    'controlled feedback is traceable and idempotent',
    feedback.status === 'template_baseline' &&
      feedback.validation.passed &&
      repeatedFeedback === feedback &&
      feedback.admissionDecision.sourceLinks.length >= 2,
    `status=${feedback.status}, links=${feedback.admissionDecision.sourceLinks.length}`,
  );

  const fallbackProvider = new ScriptedDiagnosisProviderAdapter([{
    type: 'error',
    category: 'provider_unavailable',
    retryable: false,
  }]);
  const fallback = await runControlledFeedbackExpression({
    ...feedbackInput,
    feedbackRequestId: 'phase15-integration-feedback-fallback',
    expressionConfig: createFeedbackExpressionConfigSnapshot({
      expressionPolicy: 'llm_enhanced',
      provider: fallbackProvider.providerName,
      maxAttempts: 1,
      createdAt: NOW,
    }),
  }, {
    repository: new InMemoryControlledFeedbackRepository(),
    provider: fallbackProvider,
  });
  check(
    'feedback provider failure safely falls back',
    fallback.status === 'template_fallback' &&
      fallback.finalSelection === 'deterministic_template' &&
      fallback.validation.passed,
    `status=${fallback.status}, fallback=${fallback.fallbackReason}`,
  );

  const repeatedRuntime = await runRealLLMRuntimeFoundation(runtimeInput, {
    provider: diagnosisProvider,
    formalDiagnosisRepository: diagnosisRepository,
    now: () => NOW,
  });
  check(
    'duplicate diagnosis request reuses formal commit',
    repeatedRuntime.formalDiagnosisCommit?.formalDiagnosisId === diagnosisId && diagnosisProvider.getCallCount() === 1,
    `providerCalls=${diagnosisProvider.getCallCount()}`,
  );

  const traceBlob = JSON.stringify({
    evaluationResult: evidenceReturn.evaluationResult,
    profileUpdateDecision: evidenceReturn.profileUpdateDecision,
    growthMemoryRecord: evidenceReturn.growthMemoryRecord,
  });
  check(
    'Evidence remains traceable through Evaluation and Growth Memory',
    traceBlob.includes(evidence.id),
    `evidenceId=${evidence.id}`,
  );
}

async function verifyInvalidAnswerBlocked(task: ConcreteLearningTask, execution: TaskExecutionResult): Promise<void> {
  const provider = new ScriptedDiagnosisProviderAdapter([responseStep(buildDiagnosis())]);
  const runtime = await runRealLLMRuntimeFoundation({
    concreteTask: task,
    taskExecutionResult: execution,
    executionMode: 'live',
    requestId: 'phase15-integration-invalid',
    providerConfig: createDiagnosisProviderConfigSnapshot({
      provider: provider.providerName,
      model: 'phase15-integration-model',
      maxAttempts: 1,
      createdAt: NOW,
    }),
    commitOnSuccess: true,
    startedAt: NOW,
  }, {
    provider,
    formalDiagnosisRepository: new InMemoryFormalDiagnosisRepository(),
    now: () => NOW,
  });
  const evidenceReturn = runTaskEvidenceReturnAgent({
    concreteTask: task,
    taskExecutionResult: execution,
    diagnosisResult: buildDiagnosis(),
    diagnosisResultId: 'must-not-be-consumed',
    returnedAt: NOW,
  });
  check(
    'invalid answer is blocked before provider and Evidence',
    execution.status === 'submitted_invalid' &&
      runtime.status === 'blocked' &&
      provider.getCallCount() === 0 &&
      evidenceReturn.status === 'blocked_invalid_execution' &&
      evidenceReturn.abilityEvidence.length === 0,
    `execution=${execution.status}, runtime=${runtime.status}, providerCalls=${provider.getCallCount()}, return=${evidenceReturn.status}`,
  );
}

async function verifyAbilityMismatchBlocked(task: ConcreteLearningTask, execution: TaskExecutionResult): Promise<void> {
  const provider = new ScriptedDiagnosisProviderAdapter([
    responseStep(buildDiagnosis({ mainAbility: '表达' })),
  ]);
  const runtime = await runRealLLMRuntimeFoundation({
    concreteTask: task,
    taskExecutionResult: execution,
    executionMode: 'live',
    requestId: 'phase15-integration-mismatch',
    providerConfig: createDiagnosisProviderConfigSnapshot({
      provider: provider.providerName,
      model: 'phase15-integration-model',
      maxAttempts: 1,
      createdAt: NOW,
    }),
    commitOnSuccess: true,
    startedAt: NOW,
  }, {
    provider,
    formalDiagnosisRepository: new InMemoryFormalDiagnosisRepository(),
    now: () => NOW,
  });
  check(
    'ability mismatch requires review and cannot enter Evidence Return',
    runtime.status === 'review_required' && !runtime.formalDiagnosisCommit && !runtime.canEnterEvidenceReturn,
    `runtime=${runtime.status}, canEnterEvidence=${runtime.canEnterEvidenceReturn}`,
  );
}

function execute(task: ConcreteLearningTask, answerText: string): TaskExecutionResult {
  const result = runTaskExecutionAgent({
    concreteTask: task,
    readiness: buildReadiness(task.taskId),
    studentAnswer: {
      answerText,
      usedHint: false,
      hintCount: 0,
      submittedAt: NOW,
    },
    startedAt: '2026-07-17T17:55:00.000Z',
  });
  if (!result.taskExecutionResult) throw new Error('Task execution did not produce a result.');
  return result.taskExecutionResult;
}

function buildTask(): ConcreteLearningTask {
  return {
    taskId: 'phase15-integration-task',
    studentId: STUDENT_ID,
    sourceType: 'mock',
    sourceTaskRequestId: 'phase15-integration-task-request',
    targetAbilityId: ABILITY_ID,
    targetAbilityName: ABILITY_ID,
    taskRole: 'retest',
    validationGoal: '验证学生能否根据人物动作独立推断人物心理。',
    readingText: '父亲整理书柜时发现一片旧树叶。他捏着树叶站了很久，最后又把它小心地夹回原处。',
    question: '父亲此时可能有怎样的心理？请结合文中内容说明理由。',
    answerRequirements: ['写出人物心理，并使用文中动作说明理由。'],
    referenceAnswer: '父亲可能感到怀念和不舍，因为他站了很久，又把树叶小心地夹回原处。',
    scoringPoints: ['人物心理判断', '文本动作依据', '行为与心理关系'],
    rubric: [{
      id: 'reasoning-chain',
      name: '推理链',
      description: '能够从人物动作推出人物心理。',
      ability: ABILITY_ID,
      required: true,
    }],
    questionMetadata: {
      questionId: 'phase15-integration-question',
      subject: '语文',
      questionType: 'reading_open_response',
      assessmentMode: 'reasoning_chain',
      mainAbility: ABILITY_ID,
      relatedAbilities: ['信息提取', '表达'],
      rubric: [{ id: 'reasoning-chain', name: '推理链', ability: ABILITY_ID, required: true }],
    },
    expectedDiagnosisFocus: ['学生是否从人物动作推出心理，并说明依据。'],
    createdAt: NOW,
  };
}

function buildReadiness(taskId: string): TaskReadinessValidation {
  return {
    taskId,
    canExecute: true,
    checks: {
      canDisplay: true,
      canAcceptResponse: true,
      hasAssessmentBasis: true,
      metadataComplete: true,
      targetAbilityAligned: true,
      taskRoleAligned: true,
      validationGoalPreserved: true,
      sourceTraceable: true,
      canEnterDiagnosisRuntime: true,
    },
    issues: [],
  };
}

function buildDiagnosis(overrides: Partial<DiagnosisResult> = {}): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: true,
    strategyUsed: 'real_llm_structured_diagnosis',
    answerStatus: 'fully_meets',
    scoreBand: 'high',
    mainAbility: ABILITY_ID,
    relatedAbilities: ['信息提取', '表达'],
    surfaceError: '本次回答能够回应题目要求。',
    rootCause: '本次回答能够使用人物动作支持心理判断。',
    errorType: DIAGNOSIS_ERROR_TYPES[DIAGNOSIS_ERROR_TYPES.length - 1],
    abilityEvidence: ['学生写出怀念和不舍，并引用站了很久和小心夹回原处作为依据。'],
    diagnosisSummary: '本次回答形成了人物动作到人物心理的推理关系。',
    nextTraining: '后续可在新材料中继续观察独立推理表现。',
    confidence: 0.82,
    ...overrides,
  };
}

function responseStep(diagnosis: DiagnosisResult): ScriptedDiagnosisProviderStep {
  return {
    type: 'response',
    rawOutput: JSON.stringify(diagnosis),
    latencyMs: 5,
  };
}

function printReport(): void {
  console.log('\nPhase 15 Integrated Debug Acceptance');
  console.log('====================================');
  for (const item of checks) {
    console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.name}`);
    console.log(`       ${item.detail}`);
  }
  const passed = checks.filter((item) => item.passed).length;
  console.log(`\nResult: ${passed}/${checks.length} checks passed.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
