import assert from 'node:assert/strict';
import {
  getMaterialProductionCommandAvailability,
  MATERIAL_PRODUCTION_COMMANDS,
  type MaterialProductionCommandContext,
} from '../../pages/materialResourceProductionCommandState.ts';

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

const cases: Array<{ name: string; run: () => void }> = [
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
];

let passed = 0;
for (const testCase of cases) {
  testCase.run();
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
