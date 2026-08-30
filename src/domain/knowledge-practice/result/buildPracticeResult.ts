import { getKnowledgeQuestionDisplayAnswer, knowledgeQuestionRepository } from '../questions/knowledgeQuestionRepository.ts';
import type { KnowledgeQuestion } from '../questions/knowledgeQuestionTypes.ts';
import type { PracticeAttempt } from '../response/practiceResponseTypes.ts';
import { aggregateKnowledgePointResults } from './aggregateKnowledgePointResults.ts';
import { aggregateMisconceptionResults } from './aggregateMisconceptionResults.ts';
import { PRACTICE_RESULT_RESPONSE_CAP_MS, type PracticeResult, type PracticeWrongItemSummary } from './practiceResultTypes.ts';
import { selectPracticeRecommendation } from './selectPracticeRecommendation.ts';

export type BuildPracticeResultInput = {
  completedAttempt: PracticeAttempt;
  questionSnapshots?: KnowledgeQuestion[];
  approvedQuestionInventory?: KnowledgeQuestion[];
};

export function buildPracticeResult(input: BuildPracticeResultInput): PracticeResult {
  const attempt = input.completedAttempt;
  if (attempt.session.status !== 'completed' || !attempt.session.completedAt) {
    throw new Error('Only a completed practice attempt can produce a result.');
  }
  const questions = input.questionSnapshots || knowledgeQuestionRepository.listApproved();
  const inventory = input.approvedQuestionInventory || knowledgeQuestionRepository.listApproved();
  const questionById = new Map(questions.map((item) => [item.id, item]));
  const baseResponses = attempt.responses.filter((item) => item.role === 'base');
  const reinforcementResponses = attempt.responses.filter((item) => item.role === 'reinforcement');
  if (baseResponses.length !== attempt.session.actualBaseQuestionCount) throw new Error('Completed base response count mismatch.');
  if (attempt.responses.length !== attempt.session.queue.length) throw new Error('Completed queue response count mismatch.');
  const baseCorrect = baseResponses.filter((item) => item.isCorrect).length;
  const effective = (durationMs: number) => Math.min(durationMs, PRACTICE_RESULT_RESPONSE_CAP_MS);
  const wrongItems: PracticeWrongItemSummary[] = baseResponses.flatMap((response, occurrenceIndex) => {
    if (response.isCorrect) return [];
    const question = questionById.get(response.questionId);
    const feedback = attempt.feedbackByResponseId[response.id];
    return [{
      questionId: response.questionId,
      questionContentVersion: response.questionContentVersion,
      ...(question?.category ? { category: question.category } : {}),
      knowledgePoint: response.knowledgePoint,
      stemSnapshot: question?.stem || '题目内容暂不可用',
      submittedAnswerText: feedback?.submittedAnswerText || response.submittedAnswer,
      correctAnswerText: feedback?.correctAnswerText || (question ? getKnowledgeQuestionDisplayAnswer(question) : response.correctAnswer),
      keyEvidence: feedback?.keyEvidence || question?.explanation || '请结合原题解析复盘。',
      hasStructuredMisconception: Boolean(response.misconceptionCode && feedback?.misconception?.studentMessage),
      occurrenceIndex,
    }];
  });
  const knowledgePoints = aggregateKnowledgePointResults(baseResponses, questionById);
  const misconceptions = aggregateMisconceptionResults(attempt);
  const baseEffectiveDurationMs = baseResponses.reduce((sum, item) => sum + effective(item.durationMs), 0);
  const reinforcementEffectiveDurationMs = reinforcementResponses.reduce((sum, item) => sum + effective(item.durationMs), 0);
  const result: PracticeResult = {
    schemaVersion: 1,
    resultId: `practice-result-${attempt.session.id}`,
    sourceSessionId: attempt.session.id,
    mode: attempt.session.mode,
    ...(attempt.session.category ? { category: attempt.session.category } : {}),
    completedAt: attempt.session.completedAt,
    basePerformance: {
      questionCount: attempt.session.actualBaseQuestionCount,
      answeredCount: baseResponses.length,
      correctCount: baseCorrect,
      incorrectCount: baseResponses.length - baseCorrect,
      firstAttemptAccuracy: baseResponses.length === 0 ? 0 : Math.round((baseCorrect / baseResponses.length) * 100),
    },
    reinforcementPerformance: {
      scheduledCount: attempt.session.queue.filter((item) => item.role === 'reinforcement').length,
      answeredCount: reinforcementResponses.length,
      correctCount: reinforcementResponses.filter((item) => item.isCorrect).length,
      incorrectCount: reinforcementResponses.filter((item) => !item.isCorrect).length,
    },
    timing: {
      perResponseCapMs: PRACTICE_RESULT_RESPONSE_CAP_MS,
      rawDurationMs: attempt.responses.reduce((sum, item) => sum + item.durationMs, 0),
      effectiveDurationMs: baseEffectiveDurationMs + reinforcementEffectiveDurationMs,
      baseEffectiveDurationMs,
      reinforcementEffectiveDurationMs,
      cappedResponseCount: attempt.responses.filter((item) => item.durationMs > PRACTICE_RESULT_RESPONSE_CAP_MS).length,
    },
    knowledgePoints,
    misconceptions,
    wrongItems,
    recommendation: selectPracticeRecommendation({ knowledgePoints, wrongItems, approvedQuestions: inventory }),
    statementBoundary: 'current_round_only',
  };
  return result;
}
