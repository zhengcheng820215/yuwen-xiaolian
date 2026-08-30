import { normalizeKnowledgeAnswer } from '../questions/knowledgeQuestionNormalization.ts';
import type { KnowledgeQuestion } from '../questions/knowledgeQuestionTypes.ts';
import type { EvaluateAnswerResult, SubmittedPracticeAnswer } from './practiceResponseTypes.ts';
import { validateSubmittedAnswer } from './validateSubmittedAnswer.ts';

export function evaluateKnowledgeAnswer(
  question: KnowledgeQuestion,
  submitted: SubmittedPracticeAnswer,
): EvaluateAnswerResult {
  const validation = validateSubmittedAnswer(question, submitted);
  if (!validation.ok) return validation;
  const submittedAnswer = validation.answer.value;
  if (question.type !== 'fill_blank') {
    const isCorrect = submittedAnswer === question.correctAnswer;
    return {
      ok: true,
      durationMs: validation.answer.durationMs,
      evaluation: {
        submittedAnswer,
        normalizedAnswer: submittedAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        ...(!isCorrect && question.misconceptionByAnswer?.[submittedAnswer]
          ? { misconceptionCode: question.misconceptionByAnswer[submittedAnswer].code }
          : {}),
      },
    };
  }

  const normalizedAnswer = normalizeKnowledgeAnswer(submittedAnswer, question.answerNormalization);
  const acceptedAnswers = question.acceptedAnswers?.length ? question.acceptedAnswers : [question.correctAnswer];
  const normalizedAccepted = acceptedAnswers.map((answer) => normalizeKnowledgeAnswer(answer, question.answerNormalization));
  return {
    ok: true,
    durationMs: validation.answer.durationMs,
    evaluation: {
      submittedAnswer,
      normalizedAnswer,
      correctAnswer: normalizeKnowledgeAnswer(question.correctAnswer, question.answerNormalization),
      isCorrect: normalizedAccepted.includes(normalizedAnswer),
    },
  };
}
