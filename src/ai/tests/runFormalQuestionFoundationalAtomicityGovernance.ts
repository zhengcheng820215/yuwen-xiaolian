import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  FORMAL_QUESTION_FOUNDATIONAL_ATOMICITY_GOVERNANCE_MARKER,
  prepareFormalQuestionFoundationalAtomicityGovernance,
} from '../agents/formalQuestionHighRiskGovernanceAgent.ts';
import { buildQuestionOptimizationBaseline } from
  '../agents/questionOptimizationBaselineAgent.ts';
import { buildReadingOpenResponseInputLoadBaselineAudit } from
  '../services/readingOpenResponseInputLoadBaselineAuditService.ts';

const apply = process.argv.includes('--apply');
const store = new SharedFormalResourceStore();
const before = await store.read();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');

const beforeBaseline = buildQuestionOptimizationBaseline(before);
const beforeAudit = buildReadingOpenResponseInputLoadBaselineAudit(before);
const prepared = prepareFormalQuestionFoundationalAtomicityGovernance(
  before.data,
  new Date().toISOString(),
);
const projected = { ...before, data: prepared.data };
const projectedBaseline = buildQuestionOptimizationBaseline(projected);
const audit = buildReadingOpenResponseInputLoadBaselineAudit(projected);
const governedResults = audit.questionResults.filter((result) => (
  prepared.report.successorResourceVersionIds.includes(result.questionVersionId)
));
const successorVersions = prepared.data.questionResources.versions.filter((version) => (
  prepared.report.successorResourceVersionIds.includes(version.resourceVersionId)
));
const governedMaterialVersionIds = new Set(successorVersions.map((version) => (
  version.materialVersionId
)));
const governedGroups = audit.taskGroups.filter((group) => (
  governedMaterialVersionIds.has(group.materialVersionId)
));

console.log(JSON.stringify({
  governedResults: governedResults.map((result) => ({
    questionVersionId: result.questionVersionId,
    disposition: result.disposition,
    profile: result.profile,
    findings: result.findings.map((finding) => finding.code),
  })),
  governedGroups: governedGroups.map((group) => ({
    materialVersionId: group.materialVersionId,
    findings: group.sequenceFindings.map((finding) => finding.code),
  })),
}, null, 2));

assert.equal(prepared.report.currentQuestionCount, beforeBaseline.counts.currentTasks);
assert.equal(prepared.report.currentTraceCount, beforeBaseline.counts.frozenQualityTraces);
assert.equal(projectedBaseline.counts.currentTasks, beforeBaseline.counts.currentTasks);
assert.equal(projectedBaseline.counts.currentFormalVersions, beforeBaseline.counts.currentFormalVersions);
assert.equal(
  projectedBaseline.counts.learningConsumableQuestions,
  beforeBaseline.counts.learningConsumableQuestions,
);
assert.deepEqual(projectedBaseline.issues, []);
assert.equal(prepared.report.successorResourceVersionIds.length, 2);
assert.equal(governedResults.length, 2);
assert(governedResults.every((result) => (
  result.disposition !== 'regenerate' && result.disposition !== 'decompose_or_refocus'
)));
assert(governedResults.every((result) => result.findings.every((finding) => ![
  'composite_core_actions',
  'hidden_rubric_requirement',
  'object_scope_overloaded',
  'relation_load_overloaded',
  'response_format_load_mismatch',
].includes(finding.code))));
assert(governedResults.every((result) => (result.profile?.requiredRelationCount || 0) <= 1));
assert.equal(audit.dispositionBreakdown.regenerate, 0);
if (!prepared.report.alreadyApplied) {
  assert(audit.dispositionBreakdown.decompose_or_refocus
    <= beforeAudit.dispositionBreakdown.decompose_or_refocus - 2);
  assert(audit.findingBreakdown.composite_core_actions
    <= beforeAudit.findingBreakdown.composite_core_actions - 2);
}
assert(governedGroups.every((group) => group.sequenceFindings.every((finding) => (
  finding.code !== 'unexplained_load_jump'
  && finding.code !== 'duplicate_load_observation'
))));

const marked = prepared.data.questionResources.versions.filter((version) => (
  version.status === 'frozen'
  && version.tags.includes(FORMAL_QUESTION_FOUNDATIONAL_ATOMICITY_GOVERNANCE_MARKER)
  && prepared.data.questionResources.registryEntries.some((entry) => (
    entry.status === 'active' && entry.currentFrozenVersionId === version.resourceVersionId
  ))
));
assert.equal(marked.length, 2);
assert(marked.every((version) => version.parentVersionId));
assert(marked.every((version) => prepared.data.questionQuality.frozenQualityTraces.some(
  (trace) => trace.resourceVersionId === version.resourceVersionId,
)));
assert(prepared.report.previousResourceVersionIds.every((id) => (
  prepared.data.questionResources.versions.some((version) => (
    version.resourceVersionId === id && version.status === 'superseded'
  ))
)));

if (apply && !prepared.report.alreadyApplied) {
  const committed = await store.applyCommand(before.revision, {
    commandType: 'apply_collection_patch',
    commandId: 'formal-question-foundational-atomicity-governance-2026-09-04-v1',
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
    dispositionBreakdown: audit.dispositionBreakdown,
    findingBreakdown: audit.findingBreakdown,
  }, null, 2));
} else {
  const after = await store.read();
  assert.equal(after.revision, before.revision, 'Dry-run/no-op must not mutate the store.');
  assert.deepEqual(after.data, before.data, 'Dry-run/no-op must remain read-only.');
  console.log(JSON.stringify({
    mode: apply ? 'apply-noop' : 'dry-run',
    revision: before.revision,
    ...prepared.report,
    dispositionBreakdown: audit.dispositionBreakdown,
    findingBreakdown: audit.findingBreakdown,
  }, null, 2));
}

console.log('Formal question foundational atomicity governance passed.');
