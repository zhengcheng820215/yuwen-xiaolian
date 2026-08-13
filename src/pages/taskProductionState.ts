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
  | 'generate_candidate'
  | 'adopt_candidate'
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
  label:
    | '生成题目'
    | '重新生成题目'
    | '采用并发布'
    | '确认并发布'
    | '处理问题'
    | '保存任务'
    | '检查题目'
    | '查看题目方案'
    | '继续发布'
    | '重试发布'
    | '查看正式资源'
    | null;
  busyLabel: string | null;
};

export type InitialQuestionCandidateGapPresentation = {
  stateLabel: '题目待采用' | '未生成题目';
  actionLabel: '重新生成题目' | '生成题目';
  busyLabel: '正在重新生成题目…' | '正在生成题目…';
  emptyMessage: string;
  hasQuestionContent: boolean;
  missingFields: string[];
};

export function resolveInitialQuestionCandidateGapPresentation({
  questionStem,
  missingFields = [],
}: {
  questionStem?: string | null;
  missingFields?: string[];
}): InitialQuestionCandidateGapPresentation {
  const hasQuestionContent = Boolean(questionStem?.trim());

  if (hasQuestionContent) {
    return {
      stateLabel: '题目待采用',
      actionLabel: '重新生成题目',
      busyLabel: '正在重新生成题目…',
      emptyMessage: '正在恢复当前题目方案，请稍候。',
      hasQuestionContent: true,
      missingFields: [...missingFields],
    };
  }

  return {
    stateLabel: '未生成题目',
    actionLabel: '生成题目',
    busyLabel: '正在生成题目…',
    emptyMessage: '当前任务还没有题目。',
    hasQuestionContent: false,
    missingFields: [...missingFields],
  };
}

export function shouldShowInitialQuestionCandidateGap({
  isPublishedTask,
  hasSelectedCandidate,
  isLoadingCandidates,
  readyCandidateCount,
  initialCandidateStatus,
  hasExistingDraft,
  hasQuestionContent,
  productionState,
}: {
  isPublishedTask: boolean;
  hasSelectedCandidate: boolean;
  isLoadingCandidates: boolean;
  readyCandidateCount: number;
  initialCandidateStatus?: string | null;
  hasExistingDraft: boolean;
  hasQuestionContent: boolean;
  productionState?: TaskProductionState | null;
}): boolean {
  if (
    isPublishedTask
    || hasSelectedCandidate
    || isLoadingCandidates
    || readyCandidateCount > 0
  ) {
    return false;
  }

  if (hasQuestionContent) return false;

  return initialCandidateStatus === 'question_generation_required'
    || !hasExistingDraft
    || productionState === 'draft_empty';
}

export type TaskProductionCardPresentation = {
  visibleStatus: TaskProductionVisibleStatus;
  visibleStatusLabel: '待处理' | '处理中' | '已发布';
  visibleStatusTone: 'warning' | 'action' | 'success';
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

export type TaskGroupPublicationSummary = {
  actionRequired: number;
  awaitingAdoption: number;
  pendingPublication: number;
  published: number;
};

export type TaskProductionVisibleStatus = 'pending' | 'processing' | 'published';

export type TaskGroupTopLevelSummary = {
  pendingPublication: number;
  published: number;
};

export type TaskProductionVisibleSummaryItem = {
  productionView: TaskProductionView;
  candidateReady?: boolean;
  actionRequired?: boolean;
};

export function resolveNextPendingTaskId(
  items: Array<{ taskId: string; published: boolean }>,
  currentTaskId: string,
): string | null {
  const currentIndex = items.findIndex((item) => item.taskId === currentTaskId);
  const orderedItems = currentIndex >= 0
    ? [...items.slice(currentIndex + 1), ...items.slice(0, currentIndex)]
    : items;
  return orderedItems.find((item) => (
    item.taskId !== currentTaskId && !item.published
  ))?.taskId || null;
}

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
  editing: { stateLabel: '需要处理', tone: 'warning', busy: false },
  check_required: { stateLabel: '需要处理', tone: 'warning', busy: false },
  checking: { stateLabel: '处理中', tone: 'action', busy: true },
  revision_required: { stateLabel: '需要处理', tone: 'warning', busy: false },
  pending_confirmation: { stateLabel: '需要处理', tone: 'warning', busy: false },
  confirmed: { stateLabel: '处理中', tone: 'action', busy: false },
  publishing: { stateLabel: '处理中', tone: 'action', busy: true },
  publication_failed: { stateLabel: '发布未完成', tone: 'danger', busy: false },
  published: { stateLabel: '已发布', tone: 'success', busy: false },
};

const ACTION_LABELS: Record<TaskProductionAction, string> = {
  edit: '继续修改',
  save: '保存任务',
  run_check: '检查题目',
  open_confirmation: '查看题目方案',
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
        kind: 'generate_candidate',
        label: '生成题目',
        busyLabel: '正在生成题目…',
      };
    }
    return {
      kind: 'generate_candidate',
      label: '重新生成题目',
      busyLabel: '正在重新生成题目…',
    };
  }

  const orchestrationActions: Record<
    Exclude<TaskProductionAction, 'edit' | 'return_for_revision' | 'view_formal_resource'>,
    Pick<TaskProductionCardAction, 'kind' | 'busyLabel'>
  > = {
    save: { kind: 'save_plan', busyLabel: '正在保存任务修改…' },
    run_check: { kind: 'run_check', busyLabel: '正在检查题目…' },
    open_confirmation: { kind: 'open_confirmation', busyLabel: null },
    confirm: { kind: 'confirm', busyLabel: '正在完成最终确认…' },
    publish: { kind: 'publish', busyLabel: '正在发布正式题目…' },
    retry_publication: { kind: 'retry_publication', busyLabel: '正在重试发布…' },
  };

  if (action === 'return_for_revision') {
    return {
      kind: 'generate_candidate',
      label: '重新生成题目',
      busyLabel: '正在重新生成题目…',
    };
  }

  if (action === 'retry_publication') {
    return {
      kind: 'retry_publication',
      label: '重试发布',
      busyLabel: '正在重试发布…',
    };
  }

  if (action === 'publish') {
    return {
      kind: 'publish',
      label: '继续发布',
      busyLabel: '正在发布正式题目…',
    };
  }

  return {
    ...orchestrationActions[action],
    label: action === 'open_confirmation'
      ? '继续发布'
      : action === 'confirm'
        ? '继续发布'
      : action === 'save'
          ? '继续发布'
          : '继续发布',
  };
}

/**
 * Prevents the legacy empty-draft action from contradicting question content
 * already visible on the task card while its initial Candidate is restored.
 */
export function resolveCandidateAwareTaskCardFallback({
  baseAction,
  hasQuestionContent,
  isLoadingCandidates,
  isPublishedTask,
}: {
  baseAction: TaskProductionCardAction;
  hasQuestionContent: boolean;
  isLoadingCandidates: boolean;
  isPublishedTask: boolean;
}): TaskProductionCardAction {
  if (
    baseAction.kind !== 'generate_candidate'
    || !hasQuestionContent
    || isPublishedTask
  ) {
    return baseAction;
  }

  if (isLoadingCandidates) {
    return { kind: null, label: null, busyLabel: null };
  }

  return {
    kind: 'adopt_candidate',
    label: '采用并发布',
    busyLabel: '正在采用并发布题目…',
  };
}

/**
 * Single read model for the task-card header. It keeps the lifecycle state,
 * recommended next action and historical formal-resource entry consistent.
 */
export function resolveTaskProductionCardPresentation(
  productionView: TaskProductionView,
  options: { hasIssues?: boolean; actionRequired?: boolean } = {},
): TaskProductionCardPresentation {
  const primaryAction = resolveTaskProductionCardAction(productionView, options);
  const visibleStatus = resolveTaskProductionVisibleStatus(
    productionView,
    Boolean(options.actionRequired),
  );
  const canViewHistoricalFormalResource = productionView.hasPublishedVersion
    && primaryAction.kind !== 'view_formal_resource'
    && productionView.availableActions.includes('view_formal_resource');

  return {
    visibleStatus,
    visibleStatusLabel: getTaskProductionVisibleStatusLabel(visibleStatus),
    visibleStatusTone: getTaskProductionVisibleStatusTone(visibleStatus),
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
  if (state === 'draft_empty' && action === 'edit') return '生成题目';
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
  if (hasPublishedVersion) {
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

  if (draft.isDirty) {
    return view(
      binding,
      'editing',
      ['edit', 'save'],
      'save',
      '当前修改尚未保存。',
      hasPublishedVersion,
    );
  }
  if (draft.assessmentStatus === 'running') {
    return view(
      binding,
      'checking',
      [],
      null,
      '正在检查题目。',
      hasPublishedVersion,
    );
  }
  if (['validation_failed', 'revision_required', 'rejected'].includes(draft.status)) {
    return view(
      binding,
      'revision_required',
      ['edit', 'run_check'],
      'edit',
      '题目需要修改并重新检查。',
      hasPublishedVersion,
    );
  }
  if (draft.status === 'pending_review') {
    return view(
      binding,
      'pending_confirmation',
      ['open_confirmation', 'confirm', 'return_for_revision'],
      'confirm',
      '题目等待最终确认。',
      hasPublishedVersion,
    );
  }
  if (draft.status === 'reviewed') {
    return view(
      binding,
      'confirmed',
      ['publish', 'return_for_revision'],
      'publish',
      '题目已确认，等待发布。',
      hasPublishedVersion,
    );
  }
  if (draft.status === 'drafted' && draft.assessmentStatus === 'current') {
    return view(
      binding,
      'pending_confirmation',
      ['open_confirmation'],
      'open_confirmation',
      '题目检查已完成，等待最终确认。',
      hasPublishedVersion,
    );
  }
  return view(
    binding,
    'check_required',
    ['edit', 'run_check'],
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

/**
 * Projects the mutually exclusive production buckets into the compact overview
 * shown above the task cards. Historical formal versions do not count as
 * published when the active revision still requires work.
 */
export function resolveTaskGroupPublicationSummary(
  summary: TaskProductionSummary,
  options: {
    awaitingAdoption?: number;
  } = {},
): TaskGroupPublicationSummary {
  const awaitingAdoption = Math.min(
    summary.actionRequired,
    Math.max(0, Math.floor(options.awaitingAdoption || 0)),
  );
  return {
    actionRequired: summary.actionRequired - awaitingAdoption + summary.pendingConfirmation,
    awaitingAdoption,
    pendingPublication: summary.confirmedAwaitingPublication,
    published: summary.published,
  };
}

/**
 * Projects task-level lifecycle facts into the four mutually exclusive buckets
 * used by the unified workbench. Candidate readiness is a product-visible fact,
 * while detailed check, confirmation and publication states remain internal.
 */
export function resolveTaskProductionVisibleSummary(
  items: TaskProductionVisibleSummaryItem[],
): TaskGroupPublicationSummary {
  return items.reduce<TaskGroupPublicationSummary>((summary, item) => {
    const state = item.productionView.state;
    // Publication is a terminal fact. Stale candidate-panel feedback must not
    // move an already published task back into an actionable bucket.
    if (state === 'published') {
      summary.published += 1;
    } else if (item.actionRequired) {
      summary.actionRequired += 1;
    } else if (state === 'draft_empty' && item.candidateReady) {
      summary.awaitingAdoption += 1;
    } else if ([
      'check_required',
      'checking',
      'pending_confirmation',
      'confirmed',
      'publishing',
    ].includes(state)) {
      summary.pendingPublication += 1;
    } else {
      summary.actionRequired += 1;
    }
    return summary;
  }, {
    actionRequired: 0,
    awaitingAdoption: 0,
    pendingPublication: 0,
    published: 0,
  });
}

/**
 * Keeps lifecycle detail inside each task card while exposing the only two
 * group-level facts a content operator needs: whether a formal resource exists.
 */
export function resolveTaskGroupTopLevelSummary(
  summary: TaskGroupPublicationSummary,
): TaskGroupTopLevelSummary {
  return {
    pendingPublication:
      summary.actionRequired + summary.awaitingAdoption + summary.pendingPublication,
    published: summary.published,
  };
}

export function resolveTaskProductionVisibleStatus(
  productionView: TaskProductionView,
  actionRequired = false,
): TaskProductionVisibleStatus {
  if (productionView.state === 'published') return 'published';
  if (actionRequired) return 'pending';
  if (
    productionView.state === 'checking'
    || productionView.state === 'pending_confirmation'
    || productionView.state === 'confirmed'
    || productionView.state === 'publishing'
    || productionView.state === 'publication_failed'
  ) {
    return 'processing';
  }
  return 'pending';
}

export function getTaskProductionVisibleStatusLabel(
  status: TaskProductionVisibleStatus,
): TaskProductionCardPresentation['visibleStatusLabel'] {
  return ({
    pending: '待处理',
    processing: '处理中',
    published: '已发布',
  })[status];
}

export function getTaskProductionVisibleStatusTone(
  status: TaskProductionVisibleStatus,
): TaskProductionCardPresentation['visibleStatusTone'] {
  return ({
    pending: 'warning',
    processing: 'action',
    published: 'success',
  })[status];
}

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
