import assert from 'node:assert/strict';
import {
  countPendingReviewDrafts,
  getReturnIssueEditorTargetIds,
  resolveQuestionBatchNavigationTitle,
  resolveQuestionWorkbenchPageIdentity,
  resolveReviewWarningSection,
} from '../../pages/questionWorkbenchPresentationState.ts';

const cases = [
  [false, null, '题目录入工作台'],
  [true, 'drafted', '题目修改与提交平台'],
  [true, 'revision_required', '题目修改与提交平台'],
  [true, 'pending_review', '题目人工审核平台'],
  [true, 'reviewed', '题目发布平台'],
  [true, 'publication_incomplete', '题目发布恢复平台'],
  [true, 'published', '已发布题目'],
  [true, 'rejected', '题目审核记录'],
] as const;

for (const [focusedReview, status, expectedTitle] of cases) {
  assert.equal(
    resolveQuestionWorkbenchPageIdentity({ focusedReview, status }).title,
    expectedTitle,
  );
}

assert.deepEqual(
  resolveQuestionWorkbenchPageIdentity({
    focusedReview: true,
    status: null,
    loading: true,
  }),
  {
    title: '正在载入题目',
    subtitle: '',
  },
);

assert.equal(
  countPendingReviewDrafts([
    'drafted',
    'validation_failed',
    'pending_review',
    'revision_required',
    'reviewed',
    'published',
  ]),
  1,
);
assert.equal(resolveQuestionBatchNavigationTitle(true), '本批题目');
assert.equal(resolveQuestionBatchNavigationTitle(false), 'DRAFT / REVIEW');
assert.deepEqual(
  resolveReviewWarningSection({
    status: 'pending_review',
    warningCount: 2,
    allWarningsDecided: false,
  }),
  { title: '待确认事项（2）', pending: true },
);
assert.deepEqual(
  resolveReviewWarningSection({
    status: 'published',
    warningCount: 2,
    allWarningsDecided: true,
  }),
  { title: '提醒处理记录（2）', pending: false },
);
assert.deepEqual(
  getReturnIssueEditorTargetIds('question_expression', { planReviewMode: true }),
  ['question-stem-editor'],
);
assert.deepEqual(
  getReturnIssueEditorTargetIds('ability_target', { planReviewMode: true }),
  ['question-training-targets'],
);
assert.deepEqual(
  getReturnIssueEditorTargetIds('difficulty', { planReviewMode: false }),
  ['question-difficulty-editor'],
);
assert.deepEqual(
  getReturnIssueEditorTargetIds('rubric', { planReviewMode: true }),
  ['question-rubric-editor'],
);
assert.deepEqual(
  getReturnIssueEditorTargetIds('answer_scope', { planReviewMode: true }),
  ['question-answer-requirements'],
);
assert.deepEqual(
  getReturnIssueEditorTargetIds('student_presentation', { planReviewMode: true }),
  ['question-response-settings', 'question-stem-editor'],
);
assert.deepEqual(
  getReturnIssueEditorTargetIds('other', { planReviewMode: true }),
  [],
);

const additionalAssertions = 13;
console.log(
  `Question workbench presentation state debug: ${cases.length + additionalAssertions}/${cases.length + additionalAssertions} passed.`,
);
