import type { Phase163RealLearningChainResult } from '../schemas/realLearningOperation.schema.ts';
import {
  PHASE163_MULTI_DAY_SCHEMA_VERSION,
  isPhase163MultiDayRunState,
  type Phase163DailyOperationRecord,
  type Phase163MultiDayAcceptance,
  type Phase163MultiDayRunState,
  type Phase163TimeSource,
} from '../schemas/phase163MultiDayOperation.schema.ts';

export function createPhase163MultiDayRun(input: {
  runId: string;
  studentId: string;
  timezone: string;
  targetNaturalDayCount?: number;
  startedAt: string;
}): Phase163MultiDayRunState {
  const state: Phase163MultiDayRunState = {
    runId: input.runId,
    studentId: input.studentId,
    timezone: input.timezone,
    targetNaturalDayCount: input.targetNaturalDayCount || 5,
    startedAt: input.startedAt,
    updatedAt: input.startedAt,
    status: 'engineering_ready',
    days: [],
    validation: { passed: true, issues: [] },
    schemaVersion: PHASE163_MULTI_DAY_SCHEMA_VERSION,
  };
  return validateState(state);
}

export function recordPhase163DailyOperation(
  state: Phase163MultiDayRunState,
  input: {
    result: Phase163RealLearningChainResult;
    observedAt: string;
    dayKey: string;
    timeSource: Phase163TimeSource;
    recoveredFromCheckpoint?: boolean;
    retestPlanId?: string;
    retestCompleted?: boolean;
    anomalyCodes?: string[];
  },
): Phase163MultiDayRunState {
  const stateIssues = validateState(state).validation.issues;
  const checkpoint = input.result.checkpoint;
  const issues = unique([
    ...stateIssues,
    ...(checkpoint.studentId === state.studentId ? [] : ['multiday_student_identity_mismatch']),
    ...(checkpoint.learningSessionId ? [] : ['multiday_session_id_missing']),
    ...(checkpoint.learningRoundId ? [] : ['multiday_round_id_missing']),
    ...(checkpoint.sourceResourceVersionId ? [] : ['multiday_resource_version_missing']),
    ...(input.retestCompleted && checkpoint.concreteTask?.taskRole !== 'retest'
      ? ['completed_retest_requires_retest_task_role']
      : []),
    ...input.result.acceptanceReport.persistence.duplicateFormalWrites.map((item) => `duplicate_formal_write:${item}`),
  ]);
  const record: Phase163DailyOperationRecord = {
    dayKey: input.dayKey,
    observedAt: input.observedAt,
    timezone: state.timezone,
    timeSource: input.timeSource,
    operationId: checkpoint.operationId,
    learningSessionId: checkpoint.learningSessionId,
    learningRoundId: checkpoint.learningRoundId,
    resourceId: checkpoint.sourceResourceId,
    resourceVersionId: checkpoint.sourceResourceVersionId,
    status: mapStatus(input.result.status),
    formalDiagnosisId: checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit?.formalDiagnosisId,
    evidenceIds: checkpoint.taskEvidenceReturnResult?.abilityEvidence.map((item) => item.id) || [],
    profileUpdated: Boolean(checkpoint.updatedStudentAbilityProfile),
    growthMemoryUpdated: Boolean(checkpoint.updatedGrowthMemorySummary),
    recoveredFromCheckpoint: Boolean(input.recoveredFromCheckpoint || input.result.acceptanceReport.persistence.recoveredFromCheckpoint),
    duplicateFormalWrites: input.result.acceptanceReport.persistence.duplicateFormalWrites,
    nextResourceVersionId: checkpoint.nextTaskResolution?.resourceVersion?.resourceVersionId,
    retestPlanId: input.retestPlanId,
    retestCompleted: Boolean(input.retestCompleted),
    anomalyCodes: unique(input.anomalyCodes || []),
    validation: { passed: issues.length === 0, issues },
  };

  const operationObservations = state.days.filter((item) => item.operationId === record.operationId);
  const identityConflict = operationObservations.some((item) => (
    item.learningSessionId !== record.learningSessionId ||
    item.learningRoundId !== record.learningRoundId ||
    item.resourceVersionId !== record.resourceVersionId
  ));
  if (identityConflict) {
    return validateState({
      ...state,
      status: 'blocked',
      updatedAt: input.observedAt,
      validation: { passed: false, issues: ['multiday_operation_identity_conflict'] },
    });
  }
  const existing = operationObservations.find((item) => item.dayKey === record.dayKey);
  if (existing) {
    return validateState({
      ...state,
      updatedAt: input.observedAt,
      days: state.days.map((item) => item.operationId === record.operationId
        ? {
          ...item,
          recoveredFromCheckpoint: item.recoveredFromCheckpoint || record.recoveredFromCheckpoint,
          anomalyCodes: unique([...item.anomalyCodes, ...record.anomalyCodes]),
        }
        : item),
    });
  }

  const next = validateState({
    ...state,
    updatedAt: input.observedAt,
    status: input.timeSource === 'natural' ? 'natural_run_in_progress' : state.status,
    days: [...state.days, record].sort((a, b) => a.observedAt.localeCompare(b.observedAt)),
  });
  const acceptance = buildPhase163MultiDayAcceptance(next);
  return {
    ...next,
    status: !next.validation.passed
      ? 'blocked'
      : acceptance.naturalRunComplete
        ? 'acceptance_ready'
        : next.status,
  };
}

export function buildPhase163MultiDayAcceptance(
  state: Phase163MultiDayRunState,
): Phase163MultiDayAcceptance {
  const naturalDays = new Set(state.days.filter((item) => item.timeSource === 'natural').map((item) => item.dayKey)).size;
  const sessions = new Set(state.days.map((item) => item.learningSessionId)).size;
  const rounds = new Set(state.days.map((item) => item.learningRoundId)).size;
  const resources = new Set(state.days.map((item) => item.resourceVersionId)).size;
  const evidence = new Set(state.days.flatMap((item) => item.evidenceIds)).size;
  const completedRetests = state.days.filter((item) => item.retestCompleted).length;
  const recoveries = state.days.filter((item) => item.recoveredFromCheckpoint).length;
  const anomalyExercises = state.days.filter((item) => item.anomalyCodes.length > 0).length;
  const checks = {
    identitiesStable: state.validation.passed && state.days.every((item) => item.validation.passed),
    formalWritesIdempotent: state.days.every((item) => item.duplicateFormalWrites.length === 0),
    atLeastTwoSessions: sessions >= 2,
    atLeastThreeRounds: rounds >= 3,
    atLeastTwoResources: resources >= 2,
    atLeastTwoEvidence: evidence >= 2,
    delayedRetestObserved: completedRetests >= 1,
    recoveryObserved: recoveries >= 1,
    anomalyObserved: anomalyExercises >= 1,
    naturalDayTargetReached: naturalDays >= state.targetNaturalDayCount,
  };
  const engineeringReady = Object.entries(checks)
    .filter(([key]) => key !== 'naturalDayTargetReached')
    .every(([, passed]) => passed);
  return {
    runId: state.runId,
    studentId: state.studentId,
    engineeringReady,
    naturalRunComplete: engineeringReady && checks.naturalDayTargetReached,
    counts: {
      naturalDays,
      totalDays: new Set(state.days.map((item) => item.dayKey)).size,
      sessions,
      rounds,
      resources,
      evidence,
      completedRetests,
      recoveries,
      anomalyExercises,
    },
    checks,
    issues: unique([
      ...state.validation.issues,
      ...state.days.flatMap((item) => item.validation.issues),
      ...(engineeringReady ? [] : ['multiday_engineering_minimum_not_reached']),
      ...(checks.naturalDayTargetReached ? [] : ['natural_day_target_not_reached']),
    ]),
  };
}

function validateState(state: Phase163MultiDayRunState): Phase163MultiDayRunState {
  const issues: string[] = [...state.validation.issues];
  if (!isPhase163MultiDayRunState({ ...state, validation: { passed: true, issues: [] } })) {
    issues.push('phase163_multiday_schema_invalid');
  }
  const observationKeys = state.days.map((item) => `${item.dayKey}::${item.operationId}`);
  if (new Set(observationKeys).size !== observationKeys.length) issues.push('multiday_duplicate_daily_observation');
  return {
    ...state,
    status: issues.length > 0 ? 'blocked' : state.status,
    validation: { passed: issues.length === 0, issues: unique(issues) },
  };
}

function mapStatus(status: Phase163RealLearningChainResult['status']): Phase163DailyOperationRecord['status'] {
  if (status === 'completed') return 'completed';
  if (status === 'review_required') return 'review_required';
  if (status === 'blocked') return 'blocked';
  return 'interrupted';
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
