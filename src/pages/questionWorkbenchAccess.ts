export type QuestionWorkbenchAccessMode =
  | 'unified_edit'
  | 'task_detail'
  | 'legacy_adapter';

export interface QuestionWorkbenchRouteContext {
  mode?: string | null;
  planId?: string | null;
  materialVersionId?: string | null;
  draftId?: string | null;
}

export interface QuestionWorkbenchAccess {
  mode: QuestionWorkbenchAccessMode;
  writable: boolean;
  requiresWorkspaceLoad: boolean;
  reason: 'valid_plan_review' | 'valid_task_detail' | 'missing_task_context';
}

export function resolveQuestionWorkbenchAccess(
  route: QuestionWorkbenchRouteContext,
): QuestionWorkbenchAccess {
  const hasTaskContext = Boolean(route.planId && route.materialVersionId);

  if (route.mode === 'plan-review' && hasTaskContext) {
    return {
      mode: 'unified_edit',
      writable: true,
      requiresWorkspaceLoad: true,
      reason: 'valid_plan_review',
    };
  }

  if (route.mode === 'task-detail' && hasTaskContext) {
    return {
      mode: 'task_detail',
      writable: false,
      requiresWorkspaceLoad: true,
      reason: 'valid_task_detail',
    };
  }

  return {
    mode: 'legacy_adapter',
    writable: false,
    requiresWorkspaceLoad: false,
    reason: 'missing_task_context',
  };
}
