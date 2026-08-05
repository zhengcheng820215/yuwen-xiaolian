import assert from 'node:assert/strict';
import {
  commitTaskGroupChanges,
  TaskGroupSubmissionConflictError,
  type CommitTaskGroupChangesDependencies,
  type TaskDraftSnapshot,
} from '../agents/taskGroupSubmissionService.ts';
import { InMemoryTaskGroupSubmissionRepository } from '../repositories/inMemoryTaskGroupSubmissionRepository.ts';

await testIndependentTaskSubmission();
await testNoChangesSubmission();
await testConflictBlocksSubmission();
await testPartialRevisionFailureRecovery();
await testCompleteRevisionFailureRecovery();
await testTaskAssessmentRecovery();
await testGroupAssessmentRecovery();

console.log('Task group submission debug passed.');

async function testIndependentTaskSubmission() {
  const fixture = createFixture();
  const first = await fixture.commit(['task-1'], 'submit:task-1');

  assert.equal(first.status, 'completed');
  assert.equal(fixture.drafts.get('task-1')?.revision, 2);
  assert.equal(fixture.drafts.get('task-2')?.revision, 1);
  assert.equal(fixture.workingTaskIds.has('task-1'), false);
  assert.equal(fixture.workingTaskIds.has('task-2'), true);
  assert.deepEqual(fixture.lastGroupBindings.map((item) => item.trainingTaskId), [
    'task-1',
    'task-2',
  ]);

  const repeated = await fixture.commit(['task-1'], 'submit:task-1');
  assert.equal(repeated.submissionId, first.submissionId);
  assert.equal(fixture.drafts.get('task-1')?.revision, 2);
  assert.equal(fixture.revisionCreationCount.get('task-1'), 1);
}

async function testNoChangesSubmission() {
  const fixture = createFixture();
  fixture.noChangeTaskIds.add('task-1');
  const result = await fixture.commit(['task-1'], 'submit:no-change');

  assert.equal(result.status, 'no_changes');
  assert.equal(fixture.drafts.get('task-1')?.revision, 1);
  assert.equal((await fixture.repository.list()).length, 0);
  assert.equal(fixture.workingTaskIds.has('task-1'), false);
}

async function testConflictBlocksSubmission() {
  const fixture = createFixture();
  fixture.conflictTaskIds.add('task-1');

  await assert.rejects(
    fixture.commit(['task-1'], 'submit:conflict'),
    (error) => error instanceof TaskGroupSubmissionConflictError
      && error.trainingTaskIds.includes('task-1'),
  );
  assert.equal(fixture.revisionCreationCount.get('task-1') || 0, 0);
}

async function testPartialRevisionFailureRecovery() {
  const fixture = createFixture();
  fixture.revisionFailureCount.set('task-2', 1);
  const first = await fixture.commit(['task-1', 'task-2'], 'submit:partial-revision');

  assert.equal(first.status, 'partially_failed');
  assert.equal(first.groupAssessmentStatus, 'not_started');
  assert.equal(fixture.drafts.get('task-1')?.revision, 2);
  assert.equal(fixture.drafts.get('task-2')?.revision, 1);
  assert.equal(fixture.workingTaskIds.has('task-1'), false);
  assert.equal(fixture.workingTaskIds.has('task-2'), true);
  assert.equal(fixture.groupAssessmentCount, 0);

  const retried = await fixture.commit(
    ['task-1', 'task-2'],
    'submit:partial-revision',
  );
  assert.equal(retried.status, 'completed');
  assert.equal(retried.submissionId, first.submissionId);
  assert.equal(fixture.drafts.get('task-1')?.revision, 2);
  assert.equal(fixture.drafts.get('task-2')?.revision, 2);
  assert.equal(fixture.revisionCreationCount.get('task-1'), 1);
  assert.equal(fixture.revisionCreationCount.get('task-2'), 1);
  assert.equal(fixture.groupAssessmentCount, 1);
}

async function testCompleteRevisionFailureRecovery() {
  const fixture = createFixture();
  fixture.revisionFailureCount.set('task-1', 1);
  fixture.revisionFailureCount.set('task-2', 1);
  const first = await fixture.commit(['task-1', 'task-2'], 'submit:all-revision-failed');

  assert.equal(first.status, 'partially_failed');
  assert.equal(first.groupAssessmentStatus, 'not_started');
  assert.equal(fixture.workingTaskIds.has('task-1'), true);
  assert.equal(fixture.workingTaskIds.has('task-2'), true);
  assert.equal((await fixture.repository.list()).length, 1);

  const retried = await fixture.commit(
    ['task-1', 'task-2'],
    'submit:all-revision-failed',
  );
  assert.equal(retried.status, 'completed');
  assert.equal(fixture.drafts.get('task-1')?.revision, 2);
  assert.equal(fixture.drafts.get('task-2')?.revision, 2);
}

async function testTaskAssessmentRecovery() {
  const fixture = createFixture();
  fixture.taskAssessmentFailureCount.set('task-1', 1);
  const first = await fixture.commit(['task-1'], 'submit:assessment-failed');

  assert.equal(first.status, 'partially_failed');
  assert.equal(first.taskResults[0]?.failedStage, 'quality_assessment');
  assert.equal(fixture.drafts.get('task-1')?.revision, 2);
  assert.equal(fixture.workingTaskIds.has('task-1'), false);

  const retried = await fixture.commit(['task-1'], 'submit:assessment-failed');
  assert.equal(retried.status, 'completed');
  assert.equal(fixture.drafts.get('task-1')?.revision, 2);
  assert.equal(fixture.revisionCreationCount.get('task-1'), 1);
  assert.equal(fixture.taskAssessmentCount.get('task-1'), 2);
}

async function testGroupAssessmentRecovery() {
  const fixture = createFixture();
  fixture.groupAssessmentFailureCount = 1;
  const first = await fixture.commit(['task-1'], 'submit:group-check-failed');

  assert.equal(first.status, 'partially_failed');
  assert.equal(first.groupAssessmentStatus, 'failed');
  assert.equal(fixture.drafts.get('task-1')?.revision, 2);

  const retried = await fixture.commit(['task-1'], 'submit:group-check-failed');
  assert.equal(retried.status, 'completed');
  assert.equal(fixture.drafts.get('task-1')?.revision, 2);
  assert.equal(fixture.revisionCreationCount.get('task-1'), 1);
  assert.equal(fixture.taskAssessmentCount.get('task-1'), 1);
  assert.equal(fixture.groupAssessmentCount, 2);
}

function createFixture() {
  const repository = new InMemoryTaskGroupSubmissionRepository();
  const drafts = new Map<string, TaskDraftSnapshot>([
    ['task-1', draft('task-1')],
    ['task-2', draft('task-2')],
  ]);
  const workingTaskIds = new Set(['task-1', 'task-2']);
  const conflictTaskIds = new Set<string>();
  const noChangeTaskIds = new Set<string>();
  const revisionFailureCount = new Map<string, number>();
  const taskAssessmentFailureCount = new Map<string, number>();
  const revisionCreationCount = new Map<string, number>();
  const taskAssessmentCount = new Map<string, number>();
  let groupAssessmentFailureCount = 0;
  let groupAssessmentCount = 0;
  let lastGroupBindings: TaskDraftSnapshot[] = [];

  const dependencies: CommitTaskGroupChangesDependencies = {
    submissionRepository: repository,
    getWorkingState: async (trainingTaskId) => {
      if (conflictTaskIds.has(trainingTaskId)) {
        return {
          status: 'base_revision_conflict',
          workingContent: {} as never,
          reason: 'revision_changed',
          activeDraftId: `${trainingTaskId}:draft:v2`,
          activeRevision: 2,
          activeContentHash: `${trainingTaskId}:hash:v2`,
        };
      }
      return workingTaskIds.has(trainingTaskId)
        ? { status: 'current', workingContent: {} as never }
        : { status: 'missing', workingContent: null };
    },
    listTaskDrafts: async () => [...drafts.values()].map((item) => ({ ...item })),
    commitWorkingChanges: async (submission) => {
      const failedTaskIds: string[] = [];
      for (const trainingTaskId of submission.requestedTaskIds) {
        const result = submission.taskResults.find(
          (item) => item.trainingTaskId === trainingTaskId,
        );
        if (result?.revisionCreated || noChangeTaskIds.has(trainingTaskId)) continue;
        if (consumeFailure(revisionFailureCount, trainingTaskId)) {
          failedTaskIds.push(trainingTaskId);
          continue;
        }
        const current = drafts.get(trainingTaskId);
        assert(current);
        const nextRevision = current.revision + 1;
        drafts.set(trainingTaskId, {
          trainingTaskId,
          draftId: `${trainingTaskId}:draft:v${nextRevision}`,
          revision: nextRevision,
          contentHash: `${trainingTaskId}:hash:v${nextRevision}`,
        });
        revisionCreationCount.set(
          trainingTaskId,
          (revisionCreationCount.get(trainingTaskId) || 0) + 1,
        );
      }
      return { committedPlanId: 'plan:committed', failedTaskIds };
    },
    completeTaskAssessment: async (draftId) => {
      const trainingTaskId = draftId.split(':draft:')[0];
      taskAssessmentCount.set(
        trainingTaskId,
        (taskAssessmentCount.get(trainingTaskId) || 0) + 1,
      );
      if (consumeFailure(taskAssessmentFailureCount, trainingTaskId)) {
        throw new Error('task assessment failed');
      }
    },
    completeGroupAssessment: async (bindings) => {
      groupAssessmentCount += 1;
      lastGroupBindings = bindings.map((item) => ({
        trainingTaskId: item.trainingTaskId,
        draftId: item.draftId,
        revision: item.toRevision,
        contentHash: item.contentHash,
      }));
      if (groupAssessmentFailureCount > 0) {
        groupAssessmentFailureCount -= 1;
        throw new Error('group assessment failed');
      }
    },
    discardWorkingContent: async (trainingTaskId) => {
      workingTaskIds.delete(trainingTaskId);
    },
  };

  return {
    repository,
    drafts,
    workingTaskIds,
    conflictTaskIds,
    noChangeTaskIds,
    revisionFailureCount,
    taskAssessmentFailureCount,
    revisionCreationCount,
    taskAssessmentCount,
    get groupAssessmentFailureCount() {
      return groupAssessmentFailureCount;
    },
    set groupAssessmentFailureCount(value: number) {
      groupAssessmentFailureCount = value;
    },
    get groupAssessmentCount() {
      return groupAssessmentCount;
    },
    get lastGroupBindings() {
      return lastGroupBindings;
    },
    commit(requestedTaskIds: string[], idempotencyKey: string) {
      return commitTaskGroupChanges(dependencies, {
        planId: 'plan:source',
        requestedTaskIds,
        idempotencyKey,
        now: '2026-08-04T12:00:00.000Z',
      });
    },
  };
}

function draft(trainingTaskId: string): TaskDraftSnapshot {
  return {
    trainingTaskId,
    draftId: `${trainingTaskId}:draft:v1`,
    revision: 1,
    contentHash: `${trainingTaskId}:hash:v1`,
  };
}

function consumeFailure(failures: Map<string, number>, key: string): boolean {
  const remaining = failures.get(key) || 0;
  if (remaining <= 0) return false;
  failures.set(key, remaining - 1);
  return true;
}
