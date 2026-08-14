import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  prepareQuestionMaterialScopeRepair,
} from '../agents/materialCorpusOptimizationAgent.ts';
import { evaluateQuestionGenerationQuality } from
  '../agents/questionGenerationQualityPolicyAgent.ts';
import { buildQuestionOptimizationBaseline } from
  '../agents/questionOptimizationBaselineAgent.ts';
import { inspectInitialCandidateCompleteness } from '../schemas/questionCandidate.schema.ts';

const apply = process.argv.includes('--apply');
const store = new SharedFormalResourceStore();
const before = await store.read();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');

const prepared = prepareQuestionMaterialScopeRepair(before.data, new Date().toISOString());
const projectedSnapshot = { ...before, data: prepared.data };
const baseline = buildQuestionOptimizationBaseline(projectedSnapshot);
const currentVersion = prepared.data.questionResources.versions.find((item) => (
  item.resourceVersionId === prepared.report.currentResourceVersionId
));
const previousVersion = prepared.data.questionResources.versions.find((item) => (
  item.resourceVersionId === prepared.report.previousResourceVersionId
));
assert(currentVersion, 'P0-02 current version is missing.');
assert(previousVersion, 'P0-02 previous version is missing.');
assert.equal(inspectInitialCandidateCompleteness(currentVersion).complete, true);
assert.equal(currentVersion.status, 'frozen');
assert.equal(previousVersion.status, 'superseded');
assert.equal(currentVersion.parentVersionId, previousVersion.resourceVersionId);
assert.deepEqual(
  semanticContent(currentVersion),
  semanticContent(previousVersion),
  'P0-02 must not change the question stem, response contract, rubric, or material.',
);
assert.equal(baseline.counts.currentTasks, 42);
assert.equal(baseline.counts.activeObservationLinks, 42);
assert.equal(baseline.counts.activeRegistryEntries, 42);
assert.equal(baseline.counts.currentFormalVersions, 42);
assert.equal(baseline.counts.frozenQualityTraces, 42);
assert.equal(baseline.counts.learningConsumableQuestions, 42);
assert.deepEqual(baseline.issues, []);
assert.notEqual(evaluateQuestionGenerationQuality({
  candidate: currentVersion,
  includePortfolioGuidance: false,
}).status, 'blocked');

if (apply && !prepared.report.alreadyApplied) {
  const committed = await store.applyCommand(before.revision, {
    commandType: 'apply_collection_patch',
    commandId: 'p0-02-material-scope-repair-question-observation-candidate-a5flmn-v2',
    patches: [
      { scope: 'questionResources', collection: 'drafts', values: prepared.data.questionResources.drafts },
      { scope: 'questionResources', collection: 'validations', values: prepared.data.questionResources.validations },
      { scope: 'questionResources', collection: 'reviews', values: prepared.data.questionResources.reviews },
      { scope: 'questionResources', collection: 'versions', values: prepared.data.questionResources.versions },
      { scope: 'questionResources', collection: 'registryEntries', values: prepared.data.questionResources.registryEntries },
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
    baselineCounts: baseline.counts,
  }, null, 2));
} else {
  const after = await store.read();
  assert.equal(after.revision, before.revision, 'P0-02 dry-run must not mutate the Shared Store.');
  assert.deepEqual(after.data, before.data, 'P0-02 dry-run must remain read-only.');
  console.log(JSON.stringify({
    mode: apply ? 'apply-noop' : 'dry-run',
    revision: before.revision,
    ...prepared.report,
    baselineCounts: baseline.counts,
  }, null, 2));
}

function semanticContent(version: typeof currentVersion) {
  assert(version);
  return {
    materialId: version.materialId,
    materialVersionId: version.materialVersionId,
    materialSnapshot: version.materialSnapshot,
    title: version.title,
    questionStem: version.questionStem,
    questionType: version.questionType,
    responseFormat: version.responseFormat,
    options: version.options,
    assessmentMode: version.assessmentMode,
    answerAcceptance: version.answerAcceptance,
    rubric: version.rubric,
    minimumAnswerRequirement: version.minimumAnswerRequirement,
    abilityMetadata: version.abilityMetadata,
    source: version.source,
  };
}
