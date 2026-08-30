import type { AnswerNormalizationRule } from './knowledgeQuestionTypes.ts';

const TERMINAL_PUNCTUATION_PATTERN = /[。！？；，,.!?;]$/u;
const NORMALIZATION_ORDER: AnswerNormalizationRule[] = [
  'normalize_fullwidth_space',
  'trim',
  'collapse_whitespace',
  'ignore_terminal_punctuation',
];

export function normalizeKnowledgeAnswer(
  value: string,
  rules: AnswerNormalizationRule[] = [],
): string {
  const enabled = new Set(rules);
  let normalized = String(value ?? '');

  for (const rule of NORMALIZATION_ORDER) {
    if (!enabled.has(rule)) continue;
    if (rule === 'normalize_fullwidth_space') normalized = normalized.replace(/\u3000/g, ' ');
    if (rule === 'trim') normalized = normalized.trim();
    if (rule === 'collapse_whitespace') normalized = normalized.replace(/\s+/gu, ' ');
    if (rule === 'ignore_terminal_punctuation') normalized = normalized.replace(TERMINAL_PUNCTUATION_PATTERN, '');
  }

  return normalized;
}

export function normalizedAcceptedAnswers(
  answers: string[],
  rules: AnswerNormalizationRule[] = [],
): string[] {
  return answers.map((answer) => normalizeKnowledgeAnswer(answer, rules));
}
