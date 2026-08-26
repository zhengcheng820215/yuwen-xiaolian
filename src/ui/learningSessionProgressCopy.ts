export function formatNextTaskAction(nextTaskNumber: number, totalTaskCount: number): string {
  return `进入第 ${nextTaskNumber} 题（共 ${totalTaskCount} 题）`;
}

export function formatNextTaskContinuation(nextTaskNumber: number, totalTaskCount: number): string {
  return `本题结果已经保存，接下来进入第 ${nextTaskNumber} 题（共 ${totalTaskCount} 题）。`;
}

type FeedbackExitState = {
  canAdvance?: boolean;
  sessionComplete?: boolean;
  revision?: { status?: string };
};

const ACTIONABLE_REVISION_STATUSES = new Set([
  'offered',
  'draft',
  'submitted',
  'evaluating',
  'evaluation_pending_retry',
]);

/**
 * A completed result with no executable continuation must be settled before
 * returning to the unified entry. Otherwise the active Activity Context is
 * projected as resumable and immediately opens the same terminal feedback.
 */
export function shouldSettleTerminalLearningSessionOnExit(
  state: FeedbackExitState | null | undefined,
): boolean {
  return Boolean(
    state &&
    !state.canAdvance &&
    !state.sessionComplete &&
    !ACTIONABLE_REVISION_STATUSES.has(state.revision?.status || ''),
  );
}
