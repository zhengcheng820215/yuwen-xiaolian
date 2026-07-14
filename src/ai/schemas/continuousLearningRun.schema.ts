import type { AbilityEvidence } from './abilityEvidence.schema.ts';
import type { GrowthMemorySummary } from './growthMemory.schema.ts';
import type { LearningPersistenceRecord } from './learningPersistence.schema.ts';
import type { LearningRoundResult } from './learningRound.schema.ts';
import type {
  NextLearningAction,
  RecommendedTaskRole,
} from './nextLearningStrategy.schema.ts';
import type { StudentAbilityProfile } from './studentAbilityProfile.schema.ts';

export type LearningRoundTransitionType =
  | 'continue_same_ability'
  | 'retest'
  | 'transfer'
  | 'diagnostic_verification'
  | 'collect_more_evidence'
  | 'switch_ability';

export type LearningRoundTransition = {
  transitionId: string;
  studentId: string;
  fromLearningRoundId: string;
  fromPersistenceRecordId: string;
  fromGrowthMemoryRecordIds: string[];
  fromGrowthMemorySummaryLatestRecordId?: string;
  toLearningRoundId: string;
  nextLearningStrategyId: string;
  taskRequestId: string;
  concreteTaskId: string;
  targetAbilityId: string;
  sourceStrategyAction: NextLearningAction;
  sourceTaskRole: RecommendedTaskRole;
  transitionType: LearningRoundTransitionType;
  traceable: boolean;
  issues: string[];
};

export type ContinuousLearningRunStatus =
  | 'completed'
  | 'stopped'
  | 'blocked'
  | 'retry_required'
  | 'review_required';

export type ContinuousLearningRunEndReason =
  | 'max_rounds_reached'
  | 'runtime_stop'
  | 'student_stopped'
  | 'no_available_task'
  | 'response_retry_required'
  | 'review_required'
  | 'persistence_failed'
  | 'blocked';

export type ContinuousLearningRoundPersistenceStatus =
  | 'not_started'
  | 'saved'
  | 'retry_required'
  | 'failed';

export type ContinuousLearningRoundSnapshot = {
  roundIndex: number;
  learningRoundId: string;
  status: LearningRoundResult['status'];
  strategyId?: string;
  taskRequestId?: string;
  resourceId?: string;
  concreteTaskId?: string;
  executionSessionId?: string;
  responseId?: string;
  targetAbilityId?: string;
  evidenceIds: string[];
  growthMemoryRecordId?: string;
  persistenceRecordId?: string;
  persistenceStatus: ContinuousLearningRoundPersistenceStatus;
  nextStep: LearningRoundResult['nextStep'];
  issues: string[];
};

export type ContinuousLearningRunNextStep =
  | 'continue_next_round'
  | 'supplement_response'
  | 'regenerate_task'
  | 'human_review'
  | 'finish_run';

export type ContinuousLearningRunResult = {
  runId: string;
  studentId: string;
  startedAt: string;
  endedAt?: string;
  status: ContinuousLearningRunStatus;
  endReason: ContinuousLearningRunEndReason;
  maxRounds: 2 | 3;
  completedRoundCount: number;
  rounds: ContinuousLearningRoundSnapshot[];
  transitions: LearningRoundTransition[];
  latestGrowthMemorySummary?: GrowthMemorySummary;
  latestStudentAbilityProfile?: StudentAbilityProfile;
  latestPersistenceRecordId?: string;
  nextStep: ContinuousLearningRunNextStep;
  nextStepReason: string;
  validation: {
    passed: boolean;
    noDuplicateRoundIds: boolean;
    noDuplicateEvidenceIds: boolean;
    transitionsTraceable: boolean;
    persistedBetweenRounds: boolean;
    studentIdConsistent: boolean;
    issues: string[];
  };
};

export type PendingContinuousLearningPersistence = {
  runId: string;
  roundIndex: number;
  record: LearningPersistenceRecord;
};

export type ContinuousLearningRunOutput = {
  result: ContinuousLearningRunResult;
  updatedEvidence: AbilityEvidence[];
  pendingPersistence?: PendingContinuousLearningPersistence;
};

export function isLearningRoundTransition(value: unknown): value is LearningRoundTransition {
  if (!value || typeof value !== 'object') return false;
  const item = value as LearningRoundTransition;

  return (
    isText(item.transitionId) &&
    isText(item.studentId) &&
    isText(item.fromLearningRoundId) &&
    isText(item.fromPersistenceRecordId) &&
    Array.isArray(item.fromGrowthMemoryRecordIds) &&
    item.fromGrowthMemoryRecordIds.length > 0 &&
    item.fromGrowthMemoryRecordIds.every(isText) &&
    isText(item.toLearningRoundId) &&
    isText(item.nextLearningStrategyId) &&
    isText(item.taskRequestId) &&
    isText(item.concreteTaskId) &&
    isText(item.targetAbilityId) &&
    [
      'continue_same_ability',
      'retest',
      'transfer',
      'diagnostic_verification',
      'collect_more_evidence',
      'switch_ability',
    ].includes(item.transitionType) &&
    typeof item.traceable === 'boolean' &&
    Array.isArray(item.issues)
  );
}

export function isContinuousLearningRunResult(value: unknown): value is ContinuousLearningRunResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as ContinuousLearningRunResult;

  return (
    isText(result.runId) &&
    isText(result.studentId) &&
    isText(result.startedAt) &&
    ['completed', 'stopped', 'blocked', 'retry_required', 'review_required'].includes(result.status) &&
    [
      'max_rounds_reached',
      'runtime_stop',
      'student_stopped',
      'no_available_task',
      'response_retry_required',
      'review_required',
      'persistence_failed',
      'blocked',
    ].includes(result.endReason) &&
    (result.maxRounds === 2 || result.maxRounds === 3) &&
    Number.isInteger(result.completedRoundCount) &&
    result.completedRoundCount >= 0 &&
    Array.isArray(result.rounds) &&
    Array.isArray(result.transitions) &&
    result.transitions.every(isLearningRoundTransition) &&
    ['continue_next_round', 'supplement_response', 'regenerate_task', 'human_review', 'finish_run'].includes(result.nextStep) &&
    isText(result.nextStepReason) &&
    Boolean(result.validation) &&
    typeof result.validation.passed === 'boolean' &&
    Array.isArray(result.validation.issues)
  );
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
