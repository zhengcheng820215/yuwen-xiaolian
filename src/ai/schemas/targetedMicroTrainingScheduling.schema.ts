import type { PrimaryAbilityId } from './questionResourceAdmission.schema.ts';
import {
  TARGETED_GAP_REASON_CODES,
  type TargetedGapReasonCode,
  type TargetedMicroTrainingAssignment,
  type TargetedMicroTrainingRequest,
} from './targetedMicroTraining.schema.ts';

export const TARGETED_MICRO_TRAINING_SCHEDULING_SCHEMA_VERSION =
  'targeted_micro_training_scheduling_v1' as const;
export const TARGETED_MICRO_TRAINING_TRIGGER_POLICY_VERSION =
  'targeted_micro_training_trigger_v1' as const;
export const TARGETED_MICRO_TRAINING_MATCH_POLICY_VERSION =
  'targeted_micro_training_match_v1' as const;
export const TARGETED_MICRO_TRAINING_SESSION_LIMIT = 2 as const;

export type TargetedMicroTrainingTriggerOutcome =
  | 'eligible'
  | 'not_eligible'
  | 'no_match'
  | 'limit_reached'
  | 'intervention_conflict';

export type TargetedMicroTrainingTriggerDecision = {
  decisionId: string;
  studentId: string;
  learningSessionId: string;
  sourceLearningRoundId: string;
  sourceAttemptId: string;
  sourceResourceVersionId: string;
  sourceMaterialId: string;
  sourceCoreTaskNumber: number;
  abilityId?: PrimaryAbilityId;
  primaryGapRequirementId?: string;
  gapReasonCode?: TargetedGapReasonCode;
  outcome: TargetedMicroTrainingTriggerOutcome;
  reasonCode: string;
  triggerPolicyVersion: typeof TARGETED_MICRO_TRAINING_TRIGGER_POLICY_VERSION;
  evaluatedAt: string;
};

export type TargetedMicroTrainingMatchResult =
  | {
      status: 'matched';
      resourceVersionId: string;
      materialVersionId: string;
      matchPolicyVersion: typeof TARGETED_MICRO_TRAINING_MATCH_POLICY_VERSION;
    }
  | {
      status: 'no_match';
      reasonCode: string;
      matchPolicyVersion: typeof TARGETED_MICRO_TRAINING_MATCH_POLICY_VERSION;
    };

export type TargetedMicroTrainingSessionOverlay = {
  learningSessionId: string;
  mode: 'core' | 'targeted';
  activeAssignmentId?: string;
  returnToCoreTaskNumber?: number;
  completedAssignmentIds: string[];
  skippedAssignmentIds: string[];
  unavailableAssignmentIds: string[];
  consumedCount: number;
  overlayRevision: number;
  updatedAt: string;
};

export type TargetedMicroTrainingSchedulingSnapshot = {
  schemaVersion: typeof TARGETED_MICRO_TRAINING_SCHEDULING_SCHEMA_VERSION;
  revision: number;
  decisions: TargetedMicroTrainingTriggerDecision[];
  requests: TargetedMicroTrainingRequest[];
  assignments: TargetedMicroTrainingAssignment[];
  updatedAt: string;
};

export type TargetedMicroTrainingRuntimeEventName =
  | 'targeted_trigger_evaluated'
  | 'targeted_no_match'
  | 'targeted_assignment_created'
  | 'targeted_assignment_presented'
  | 'targeted_assignment_completed'
  | 'targeted_assignment_skipped'
  | 'targeted_assignment_unavailable'
  | 'targeted_core_queue_resumed';

export type TargetedMicroTrainingRuntimeEvent = {
  eventId: string;
  eventName: TargetedMicroTrainingRuntimeEventName;
  studentId: string;
  learningSessionId: string;
  sourceLearningRoundId?: string;
  requestId?: string;
  assignmentId?: string;
  policyVersion: string;
  occurredAt: string;
};

export function createTargetedMicroTrainingSessionOverlay(input: {
  learningSessionId: string;
  now: string;
}): TargetedMicroTrainingSessionOverlay {
  return {
    learningSessionId: input.learningSessionId,
    mode: 'core',
    completedAssignmentIds: [],
    skippedAssignmentIds: [],
    unavailableAssignmentIds: [],
    consumedCount: 0,
    overlayRevision: 0,
    updatedAt: input.now,
  };
}

export function createEmptyTargetedMicroTrainingSchedulingSnapshot(
  now: string,
): TargetedMicroTrainingSchedulingSnapshot {
  return {
    schemaVersion: TARGETED_MICRO_TRAINING_SCHEDULING_SCHEMA_VERSION,
    revision: 0,
    decisions: [],
    requests: [],
    assignments: [],
    updatedAt: now,
  };
}

export function buildTargetedMicroTrainingDecisionId(input: {
  studentId: string;
  sourceAttemptId: string;
  gapReasonCode?: string;
  triggerPolicyVersion?: string;
}): string {
  return stableIdentity('targeted-trigger-decision', [
    input.studentId,
    input.sourceAttemptId,
    input.gapReasonCode || 'no-supported-gap',
    input.triggerPolicyVersion || TARGETED_MICRO_TRAINING_TRIGGER_POLICY_VERSION,
  ]);
}

export function buildTargetedMicroTrainingRuntimeEventId(input: {
  eventName: TargetedMicroTrainingRuntimeEventName;
  learningSessionId: string;
  assignmentId?: string;
  sourceLearningRoundId?: string;
}): string {
  return stableIdentity('targeted-runtime-event', [
    input.eventName,
    input.learningSessionId,
    input.assignmentId || input.sourceLearningRoundId || 'session',
  ]);
}

export function isTargetedMicroTrainingSessionOverlay(
  value: unknown,
): value is TargetedMicroTrainingSessionOverlay {
  if (!value || typeof value !== 'object') return false;
  const overlay = value as TargetedMicroTrainingSessionOverlay;
  const allIds = [
    ...overlay.completedAssignmentIds,
    ...overlay.skippedAssignmentIds,
    ...overlay.unavailableAssignmentIds,
  ];
  return nonEmpty(overlay.learningSessionId)
    && ['core', 'targeted'].includes(overlay.mode)
    && (overlay.activeAssignmentId === undefined || nonEmpty(overlay.activeAssignmentId))
    && (overlay.returnToCoreTaskNumber === undefined
      || (Number.isInteger(overlay.returnToCoreTaskNumber) && overlay.returnToCoreTaskNumber >= 1))
    && [overlay.completedAssignmentIds, overlay.skippedAssignmentIds, overlay.unavailableAssignmentIds]
      .every((ids) => Array.isArray(ids) && ids.every(nonEmpty))
    && new Set(allIds).size === allIds.length
    && Number.isInteger(overlay.consumedCount)
    && overlay.consumedCount >= 0
    && overlay.consumedCount === overlay.completedAssignmentIds.length
    && Number.isInteger(overlay.overlayRevision)
    && overlay.overlayRevision >= 0
    && timestamp(overlay.updatedAt)
    && (overlay.mode !== 'targeted'
      || (nonEmpty(overlay.activeAssignmentId) && Number.isInteger(overlay.returnToCoreTaskNumber)));
}

export function isTargetedMicroTrainingTriggerDecision(
  value: unknown,
): value is TargetedMicroTrainingTriggerDecision {
  if (!value || typeof value !== 'object') return false;
  const decision = value as TargetedMicroTrainingTriggerDecision;
  return [
    decision.decisionId,
    decision.studentId,
    decision.learningSessionId,
    decision.sourceLearningRoundId,
    decision.sourceAttemptId,
    decision.sourceResourceVersionId,
    decision.sourceMaterialId,
    decision.reasonCode,
  ].every(nonEmpty)
    && Number.isInteger(decision.sourceCoreTaskNumber)
    && decision.sourceCoreTaskNumber >= 1
    && ['eligible', 'not_eligible', 'no_match', 'limit_reached', 'intervention_conflict']
      .includes(decision.outcome)
    && (decision.gapReasonCode === undefined
      || TARGETED_GAP_REASON_CODES.includes(decision.gapReasonCode))
    && decision.triggerPolicyVersion === TARGETED_MICRO_TRAINING_TRIGGER_POLICY_VERSION
    && timestamp(decision.evaluatedAt);
}

export function isTargetedMicroTrainingSchedulingSnapshot(
  value: unknown,
): value is TargetedMicroTrainingSchedulingSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as TargetedMicroTrainingSchedulingSnapshot;
  return snapshot.schemaVersion === TARGETED_MICRO_TRAINING_SCHEDULING_SCHEMA_VERSION
    && Number.isInteger(snapshot.revision)
    && snapshot.revision >= 0
    && Array.isArray(snapshot.decisions)
    && snapshot.decisions.every(isTargetedMicroTrainingTriggerDecision)
    && Array.isArray(snapshot.requests)
    && Array.isArray(snapshot.assignments)
    && timestamp(snapshot.updatedAt);
}

function stableIdentity(prefix: string, values: string[]): string {
  const source = values.map((value) => encodeURIComponent(value.trim())).join('|');
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function timestamp(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}
