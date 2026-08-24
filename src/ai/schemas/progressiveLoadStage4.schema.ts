import {
  PROGRESSION_AUDIT_FINDING_CODES,
  READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION,
  type ProgressionAuditFindingCode,
} from './readingTrainingProgressionAudit.schema.ts';

export const PROGRESSIVE_LOAD_GOVERNANCE_CONTEXT_SCHEMA_VERSION =
  'progressive_load_governance_context_v1' as const;
export const PROGRESSIVE_LOAD_CALIBRATION_EVENT_SCHEMA_VERSION =
  'progressive_load_calibration_event_v1' as const;
export const PROGRESSIVE_LOAD_CALIBRATION_PROJECTION_SCHEMA_VERSION =
  'progressive_load_calibration_projection_v1' as const;
export const PROGRESSIVE_LOAD_CALIBRATION_THRESHOLD_POLICY_SCHEMA_VERSION =
  'progressive_load_calibration_threshold_policy_v1' as const;
export const PROGRESSIVE_LOAD_CALIBRATION_OUTBOX_SCHEMA_VERSION =
  'progressive_load_calibration_outbox_v1' as const;
export const DEFAULT_PROGRESSIVE_LOAD_CALIBRATION_POLICY_VERSION =
  'progressive_load_calibration_trial_policy_v1' as const;

export const PROGRESSIVE_LOAD_GOVERNANCE_TARGETS = [
  'restore_accessible_entry',
  'remove_unexplained_jump',
  'reduce_composite_responsibility',
  'remove_duplicate_observation',
  'repair_identity_consistency',
] as const;

export type ProgressiveLoadGovernanceTarget =
  typeof PROGRESSIVE_LOAD_GOVERNANCE_TARGETS[number];

export type ProgressiveLoadGovernanceContext = {
  schemaVersion: typeof PROGRESSIVE_LOAD_GOVERNANCE_CONTEXT_SCHEMA_VERSION;
  policyVersion: typeof READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION;
  governanceContextId: string;
  existingGovernanceCaseId?: string;
  baselineAuditVersion: string;
  sourceDigest: string;
  auditDigest: string;
  questionLineageId: string;
  sourceResourceVersionId: string;
  materialVersionId: string;
  observationTaskPlanId: string;
  sourceProgressionPlanHash?: string;
  sourceTaskLoadSemanticsHash?: string;
  findingCodes: ProgressionAuditFindingCode[];
  targetOutcome: ProgressiveLoadGovernanceTarget;
  priority: 1 | 2 | 3;
  status: 'selected' | 'linked' | 'stale' | 'resolved' | 'deferred';
  createdAt: string;
  updatedAt: string;
};

export const PROGRESSIVE_LOAD_CALIBRATION_EVENT_TYPES = [
  'task_presented',
  'valid_response_submitted',
  'invalid_response_rejected',
  'hint_opened',
  'revision_offered',
  'revision_submitted',
  'task_completed',
  'task_abandoned',
  'next_task_entered',
  'session_resumed',
] as const;

export type ProgressiveLoadCalibrationEventType =
  typeof PROGRESSIVE_LOAD_CALIBRATION_EVENT_TYPES[number];

export const PROGRESSIVE_LOAD_SUPPORT_MODES = [
  'initial_independent',
  'hint_supported',
  'feedback_revision',
  'targeted_training',
  'retest_independent',
  'transfer_independent',
] as const;

export type ProgressiveLoadSupportMode = typeof PROGRESSIVE_LOAD_SUPPORT_MODES[number];

export type ProgressiveLoadCalibrationEvent = {
  schemaVersion: typeof PROGRESSIVE_LOAD_CALIBRATION_EVENT_SCHEMA_VERSION;
  eventId: string;
  sourceObservationEventId?: string;
  eventType: ProgressiveLoadCalibrationEventType;
  runtimeScope: 'product' | 'demo' | 'fixture' | 'debug' | 'internal_acceptance';
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  learningTaskAttemptId: string;
  resourceVersionId: string;
  materialVersionId: string;
  progressionPlanHash?: string;
  taskLoadSemanticsHash?: string;
  observationThreadId?: string;
  sequenceRank?: number;
  supportMode: ProgressiveLoadSupportMode;
  responseFormat?: 'text' | 'single_choice';
  taskLoadRisk?: boolean;
  occurredAt: string;
  source: 'real_learning' | 'isolated_acceptance';
};

export type ProgressiveLoadCalibrationEventWriteResult = {
  status: 'created' | 'unchanged' | 'conflict';
  event: ProgressiveLoadCalibrationEvent;
  issues: string[];
};

export type ProgressiveLoadCalibrationOutboxEntry = {
  schemaVersion: typeof PROGRESSIVE_LOAD_CALIBRATION_OUTBOX_SCHEMA_VERSION;
  outboxId: string;
  eventId: string;
  event: ProgressiveLoadCalibrationEvent;
  status: 'pending' | 'retrying' | 'failed';
  retryCount: number;
  lastError: string;
  nextRetryAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ProgressiveLoadCalibrationThresholdPolicy = {
  schemaVersion: typeof PROGRESSIVE_LOAD_CALIBRATION_THRESHOLD_POLICY_SCHEMA_VERSION;
  policyVersion: string;
  reviewReadyValidAttemptCount: number;
  minimumDistinctLearnerCount?: number;
  integrityRateFloor: number;
  effectiveFrom: string;
};

export type ProgressiveLoadCalibrationStatus =
  | 'awaiting_data'
  | 'collecting'
  | 'insufficient_sample'
  | 'review_ready'
  | 'calibrated'
  | 'integrity_blocked';

export type ProgressiveLoadCalibrationProjection = {
  schemaVersion: typeof PROGRESSIVE_LOAD_CALIBRATION_PROJECTION_SCHEMA_VERSION;
  projectionId: string;
  resourceVersionId: string;
  materialVersionId: string;
  progressionPlanHash?: string;
  taskLoadSemanticsHash?: string;
  observationThreadId?: string;
  sequenceRank?: number;
  supportMode: ProgressiveLoadSupportMode;
  responseFormat?: 'text' | 'single_choice';
  status: ProgressiveLoadCalibrationStatus;
  presentedCount: number;
  validInitialAttemptCount: number;
  invalidResponseCount: number;
  completedCount: number;
  abandonedCount: number;
  hintOpenedCount: number;
  revisionOfferedCount: number;
  revisionSubmittedCount: number;
  nextTaskEnteredCount: number;
  sessionResumeCount: number;
  taskLoadRiskCount: number;
  distinctLearnerCount: number;
  identityIntegrityFailureCount: number;
  integrityRate: number;
  excludedCounts: Record<string, number>;
  limitations: string[];
  policyVersion: string;
  generatedAt: string;
};

export function createDefaultProgressiveLoadCalibrationThresholdPolicy(
  effectiveFrom: string,
): ProgressiveLoadCalibrationThresholdPolicy {
  return {
    schemaVersion: PROGRESSIVE_LOAD_CALIBRATION_THRESHOLD_POLICY_SCHEMA_VERSION,
    policyVersion: DEFAULT_PROGRESSIVE_LOAD_CALIBRATION_POLICY_VERSION,
    reviewReadyValidAttemptCount: 30,
    minimumDistinctLearnerCount: 1,
    integrityRateFloor: 0.98,
    effectiveFrom,
  };
}

export function isProgressiveLoadGovernanceContext(
  value: unknown,
): value is ProgressiveLoadGovernanceContext {
  if (!value || typeof value !== 'object') return false;
  const item = value as ProgressiveLoadGovernanceContext & Record<string, unknown>;
  return item.schemaVersion === PROGRESSIVE_LOAD_GOVERNANCE_CONTEXT_SCHEMA_VERSION
    && item.policyVersion === READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION
    && [item.governanceContextId, item.baselineAuditVersion, item.sourceDigest,
      item.auditDigest, item.questionLineageId, item.sourceResourceVersionId,
      item.materialVersionId, item.observationTaskPlanId, item.createdAt,
      item.updatedAt].every(nonEmpty)
    && optionalText(item.existingGovernanceCaseId)
    && optionalText(item.sourceProgressionPlanHash)
    && optionalText(item.sourceTaskLoadSemanticsHash)
    && Array.isArray(item.findingCodes)
    && item.findingCodes.length > 0
    && item.findingCodes.every((code) => (
      (PROGRESSION_AUDIT_FINDING_CODES as readonly string[]).includes(code)
    ))
    && (PROGRESSIVE_LOAD_GOVERNANCE_TARGETS as readonly string[])
      .includes(item.targetOutcome)
    && [1, 2, 3].includes(item.priority)
    && ['selected', 'linked', 'stale', 'resolved', 'deferred'].includes(item.status)
    && !['questionStem', 'rubric', 'answerAcceptance', 'readingText']
      .some((field) => field in item);
}

export function isProgressiveLoadCalibrationEvent(
  value: unknown,
): value is ProgressiveLoadCalibrationEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as ProgressiveLoadCalibrationEvent & Record<string, unknown>;
  return event.schemaVersion === PROGRESSIVE_LOAD_CALIBRATION_EVENT_SCHEMA_VERSION
    && [event.eventId, event.studentId, event.learningSessionId, event.learningRoundId,
      event.learningTaskAttemptId, event.resourceVersionId, event.materialVersionId,
      event.occurredAt].every(nonEmpty)
    && optionalText(event.sourceObservationEventId)
    && (PROGRESSIVE_LOAD_CALIBRATION_EVENT_TYPES as readonly string[])
      .includes(event.eventType)
    && ['product', 'demo', 'fixture', 'debug', 'internal_acceptance']
      .includes(event.runtimeScope)
    && (PROGRESSIVE_LOAD_SUPPORT_MODES as readonly string[]).includes(event.supportMode)
    && optionalText(event.progressionPlanHash)
    && optionalText(event.taskLoadSemanticsHash)
    && optionalText(event.observationThreadId)
    && (event.sequenceRank === undefined || (
      Number.isInteger(event.sequenceRank) && Number(event.sequenceRank) > 0
    ))
    && (event.responseFormat === undefined
      || ['text', 'single_choice'].includes(event.responseFormat))
    && (event.taskLoadRisk === undefined || typeof event.taskLoadRisk === 'boolean')
    && ['real_learning', 'isolated_acceptance'].includes(event.source)
    && !['answerText', 'readingText', 'feedbackText', 'diagnosisText']
      .some((field) => field in event);
}

export function isProgressiveLoadCalibrationThresholdPolicy(
  value: unknown,
): value is ProgressiveLoadCalibrationThresholdPolicy {
  if (!value || typeof value !== 'object') return false;
  const policy = value as ProgressiveLoadCalibrationThresholdPolicy;
  return policy.schemaVersion === PROGRESSIVE_LOAD_CALIBRATION_THRESHOLD_POLICY_SCHEMA_VERSION
    && nonEmpty(policy.policyVersion)
    && Number.isInteger(policy.reviewReadyValidAttemptCount)
    && policy.reviewReadyValidAttemptCount > 0
    && (policy.minimumDistinctLearnerCount === undefined || (
      Number.isInteger(policy.minimumDistinctLearnerCount)
      && policy.minimumDistinctLearnerCount > 0
    ))
    && Number.isFinite(policy.integrityRateFloor)
    && policy.integrityRateFloor >= 0
    && policy.integrityRateFloor <= 1
    && nonEmpty(policy.effectiveFrom);
}

export function isProgressiveLoadCalibrationOutboxEntry(
  value: unknown,
): value is ProgressiveLoadCalibrationOutboxEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as ProgressiveLoadCalibrationOutboxEntry;
  return entry.schemaVersion === PROGRESSIVE_LOAD_CALIBRATION_OUTBOX_SCHEMA_VERSION
    && [entry.outboxId, entry.eventId, entry.lastError, entry.nextRetryAt,
      entry.createdAt, entry.updatedAt].every(nonEmpty)
    && isProgressiveLoadCalibrationEvent(entry.event)
    && entry.event.eventId === entry.eventId
    && ['pending', 'retrying', 'failed'].includes(entry.status)
    && Number.isInteger(entry.retryCount)
    && entry.retryCount >= 0;
}

export function isProgressiveLoadCalibrationProjection(
  value: unknown,
): value is ProgressiveLoadCalibrationProjection {
  if (!value || typeof value !== 'object') return false;
  const item = value as ProgressiveLoadCalibrationProjection;
  const counts = [item.presentedCount, item.validInitialAttemptCount,
    item.invalidResponseCount, item.completedCount, item.abandonedCount,
    item.hintOpenedCount, item.revisionOfferedCount, item.revisionSubmittedCount,
    item.nextTaskEnteredCount, item.sessionResumeCount, item.taskLoadRiskCount,
    item.distinctLearnerCount, item.identityIntegrityFailureCount];
  return item.schemaVersion === PROGRESSIVE_LOAD_CALIBRATION_PROJECTION_SCHEMA_VERSION
    && [item.projectionId, item.resourceVersionId, item.materialVersionId,
      item.policyVersion, item.generatedAt].every(nonEmpty)
    && (PROGRESSIVE_LOAD_SUPPORT_MODES as readonly string[]).includes(item.supportMode)
    && ['awaiting_data', 'collecting', 'insufficient_sample', 'review_ready',
      'calibrated', 'integrity_blocked'].includes(item.status)
    && counts.every((count) => Number.isInteger(count) && count >= 0)
    && Number.isFinite(item.integrityRate)
    && item.integrityRate >= 0 && item.integrityRate <= 1
    && Array.isArray(item.limitations)
    && item.limitations.every(nonEmpty)
    && Boolean(item.excludedCounts && typeof item.excludedCounts === 'object');
}

export function stableProgressiveLoadId(prefix: string, values: unknown[]): string {
  const text = JSON.stringify(values);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function optionalText(value: unknown): boolean {
  return value === undefined || nonEmpty(value);
}
