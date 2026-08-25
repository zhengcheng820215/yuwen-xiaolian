import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  FORMAL_QUESTION_LATEST_STANDARD_GOVERNANCE_MARKER,
  prepareFormalQuestionLatestStandardGovernance,
} from '../agents/formalQuestionLatestStandardGovernanceAgent.ts';
import { buildQuestionOptimizationBaseline } from
  '../agents/questionOptimizationBaselineAgent.ts';
import { evaluateCurrentFormalResourceQualityAdmission } from
  '../agents/phase173FormalResourceMatchingService.ts';

const apply = process.argv.includes('--apply');
const store = new SharedFormalResourceStore();
const before = await store.read();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');

const beforeBaseline = buildQuestionOptimizationBaseline(before);
const prepared = prepareFormalQuestionLatestStandardGovernance(
  before.data,
  new Date().toISOString(),
);
const projected = { ...before, data: prepared.data };
const projectedBaseline = buildQuestionOptimizationBaseline(projected);
const currentIds = new Set(prepared.data.questionResources.registryEntries
  .filter((entry) => entry.status === 'active' && entry.currentFrozenVersionId)
  .map((entry) => entry.currentFrozenVersionId!));
const currentVersions = prepared.data.questionResources.versions.filter((version) => (
  version.status === 'frozen' && currentIds.has(version.resourceVersionId)
));
const admissions = evaluateCurrentFormalResourceQualityAdmission(currentVersions);
const governedVersions = currentVersions.filter((version) => (
  version.tags.includes(FORMAL_QUESTION_LATEST_STANDARD_GOVERNANCE_MARKER)
));
const spring = governedVersions.find((version) => version.materialSnapshot?.title === '《春》');
const nuwa = governedVersions.find((version) => version.materialSnapshot?.title === '《女娲造人》');

assert.equal(prepared.report.currentQuestionCount, beforeBaseline.counts.currentTasks);
assert.equal(prepared.report.currentTraceCount, beforeBaseline.counts.frozenQualityTraces);
assert.equal(projectedBaseline.counts.currentTasks, beforeBaseline.counts.currentTasks);
assert.equal(projectedBaseline.counts.currentFormalVersions, beforeBaseline.counts.currentFormalVersions);
assert.equal(projectedBaseline.counts.learningConsumableQuestions, beforeBaseline.counts.learningConsumableQuestions);
assert.deepEqual(projectedBaseline.issues, []);
assert.equal(governedVersions.length, 2);
assert.equal(admissions.filter((item) => item.status === 'blocked').length, 0);
assert(admissions.every((item) => item.eligibleForNewLearningSession));

assert(spring, '《春》 successor is missing.');
assert.equal(spring.responseFormat, 'single_choice');
assert.equal(spring.questionType, 'multiple_choice');
assert.equal(spring.assessmentMode, 'exact_match');
assert.equal(spring.choiceInteraction?.options.length, 4);
assert.deepEqual(spring.choiceInteraction?.correctOptionIds, ['spring-correct']);
assert.equal(spring.choiceInteraction?.distractorRationales.length, 3);
assert.deepEqual(spring.answerAcceptance.acceptedOptionIds, ['spring-correct']);
assert.equal(spring.minimumAnswerRequirement.requireTextEvidence, false);
assert.equal(spring.minimumAnswerRequirement.requireExplanation, false);

assert(nuwa, '《女娲造人》 successor is missing.');
assert.equal(nuwa.responseFormat, 'short_text');
assert.match(nuwa.questionStem, /这些表现为什么会让女娲/);
assert.equal(nuwa.rubric.length, 1);
assert.match(nuwa.rubric[0]!.description, /因此感到喜悦/);

assert(governedVersions.every((version) => version.parentVersionId));
assert(governedVersions.every((version) => prepared.data.questionQuality.frozenQualityTraces.some(
  (trace) => trace.resourceVersionId === version.resourceVersionId,
)));
if (!prepared.report.alreadyApplied) {
  assert.equal(prepared.report.previousResourceVersionIds.length, 2);
  assert(prepared.report.previousResourceVersionIds.every((id) => (
    prepared.data.questionResources.versions.some((version) => (
      version.resourceVersionId === id && version.status === 'superseded'
    ))
  )));
}

const idempotent = prepareFormalQuestionLatestStandardGovernance(
  prepared.data,
  new Date().toISOString(),
);
assert.equal(idempotent.report.alreadyApplied, true);
const idempotentBaseline = buildQuestionOptimizationBaseline({
  ...projected,
  data: idempotent.data,
});
assert.equal(idempotentBaseline.counts.currentFormalVersions, projectedBaseline.counts.currentFormalVersions);
assert.equal(idempotentBaseline.counts.learningConsumableQuestions, projectedBaseline.counts.learningConsumableQuestions);
assert.deepEqual(idempotentBaseline.issues, []);

if (apply && !prepared.report.alreadyApplied) {
  const committed = await store.applyCommand(before.revision, {
    commandType: 'apply_collection_patch',
    commandId: 'formal-question-latest-standard-governance-2026-08-25-v1',
    patches: [
      { scope: 'questionResources', collection: 'drafts', values: prepared.data.questionResources.drafts },
      { scope: 'questionResources', collection: 'validations', values: prepared.data.questionResources.validations },
      { scope: 'questionResources', collection: 'reviews', values: prepared.data.questionResources.reviews },
      { scope: 'questionResources', collection: 'versions', values: prepared.data.questionResources.versions },
      { scope: 'questionResources', collection: 'registryEntries', values: prepared.data.questionResources.registryEntries },
      { scope: 'materialObservations', collection: 'anchors', values: prepared.data.materialObservations.anchors },
      { scope: 'materialObservations', collection: 'plans', values: prepared.data.materialObservations.plans },
      { scope: 'materialObservations', collection: 'validations', values: prepared.data.materialObservations.validations },
      { scope: 'materialObservations', collection: 'reviews', values: prepared.data.materialObservations.reviews },
      { scope: 'materialObservations', collection: 'links', values: prepared.data.materialObservations.links },
      { scope: 'questionQuality', collection: 'deterministicAssessments', values: prepared.data.questionQuality.deterministicAssessments },
      { scope: 'questionQuality', collection: 'semanticAssessments', values: prepared.data.questionQuality.semanticAssessments },
      { scope: 'questionQuality', collection: 'assessmentBundles', values: prepared.data.questionQuality.assessmentBundles },
      { scope: 'questionQuality', collection: 'frozenQualityTraces', values: prepared.data.questionQuality.frozenQualityTraces },
    ],
  });
  console.log(JSON.stringify({
    mode: 'apply',
    beforeRevision: before.revision,
    afterRevision: committed.revision,
    ...prepared.report,
    latestQuality: summarizeAdmission(admissions),
  }, null, 2));
} else {
  const after = await store.read();
  assert.equal(after.revision, before.revision, 'Dry-run/no-op must not mutate the store.');
  assert.deepEqual(after.data, before.data, 'Dry-run/no-op must remain read-only.');
  console.log(JSON.stringify({
    mode: apply ? 'apply-noop' : 'dry-run',
    revision: before.revision,
    ...prepared.report,
    latestQuality: summarizeAdmission(admissions),
  }, null, 2));
}

console.log('Formal question latest-standard governance passed.');

function summarizeAdmission(
  results: ReturnType<typeof evaluateCurrentFormalResourceQualityAdmission>,
) {
  return {
    blocked: results.filter((item) => item.status === 'blocked').length,
    guided: results.filter((item) => item.status === 'ready_with_guidance').length,
    ready: results.filter((item) => item.status === 'ready').length,
  };
}
