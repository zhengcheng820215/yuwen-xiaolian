import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  buildQuestionPortfolioSupplementPlan,
} from '../agents/questionPortfolioSupplementPlanningAgent.ts';

const store = new SharedFormalResourceStore();
const before = await store.read();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');

const plan = buildQuestionPortfolioSupplementPlan(before);
assert([42, 46].includes(plan.baselineQuestionCount));
assert.equal(plan.maximumSupplementCount, 4);
assert.equal(plan.projectedMaximumQuestionCount, 46);
assert.equal(plan.targets.length + plan.satisfiedMaterialTitles.length, 4);
assert.deepEqual([...plan.targets.map((item) => item.materialTitle), ...plan.satisfiedMaterialTitles], [
  '《皇帝的新装》',
  '《秋天的怀念》',
  '《散步》',
  '《狼》',
]);
assert(plan.targets.every((item) => item.targetDifficulty === 'basic'));
assert(plan.targets.every((item) => ['comprehension', 'summarization'].includes(
  item.targetAbilityId,
)));
assert(plan.targets.every((item) => !item.currentDifficultyBreakdown.basic));
assert.equal(new Set(plan.targets.map((item) => item.observationFocus)).size, plan.targets.length);
assert.deepEqual(plan.deferredMaterialTitles, [
  '《从百草园到三味书屋》',
  '《走一步，再走一步》',
  '《女娲造人》',
  '《天上的街市》',
]);
assert.deepEqual(plan.issues, []);

const after = await store.read();
assert.equal(after.revision, before.revision);
assert.deepEqual(after.data, before.data, 'P2-01 planning must remain read-only.');

console.log(JSON.stringify({ storeRevision: before.revision, ...plan }, null, 2));
console.log('P2-01 question portfolio supplement planning debug passed (read-only).');
