type SingleChoiceFeedbackSource = {
  diagnosisMeaning?: string;
  evidenceBoundary?: string;
};

export function projectSingleChoiceGapForStudent(
  source: SingleChoiceFeedbackSource | undefined,
): string {
  const meaning = normalize(source?.diagnosisMeaning);
  if (!meaning) return '这项选择与材料中的关键信息还不一致。';

  const studentFacing = meaning
    .replace(/^只看到/u, '你选择的这一项只关注了')
    .replace(/^只关注/u, '你选择的这一项只关注了')
    .replace(/^学生只看到/u, '你选择的这一项只关注了')
    .replace(/^学生只关注/u, '你选择的这一项只关注了')
    .replace(/^学生(?:忽略了?|漏掉了?)/u, '你选择的这一项还没有结合')
    .replace(/^学生/u, '这项判断')
    .replace(/，忽略了/u, '，还没有结合')
    .replace(/，漏掉了/u, '，还没有结合');

  return finishSentence(studentFacing);
}

export function projectSingleChoiceReviewActionForStudent(
  source: SingleChoiceFeedbackSource | undefined,
): string {
  const boundary = normalize(source?.evidenceBoundary)
    .replace(/[。！？!?]$/u, '')
    .replace(/^回到材料(?:中)?核对[：:]?\s*/u, '')
    .replace(/^(?:核对|对照)/u, '');
  if (!boundary) return '请对照题目指向的关键语句，再判断哪个选项更符合原文。';
  return `请对照${boundary}，再判断哪个选项更符合原文。`;
}

function normalize(value?: string): string {
  return value?.trim().replace(/\s+/g, ' ') || '';
}

function finishSentence(value: string): string {
  return /[。！？!?]$/u.test(value) ? value : `${value}。`;
}
