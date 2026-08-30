import type { PracticeSession } from './practiceSessionTypes.ts';

export function markPracticeQueueItemAnswered(
  session: PracticeSession,
  queueItemId: string,
  now: string,
): PracticeSession {
  if (session.status !== 'active') return session;
  const current = session.queue[session.currentIndex];
  if (!current || current.id !== queueItemId) return session;
  if (current.status === 'answered') return session;
  return {
    ...session,
    updatedAt: now,
    queue: session.queue.map((item) => item.id === queueItemId ? { ...item, status: 'answered' } : item),
  };
}

export function advancePracticeSession(session: PracticeSession, now: string): PracticeSession {
  if (session.status !== 'active') return session;
  const current = session.queue[session.currentIndex];
  if (!current || current.status !== 'answered') return session;
  if (session.currentIndex < session.queue.length - 1) {
    return { ...session, currentIndex: session.currentIndex + 1, updatedAt: now };
  }
  return { ...session, status: 'completed', updatedAt: now, completedAt: now };
}

export function abandonPracticeSession(session: PracticeSession, now: string): PracticeSession {
  if (session.status !== 'active') return session;
  return { ...session, status: 'abandoned', updatedAt: now, abandonedAt: now };
}
