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
  [materialWorkbenchSource, '生成更多任务', 'ai-button-solid'],
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
  '保存任务组并重新检查',
  '返回任务调整',
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

const savePlanButton = findButton(materialWorkbenchSource, '保存任务组并重新检查');
assert.match(savePlanButton, /bg-slate-950/, '保存任务组并重新检查应使用深蓝主操作样式');
assert.doesNotMatch(savePlanButton, /bg-emerald-|border-emerald-|text-emerald-/, '保存任务组并重新检查不得使用绿色操作样式');

const submitReviewButton = findButton(materialWorkbenchSource, '提交最终确认');
assert.match(submitReviewButton, /bg-slate-950/, '提交最终确认应使用深蓝主操作样式');
assert.doesNotMatch(submitReviewButton, /bg-emerald-|border-emerald-|text-emerald-/, '提交最终确认不得使用绿色操作样式');

const returnAdjustmentButton = findButton(materialWorkbenchSource, '返回任务调整');
assert.match(returnAdjustmentButton, /border-\[#666666\]/, '返回任务调整应使用中性描边次操作样式');
assert.doesNotMatch(returnAdjustmentButton, /bg-emerald-|border-emerald-|text-emerald-/, '返回任务调整不得使用绿色操作样式');

console.log(`Product color semantics debug: ${aiActions.length + ordinaryActionLabels.length + 6} assertions passed.`);
