import assert from 'node:assert/strict';
import {
  countQuestionLifecycleBuckets,
  countPendingReviewDrafts,
  getReturnIssueEditorTargetIds,
  resolveQuestionBatchNavigationTitle,
  resolveQuestionLocalSectionTitle,
  resolveQuestionWorkbenchPageIdentity,
  resolveReviewWarningSection,
} from '../../pages/questionWorkbenchPresentationState.ts';

const cases = [
  [false, null, '题目录入工作台'],
  [true, 'drafted', '题目资源工作台'],
  [true, 'revision_required', '题目资源工作台'],
  [true, 'pending_review', '题目资源工作台'],
  [true, 'reviewed', '题目资源工作台'],
  [true, 'publication_incomplete', '题目资源工作台'],
  [true, 'published', '题目资源工作台'],
  [true, 'rejected', '题目资源工作台'],
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
assert.deepEqual(
  countQuestionLifecycleBuckets([
    'drafted',
    'revision_required',
    'pending_review',
    'reviewed',
    'publication_incomplete',
    'published',
  ]),
  {
    pendingAction: 2,
    pendingReview: 1,
    approvedForPublication: 2,
    published: 1,
    total: 6,
  },
);
const lifecycleCounts = countQuestionLifecycleBuckets([
  'drafted',
  'pending_review',
  'published',
]);
assert.equal(
  lifecycleCounts.pendingAction +
    lifecycleCounts.pendingReview +
    lifecycleCounts.approvedForPublication +
    lifecycleCounts.published,
  lifecycleCounts.total,
);
assert.equal(resolveQuestionBatchNavigationTitle(true), '本批题目');
assert.equal(resolveQuestionBatchNavigationTitle(false), 'DRAFT / REVIEW');
assert.equal(
  resolveQuestionLocalSectionTitle({ questionNumber: 3, status: 'drafted' }),
  '题目3 · 修改与提交',
);
assert.equal(
  resolveQuestionLocalSectionTitle({ questionNumber: 2, status: 'pending_review' }),
  '题目2 · 人工审核',
);
assert.equal(
  resolveQuestionLocalSectionTitle({ questionNumber: 1, status: 'reviewed' }),
  '题目1 · 发布准备',
);
assert.equal(
  resolveQuestionLocalSectionTitle({ questionNumber: 1, status: 'published' }),
  '题目1 · 已发布',
);
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

const additionalAssertions = 15;
console.log(
  `Question workbench presentation state debug: ${cases.length + additionalAssertions}/${cases.length + additionalAssertions} passed.`,
);
