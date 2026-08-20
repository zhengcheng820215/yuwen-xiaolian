import {
  TARGETED_GAP_REASON_CODES,
  type TargetedGapReasonCode,
} from './targetedMicroTraining.schema.ts';

export const TARGETED_MICRO_TRAINING_STAGE4_SCHEMA_VERSION =
  'targeted_micro_training_stage4_v1' as const;
export const TARGETED_MICRO_TRAINING_STAGE4_POLICY_VERSION =
  'targeted_micro_training_stage4_policy_v1' as const;
export const TARGETED_MICRO_TRAINING_STAGE4_PACK_VERSION =
  'targeted_micro_training_controlled_pack_v3' as const;

export const TARGETED_MICRO_TRAINING_ENABLEMENT_MODES = [
  'disabled',
  'isolated_verify',
  'controlled_single_learner',
  'paused',
] as const;

export type TargetedMicroTrainingEnablementMode =
  typeof TARGETED_MICRO_TRAINING_ENABLEMENT_MODES[number];

export type TargetedMicroTrainingEnablementState = {
  mode: TargetedMicroTrainingEnablementMode;
  policyVersion: typeof TARGETED_MICRO_TRAINING_STAGE4_POLICY_VERSION;
  packId?: string;
  packVersion?: string;
  controlledStudentId?: string;
  changedBy: string;
  reason: string;
  changedAt: string;
};

export type TargetedMicroTrainingControlledPackManifestStatus =
  | 'prepared'
  | 'imported'
  | 'paused'
  | 'rolled_back';

export type TargetedMicroTrainingControlledPackManifest = {
  packId: string;
  packVersion: string;
  sourceSnapshotRevision: number;
  materialVersionIds: string[];
  resourceVersionIds: string[];
  registryResourceIds: string[];
  gapCoverage: Record<TargetedGapReasonCode, number>;
  manifestHash: string;
  reviewedAt: string;
  importedAt?: string;
  rolledBackAt?: string;
  status: TargetedMicroTrainingControlledPackManifestStatus;
};

export type TargetedMicroTrainingPackAuditAction =
  | 'prepared'
  | 'imported'
  | 'paused'
  | 'rolled_back'
  | 'enablement_changed';

export type TargetedMicroTrainingPackAuditRecord = {
  auditId: string;
  action: TargetedMicroTrainingPackAuditAction;
  packId?: string;
  packVersion?: string;
  previousMode?: TargetedMicroTrainingEnablementMode;
  nextMode?: TargetedMicroTrainingEnablementMode;
  actorId: string;
  reason: string;
  occurredAt: string;
};

export const TARGETED_MICRO_TRAINING_STAGE4_EVENT_NAMES = [
  'targeted_trigger_evaluated',
  'targeted_no_match',
  'targeted_assignment_created',
  'targeted_assignment_presented',
  'targeted_assignment_completed',
  'targeted_assignment_skipped',
  'targeted_assignment_unavailable',
  'targeted_core_queue_resumed',
  'targeted_follow_up_observed',
] as const;

export type TargetedMicroTrainingStage4EventName =
  typeof TARGETED_MICRO_TRAINING_STAGE4_EVENT_NAMES[number];

export type TargetedMicroTrainingStage4RuntimeEvent = {
  eventId: string;
  eventName: TargetedMicroTrainingStage4EventName;
  studentId: string;
  learningSessionId: string;
  sourceLearningRoundId?: string;
  sourceAttemptId?: string;
  decisionId?: string;
  requestId?: string;
  assignmentId?: string;
  targetedAttemptId?: string;
  sourceResourceVersionId?: string;
  targetedResourceVersionId?: string;
  abilityId?: string;
  gapReasonCode?: TargetedGapReasonCode;
  responseFormat?: string;
  taskRole?: string;
  policyVersion: string;
  packId: string;
  packVersion: string;
  outcome?: string;
  occurredAt: string;
};

export type TargetedMicroTrainingStage4OutboxEntry = {
  outboxId: string;
  eventId: string;
  event: TargetedMicroTrainingStage4RuntimeEvent;
  status: 'pending' | 'retrying' | 'failed';
  retryCount: number;
  lastError?: string;
  nextRetryAt: string;
  createdAt: string;
  updatedAt: string;
};

export type TargetedMicroTrainingCalibrationEpisode = {
  episodeId: string;
  policyVersion: string;
  packId: string;
  packVersion: string;
  studentId: string;
  learningSessionId: string;
  sourceLearningRoundId: string;
  sourceAttemptId: string;
  decisionId: string;
  requestId?: string;
  assignmentId?: string;
  targetedAttemptId?: string;
  sourceResourceVersionId: string;
  targetedResourceVersionId?: string;
  abilityId?: string;
  gapReasonCode?: TargetedGapReasonCode;
  triggerOutcome: string;
  assignmentOutcome?: 'completed' | 'skipped' | 'unavailable';
  coreReturnOutcome?: 'resumed' | 'session_completed' | 'interrupted';
  openedAt: string;
  closedAt?: string;
};

export type TargetedMicroTrainingFollowUpObservation = {
  observationId: string;
  episodeId: string;
  followUpAttemptId: string;
  followUpResourceVersionId: string;
  followUpRole: 'core_training' | 'retest' | 'transfer';
  abilityId: string;
  gapReasonCode: TargetedGapReasonCode;
  independence: 'qualified' | 'not_independent' | 'insufficient_to_judge';
  result: 'gap_recurred' | 'gap_not_observed' | 'insufficient_to_judge';
  observedAt: string;
};

export type TargetedMicroTrainingCalibrationDecision = {
  decisionId: string;
  policyVersion: string;
  packVersion: string;
  observationWindow: { startedAt: string; endedAt: string };
  sampleSummary: {
    sessions: number;
    presented: number;
    completed: number;
    qualifiedFollowUps: number;
  };
  runtimeSafety: 'pass' | 'fail' | 'insufficient_data';
  educationalSignal: 'favorable' | 'neutral' | 'adverse' | 'insufficient_data';
  decision: 'continue_controlled' | 'adjust_resources' | 'tighten_policy' | 'pause';
  reasons: string[];
  decidedAt: string;
};

export type TargetedMicroTrainingMetric = {
  numerator: number;
  denominator: number;
  rate?: number;
  status: 'available' | 'insufficient_data';
};

export type TargetedMicroTrainingStage4Metrics = {
  triggerRate: TargetedMicroTrainingMetric;
  matchRate: TargetedMicroTrainingMetric;
  startRate: TargetedMicroTrainingMetric;
  completionRate: TargetedMicroTrainingMetric;
  skipRate: TargetedMicroTrainingMetric;
  unavailableRate: TargetedMicroTrainingMetric;
  coreReturnRate: TargetedMicroTrainingMetric;
  immediateResolutionRate: TargetedMicroTrainingMetric;
  followUpCoverageRate: TargetedMicroTrainingMetric;
  sameGapRecurrenceRate: TargetedMicroTrainingMetric;
  sessionExitRate: TargetedMicroTrainingMetric;
};

export type TargetedMicroTrainingStage4IntegrityIssue = {
  code: string;
  severity: 'warning' | 'fail';
  message: string;
  identity?: string;
};

export type TargetedMicroTrainingStage4Projection = {
  generatedAt: string;
  mode: TargetedMicroTrainingEnablementMode;
  packId?: string;
  packVersion?: string;
  metrics: TargetedMicroTrainingStage4Metrics;
  totals: {
    events: number;
    episodes: number;
    followUps: number;
    qualifiedFollowUps: number;
    outboxPending: number;
    outboxFailed: number;
  };
  integrityStatus: 'pass' | 'warning' | 'fail' | 'awaiting_data';
  issues: TargetedMicroTrainingStage4IntegrityIssue[];
  breakdowns: Array<{
    dimension: 'gap' | 'ability' | 'response_format' | 'task_role';
    value: string;
    presented: number;
    completed: number;
    qualifiedFollowUps: number;
    sameGapRecurrences: number;
  }>;
};

export type TargetedMicroTrainingStage4Snapshot = {
  schemaVersion: typeof TARGETED_MICRO_TRAINING_STAGE4_SCHEMA_VERSION;
  revision: number;
  enablement: TargetedMicroTrainingEnablementState;
  manifests: TargetedMicroTrainingControlledPackManifest[];
  audits: TargetedMicroTrainingPackAuditRecord[];
  events: TargetedMicroTrainingStage4RuntimeEvent[];
  outbox: TargetedMicroTrainingStage4OutboxEntry[];
  episodes: TargetedMicroTrainingCalibrationEpisode[];
  followUps: TargetedMicroTrainingFollowUpObservation[];
  decisions: TargetedMicroTrainingCalibrationDecision[];
  updatedAt: string;
};

export function createEmptyTargetedMicroTrainingStage4Snapshot(
  now: string,
): TargetedMicroTrainingStage4Snapshot {
  return {
    schemaVersion: TARGETED_MICRO_TRAINING_STAGE4_SCHEMA_VERSION,
    revision: 0,
    enablement: {
      mode: 'disabled',
      policyVersion: TARGETED_MICRO_TRAINING_STAGE4_POLICY_VERSION,
      changedBy: 'system',
      reason: 'stage4_default_disabled',
      changedAt: now,
    },
    manifests: [],
    audits: [],
    events: [],
    outbox: [],
    episodes: [],
    followUps: [],
    decisions: [],
    updatedAt: now,
  };
}

export function buildTargetedMicroTrainingStage4Id(
  prefix: string,
  values: Array<string | undefined>,
): string {
  const source = values.map((value) => encodeURIComponent((value || '').trim())).join('|');
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildTargetedMicroTrainingManifestHash(input: {
  packId: string;
  packVersion: string;
  materialVersionIds: string[];
  resourceVersionIds: string[];
  registryResourceIds: string[];
  gapCoverage: Record<TargetedGapReasonCode, number>;
}): string {
  return buildTargetedMicroTrainingStage4Id('targeted-pack-manifest', [
    input.packId,
    input.packVersion,
    [...input.materialVersionIds].sort().join(','),
    [...input.resourceVersionIds].sort().join(','),
    [...input.registryResourceIds].sort().join(','),
    TARGETED_GAP_REASON_CODES.map((code) => `${code}:${input.gapCoverage[code] || 0}`).join(','),
  ]);
}

export function isTargetedMicroTrainingStage4Snapshot(
  value: unknown,
): value is TargetedMicroTrainingStage4Snapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as TargetedMicroTrainingStage4Snapshot;
  return snapshot.schemaVersion === TARGETED_MICRO_TRAINING_STAGE4_SCHEMA_VERSION
    && Number.isInteger(snapshot.revision)
    && snapshot.revision >= 0
    && isTargetedMicroTrainingEnablementState(snapshot.enablement)
    && Array.isArray(snapshot.manifests)
    && snapshot.manifests.every(isTargetedMicroTrainingControlledPackManifest)
    && Array.isArray(snapshot.audits)
    && Array.isArray(snapshot.events)
    && snapshot.events.every(isTargetedMicroTrainingStage4RuntimeEvent)
    && Array.isArray(snapshot.outbox)
    && Array.isArray(snapshot.episodes)
    && Array.isArray(snapshot.followUps)
    && Array.isArray(snapshot.decisions)
    && timestamp(snapshot.updatedAt);
}

export function isTargetedMicroTrainingEnablementState(
  value: unknown,
): value is TargetedMicroTrainingEnablementState {
  if (!value || typeof value !== 'object') return false;
  const state = value as TargetedMicroTrainingEnablementState;
  if (!TARGETED_MICRO_TRAINING_ENABLEMENT_MODES.includes(state.mode)) return false;
  if (state.policyVersion !== TARGETED_MICRO_TRAINING_STAGE4_POLICY_VERSION) return false;
  if (![state.changedBy, state.reason].every(nonEmpty) || !timestamp(state.changedAt)) return false;
  if (state.mode === 'controlled_single_learner' && !nonEmpty(state.controlledStudentId)) return false;
  if (['isolated_verify', 'controlled_single_learner'].includes(state.mode)) {
    return nonEmpty(state.packId) && nonEmpty(state.packVersion);
  }
  return true;
}

export function isTargetedMicroTrainingControlledPackManifest(
  value: unknown,
): value is TargetedMicroTrainingControlledPackManifest {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as TargetedMicroTrainingControlledPackManifest;
  return [manifest.packId, manifest.packVersion, manifest.manifestHash].every(nonEmpty)
    && Number.isInteger(manifest.sourceSnapshotRevision)
    && manifest.sourceSnapshotRevision >= 0
    && [manifest.materialVersionIds, manifest.resourceVersionIds, manifest.registryResourceIds]
      .every((items) => Array.isArray(items) && items.length > 0 && items.every(nonEmpty))
    && TARGETED_GAP_REASON_CODES.every((code) => Number.isInteger(manifest.gapCoverage?.[code]) && manifest.gapCoverage[code] >= 0)
    && ['prepared', 'imported', 'paused', 'rolled_back'].includes(manifest.status)
    && timestamp(manifest.reviewedAt)
    && (manifest.importedAt === undefined || timestamp(manifest.importedAt))
    && (manifest.rolledBackAt === undefined || timestamp(manifest.rolledBackAt));
}

export function isTargetedMicroTrainingStage4RuntimeEvent(
  value: unknown,
): value is TargetedMicroTrainingStage4RuntimeEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as TargetedMicroTrainingStage4RuntimeEvent;
  return [event.eventId, event.studentId, event.learningSessionId, event.policyVersion, event.packId, event.packVersion]
    .every(nonEmpty)
    && TARGETED_MICRO_TRAINING_STAGE4_EVENT_NAMES.includes(event.eventName)
    && timestamp(event.occurredAt)
    && !containsPayloadText(event);
}

function containsPayloadText(event: TargetedMicroTrainingStage4RuntimeEvent): boolean {
  const disallowed = [
    'answer', 'studentAnswer', 'responseText', 'content', 'materialContent',
    'passage', 'feedback', 'materialText', 'questionStem',
  ];
  return disallowed.some((key) => Object.prototype.hasOwnProperty.call(event, key));
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function timestamp(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}
