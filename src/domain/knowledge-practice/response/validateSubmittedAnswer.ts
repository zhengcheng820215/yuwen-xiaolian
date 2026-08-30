import type { KnowledgeQuestion } from '../questions/knowledgeQuestionTypes.ts';
import type {
  PracticeAnswerError,
  SubmittedPracticeAnswer,
} from './practiceResponseTypes.ts';

const PUNCTUATION_ONLY_PATTERN = /^[\p{P}\s]+$/u;
const CONTROL_CHARACTER_PATTERN = /[\p{Cc}\p{Cf}]/u;
export const MAX_PRACTICE_ANSWER_CHARACTERS = 200;
export const MAX_PRACTICE_QUESTION_DURATION_MS = 30 * 60 * 1000;

const messages: Record<PracticeAnswerError['code'], string> = {
  attempt_invalid: '当前练习状态异常，请返回后重新进入。',
  session_not_active: '本组练习已经结束，不能继续提交。',
  queue_item_not_current: '当前题目已经变化，请确认后再提交。',
  question_unavailable: '当前题目暂时无法读取，请返回后重新进入。',
  question_version_mismatch: '当前题目内容已经更新，请重新开始本组练习。',
  answer_empty: '请先填写或选择答案。',
  answer_punctuation_only: '答案不能只包含标点符号。',
  answer_too_long: '答案内容过长，请检查后重新提交。',
  answer_control_character: '答案包含无法识别的字符，请重新输入。',
  option_invalid: '请选择当前题目提供的有效选项。',
  duration_invalid: '当前作答时间记录异常，请重新进入本题。',
  submitted_at_invalid: '当前提交时间异常，请重新提交。',
  response_identity_failed: '暂时无法保存本次答案，请稍后重试。',
};

export function practiceAnswerError(
  code: PracticeAnswerError['code'],
  details?: Record<string, unknown>,
): PracticeAnswerError {
  return { code, studentMessage: messages[code], details };
}

export type ValidatedSubmittedAnswer = {
  value: string;
  durationMs: number;
};

export function hasPotentialPracticeAnswer(question: KnowledgeQuestion, value: string): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (question.type !== 'fill_blank') return Boolean(question.options?.some((option) => option.id === trimmed));
  return !PUNCTUATION_ONLY_PATTERN.test(trimmed)
    && !CONTROL_CHARACTER_PATTERN.test(trimmed)
    && Array.from(trimmed).length <= MAX_PRACTICE_ANSWER_CHARACTERS;
}

export function validateSubmittedAnswer(
  question: KnowledgeQuestion,
  submitted: SubmittedPracticeAnswer,
): { ok: true; answer: ValidatedSubmittedAnswer } | { ok: false; error: PracticeAnswerError } {
  if (!submitted || typeof submitted.value !== 'string') return { ok: false, error: practiceAnswerError('answer_empty') };
  if (!submitted.submittedAt || Number.isNaN(Date.parse(submitted.submittedAt))) {
    return { ok: false, error: practiceAnswerError('submitted_at_invalid') };
  }
  if (!Number.isFinite(submitted.durationMs) || submitted.durationMs < 0) {
    return { ok: false, error: practiceAnswerError('duration_invalid') };
  }
  const value = submitted.value.trim();
  if (!value) return { ok: false, error: practiceAnswerError('answer_empty') };
  if (question.type === 'fill_blank') {
    if (CONTROL_CHARACTER_PATTERN.test(value)) return { ok: false, error: practiceAnswerError('answer_control_character') };
    if (Array.from(value).length > MAX_PRACTICE_ANSWER_CHARACTERS) return { ok: false, error: practiceAnswerError('answer_too_long') };
    if (PUNCTUATION_ONLY_PATTERN.test(value)) return { ok: false, error: practiceAnswerError('answer_punctuation_only') };
  } else if (!question.options?.some((option) => option.id === value)) {
    return { ok: false, error: practiceAnswerError('option_invalid', { submittedOptionId: value }) };
  }
  return {
    ok: true,
    answer: {
      value,
      durationMs: Math.min(Math.round(submitted.durationMs), MAX_PRACTICE_QUESTION_DURATION_MS),
    },
  };
}
