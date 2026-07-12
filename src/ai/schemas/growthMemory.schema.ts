import {
  PROFILE_UPDATE_ACTIONS,
  type ProfileUpdateAction,
} from './profileUpdateDecision.schema.ts';

export type GrowthMemoryRecentTrend =
  | 'insufficient_evidence'
  | 'continued_observation'
  | 'retest_pending'
  | 'fluctuating'
  | 'confidence_increasing'
  | 'status_improving'
  | 'mixed';

export type AbilityProfileSnapshot = {
  abilityId: string;
  abilityLabel?: string;
  abilityStatus?: string;
  confidence?: number;
  currentWeakness?: string;
  evidenceCount: number;
  summary?: string;
  updatedAt?: string;
};

export type GrowthMemoryRecord = {
  recordId: string;
  studentId: string;
  abilityId: string;
  abilityLabel?: string;
  createdAt: string;
  evaluationResultId: string;
  profileUpdateDecisionId: string;
  evidenceLinks: string[];
  action: ProfileUpdateAction;
  beforeProfileSummary: AbilityProfileSnapshot;
  afterProfileSummary: AbilityProfileSnapshot;
  reason: string;
  limitations: string[];
  nextAction?: string;
  sourceRuntime?: string;
  relatedSessionId?: string;
};

export type GrowthMemorySummary = {
  studentId: string;
  abilityId: string;
  abilityLabel?: string;
  recordCount: number;
  latestRecordId?: string;
  latestAction?: ProfileUpdateAction;
  recentActions: ProfileUpdateAction[];
  recentTrend: GrowthMemoryRecentTrend;
  pendingActions: string[];
  evidenceLinks: string[];
  limitations: string[];
  summary: string;
};

export const GROWTH_MEMORY_RECENT_TRENDS: GrowthMemoryRecentTrend[] = [
  'insufficient_evidence',
  'continued_observation',
  'retest_pending',
  'fluctuating',
  'confidence_increasing',
  'status_improving',
  'mixed',
];

export function isGrowthMemoryRecord(value: unknown): value is GrowthMemoryRecord {
  if (!value || typeof value !== 'object') return false;

  const record = value as GrowthMemoryRecord;

  return (
    isNonEmptyString(record.recordId) &&
    isNonEmptyString(record.studentId) &&
    isNonEmptyString(record.abilityId) &&
    (record.abilityLabel === undefined || isNonEmptyString(record.abilityLabel)) &&
    isNonEmptyString(record.createdAt) &&
    isNonEmptyString(record.evaluationResultId) &&
    isNonEmptyString(record.profileUpdateDecisionId) &&
    Array.isArray(record.evidenceLinks) &&
    record.evidenceLinks.length > 0 &&
    record.evidenceLinks.every(isNonEmptyString) &&
    PROFILE_UPDATE_ACTIONS.includes(record.action) &&
    isAbilityProfileSnapshot(record.beforeProfileSummary) &&
    isAbilityProfileSnapshot(record.afterProfileSummary) &&
    isNonEmptyString(record.reason) &&
    Array.isArray(record.limitations) &&
    record.limitations.every((item) => typeof item === 'string') &&
    (record.nextAction === undefined || isNonEmptyString(record.nextAction)) &&
    (record.sourceRuntime === undefined || isNonEmptyString(record.sourceRuntime)) &&
    (record.relatedSessionId === undefined || isNonEmptyString(record.relatedSessionId))
  );
}

export function isGrowthMemorySummary(value: unknown): value is GrowthMemorySummary {
  if (!value || typeof value !== 'object') return false;

  const summary = value as GrowthMemorySummary;

  return (
    isNonEmptyString(summary.studentId) &&
    isNonEmptyString(summary.abilityId) &&
    (summary.abilityLabel === undefined || isNonEmptyString(summary.abilityLabel)) &&
    isNonNegativeNumber(summary.recordCount) &&
    (summary.latestRecordId === undefined || isNonEmptyString(summary.latestRecordId)) &&
    (summary.latestAction === undefined || PROFILE_UPDATE_ACTIONS.includes(summary.latestAction)) &&
    Array.isArray(summary.recentActions) &&
    summary.recentActions.every((action) => PROFILE_UPDATE_ACTIONS.includes(action)) &&
    GROWTH_MEMORY_RECENT_TRENDS.includes(summary.recentTrend) &&
    Array.isArray(summary.pendingActions) &&
    summary.pendingActions.every(isNonEmptyString) &&
    Array.isArray(summary.evidenceLinks) &&
    summary.evidenceLinks.every(isNonEmptyString) &&
    Array.isArray(summary.limitations) &&
    summary.limitations.every((item) => typeof item === 'string') &&
    isNonEmptyString(summary.summary)
  );
}

function isAbilityProfileSnapshot(value: unknown): value is AbilityProfileSnapshot {
  if (!value || typeof value !== 'object') return false;

  const snapshot = value as AbilityProfileSnapshot;

  return (
    isNonEmptyString(snapshot.abilityId) &&
    (snapshot.abilityLabel === undefined || isNonEmptyString(snapshot.abilityLabel)) &&
    (snapshot.abilityStatus === undefined || isNonEmptyString(snapshot.abilityStatus)) &&
    (snapshot.confidence === undefined || isConfidence(snapshot.confidence)) &&
    (snapshot.currentWeakness === undefined || isNonEmptyString(snapshot.currentWeakness)) &&
    isNonNegativeNumber(snapshot.evidenceCount) &&
    (snapshot.summary === undefined || isNonEmptyString(snapshot.summary)) &&
    (snapshot.updatedAt === undefined || isNonEmptyString(snapshot.updatedAt))
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0;
}

function isConfidence(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0 && value <= 1;
}
