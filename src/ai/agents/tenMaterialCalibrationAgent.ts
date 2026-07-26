import {
  TEN_MATERIAL_CALIBRATION_REPORT_RULE_VERSION,
  TEN_MATERIAL_CALIBRATION_REPORT_VERSION,
  allCalibrationSystemChecksPass,
  assertTenMaterialCalibrationManifest,
  type CalibrationAdjustmentTarget,
  type CalibrationPassDecision,
  type TenMaterialCalibrationManifest,
  type TenMaterialCalibrationReport,
  type TenMaterialCalibrationSystemChecks,
} from '../schemas/questionQualityCalibration.schema.ts';
import type {
  FrozenQuestionQualityTrace,
} from '../schemas/questionQualityPersistence.schema.ts';
import type {
  QuestionGenerationBatchQualitySummary,
} from '../schemas/questionQualityBatchSummary.schema.ts';
import type {
  QuestionSemanticQualityAssessment,
} from '../schemas/questionSemanticQualityAssessment.schema.ts';

export type TenMaterialCalibrationInput = {
  manifest: TenMaterialCalibrationManifest;
  summary: QuestionGenerationBatchQualitySummary;
  repeatedSummary: QuestionGenerationBatchQualitySummary;
  semanticAssessments: QuestionSemanticQualityAssessment[];
  expectedFrozenResourceVersionIds: string[];
  frozenQualityTraces: FrozenQuestionQualityTrace[];
  qualityObservations: string[];
  reviewerNotes: string[];
  decision: CalibrationPassDecision;
  adjustmentTarget: CalibrationAdjustmentTarget;
  decisionReason: string;
  approvedBy: string;
  approvedAt: string;
};

export function createTenMaterialCalibrationReport(
  input: TenMaterialCalibrationInput,
): TenMaterialCalibrationReport {
  assertTenMaterialCalibrationManifest(input.manifest);
  assertText(input.approvedBy, 'approvedBy');
  assertText(input.approvedAt, 'approvedAt');
  assertText(input.decisionReason, 'decisionReason');
  if (input.qualityObservations.length === 0) {
    throw new Error('Calibration quality observations are required.');
  }
  const systemChecks = evaluateTenMaterialCalibrationSystemChecks(input);
  const allChecksPass = allCalibrationSystemChecksPass(systemChecks);
  if (!allChecksPass && input.decision !== 'fail') {
    throw new Error('Calibration hard checks failed; decision must be fail.');
  }
  if (input.decision === 'pass' && input.adjustmentTarget !== 'none') {
    throw new Error('Pass decision cannot declare an adjustment target.');
  }
  if (
    (input.decision === 'conditional_pass' || input.decision === 'fail') &&
    input.adjustmentTarget === 'none'
  ) {
    throw new Error(`${input.decision} must declare an adjustment target.`);
  }
  if (input.decision === 'conditional_pass' && input.reviewerNotes.length === 0) {
    throw new Error('Conditional pass requires reviewer limitations or follow-up notes.');
  }
  const reportId = createCalibrationReportId(input);
  return {
    reportId,
    manifestId: input.manifest.manifestId,
    calibrationSetId: input.manifest.calibrationSetId,
    calibrationSetVersion: input.manifest.calibrationSetVersion,
    batchSummaryId: input.summary.summaryId,
    systemChecks,
    qualitySnapshot: {
      metrics: clone(input.summary.metrics),
      warningDistribution: clone(input.summary.warningDistribution),
      abilityDistribution: clone(input.summary.abilityDistribution),
      difficultyDistribution: clone(input.summary.difficultyDistribution),
      humanDecisionDistribution: clone(input.summary.humanDecisionDistribution),
    },
    qualityObservations: clone(input.qualityObservations),
    reviewerNotes: clone(input.reviewerNotes),
    decision: input.decision,
    adjustmentTarget: input.adjustmentTarget,
    decisionReason: input.decisionReason.trim(),
    approvedBy: input.approvedBy.trim(),
    approvedAt: input.approvedAt,
    reportRuleVersion: TEN_MATERIAL_CALIBRATION_REPORT_RULE_VERSION,
    version: TEN_MATERIAL_CALIBRATION_REPORT_VERSION,
  };
}

export function evaluateTenMaterialCalibrationSystemChecks(
  input: Pick<
    TenMaterialCalibrationInput,
    | 'manifest'
    | 'summary'
    | 'repeatedSummary'
    | 'semanticAssessments'
    | 'expectedFrozenResourceVersionIds'
    | 'frozenQualityTraces'
  >,
): TenMaterialCalibrationSystemChecks {
  const manifestMaterialVersions = sorted(
    input.manifest.materials.map((item) => item.materialVersionId),
  );
  const summaryMaterialVersions = sorted(input.summary.materialVersionIds);
  const relevantSemantic = input.semanticAssessments.filter((item) => (
    manifestMaterialVersions.includes(item.materialVersionId)
  ));
  const noMixedRuleVersion = (
    input.summary.status !== 'mixed_versions' &&
    input.summary.deterministicRuleVersions.length === 1 &&
    sameList(
      input.summary.semanticRuleVersions,
      [input.manifest.requiredSemanticRuleVersion],
    ) &&
    sameList(
      input.summary.promptVersions,
      [input.manifest.requiredPromptVersion],
    ) &&
    sameList(
      input.summary.mergeRuleVersions,
      [input.manifest.requiredMergeRuleVersion],
    ) &&
    relevantSemantic.every((item) => (
      item.providerId === input.manifest.requiredProviderId &&
      item.modelId === input.manifest.requiredModelId &&
      item.promptVersion === input.manifest.requiredPromptVersion &&
      item.semanticRuleVersion === input.manifest.requiredSemanticRuleVersion
    ))
  );
  const tracedResourceVersionIds = new Set(
    input.frozenQualityTraces.map((item) => item.resourceVersionId),
  );
  return {
    allMaterialsProcessed: sameList(
      summaryMaterialVersions,
      manifestMaterialVersions,
    ),
    allDraftsContractValidated:
      input.summary.metrics.contractValidationPassRate.value === 1,
    currentAssessmentCoverageComplete:
      input.summary.status === 'complete' &&
      input.summary.metrics.currentAssessmentCoverage.value === 1,
    noMixedRevision:
      input.summary.status !== 'mixed_versions' &&
      !input.summary.issues.some((issue) => /revision/i.test(issue)),
    noMixedRuleVersion,
    noSilentSemanticFallback:
      relevantSemantic.length >= input.summary.counts.draftCount &&
      relevantSemantic.every((item) => item.status === 'completed') &&
      input.summary.decisionDistribution.semantic_unavailable === 0,
    freezeTraceComplete:
      input.expectedFrozenResourceVersionIds.length > 0 &&
      input.expectedFrozenResourceVersionIds.every(
        (resourceVersionId) => tracedResourceVersionIds.has(resourceVersionId),
      ),
    repeatedSummaryStable: summariesAreStable(
      input.summary,
      input.repeatedSummary,
    ),
  };
}

function summariesAreStable(
  left: QuestionGenerationBatchQualitySummary,
  right: QuestionGenerationBatchQualitySummary,
): boolean {
  return (
    left.summaryId === right.summaryId &&
    JSON.stringify(left.counts) === JSON.stringify(right.counts) &&
    JSON.stringify(left.metrics) === JSON.stringify(right.metrics) &&
    JSON.stringify(left.decisionDistribution) ===
      JSON.stringify(right.decisionDistribution) &&
    JSON.stringify(left.warningDistribution) ===
      JSON.stringify(right.warningDistribution) &&
    JSON.stringify(left.abilityDistribution) ===
      JSON.stringify(right.abilityDistribution) &&
    JSON.stringify(left.difficultyDistribution) ===
      JSON.stringify(right.difficultyDistribution) &&
    JSON.stringify(left.humanDecisionDistribution) ===
      JSON.stringify(right.humanDecisionDistribution)
  );
}

function createCalibrationReportId(input: TenMaterialCalibrationInput): string {
  const identity = [
    input.manifest.manifestId,
    input.summary.summaryId,
    input.decision,
    input.adjustmentTarget,
    input.approvedBy.trim(),
    input.approvedAt,
    TEN_MATERIAL_CALIBRATION_REPORT_RULE_VERSION,
  ].join('|');
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `calibration-report-${(hash >>> 0).toString(36)}`;
}

function sameList(left: string[], right: string[]): boolean {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function sorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function assertText(value: string, field: string): void {
  if (!value?.trim()) throw new Error(`${field} is required.`);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
