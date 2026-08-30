import type { PracticeAttempt } from '../response/practiceResponseTypes.ts';
import type { MisconceptionResultSummary } from './practiceResultTypes.ts';

export function aggregateMisconceptionResults(attempt: PracticeAttempt): MisconceptionResultSummary[] {
  const groups = new Map<string, MisconceptionResultSummary>();
  attempt.responses.filter((item) => item.role === 'base' && !item.isCorrect && item.misconceptionCode).forEach((response, index) => {
    const code = response.misconceptionCode!;
    const feedback = attempt.feedbackByResponseId[response.id];
    const studentMessage = feedback?.misconception?.studentMessage;
    if (!studentMessage) return;
    const existing = groups.get(code);
    if (existing) {
      existing.occurrenceCount += 1;
      existing.questionIds.push(response.questionId);
    } else {
      groups.set(code, { code, studentMessage, occurrenceCount: 1, questionIds: [response.questionId], firstOccurrenceIndex: index });
    }
  });
  return [...groups.values()].sort((left, right) => (
    right.occurrenceCount - left.occurrenceCount
    || left.firstOccurrenceIndex - right.firstOccurrenceIndex
    || left.code.localeCompare(right.code)
  ));
}
