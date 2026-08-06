import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
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
  [materialWorkbenchSource, '重新规划整组任务', 'ai-button-outline'],
  [materialWorkbenchSource, '补充生成训练任务', 'ai-button-solid'],
  [materialWorkbenchSource, 'AI 优化', 'ai-button-outline'],
  [materialWorkbenchSource, '生成优化题目', 'ai-button-solid'],
  [materialWorkbenchSource, '重新生成题目', 'ai-button-outline'],
  [materialWorkbenchSource, '采用所选候选', 'ai-button-solid'],
  [questionWorkbenchSource, 'AI 优化题干', 'ai-button-outline'],
  [questionWorkbenchSource, 'AI 优化本项', 'ai-button-outline'],
] as const;

for (const [source, label, expectedClass] of aiActions) {
  assertButtonUsesAiStyle(source, label, expectedClass);
}

const ordinaryActionLabels = [
  '保存任务组修改',
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

const savePlanButton = findButton(materialWorkbenchSource, '保存任务组修改');
assert.match(savePlanButton, /bg-blue-700/, '保存任务组修改应使用蓝色主操作样式');
assert.doesNotMatch(savePlanButton, /bg-emerald-|border-emerald-|text-emerald-/, '保存任务组修改不得使用绿色操作样式');
assert.match(
  materialWorkbenchSource,
  /\{taskEditorDirty && \([\s\S]*?保存任务组修改/,
  '保存任务组修改仅应在任务组存在未保存变化时显示',
);

const removeTaskButton = findButton(materialWorkbenchSource, '删除任务');
assert.match(removeTaskButton, /border-red-600/, '删除任务应使用标准红色线框');
assert.match(removeTaskButton, /text-red-700/, '删除任务应使用标准危险操作字色');
assert.match(removeTaskButton, /hover:bg-red-50/, '删除任务悬停时应使用浅红色背景');
assert.match(removeTaskButton, /<Trash2 size=\{16\}/, '删除任务应保留删除图标');

const taskWorkflowButton = buttonBlocks(materialWorkbenchSource)
  .find((candidate) => candidate.includes('taskCardAction.label'));
assert.ok(taskWorkflowButton, '未找到任务卡统一生产动作按钮');
assert.match(taskWorkflowButton, /taskCardAction\.kind === 'generate_candidate'/, '题目候选生成动作必须独立识别');
assert.match(taskWorkflowButton, /ai-button-solid/, '题目候选生成动作应使用 AI 紫色主操作样式');
assert.match(taskWorkflowButton, /text-blue-700/, '非 AI 任务生产动作仍应使用蓝色动作样式');
assert.doesNotMatch(
  materialWorkbenchSource,
  />下一步：<\/span>/,
  '任务卡流程动作不得额外显示“下一步”辅助文案',
);

const candidatePreviewStart = materialWorkbenchSource.indexOf('function CandidateContentPreview');
const candidatePreviewEnd = materialWorkbenchSource.indexOf(
  'function TaskProductionWorkflowPanel',
  candidatePreviewStart,
);
assert.ok(candidatePreviewStart >= 0 && candidatePreviewEnd > candidatePreviewStart, '未找到候选内容预览组件');
const candidatePreviewSource = materialWorkbenchSource.slice(candidatePreviewStart, candidatePreviewEnd);
assert.match(
  candidatePreviewSource,
  />作答要求：<\/span>[\s\S]*?不少于 \{minimumAnswerLength\} 字/,
  '候选预览必须直接外显用户可理解的最低作答要求',
);
assert.doesNotMatch(
  candidatePreviewSource,
  /能力：|最低字数：|评分项：|变化：|generationReason/,
  '候选预览不得展示能力代码、工程统计或生成说明',
);

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
  /<TaskQuestionLifecycleBadge[\s\S]*?presentation=\{taskCardPresentation\}[\s\S]*?candidateReady=\{candidateReadyForAdoption\}/,
  '任务卡状态徽标必须直接消费统一展示投影',
);
assert.match(
  materialWorkbenchSource,
  /aria-label="训练任务标题与状态"[\s\S]*?<TaskQuestionLifecycleBadge[\s\S]*?presentation=\{taskCardPresentation\}/,
  '任务卡首层应只保留任务标题与状态标签',
);
assert.match(
  materialWorkbenchSource,
  /stateLabel: '题目待采用'[\s\S]*?tone: 'candidate'/,
  '已有完整题目但尚未采用时必须显示“题目待采用”，不得继续显示“未生成题目”',
);
assert.doesNotMatch(
  materialWorkbenchSource,
  /<TaskSourceBadge|>来源：</,
  '任务卡首层不应展示默认 AI 来源信息',
);
assert.match(
  materialWorkbenchSource,
  /<summary className="grid cursor-pointer list-none grid-cols-\[minmax\(0,1fr\)_auto\][^"\n]*">/,
  '任务卡头部必须形成任务信息与主操作两列网格',
);
assert.doesNotMatch(
  materialWorkbenchSource,
  /sm:grid-cols-\[minmax\(0,1fr\)_auto_auto\]/,
  '展开入口移到题目摘要后，不应继续占据独立第三列',
);
assert.match(
  materialWorkbenchSource,
  /className="col-span-2 row-start-3[^"\n]*sm:col-start-2 sm:row-start-1[^"\n]*"[\s\S]*?aria-label="训练任务流程操作"/,
  '任务卡主操作必须在桌面端位于第一行中部操作区',
);
assert.match(
  materialWorkbenchSource,
  /className="col-span-2 row-start-4 flex min-w-0 items-baseline gap-2 sm:row-start-3"[\s\S]*?line-clamp-2[\s\S]*?>展开详情<[\s\S]*?>收起详情</,
  '展开与收起入口必须以蓝色文字紧跟题目摘要，并避免被长题目挤出',
);
assert.match(
  materialWorkbenchSource,
  /data-task-production-state=\{questionLifecycle\?\.productionView\?\.state \|\| 'unknown'\}/,
  '任务卡必须暴露统一生产状态供端到端验收',
);
assert.match(
  materialWorkbenchSource,
  /data-task-production-action=\{taskCardAction\?\.kind \|\| 'none'\}/,
  '任务卡必须暴露唯一主操作供端到端验收',
);
assert.match(
  materialWorkbenchSource,
  /taskCardAction\.kind !== 'view_formal_resource'/,
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
const trainingTargetSource = materialWorkbenchSource.slice(taskAttributeIndex, scoringIndex);
const scoringSource = materialWorkbenchSource.slice(scoringIndex, designRationaleIndex);
assert.match(trainingTargetSource, />训练目标</, '任务属性区应以用户可理解的“训练目标”命名');
assert.doesNotMatch(
  trainingTargetSource,
  /<Select\b|<input\b|<textarea\b|调整任务属性/,
  '训练目标区不得保留冻结表单或编辑型命名',
);
assert.match(scoringSource, />评分标准与答案示例</, '评分区必须保留审核所需信息');
assert.match(scoringSource, /label="作答要求"/, '评分区必须外显学生作答要求');
assert.doesNotMatch(
  scoringSource,
  /<Select\b|<input\b|<textarea\b|<button\b/,
  '评分区不得继续伪装为可编辑表单',
);
assert.doesNotMatch(
  materialWorkbenchSource,
  /<fieldset disabled/,
  '任务详情不得再使用 disabled fieldset 模拟只读展示',
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
disclosureState = setTaskCardDisclosureOpen(disclosureState, 'task-1', 'task_attributes', true);
assert.equal(isTaskCardDisclosureOpen(disclosureState, 'task-1', 'task_attributes'), true);
disclosureState = setTaskCardDisclosureOpen(disclosureState, 'task-1', 'scoring', false);
assert.equal(
  isTaskCardDisclosureOpen(disclosureState, 'task-1', 'scoring'),
  false,
  '任务卡手动收起评分标准后必须保持收起',
);
assert.equal(
  isTaskCardDisclosureOpen(disclosureState, 'task-2', 'task_attributes'),
  false,
  '任务间不得串用展开状态',
);
console.log('Product color semantics debug: all assertions passed.');
