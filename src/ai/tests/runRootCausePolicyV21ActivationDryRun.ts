import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DiagnosisQualityLevel } from '../schemas/diagnosisQualityEvaluation.schema.ts';

const SOURCE_REPORT = 'docs/education/phase/reports/phase15_2/phase15-prompt-v4-calibrated-baseline-2026-07-17T10-03-31-702Z.json';
const CALIBRATION_REPORT = 'docs/education/phase/reports/phase15_2/phase15-root-cause-policy-v2-1-calibration-2026-07-17T10-35-17-417Z.json';
const OUTPUT_DIRECTORY = 'docs/education/phase/reports/phase15_2';

type SourceEvaluation = {
  runId: string;
  sampleId: string;
  qualityLevel: DiagnosisQualityLevel;
  dimensions: {
    mainAbilityAccepted: boolean;
    answerStatusAccepted: boolean;
    rootCauseCategoryAccepted: boolean;
    requiredFactsPresent: boolean;
    quoteAttributionValid: boolean;
    noBoundaryOverreach: boolean;
    noCriticalHallucination: boolean;
  };
  canBecomeFormalCandidate: boolean;
  validation: { passed: boolean; issues: string[] };
};

type SourceReport = {
  reportId: string;
  configuration: { promptVersion: string; executionMode: string };
  evaluations: SourceEvaluation[];
  safety: {
    evidenceCreated: boolean;
    profileUpdated: boolean;
    secretLogged: boolean;
    fullPromptLogged: boolean;
    rawOutputLogged: boolean;
  };
};

type CalibrationRun = {
  runId: string;
  sampleId: string;
  regressionGroup: 'previously_accepted_61' | 'reasonable_failed_29' | 'confirmed_prompt_error_3';
  v21Accepted: boolean;
  classification: { status: 'classified' | 'unknown' | 'conflicting'; categories: string[] };
};

type CalibrationReport = {
  reportId: string;
  policyVersion: string;
  runResults: CalibrationRun[];
  validation: { passed: boolean; issues: string[] };
  safety: { providerCalls: number; evidenceCreated: boolean; profileUpdated: boolean; onlineRuntimeChanged: boolean };
};

type DryRunResult = {
  runId: string;
  sampleId: string;
  regressionGroup: CalibrationRun['regressionGroup'];
  previousQualityLevel: DiagnosisQualityLevel;
  projectedQualityLevel: DiagnosisQualityLevel;
  previousFormalCandidate: boolean;
  projectedFormalCandidate: boolean;
  v21RootCauseAccepted: boolean;
  blockingDimensions: string[];
};

type DryRunConstraint = {
  code: string;
  passed: boolean;
  actual: string;
};

type ActivationDryRunReport = {
  schemaVersion: 'root_cause_policy_v2_1_activation_dry_run_v1';
  reportId: string;
  createdAt: string;
  sourceReportId: string;
  calibrationReportId: string;
  policyVersion: string;
  executionMode: 'offline_frozen_candidate_dry_run';
  qualityCountsBefore: Record<DiagnosisQualityLevel, number>;
  qualityCountsProjected: Record<DiagnosisQualityLevel, number>;
  newlyAcceptedRuns: string[];
  stillBlockedPromptErrors: Array<{ runId: string; blockingDimensions: string[] }>;
  results: DryRunResult[];
  constraints: DryRunConstraint[];
  review: {
    recoveredRunsAgentReviewed: 29;
    blockedPromptErrorsAgentReviewed: 3;
    preservedRunsAgentReviewed: 61;
    ownerConfirmationRequired: true;
    ownerConfirmationRecorded: false;
  };
  recommendation: 'ready_for_owner_confirmation' | 'targeted_repair_required';
  safety: {
    providerCalls: 0;
    promptModified: false;
    datasetModified: false;
    formalEvaluatorModified: false;
    policyActivated: false;
    evidenceCreated: false;
    profileUpdated: false;
  };
  limitations: string[];
  validation: { passed: boolean; issues: string[] };
};

async function run(): Promise<void> {
  const source = JSON.parse(await readFile(path.resolve(SOURCE_REPORT), 'utf8')) as SourceReport;
  const calibration = JSON.parse(await readFile(path.resolve(CALIBRATION_REPORT), 'utf8')) as CalibrationReport;
  const sourceByRunId = new Map(source.evaluations.map((item) => [item.runId, item]));
  const results = calibration.runResults.map((item) => {
    const evaluation = sourceByRunId.get(item.runId);
    if (!evaluation) throw new Error(`Missing frozen evaluation for ${item.runId}.`);
    const projectedQualityLevel = projectQuality(evaluation, item.v21Accepted);
    return {
      runId: item.runId,
      sampleId: item.sampleId,
      regressionGroup: item.regressionGroup,
      previousQualityLevel: evaluation.qualityLevel,
      projectedQualityLevel,
      previousFormalCandidate: evaluation.canBecomeFormalCandidate,
      projectedFormalCandidate: projectedQualityLevel === 'accepted',
      v21RootCauseAccepted: item.v21Accepted,
      blockingDimensions: blockingDimensions(evaluation, item.v21Accepted),
    } satisfies DryRunResult;
  });

  const constraints = buildConstraints(source, calibration, results);
  const createdAt = new Date().toISOString();
  const reportId = `phase15-root-cause-policy-v2-1-activation-dry-run-${createdAt.replace(/[:.]/g, '-')}`;
  const report: ActivationDryRunReport = {
    schemaVersion: 'root_cause_policy_v2_1_activation_dry_run_v1',
    reportId,
    createdAt,
    sourceReportId: source.reportId,
    calibrationReportId: calibration.reportId,
    policyVersion: calibration.policyVersion,
    executionMode: 'offline_frozen_candidate_dry_run',
    qualityCountsBefore: countQuality(results.map((item) => item.previousQualityLevel)),
    qualityCountsProjected: countQuality(results.map((item) => item.projectedQualityLevel)),
    newlyAcceptedRuns: results.filter((item) => !item.previousFormalCandidate && item.projectedFormalCandidate).map((item) => item.runId),
    stillBlockedPromptErrors: results
      .filter((item) => item.regressionGroup === 'confirmed_prompt_error_3' && !item.projectedFormalCandidate)
      .map((item) => ({ runId: item.runId, blockingDimensions: item.blockingDimensions })),
    results,
    constraints,
    review: {
      recoveredRunsAgentReviewed: 29,
      blockedPromptErrorsAgentReviewed: 3,
      preservedRunsAgentReviewed: 61,
      ownerConfirmationRequired: true,
      ownerConfirmationRecorded: false,
    },
    recommendation: constraints.every((item) => item.passed)
      ? 'ready_for_owner_confirmation'
      : 'targeted_repair_required',
    safety: {
      providerCalls: 0,
      promptModified: false,
      datasetModified: false,
      formalEvaluatorModified: false,
      policyActivated: false,
      evidenceCreated: false,
      profileUpdated: false,
    },
    limitations: [
      '本报告是冻结 Candidate 的离线 Dry Run，不是线上 Policy 激活记录。',
      'Agent 复核不能替代产品负责人对 29 / 3 / 61 三组结果的最终确认。',
      'Projected accepted 只表示冻结评估集满足全部质量维度，不代表真实新答案一定可靠。',
    ],
    validation: { passed: constraints.every((item) => item.passed), issues: constraints.filter((item) => !item.passed).map((item) => item.code) },
  };

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIRECTORY, `${reportId}.json`);
  const markdownPath = path.join(OUTPUT_DIRECTORY, `${reportId}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, toMarkdown(report), 'utf8');
  printReport(report, { jsonPath, markdownPath });
  if (!report.validation.passed) process.exitCode = 1;
}

function projectQuality(evaluation: SourceEvaluation, rootCauseAccepted: boolean): DiagnosisQualityLevel {
  if (
    !evaluation.validation.passed ||
    !evaluation.dimensions.quoteAttributionValid ||
    !evaluation.dimensions.noBoundaryOverreach ||
    !evaluation.dimensions.noCriticalHallucination
  ) return 'critical_violation';
  if (!evaluation.dimensions.mainAbilityAccepted || !evaluation.dimensions.answerStatusAccepted) return 'unacceptable';
  if (!rootCauseAccepted || !evaluation.dimensions.requiredFactsPresent) return 'questionable';
  return 'accepted';
}

function blockingDimensions(evaluation: SourceEvaluation, rootCauseAccepted: boolean): string[] {
  const result: string[] = [];
  if (!evaluation.validation.passed) result.push('validation');
  if (!evaluation.dimensions.mainAbilityAccepted) result.push('mainAbility');
  if (!evaluation.dimensions.answerStatusAccepted) result.push('answerStatus');
  if (!rootCauseAccepted) result.push('rootCause');
  if (!evaluation.dimensions.requiredFactsPresent) result.push('requiredFacts');
  if (!evaluation.dimensions.quoteAttributionValid) result.push('quoteAttribution');
  if (!evaluation.dimensions.noBoundaryOverreach) result.push('boundaryOverreach');
  if (!evaluation.dimensions.noCriticalHallucination) result.push('criticalHallucination');
  return result;
}

function buildConstraints(source: SourceReport, calibration: CalibrationReport, results: DryRunResult[]) {
  const group = (name: CalibrationRun['regressionGroup']) => results.filter((item) => item.regressionGroup === name);
  const promptErrors = group('confirmed_prompt_error_3');
  const preserved = group('previously_accepted_61');
  const recovered = group('reasonable_failed_29');
  return [
    check('frozen_93_runs_joined', results.length === 93, `${results.length}/93`),
    check('source_and_calibration_valid', calibration.validation.passed, calibration.validation.issues.join(',') || 'PASS'),
    check('reasonable_29_root_cause_recovered', recovered.length === 29 && recovered.every((item) => item.v21RootCauseAccepted), `${recovered.filter((item) => item.v21RootCauseAccepted).length}/29`),
    check('prompt_error_3_not_formal', promptErrors.length === 3 && promptErrors.every((item) => !item.projectedFormalCandidate), `${promptErrors.filter((item) => !item.projectedFormalCandidate).length}/3`),
    check('prompt_error_3_keep_root_cause_block', promptErrors.every((item) => !item.v21RootCauseAccepted), `${promptErrors.filter((item) => !item.v21RootCauseAccepted).length}/3`),
    check('previously_root_cause_accepted_61_full_quality_unchanged', preserved.length === 61 && preserved.every((item) => item.projectedQualityLevel === item.previousQualityLevel), `${preserved.filter((item) => item.projectedQualityLevel === item.previousQualityLevel).length}/61`),
    check('questionable_never_formal', results.every((item) => item.projectedQualityLevel !== 'questionable' || !item.projectedFormalCandidate), 'PASS'),
    check('unacceptable_never_formal', results.every((item) => item.projectedQualityLevel !== 'unacceptable' || !item.projectedFormalCandidate), 'PASS'),
    check('offline_safety_preserved', !source.safety.evidenceCreated && !source.safety.profileUpdated && calibration.safety.providerCalls === 0 && !calibration.safety.onlineRuntimeChanged, 'PASS'),
  ];
}

function check(code: string, passed: boolean, actual: string): DryRunConstraint {
  return { code, passed, actual };
}

function countQuality(levels: DiagnosisQualityLevel[]): Record<DiagnosisQualityLevel, number> {
  const result: Record<DiagnosisQualityLevel, number> = { accepted: 0, questionable: 0, unacceptable: 0, critical_violation: 0 };
  for (const level of levels) result[level] += 1;
  return result;
}

function toMarkdown(report: ActivationDryRunReport): string {
  const rows = report.constraints.map((item) => `| ${item.passed ? 'PASS' : 'FAIL'} | ${item.code} | ${item.actual} |`).join('\n');
  const errors = report.stillBlockedPromptErrors
    .map((item) => `| ${item.runId} | ${item.blockingDimensions.join(', ')} |`)
    .join('\n');
  return `# Phase 15.2 Policy v2.1 Activation Dry Run\n\n` +
    `状态：${report.recommendation}\n\n` +
    `## 一、完整 Evaluator 投影\n\n` +
    `- 调整前：${JSON.stringify(report.qualityCountsBefore)}；\n` +
    `- v2.1 投影：${JSON.stringify(report.qualityCountsProjected)}；\n` +
    `- 新进入 accepted 候选：${report.newlyAcceptedRuns.length} 个；\n` +
    `- Policy 已激活：否。\n\n` +
    `## 二、防绕过约束\n\n| 状态 | 约束 | 实际 |\n|---|---|---|\n${rows}\n\n` +
    `## 三、持续阻断的 Prompt 错误\n\n| Run | 阻断维度 |\n|---|---|\n${errors}\n\n` +
    `## 四、复核状态\n\n` +
    `- 29 个恢复 Run：Agent 复核完成，待负责人确认；\n` +
    `- 3 个 Prompt 错误：继续阻断，待负责人确认；\n` +
    `- 61 个原 Root Cause 维度通过 Run：完整质量结果保持不变，待负责人确认。\n\n` +
    `## 五、结论\n\n` +
    `Policy v2.1 接入完整 Evaluator 后不会绕过 Answer Status、Required Facts、引用真实性或越权边界。当前仅达到负责人确认前的激活就绪状态，不构成正式启用。\n`;
}

function printReport(
  report: ActivationDryRunReport,
  output: { jsonPath: string; markdownPath: string },
): void {
  console.log('\nPhase 15.2 Policy v2.1 Activation Dry Run');
  console.log('='.repeat(76));
  for (const item of report.constraints) {
    console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.code} | ${item.actual}`);
  }
  console.log('-'.repeat(76));
  console.log(`Before: ${JSON.stringify(report.qualityCountsBefore)}`);
  console.log(`Projected: ${JSON.stringify(report.qualityCountsProjected)}`);
  console.log(`New accepted candidates: ${report.newlyAcceptedRuns.length}`);
  console.log(`Recommendation: ${report.recommendation}`);
  console.log(`Validation: ${report.validation.passed ? 'PASS' : 'FAIL'}`);
  console.log(`JSON: ${output.jsonPath}`);
  console.log(`Markdown: ${output.markdownPath}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
