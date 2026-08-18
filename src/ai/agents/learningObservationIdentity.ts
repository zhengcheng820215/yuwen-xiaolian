import { buildStableId } from './reviewedResourceCandidateAdapter.ts';
import type { SingleChoiceStudentAnswerValue } from '../schemas/singleChoiceInteraction.schema.ts';

export function buildLearningCalibrationAttemptId(input: {
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  submissionIntentId: string;
}): string {
  return buildStableId('learning-calibration-attempt', [
    input.studentId,
    input.learningSessionId,
    input.learningRoundId,
    input.submissionIntentId,
  ]);
}

export function buildLearningSubmissionIntentId(input: {
  responseId: string;
  answerText?: string;
  singleChoiceAnswer?: SingleChoiceStudentAnswerValue;
}): string {
  return buildStableId('learning-answer-submission', [
    input.responseId,
    input.singleChoiceAnswer
      ? [
        input.singleChoiceAnswer.responseFormat,
        input.singleChoiceAnswer.optionSetVersion,
        ...input.singleChoiceAnswer.selectedOptionIds,
        ...input.singleChoiceAnswer.displayedOptionOrder,
      ].join(':')
      : (input.answerText || '').trim(),
  ]);
}

export function buildLearningObservationEventId(input: {
  schemaVersion: string;
  eventType: string;
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  sourceEntityId: string;
}): string {
  return buildStableId('learning-observation-event', [
    input.schemaVersion,
    input.eventType,
    input.studentId,
    input.learningSessionId,
    input.learningRoundId,
    input.sourceEntityId,
  ]);
}

export function buildQuestionCalibrationProjectionId(input: {
  schemaVersion: string;
  attemptId: string;
}): string {
  return buildStableId('question-calibration-projection', [
    input.schemaVersion,
    input.attemptId,
  ]);
}

export function buildQuestionPresentationId(input: {
  studentId: string;
  learningRoundId: string;
  resourceVersionId: string;
}): string {
  return buildStableId('question-presentation', [
    input.studentId,
    input.learningRoundId,
    input.resourceVersionId,
  ]);
}
