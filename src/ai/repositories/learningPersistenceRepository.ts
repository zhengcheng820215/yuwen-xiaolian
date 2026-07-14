import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';

export type LearningPersistenceRepository = {
  save(record: LearningPersistenceRecord): Promise<LearningPersistenceRecord>;
  loadLatest(studentId: string): Promise<LearningPersistenceRecord | null>;
  loadByRound(studentId: string, learningRoundId: string): Promise<LearningPersistenceRecord | null>;
  listByStudent(studentId: string): Promise<LearningPersistenceRecord[]>;
  clear(studentId: string): Promise<void>;
};
