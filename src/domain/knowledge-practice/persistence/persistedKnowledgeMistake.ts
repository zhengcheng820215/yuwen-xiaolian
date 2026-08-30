import type { KnowledgeQuestion } from '../questions/knowledgeQuestionTypes.ts';
import type { PracticeResponse } from '../response/practiceResponseTypes.ts';
import { PRACTICE_MISTAKE_LIMIT, type PersistedKnowledgeMistake } from './localPracticeStoreTypes.ts';

function answerText(question: KnowledgeQuestion, value: string): string {
  return question.options?.find((option) => option.id === value)?.text || value;
}

export function buildPersistedKnowledgeMistake(question: KnowledgeQuestion, response: PracticeResponse): PersistedKnowledgeMistake {
  return {
    schemaVersion: 1,
    questionId: question.id,
    questionContentVersion: response.questionContentVersion,
    category: question.category,
    knowledgePoint: response.knowledgePoint,
    stemSnapshot: question.stem,
    wrongAnswer: answerText(question, response.submittedAnswer),
    correctAnswerText: answerText(question, response.correctAnswer),
    explanationSnapshot: question.explanation,
    responseId: response.id,
    status: 'active',
    firstWrongAt: response.answeredAt,
    lastWrongAt: response.answeredAt,
  };
}

export function upsertPersistedMistake(items: PersistedKnowledgeMistake[], next: PersistedKnowledgeMistake): PersistedKnowledgeMistake[] {
  const existing = items.find((item) => item.questionId === next.questionId);
  const merged = existing ? { ...next, firstWrongAt: existing.firstWrongAt } : next;
  const result = [merged, ...items.filter((item) => item.questionId !== next.questionId)];
  if (result.length <= PRACTICE_MISTAKE_LIMIT) return result;
  const resolved = result.filter((item) => item.status === 'resolved').sort((a, b) => Date.parse(a.lastWrongAt) - Date.parse(b.lastWrongAt));
  const removable = new Set(resolved.slice(0, result.length - PRACTICE_MISTAKE_LIMIT).map((item) => item.questionId));
  return result.filter((item) => !removable.has(item.questionId));
}
