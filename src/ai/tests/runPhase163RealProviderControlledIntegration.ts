import { createDiagnosisProviderConfigSnapshot } from '../agents/realLLMRuntimeFoundationAgent.ts';
import { runPhase163RealLearningChain } from '../agents/phase163RealLearningChainAgent.ts';
import { REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION } from '../prompts/buildRealAIDiagnosisPromptV4.ts';
import {
  DeepSeekChatDiagnosisProvider,
  type DiagnosisProviderAdapter,
  type DiagnosisProviderRequest,
  type DiagnosisProviderResponse,
} from '../providers/diagnosisProviderAdapter.ts';
import { InMemoryLearningPersistenceRepository } from '../repositories/inMemoryLearningPersistenceRepository.ts';
import { InMemoryRealLearningOperationRepository } from '../repositories/inMemoryRealLearningOperationRepository.ts';
import {
  createPhase163DemoEnvironment,
  type Phase163DemoCaseId,
} from '../../api/phase163RealLearningChainDemo.ts';

const ENABLE_FLAG = 'PHASE163_REAL_PROVIDER_INTEGRATION';
const MODEL_FALLBACK = 'deepseek-v4-flash';
const VALID_ANSWER = '父亲捏着褪色的树叶站了很久，又小心地夹回原处，说明他想起过去，因此感到怀念和不舍。';

type Check = {
  id: string;
  passed: boolean;
  detail: string;
};

async function main(): Promise<void> {
  if (process.env[ENABLE_FLAG] !== 'true') {
    console.log(`Phase 16.3A Controlled Real Provider Integration SKIPPED: set ${ENABLE_FLAG}=true to run.`);
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || MODEL_FALLBACK;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is required.');

  const environment = await createPhase163DemoEnvironment('complete_chain', VALID_ANSWER);
  const provider = new CountingProvider(new DeepSeekChatDiagnosisProvider({ apiKey }));
  const input = {
    ...environment.input,
    operationId: 'phase16-3-controlled-live-operation',
    learningSessionId: 'phase16-3-controlled-live-session',
    learningRoundId: 'phase16-3-controlled-live-round',
    diagnosisRequestId: 'phase16-3-controlled-live-diagnosis',
    providerConfig: createDiagnosisProviderConfigSnapshot({
      provider: provider.providerName,
      model,
      providerConfigId: `phase16-3-controlled-live-${sanitizeId(model)}`,
      promptVersion: REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION,
      maxAttempts: 2,
      timeoutMs: 30_000,
      createdAt: environment.input.startedAt,
    }),
  };
  const dependencies = { ...environment.dependencies, provider };
  const checks: Check[] = [];

  const first = await runPhase163RealLearningChain(input, dependencies);
  const checkpoint = first.checkpoint;
  const runtime = checkpoint.realDiagnosisRuntimeResult;
  const evidenceReturn = checkpoint.taskEvidenceReturnResult;
  const next = checkpoint.nextTaskResolution;
  record(checks, 'LIVE-A1 full chain completed',
    first.status === 'completed' && checkpoint.stage === 'next_task_ready',
    `status=${first.status}, stage=${checkpoint.stage}`);
  record(checks, 'LIVE-A2 formal Diagnosis committed and admitted',
    runtime?.status === 'formal_result_committed' &&
      checkpoint.diagnosisAdmission?.status === 'accepted' &&
      checkpoint.diagnosisAdmission.basis === 'formal_runtime_validation' &&
      checkpoint.diagnosisAdmission.limitations.includes('not_individually_human_annotated') &&
      runtime.formalDiagnosisCommit?.status === 'committed',
    `runtime=${runtime?.status}, admission=${checkpoint.diagnosisAdmission?.status}, basis=${checkpoint.diagnosisAdmission?.basis}`);
  record(checks, 'LIVE-A3 Evidence, Profile and GrowthMemory returned once',
    evidenceReturn?.status === 'evidence_returned' &&
      evidenceReturn.abilityEvidence.length === 1 &&
      Boolean(checkpoint.updatedStudentAbilityProfile) &&
      Boolean(checkpoint.updatedGrowthMemorySummary),
    `evidence=${evidenceReturn?.abilityEvidence.length || 0}, profile=${Boolean(checkpoint.updatedStudentAbilityProfile)}, memory=${Boolean(checkpoint.updatedGrowthMemorySummary)}`);
  record(checks, 'LIVE-A4 formal result persisted',
    Boolean(checkpoint.learningPersistenceRecordId) && first.acceptanceReport.persistence.formalResultSaved,
    `record=${checkpoint.learningPersistenceRecordId ? 'present' : 'missing'}`);
  record(checks, 'LIVE-A5 next task uses another Frozen Resource',
    next?.status === 'matched' && next.taskReadiness?.canExecute === true &&
      next.resourceVersion?.resourceId !== input.resourceVersion.resourceId,
    `match=${next?.status}, differentResource=${next?.resourceVersion?.resourceId !== input.resourceVersion.resourceId}`);
  record(checks, 'LIVE-A6 DeepSeek called exactly once',
    provider.callCount === 1,
    `providerCalls=${provider.callCount}`);

  const repeated = await runPhase163RealLearningChain(input, dependencies);
  record(checks, 'LIVE-A7 duplicate submission reuses formal result',
    repeated.status === 'completed' && provider.callCount === 1 &&
      repeated.checkpoint.taskEvidenceReturnResult?.returnId === evidenceReturn?.returnId,
    `providerCalls=${provider.callCount}, sameReturn=${repeated.checkpoint.taskEvidenceReturnResult?.returnId === evidenceReturn?.returnId}`);

  const restoredDependencies = {
    ...dependencies,
    operationRepository: new InMemoryRealLearningOperationRepository(environment.operationStore),
    learningPersistenceRepository: new InMemoryLearningPersistenceRepository(environment.learningStore),
  };
  const restored = await runPhase163RealLearningChain(input, restoredDependencies);
  record(checks, 'LIVE-A8 Repository recreation restores without Diagnosis rerun',
    restored.status === 'completed' &&
      restored.acceptanceReport.persistence.recoveredFromCheckpoint &&
      !restored.acceptanceReport.persistence.diagnosisReexecutedDuringRecovery &&
      provider.callCount === 1,
    `recovered=${restored.acceptanceReport.persistence.recoveredFromCheckpoint}, providerCalls=${provider.callCount}`);

  const invalid = await runBlockedCase('invalid_answer', '', provider);
  record(checks, 'LIVE-A9 invalid response blocks before Provider',
    invalid.status === 'retry_required' && provider.callCount === 1 &&
      !invalid.checkpoint.taskEvidenceReturnResult,
    `status=${invalid.status}, providerCalls=${provider.callCount}`);

  const reviewEnvironment = await createPhase163DemoEnvironment('diagnosis_review', VALID_ANSWER);
  const review = await runPhase163RealLearningChain(reviewEnvironment.input, reviewEnvironment.dependencies);
  record(checks, 'LIVE-A10 questionable Diagnosis remains review_required',
    review.status === 'review_required' && !review.checkpoint.taskEvidenceReturnResult,
    `status=${review.status}, evidence=${Boolean(review.checkpoint.taskEvidenceReturnResult)}`);

  record(checks, 'LIVE-A11 acceptance checks and traceability are complete',
    Object.values(first.acceptanceReport.checks).every(Boolean) &&
      evidenceReturn?.validation.traceabilityComplete === true,
    `failedChecks=${Object.entries(first.acceptanceReport.checks).filter(([, passed]) => !passed).map(([key]) => key).join('|') || 'none'}`);

  printReport(model, checks, first, provider.callCount);
  if (checks.some((item) => !item.passed)) {
    throw new Error('Phase 16.3A Controlled Real Provider Integration failed.');
  }
}

async function runBlockedCase(
  caseId: Phase163DemoCaseId,
  answerText: string,
  provider: CountingProvider,
) {
  const environment = await createPhase163DemoEnvironment(caseId, answerText);
  return runPhase163RealLearningChain(environment.input, {
    ...environment.dependencies,
    provider,
  });
}

function record(checks: Check[], id: string, passed: boolean, detail: string): void {
  checks.push({ id, passed, detail });
}

function printReport(
  model: string,
  checks: Check[],
  result: Awaited<ReturnType<typeof runPhase163RealLearningChain>>,
  providerCalls: number,
): void {
  const runRecord = result.checkpoint.realDiagnosisRuntimeResult?.runRecord;
  console.log('\nPhase 16.3A Controlled Real Provider Integration');
  console.log('='.repeat(78));
  checks.forEach((item) => {
    console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.id}`);
    console.log(`       ${item.detail}`);
  });
  console.log('-'.repeat(78));
  console.log(`Result: ${checks.filter((item) => item.passed).length} / ${checks.length} PASS`);
  console.log(`Provider: deepseek_chat / ${model}`);
  console.log(`Prompt: ${REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION}`);
  console.log(`Provider calls: ${providerCalls}`);
  console.log(`Latency: ${runRecord?.latencyMs || 0} ms`);
  console.log(`Token usage: input=${runRecord?.tokenUsage.inputTokens || 0}, output=${runRecord?.tokenUsage.outputTokens || 0}, total=${runRecord?.tokenUsage.totalTokens || 0}`);
  console.log(`Retry count: ${Math.max(0, (runRecord?.attemptCount || 1) - 1)}`);
  console.log('Sensitive output: API key, full prompt and raw model output are not printed.');
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
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
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
