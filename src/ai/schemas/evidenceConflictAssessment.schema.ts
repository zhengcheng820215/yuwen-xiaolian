import type { AbilityEvidence } from './abilityEvidence.schema.ts';
import type {
  EvidenceEvaluationEligibility,
  EvidenceHintDependency,
  EvidenceQualityAssessment,
  EvidenceQualityLevel,
  EvidenceTaskNovelty,
  EvidenceTimingType,
} from './evidenceQualityAssessment.schema.ts';
import type { RetentionDifficultyRelation } from './retentionEvaluation.schema.ts';

export const EVIDENCE_CONFLICT_ASSESSMENT_SCHEMA_VERSION = 'evidence_conflict_assessment_v1' as const;
export const EVIDENCE_CONFLICT_POLICY_VERSION = 'evidence_conflict_policy_v1' as const;
export const EVALUATION_CONTEXT_ENVELOPE_SCHEMA_VERSION = 'evaluation_context_envelope_v1' as const;

export type EvidenceConflictStatus =
  | 'aligned_positive_evidence'
  | 'aligned_weakness_evidence'
  | 'explainable_mixed_evidence'
  | 'unresolved_conflict'
  | 'insufficient_comparable_evidence'
  | 'review_required';

export type EvidenceCoordinationRecommendation =
  | 'proceed_to_evaluation'
  | 'proceed_with_limitations'
  | 'collect_more_evidence'
  | 'request_discriminating_observation'
  | 'human_review';

export type EvidenceObservationDirection =
  | 'positive_signal'
  | 'weakness_signal'
  | 'mixed_signal'
  | 'insufficient_signal';

export type EvidenceDifferenceFactorType =
  | 'hint'
  | 'difficulty'
  | 'material'
  | 'timing'
  | 'task_role'
  | 'independence';

export type EvidenceDifferenceExplanatoryStrength =
  | 'strong'
  | 'plausible'
  | 'insufficient';

export type EvidenceDifferenceFactor = {
  factor: EvidenceDifferenceFactorType;
  observedDifference: boolean;
  explanatoryStrength: EvidenceDifferenceExplanatoryStrength;
  relatedObservationUnitIds: string[];
  reason: string;
};

export type EvidenceComparisonContext = {
  comparisonContextId: string;
  observationUnitId: string;
  studentId: string;
  abilityId: string;
  taskId: string;
  sourceTaskId?: string;
  executionSessionId: string;
  responseId: string;
  materialIdentity?: string;
  taskRole: string;
  taskNovelty: EvidenceTaskNovelty;
  timingType: EvidenceTimingType;
  difficultyRelation: RetentionDifficultyRelation;
  hintDependency: EvidenceHintDependency;
  observedAt: string;
  observationWindowId: string;
  repeatedExecutionOf?: string;
  source: 'formal_runtime_adapter';
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type EvidenceObservationUnitSummary = {
  observationUnitId: string;
  studentId: string;
  abilityId: string;
  direction: EvidenceObservationDirection;
  evidenceIds: string[];
  qualityAssessmentIds: string[];
  effectiveQualityLevel: EvidenceQualityLevel;
  effectiveEligibility: EvidenceEvaluationEligibility;
  taskIds: string[];
  responseIds: string[];
  taskRoles: string[];
  comparisonContextIds: string[];
  comparisonClusterId: string;
  limitations: string[];
};

export type EvidenceConflictAssessment = {
  conflictAssessmentId: string;
  studentId: string;
  abilityId: string;
  status: EvidenceConflictStatus;
  recommendation: EvidenceCoordinationRecommendation;
  observationUnits: EvidenceObservationUnitSummary[];
  observationUnitCount: number;
  comparableObservationUnitCount: number;
  independentContextCount: number;
  directionSummary: {
    positiveUnitCount: number;
    weaknessUnitCount: number;
    mixedUnitCount: number;
    insufficientUnitCount: number;
  };
  eligibleEvidenceIds: string[];
  limitedEvidenceIds: string[];
  blockedEvidenceIds: string[];
  reviewRequiredEvidenceIds: string[];
  currentQualityAssessmentIds: string[];
  supersededQualityAssessmentIds: string[];
  comparisonFacts: string[];
  differenceFactors: EvidenceDifferenceFactor[];
  conflictFactors: string[];
  limitations: string[];
  evidenceLinks: string[];
  schemaVersion: typeof EVIDENCE_CONFLICT_ASSESSMENT_SCHEMA_VERSION;
  policyVersion: typeof EVIDENCE_CONFLICT_POLICY_VERSION;
  coordinatedAt: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type EvidenceConflictCoordinationInput = {
  studentId: string;
  targetAbilityId: string;
  abilityEvidence: AbilityEvidence[];
  qualityAssessments: EvidenceQualityAssessment[];
  comparisonContexts: EvidenceComparisonContext[];
  coordinatedAt: string;
  timezone: string;
};

export type EvaluationInputMode =
  | 'legacy_full_evidence'
  | 'quality_aware_primary_evidence';

export type EvaluationCapability =
  | 'quality_context'
  | 'conflict_context'
  | 'limited_evidence'
  | 'do_not_resolve_conflict_automatically';

export type EvaluationRuntimeContract = {
  runtimeId: string;
  runtimeVersion: string;
  supportedCapabilities: EvaluationCapability[];
  source: 'registered_runtime_contract';
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type EvaluationContextAdapterInput = {
  rawEvidence: AbilityEvidence[];
  conflictAssessment: EvidenceConflictAssessment;
  currentQualityAssessments: EvidenceQualityAssessment[];
  runtimeContract: EvaluationRuntimeContract;
};

export type EvaluationContextEnvelope = {
  adapterResultId: string;
  studentId: string;
  targetAbilityId: string;
  rawEvidence: AbilityEvidence[];
  primaryEvaluationEvidence: AbilityEvidence[];
  supportingContextEvidence: AbilityEvidence[];
  observationUnits: EvidenceObservationUnitSummary[];
  conflictAssessment: EvidenceConflictAssessment;
  blockedEvidenceIds: string[];
  reviewRequiredEvidenceIds: string[];
  qualityAssessmentIds: string[];
  observationUnitIds: string[];
  evaluationInputMode: EvaluationInputMode;
  requiredEvaluationCapabilities: EvaluationCapability[];
  supportedEvaluationCapabilities: EvaluationCapability[];
  supportedByCurrentEvaluationRuntime: boolean;
  qualityProtectionApplied: boolean;
  limitations: string[];
  canEnterExistingEvaluation: boolean;
  schemaVersion: typeof EVALUATION_CONTEXT_ENVELOPE_SCHEMA_VERSION;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export const EVIDENCE_CONFLICT_STATUSES: EvidenceConflictStatus[] = [
  'aligned_positive_evidence',
  'aligned_weakness_evidence',
  'explainable_mixed_evidence',
  'unresolved_conflict',
  'insufficient_comparable_evidence',
  'review_required',
];

export const EVIDENCE_COORDINATION_RECOMMENDATIONS: EvidenceCoordinationRecommendation[] = [
  'proceed_to_evaluation',
  'proceed_with_limitations',
  'collect_more_evidence',
  'request_discriminating_observation',
  'human_review',
];

export const EVALUATION_CAPABILITIES: EvaluationCapability[] = [
  'quality_context',
  'conflict_context',
  'limited_evidence',
  'do_not_resolve_conflict_automatically',
];

export function isEvidenceComparisonContext(value: unknown): value is EvidenceComparisonContext {
  if (!value || typeof value !== 'object') return false;
  const context = value as EvidenceComparisonContext;
  return (
    isNonEmptyString(context.comparisonContextId) &&
    isNonEmptyString(context.observationUnitId) &&
    isNonEmptyString(context.studentId) &&
    isNonEmptyString(context.abilityId) &&
    isNonEmptyString(context.taskId) &&
    (context.sourceTaskId === undefined || isNonEmptyString(context.sourceTaskId)) &&
    isNonEmptyString(context.executionSessionId) &&
    isNonEmptyString(context.responseId) &&
    (context.materialIdentity === undefined || isNonEmptyString(context.materialIdentity)) &&
    isNonEmptyString(context.taskRole) &&
    ['same', 'similar', 'transfer', 'unknown'].includes(context.taskNovelty) &&
    ['immediate', 'delayed', 'unknown'].includes(context.timingType) &&
    ['lower', 'comparable', 'higher', 'unknown'].includes(context.difficultyRelation) &&
    ['none', 'low', 'medium', 'high', 'unknown'].includes(context.hintDependency) &&
    isTimestamp(context.observedAt) &&
    isNonEmptyString(context.observationWindowId) &&
    (context.repeatedExecutionOf === undefined || isNonEmptyString(context.repeatedExecutionOf)) &&
    context.source === 'formal_runtime_adapter' &&
    isValidation(context.validation)
  );
}

export function isEvidenceDifferenceFactor(value: unknown): value is EvidenceDifferenceFactor {
  if (!value || typeof value !== 'object') return false;
  const factor = value as EvidenceDifferenceFactor;
  return (
    ['hint', 'difficulty', 'material', 'timing', 'task_role', 'independence'].includes(factor.factor) &&
    typeof factor.observedDifference === 'boolean' &&
    ['strong', 'plausible', 'insufficient'].includes(factor.explanatoryStrength) &&
    nonEmptyStringArray(factor.relatedObservationUnitIds) &&
    isNonEmptyString(factor.reason)
  );
}

export function isEvidenceObservationUnitSummary(value: unknown): value is EvidenceObservationUnitSummary {
  if (!value || typeof value !== 'object') return false;
  const unit = value as EvidenceObservationUnitSummary;
  return (
    isNonEmptyString(unit.observationUnitId) &&
    isNonEmptyString(unit.studentId) &&
    isNonEmptyString(unit.abilityId) &&
    ['positive_signal', 'weakness_signal', 'mixed_signal', 'insufficient_signal'].includes(unit.direction) &&
    nonEmptyStringArray(unit.evidenceIds) &&
    nonEmptyStringArray(unit.qualityAssessmentIds) &&
    ['high', 'medium', 'low', 'insufficient'].includes(unit.effectiveQualityLevel) &&
    ['eligible', 'limited', 'blocked', 'review_required'].includes(unit.effectiveEligibility) &&
    nonEmptyStringArray(unit.taskIds) &&
    nonEmptyStringArray(unit.responseIds) &&
    nonEmptyStringArray(unit.taskRoles) &&
    nonEmptyStringArray(unit.comparisonContextIds) &&
    isNonEmptyString(unit.comparisonClusterId) &&
    stringArray(unit.limitations)
  );
}

export function isEvidenceConflictAssessment(value: unknown): value is EvidenceConflictAssessment {
  if (!value || typeof value !== 'object') return false;
  const assessment = value as EvidenceConflictAssessment;
  const allClassifiedIds = [
    ...assessment.eligibleEvidenceIds,
    ...assessment.limitedEvidenceIds,
    ...assessment.blockedEvidenceIds,
    ...assessment.reviewRequiredEvidenceIds,
  ];
  return (
    isNonEmptyString(assessment.conflictAssessmentId) &&
    isNonEmptyString(assessment.studentId) &&
    isNonEmptyString(assessment.abilityId) &&
    EVIDENCE_CONFLICT_STATUSES.includes(assessment.status) &&
    EVIDENCE_COORDINATION_RECOMMENDATIONS.includes(assessment.recommendation) &&
    Array.isArray(assessment.observationUnits) &&
    assessment.observationUnits.every(isEvidenceObservationUnitSummary) &&
    isNonNegativeInteger(assessment.observationUnitCount) &&
    isNonNegativeInteger(assessment.comparableObservationUnitCount) &&
    isNonNegativeInteger(assessment.independentContextCount) &&
    isDirectionSummary(assessment.directionSummary) &&
    stringArray(assessment.eligibleEvidenceIds) &&
    stringArray(assessment.limitedEvidenceIds) &&
    stringArray(assessment.blockedEvidenceIds) &&
    stringArray(assessment.reviewRequiredEvidenceIds) &&
    new Set(allClassifiedIds).size === allClassifiedIds.length &&
    stringArray(assessment.currentQualityAssessmentIds) &&
    stringArray(assessment.supersededQualityAssessmentIds) &&
    nonEmptyStringArray(assessment.comparisonFacts) &&
    Array.isArray(assessment.differenceFactors) &&
    assessment.differenceFactors.every(isEvidenceDifferenceFactor) &&
    stringArray(assessment.conflictFactors) &&
    stringArray(assessment.limitations) &&
    nonEmptyStringArray(assessment.evidenceLinks) &&
    assessment.schemaVersion === EVIDENCE_CONFLICT_ASSESSMENT_SCHEMA_VERSION &&
    assessment.policyVersion === EVIDENCE_CONFLICT_POLICY_VERSION &&
    isTimestamp(assessment.coordinatedAt) &&
    isValidation(assessment.validation)
  );
}

export function isEvaluationRuntimeContract(value: unknown): value is EvaluationRuntimeContract {
  if (!value || typeof value !== 'object') return false;
  const contract = value as EvaluationRuntimeContract;
  return (
    isNonEmptyString(contract.runtimeId) &&
    isNonEmptyString(contract.runtimeVersion) &&
    Array.isArray(contract.supportedCapabilities) &&
    contract.supportedCapabilities.every((item) => EVALUATION_CAPABILITIES.includes(item)) &&
    contract.source === 'registered_runtime_contract' &&
    isValidation(contract.validation)
  );
}

export function isEvaluationContextEnvelope(value: unknown): value is EvaluationContextEnvelope {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as EvaluationContextEnvelope;
  return (
    isNonEmptyString(envelope.adapterResultId) &&
    isNonEmptyString(envelope.studentId) &&
    isNonEmptyString(envelope.targetAbilityId) &&
    Array.isArray(envelope.rawEvidence) &&
    Array.isArray(envelope.primaryEvaluationEvidence) &&
    Array.isArray(envelope.supportingContextEvidence) &&
    Array.isArray(envelope.observationUnits) &&
    envelope.observationUnits.every(isEvidenceObservationUnitSummary) &&
    isEvidenceConflictAssessment(envelope.conflictAssessment) &&
    stringArray(envelope.blockedEvidenceIds) &&
    stringArray(envelope.reviewRequiredEvidenceIds) &&
    stringArray(envelope.qualityAssessmentIds) &&
    stringArray(envelope.observationUnitIds) &&
    ['legacy_full_evidence', 'quality_aware_primary_evidence'].includes(envelope.evaluationInputMode) &&
    Array.isArray(envelope.requiredEvaluationCapabilities) &&
    envelope.requiredEvaluationCapabilities.every((item) => EVALUATION_CAPABILITIES.includes(item)) &&
    Array.isArray(envelope.supportedEvaluationCapabilities) &&
    envelope.supportedEvaluationCapabilities.every((item) => EVALUATION_CAPABILITIES.includes(item)) &&
    typeof envelope.supportedByCurrentEvaluationRuntime === 'boolean' &&
    typeof envelope.qualityProtectionApplied === 'boolean' &&
    stringArray(envelope.limitations) &&
    typeof envelope.canEnterExistingEvaluation === 'boolean' &&
    envelope.schemaVersion === EVALUATION_CONTEXT_ENVELOPE_SCHEMA_VERSION &&
    isValidation(envelope.validation)
  );
}

function isDirectionSummary(value: unknown): value is EvidenceConflictAssessment['directionSummary'] {
  if (!value || typeof value !== 'object') return false;
  const summary = value as EvidenceConflictAssessment['directionSummary'];
  return [
    summary.positiveUnitCount,
    summary.weaknessUnitCount,
    summary.mixedUnitCount,
    summary.insufficientUnitCount,
  ].every(isNonNegativeInteger);
}

function isValidation(value: unknown): value is { passed: boolean; issues: string[] } {
  if (!value || typeof value !== 'object') return false;
  const validation = value as { passed: boolean; issues: string[] };
  return typeof validation.passed === 'boolean' && stringArray(validation.issues);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}
