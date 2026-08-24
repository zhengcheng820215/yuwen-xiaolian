import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  buildFormalQuestionLoadGovernanceClosureCandidates,
  FORMAL_QUESTION_LOAD_GOVERNANCE_CLOSURE_MARKER,
} from '../agents/formalQuestionLoadGovernanceClosureAgent.ts';
import { prepareQuestionPortfolioSupplementPublication } from
  '../agents/questionPortfolioSupplementPublicationAgent.ts';
import { buildQuestionOptimizationBaseline } from
  '../agents/questionOptimizationBaselineAgent.ts';
import { buildReadingOpenResponseInputLoadBaselineAudit } from
  '../services/readingOpenResponseInputLoadBaselineAuditService.ts';

const apply = process.argv.includes('--apply');
const store = new SharedFormalResourceStore();
const before = await store.read();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');

const beforeBaseline = buildQuestionOptimizationBaseline(before);
const existingPublished = before.data.questionResources.versions.filter((version) => (
  version.status === 'frozen'
  && version.tags.includes(FORMAL_QUESTION_LOAD_GOVERNANCE_CLOSURE_MARKER)
  && before.data.questionResources.registryEntries.some((entry) => (
    entry.status === 'active' && entry.currentFrozenVersionId === version.resourceVersionId
  ))
));
const candidateReport = existingPublished.length === 2
  ? null
  : buildFormalQuestionLoadGovernanceClosureCandidates(before);
const prepared = prepareQuestionPortfolioSupplementPublication(
  before.data,
  candidateReport,
  new Date().toISOString(),
  {
    expectedCandidateCount: 2,
    publicationMarker: FORMAL_QUESTION_LOAD_GOVERNANCE_CLOSURE_MARKER,
    idPrefix: 'formal-load-closure',
    authorId: 'codex-formal-load-governance-author',
    reviewerId: 'codex-formal-load-governance-reviewer',
    planReviewNote: '正式题输入负担治理：仅为缺少合理入口的题组补充独立低负担观察，不改写历史冻结题。',
    questionReviewNote: '正式题输入负担治理：材料依据、观察价值、作答负担、答案接受范围与质量门禁均已完成受控核对。',
  },
);
const projected = { ...before, data: prepared.data };
const projectedBaseline = buildQuestionOptimizationBaseline(projected);
const loadAudit = buildReadingOpenResponseInputLoadBaselineAudit(projected);
const activeCoreVersionIds = new Set(projected.data.questionResources.materials.filter((material) => (
  material.status !== 'retired' && (material.usageType || 'core_reading') === 'core_reading'
)).map((material) => material.materialVersionId));
const coreSequenceFindings = loadAudit.taskGroups.filter((group) => (
  activeCoreVersionIds.has(group.materialVersionId)
)).flatMap((group) => group.sequenceFindings);
const expectedAddedQuestionCount = prepared.report.alreadyApplied ? 0 : 2;

assert.equal(prepared.report.activeMaterialCount, 24);
assert.equal(
  prepared.report.currentQuestionCount,
  beforeBaseline.counts.currentTasks + expectedAddedQuestionCount,
);
assert.equal(
  prepared.report.currentTraceCount,
  beforeBaseline.counts.frozenQualityTraces + expectedAddedQuestionCount,
);
assert.equal(
  projectedBaseline.counts.currentTasks,
  beforeBaseline.counts.currentTasks + expectedAddedQuestionCount,
);
assert.equal(
  projectedBaseline.counts.currentFormalVersions,
  beforeBaseline.counts.currentFormalVersions + expectedAddedQuestionCount,
);
assert.equal(
  projectedBaseline.counts.learningConsumableQuestions,
  beforeBaseline.counts.learningConsumableQuestions + expectedAddedQuestionCount,
);
assert.deepEqual(projectedBaseline.issues, []);
assert.equal(coreSequenceFindings.length, 0, JSON.stringify(coreSequenceFindings));

const governed = prepared.data.questionResources.versions.filter((version) => (
  version.status === 'frozen'
  && version.tags.includes(FORMAL_QUESTION_LOAD_GOVERNANCE_CLOSURE_MARKER)
  && prepared.data.questionResources.registryEntries.some((entry) => (
    entry.status === 'active' && entry.currentFrozenVersionId === version.resourceVersionId
  ))
));
assert.equal(governed.length, 2);
assert.equal(governed.filter((version) => version.responseFormat === 'single_choice').length, 1);
assert.equal(governed.filter((version) => version.responseFormat === 'short_text').length, 1);
assert(governed.every((version) => prepared.data.questionQuality.frozenQualityTraces.some(
  (trace) => trace.resourceVersionId === version.resourceVersionId,
)));

if (apply && !prepared.report.alreadyApplied) {
  const committed = await store.applyCommand(before.revision, {
    commandType: 'apply_collection_patch',
    commandId: 'formal-question-load-governance-closure-2026-08-21-v1',
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
    baselineCounts: projectedBaseline.counts,
  }, null, 2));
} else {
  const after = await store.read();
  assert.equal(after.revision, before.revision, 'Dry-run/no-op must not mutate the store.');
  assert.deepEqual(after.data, before.data, 'Dry-run/no-op must remain read-only.');
  console.log(JSON.stringify({
    mode: apply ? 'apply-noop' : 'dry-run',
    revision: before.revision,
    ...prepared.report,
    baselineCounts: projectedBaseline.counts,
  }, null, 2));
}

console.log('Formal question load governance closure passed.');
