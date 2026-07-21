export const STUDENT_REVIEW_REQUIRED_TITLE = '本次结果暂不采用';

export const STUDENT_REVIEW_REQUIRED_MESSAGE =
  '系统暂时无法可靠判断这次回答，因此不会用它更新你的学习记录。你不需要重复提交，可以先结束本次学习。';

export const STUDENT_REVIEW_REQUIRED_ACTION_TEXT = '结束本次学习';

export type StudentRuntimePauseReason =
  | 'diagnosis_not_adopted'
  | 'next_task_review'
  | 'resource_unavailable'
  | 'runtime_blocked';

export type StudentRuntimePausePresentation = {
  reason: StudentRuntimePauseReason;
  title: string;
  message: string;
  actionText: string;
};

export function resolveStudentRuntimePausePresentation(input: {
  status: 'review_required' | 'blocked';
  nextAction?: string;
  hasFormalRoundResult: boolean;
}): StudentRuntimePausePresentation {
  if (input.status === 'review_required' && input.hasFormalRoundResult) {
    return {
      reason: 'next_task_review',
      title: '本轮学习已经完成',
      message: '本轮结果已经保存。下一任务暂时无法确定，需要先检查任务安排。你不需要重复提交，可以先结束本次学习，之后从学习入口继续。',
      actionText: '结束本次学习',
    };
  }
  if (input.status === 'review_required') {
    return {
      reason: 'diagnosis_not_adopted',
      title: STUDENT_REVIEW_REQUIRED_TITLE,
      message: STUDENT_REVIEW_REQUIRED_MESSAGE,
      actionText: STUDENT_REVIEW_REQUIRED_ACTION_TEXT,
    };
  }
  if (input.nextAction === 'prepare_resource' && input.hasFormalRoundResult) {
    return {
      reason: 'resource_unavailable',
      title: '下一任务需要补充',
      message: '本轮结果已经保存。当前还没有符合要求的下一任务，需要先补充合适的正式任务；任务补充后可以再次检查。',
      actionText: '返回学习入口',
    };
  }
  return {
    reason: 'runtime_blocked',
    title: '暂时无法继续',
    message: '当前任务暂时无法继续，已有学习记录已经保留。',
    actionText: '返回学习入口',
  };
}
