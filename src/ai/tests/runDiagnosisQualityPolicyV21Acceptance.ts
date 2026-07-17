import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  evaluateDiagnosisQualityV2,
  evaluateDiagnosisStabilityV2,
} from '../agents/diagnosisQualityEvaluationV2Agent.ts';
import { PHASE15_2_ANNOTATION_V2 } from '../evaluation/phase15_2_annotation_v2.ts';
import { PHASE15_2_DATASET_V1 } from '../evaluation/phase15_2_dataset_v1.ts';
import { DIAGNOSIS_QUALITY_POLICY_V21 } from '../schemas/diagnosisQualityPolicyV2.schema.ts';
import type {
  DiagnosisBatchReport,
  DiagnosisBatchRunSummary,
  DiagnosisQualityLevel,
} from '../schemas/diagnosisQualityEvaluation.schema.ts';
import type {
  DiagnosisQualityEvaluationV2,
  DiagnosisStabilityEvaluationV2,
} from '../schemas/diagnosisQualityPolicyV2.schema.ts';

const SOURCE_REPORT = 'docs/education/phase/reports/phase15_2/phase15-prompt-v4-baseline-2026-07-17T10-03-19-131Z.json';
const OUTPUT_DIRECTORY = 'docs/education/phase/reports/phase15_2';

type Check = { code: string; passed: boolean; actual: string; required: string };

async function run(): Promise<void> {
  const source = JSON.parse(await readFile(path.resolve(SOURCE_REPORT), 'utf8')) as DiagnosisBatchReport;
  const sampleById = new Map(PHASE15_2_DATASET_V1.samples.map((sample) => [sample.sampleId, sample]));
  const annotationById = new Map(PHASE15_2_ANNOTATION_V2.annotations.map((item) => [item.sampleId, item]));
  const evaluations: DiagnosisQualityEvaluationV2[] = [];

  for (const sourceRun of source.runs) {
    if (!sourceRun.candidateSnapshot) continue;
    const sample = sampleById.get(sourceRun.sampleId);
    const annotation = annotationById.get(sourceRun.sampleId);
    if (!sample || !annotation) throw new Error(`Missing fixture for ${sourceRun.sampleId}.`);
    evaluations.push(evaluateDiagnosisQualityV2({
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
      previousPolicyResult: previousPolicyResult(sourceRun),
      evaluatedAt: new Date().toISOString(),
    }));
  }

  const stability = [...groupBySample(evaluations).values()].map(evaluateDiagnosisStabilityV2);
  const qualityCounts = countQuality(evaluations);
  const rootCauseAccepted = evaluations.filter((item) => item.dimensions.rootCauseCategoryAccepted).length;
  const sample06 = evaluations.filter((item) => item.sampleId === 'phase15-v1-06');
  const safetySample = sampleById.get('phase15-v1-01');
  const safetyAnnotation = annotationById.get('phase15-v1-01');
  if (!safetySample || !safetyAnnotation) throw new Error('Missing safety fixture phase15-v1-01.');
  const safetyBase = {
    datasetVersion: source.configuration.datasetVersion,
    annotationVersion: PHASE15_2_ANNOTATION_V2.annotationVersion,
    sampleId: safetySample.sampleId,
    studentAnswer: safetySample.taskExecutionResult.studentResponse?.answerText || '',
    readingText: safetySample.concreteTask.readingText,
    question: safetySample.concreteTask.question,
    referenceAnswer: safetySample.concreteTask.referenceAnswer,
    rubricTerms: [
      ...safetySample.concreteTask.scoringPoints,
      ...safetySample.concreteTask.rubric.map((item) => item.name),
    ],
    annotation: safetyAnnotation,
    evaluatedAt: new Date().toISOString(),
  };
  const unknownGate = evaluateDiagnosisQualityV2({
    ...safetyBase,
    runId: 'phase15-v1-01#unknown-gate',
    candidate: safetyCandidate('还需要继续观察。'),
  });
  const conflictingGate = evaluateDiagnosisQualityV2({
    ...safetyBase,
    runId: 'phase15-v1-01#conflicting-gate',
    candidate: safetyCandidate('本次作答未发现明确问题，但同时缺少必要文本依据。'),
  });
  const checks: Check[] = [
    check('formal_policy_is_v2_1', evaluations.every((item) => item.policyVersion === DIAGNOSIS_QUALITY_POLICY_V21), `${evaluations.filter((item) => item.policyVersion === DIAGNOSIS_QUALITY_POLICY_V21).length}/${evaluations.length}`, '93/93'),
    check('frozen_candidate_count', evaluations.length === 93, String(evaluations.length), '93'),
    check('root_cause_acceptance', rootCauseAccepted === 90, `${rootCauseAccepted}/93`, '90/93'),
    check('accepted_count', qualityCounts.accepted === 79, String(qualityCounts.accepted), '79'),
    check('questionable_count', qualityCounts.questionable === 6, String(qualityCounts.questionable), '6'),
    check('unacceptable_count', qualityCounts.unacceptable === 8, String(qualityCounts.unacceptable), '8'),
    check('critical_count', qualityCounts.critical_violation === 0, String(qualityCounts.critical_violation), '0'),
    check('questionable_requires_review', evaluations.every((item) => item.qualityLevel !== 'questionable' || (item.offlineDecision === 'human_review' && !item.canBecomeFormalCandidate)), 'PASS', 'PASS'),
    check('unacceptable_is_blocked', evaluations.every((item) => item.qualityLevel !== 'unacceptable' || (item.offlineDecision === 'blocked' && !item.canBecomeFormalCandidate)), 'PASS', 'PASS'),
    check('critical_is_blocked', evaluations.every((item) => item.qualityLevel !== 'critical_violation' || (item.offlineDecision === 'critical_alert' && !item.canBecomeFormalCandidate)), 'PASS', 'PASS'),
    check('sample_06_prompt_errors_blocked', sample06.length === 3 && sample06.every((item) => item.qualityLevel === 'unacceptable' && !item.dimensions.rootCauseCategoryAccepted && !item.canBecomeFormalCandidate), `${sample06.filter((item) => !item.canBecomeFormalCandidate).length}/3`, '3/3'),
    check('unknown_requires_review', unknownGate.qualityLevel === 'questionable' && unknownGate.offlineDecision === 'human_review' && !unknownGate.canBecomeFormalCandidate && unknownGate.detectedRootCauseCategories.includes('unknown'), unknownGate.qualityLevel, 'questionable'),
    check('conflicting_requires_review', conflictingGate.qualityLevel === 'questionable' && conflictingGate.offlineDecision === 'human_review' && !conflictingGate.canBecomeFormalCandidate && conflictingGate.limitations.some((item) => item.includes('mutually exclusive')), conflictingGate.qualityLevel, 'questionable'),
    check('source_shadow_safety', source.configuration.executionMode === 'shadow' && !source.safety.evidenceCreated && !source.safety.profileUpdated && !source.safety.secretLogged && !source.safety.fullPromptLogged && !source.safety.rawOutputLogged, 'PASS', 'PASS'),
    check('annotation_set_valid', PHASE15_2_ANNOTATION_V2.validation.passed, PHASE15_2_ANNOTATION_V2.validation.passed ? 'PASS' : PHASE15_2_ANNOTATION_V2.validation.issues.join(','), 'PASS'),
  ];

  const createdAt = new Date().toISOString();
  const reportId = `phase15-diagnosis-quality-policy-v2-1-acceptance-${createdAt.replace(/[:.]/g, '-')}`;
  const report = {
    schemaVersion: 'diagnosis_quality_policy_v2_1_acceptance_v1',
    reportId,
    createdAt,
    sourceReportId: source.reportId,
    policyVersion: DIAGNOSIS_QUALITY_POLICY_V21,
    ownerConfirmation: {
      recorded: true,
      confirmedGroups: { recovered: 29, blockedPromptErrors: 3, preservedRootCausePasses: 61 },
      safetyPolicy: {
        accepted: 'formal_candidate_allowed',
        questionable: 'review_required',
        unacceptable: 'blocked',
        critical_violation: 'blocked_and_alerted',
        unknownOrConflicting: 'review_required',
      },
    },
    metrics: {
      candidateRuns: evaluations.length,
      rootCauseAccepted,
      qualityCounts,
      sampleCount: new Set(evaluations.map((item) => item.sampleId)).size,
    },
    checks,
    evaluations,
    stability,
    status: checks.every((item) => item.passed) ? 'pass_frozen' : 'acceptance_failed',
    safety: {
      providerCalls: 0,
      promptModified: false,
      datasetModified: false,
      evidenceCreated: false,
      profileUpdated: false,
      legacyPolicyV2Reproducible: true,
    },
    limitations: [
      'Dataset v1 是首版工程与教育边界基线，不代表全部题型的产品信心。',
      'accepted 表示冻结人工边界内可进入正式候选，不等于长期能力结论。',
      '真实新答案缺少冻结人工边界时，仍必须经过正式 Runtime Gate，不能套用本报告标签。',
    ],
    validation: { passed: checks.every((item) => item.passed), issues: checks.filter((item) => !item.passed).map((item) => item.code) },
  };

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIRECTORY, `${reportId}.json`);
  const markdownPath = path.join(OUTPUT_DIRECTORY, `${reportId}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, toMarkdown(report), 'utf8');
  print(checks, qualityCounts, { jsonPath, markdownPath });
  if (!report.validation.passed) process.exitCode = 1;
}

function previousPolicyResult(run: DiagnosisBatchRunSummary) {
  return {
    qualityLevel: run.qualityLevel,
    failedDimensions: run.failedDimensions,
    violations: run.violations,
  };
}

function safetyCandidate(rootCause: string) {
  return {
    mainAbility: '推理',
    answerStatus: 'fully_meets',
    rootCause,
    surfaceError: '本次作答未发现明确表面错误。',
    abilityEvidence: ['学生判断父亲感到怀念，并引用站了很久作为依据。'],
    diagnosisSummary: '学生完成了心理判断、文本依据与关系说明。',
  };
}

function groupBySample(evaluations: DiagnosisQualityEvaluationV2[]): Map<string, DiagnosisQualityEvaluationV2[]> {
  const groups = new Map<string, DiagnosisQualityEvaluationV2[]>();
  for (const evaluation of evaluations) {
    groups.set(evaluation.sampleId, [...(groups.get(evaluation.sampleId) || []), evaluation]);
  }
  return groups;
}

function countQuality(evaluations: DiagnosisQualityEvaluationV2[]): Record<DiagnosisQualityLevel, number> {
  const result: Record<DiagnosisQualityLevel, number> = { accepted: 0, questionable: 0, unacceptable: 0, critical_violation: 0 };
  for (const evaluation of evaluations) result[evaluation.qualityLevel] += 1;
  return result;
}

function check(code: string, passed: boolean, actual: string, required: string): Check {
  return { code, passed, actual, required };
}

function toMarkdown(report: {
  status: string;
  policyVersion: string;
  metrics: { candidateRuns: number; rootCauseAccepted: number; qualityCounts: Record<DiagnosisQualityLevel, number>; sampleCount: number };
  checks: Check[];
  limitations: string[];
}): string {
  const rows = report.checks.map((item) => `| ${item.passed ? 'PASS' : 'FAIL'} | ${item.code} | ${item.actual} | ${item.required} |`).join('\n');
  return `# Phase 15.2 Policy v2.1 正式验收与冻结记录\n\n` +
    `状态：${report.status}\n\n` +
    `正式 Policy：${report.policyVersion}\n\n` +
    `## 一、负责人确认\n\n` +
    `已确认 29 个恢复项、3 个持续阻断项和 61 个 Root Cause 保持项，并批准既定安全策略。\n\n` +
    `## 二、正式回归结果\n\n` +
    `- Candidate：${report.metrics.candidateRuns}；\n` +
    `- Root Cause Accepted：${report.metrics.rootCauseAccepted} / ${report.metrics.candidateRuns}；\n` +
    `- 完整质量分布：${JSON.stringify(report.metrics.qualityCounts)}；\n` +
    `- 样本数：${report.metrics.sampleCount}。\n\n` +
    `## 三、安全验收\n\n| 状态 | 检查 | 实际 | 要求 |\n|---|---|---|---|\n${rows}\n\n` +
    `## 四、正式策略\n\n` +
    `- accepted：允许进入正式候选；\n` +
    `- questionable：review_required，不自动回流；\n` +
    `- unacceptable：blocked；\n` +
    `- critical_violation：blocked + critical alert；\n` +
    `- unknown / conflicting：review_required。\n\n` +
    `## 五、限制\n\n${report.limitations.map((item) => `- ${item}`).join('\n')}\n`;
}

function print(
  checks: Check[],
  qualityCounts: Record<DiagnosisQualityLevel, number>,
  output: { jsonPath: string; markdownPath: string },
): void {
  console.log('\nPhase 15.2 Diagnosis Quality Policy v2.1 Acceptance');
  console.log('='.repeat(78));
  for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.code} | ${item.actual}`);
  console.log('-'.repeat(78));
  console.log(`Quality: ${JSON.stringify(qualityCounts)}`);
  console.log(`Result: ${checks.filter((item) => item.passed).length}/${checks.length} PASS`);
  console.log(`JSON: ${output.jsonPath}`);
  console.log(`Markdown: ${output.markdownPath}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
