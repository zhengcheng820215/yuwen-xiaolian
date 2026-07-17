import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import {
  createDiagnosisProviderConfigSnapshot,
  runRealLLMRuntimeFoundation,
} from '../agents/realLLMRuntimeFoundationAgent.ts';
import { evaluateDiagnosisQualityV2 } from '../agents/diagnosisQualityEvaluationV2Agent.ts';
import { PHASE15_2_ANNOTATION_V2 } from '../evaluation/phase15_2_annotation_v2.ts';
import { PHASE15_2_DATASET_V1 } from '../evaluation/phase15_2_dataset_v1.ts';
import { REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION } from '../prompts/buildRealAIDiagnosisPromptV4.ts';
import { DeepSeekChatDiagnosisProvider } from '../providers/diagnosisProviderAdapter.ts';
import { InMemoryFormalDiagnosisRepository } from '../repositories/inMemoryFormalDiagnosisRepository.ts';
import type { DiagnosisCandidateSnapshot, DiagnosisQualityEvaluationV2 } from '../schemas/diagnosisQualityPolicyV2.schema.ts';

const ENABLE_FLAG = 'REAL_DIAGNOSIS_PROMPT_V4_SLICE_BATCH';
const MODEL = 'deepseek-v4-flash';
const TEMPERATURE = 0.2;
const MAX_OUTPUT_TOKENS = 1600;
const MAX_ATTEMPTS = 2;
const TIMEOUT_MS = 30_000;
const REPETITIONS = 3;
const OUTPUT_DIRECTORY = 'docs/education/phase/reports/phase15_2';

const SLICES = {
  reasonable_alternative: ['phase15-v1-23', 'phase15-v1-24', 'phase15-v1-25', 'phase15-v1-26'],
  concise_valid: ['phase15-v1-20', 'phase15-v1-21', 'phase15-v1-22'],
  core_conclusion_error: ['phase15-v1-13', 'phase15-v1-14', 'phase15-v1-15'],
} as const;

const THRESHOLDS = {
  providerAvailability: 1,
  formalCandidateRate: 1,
  mainAbilityRate: 1,
  reasonableAlternativeAcceptedRuns: 9,
  conciseValidAcceptedRuns: 7,
  coreConclusionCorrectRejections: 9,
  criticalModelViolationCount: 0,
} as const;

type SliceName = keyof typeof SLICES;
type SliceRun = {
  runId: string;
  sampleId: string;
  slice: SliceName;
  runIndex: number;
  outcome: 'provider_completed' | 'provider_failed';
  runtimeStatus?: string;
  attemptCount: number;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  latencyMs: number;
  candidate?: DiagnosisCandidateSnapshot;
  quality?: DiagnosisQualityEvaluationV2;
};

type Metric = { numerator: number; denominator: number; rate: number };
type Check = { name: keyof typeof THRESHOLDS; actual: number; required: number; passed: boolean };

type PromptV4SliceReport = {
  schemaVersion: 'prompt_v4_slice_report_v1';
  reportId: string;
  createdAt: string;
  status: 'slice_thresholds_met' | 'requires_revision' | 'blocked_by_critical_violation';
  configuration: {
    datasetVersion: '1.0.0';
    provider: 'deepseek_chat';
    model: typeof MODEL;
    promptVersion: typeof REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION;
    temperature: typeof TEMPERATURE;
    maxOutputTokens: typeof MAX_OUTPUT_TOKENS;
    maxAttempts: typeof MAX_ATTEMPTS;
    timeoutMs: typeof TIMEOUT_MS;
    repetitions: typeof REPETITIONS;
    executionMode: 'shadow';
    plannedProviderCalls: 30;
  };
  thresholds: typeof THRESHOLDS;
  checks: Check[];
  metrics: {
    providerAvailability: Metric;
    formalCandidateRate: Metric;
    mainAbilityRate: Metric;
    reasonableAlternativeAcceptance: Metric;
    conciseValidAcceptance: Metric;
    coreConclusionCorrectRejection: Metric;
    criticalModelViolationCount: number;
  };
  v3Comparison: {
    sourceReportId: 'phase15-prompt-v3-calibrated-baseline-2026-07-17T09-24-49-896Z';
    reasonableAlternativeAcceptance: Metric;
    conciseValidAcceptance: Metric;
    coreConclusionCorrectRejection: Metric;
  };
  qualityCounts: Record<'accepted' | 'questionable' | 'unacceptable' | 'critical_violation', number>;
  runs: SliceRun[];
  safety: {
    executionMode: 'shadow';
    diagnosisCommitted: false;
    evidenceCreated: false;
    profileUpdated: false;
    secretLogged: false;
    fullPromptLogged: false;
    rawOutputLogged: false;
  };
  manualReviewRequired: true;
};

async function run(): Promise<void> {
  if (process.env[ENABLE_FLAG] !== 'true') {
    console.log(`Prompt v4 Slice Batch SKIPPED: set ${ENABLE_FLAG}=true to run.`);
    return;
  }
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is required.');
  validateFixtures();

  const provider = new DeepSeekChatDiagnosisProvider({ apiKey });
  const config = createDiagnosisProviderConfigSnapshot({
    provider: provider.providerName,
    model: MODEL,
    providerConfigId: 'phase15-prompt-v4-slice-deepseek-v4-flash',
    temperature: TEMPERATURE,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxAttempts: MAX_ATTEMPTS,
    timeoutMs: TIMEOUT_MS,
    promptVersion: REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION,
  });
  const sampleById = new Map(PHASE15_2_DATASET_V1.samples.map((sample) => [sample.sampleId, sample]));
  const annotationById = new Map(PHASE15_2_ANNOTATION_V2.annotations.map((item) => [item.sampleId, item]));
  const repository = new InMemoryFormalDiagnosisRepository();
  const runs: SliceRun[] = [];
  const sampleIds = Object.values(SLICES).flat();

  console.log('Phase 15.2 Prompt v4 Specialty Slice Shadow Batch');
  console.log('='.repeat(78));
  console.log(`Dataset / Model / Prompt: 1.0.0 / ${MODEL} / ${REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION}`);
  console.log('Slices: reasonable_alternative=12, concise_valid=9, core_conclusion_error=9');
  console.log('Safety: shadow only; no commit, Evidence, Profile, raw output or secret logging.');

  for (const sampleId of sampleIds) {
    const sample = sampleById.get(sampleId)!;
    const annotation = annotationById.get(sampleId)!;
    const slice = resolveSlice(sampleId);
    for (let runIndex = 1; runIndex <= REPETITIONS; runIndex += 1) {
      const runId = `${sampleId}#${runIndex}`;
      const runtime = await runRealLLMRuntimeFoundation({
        concreteTask: sample.concreteTask,
        taskExecutionResult: sample.taskExecutionResult,
        executionMode: 'shadow',
        requestId: `phase15-prompt-v4-slice-${sampleId}-${runIndex}`,
        providerConfig: config,
        commitOnSuccess: false,
      }, { provider, formalDiagnosisRepository: repository });
      const candidate = runtime.diagnosisCandidate
        ? {
          mainAbility: runtime.diagnosisCandidate.mainAbility,
          answerStatus: runtime.diagnosisCandidate.answerStatus,
          rootCause: runtime.diagnosisCandidate.rootCause,
          surfaceError: runtime.diagnosisCandidate.surfaceError,
          abilityEvidence: runtime.diagnosisCandidate.abilityEvidence,
          diagnosisSummary: runtime.diagnosisCandidate.diagnosisSummary,
        }
        : undefined;
      const quality = candidate
        ? evaluateDiagnosisQualityV2({
          datasetVersion: PHASE15_2_DATASET_V1.datasetVersion,
          annotationVersion: PHASE15_2_ANNOTATION_V2.annotationVersion,
          sampleId,
          runId,
          studentAnswer: sample.taskExecutionResult.studentResponse?.answerText || '',
          readingText: sample.concreteTask.readingText,
          question: sample.concreteTask.question,
          referenceAnswer: sample.concreteTask.referenceAnswer,
          rubricTerms: [...sample.concreteTask.scoringPoints, ...sample.concreteTask.rubric.map((item) => item.name)],
          candidate,
          annotation,
          evaluatedAt: new Date().toISOString(),
        })
        : undefined;
      const tokenUsage = runtime.runRecord.tokenUsage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      runs.push({
        runId,
        sampleId,
        slice,
        runIndex,
        outcome: runtime.runRecord.rawOutputRef ? 'provider_completed' : 'provider_failed',
        runtimeStatus: runtime.status,
        attemptCount: runtime.runRecord.attemptCount,
        tokenUsage,
        latencyMs: runtime.runRecord.latencyMs || 0,
        candidate,
        quality,
      });
      console.log(`${runs.length}/30 ${runId}: ${runtime.status} / ${quality?.qualityLevel || 'no_candidate'}`);
    }
  }

  const report = buildReport(runs);
  const paths = await writeReport(report);
  printReport(report, paths);
}

function buildReport(runs: SliceRun[]): PromptV4SliceReport {
  const completed = runs.filter((item) => item.outcome === 'provider_completed');
  const candidateRuns = runs.filter((item) => item.candidate && item.quality);
  const reasonable = candidateRuns.filter((item) => item.slice === 'reasonable_alternative');
  const concise = candidateRuns.filter((item) => item.slice === 'concise_valid');
  const core = candidateRuns.filter((item) => item.slice === 'core_conclusion_error');
  const metrics = {
    providerAvailability: metric(completed.length, runs.length),
    formalCandidateRate: metric(candidateRuns.length, runs.length),
    mainAbilityRate: metric(candidateRuns.filter((item) => item.quality!.dimensions.mainAbilityAccepted).length, candidateRuns.length),
    reasonableAlternativeAcceptance: metric(reasonable.filter((item) => item.quality!.qualityLevel === 'accepted').length, 12),
    conciseValidAcceptance: metric(concise.filter((item) => item.quality!.qualityLevel === 'accepted').length, 9),
    coreConclusionCorrectRejection: metric(core.filter((item) => item.candidate!.answerStatus === 'does_not_meet').length, 9),
    criticalModelViolationCount: candidateRuns.filter((item) => item.quality!.qualityLevel === 'critical_violation').length,
  };
  const checks = buildChecks(metrics);
  const createdAt = new Date().toISOString();
  const status = metrics.criticalModelViolationCount > 0
    ? 'blocked_by_critical_violation'
    : checks.every((item) => item.passed)
      ? 'slice_thresholds_met'
      : 'requires_revision';
  const qualities = candidateRuns.map((item) => item.quality!);
  return {
    schemaVersion: 'prompt_v4_slice_report_v1',
    reportId: `phase15-prompt-v4-slice-${createdAt.replace(/[:.]/g, '-')}`,
    createdAt,
    status,
    configuration: {
      datasetVersion: '1.0.0',
      provider: 'deepseek_chat',
      model: MODEL,
      promptVersion: REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION,
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      maxAttempts: MAX_ATTEMPTS,
      timeoutMs: TIMEOUT_MS,
      repetitions: REPETITIONS,
      executionMode: 'shadow',
      plannedProviderCalls: 30,
    },
    thresholds: THRESHOLDS,
    checks,
    metrics,
    v3Comparison: {
      sourceReportId: 'phase15-prompt-v3-calibrated-baseline-2026-07-17T09-24-49-896Z',
      reasonableAlternativeAcceptance: metric(3, 12),
      conciseValidAcceptance: metric(6, 9),
      coreConclusionCorrectRejection: metric(6, 9),
    },
    qualityCounts: {
      accepted: qualities.filter((item) => item.qualityLevel === 'accepted').length,
      questionable: qualities.filter((item) => item.qualityLevel === 'questionable').length,
      unacceptable: qualities.filter((item) => item.qualityLevel === 'unacceptable').length,
      critical_violation: qualities.filter((item) => item.qualityLevel === 'critical_violation').length,
    },
    runs,
    safety: {
      executionMode: 'shadow',
      diagnosisCommitted: false,
      evidenceCreated: false,
      profileUpdated: false,
      secretLogged: false,
      fullPromptLogged: false,
      rawOutputLogged: false,
    },
    manualReviewRequired: true,
  };
}

function buildChecks(metrics: PromptV4SliceReport['metrics']): Check[] {
  const actuals: Record<keyof typeof THRESHOLDS, number> = {
    providerAvailability: metrics.providerAvailability.rate,
    formalCandidateRate: metrics.formalCandidateRate.rate,
    mainAbilityRate: metrics.mainAbilityRate.rate,
    reasonableAlternativeAcceptedRuns: metrics.reasonableAlternativeAcceptance.numerator,
    conciseValidAcceptedRuns: metrics.conciseValidAcceptance.numerator,
    coreConclusionCorrectRejections: metrics.coreConclusionCorrectRejection.numerator,
    criticalModelViolationCount: metrics.criticalModelViolationCount,
  };
  return (Object.keys(THRESHOLDS) as Array<keyof typeof THRESHOLDS>).map((name) => ({
    name,
    actual: actuals[name],
    required: THRESHOLDS[name],
    passed: name === 'criticalModelViolationCount'
      ? actuals[name] === THRESHOLDS[name]
      : actuals[name] >= THRESHOLDS[name],
  }));
}

function validateFixtures(): void {
  const issues: string[] = [];
  if (PHASE15_2_DATASET_V1.datasetVersion !== '1.0.0') issues.push('Dataset version must remain 1.0.0.');
  const allIds = Object.values(SLICES).flat();
  if (allIds.length !== 10 || new Set(allIds).size !== 10) issues.push('Slice fixtures must contain 10 unique samples.');
  const sampleIds = new Set(PHASE15_2_DATASET_V1.samples.map((item) => item.sampleId));
  const annotationIds = new Set(PHASE15_2_ANNOTATION_V2.annotations.map((item) => item.sampleId));
  for (const sampleId of allIds) {
    if (!sampleIds.has(sampleId)) issues.push(`Missing Dataset sample ${sampleId}.`);
    if (!annotationIds.has(sampleId)) issues.push(`Missing Annotation v2 for ${sampleId}.`);
  }
  if (issues.length > 0) throw new Error(`Prompt v4 Slice fixtures invalid: ${issues.join(' | ')}`);
}

function resolveSlice(sampleId: string): SliceName {
  for (const [slice, ids] of Object.entries(SLICES) as Array<[SliceName, readonly string[]]>) {
    if (ids.includes(sampleId)) return slice;
  }
  throw new Error(`Unknown slice for ${sampleId}.`);
}

function metric(numerator: number, denominator: number): Metric {
  return { numerator, denominator, rate: denominator === 0 ? 0 : numerator / denominator };
}

async function writeReport(report: PromptV4SliceReport): Promise<string[]> {
  const directory = path.resolve(OUTPUT_DIRECTORY);
  await mkdir(directory, { recursive: true });
  const jsonPath = path.join(directory, `${report.reportId}.json`);
  const markdownPath = path.join(directory, `${report.reportId}.md`);
  await writeExclusive(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeExclusive(markdownPath, renderMarkdown(report));
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

function renderMarkdown(report: PromptV4SliceReport): string {
  const checkRows = report.checks.map((item) => `| ${item.name} | ${item.actual} | ${item.required} | ${item.passed ? 'PASS' : 'FAIL'} |`).join('\n');
  const runRows = report.runs.map((item) => `| \`${item.runId}\` | ${item.slice} | ${item.candidate?.answerStatus || 'none'} | ${item.quality?.qualityLevel || 'none'} |`).join('\n');
  return `# Phase 15.2 Prompt v4 专项 Slice 报告\n\n` +
    `状态：${report.status}\n\n` +
    `## 固定配置\n\n` +
    `- Dataset：1.0.0\n- Provider / Model：deepseek_chat / ${MODEL}\n- Prompt：${REAL_AI_DIAGNOSIS_PROMPT_V4_VERSION}\n- Temperature：${TEMPERATURE}\n- Mode：shadow\n- Provider calls：30\n\n` +
    `## 预注册门槛\n\n| 指标 | 实际 | 门槛 | 结果 |\n|---|---:|---:|---|\n${checkRows}\n\n` +
    `## v3 / v4 专项对照\n\n` +
    `| Slice | v3 | v4 |\n|---|---:|---:|\n` +
    `| Reasonable Alternative | ${formatMetric(report.v3Comparison.reasonableAlternativeAcceptance)} | ${formatMetric(report.metrics.reasonableAlternativeAcceptance)} |\n` +
    `| Concise Valid | ${formatMetric(report.v3Comparison.conciseValidAcceptance)} | ${formatMetric(report.metrics.conciseValidAcceptance)} |\n` +
    `| Core Conclusion Correct Rejection | ${formatMetric(report.v3Comparison.coreConclusionCorrectRejection)} | ${formatMetric(report.metrics.coreConclusionCorrectRejection)} |\n\n` +
    `## Run 明细\n\n| Run | Slice | Answer Status | Policy v2 Quality |\n|---|---|---|---|\n${runRows}\n\n` +
    `## 安全边界\n\n- Shadow only\n- Diagnosis committed：false\n- Evidence created：false\n- Profile updated：false\n- Key、完整 Prompt、Raw Output 写入报告：false\n- 专项通过不等于 Prompt v4 或 Phase 15.2 冻结，仍需全量 Dataset v1 × 3 回归和人工复核。\n`;
}

function printReport(report: PromptV4SliceReport, paths: string[]): void {
  console.log('\nPrompt v4 Specialty Slice Result');
  console.log('='.repeat(78));
  for (const item of report.checks) console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.name}: ${item.actual}/${item.required}`);
  console.log(`Decision: ${report.status}`);
  console.log(`Quality: ${JSON.stringify(report.qualityCounts)}`);
  console.log(`Reports: ${paths.join(', ')}`);
  console.log('Manual review remains required before full v4 baseline.');
}

function formatMetric(value: Metric): string {
  return `${value.numerator}/${value.denominator} (${(value.rate * 100).toFixed(1)}%)`;
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
