import assert from 'node:assert/strict';
import { resolveQuestionWorkbenchAccess } from '../../pages/questionWorkbenchAccess.ts';

const standalone = resolveQuestionWorkbenchAccess({});
assert.equal(standalone.mode, 'legacy_adapter');
assert.equal(standalone.writable, false);
assert.equal(standalone.requiresWorkspaceLoad, false);

const legacyDraftLink = resolveQuestionWorkbenchAccess({ draftId: 'draft-legacy' });
assert.equal(legacyDraftLink.mode, 'legacy_adapter');
assert.equal(legacyDraftLink.writable, false);

const incompletePlanReview = resolveQuestionWorkbenchAccess({
  mode: 'plan-review',
  planId: 'plan-1',
});
assert.equal(incompletePlanReview.mode, 'legacy_adapter');
assert.equal(incompletePlanReview.writable, false);

const planReview = resolveQuestionWorkbenchAccess({
  mode: 'plan-review',
  planId: 'plan-1',
  materialVersionId: 'material-1:v1',
});
assert.equal(planReview.mode, 'unified_edit');
assert.equal(planReview.writable, true);
assert.equal(planReview.requiresWorkspaceLoad, true);

const taskDetail = resolveQuestionWorkbenchAccess({
  mode: 'task-detail',
  planId: 'plan-1',
  materialVersionId: 'material-1:v1',
  draftId: 'draft-1',
});
assert.equal(taskDetail.mode, 'task_detail');
assert.equal(taskDetail.writable, false);
assert.equal(taskDetail.requiresWorkspaceLoad, true);

const unknownMode = resolveQuestionWorkbenchAccess({
  mode: 'standalone-editor',
  planId: 'plan-1',
  materialVersionId: 'material-1:v1',
});
assert.equal(unknownMode.mode, 'legacy_adapter');
assert.equal(unknownMode.writable, false);

console.log('Question workbench legacy closure debug passed.');
