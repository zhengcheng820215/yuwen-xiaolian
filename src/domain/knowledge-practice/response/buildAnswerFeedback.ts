import type { KnowledgeQuestion } from '../questions/knowledgeQuestionTypes.ts';
import type { AnswerFeedback, AnswerFeedbackFallbackCode, PracticeResponse } from './practiceResponseTypes.ts';

function optionText(question: KnowledgeQuestion, optionId: string): string {
  return question.options?.find((option) => option.id === optionId)?.text || optionId;
}
export function buildAnswerFeedback(
  question: KnowledgeQuestion,
  response: PracticeResponse,
): AnswerFeedback {
  const fallbacks: AnswerFeedbackFallbackCode[] = [];
  const isChoice = question.type !== 'fill_blank';
  const submittedAnswerText = isChoice ? optionText(question, response.submittedAnswer) : response.submittedAnswer;
  const correctAnswerText = isChoice ? optionText(question, question.correctAnswer) : question.correctAnswer;
  let currentChoiceExplanation: string | undefined;
  if (!response.isCorrect) {
    currentChoiceExplanation = isChoice ? question.answerAnalysis?.[response.submittedAnswer] : question.explanation;
    if (!currentChoiceExplanation) {
      currentChoiceExplanation = '这个答案不符合本题要求，请对照正确依据重新核查。';
      fallbacks.push('choice_analysis_missing');
    }
  }
  let keyEvidence = isChoice ? question.answerAnalysis?.[question.correctAnswer] : question.explanation;
  if (!keyEvidence) {
    keyEvidence = question.explanation;
    fallbacks.push('key_evidence_from_general_explanation');
  }
  const misconception = !response.isCorrect
    ? question.misconceptionByAnswer?.[response.submittedAnswer]
    : undefined;
  if (!response.isCorrect && !misconception) fallbacks.push('misconception_missing');

  return {
    schemaVersion: 1,
    responseId: response.id,
    result: response.isCorrect ? 'correct' : 'incorrect',
    headline: response.isCorrect ? '回答正确' : '这道题需要再核查一次',
    submittedAnswerText,
    correctAnswerText,
    ...(currentChoiceExplanation ? { currentChoiceExplanation } : {}),
    keyEvidence,
    knowledgePoint: question.knowledgePoint,
    ...(misconception ? { misconception: { ...misconception } } : {}),
    solutionSteps: question.solutionSteps.slice(0, 3),
    contentFallbacks: fallbacks,
  };
}
