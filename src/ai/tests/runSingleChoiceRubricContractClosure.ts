import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  prepareSingleChoiceRubricContractClosure,
} from '../agents/singleChoiceRubricContractClosureAgent.ts';
import { buildQuestionOptimizationBaseline } from
  '../agents/questionOptimizationBaselineAgent.ts';
import { evaluateQuestionGenerationQuality } from
  '../agents/questionGenerationQualityPolicyAgent.ts';
import {
  inspectInitialCandidateCompleteness,
  validateQuestionCandidateContent,
} from '../schemas/questionCandidate.schema.ts';

const apply = process.argv.includes('--apply');
const store = new SharedFormalResourceStore();
const before = await store.read();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');

const prepared = prepareSingleChoiceRubricContractClosure(before.data, new Date().toISOString());
const projected = { ...before, data: prepared.data };
const baseline = buildQuestionOptimizationBaseline(projected);
const currentIds = new Set(prepared.data.questionResources.registryEntries
  .filter((entry) => entry.status === 'active' && entry.currentFrozenVersionId)
  .map((entry) => entry.currentFrozenVersionId!));
const currentVersions = prepared.data.questionResources.versions.filter((version) => (
  version.status === 'frozen' && currentIds.has(version.resourceVersionId)
));
const currentChoices = currentVersions.filter((version) => version.responseFormat === 'single_choice');

assert.equal(prepared.report.currentQuestionCount, 61);
assert.equal(prepared.report.currentSingleChoiceCount, 15);
assert.equal(prepared.report.currentTraceCount, 61);
assert.equal(baseline.counts.currentFormalVersions, 61);
assert.equal(baseline.counts.learningConsumableQuestions, 61);
assert.deepEqual(baseline.issues, []);
assert(currentChoices.every((version) => validateQuestionCandidateContent(version).passed));
assert(currentChoices.every((version) => inspectInitialCandidateCompleteness(version).complete));
assert(currentChoices.every((version) => evaluateQuestionGenerationQuality({
  candidate: version,
  includePortfolioGuidance: false,
}).status !== 'blocked'));
assert(currentChoices.every((version) => version.rubric.every((item) => !item.required || (
  !item.evidenceRequirement?.requireTextEvidence
  && !item.evidenceRequirement?.requireExplanation
  && !item.evidenceRequirement?.requireConclusion
))));

if (apply && !prepared.report.alreadyApplied) {
  const committed = await store.applyCommand(before.revision, {
    commandType: 'apply_collection_patch',
    commandId: 'single-choice-rubric-contract-closure-v1',
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
  assert.equal(after.revision, before.revision, 'Dry-run must not mutate the Shared Store.');
  assert.deepEqual(after.data, before.data, 'Dry-run must remain read-only.');
  console.log(JSON.stringify({
    mode: apply ? 'apply-noop' : 'dry-run',
    revision: before.revision,
    ...prepared.report,
    baselineCounts: baseline.counts,
  }, null, 2));
}
