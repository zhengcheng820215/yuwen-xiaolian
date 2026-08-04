import type { QuestionResourceDraftStatus } from '../ai/schemas/questionResourceAdmission.schema.ts';

export type TaskProductionState =
  | 'draft_empty'
  | 'editing'
  | 'check_required'
  | 'checking'
  | 'revision_required'
  | 'pending_confirmation'
  | 'confirmed'
  | 'publishing'
  | 'publication_failed'
  | 'published';

export type TaskProductionAction =
  | 'edit'
  | 'save'
  | 'run_check'
  | 'open_confirmation'
  | 'confirm'
  | 'return_for_revision'
  | 'publish'
  | 'retry_publication'
  | 'view_formal_resource';

export type TaskProductionTone =
  | 'neutral'
  | 'action'
  | 'warning'
  | 'danger'
  | 'success';

export type TaskProductionPresentation = {
  stateLabel: string;
  tone: TaskProductionTone;
  primaryActionLabel: string | null;
  busy: boolean;
};

export type TaskProductionCardActionKind =
  | 'focus_issue'
  | 'save_plan'
  | 'open_repair'
  | 'run_check'
  | 'open_confirmation'
  | 'confirm'
  | 'publish'
  | 'retry_publication'
  | 'view_formal_resource';

export type TaskProductionCardAction = {
  kind: TaskProductionCardActionKind | null;
  label: '继续修改' | '发布任务' | '查看正式资源' | null;
  busyLabel: string | null;
};

export type TaskProductionCardPresentation = {
  stateLabel: string;
  tone: TaskProductionTone;
  primaryAction: TaskProductionCardAction;
  auxiliaryActions: TaskProductionCardAction[];
};

export type TrainingTaskQuestionBinding = {
  trainingTaskId: string;
  questionLineageId: string;
  activeDraftId?: string;
  activeRevisionId?: string;
  confirmedRevisionId?: string;
  latestFormalVersionId?: string;
};

export type TaskProductionDraftSnapshot = {
  draftId: string;
  resourceId?: string;
  revision: number;
  status: QuestionResourceDraftStatus;
  isDirty?: boolean;
  assessmentStatus?: 'missing' | 'current' | 'running' | 'stale' | 'failed';
};

export type TaskValidationSnapshot = {
  validatedDraftRevision: number;
  passed: boolean;
};

export type TaskQualityCheckState = 'missing' | 'incomplete' | 'complete';

export type TaskProductionPublicationSnapshot = {
  status: 'none' | 'publishing' | 'failed' | 'published';
  sourceDraftId?: string;
  formalVersionId?: string;
};

export type TaskProductionInput = {
  trainingTaskId: string;
  questionLineageId?: string;
  draft?: TaskProductionDraftSnapshot;
  publication?: TaskProductionPublicationSnapshot;
};

export type TaskProductionView = {
  binding: TrainingTaskQuestionBinding;
  state: TaskProductionState;
  availableActions: TaskProductionAction[];
  primaryAction: TaskProductionAction | null;
  message: string;
  hasPublishedVersion: boolean;
  presentation: TaskProductionPresentation;
};

export type TaskGroupAggregateState =
  | 'empty'
  | 'in_progress'
  | 'ready'
  | 'partial'
  | 'published';

export type TaskProductionSummary = {
  total: number;
  actionRequired: number;
  pendingConfirmation: number;
  confirmedAwaitingPublication: number;
  published: number;
  aggregateState: TaskGroupAggregateState;
};

export type TaskPublicationEligibilityReason =
  | 'ready'
  | 'retryable_failure'
  | 'already_published'
  | 'publishing'
  | 'not_confirmed'
  | 'missing_draft';

export type TaskPublicationEligibility = {
  trainingTaskId: string;
  eligible: boolean;
  action: 'publish' | 'retry_publication' | null;
  reason: TaskPublicationEligibilityReason;
  message: string;
};

const STATE_PRESENTATIONS: Record<TaskProductionState, Omit<TaskProductionPresentation, 'primaryActionLabel'>> = {
  draft_empty: { stateLabel: '未生成题目', tone: 'neutral', busy: false },
  editing: { stateLabel: '编辑中', tone: 'action', busy: false },
  check_required: { stateLabel: '待检查', tone: 'warning', busy: false },
  checking: { stateLabel: '检查中', tone: 'action', busy: true },
  revision_required: { stateLabel: '需要修改', tone: 'warning', busy: false },
  pending_confirmation: { stateLabel: '待最终确认', tone: 'warning', busy: false },
  confirmed: { stateLabel: '已确认，待发布', tone: 'action', busy: false },
  publishing: { stateLabel: '正在发布', tone: 'action', busy: true },
  publication_failed: { stateLabel: '发布未完成', tone: 'danger', busy: false },
  published: { stateLabel: '已发布', tone: 'success', busy: false },
};

const ACTION_LABELS: Record<TaskProductionAction, string> = {
  edit: '继续修改',
  save: '保存任务',
  run_check: '检查题目',
  open_confirmation: '进入最终确认',
  confirm: '确认通过',
  return_for_revision: '退回修改',
  publish: '发布正式题目',
  retry_publication: '重试发布',
  view_formal_resource: '查看正式资源',
};

export function getTaskProductionActionLabel(action: TaskProductionAction): string {
  return ACTION_LABELS[action];
}

export function getTaskProductionPresentation(
  state: TaskProductionState,
  primaryAction: TaskProductionAction | null,
): TaskProductionPresentation {
  return {
    ...STATE_PRESENTATIONS[state],
    primaryActionLabel: primaryAction
      ? getTaskProductionPrimaryActionLabel(state, primaryAction)
      : null,
  };
}

/**
 * Maps the domain action to the single orchestration entry exposed by a task card.
 * The card keeps P0's compact CTA while the current stage remains observable.
 */
export function resolveTaskProductionCardAction(
  productionView: TaskProductionView,
  options: { hasIssues?: boolean } = {},
): TaskProductionCardAction {
  const action = productionView.primaryAction;
  if (!action) return { kind: null, label: null, busyLabel: null };

  if (action === 'view_formal_resource') {
    return {
      kind: 'view_formal_resource',
      label: '查看正式资源',
      busyLabel: null,
    };
  }

  if (action === 'edit') {
    if (productionView.state === 'draft_empty') {
      return {
        kind: 'open_repair',
        label: '发布任务',
        busyLabel: '正在创建题目草稿…',
      };
    }
    return {
      kind: options.hasIssues ? 'focus_issue' : 'open_repair',
      label: '继续修改',
      busyLabel: null,
    };
  }

  const orchestrationActions: Record<
    Exclude<TaskProductionAction, 'edit' | 'return_for_revision' | 'view_formal_resource'>,
    Pick<TaskProductionCardAction, 'kind' | 'busyLabel'>
  > = {
    save: { kind: 'save_plan', busyLabel: '正在保存任务修改…' },
    run_check: { kind: 'run_check', busyLabel: '正在检查题目…' },
    open_confirmation: { kind: 'open_confirmation', busyLabel: '正在提交最终确认…' },
    confirm: { kind: 'confirm', busyLabel: '正在完成最终确认…' },
    publish: { kind: 'publish', busyLabel: '正在发布正式题目…' },
    retry_publication: { kind: 'retry_publication', busyLabel: '正在重试发布…' },
  };

  if (action === 'return_for_revision') {
    return {
      kind: 'open_repair',
      label: '继续修改',
      busyLabel: null,
    };
  }

  return {
    ...orchestrationActions[action],
    label: '发布任务',
  };
}

/**
 * Single read model for the task-card header. It keeps the lifecycle state,
 * recommended next action and historical formal-resource entry consistent.
 */
export function resolveTaskProductionCardPresentation(
  productionView: TaskProductionView,
  options: { hasIssues?: boolean } = {},
): TaskProductionCardPresentation {
  const primaryAction = resolveTaskProductionCardAction(productionView, options);
  const canViewHistoricalFormalResource = productionView.hasPublishedVersion
    && primaryAction.kind !== 'view_formal_resource'
    && productionView.availableActions.includes('view_formal_resource');

  return {
    stateLabel: productionView.presentation.stateLabel,
    tone: productionView.presentation.tone,
    primaryAction,
    auxiliaryActions: canViewHistoricalFormalResource
      ? [{
          kind: 'view_formal_resource',
          label: '查看正式资源',
          busyLabel: null,
        }]
      : [],
  };
}

export function resolveTaskAssessmentStatus(
  draftRevision: number | undefined,
  validation?: TaskValidationSnapshot | null,
  qualityCheckState: TaskQualityCheckState = 'missing',
): TaskProductionDraftSnapshot['assessmentStatus'] {
  if (draftRevision === undefined || !validation) return 'missing';
  if (validation.validatedDraftRevision !== draftRevision) return 'stale';
  if (!validation.passed) return 'failed';
  if (qualityCheckState === 'incomplete') return 'failed';
  return qualityCheckState === 'complete' ? 'current' : 'missing';
}

function getTaskProductionPrimaryActionLabel(
  state: TaskProductionState,
  action: TaskProductionAction,
): string {
  if (state === 'draft_empty' && action === 'edit') return '创建题目';
  return getTaskProductionActionLabel(action);
}

export function resolveTaskProductionState(input: TaskProductionInput): TaskProductionView {
  const publication = input.publication || { status: 'none' as const };
  const draft = input.draft;
  const hasPublishedVersion = publication.status === 'published';
  const publicationMatchesDraft = Boolean(
    draft &&
    publication.sourceDraftId &&
    publication.sourceDraftId === draft.draftId,
  );
  const binding = resolveTrainingTaskQuestionBinding(input);

  if (publication.status === 'publishing' && (!draft || publicationMatchesDraft)) {
    return view(binding, 'publishing', [], null, '正在发布题目。', hasPublishedVersion);
  }
  if (publication.status === 'failed' && (!draft || publicationMatchesDraft)) {
    return view(
      binding,
      'publication_failed',
      ['retry_publication'],
      'retry_publication',
      '发布未完成，可从失败阶段继续。',
      hasPublishedVersion,
    );
  }
  if (hasPublishedVersion && (!draft || publicationMatchesDraft)) {
    return view(
      binding,
      'published',
      ['view_formal_resource'],
      'view_formal_resource',
      '题目已发布。',
      true,
    );
  }
  if (!draft) {
    return view(binding, 'draft_empty', ['edit'], 'edit', '尚未生成题目草稿。', hasPublishedVersion);
  }

  const publishedAuxiliaryAction: TaskProductionAction[] = hasPublishedVersion
    ? ['view_formal_resource']
    : [];
  if (draft.isDirty) {
    return view(
      binding,
      'editing',
      ['edit', 'save', ...publishedAuxiliaryAction],
      'save',
      '当前修改尚未保存。',
      hasPublishedVersion,
    );
  }
  if (draft.assessmentStatus === 'running') {
    return view(
      binding,
      'checking',
      publishedAuxiliaryAction,
      null,
      '正在检查题目。',
      hasPublishedVersion,
    );
  }
  if (['validation_failed', 'revision_required', 'rejected'].includes(draft.status)) {
    return view(
      binding,
      'revision_required',
      ['edit', 'run_check', ...publishedAuxiliaryAction],
      'edit',
      '题目需要修改并重新检查。',
      hasPublishedVersion,
    );
  }
  if (draft.status === 'pending_review') {
    return view(
      binding,
      'pending_confirmation',
      ['open_confirmation', 'confirm', 'return_for_revision', ...publishedAuxiliaryAction],
      'confirm',
      '题目等待最终确认。',
      hasPublishedVersion,
    );
  }
  if (draft.status === 'reviewed') {
    return view(
      binding,
      'confirmed',
      ['publish', 'return_for_revision', ...publishedAuxiliaryAction],
      'publish',
      '题目已确认，等待发布。',
      hasPublishedVersion,
    );
  }
  if (draft.status === 'drafted' && draft.assessmentStatus === 'current') {
    return view(
      binding,
      'pending_confirmation',
      ['open_confirmation', ...publishedAuxiliaryAction],
      'open_confirmation',
      '题目检查已完成，等待最终确认。',
      hasPublishedVersion,
    );
  }
  return view(
    binding,
    'check_required',
    ['edit', 'run_check', ...publishedAuxiliaryAction],
    'run_check',
    '题目需要完成检查。',
    hasPublishedVersion,
  );
}

export function resolveTaskGroupSummary(
  views: TaskProductionView[],
): TaskProductionSummary {
  const summary = views.reduce<Omit<TaskProductionSummary, 'aggregateState'>>((result, item) => {
    result.total += 1;
    if (item.state === 'published') {
      result.published += 1;
    } else if (item.state === 'pending_confirmation') {
      result.pendingConfirmation += 1;
    } else if (['confirmed', 'publishing', 'publication_failed'].includes(item.state)) {
      result.confirmedAwaitingPublication += 1;
    } else {
      result.actionRequired += 1;
    }
    return result;
  }, {
    total: 0,
    actionRequired: 0,
    pendingConfirmation: 0,
    confirmedAwaitingPublication: 0,
    published: 0,
  });
  return {
    ...summary,
    aggregateState: resolveTaskGroupAggregateState(views, summary),
  };
}

export const summarizeTaskProductionViews = resolveTaskGroupSummary;

export function resolveTaskPublicationEligibility(
  productionView: TaskProductionView,
): TaskPublicationEligibility {
  const base = {
    trainingTaskId: productionView.binding.trainingTaskId,
  };
  if (productionView.state === 'confirmed') {
    return {
      ...base,
      eligible: true,
      action: 'publish',
      reason: 'ready',
      message: '题目已完成最终确认，可以发布。',
    };
  }
  if (productionView.state === 'publication_failed') {
    return {
      ...base,
      eligible: true,
      action: 'retry_publication',
      reason: 'retryable_failure',
      message: '题目发布未完成，可以从失败阶段继续。',
    };
  }
  if (productionView.state === 'published') {
    return {
      ...base,
      eligible: false,
      action: null,
      reason: 'already_published',
      message: '题目已经发布，无需重复发布。',
    };
  }
  if (productionView.state === 'publishing') {
    return {
      ...base,
      eligible: false,
      action: null,
      reason: 'publishing',
      message: '题目正在发布，请等待当前操作完成。',
    };
  }
  if (productionView.state === 'draft_empty') {
    return {
      ...base,
      eligible: false,
      action: null,
      reason: 'missing_draft',
      message: '题目草稿尚未创建。',
    };
  }
  return {
    ...base,
    eligible: false,
    action: null,
    reason: 'not_confirmed',
    message: '题目尚未完成最终确认。',
  };
}

function resolveTaskGroupAggregateState(
  views: TaskProductionView[],
  summary: Omit<TaskProductionSummary, 'aggregateState'>,
): TaskGroupAggregateState {
  if (summary.total === 0) return 'empty';
  if (summary.published === summary.total) return 'published';
  if (summary.published > 0) return 'partial';
  if (views.every((item) => item.state === 'confirmed')) return 'ready';
  return 'in_progress';
}

function resolveTrainingTaskQuestionBinding(
  input: TaskProductionInput,
): TrainingTaskQuestionBinding {
  const draft = input.draft;
  const publication = input.publication;
  return {
    trainingTaskId: input.trainingTaskId,
    questionLineageId:
      input.questionLineageId || draft?.resourceId || `question-lineage:${input.trainingTaskId}`,
    activeDraftId: draft?.draftId,
    activeRevisionId: draft ? `${draft.draftId}:r${draft.revision}` : undefined,
    confirmedRevisionId: draft?.status === 'reviewed'
      ? `${draft.draftId}:r${draft.revision}`
      : undefined,
    latestFormalVersionId: publication?.formalVersionId,
  };
}

function view(
  binding: TrainingTaskQuestionBinding,
  state: TaskProductionState,
  availableActions: TaskProductionAction[],
  primaryAction: TaskProductionAction | null,
  message: string,
  hasPublishedVersion: boolean,
): TaskProductionView {
  return {
    binding,
    state,
    availableActions: [...new Set(availableActions)],
    primaryAction,
    message,
    hasPublishedVersion,
    presentation: getTaskProductionPresentation(state, primaryAction),
  };
}
