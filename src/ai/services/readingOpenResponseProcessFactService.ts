import type { ReadingOpenResponseProcessFactRepository } from
  '../repositories/readingOpenResponseProcessFactRepository.ts';
import {
  READING_OPEN_RESPONSE_TIMING_POLICY_VERSION,
  type ReadingOpenResponseLearningProcessFact,
} from '../schemas/readingOpenResponseGovernance.schema.ts';

type FactIdentity = Pick<
  ReadingOpenResponseLearningProcessFact,
  | 'attemptId'
  | 'runtimeScope'
  | 'studentId'
  | 'learningSessionId'
  | 'learningRoundId'
  | 'materialVersionId'
  | 'resourceVersionId'
>;

export class ReadingOpenResponseProcessFactService {
  private readonly repository: ReadingOpenResponseProcessFactRepository;
  private readonly now: () => string;

  constructor(
    repository: ReadingOpenResponseProcessFactRepository,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.repository = repository;
    this.now = now;
  }

  async recordPresented(input: FactIdentity & { presentedAt?: string }) {
    const presentedAt = input.presentedAt || this.now();
    return this.repository.save({
      ...structuredClone(input),
      presentedAt,
      lastActivityAt: presentedAt,
      hintOpened: false,
      responseValidity: 'empty',
      revisionOffered: false,
      revisionSubmitted: false,
      timingPolicyVersion: READING_OPEN_RESPONSE_TIMING_POLICY_VERSION,
    });
  }

  async recordFirstInput(attemptId: string, firstInputAt: string = this.now()) {
    return this.patch(attemptId, { firstInputAt, lastActivityAt: firstInputAt });
  }

  async recordHintOpened(attemptId: string, occurredAt: string = this.now()) {
    return this.patch(attemptId, { hintOpened: true, lastActivityAt: occurredAt });
  }

  async recordSubmitted(input: {
    attemptId: string;
    submittedAt?: string;
    responseValidity: ReadingOpenResponseLearningProcessFact['responseValidity'];
  }) {
    const submittedAt = input.submittedAt || this.now();
    return this.patch(input.attemptId, {
      submittedAt,
      lastActivityAt: submittedAt,
      responseValidity: input.responseValidity,
    });
  }

  async recordRevision(input: {
    attemptId: string;
    offered?: boolean;
    submitted?: boolean;
    occurredAt?: string;
  }) {
    const current = await this.requireFact(input.attemptId);
    return this.repository.save({
      ...current,
      revisionOffered: current.revisionOffered || Boolean(input.offered),
      revisionSubmitted: current.revisionSubmitted || Boolean(input.submitted),
      lastActivityAt: input.occurredAt || this.now(),
    });
  }

  async recordCompleted(input: {
    attemptId: string;
    completedAt?: string;
    followUpRole?: ReadingOpenResponseLearningProcessFact['followUpRole'];
    sameGapRecurred?: boolean;
  }) {
    const completedAt = input.completedAt || this.now();
    return this.patch(input.attemptId, {
      completedAt,
      lastActivityAt: completedAt,
      ...(input.followUpRole ? { followUpRole: input.followUpRole } : {}),
      ...(input.sameGapRecurred === undefined
        ? {}
        : { sameGapRecurred: input.sameGapRecurred }),
    });
  }

  async recordExit(input: {
    attemptId: string;
    reason: NonNullable<ReadingOpenResponseLearningProcessFact['taskExitReason']>;
    occurredAt?: string;
  }) {
    return this.patch(input.attemptId, {
      taskExitReason: input.reason,
      lastActivityAt: input.occurredAt || this.now(),
    });
  }

  private async patch(
    attemptId: string,
    patch: Partial<ReadingOpenResponseLearningProcessFact>,
  ) {
    return this.repository.save({
      ...await this.requireFact(attemptId),
      ...structuredClone(patch),
    });
  }

  private async requireFact(attemptId: string): Promise<ReadingOpenResponseLearningProcessFact> {
    const fact = await this.repository.getByAttemptId(attemptId);
    if (!fact) throw new Error(`Reading process fact not found: ${attemptId}`);
    return fact;
  }
}
