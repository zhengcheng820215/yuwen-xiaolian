import type { PracticeQueueItem } from '../practice/practiceSessionTypes.ts';
import type { KnowledgeQuestion } from '../questions/knowledgeQuestionTypes.ts';
import { validatePracticeAttempt } from '../response/practiceAttemptValidator.ts';
import type { PracticeAttempt, PracticeResponse } from '../response/practiceResponseTypes.ts';
import { selectReinforcementCandidate } from './selectReinforcementCandidate.ts';
import type { ReinforcementDecision, ReinforcementLink } from './reinforcementTypes.ts';

function queueItemId(sessionId: string, sourceQueueItemId: string, targetQuestionId: string): string {
  return `${sessionId}-reinforcement-${sourceQueueItemId.replace(`${sessionId}-`, '')}-${targetQuestionId}`;
}

export function schedulePracticeReinforcement(input: {
  attempt: PracticeAttempt;
  response: PracticeResponse;
  sourceQuestion: KnowledgeQuestion;
  approvedQuestions: KnowledgeQuestion[];
  approvedLinks: ReinforcementLink[];
}): { attempt: PracticeAttempt; decision: ReinforcementDecision } {
  const selection = selectReinforcementCandidate(input);
  if (!selection.ok) return { attempt: input.attempt, decision: { outcome: 'not_scheduled', reason: selection.reason } };
  const sourceIndex = input.attempt.session.queue.findIndex((item) => item.id === input.response.queueItemId);
  if (sourceIndex < 0) return { attempt: input.attempt, decision: { outcome: 'not_scheduled', reason: 'candidate_unavailable' } };
  const insertionIndex = sourceIndex < input.attempt.session.queue.length - 1 ? sourceIndex + 2 : sourceIndex + 1;
  const id = queueItemId(input.attempt.session.id, input.response.queueItemId, selection.question.id);
  const item: PracticeQueueItem = {
    id,
    questionId: selection.question.id,
    questionContentVersion: selection.question.contentVersion,
    role: 'reinforcement',
    sourceQuestionId: input.sourceQuestion.id,
    status: 'pending',
  };
  const queue = [...input.attempt.session.queue];
  queue.splice(insertionIndex, 0, item);
  const attempt: PracticeAttempt = {
    ...input.attempt,
    session: { ...input.attempt.session, queue, updatedAt: input.response.answeredAt },
    updatedAt: input.response.answeredAt,
  };
  if (!validatePracticeAttempt(attempt).passed) return { attempt: input.attempt, decision: { outcome: 'not_scheduled', reason: 'candidate_unavailable' } };
  return {
    attempt,
    decision: {
      outcome: 'scheduled',
      sourceQuestionId: input.sourceQuestion.id,
      reinforcementQuestionId: selection.question.id,
      queueItemId: id,
      insertionIndex,
      linkId: selection.link.id,
    },
  };
}
