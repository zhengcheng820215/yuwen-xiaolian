import type { KnowledgeQuestion, KnowledgeQuestionCategory } from './knowledgeQuestionTypes.ts';

export const MIN_READY_CATEGORY_QUESTION_COUNT = 3;

export function isKnowledgeCategoryReady(questionCount: number): boolean {
  return Number.isInteger(questionCount) && questionCount >= MIN_READY_CATEGORY_QUESTION_COUNT;
}

export function countReadyKnowledgeCategories(questions: KnowledgeQuestion[]): number {
  const counts = new Map<KnowledgeQuestionCategory, number>();
  for (const question of questions) {
    counts.set(question.category, (counts.get(question.category) || 0) + 1);
  }
  return [...counts.values()].filter(isKnowledgeCategoryReady).length;
}
