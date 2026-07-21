import type { RealLearningOperationCheckpoint } from '../schemas/realLearningOperation.schema.ts';

export type RealLearningOperationWriteStatus =
  | 'created'
  | 'updated'
  | 'reused'
  | 'conflict';

export type RealLearningOperationWriteResult = {
  status: RealLearningOperationWriteStatus;
  checkpoint: RealLearningOperationCheckpoint;
  issues: string[];
};

export type RealLearningOperationRepository = {
  getByOperationId(operationId: string): Promise<RealLearningOperationCheckpoint | null>;
  save(checkpoint: RealLearningOperationCheckpoint): Promise<RealLearningOperationWriteResult>;
  clearByStudent(studentId: string): Promise<void>;
  clear(): Promise<void>;
};
