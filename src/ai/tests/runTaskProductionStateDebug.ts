import assert from 'node:assert/strict';
import {
  resolveInitialQuestionCandidateGapPresentation,
  resolveNextPendingTaskId,
  resolveCandidateAwareTaskCardFallback,
  shouldShowInitialQuestionCandidateGap,
  resolveTaskAssessmentStatus,
  resolveTaskGroupPublicationSummary,
  resolveTaskGroupTopLevelSummary,
  resolveTaskGroupSummary,
  resolveTaskProductionVisibleSummary,
  resolveTaskProductionCardAction,
  resolveTaskProductionCardPresentation,
  resolveTaskProductionVisibleStatus,
  resolveTaskPublicationEligibility,
  resolveTaskProductionState,
} from '../../pages/taskProductionState.ts';

const incompleteInitialCandidate = resolveInitialQuestionCandidateGapPresentation({
  questionStem: '已有题干',
  missingFields: ['rubric', 'answerAcceptance'],
});
assert.equal(incompleteInitialCandidate.stateLabel, '题目待采用');
assert.equal(incompleteInitialCandidate.actionLabel, '重新生成题目');
assert.equal(incompleteInitialCandidate.busyLabel, '正在重新生成题目…');
assert.match(incompleteInitialCandidate.emptyMessage, /恢复当前题目方案/);
assert.equal(incompleteInitialCandidate.hasQuestionContent, true);
assert.deepEqual(incompleteInitialCandidate.missingFields, ['rubric', 'answerAcceptance']);

const missingInitialCandidate = resolveInitialQuestionCandidateGapPresentation({
  questionStem: ' ',
});
assert.equal(missingInitialCandidate.stateLabel, '未生成题目');
assert.equal(missingInitialCandidate.actionLabel, '生成题目');
assert.equal(missingInitialCandidate.hasQuestionContent, false);

const legacyGenerateAction = {
  kind: 'generate_candidate',
  label: '生成题目',
  busyLabel: '正在生成题目…',
} as const;
assert.deepEqual(resolveCandidateAwareTaskCardFallback({
  baseAction: legacyGenerateAction,
  hasQuestionContent: true,
  isLoadingCandidates: false,
  isPublishedTask: false,
}), {
  kind: 'adopt_candidate',
  label: '采用并发布',
  busyLabel: '正在采用并发布题目…',
});
assert.deepEqual(resolveCandidateAwareTaskCardFallback({
  baseAction: legacyGenerateAction,
  hasQuestionContent: true,
  isLoadingCandidates: true,
  isPublishedTask: false,
}), {
  kind: null,
  label: null,
  busyLabel: null,
});
assert.deepEqual(resolveCandidateAwareTaskCardFallback({
  baseAction: legacyGenerateAction,
  hasQuestionContent: false,
  isLoadingCandidates: false,
  isPublishedTask: false,
}), legacyGenerateAction);

assert.equal(shouldShowInitialQuestionCandidateGap({
  isPublishedTask: false,
  hasSelectedCandidate: false,
  isLoadingCandidates: false,
  readyCandidateCount: 0,
  initialCandidateStatus: 'question_generation_required',
  hasExistingDraft: false,
  hasQuestionContent: false,
  productionState: 'editing',
}), true);
assert.equal(shouldShowInitialQuestionCandidateGap({
  isPublishedTask: false,
  hasSelectedCandidate: false,
  isLoadingCandidates: false,
  readyCandidateCount: 0,
  initialCandidateStatus: 'question_generation_required',
  hasExistingDraft: false,
  hasQuestionContent: true,
  productionState: 'draft_empty',
}), false);
assert.equal(shouldShowInitialQuestionCandidateGap({
  isPublishedTask: false,
  hasSelectedCandidate: false,
  isLoadingCandidates: false,
  readyCandidateCount: 0,
  initialCandidateStatus: null,
  hasExistingDraft: false,
  hasQuestionContent: false,
  productionState: 'revision_required',
}), true);
assert.equal(shouldShowInitialQuestionCandidateGap({
  isPublishedTask: false,
  hasSelectedCandidate: false,
  isLoadingCandidates: false,
  readyCandidateCount: 0,
  initialCandidateStatus: null,
  hasExistingDraft: true,
  hasQuestionContent: false,
  productionState: 'check_required',
}), false);
assert.equal(shouldShowInitialQuestionCandidateGap({
  isPublishedTask: false,
  hasSelectedCandidate: true,
  isLoadingCandidates: false,
  readyCandidateCount: 1,
  initialCandidateStatus: 'candidate_available',
  hasExistingDraft: false,
  hasQuestionContent: true,
  productionState: 'draft_empty',
}), false);
assert.equal(shouldShowInitialQuestionCandidateGap({
  isPublishedTask: true,
  hasSelectedCandidate: false,
  isLoadingCandidates: false,
  readyCandidateCount: 0,
  initialCandidateStatus: 'question_generation_required',
  hasExistingDraft: false,
  hasQuestionContent: false,
  productionState: 'published',
}), false);

assert.equal(resolveTaskAssessmentStatus(undefined, null), 'missing');
assert.equal(resolveTaskAssessmentStatus(3, null), 'missing');
assert.equal(resolveTaskAssessmentStatus(3, {
  validatedDraftRevision: 2,
  passed: true,
}), 'stale');
assert.equal(resolveTaskAssessmentStatus(3, {
  validatedDraftRevision: 3,
  passed: false,
}), 'failed');
assert.equal(resolveTaskAssessmentStatus(3, {
  validatedDraftRevision: 3,
  passed: true,
}), 'missing');
assert.equal(resolveTaskAssessmentStatus(3, {
  validatedDraftRevision: 3,
  passed: true,
}, 'incomplete'), 'failed');
assert.equal(resolveTaskAssessmentStatus(3, {
  validatedDraftRevision: 3,
  passed: true,
}, 'complete'), 'current');

const empty = resolveTaskProductionState({ trainingTaskId: 'task-empty' });
assert.equal(empty.state, 'draft_empty');
assert.equal(empty.binding.questionLineageId, 'question-lineage:task-empty');
assert.equal(empty.presentation.stateLabel, '未生成题目');
assert.equal(empty.presentation.primaryActionLabel, '生成题目');
assert.deepEqual(resolveTaskProductionCardAction(empty), {
  kind: 'generate_candidate',
  label: '生成题目',
  busyLabel: '正在生成题目…',
});
assert.deepEqual(resolveTaskProductionCardPresentation(empty, { hasIssues: true }).primaryAction, {
  kind: 'generate_candidate',
  label: '生成题目',
  busyLabel: '正在生成题目…',
});

const checkRequired = resolveTaskProductionState({
  trainingTaskId: 'task-check',
  draft: draft('draft-check', 'resource-check', 'drafted'),
});
assert.equal(checkRequired.state, 'check_required');
assert.equal(checkRequired.primaryAction, 'run_check');
assert.equal(checkRequired.presentation.primaryActionLabel, '检查题目');
assert.deepEqual(resolveTaskProductionCardAction(checkRequired), {
  kind: 'run_check',
  label: '继续发布',
  busyLabel: '正在检查题目…',
});

const editing = resolveTaskProductionState({
  trainingTaskId: 'task-editing',
  draft: { ...draft('draft-editing', 'resource-editing', 'drafted'), isDirty: true },
});
assert.equal(editing.state, 'editing');
assert.equal(editing.primaryAction, 'save');
assert.deepEqual(resolveTaskProductionCardAction(editing), {
  kind: 'save_plan',
  label: '继续发布',
  busyLabel: '正在保存任务修改…',
});

const checking = resolveTaskProductionState({
  trainingTaskId: 'task-checking',
  draft: {
    ...draft('draft-checking', 'resource-checking', 'drafted'),
    assessmentStatus: 'running',
  },
});
assert.equal(checking.state, 'checking');
assert.equal(checking.presentation.busy, true);
assert.equal(checking.presentation.primaryActionLabel, null);
assert.deepEqual(resolveTaskProductionCardAction(checking), {
  kind: null,
  label: null,
  busyLabel: null,
});

const revisionRequired = resolveTaskProductionState({
  trainingTaskId: 'task-revision',
  draft: draft('draft-revision', 'resource-revision', 'validation_failed'),
});
assert.equal(revisionRequired.state, 'revision_required');
assert.deepEqual(resolveTaskProductionCardAction(revisionRequired, { hasIssues: true }), {
  kind: 'generate_candidate',
  label: '重新生成题目',
  busyLabel: '正在重新生成题目…',
});

const confirmationReady = resolveTaskProductionState({
  trainingTaskId: 'task-confirmation-ready',
  draft: {
    ...draft('draft-confirmation-ready', 'resource-confirmation-ready', 'drafted'),
    assessmentStatus: 'current',
  },
});
assert.equal(confirmationReady.state, 'pending_confirmation');
assert.deepEqual(resolveTaskProductionCardAction(confirmationReady), {
  kind: 'open_confirmation',
  label: '继续发布',
  busyLabel: null,
});

const pendingConfirmation = resolveTaskProductionState({
  trainingTaskId: 'task-confirmation',
  draft: draft('draft-confirmation', 'resource-confirmation', 'pending_review'),
});
assert.equal(pendingConfirmation.state, 'pending_confirmation');
assert.equal(pendingConfirmation.primaryAction, 'confirm');
assert.equal(pendingConfirmation.presentation.primaryActionLabel, '确认通过');
assert.deepEqual(resolveTaskProductionCardAction(pendingConfirmation), {
  kind: 'confirm',
  label: '继续发布',
  busyLabel: '正在完成最终确认…',
});

const confirmed = resolveTaskProductionState({
  trainingTaskId: 'task-confirmed',
  draft: draft('draft-confirmed', 'resource-confirmed', 'reviewed'),
});
assert.equal(confirmed.state, 'confirmed');
assert.equal(confirmed.binding.confirmedRevisionId, 'draft-confirmed:r2');
assert.deepEqual(resolveTaskPublicationEligibility(confirmed), {
  trainingTaskId: 'task-confirmed',
  eligible: true,
  action: 'publish',
  reason: 'ready',
  message: '题目已完成最终确认，可以发布。',
});
assert.deepEqual(resolveTaskProductionCardAction(confirmed), {
  kind: 'publish',
  label: '继续发布',
  busyLabel: '正在发布正式题目…',
});

const publicationFailed = resolveTaskProductionState({
  trainingTaskId: 'task-publication-failed',
  draft: draft('draft-publication-failed', 'resource-publication-failed', 'reviewed'),
  publication: {
    status: 'failed',
    sourceDraftId: 'draft-publication-failed',
  },
});
assert.equal(publicationFailed.state, 'publication_failed');
assert.equal(publicationFailed.primaryAction, 'retry_publication');
assert.equal(publicationFailed.presentation.tone, 'danger');
assert.equal(resolveTaskPublicationEligibility(publicationFailed).eligible, true);
assert.equal(resolveTaskPublicationEligibility(publicationFailed).action, 'retry_publication');
assert.deepEqual(resolveTaskProductionCardAction(publicationFailed), {
  kind: 'retry_publication',
  label: '重试发布',
  busyLabel: '正在重试发布…',
});

const published = resolveTaskProductionState({
  trainingTaskId: 'task-published',
  draft: draft('draft-published', 'resource-published', 'reviewed'),
  publication: {
    status: 'published',
    sourceDraftId: 'draft-published',
    formalVersionId: 'resource-published:v1',
  },
});
assert.equal(published.state, 'published');
assert.equal(published.binding.latestFormalVersionId, 'resource-published:v1');
assert.equal(published.presentation.stateLabel, '已发布');
assert.equal(published.presentation.primaryActionLabel, '查看正式资源');
assert.equal(resolveTaskPublicationEligibility(published).eligible, false);
assert.equal(resolveTaskPublicationEligibility(published).reason, 'already_published');
assert.deepEqual(resolveTaskProductionCardAction(published), {
  kind: 'view_formal_resource',
  label: '查看正式资源',
  busyLabel: null,
});
assert.deepEqual(resolveTaskProductionCardPresentation(published), {
  visibleStatus: 'published',
  visibleStatusLabel: '已发布',
  visibleStatusTone: 'success',
  stateLabel: '已发布',
  tone: 'success',
  primaryAction: {
    kind: 'view_formal_resource',
    label: '查看正式资源',
    busyLabel: null,
  },
  auxiliaryActions: [],
});
assert.equal(resolveTaskPublicationEligibility(pendingConfirmation).eligible, false);
assert.equal(resolveTaskPublicationEligibility(pendingConfirmation).reason, 'not_confirmed');

const publishedWithNewRevision = resolveTaskProductionState({
  trainingTaskId: 'task-published-with-revision',
  draft: draft('draft-revision-v2', 'resource-published-with-revision', 'drafted'),
  publication: {
    status: 'published',
    sourceDraftId: 'draft-revision-v1',
    formalVersionId: 'resource-published-with-revision:v1',
  },
});
assert.equal(publishedWithNewRevision.state, 'published');
assert.equal(publishedWithNewRevision.hasPublishedVersion, true);
assert.deepEqual(publishedWithNewRevision.availableActions, ['view_formal_resource']);
assert.deepEqual(resolveTaskProductionCardPresentation(publishedWithNewRevision), {
  visibleStatus: 'published',
  visibleStatusLabel: '已发布',
  visibleStatusTone: 'success',
  stateLabel: '已发布',
  tone: 'success',
  primaryAction: {
    kind: 'view_formal_resource',
    label: '查看正式资源',
    busyLabel: null,
  },
  auxiliaryActions: [],
});

const publishedWithUnsavedRevision = resolveTaskProductionState({
  trainingTaskId: 'task-published-with-unsaved-revision',
  draft: {
    ...draft('draft-revision-v2-dirty', 'resource-published-with-unsaved-revision', 'drafted'),
    isDirty: true,
  },
  publication: {
    status: 'published',
    sourceDraftId: 'draft-revision-v1',
    formalVersionId: 'resource-published-with-unsaved-revision:v1',
  },
});
assert.equal(publishedWithUnsavedRevision.state, 'published');
assert.equal(publishedWithUnsavedRevision.primaryAction, 'view_formal_resource');
assert.deepEqual(publishedWithUnsavedRevision.availableActions, ['view_formal_resource']);
assert.equal(publishedWithUnsavedRevision.availableActions.includes('edit'), false);
assert.equal(publishedWithUnsavedRevision.availableActions.includes('save'), false);
assert.equal(publishedWithUnsavedRevision.availableActions.includes('run_check'), false);

const summary = resolveTaskGroupSummary([
  checkRequired,
  pendingConfirmation,
  confirmed,
  published,
]);
assert.deepEqual(summary, {
  total: 4,
  actionRequired: 1,
  pendingConfirmation: 1,
  confirmedAwaitingPublication: 1,
  published: 1,
  aggregateState: 'partial',
});
assert.equal(
  summary.actionRequired +
    summary.pendingConfirmation +
    summary.confirmedAwaitingPublication +
    summary.published,
  summary.total,
);
assert.deepEqual(resolveTaskGroupPublicationSummary(summary), {
  actionRequired: 2,
  awaitingAdoption: 0,
  pendingPublication: 1,
  published: 1,
});
assert.deepEqual(resolveTaskGroupPublicationSummary(summary, {
  awaitingAdoption: 1,
}), {
  actionRequired: 1,
  awaitingAdoption: 1,
  pendingPublication: 1,
  published: 1,
});
assert.deepEqual(resolveTaskGroupPublicationSummary(resolveTaskGroupSummary([
  publishedWithNewRevision,
  published,
])), {
  actionRequired: 0,
  awaitingAdoption: 0,
  pendingPublication: 0,
  published: 2,
});
assert.deepEqual(resolveTaskGroupPublicationSummary(resolveTaskGroupSummary([
  published,
])), {
  actionRequired: 0,
  awaitingAdoption: 0,
  pendingPublication: 0,
  published: 1,
});

assert.deepEqual(resolveTaskProductionVisibleSummary([
  { productionView: checkRequired },
  { productionView: pendingConfirmation },
  { productionView: confirmed },
  { productionView: published },
]), {
  actionRequired: 0,
  awaitingAdoption: 0,
  pendingPublication: 3,
  published: 1,
});
assert.deepEqual(resolveTaskProductionVisibleSummary([
  { productionView: resolveTaskProductionState({ trainingTaskId: 'candidate-task' }), candidateReady: true },
  { productionView: resolveTaskProductionState({ trainingTaskId: 'missing-task' }) },
  { productionView: publicationFailed },
]), {
  actionRequired: 2,
  awaitingAdoption: 1,
  pendingPublication: 0,
  published: 0,
});
assert.deepEqual(resolveTaskProductionVisibleSummary([
  { productionView: published, actionRequired: true },
  { productionView: pendingConfirmation, actionRequired: true },
  { productionView: resolveTaskProductionState({ trainingTaskId: 'candidate-task' }), candidateReady: true },
]), {
  actionRequired: 1,
  awaitingAdoption: 1,
  pendingPublication: 0,
  published: 1,
});

assert.equal(resolveTaskProductionVisibleStatus(empty), 'pending');
assert.equal(resolveTaskProductionVisibleStatus(checking), 'processing');
assert.equal(resolveTaskProductionVisibleStatus(confirmationReady), 'processing');
assert.equal(resolveTaskProductionVisibleStatus(confirmationReady, true), 'pending');
assert.equal(resolveTaskProductionVisibleStatus(confirmed), 'processing');
assert.equal(resolveTaskProductionVisibleStatus(publicationFailed), 'processing');
assert.equal(resolveTaskProductionVisibleStatus(published), 'published');
assert.deepEqual(resolveTaskGroupTopLevelSummary({
  actionRequired: 1,
  awaitingAdoption: 1,
  pendingPublication: 2,
  published: 3,
}), {
  pendingPublication: 4,
  published: 3,
});
assert.deepEqual(resolveTaskGroupTopLevelSummary({
  actionRequired: 0,
  awaitingAdoption: 0,
  pendingPublication: 0,
  published: 3,
}), {
  pendingPublication: 0,
  published: 3,
});

assert.equal(resolveTaskGroupSummary([]).aggregateState, 'empty');
assert.equal(resolveTaskGroupSummary([confirmed]).aggregateState, 'ready');
assert.equal(resolveTaskGroupSummary([published]).aggregateState, 'published');
assert.equal(
  resolveTaskGroupSummary([checkRequired, pendingConfirmation]).aggregateState,
  'in_progress',
);
assert.equal(resolveTaskGroupSummary([publicationFailed]).aggregateState, 'in_progress');

assert.equal(resolveNextPendingTaskId([
  { taskId: 'task-1', published: true },
  { taskId: 'task-2', published: true },
  { taskId: 'task-3', published: false },
], 'task-2'), 'task-3');
assert.equal(resolveNextPendingTaskId([
  { taskId: 'task-1', published: false },
  { taskId: 'task-2', published: true },
  { taskId: 'task-3', published: true },
], 'task-3'), 'task-1');
assert.equal(resolveNextPendingTaskId([
  { taskId: 'task-1', published: true },
  { taskId: 'task-2', published: true },
], 'task-2'), null);

console.log('Task production state debug passed.');

function draft(
  draftId: string,
  resourceId: string,
  status: 'drafted' | 'validation_failed' | 'pending_review' | 'reviewed',
) {
  return {
    draftId,
    resourceId,
    revision: 2,
    status,
  } as const;
}
