import { buildLearningCalibrationAttemptId, buildLearningSubmissionIntentId } from '../agents/learningObservationIdentity.ts';
import type { LearningObservationEvent, LearningObservationEventType } from '../schemas/learningObservationEvent.schema.ts';
import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';
import type { QuestionCalibrationProjectionInput } from '../services/questionCalibrationProjectionService.ts';
import type { RealLearningOperationCheckpoint } from '../schemas/realLearningOperation.schema.ts';

export const HEALTHY_STUDENT_ID = 'student-local-primary-v1';
export const HEALTHY_ROUND_ID = 'wp7-round-1';
export const HEALTHY_SESSION_ID = 'wp7-session-1';
export const HEALTHY_RESPONSE_ID = 'wp7-response-1';
export const HEALTHY_ANSWER = '作者反复写失去小猫，先建立温暖期待，再让失去形成落差，从而加强后文的悲伤。';
export const HEALTHY_ATTEMPT_ID = buildLearningCalibrationAttemptId({
  studentId: HEALTHY_STUDENT_ID,
  learningSessionId: HEALTHY_SESSION_ID,
  learningRoundId: HEALTHY_ROUND_ID,
  submissionIntentId: buildLearningSubmissionIntentId({ responseId: HEALTHY_RESPONSE_ID, answerText: HEALTHY_ANSWER }),
});

export function healthyCheckpoint(): RealLearningOperationCheckpoint {
  return {
    schemaVersion: 'real_learning_operation_v1', operationId: 'wp7-operation-1', learningSessionId: HEALTHY_SESSION_ID,
    learningRoundId: HEALTHY_ROUND_ID, studentId: HEALTHY_STUDENT_ID, stage: 'next_task_ready', status: 'completed',
    nextAction: 'start_next_task', sourceResourceId: 'wp7-resource-1', sourceResourceVersionId: 'wp7-resource-version-1',
    sourceTaskId: 'wp7-task-1', diagnosisRequestId: 'wp7-request-1',
    taskExecutionResult: {
      executionSessionId: 'wp7-execution-1', studentId: HEALTHY_STUDENT_ID, taskId: 'wp7-task-1', status: 'submitted_valid',
      studentResponse: { responseId: HEALTHY_RESPONSE_ID, executionSessionId: 'wp7-execution-1', studentId: HEALTHY_STUDENT_ID, taskId: 'wp7-task-1', answerText: HEALTHY_ANSWER, submittedAt: '2026-08-13T13:01:00.000Z', usedHint: false, hintCount: 0 },
      responseValidity: { responseId: HEALTHY_RESPONSE_ID, status: 'valid', canDiagnose: true, reasons: [] },
      usedHint: false, hintCount: 0, canEnterDiagnosisRuntime: true,
    },
    realDiagnosisRuntimeResult: {
      requestId: 'wp7-request-1', status: 'formal_result_committed', formalizationStatus: 'committed', canEnterEvidenceReturn: true,
      runRecord: { schemaVersion: 'diagnosis_run_record_v1', runId: 'wp7-run-1', requestId: 'wp7-request-1', studentId: HEALTHY_STUDENT_ID, taskId: 'wp7-task-1', executionSessionId: 'wp7-execution-1', responseId: HEALTHY_RESPONSE_ID, executionMode: 'live', status: 'formal_result_committed', providerConfigId: 'wp7-provider-1', providerRequestIds: [], attemptCount: 1, repairOperations: [], promptVersion: 'v1', diagnosisSchemaVersion: 'v1', issues: [], startedAt: '2026-08-13T13:01:00.000Z', completedAt: '2026-08-13T13:02:00.000Z' },
      formalDiagnosisCommit: { schemaVersion: 'formal_diagnosis_commit_v1', formalDiagnosisId: 'wp7-diagnosis-1', requestId: 'wp7-request-1', runId: 'wp7-run-1', status: 'committed', committedAt: '2026-08-13T13:02:00.000Z', diagnosisResult: { taskType: 'open_response', correct: null, strategyUsed: 'analysis', answerStatus: 'partially_meets', scoreBand: 'medium', rubricItems: healthyRubric(), matchedRubricItems: ['r1', 'r2', 'r3'], missingRubricItems: ['r4'], mainAbility: '分析', relatedAbilities: [], surfaceError: '无', rootCause: '分析尚不完整', errorType: '分析错误', abilityEvidence: [], diagnosisSummary: '完成三个评分项', nextTraining: '补充影响说明', confidence: 0.8 }, validation: { passed: true, issues: [] } },
      validation: { passed: true, schemaValid: true, identityAligned: true, semanticBoundaryPassed: true, promptLeakagePassed: true, issues: [] },
    }, issues: [], createdAt: '2026-08-13T13:00:00.000Z', updatedAt: '2026-08-13T13:05:00.000Z',
  };
}

export function healthyPersistence(): LearningPersistenceRecord {
  return { recordId: 'wp7-persistence-1', studentId: HEALTHY_STUDENT_ID, learningRoundId: HEALTHY_ROUND_ID, savedAt: '2026-08-13T13:04:00.000Z', updatedAt: '2026-08-13T13:04:00.000Z', version: 'phase12_1_v1', schemaVersion: 'learning_persistence_v1', learningRoundResult: { status: 'completed' } as LearningPersistenceRecord['learningRoundResult'], status: 'saved', issues: [] };
}

export function healthyEvents(): LearningObservationEvent[] {
  const types: LearningObservationEventType[] = ['question_presented', 'answer_submitted', 'diagnosis_completed', 'feedback_presented', 'learning_round_completed'];
  return types.map((eventType, index) => ({
    schemaVersion: 'learning_observation_event_v1', eventId: `wp7-event-${eventType}`, eventType,
    occurredAt: `2026-08-13T13:0${index}:00.000Z`, recordedAt: `2026-08-13T13:0${index}:00.000Z`, runtimeScope: 'product',
    studentId: HEALTHY_STUDENT_ID, operationId: 'wp7-operation-1', learningSessionId: HEALTHY_SESSION_ID,
    learningRoundId: HEALTHY_ROUND_ID, materialVersionId: 'wp7-material-version-1', resourceId: 'wp7-resource-1',
    resourceVersionId: 'wp7-resource-version-1', taskId: 'wp7-task-1', sourceEntityId: `wp7-source-${eventType}`,
    appVersion: 'wp7-e2e', payload: healthyPayload(eventType),
  }));
}

export function healthyProjectionInput(): QuestionCalibrationProjectionInput {
  return { attemptId: HEALTHY_ATTEMPT_ID, runtimeScope: 'product', studentId: HEALTHY_STUDENT_ID, operationId: 'wp7-operation-1',
    learningSessionId: HEALTHY_SESSION_ID, learningRoundId: HEALTHY_ROUND_ID, responseId: HEALTHY_RESPONSE_ID,
    responseValidityStatus: 'valid', roundCompleted: true, completedAt: '2026-08-13T13:04:00.000Z',
    formalDiagnosisId: 'wp7-diagnosis-1', formalDiagnosisCommitted: true, rubricItems: healthyRubric(),
    resourceVersionId: 'wp7-resource-version-1', projectedAt: '2026-08-13T13:04:00.000Z' };
}

function healthyRubric() {
  return [1, 2, 3, 4].map((index) => ({ id: `r${index}`, label: `评分项${index}`, ability: '分析', required: true, matched: index < 4 }));
}

function healthyPayload(type: LearningObservationEventType): LearningObservationEvent['payload'] {
  if (type === 'question_presented') return { kind: type, presentationId: 'wp7-presentation-1' };
  if (type === 'answer_submitted') return { kind: type, responseId: HEALTHY_RESPONSE_ID, attemptId: HEALTHY_ATTEMPT_ID, submittedAt: '2026-08-13T13:01:00.000Z' };
  if (type === 'diagnosis_completed') return { kind: type, responseId: HEALTHY_RESPONSE_ID, attemptId: HEALTHY_ATTEMPT_ID, formalDiagnosisId: 'wp7-diagnosis-1', diagnosisSchemaVersion: 'v1' };
  if (type === 'feedback_presented') return { kind: type, responseId: HEALTHY_RESPONSE_ID, attemptId: HEALTHY_ATTEMPT_ID, feedbackRequestId: 'wp7-feedback-1', feedbackSchemaVersion: 'v1' };
  return { kind: type, responseId: HEALTHY_RESPONSE_ID, attemptId: HEALTHY_ATTEMPT_ID, persistenceRecordId: 'wp7-persistence-1', completedAt: '2026-08-13T13:04:00.000Z' };
}
