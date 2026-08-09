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
];

async function main(): Promise<void> {
  const [source, apiSource] = await Promise.all([
    readFile(PAGE_PATH, 'utf8'),
    readFile(API_PATH, 'utf8'),
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
    '生成新一轮方案',
    'TaskQualityWarningSummary',
    'data-task-candidate-decision',
    "reasonSource: 'fixed'",
    "structuredReason: 'selected_candidate_with_warning'",
    '请比较当前方案与 AI 新方案，选择合适方案后采用并发布。',
    '当前题目有质量提醒，请在题目方案区继续处理。',
  ]) {
    assert.equal(source.includes(token), true, `P6 canonical token is missing: ${token}`);
  }
  assert.match(
    source,
    /if \(adoptionResult\.visibleState === 'published'\) \{\s*await refresh\(\{\s*materialVersionId: selectedMaterial\.materialVersionId,\s*planId: selectedPlan\.materialObservationPlanId,/,
    'published adoption must refresh the current material and plan snapshot before rendering success',
  );
  for (const token of [
    "reasonSource?: 'fixed' | 'generated' | 'manual'",
    'structuredReason?: string',
    "reasonSource: acknowledgement?.reasonSource || 'fixed'",
    'structuredReason: acknowledgement?.structuredReason || acknowledgement?.rationale ||',
  ]) {
    assert.equal(apiSource.includes(token), true, `warning audit contract is missing: ${token}`);
  }

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
