import {
  isReadingOpenResponseLearningProcessFact,
  type ReadingOpenResponseLearningProcessFact,
} from '../schemas/readingOpenResponseGovernance.schema.ts';
import type {
  ReadingOpenResponseProcessFactRepository,
  ReadingOpenResponseProcessFactWriteResult,
} from './readingOpenResponseProcessFactRepository.ts';

export class InMemoryReadingOpenResponseProcessFactRepository
implements ReadingOpenResponseProcessFactRepository {
  private readonly records = new Map<string, ReadingOpenResponseLearningProcessFact>();

  async save(
    fact: ReadingOpenResponseLearningProcessFact,
  ): Promise<ReadingOpenResponseProcessFactWriteResult> {
    if (!isReadingOpenResponseLearningProcessFact(fact)) {
      throw new Error('Reading Open Response process fact is invalid.');
    }
    const existing = this.records.get(fact.attemptId);
    if (!existing) {
      this.records.set(fact.attemptId, clone(fact));
      return { status: 'created', fact: clone(fact), issues: [] };
    }
    if (!sameIdentity(existing, fact)) {
      return {
        status: 'conflict',
        fact: clone(existing),
        issues: ['process_fact_identity_conflict'],
      };
    }
    if (stable(existing) === stable(fact)) {
      return { status: 'unchanged', fact: clone(existing), issues: [] };
    }
    const merged = merge(existing, fact);
    this.records.set(fact.attemptId, clone(merged));
    return { status: 'updated', fact: clone(merged), issues: [] };
  }

  async getByAttemptId(attemptId: string): Promise<ReadingOpenResponseLearningProcessFact | null> {
    const fact = this.records.get(attemptId);
    return fact ? clone(fact) : null;
  }

  async listByResourceVersion(
    resourceVersionId: string,
  ): Promise<ReadingOpenResponseLearningProcessFact[]> {
    return [...this.records.values()]
      .filter((fact) => fact.resourceVersionId === resourceVersionId)
      .sort((left, right) => left.presentedAt.localeCompare(right.presentedAt))
      .map(clone);
  }

  async listAll(): Promise<ReadingOpenResponseLearningProcessFact[]> {
    return [...this.records.values()]
      .sort((left, right) => left.presentedAt.localeCompare(right.presentedAt))
      .map(clone);
  }

  async clear(): Promise<void> { this.records.clear(); }
}

export function mergeReadingOpenResponseProcessFact(
  previous: ReadingOpenResponseLearningProcessFact,
  next: ReadingOpenResponseLearningProcessFact,
): ReadingOpenResponseLearningProcessFact {
  return merge(previous, next);
}

function merge(
  previous: ReadingOpenResponseLearningProcessFact,
  next: ReadingOpenResponseLearningProcessFact,
): ReadingOpenResponseLearningProcessFact {
  return {
    ...previous,
    ...next,
    firstInputAt: earliest(previous.firstInputAt, next.firstInputAt),
    submittedAt: earliest(previous.submittedAt, next.submittedAt),
    completedAt: earliest(previous.completedAt, next.completedAt),
    lastActivityAt: latest(previous.lastActivityAt, next.lastActivityAt),
    hintOpened: previous.hintOpened || next.hintOpened,
    revisionOffered: previous.revisionOffered || next.revisionOffered,
    revisionSubmitted: previous.revisionSubmitted || next.revisionSubmitted,
  };
}

function sameIdentity(
  left: ReadingOpenResponseLearningProcessFact,
  right: ReadingOpenResponseLearningProcessFact,
): boolean {
  return left.attemptId === right.attemptId
    && left.runtimeScope === right.runtimeScope
    && left.studentId === right.studentId
    && left.learningSessionId === right.learningSessionId
    && left.learningRoundId === right.learningRoundId
    && left.materialVersionId === right.materialVersionId
    && left.resourceVersionId === right.resourceVersionId
    && left.timingPolicyVersion === right.timingPolicyVersion;
}

function earliest(left?: string, right?: string): string | undefined {
  if (!left) return right;
  if (!right) return left;
  return left.localeCompare(right) <= 0 ? left : right;
}

function latest(left?: string, right?: string): string | undefined {
  if (!left) return right;
  if (!right) return left;
  return left.localeCompare(right) >= 0 ? left : right;
}

function stable(value: unknown): string { return JSON.stringify(value); }
function clone<T>(value: T): T { return structuredClone(value); }
