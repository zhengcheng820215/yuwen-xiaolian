import type { LearningRoundStatus } from '../schemas/learningRound.schema.ts';
import type {
  StudentRoundNextAction,
  StudentRoundSummary,
  StudentRoundSummaryInput,
  StudentRoundSummaryStatus,
} from '../schemas/studentRoundSummary.schema.ts';
import type { StudentLearningFeedbackStatus } from '../schemas/studentLearningFeedback.schema.ts';

export function buildStudentRoundSummary(input: StudentRoundSummaryInput): StudentRoundSummary {
  const identityIssues = validateIdentity(input);
  const roundStatus = input.exitState?.abandoned
    ? 'abandoned'
    : input.learningRoundResult.status;
  const feedbackStatus = input.studentLearningFeedback.resultStatus;
  const statusIssues = detectStatusConflict(roundStatus, feedbackStatus);
  const issues = [
    ...identityIssues,
    ...statusIssues,
    ...input.learningRoundResult.issues,
    ...(input.studentLearningFeedback.debugState?.issues || []),
    ...(input.exitState?.reason ? [`exitState.reason=${input.exitState.reason}`] : []),
  ];
  const status = identityIssues.length > 0
    ? 'blocked'
    : statusIssues.length > 0
      ? conservativeStatus(roundStatus, feedbackStatus)
      : roundStatus;
  const nextAction = mapNextAction(status, input.learningRoundResult.nextStep);

  return {
    learningRoundId: input.learningRoundResult.learningRoundId,
    studentId: input.learningRoundResult.studentId,
    status,
    title: buildTitle(status),
    completedTaskTitle: input.studentLearningEntryState.taskTitle,
    roundFocus: input.studentLearningFeedback.studentRoundFocus || input.studentLearningEntryState.studentRoundFocus,
    completionSummary: buildCompletionSummary(status),
    studentReadableResult: buildStudentReadableResult(status, input.studentLearningFeedback.summary),
    positiveTakeaway: identityIssues.length > 0 ? [] : buildPositiveTakeaway(input),
    continueAttention: buildContinueAttention(status, input, issues),
    nextAction,
    nextActionText: buildNextActionText(nextAction, input.learningRoundResult.nextStepReason),
    canContinue: nextAction === 'continue_learning',
    canRetry: nextAction === 'retry_answer' || nextAction === 'supplement_answer',
    canFinish: ['completed', 'review_required', 'blocked', 'abandoned'].includes(status),
    debugState: {
      roundStatus,
      feedbackStatus,
      nextStep: input.learningRoundResult.nextStep,
      issues,
    },
  };
}

function validateIdentity(input: StudentRoundSummaryInput): string[] {
  const issues: string[] = [];
  const roundId = input.learningRoundResult.learningRoundId;
  const feedbackRoundId = input.studentLearningFeedback.learningRoundId;
  const entryRoundId = input.studentLearningEntryState.learningRoundId;
  const studentId = input.learningRoundResult.studentId;
  const feedbackStudentId = input.studentLearningFeedback.studentId;
  const entryStudentId = input.studentLearningEntryState.studentId;

  if (roundId !== feedbackRoundId || roundId !== entryRoundId) {
    issues.push('identity_mismatch: learningRoundId is inconsistent.');
  }
  if (studentId !== feedbackStudentId || studentId !== entryStudentId) {
    issues.push('identity_mismatch: studentId is inconsistent.');
  }

  return issues;
}

function detectStatusConflict(
  roundStatus: StudentRoundSummaryStatus,
  feedbackStatus: StudentLearningFeedbackStatus,
): string[] {
  if (roundStatus === 'abandoned') return [];
  if (roundStatus === feedbackStatus) return [];
  if (roundStatus === 'completed' && feedbackStatus !== 'completed') {
    return ['status_conflict: completed round has non-completed feedback.'];
  }
  if (roundStatus !== 'completed' && feedbackStatus === 'completed') {
    return ['status_conflict: non-completed round has completed feedback.'];
  }

  return [];
}

function conservativeStatus(
  roundStatus: StudentRoundSummaryStatus,
  feedbackStatus: StudentLearningFeedbackStatus,
): StudentRoundSummaryStatus {
  if (roundStatus === 'blocked' || feedbackStatus === 'blocked') return 'blocked';
  if (roundStatus === 'review_required' || feedbackStatus === 'review_required') return 'review_required';
  if (roundStatus === 'retry_required' || feedbackStatus === 'retry_required') return 'retry_required';
  if (roundStatus === 'abandoned') return 'abandoned';

  return 'review_required';
}

function buildTitle(status: StudentRoundSummaryStatus): string {
  if (status === 'completed') return '本轮学习已完成';
  if (status === 'retry_required') return '还需要补充回答';
  if (status === 'review_required') return '本轮结果需要确认';
  if (status === 'abandoned') return '本轮已经停止';
  return '本轮暂时无法完成';
}

function buildCompletionSummary(status: StudentRoundSummaryStatus): string {
  if (status === 'completed') return '你已经完成本轮学习任务，答案已被记录和分析。';
  if (status === 'retry_required') return '本轮还没有形成完整结果，需要先补充回答。';
  if (status === 'review_required') return '本轮回答已经记录，但结果需要进一步确认。';
  if (status === 'abandoned') return '你已经中断本轮任务，这次不会形成正式学习结果。';
  return '本轮暂时无法继续，请稍后重试或重新开始。';
}

function buildStudentReadableResult(
  status: StudentRoundSummaryStatus,
  feedbackSummary: string,
): string {
  if (status === 'completed') return feedbackSummary;
  if (status === 'retry_required') return '请先补充你的判断和理由，再继续完成本轮。';
  if (status === 'review_required') return '这次回答暂时不会直接改变你的能力状态。';
  if (status === 'abandoned') return '本轮没有继续分析，也不会形成正式反馈。';
  return '当前系统无法稳定完成本轮，请根据提示稍后重试。';
}

function buildPositiveTakeaway(input: StudentRoundSummaryInput): string[] {
  return uniqueStrings(input.studentLearningFeedback.whatYouDidWell);
}

function buildContinueAttention(
  status: StudentRoundSummaryStatus,
  input: StudentRoundSummaryInput,
  issues: string[],
): string[] {
  const attention = [...input.studentLearningFeedback.whatNeedsAttention];

  if (status === 'retry_required' && attention.length === 0) {
    attention.push('请补充自己的判断，并结合文本说明理由。');
  }
  if (status === 'review_required' && attention.length === 0) {
    attention.push('本轮结果需要确认，暂时不要把这次反馈当作最终结论。');
  }
  if (status === 'blocked') {
    attention.push('本轮流程暂时无法继续，请稍后重试。');
  }
  if (status === 'abandoned') {
    attention.push('本轮已经停止，不会形成正式学习结果。');
  }

  const readableIssues = issues
    .filter((issue) => issue.includes('status_conflict') || issue.includes('identity_mismatch'))
    .map((issue) => issue.includes('identity_mismatch')
      ? '本轮数据不一致，系统不会展示混合结果。'
      : '本轮状态需要确认，系统不会直接给出完成结论。');

  return uniqueStrings([...attention, ...readableIssues]);
}

function mapNextAction(
  status: StudentRoundSummaryStatus,
  roundNextStep: string,
): StudentRoundNextAction {
  if (status === 'retry_required') return roundNextStep === 'supplement_response' ? 'supplement_answer' : 'retry_answer';
  if (status === 'review_required') return 'wait_for_review';
  if (status === 'blocked') return 'restart_later';
  if (status === 'abandoned') return 'finish_round';
  if (roundNextStep === 'continue') return 'continue_learning';
  if (roundNextStep === 'supplement_response') return 'supplement_answer';
  if (roundNextStep === 'regenerate_task') return 'retry_answer';
  if (roundNextStep === 'human_review') return 'wait_for_review';

  return 'finish_round';
}

function buildNextActionText(nextAction: StudentRoundNextAction, fallbackReason: string): string {
  if (nextAction === 'continue_learning') return '可以继续下一步学习。';
  if (nextAction === 'supplement_answer') return '请补充回答后再提交。';
  if (nextAction === 'retry_answer') return '可以重新尝试本轮任务。';
  if (nextAction === 'wait_for_review') return '请等待确认，或稍后再继续。';
  if (nextAction === 'restart_later') return '可以稍后重新开始。';
  return fallbackReason || '可以结束本轮。';
}

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}
