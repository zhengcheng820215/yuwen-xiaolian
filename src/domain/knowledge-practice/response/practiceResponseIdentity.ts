export function createPracticeResponseKey(sessionId: string, queueItemId: string): string {
  return `${sessionId}::${queueItemId}`;
}
export function createPracticeResponseId(sessionId: string, queueItemId: string): string {
  if (!sessionId || !queueItemId) throw new Error('Response identity requires session and queue item.');
  return `${queueItemId}-response`;
}
