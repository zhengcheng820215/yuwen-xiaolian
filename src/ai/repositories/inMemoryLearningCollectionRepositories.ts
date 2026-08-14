import type { LearningObservationEvent } from '../schemas/learningObservationEvent.schema.ts';
import type { LearningObservationOutboxEntry } from '../schemas/learningObservationOutbox.schema.ts';
import type { QuestionCalibrationProjectionRecord } from '../schemas/questionCalibrationProjection.schema.ts';
import type { LearningObservationRepository, LearningObservationWriteResult } from './learningObservationRepository.ts';
import type { LearningObservationOutboxRepository, LearningObservationOutboxWriteResult } from './learningObservationOutboxRepository.ts';
import type { QuestionCalibrationProjectionRepository, QuestionCalibrationProjectionWriteResult } from './questionCalibrationProjectionRepository.ts';

export class InMemoryLearningObservationRepository implements LearningObservationRepository {
  private readonly records = new Map<string, LearningObservationEvent>();

  async save(event: LearningObservationEvent): Promise<LearningObservationWriteResult> {
    const existing = this.records.get(event.eventId);
    if (!existing) {
      this.records.set(event.eventId, clone(event));
      return { status: 'created', event: clone(event), issues: [] };
    }
    if (sameEvent(existing, event)) return { status: 'unchanged', event: clone(existing), issues: [] };
    return { status: 'conflict', event: clone(existing), issues: ['learning_observation_event_conflict'] };
  }

  async getById(eventId: string): Promise<LearningObservationEvent | undefined> {
    return cloneOptional(this.records.get(eventId));
  }

  async listByStudent(studentId: string): Promise<LearningObservationEvent[]> {
    return sorted([...this.records.values()].filter((event) => event.studentId === studentId)).map(clone);
  }

  async listAll(): Promise<LearningObservationEvent[]> { return sorted([...this.records.values()]).map(clone); }

  async listByRound(studentId: string, learningRoundId: string): Promise<LearningObservationEvent[]> {
    return sorted([...this.records.values()].filter((event) => (
      event.studentId === studentId && event.learningRoundId === learningRoundId
    ))).map(clone);
  }

  async listByResourceVersion(resourceVersionId: string): Promise<LearningObservationEvent[]> {
    return sorted([...this.records.values()].filter((event) => event.resourceVersionId === resourceVersionId)).map(clone);
  }

  async clear(): Promise<void> { this.records.clear(); }
}

export class InMemoryLearningObservationOutboxRepository implements LearningObservationOutboxRepository {
  private readonly records = new Map<string, LearningObservationOutboxEntry>();

  async save(entry: LearningObservationOutboxEntry): Promise<LearningObservationOutboxWriteResult> {
    const existing = this.records.get(entry.outboxId);
    if (!existing) {
      this.records.set(entry.outboxId, clone(entry));
      return { status: 'created', entry: clone(entry), issues: [] };
    }
    if (existing.eventId !== entry.eventId
      || existing.createdAt !== entry.createdAt
      || !sameEvent(existing.event, entry.event)) {
      return { status: 'conflict', entry: clone(existing), issues: ['learning_observation_outbox_identity_conflict'] };
    }
    if (stableStringify(existing) === stableStringify(entry)) {
      return { status: 'unchanged', entry: clone(existing), issues: [] };
    }
    this.records.set(entry.outboxId, clone(entry));
    return { status: 'updated', entry: clone(entry), issues: [] };
  }

  async getById(outboxId: string): Promise<LearningObservationOutboxEntry | undefined> {
    return cloneOptional(this.records.get(outboxId));
  }

  async listDue(now: string): Promise<LearningObservationOutboxEntry[]> {
    const time = Date.parse(now);
    return [...this.records.values()]
      .filter((entry) => entry.status !== 'failed' && Date.parse(entry.nextRetryAt) <= time)
      .sort((left, right) => left.nextRetryAt.localeCompare(right.nextRetryAt))
      .map(clone);
  }

  async listAll(): Promise<LearningObservationOutboxEntry[]> {
    return [...this.records.values()]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(clone);
  }

  async delete(outboxId: string): Promise<void> { this.records.delete(outboxId); }
  async clear(): Promise<void> { this.records.clear(); }
}

export class InMemoryQuestionCalibrationProjectionRepository implements QuestionCalibrationProjectionRepository {
  private readonly records = new Map<string, QuestionCalibrationProjectionRecord>();

  async save(record: QuestionCalibrationProjectionRecord): Promise<QuestionCalibrationProjectionWriteResult> {
    const result = resolveQuestionCalibrationProjectionWrite([...this.records.values()], record);
    if (result.status === 'created' || result.status === 'updated') {
      this.records.set(result.record.projectionId, clone(result.record));
    }
    return result;
  }

  async getByAttemptId(attemptId: string): Promise<QuestionCalibrationProjectionRecord | undefined> {
    return cloneOptional([...this.records.values()].find((record) => record.attemptId === attemptId));
  }

  async listByStudent(studentId: string): Promise<QuestionCalibrationProjectionRecord[]> {
    return [...this.records.values()].filter((record) => record.studentId === studentId)
      .sort((left, right) => left.projectedAt.localeCompare(right.projectedAt)).map(clone);
  }

  async listAll(): Promise<QuestionCalibrationProjectionRecord[]> {
    return [...this.records.values()].sort((left, right) => left.projectedAt.localeCompare(right.projectedAt)).map(clone);
  }

  async listByRound(studentId: string, learningRoundId: string): Promise<QuestionCalibrationProjectionRecord[]> {
    return [...this.records.values()].filter((record) => (
      record.studentId === studentId && record.learningRoundId === learningRoundId
    )).sort((left, right) => left.projectedAt.localeCompare(right.projectedAt)).map(clone);
  }

  async listEligibleByResourceVersion(resourceVersionId: string): Promise<QuestionCalibrationProjectionRecord[]> {
    return [...this.records.values()].filter((record) => (
      record.resourceVersionId === resourceVersionId && record.status === 'eligible'
    )).sort((left, right) => left.projectedAt.localeCompare(right.projectedAt)).map(clone);
  }

  async clear(): Promise<void> { this.records.clear(); }
}

export function resolveQuestionCalibrationProjectionWrite(
  records: QuestionCalibrationProjectionRecord[],
  record: QuestionCalibrationProjectionRecord,
): QuestionCalibrationProjectionWriteResult {
  const duplicateAttempt = records.find((item) => (
    item.attemptId === record.attemptId && item.projectionId !== record.projectionId
  ));
  if (duplicateAttempt) {
    return { status: 'conflict', record: clone(duplicateAttempt), issues: ['question_calibration_attempt_identity_conflict'] };
  }
  const existing = records.find((item) => item.projectionId === record.projectionId);
  if (!existing) return { status: 'created', record: clone(record), issues: [] };
  if (stableStringify(existing) === stableStringify(record)) {
    return { status: 'unchanged', record: clone(existing), issues: [] };
  }
  if (existing.status === 'eligible'
    && record.status === 'eligible'
    && stableStringify(withoutProjectionHistoryIssues(existing)) === stableStringify(withoutProjectionHistoryIssues(record))) {
    return { status: 'unchanged', record: clone(existing), issues: [] };
  }
  if (existing.status === 'eligible' && record.status !== 'eligible') {
    return { status: 'unchanged', record: clone(existing), issues: ['eligible_projection_is_terminal'] };
  }
  if (canUpgradeProjection(existing.status, record.status)) {
    const upgraded = {
      ...record,
      issues: [...new Set([
        ...existing.issues,
        `resolved_previous_status:${existing.status}`,
        ...record.issues,
      ])],
    };
    return { status: 'updated', record: clone(upgraded), issues: [] };
  }
  return { status: 'conflict', record: clone(existing), issues: ['question_calibration_projection_conflict'] };
}

function sameEvent(left: LearningObservationEvent, right: LearningObservationEvent): boolean {
  const { recordedAt: _leftRecordedAt, ...leftSemantic } = left;
  const { recordedAt: _rightRecordedAt, ...rightSemantic } = right;
  return stableStringify(leftSemantic) === stableStringify(rightSemantic);
}

function canUpgradeProjection(
  previous: QuestionCalibrationProjectionRecord['status'],
  next: QuestionCalibrationProjectionRecord['status'],
): boolean {
  const rank: Record<QuestionCalibrationProjectionRecord['status'], number> = {
    excluded_non_product_scope: 0,
    excluded_invalid_response: 0,
    projection_failed: 0,
    excluded_incomplete_round: 1,
    excluded_missing_formal_diagnosis: 2,
    excluded_unscorable: 3,
    eligible: 4,
  };
  return rank[previous] > 0 && rank[next] > rank[previous];
}

function withoutProjectionHistoryIssues(record: QuestionCalibrationProjectionRecord): QuestionCalibrationProjectionRecord {
  return {
    ...record,
    issues: record.issues.filter((issue) => (
      !issue.startsWith('resolved_previous_status:')
      && !issue.startsWith('excluded_')
    )),
  };
}

function sorted(events: LearningObservationEvent[]): LearningObservationEvent[] {
  return events.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.eventId.localeCompare(right.eventId));
}

function clone<T>(value: T): T { return structuredClone(value); }
function cloneOptional<T>(value: T | undefined): T | undefined { return value === undefined ? undefined : clone(value); }

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, sortValue(item)]));
}
