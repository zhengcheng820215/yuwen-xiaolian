export const QUESTION_CALIBRATION_PROJECTION_SCHEMA_VERSION =
  'question_calibration_projection_v1' as const;

export const QUESTION_CALIBRATION_ITEM_SCORE_POLICY_VERSION =
  'rubric_required_equal_weight_v1' as const;

export type QuestionCalibrationProjectionStatus =
  | 'eligible'
  | 'excluded_invalid_response'
  | 'excluded_incomplete_round'
  | 'excluded_missing_formal_diagnosis'
  | 'excluded_unscorable'
  | 'excluded_non_product_scope'
  | 'projection_failed';

export type QuestionCalibrationProjectionRecord = {
  schemaVersion: typeof QUESTION_CALIBRATION_PROJECTION_SCHEMA_VERSION;
  projectionId: string;
  attemptId: string;
  status: QuestionCalibrationProjectionStatus;
  runtimeScope: 'product' | 'demo' | 'fixture' | 'debug';
  studentId: string;
  operationId: string;
  learningSessionId: string;
  learningRoundId: string;
  responseId: string;
  formalDiagnosisId?: string;
  resourceVersionId: string;
  itemScore?: number;
  itemScorePolicyVersion?: typeof QUESTION_CALIBRATION_ITEM_SCORE_POLICY_VERSION;
  totalScore?: number;
  totalScoreStatus: 'unavailable_single_round' | 'available_comparable_window';
  assessmentWindowId?: string;
  valid: boolean;
  completedAt?: string;
  projectedAt: string;
  issues: string[];
};

export type QuestionCalibrationProjectionValidation = {
  passed: boolean;
  issues: string[];
};

export function validateQuestionCalibrationProjectionRecord(
  value: unknown,
): QuestionCalibrationProjectionValidation {
  if (!value || typeof value !== 'object') return { passed: false, issues: ['projection_not_object'] };
  const record = value as Partial<QuestionCalibrationProjectionRecord>;
  const issues: string[] = [];
  if (record.schemaVersion !== QUESTION_CALIBRATION_PROJECTION_SCHEMA_VERSION) issues.push('invalid_schema_version');
  for (const [field, fieldValue] of [
    ['projectionId', record.projectionId],
    ['attemptId', record.attemptId],
    ['studentId', record.studentId],
    ['operationId', record.operationId],
    ['learningSessionId', record.learningSessionId],
    ['learningRoundId', record.learningRoundId],
    ['responseId', record.responseId],
    ['resourceVersionId', record.resourceVersionId],
  ] as const) {
    if (!isNonEmpty(fieldValue)) issues.push(`missing_${field}`);
  }
  if (!isStatus(record.status)) issues.push('invalid_projection_status');
  if (!['product', 'demo', 'fixture', 'debug'].includes(record.runtimeScope || '')) issues.push('invalid_runtime_scope');
  if (!['unavailable_single_round', 'available_comparable_window'].includes(record.totalScoreStatus || '')) {
    issues.push('invalid_total_score_status');
  }
  if (!isTimestamp(record.projectedAt)) issues.push('invalid_projected_at');
  if (!Array.isArray(record.issues) || !record.issues.every((item) => typeof item === 'string')) issues.push('invalid_issues');
  if (record.itemScore !== undefined && (!Number.isFinite(record.itemScore) || record.itemScore < 0 || record.itemScore > 1)) {
    issues.push('invalid_item_score');
  }
  if (record.totalScoreStatus === 'unavailable_single_round' && record.totalScore !== undefined) {
    issues.push('unexpected_total_score');
  }
  if (record.totalScoreStatus === 'available_comparable_window') {
    if (!Number.isFinite(record.totalScore)) issues.push('missing_total_score');
    if (!isNonEmpty(record.assessmentWindowId)) issues.push('missing_assessment_window_id');
  }
  if (record.status === 'eligible') {
    if (record.runtimeScope !== 'product') issues.push('eligible_non_product_scope');
    if (record.valid !== true) issues.push('eligible_not_valid');
    if (!Number.isFinite(record.itemScore)) issues.push('eligible_missing_item_score');
    if (record.itemScorePolicyVersion !== QUESTION_CALIBRATION_ITEM_SCORE_POLICY_VERSION) {
      issues.push('eligible_invalid_item_score_policy');
    }
    if (!isNonEmpty(record.formalDiagnosisId)) issues.push('eligible_missing_formal_diagnosis_id');
    if (!isTimestamp(record.completedAt)) issues.push('eligible_invalid_completed_at');
  }
  return { passed: issues.length === 0, issues };
}

export function isQuestionCalibrationProjectionRecord(
  value: unknown,
): value is QuestionCalibrationProjectionRecord {
  return validateQuestionCalibrationProjectionRecord(value).passed;
}

function isStatus(value: unknown): value is QuestionCalibrationProjectionStatus {
  return [
    'eligible',
    'excluded_invalid_response',
    'excluded_incomplete_round',
    'excluded_missing_formal_diagnosis',
    'excluded_unscorable',
    'excluded_non_product_scope',
    'projection_failed',
  ].includes(value as QuestionCalibrationProjectionStatus);
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return isNonEmpty(value) && Number.isFinite(Date.parse(value));
}
