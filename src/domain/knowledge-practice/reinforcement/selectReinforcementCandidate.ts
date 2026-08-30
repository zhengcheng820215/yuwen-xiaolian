import { seededShuffle } from '../practice/practiceSeed.ts';
import type { PracticeAttempt, PracticeResponse } from '../response/practiceResponseTypes.ts';
import type { KnowledgeQuestion } from '../questions/knowledgeQuestionTypes.ts';
import type { ReinforcementLink, ReinforcementNotScheduledReason } from './reinforcementTypes.ts';

export type ReinforcementCandidateSelection =
  | { ok: true; link: ReinforcementLink; question: KnowledgeQuestion }
  | { ok: false; reason: ReinforcementNotScheduledReason };

export function selectReinforcementCandidate(input: {
  attempt: PracticeAttempt;
  response: PracticeResponse;
  sourceQuestion: KnowledgeQuestion;
  approvedQuestions: KnowledgeQuestion[];
  approvedLinks: ReinforcementLink[];
}): ReinforcementCandidateSelection {
  const { attempt, response, sourceQuestion } = input;
  const currentItem = attempt.session.queue.find((item) => item.id === response.queueItemId);
  if (response.isCorrect) return { ok: false, reason: 'response_correct' };
  if (!currentItem || currentItem.role !== 'base' || response.role !== 'base') return { ok: false, reason: 'not_base_item' };
  if (attempt.session.queue.some((item) => item.role === 'reinforcement' && item.sourceQuestionId === sourceQuestion.id)) return { ok: false, reason: 'already_scheduled' };
  if (attempt.session.queue.filter((item) => item.role === 'reinforcement').length >= 3) return { ok: false, reason: 'session_limit_reached' };
  if (!sourceQuestion.variantGroupId) return { ok: false, reason: 'source_group_missing' };

  const sourceLinks = input.approvedLinks.filter((link) => link.status === 'approved' && link.sourceQuestionId === sourceQuestion.id && link.variantGroupId === sourceQuestion.variantGroupId);
  if (sourceLinks.length === 0) return { ok: false, reason: 'approved_link_missing' };
  const misconceptionLinks = sourceLinks.filter((link) => !link.applicableMisconceptionCodes?.length || (response.misconceptionCode && link.applicableMisconceptionCodes.includes(response.misconceptionCode)));
  if (misconceptionLinks.length === 0) return { ok: false, reason: 'misconception_not_applicable' };

  const questionById = new Map(input.approvedQuestions.filter((question) => question.contentStatus === 'approved').map((question) => [question.id, question]));
  const queuedQuestionIds = new Set(attempt.session.queue.map((item) => item.questionId));
  const notAlreadyQueued = misconceptionLinks.filter((link) => !queuedQuestionIds.has(link.reinforcementQuestionId));
  if (notAlreadyQueued.length === 0) return { ok: false, reason: 'candidate_already_in_session' };
  const candidates = notAlreadyQueued.flatMap((link) => {
    const question = questionById.get(link.reinforcementQuestionId);
    return question && question.id !== sourceQuestion.id && question.variantGroupId === sourceQuestion.variantGroupId && question.knowledgePoint === sourceQuestion.knowledgePoint
      ? [{ link, question }]
      : [];
  });
  if (candidates.length === 0) return { ok: false, reason: 'candidate_unavailable' };
  const [selected] = seededShuffle(candidates, `${attempt.session.seed}|${currentItem.id}|${response.id}`);
  return { ok: true, ...selected };
}
