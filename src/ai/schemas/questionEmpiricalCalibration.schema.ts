export const QUESTION_EMPIRICAL_CALIBRATION_SCHEMA_VERSION =
  'question_empirical_calibration_v1' as const;

export type AnonymousQuestionCalibrationAttempt = {
  attemptId: string;
  resourceVersionId: string;
  itemScore: number;
  totalScore: number;
  valid: boolean;
  completedAt: string;
};

export type QuestionEmpiricalCalibrationReport = {
  reportId: string;
  resourceVersionId: string;
  status: 'awaiting_data' | 'insufficient_sample' | 'calibrated';
  sampleSize: number;
  minimumSampleSize: number;
  meanItemScore?: number;
  highLowDiscrimination?: number;
  generatedAt: string;
  limitations: string[];
  schemaVersion: typeof QUESTION_EMPIRICAL_CALIBRATION_SCHEMA_VERSION;
};
