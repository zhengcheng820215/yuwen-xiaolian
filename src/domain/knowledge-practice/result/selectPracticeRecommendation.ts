import type { KnowledgeQuestion } from '../questions/knowledgeQuestionTypes.ts';
import type { KnowledgePointResultSummary, PracticeRecommendation, PracticeWrongItemSummary } from './practiceResultTypes.ts';

type Input = {
  knowledgePoints: KnowledgePointResultSummary[];
  wrongItems: PracticeWrongItemSummary[];
  approvedQuestions: KnowledgeQuestion[];
};

export function selectPracticeRecommendation(input: Input): PracticeRecommendation {
  const approvedById = new Map(input.approvedQuestions.map((item) => [item.id, item]));
  const concentrated = input.knowledgePoints
    .filter((item) => item.incorrectCount >= 2 && item.baseQuestionCount >= 2 && item.category)
    .sort((left, right) => (
      right.incorrectCount - left.incorrectCount
      || right.baseQuestionCount - left.baseQuestionCount
      || left.firstOccurrenceIndex - right.firstOccurrenceIndex
      || left.knowledgePoint.localeCompare(right.knowledgePoint)
    ))[0];
  if (concentrated && input.approvedQuestions.some((item) => item.category === concentrated.category)) {
    return {
      type: 'start_category_practice',
      title: `继续练习“${concentrated.category}”`,
      reason: `本轮“${concentrated.knowledgePoint}”${concentrated.baseQuestionCount}道基础题中有${concentrated.incorrectCount}道首次答错，建议继续完成5题专项。`,
      targetPath: `/learning/knowledge/quiz/${encodeURIComponent(concentrated.category!)}`,
      sourceKnowledgePoint: concentrated.knowledgePoint,
      category: concentrated.category,
      targetCount: 5,
      availability: 'available',
    };
  }
  const retryIds = input.wrongItems.map((item) => item.questionId).filter((id) => approvedById.has(id)).slice(0, 10);
  if (retryIds.length > 0) {
    return {
      type: 'retry_wrong_items',
      title: '重做本轮错题',
      reason: `本轮有${retryIds.length}道基础题首次答错，可以先按原顺序再做一次。`,
      targetPath: '/learning/knowledge/quiz/retry',
      targetCount: retryIds.length,
      sourceQuestionIds: retryIds,
      availability: 'available',
    };
  }
  if (input.approvedQuestions.length > 0 && input.wrongItems.length === 0) {
    return {
      type: 'start_mixed_practice',
      title: '开始新的综合小练',
      reason: '本轮基础题全部首次答对，可以通过一组新题继续收集本轮练习证据。',
      targetPath: '/learning/knowledge/quiz/all',
      targetCount: 10,
      availability: 'available',
    };
  }
  return {
    type: 'return_to_learning',
    title: '返回学习入口',
    reason: '当前没有可安全创建的相关题组，可以返回学习入口继续系统安排。',
    targetPath: '/learning',
    availability: 'fallback',
  };
}
