import type {
  CurrentLearningContext,
  NextLearningAction,
  NextLearningStrategy,
  RecommendedTaskRole,
  StrategyValidationResult,
  TaskRequest,
} from './nextLearningStrategy.schema.ts';
import {
  isTaskRequest,
  NEXT_LEARNING_ACTIONS,
  RECOMMENDED_TASK_ROLES,
} from './nextLearningStrategy.schema.ts';
import type { EvidenceConflictAssessment } from './evidenceConflictAssessment.schema.ts';
import { EVIDENCE_CONFLICT_STATUSES } from './evidenceConflictAssessment.schema.ts';
import type { EvidenceQualityAssessment } from './evidenceQualityAssessment.schema.ts';

export const ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION = 'adaptive_task_constraints_v1' as const;
export const ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION = 'adaptive_task_constraints_policy_v1' as const;
export const ADAPTIVE_TASK_CONTEXT_SCHEMA_VERSION = 'adaptive_task_context_v1' as const;
export const ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION = 'adaptive_task_request_envelope_v1' as const;

export type AdaptiveLearningIntent =
  | 'foundation'
  | 'consolidation'
  | 'independent_validation'
  | 'delayed_validation'
  | 'transfer_validation'
  | 'diagnostic_observation'
  | 'discriminating_observation';

export type AdaptiveObservationTarget =
  | 'strengthen_foundation'
  | 'recheck_weakness'
  | 'verify_independence'
  | 'verify_retention'
  | 'verify_transfer'
  | 'resolve_direction_conflict'
  | 'collect_comparable_evidence';

export type AdaptiveDifficultyDirection = 'decrease' | 'maintain' | 'increase';
export type AdaptiveMaterialNovelty = 'same_context' | 'similar_context' | 'new_context';
export type AdaptiveHintPolicy = 'allow_guidance' | 'limited_hint' | 'no_hint';
export type AdaptiveTargetEvidenceQuality = 'medium' | 'high';

export type AdaptiveConstraintCode =
  | 'task_role'
  | 'target_ability'
  | 'difficulty'
  | 'material_novelty'
  | 'hint_policy'
  | 'exclude_task'
  | 'exclude_material'
  | 'required_capability';

export type AdaptiveConstraintOperator = 'eq' | 'in' | 'exclude' | 'required';
export type AdaptiveConstraintSource = 'strategy' | 'quality' | 'conflict';

export type AdaptiveConstraintRule = {
  code: AdaptiveConstraintCode;
  operator: AdaptiveConstraintOperator;
  value: string | string[] | boolean;
  source: AdaptiveConstraintSource;
};

export type PreExecutionQualityConditions = {
  requireNovelMaterial: boolean;
  requireKnownDifficulty: boolean;
  requireAbilityAlignment: boolean;
  requiredHintPolicy: AdaptiveHintPolicy;
  requireTraceability: boolean;
};

export type AdaptiveTaskContextSnapshot = {
  contextId: string;
  studentId: string;
  targetAbilityId: string;
  currentDifficultyLevel?: string;
  recentTaskIds: string[];
  recentMaterialIds: string[];
  allowedTaskRoles: RecommendedTaskRole[];
  allowedHintPolicies: AdaptiveHintPolicy[];
  sourceLearningContextId: string;
  activeSessionId?: string;
  timezone: string;
  schemaVersion: typeof ADAPTIVE_TASK_CONTEXT_SCHEMA_VERSION;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type AdaptiveTaskConstraints = {
  constraintsId: string;
  studentId: string;
  targetAbilityId: string;
  sourceStrategyId: string;
  sourceStrategyAction: NextLearningAction;
  sourceStrategyTaskRole: RecommendedTaskRole;
  sourceValidationGoal: string;
  sourceContextSnapshotId: string;
  sourceConflictAssessmentId: string;
  sourceConflictStatus: EvidenceConflictAssessment['status'];
  sourceQualityAssessmentIds: string[];
  sourceEvidenceIds: string[];
  sourceObservationUnitIds: string[];
  learningIntent: AdaptiveLearningIntent;
  observationTarget: AdaptiveObservationTarget;
  recommendedTaskRole: RecommendedTaskRole;
  difficultyDirection: AdaptiveDifficultyDirection;
  materialNovelty: AdaptiveMaterialNovelty;
  hintPolicy: AdaptiveHintPolicy;
  targetEvidenceQuality: AdaptiveTargetEvidenceQuality;
  preExecutionQualityConditions: PreExecutionQualityConditions;
  requiredCapabilities: string[];
  hardConstraints: AdaptiveConstraintRule[];
  softPreferences: AdaptiveConstraintRule[];
  reasons: string[];
  limitations: string[];
  schemaVersion: typeof ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION;
  policyVersion: typeof ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION;
  generatedAt: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type AdaptiveTaskConstraintsInput = {
  strategy: NextLearningStrategy;
  strategyValidationResult: StrategyValidationResult;
  currentLearningContext: CurrentLearningContext;
  adaptiveTaskContext: AdaptiveTaskContextSnapshot;
  qualityAssessments: EvidenceQualityAssessment[];
  conflictAssessment: EvidenceConflictAssessment;
  generatedAt: string;
  timezone: string;
};

export type AdaptiveTaskConstraintsStatus =
  | 'generated'
  | 'blocked'
  | 'review_required'
  | 'regenerate_strategy';

export type AdaptiveTaskConstraintsResult = {
  status: AdaptiveTaskConstraintsStatus;
  constraints: AdaptiveTaskConstraints | null;
  issues: string[];
};

export type StrategyConstraintAlignmentStatus =
  | 'aligned'
  | 'strategy_mismatch'
  | 'review_required'
  | 'blocked';

export type StrategyConstraintAlignmentNextStep =
  | 'create_task_request'
  | 'regenerate_strategy'
  | 'human_review'
  | 'blocked';

export type StrategyConstraintAlignmentResult = {
  alignmentId: string;
  strategyId: string;
  constraintsId: string;
  contextSnapshotId: string;
  status: StrategyConstraintAlignmentStatus;
  checks: {
    identityAligned: boolean;
    strategyValidationPassed: boolean;
    sourceStrategyAligned: boolean;
    targetAbilityAligned: boolean;
    taskRoleAligned: boolean;
    validationGoalAligned: boolean;
    difficultyAllowed: boolean;
    materialAllowed: boolean;
    hintPolicyAllowed: boolean;
    contextAllowed: boolean;
    conflictAllowed: boolean;
  };
  canCreateTaskRequest: boolean;
  nextStep: StrategyConstraintAlignmentNextStep;
  issues: string[];
  warnings: string[];
  alignedAt: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type AdaptiveTaskRequestEnvelope = {
  envelopeId: string;
  taskRequest: TaskRequest;
  adaptiveConstraints: AdaptiveTaskConstraints;
  alignmentResult: StrategyConstraintAlignmentResult;
  constraintsId: string;
  canEnterTaskFulfillment: boolean;
  schemaVersion: typeof ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export const ADAPTIVE_HINT_POLICIES: AdaptiveHintPolicy[] = [
  'allow_guidance',
  'limited_hint',
  'no_hint',
];

export const ADAPTIVE_CONSTRAINT_CODES: AdaptiveConstraintCode[] = [
  'task_role',
  'target_ability',
  'difficulty',
  'material_novelty',
  'hint_policy',
  'exclude_task',
  'exclude_material',
  'required_capability',
];

export function isAdaptiveTaskContextSnapshot(value: unknown): value is AdaptiveTaskContextSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as AdaptiveTaskContextSnapshot;
  return (
    isNonEmptyString(snapshot.contextId) &&
    isNonEmptyString(snapshot.studentId) &&
    isNonEmptyString(snapshot.targetAbilityId) &&
    (snapshot.currentDifficultyLevel === undefined || isNonEmptyString(snapshot.currentDifficultyLevel)) &&
    stringArray(snapshot.recentTaskIds) &&
    stringArray(snapshot.recentMaterialIds) &&
    nonEmptyStringArray(snapshot.allowedTaskRoles) &&
    snapshot.allowedTaskRoles.every((role) => ['training', 'retest', 'transfer', 'diagnosis', 'observation'].includes(role)) &&
    nonEmptyStringArray(snapshot.allowedHintPolicies) &&
    snapshot.allowedHintPolicies.every((policy) => ADAPTIVE_HINT_POLICIES.includes(policy)) &&
    isNonEmptyString(snapshot.sourceLearningContextId) &&
    (snapshot.activeSessionId === undefined || isNonEmptyString(snapshot.activeSessionId)) &&
    isNonEmptyString(snapshot.timezone) &&
    snapshot.schemaVersion === ADAPTIVE_TASK_CONTEXT_SCHEMA_VERSION &&
    isValidation(snapshot.validation)
  );
}

export function isAdaptiveConstraintRule(value: unknown): value is AdaptiveConstraintRule {
  if (!value || typeof value !== 'object') return false;
  const rule = value as AdaptiveConstraintRule;
  if (
    !ADAPTIVE_CONSTRAINT_CODES.includes(rule.code) ||
    !['eq', 'in', 'exclude', 'required'].includes(rule.operator) ||
    !['strategy', 'quality', 'conflict'].includes(rule.source) ||
    !isRuleValue(rule.value)
  ) return false;

  const allowedOperators: Record<AdaptiveConstraintCode, AdaptiveConstraintOperator[]> = {
    task_role: ['eq', 'in'],
    target_ability: ['eq'],
    difficulty: ['eq', 'in'],
    material_novelty: ['eq', 'in'],
    hint_policy: ['eq', 'in'],
    exclude_task: ['exclude'],
    exclude_material: ['exclude'],
    required_capability: ['required', 'in'],
  };
  if (!allowedOperators[rule.code].includes(rule.operator)) return false;
  if (rule.operator === 'eq') return isNonEmptyString(rule.value);
  if (rule.operator === 'in' || rule.operator === 'exclude') return nonEmptyStringArray(rule.value);
  return typeof rule.value === 'boolean' || isNonEmptyString(rule.value) || nonEmptyStringArray(rule.value);
}

export function isAdaptiveTaskConstraints(value: unknown): value is AdaptiveTaskConstraints {
  if (!value || typeof value !== 'object') return false;
  const constraints = value as AdaptiveTaskConstraints;
  return (
    isNonEmptyString(constraints.constraintsId) &&
    isNonEmptyString(constraints.studentId) &&
    isNonEmptyString(constraints.targetAbilityId) &&
    isNonEmptyString(constraints.sourceStrategyId) &&
    NEXT_LEARNING_ACTIONS.includes(constraints.sourceStrategyAction) &&
    RECOMMENDED_TASK_ROLES.includes(constraints.sourceStrategyTaskRole) &&
    isNonEmptyString(constraints.sourceValidationGoal) &&
    isNonEmptyString(constraints.sourceContextSnapshotId) &&
    isNonEmptyString(constraints.sourceConflictAssessmentId) &&
    EVIDENCE_CONFLICT_STATUSES.includes(constraints.sourceConflictStatus) &&
    nonEmptyStringArray(constraints.sourceQualityAssessmentIds) &&
    nonEmptyStringArray(constraints.sourceEvidenceIds) &&
    nonEmptyStringArray(constraints.sourceObservationUnitIds) &&
    ['foundation', 'consolidation', 'independent_validation', 'delayed_validation', 'transfer_validation', 'diagnostic_observation', 'discriminating_observation'].includes(constraints.learningIntent) &&
    ['strengthen_foundation', 'recheck_weakness', 'verify_independence', 'verify_retention', 'verify_transfer', 'resolve_direction_conflict', 'collect_comparable_evidence'].includes(constraints.observationTarget) &&
    RECOMMENDED_TASK_ROLES.includes(constraints.recommendedTaskRole) &&
    ['decrease', 'maintain', 'increase'].includes(constraints.difficultyDirection) &&
    ['same_context', 'similar_context', 'new_context'].includes(constraints.materialNovelty) &&
    ADAPTIVE_HINT_POLICIES.includes(constraints.hintPolicy) &&
    ['medium', 'high'].includes(constraints.targetEvidenceQuality) &&
    isPreExecutionQualityConditions(constraints.preExecutionQualityConditions) &&
    nonEmptyStringArray(constraints.requiredCapabilities) &&
    nonEmptyRules(constraints.hardConstraints) &&
    Array.isArray(constraints.softPreferences) && constraints.softPreferences.every(isAdaptiveConstraintRule) &&
    nonEmptyStringArray(constraints.reasons) &&
    stringArray(constraints.limitations) &&
    constraints.schemaVersion === ADAPTIVE_TASK_CONSTRAINTS_SCHEMA_VERSION &&
    constraints.policyVersion === ADAPTIVE_TASK_CONSTRAINTS_POLICY_VERSION &&
    isTimestamp(constraints.generatedAt) &&
    isValidation(constraints.validation)
  );
}

export function isStrategyConstraintAlignmentResult(value: unknown): value is StrategyConstraintAlignmentResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as StrategyConstraintAlignmentResult;
  return (
    isNonEmptyString(result.alignmentId) &&
    isNonEmptyString(result.strategyId) &&
    isNonEmptyString(result.constraintsId) &&
    isNonEmptyString(result.contextSnapshotId) &&
    ['aligned', 'strategy_mismatch', 'review_required', 'blocked'].includes(result.status) &&
    isAlignmentChecks(result.checks) &&
    typeof result.canCreateTaskRequest === 'boolean' &&
    ['create_task_request', 'regenerate_strategy', 'human_review', 'blocked'].includes(result.nextStep) &&
    stringArray(result.issues) &&
    stringArray(result.warnings) &&
    isTimestamp(result.alignedAt) &&
    isValidation(result.validation) &&
    (result.status === 'aligned'
      ? result.canCreateTaskRequest && result.nextStep === 'create_task_request'
      : !result.canCreateTaskRequest && result.nextStep !== 'create_task_request')
  );
}

export function isAdaptiveTaskRequestEnvelope(value: unknown): value is AdaptiveTaskRequestEnvelope {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as AdaptiveTaskRequestEnvelope;
  return (
    isNonEmptyString(envelope.envelopeId) &&
    isTaskRequest(envelope.taskRequest) &&
    isAdaptiveTaskConstraints(envelope.adaptiveConstraints) &&
    isStrategyConstraintAlignmentResult(envelope.alignmentResult) &&
    isNonEmptyString(envelope.constraintsId) &&
    typeof envelope.canEnterTaskFulfillment === 'boolean' &&
    envelope.schemaVersion === ADAPTIVE_TASK_REQUEST_ENVELOPE_SCHEMA_VERSION &&
    isValidation(envelope.validation) &&
    envelope.constraintsId === envelope.adaptiveConstraints.constraintsId &&
    envelope.alignmentResult.constraintsId === envelope.constraintsId &&
    envelope.taskRequest.strategyId === envelope.adaptiveConstraints.sourceStrategyId &&
    envelope.taskRequest.studentId === envelope.adaptiveConstraints.studentId &&
    envelope.taskRequest.targetAbilityId === envelope.adaptiveConstraints.targetAbilityId &&
    envelope.taskRequest.taskRole === envelope.adaptiveConstraints.recommendedTaskRole &&
    envelope.canEnterTaskFulfillment === (
      envelope.validation.passed &&
      envelope.alignmentResult.status === 'aligned' &&
      envelope.alignmentResult.canCreateTaskRequest
    )
  );
}

function isPreExecutionQualityConditions(value: unknown): value is PreExecutionQualityConditions {
  if (!value || typeof value !== 'object') return false;
  const conditions = value as PreExecutionQualityConditions;
  return (
    typeof conditions.requireNovelMaterial === 'boolean' &&
    typeof conditions.requireKnownDifficulty === 'boolean' &&
    typeof conditions.requireAbilityAlignment === 'boolean' &&
    ADAPTIVE_HINT_POLICIES.includes(conditions.requiredHintPolicy) &&
    typeof conditions.requireTraceability === 'boolean'
  );
}

function isAlignmentChecks(value: unknown): value is StrategyConstraintAlignmentResult['checks'] {
  if (!value || typeof value !== 'object') return false;
  const checks = value as StrategyConstraintAlignmentResult['checks'];
  const expectedKeys: (keyof StrategyConstraintAlignmentResult['checks'])[] = [
    'identityAligned',
    'strategyValidationPassed',
    'sourceStrategyAligned',
    'targetAbilityAligned',
    'taskRoleAligned',
    'validationGoalAligned',
    'difficultyAllowed',
    'materialAllowed',
    'hintPolicyAllowed',
    'contextAllowed',
    'conflictAllowed',
  ];
  return expectedKeys.every((key) => typeof checks[key] === 'boolean');
}

function isRuleValue(value: unknown): value is AdaptiveConstraintRule['value'] {
  if (typeof value === 'boolean') return true;
  if (isNonEmptyString(value)) return true;
  return nonEmptyStringArray(value);
}

function isValidation(value: unknown): value is { passed: boolean; issues: string[] } {
  if (!value || typeof value !== 'object') return false;
  const validation = value as { passed: boolean; issues: string[] };
  return typeof validation.passed === 'boolean' && stringArray(validation.issues);
}

function nonEmptyRules(value: unknown): value is AdaptiveConstraintRule[] {
  return Array.isArray(value) && value.length > 0 && value.every(isAdaptiveConstraintRule);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
