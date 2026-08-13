import type { LearningObservationEvent } from '../schemas/learningObservationEvent.schema.ts';

export type LearningObservationWriteResult = {
  status: 'created' | 'unchanged' | 'conflict';
  event: LearningObservationEvent;
  issues: string[];
};

export type LearningObservationRepository = {
  save(event: LearningObservationEvent): Promise<LearningObservationWriteResult>;
  getById(eventId: string): Promise<LearningObservationEvent | undefined>;
  listByStudent(studentId: string): Promise<LearningObservationEvent[]>;
  listAll(): Promise<LearningObservationEvent[]>;
  listByRound(studentId: string, learningRoundId: string): Promise<LearningObservationEvent[]>;
  listByResourceVersion(resourceVersionId: string): Promise<LearningObservationEvent[]>;
  clear(): Promise<void>;
};
