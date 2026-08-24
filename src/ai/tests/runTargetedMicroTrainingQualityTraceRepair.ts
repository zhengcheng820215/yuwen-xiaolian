import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import { buildQuestionOptimizationBaseline } from
  '../agents/questionOptimizationBaselineAgent.ts';
import { prepareTargetedMicroTrainingQualityTraceRepair } from
  '../services/targetedMicroTrainingQualityTraceRepairService.ts';

const apply = process.argv.includes('--apply');
const now = new Date().toISOString();
const store = new SharedFormalResourceStore();
const snapshot = await store.read();
const originalData = structuredClone(snapshot.data);
const prepared = prepareTargetedMicroTrainingQualityTraceRepair(snapshot, now);

assert.equal(prepared.report.nonQualityDigestBefore, prepared.report.nonQualityDigestAfter);
assert.deepEqual(snapshot.data, originalData, 'Dry-run must not mutate the source Snapshot.');
if (prepared.report.changed) {
  assert.equal(prepared.report.targetResourceVersionIds.length, 18);
  assert.equal(prepared.report.before.missingTraceIssues, 18);
  assert.equal(prepared.report.before.identityMismatchIssues, 0);
  assert.equal(prepared.report.after.missingTraceIssues, 0);
  assert.equal(prepared.report.after.identityMismatchIssues, 0);
  assert.equal(prepared.report.after.currentTasks, prepared.report.after.frozenQualityTraces);
  assert.equal(
    prepared.report.after.currentTasks,
    prepared.report.after.learningConsumableQuestions,
  );
  assert(prepared.command);
  await verifyAtomicFailure(snapshot, prepared.command);
}

console.log(JSON.stringify({
  mode: apply ? 'APPLY' : 'DRY-RUN',
  policyVersion: prepared.report.policyVersion,
  sourceRevision: prepared.report.sourceRevision,
  changed: prepared.report.changed,
  targetCount: prepared.report.targetResourceVersionIds.length,
  repairedTraceCount: prepared.report.repairedTraceIds.length,
  before: prepared.report.before,
  after: prepared.report.after,
  nonQualityDataUnchanged:
    prepared.report.nonQualityDigestBefore === prepared.report.nonQualityDigestAfter,
}, null, 2));

if (apply && prepared.command) {
  const committed = await store.applyCommand(snapshot.revision, prepared.command);
  const baseline = buildQuestionOptimizationBaseline(committed);
  assert.equal(baseline.counts.currentTasks, 79);
  assert.equal(baseline.counts.frozenQualityTraces, 79);
  assert.equal(baseline.counts.learningConsumableQuestions, 79);
  assert.deepEqual(baseline.issues, []);
  const repeated = prepareTargetedMicroTrainingQualityTraceRepair(committed, now);
  assert.equal(repeated.report.changed, false);
  assert.equal(repeated.command, undefined);
  console.log(`Applied atomically at Shared Store revision ${committed.revision}.`);
} else if (!prepared.command) {
  const baseline = buildQuestionOptimizationBaseline(snapshot);
  assert.equal(baseline.counts.currentTasks, baseline.counts.frozenQualityTraces);
  assert.equal(baseline.counts.currentTasks, baseline.counts.learningConsumableQuestions);
  assert.deepEqual(baseline.issues, []);
  console.log('No quality trace repair is required.');
} else {
  console.log('No data was changed. Re-run with --apply after reviewing the dry-run report.');
}

async function verifyAtomicFailure(
  source: typeof snapshot,
  command: NonNullable<typeof prepared.command>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'targeted-quality-trace-repair-'));
  const storePath = join(directory, 'store.json');
  try {
    const fixture = new SharedFormalResourceStore({ storePath, now: () => now });
    const initialized = await fixture.initialize(source.data, 'targeted-quality-trace-repair-debug');
    const failing = new SharedFormalResourceStore({
      storePath,
      now: () => now,
      failBeforeCommit: () => true,
    });
    await assert.rejects(() => failing.applyCommand(initialized.revision, command));
    const after = await fixture.read();
    assert.deepEqual(after.data, initialized.data, 'Failed atomic repair left partial data.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
