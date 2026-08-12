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
const unifiedLearningEntrySource = readFileSync(
  new URL('../../pages/UnifiedLearningEntry.jsx', import.meta.url),
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
  assert.match(
    block,
    new RegExp(`className=(?:"[^"]*${expectedClass}|\\{\\\`[^\\\`]*${expectedClass})`),
    `${label} 应使用 ${expectedClass}`,
  );
}

const aiActions = [
  [materialWorkbenchSource, 'AI根据素材生成训练任务', 'ai-button-solid'],
  [materialWorkbenchSource, '重新规划整组任务', 'ai-button-outline'],
  [materialWorkbenchSource, '补充生成训练任务', 'ai-button-solid'],
  [questionWorkbenchSource, 'AI 优化题干', 'ai-button-outline'],
  [questionWorkbenchSource, 'AI 优化本项', 'ai-button-outline'],
] as const;

for (const [source, label, expectedClass] of aiActions) {
  assertButtonUsesAiStyle(source, label, expectedClass);
}

const ordinaryActionLabels = [
  '保存任务组修改',
  '采用并保存所选候选',
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
assert.match(taskWorkflowButton, /taskCardAction\.kind === 'adopt_candidate'/, '候选采用并发布动作必须独立识别');
assert.match(taskWorkflowButton, /candidateAdoptButtonClassName/, '采用并发布应复用统一的 AI 紫色主操作样式');
assert.match(
  taskWorkflowButton,
  /taskCardAction\.kind === 'adopt_candidate'[\s\S]*?group-open:hidden/,
  '任务卡展开后必须隐藏首层采用入口，避免与方案区重复执行同一命令',
);
assert.match(taskWorkflowButton, /text-blue-700/, '非 AI 任务生产动作仍应使用蓝色动作样式');
assert.match(
  materialWorkbenchSource,
  /candidateReadyForAdoption[\s\S]*?重新生成题目[\s\S]*?group-open:hidden/,
  '任务卡展开后必须隐藏首层重新生成入口，避免与方案区重复执行同一命令',
);
assert.match(
  materialWorkbenchSource,
  /const candidateRegenerateButtonClassName = 'ai-button-outline inline-flex h-10 w-fit[\s\S]*?whitespace-nowrap[\s\S]*?disabled:opacity-40'/,
  '重新生成题目必须使用统一的 AI 紫色线框次操作样式',
);
assert.match(
  materialWorkbenchSource,
  /const candidateAdoptButtonClassName = 'ai-button-solid inline-flex h-10 w-fit[\s\S]*?whitespace-nowrap[\s\S]*?disabled:opacity-40'/,
  '采用并发布必须使用统一的 AI 紫色实心主操作样式',
);
assert.ok(
  (materialWorkbenchSource.match(/candidateRegenerateButtonClassName/g) || []).length >= 4,
  '折叠态、展开态与失败恢复态必须复用同一重新生成按钮样式',
);
assert.doesNotMatch(
  materialWorkbenchSource,
  />下一步：<\/span>/,
  '任务卡流程动作不得额外显示“下一步”辅助文案',
);

const generatorPreviewStart = materialWorkbenchSource.indexOf('function GeneratorCandidatePreview');
const generatorPreviewEnd = materialWorkbenchSource.indexOf('function CoverageSummary', generatorPreviewStart);
assert.ok(generatorPreviewStart >= 0 && generatorPreviewEnd > generatorPreviewStart, '未找到训练任务生成结果组件');
const generatorPreviewSource = materialWorkbenchSource.slice(generatorPreviewStart, generatorPreviewEnd);
assert.match(generatorPreviewSource, /result\.candidates\.map/, '生成结果必须渲染候选训练任务');
assert.match(generatorPreviewSource, /onClick=\{onAdopt\}/, '生成结果必须提供采用候选入口');
assert.match(generatorPreviewSource, /采用并保存这组候选/, '首批候选必须使用采用并保存语义');
assert.match(generatorPreviewSource, /用候选组替换并保存当前任务组/, '替代候选组必须使用替换并保存语义');
assert.match(generatorPreviewSource, /放弃新候选/, '整组替代的次操作必须明确表达放弃新候选');
assert.doesNotMatch(generatorPreviewSource, /保留当前任务组/, '整组替代不得使用容易被误解为保存的保留文案');
assert.match(generatorPreviewSource, /待采用的补充候选/, '补充候选区必须使用待采用语义');
assert.match(
  generatorPreviewSource,
  /以下候选尚未加入当前任务组，采用并保存后才会进入任务列表。/,
  '补充候选区必须说明候选尚未进入当前任务组',
);
const taskListStart = materialWorkbenchSource.indexOf('<div className="mt-6 space-y-3">');
const supplementSectionStart = materialWorkbenchSource.indexOf('data-supplement-candidate-section');
const groupActionsStart = materialWorkbenchSource.indexOf(
  '<div className="mt-4 flex flex-wrap items-center justify-center gap-2">',
  supplementSectionStart,
);
assert.ok(
  taskListStart >= 0 && supplementSectionStart > taskListStart && groupActionsStart > supplementSectionStart,
  '补充候选区必须位于任务列表之后、任务组操作区之前',
);
const adoptCandidatesStart = materialWorkbenchSource.indexOf('async function adoptCandidates');
const adoptCandidatesEnd = materialWorkbenchSource.indexOf('function discardCandidates', adoptCandidatesStart);
assert.ok(adoptCandidatesStart >= 0 && adoptCandidatesEnd > adoptCandidatesStart, '未找到候选采用并保存流程');
const adoptCandidatesSource = materialWorkbenchSource.slice(adoptCandidatesStart, adoptCandidatesEnd);
assert.match(adoptCandidatesSource, /executeSavePlanRevisionCommand/, '采用候选后必须自动保存 Observation Plan');
assert.match(adoptCandidatesSource, /if \(!saved\)[\s\S]*?当前候选已保留/, '保存失败时必须保留当前候选');
assert.ok(
  adoptCandidatesSource.indexOf('if (!saved)') < adoptCandidatesSource.indexOf('setGeneratorResult(null)'),
  '只有保存成功后才允许关闭候选结果区',
);
assert.match(generatorPreviewSource, /AI 服务调用未完成/, '生成结果必须展示 AI 调用失败状态');
assert.doesNotMatch(generatorPreviewSource, /border-l-4 border-slate-300/, '候选结果区不得使用灰色左侧竖线');
assert.doesNotMatch(generatorPreviewSource, /divide-y divide-slate-200 border-y/, '候选任务之间不得使用灰色横向分割线');
assert.match(generatorPreviewSource, /mt-6 space-y-7/, '候选任务之间必须使用留白分隔');
assert.doesNotMatch(generatorPreviewSource, /推荐训练任务：/, '生成结果不得重复展示推荐任务数量');
assert.doesNotMatch(generatorPreviewSource, /查看生成说明/, '生成结果不得展示面向工程诊断的生成说明');
assert.doesNotMatch(generatorPreviewSource, /生成的题目/, '候选卡片不得使用信息量不足的“生成的题目”标题');
assert.doesNotMatch(generatorPreviewSource, /题目依据：/, '候选卡片不得重复展示题目依据');
assert.match(
  generatorPreviewSource,
  /rounded-md border border-slate-200 bg-slate-50[\s\S]*?候选训练任务 \{index \+ 1\}[\s\S]*?candidate\.questionStem/,
  '候选训练任务标签必须移入题目卡片并位于题干之前',
);
assert.match(generatorPreviewSource, /items-center justify-center gap-3 sm:flex-row/, '候选操作按钮必须居中排列');
assert.ok(
  (generatorPreviewSource.match(/sm:w-\[240px\]/g) || []).length === 2,
  '两个候选操作按钮在非移动端必须分别为 240px 宽',
);
assert.match(
  materialWorkbenchSource,
  /生成时间较长，AI 仍在分析素材，请继续等待，不要重复提交。/,
  '生成耗时较长时必须提供持续等待提示',
);
assert.match(
  materialWorkbenchSource,
  /generatorResultRef\.current\?\.scrollIntoView/,
  '生成完成后必须自动定位到候选结果区',
);
assert.match(
  materialWorkbenchSource,
  /重新生成候选训练任务/,
  '已有候选时必须使用明确的重新生成按钮文案',
);
assert.match(
  materialWorkbenchSource,
  /重新生成会替换当前尚未采用的候选训练任务，是否继续？/,
  '替换未采用候选前必须向用户确认',
);
assert.match(
  materialWorkbenchSource,
  /重新生成会使用新候选替换当前候选，不会修改已保存的训练任务。/,
  '候选区必须说明重新生成的影响范围',
);
assert.match(
  materialWorkbenchSource,
  /正在保存训练任务…[\s\S]*?训练任务已保存，并通过内容检查。[\s\S]*?训练任务保存失败，请根据页面提示检查后重试。/,
  '保存训练任务必须提供进行中、成功和失败的固定位置反馈',
);
assert.match(
  materialWorkbenchSource,
  /<WorkspaceToast[\s\S]*?tone=\{toast\.tone\}/,
  '工作台 Toast 必须呈现保存结果语义',
);
const adoptTaskCandidateStart = materialWorkbenchSource.indexOf('async function adoptTaskCandidate');
const adoptTaskCandidateEnd = materialWorkbenchSource.indexOf('async function correctTaskCandidate', adoptTaskCandidateStart);
assert.ok(adoptTaskCandidateStart >= 0 && adoptTaskCandidateEnd > adoptTaskCandidateStart, '未找到题目采用并发布流程');
const adoptTaskCandidateSource = materialWorkbenchSource.slice(adoptTaskCandidateStart, adoptTaskCandidateEnd);
assert.match(
  adoptTaskCandidateSource,
  /selectedValidation\?\.passed/,
  '采用 Candidate 前必须检查训练计划结构校验结果',
);
assert.match(
  adoptTaskCandidateSource,
  /const candidateWorkingStatus = taskWorkingStates\[trainingTaskId\]\?\.status[\s\S]*?\|\| \(task\.editorDirty \? 'dirty' : 'clean'\)[\s\S]*?workingStatus: candidateWorkingStatus/,
  '采用入口与卡片展示必须使用一致的候选工作状态默认值，避免按钮可见但点击后静默失效',
);
assert.match(
  materialWorkbenchSource,
  /adoptTaskCandidate\(task, selectedTaskCandidate\)/,
  '采用入口必须把界面当前展示的候选明确传给执行函数，避免二次投影造成可见候选丢失',
);
assert.ok(
  adoptTaskCandidateSource.indexOf('executeConfirmTrainingPlanForTaskProductionCommand')
    < adoptTaskCandidateSource.indexOf('adoptQuestionTaskCandidate'),
  '训练计划提交与审核必须发生在 Candidate Adopt 之前',
);
assert.match(
  materialWorkbenchSource,
  /const planCanPrepareForPublication = Boolean\([\s\S]*?selectedValidation\?\.passed[\s\S]*?const candidateReadyForAdoption = Boolean\([\s\S]*?planCanPrepareForPublication/,
  '“可以发布”状态必须消费训练计划发布准备门禁',
);
assert.match(
  materialWorkbenchSource,
  /const candidateReadyForDecision = Boolean\([\s\S]*?planCanPrepareForPublication[\s\S]*?TaskQuestionLifecycleBadge[\s\S]*?presentation=\{taskCardPresentationWithPlanGate\}/,
  '普通采用与提醒确认入口都必须服从同一 Plan 发布准备门禁',
);

const candidatePreviewStart = materialWorkbenchSource.indexOf('function CandidateContentPreview');
const candidatePreviewEnd = materialWorkbenchSource.indexOf(
  'function TaskQualityWarningSummary',
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
  /能力：|最低字数：|评分项：|变化：|generationReason|candidateTypeLabel/,
  '候选预览不得展示能力代码、工程统计、生成说明或重复的 AI 来源标签',
);
const warningSummarySource = materialWorkbenchSource.slice(
  materialWorkbenchSource.indexOf('function TaskQualityWarningSummary'),
  materialWorkbenchSource.indexOf('function MaterialContentPreview'),
);
assert.doesNotMatch(
  warningSummarySource,
  /项需要判断/,
  '质量提醒区不得重复显示提醒数量',
);
assert.match(
  materialWorkbenchSource,
  /<span>\{taskQualityWarningMessage\(warning\)\}<\/span>/,
  '统一工作台的质量提醒必须经过用户文案投影',
);
assert.match(
  materialWorkbenchSource,
  /warning\.check === 'difficultyCoherence'[\s\S]*?题目难度可能需要调整/,
  '历史难度一致性提醒必须映射为直白的用户文案',
);
assert.doesNotMatch(
  warningSummarySource,
  /<span>\{warning\.message\}<\/span>/,
  '质量提醒列表不得直接渲染历史 message',
);
assert.match(
  warningSummarySource,
  /点击“生成优化题目”获得可比较方案；选择合适方案后，点击“确认并发布”完成确认。/,
  '质量提醒区必须说明如何完成确认',
);
assert.match(
  materialWorkbenchSource,
  /const qualityWarningCandidateMissing = pendingQualityWarnings\.length > 0[\s\S]*?taskCandidateProjection\.readyCandidates\.length === 0[\s\S]*?label: '生成优化题目'/,
  '质量提醒缺少候选时必须提供生成优化题目入口',
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
  /<TaskQuestionLifecycleBadge[\s\S]*?presentation=\{taskCardPresentationWithPlanGate\}[\s\S]*?candidateReady=\{candidateReadyForAdoption\}/,
  '任务卡状态徽标必须消费统一展示投影及 Plan 发布准备门禁',
);
assert.match(
  materialWorkbenchSource,
  /aria-label="训练任务标题与状态"[\s\S]*?<TaskQuestionLifecycleBadge[\s\S]*?presentation=\{taskCardPresentationWithPlanGate\}/,
  '任务卡首层应只保留任务标题与状态标签',
);
assert.match(
  materialWorkbenchSource,
  /qualityWarningCount > 0 \? \{[\s\S]*?visibleStatusLabel: '需要确认'[\s\S]*?candidateReady \? \{[\s\S]*?visibleStatusLabel: '可以发布'/,
  '任务卡必须区分需要确认与可以发布，避免相同标签对应不同操作',
);
assert.match(
  materialWorkbenchSource,
  /const candidateActionRequired = Boolean\([\s\S]*?!isPublishedTask[\s\S]*?adoptionResult\?\.visibleState === 'action_required'/,
  '已发布任务不得被历史候选处理状态覆盖为需要处理',
);
assert.match(
  materialWorkbenchSource,
  /adoptionResult\.visibleState === 'published'[\s\S]*?updateTaskCandidatePanel\(trainingTaskId,[\s\S]*?adoptionResult: null/,
  '发布成功后必须清理候选采用的临时处理状态',
);
assert.match(
  materialWorkbenchSource,
  /qualityWarningCount=\{pendingQualityWarnings\.length\}/,
  '任务卡状态标签必须读取当前质量提醒数量',
);
assert.match(
  materialWorkbenchSource,
  /visibleStatusLabel = resolvedPresentation\.visibleStatusLabel/,
  '任务卡徽标必须优先使用统一三态投影',
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
  /className="col-span-2 row-start-4 flex min-w-0 items-baseline gap-2 sm:row-start-3"[\s\S]*?line-clamp-2 group-open:line-clamp-none[\s\S]*?>展开详情<[\s\S]*?>收起详情</,
  '折叠态题目最多显示两行，展开态必须显示完整题目并保留收起入口',
);
assert.doesNotMatch(
  materialWorkbenchSource,
  /line-clamp-2 text-sm leading-6 group-open:hidden/,
  '展开任务卡时不得隐藏题目正文',
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
const publishedReadonlyStart = materialWorkbenchSource.indexOf('data-published-resource-readonly');
const publishedReadonlyEnd = materialWorkbenchSource.indexOf(
  '{pendingQualityWarnings.length > 0',
  publishedReadonlyStart,
);
assert.ok(publishedReadonlyStart >= 0 && publishedReadonlyEnd > publishedReadonlyStart, '未找到已发布资源摘要区');
assert.doesNotMatch(
  materialWorkbenchSource.slice(publishedReadonlyStart, publishedReadonlyEnd),
  /查看正式资源/,
  '已展开的正式资源摘要区不得重复显示查看正式资源入口',
);
assert.doesNotMatch(
  materialWorkbenchSource,
  /open=\{!isPublishedTask[\s\S]*?pendingQualityWarnings\.length > 0/,
  '任务卡不得因待处理问题或质量提醒自动展开',
);
assert.match(
  materialWorkbenchSource,
  /pendingQualityWarnings\.length > 0[\s\S]*?taskProductionAction\?\.kind === 'open_confirmation'[\s\S]*?\? null/,
  '质量提醒已有具体标签和展开入口时，不应重复显示同义操作',
);
assert.match(
  materialWorkbenchSource,
  /const isPublishedTask = questionLifecycle\?\.productionView\?\.state === 'published'/,
  '任务卡必须显式识别已发布只读状态',
);
assert.match(
  materialWorkbenchSource,
  /const hasFormalVersionCandidate = taskCandidateProjection\.readyCandidates\.some/,
  '已发布任务只能通过明确绑定正式版本的新版 Candidate 打开决策区',
);
assert.match(
  materialWorkbenchSource,
  /const showTaskCandidatePanel = \(!isPublishedTask \|\| hasFormalVersionCandidate\) &&/,
  '普通历史 Candidate 不得在已发布任务下继续显示',
);
assert.match(
  materialWorkbenchSource,
  /data-published-resource-readonly[\s\S]*?>正式资源已冻结<[\s\S]*?>当前学习将继续使用此版本。</,
  '已发布任务展开后必须展示冻结说明',
);
assert.match(
  materialWorkbenchSource,
  /'生成新版方案'/,
  '已发布任务必须以独立新版 Candidate 入口替代直接编辑',
);
assert.match(
  materialWorkbenchSource,
  /\{!isPublishedTask && \([\s\S]*?aria-label=\{`删除\$\{taskEditorTitle\(index\)\}`\}/,
  '已发布任务不得继续显示删除或编辑链入口',
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
const taskRationaleIndex = materialWorkbenchSource.indexOf("open={taskDisclosureOpen('task_rationale')}");
const formalResourceIndex = materialWorkbenchSource.indexOf("open={taskDisclosureOpen('formal_resource')}");
assert.ok(
  taskRationaleIndex >= 0 && taskRationaleIndex < formalResourceIndex,
  '任务卡低频信息必须先收进任务依据，正式资源只读区随后独立展示',
);
const taskRationaleSource = materialWorkbenchSource.slice(taskRationaleIndex, formalResourceIndex);
assert.match(taskRationaleSource, />查看任务依据</, '任务依据折叠区必须保留审核所需信息');
assert.match(taskRationaleSource, />能力目标</, '任务依据中必须保留能力目标');
assert.match(taskRationaleSource, />学生任务</, '任务依据中必须保留学生任务');
assert.match(taskRationaleSource, />观察目标</, '任务依据中必须保留观察目标');
assert.match(taskRationaleSource, />评分标准</, '任务依据中必须保留评分标准');
assert.match(taskRationaleSource, /label="作答要求"/, '评分标准必须外显学生作答要求');
assert.match(taskRationaleSource, />设计依据</, '任务依据中必须保留设计依据');
assert.doesNotMatch(
  taskRationaleSource,
  /<Select\b|<input\b|<textarea\b|<button\b/,
  '任务依据不得继续伪装为可编辑表单',
);
assert.doesNotMatch(
  materialWorkbenchSource,
  /<fieldset disabled/,
  '任务详情不得再使用 disabled fieldset 模拟只读展示',
);
assert.match(
  materialWorkbenchSource,
  /open=\{taskDisclosureOpen\('task_rationale'\)\}/,
  '任务依据必须消费当前任务的受控展开状态',
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
assert.match(
  materialWorkbenchSource,
  /resolveTaskCardDecisionAction\(\{[\s\S]*?fallbackAction: candidateAwareFallbackAction/,
  '任务卡主操作必须通过单一决策投影解析',
);
assert.match(
  materialWorkbenchSource,
  /operation: current\[trainingTaskId\]\?\.operation \|\| 'loading_candidates'/,
  '后台候选刷新不得把已有任务统一改写为候选加载态',
);
assert.match(
  materialWorkbenchSource,
  /const taskCardFeedback = workflowFeedback \|\|[\s\S]*?taskCandidatePanel\.error[\s\S]*?role=\{\(taskCardFeedback/,
  'Candidate 主操作失败必须在任务卡摘要区外显',
);
assert.match(
  unifiedLearningEntrySource,
  /const nextEntry = await startOrResumeUnifiedLearning\(\);[\s\S]*?setEntry\(nextEntry\);[\s\S]*?if \(nextEntry\.canEnterWorkspace\)/,
  'Learning 开始入口必须消费命令返回的最新状态后再进入工作区',
);

let disclosureState = {};
for (const key of ['task_rationale', 'formal_resource'] as const) {
  assert.equal(
    isTaskCardDisclosureOpen(disclosureState, 'task-1', key),
    false,
    `${key} 初始必须收起`,
  );
}
disclosureState = setTaskCardDisclosureOpen(disclosureState, 'task-1', 'task_rationale', true);
assert.equal(isTaskCardDisclosureOpen(disclosureState, 'task-1', 'task_rationale'), true);
disclosureState = setTaskCardDisclosureOpen(disclosureState, 'task-1', 'task_rationale', false);
assert.equal(
  isTaskCardDisclosureOpen(disclosureState, 'task-1', 'task_rationale'),
  false,
  '任务卡手动收起任务依据后必须保持收起',
);
assert.equal(
  isTaskCardDisclosureOpen(disclosureState, 'task-2', 'task_rationale'),
  false,
  '任务间不得串用展开状态',
);
console.log('Product color semantics debug: all assertions passed.');
