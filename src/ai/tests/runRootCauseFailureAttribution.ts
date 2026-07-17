import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PHASE15_2_ANNOTATION_V2 } from '../evaluation/phase15_2_annotation_v2.ts';
import { PHASE15_2_DATASET_V1 } from '../evaluation/phase15_2_dataset_v1.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type {
  DiagnosisCalibrationReport,
  DiagnosisQualityEvaluationV2,
  RootCauseBoundaryCategory,
} from '../schemas/diagnosisQualityPolicyV2.schema.ts';

const SOURCE_REPORT = 'docs/education/phase/reports/phase15_2/phase15-prompt-v4-calibrated-baseline-2026-07-17T10-03-31-702Z.json';
const OUTPUT_DIRECTORY = 'docs/education/phase/reports/phase15_2';
const EXPECTED_SOURCE_REPORT_ID = 'phase15-prompt-v4-calibrated-baseline-2026-07-17T10-03-31-702Z';

type FailureLayer = 'prompt' | 'policy' | 'dataset' | 'evaluator' | 'ambiguous';
type EvidenceSufficiency =
  | 'sufficient_for_observed_issue'
  | 'limited_for_unique_root_cause'
  | 'insufficient';
type ExpectedLabelValidity = 'valid' | 'needs_expansion' | 'conflicting';
type ActualLabelReasonableness = 'reasonable' | 'unreasonable' | 'ambiguous';
type RecommendedAction =
  | 'prompt_change'
  | 'policy_change'
  | 'dataset_change'
  | 'evaluator_fix'
  | 'further_review'
  | 'no_change';

type SourceReport = {
  reportId: string;
  configuration: {
    datasetVersion: string;
    promptVersion: string;
    executionMode: string;
  };
  modelQualityLayer: {
    rootCauseCategory: Metric;
  };
  evaluations: DiagnosisQualityEvaluationV2[];
  runs: Array<{
    sampleId: string;
    runIndex: number;
    candidateSnapshot?: DiagnosisResult;
  }>;
  safety: {
    executionMode: string;
    evidenceCreated: boolean;
    profileUpdated: boolean;
    secretLogged: boolean;
    fullPromptLogged: boolean;
    rawOutputLogged: boolean;
  };
};

type Metric = {
  numerator: number;
  denominator: number;
  rate: number;
};

type SampleReview = {
  primaryFailureLayer: FailureLayer;
  contributingLayers: FailureLayer[];
  evidenceSufficiency: EvidenceSufficiency;
  expectedLabelValidity: ExpectedLabelValidity;
  actualLabelReasonableness: ActualLabelReasonableness;
  recommendedAction: RecommendedAction;
  reviewNote: string;
};

type RunAttribution = {
  caseId: string;
  sampleId: string;
  questionType: string;
  studentAnswerExcerpt: string;
  expectedRootCauseCategories: RootCauseBoundaryCategory[];
  actualRootCause: string;
  answerStatus: DiagnosisResult['answerStatus'];
  mainAbility: string;
  evidenceSufficiency: EvidenceSufficiency;
  expectedLabelValidity: ExpectedLabelValidity;
  actualLabelReasonableness: ActualLabelReasonableness;
  detectedRootCauseCategories: RootCauseBoundaryCategory[];
  primaryFailureLayer: FailureLayer;
  contributingLayers: FailureLayer[];
  recommendedAction: RecommendedAction;
  reviewStatus: 'agent_initial_review';
  reviewNote: string;
};

type RootCauseFailureAttributionReport = {
  schemaVersion: 'root_cause_failure_attribution_v1';
  reportId: string;
  createdAt: string;
  sourceReportId: string;
  datasetVersion: string;
  promptVersion: string;
  policyVersion: string;
  annotationVersion: string;
  executionMode: 'offline_existing_candidate_review';
  sourceMetrics: {
    automaticRootCauseCategory: Metric;
    failedRuns: number;
    affectedSamples: number;
  };
  runLevelPrimaryCounts: Record<FailureLayer, number>;
  sampleLevelPrimaryCounts: Record<FailureLayer, number>;
  attributionMetrics: {
    reviewedFailedRuns: number;
    reasonableActualRootCauseRuns: number;
    unreasonableActualRootCauseRuns: number;
    ambiguousActualRootCauseRuns: number;
    failedRunReasonablenessRate: number;
    projectedPostAttributionAcceptability: Metric;
  };
  recommendation: {
    priority: 'policy_v2_1_and_evaluator_calibration';
    promptV4_1RequiredNow: false;
    reason: string;
  };
  sampleAttributions: Array<{
    sampleId: string;
    failedRunIds: string[];
    primaryFailureLayer: FailureLayer;
    contributingLayers: FailureLayer[];
    recommendedAction: RecommendedAction;
    reviewNote: string;
  }>;
  runAttributions: RunAttribution[];
  safety: {
    providerCalls: 0;
    promptModified: false;
    policyModified: false;
    datasetModified: false;
    evidenceCreated: false;
    profileUpdated: false;
    rawOutputStored: false;
  };
  limitations: string[];
  validation: {
    passed: boolean;
    issues: string[];
  };
};

const SAMPLE_REVIEWS: Record<string, SampleReview> = {
  'phase15-v1-05': {
    primaryFailureLayer: 'evaluator',
    contributingLayers: ['prompt'],
    evidenceSufficiency: 'sufficient_for_observed_issue',
    expectedLabelValidity: 'valid',
    actualLabelReasonableness: 'reasonable',
    recommendedAction: 'evaluator_fix',
    reviewNote: 'Root Cause 已正确识别缺少文本依据，但分类器返回 unknown；Run 1-2 还存在独立的 answerStatus 校准问题。',
  },
  'phase15-v1-06': {
    primaryFailureLayer: 'prompt',
    contributingLayers: [],
    evidenceSufficiency: 'sufficient_for_observed_issue',
    expectedLabelValidity: 'valid',
    actualLabelReasonableness: 'unreasonable',
    recommendedAction: 'prompt_change',
    reviewNote: '回答给出了可能成立的目的，但没有材料依据；模型连续三次判为 fully_meets 且未发现缺口。',
  },
  'phase15-v1-07': {
    primaryFailureLayer: 'evaluator',
    contributingLayers: [],
    evidenceSufficiency: 'sufficient_for_observed_issue',
    expectedLabelValidity: 'valid',
    actualLabelReasonableness: 'reasonable',
    recommendedAction: 'evaluator_fix',
    reviewNote: '三次 Root Cause 都清楚描述了概括不完整，但 Evaluator 未能映射到 incomplete_summary。',
  },
  'phase15-v1-08': {
    primaryFailureLayer: 'policy',
    contributingLayers: ['evaluator', 'prompt'],
    evidenceSufficiency: 'sufficient_for_observed_issue',
    expectedLabelValidity: 'needs_expansion',
    actualLabelReasonableness: 'reasonable',
    recommendedAction: 'policy_change',
    reviewNote: '对于表达题中的笼统理由，missing_evidence 与 expression_incomplete 均可成立；v2 类别边界过窄，answerStatus 漂移则是另一项 Prompt 问题。',
  },
  'phase15-v1-09': {
    primaryFailureLayer: 'evaluator',
    contributingLayers: [],
    evidenceSufficiency: 'sufficient_for_observed_issue',
    expectedLabelValidity: 'valid',
    actualLabelReasonableness: 'reasonable',
    recommendedAction: 'evaluator_fix',
    reviewNote: 'Root Cause 已明确指出“褪色”与“价值昂贵”之间的错误关系，但其中一次被误分类为 missing_evidence。',
  },
  'phase15-v1-10': {
    primaryFailureLayer: 'evaluator',
    contributingLayers: [],
    evidenceSufficiency: 'sufficient_for_observed_issue',
    expectedLabelValidity: 'valid',
    actualLabelReasonableness: 'reasonable',
    recommendedAction: 'evaluator_fix',
    reviewNote: '三次 Root Cause 都描述了缺乏依据或错误的因果推断，但全部被分类为 unknown。',
  },
  'phase15-v1-11': {
    primaryFailureLayer: 'evaluator',
    contributingLayers: [],
    evidenceSufficiency: 'sufficient_for_observed_issue',
    expectedLabelValidity: 'valid',
    actualLabelReasonableness: 'reasonable',
    recommendedAction: 'evaluator_fix',
    reviewNote: '答案给出了无关的因果理由；Evaluator 将其映射为 unknown 或表达类别，而不是 incorrect_causal_relation / unsupported_inference。',
  },
  'phase15-v1-12': {
    primaryFailureLayer: 'policy',
    contributingLayers: ['evaluator'],
    evidenceSufficiency: 'sufficient_for_observed_issue',
    expectedLabelValidity: 'needs_expansion',
    actualLabelReasonableness: 'reasonable',
    recommendedAction: 'policy_change',
    reviewNote: 'Dataset v1 接受“添加不存在事实 / 事实错误”，但 Annotation v2 对该样本类别遗漏了 incomplete_summary 与 misread_key_detail。',
  },
  'phase15-v1-13': {
    primaryFailureLayer: 'evaluator',
    contributingLayers: [],
    evidenceSufficiency: 'sufficient_for_observed_issue',
    expectedLabelValidity: 'valid',
    actualLabelReasonableness: 'reasonable',
    recommendedAction: 'evaluator_fix',
    reviewNote: '失败 Run 已清楚描述“引用动作正确但心理推断错误”，Evaluator 却返回 unknown。',
  },
  'phase15-v1-14': {
    primaryFailureLayer: 'evaluator',
    contributingLayers: [],
    evidenceSufficiency: 'sufficient_for_observed_issue',
    expectedLabelValidity: 'valid',
    actualLabelReasonableness: 'reasonable',
    recommendedAction: 'evaluator_fix',
    reviewNote: '三次 Root Cause 都识别了缺乏依据的“惩罚”解释，但 Evaluator 全部返回 unknown。',
  },
  'phase15-v1-15': {
    primaryFailureLayer: 'evaluator',
    contributingLayers: [],
    evidenceSufficiency: 'sufficient_for_observed_issue',
    expectedLabelValidity: 'valid',
    actualLabelReasonableness: 'reasonable',
    recommendedAction: 'evaluator_fix',
    reviewNote: '三次 Root Cause 都识别了在相关事件概括中加入无依据结论的问题，但 Evaluator 全部返回 unknown。',
  },
  'phase15-v1-16': {
    primaryFailureLayer: 'policy',
    contributingLayers: [],
    evidenceSufficiency: 'limited_for_unique_root_cause',
    expectedLabelValidity: 'needs_expansion',
    actualLabelReasonableness: 'reasonable',
    recommendedAction: 'policy_change',
    reviewNote: 'Dataset v1 允许 fully_meets，但 Annotation v2 只允许 missing_evidence；“未发现明确缺口”与被允许的 fully_meets 路径并不冲突。',
  },
  'phase15-v1-17': {
    primaryFailureLayer: 'evaluator',
    contributingLayers: [],
    evidenceSufficiency: 'sufficient_for_observed_issue',
    expectedLabelValidity: 'valid',
    actualLabelReasonableness: 'reasonable',
    recommendedAction: 'evaluator_fix',
    reviewNote: '三次 Root Cause 都识别了深层目的或关系缺失，但 Evaluator 将其映射为 misread_key_detail 或 unknown。',
  },
};

const PROMPT_RUN_IDS = new Set([
  'phase15-v1-06#1',
  'phase15-v1-06#2',
  'phase15-v1-06#3',
]);

const POLICY_RUN_IDS = new Set([
  'phase15-v1-08#1',
  'phase15-v1-12#1',
  'phase15-v1-12#2',
  'phase15-v1-12#3',
  'phase15-v1-16#1',
  'phase15-v1-16#3',
]);

async function run(): Promise<void> {
  const source = JSON.parse(await readFile(path.resolve(SOURCE_REPORT), 'utf8')) as SourceReport;
  const validationIssues = validateSource(source);
  const failedEvaluations = source.evaluations.filter(
    (evaluation) => !evaluation.dimensions.rootCauseCategoryAccepted,
  );
  const runById = new Map(source.runs.map((item) => [toRunId(item.sampleId, item.runIndex), item]));
  const sampleById = new Map(PHASE15_2_DATASET_V1.samples.map((item) => [item.sampleId, item]));
  const annotationById = new Map(PHASE15_2_ANNOTATION_V2.annotations.map((item) => [item.sampleId, item]));

  const runAttributions = failedEvaluations.map((evaluation): RunAttribution => {
    const runId = evaluation.runId;
    const sourceRun = runById.get(runId);
    const sample = sampleById.get(evaluation.sampleId);
    const annotation = annotationById.get(evaluation.sampleId);
    const review = SAMPLE_REVIEWS[evaluation.sampleId];
    if (!sourceRun?.candidateSnapshot || !sample || !annotation || !review) {
      throw new Error(`Attribution source is incomplete for ${runId}.`);
    }
    const primaryFailureLayer = runFailureLayer(runId);
    const contributingLayers = uniqueLayers([
      ...review.contributingLayers,
      ...(primaryFailureLayer === review.primaryFailureLayer ? [] : [review.primaryFailureLayer]),
    ]).filter((item) => item !== primaryFailureLayer);

    return {
      caseId: runId,
      sampleId: evaluation.sampleId,
      questionType: sample.concreteTask.questionMetadata.questionType,
      studentAnswerExcerpt: excerpt(sample.taskExecutionResult.studentResponse?.answerText || ''),
      expectedRootCauseCategories: [...annotation.allowedRootCauseCategories],
      actualRootCause: sourceRun.candidateSnapshot.rootCause,
      answerStatus: sourceRun.candidateSnapshot.answerStatus,
      mainAbility: sourceRun.candidateSnapshot.mainAbility,
      evidenceSufficiency: review.evidenceSufficiency,
      expectedLabelValidity: review.expectedLabelValidity,
      actualLabelReasonableness: evaluation.sampleId === 'phase15-v1-06'
        ? 'unreasonable'
        : review.actualLabelReasonableness,
      detectedRootCauseCategories: [...evaluation.detectedRootCauseCategories],
      primaryFailureLayer,
      contributingLayers,
      recommendedAction: actionFor(primaryFailureLayer),
      reviewStatus: 'agent_initial_review',
      reviewNote: review.reviewNote,
    };
  });

  const affectedSampleIds = [...new Set(runAttributions.map((item) => item.sampleId))].sort();
  const createdAt = new Date().toISOString();
  const automatic = source.modelQualityLayer.rootCauseCategory;
  const reasonableFailedRuns = runAttributions.filter(
    (item) => item.actualLabelReasonableness === 'reasonable',
  ).length;
  const unreasonableFailedRuns = runAttributions.filter(
    (item) => item.actualLabelReasonableness === 'unreasonable',
  ).length;
  const ambiguousFailedRuns = runAttributions.filter(
    (item) => item.actualLabelReasonableness === 'ambiguous',
  ).length;
  const projectedNumerator = automatic.numerator + reasonableFailedRuns;
  const reportId = `phase15-root-cause-failure-attribution-${createdAt.replace(/[:.]/g, '-')}`;

  const report: RootCauseFailureAttributionReport = {
    schemaVersion: 'root_cause_failure_attribution_v1',
    reportId,
    createdAt,
    sourceReportId: source.reportId,
    datasetVersion: source.configuration.datasetVersion,
    promptVersion: source.configuration.promptVersion,
    policyVersion: 'diagnosis_quality_policy_v2',
    annotationVersion: PHASE15_2_ANNOTATION_V2.annotationVersion,
    executionMode: 'offline_existing_candidate_review',
    sourceMetrics: {
      automaticRootCauseCategory: automatic,
      failedRuns: runAttributions.length,
      affectedSamples: affectedSampleIds.length,
    },
    runLevelPrimaryCounts: countLayers(runAttributions.map((item) => item.primaryFailureLayer)),
    sampleLevelPrimaryCounts: countLayers(
      affectedSampleIds.map((sampleId) => SAMPLE_REVIEWS[sampleId].primaryFailureLayer),
    ),
    attributionMetrics: {
      reviewedFailedRuns: runAttributions.length,
      reasonableActualRootCauseRuns: reasonableFailedRuns,
      unreasonableActualRootCauseRuns: unreasonableFailedRuns,
      ambiguousActualRootCauseRuns: ambiguousFailedRuns,
      failedRunReasonablenessRate: safeRate(reasonableFailedRuns, runAttributions.length),
      projectedPostAttributionAcceptability: {
        numerator: projectedNumerator,
        denominator: automatic.denominator,
        rate: safeRate(projectedNumerator, automatic.denominator),
      },
    },
    recommendation: {
      priority: 'policy_v2_1_and_evaluator_calibration',
      promptV4_1RequiredNow: false,
      reason: '29 of 32 automatically failed Root Cause runs remain semantically reasonable. The dominant failure is category-boundary or evaluator mapping, while only 3 runs show a confirmed Prompt-level Root Cause error.',
    },
    sampleAttributions: affectedSampleIds.map((sampleId) => {
      const review = SAMPLE_REVIEWS[sampleId];
      return {
        sampleId,
        failedRunIds: runAttributions
          .filter((item) => item.sampleId === sampleId)
          .map((item) => item.caseId),
        primaryFailureLayer: review.primaryFailureLayer,
        contributingLayers: [...review.contributingLayers],
        recommendedAction: review.recommendedAction,
        reviewNote: review.reviewNote,
      };
    }),
    runAttributions,
    safety: {
      providerCalls: 0,
      promptModified: false,
      policyModified: false,
      datasetModified: false,
      evidenceCreated: false,
      profileUpdated: false,
      rawOutputStored: false,
    },
    limitations: [
      'This report reviews only the 32 Root Cause Category failures in the frozen Prompt v4 calibrated baseline.',
      'The attribution is an agent-assisted initial review. Final human adjudication and agreement are still required before changing Policy or Prompt.',
      'The projected post-attribution rate assumes the 61 automatically accepted Root Cause runs remain valid; those runs were not fully re-adjudicated here.',
      'Attribution is an offline human review artifact and must not be used as an online quality classifier for new student responses.',
      'No Prompt, Policy, Dataset, Annotation or Runtime behavior is changed by this report.',
    ],
    validation: {
      passed: false,
      issues: [],
    },
  };

  report.validation.issues = [
    ...validationIssues,
    ...validateAttributions(report),
  ];
  report.validation.passed = report.validation.issues.length === 0;
  if (!report.validation.passed) {
    throw new Error(`Attribution validation failed: ${report.validation.issues.join(' | ')}`);
  }

  const outputPaths = await writeReport(report);
  printSummary(report, outputPaths);
}

function validateSource(source: SourceReport): string[] {
  const issues: string[] = [];
  if (source.reportId !== EXPECTED_SOURCE_REPORT_ID) issues.push('source_report_id_mismatch');
  if (source.configuration.datasetVersion !== '1.0.0') issues.push('dataset_version_mismatch');
  if (source.configuration.promptVersion !== 'real_ai_diagnosis_prompt_v4') issues.push('prompt_version_mismatch');
  if (source.configuration.executionMode !== 'shadow') issues.push('source_not_shadow');
  if (source.safety.evidenceCreated || source.safety.profileUpdated) issues.push('formal_data_mutation_detected');
  if (source.safety.secretLogged || source.safety.fullPromptLogged || source.safety.rawOutputLogged) {
    issues.push('unsafe_source_logging_detected');
  }
  return issues;
}

function validateAttributions(report: RootCauseFailureAttributionReport): string[] {
  const issues: string[] = [];
  const caseIds = report.runAttributions.map((item) => item.caseId);
  if (caseIds.length !== 32) issues.push(`expected_32_failed_runs_received_${caseIds.length}`);
  if (new Set(caseIds).size !== caseIds.length) issues.push('duplicate_case_id');
  if (report.sampleAttributions.length !== 13) issues.push('expected_13_affected_samples');
  if (report.attributionMetrics.reviewedFailedRuns !== report.sourceMetrics.failedRuns) {
    issues.push('reviewed_failed_run_count_mismatch');
  }
  const attributionTotal = Object.values(report.runLevelPrimaryCounts).reduce((sum, value) => sum + value, 0);
  if (attributionTotal !== report.runAttributions.length) issues.push('run_level_count_mismatch');
  if (report.runLevelPrimaryCounts.prompt !== 3) issues.push('prompt_run_count_mismatch');
  if (report.runLevelPrimaryCounts.policy !== 6) issues.push('policy_run_count_mismatch');
  if (report.runLevelPrimaryCounts.evaluator !== 23) issues.push('evaluator_run_count_mismatch');
  if (report.runLevelPrimaryCounts.dataset !== 0) issues.push('unexpected_dataset_failure');
  if (report.runLevelPrimaryCounts.ambiguous !== 0) issues.push('unexpected_ambiguous_failure');
  if (report.attributionMetrics.reasonableActualRootCauseRuns !== 29) issues.push('reasonable_run_count_mismatch');
  if (report.attributionMetrics.unreasonableActualRootCauseRuns !== 3) issues.push('unreasonable_run_count_mismatch');
  if (report.attributionMetrics.ambiguousActualRootCauseRuns !== 0) issues.push('ambiguous_run_count_mismatch');
  if (report.safety.providerCalls !== 0 || report.safety.evidenceCreated || report.safety.profileUpdated) {
    issues.push('offline_safety_boundary_failed');
  }
  return issues;
}

async function writeReport(report: RootCauseFailureAttributionReport): Promise<{ json: string; markdown: string }> {
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const baseName = report.reportId;
  const jsonPath = path.join(OUTPUT_DIRECTORY, `${baseName}.json`);
  const markdownPath = path.join(OUTPUT_DIRECTORY, `${baseName}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, toMarkdown(report), 'utf8');
  return { json: jsonPath, markdown: markdownPath };
}

function toMarkdown(report: RootCauseFailureAttributionReport): string {
  const runRows = report.runAttributions.map((item) =>
    `| ${item.caseId} | ${item.answerStatus} | ${item.expectedRootCauseCategories.join(', ')} | ${item.detectedRootCauseCategories.join(', ') || 'unknown'} | ${item.actualLabelReasonableness} | ${item.primaryFailureLayer} | ${item.recommendedAction} |`,
  );
  const sampleRows = report.sampleAttributions.map((item) =>
    `| ${item.sampleId} | ${item.failedRunIds.length} | ${item.primaryFailureLayer} | ${item.contributingLayers.join(', ') || '-'} | ${item.recommendedAction} | ${item.reviewNote} |`,
  );

  return `# Phase 15.2 Root Cause Failure Attribution\n\n` +
    `状态：${report.validation.passed ? 'PASS' : 'FAIL'}  \n` +
    `执行模式：离线审查已有 Candidate，不调用 Provider  \n` +
    `来源报告：${report.sourceReportId}  \n` +
    `Prompt：${report.promptVersion}  \n\n` +
    `## 一、结论\n\n` +
    `本次初步审查覆盖 ${report.sourceMetrics.affectedSamples} 个样本、${report.sourceMetrics.failedRuns} 个 Root Cause Category 失败 Run。` +
    `其中 ${report.attributionMetrics.reasonableActualRootCauseRuns} 个 Run 的实际 Root Cause 在语义上合理，` +
    `${report.attributionMetrics.unreasonableActualRootCauseRuns} 个 Run 确认为 Prompt 层 Root Cause 问题，` +
    `${report.attributionMetrics.ambiguousActualRootCauseRuns} 个 Run 无法判定。\n\n` +
    `原始自动指标保持为 ${percent(report.sourceMetrics.automaticRootCauseCategory.rate)}。` +
    `若只把本次确认合理的失败 Run 计入，投影可接受率为 ${percent(report.attributionMetrics.projectedPostAttributionAcceptability.rate)}；` +
    `该投影不等于全量人工确认率，因为原本自动通过的 61 个 Run 未在本轮逐条重审。\n\n` +
    `优先建议：人工确认归因后，先进行 Policy v2.1 与 Evaluator 分类校准，当前不启动 Prompt v4.1。\n\n` +
    `## 二、归因统计\n\n` +
    `### Run 级主责任\n\n` +
    `- Prompt：${report.runLevelPrimaryCounts.prompt}\n` +
    `- Policy：${report.runLevelPrimaryCounts.policy}\n` +
    `- Dataset：${report.runLevelPrimaryCounts.dataset}\n` +
    `- Evaluator：${report.runLevelPrimaryCounts.evaluator}\n` +
    `- Ambiguous：${report.runLevelPrimaryCounts.ambiguous}\n\n` +
    `### Sample 级主责任\n\n` +
    `- Prompt：${report.sampleLevelPrimaryCounts.prompt}\n` +
    `- Policy：${report.sampleLevelPrimaryCounts.policy}\n` +
    `- Dataset：${report.sampleLevelPrimaryCounts.dataset}\n` +
    `- Evaluator：${report.sampleLevelPrimaryCounts.evaluator}\n` +
    `- Ambiguous：${report.sampleLevelPrimaryCounts.ambiguous}\n\n` +
    `## 三、样本级归因\n\n` +
    `| Sample | 失败 Run | 主责任层 | 共同影响层 | 建议动作 | 审查说明 |\n` +
    `|---|---:|---|---|---|---|\n` +
    `${sampleRows.join('\n')}\n\n` +
    `## 四、Run 级明细\n\n` +
    `| Case | Answer Status | 允许 Root Cause | 检出类别 | 实际理由 | 主责任层 | 建议动作 |\n` +
    `|---|---|---|---|---|---|---|\n` +
    `${runRows.join('\n')}\n\n` +
    `## 五、安全边界\n\n` +
    `- Provider 调用：0；\n` +
    `- Prompt、Policy、Dataset 修改：否；\n` +
    `- Evidence 创建：否；\n` +
    `- Profile 更新：否；\n` +
    `- Raw Output 保存：否。\n\n` +
    `## 六、限制\n\n` +
    report.limitations.map((item) => `- ${item}`).join('\n') + '\n';
}

function runFailureLayer(runId: string): FailureLayer {
  if (PROMPT_RUN_IDS.has(runId)) return 'prompt';
  if (POLICY_RUN_IDS.has(runId)) return 'policy';
  return 'evaluator';
}

function actionFor(layer: FailureLayer): RecommendedAction {
  if (layer === 'prompt') return 'prompt_change';
  if (layer === 'policy') return 'policy_change';
  if (layer === 'dataset') return 'dataset_change';
  if (layer === 'evaluator') return 'evaluator_fix';
  return 'further_review';
}

function countLayers(values: FailureLayer[]): Record<FailureLayer, number> {
  const counts: Record<FailureLayer, number> = {
    prompt: 0,
    policy: 0,
    dataset: 0,
    evaluator: 0,
    ambiguous: 0,
  };
  for (const value of values) counts[value] += 1;
  return counts;
}

function toRunId(sampleId: string, runIndex: number): string {
  return `${sampleId}#${runIndex}`;
}

function excerpt(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= 120 ? normalized : `${normalized.slice(0, 117)}...`;
}

function uniqueLayers(values: FailureLayer[]): FailureLayer[] {
  return [...new Set(values)];
}

function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function printSummary(
  report: RootCauseFailureAttributionReport,
  outputPaths: { json: string; markdown: string },
): void {
  console.log('\nPhase 15.2 Root Cause Failure Attribution');
  console.log('='.repeat(72));
  console.log(`Source automatic rate: ${percent(report.sourceMetrics.automaticRootCauseCategory.rate)}`);
  console.log(`Reviewed: ${report.sourceMetrics.failedRuns} runs / ${report.sourceMetrics.affectedSamples} samples`);
  console.log(`Prompt: ${report.runLevelPrimaryCounts.prompt}`);
  console.log(`Policy: ${report.runLevelPrimaryCounts.policy}`);
  console.log(`Dataset: ${report.runLevelPrimaryCounts.dataset}`);
  console.log(`Evaluator: ${report.runLevelPrimaryCounts.evaluator}`);
  console.log(`Ambiguous: ${report.runLevelPrimaryCounts.ambiguous}`);
  console.log(`Reasonable actual Root Cause: ${report.attributionMetrics.reasonableActualRootCauseRuns}`);
  console.log(`Unreasonable actual Root Cause: ${report.attributionMetrics.unreasonableActualRootCauseRuns}`);
  console.log(`Projected post-attribution rate: ${percent(report.attributionMetrics.projectedPostAttributionAcceptability.rate)}`);
  console.log(`Priority: ${report.recommendation.priority}`);
  console.log(`JSON: ${outputPaths.json}`);
  console.log(`Markdown: ${outputPaths.markdown}`);
  console.log(`Result: ${report.validation.passed ? 'PASS' : 'FAIL'}`);
}

await run();
