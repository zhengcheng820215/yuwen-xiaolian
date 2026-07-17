import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildDiagnosisCalibrationReport } from '../agents/diagnosisCalibrationReportAgent.ts';
import {
  evaluateDiagnosisQualityPolicyV2Legacy,
  evaluateDiagnosisStabilityV2,
} from '../agents/diagnosisQualityEvaluationV2Agent.ts';
import { PHASE15_2_ANNOTATION_V2 } from '../evaluation/phase15_2_annotation_v2.ts';
import { PHASE15_2_DATASET_V1 } from '../evaluation/phase15_2_dataset_v1.ts';
import type { DiagnosisBatchRunSummary } from '../schemas/diagnosisQualityEvaluation.schema.ts';
import type {
  DiagnosisCalibrationReport,
  DiagnosisQualityEvaluationV2,
} from '../schemas/diagnosisQualityPolicyV2.schema.ts';

const SOURCE_REPORT = 'docs/education/phase/reports/phase15_2/phase15-prompt-v3-manual-review-2026-07-17T08-36-41-396Z.json';
const OUTPUT_JSON = 'docs/education/phase/reports/phase15_2/phase15-prompt-v3-policy-v2-calibration.json';
const OUTPUT_MARKDOWN = 'docs/education/phase/reports/phase15_2/phase15-prompt-v3-policy-v2-calibration.md';

type SourceReport = {
  reportId: string;
  configuration: {
    datasetVersion: string;
    promptVersion: string;
    provider: string;
    model: string;
  };
  runs: DiagnosisBatchRunSummary[];
};

async function run(): Promise<void> {
  const source = JSON.parse(await readFile(path.resolve(SOURCE_REPORT), 'utf8')) as SourceReport;
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

  const evaluationGroups = groupBySample(evaluations);
  const stability = [...evaluationGroups.values()].map(evaluateDiagnosisStabilityV2);
  const categoryBySampleId = new Map(
    PHASE15_2_DATASET_V1.samples.map((sample) => [sample.sampleId, sample.category]),
  );
  const report = buildDiagnosisCalibrationReport({
    reportId: 'phase15-prompt-v3-policy-v2-calibration',
    createdAt: new Date().toISOString(),
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

  await writeFile(path.resolve(OUTPUT_JSON), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(path.resolve(OUTPUT_MARKDOWN), renderMarkdown(report), 'utf8');
  printSummary(report);
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

function printSummary(report: DiagnosisCalibrationReport): void {
  console.log('\nPhase 15.2 Prompt v3 / Quality Policy v2 Offline Calibration');
  console.log('='.repeat(78));
  console.log(`Source Candidate runs: ${report.candidateRunCount}`);
  console.log(`Samples: ${report.sampleCount}`);
  console.log('Provider calls made: 0');
  console.log(`Quality: ${JSON.stringify(report.qualityCounts)}`);
  console.log(`Boundary stability: ${JSON.stringify(report.boundaryStabilityCounts)}`);
  console.log(`Quality stability: ${JSON.stringify(report.qualityStabilityCounts)}`);
  console.log(`Evaluator false-positive findings: ${report.evaluatorQuality.falsePositiveFindingCount}`);
  console.log(`Confirmed model-issue findings: ${report.evaluatorQuality.confirmedModelIssueFindingCount}`);
  console.log(`Conclusion: ${report.conclusion}`);
  console.log(`JSON: ${OUTPUT_JSON}`);
  console.log(`Markdown: ${OUTPUT_MARKDOWN}`);
}

function renderMarkdown(report: DiagnosisCalibrationReport): string {
  const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
  const runRows = report.evaluations.map((item) => {
    const attributions = [...new Set(item.reviewFindings.map((finding) => finding.attribution))];
    return `| \`${item.runId}\` | ${item.qualityLevel} | ${item.detectedRootCauseCategories.join(', ')} | ${attributions.join(', ') || 'none'} |`;
  }).join('\n');
  return `# Phase 15.2 Prompt v3 / Quality Policy v2 离线校准报告

状态：${report.conclusion === 'policy_calibration_pass' ? 'POLICY V2 CALIBRATION PASS' : 'REVIEW REQUIRED'}

## 一、校准边界

- 来源报告：\`${report.sourceReportId}\`
- Dataset：\`${report.datasetVersion}\`，内容未修改
- Annotation：\`${report.annotationVersion}\`
- Quality Policy：\`${report.policyVersion}\`
- Prompt：\`${report.promptVersion}\`
- Provider / Model：\`${report.provider} / ${report.model}\`
- 本次 Provider 调用：0
- 重评 Candidate：${report.candidateRunCount} 个 Run / ${report.sampleCount} 个样本

本报告只重评人工复核包中已经保存的结构化 Candidate，不生成新的模型输出，也不是完整 Prompt v3 Calibrated Baseline。

## 二、重评结果

| 质量等级 | Run 数量 |
|---|---:|
| accepted | ${report.qualityCounts.accepted} |
| questionable | ${report.qualityCounts.questionable} |
| unacceptable | ${report.qualityCounts.unacceptable} |
| critical_violation | ${report.qualityCounts.critical_violation} |

## 三、模型质量层

| 指标 | 分子 | 分母 | 比例 |
|---|---:|---:|---:|
| Main Ability | ${report.modelQuality.mainAbility.numerator} | ${report.modelQuality.mainAbility.denominator} | ${percent(report.modelQuality.mainAbility.rate)} |
| Answer Status | ${report.modelQuality.answerStatus.numerator} | ${report.modelQuality.answerStatus.denominator} | ${percent(report.modelQuality.answerStatus.rate)} |
| Root Cause Category | ${report.modelQuality.rootCauseCategory.numerator} | ${report.modelQuality.rootCauseCategory.denominator} | ${percent(report.modelQuality.rootCauseCategory.rate)} |
| Reasonable Alternative Acceptance | ${report.modelQuality.reasonableAlternativeAcceptance.numerator} | ${report.modelQuality.reasonableAlternativeAcceptance.denominator} | ${percent(report.modelQuality.reasonableAlternativeAcceptance.rate)} |
| Concise Valid Acceptance | ${report.modelQuality.conciseValidAcceptance.numerator} | ${report.modelQuality.conciseValidAcceptance.denominator} | ${percent(report.modelQuality.conciseValidAcceptance.rate)} |

## 四、评估器质量层

- Evaluator False Positive Finding：${report.evaluatorQuality.falsePositiveFindingCount}
- Confirmed Model Issue Finding：${report.evaluatorQuality.confirmedModelIssueFindingCount}
- Mixed Issue Run：${report.evaluatorQuality.mixedIssueRunCount}
- 仍需人工复核 Run：${report.evaluatorQuality.humanReviewRunCount}

## 五、稳定性

- Boundary Stability：\`${JSON.stringify(report.boundaryStabilityCounts)}\`
- Quality Stability：\`${JSON.stringify(report.qualityStabilityCounts)}\`

Boundary Stability 只判断 mainAbility、answerStatus 和 Critical Boundary；Quality Stability 继续观察 accepted、questionable 与 unacceptable 的漂移，两者不再混为一个指标。

## 六、逐 Run 归因

| Run | Policy v2 质量 | Root Cause 类别 | 问题归因 |
|---|---|---|---|
${runRows}

## 七、限制与下一步

${report.limitations.map((item) => `- ${item}`).join('\n')}

下一步应先人工确认本报告中的剩余模型问题，再以相同 Prompt v3 配置重跑完整 Dataset v1，形成正式 Calibrated Baseline；在此之前不进入 Prompt v4。
`;
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
