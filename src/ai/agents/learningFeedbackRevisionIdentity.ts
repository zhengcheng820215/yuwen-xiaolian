import { buildStableId } from './reviewedResourceCandidateAdapter.ts';

export function buildLearningTaskAttemptId(input: {
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  taskId: string;
  initialAttemptId: string;
}): string {
  return buildStableId('learning-task-attempt', [
    input.studentId,
    input.learningSessionId,
    input.learningRoundId,
    input.taskId,
    input.initialAttemptId,
  ]);
}

export function buildFeedbackGuidedRevisionId(input: {
  learningTaskAttemptId: string;
  initialResponseId: string;
}): string {
  return buildStableId('feedback-guided-revision', [
    input.learningTaskAttemptId,
    input.initialResponseId,
  ]);
}

export function buildRevisedResponseId(input: { revisionId: string }): string {
  return buildStableId('learning-revised-response', [input.revisionId]);
}

export function buildRevisionEvaluationId(input: {
  revisionId: string;
  policyVersion: string;
}): string {
  return buildStableId('revision-evaluation', [input.revisionId, input.policyVersion]);
}

export function buildFeedbackSupportedRevisionEvidenceId(input: {
  revisionId: string;
  revisionEvaluationId: string;
}): string {
  return buildStableId('feedback-supported-revision-evidence', [
    input.revisionId,
    input.revisionEvaluationId,
  ]);
}

export function buildRevisionProfileDecisionId(input: {
  revisionId: string;
  revisionEvaluationId: string;
}): string {
  return buildStableId('revision-profile-decision', [
    input.revisionId,
    input.revisionEvaluationId,
  ]);
}

export function buildRevisionProfileEvaluationId(input: {
  revisionId: string;
  revisionEvaluationId: string;
}): string {
  return buildStableId('revision-profile-evaluation', [
    input.revisionId,
    input.revisionEvaluationId,
  ]);
}
