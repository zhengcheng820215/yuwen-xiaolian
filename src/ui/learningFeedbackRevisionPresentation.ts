import type { RevisionEvaluation, RevisionOutcome } from '../ai/schemas/learningFeedbackRevision.schema.ts';

export type LearningFeedbackRevisionPresentation = {
  eyebrow: string;
  title: string;
  summary: string;
  remainingFocus?: string;
  methodReminder: string;
};

type IssuePresentation = {
  resolvedSummary: string;
  remainingFocus: string;
  methodReminder: string;
};

const DEFAULT_ISSUE_PRESENTATION: IssuePresentation = {
  resolvedSummary: '你已经根据反馈补充了关键内容，回答比第一次更完整。',
  remainingFocus: '再对照题目要求，看看是否还有内容没有说明清楚。',
  methodReminder: '回答后对照题目要求检查一遍，确认关键信息已经说清楚。',
};

const ISSUE_PRESENTATIONS: Record<string, IssuePresentation> = {
  missing_text_evidence: {
    resolvedSummary: '你已经补充了文本依据，回答比第一次更完整。',
    remainingFocus: '还需要找到能够直接支持判断的原文内容。',
    methodReminder: '先找到能支持判断的原文，再说明它怎样支持你的判断。',
  },
  evidence: {
    resolvedSummary: '你已经补充了文本依据，回答比第一次更完整。',
    remainingFocus: '还需要找到能够直接支持判断的原文内容。',
    methodReminder: '先找到能支持判断的原文，再说明它怎样支持你的判断。',
  },
  missing_reasoning_relation: {
    resolvedSummary: '你已经说明了依据与判断之间的关系，回答思路更清楚了。',
    remainingFocus: '还需要说明文本依据为什么能够支持你的判断。',
    methodReminder: '写出依据后，再用一句话说明它为什么能支持你的判断。',
  },
  relation: {
    resolvedSummary: '你已经说明了依据与判断之间的关系，回答思路更清楚了。',
    remainingFocus: '还需要说明文本依据为什么能够支持你的判断。',
    methodReminder: '写出依据后，再用一句话说明它为什么能支持你的判断。',
  },
  conclusion_inconsistent: {
    resolvedSummary: '你已经调整了判断，使回答与文章内容更一致。',
    remainingFocus: '还需要回到原文核对判断，避免超出文章内容。',
    methodReminder: '作出判断后回到原文核对，看看文章是否真的支持这个结论。',
  },
  incomplete_task_requirement: {
    resolvedSummary: '你已经补充了题目要求的内容，回答更完整了。',
    remainingFocus: '题目要求的内容还没有全部回答完整。',
    methodReminder: '提交前逐项对照题目要求，确认每一项都已经回答。',
  },
  revision_regression: {
    resolvedSummary: DEFAULT_ISSUE_PRESENTATION.resolvedSummary,
    remainingFocus: '修改时要保留原来答对的内容，只调整需要完善的部分。',
    methodReminder: '先保留原来答对的内容，再只修改反馈指出的部分。',
  },
};

export function presentLearningFeedbackRevision(
  evaluation: Pick<
    RevisionEvaluation,
    'outcome' | 'resolvedIssueCodes' | 'remainingIssueCodes' | 'newIssueCodes'
  >,
): LearningFeedbackRevisionPresentation {
  const resolved = issuePresentation(evaluation.resolvedIssueCodes[0]);
  const remainingCode = evaluation.newIssueCodes[0] || evaluation.remainingIssueCodes[0];
  const remaining = remainingCode ? issuePresentation(remainingCode) : undefined;
  const method = remaining || resolved;

  return {
    eyebrow: '本题修订完成',
    title: outcomeTitle(evaluation.outcome),
    summary: outcomeSummary(evaluation.outcome, resolved),
    remainingFocus: remaining?.remainingFocus,
    methodReminder: method.methodReminder,
  };
}

function outcomeTitle(outcome: RevisionOutcome): string {
  if (outcome === 'improved') return '修改后，回答更完整了';
  if (outcome === 'partially_improved') return '这次修改有进步';
  if (outcome === 'regressed') return '修改时要保留原来答对的内容';
  return '还可以再补充一步';
}

function outcomeSummary(outcome: RevisionOutcome, issue: IssuePresentation): string {
  if (outcome === 'improved') return issue.resolvedSummary;
  if (outcome === 'partially_improved') return `${issue.resolvedSummary.replace(/[。]$/, '')}，还有一部分需要继续完善。`;
  if (outcome === 'regressed') return '这次修改影响了原来答对的内容，可以先保留正确部分，再完善需要修改的地方。';
  return '这次修改还没有补上题目需要的关键内容，可以再对照反馈想一想。';
}

function issuePresentation(issueCode?: string): IssuePresentation {
  return issueCode ? ISSUE_PRESENTATIONS[issueCode] || DEFAULT_ISSUE_PRESENTATION : DEFAULT_ISSUE_PRESENTATION;
}
