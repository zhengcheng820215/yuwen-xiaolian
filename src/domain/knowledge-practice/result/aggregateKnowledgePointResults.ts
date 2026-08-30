import type { KnowledgeQuestion } from '../questions/knowledgeQuestionTypes.ts';
import type { PracticeResponse } from '../response/practiceResponseTypes.ts';
import type { KnowledgePointResultLevel, KnowledgePointResultSummary } from './practiceResultTypes.ts';

const LEVEL_ORDER: Record<KnowledgePointResultLevel, number> = {
  prioritize_this_round: 0,
  reinforce_this_round: 1,
  insufficient_evidence: 2,
  steady_this_round: 3,
};

function levelFor(count: number, incorrect: number): KnowledgePointResultLevel {
  if (count <= 1) return 'insufficient_evidence';
  if (incorrect === 0) return 'steady_this_round';
  if (incorrect === 1) return 'reinforce_this_round';
  return 'prioritize_this_round';
}

const MESSAGE: Record<KnowledgePointResultLevel, string> = {
  insufficient_evidence: '本轮证据较少',
  steady_this_round: '本轮表现较稳',
  reinforce_this_round: '本轮建议巩固',
  prioritize_this_round: '本轮优先巩固',
};

export function aggregateKnowledgePointResults(
  responses: PracticeResponse[],
  questionById: Map<string, KnowledgeQuestion>,
): KnowledgePointResultSummary[] {
  const groups = new Map<string, { responses: PracticeResponse[]; first: number }>();
  responses.filter((item) => item.role === 'base').forEach((response, index) => {
    const current = groups.get(response.knowledgePoint);
    if (current) current.responses.push(response);
    else groups.set(response.knowledgePoint, { responses: [response], first: index });
  });
  return [...groups.entries()].map(([knowledgePoint, group]) => {
    const incorrectCount = group.responses.filter((item) => !item.isCorrect).length;
    const level = levelFor(group.responses.length, incorrectCount);
    const category = questionById.get(group.responses[0].questionId)?.category;
    return {
      knowledgePoint,
      ...(category ? { category } : {}),
      baseQuestionCount: group.responses.length,
      correctCount: group.responses.length - incorrectCount,
      incorrectCount,
      firstOccurrenceIndex: group.first,
      level,
      studentMessage: MESSAGE[level],
    };
  }).sort((left, right) => (
    LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level]
    || right.incorrectCount - left.incorrectCount
    || left.firstOccurrenceIndex - right.firstOccurrenceIndex
    || left.knowledgePoint.localeCompare(right.knowledgePoint)
  ));
}
