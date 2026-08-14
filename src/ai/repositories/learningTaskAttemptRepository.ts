import type { LearningTaskAttemptRecord } from '../schemas/learningFeedbackRevision.schema.ts';

export type LearningTaskAttemptWriteResult = {
  status: 'created' | 'updated' | 'unchanged' | 'conflict';
  record: LearningTaskAttemptRecord;
  issues: string[];
};

export type LearningTaskAttemptRepository = {
  save(record: LearningTaskAttemptRecord): Promise<LearningTaskAttemptWriteResult>;
  getById(learningTaskAttemptId: string): Promise<LearningTaskAttemptRecord | undefined>;
  getByInitialAttemptId(initialAttemptId: string): Promise<LearningTaskAttemptRecord | undefined>;
  listByRound(studentId: string, learningRoundId: string): Promise<LearningTaskAttemptRecord[]>;
  listByStudent(studentId: string): Promise<LearningTaskAttemptRecord[]>;
  listAll(): Promise<LearningTaskAttemptRecord[]>;
  clear(): Promise<void>;
};
