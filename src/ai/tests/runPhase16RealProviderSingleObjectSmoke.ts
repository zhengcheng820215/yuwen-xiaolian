import { assessEvidenceQuality } from '../agents/evidenceQualityAssessmentAgent.ts';
import { prepareConcreteLearningTaskFromFrozenResource } from '../agents/frozenQuestionResourceTaskAdapter.ts';
import { applyProfileUpdateDecision } from '../agents/profileUpdateExecutor.ts';
import { summarizeGrowthMemory } from '../agents/growthMemorySummaryAgent.ts';
import { generateNextLearningStrategy } from '../agents/nextLearningStrategyAgent.ts';
import { validateNextLearningStrategy } from '../agents/strategyValidationAgent.ts';
import { createTaskRequest } from '../agents/taskRequestAgent.ts';
import { runTaskEvidenceReturnAgent } from '../agents/taskEvidenceReturnAgent.ts';
import { runTaskExecutionAgent } from '../agents/taskExecutionAgent.ts';
import {
  createDiagnosisProviderConfigSnapshot,
  runRealLLMRuntimeFoundation,
} from '../agents/realLLMRuntimeFoundationAgent.ts';
import {
  createFeedbackExpressionConfigSnapshot,
  runControlledFeedbackExpression,
} from '../agents/controlledFeedbackExpressionAgent.ts';
import { REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION } from '../prompts/buildRealAIDiagnosisPromptV4.ts';
import {
  DeepSeekChatDiagnosisProvider,
  ScriptedDiagnosisProviderAdapter,
  type DiagnosisProviderAdapter,
  type DiagnosisProviderRequest,
  type DiagnosisProviderResponse,
} from '../providers/diagnosisProviderAdapter.ts';
import { InMemoryControlledFeedbackRepository } from '../repositories/inMemoryControlledFeedbackRepository.ts';
import { InMemoryFormalDiagnosisRepository } from '../repositories/inMemoryFormalDiagnosisRepository.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { CurrentLearningContext } from '../schemas/nextLearningStrategy.schema.ts';
import type { TaskExecutionResult } from '../schemas/taskExecution.schema.ts';
import type { TaskEvidenceReturnResult } from '../schemas/taskEvidenceReturn.schema.ts';
import type { RealLLMDiagnosisRuntimeResult } from '../schemas/diagnosisRunRecord.schema.ts';
import { getPhase161To162IntegrationDemoData } from '../../api/phase161To162IntegrationDemo.ts';
import { makeProfile } from './growthMemoryDebugFixtures.ts';

const ENABLE_FLAG = 'PHASE16_REAL_PROVIDER_SMOKE';
const RUN_AT = '2026-07-21T09:00:00.000Z';
const SUBMITTED_AT = '2026-07-21T09:05:00.000Z';
const VALID_ANSWER = '父亲捏着褪色的树叶站了很久，又小心地夹回原处，说明他想起过去，因此感到怀念和不舍。';

type SmokeReport = {
  id: string;
  passed: boolean;
  detail: string;
};

type LiveState = {
  runtimeInput: Parameters<typeof runRealLLMRuntimeFoundation>[0];
  runtime: RealLLMDiagnosisRuntimeResult;
  execution: TaskExecutionResult;
  evidenceReturn: TaskEvidenceReturnResult;
  provider: CountingDiagnosisProvider;
  repository: InMemoryFormalDiagnosisRepository;
};

async function main(): Promise<void> {
  if (process.env[ENABLE_FLAG] !== 'true') {
    console.log(`Phase 16 Real Provider Smoke SKIPPED: set ${ENABLE_FLAG}=true to run.`);
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is required.');
  if (!model) throw new Error('DEEPSEEK_MODEL is required.');

  const base = await prepareBase();
  const reports: SmokeReport[] = [];
  let liveState: LiveState | null = null;

  await runCase(reports, 'LIVE-001 formal resource reaches real Diagnosis, Evidence, quality, feedback and next request', async () => {
    liveState = await runLiveHappyPath(base, apiKey, model);
    return `runtime=${liveState.runtime.status}, evidence=${liveState.evidenceReturn.abilityEvidence[0]?.id || 'none'}, providerCalls=${liveState.provider.callCount}`;
  });
  await runCase(reports, 'LIVE-002 invalid response blocks before Provider and Evidence', () => runInvalidResponseCase(base));
  await runCase(reports, 'LIVE-003 Provider failure blocks formal state', () => runProviderFailureCase(base));
  await runCase(reports, 'LIVE-004 ability-misaligned output requires review', () => runAbilityMismatchCase(base));
  await runCase(reports, 'LIVE-005 duplicate request and return remain idempotent', async () => {
    if (!liveState) throw new Error('LIVE-001 did not produce reusable state.');
    return runReplayCase(liveState);
  });

  printReport(model, reports, liveState);
  if (reports.some((item) => !item.passed)) {
    throw new Error('Phase 16 Real Provider Single-object Smoke failed.');
  }
}

async function prepareBase() {
  const demo = await getPhase161To162IntegrationDemoData();
  const normal = demo.cases.find((item) => item.id === 'repository-handoff');
  expect(normal?.passed, 'Phase 16.1 -> 16.2 formal resource handoff is unavailable.');
  expect(normal?.taskResult.task, 'Quality Gate did not create an executable task.');
  expect(normal?.selectedVersion, 'Frozen Resource Version is missing.');
  const preparation = prepareConcreteLearningTaskFromFrozenResource({
    resourceVersion: normal!.selectedVersion!,
    qualityGatedTask: normal!.taskResult.task!,
    createdAt: RUN_AT,
  });
  expect(preparation.status === 'prepared', `Frozen Resource Adapter blocked: ${preparation.issues.join(', ')}`);
  expect(preparation.concreteTaskResult.concreteTask, 'ConcreteLearningTask is missing.');
  expect(preparation.concreteTaskResult.readiness.canExecute, 'ConcreteLearningTask is not executable.');
  return {
    normal: normal!,
    task: preparation.concreteTaskResult.concreteTask!,
    readiness: preparation.concreteTaskResult.readiness,
  };
}

async function runLiveHappyPath(
  base: Awaited<ReturnType<typeof prepareBase>>,
  apiKey: string,
  model: string,
): Promise<LiveState> {
  const execution = execute(base, VALID_ANSWER);
  expect(execution.canEnterDiagnosisRuntime, 'Valid response did not enter Diagnosis Runtime.');
  const provider = new CountingDiagnosisProvider(new DeepSeekChatDiagnosisProvider({ apiKey }));
  const repository = new InMemoryFormalDiagnosisRepository();
  const runtimeInput = {
    concreteTask: base.task,
    taskExecutionResult: execution,
    executionMode: 'live' as const,
    requestId: `phase16-live-${base.normal.selectedVersion!.resourceVersionId}`,
    providerConfig: createDiagnosisProviderConfigSnapshot({
      provider: provider.providerName,
      model,
      providerConfigId: `phase16-live-${sanitizeId(model)}`,
      promptVersion: REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION,
      maxAttempts: 2,
      timeoutMs: 30_000,
      createdAt: RUN_AT,
    }),
    commitOnSuccess: true,
    evidenceReturnAlreadyCompleted: false,
    startedAt: RUN_AT,
  };
  const runtime = await runRealLLMRuntimeFoundation(runtimeInput, {
    provider,
    formalDiagnosisRepository: repository,
    now: () => SUBMITTED_AT,
  });
  expect(runtime.status === 'formal_result_committed', `Real Diagnosis status=${runtime.status}.`);
  expect(runtime.validation.passed && runtime.canEnterEvidenceReturn, `Real Diagnosis validation failed: ${runtime.validation.issues.join(', ')}`);
  expect(runtime.formalDiagnosisCommit?.diagnosisResult, 'Formal DiagnosisResult is missing.');

  const currentProfile = makeProfile(base.task.studentId, base.task.targetAbilityId);
  const evidenceReturn = runTaskEvidenceReturnAgent({
    concreteTask: base.task,
    taskExecutionResult: execution,
    currentProfile,
    diagnosisResult: runtime.formalDiagnosisCommit!.diagnosisResult,
    diagnosisResultId: runtime.formalDiagnosisCommit!.formalDiagnosisId,
    returnedAt: SUBMITTED_AT,
  });
  expect(evidenceReturn.status === 'evidence_returned', `Evidence Return status=${evidenceReturn.status}.`);
  expect(evidenceReturn.abilityEvidence.length === 1, 'Expected one formal AbilityEvidence.');
  expect(evidenceReturn.validation.traceabilityComplete, 'Evidence traceability is incomplete.');

  const evidence = evidenceReturn.abilityEvidence[0];
  const quality = assessEvidenceQuality({
    studentId: base.task.studentId,
    targetAbilityId: base.task.targetAbilityId,
    abilityEvidence: evidence,
    concreteLearningTask: base.task,
    taskExecutionResult: execution,
    taskEvidenceReturnResult: evidenceReturn,
    retentionContext: {
      baselineTaskId: 'phase16-live-baseline-task',
      baselineEvidenceAt: '2026-07-14T09:00:00.000Z',
      materialRelation: 'new_material',
      difficultyRelation: 'comparable',
      source: 'comparison_adapter',
      validationPassed: true,
    },
    assessedAt: SUBMITTED_AT,
    timezone: 'Asia/Shanghai',
  });
  expect(quality.validation.passed, `Evidence Quality validation failed: ${quality.validation.issues.join(', ')}`);
  expect(quality.evidenceId === evidence.id, 'Evidence Quality lost the returned Evidence identity.');

  const feedback = await runControlledFeedbackExpression({
    feedbackRequestId: `phase16-live-feedback-${evidence.id}`,
    learningRoundId: 'phase16-live-round-1',
    studentId: base.task.studentId,
    taskId: base.task.taskId,
    executionSessionId: execution.executionSessionId,
    responseId: execution.studentResponse!.responseId,
    studentResponseText: execution.studentResponse!.answerText,
    realDiagnosisRuntimeResult: runtime,
    taskEvidenceReturnResult: evidenceReturn,
    expressionConfig: createFeedbackExpressionConfigSnapshot({
      expressionPolicy: 'deterministic_only',
      createdAt: SUBMITTED_AT,
    }),
    requestedAt: SUBMITTED_AT,
  }, {
    repository: new InMemoryControlledFeedbackRepository(),
  });
  expect(feedback.validation.passed, `Controlled Feedback failed: ${feedback.validation.issues.join(', ')}`);
  expect(feedback.admissionDecision.limitations.includes('not_individually_human_annotated'), 'Ordinary Live feedback lost its restricted admission limitation.');

  const profileExecution = applyProfileUpdateDecision({
    currentProfile,
    decision: evidenceReturn.profileUpdateDecision!,
    appliedAt: SUBMITTED_AT,
  });
  const memorySummary = summarizeGrowthMemory({
    studentId: base.task.studentId,
    abilityId: base.task.targetAbilityId,
    records: [evidenceReturn.growthMemoryRecord!],
  });
  const context = learningContext(base.task.studentId, base.task.targetAbilityId);
  const strategy = generateNextLearningStrategy({
    growthMemorySummary: memorySummary,
    studentAbilityProfile: profileExecution.afterProfile,
    currentLearningContext: context,
    createdAt: SUBMITTED_AT,
  });
  const strategyValidation = validateNextLearningStrategy({
    strategy,
    currentLearningContext: context,
    validatedAt: SUBMITTED_AT,
  });
  const taskRequest = createTaskRequest({
    strategy,
    validationResult: strategyValidation,
    createdAt: SUBMITTED_AT,
  });
  expect(strategyValidation.isValid, `Next Strategy failed: ${strategyValidation.validationErrors.join(', ')}`);
  expect(taskRequest.taskRequest?.evidenceLinks.includes(evidence.id), 'Next TaskRequest is not grounded in the new Evidence.');
  expect(taskRequest.taskRequest?.growthMemoryRecordIds.includes(evidenceReturn.growthMemoryRecord!.recordId), 'Next TaskRequest is not grounded in GrowthMemory.');
  expect(provider.callCount === 1, `Expected one DeepSeek call, got ${provider.callCount}.`);

  return { runtimeInput, runtime, execution, evidenceReturn, provider, repository };
}

async function runInvalidResponseCase(base: Awaited<ReturnType<typeof prepareBase>>): Promise<string> {
  const execution = execute(base, '445');
  const provider = new CountingDiagnosisProvider(new ScriptedDiagnosisProviderAdapter([{
    type: 'error', category: 'provider_unavailable', retryable: false,
  }]));
  const runtime = await runRealLLMRuntimeFoundation({
    concreteTask: base.task,
    taskExecutionResult: execution,
    executionMode: 'live',
    requestId: 'phase16-live-invalid-response',
    providerConfig: controlledConfig(provider.providerName, 'invalid-response'),
    commitOnSuccess: true,
    startedAt: RUN_AT,
  }, {
    provider,
    formalDiagnosisRepository: new InMemoryFormalDiagnosisRepository(),
    now: () => SUBMITTED_AT,
  });
  expect(!execution.canEnterDiagnosisRuntime, 'Invalid response entered Diagnosis Runtime.');
  expect(runtime.status === 'blocked', `Invalid response runtime status=${runtime.status}.`);
  expect(provider.callCount === 0, 'Provider was called for an invalid response.');
  expect(!runtime.formalDiagnosisCommit && !runtime.canEnterEvidenceReturn, 'Invalid response created a formal Diagnosis.');
  return `execution=${execution.status}, runtime=${runtime.status}, providerCalls=${provider.callCount}`;
}

async function runProviderFailureCase(base: Awaited<ReturnType<typeof prepareBase>>): Promise<string> {
  const execution = execute(base, VALID_ANSWER);
  const provider = new CountingDiagnosisProvider(new ScriptedDiagnosisProviderAdapter([{
    type: 'error', category: 'provider_unavailable', retryable: false,
  }]));
  const runtime = await runRealLLMRuntimeFoundation({
    concreteTask: base.task,
    taskExecutionResult: execution,
    executionMode: 'live',
    requestId: 'phase16-live-provider-failure',
    providerConfig: controlledConfig(provider.providerName, 'provider-failure'),
    commitOnSuccess: true,
    startedAt: RUN_AT,
  }, {
    provider,
    formalDiagnosisRepository: new InMemoryFormalDiagnosisRepository(),
    now: () => SUBMITTED_AT,
  });
  const returned = runTaskEvidenceReturnAgent({
    concreteTask: base.task,
    taskExecutionResult: execution,
    diagnosisFailed: true,
    returnedAt: SUBMITTED_AT,
  });
  expect(['failed', 'blocked'].includes(runtime.status), `Provider failure runtime status=${runtime.status}.`);
  expect(!runtime.formalDiagnosisCommit && !runtime.canEnterEvidenceReturn, 'Provider failure created a formal Diagnosis.');
  expect(returned.status === 'diagnosis_failed' && returned.abilityEvidence.length === 0, 'Provider failure created Evidence.');
  return `runtime=${runtime.status}, return=${returned.status}, providerCalls=${provider.callCount}`;
}

async function runAbilityMismatchCase(base: Awaited<ReturnType<typeof prepareBase>>): Promise<string> {
  const execution = execute(base, VALID_ANSWER);
  const provider = new CountingDiagnosisProvider(new ScriptedDiagnosisProviderAdapter([{
    type: 'response',
    rawOutput: JSON.stringify(misalignedDiagnosis()),
    providerRequestId: 'controlled-phase16-mismatch',
  }]));
  const runtime = await runRealLLMRuntimeFoundation({
    concreteTask: base.task,
    taskExecutionResult: execution,
    executionMode: 'live',
    requestId: 'phase16-live-ability-mismatch',
    providerConfig: controlledConfig(provider.providerName, 'ability-mismatch'),
    commitOnSuccess: true,
    startedAt: RUN_AT,
  }, {
    provider,
    formalDiagnosisRepository: new InMemoryFormalDiagnosisRepository(),
    now: () => SUBMITTED_AT,
  });
  expect(runtime.status === 'review_required', `Ability mismatch runtime status=${runtime.status}.`);
  expect(!runtime.validation.identityAligned, 'Ability mismatch passed identity validation.');
  expect(!runtime.formalDiagnosisCommit && !runtime.canEnterEvidenceReturn, 'Ability mismatch created a formal Diagnosis.');
  return `runtime=${runtime.status}, identity=${runtime.validation.identityAligned}, providerCalls=${provider.callCount}`;
}

async function runReplayCase(state: LiveState): Promise<string> {
  const repeatedRuntime = await runRealLLMRuntimeFoundation(state.runtimeInput, {
    provider: state.provider,
    formalDiagnosisRepository: state.repository,
    now: () => SUBMITTED_AT,
  });
  const repeatedReturn = runTaskEvidenceReturnAgent({
    concreteTask: state.runtimeInput.concreteTask,
    taskExecutionResult: state.execution,
    diagnosisResult: repeatedRuntime.formalDiagnosisCommit?.diagnosisResult,
    diagnosisResultId: repeatedRuntime.formalDiagnosisCommit?.formalDiagnosisId,
    returnedAt: SUBMITTED_AT,
  });
  expect(state.provider.callCount === 1, `Duplicate request recalled DeepSeek: ${state.provider.callCount}.`);
  expect(repeatedRuntime.formalDiagnosisCommit?.formalDiagnosisId === state.runtime.formalDiagnosisCommit?.formalDiagnosisId, 'Duplicate request changed formalDiagnosisId.');
  expect(repeatedReturn.returnId === state.evidenceReturn.returnId, 'Duplicate return changed returnId.');
  expect(repeatedReturn.abilityEvidence[0]?.id === state.evidenceReturn.abilityEvidence[0]?.id, 'Duplicate return changed evidenceId.');
  expect(repeatedReturn.growthMemoryRecord?.recordId === state.evidenceReturn.growthMemoryRecord?.recordId, 'Duplicate return changed GrowthMemory identity.');
  return `providerCalls=${state.provider.callCount}, formalDiagnosis=${repeatedRuntime.formalDiagnosisCommit?.formalDiagnosisId}`;
}

function execute(base: Awaited<ReturnType<typeof prepareBase>>, answerText: string): TaskExecutionResult {
  const result = runTaskExecutionAgent({
    concreteTask: base.task,
    readiness: base.readiness,
    studentAnswer: { answerText, submittedAt: SUBMITTED_AT, elapsedSeconds: 300 },
    startedAt: RUN_AT,
  });
  expect(result.taskExecutionResult, 'TaskExecutionResult is missing.');
  return result.taskExecutionResult!;
}

function controlledConfig(provider: string, id: string) {
  return createDiagnosisProviderConfigSnapshot({
    provider,
    model: `controlled-${id}`,
    providerConfigId: `phase16-${id}`,
    promptVersion: REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION,
    maxAttempts: 1,
    timeoutMs: 1_000,
    createdAt: RUN_AT,
  });
}

function learningContext(studentId: string, targetAbilityId: string): CurrentLearningContext {
  return {
    contextId: 'phase16-live-next-context',
    studentId,
    currentPhase: 'observation',
    targetAbilityId,
    recentTaskRole: 'training',
    allowTraining: true,
    allowRetest: true,
    allowTransfer: true,
    recentFailureCount: 0,
    cognitiveLoad: 'medium',
    reviewRequired: false,
    notes: ['Generated from the Phase 16 Real Provider Smoke result.'],
  };
}

function misalignedDiagnosis(): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: true,
    strategyUsed: 'controlled_mismatch',
    answerStatus: 'fully_meets',
    scoreBand: 'high',
    mainAbility: 'expression',
    relatedAbilities: ['inference'],
    surfaceError: '受控能力错位输出。',
    rootCause: '本对象仅用于验证能力错位 Gate。',
    errorType: '待验证',
    abilityEvidence: ['受控测试内容。'],
    diagnosisSummary: '受控能力错位结果。',
    nextTraining: '不应进入正式回流。',
    confidence: 0.8,
  };
}

class CountingDiagnosisProvider implements DiagnosisProviderAdapter {
  readonly providerName: string;
  callCount = 0;
  private readonly delegate: DiagnosisProviderAdapter;

  constructor(delegate: DiagnosisProviderAdapter) {
    this.delegate = delegate;
    this.providerName = delegate.providerName;
  }

  async diagnose(request: DiagnosisProviderRequest): Promise<DiagnosisProviderResponse> {
    this.callCount += 1;
    return this.delegate.diagnose(request);
  }
}

async function runCase(
  reports: SmokeReport[],
  id: string,
  run: () => string | Promise<string>,
): Promise<void> {
  try {
    reports.push({ id, passed: true, detail: await run() });
  } catch (error) {
    reports.push({
      id,
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function printReport(model: string, reports: SmokeReport[], liveState: LiveState | null): void {
  console.log('\nPhase 16 Real Provider Single-object Smoke');
  console.log('='.repeat(72));
  console.log('provider: deepseek_chat');
  console.log(`model: ${model}`);
  console.log(`realProviderCalls: ${liveState?.provider.callCount || 0}`);
  console.log(`latencyMs: ${liveState?.runtime.runRecord.latencyMs || 0}`);
  console.log(`totalTokens: ${liveState?.runtime.runRecord.tokenUsage?.totalTokens || 0}`);
  for (const report of reports) {
    console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.id}`);
    console.log(`       ${report.detail}`);
  }
  const passed = reports.filter((item) => item.passed).length;
  console.log('-'.repeat(72));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  console.log('Privacy: API Key, full Prompt, Raw Output and full student answer are not printed.');
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 80);
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
