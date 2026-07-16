export const LEARNING_SESSION_HISTORY_SCHEMA_VERSION = 'learning_session_history_v1' as const;

export type LearningSessionRecordStatus =
  | 'in_progress'
  | 'completed'
  | 'interrupted'
  | 'blocked'
  | 'review_required';

export type LearningSessionEndReason =
  | 'student_finished'
  | 'max_rounds_reached'
  | 'student_stopped'
  | 'runtime_blocked'
  | 'review_required'
  | 'no_available_task';

export type LearningSessionRecord = {
  sessionId: string;
  studentId: string;
  startedAt: string;
  endedAt?: string;
  lastActivityAt: string;
  timezone: string;
  learningRoundIds: string[];
  persistenceRecordIds: string[];
  evidenceIds: string[];
  primaryAbilityId?: string;
  targetAbilityIds: string[];
  status: LearningSessionRecordStatus;
  endReason?: LearningSessionEndReason;
  unfinishedRoundId?: string;
  roundCount: number;
  completedRoundCount: number;
  schemaVersion: typeof LEARNING_SESSION_HISTORY_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type LearningSessionQuery = {
  studentId: string;
  abilityId?: string;
  startedFrom?: string;
  startedTo?: string;
  status?: LearningSessionRecordStatus;
  hasUnfinishedRound?: boolean;
  limit?: number;
};

export type RejectedLearningSessionRecord = {
  sessionId?: string;
  studentId?: string;
  schemaVersion?: string;
  reasons: string[];
  rejectedAt: string;
};

export type LearningSessionHistoryResult = {
  studentId: string;
  sessions: LearningSessionRecord[];
  total: number;
  rejectedRecords: RejectedLearningSessionRecord[];
  rejectedTotal: number;
  latestSessionId?: string;
  latestLearningAt?: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export const LEARNING_SESSION_RECORD_STATUSES: LearningSessionRecordStatus[] = [
  'in_progress',
  'completed',
  'interrupted',
  'blocked',
  'review_required',
];

export const LEARNING_SESSION_END_REASONS: LearningSessionEndReason[] = [
  'student_finished',
  'max_rounds_reached',
  'student_stopped',
  'runtime_blocked',
  'review_required',
  'no_available_task',
];

export function isLearningSessionRecord(value: unknown): value is LearningSessionRecord {
  if (!value || typeof value !== 'object') return false;

  const record = value as LearningSessionRecord;

  return (
    isNonEmptyString(record.sessionId) &&
    isNonEmptyString(record.studentId) &&
    isTimestamp(record.startedAt) &&
    (record.endedAt === undefined || isTimestamp(record.endedAt)) &&
    isTimestamp(record.lastActivityAt) &&
    isNonEmptyString(record.timezone) &&
    isUniqueStringArray(record.learningRoundIds) &&
    isUniqueStringArray(record.persistenceRecordIds) &&
    isUniqueStringArray(record.evidenceIds) &&
    (record.primaryAbilityId === undefined || isNonEmptyString(record.primaryAbilityId)) &&
    isUniqueStringArray(record.targetAbilityIds) &&
    LEARNING_SESSION_RECORD_STATUSES.includes(record.status) &&
    (record.endReason === undefined || LEARNING_SESSION_END_REASONS.includes(record.endReason)) &&
    (record.unfinishedRoundId === undefined || isNonEmptyString(record.unfinishedRoundId)) &&
    isNonNegativeInteger(record.roundCount) &&
    isNonNegativeInteger(record.completedRoundCount) &&
    record.schemaVersion === LEARNING_SESSION_HISTORY_SCHEMA_VERSION &&
    isTimestamp(record.createdAt) &&
    isTimestamp(record.updatedAt) &&
    isValidation(record.validation)
  );
}

export function isLearningSessionQuery(value: unknown): value is LearningSessionQuery {
  if (!value || typeof value !== 'object') return false;

  const query = value as LearningSessionQuery;

  return (
    isNonEmptyString(query.studentId) &&
    (query.abilityId === undefined || isNonEmptyString(query.abilityId)) &&
    (query.startedFrom === undefined || isTimestamp(query.startedFrom)) &&
    (query.startedTo === undefined || isTimestamp(query.startedTo)) &&
    (query.status === undefined || LEARNING_SESSION_RECORD_STATUSES.includes(query.status)) &&
    (query.hasUnfinishedRound === undefined || typeof query.hasUnfinishedRound === 'boolean') &&
    (query.limit === undefined || (Number.isInteger(query.limit) && query.limit > 0))
  );
}

export function isLearningSessionHistoryResult(
  value: unknown,
): value is LearningSessionHistoryResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as LearningSessionHistoryResult;

  return (
    isNonEmptyString(result.studentId) &&
    Array.isArray(result.sessions) &&
    result.sessions.every((session) => isLearningSessionRecord(session) && session.validation.passed) &&
    isNonNegativeInteger(result.total) &&
    result.total === result.sessions.length &&
    Array.isArray(result.rejectedRecords) &&
    result.rejectedRecords.every(isRejectedLearningSessionRecord) &&
    isNonNegativeInteger(result.rejectedTotal) &&
    result.rejectedTotal === result.rejectedRecords.length &&
    (result.latestSessionId === undefined || isNonEmptyString(result.latestSessionId)) &&
    (result.latestLearningAt === undefined || isTimestamp(result.latestLearningAt)) &&
    isValidation(result.validation)
  );
}

export function isRejectedLearningSessionRecord(
  value: unknown,
): value is RejectedLearningSessionRecord {
  if (!value || typeof value !== 'object') return false;

  const record = value as RejectedLearningSessionRecord;

  return (
    (record.sessionId === undefined || isNonEmptyString(record.sessionId)) &&
    (record.studentId === undefined || isNonEmptyString(record.studentId)) &&
    (record.schemaVersion === undefined || isNonEmptyString(record.schemaVersion)) &&
    Array.isArray(record.reasons) &&
    record.reasons.length > 0 &&
    record.reasons.every(isNonEmptyString) &&
    isTimestamp(record.rejectedAt)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isUniqueStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(isNonEmptyString) &&
    new Set(value).size === value.length
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && value >= 0;
}

function isValidation(value: unknown): value is LearningSessionRecord['validation'] {
  if (!value || typeof value !== 'object') return false;

  const validation = value as LearningSessionRecord['validation'];

  return (
    typeof validation.passed === 'boolean' &&
    Array.isArray(validation.issues) &&
    validation.issues.every((issue) => typeof issue === 'string')
  );
}
