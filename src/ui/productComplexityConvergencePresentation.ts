import { nextQuestionLabel } from '../ai/agents/productComplexityConvergenceSurfaceProjectionAgent.ts';

export function formatStudentNextQuestionAction(current?: number, total?: number, fallback = '进入下一题'): string {
  return nextQuestionLabel(current, total) || fallback;
}

export function studentConditionalTaskTitle(state: { isTargetedMicroTraining?: boolean }): string | undefined {
  return state.isTargetedMicroTraining ? '针对练习' : undefined;
}

export function studentEntryStatusLabel(status?: string, title?: string): string {
  if (status === 'review_required' && title === '本轮学习已经完成') return '下一项练习待检查';
  const labels: Record<string, string> = {
    review_required: '结果未采用', blocked: '暂时无法继续', recovering_submission: '正在恢复',
    continue_round: '可以继续', delayed_retest_available: '可以继续', feedback_available: '反馈可查看',
    start_new_round: '可以开始', session_ended: '本次学习已结束', no_task: '暂无任务',
  };
  return labels[status || ''] || '学习状态';
}

export function ordinaryRuntimeNotice(notice: any): { message: string; recoveryMessage?: string } | null {
  if (!notice) return null;
  return {
    message: String(notice.message || (notice.type === 'error' ? '本次操作没有完成，请重新尝试。' : '操作已完成。')),
    recoveryMessage: notice.type === 'error' && notice.recoveryMessage
      ? String(notice.recoveryMessage) : undefined,
  };
}
