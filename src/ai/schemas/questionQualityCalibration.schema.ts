import type {
  QuestionGenerationBatchQualitySummary,
} from './questionQualityBatchSummary.schema.ts';

export const TEN_MATERIAL_CALIBRATION_MANIFEST_VERSION =
  'ten_material_calibration_manifest_v1' as const;
export const TEN_MATERIAL_CALIBRATION_REPORT_VERSION =
  'ten_material_calibration_report_v1' as const;
export const TEN_MATERIAL_CALIBRATION_REPORT_RULE_VERSION =
  'ten_material_calibration_report_rules_v1' as const;

export type TenMaterialCalibrationMaterialRef = {
  materialId: string;
  materialVersionId: string;
  title: string;
  expectedCoverageNotes: string[];
};

export type TenMaterialCalibrationManifest = {
  manifestId: string;
  calibrationSetId: string;
  calibrationSetVersion: string;
  materials: TenMaterialCalibrationMaterialRef[];
  requiredProviderId: string;
  requiredModelId: string;
  requiredPromptVersion: string;
  requiredSemanticRuleVersion: string;
  requiredMergeRuleVersion: string;
  frozenAt: string;
  version: typeof TEN_MATERIAL_CALIBRATION_MANIFEST_VERSION;
};

export type CalibrationPassDecision =
  | 'pass'
  | 'conditional_pass'
  | 'fail';

export type CalibrationAdjustmentTarget =
  | 'none'
  | 'prompt'
  | 'deterministic_rule'
  | 'semantic_rule'
  | 'merge_rule'
  | 'question_revision'
  | 'material_manifest';

export type TenMaterialCalibrationSystemChecks = {
  allMaterialsProcessed: boolean;
  allDraftsContractValidated: boolean;
  currentAssessmentCoverageComplete: boolean;
  noMixedRevision: boolean;
  noMixedRuleVersion: boolean;
  noSilentSemanticFallback: boolean;
  freezeTraceComplete: boolean;
  repeatedSummaryStable: boolean;
};

export type TenMaterialCalibrationQualitySnapshot = {
  metrics: QuestionGenerationBatchQualitySummary['metrics'];
  warningDistribution: QuestionGenerationBatchQualitySummary['warningDistribution'];
  abilityDistribution: QuestionGenerationBatchQualitySummary['abilityDistribution'];
  difficultyDistribution: QuestionGenerationBatchQualitySummary['difficultyDistribution'];
  humanDecisionDistribution: QuestionGenerationBatchQualitySummary['humanDecisionDistribution'];
};

export type TenMaterialCalibrationReport = {
  reportId: string;
  manifestId: string;
  calibrationSetId: string;
  calibrationSetVersion: string;
  batchSummaryId: string;
  systemChecks: TenMaterialCalibrationSystemChecks;
  qualitySnapshot: TenMaterialCalibrationQualitySnapshot;
  qualityObservations: string[];
  reviewerNotes: string[];
  decision: CalibrationPassDecision;
  adjustmentTarget: CalibrationAdjustmentTarget;
  decisionReason: string;
  approvedBy: string;
  approvedAt: string;
  reportRuleVersion: string;
  version: typeof TEN_MATERIAL_CALIBRATION_REPORT_VERSION;
};

export function createTenMaterialCalibrationManifest(input: Omit<
  TenMaterialCalibrationManifest,
  'manifestId' | 'version'
>): TenMaterialCalibrationManifest {
  const manifest: TenMaterialCalibrationManifest = {
    ...input,
    manifestId: createCalibrationManifestId(
      input.calibrationSetId,
      input.calibrationSetVersion,
    ),
    version: TEN_MATERIAL_CALIBRATION_MANIFEST_VERSION,
  };
  assertTenMaterialCalibrationManifest(manifest);
  return clone(manifest);
}

export function assertTenMaterialCalibrationManifest(
  value: TenMaterialCalibrationManifest,
): void {
  if (!Array.isArray(value.materials) || value.materials.length !== 10) {
    throw new Error('Ten-material calibration manifest must contain exactly 10 materials.');
  }
  const materialVersionIds = value.materials.map((item) => item.materialVersionId);
  if (new Set(materialVersionIds).size !== materialVersionIds.length) {
    throw new Error('Ten-material calibration material versions must be unique.');
  }
  const materialIds = value.materials.map((item) => item.materialId);
  if (new Set(materialIds).size !== materialIds.length) {
    throw new Error('Ten-material calibration materials must be unique.');
  }
  if (!isTenMaterialCalibrationManifest(value)) {
    throw new Error('Ten-material calibration manifest is invalid.');
  }
}

export function isTenMaterialCalibrationManifest(
  value: unknown,
): value is TenMaterialCalibrationManifest {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as TenMaterialCalibrationManifest;
  return (
    nonEmpty(manifest.manifestId) &&
    manifest.manifestId === createCalibrationManifestId(
      manifest.calibrationSetId,
      manifest.calibrationSetVersion,
    ) &&
    nonEmpty(manifest.calibrationSetId) &&
    nonEmpty(manifest.calibrationSetVersion) &&
    Array.isArray(manifest.materials) &&
    manifest.materials.length === 10 &&
    manifest.materials.every((item) => (
      nonEmpty(item.materialId) &&
      nonEmpty(item.materialVersionId) &&
      nonEmpty(item.title) &&
      stringArray(item.expectedCoverageNotes)
    )) &&
    new Set(manifest.materials.map((item) => item.materialId)).size === 10 &&
    new Set(manifest.materials.map((item) => item.materialVersionId)).size === 10 &&
    nonEmpty(manifest.requiredProviderId) &&
    nonEmpty(manifest.requiredModelId) &&
    nonEmpty(manifest.requiredPromptVersion) &&
    nonEmpty(manifest.requiredSemanticRuleVersion) &&
    nonEmpty(manifest.requiredMergeRuleVersion) &&
    nonEmpty(manifest.frozenAt) &&
    manifest.version === TEN_MATERIAL_CALIBRATION_MANIFEST_VERSION
  );
}

export function isTenMaterialCalibrationReport(
  value: unknown,
): value is TenMaterialCalibrationReport {
  if (!value || typeof value !== 'object') return false;
  const report = value as TenMaterialCalibrationReport;
  return (
    nonEmpty(report.reportId) &&
    nonEmpty(report.manifestId) &&
    nonEmpty(report.calibrationSetId) &&
    nonEmpty(report.calibrationSetVersion) &&
    nonEmpty(report.batchSummaryId) &&
    isSystemChecks(report.systemChecks) &&
    isQualitySnapshot(report.qualitySnapshot) &&
    stringArray(report.qualityObservations) &&
    stringArray(report.reviewerNotes) &&
    ['pass', 'conditional_pass', 'fail'].includes(report.decision) &&
    [
      'none',
      'prompt',
      'deterministic_rule',
      'semantic_rule',
      'merge_rule',
      'question_revision',
      'material_manifest',
    ].includes(report.adjustmentTarget) &&
    nonEmpty(report.decisionReason) &&
    nonEmpty(report.approvedBy) &&
    nonEmpty(report.approvedAt) &&
    nonEmpty(report.reportRuleVersion) &&
    report.version === TEN_MATERIAL_CALIBRATION_REPORT_VERSION
  );
}

export function allCalibrationSystemChecksPass(
  checks: TenMaterialCalibrationSystemChecks,
): boolean {
  return Object.values(checks).every(Boolean);
}

export function createCalibrationManifestId(
  calibrationSetId: string,
  calibrationSetVersion: string,
): string {
  return `calibration-manifest:${calibrationSetId.trim()}:${calibrationSetVersion.trim()}`;
}

function isSystemChecks(value: unknown): value is TenMaterialCalibrationSystemChecks {
  if (!value || typeof value !== 'object') return false;
  const checks = value as TenMaterialCalibrationSystemChecks;
  return [
    checks.allMaterialsProcessed,
    checks.allDraftsContractValidated,
    checks.currentAssessmentCoverageComplete,
    checks.noMixedRevision,
    checks.noMixedRuleVersion,
    checks.noSilentSemanticFallback,
    checks.freezeTraceComplete,
    checks.repeatedSummaryStable,
  ].every((item) => typeof item === 'boolean');
}

function isQualitySnapshot(value: unknown): value is TenMaterialCalibrationQualitySnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as TenMaterialCalibrationQualitySnapshot;
  return Boolean(
    snapshot.metrics &&
    snapshot.warningDistribution &&
    snapshot.abilityDistribution &&
    snapshot.difficultyDistribution &&
    snapshot.humanDecisionDistribution,
  );
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
