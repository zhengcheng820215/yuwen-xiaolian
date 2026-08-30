import type { PracticeSession } from '../practice/practiceSessionTypes.ts';

export type PracticeResponse = {
  schemaVersion: 1;
  id: string;
  responseKey: string;
  sessionId: string;
  queueItemId: string;
  questionId: string;
  questionContentVersion: number;
  role: 'base' | 'reinforcement';
  sourceQuestionId?: string;
  submittedAnswer: string;
  normalizedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  knowledgePoint: string;
  misconceptionCode?: string;
  durationMs: number;
  answeredAt: string;
};

export type AnswerFeedbackFallbackCode =
  | 'choice_analysis_missing'
  | 'misconception_missing'
  | 'key_evidence_from_general_explanation';

export type AnswerFeedback = {
  schemaVersion: 1;
  responseId: string;
  result: 'correct' | 'incorrect';
  headline: string;
  submittedAnswerText: string;
  correctAnswerText: string;
  currentChoiceExplanation?: string;
  keyEvidence: string;
  knowledgePoint: string;
  misconception?: {
    code: string;
    studentMessage: string;
  };
  solutionSteps: string[];
  contentFallbacks: AnswerFeedbackFallbackCode[];
};

export type PracticeAttempt = {
  schemaVersion: 1;
  session: PracticeSession;
  responses: PracticeResponse[];
  feedbackByResponseId: Record<string, AnswerFeedback>;
  currentQuestionPresentedAt: string;
  updatedAt: string;
};

export type SubmittedPracticeAnswer = {
  value: string;
  submittedAt: string;
  durationMs: number;
};

export type AnswerEvaluation = {
  submittedAnswer: string;
  normalizedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  misconceptionCode?: string;
};

export type PracticeAnswerErrorCode =
  | 'attempt_invalid'
  | 'session_not_active'
  | 'queue_item_not_current'
  | 'question_unavailable'
  | 'question_version_mismatch'
  | 'answer_empty'
  | 'answer_punctuation_only'
  | 'answer_too_long'
  | 'answer_control_character'
  | 'option_invalid'
  | 'duration_invalid'
  | 'submitted_at_invalid'
  | 'response_identity_failed';

export type PracticeAnswerError = {
  code: PracticeAnswerErrorCode;
  studentMessage: string;
  details?: Record<string, unknown>;
};

export type EvaluateAnswerResult =
  | { ok: true; evaluation: AnswerEvaluation; durationMs: number }
  | { ok: false; error: PracticeAnswerError };
export type SubmitPracticeAnswerResult =
  | {
      ok: true;
      outcome: 'created' | 'already_submitted';
      attempt: PracticeAttempt;
      response: PracticeResponse;
      feedback: AnswerFeedback;
    }
  | { ok: false; error: PracticeAnswerError };
