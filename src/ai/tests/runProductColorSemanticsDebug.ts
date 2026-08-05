import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  enterTaskCardCalibration,
  exitTaskCardCalibration,
  isTaskCardDisclosureOpen,
  setTaskCardDisclosureOpen,
} from '../../pages/taskCardDisclosureState.ts';

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
  [materialWorkbenchSource, '退出人工校准', 'ai-button-outline'],
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

const removeTaskButton = findButton(materialWorkbenchSource, '删除任务');
assert.match(removeTaskButton, /border-red-600/, '删除任务应使用标准红色线框');
assert.match(removeTaskButton, /text-red-700/, '删除任务应使用标准危险操作字色');
assert.match(removeTaskButton, /hover:bg-red-50/, '删除任务悬停时应使用浅红色背景');
assert.match(removeTaskButton, /<Trash2 size=\{16\}/, '删除任务应保留删除图标');

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
assert.match(
  materialWorkbenchSource,
  /taskProductionAction\.kind !== 'view_formal_resource'/,
  '纯已发布任务不得重复渲染首层“查看正式资源”入口',
);
assert.doesNotMatch(
  materialWorkbenchSource,
  /open=\{taskProductionAction\?\.kind === 'view_formal_resource'\}/,
  '正式资源不得再根据生产动作自动展开',
);
assert.match(
  materialWorkbenchSource,
  />使用状态<[\s\S]*?>可用于学习</,
  '正式资源首层必须展示用户可理解的使用状态',
);
assert.match(
  materialWorkbenchSource,
  />来源素材</,
  '正式资源首层必须展示用户可理解的来源素材',
);
assert.doesNotMatch(
  materialWorkbenchSource,
  /查看追溯信息|正式资源 ID|正式版本 ID|来源草稿 ID|素材版本 ID/,
  '正式资源用户界面不得外显工程追溯入口或内部标识',
);
assert.doesNotMatch(
  materialWorkbenchSource,
  />来源 Draft</,
  '正式资源不得继续展示中英混排的来源 Draft 标签',
);
assert.doesNotMatch(
  materialWorkbenchSource,
  />Material Version</,
  '正式资源不得继续展示中英混排的 Material Version 标签',
);
assert.equal(
  materialWorkbenchSource.match(/className="mt-2 rounded-md bg-slate-50 px-4 py-3"/g)?.length,
  4,
  '任务卡四个二级折叠区必须使用统一的浅底色容器样式',
);
const taskAttributeIndex = materialWorkbenchSource.indexOf("open={taskDisclosureOpen('task_attributes')}");
const scoringIndex = materialWorkbenchSource.indexOf("open={taskDisclosureOpen('scoring')}");
const designRationaleIndex = materialWorkbenchSource.indexOf("open={taskDisclosureOpen('design_rationale')}");
const formalResourceIndex = materialWorkbenchSource.indexOf("open={taskDisclosureOpen('formal_resource')}");
assert.ok(
  taskAttributeIndex >= 0
    && taskAttributeIndex < scoringIndex
    && scoringIndex < designRationaleIndex
    && designRationaleIndex < formalResourceIndex,
  '任务卡二级信息必须按任务属性、评分标准、设计依据、正式资源排序',
);
assert.match(
  materialWorkbenchSource,
  /open=\{taskDisclosureOpen\('task_attributes'\)\}/,
  '任务属性必须消费当前任务的受控展开状态',
);
assert.match(
  materialWorkbenchSource,
  /open=\{taskDisclosureOpen\('scoring'\)\}/,
  '评分标准必须消费当前任务的受控展开状态',
);
assert.match(
  materialWorkbenchSource,
  /open=\{taskDisclosureOpen\('design_rationale'\)\}/,
  '设计依据必须消费当前任务的受控展开状态',
);
assert.match(
  materialWorkbenchSource,
  /open=\{taskDisclosureOpen\('formal_resource'\)\}/,
  '正式资源必须消费当前任务的受控展开状态',
);
assert.equal(
  materialWorkbenchSource.match(/aria-label="训练任务校准操作"/g)?.length,
  1,
  '人工校准进入与退出必须复用同一个稳定操作栏，避免切换时布局抖动',
);
assert.match(
  materialWorkbenchSource,
  /className="ai-button-outline inline-flex h-10 w-36[^\"]*"[\s\S]*?退出人工校准/,
  '退出人工校准必须使用与进入校准相同的固定按钮宽度',
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

let disclosureState = {};
for (const key of ['task_attributes', 'scoring', 'design_rationale', 'formal_resource'] as const) {
  assert.equal(
    isTaskCardDisclosureOpen(disclosureState, 'task-1', key),
    false,
    `${key} 初始必须收起`,
  );
}
disclosureState = enterTaskCardCalibration(disclosureState, 'task-1');
assert.equal(isTaskCardDisclosureOpen(disclosureState, 'task-1', 'task_attributes'), true);
assert.equal(isTaskCardDisclosureOpen(disclosureState, 'task-1', 'scoring'), true);
assert.equal(isTaskCardDisclosureOpen(disclosureState, 'task-1', 'design_rationale'), false);
assert.equal(isTaskCardDisclosureOpen(disclosureState, 'task-1', 'formal_resource'), false);
disclosureState = setTaskCardDisclosureOpen(disclosureState, 'task-1', 'scoring', false);
assert.equal(
  isTaskCardDisclosureOpen(disclosureState, 'task-1', 'scoring'),
  false,
  '人工校准中手动收起评分标准后必须保持收起',
);
assert.equal(
  isTaskCardDisclosureOpen(disclosureState, 'task-2', 'task_attributes'),
  false,
  '任务间不得串用展开状态',
);
disclosureState = exitTaskCardCalibration(disclosureState, 'task-1');
for (const key of ['task_attributes', 'scoring', 'design_rationale', 'formal_resource'] as const) {
  assert.equal(
    isTaskCardDisclosureOpen(disclosureState, 'task-1', key),
    false,
    `退出人工校准后 ${key} 必须收起`,
  );
}

console.log('Product color semantics debug: all assertions passed.');
