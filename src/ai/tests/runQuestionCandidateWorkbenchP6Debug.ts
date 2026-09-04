import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolveLegacyWorkflowExitAudit } from
  '../../pages/questionCandidateLegacyClosureState.ts';
import { resolveCandidatePanelProjection } from
  '../../pages/questionCandidateWorkbenchState.ts';

const PAGE_PATH = fileURLToPath(new URL(
  '../../pages/MaterialResourceProductionWorkbench.jsx',
  import.meta.url,
));

const API_PATH = fileURLToPath(new URL(
  '../../api/questionResourceWorkbench.ts',
  import.meta.url,
));

const MATERIAL_API_PATH = fileURLToPath(new URL(
  '../../api/materialResourceProductionWorkbench.ts',
  import.meta.url,
));

const forbiddenPageTokens = [
  'candidateWorkflowEnabled',
  'QUESTION_CANDIDATE_WORKFLOW_STORAGE_KEY',
  'legacyCandidateTaskIds',
  'enableTaskEditing',
  'saveCurrentTaskWorkingContent',
  'reapplyCurrentTaskWorkingContent',
  'submitWorkingTaskChanges',
  'mergeWorkingContentIntoEditableTask',
  'saveQuestionTaskWorkingContent',
  'rebaseQuestionTaskWorkingContent',
  'commitQuestionTaskWorkingChanges',
  '人工编辑校准',
  '退出人工校准',
  '继续处理旧修改',
  '提交前请确认质量提醒',
  '请填写质量提醒的保留理由',
  '说明保留当前设置的理由',
  '已查看质量提醒，确认保留当前版本并继续发布。',
  'label="待最终确认"',
  'label="已确认（待发布）"',
  'label="需处理"',
  'label="待采用"',
  'pendingPublication: summary.total - summary.published',
  '接受提醒并发布',
  'acceptCurrentWarnings: true',
  '用户已查看当前质量提醒，并明确选择保留当前题目。',
  "busy ? '正在发布…' : '接受提醒并发布'",
  '生成优化方案',
  '题目已采用，仍有质量提醒需要处理',
  '放弃本轮方案',
  'onDiscardBatch',
  'TaskProductionWorkflowPanel',
  'TaskWarningRetentionDialog',
  'hasCandidateDecision={hasCandidateDecision}',
  'data-quality-warning-decision-mode="candidate"',
  'data-quality-warning-decision-mode="fallback"',
  '保存任务组修改',
  '采用并保存',
  '放弃候选',
  'aria-label={`选择补充候选任务',
  "reviewerId: 'local-reviewer'",
  '请处理后重试',
  '重新生成会替换当前尚未采用的候选训练任务，是否继续？',
  'materialForm.description',
  '>来源说明<',
];

async function main(): Promise<void> {
  const [source, apiSource, materialApiSource] = await Promise.all([
    readFile(PAGE_PATH, 'utf8'),
    readFile(API_PATH, 'utf8'),
    readFile(MATERIAL_API_PATH, 'utf8'),
  ]);

  for (const token of forbiddenPageTokens) {
    assert.equal(source.includes(token), false, `legacy token remains reachable: ${token}`);
  }
  for (const token of [
    'TaskCandidateDecisionPanel',
    'migrateTaskWorkingContent',
    'discardCurrentTaskWorkingContent',
    '迁移为纠错候选',
    '放弃旧修改',
    'showTaskCandidatePanel',
    '当前任务使用既有题目版本',
    'resolveTaskGroupTopLevelSummary(taskQuestionLifecycleSummary)',
    'candidatePanelOptionLabel(candidate, projection.readyCandidates)',
    "candidate.candidateOrigin === 'training_task_compatibility_wrap'",
    '重新生成题目',
    'TaskQualityWarningSummary',
    'data-task-candidate-decision',
    'candidateReadyForDecision',
    "reasonSource: 'fixed'",
    "structuredReason: 'selected_candidate_with_warning'",
    '可直接采用当前方案；如不满意，点击“重新生成题目”让 AI 继续优化。',
    'qualityWarningCandidateMissing',
    '当前方案包含质量提醒；系统将按本次采用选择继续发布。',
    '采用当前任务方案',
    '重新生成任务方案',
    "reviewerId: 'local-entry-operator'",
    '系统会从中断位置自动重试',
    '补充版权信息（可选）',
    '仅在已有明确版权说明时填写；留空不会阻断素材保存和内部校准。',
  ]) {
    assert.equal(source.includes(token), true, `P6 canonical token is missing: ${token}`);
  }
  assert.match(
    source,
    /if \(adoptionResult\.visibleState === 'published'\) \{\s*await synchronizeProductionObservationLinks\(selectedPlan\.materialObservationPlanId\);\s*await refresh\(\{\s*materialVersionId: selectedMaterial\.materialVersionId,\s*planId: selectedPlan\.materialObservationPlanId,/,
    'published adoption must synchronize Active Links and refresh the current material and plan snapshot before rendering success',
  );
  assert.equal(
    source.includes("if (selectedPlan.status !== 'reviewed')"),
    false,
    'candidate adoption must not bypass the authority continuation command when the page shows reviewed',
  );
  assert.equal(
    (source.match(/executeConfirmTrainingPlanForTaskProductionCommand\(\{/g) || []).length >= 2,
    true,
    'candidate adoption and existing task publication must share the authority continuation command',
  );
  for (const token of [
    '训练计划状态已同步，正在继续发布…',
    'data-plan-continuation-code={taskCardFeedback.continuationCode || undefined}',
    'taskCardFeedback.recoveryMessage',
  ]) {
    assert.equal(source.includes(token), true, `P1 continuation projection is missing: ${token}`);
  }
  assert.equal(
    source.includes('错误码：{taskCardFeedback.errorCode}'),
    false,
    'content operator feedback must not expose an internal error code on the workbench surface',
  );
  for (const token of [
    "reasonSource?: 'fixed' | 'generated' | 'manual'",
    'structuredReason?: string',
    "reasonSource: acknowledgement?.reasonSource || 'fixed'",
    'structuredReason: acknowledgement?.structuredReason || acknowledgement?.rationale ||',
  ]) {
    assert.equal(apiSource.includes(token), true, `warning audit contract is missing: ${token}`);
  }
  assert.match(
    materialApiSource,
    /description\?: string;[\s\S]*?description: input\.description\?\.trim\(\) \|\| '系统自动记录：人工录入'/,
    '人工录入素材必须由系统自动形成来源记录，来源说明不得成为必填输入',
  );

  assert.deepEqual(resolveLegacyWorkflowExitAudit(exitFixture()), {
    status: 'ready',
    blockingReasons: [],
    migrationItemCount: 0,
  });
  assert.equal(resolveLegacyWorkflowExitAudit({
    ...exitFixture(),
    protectedWorkingContentCount: 2,
  }).status, 'migration_required');
  assert.deepEqual(resolveLegacyWorkflowExitAudit({
    ...exitFixture(),
    reachableLegacyHandlerCount: 1,
    unprotectedWorkingContentCount: 1,
  }).blockingReasons, [
    'reachable_legacy_handlers',
    'unprotected_working_content',
  ]);

  const projection = resolveCandidatePanelProjection({
    candidates: [],
    context: {
      materialVersionId: 'material:v1',
      observationPlanVersion: 'plan:v1',
      trainingTaskVersion: 'task:v1',
      activeDraftId: 'draft-1',
      activeDraftRevision: 1,
      activeDraftContentHash: 'hash-1',
    },
    workingStatus: 'migration_required',
  });
  assert.equal(projection.showsLegacyRecovery, true);

  console.log('Question Candidate Workbench P6 Debug');
  console.log('PASS canonical candidate workflow is the only reachable production path');
  console.log('PASS exit audit resolves ready, migration_required, and blocked');
  console.log('PASS historical working content exposes migration recovery');
  console.log('PASS published adoption refreshes the task-card formal resource state');
  console.log('PASS both publication entries use authority continuation and structured feedback');
}

function exitFixture() {
  return {
    canonicalCandidateWorkflow: true,
    reachableLegacyEntryCount: 0,
    reachableLegacyHandlerCount: 0,
    candidateFeatureFlagCount: 0,
    workingContentMergedIntoForm: false,
    migratableWorkingContentCount: 0,
    protectedWorkingContentCount: 0,
    unprotectedWorkingContentCount: 0,
  };
}

void main();
