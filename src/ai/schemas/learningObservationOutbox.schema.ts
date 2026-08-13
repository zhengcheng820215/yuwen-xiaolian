import type { LearningObservationEvent, LearningObservationEventType } from './learningObservationEvent.schema.ts';

export const LEARNING_OBSERVATION_OUTBOX_SCHEMA_VERSION =
  'learning_observation_outbox_v1' as const;

export type LearningObservationOutboxEntry = {
  schemaVersion: typeof LEARNING_OBSERVATION_OUTBOX_SCHEMA_VERSION;
  outboxId: string;
  eventId: string;
  learningRoundId: string;
  eventType: LearningObservationEventType;
  event: LearningObservationEvent;
  status: 'pending' | 'retrying' | 'failed';
  retryCount: number;
  lastError?: string;
  nextRetryAt: string;
  createdAt: string;
  updatedAt: string;
};

export function isLearningObservationOutboxEntry(
  value: unknown,
): value is LearningObservationOutboxEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<LearningObservationOutboxEntry>;
  return entry.schemaVersion === LEARNING_OBSERVATION_OUTBOX_SCHEMA_VERSION
    && isNonEmpty(entry.outboxId)
    && isNonEmpty(entry.eventId)
    && isNonEmpty(entry.learningRoundId)
    && entry.event?.eventId === entry.eventId
    && entry.event?.learningRoundId === entry.learningRoundId
    && entry.event?.eventType === entry.eventType
    && ['pending', 'retrying', 'failed'].includes(entry.status || '')
    && Number.isInteger(entry.retryCount)
    && (entry.retryCount || 0) >= 0
    && isTimestamp(entry.nextRetryAt)
    && isTimestamp(entry.createdAt)
    && isTimestamp(entry.updatedAt);
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return isNonEmpty(value) && Number.isFinite(Date.parse(value));
}
