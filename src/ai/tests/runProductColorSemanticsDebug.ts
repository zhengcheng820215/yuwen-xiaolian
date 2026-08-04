import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const materialWorkbenchSource = readFileSync(
  new URL('../../pages/MaterialResourceProductionWorkbench.jsx', import.meta.url),
  'utf8',
);
const questionWorkbenchSource = readFileSync(
  new URL('../../pages/QuestionResourceWorkbench.jsx', import.meta.url),
  'utf8',
);

function buttonBlocks(source: string) {
  return source.match(/<button\b[\s\S]*?<\/button>/g) || [];
}

function findButton(source: string, label: string) {
  const block = buttonBlocks(source).find((candidate) => candidate.includes(label));
  assert.ok(block, `未找到按钮：${label}`);
  return block;
}

function assertButtonUsesAiStyle(source: string, label: string, expectedClass: string) {
  const block = findButton(source, label);
  assert.match(block, new RegExp(`className="[^"]*${expectedClass}`), `${label} 应使用 ${expectedClass}`);
}

const aiActions = [
  [materialWorkbenchSource, 'AI根据素材生成训练任务', 'ai-button-solid'],
  [materialWorkbenchSource, '重新生成整组任务', 'ai-button-outline'],
  [materialWorkbenchSource, '补充生成候选任务', 'ai-button-solid'],
  [materialWorkbenchSource, '人工编辑校准', 'ai-button-outline'],
  [materialWorkbenchSource, '重新生成此任务', 'ai-button-solid'],
  [materialWorkbenchSource, '采用此候选', 'ai-button-solid'],
  [materialWorkbenchSource, '采用所选候选', 'ai-button-solid'],
  [questionWorkbenchSource, 'AI 优化题干', 'ai-button-outline'],
  [questionWorkbenchSource, 'AI 优化本项', 'ai-button-outline'],
] as const;

for (const [source, label, expectedClass] of aiActions) {
  assertButtonUsesAiStyle(source, label, expectedClass);
}

const ordinaryActionLabels = [
  '确认任务并保存',
  '提交最终确认',
  '保存本次修改',
  '退回录入修改',
  '确认通过',
  '发布正式题目',
] as const;

for (const label of ordinaryActionLabels) {
  const sources = [materialWorkbenchSource, questionWorkbenchSource];
  const matchingBlocks = sources.flatMap((source) => (
    buttonBlocks(source).filter((candidate) => candidate.includes(label))
  ));
  assert.ok(matchingBlocks.length > 0, `未找到常规操作按钮：${label}`);
  for (const block of matchingBlocks) {
    assert.doesNotMatch(block, /ai-button-(?:solid|outline)/, `${label} 不得使用 AI 紫色样式`);
  }
}

const savePlanButton = findButton(materialWorkbenchSource, '确认任务并保存');
assert.match(savePlanButton, /bg-blue-700/, '确认任务并保存应使用蓝色主操作样式');
assert.doesNotMatch(savePlanButton, /bg-emerald-|border-emerald-|text-emerald-/, '确认任务并保存不得使用绿色操作样式');

const taskWorkflowButton = buttonBlocks(materialWorkbenchSource)
  .find((candidate) => candidate.includes('taskProductionAction.label'));
assert.ok(taskWorkflowButton, '未找到任务卡统一生产动作按钮');
assert.match(taskWorkflowButton, /text-blue-700/, '任务卡统一生产动作应使用蓝色动作样式');
assert.doesNotMatch(taskWorkflowButton, /ai-button-(?:solid|outline)/, '任务卡统一生产动作不得使用 AI 紫色样式');

assert.match(
  materialWorkbenchSource,
  /const taskCardPresentation = questionLifecycle\?\.cardPresentation/,
  '任务卡首层必须先读取统一 cardPresentation',
);
assert.match(
  materialWorkbenchSource,
  /const taskProductionAction = taskCardPresentation\?\.primaryAction/,
  '任务卡展示、点击与 Loading 必须消费统一 primaryAction',
);
assert.match(
  materialWorkbenchSource,
  /<TaskQuestionLifecycleBadge presentation=\{taskCardPresentation\}/,
  '任务卡状态徽标必须直接消费统一展示投影',
);
assert.match(
  materialWorkbenchSource,
  /data-task-production-state=\{questionLifecycle\?\.productionView\?\.state \|\| 'unknown'\}/,
  '任务卡必须暴露统一生产状态供端到端验收',
);
assert.match(
  materialWorkbenchSource,
  /data-task-production-action=\{taskProductionAction\?\.kind \|\| 'none'\}/,
  '任务卡必须暴露唯一主操作供端到端验收',
);
assert.doesNotMatch(
  materialWorkbenchSource,
  /actionLabel:\s*cardAction\.label/,
  '任务生命周期不得复制 actionLabel 影子字段',
);
assert.doesNotMatch(
  materialWorkbenchSource,
  /actionKind:\s*cardAction\.kind/,
  '任务生命周期不得复制 actionKind 影子字段',
);
assert.doesNotMatch(
  materialWorkbenchSource,
  /busyLabel:\s*cardAction\.busyLabel/,
  '任务生命周期不得复制 busyLabel 影子字段',
);

console.log(`Product color semantics debug: ${aiActions.length + ordinaryActionLabels.length + 13} assertions passed.`);
