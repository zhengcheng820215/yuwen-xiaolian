export const PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT_VERSION =
  'product_complexity_convergence_v1' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION =
  'product_complexity_convergence_stage0_audit_v1' as const;

export const CONVERGENCE_AUDIENCES = [
  'authoring_user',
  'learning_student',
  'internal',
] as const;
export type ConvergenceAudience = typeof CONVERGENCE_AUDIENCES[number];

export const CONVERGENCE_SURFACE_KINDS = [
  'heading',
  'explanation',
  'status',
  'primary_action',
  'secondary_action',
  'error',
  'conditional_entry',
  'feedback',
] as const;
export type ConvergenceSurfaceKind = typeof CONVERGENCE_SURFACE_KINDS[number];

export type ConvergenceSurfaceElement = {
  elementId: string;
  kind: ConvergenceSurfaceKind;
  text: string;
  intent?: string;
  factKey?: string;
  actionable?: boolean;
  nextAction?: string;
  location?: 'local' | 'remote';
  conditionActive?: boolean;
  factSource?: 'canonical_projection' | 'local_projection' | 'parallel_derived';
};

export type ConvergenceSurfaceAuditInput = {
  schemaVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION;
  surfaceId: string;
  route: string;
  stateId: string;
  audience: ConvergenceAudience;
  elements: ConvergenceSurfaceElement[];
  feedback?: {
    issueCount: number;
    guidanceCount: number;
    expressionMode: 'adaptive' | 'fixed_template';
  };
};

export const CONDITIONAL_CAPABILITY_TYPES = [
  'revision',
  'targeted',
  'retest',
  'transfer',
  'governance',
  'calibration',
] as const;
export type ConditionalCapabilityType = typeof CONDITIONAL_CAPABILITY_TYPES[number];

export type ConditionalCapabilityAuditInput = {
  schemaVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION;
  capability: ConditionalCapabilityType;
  pathId: string;
  audience: ConvergenceAudience;
  triggerActive: boolean;
  entryVisible: boolean;
  exitAvailable: boolean;
  noActionFallbackAvailable: boolean;
  recoveryAvailable: boolean;
  recursiveDepth?: number;
  benefitCode?: string;
  factSource?: 'canonical_projection' | 'parallel_derived';
  retirementCompatibility?: boolean;
};

export const CONVERGENCE_FINDING_CODES = [
  'internal_term_exposed',
  'non_actionable_status',
  'duplicate_primary_action',
  'duplicate_state_message',
  'conditional_feature_visible_without_trigger',
  'scheduler_explanation_exposed',
  'profile_pipeline_exposed',
  'error_without_local_action',
  'hidden_error_location',
  'feedback_overloaded',
  'fixed_feedback_template',
  'conditional_exit_missing',
  'targeted_loop_risk',
  'benefit_code_unstructured',
  'parallel_fact_source_risk',
  'retirement_compatibility_missing',
] as const;
export type ConvergenceFindingCode = typeof CONVERGENCE_FINDING_CODES[number];
export type ConvergenceFindingPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type ConvergenceRecommendationStage = 1 | 2 | 3 | 4;

export type ConvergenceAuditFinding = {
  code: ConvergenceFindingCode;
  priority: ConvergenceFindingPriority;
  recommendationStage: ConvergenceRecommendationStage;
  sourceId: string;
  elementIds: string[];
  explanation: string;
};

export type ConvergenceSurfaceAuditResult = {
  surfaceId: string;
  route: string;
  stateId: string;
  audience: ConvergenceAudience;
  findings: ConvergenceAuditFinding[];
};

export type ConditionalCapabilityAuditResult = {
  pathId: string;
  capability: ConditionalCapabilityType;
  findings: ConvergenceAuditFinding[];
};

export type ConvergenceProtectedSnapshot = {
  formalResourceDigest: string;
  registryDigest: string;
  storeRevision: number;
  learningSessionDigest: string;
  learningAttemptDigest: string;
  evidenceDigest: string;
  profileDigest: string;
  calibrationDigest: string;
  learningProgressDigest: string;
};

export type ProductComplexityConvergenceStage0Report = {
  schemaVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION;
  contractVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_CONTRACT_VERSION;
  runtimeScope: 'read_only_audit';
  surfaceResults: ConvergenceSurfaceAuditResult[];
  capabilityResults: ConditionalCapabilityAuditResult[];
  findingBreakdown: Record<ConvergenceFindingCode, number>;
  priorityBreakdown: Record<ConvergenceFindingPriority, number>;
  stageBreakdown: Record<ConvergenceRecommendationStage, number>;
  beforeSnapshot: ConvergenceProtectedSnapshot;
  afterSnapshot: ConvergenceProtectedSnapshot;
  zeroWriteVerified: boolean;
  limitations: string[];
  auditDigest: string;
};

export function isConvergenceSurfaceAuditInput(
  value: unknown,
): value is ConvergenceSurfaceAuditInput {
  if (!value || typeof value !== 'object') return false;
  const input = value as ConvergenceSurfaceAuditInput;
  return input.schemaVersion === PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION
    && Boolean(input.surfaceId?.trim())
    && Boolean(input.route?.trim())
    && Boolean(input.stateId?.trim())
    && (CONVERGENCE_AUDIENCES as readonly string[]).includes(input.audience)
    && Array.isArray(input.elements)
    && input.elements.every((item) => Boolean(item?.elementId?.trim())
      && (CONVERGENCE_SURFACE_KINDS as readonly string[]).includes(item.kind)
      && typeof item.text === 'string');
}

export function isConditionalCapabilityAuditInput(
  value: unknown,
): value is ConditionalCapabilityAuditInput {
  if (!value || typeof value !== 'object') return false;
  const input = value as ConditionalCapabilityAuditInput;
  return input.schemaVersion === PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION
    && (CONDITIONAL_CAPABILITY_TYPES as readonly string[]).includes(input.capability)
    && Boolean(input.pathId?.trim())
    && (CONVERGENCE_AUDIENCES as readonly string[]).includes(input.audience)
    && typeof input.triggerActive === 'boolean'
    && typeof input.entryVisible === 'boolean'
    && typeof input.exitAvailable === 'boolean'
    && typeof input.noActionFallbackAvailable === 'boolean'
    && typeof input.recoveryAvailable === 'boolean';
}
