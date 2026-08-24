export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_SCHEMA_VERSION =
  'product_complexity_convergence_stage3_feedback_profile_projection_v1' as const;
export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_EXPRESSION_POLICY_VERSION =
  'product_complexity_convergence_stage3_expression_policy_v1' as const;

export const CONVERGENCE_FEEDBACK_FOCUS_KINDS = [
  'confirmed_understanding',
  'primary_actionable_gap',
  'revision_change',
  'insufficient_to_judge',
  'recovery_only',
] as const;
export type ConvergenceFeedbackFocusKind = typeof CONVERGENCE_FEEDBACK_FOCUS_KINDS[number];

export const CONVERGENCE_FEEDBACK_FOCUS_REASON_CODES = [
  'answer_meets_current_requirement',
  'required_gap_selected',
  'partial_required_gap_selected',
  'revision_gap_resolved',
  'revision_gap_partially_resolved',
  'revision_gap_unresolved',
  'formal_result_insufficient',
  'feedback_identity_mismatch',
  'structured_focus_unavailable',
  'runtime_recovery_required',
] as const;
export type ConvergenceFeedbackFocusReasonCode =
  typeof CONVERGENCE_FEEDBACK_FOCUS_REASON_CODES[number];

export const CONVERGENCE_FEEDBACK_SOURCE_TYPES = [
  'student_learning_feedback',
  'formal_diagnosis',
  'requirement_coverage',
  'feedback_action_plan',
  'revision_evaluation',
] as const;
export type ConvergenceFeedbackSourceType = typeof CONVERGENCE_FEEDBACK_SOURCE_TYPES[number];

export type ConvergenceFeedbackSourceRef = {
  sourceType: ConvergenceFeedbackSourceType;
  sourceId: string;
  sourceSchemaVersion?: string;
};

export const CONVERGENCE_FEEDBACK_BLOCK_KINDS = [
  'acknowledgement', 'primary_gap', 'next_action', 'recovery',
] as const;
export type ConvergenceFeedbackBlockKind = typeof CONVERGENCE_FEEDBACK_BLOCK_KINDS[number];

export type ConvergenceFeedbackDisplayBlock = {
  kind: ConvergenceFeedbackBlockKind;
  text: string;
  sourceRefIds: string[];
};

export const CONVERGENCE_FEEDBACK_ACTION_KINDS = [
  'continue', 'revise_once', 'retry_analysis', 'recover_saved_state',
] as const;
export type ConvergenceFeedbackActionKind = typeof CONVERGENCE_FEEDBACK_ACTION_KINDS[number];

export type ConvergenceFeedbackActionProjection = {
  kind: ConvergenceFeedbackActionKind;
  label: string;
  existingCommand: string;
  enabled: boolean;
};

export type ConvergenceFeedbackPresentation = {
  schemaVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_SCHEMA_VERSION;
  expressionPolicyVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_EXPRESSION_POLICY_VERSION;
  projectionId: string;
  projectionHash: string;
  persistenceRole: 'presentation_projection';
  studentId: string;
  learningRoundId: string;
  learningTaskAttemptId?: string;
  feedbackId: string;
  focusKind: ConvergenceFeedbackFocusKind;
  focusReasonCode: ConvergenceFeedbackFocusReasonCode;
  primaryRequirementId?: string;
  sourceRefs: ConvergenceFeedbackSourceRef[];
  blocks: ConvergenceFeedbackDisplayBlock[];
  actions: ConvergenceFeedbackActionProjection[];
  fallbackUsed: boolean;
  validation: {
    passed: boolean;
    identityAligned: boolean;
    grounded: boolean;
    singleFocus: boolean;
    actionAligned: boolean;
    studentSafe: boolean;
    issues: string[];
  };
};

export const CORE_ABILITY_SUMMARY_STATUSES = [
  'stable', 'developing', 'uncertain', 'needs_attention',
] as const;
export type CoreAbilitySummaryStatus = typeof CORE_ABILITY_SUMMARY_STATUSES[number];

export const CORE_ABILITY_SUMMARY_CONFIDENCE = ['low', 'medium', 'high'] as const;
export type CoreAbilitySummaryConfidence = typeof CORE_ABILITY_SUMMARY_CONFIDENCE[number];

export type CoreAbilitySummary = {
  schemaVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_SCHEMA_VERSION;
  projectionId: string;
  persistenceRole: 'profile_read_model';
  studentId: string;
  sourceProfileGeneratedAt: string;
  abilityId: string;
  status: CoreAbilitySummaryStatus;
  confidence: CoreAbilitySummaryConfidence;
  recentEvidenceSummary: string;
  lastUpdatedAt: string;
  sourceEvidenceCount: number;
  validation: {
    passed: boolean;
    sourceProfileValid: boolean;
    noNewAbilityInference: boolean;
    noUnsupportedPrecision: boolean;
    issues: string[];
  };
};

export type ConvergenceStage3PresentationFlag = 'legacy' | 'convergence_v1';

export function buildConvergenceFeedbackProjectionIdentity(input: {
  studentId: string;
  learningRoundId: string;
  feedbackId: string;
  stableInput: unknown;
}): { projectionId: string; projectionHash: string } {
  const identityHash = stableHash(stableSerialize({
    studentId: input.studentId,
    learningRoundId: input.learningRoundId,
    feedbackId: input.feedbackId,
    schemaVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_SCHEMA_VERSION,
    expressionPolicyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_EXPRESSION_POLICY_VERSION,
  }));
  return {
    projectionId: `convergence-feedback-${identityHash}`,
    projectionHash: stableHash(stableSerialize(input.stableInput)),
  };
}

export function buildCoreAbilitySummaryProjectionId(input: {
  studentId: string;
  abilityId: string;
  sourceProfileGeneratedAt: string;
}): string {
  return `convergence-profile-${stableHash(stableSerialize(input))}`;
}

export function isConvergenceFeedbackPresentation(
  value: unknown,
): value is ConvergenceFeedbackPresentation {
  if (!value || typeof value !== 'object') return false;
  const item = value as ConvergenceFeedbackPresentation;
  const issues = validateConvergenceFeedbackPresentation(item);
  return issues.length === 0 && item.validation?.passed === true;
}

export function validateConvergenceFeedbackPresentation(
  item: ConvergenceFeedbackPresentation,
): string[] {
  const issues: string[] = [];
  if (item.schemaVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_SCHEMA_VERSION) issues.push('schema_version_invalid');
  if (item.expressionPolicyVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_EXPRESSION_POLICY_VERSION) issues.push('policy_version_invalid');
  if (!nonEmpty(item.projectionId) || !nonEmpty(item.projectionHash)) issues.push('projection_identity_invalid');
  if (item.persistenceRole !== 'presentation_projection') issues.push('persistence_role_invalid');
  if (!nonEmpty(item.studentId) || !nonEmpty(item.learningRoundId) || !nonEmpty(item.feedbackId)) issues.push('source_identity_invalid');
  if (!CONVERGENCE_FEEDBACK_FOCUS_KINDS.includes(item.focusKind)) issues.push('focus_kind_invalid');
  if (!CONVERGENCE_FEEDBACK_FOCUS_REASON_CODES.includes(item.focusReasonCode)) issues.push('focus_reason_invalid');
  if (!Array.isArray(item.sourceRefs) || item.sourceRefs.length === 0 || !item.sourceRefs.every(isSourceRef)) issues.push('source_refs_invalid');
  if (!Array.isArray(item.blocks) || item.blocks.length > 3 || !item.blocks.every(isDisplayBlock)) issues.push('blocks_invalid');
  if (!Array.isArray(item.actions) || !item.actions.every(isAction)) issues.push('actions_invalid');
  const kinds = item.blocks.map((block) => block.kind);
  if (new Set(kinds).size !== kinds.length) issues.push('duplicate_block_kind');
  if (kinds.includes('recovery') && kinds.some((kind) => kind !== 'recovery')) issues.push('recovery_mixed_with_learning_feedback');
  if (item.focusKind === 'primary_actionable_gap' && !nonEmpty(item.primaryRequirementId)) issues.push('primary_requirement_missing');
  if (item.focusKind === 'recovery_only' && !kinds.includes('recovery')) issues.push('recovery_block_missing');
  if (!item.validation || typeof item.validation !== 'object') issues.push('validation_missing');
  return unique(issues);
}

export function isCoreAbilitySummary(value: unknown): value is CoreAbilitySummary {
  if (!value || typeof value !== 'object') return false;
  const item = value as CoreAbilitySummary;
  return item.schemaVersion === PRODUCT_COMPLEXITY_CONVERGENCE_STAGE3_SCHEMA_VERSION
    && nonEmpty(item.projectionId)
    && item.persistenceRole === 'profile_read_model'
    && nonEmpty(item.studentId)
    && timestamp(item.sourceProfileGeneratedAt)
    && nonEmpty(item.abilityId)
    && CORE_ABILITY_SUMMARY_STATUSES.includes(item.status)
    && CORE_ABILITY_SUMMARY_CONFIDENCE.includes(item.confidence)
    && nonEmpty(item.recentEvidenceSummary)
    && timestamp(item.lastUpdatedAt)
    && nonNegativeInteger(item.sourceEvidenceCount)
    && item.sourceEvidenceCount > 0
    && item.validation?.passed === true
    && item.validation.sourceProfileValid === true
    && item.validation.noNewAbilityInference === true
    && item.validation.noUnsupportedPrecision === true
    && Array.isArray(item.validation.issues)
    && item.validation.issues.length === 0;
}

function isSourceRef(value: unknown): value is ConvergenceFeedbackSourceRef {
  if (!value || typeof value !== 'object') return false;
  const item = value as ConvergenceFeedbackSourceRef;
  return CONVERGENCE_FEEDBACK_SOURCE_TYPES.includes(item.sourceType)
    && nonEmpty(item.sourceId)
    && (item.sourceSchemaVersion === undefined || nonEmpty(item.sourceSchemaVersion));
}

function isDisplayBlock(value: unknown): value is ConvergenceFeedbackDisplayBlock {
  if (!value || typeof value !== 'object') return false;
  const item = value as ConvergenceFeedbackDisplayBlock;
  return CONVERGENCE_FEEDBACK_BLOCK_KINDS.includes(item.kind)
    && nonEmpty(item.text)
    && Array.isArray(item.sourceRefIds)
    && item.sourceRefIds.length > 0
    && item.sourceRefIds.every(nonEmpty);
}

function isAction(value: unknown): value is ConvergenceFeedbackActionProjection {
  if (!value || typeof value !== 'object') return false;
  const item = value as ConvergenceFeedbackActionProjection;
  return CONVERGENCE_FEEDBACK_ACTION_KINDS.includes(item.kind)
    && nonEmpty(item.label)
    && nonEmpty(item.existingCommand)
    && typeof item.enabled === 'boolean';
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function nonEmpty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function timestamp(value: unknown): value is string { return nonEmpty(value) && !Number.isNaN(Date.parse(value)); }
function nonNegativeInteger(value: unknown): value is number { return Number.isInteger(value) && Number(value) >= 0; }
function unique(values: string[]): string[] { return [...new Set(values)]; }
