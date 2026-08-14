import assert from 'node:assert/strict';
import {
  getMaterialProductionCommandAvailability,
  MATERIAL_PRODUCTION_COMMANDS,
  type MaterialProductionCommandContext,
} from '../../pages/materialResourceProductionCommandState.ts';
import { confirmTrainingPlanForTaskProduction } from '../../pages/materialProductionCommands.ts';

const baseContext: MaterialProductionCommandContext = {
  hasMaterial: true,
  hasPlan: true,
  aiServiceReady: true,
  generatorBusy: false,
  commandBusy: false,
  taskEditorDirty: false,
  taskCount: 3,
  taskLimit: 5,
  editableIssueCount: 0,
  candidateReady: false,
  validationPassed: true,
  submissionReady: true,
};

const cases: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: '未保存修改会阻止三类 AI 规划命令',
    run: () => {
      const context = { ...baseContext, taskEditorDirty: true };
      assert.equal(availability('regenerateSingleTask', context).enabled, false);
      assert.equal(availability('planSupplementCandidates', context).enabled, false);
      assert.equal(availability('planReplacementGroup', context).enabled, false);
    },
  },
  {
    name: '补充候选达到任务上限后不可执行',
    run: () => {
      const result = availability('planSupplementCandidates', {
        ...baseContext,
        taskCount: 5,
      });
      assert.equal(result.enabled, false);
      assert.match(result.reason, /达到 5 个任务/);
    },
  },
  {
    name: '候选采用必须存在可用候选且编辑区干净',
    run: () => {
      assert.equal(availability('adoptCandidates', baseContext).enabled, false);
      assert.equal(availability('adoptCandidates', {
        ...baseContext,
        candidateReady: true,
      }).enabled, true);
      assert.equal(availability('adoptCandidates', {
        ...baseContext,
        candidateReady: true,
        taskEditorDirty: true,
      }).enabled, false);
    },
  },
  {
    name: '已有版本只有发生修改后才允许保存新 Revision',
    run: () => {
      assert.equal(availability('savePlanRevision', baseContext).enabled, false);
      assert.equal(availability('savePlanRevision', {
        ...baseContext,
        taskEditorDirty: true,
      }).enabled, true);
      assert.equal(availability('savePlanRevision', {
        ...baseContext,
        taskEditorDirty: true,
        editableIssueCount: 1,
      }).enabled, false);
    },
  },
  {
    name: '仅保存素材不会把空白占位任务当成可保存任务组',
    run: () => {
      const result = availability('savePlanRevision', {
        ...baseContext,
        hasPlan: false,
        taskCount: 0,
      });
      assert.equal(result.enabled, false);
      assert.match(result.reason, /AI 规划并采用训练任务/);
    },
  },
  {
    name: '提交审核只读取已保存且通过检查的版本',
    run: () => {
      assert.equal(availability('submitForQuestionReview', baseContext).enabled, true);
      assert.equal(availability('submitForQuestionReview', {
        ...baseContext,
        taskEditorDirty: true,
      }).enabled, false);
      assert.equal(availability('submitForQuestionReview', {
        ...baseContext,
        validationPassed: false,
      }).enabled, false);
      assert.equal(availability('submitForQuestionReview', {
        ...baseContext,
        submissionReady: false,
      }).enabled, false);
    },
  },
  {
    name: '无计划时可以规划替代组但不能补充或提交',
    run: () => {
      const context = { ...baseContext, hasPlan: false };
      assert.equal(availability('planReplacementGroup', context).enabled, true);
      assert.equal(availability('planSupplementCandidates', context).enabled, false);
      assert.equal(availability('submitForQuestionReview', context).enabled, false);
    },
  },
  {
    name: '草稿计划按直接返回的 Plan 状态完成提交和批准',
    run: async () => {
      const calls: string[] = [];
      const result = await confirmTrainingPlanForTaskProduction({
        planId: 'plan-draft',
        currentStatus: 'draft',
      }, {
        loadPlan: async () => ({ status: 'draft' }),
        submitPlan: async (planId) => {
          calls.push(`submit:${planId}`);
          return { status: 'pending_review' };
        },
        approvePlan: async (planId) => {
          calls.push(`approve:${planId}`);
          return { action: 'approve' };
        },
      });

      assert.deepEqual(calls, ['submit:plan-draft', 'approve:plan-draft']);
      assert.equal(result.status, 'reviewed');
      assert.equal(result.continuationCode, 'submitted_and_approved');
      assert.deepEqual(result.completedStages, ['plan_submitted', 'plan_approved']);
    },
  },
  {
    name: '待审核计划批准后显式进入 reviewed，不读取审核决定中不存在的 plan',
    run: async () => {
      let submitCalled = false;
      const result = await confirmTrainingPlanForTaskProduction({
        planId: 'plan-pending',
        currentStatus: 'pending_review',
      }, {
        loadPlan: async () => ({ status: 'pending_review' }),
        submitPlan: async () => {
          submitCalled = true;
          return { status: 'pending_review' };
        },
        approvePlan: async () => ({ action: 'approve' }),
      });

      assert.equal(submitCalled, false);
      assert.equal(result.status, 'reviewed');
      assert.equal(result.continuationCode, 'approved');
      assert.deepEqual(result.completedStages, ['plan_approved']);
    },
  },
  {
    name: '排队期间计划已 reviewed 时按权威状态直接续接',
    run: async () => {
      let submitCalls = 0;
      let approveCalls = 0;
      const result = await confirmTrainingPlanForTaskProduction({
        planId: 'plan-stale-reviewed',
        currentStatus: 'draft',
      }, {
        loadPlan: async () => ({ status: 'reviewed' }),
        submitPlan: async () => {
          submitCalls += 1;
          return { status: 'pending_review' };
        },
        approvePlan: async () => {
          approveCalls += 1;
        },
      });

      assert.equal(submitCalls, 0);
      assert.equal(approveCalls, 0);
      assert.equal(result.status, 'reviewed');
      assert.equal(result.continuationCode, 'semantic_state_reloaded');
      assert.equal(result.events.some((event) => event.type === 'stage_skipped'), true);
    },
  },
  {
    name: '提交竞态后重读为 reviewed 时安全续接',
    run: async () => {
      let reads = 0;
      let approveCalls = 0;
      const result = await confirmTrainingPlanForTaskProduction({
        planId: 'plan-submit-race',
        currentStatus: 'draft',
      }, {
        loadPlan: async () => ({ status: reads++ === 0 ? 'draft' : 'reviewed' }),
        submitPlan: async () => {
          throw new Error('Material Observation Plan cannot be submitted from status: reviewed');
        },
        approvePlan: async () => {
          approveCalls += 1;
        },
      });

      assert.equal(approveCalls, 0);
      assert.equal(result.status, 'reviewed');
      assert.equal(result.continuationCode, 'race_recovered');
      assert.equal(result.events.some((event) => event.type === 'race_recovered'), true);
    },
  },
  {
    name: '同一计划连续发布只提交和批准一次',
    run: async () => {
      let authorityStatus = 'draft';
      let submitCalls = 0;
      let approveCalls = 0;
      const dependencies = {
        loadPlan: async () => ({ status: authorityStatus }),
        submitPlan: async () => {
          submitCalls += 1;
          authorityStatus = 'pending_review';
          return { status: authorityStatus };
        },
        approvePlan: async () => {
          approveCalls += 1;
          authorityStatus = 'reviewed';
        },
      };

      const first = await confirmTrainingPlanForTaskProduction({
        planId: 'plan-sequential',
        currentStatus: 'draft',
      }, dependencies);
      const second = await confirmTrainingPlanForTaskProduction({
        planId: 'plan-sequential',
        currentStatus: 'draft',
      }, dependencies);

      assert.equal(first.continuationCode, 'submitted_and_approved');
      assert.equal(second.continuationCode, 'semantic_state_reloaded');
      assert.equal(submitCalls, 1);
      assert.equal(approveCalls, 1);
    },
  },
  {
    name: '不兼容计划状态使用中文提示并阻断',
    run: async () => {
      await assert.rejects(
        () => confirmTrainingPlanForTaskProduction({
          planId: 'plan-superseded',
          currentStatus: 'draft',
        }, {
          loadPlan: async () => ({ status: 'superseded' }),
          submitPlan: async () => ({ status: 'pending_review' }),
          approvePlan: async () => ({ action: 'approve' }),
        }),
        (error: any) => {
          assert.equal(error.code, 'MATERIAL_OBSERVATION_PLAN_STATE_CHANGED');
          assert.equal(error.recoverability, 'reload_required');
          assert.equal(error.objectId, 'plan-superseded');
          return /当前训练计划状态已经变化，请刷新后重试/.test(error.message);
        },
      );
    },
  },
  {
    name: '页面与权威计划均 reviewed 时返回结构化跳过结果',
    run: async () => {
      const result = await confirmTrainingPlanForTaskProduction({
        planId: 'plan-already-reviewed',
        currentStatus: 'reviewed',
      }, {
        loadPlan: async () => ({ status: 'reviewed' }),
        submitPlan: async () => { throw new Error('submit should not run'); },
        approvePlan: async () => { throw new Error('approve should not run'); },
      });

      assert.equal(result.continuationCode, 'already_reviewed');
      assert.deepEqual(result.completedStages, []);
      assert.deepEqual(result.events.map((event) => event.type), [
        'authority_loaded',
        'stage_skipped',
        'stage_skipped',
      ]);
    },
  },
  {
    name: '审批竞态后重读为 reviewed 时返回结构化恢复结果',
    run: async () => {
      let reads = 0;
      const result = await confirmTrainingPlanForTaskProduction({
        planId: 'plan-approve-race',
        currentStatus: 'pending_review',
      }, {
        loadPlan: async () => ({ status: reads++ === 0 ? 'pending_review' : 'reviewed' }),
        submitPlan: async () => ({ status: 'pending_review' }),
        approvePlan: async () => { throw new Error('approval raced'); },
      });

      assert.equal(result.continuationCode, 'race_recovered');
      assert.equal(result.events.at(-1)?.stage, 'approve_plan');
    },
  },
  {
    name: '权威计划缺失时返回固定结构化刷新错误',
    run: async () => {
      await assert.rejects(
        () => confirmTrainingPlanForTaskProduction({
          planId: 'plan-missing',
          currentStatus: 'reviewed',
        }, {
          loadPlan: async () => null,
          submitPlan: async () => ({ status: 'pending_review' }),
          approvePlan: async () => ({ action: 'approve' }),
        }),
        (error: any) => {
          assert.equal(error.code, 'MATERIAL_OBSERVATION_PLAN_STATE_CHANGED');
          assert.equal(error.operation, 'material_observation_plan.continue_for_task_publication');
          assert.equal(error.recoverability, 'reload_required');
          return true;
        },
      );
    },
  },
];

let passed = 0;
for (const testCase of cases) {
  await testCase.run();
  passed += 1;
  console.log(`PASS ${testCase.name}`);
}
console.log(`Material resource production command debug: ${passed}/${cases.length} passed.`);

function availability(
  command: keyof typeof MATERIAL_PRODUCTION_COMMANDS,
  context: MaterialProductionCommandContext,
) {
  return getMaterialProductionCommandAvailability(
    MATERIAL_PRODUCTION_COMMANDS[command],
    context,
  );
}
