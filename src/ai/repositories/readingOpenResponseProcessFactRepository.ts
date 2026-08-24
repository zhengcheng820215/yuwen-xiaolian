import type { ReadingOpenResponseLearningProcessFact } from
  '../schemas/readingOpenResponseGovernance.schema.ts';

export type ReadingOpenResponseProcessFactWriteResult = {
  status: 'created' | 'updated' | 'unchanged' | 'conflict';
  fact: ReadingOpenResponseLearningProcessFact;
  issues: string[];
};

export interface ReadingOpenResponseProcessFactRepository {
  save(
    fact: ReadingOpenResponseLearningProcessFact,
  ): Promise<ReadingOpenResponseProcessFactWriteResult>;
  getByAttemptId(attemptId: string): Promise<ReadingOpenResponseLearningProcessFact | null>;
  listByResourceVersion(
    resourceVersionId: string,
  ): Promise<ReadingOpenResponseLearningProcessFact[]>;
  listAll(): Promise<ReadingOpenResponseLearningProcessFact[]>;
  clear(): Promise<void>;
}
