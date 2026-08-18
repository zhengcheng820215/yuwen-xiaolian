import assert from 'node:assert/strict';
import {
  MAX_TRAINING_TASK_COUNT,
  resolveSingleChoiceQuantityPlan,
  resolveSingleChoiceTargetRange,
} from '../../pages/trainingTaskGroupPlanningState.ts';

let passed = 0;

function test(name: string, run: () => void): void {
  run();
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')} ${name}`);
}

console.log('Single-choice quantity planning Debug');
console.log('='.repeat(72));

test('training task capacity is aligned to the six-task contract', () => {
  assert.equal(MAX_TRAINING_TASK_COUNT, 6);
});

test('three-task group defaults to one choice and allows at most two', () => {
  assert.deepEqual(resolveSingleChoiceTargetRange(3), { defaultTarget: 1, maximum: 2 });
});

test('four-task group recommends one choice and allows at most two', () => {
  assert.deepEqual(resolveSingleChoiceTargetRange(4), { defaultTarget: 1, maximum: 2 });
});

test('five-task group defaults to two choices and allows at most three', () => {
  assert.deepEqual(resolveSingleChoiceTargetRange(5), { defaultTarget: 2, maximum: 3 });
});

test('six-task group defaults to two choices and allows at most three', () => {
  assert.deepEqual(resolveSingleChoiceTargetRange(6), { defaultTarget: 2, maximum: 3 });
});

test('three text tasks supplemented to five request two choices', () => {
  const plan = resolveSingleChoiceQuantityPlan({
    currentEffectiveTaskCount: 3,
    currentSingleChoiceCount: 0,
    intendedSupplementTaskCount: 2,
    qualifiedIndependentSingleChoiceObservationCount: 2,
  });
  assert.equal(plan.targetEffectiveTaskCount, 5);
  assert.equal(plan.targetSingleChoiceCount, 2);
  assert.equal(plan.singleChoiceGap, 2);
  assert.equal(plan.requestedSupplementSingleChoiceCount, 2);
});

test('one existing choice only requests the remaining default gap', () => {
  const plan = resolveSingleChoiceQuantityPlan({
    currentEffectiveTaskCount: 3,
    currentSingleChoiceCount: 1,
    intendedSupplementTaskCount: 2,
    qualifiedIndependentSingleChoiceObservationCount: 2,
  });
  assert.equal(plan.targetEffectiveTaskCount, 5);
  assert.equal(plan.requestedSupplementSingleChoiceCount, 1);
});

test('supplement request scope limits choices even when the target gap is larger', () => {
  const plan = resolveSingleChoiceQuantityPlan({
    currentEffectiveTaskCount: 4,
    currentSingleChoiceCount: 0,
    intendedSupplementTaskCount: 1,
    qualifiedIndependentSingleChoiceObservationCount: 3,
  });
  assert.equal(plan.targetEffectiveTaskCount, 5);
  assert.equal(plan.singleChoiceGap, 2);
  assert.equal(plan.requestedSupplementSingleChoiceCount, 1);
});

test('one remaining slot completes a six-task default choice target', () => {
  const plan = resolveSingleChoiceQuantityPlan({
    currentEffectiveTaskCount: 5,
    currentSingleChoiceCount: 1,
    intendedSupplementTaskCount: 1,
    qualifiedIndependentSingleChoiceObservationCount: 1,
  });
  assert.equal(plan.availableTaskCapacity, 1);
  assert.equal(plan.targetEffectiveTaskCount, 6);
  assert.equal(plan.requestedSupplementSingleChoiceCount, 1);
});

test('default target already met requests no more choices', () => {
  const plan = resolveSingleChoiceQuantityPlan({
    currentEffectiveTaskCount: 5,
    currentSingleChoiceCount: 2,
    intendedSupplementTaskCount: 1,
    qualifiedIndependentSingleChoiceObservationCount: 1,
  });
  assert.equal(plan.targetEffectiveTaskCount, 6);
  assert.equal(plan.singleChoiceGap, 0);
  assert.equal(plan.requestedSupplementSingleChoiceCount, 0);
});

test('expanded target can request a third independent choice', () => {
  const plan = resolveSingleChoiceQuantityPlan({
    currentEffectiveTaskCount: 5,
    currentSingleChoiceCount: 2,
    intendedSupplementTaskCount: 1,
    qualifiedIndependentSingleChoiceObservationCount: 1,
    targetPreference: 'expanded',
  });
  assert.equal(plan.targetSingleChoiceCount, 3);
  assert.equal(plan.requestedSupplementSingleChoiceCount, 1);
});

test('full six-task group never requests an additive choice', () => {
  const plan = resolveSingleChoiceQuantityPlan({
    currentEffectiveTaskCount: 6,
    currentSingleChoiceCount: 0,
    intendedSupplementTaskCount: 2,
    qualifiedIndependentSingleChoiceObservationCount: 2,
  });
  assert.equal(plan.boundedSupplementTaskCount, 0);
  assert.equal(plan.availableTaskCapacity, 0);
  assert.equal(plan.requestedSupplementSingleChoiceCount, 0);
});

test('qualified independent observations limit the requested quantity', () => {
  const plan = resolveSingleChoiceQuantityPlan({
    currentEffectiveTaskCount: 3,
    currentSingleChoiceCount: 0,
    intendedSupplementTaskCount: 2,
    qualifiedIndependentSingleChoiceObservationCount: 1,
  });
  assert.equal(plan.singleChoiceGap, 2);
  assert.equal(plan.requestedSupplementSingleChoiceCount, 1);
});

test('no qualified observation produces a zero request without inventing work', () => {
  const plan = resolveSingleChoiceQuantityPlan({
    currentEffectiveTaskCount: 3,
    currentSingleChoiceCount: 0,
    intendedSupplementTaskCount: 2,
    qualifiedIndependentSingleChoiceObservationCount: 0,
  });
  assert.equal(plan.requestedSupplementSingleChoiceCount, 0);
});

test('existing single-choice overflow is exposed for later validation', () => {
  const plan = resolveSingleChoiceQuantityPlan({
    currentEffectiveTaskCount: 4,
    currentSingleChoiceCount: 3,
    intendedSupplementTaskCount: 0,
    qualifiedIndependentSingleChoiceObservationCount: 0,
  });
  assert.equal(plan.maximumSingleChoiceCount, 2);
  assert.equal(plan.singleChoiceLimitExceeded, true);
});

test('negative planning inputs are rejected', () => {
  assert.throws(() => resolveSingleChoiceQuantityPlan({
    currentEffectiveTaskCount: -1,
    currentSingleChoiceCount: 0,
    intendedSupplementTaskCount: 0,
    qualifiedIndependentSingleChoiceObservationCount: 0,
  }), /current_effective_task_count_invalid/);
});

test('choice count cannot exceed current effective task count', () => {
  assert.throws(() => resolveSingleChoiceQuantityPlan({
    currentEffectiveTaskCount: 2,
    currentSingleChoiceCount: 3,
    intendedSupplementTaskCount: 0,
    qualifiedIndependentSingleChoiceObservationCount: 0,
  }), /current_single_choice_count_exceeds_task_count/);
});

test('task counts above capacity are rejected instead of silently clamped', () => {
  assert.throws(() => resolveSingleChoiceQuantityPlan({
    currentEffectiveTaskCount: 7,
    currentSingleChoiceCount: 0,
    intendedSupplementTaskCount: 0,
    qualifiedIndependentSingleChoiceObservationCount: 0,
  }), /current_effective_task_count_exceeds_capacity/);
});

console.log('-'.repeat(72));
console.log(`Result: ${passed} / ${passed} PASS`);
