export type ReadingAnswerLengthPolicy = {
  minimumLength: number;
  mode: 'advisory' | 'required';
};

// Generated minLength metadata is guidance; only the visible question can
// establish a hard lower bound. Frozen resources are not rewritten.
export function resolveReadingAnswerLengthPolicy(
  question: string,
  suggestedMinimumLength = 0,
): ReadingAnswerLengthPolicy {
  const explicit = question.match(/(?:不少于|至少(?:作答|写)?|不低于|最低)\s*(\d+)\s*(?:个)?字/);
  const minimum = explicit ? Number(explicit[1]) : suggestedMinimumLength;
  return {
    minimumLength: Number.isSafeInteger(minimum) && minimum > 0 ? minimum : 0,
    mode: explicit && minimum > 0 ? 'required' : 'advisory',
  };
}

export function answerMeetsRequiredLength(answer: string, policy: ReadingAnswerLengthPolicy): boolean {
  return policy.mode !== 'required'
    || Array.from(answer.replace(/\s/g, '')).length >= policy.minimumLength;
}
