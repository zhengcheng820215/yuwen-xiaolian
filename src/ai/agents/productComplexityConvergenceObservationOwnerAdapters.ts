import type { ConvergenceObservationSourceFact } from './productComplexityConvergenceObservationAgent.ts';
import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_SOURCE_REGISTRY_ENTRY_VERSION,
  buildConvergenceSourceRegistrySnapshot,
  validateConvergenceSourceRegistryEntry,
  type ConvergenceObservationSourceRegistryEntry,
  type ConvergenceObservationSourceRegistrySnapshot,
} from '../schemas/productComplexityConvergenceTrialPreflight.schema.ts';
import type {
  ComplexityConvergenceCapability,
  ComplexityConvergenceLifecycleStage,
  ComplexityConvergenceObservedOutcomeCode,
  ConvergenceObservationDataOrigin,
} from '../schemas/productComplexityConvergenceObservation.schema.ts';

export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OWNER_ADAPTER_VERSION =
  'product_complexity_convergence_stage4_owner_adapters_v1' as const;

export type ConvergenceFormalOwnerFact = {
  capability: ComplexityConvergenceCapability;
  ownerFactType: string;
  ownerSchemaVersion: string;
  studentId: string;
  learningSessionId?: string;
  learningRoundId?: string;
  learningTaskAttemptId?: string;
  sourceDecisionId?: string;
  sourceResultId?: string;
  sourceEvidenceIds?: string[];
  lifecycleStage: ComplexityConvergenceLifecycleStage;
  outcomeCode: ComplexityConvergenceObservedOutcomeCode;
  occurredAt: string;
  dataOrigin: ConvergenceObservationDataOrigin;
  runtimeScope: 'product' | 'internal';
  identityAligned: boolean;
  sourceFactValidated: boolean;
};

export type ConvergenceOwnerAdapterResult = {
  accepted: boolean;
  sourceFacts: ConvergenceObservationSourceFact[];
  issueCodes: string[];
};

const COMMON_IDENTITY_FIELDS = ['studentId', 'sourceDecisionId|sourceResultId'] as const;

export const CONVERGENCE_STAGE4_SOURCE_REGISTRY_ENTRIES: ConvergenceObservationSourceRegistryEntry[] = [
  entry('revision', 'learning_feedback_revision', 'revision_evaluation',
    ['learning_feedback_revision_v1'], 'resolve_revision_gap',
    ['eligible', 'not_triggered', 'triggered', 'completed', 'interrupted'],
    ['eligible_not_triggered', 'triggered_pending', 'revision_gap_resolved_supported',
      'revision_gap_partially_resolved_supported', 'revision_gap_unresolved', 'runtime_interrupted']),
  entry('targeted_micro_training', 'targeted_micro_training', 'targeted_training_result',
    ['targeted_micro_training_scheduling_v1'], 'isolate_atomic_gap',
    ['eligible', 'not_triggered', 'triggered', 'completed', 'interrupted'],
    ['eligible_not_triggered', 'triggered_pending', 'completed_without_outcome',
      'targeted_gap_resolved_supported',
      'targeted_gap_unresolved', 'runtime_interrupted']),
  entry('retest', 'delayed_retest', 'retest_result',
    ['delayed_retest_scheduling_v1'], 'verify_independent_retention',
    ['eligible', 'not_triggered', 'triggered', 'completed', 'interrupted', 'follow_up_observed'],
    ['eligible_not_triggered', 'triggered_pending', 'retest_independent_retained',
      'retest_independent_not_retained', 'runtime_interrupted']),
  entry('transfer', 'learning_task_request', 'transfer_result',
    ['next_learning_task_request_v1'], 'verify_transfer',
    ['eligible', 'not_triggered', 'triggered', 'completed', 'interrupted', 'follow_up_observed'],
    ['eligible_not_triggered', 'triggered_pending', 'transfer_independent_succeeded',
      'transfer_independent_not_succeeded', 'runtime_interrupted']),
  entry('successor_governance', 'question_resource_governance', 'successor_governance_result',
    ['question_revision_v1'], 'repair_resource_risk',
    ['triggered', 'completed', 'interrupted'],
    ['triggered_pending', 'resource_risk_repaired', 'resource_risk_unresolved', 'runtime_interrupted']),
  entry('calibration_review', 'question_calibration', 'calibration_review_result',
    ['question_quality_calibration_v1'], 'review_calibration_evidence',
    ['eligible', 'triggered', 'completed', 'interrupted'],
    ['triggered_pending', 'calibration_review_completed', 'integrity_blocked', 'runtime_interrupted']),
  entry('feedback_projection', 'learning_feedback_projection', 'feedback_projection_result',
    ['product_complexity_convergence_feedback_projection_v1'], 'clarify_primary_feedback_focus',
    ['eligible', 'completed', 'fallback'],
    ['feedback_action_followed', 'feedback_projection_fallback', 'observation_unavailable']),
  entry('core_ability_summary', 'student_profile_projection', 'core_ability_summary_result',
    ['product_complexity_convergence_profile_projection_v1'], 'summarize_stable_profile',
    ['eligible', 'completed', 'fallback'],
    ['profile_summary_available', 'profile_summary_insufficient_evidence', 'observation_unavailable']),
];

export function buildDefaultConvergenceSourceRegistrySnapshot(
  generatedAt: string,
): ConvergenceObservationSourceRegistrySnapshot {
  return buildConvergenceSourceRegistrySnapshot({
    entries: CONVERGENCE_STAGE4_SOURCE_REGISTRY_ENTRIES,
    generatedAt,
  });
}

export function adaptConvergenceFormalOwnerFact(
  ownerFact: ConvergenceFormalOwnerFact,
  registrySnapshot: ConvergenceObservationSourceRegistrySnapshot,
): ConvergenceOwnerAdapterResult {
  const entry = registrySnapshot.entries.find((candidate) => candidate.capability === ownerFact.capability);
  if (!entry) return rejected('owner_registry_entry_missing');
  const registryIssues = validateConvergenceSourceRegistryEntry(entry);
  if (registryIssues.length) return { accepted: false, sourceFacts: [], issueCodes: registryIssues };
  if (entry.ownerFactType !== ownerFact.ownerFactType) return rejected('owner_fact_type_mismatch');
  if (!entry.ownerSchemaVersions.includes(ownerFact.ownerSchemaVersion)) return rejected('owner_schema_version_not_registered');
  if (!entry.allowedLifecycleStages.includes(ownerFact.lifecycleStage)) return rejected('owner_lifecycle_not_allowed');
  if (!entry.allowedOutcomeCodes.includes(ownerFact.outcomeCode)) return rejected('owner_outcome_not_allowed');
  if (!ownerFact.studentId.trim()) return rejected('owner_student_identity_missing');
  if (!ownerFact.sourceDecisionId && !ownerFact.sourceResultId) return rejected('owner_source_identity_missing');
  if (containsForbiddenContentKey(ownerFact)) return rejected('owner_fact_contains_student_content');
  return {
    accepted: true,
    issueCodes: [],
    sourceFacts: [{
      capability: ownerFact.capability,
      expectedBenefitCode: entry.expectedBenefitCode,
      studentId: ownerFact.studentId,
      learningSessionId: ownerFact.learningSessionId,
      learningRoundId: ownerFact.learningRoundId,
      learningTaskAttemptId: ownerFact.learningTaskAttemptId,
      sourceDecisionId: ownerFact.sourceDecisionId,
      sourceResultId: ownerFact.sourceResultId,
      sourceEvidenceIds: ownerFact.sourceEvidenceIds || [],
      sourceSchemaVersions: [ownerFact.ownerSchemaVersion],
      dataOrigin: ownerFact.dataOrigin,
      runtimeScope: ownerFact.runtimeScope,
      lifecycleStage: ownerFact.lifecycleStage,
      outcomeCode: ownerFact.outcomeCode,
      occurredAt: ownerFact.occurredAt,
      identityAligned: ownerFact.identityAligned,
      sourceFactValidated: ownerFact.sourceFactValidated,
    }],
  };
}

export function adaptRevisionObservationFact(
  input: Omit<ConvergenceFormalOwnerFact, 'capability' | 'ownerFactType'>,
  registry: ConvergenceObservationSourceRegistrySnapshot,
): ConvergenceOwnerAdapterResult {
  return adaptConvergenceFormalOwnerFact({ ...input, capability: 'revision', ownerFactType: 'revision_evaluation' }, registry);
}
export function adaptTargetedObservationFact(
  input: Omit<ConvergenceFormalOwnerFact, 'capability' | 'ownerFactType'>,
  registry: ConvergenceObservationSourceRegistrySnapshot,
): ConvergenceOwnerAdapterResult {
  return adaptConvergenceFormalOwnerFact({ ...input, capability: 'targeted_micro_training', ownerFactType: 'targeted_training_result' }, registry);
}
export function adaptRetestObservationFact(
  input: Omit<ConvergenceFormalOwnerFact, 'capability' | 'ownerFactType'>,
  registry: ConvergenceObservationSourceRegistrySnapshot,
): ConvergenceOwnerAdapterResult {
  return adaptConvergenceFormalOwnerFact({ ...input, capability: 'retest', ownerFactType: 'retest_result' }, registry);
}
export function adaptTransferObservationFact(
  input: Omit<ConvergenceFormalOwnerFact, 'capability' | 'ownerFactType'>,
  registry: ConvergenceObservationSourceRegistrySnapshot,
): ConvergenceOwnerAdapterResult {
  return adaptConvergenceFormalOwnerFact({ ...input, capability: 'transfer', ownerFactType: 'transfer_result' }, registry);
}
export function adaptSuccessorObservationFact(
  input: Omit<ConvergenceFormalOwnerFact, 'capability' | 'ownerFactType'>,
  registry: ConvergenceObservationSourceRegistrySnapshot,
): ConvergenceOwnerAdapterResult {
  return adaptConvergenceFormalOwnerFact({ ...input, capability: 'successor_governance', ownerFactType: 'successor_governance_result' }, registry);
}
export function adaptCalibrationObservationFact(
  input: Omit<ConvergenceFormalOwnerFact, 'capability' | 'ownerFactType'>,
  registry: ConvergenceObservationSourceRegistrySnapshot,
): ConvergenceOwnerAdapterResult {
  return adaptConvergenceFormalOwnerFact({ ...input, capability: 'calibration_review', ownerFactType: 'calibration_review_result' }, registry);
}
export function adaptFeedbackProjectionObservationFact(
  input: Omit<ConvergenceFormalOwnerFact, 'capability' | 'ownerFactType'>,
  registry: ConvergenceObservationSourceRegistrySnapshot,
): ConvergenceOwnerAdapterResult {
  return adaptConvergenceFormalOwnerFact({ ...input, capability: 'feedback_projection', ownerFactType: 'feedback_projection_result' }, registry);
}
export function adaptCoreAbilitySummaryObservationFact(
  input: Omit<ConvergenceFormalOwnerFact, 'capability' | 'ownerFactType'>,
  registry: ConvergenceObservationSourceRegistrySnapshot,
): ConvergenceOwnerAdapterResult {
  return adaptConvergenceFormalOwnerFact({ ...input, capability: 'core_ability_summary', ownerFactType: 'core_ability_summary_result' }, registry);
}

function entry(
  capability: ComplexityConvergenceCapability,
  ownerDomain: string,
  ownerFactType: string,
  ownerSchemaVersions: string[],
  expectedBenefitCode: ConvergenceObservationSourceRegistryEntry['expectedBenefitCode'],
  allowedLifecycleStages: ComplexityConvergenceLifecycleStage[],
  allowedOutcomeCodes: ComplexityConvergenceObservedOutcomeCode[],
): ConvergenceObservationSourceRegistryEntry {
  return {
    registryEntryVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_SOURCE_REGISTRY_ENTRY_VERSION,
    capability,
    ownerDomain,
    ownerFactType,
    ownerSchemaVersions,
    adapterVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OWNER_ADAPTER_VERSION,
    expectedBenefitCode,
    allowedLifecycleStages,
    allowedOutcomeCodes,
    requiredIdentityFields: [...COMMON_IDENTITY_FIELDS],
    enabledForIsolatedAcceptance: true,
    enabledForRealTrial: true,
  };
}

function rejected(issueCode: string): ConvergenceOwnerAdapterResult {
  return { accepted: false, sourceFacts: [], issueCodes: [issueCode] };
}

const FORBIDDEN_CONTENT_KEYS = new Set([
  'studentAnswer', 'studentResponse', 'revisedAnswer', 'materialText', 'questionText',
  'modelOutput', 'rawOutput', 'feedbackText', 'freeText', 'draftAnswer', 'initialAnswer',
]);
function containsForbiddenContentKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value as Record<string, unknown>).some(([key, item]) =>
    FORBIDDEN_CONTENT_KEYS.has(key) || containsForbiddenContentKey(item));
}
