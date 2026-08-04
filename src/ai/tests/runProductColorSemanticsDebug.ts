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
  .find((candidate) => candidate.includes('questionLifecycle.actionLabel'));
assert.ok(taskWorkflowButton, '未找到任务卡统一生产动作按钮');
assert.match(taskWorkflowButton, /text-blue-700/, '任务卡统一生产动作应使用蓝色动作样式');
assert.doesNotMatch(taskWorkflowButton, /ai-button-(?:solid|outline)/, '任务卡统一生产动作不得使用 AI 紫色样式');

console.log(`Product color semantics debug: ${aiActions.length + ordinaryActionLabels.length + 5} assertions passed.`);
