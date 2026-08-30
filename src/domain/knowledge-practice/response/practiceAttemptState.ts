import { abandonPracticeSession, advancePracticeSession } from '../practice/practiceSessionState.ts';
import type { PracticeAttempt } from './practiceResponseTypes.ts';

export function advancePracticeAttempt(attempt: PracticeAttempt, now: string): PracticeAttempt {
  const nextSession = advancePracticeSession(attempt.session, now);
  if (nextSession === attempt.session) return attempt;
  return {
    ...attempt,
    session: nextSession,
    currentQuestionPresentedAt: now,
    updatedAt: now,
  };
}
export function abandonPracticeAttempt(attempt: PracticeAttempt, now: string): PracticeAttempt {
  const nextSession = abandonPracticeSession(attempt.session, now);
  if (nextSession === attempt.session) return attempt;
  return { ...attempt, session: nextSession, updatedAt: now };
}
