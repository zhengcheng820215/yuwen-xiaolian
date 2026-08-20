import type { LearningPersistenceRecord } from './learningPersistence.schema.ts';
import type { DelayedRetestPlan } from './delayedRetestScheduling.schema.ts';
import type { RealLearningOperationCheckpoint } from './realLearningOperation.schema.ts';
import {
  isStudentLearningPresentation,
  type StudentLearningPresentation,
} from './studentLearningNarrative.schema.ts';
import {
  isTargetedMicroTrainingSessionOverlay,
  type TargetedMicroTrainingSessionOverlay,
} from './targetedMicroTrainingScheduling.schema.ts';

export const UNIFIED_LEARNING_ENTRY_SCHEMA_VERSION = 'unified_learning_entry_v1' as const;

export type UnifiedLearningActivityStatus =
  | 'active'
  | 'review_required'
  | 'blocked'
  | 'ended';

export const LEARNING_SESSION_TASK_QUEUE_VERSION =
  'learning_session_task_queue_v1' as const;

export type LearningSessionTaskQueue = {
  queueVersion: typeof LEARNING_SESSION_TASK_QUEUE_VERSION;
  materialId: string;
  resourceVersionIds: string[];
  targetTaskCount: number;
  createdAt: string;
};

export type UnifiedLearningActivityContext = {
  schemaVersion: typeof UNIFIED_LEARNING_ENTRY_SCHEMA_VERSION;
  studentId: string;
  learningSessionId: string;
  currentLearningRoundId?: string;
  taskQueue?: LearningSessionTaskQueue;
  targetedMicroTrainingOverlay?: TargetedMicroTrainingSessionOverlay;
  status: UnifiedLearningActivityStatus;
  createdAt: string;
  updatedAt: string;
};

export type UnifiedLearningEntryViewStatus =
  | 'review_required'
  | 'blocked'
  | 'recovering_submission'
  | 'continue_round'
  | 'delayed_retest_available'
  | 'feedback_available'
  | 'start_new_round'
  | 'session_ended'
  | 'no_task';

export type UnifiedLearningEntryAction =
  | 'wait_for_review'
  | 'retry_later'
  | 'retry_resource'
  | 'resume_processing'
  | 'continue_learning'
  | 'start_retest'
  | 'view_feedback'
  | 'start_learning'
  | 'start_new_session'
  | 'none';

export type UnifiedLearningTaskAvailabilityState =
  | 'available'
  | 'no_formal_resource'
  | 'no_eligible_match'
  | 'already_used'
  | 'stale_session';

export type UnifiedLearningEntryState = {
  schemaVersion: typeof UNIFIED_LEARNING_ENTRY_SCHEMA_VERSION;
  studentId: string;
  status: UnifiedLearningEntryViewStatus;
  priority: number;
  title: string;
  message: string;
  primaryAction: UnifiedLearningEntryAction;
  primaryActionText: string;
  canEnterWorkspace: boolean;
  hasActiveSession: boolean;
  hasDraft: boolean;
  hasUnviewedFeedback: boolean;
  currentRoundNumber?: number;
  completedRoundCount: number;
  taskAvailabilityState?: UnifiedLearningTaskAvailabilityState;
  focusText?: string;
  learningPresentation?: StudentLearningPresentation;
  retest?: {
    targetAbilityId: string;
    plannedRetestAt: string;
    whyNow: string;
  };
  studentVisibleIssues: string[];
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type UnifiedLearningEntryInput = {
  studentId: string;
  now: string;
  activeContexts: UnifiedLearningActivityContext[];
  latestPersistenceRecord?: LearningPersistenceRecord;
  delayedRetestPlans?: DelayedRetestPlan[];
  operationCheckpoint?: RealLearningOperationCheckpoint;
  hasAvailableTask: boolean;
  taskAvailabilityState?: UnifiedLearningTaskAvailabilityState;
  taskAvailabilityMessage?: string;
  completedRoundCount: number;
};

export type InternalLearningReviewSummary = {
  schemaVersion: typeof UNIFIED_LEARNING_ENTRY_SCHEMA_VERSION;
  reviewKey: string;
  studentId: string;
  status: 'completed' | 'review_required' | 'blocked' | 'recovering';
  actionRequired: boolean;
  headline: string;
  summary: string;
  stages: Array<{
    key: string;
    label: string;
    status: 'completed' | 'current' | 'blocked' | 'pending';
  }>;
  trace: {
    operationId: string;
    learningSessionId: string;
    learningRoundId: string;
    sourceResourceVersionId: string;
    formalDiagnosisId?: string;
    evidenceIds: string[];
    persistenceRecordId?: string;
    nextResourceVersionId?: string;
  };
  issues: string[];
  sensitiveDataHidden: true;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export function isUnifiedLearningActivityContext(
  value: unknown,
): value is UnifiedLearningActivityContext {
  if (!value || typeof value !== 'object') return false;
  const context = value as UnifiedLearningActivityContext;
  return context.schemaVersion === UNIFIED_LEARNING_ENTRY_SCHEMA_VERSION &&
    nonEmpty(context.studentId) &&
    nonEmpty(context.learningSessionId) &&
    (context.taskQueue === undefined || isLearningSessionTaskQueue(context.taskQueue)) &&
    (context.targetedMicroTrainingOverlay === undefined || (
      isTargetedMicroTrainingSessionOverlay(context.targetedMicroTrainingOverlay) &&
      context.targetedMicroTrainingOverlay.learningSessionId === context.learningSessionId
    )) &&
    ['active', 'review_required', 'blocked', 'ended'].includes(context.status) &&
    timestamp(context.createdAt) &&
    timestamp(context.updatedAt);
}

export function isLearningSessionTaskQueue(
  value: unknown,
): value is LearningSessionTaskQueue {
  if (!value || typeof value !== 'object') return false;
  const queue = value as LearningSessionTaskQueue;
  return queue.queueVersion === LEARNING_SESSION_TASK_QUEUE_VERSION &&
    nonEmpty(queue.materialId) &&
    Array.isArray(queue.resourceVersionIds) &&
    queue.resourceVersionIds.length >= 1 &&
    queue.resourceVersionIds.length <= 6 &&
    queue.resourceVersionIds.every(nonEmpty) &&
    new Set(queue.resourceVersionIds).size === queue.resourceVersionIds.length &&
    Number.isInteger(queue.targetTaskCount) &&
    queue.targetTaskCount === queue.resourceVersionIds.length &&
    timestamp(queue.createdAt);
}

export function isUnifiedLearningEntryState(value: unknown): value is UnifiedLearningEntryState {
  if (!value || typeof value !== 'object') return false;
  const state = value as UnifiedLearningEntryState;
  return state.schemaVersion === UNIFIED_LEARNING_ENTRY_SCHEMA_VERSION &&
    nonEmpty(state.studentId) &&
    ['review_required', 'blocked', 'recovering_submission', 'continue_round', 'delayed_retest_available', 'feedback_available', 'start_new_round', 'session_ended', 'no_task'].includes(state.status) &&
    Number.isInteger(state.priority) &&
    nonEmpty(state.title) &&
    nonEmpty(state.message) &&
    ['wait_for_review', 'retry_later', 'retry_resource', 'resume_processing', 'continue_learning', 'start_retest', 'view_feedback', 'start_learning', 'start_new_session', 'none'].includes(state.primaryAction) &&
    nonEmpty(state.primaryActionText) &&
    typeof state.canEnterWorkspace === 'boolean' &&
    typeof state.hasActiveSession === 'boolean' &&
    typeof state.hasDraft === 'boolean' &&
    typeof state.hasUnviewedFeedback === 'boolean' &&
    Number.isInteger(state.completedRoundCount) &&
    (state.taskAvailabilityState === undefined || ['available', 'no_formal_resource', 'no_eligible_match', 'already_used', 'stale_session'].includes(state.taskAvailabilityState)) &&
    (state.learningPresentation === undefined || isStudentLearningPresentation(state.learningPresentation)) &&
    Array.isArray(state.studentVisibleIssues) &&
    Boolean(state.validation) &&
    typeof state.validation.passed === 'boolean' &&
    Array.isArray(state.validation.issues);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function timestamp(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}
