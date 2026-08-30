import type { KnowledgeQuestion } from '../questions/knowledgeQuestionTypes.ts';
import type { ReinforcementLink, ReinforcementDecision } from '../reinforcement/reinforcementTypes.ts';
import { schedulePracticeReinforcement } from '../reinforcement/schedulePracticeReinforcement.ts';
import { submitPracticeAnswer } from './submitPracticeAnswer.ts';
import type { PracticeAttempt, PracticeAnswerError, PracticeResponse, AnswerFeedback, SubmittedPracticeAnswer } from './practiceResponseTypes.ts';

export type SubmitPracticeAnswerWithReinforcementResult =
  | {
      ok: true;
      outcome: 'created' | 'already_submitted';
      attempt: PracticeAttempt;
      response: PracticeResponse;
      feedback: AnswerFeedback;
      reinforcementDecision: ReinforcementDecision;
    }
  | { ok: false; error: PracticeAnswerError };

export function submitPracticeAnswerWithReinforcement(input: {
  attempt: PracticeAttempt;
  queueItemId: string;
  question: KnowledgeQuestion;
  answer: SubmittedPracticeAnswer;
  approvedQuestions: KnowledgeQuestion[];
  approvedLinks: ReinforcementLink[];
}): SubmitPracticeAnswerWithReinforcementResult {
  const submitted = submitPracticeAnswer(input);
  if (!submitted.ok) return submitted;
  if (submitted.outcome === 'already_submitted') {
    return { ...submitted, reinforcementDecision: { outcome: 'not_scheduled', reason: 'already_scheduled' } };
  }
  const scheduled = schedulePracticeReinforcement({
    attempt: submitted.attempt,
    response: submitted.response,
    sourceQuestion: input.question,
    approvedQuestions: input.approvedQuestions,
    approvedLinks: input.approvedLinks,
  });
  return { ...submitted, attempt: scheduled.attempt, reinforcementDecision: scheduled.decision };
}
