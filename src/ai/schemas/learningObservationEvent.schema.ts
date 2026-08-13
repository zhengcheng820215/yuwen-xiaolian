export const LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION =
  'learning_observation_event_v1' as const;

export const PRODUCT_LEARNING_STUDENT_ID = 'student-local-primary-v1' as const;

export type LearningObservationEventType =
  | 'question_presented'
  | 'answer_submitted'
  | 'diagnosis_completed'
  | 'feedback_presented'
  | 'learning_round_completed';

export type QuestionPresentedPayload = {
  kind: 'question_presented';
  presentationId: string;
};

export type AnswerSubmittedPayload = {
  kind: 'answer_submitted';
  responseId: string;
  attemptId: string;
  submittedAt: string;
};

export type DiagnosisCompletedPayload = {
  kind: 'diagnosis_completed';
  responseId: string;
  attemptId: string;
  formalDiagnosisId: string;
  diagnosisSchemaVersion: string;
};

export type FeedbackPresentedPayload = {
  kind: 'feedback_presented';
  responseId: string;
  attemptId: string;
  feedbackRequestId: string;
  feedbackSchemaVersion: string;
};

export type LearningRoundCompletedPayload = {
  kind: 'learning_round_completed';
  responseId: string;
  attemptId: string;
  persistenceRecordId: string;
  completedAt: string;
};

export type LearningObservationEventPayload =
  | QuestionPresentedPayload
  | AnswerSubmittedPayload
  | DiagnosisCompletedPayload
  | FeedbackPresentedPayload
  | LearningRoundCompletedPayload;

export type LearningObservationEvent = {
  schemaVersion: typeof LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION;
  eventId: string;
  eventType: LearningObservationEventType;
  occurredAt: string;
  recordedAt: string;
  runtimeScope: 'product';
  studentId: typeof PRODUCT_LEARNING_STUDENT_ID;
  operationId: string;
  learningSessionId: string;
  learningRoundId: string;
  materialVersionId: string;
  resourceId: string;
  resourceVersionId: string;
  taskId: string;
  sourceEntityId: string;
  appVersion: string;
  payload: LearningObservationEventPayload;
};

export type LearningObservationEventValidation = {
  passed: boolean;
  issues: string[];
};

export function validateLearningObservationEvent(
  value: unknown,
): LearningObservationEventValidation {
  if (!value || typeof value !== 'object') {
    return { passed: false, issues: ['event_not_object'] };
  }
  const event = value as Partial<LearningObservationEvent>;
  const issues: string[] = [];
  if (event.schemaVersion !== LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION) issues.push('invalid_schema_version');
  if (!isNonEmpty(event.eventId)) issues.push('missing_event_id');
  if (!isEventType(event.eventType)) issues.push('invalid_event_type');
  if (!isTimestamp(event.occurredAt)) issues.push('invalid_occurred_at');
  if (!isTimestamp(event.recordedAt)) issues.push('invalid_recorded_at');
  if (event.runtimeScope !== 'product') issues.push('non_product_runtime_scope');
  if (event.studentId !== PRODUCT_LEARNING_STUDENT_ID) issues.push('invalid_product_student');
  for (const [field, fieldValue] of [
    ['operationId', event.operationId],
    ['learningSessionId', event.learningSessionId],
    ['learningRoundId', event.learningRoundId],
    ['materialVersionId', event.materialVersionId],
    ['resourceId', event.resourceId],
    ['resourceVersionId', event.resourceVersionId],
    ['taskId', event.taskId],
    ['sourceEntityId', event.sourceEntityId],
    ['appVersion', event.appVersion],
  ] as const) {
    if (!isNonEmpty(fieldValue)) issues.push(`missing_${field}`);
  }
  if (!event.payload || typeof event.payload !== 'object') {
    issues.push('missing_payload');
  } else if (event.payload.kind !== event.eventType) {
    issues.push('event_payload_kind_mismatch');
  } else {
    issues.push(...validatePayload(event.payload));
  }
  return { passed: issues.length === 0, issues };
}

export function isLearningObservationEvent(value: unknown): value is LearningObservationEvent {
  return validateLearningObservationEvent(value).passed;
}

function validatePayload(payload: LearningObservationEventPayload): string[] {
  const issues: string[] = [];
  if (payload.kind === 'question_presented') {
    if (!isNonEmpty(payload.presentationId)) issues.push('missing_presentation_id');
    return issues;
  }
  if (!isNonEmpty(payload.responseId)) issues.push('missing_response_id');
  if (!isNonEmpty(payload.attemptId)) issues.push('missing_attempt_id');
  if (payload.kind === 'answer_submitted' && !isTimestamp(payload.submittedAt)) issues.push('invalid_submitted_at');
  if (payload.kind === 'diagnosis_completed') {
    if (!isNonEmpty(payload.formalDiagnosisId)) issues.push('missing_formal_diagnosis_id');
    if (!isNonEmpty(payload.diagnosisSchemaVersion)) issues.push('missing_diagnosis_schema_version');
  }
  if (payload.kind === 'feedback_presented') {
    if (!isNonEmpty(payload.feedbackRequestId)) issues.push('missing_feedback_request_id');
    if (!isNonEmpty(payload.feedbackSchemaVersion)) issues.push('missing_feedback_schema_version');
  }
  if (payload.kind === 'learning_round_completed') {
    if (!isNonEmpty(payload.persistenceRecordId)) issues.push('missing_persistence_record_id');
    if (!isTimestamp(payload.completedAt)) issues.push('invalid_completed_at');
  }
  return issues;
}

function isEventType(value: unknown): value is LearningObservationEventType {
  return [
    'question_presented',
    'answer_submitted',
    'diagnosis_completed',
    'feedback_presented',
    'learning_round_completed',
  ].includes(value as LearningObservationEventType);
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return isNonEmpty(value) && Number.isFinite(Date.parse(value));
}
