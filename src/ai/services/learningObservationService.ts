import { buildStableId } from '../agents/reviewedResourceCandidateAdapter.ts';
import type { LearningObservationOutboxRepository } from '../repositories/learningObservationOutboxRepository.ts';
import type { LearningObservationRepository } from '../repositories/learningObservationRepository.ts';
import {
  validateLearningObservationEvent,
  type LearningObservationEvent,
} from '../schemas/learningObservationEvent.schema.ts';
import {
  LEARNING_OBSERVATION_OUTBOX_SCHEMA_VERSION,
  type LearningObservationOutboxEntry,
} from '../schemas/learningObservationOutbox.schema.ts';

export type LearningObservationRecordStatus =
  | 'created'
  | 'unchanged'
  | 'conflict'
  | 'queued'
  | 'dropped';

export type LearningObservationRetryReport = {
  processed: number;
  succeeded: number;
  rescheduled: number;
  failed: number;
  issues: string[];
};

export type LearningObservationReconciliationReport = {
  created: number;
  unchanged: number;
  queued: number;
  conflict: number;
  dropped: number;
};

type LearningObservationServiceOptions = {
  maxRetryCount?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
};

const RECONCILABLE_EVENT_TYPES = new Set<LearningObservationEvent['eventType']>([
  'answer_submitted',
  'diagnosis_completed',
  'learning_round_completed',
]);

export class LearningObservationService {
  private readonly eventRepository: LearningObservationRepository;
  private readonly outboxRepository: LearningObservationOutboxRepository;
  private readonly now: () => string;
  private readonly maxRetryCount: number;
  private readonly baseRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;

  constructor(
    eventRepository: LearningObservationRepository,
    outboxRepository: LearningObservationOutboxRepository,
    now: () => string = () => new Date().toISOString(),
    options: LearningObservationServiceOptions = {},
  ) {
    this.eventRepository = eventRepository;
    this.outboxRepository = outboxRepository;
    this.now = now;
    this.maxRetryCount = options.maxRetryCount ?? 5;
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? 1_000;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 5 * 60_000;
  }

  async retryDue(now = this.now(), limit = 50): Promise<LearningObservationRetryReport> {
    const report: LearningObservationRetryReport = {
      processed: 0, succeeded: 0, rescheduled: 0, failed: 0, issues: [],
    };
    let due: LearningObservationOutboxEntry[];
    try {
      due = (await this.outboxRepository.listDue(now)).slice(0, limit);
    } catch (error) {
      report.issues.push(`outbox_list_failed:${errorText(error)}`);
      return report;
    }
    for (const entry of due) {
      report.processed += 1;
      try {
        await this.outboxRepository.save({ ...entry, status: 'retrying', updatedAt: now });
        const result = await this.eventRepository.save(entry.event);
        if (result.status === 'created' || result.status === 'unchanged') {
          await this.outboxRepository.delete(entry.outboxId);
          report.succeeded += 1;
          continue;
        }
        await this.markFailed(entry, now, 'learning_observation_event_conflict');
        report.failed += 1;
        report.issues.push(`${entry.eventId}:learning_observation_event_conflict`);
      } catch (error) {
        const nextRetryCount = entry.retryCount + 1;
        const message = errorText(error);
        try {
          if (nextRetryCount >= this.maxRetryCount) {
            await this.markFailed(entry, now, message, nextRetryCount);
            report.failed += 1;
          } else {
            const delay = Math.min(
              this.baseRetryDelayMs * (2 ** Math.max(0, nextRetryCount - 1)),
              this.maxRetryDelayMs,
            );
            await this.outboxRepository.save({
              ...entry,
              status: 'pending',
              retryCount: nextRetryCount,
              lastError: message,
              nextRetryAt: new Date(Date.parse(now) + delay).toISOString(),
              updatedAt: now,
            });
            report.rescheduled += 1;
          }
        } catch (outboxError) {
          report.failed += 1;
          report.issues.push(`${entry.eventId}:outbox_update_failed:${errorText(outboxError)}`);
        }
        report.issues.push(`${entry.eventId}:${message}`);
      }
    }
    return report;
  }

  async reconcileRound(
    learningRoundId: string,
    events: LearningObservationEvent[],
  ): Promise<LearningObservationReconciliationReport> {
    const report: LearningObservationReconciliationReport = {
      created: 0, unchanged: 0, queued: 0, conflict: 0, dropped: 0,
    };
    for (const event of events) {
      if (event.learningRoundId !== learningRoundId || !RECONCILABLE_EVENT_TYPES.has(event.eventType)) {
        report.dropped += 1;
        continue;
      }
      const status = await this.record(event);
      report[status] += 1;
    }
    return report;
  }

  async record(event: LearningObservationEvent): Promise<LearningObservationRecordStatus> {
    const validation = validateLearningObservationEvent(event);
    if (!validation.passed) return 'dropped';
    try {
      const result = await this.eventRepository.save(event);
      return result.status;
    } catch (error) {
      await this.queue(event, error);
      return 'queued';
    }
  }

  private async queue(event: LearningObservationEvent, error: unknown): Promise<void> {
    const now = this.now();
    const outboxId = buildStableId('learning-observation-outbox', [event.eventId]);
    let existing: LearningObservationOutboxEntry | undefined;
    try {
      existing = await this.outboxRepository.getById(outboxId);
    } catch {
      return;
    }
    const entry: LearningObservationOutboxEntry = {
      schemaVersion: LEARNING_OBSERVATION_OUTBOX_SCHEMA_VERSION,
      outboxId,
      eventId: event.eventId,
      learningRoundId: event.learningRoundId,
      eventType: event.eventType,
      event: existing?.event || event,
      status: existing?.status || 'pending',
      retryCount: existing?.retryCount || 0,
      lastError: error instanceof Error ? error.message : String(error),
      nextRetryAt: existing?.nextRetryAt || now,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    try {
      await this.outboxRepository.save(entry);
    } catch {
      // Observation capture is non-critical and must never block learning.
    }
  }

  private async markFailed(
    entry: LearningObservationOutboxEntry,
    now: string,
    lastError: string,
    retryCount = entry.retryCount + 1,
  ): Promise<void> {
    await this.outboxRepository.save({
      ...entry,
      status: 'failed',
      retryCount,
      lastError,
      nextRetryAt: now,
      updatedAt: now,
    });
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
