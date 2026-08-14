import {
  isLearningTaskAttemptRecord,
  type LearningTaskAttemptRecord,
} from '../schemas/learningFeedbackRevision.schema.ts';
import type {
  LearningTaskAttemptRepository,
  LearningTaskAttemptWriteResult,
} from './learningTaskAttemptRepository.ts';

export class InMemoryLearningTaskAttemptRepository implements LearningTaskAttemptRepository {
  private readonly records = new Map<string, LearningTaskAttemptRecord>();

  async save(record: LearningTaskAttemptRecord): Promise<LearningTaskAttemptWriteResult> {
    const result = resolveLearningTaskAttemptWrite([...this.records.values()], record);
    if (result.status === 'created' || result.status === 'updated') {
      this.records.set(result.record.learningTaskAttemptId, clone(result.record));
    }
    return result;
  }

  async getById(learningTaskAttemptId: string): Promise<LearningTaskAttemptRecord | undefined> {
    return cloneOptional(this.records.get(learningTaskAttemptId));
  }

  async getByInitialAttemptId(initialAttemptId: string): Promise<LearningTaskAttemptRecord | undefined> {
    return cloneOptional([...this.records.values()].find((record) => record.initialAttemptId === initialAttemptId));
  }

  async listByRound(studentId: string, learningRoundId: string): Promise<LearningTaskAttemptRecord[]> {
    return sorted([...this.records.values()].filter((record) => (
      record.studentId === studentId && record.learningRoundId === learningRoundId
    ))).map(clone);
  }

  async listByStudent(studentId: string): Promise<LearningTaskAttemptRecord[]> {
    return sorted([...this.records.values()].filter((record) => record.studentId === studentId)).map(clone);
  }

  async listAll(): Promise<LearningTaskAttemptRecord[]> {
    return sorted([...this.records.values()]).map(clone);
  }

  async clear(): Promise<void> { this.records.clear(); }
}

export function resolveLearningTaskAttemptWrite(
  records: LearningTaskAttemptRecord[],
  candidate: LearningTaskAttemptRecord,
): LearningTaskAttemptWriteResult {
  if (!isLearningTaskAttemptRecord(candidate) || !hasConsistentAggregateState(candidate)) {
    return { status: 'conflict', record: clone(candidate), issues: ['learning_task_attempt_schema_invalid'] };
  }

  const duplicateInitialAttempt = records.find((record) => (
    record.initialAttemptId === candidate.initialAttemptId
    && record.learningTaskAttemptId !== candidate.learningTaskAttemptId
  ));
  if (duplicateInitialAttempt) {
    return {
      status: 'conflict',
      record: clone(duplicateInitialAttempt),
      issues: ['learning_task_attempt_initial_identity_conflict'],
    };
  }

  const existing = records.find((record) => (
    record.learningTaskAttemptId === candidate.learningTaskAttemptId
  ));
  if (!existing) return { status: 'created', record: clone(candidate), issues: [] };
  if (stableStringify(existing) === stableStringify(candidate)
    || stableStringify(withoutUpdatedAt(existing)) === stableStringify(withoutUpdatedAt(candidate))) {
    return { status: 'unchanged', record: clone(existing), issues: [] };
  }
  if (!sameImmutableAttempt(existing, candidate)) {
    return { status: 'conflict', record: clone(existing), issues: ['learning_task_attempt_initial_response_immutable'] };
  }
  if (!isAllowedAttemptTransition(existing, candidate)) {
    return { status: 'conflict', record: clone(existing), issues: ['learning_task_attempt_invalid_transition'] };
  }
  return { status: 'updated', record: clone(candidate), issues: [] };
}

function sameImmutableAttempt(left: LearningTaskAttemptRecord, right: LearningTaskAttemptRecord): boolean {
  return stableStringify({
    schemaVersion: left.schemaVersion,
    learningTaskAttemptId: left.learningTaskAttemptId,
    initialAttemptId: left.initialAttemptId,
    studentId: left.studentId,
    learningSessionId: left.learningSessionId,
    learningRoundId: left.learningRoundId,
    operationId: left.operationId,
    materialVersionId: left.materialVersionId,
    resourceId: left.resourceId,
    resourceVersionId: left.resourceVersionId,
    taskId: left.taskId,
    taskRole: left.taskRole,
    rubricVersion: left.rubricVersion,
    initialResponse: left.initialResponse,
    initialDiagnosisId: left.initialDiagnosisId,
    initialDiagnosisSchemaVersion: left.initialDiagnosisSchemaVersion,
    initialFeedbackId: left.initialFeedbackId,
    initialFeedbackSchemaVersion: left.initialFeedbackSchemaVersion,
    createdAt: left.createdAt,
  }) === stableStringify({
    schemaVersion: right.schemaVersion,
    learningTaskAttemptId: right.learningTaskAttemptId,
    initialAttemptId: right.initialAttemptId,
    studentId: right.studentId,
    learningSessionId: right.learningSessionId,
    learningRoundId: right.learningRoundId,
    operationId: right.operationId,
    materialVersionId: right.materialVersionId,
    resourceId: right.resourceId,
    resourceVersionId: right.resourceVersionId,
    taskId: right.taskId,
    taskRole: right.taskRole,
    rubricVersion: right.rubricVersion,
    initialResponse: right.initialResponse,
    initialDiagnosisId: right.initialDiagnosisId,
    initialDiagnosisSchemaVersion: right.initialDiagnosisSchemaVersion,
    initialFeedbackId: right.initialFeedbackId,
    initialFeedbackSchemaVersion: right.initialFeedbackSchemaVersion,
    createdAt: right.createdAt,
  });
}

function isAllowedAttemptTransition(
  existing: LearningTaskAttemptRecord,
  candidate: LearningTaskAttemptRecord,
): boolean {
  const allowed: Record<LearningTaskAttemptRecord['status'], LearningTaskAttemptRecord['status'][]> = {
    feedback_presented: ['feedback_presented', 'revision_draft', 'completed_initial_only'],
    revision_draft: ['revision_draft', 'revision_submitted', 'completed_initial_only'],
    revision_submitted: ['revision_submitted', 'revision_evaluating', 'revision_evaluation_pending_retry', 'completed_with_revision_pending_evaluation'],
    revision_evaluating: ['revision_evaluating', 'revision_evaluated', 'revision_evaluation_pending_retry', 'completed_with_revision_pending_evaluation'],
    revision_evaluated: ['revision_evaluated', 'completed_with_revision'],
    revision_evaluation_pending_retry: ['revision_evaluation_pending_retry', 'revision_evaluated', 'completed_with_revision_pending_evaluation'],
    completed_initial_only: ['completed_initial_only'],
    completed_with_revision: ['completed_with_revision'],
    completed_with_revision_pending_evaluation: ['completed_with_revision_pending_evaluation', 'completed_with_revision'],
  };
  if (!allowed[existing.status].includes(candidate.status)) return false;

  if (existing.revisionOfferDecision && (
    !candidate.revisionOfferDecision
    || stableStringify(existing.revisionOfferDecision) !== stableStringify(candidate.revisionOfferDecision)
  )) return false;
  if (!existing.revision) return candidate.revision === undefined || candidate.revision.status === 'draft';
  if (!candidate.revision) return false;
  if (
    existing.revision.revisionId !== candidate.revision.revisionId
    || stableStringify(existing.revision.revisionGoal) !== stableStringify(candidate.revision.revisionGoal)
    || existing.revision.initialResponseId !== candidate.revision.initialResponseId
    || existing.revision.createdAt !== candidate.revision.createdAt
  ) return false;
  if (existing.revision.revisedResponse && (
    !candidate.revision.revisedResponse
    || stableStringify(existing.revision.revisedResponse) !== stableStringify(candidate.revision.revisedResponse)
  )) return false;
  if (existing.revision.evaluation && (
    !candidate.revision.evaluation
    || stableStringify(existing.revision.evaluation) !== stableStringify(candidate.revision.evaluation)
  )) return false;
  if (existing.revision.feedbackSupportedEvidence && (
    !candidate.revision.feedbackSupportedEvidence
    || stableStringify(existing.revision.feedbackSupportedEvidence) !== stableStringify(candidate.revision.feedbackSupportedEvidence)
  )) return false;
  if (existing.revision.profileUpdateDecision && (
    !candidate.revision.profileUpdateDecision
    || stableStringify(existing.revision.profileUpdateDecision) !== stableStringify(candidate.revision.profileUpdateDecision)
  )) return false;
  if (existing.revision.profileAfterRevision && (
    !candidate.revision.profileAfterRevision
    || stableStringify(existing.revision.profileAfterRevision) !== stableStringify(candidate.revision.profileAfterRevision)
  )) return false;
  if (existing.revision.growthMemoryRecord && (
    !candidate.revision.growthMemoryRecord
    || stableStringify(existing.revision.growthMemoryRecord) !== stableStringify(candidate.revision.growthMemoryRecord)
  )) return false;
  if (existing.revision.status !== 'draft'
    && existing.revision.draftAnswer !== candidate.revision.draftAnswer) return false;
  return true;
}

function hasConsistentAggregateState(record: LearningTaskAttemptRecord): boolean {
  if (record.status === 'feedback_presented') return record.revision === undefined;
  if (record.status === 'completed_initial_only') {
    return record.revision === undefined || record.revision.status === 'abandoned';
  }
  if (!record.revision) return false;
  const expectedRevisionStatus: Partial<Record<LearningTaskAttemptRecord['status'], typeof record.revision.status>> = {
    revision_draft: 'draft',
    revision_submitted: 'submitted',
    revision_evaluating: 'evaluating',
    revision_evaluated: 'evaluated',
    revision_evaluation_pending_retry: 'evaluation_pending_retry',
    completed_with_revision: 'evaluated',
    completed_with_revision_pending_evaluation: 'evaluation_pending_retry',
  };
  return expectedRevisionStatus[record.status] === record.revision.status;
}

function sorted(records: LearningTaskAttemptRecord[]): LearningTaskAttemptRecord[] {
  return records.sort((left, right) => (
    left.updatedAt.localeCompare(right.updatedAt)
    || left.learningTaskAttemptId.localeCompare(right.learningTaskAttemptId)
  ));
}

function withoutUpdatedAt(record: LearningTaskAttemptRecord): Omit<LearningTaskAttemptRecord, 'updatedAt'> {
  const { updatedAt: _updatedAt, ...semantic } = record;
  return semantic;
}

function clone<T>(value: T): T { return structuredClone(value); }
function cloneOptional<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : clone(value);
}

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
