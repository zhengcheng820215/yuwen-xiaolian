import {
  PHASE17_BATCH_A_ANSWER_FIXTURES,
} from '../../data/phase17BatchAFormalResources.ts';
import { resolvePhase163DiagnosisCredential } from '../../server/phase163DiagnosisBoundary.ts';
import {
  prepareFormalResourceRuntimeTask,
  resolveFormalResourceRuntimeSource,
  validateFormalResourceLearningTrace,
} from '../agents/formalResourceRuntimeIntegrationAgent.ts';
import { linkFrozenResourceToObservationTask } from '../agents/materialObservationApplicationService.ts';
import { producePhase17BatchA } from '../agents/phase17BatchAProductionService.ts';
import {
  createNextQuestionResourceVersionDraft,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  validateStructuredQuestionDraft,
} from '../agents/questionResourceAdmissionAgent.ts';
import {
  createDiagnosisProviderConfigSnapshot,
  runRealLLMRuntimeFoundation,
} from '../agents/realLLMRuntimeFoundationAgent.ts';
import { runTaskEvidenceReturnAgent } from '../agents/taskEvidenceReturnAgent.ts';
import { runTaskExecutionAgent } from '../agents/taskExecutionAgent.ts';
import { REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION } from '../prompts/buildRealAIDiagnosisPromptV4.ts';
import {
  DeepSeekChatDiagnosisProvider,
  type DiagnosisProviderAdapter,
  type DiagnosisProviderRequest,
  type DiagnosisProviderResponse,
} from '../providers/diagnosisProviderAdapter.ts';
import { InMemoryFormalDiagnosisRepository } from '../repositories/inMemoryFormalDiagnosisRepository.ts';
import { InMemoryMaterialObservationRepository } from '../repositories/inMemoryMaterialObservationRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  RESOURCE_MATCH_QUALITY_SCHEMA_VERSION,
  type QualityGatedExecutableTask,
} from '../schemas/resourceMatchQuality.schema.ts';
import type { FrozenQuestionResourceVersion } from '../schemas/questionResourceAdmission.schema.ts';
import { makeProfile } from './growthMemoryDebugFixtures.ts';

const ENABLE_FLAG = 'PHASE173_CONTROLLED_LIVE';
const MODEL_FALLBACK = 'deepseek-v4-flash';
const RUN_AT = '2026-07-23T15:00:00.000Z';
const SUBMITTED_AT = '2026-07-23T15:06:00.000Z';
const STUDENT_ID = 'phase17-3-controlled-live-student';
const REVIEWER_ID = 'phase17-3-controlled-live-reviewer';
const REVIEW_NOTE = 'Controlled Live mirror version; content and educational metadata remain unchanged.';

const LIVE_SAMPLES = [
  {
    resourceKey: 'station-analysis-training',
    fixtureId: 'station-analysis-full',
    taskRole: 'training',
    abilityId: 'analysis',
  },
  {
    resourceKey: 'riverbank-inference-retest',
    fixtureId: 'riverbank-inference-full',
    taskRole: 'retest',
    abilityId: 'inference',
  },
  {
    resourceKey: 'riverbank-analysis-transfer',
    fixtureId: 'riverbank-analysis-full',
    taskRole: 'transfer',
    abilityId: 'analysis',
  },
] as const;

type SampleResult = {
  resourceKey: string;
  resourceVersionId: string;
  taskRole: string;
  abilityId: string;
  passed: boolean;
  sourceStatus: string;
  runtimeStatus: string;
  formalizationStatus: string;
  answerStatus: string;
  evidenceCount: number;
  tracePassed: boolean;
  providerCalls: number;
  attempts: number;
  retries: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  issues: string[];
};

async function main(): Promise<void> {
  if (process.env[ENABLE_FLAG] !== 'true') {
    console.log(`Phase 17.3 Controlled Live SKIPPED: set ${ENABLE_FLAG}=true to run.`);
    return;
  }

  const credential = await resolvePhase163DiagnosisCredential();
  if (!credential.apiKey) throw new Error('DeepSeek credential is unavailable.');
  const model = process.env.DEEPSEEK_MODEL?.trim() || MODEL_FALLBACK;
  const provider = new CountingProvider(new DeepSeekChatDiagnosisProvider({
    apiKey: credential.apiKey,
  }));
  const formalDiagnosisRepository = new InMemoryFormalDiagnosisRepository();
  const resourceRepository = new InMemoryQuestionResourceAdmissionRepository();
  const observationRepository = new InMemoryMaterialObservationRepository();

  await producePhase17BatchA({
    resourceRepository,
    observationRepository,
    targetState: 'controlled_frozen',
    reviewerId: REVIEWER_ID,
    reviewNote: REVIEW_NOTE,
    now: RUN_AT,
  });

  const results: SampleResult[] = [];
  for (const sample of LIVE_SAMPLES) {
    try {
      const version = await ensureControlledLiveV2(
        sample.resourceKey,
        resourceRepository,
        observationRepository,
      );
      results.push(await runSample({
        sample,
        version,
        provider,
        formalDiagnosisRepository,
        resourceRepository,
        observationRepository,
        model,
      }));
    } catch (error) {
      results.push({
        resourceKey: sample.resourceKey,
        resourceVersionId: `phase17-batch-a-resource-${sample.resourceKey}:v2`,
        taskRole: sample.taskRole,
        abilityId: sample.abilityId,
        passed: false,
        sourceStatus: 'unknown',
        runtimeStatus: 'failed',
        formalizationStatus: 'blocked',
        answerStatus: 'unknown',
        evidenceCount: 0,
        tracePassed: false,
        providerCalls: 0,
        attempts: 0,
        retries: 0,
        latencyMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        issues: [sanitizeIssue(error)],
      });
    }
  }

  printReport({
    model,
    credentialSource: credential.source,
    results,
    providerCalls: provider.callCount,
  });

  const attempts = results.reduce((total, result) => total + result.attempts, 0);
  if (provider.callCount > 6 || attempts > 6) {
    throw new Error(`Controlled Live budget exceeded: calls=${provider.callCount}, attempts=${attempts}.`);
  }
  if (results.some((result) => !result.passed)) {
    throw new Error('Phase 17.3 Controlled DeepSeek Live failed.');
  }
}

async function runSample(input: {
  sample: typeof LIVE_SAMPLES[number];
  version: FrozenQuestionResourceVersion;
  provider: CountingProvider;
  formalDiagnosisRepository: InMemoryFormalDiagnosisRepository;
  resourceRepository: InMemoryQuestionResourceAdmissionRepository;
  observationRepository: InMemoryMaterialObservationRepository;
  model: string;
}): Promise<SampleResult> {
  const source = await resolveFormalResourceRuntimeSource({
    resourceVersionId: input.version.resourceVersionId,
    resourceRepository: input.resourceRepository,
    observationRepository: input.observationRepository,
  });
  expect(source.status === 'ready' && source.sourceContext, source.issues.join('|'));
  expect(input.version.abilityMetadata.abilityId === input.sample.abilityId, 'Live sample Ability changed.');
  expect(input.version.abilityMetadata.taskRole === input.sample.taskRole, 'Live sample TaskRole changed.');
  expect(input.version.versionNumber === 2, 'Controlled Live sample is not the frozen v2 mirror.');

  const qualityTask = buildQualityTask(input.version, source.sourceContext.observationGoal);
  const preparation = await prepareFormalResourceRuntimeTask({
    resourceVersionId: input.version.resourceVersionId,
    qualityGatedTask: qualityTask,
    resourceRepository: input.resourceRepository,
    observationRepository: input.observationRepository,
    createdAt: RUN_AT,
  });
  expect(preparation.status === 'prepared', preparation.issues.join('|'));
  const task = preparation.taskPreparation?.concreteTaskResult.concreteTask;
  const readiness = preparation.taskPreparation?.concreteTaskResult.readiness;
  expect(task && readiness?.canExecute, 'Concrete task is not ready.');

  const answer = PHASE17_BATCH_A_ANSWER_FIXTURES
    .find((fixture) => fixture.fixtureId === input.sample.fixtureId)?.studentAnswer;
  expect(answer, 'Frozen Live answer Fixture is missing.');
  const execution = runTaskExecutionAgent({
    concreteTask: task,
    readiness,
    studentAnswer: {
      answerText: answer,
      usedHint: false,
      hintCount: 0,
      submittedAt: SUBMITTED_AT,
      elapsedSeconds: 360,
    },
    startedAt: RUN_AT,
  }).taskExecutionResult;
  expect(execution?.canEnterDiagnosisRuntime, 'Live answer did not pass Answer Validity.');

  const requestId = `phase17-3-controlled-live-${input.sample.resourceKey}-v2`;
  const runtimeInput = {
    concreteTask: task,
    taskExecutionResult: execution,
    executionMode: 'live' as const,
    requestId,
    providerConfig: createDiagnosisProviderConfigSnapshot({
      provider: input.provider.providerName,
      model: input.model,
      providerConfigId: `phase17-3-controlled-live-${sanitizeId(input.model)}`,
      promptVersion: REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION,
      temperature: 0.2,
      maxOutputTokens: 1600,
      timeoutMs: 30_000,
      maxAttempts: 2,
      createdAt: RUN_AT,
    }),
    commitOnSuccess: true,
    evidenceReturnAlreadyCompleted: false,
    startedAt: RUN_AT,
  };
  const callsBefore = input.provider.callCount;
  const runtime = await runRealLLMRuntimeFoundation(runtimeInput, {
    provider: input.provider,
    formalDiagnosisRepository: input.formalDiagnosisRepository,
    now: () => SUBMITTED_AT,
  });
  const callsAfterFirst = input.provider.callCount;
  const replay = await runRealLLMRuntimeFoundation(runtimeInput, {
    provider: input.provider,
    formalDiagnosisRepository: input.formalDiagnosisRepository,
    now: () => SUBMITTED_AT,
  });
  const providerCalls = callsAfterFirst - callsBefore;
  const replayReused = input.provider.callCount === callsAfterFirst &&
    replay.formalDiagnosisCommit?.formalDiagnosisId === runtime.formalDiagnosisCommit?.formalDiagnosisId;

  const diagnosis = runtime.formalDiagnosisCommit?.diagnosisResult;
  const evidenceReturn = diagnosis
    ? runTaskEvidenceReturnAgent({
      concreteTask: task,
      taskExecutionResult: execution,
      currentProfile: makeProfile(STUDENT_ID, input.sample.abilityId),
      diagnosisResult: diagnosis,
      diagnosisResultId: runtime.formalDiagnosisCommit!.formalDiagnosisId,
      returnedAt: SUBMITTED_AT,
    })
    : undefined;
  const trace = validateFormalResourceLearningTrace({
    sourceContext: source.sourceContext,
    concreteTask: task,
    diagnosisResult: diagnosis,
    evidenceReturnResult: evidenceReturn,
  });
  const runRecord = runtime.runRecord;
  const issues = unique([
    ...source.issues,
    ...runtime.validation.issues,
    ...(evidenceReturn?.validation.issues || []),
    ...trace.issues,
    ...(!replayReused ? ['duplicate_request_not_reused'] : []),
  ]);
  const passed = runtime.status === 'formal_result_committed' &&
    runtime.formalizationStatus === 'committed' &&
    runtime.validation.passed &&
    runtime.canEnterEvidenceReturn &&
    diagnosis?.mainAbility === input.sample.abilityId &&
    evidenceReturn?.status === 'evidence_returned' &&
    evidenceReturn.abilityEvidence.length === 1 &&
    trace.passed &&
    replayReused &&
    providerCalls >= 1 &&
    providerCalls <= 2;

  return {
    resourceKey: input.sample.resourceKey,
    resourceVersionId: input.version.resourceVersionId,
    taskRole: input.sample.taskRole,
    abilityId: input.sample.abilityId,
    passed,
    sourceStatus: source.status,
    runtimeStatus: runtime.status,
    formalizationStatus: runtime.formalizationStatus,
    answerStatus: diagnosis?.answerStatus || 'unknown',
    evidenceCount: evidenceReturn?.abilityEvidence.length || 0,
    tracePassed: trace.passed,
    providerCalls,
    attempts: runRecord.attemptCount,
    retries: Math.max(0, runRecord.attemptCount - 1),
    latencyMs: runRecord.latencyMs || 0,
    inputTokens: runRecord.tokenUsage?.inputTokens || 0,
    outputTokens: runRecord.tokenUsage?.outputTokens || 0,
    totalTokens: runRecord.tokenUsage?.totalTokens || 0,
    issues,
  };
}

async function ensureControlledLiveV2(
  resourceKey: string,
  resourceRepository: InMemoryQuestionResourceAdmissionRepository,
  observationRepository: InMemoryMaterialObservationRepository,
): Promise<FrozenQuestionResourceVersion> {
  const resourceId = `phase17-batch-a-resource-${resourceKey}`;
  const registry = await resourceRepository.getRegistryEntry(resourceId);
  expect(registry?.currentFrozenVersionId, 'Controlled Live Registry head is missing.');
  const current = await resourceRepository.getVersion(registry.currentFrozenVersionId);
  expect(current, 'Controlled Live current Frozen Resource is missing.');
  if (current.versionNumber === 2) return current;
  expect(current.versionNumber === 1, 'Controlled Live mirror requires a v1 source.');
  const activeLink = (await observationRepository.listLinks(resourceId))
    .find((link) => link.status === 'active' && link.resourceVersionId === current.resourceVersionId);
  expect(activeLink, 'Controlled Live source Observation Link is missing.');

  const draftId = `phase17-3-controlled-live-${resourceKey}-v2`;
  let draft = await createNextQuestionResourceVersionDraft(resourceRepository, {
    resourceId,
    draftId,
    now: RUN_AT,
  });
  const validation = await validateStructuredQuestionDraft(resourceRepository, draft.draftId, RUN_AT);
  expect(validation.passed, validation.issues.map((issue) => issue.code).join('|'));
  draft = await submitQuestionResourceForReview(resourceRepository, draft.draftId, RUN_AT);
  await reviewQuestionResourceDraft(resourceRepository, {
    draftId: draft.draftId,
    action: 'approve',
    reviewerId: REVIEWER_ID,
    notes: REVIEW_NOTE,
    now: RUN_AT,
  });
  const frozen = await freezeQuestionResourceDraft(resourceRepository, draft.draftId, RUN_AT);
  const linked = await linkFrozenResourceToObservationTask(
    resourceRepository,
    observationRepository,
    {
      planId: activeLink.materialObservationPlanId,
      observationTaskPlanId: activeLink.observationTaskPlanId,
      resourceVersionId: frozen.version.resourceVersionId,
      linkedAt: RUN_AT,
    },
  );
  expect(linked.link.status === 'active' && linked.issues.length === 0, linked.issues.join('|'));
  return frozen.version;
}

function buildQualityTask(
  version: FrozenQuestionResourceVersion,
  validationGoal: string,
): QualityGatedExecutableTask {
  const suffix = sanitizeId(version.resourceVersionId);
  return {
    traceId: `phase17-3-controlled-live-trace-${suffix}`,
    executableTask: {
      executableTaskId: `phase17-3-controlled-live-executable-${suffix}`,
      studentId: STUDENT_ID,
      sourceType: 'resource_match',
      sourceTaskId: version.taskId,
      taskRole: version.abilityMetadata.taskRole,
      targetAbilityId: version.abilityMetadata.abilityId,
      validationGoal,
      contentRef: version.materialVersionId || `resource:${version.resourceVersionId}`,
      questionRef: `question:${version.resourceVersionId}`,
      rubricRef: `rubric:${version.resourceVersionId}`,
      sourceStrategyId: `phase17-3-controlled-live-strategy-${suffix}`,
      sourceTaskRequestId: `phase17-3-controlled-live-request-${suffix}`,
      sourceFulfillmentRequestId: `phase17-3-controlled-live-fulfillment-${suffix}`,
      limitations: ['controlled_live_isolated_repository'],
      createdAt: RUN_AT,
    },
    resourceId: version.resourceId,
    resourceVersionId: version.resourceVersionId,
    taskId: version.taskId,
    materialId: version.materialId,
    materialVersionId: version.materialVersionId,
    constraintsId: `phase17-3-controlled-live-constraints-${suffix}`,
    resourceMatchQualityEvaluationId: `phase17-3-controlled-live-quality-${suffix}`,
    createdAt: RUN_AT,
    schemaVersion: RESOURCE_MATCH_QUALITY_SCHEMA_VERSION,
  };
}

function printReport(input: {
  model: string;
  credentialSource: string;
  results: SampleResult[];
  providerCalls: number;
}): void {
  console.log('\nPhase 17.3 Controlled DeepSeek Live');
  console.log('='.repeat(92));
  input.results.forEach((result) => {
    console.log(`${result.passed ? 'PASS' : 'FAIL'} | ${result.taskRole.toUpperCase()} | ${result.resourceVersionId}`);
    console.log(
      `       source=${result.sourceStatus}, runtime=${result.runtimeStatus}, formalization=${result.formalizationStatus}, ` +
      `answerStatus=${result.answerStatus}, evidence=${result.evidenceCount}, trace=${result.tracePassed}`,
    );
    console.log(
      `       calls=${result.providerCalls}, attempts=${result.attempts}, retries=${result.retries}, ` +
      `latency=${result.latencyMs}ms, tokens=${result.inputTokens}/${result.outputTokens}/${result.totalTokens}, ` +
      `issues=${result.issues.join('|') || 'none'}`,
    );
  });
  const total = input.results.reduce((sum, result) => ({
    attempts: sum.attempts + result.attempts,
    latencyMs: sum.latencyMs + result.latencyMs,
    inputTokens: sum.inputTokens + result.inputTokens,
    outputTokens: sum.outputTokens + result.outputTokens,
    totalTokens: sum.totalTokens + result.totalTokens,
  }), { attempts: 0, latencyMs: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  console.log('-'.repeat(92));
  console.log(`Result: ${input.results.filter((result) => result.passed).length} / ${input.results.length} samples PASS`);
  console.log(`Provider: deepseek_chat / ${input.model}`);
  console.log(`Prompt: ${REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION}`);
  console.log(`Credential source: ${input.credentialSource}`);
  console.log(`Provider calls: ${input.providerCalls} / 6 budget`);
  console.log(`Attempts: ${total.attempts} / 6 budget`);
  console.log(`Latency total: ${total.latencyMs} ms`);
  console.log(`Token usage: input=${total.inputTokens}, output=${total.outputTokens}, total=${total.totalTokens}`);
  console.log('Formal side effects: isolated in-memory repositories; browser IndexedDB unchanged.');
  console.log('Sensitive output: API key, full prompt, student answer and raw model output are not printed.');
}

function sanitizeIssue(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .slice(0, 240);
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class CountingProvider implements DiagnosisProviderAdapter {
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

void main().catch((error: unknown) => {
  console.error(sanitizeIssue(error));
  process.exitCode = 1;
});
