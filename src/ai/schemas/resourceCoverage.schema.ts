import type { RecommendedTaskRole } from './nextLearningStrategy.schema.ts';
import type {
  FrozenQuestionResourceVersion,
  PrimaryAbilityId,
  QuestionMaterialVersion,
  QuestionResourceDifficulty,
  QuestionResponseFormat,
  ResourceRegistryEntry,
  ResourceReviewDecision,
  ResourceValidationResult,
  StructuredQuestionType,
} from './questionResourceAdmission.schema.ts';

export const RESOURCE_COVERAGE_SCHEMA_VERSION = 'resource_coverage_v1' as const;
export const RESOURCE_COVERAGE_POLICY_VERSION = 'phase17_1_policy_v1' as const;
export const PRODUCT_EXECUTABLE_CAPABILITY_VERSION = 'phase17_1_product_capability_v2' as const;

export const RESOURCE_COVERAGE_STATUSES = [
  'covered',
  'thin',
  'gap',
  'blocked',
  'not_planned',
] as const;

export type ResourceCoverageStatus = typeof RESOURCE_COVERAGE_STATUSES[number];

export const PRODUCT_EXECUTABLE_CAPABILITY_STATUSES = [
  'accepted',
  'resource_only',
  'blocked',
] as const;

export type ProductExecutableCapabilityStatus =
  typeof PRODUCT_EXECUTABLE_CAPABILITY_STATUSES[number];

export const RESOURCE_COVERAGE_GAP_CODES = [
  'no_current_frozen_resource',
  'insufficient_executable_resources',
  'insufficient_material_clusters',
  'insufficient_independent_contexts',
  'missing_required_difficulty',
  'question_type_not_product_executable',
  'response_format_not_product_executable',
  'missing_material_identity',
  'missing_rubric_or_answer_requirement',
  'review_or_validation_untraceable',
  'resource_not_frozen_active',
  'question_type_not_allowed_by_policy',
  'registry_current_version_missing',
  'registry_version_identity_mismatch',
  'registry_consistency_failed',
  'unsupported_ability',
  'unsupported_task_role',
  'unsupported_difficulty',
  'policy_target_not_configured',
] as const;

export type ResourceCoverageGapCode = typeof RESOURCE_COVERAGE_GAP_CODES[number];

export type ResourceCoverageCellKey = {
  abilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
};

export type CoveragePolicyTarget = ResourceCoverageCellKey & {
  planned: boolean;
  minimumExecutableResourceCount: number;
  minimumMaterialClusterCount: number;
  minimumIndependentContextCount: number;
  requiredDifficulties: QuestionResourceDifficulty[];
  allowedQuestionTypes: StructuredQuestionType[];
};

export type ResourceCoveragePolicy = {
  policyId: string;
  policyVersion: typeof RESOURCE_COVERAGE_POLICY_VERSION;
  schemaVersion: typeof RESOURCE_COVERAGE_SCHEMA_VERSION;
  targets: CoveragePolicyTarget[];
  createdAt: string;
};

export type ProductExecutableCapabilitySnapshot = {
  capabilitySnapshotId: string;
  capabilityVersion: typeof PRODUCT_EXECUTABLE_CAPABILITY_VERSION;
  schemaVersion: typeof RESOURCE_COVERAGE_SCHEMA_VERSION;
  questionTypes: Record<StructuredQuestionType, ProductExecutableCapabilityStatus>;
  responseFormats: Record<QuestionResponseFormat, ProductExecutableCapabilityStatus>;
  createdAt: string;
};

export type ResourceCoverageSourceSnapshot = {
  registryEntries: ResourceRegistryEntry[];
  frozenVersions: FrozenQuestionResourceVersion[];
  validations: ResourceValidationResult[];
  reviews: ResourceReviewDecision[];
  materials: QuestionMaterialVersion[];
};

export type ResourceRegistrySnapshot = {
  registrySnapshotId: string;
  registrySchemaVersion: string;
  policyId: string;
  capabilitySnapshotId: string;
  registryEntryIds: string[];
  currentResourceVersionIds: string[];
  materialVersionIds: string[];
  contentHash: string;
  capturedAt: string;
};

export type MaterialClusterCoverageView = {
  materialClusterId: string;
  materialId: string;
  currentMaterialVersionIds: string[];
  currentExecutableResourceIds: string[];
  abilityIds: PrimaryAbilityId[];
  taskRoles: RecommendedTaskRole[];
  limitations: string[];
};

export type ResourceCoverageBreakdown<T extends string> = Record<T, number>;

export type ResourceCoverageCell = {
  key: ResourceCoverageCellKey;
  status: ResourceCoverageStatus;
  currentExecutableResourceIds: string[];
  resourceVersionIds: string[];
  materialClusterIds: string[];
  executableResourceCount: number;
  materialClusterCount: number;
  independentContextCount: number;
  difficultyBreakdown: ResourceCoverageBreakdown<QuestionResourceDifficulty>;
  questionTypeBreakdown: ResourceCoverageBreakdown<StructuredQuestionType>;
  responseFormatBreakdown: ResourceCoverageBreakdown<QuestionResponseFormat>;
  limitations: string[];
  gapIds: string[];
};

export type ResourceCoverageRecommendedActionCode =
  | 'add_resource'
  | 'add_material_cluster'
  | 'repair_resource_metadata'
  | 'complete_review_or_freeze'
  | 'enable_product_capability'
  | 'repair_registry'
  | 'review_policy';

export type ResourceCoverageGap = {
  gapId: string;
  cellKey: ResourceCoverageCellKey;
  code: ResourceCoverageGapCode;
  severity: 'info' | 'warning' | 'blocking';
  affectedResourceIds: string[];
  materialClusterIds: string[];
  reason: string;
  recommendedActionCode: ResourceCoverageRecommendedActionCode;
};

export type RejectedCoverageRecord = {
  rejectedRecordId: string;
  resourceId?: string;
  resourceVersionId?: string;
  registryEntryId?: string;
  issueCodes: ResourceCoverageGapCode[];
  rejectedAt: string;
};

export type ResourceCoverageReport = {
  reportId: string;
  reportVersion: typeof RESOURCE_COVERAGE_POLICY_VERSION;
  schemaVersion: typeof RESOURCE_COVERAGE_SCHEMA_VERSION;
  registrySnapshot: ResourceRegistrySnapshot;
  policyId: string;
  capabilitySnapshotId: string;
  materialClusters: MaterialClusterCoverageView[];
  cells: ResourceCoverageCell[];
  gaps: ResourceCoverageGap[];
  rejectedRecords: RejectedCoverageRecord[];
  summary: {
    coveredCellCount: number;
    thinCellCount: number;
    gapCellCount: number;
    blockedCellCount: number;
    notPlannedCellCount: number;
    executableResourceCount: number;
    materialClusterCount: number;
    independentContextCount: number;
  };
  generatedAt: string;
};

export type ResourceCoverageGenerationInput = {
  source: ResourceCoverageSourceSnapshot;
  policy: ResourceCoveragePolicy;
  capabilitySnapshot: ProductExecutableCapabilitySnapshot;
  generatedAt: string;
};

export type ResourceCoverageGenerationResult =
  | {
      status: 'complete';
      report: ResourceCoverageReport;
      issues: string[];
    }
  | {
      status: 'blocked';
      issues: string[];
    };

export type ResourceCoverageDashboardCell = {
  cellId: string;
  abilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
  status: ResourceCoverageStatus;
  executableResourceCount: number;
  materialClusterCount: number;
  independentContextCount: number;
  gapCodes: ResourceCoverageGapCode[];
};

export type ResourceCoverageDashboardViewModel = {
  reportId: string;
  registrySnapshotId: string;
  policyId: string;
  capabilitySnapshotId: string;
  cells: ResourceCoverageDashboardCell[];
  materialClusters: MaterialClusterCoverageView[];
  summary: ResourceCoverageReport['summary'];
  rejectedRecordCount: number;
  generatedAt: string;
};

export function isResourceCoveragePolicy(value: unknown): value is ResourceCoveragePolicy {
  if (!value || typeof value !== 'object') return false;
  const policy = value as ResourceCoveragePolicy;
  return (
    isNonEmptyString(policy.policyId) &&
    policy.policyVersion === RESOURCE_COVERAGE_POLICY_VERSION &&
    policy.schemaVersion === RESOURCE_COVERAGE_SCHEMA_VERSION &&
    isTimestamp(policy.createdAt) &&
    Array.isArray(policy.targets) &&
    policy.targets.every(isCoveragePolicyTarget)
  );
}

export function isProductExecutableCapabilitySnapshot(
  value: unknown,
): value is ProductExecutableCapabilitySnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as ProductExecutableCapabilitySnapshot;
  return (
    isNonEmptyString(snapshot.capabilitySnapshotId) &&
    snapshot.capabilityVersion === PRODUCT_EXECUTABLE_CAPABILITY_VERSION &&
    snapshot.schemaVersion === RESOURCE_COVERAGE_SCHEMA_VERSION &&
    isTimestamp(snapshot.createdAt) &&
    isCapabilityRecord(snapshot.questionTypes) &&
    isCapabilityRecord(snapshot.responseFormats)
  );
}

export function isResourceCoverageReport(value: unknown): value is ResourceCoverageReport {
  if (!value || typeof value !== 'object') return false;
  const report = value as ResourceCoverageReport;
  return (
    isNonEmptyString(report.reportId) &&
    report.reportVersion === RESOURCE_COVERAGE_POLICY_VERSION &&
    report.schemaVersion === RESOURCE_COVERAGE_SCHEMA_VERSION &&
    isNonEmptyString(report.registrySnapshot?.registrySnapshotId) &&
    report.policyId === report.registrySnapshot.policyId &&
    report.capabilitySnapshotId === report.registrySnapshot.capabilitySnapshotId &&
    Array.isArray(report.materialClusters) &&
    Array.isArray(report.cells) &&
    report.cells.every(isResourceCoverageCell) &&
    Array.isArray(report.gaps) &&
    Array.isArray(report.rejectedRecords) &&
    isTimestamp(report.generatedAt)
  );
}

export function isResourceCoverageGenerationResult(
  value: unknown,
): value is ResourceCoverageGenerationResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as ResourceCoverageGenerationResult;
  if (!Array.isArray(result.issues)) return false;
  if (result.status === 'blocked') return true;
  return result.status === 'complete' && isResourceCoverageReport(result.report);
}

export function isResourceCoverageDashboardViewModel(
  value: unknown,
): value is ResourceCoverageDashboardViewModel {
  if (!value || typeof value !== 'object') return false;
  const dashboard = value as ResourceCoverageDashboardViewModel;
  return (
    isNonEmptyString(dashboard.reportId) &&
    isNonEmptyString(dashboard.registrySnapshotId) &&
    Array.isArray(dashboard.cells) &&
    Array.isArray(dashboard.materialClusters) &&
    Number.isInteger(dashboard.rejectedRecordCount) &&
    isTimestamp(dashboard.generatedAt)
  );
}

function isCoveragePolicyTarget(value: unknown): value is CoveragePolicyTarget {
  if (!value || typeof value !== 'object') return false;
  const target = value as CoveragePolicyTarget;
  return (
    isNonEmptyString(target.abilityId) &&
    isNonEmptyString(target.taskRole) &&
    typeof target.planned === 'boolean' &&
    isNonNegativeInteger(target.minimumExecutableResourceCount) &&
    isNonNegativeInteger(target.minimumMaterialClusterCount) &&
    isNonNegativeInteger(target.minimumIndependentContextCount) &&
    Array.isArray(target.requiredDifficulties) &&
    Array.isArray(target.allowedQuestionTypes)
  );
}

function isResourceCoverageCell(value: unknown): value is ResourceCoverageCell {
  if (!value || typeof value !== 'object') return false;
  const cell = value as ResourceCoverageCell;
  return (
    isNonEmptyString(cell.key?.abilityId) &&
    isNonEmptyString(cell.key?.taskRole) &&
    RESOURCE_COVERAGE_STATUSES.includes(cell.status) &&
    Array.isArray(cell.currentExecutableResourceIds) &&
    Array.isArray(cell.resourceVersionIds) &&
    Array.isArray(cell.materialClusterIds) &&
    isNonNegativeInteger(cell.executableResourceCount) &&
    isNonNegativeInteger(cell.materialClusterCount) &&
    isNonNegativeInteger(cell.independentContextCount) &&
    Array.isArray(cell.limitations) &&
    Array.isArray(cell.gapIds)
  );
}

function isCapabilityRecord(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).every((status) => (
    PRODUCT_EXECUTABLE_CAPABILITY_STATUSES.includes(status as ProductExecutableCapabilityStatus)
  ));
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}
