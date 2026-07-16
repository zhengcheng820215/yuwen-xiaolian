import { isAbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import {
  LEARNING_SESSION_HISTORY_SCHEMA_VERSION,
  type LearningSessionEndReason,
  type LearningSessionHistoryResult,
  type LearningSessionQuery,
  type LearningSessionRecord,
  type LearningSessionRecordStatus,
  type RejectedLearningSessionRecord,
  isLearningSessionQuery,
  isLearningSessionRecord,
} from '../schemas/learningSessionHistory.schema.ts';
import {
  isLearningPersistenceRecord,
  type LearningPersistenceRecord,
} from '../schemas/learningPersistence.schema.ts';
import type { LearningSessionRepository } from '../repositories/learningSessionRepository.ts';
import { filterLearningSessions } from '../repositories/learningSessionRepository.ts';
import { validatePersistenceRecord } from './learningPersistenceAgent.ts';

export type CreateLearningSessionInput = {
  sessionId: string;
  studentId: string;
  startedAt: string;
  timezone: string;
  primaryAbilityId?: string;
};

export type AppendLearningRoundInput = {
  persistenceRecord: LearningPersistenceRecord;
  activityAt?: string;
};

export type CloseLearningSessionInput = {
  status: Exclude<LearningSessionRecordStatus, 'in_progress'>;
  endReason: LearningSessionEndReason;
  endedAt: string;
};

export function createLearningSessionRecord(
  input: CreateLearningSessionInput,
): LearningSessionRecord {
  const record: LearningSessionRecord = {
    sessionId: input.sessionId,
    studentId: input.studentId,
    startedAt: input.startedAt,
    lastActivityAt: input.startedAt,
    timezone: input.timezone,
    learningRoundIds: [],
    persistenceRecordIds: [],
    evidenceIds: [],
    primaryAbilityId: input.primaryAbilityId,
    targetAbilityIds: input.primaryAbilityId ? [input.primaryAbilityId] : [],
    status: 'in_progress',
    roundCount: 0,
    completedRoundCount: 0,
    schemaVersion: LEARNING_SESSION_HISTORY_SCHEMA_VERSION,
    createdAt: input.startedAt,
    updatedAt: input.startedAt,
    validation: {
      passed: true,
      issues: [],
    },
  };

  return withValidation(record);
}

export function appendLearningRoundToSession(
  session: LearningSessionRecord,
  input: AppendLearningRoundInput,
): LearningSessionRecord {
  assertSessionCanMutate(session);

  const persistence = input.persistenceRecord;
  const issues = validateAppendInput(session, persistence);
  if (issues.length > 0) throw new Error(issues.join(' '));

  const roundId = persistence.learningRoundId;
  const activityAt = input.activityAt || persistence.updatedAt;
  const targetAbilityId = extractTargetAbilityId(persistence);
  const evidenceIds = extractFormalEvidenceIds(persistence);
  const isCompleted = persistence.learningRoundResult?.status === 'completed';
  const roundAlreadyExists = session.learningRoundIds.includes(roundId);
  const wasCompleted = roundAlreadyExists && session.unfinishedRoundId !== roundId;

  const learningRoundIds = appendUnique(session.learningRoundIds, roundId);
  const persistenceRecordIds = appendUnique(session.persistenceRecordIds, persistence.recordId);
  const mergedEvidenceIds = appendUnique(session.evidenceIds, ...evidenceIds);
  const targetAbilityIds = appendUnique(session.targetAbilityIds, targetAbilityId);
  const completedRoundCount = isCompleted && !wasCompleted
    ? session.completedRoundCount + 1
    : session.completedRoundCount;
  const unfinishedRoundId = isCompleted
    ? session.unfinishedRoundId === roundId ? undefined : session.unfinishedRoundId
    : roundId;

  return withValidation({
    ...session,
    lastActivityAt: latestTimestamp(session.lastActivityAt, activityAt),
    learningRoundIds,
    persistenceRecordIds,
    evidenceIds: mergedEvidenceIds,
    targetAbilityIds,
    primaryAbilityId: session.primaryAbilityId || targetAbilityId,
    unfinishedRoundId,
    roundCount: learningRoundIds.length,
    completedRoundCount,
    updatedAt: latestTimestamp(session.updatedAt, activityAt),
    validation: {
      passed: true,
      issues: [],
    },
  });
}

export function closeLearningSessionRecord(
  session: LearningSessionRecord,
  input: CloseLearningSessionInput,
): LearningSessionRecord {
  assertSessionCanMutate(session);

  return withValidation({
    ...session,
    status: input.status,
    endReason: input.endReason,
    endedAt: input.endedAt,
    lastActivityAt: latestTimestamp(session.lastActivityAt, input.endedAt),
    updatedAt: latestTimestamp(session.updatedAt, input.endedAt),
    validation: {
      passed: true,
      issues: [],
    },
  });
}

export async function saveLearningSessionRecord(
  repository: LearningSessionRepository,
  record: LearningSessionRecord,
): Promise<LearningSessionRecord> {
  const validated = withValidation(record);
  if (!validated.validation.passed) {
    throw new Error(validated.validation.issues.join(' '));
  }
  return repository.save(validated);
}

export async function queryLearningSessionHistory(
  repository: LearningSessionRepository,
  query: LearningSessionQuery,
  rejectedAt = new Date().toISOString(),
): Promise<LearningSessionHistoryResult> {
  if (!isLearningSessionQuery(query)) {
    return {
      studentId: query.studentId || 'unknown-student',
      sessions: [],
      total: 0,
      rejectedRecords: [],
      rejectedTotal: 0,
      validation: {
        passed: false,
        issues: ['LearningSessionQuery schema validation failed.'],
      },
    };
  }

  const candidates = await repository.query({ studentId: query.studentId });
  return buildLearningSessionHistoryResult(query.studentId, candidates, query, rejectedAt);
}

export function buildLearningSessionHistoryResult(
  studentId: string,
  candidates: LearningSessionRecord[],
  query: LearningSessionQuery = { studentId },
  rejectedAt = new Date().toISOString(),
): LearningSessionHistoryResult {
  const accepted: LearningSessionRecord[] = [];
  const rejectedRecords: RejectedLearningSessionRecord[] = [];

  for (const session of candidates) {
    const sessionIssues = validateLearningSessionRecord(session);
    if (session.studentId !== studentId) sessionIssues.push(`studentId mismatch in session ${session.sessionId}.`);
    const reasons = uniqueStrings(sessionIssues);

    if (reasons.length === 0) {
      accepted.push(session);
    } else {
      rejectedRecords.push({
        sessionId: nonEmptyStringOrUndefined(session.sessionId),
        studentId: nonEmptyStringOrUndefined(session.studentId),
        schemaVersion: nonEmptyStringOrUndefined(session.schemaVersion),
        reasons,
        rejectedAt,
      });
    }
  }

  const ordered = filterLearningSessions(accepted, query);
  const latest = ordered[0];

  return {
    studentId,
    sessions: ordered,
    total: ordered.length,
    rejectedRecords,
    rejectedTotal: rejectedRecords.length,
    latestSessionId: latest?.sessionId,
    latestLearningAt: latest?.lastActivityAt,
    validation: {
      passed: rejectedRecords.length === 0,
      issues: uniqueStrings(rejectedRecords.flatMap((record) => record.reasons)),
    },
  };
}

export function validateLearningSessionRecord(record: LearningSessionRecord): string[] {
  const issues: string[] = [];

  if (!isLearningSessionRecord(record)) {
    issues.push('LearningSessionRecord schema validation failed.');
  }
  if (record.roundCount !== record.learningRoundIds.length) {
    issues.push('roundCount does not match learningRoundIds length.');
  }
  if (record.persistenceRecordIds.length !== record.learningRoundIds.length) {
    issues.push('persistenceRecordIds must contain one record per learningRoundId.');
  }
  if (record.completedRoundCount > record.roundCount) {
    issues.push('completedRoundCount cannot exceed roundCount.');
  }
  if (record.primaryAbilityId && !record.targetAbilityIds.includes(record.primaryAbilityId)) {
    issues.push('primaryAbilityId must be included in targetAbilityIds.');
  }
  if (record.unfinishedRoundId && !record.learningRoundIds.includes(record.unfinishedRoundId)) {
    issues.push('unfinishedRoundId must be included in learningRoundIds.');
  }
  if (record.status === 'in_progress' && (record.endedAt || record.endReason)) {
    issues.push('In-progress session cannot have endedAt or endReason.');
  }
  if (record.status !== 'in_progress' && (!record.endedAt || !record.endReason)) {
    issues.push('Closed session requires endedAt and endReason.');
  }
  if (record.status === 'completed' && record.unfinishedRoundId) {
    issues.push('Completed session cannot contain unfinishedRoundId.');
  }
  if (record.status === 'completed' && record.completedRoundCount !== record.roundCount) {
    issues.push('Completed session requires completedRoundCount to equal roundCount.');
  }
  if (!isStatusEndReasonCompatible(record.status, record.endReason)) {
    issues.push('Session status and endReason are incompatible.');
  }
  if (Date.parse(record.lastActivityAt) < Date.parse(record.startedAt)) {
    issues.push('lastActivityAt cannot be earlier than startedAt.');
  }
  if (record.endedAt && Date.parse(record.endedAt) < Date.parse(record.startedAt)) {
    issues.push('endedAt cannot be earlier than startedAt.');
  }
  if (record.endedAt && Date.parse(record.endedAt) < Date.parse(record.lastActivityAt)) {
    issues.push('endedAt cannot be earlier than lastActivityAt.');
  }
  if (Date.parse(record.updatedAt) < Date.parse(record.createdAt)) {
    issues.push('updatedAt cannot be earlier than createdAt.');
  }
  if (record.schemaVersion !== LEARNING_SESSION_HISTORY_SCHEMA_VERSION) {
    issues.push('Unsupported LearningSessionRecord schemaVersion.');
  }

  return uniqueStrings(issues);
}

function validateAppendInput(
  session: LearningSessionRecord,
  persistence: LearningPersistenceRecord,
): string[] {
  const issues: string[] = [];

  if (!isLearningPersistenceRecord(persistence)) {
    issues.push('LearningPersistenceRecord schema validation failed.');
  } else {
    issues.push(...validatePersistenceRecord(persistence).map((issue) => (
      `LearningPersistenceRecord invalid: ${issue}`
    )));
  }
  if (persistence.status === 'invalid' || persistence.status === 'restore_failed') {
    issues.push('Invalid persistence record cannot enter Session History.');
  }
  if (persistence.studentId !== session.studentId) {
    issues.push('studentId mismatch between Session and Persistence Record.');
  }
  if (persistence.learningRoundResult) {
    if (persistence.learningRoundResult.studentId !== session.studentId) {
      issues.push('LearningRoundResult.studentId does not match Session.studentId.');
    }
    if (persistence.learningRoundResult.learningRoundId !== persistence.learningRoundId) {
      issues.push('LearningRoundResult.learningRoundId does not match Persistence Record.');
    }

    const evidenceReturn = persistence.learningRoundResult.taskEvidenceReturnResult;
    if (evidenceReturn?.status === 'evidence_returned' && evidenceReturn.validation.passed) {
      if (evidenceReturn.studentId !== session.studentId) {
        issues.push('TaskEvidenceReturnResult.studentId does not match Session.studentId.');
      }
      for (const evidence of evidenceReturn.abilityEvidence) {
        if (evidence.studentId !== session.studentId) {
          issues.push(`AbilityEvidence.studentId mismatch: ${evidence.id}.`);
        }
        if (evidence.taskId !== evidenceReturn.taskId) {
          issues.push(`AbilityEvidence.taskId mismatch: ${evidence.id}.`);
        }
      }
      for (const trace of evidenceReturn.evidenceTraceLinks) {
        if (trace.taskId !== evidenceReturn.taskId) {
          issues.push('TaskEvidenceTraceLink.taskId does not match TaskEvidenceReturnResult.taskId.');
        }
        if (trace.executionSessionId !== evidenceReturn.executionSessionId) {
          issues.push('TaskEvidenceTraceLink.executionSessionId does not match TaskEvidenceReturnResult.');
        }
        if (trace.responseId !== evidenceReturn.responseId) {
          issues.push('TaskEvidenceTraceLink.responseId does not match TaskEvidenceReturnResult.');
        }
        if (trace.diagnosisResultId !== evidenceReturn.diagnosisResultId) {
          issues.push('TaskEvidenceTraceLink.diagnosisResultId does not match TaskEvidenceReturnResult.');
        }
      }
    }
  }
  if (!extractTargetAbilityId(persistence)) {
    issues.push('Target ability is missing from formal round data.');
  }
  if (
    session.unfinishedRoundId &&
    session.unfinishedRoundId !== persistence.learningRoundId &&
    !session.learningRoundIds.includes(persistence.learningRoundId)
  ) {
    issues.push('Session already has another unfinished round.');
  }

  return uniqueStrings(issues);
}

function extractTargetAbilityId(record: LearningPersistenceRecord): string {
  return (
    record.learningRoundResult?.taskEvidenceReturnResult?.concreteTask.targetAbilityId ||
    record.learningRoundResult?.startResult.concreteTask?.targetAbilityId ||
    record.concreteTask?.targetAbilityId ||
    record.growthMemoryRecord?.abilityId ||
    record.growthMemorySummary?.abilityId ||
    ''
  );
}

function extractFormalEvidenceIds(record: LearningPersistenceRecord): string[] {
  const result = record.learningRoundResult?.taskEvidenceReturnResult;
  if (!result || result.status !== 'evidence_returned' || !result.validation.passed) return [];

  return result.abilityEvidence
    .filter(isAbilityEvidence)
    .map((evidence) => evidence.id);
}

function withValidation(record: LearningSessionRecord): LearningSessionRecord {
  const issues = validateLearningSessionRecord({
    ...record,
    validation: {
      passed: true,
      issues: [],
    },
  });

  return {
    ...record,
    validation: {
      passed: issues.length === 0,
      issues,
    },
  };
}

function assertSessionCanMutate(session: LearningSessionRecord): void {
  const issues = validateLearningSessionRecord(session);
  if (issues.length > 0) throw new Error(issues.join(' '));
  if (session.status !== 'in_progress') throw new Error('Closed LearningSessionRecord cannot be mutated.');
}

function isStatusEndReasonCompatible(
  status: LearningSessionRecordStatus,
  endReason?: LearningSessionEndReason,
): boolean {
  if (status === 'in_progress') return endReason === undefined;
  if (!endReason) return false;
  if (status === 'completed') return ['student_finished', 'max_rounds_reached'].includes(endReason);
  if (status === 'interrupted') return endReason === 'student_stopped';
  if (status === 'blocked') return ['runtime_blocked', 'no_available_task'].includes(endReason);
  return status === 'review_required' && endReason === 'review_required';
}

function appendUnique(values: string[], ...newValues: string[]): string[] {
  return Array.from(new Set([...values, ...newValues.filter(Boolean)]));
}

function latestTimestamp(current: string, candidate: string): string {
  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function nonEmptyStringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
