import {
  DIAGNOSIS_CALIBRATION_REPORT_SCHEMA_VERSION,
  DIAGNOSIS_QUALITY_POLICY_V21,
  type DiagnosisCalibrationReport,
  type DiagnosisQualityEvaluationV2,
  type DiagnosisQualityPolicyVersion,
  type DiagnosisStabilityEvaluationV2,
  type MetricCount,
} from '../schemas/diagnosisQualityPolicyV2.schema.ts';
import type { DiagnosisSampleCategory } from '../schemas/diagnosisQualityEvaluation.schema.ts';

export function buildDiagnosisCalibrationReport(input: {
  reportId: string;
  createdAt: string;
  sourceReportId: string;
  datasetVersion: string;
  annotationVersion: string;
  promptVersion: string;
  provider: string;
  model: string;
  evaluations: DiagnosisQualityEvaluationV2[];
  stability: DiagnosisStabilityEvaluationV2[];
  categoryBySampleId: Map<string, DiagnosisSampleCategory>;
  policyVersion?: DiagnosisQualityPolicyVersion;
}): DiagnosisCalibrationReport {
  const { evaluations } = input;
  const reasonableAlternative = evaluations.filter((item) =>
    input.categoryBySampleId.get(item.sampleId) === 'reasonable_alternative'
  );
  const conciseValid = evaluations.filter((item) =>
    input.categoryBySampleId.get(item.sampleId) === 'concise_valid'
  );
  const falsePositiveFindingCount = countFindings(evaluations, 'evaluator_false_positive');
  const confirmedModelIssueFindingCount = countFindings(evaluations, 'confirmed_model_issue');
  const mixedIssueRunCount = evaluations.filter((item) => {
    const attributions = new Set(item.reviewFindings.map((finding) => finding.attribution));
    return attributions.has('evaluator_false_positive') && attributions.has('confirmed_model_issue');
  }).length;
  const criticalCount = evaluations.filter((item) => item.qualityLevel === 'critical_violation').length;
  const validationFailures = evaluations.filter((item) => !item.validation.passed).length;
  const limitations = [
    '本报告只重评优先人工复核包中已经保存的 Candidate Snapshot。',
    '本次没有调用 Provider，也没有生成新的模型输出。',
    '来源复核包不包含 concise_valid Candidate，因此本轮无法计算简短有效答案专项指标。',
    '在完整 Dataset v1 重新运行或恢复全部原始 Candidate Snapshot 前，Policy v2 校准结果不等于完整 Prompt v3 Calibrated Baseline。',
  ];
  return {
    schemaVersion: DIAGNOSIS_CALIBRATION_REPORT_SCHEMA_VERSION,
    reportId: input.reportId,
    createdAt: input.createdAt,
    sourceReportId: input.sourceReportId,
    datasetVersion: input.datasetVersion,
    annotationVersion: input.annotationVersion,
    policyVersion: input.policyVersion || DIAGNOSIS_QUALITY_POLICY_V21,
    promptVersion: input.promptVersion,
    provider: input.provider,
    model: input.model,
    providerCallsMade: 0,
    candidateRunCount: evaluations.length,
    sampleCount: new Set(evaluations.map((item) => item.sampleId)).size,
    qualityCounts: {
      accepted: countQuality(evaluations, 'accepted'),
      questionable: countQuality(evaluations, 'questionable'),
      unacceptable: countQuality(evaluations, 'unacceptable'),
      critical_violation: criticalCount,
    },
    boundaryStabilityCounts: {
      stable_within_boundary: countStability(input.stability, 'boundaryStability', 'stable_within_boundary'),
      boundary_unstable: countStability(input.stability, 'boundaryStability', 'boundary_unstable'),
      critical_violation: countStability(input.stability, 'boundaryStability', 'critical_violation'),
      insufficient_runs: countStability(input.stability, 'boundaryStability', 'insufficient_runs'),
    },
    qualityStabilityCounts: {
      stable_accepted: countStability(input.stability, 'qualityStability', 'stable_accepted'),
      stable_questionable: countStability(input.stability, 'qualityStability', 'stable_questionable'),
      quality_unstable: countStability(input.stability, 'qualityStability', 'quality_unstable'),
      critical_violation: countStability(input.stability, 'qualityStability', 'critical_violation'),
      insufficient_runs: countStability(input.stability, 'qualityStability', 'insufficient_runs'),
    },
    modelQuality: {
      mainAbility: metric(evaluations, (item) => item.dimensions.mainAbilityAccepted),
      answerStatus: metric(evaluations, (item) => item.dimensions.answerStatusAccepted),
      rootCauseCategory: metric(evaluations, (item) => item.dimensions.rootCauseCategoryAccepted),
      reasonableAlternativeAcceptance: metric(
        reasonableAlternative,
        (item) => item.qualityLevel === 'accepted',
      ),
      conciseValidAcceptance: metric(
        conciseValid,
        (item) => item.qualityLevel === 'accepted',
      ),
    },
    evaluatorQuality: {
      falsePositiveFindingCount,
      confirmedModelIssueFindingCount,
      mixedIssueRunCount,
      humanReviewRunCount: evaluations.filter((item) => item.offlineDecision !== 'accepted_candidate').length,
    },
    evaluations,
    stability: input.stability,
    conclusion: criticalCount === 0 && validationFailures === 0
      ? 'policy_calibration_pass'
      : 'policy_calibration_requires_review',
    limitations,
  };
}

function metric(
  items: DiagnosisQualityEvaluationV2[],
  predicate: (item: DiagnosisQualityEvaluationV2) => boolean,
): MetricCount {
  const numerator = items.filter(predicate).length;
  const denominator = items.length;
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? 0 : numerator / denominator,
  };
}

function countQuality(
  items: DiagnosisQualityEvaluationV2[],
  quality: DiagnosisQualityEvaluationV2['qualityLevel'],
): number {
  return items.filter((item) => item.qualityLevel === quality).length;
}

function countFindings(
  items: DiagnosisQualityEvaluationV2[],
  attribution: DiagnosisQualityEvaluationV2['reviewFindings'][number]['attribution'],
): number {
  return items.flatMap((item) => item.reviewFindings)
    .filter((finding) => finding.attribution === attribution).length;
}

function countStability<K extends 'boundaryStability' | 'qualityStability'>(
  items: DiagnosisStabilityEvaluationV2[],
  key: K,
  value: DiagnosisStabilityEvaluationV2[K],
): number {
  return items.filter((item) => item[key] === value).length;
}
