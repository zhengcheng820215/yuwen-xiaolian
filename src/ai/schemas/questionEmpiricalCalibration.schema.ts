export const QUESTION_EMPIRICAL_CALIBRATION_SCHEMA_VERSION =
  'question_empirical_calibration_v2' as const;

export const LEGACY_QUESTION_EMPIRICAL_CALIBRATION_SCHEMA_VERSION =
  'question_empirical_calibration_v1' as const;

export type LegacyAnonymousQuestionCalibrationAttempt = {
  attemptId: string;
  resourceVersionId: string;
  itemScore: number;
  totalScore: number;
  valid: boolean;
  completedAt: string;
};

export type AnonymousQuestionCalibrationAttempt = {
  attemptId: string;
  subjectKey: string;
  resourceVersionId: string;
  itemScore: number;
  itemScorePolicyVersion: 'rubric_required_equal_weight_v1' | 'single_choice_correctness_v1';
  responseFormat?: 'text' | 'single_choice';
  selectedOptionIds?: string[];
  optionSetVersion?: number;
  displayedOptionOrder?: string[];
  misconceptionCode?: string;
  totalScore?: number;
  totalScoreStatus: 'unavailable_single_round' | 'available_comparable_window';
  assessmentWindowId?: string;
  valid: true;
  completedAt: string;
};

export type QuestionCalibrationAttemptInput =
  | AnonymousQuestionCalibrationAttempt
  | LegacyAnonymousQuestionCalibrationAttempt;

export type QuestionEmpiricalCalibrationReport = {
  reportId: string;
  resourceVersionId: string;
  status: 'awaiting_data' | 'insufficient_sample' | 'calibrated';
  sampleSize: number;
  independentSubjectCount: number;
  minimumSampleSize: number;
  meanItemScore?: number;
  highLowDiscrimination?: number;
  generatedAt: string;
  limitations: string[];
  schemaVersion: typeof QUESTION_EMPIRICAL_CALIBRATION_SCHEMA_VERSION;
};

export function normalizeQuestionCalibrationAttempt(
  attempt: QuestionCalibrationAttemptInput,
): AnonymousQuestionCalibrationAttempt | undefined {
  if (!attempt.valid || !isBaseAttemptValid(attempt)) return undefined;
  if ('subjectKey' in attempt) {
    if (
      !isNonEmpty(attempt.subjectKey)
      || !['rubric_required_equal_weight_v1', 'single_choice_correctness_v1'].includes(attempt.itemScorePolicyVersion)
      || !['unavailable_single_round', 'available_comparable_window'].includes(attempt.totalScoreStatus)
    ) return undefined;
    if (
      attempt.totalScoreStatus === 'available_comparable_window'
      && (!Number.isFinite(attempt.totalScore) || !isNonEmpty(attempt.assessmentWindowId))
    ) return undefined;
    if (attempt.totalScoreStatus === 'unavailable_single_round' && attempt.totalScore !== undefined) return undefined;
    return attempt;
  }
  if (!Number.isFinite(attempt.totalScore)) return undefined;
  return {
    attemptId: attempt.attemptId,
    subjectKey: 'legacy-v1:unknown-subject',
    resourceVersionId: attempt.resourceVersionId,
    itemScore: attempt.itemScore,
    itemScorePolicyVersion: 'rubric_required_equal_weight_v1',
    totalScore: attempt.totalScore,
    totalScoreStatus: 'available_comparable_window',
    assessmentWindowId: 'legacy-v1-unversioned',
    valid: true,
    completedAt: attempt.completedAt,
  };
}

function isBaseAttemptValid(attempt: QuestionCalibrationAttemptInput): boolean {
  return isNonEmpty(attempt.attemptId)
    && isNonEmpty(attempt.resourceVersionId)
    && Number.isFinite(attempt.itemScore)
    && attempt.itemScore >= 0
    && attempt.itemScore <= 1
    && Number.isFinite(Date.parse(attempt.completedAt));
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
