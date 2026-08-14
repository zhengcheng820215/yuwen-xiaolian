import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  MATERIAL_CORPUS_OPTIMIZATION_MARKER,
  prepareMaterialCorpusOptimization,
} from '../agents/materialCorpusOptimizationAgent.ts';
import { auditAndPrepareMaterialCorpusMaintenance } from
  '../agents/materialCorpusMaintenanceAgent.ts';
import { buildQuestionOptimizationBaseline } from
  '../agents/questionOptimizationBaselineAgent.ts';

const PEP_CATALOG = 'https://bp.pep.com.cn/2018spring/gzhtbjc/sfkl/czywk/zyqs/index.html';
const apply = process.argv.includes('--apply');
const store = new SharedFormalResourceStore();
const before = await store.read();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');

const prepared = prepareMaterialCorpusOptimization(before.data, new Date().toISOString());
const projected = { ...before, data: prepared.data };
const activeMaterials = prepared.data.questionResources.materials.filter((item) => item.status !== 'retired');
assert.equal(activeMaterials.length, 12);
for (const material of activeMaterials) {
  assert.equal(material.revisionNote, MATERIAL_CORPUS_OPTIMIZATION_MARKER);
  assert(material.metadata?.curriculumUnit, `${material.title} curriculum unit is missing.`);
  assert.equal(material.metadata?.provenanceStatus, 'needs_verification');
  assert.equal(material.metadata?.provenanceReview?.textVerificationStatus, 'pending');
  assert.equal(material.metadata?.provenanceReview?.rightsStatus, 'unknown');
  assert.equal(material.metadata?.provenanceReview?.sourceLocator, PEP_CATALOG);
  if (material.parentMaterialVersionId) {
    const parent = prepared.data.questionResources.materials.find((item) => (
      item.materialVersionId === material.parentMaterialVersionId
    ));
    assert(parent, `${material.title} parent material is missing.`);
    assert.equal(material.content, parent.content, `${material.title} text changed during provenance governance.`);
  }
}
for (const resourceVersionId of prepared.report.revisedQuestionResourceVersionIds) {
  const version = prepared.data.questionResources.versions.find((item) => (
    item.resourceVersionId === resourceVersionId
  ));
  assert(version?.parentVersionId, `${resourceVersionId} parent version is missing.`);
  const parent = prepared.data.questionResources.versions.find((item) => (
    item.resourceVersionId === version.parentVersionId
  ));
  assert(parent, `${resourceVersionId} parent resource is missing.`);
  assert.deepEqual(questionSemantics(version), questionSemantics(parent), (
    `${resourceVersionId} question semantics changed during provenance governance.`
  ));
}
const corpus = auditAndPrepareMaterialCorpusMaintenance(prepared.data, new Date().toISOString()).report;
assert.equal(corpus.issues.filter((item) => item.severity !== 'information').length, 0);
const baseline = buildQuestionOptimizationBaseline(projected);
assert.deepEqual(baseline.issues, []);
assert.equal(baseline.counts.currentTasks, 42);
assert.equal(baseline.counts.activeObservationLinks, 42);
assert.equal(baseline.counts.activeRegistryEntries, 42);
assert.equal(baseline.counts.currentFormalVersions, 42);
assert.equal(baseline.counts.frozenQualityTraces, 42);
assert.equal(baseline.counts.learningConsumableQuestions, 42);

if (apply && !prepared.report.alreadyApplied) {
  const committed = await store.replace(before.revision, prepared.data);
  console.log(JSON.stringify({
    mode: 'apply',
    beforeRevision: before.revision,
    afterRevision: committed.revision,
    ...prepared.report,
    sourceLocator: PEP_CATALOG,
    baselineCounts: baseline.counts,
  }, null, 2));
} else {
  const after = await store.read();
  assert.equal(after.revision, before.revision, 'Provenance dry-run must not mutate the Shared Store.');
  assert.deepEqual(after.data, before.data, 'Provenance dry-run must remain read-only.');
  console.log(JSON.stringify({
    mode: apply ? 'apply-noop' : 'dry-run',
    revision: before.revision,
    ...prepared.report,
    sourceLocator: PEP_CATALOG,
    baselineCounts: baseline.counts,
  }, null, 2));
}

function questionSemantics(version: NonNullable<
  typeof prepared.data.questionResources.versions[number]
>) {
  return {
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
  };
}
