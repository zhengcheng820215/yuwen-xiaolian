export const PHASE163_MULTI_DAY_SCHEMA_VERSION = 'phase16_3_multiday_v1' as const;

export type Phase163TimeSource = 'natural' | 'simulated';
export type Phase163DailyStatus = 'completed' | 'interrupted' | 'blocked' | 'review_required';

export type Phase163DailyOperationRecord = {
  dayKey: string;
  observedAt: string;
  timezone: string;
  timeSource: Phase163TimeSource;
  operationId: string;
  learningSessionId: string;
  learningRoundId: string;
  resourceId: string;
  resourceVersionId: string;
  status: Phase163DailyStatus;
  formalDiagnosisId?: string;
  evidenceIds: string[];
  profileUpdated: boolean;
  growthMemoryUpdated: boolean;
  recoveredFromCheckpoint: boolean;
  duplicateFormalWrites: string[];
  nextResourceVersionId?: string;
  retestPlanId?: string;
  retestCompleted: boolean;
  anomalyCodes: string[];
  validation: { passed: boolean; issues: string[] };
};

export type Phase163MultiDayRunState = {
  runId: string;
  studentId: string;
  timezone: string;
  targetNaturalDayCount: number;
  startedAt: string;
  updatedAt: string;
  status: 'engineering_ready' | 'natural_run_in_progress' | 'acceptance_ready' | 'blocked';
  days: Phase163DailyOperationRecord[];
  validation: { passed: boolean; issues: string[] };
  schemaVersion: typeof PHASE163_MULTI_DAY_SCHEMA_VERSION;
};

export type Phase163MultiDayAcceptance = {
  runId: string;
  studentId: string;
  engineeringReady: boolean;
  naturalRunComplete: boolean;
  counts: {
    naturalDays: number;
    totalDays: number;
    sessions: number;
    rounds: number;
    resources: number;
    evidence: number;
    completedRetests: number;
    recoveries: number;
    anomalyExercises: number;
  };
  checks: {
    identitiesStable: boolean;
    formalWritesIdempotent: boolean;
    atLeastTwoSessions: boolean;
    atLeastThreeRounds: boolean;
    atLeastTwoResources: boolean;
    atLeastTwoEvidence: boolean;
    delayedRetestObserved: boolean;
    recoveryObserved: boolean;
    anomalyObserved: boolean;
    naturalDayTargetReached: boolean;
  };
  issues: string[];
};

export function isPhase163MultiDayRunState(value: unknown): value is Phase163MultiDayRunState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Phase163MultiDayRunState;
  return state.schemaVersion === PHASE163_MULTI_DAY_SCHEMA_VERSION &&
    nonEmpty(state.runId) && nonEmpty(state.studentId) && nonEmpty(state.timezone) &&
    Number.isInteger(state.targetNaturalDayCount) && state.targetNaturalDayCount >= 5 && state.targetNaturalDayCount <= 7 &&
    timestamp(state.startedAt) && timestamp(state.updatedAt) &&
    ['engineering_ready', 'natural_run_in_progress', 'acceptance_ready', 'blocked'].includes(state.status) &&
    Array.isArray(state.days) && state.days.every(isDailyRecord) &&
    typeof state.validation?.passed === 'boolean' && Array.isArray(state.validation?.issues);
}

function isDailyRecord(value: unknown): value is Phase163DailyOperationRecord {
  if (!value || typeof value !== 'object') return false;
  const day = value as Phase163DailyOperationRecord;
  return /^\d{4}-\d{2}-\d{2}$/.test(day.dayKey) && timestamp(day.observedAt) && nonEmpty(day.timezone) &&
    ['natural', 'simulated'].includes(day.timeSource) && nonEmpty(day.operationId) &&
    nonEmpty(day.learningSessionId) && nonEmpty(day.learningRoundId) && nonEmpty(day.resourceId) &&
    nonEmpty(day.resourceVersionId) && ['completed', 'interrupted', 'blocked', 'review_required'].includes(day.status) &&
    stringArray(day.evidenceIds) && typeof day.profileUpdated === 'boolean' &&
    typeof day.growthMemoryUpdated === 'boolean' && typeof day.recoveredFromCheckpoint === 'boolean' &&
    stringArray(day.duplicateFormalWrites) && typeof day.retestCompleted === 'boolean' &&
    stringArray(day.anomalyCodes) && typeof day.validation?.passed === 'boolean' && Array.isArray(day.validation?.issues);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function timestamp(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty) && new Set(value).size === value.length;
}
