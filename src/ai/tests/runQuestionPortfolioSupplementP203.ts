import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  generateQuestionPortfolioSupplementCandidates,
} from '../agents/questionPortfolioSupplementCandidateAgent.ts';
import {
  prepareQuestionPortfolioSupplementPublication,
} from '../agents/questionPortfolioSupplementPublicationAgent.ts';
import {
  QUESTION_PORTFOLIO_SUPPLEMENT_PUBLICATION_MARKER,
} from '../agents/questionPortfolioSupplementPlanningAgent.ts';
import { buildQuestionOptimizationBaseline } from
  '../agents/questionOptimizationBaselineAgent.ts';

const apply = process.argv.includes('--apply');
const store = new SharedFormalResourceStore();
const before = await store.read();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');
const sourceBaseline = buildQuestionOptimizationBaseline(before);

const existingPublished = before.data.questionResources.versions.filter((version) => (
  version.status === 'frozen'
  && version.tags.includes(QUESTION_PORTFOLIO_SUPPLEMENT_PUBLICATION_MARKER)
  && before.data.questionResources.registryEntries.some((entry) => (
    entry.status === 'active' && entry.currentFrozenVersionId === version.resourceVersionId
  ))
));
const candidateReport = existingPublished.length === 4
  ? null
  : await generateQuestionPortfolioSupplementCandidates(before);
const prepared = prepareQuestionPortfolioSupplementPublication(
  before.data,
  candidateReport,
  new Date().toISOString(),
);
const projected = { ...before, data: prepared.data };
const baseline = buildQuestionOptimizationBaseline(projected);
assert.equal(prepared.report.activeMaterialCount, sourceBaseline.counts.activeMaterials);
assert.equal(prepared.report.currentQuestionCount, sourceBaseline.counts.currentTasks);
assert.equal(prepared.report.currentTraceCount, sourceBaseline.counts.frozenQualityTraces);
assert.equal(prepared.report.publishedMaterialTitles.length, 4);
assert.equal(baseline.counts.activeMaterials, sourceBaseline.counts.activeMaterials);
assert.equal(baseline.counts.currentTasks, sourceBaseline.counts.currentTasks);
assert.equal(baseline.counts.activeObservationLinks, sourceBaseline.counts.activeObservationLinks);
assert.equal(baseline.counts.activeRegistryEntries, sourceBaseline.counts.activeRegistryEntries);
assert.equal(baseline.counts.currentFormalVersions, sourceBaseline.counts.currentFormalVersions);
assert.equal(baseline.counts.frozenQualityTraces, sourceBaseline.counts.frozenQualityTraces);
assert.equal(baseline.counts.learningConsumableQuestions, sourceBaseline.counts.learningConsumableQuestions);
assert.deepEqual(baseline.issues, []);

const publishedVersions = prepared.data.questionResources.versions.filter((version) => (
  version.status === 'frozen'
  && version.tags.includes(QUESTION_PORTFOLIO_SUPPLEMENT_PUBLICATION_MARKER)
));
assert.equal(publishedVersions.length, 4);
assert(publishedVersions.every((version) => version.versionNumber === 1));
assert(publishedVersions.every((version) => version.abilityMetadata.difficulty === 'basic'));
assert(publishedVersions.every((version) => ['comprehension', 'summarization'].includes(
  version.abilityMetadata.abilityId,
)));
assert(publishedVersions.every((version) => prepared.data.questionResources.registryEntries.some(
  (entry) => entry.status === 'active'
    && entry.currentFrozenVersionId === version.resourceVersionId,
)));
assert(publishedVersions.every((version) => prepared.data.materialObservations.links.some(
  (link) => link.status === 'active'
    && link.resourceVersionId === version.resourceVersionId,
)));
assert(publishedVersions.every((version) => prepared.data.questionQuality.frozenQualityTraces.some(
  (trace) => trace.resourceVersionId === version.resourceVersionId,
)));

if (apply && !prepared.report.alreadyApplied) {
  const committed = await store.applyCommand(before.revision, {
    commandType: 'apply_collection_patch',
    commandId: 'p2-03-question-portfolio-supplement-publication-v1',
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
    baselineCounts: baseline.counts,
  }, null, 2));
} else {
  const after = await store.read();
  assert.equal(after.revision, before.revision, 'P2-03 dry-run/no-op must not mutate the store.');
  assert.deepEqual(after.data, before.data, 'P2-03 dry-run/no-op must remain read-only.');
  console.log(JSON.stringify({
    mode: apply ? 'apply-noop' : 'dry-run',
    revision: before.revision,
    ...prepared.report,
    baselineCounts: baseline.counts,
  }, null, 2));
}

console.log('P2-03 question portfolio supplement publication passed.');
