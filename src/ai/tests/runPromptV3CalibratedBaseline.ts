import { mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildDiagnosisCalibrationReport } from '../agents/diagnosisCalibrationReportAgent.ts';
import {
  evaluateDiagnosisQualityPolicyV2Legacy,
  evaluateDiagnosisStabilityV2,
} from '../agents/diagnosisQualityEvaluationV2Agent.ts';
import { PHASE15_2_ANNOTATION_V2 } from '../evaluation/phase15_2_annotation_v2.ts';
import { PHASE15_2_DATASET_V1 } from '../evaluation/phase15_2_dataset_v1.ts';
import type {
  DiagnosisBatchReport,
  DiagnosisBatchRunSummary,
} from '../schemas/diagnosisQualityEvaluation.schema.ts';
import type {
  DiagnosisCalibrationReport,
  DiagnosisQualityEvaluationV2,
  MetricCount,
} from '../schemas/diagnosisQualityPolicyV2.schema.ts';

const SOURCE_ENV = 'PHASE15_CALIBRATION_SOURCE_REPORT';
const OUTPUT_DIRECTORY = 'docs/education/phase/reports/phase15_2';

type FrozenConfig = {
  datasetVersion: string;
  provider: string;
  model: string;
  promptVersion: string;
  temperature: number;
  maxOutputTokens: number;
  maxAttempts: number;
  timeoutMs: number;
  repairPolicyVersion: string;
  executionMode: 'shadow';
  repetitions: number;
  sampleLimit: number;
  plannedLogicalRuns: number;
  plannedProviderCalls: number;
};

const BASE_FROZEN_CONFIG = {
  datasetVersion: '1.0.0',
  provider: 'deepseek_chat',
  model: 'deepseek-v4-flash',
  temperature: 0.2,
  maxOutputTokens: 1600,
  maxAttempts: 2,
  timeoutMs: 30_000,
  repairPolicyVersion: 'diagnosis_repair_policy_v1',
  executionMode: 'shadow',
  repetitions: 3,
  sampleLimit: 36,
  plannedLogicalRuns: 108,
  plannedProviderCalls: 93,
} as const;

const FROZEN_CONFIGS: Record<string, FrozenConfig> = {
  real_ai_diagnosis_prompt_v3: {
    ...BASE_FROZEN_CONFIG,
    promptVersion: 'real_ai_diagnosis_prompt_v3',
  },
  real_ai_diagnosis_prompt_v4: {
    ...BASE_FROZEN_CONFIG,
    promptVersion: 'real_ai_diagnosis_prompt_v4',
  },
};

// These thresholds are intentionally fixed before the live calibrated run.
const FROZEN_THRESHOLDS = {
  providerAvailability: 1,
  formalCandidateSchemaValidity: 1,
  invalidResponseSafety: 1,
  mainAbility: 0.9,
  answerStatus: 0.85,
  rootCauseCategory: 0.8,
  reasonableAlternativeAcceptance: 0.75,
  conciseValidAcceptance: 0.75,
  boundaryStability: 0.85,
  criticalModelViolationCount: 0,
} as const;

type ThresholdCheck = {
  name: keyof typeof FROZEN_THRESHOLDS;
  actual: number;
  required: number;
  passed: boolean;
};

type PromptV3CalibratedBaselineReport = {
  schemaVersion: 'prompt_v3_calibrated_baseline_v1';
  reportId: string;
  createdAt: string;
  sourceReportId: string;
  status: 'meets_automatic_thresholds' | 'requires_human_review' | 'blocked_by_critical_violation';
  configuration: FrozenConfig;
  thresholds: typeof FROZEN_THRESHOLDS;
  thresholdChecks: ThresholdCheck[];
  providerLayer: {
    availability: DiagnosisBatchReport['metricDetails'][string];
    rawSchemaValidity: DiagnosisBatchReport['metricDetails'][string];
    formalCandidateSchemaValidity: DiagnosisBatchReport['metricDetails'][string];
    completedCalls: number;
    failedCalls: number;
    totalTokens: number;
    averageLatencyMs: number;
    retryCount: number;
  };
  validityLayer: {
    invalidResponseSafety: DiagnosisBatchReport['metricDetails'][string];
    blockedRuns: number;
    evidenceCreated: false;
    profileUpdated: false;
  };
  modelQualityLayer: DiagnosisCalibrationReport['modelQuality'] & {
    boundaryStability: MetricCount;
    criticalModelViolationCount: number;
  };
  evaluatorQualityLayer: DiagnosisCalibrationReport['evaluatorQuality'];
  qualityCounts: DiagnosisCalibrationReport['qualityCounts'];
  boundaryStabilityCounts: DiagnosisCalibrationReport['boundaryStabilityCounts'];
  qualityStabilityCounts: DiagnosisCalibrationReport['qualityStabilityCounts'];
  evaluations: DiagnosisQualityEvaluationV2[];
  stability: DiagnosisCalibrationReport['stability'];
  runs: DiagnosisBatchRunSummary[];
  safety: DiagnosisBatchReport['safety'];
  manualReviewRequired: true;
  limitations: string[];
};

async function run(): Promise<void> {
  const sourcePath = process.env[SOURCE_ENV];
  if (!sourcePath) throw new Error(`${SOURCE_ENV} is required.`);
  const source = JSON.parse(await readFile(path.resolve(sourcePath), 'utf8')) as DiagnosisBatchReport;
  const frozenConfig = FROZEN_CONFIGS[source.configuration.promptVersion];
  if (!frozenConfig) throw new Error(`Unsupported calibrated Prompt version: ${source.configuration.promptVersion}.`);
  validateSource(source, frozenConfig);

  const sampleById = new Map(PHASE15_2_DATASET_V1.samples.map((sample) => [sample.sampleId, sample]));
  const annotationById = new Map(PHASE15_2_ANNOTATION_V2.annotations.map((item) => [item.sampleId, item]));
  const evaluations: DiagnosisQualityEvaluationV2[] = [];

  for (const sourceRun of source.runs) {
    if (!sourceRun.candidateSnapshot) continue;
    const sample = sampleById.get(sourceRun.sampleId);
    const annotation = annotationById.get(sourceRun.sampleId);
    if (!sample || !annotation) throw new Error(`Missing sample or annotation for ${sourceRun.sampleId}.`);
    evaluations.push(evaluateDiagnosisQualityPolicyV2Legacy({
      datasetVersion: source.configuration.datasetVersion,
      annotationVersion: PHASE15_2_ANNOTATION_V2.annotationVersion,
      sampleId: sourceRun.sampleId,
      runId: `${sourceRun.sampleId}#${sourceRun.runIndex}`,
      studentAnswer: sample.taskExecutionResult.studentResponse?.answerText || '',
      readingText: sample.concreteTask.readingText,
      question: sample.concreteTask.question,
      referenceAnswer: sample.concreteTask.referenceAnswer,
      rubricTerms: [
        ...sample.concreteTask.scoringPoints,
        ...sample.concreteTask.rubric.map((item) => item.name),
      ],
      candidate: sourceRun.candidateSnapshot,
      annotation,
      previousPolicyResult: {
        qualityLevel: sourceRun.qualityLevel,
        failedDimensions: sourceRun.failedDimensions,
        violations: sourceRun.violations,
      },
      evaluatedAt: new Date().toISOString(),
    }));
  }

  const grouped = groupBySample(evaluations);
  const stability = [...grouped.values()].map(evaluateDiagnosisStabilityV2);
  const categoryBySampleId = new Map(
    PHASE15_2_DATASET_V1.samples.map((sample) => [sample.sampleId, sample.category]),
  );
  const createdAt = new Date().toISOString();
  const promptLabel = source.configuration.promptVersion.endsWith('_v4') ? 'v4' : 'v3';
  const reportId = `phase15-prompt-${promptLabel}-calibrated-baseline-${createdAt.replace(/[:.]/g, '-')}`;
  const calibration = buildDiagnosisCalibrationReport({
    reportId: `${reportId}-policy-v2`,
    createdAt,
    sourceReportId: source.reportId,
    datasetVersion: source.configuration.datasetVersion,
    annotationVersion: PHASE15_2_ANNOTATION_V2.annotationVersion,
    promptVersion: source.configuration.promptVersion,
    provider: source.configuration.provider,
    model: source.configuration.model,
    evaluations,
    stability,
    categoryBySampleId,
    policyVersion: 'diagnosis_quality_policy_v2',
  });
  const boundaryStability = metric(
    stability.filter((item) => item.boundaryStability !== 'insufficient_runs'),
    (item) => item.boundaryStability === 'stable_within_boundary',
  );
  const criticalModelViolationCount = evaluations.filter((item) =>
    item.qualityLevel === 'critical_violation' &&
    item.reviewFindings.some((finding) => finding.attribution === 'confirmed_model_issue')
  ).length;
  const checks = buildThresholdChecks(source, calibration, boundaryStability, criticalModelViolationCount);
  const status = criticalModelViolationCount > 0
    ? 'blocked_by_critical_violation'
    : checks.every((item) => item.passed)
      ? 'meets_automatic_thresholds'
      : 'requires_human_review';

  const report: PromptV3CalibratedBaselineReport = {
    schemaVersion: 'prompt_v3_calibrated_baseline_v1',
    reportId,
    createdAt,
    sourceReportId: source.reportId,
    status,
    configuration: frozenConfig,
    thresholds: FROZEN_THRESHOLDS,
    thresholdChecks: checks,
    providerLayer: {
      availability: source.metricDetails.providerAvailability,
      rawSchemaValidity: source.metricDetails.rawSchemaValidity,
      formalCandidateSchemaValidity: source.metricDetails.formalCandidateSchemaValidity,
      completedCalls: source.runSummary.completedProviderCalls,
      failedCalls: source.runSummary.providerFailedRuns,
      totalTokens: source.providerSummary.totalTokens,
      averageLatencyMs: source.providerSummary.averageLatencyMs,
      retryCount: source.providerSummary.retryCount,
    },
    validityLayer: {
      invalidResponseSafety: source.metricDetails.invalidResponseSafety,
      blockedRuns: source.runSummary.validityBlockedRuns,
      evidenceCreated: false,
      profileUpdated: false,
    },
    modelQualityLayer: {
      ...calibration.modelQuality,
      boundaryStability,
      criticalModelViolationCount,
    },
    evaluatorQualityLayer: calibration.evaluatorQuality,
    qualityCounts: calibration.qualityCounts,
    boundaryStabilityCounts: calibration.boundaryStabilityCounts,
    qualityStabilityCounts: calibration.qualityStabilityCounts,
    evaluations,
    stability,
    runs: source.runs,
    safety: source.safety,
    manualReviewRequired: true,
    limitations: [
      'Dataset v1 is an engineering and educational-boundary baseline, not a representative product-quality dataset.',
      'Automatic threshold success does not freeze Phase 15.2; questionable, unacceptable, critical and sampled accepted runs still require human review.',
      'Candidate snapshots are structured and deidentified; API keys, full prompts and raw provider outputs are not stored.',
    ],
  };

  const outputPaths = await writeReport(report);
  printSummary(report, outputPaths);
}

function validateSource(source: DiagnosisBatchReport, frozenConfig: FrozenConfig): void {
  const issues: string[] = [];
  const config = source.configuration;
  if (config.reportPurpose !== 'baseline') issues.push('Source reportPurpose must be baseline.');
  for (const [key, expected] of Object.entries(frozenConfig)) {
    if (key.startsWith('planned')) continue;
    const actual = config[key as keyof typeof config];
    if (actual !== expected) issues.push(`${key} must be ${expected}, received ${String(actual)}.`);
  }
  if (source.runSummary.plannedLogicalRuns !== frozenConfig.plannedLogicalRuns) {
    issues.push(`plannedLogicalRuns must be ${frozenConfig.plannedLogicalRuns}.`);
  }
  if (source.runSummary.plannedProviderCalls !== frozenConfig.plannedProviderCalls) {
    issues.push(`plannedProviderCalls must be ${frozenConfig.plannedProviderCalls}.`);
  }
  if (source.runSummary.completedLogicalRuns !== frozenConfig.plannedLogicalRuns) {
    issues.push('Full logical run set was not completed.');
  }
  if (source.runs.length !== frozenConfig.plannedLogicalRuns) {
    issues.push('Run snapshots are incomplete.');
  }
  if (source.safety.executionMode !== 'shadow' || source.safety.evidenceCreated || source.safety.profileUpdated) {
    issues.push('Source report violates shadow safety requirements.');
  }
  if (source.safety.secretLogged || source.safety.fullPromptLogged || source.safety.rawOutputLogged) {
    issues.push('Source report indicates unsafe logging.');
  }
  if (issues.length > 0) throw new Error(`Calibrated baseline source rejected: ${issues.join(' | ')}`);
}

function buildThresholdChecks(
  source: DiagnosisBatchReport,
  calibration: DiagnosisCalibrationReport,
  boundaryStability: MetricCount,
  criticalModelViolationCount: number,
): ThresholdCheck[] {
  const actuals: Record<keyof typeof FROZEN_THRESHOLDS, number> = {
    providerAvailability: source.metricDetails.providerAvailability.rate,
    formalCandidateSchemaValidity: source.metricDetails.formalCandidateSchemaValidity.rate,
    invalidResponseSafety: source.metricDetails.invalidResponseSafety.rate,
    mainAbility: calibration.modelQuality.mainAbility.rate,
    answerStatus: calibration.modelQuality.answerStatus.rate,
    rootCauseCategory: calibration.modelQuality.rootCauseCategory.rate,
    reasonableAlternativeAcceptance: calibration.modelQuality.reasonableAlternativeAcceptance.rate,
    conciseValidAcceptance: calibration.modelQuality.conciseValidAcceptance.rate,
    boundaryStability: boundaryStability.rate,
    criticalModelViolationCount,
  };
  return (Object.keys(FROZEN_THRESHOLDS) as Array<keyof typeof FROZEN_THRESHOLDS>).map((name) => {
    const required = FROZEN_THRESHOLDS[name];
    const actual = actuals[name];
    return {
      name,
      actual,
      required,
      passed: name === 'criticalModelViolationCount' ? actual === required : actual >= required,
    };
  });
}

function groupBySample(
  evaluations: DiagnosisQualityEvaluationV2[],
): Map<string, DiagnosisQualityEvaluationV2[]> {
  const groups = new Map<string, DiagnosisQualityEvaluationV2[]>();
  for (const evaluation of evaluations) {
    const group = groups.get(evaluation.sampleId) || [];
    group.push(evaluation);
    groups.set(evaluation.sampleId, group);
  }
  return groups;
}

function metric<T>(items: T[], predicate: (item: T) => boolean): MetricCount {
  const numerator = items.filter(predicate).length;
  return {
    numerator,
    denominator: items.length,
    rate: items.length === 0 ? 0 : numerator / items.length,
  };
}

async function writeReport(report: PromptV3CalibratedBaselineReport): Promise<string[]> {
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

function renderMarkdown(report: PromptV3CalibratedBaselineReport): string {
  const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
  const thresholdRows = report.thresholdChecks.map((item) =>
    `| ${item.name} | ${item.name === 'criticalModelViolationCount' ? item.actual : percent(item.actual)} | ${item.name === 'criticalModelViolationCount' ? item.required : percent(item.required)} | ${item.passed ? 'PASS' : 'FAIL'} |`
  ).join('\n');
  const priorityRuns = report.evaluations
    .filter((item) => item.qualityLevel !== 'accepted')
    .map((item) => `| \`${item.runId}\` | ${item.qualityLevel} | ${item.reviewFindings.map((finding) => finding.attribution).join(', ') || 'none'} |`)
    .join('\n');
  return `# Phase 15.2 ${report.configuration.promptVersion} Calibrated Baseline\n\n` +
    `状态：${report.status}\n\n` +
    `## 一、固定配置\n\n` +
    `- Dataset：\`${report.configuration.datasetVersion}\`\n` +
    `- Provider / Model：\`${report.configuration.provider} / ${report.configuration.model}\`\n` +
    `- Prompt：\`${report.configuration.promptVersion}\`\n` +
    `- Temperature：${report.configuration.temperature}\n` +
    `- 执行模式：shadow\n` +
    `- 逻辑 Run / Provider 调用：${report.configuration.plannedLogicalRuns} / ${report.configuration.plannedProviderCalls}\n` +
    `- 来源报告：\`${report.sourceReportId}\`\n\n` +
    `## 二、预注册门槛\n\n` +
    `| 指标 | 实际 | 门槛 | 结果 |\n|---|---:|---:|---|\n${thresholdRows}\n\n` +
    `## 三、Provider 层\n\n` +
    `- 调用完成 / 失败：${report.providerLayer.completedCalls} / ${report.providerLayer.failedCalls}\n` +
    `- Provider 可用率：${percent(report.providerLayer.availability.rate)}\n` +
    `- Raw Schema 合法率：${percent(report.providerLayer.rawSchemaValidity.rate)}\n` +
    `- Formal Candidate Schema 合法率：${percent(report.providerLayer.formalCandidateSchemaValidity.rate)}\n` +
    `- Token 总量：${report.providerLayer.totalTokens}\n` +
    `- 平均延迟：${report.providerLayer.averageLatencyMs.toFixed(0)}ms\n` +
    `- Retry：${report.providerLayer.retryCount}\n\n` +
    `## 四、模型质量层\n\n` +
    `- Main Ability：${formatMetric(report.modelQualityLayer.mainAbility)}\n` +
    `- Answer Status：${formatMetric(report.modelQualityLayer.answerStatus)}\n` +
    `- Root Cause Category：${formatMetric(report.modelQualityLayer.rootCauseCategory)}\n` +
    `- Reasonable Alternative Acceptance：${formatMetric(report.modelQualityLayer.reasonableAlternativeAcceptance)}\n` +
    `- Concise Valid Acceptance：${formatMetric(report.modelQualityLayer.conciseValidAcceptance)}\n` +
    `- Boundary Stability：${formatMetric(report.modelQualityLayer.boundaryStability)}\n` +
    `- Critical Model Violation：${report.modelQualityLayer.criticalModelViolationCount}\n` +
    `- 质量分布：\`${JSON.stringify(report.qualityCounts)}\`\n\n` +
    `## 五、评估器质量层\n\n` +
    `- Evaluator False Positive Finding：${report.evaluatorQualityLayer.falsePositiveFindingCount}\n` +
    `- Confirmed Model Issue Finding：${report.evaluatorQualityLayer.confirmedModelIssueFindingCount}\n` +
    `- Mixed Issue Run：${report.evaluatorQualityLayer.mixedIssueRunCount}\n` +
    `- Human Review Run：${report.evaluatorQualityLayer.humanReviewRunCount}\n\n` +
    `## 六、安全结果\n\n` +
    `- Validity Gate 阻断：${report.validityLayer.blockedRuns}\n` +
    `- 无效作答安全率：${percent(report.validityLayer.invalidResponseSafety.rate)}\n` +
    `- Evidence created：false\n` +
    `- Profile updated：false\n` +
    `- API Key、完整 Prompt、Raw Output 写入报告：false\n\n` +
    `## 七、优先人工复核\n\n` +
    `| Run | Policy v2 质量 | 归因 |\n|---|---|---|\n${priorityRuns || '| none | none | none |'}\n\n` +
    `## 八、结论边界\n\n` +
    report.limitations.map((item) => `- ${item}`).join('\n') + '\n';
}

function formatMetric(metricValue: MetricCount): string {
  return `${metricValue.numerator}/${metricValue.denominator} (${(metricValue.rate * 100).toFixed(1)}%)`;
}

function printSummary(report: PromptV3CalibratedBaselineReport, paths: string[]): void {
  console.log(`\nPhase 15.2 ${report.configuration.promptVersion} Calibrated Baseline`);
  console.log('='.repeat(76));
  for (const check of report.thresholdChecks) {
    console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}: actual=${check.actual}, required=${check.required}`);
  }
  console.log(`Decision: ${report.status}`);
  console.log(`Provider calls: ${report.providerLayer.completedCalls}, tokens: ${report.providerLayer.totalTokens}`);
  console.log(`Human review required: ${report.manualReviewRequired}`);
  console.log(`Reports: ${paths.join(', ')}`);
  console.log('Safety: shadow=true, evidenceCreated=false, profileUpdated=false, secrets/full prompt/raw output stored=false.');
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
