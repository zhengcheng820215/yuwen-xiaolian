export default function AnswerLengthIndicator({ answer, minimumLength, mode = 'advisory' }) {
  if (!Number.isInteger(minimumLength) || minimumLength <= 0) return null;

  const currentLength = Array.from(answer.replace(/\s/g, '')).length;

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm leading-6 text-slate-500">
      <p>{mode === 'required' ? `作答要求：不少于 ${minimumLength} 字` : `建议 ${minimumLength} 字左右，以题目要求为准`}</p>
      <p>已输入 {currentLength} 字</p>
    </div>
  );
}

export function readMinimumAnswerLength(answerRequirements) {
  for (const requirement of answerRequirements || []) {
    const match = requirement.match(/(?:建议作答|至少作答|不少于)\s*(\d+)\s*(?:个)?字/);
    if (match) return Number(match[1]);
  }
  return undefined;
}
