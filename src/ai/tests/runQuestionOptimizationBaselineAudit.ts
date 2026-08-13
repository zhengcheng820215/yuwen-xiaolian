import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import { buildQuestionOptimizationBaseline } from '../agents/questionOptimizationBaselineAgent.ts';

const store = new SharedFormalResourceStore();
const before = await store.read();
const report = buildQuestionOptimizationBaseline(before);
const after = await store.read();

assert.equal(after.revision, before.revision, 'Baseline audit must not mutate the Shared Store.');
assert.deepEqual(after.data, before.data, 'Baseline audit must remain read-only.');
assert.equal(report.counts.activeMaterials, report.counts.currentPlans);
assert.equal(report.counts.currentTasks, report.counts.activeObservationLinks);
assert.equal(report.counts.currentTasks, report.counts.activeRegistryEntries);
assert.equal(report.counts.currentTasks, report.counts.currentFormalVersions);
assert.equal(report.counts.currentTasks, report.counts.frozenQualityTraces);
assert.equal(report.counts.currentTasks, report.counts.learningConsumableQuestions);
assert.deepEqual(report.issues, [], `Baseline issues:\n${report.issues.join('\n')}`);

console.log(JSON.stringify(report, null, 2));
console.log('Question optimization baseline audit passed (read-only).');
