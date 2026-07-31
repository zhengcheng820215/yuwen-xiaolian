import assert from 'node:assert/strict';
import {
  questionWorkflowStepIndex,
  resolveQuestionWorkflowProjection,
} from '../../pages/questionWorkflowProjection.ts';

const base = {
  draftStatus: 'drafted',
  isDirty: false,
  qualityCheckComplete: false,
  warningCount: 0,
  warningsReady: true,
  publicationStatus: 'drafted',
};

const dirty = resolveQuestionWorkflowProjection({ ...base, isDirty: true });
assert.equal(dirty.visibleStep, 'question_check');
assert.equal(dirty.primaryAction, 'save_and_recheck');
assert.equal(dirty.productionState, 'editing');

const structureOnly = resolveQuestionWorkflowProjection({
  ...base,
  structureCheckPassed: true,
});
assert.equal(structureOnly.message, '结构检查通过，完整检查未完成');

const warningPending = resolveQuestionWorkflowProjection({
  ...base,
  qualityCheckComplete: true,
  warningCount: 1,
  warningsReady: false,
});
assert.equal(warningPending.substate, 'warning_pending');
assert.equal(warningPending.primaryAction, 'submit_final_confirmation');
assert.equal(questionWorkflowStepIndex(warningPending), 1);

const ready = resolveQuestionWorkflowProjection({
  ...base,
  qualityCheckComplete: true,
});
assert.equal(ready.substate, 'ready_to_submit');
assert.equal(ready.primaryAction, 'submit_final_confirmation');
assert.equal(questionWorkflowStepIndex(ready), 2);
assert.equal(ready.productionState, 'pending_confirmation');

const pendingReview = resolveQuestionWorkflowProjection({
  ...base,
  draftStatus: 'pending_review',
});
assert.equal(pendingReview.substate, 'pending_review');
assert.equal(pendingReview.primaryAction, 'record_review_decision');
assert.equal(questionWorkflowStepIndex(pendingReview), 2);
assert.equal(pendingReview.productionState, 'pending_confirmation');

const approved = resolveQuestionWorkflowProjection({
  ...base,
  draftStatus: 'reviewed',
});
assert.equal(approved.substate, 'approved');
assert.equal(approved.primaryAction, 'publish');
assert.equal(questionWorkflowStepIndex(approved), 3);
assert.equal(approved.productionState, 'confirmed');

const publicationIncomplete = resolveQuestionWorkflowProjection({
  ...base,
  draftStatus: 'reviewed',
  publicationStatus: 'publication_incomplete',
});
assert.equal(publicationIncomplete.substate, 'publication_incomplete');
assert.equal(publicationIncomplete.primaryAction, 'resume_publication');
assert.equal(publicationIncomplete.productionState, 'publication_failed');

const published = resolveQuestionWorkflowProjection({
  ...base,
  draftStatus: 'reviewed',
  publicationStatus: 'published',
});
assert.equal(published.visibleStep, 'published');
assert.equal(published.primaryAction, null);
assert.equal(questionWorkflowStepIndex(published), 3);
assert.equal(published.productionState, 'published');

console.log('Question workflow projection debug passed.');
