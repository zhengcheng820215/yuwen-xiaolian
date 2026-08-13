import type { QuestionCalibrationProjectionRecord } from '../schemas/questionCalibrationProjection.schema.ts';

export type QuestionCalibrationProjectionWriteResult = {
  status: 'created' | 'updated' | 'unchanged' | 'conflict';
  record: QuestionCalibrationProjectionRecord;
  issues: string[];
};

export type QuestionCalibrationProjectionRepository = {
  save(record: QuestionCalibrationProjectionRecord): Promise<QuestionCalibrationProjectionWriteResult>;
  getByAttemptId(attemptId: string): Promise<QuestionCalibrationProjectionRecord | undefined>;
  listByStudent(studentId: string): Promise<QuestionCalibrationProjectionRecord[]>;
  listAll(): Promise<QuestionCalibrationProjectionRecord[]>;
  listByRound(studentId: string, learningRoundId: string): Promise<QuestionCalibrationProjectionRecord[]>;
  listEligibleByResourceVersion(resourceVersionId: string): Promise<QuestionCalibrationProjectionRecord[]>;
  clear(): Promise<void>;
};
