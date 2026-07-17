import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import {
  buildDiagnosisBatchReport,
  getDiagnosisBatchBudgetExceededReason,
  validateDiagnosisBatchPlan,
} from '../agents/diagnosisBatchReportAgent.ts';
import { validateDiagnosisEvaluationDataset } from '../agents/diagnosisEvaluationDatasetValidator.ts';
import {
  evaluateDiagnosisQuality,
  evaluateDiagnosisSampleStability,
} from '../agents/diagnosisQualityEvaluationAgent.ts';
import {
  createDiagnosisProviderConfigSnapshot,
  runRealLLMRuntimeFoundation,
} from '../agents/realLLMRuntimeFoundationAgent.ts';
import { PHASE15_2_DATASET_V1 } from '../evaluation/phase15_2_dataset_v1.ts';
import { DeepSeekChatDiagnosisProvider } from '../providers/diagnosisProviderAdapter.ts';
import { REAL_AI_DIAGNOSIS_PROMPT_VERSION } from '../prompts/buildRealAIDiagnosisPrompt.ts';
import { REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION } from '../prompts/buildRealAIDiagnosisPromptV4.ts';
import { InMemoryFormalDiagnosisRepository } from '../repositories/inMemoryFormalDiagnosisRepository.ts';
import { DIAGNOSIS_REPAIR_POLICY_VERSION } from '../schemas/diagnosisRunRecord.schema.ts';
import type {
  DiagnosisBatchReport,
  DiagnosisBatchRunSummary,
  DiagnosisQualityEvaluation,
  DiagnosisSampleStabilityResult,
} from '../schemas/diagnosisQualityEvaluation.schema.ts';

const ENABLE_FLAG = 'REAL_DIAGNOSIS_EVALUATION_BATCH';
const BASELINE_DATASET_VERSION = '1.0.0';
const BASELINE_MODEL = 'deepseek-v4-flash';
const BASELINE_PROMPT_VERSION = 'real_ai_diagnosis_prompt_v3';
const BASELINE_TEMPERATURE = 0.2;
const BASELINE_MAX_OUTPUT_TOKENS = 1600;
const BASELINE_MAX_ATTEMPTS = 2;
const BASELINE_TIMEOUT_MS = 30_000;
const BASELINE_REPETITIONS = 3;
const DEFAULT_MAX_PROVIDER_CALLS = 100;
const DEFAULT_MAX_TOTAL_TOKENS = 500_000;
const DEFAULT_MAX_PROVIDER_FAILED_RUNS = 10;

async function runRealDiagnosisEvaluationBatch(): Promise<void> {
  if (process.env[ENABLE_FLAG] !== 'true') {
    console.log(`Phase 15.2 Real Shadow Batch SKIPPED: set ${ENABLE_FLAG}=true to run.`);
    return;
  }
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is required.');

  const model = process.env.DEEPSEEK_MODEL || BASELINE_MODEL;
  const promptVersion = process.env.PHASE15_BATCH_PROMPT_VERSION || BASELINE_PROMPT_VERSION;
  const repetitions = parsePositiveInteger(process.env.PHASE15_BATCH_REPETITIONS, BASELINE_REPETITIONS);
  const sampleLimit = parsePositiveInteger(
    process.env.PHASE15_BATCH_LIMIT,
    PHASE15_2_DATASET_V1.samples.length,
  );
  const maxProviderCalls = parsePositiveInteger(
    process.env.PHASE15_BATCH_MAX_PROVIDER_CALLS,
    DEFAULT_MAX_PROVIDER_CALLS,
  );
  const maxTotalTokens = parsePositiveInteger(
    process.env.PHASE15_BATCH_MAX_TOTAL_TOKENS,
    DEFAULT_MAX_TOTAL_TOKENS,
  );
  const maxProviderFailedRuns = parsePositiveInteger(
    process.env.PHASE15_BATCH_MAX_FAILED_RUNS,
    DEFAULT_MAX_PROVIDER_FAILED_RUNS,
  );
  const selectedSampleIds = parseSampleIds(process.env.PHASE15_BATCH_REVIEW_SAMPLE_IDS);
  const reportPurpose = selectedSampleIds.length > 0 ? 'manual_review_packet' : 'baseline';
  validateFrozenBaselineConfig({
    model,
    promptVersion,
    repetitions,
    sampleLimit,
    reviewMode: reportPurpose === 'manual_review_packet',
  });

  const datasetValidation = validateDiagnosisEvaluationDataset(PHASE15_2_DATASET_V1);
  if (!datasetValidation.passed) {
    throw new Error(`Dataset validation failed: ${datasetValidation.issues.join(' | ')}`);
  }

  const samples = reportPurpose === 'manual_review_packet'
    ? selectReviewSamples(selectedSampleIds)
    : PHASE15_2_DATASET_V1.samples.slice(0, sampleLimit);
  const plannedLogicalRuns = samples.length * repetitions;
  const plannedProviderCalls = samples.filter((sample) =>
    sample.validityExpectation !== 'should_be_blocked_by_validity_gate'
  ).length * repetitions;
  const planIssues = validateDiagnosisBatchPlan({ plannedProviderCalls, maxProviderCalls });
  if (planIssues.length > 0) throw new Error(planIssues.join(' | '));

  const provider = new DeepSeekChatDiagnosisProvider({ apiKey });
  const repository = new InMemoryFormalDiagnosisRepository();
  const config = createDiagnosisProviderConfigSnapshot({
    provider: provider.providerName,
    model,
    providerConfigId: `phase15-quality-batch-${sanitizeId(model)}-${sanitizeId(promptVersion)}`,
    temperature: BASELINE_TEMPERATURE,
    maxOutputTokens: BASELINE_MAX_OUTPUT_TOKENS,
    maxAttempts: BASELINE_MAX_ATTEMPTS,
    timeoutMs: BASELINE_TIMEOUT_MS,
    promptVersion,
  });
  const configuration: DiagnosisBatchReport['configuration'] = {
    reportPurpose,
    datasetId: PHASE15_2_DATASET_V1.datasetId,
    datasetVersion: PHASE15_2_DATASET_V1.datasetVersion,
    datasetFrozenAt: PHASE15_2_DATASET_V1.frozenAt,
    provider: provider.providerName,
    model,
    promptVersion: config.promptVersion,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    maxAttempts: config.maxAttempts,
    timeoutMs: config.timeoutMs,
    repairPolicyVersion: config.repairPolicyVersion,
    executionMode: 'shadow',
    repetitions,
    sampleLimit: samples.length,
    selectedSampleIds: reportPurpose === 'manual_review_packet'
      ? samples.map((sample) => sample.sampleId)
      : undefined,
    maxProviderCalls,
    maxTotalTokens,
    maxProviderFailedRuns,
  };
  printFrozenConfiguration(configuration, plannedLogicalRuns, plannedProviderCalls);

  const evaluations: DiagnosisQualityEvaluation[] = [];
  const stabilityResults: DiagnosisSampleStabilityResult[] = [];
  const runs: DiagnosisBatchRunSummary[] = [];
  let totalTokens = 0;
  let providerFailedRuns = 0;
  let abortedReason: string | undefined;

  outer: for (const sample of samples) {
    const sampleEvaluations: DiagnosisQualityEvaluation[] = [];
    for (let runIndex = 1; runIndex <= repetitions; runIndex += 1) {
      const isValidityBlocked = sample.validityExpectation === 'should_be_blocked_by_validity_gate';
      const runtimeResult = isValidityBlocked
        ? undefined
        : await runRealLLMRuntimeFoundation({
          concreteTask: sample.concreteTask,
          taskExecutionResult: sample.taskExecutionResult,
          executionMode: 'shadow',
          requestId: `phase15-quality-${sample.sampleId}-${runIndex}`,
          providerConfig: config,
          commitOnSuccess: false,
        }, {
          provider,
          formalDiagnosisRepository: repository,
        });
      const repairOperations = runtimeResult?.runRecord.repairOperations || [];
      const rawSchemaValid = runtimeResult
        ? runtimeResult.validation.schemaValid && repairOperations.length === 0
        : false;
      const postRepairSchemaValid = runtimeResult
        ? runtimeResult.validation.schemaValid
        : false;
      const evaluation = evaluateDiagnosisQuality({
        datasetVersion: PHASE15_2_DATASET_V1.datasetVersion,
        sample,
        runtimeResult,
        rawSchemaValid,
        postRepairSchemaValid,
        evaluatedAt: new Date().toISOString(),
        evaluationRubricVersion: 'diagnosis-human-boundary-v1',
      });
      const outcome: DiagnosisBatchRunSummary['outcome'] = isValidityBlocked
        ? 'validity_blocked'
        : runtimeResult?.runRecord.rawOutputRef
          ? 'provider_completed'
          : 'provider_failed';
      const tokenUsage = runtimeResult?.runRecord.tokenUsage || {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
      const run: DiagnosisBatchRunSummary = {
        sampleId: sample.sampleId,
        category: sample.category,
        targetAbilityId: sample.targetAbilityId,
        runIndex,
        providerCallPlanned: !isValidityBlocked,
        outcome,
        runtimeStatus: runtimeResult?.status,
        providerErrorCategory: runtimeResult?.runRecord.errorCategory,
        qualityLevel: evaluation.qualityLevel,
        attemptCount: runtimeResult?.runRecord.attemptCount || 0,
        repairCount: repairOperations.length,
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        latencyMs: runtimeResult?.runRecord.latencyMs || 0,
        failedDimensions: Object.entries(evaluation.dimensions)
          .filter(([, passed]) => !passed)
          .map(([name]) => name),
        matchedFacts: evaluation.matchedFacts,
        missingFacts: evaluation.missingFacts,
        violations: evaluation.violations,
        limitations: evaluation.limitations,
        candidateSnapshot: runtimeResult?.diagnosisCandidate
          ? {
            mainAbility: runtimeResult.diagnosisCandidate.mainAbility,
            answerStatus: runtimeResult.diagnosisCandidate.answerStatus,
            rootCause: runtimeResult.diagnosisCandidate.rootCause,
            surfaceError: runtimeResult.diagnosisCandidate.surfaceError,
            abilityEvidence: runtimeResult.diagnosisCandidate.abilityEvidence,
            diagnosisSummary: runtimeResult.diagnosisCandidate.diagnosisSummary,
          }
          : undefined,
      };
      runs.push(run);
      evaluations.push(evaluation);
      sampleEvaluations.push(evaluation);
      totalTokens += tokenUsage.totalTokens;
      if (outcome === 'provider_failed') providerFailedRuns += 1;
      console.log(
        `${runs.length}/${plannedLogicalRuns} ${sample.sampleId} #${runIndex}: ` +
        `${outcome} / ${evaluation.qualityLevel}`,
      );

      abortedReason = getDiagnosisBatchBudgetExceededReason({
        totalTokens,
        maxTotalTokens,
        providerFailedRuns,
        maxProviderFailedRuns,
      });
      if (abortedReason) {
        break outer;
      }
    }
    stabilityResults.push(evaluateDiagnosisSampleStability(sampleEvaluations));
  }

  const evaluatedSampleIds = new Set(stabilityResults.map((item) => item.sampleId));
  for (const sample of samples) {
    if (evaluatedSampleIds.has(sample.sampleId)) continue;
    const sampleEvaluations = evaluations.filter((item) => item.sampleId === sample.sampleId);
    if (sampleEvaluations.length > 0) {
      stabilityResults.push(evaluateDiagnosisSampleStability(sampleEvaluations));
    }
  }

  const createdAt = new Date().toISOString();
  const promptLabel = promptVersion === REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION ? 'v4' : 'v3';
  const reportId = `phase15-prompt-${promptLabel}-${reportPurpose === 'baseline' ? 'baseline' : 'manual-review'}-${createdAt.replace(/[:.]/g, '-')}`;
  const report = buildDiagnosisBatchReport({
    reportId,
    createdAt,
    dataset: PHASE15_2_DATASET_V1,
    configuration,
    runs,
    evaluations,
    stabilityResults,
    abortedReason,
  });
  const reportPaths = await writeSanitizedReport(report);
  printSafeReport(report, reportPaths);

  if (abortedReason) throw new Error(abortedReason);
}

function validateFrozenBaselineConfig(input: {
  model: string;
  promptVersion: string;
  repetitions: number;
  sampleLimit: number;
  reviewMode: boolean;
}): void {
  const issues: string[] = [];
  if (PHASE15_2_DATASET_V1.datasetVersion !== BASELINE_DATASET_VERSION) {
    issues.push(`Dataset version must be ${BASELINE_DATASET_VERSION}.`);
  }
  if (input.model !== BASELINE_MODEL) issues.push(`Model must be ${BASELINE_MODEL}.`);
  if (
    input.promptVersion !== REAL_AI_DIAGNOSIS_PROMPT_VERSION
    && input.promptVersion !== REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION
  ) {
    issues.push(`Prompt version must be ${REAL_AI_DIAGNOSIS_PROMPT_VERSION} or ${REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION}.`);
  }
  if (DIAGNOSIS_REPAIR_POLICY_VERSION !== 'diagnosis_repair_policy_v1') {
    issues.push('Repair policy version changed.');
  }
  if (input.repetitions !== BASELINE_REPETITIONS) {
    issues.push(`Baseline repetitions must be ${BASELINE_REPETITIONS}.`);
  }
  if (!input.reviewMode && input.sampleLimit !== PHASE15_2_DATASET_V1.samples.length) {
    issues.push(`Baseline sample limit must be ${PHASE15_2_DATASET_V1.samples.length}.`);
  }
  if (issues.length > 0) throw new Error(`Frozen baseline configuration mismatch: ${issues.join(' | ')}`);
}

function printFrozenConfiguration(
  config: DiagnosisBatchReport['configuration'],
  plannedLogicalRuns: number,
  plannedProviderCalls: number,
): void {
  console.log('Phase 15.2 Frozen Shadow Batch Configuration');
  console.log('='.repeat(72));
  console.log(`Dataset: ${config.datasetId} / ${config.datasetVersion} / ${config.datasetFrozenAt}`);
  console.log(`Provider / Model: ${config.provider} / ${config.model}`);
  console.log(`Prompt / Repair: ${config.promptVersion} / ${config.repairPolicyVersion}`);
  console.log(`Temperature / Attempts / Timeout: ${config.temperature} / ${config.maxAttempts} / ${config.timeoutMs}ms`);
  console.log(`Mode: ${config.executionMode}`);
  console.log(`Report purpose: ${config.reportPurpose}`);
  console.log(`Logical runs / Provider calls: ${plannedLogicalRuns} / ${plannedProviderCalls}`);
  console.log(`Budget: calls<=${config.maxProviderCalls}, tokens<=${config.maxTotalTokens}, failedRuns<${config.maxProviderFailedRuns}`);
}

function printSafeReport(report: DiagnosisBatchReport, reportPaths: string[]): void {
  const metrics = report.metricDetails;
  console.log('\nPhase 15.2 Real Diagnosis Shadow Batch Report');
  console.log('='.repeat(72));
  console.log(`Logical runs: ${report.runSummary.completedLogicalRuns}/${report.runSummary.plannedLogicalRuns}`);
  console.log(`Provider completed/failed: ${report.runSummary.completedProviderCalls}/${report.runSummary.providerFailedRuns}`);
  console.log(`Provider availability: ${formatMetric(metrics.providerAvailability)}`);
  console.log(`Raw schema valid: ${formatMetric(metrics.rawSchemaValidity)}`);
  console.log(`Formal candidate schema valid: ${formatMetric(metrics.formalCandidateSchemaValidity)}`);
  console.log(`Main ability accuracy: ${formatMetric(metrics.mainAbilityAccuracy)}`);
  console.log(`Answer status accuracy: ${formatMetric(metrics.answerStatusAccuracy)}`);
  console.log(`Root cause acceptability: ${formatMetric(metrics.rootCauseAcceptability)}`);
  console.log(`Student quote fidelity: ${formatMetric(metrics.studentQuoteFidelity)}`);
  console.log(`Text evidence fidelity: ${formatMetric(metrics.textEvidenceFidelity)}`);
  console.log(`Semantic stability: ${formatMetric(metrics.semanticStability)}`);
  console.log(`Tokens input/output/total: ${report.providerSummary.totalInputTokens}/${report.providerSummary.totalOutputTokens}/${report.providerSummary.totalTokens}`);
  console.log(`Average latency: ${report.providerSummary.averageLatencyMs.toFixed(0)}ms`);
  console.log(`Retries: ${report.providerSummary.retryCount}`);
  console.log(`Manual review samples: ${report.manualReviewSampleIds.length}`);
  console.log(`Accepted audit samples: ${report.acceptedAuditSampleIds.length}`);
  console.log(`Automatic baseline decision: ${report.baselineDecision}`);
  console.log(`Reports: ${reportPaths.join(', ')}`);
  console.log('Safety: shadow=true, evidenceCreated=false, profileUpdated=false, secret/prompt/rawOutput logged=false.');
}

async function writeSanitizedReport(report: DiagnosisBatchReport): Promise<string[]> {
  const outputDirectory = path.resolve(
    process.env.PHASE15_BATCH_REPORT_DIR || 'docs/education/phase/reports/phase15_2',
  );
  await mkdir(outputDirectory, { recursive: true });
  const baseName = report.reportId;
  const jsonPath = path.join(outputDirectory, `${baseName}.json`);
  const markdownPath = path.join(outputDirectory, `${baseName}.md`);
  await writeExclusive(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeExclusive(markdownPath, renderMarkdownReport(report));
  return [jsonPath, markdownPath];
}

async function writeExclusive(filePath: string, content: string): Promise<void> {
  const handle = await open(filePath, 'wx');
  try {
    await handle.writeFile(content, 'utf8');
  } finally {
    await handle.close();
  }
}

function renderMarkdownReport(report: DiagnosisBatchReport): string {
  const metricRows = Object.entries(report.metricDetails)
    .map(([name, value]) => `| ${name} | ${value.numerator} | ${value.denominator} | ${value.excludedCount} | ${(value.rate * 100).toFixed(1)}% |`)
    .join('\n');
  const priorityRows = report.runs
    .filter((run) => ['unacceptable', 'critical_violation'].includes(run.qualityLevel))
    .map((run) => `| ${run.sampleId}#${run.runIndex} | ${run.qualityLevel} | ${run.failedDimensions.join(', ') || 'none'} | ${run.violations.join('; ') || 'none'} |`)
    .join('\n');
  return `# Phase 15.2 Prompt v3 ${report.configuration.reportPurpose === 'baseline' ? 'Baseline Report' : 'Manual Review Packet'}\n\n` +
    `Status: AUTOMATED SHADOW BATCH COMPLETE / HUMAN REVIEW PENDING\n\n` +
    `## Configuration\n\n` +
    `- Dataset: ${report.configuration.datasetId} / ${report.configuration.datasetVersion}\n` +
    `- Provider / Model: ${report.configuration.provider} / ${report.configuration.model}\n` +
    `- Prompt / Repair: ${report.configuration.promptVersion} / ${report.configuration.repairPolicyVersion}\n` +
    `- Temperature: ${report.configuration.temperature}\n` +
    `- Execution Mode: shadow\n` +
    `- Report Purpose: ${report.configuration.reportPurpose}\n` +
    `- Repetitions: ${report.configuration.repetitions}\n\n` +
    `## Run Summary\n\n` +
    `- Planned / completed logical runs: ${report.runSummary.plannedLogicalRuns} / ${report.runSummary.completedLogicalRuns}\n` +
    `- Planned / completed Provider calls: ${report.runSummary.plannedProviderCalls} / ${report.runSummary.completedProviderCalls}\n` +
    `- Provider failed runs: ${report.runSummary.providerFailedRuns}\n` +
    `- Accepted / questionable / unacceptable / critical: ${report.runSummary.qualityAcceptedRuns} / ${report.runSummary.qualityQuestionableRuns} / ${report.runSummary.qualityUnacceptableRuns} / ${report.runSummary.qualityCriticalRuns}\n\n` +
    `## Metrics\n\n` +
    `| Metric | Numerator | Denominator | Excluded | Rate |\n| --- | ---: | ---: | ---: | ---: |\n${metricRows}\n\n` +
    `## Provider\n\n` +
    `- Input / output / total tokens: ${report.providerSummary.totalInputTokens} / ${report.providerSummary.totalOutputTokens} / ${report.providerSummary.totalTokens}\n` +
    `- Average latency: ${report.providerSummary.averageLatencyMs.toFixed(0)} ms\n` +
    `- Retry count: ${report.providerSummary.retryCount}\n` +
    `- Error categories: ${JSON.stringify(report.providerSummary.errorCategoryCounts)}\n\n` +
    `## Review Queue\n\n` +
    `- Priority review: ${report.manualReviewSampleIds.join(', ') || 'none'}\n` +
    `- Accepted audit sample: ${report.acceptedAuditSampleIds.join(', ') || 'none'}\n` +
    `- Human review conclusion: PENDING\n\n` +
    `### Priority Run Reasons\n\n` +
    `| Run | Quality | Failed dimensions | Violations |\n| --- | --- | --- | --- |\n${priorityRows || '| none | none | none | none |'}\n\n` +
    `## Safety\n\n` +
    `- Evidence created: false\n- Profile updated: false\n- Secret, full Prompt, Raw Output stored in this report: false\n\n` +
    `Automatic baseline decision: ${report.baselineDecision}\n`;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Expected a positive integer, received: ${value}.`);
  return parsed;
}

function parseSampleIds(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function selectReviewSamples(sampleIds: string[]) {
  const byId = new Map(PHASE15_2_DATASET_V1.samples.map((sample) => [sample.sampleId, sample]));
  const missing = sampleIds.filter((sampleId) => !byId.has(sampleId));
  if (missing.length > 0) throw new Error(`Unknown review sample IDs: ${missing.join(', ')}.`);
  return sampleIds.map((sampleId) => byId.get(sampleId)!);
}

function formatMetric(value: DiagnosisBatchReport['metricDetails'][string]): string {
  return `${value.numerator}/${value.denominator} (${(value.rate * 100).toFixed(1)}%), excluded=${value.excludedCount}`;
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

runRealDiagnosisEvaluationBatch().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
