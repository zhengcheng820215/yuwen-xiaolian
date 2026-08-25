export const PRODUCT_RUNTIME_BASELINE_AUDIT_VERSION =
  'product_runtime_baseline_audit_v1' as const;
export const PRODUCT_RUNTIME_REASON_REGISTRY_VERSION =
  'product_runtime_reason_registry_v1' as const;
export const DYNAMIC_FORMAL_RESOURCE_BASELINE_VERSION =
  'dynamic_formal_resource_baseline_v1' as const;

export const RUNTIME_DEPENDENCY_STATUSES = [
  'ready',
  'degraded',
  'blocked',
  'not_configured',
  'not_running',
  'not_checked',
  'insufficient_evidence',
] as const;
export type RuntimeDependencyStatus = typeof RUNTIME_DEPENDENCY_STATUSES[number];

export const PRODUCT_RUNTIME_REASON_CODES = [
  'runtime_unreachable',
  'runtime_health_timeout',
  'runtime_port_conflict',
  'runtime_identity_insufficient',
  'formal_store_unreadable',
  'formal_store_uninitialized',
  'formal_resource_boundary_unavailable',
  'formal_resource_baseline_inconsistent',
  'no_learning_task_available',
  'task_identity_mismatch',
  'learning_session_recovery_required',
  'learning_session_identity_mismatch',
  'submission_recovery_required',
  'submission_identity_mismatch',
  'ai_provider_not_configured',
  'ai_provider_unreachable',
  'ai_provider_status_not_checked',
  'trial_identity_mismatch',
  'trial_reentry_required',
  'trial_observation_unavailable',
  'audit_evidence_incomplete',
  'audit_zero_write_violation',
] as const;
export type ProductRuntimeReasonCode = typeof PRODUCT_RUNTIME_REASON_CODES[number];

export type ProductRuntimeReasonDefinition = {
  registryVersion: typeof PRODUCT_RUNTIME_REASON_REGISTRY_VERSION;
  code: ProductRuntimeReasonCode;
  domain: 'runtime' | 'formal_store' | 'task' | 'session' | 'submission' | 'ai' | 'trial' | 'audit';
  severity: 'information' | 'degraded' | 'blocked';
  coreLearningImpact: 'none' | 'conditional' | 'blocked';
  retryability: 'not_applicable' | 'retryable' | 'restart_required' | 'reentry_required';
  dataPreservation: 'not_started' | 'preserved' | 'unknown_requires_check';
  defaultUserProjectionKey?: string;
  internalDescription: string;
};

export type RuntimeDependencyInventoryItem = {
  dependencyId: string;
  role: string;
  requiredFor: Array<'learning_read' | 'learning_submit' | 'workbench_read' | 'workbench_ai' | 'trial_observation'>;
  status: RuntimeDependencyStatus;
  reasonCode?: ProductRuntimeReasonCode;
  evidenceCodes: string[];
  checkedAt: string;
};

export type DynamicFormalResourceBaseline = {
  schemaVersion: typeof DYNAMIC_FORMAL_RESOURCE_BASELINE_VERSION;
  observedAt: string;
  storeInitialized: boolean;
  storeRevision: number;
  storeUpdatedAt: string;
  activeMaterialCount: number;
  coreReadingMaterialCount: number;
  targetedExcerptMaterialCount: number;
  currentPlanCount: number;
  currentTaskCount: number;
  activeObservationLinkCount: number;
  activeRegistryEntryCount: number;
  currentFormalVersionCount: number;
  frozenQualityTraceCount: number;
  learningConsumableQuestionCount: number;
  latestQuality: { ready: number; guided: number; blocked: number };
  responseFormatBreakdown: Record<string, number>;
  difficultyBreakdown: Record<string, number>;
  issueCodes: string[];
  baselineDigest: string;
};

export type RuntimeIdentityInputAudit = {
  status: 'aligned' | 'mismatch' | 'insufficient_evidence' | 'not_applicable';
  gitCommit: string;
  worktreeState: 'clean' | 'dirty';
  launchGitCommit?: string;
  currentBuildVersion?: string;
  launchBuildVersion?: string;
  buildVersionUniqueness: 'content_addressed' | 'fixed_or_unverified' | 'not_available';
  trialReentryRequired: boolean;
  learningAllowed: true;
  recommendedEffectiveMode: 'off';
  reasonCodes: ProductRuntimeReasonCode[];
};

export type RuntimeRouteAudit = {
  routeId: 'learning' | 'workbench' | 'internal';
  url: string;
  reachable: boolean;
  visibleState: string;
  runtimeBoundaryReachable: boolean;
  formalResourceBoundaryReachable: boolean;
  userProjectionKey?: string;
  reasonCodes: ProductRuntimeReasonCode[];
  evidenceCodes: string[];
};

export type ProductRuntimeProtectedSnapshot = {
  formalResourceDigest: string;
  formalResourceRevision: number;
  learningDigest: string;
  calibrationDigest: string;
  trialDigest: string;
};

export type ZeroWriteComparison = {
  before: ProductRuntimeProtectedSnapshot;
  after: ProductRuntimeProtectedSnapshot;
  formalResourceWriteCount: number;
  attemptWriteCount: number;
  evidenceWriteCount: number;
  profileWriteCount: number;
  realCalibrationDenominatorWriteCount: number;
  trialStateWriteCount: number;
  verified: boolean;
};

export const PRODUCT_RUNTIME_BASELINE_FINDING_CODES = [
  'runtime_not_running',
  'runtime_state_projection_ambiguous',
  'fixed_baseline_assertion',
  'trial_build_identity_stale',
  'build_identity_not_content_addressed',
  'audit_contract_gap',
  'dependency_status_unknown',
] as const;
export type ProductRuntimeBaselineFindingCode = typeof PRODUCT_RUNTIME_BASELINE_FINDING_CODES[number];

export type ProductRuntimeBaselineFinding = {
  findingId: string;
  code: ProductRuntimeBaselineFindingCode;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  evidenceCodes: string[];
  explanation: string;
  authorizedNextWorkPackage: 'WP-R1' | 'WP-R2' | 'WP-R3' | 'WP-R4' | 'WP-R5' | 'WP-R6';
};

export type ProductRuntimeBaselineAudit = {
  schemaVersion: typeof PRODUCT_RUNTIME_BASELINE_AUDIT_VERSION;
  auditId: string;
  startedAt: string;
  completedAt: string;
  mode: 'read_only';
  git: { commit: string; worktreeState: 'clean' | 'dirty' };
  dependencies: RuntimeDependencyInventoryItem[];
  formalResourceBaseline: DynamicFormalResourceBaseline;
  identityInputAudit: RuntimeIdentityInputAudit;
  routeAudits: RuntimeRouteAudit[];
  reasonCodes: ProductRuntimeReasonCode[];
  zeroWriteComparison: ZeroWriteComparison;
  findings: ProductRuntimeBaselineFinding[];
  status: 'passed' | 'passed_with_findings' | 'failed';
  reportDigest: string;
};

export function validateRuntimeReasonRegistry(
  values: ProductRuntimeReasonDefinition[],
): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const item of values) {
    if (item.registryVersion !== PRODUCT_RUNTIME_REASON_REGISTRY_VERSION) issues.push('reason_registry_version_invalid');
    if (!(PRODUCT_RUNTIME_REASON_CODES as readonly string[]).includes(item.code)) issues.push(`reason_code_unknown:${item.code}`);
    if (!/^[a-z][a-z0-9_]*$/.test(item.code)) issues.push(`reason_code_name_invalid:${item.code}`);
    if (seen.has(item.code)) issues.push(`reason_code_duplicate:${item.code}`);
    seen.add(item.code);
    if (!item.internalDescription.trim()) issues.push(`reason_description_missing:${item.code}`);
  }
  for (const code of PRODUCT_RUNTIME_REASON_CODES) {
    if (!seen.has(code)) issues.push(`reason_code_missing:${code}`);
  }
  return [...new Set(issues)].sort();
}

export function isProductRuntimeBaselineAudit(value: unknown): value is ProductRuntimeBaselineAudit {
  if (!value || typeof value !== 'object') return false;
  const report = value as ProductRuntimeBaselineAudit;
  return report.schemaVersion === PRODUCT_RUNTIME_BASELINE_AUDIT_VERSION
    && report.mode === 'read_only'
    && Boolean(report.auditId?.trim())
    && Boolean(report.git?.commit?.trim())
    && ['clean', 'dirty'].includes(report.git?.worktreeState)
    && Array.isArray(report.dependencies)
    && report.dependencies.every((item) => Boolean(item.dependencyId?.trim())
      && (RUNTIME_DEPENDENCY_STATUSES as readonly string[]).includes(item.status))
    && report.formalResourceBaseline?.schemaVersion === DYNAMIC_FORMAL_RESOURCE_BASELINE_VERSION
    && Array.isArray(report.reasonCodes)
    && report.reasonCodes.every((code) => (PRODUCT_RUNTIME_REASON_CODES as readonly string[]).includes(code))
    && typeof report.zeroWriteComparison?.verified === 'boolean'
    && ['passed', 'passed_with_findings', 'failed'].includes(report.status)
    && Boolean(report.reportDigest?.trim());
}
