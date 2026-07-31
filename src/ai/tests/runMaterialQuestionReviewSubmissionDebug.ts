import assert from 'node:assert/strict';
import {
  executeQuestionReviewSubmission,
  QuestionReviewSubmissionStageError,
} from '../../pages/materialQuestionReviewSubmission.ts';

const cases: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: '全新计划按顺序完成提交、确认和题目创建',
    run: async () => {
      const calls: string[] = [];
      const result = await executeQuestionReviewSubmission({
        initialPlanStatus: 'draft',
        existingDraftCount: 0,
        taskPlanCount: 3,
        submitPlan: async () => { calls.push('submit'); },
        approvePlan: async () => { calls.push('approve'); },
        createDrafts: async () => { calls.push('drafts'); },
        completeDraftChecks: async () => { calls.push('checks'); },
      });

      assert.deepEqual(calls, ['submit', 'approve', 'drafts', 'checks']);
      assert.deepEqual(result.completedStages, [
        'plan_submitted',
        'plan_approved',
        'drafts_created',
        'quality_checks_completed',
      ]);
    },
  },
  {
    name: '训练计划确认失败时返回已完成阶段',
    run: async () => {
      const error = await captureStageError(() => executeQuestionReviewSubmission({
        initialPlanStatus: 'draft',
        existingDraftCount: 0,
        taskPlanCount: 2,
        submitPlan: async () => undefined,
        approvePlan: async () => { throw new Error('approval unavailable'); },
        createDrafts: async () => undefined,
        completeDraftChecks: async () => undefined,
      }));

      assert.equal(error.failedStage, 'approve_plan');
      assert.deepEqual(error.completedStages, ['plan_submitted']);
      assert.equal(error.message, '训练计划已提交，但训练计划确认失败，可重试。');
    },
  },
  {
    name: '题目创建失败时明确训练计划已经确认',
    run: async () => {
      const error = await captureStageError(() => executeQuestionReviewSubmission({
        initialPlanStatus: 'reviewed',
        existingDraftCount: 0,
        taskPlanCount: 2,
        submitPlan: async () => assert.fail('不应重新提交计划'),
        approvePlan: async () => assert.fail('不应重新确认计划'),
        createDrafts: async () => { throw new Error('draft creation unavailable'); },
        completeDraftChecks: async () => undefined,
      }));

      assert.equal(error.failedStage, 'create_drafts');
      assert.deepEqual(error.completedStages, ['plan_submitted', 'plan_approved']);
      assert.equal(error.message, '训练计划已确认，但待审核题目创建失败，可重试。');
    },
  },
  {
    name: '已有足量待审核题目时不会重复创建',
    run: async () => {
      let createCount = 0;
      let checkCount = 0;
      const result = await executeQuestionReviewSubmission({
        initialPlanStatus: 'reviewed',
        existingDraftCount: 3,
        taskPlanCount: 3,
        submitPlan: async () => assert.fail('不应重新提交计划'),
        approvePlan: async () => assert.fail('不应重新确认计划'),
        createDrafts: async () => { createCount += 1; },
        completeDraftChecks: async () => { checkCount += 1; },
      });

      assert.equal(createCount, 0);
      assert.equal(checkCount, 1);
      assert.deepEqual(result.completedStages, [
        'plan_submitted',
        'plan_approved',
        'drafts_created',
        'quality_checks_completed',
      ]);
    },
  },
  {
    name: '完整质量检查失败时保留题目创建结果并允许单独重试',
    run: async () => {
      let checkCount = 0;
      const error = await captureStageError(() => executeQuestionReviewSubmission({
        initialPlanStatus: 'reviewed',
        existingDraftCount: 3,
        taskPlanCount: 3,
        submitPlan: async () => assert.fail('不应重新提交计划'),
        approvePlan: async () => assert.fail('不应重新确认计划'),
        createDrafts: async () => assert.fail('不应重复创建题目'),
        completeDraftChecks: async () => {
          checkCount += 1;
          throw new Error('quality provider unavailable');
        },
      }));

      assert.equal(checkCount, 1);
      assert.equal(error.failedStage, 'complete_quality_checks');
      assert.deepEqual(error.completedStages, [
        'plan_submitted',
        'plan_approved',
        'drafts_created',
      ]);
      assert.equal(
        error.message,
        '待审核题目已创建，但完整质量检查未完成，可重试；系统不会重复创建题目。',
      );
    },
  },
  {
    name: '重试从持久化状态继续且不重复前序动作',
    run: async () => {
      let submitCount = 0;
      let approveCount = 0;
      let createCount = 0;

      await captureStageError(() => executeQuestionReviewSubmission({
        initialPlanStatus: 'draft',
        existingDraftCount: 0,
        taskPlanCount: 1,
        submitPlan: async () => { submitCount += 1; },
        approvePlan: async () => { approveCount += 1; },
        createDrafts: async () => {
          createCount += 1;
          throw new Error('temporary failure');
        },
        completeDraftChecks: async () => undefined,
      }));

      await executeQuestionReviewSubmission({
        initialPlanStatus: 'reviewed',
        existingDraftCount: 0,
        taskPlanCount: 1,
        submitPlan: async () => { submitCount += 1; },
        approvePlan: async () => { approveCount += 1; },
        createDrafts: async () => { createCount += 1; },
        completeDraftChecks: async () => undefined,
      });

      assert.equal(submitCount, 1);
      assert.equal(approveCount, 1);
      assert.equal(createCount, 2);
    },
  },
];

let passed = 0;
for (const testCase of cases) {
  await testCase.run();
  passed += 1;
  console.log(`PASS ${testCase.name}`);
}
console.log(`Material question review submission debug: ${passed}/${cases.length} passed.`);

async function captureStageError(
  action: () => Promise<unknown>,
): Promise<QuestionReviewSubmissionStageError> {
  try {
    await action();
    assert.fail('Expected QuestionReviewSubmissionStageError.');
  } catch (error) {
    assert.ok(error instanceof QuestionReviewSubmissionStageError);
    return error;
  }
}
