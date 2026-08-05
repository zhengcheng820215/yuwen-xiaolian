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
];

async function main(): Promise<void> {
  const source = await readFile(PAGE_PATH, 'utf8');

  for (const token of forbiddenPageTokens) {
    assert.equal(source.includes(token), false, `legacy token remains reachable: ${token}`);
  }
  for (const token of [
    'TaskCandidateDecisionPanel',
    'migrateTaskWorkingContent',
    'discardCurrentTaskWorkingContent',
    '迁移为纠错候选',
    '放弃旧修改',
  ]) {
    assert.equal(source.includes(token), true, `P6 canonical token is missing: ${token}`);
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
