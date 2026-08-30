import { markPracticeQueueItemAnswered } from '../practice/practiceSessionState.ts';
import type { PracticeSession } from '../practice/practiceSessionTypes.ts';
import type { KnowledgeQuestion } from '../questions/knowledgeQuestionTypes.ts';
import { buildAnswerFeedback } from './buildAnswerFeedback.ts';
import { evaluateKnowledgeAnswer } from './evaluateKnowledgeAnswer.ts';
import { validatePracticeAttempt } from './practiceAttemptValidator.ts';
import { createPracticeResponseId, createPracticeResponseKey } from './practiceResponseIdentity.ts';
import type {
  PracticeAttempt,
  PracticeResponse,
  SubmitPracticeAnswerResult,
  SubmittedPracticeAnswer,
} from './practiceResponseTypes.ts';
import { practiceAnswerError } from './validateSubmittedAnswer.ts';

export function createPracticeAttempt(session: PracticeSession): PracticeAttempt {
  return {
    schemaVersion: 1,
    session,
    responses: [],
    feedbackByResponseId: {},
    currentQuestionPresentedAt: session.startedAt,
    updatedAt: session.updatedAt,
  };
}
export function submitPracticeAnswer(input: {
  attempt: PracticeAttempt;
  queueItemId: string;
  question: KnowledgeQuestion;
  answer: SubmittedPracticeAnswer;
}): SubmitPracticeAnswerResult {
  const attemptValidation = validatePracticeAttempt(input.attempt);
  if (!attemptValidation.passed) return { ok: false, error: practiceAnswerError('attempt_invalid', { issues: attemptValidation.issues }) };
  const { session } = input.attempt;
  if (session.status !== 'active') return { ok: false, error: practiceAnswerError('session_not_active') };
  const currentItem = session.queue[session.currentIndex];
  if (!currentItem || currentItem.id !== input.queueItemId) return { ok: false, error: practiceAnswerError('queue_item_not_current') };
  const responseKey = createPracticeResponseKey(session.id, currentItem.id);
  const existing = input.attempt.responses.find((response) => response.responseKey === responseKey);
  if (existing) {
    return {
      ok: true,
      outcome: 'already_submitted',
      attempt: input.attempt,
      response: existing,
      feedback: input.attempt.feedbackByResponseId[existing.id],
    };
  }
  if (!input.question || input.question.id !== currentItem.questionId) return { ok: false, error: practiceAnswerError('question_unavailable') };
  if (input.question.contentVersion !== currentItem.questionContentVersion) return { ok: false, error: practiceAnswerError('question_version_mismatch') };
  const evaluated = evaluateKnowledgeAnswer(input.question, input.answer);
  if (!evaluated.ok) return evaluated;

  let responseId: string;
  try {
    responseId = createPracticeResponseId(session.id, currentItem.id);
  } catch {
    return { ok: false, error: practiceAnswerError('response_identity_failed') };
  }
  const response: PracticeResponse = {
    schemaVersion: 1,
    id: responseId,
    responseKey,
    sessionId: session.id,
    queueItemId: currentItem.id,
    questionId: currentItem.questionId,
    questionContentVersion: currentItem.questionContentVersion,
    role: currentItem.role,
    ...(currentItem.sourceQuestionId ? { sourceQuestionId: currentItem.sourceQuestionId } : {}),
    ...evaluated.evaluation,
    knowledgePoint: input.question.knowledgePoint,
    durationMs: evaluated.durationMs,
    answeredAt: input.answer.submittedAt,
  };
  const feedback = buildAnswerFeedback(input.question, response);
  const nextSession = markPracticeQueueItemAnswered(session, currentItem.id, input.answer.submittedAt);
  const nextAttempt: PracticeAttempt = {
    ...input.attempt,
    session: nextSession,
    responses: [...input.attempt.responses, response],
    feedbackByResponseId: { ...input.attempt.feedbackByResponseId, [response.id]: feedback },
    updatedAt: input.answer.submittedAt,
  };
  const nextValidation = validatePracticeAttempt(nextAttempt);
  if (!nextValidation.passed) return { ok: false, error: practiceAnswerError('attempt_invalid', { issues: nextValidation.issues }) };
  return { ok: true, outcome: 'created', attempt: nextAttempt, response, feedback };
}
