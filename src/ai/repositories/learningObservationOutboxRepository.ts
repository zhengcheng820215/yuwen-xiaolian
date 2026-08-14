import type { LearningObservationOutboxEntry } from '../schemas/learningObservationOutbox.schema.ts';

export type LearningObservationOutboxWriteResult = {
  status: 'created' | 'updated' | 'unchanged' | 'conflict';
  entry: LearningObservationOutboxEntry;
  issues: string[];
};

export type LearningObservationOutboxRepository = {
  save(entry: LearningObservationOutboxEntry): Promise<LearningObservationOutboxWriteResult>;
  getById(outboxId: string): Promise<LearningObservationOutboxEntry | undefined>;
  listDue(now: string): Promise<LearningObservationOutboxEntry[]>;
  listAll(): Promise<LearningObservationOutboxEntry[]>;
  delete(outboxId: string): Promise<void>;
  clear(): Promise<void>;
};
