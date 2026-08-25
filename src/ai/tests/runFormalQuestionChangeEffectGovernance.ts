import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  FORMAL_QUESTION_CHANGE_EFFECT_GOVERNANCE_MARKER,
  prepareFormalQuestionChangeEffectGovernance,
} from '../agents/formalQuestionChangeEffectGovernanceAgent.ts';
import { buildQuestionOptimizationBaseline } from
  '../agents/questionOptimizationBaselineAgent.ts';
import { evaluateCurrentFormalResourceQualityAdmission } from
  '../agents/phase173FormalResourceMatchingService.ts';
import { buildReadingOpenResponseInputLoadBaselineAudit } from
  '../services/readingOpenResponseInputLoadBaselineAuditService.ts';

const apply = process.argv.includes('--apply');
const store = new SharedFormalResourceStore();
const before = await store.read();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');

const beforeBaseline = buildQuestionOptimizationBaseline(before);
const prepared = prepareFormalQuestionChangeEffectGovernance(
  before.data,
  new Date().toISOString(),
);
const projected = { ...before, data: prepared.data };
const projectedBaseline = buildQuestionOptimizationBaseline(projected);
const audit = buildReadingOpenResponseInputLoadBaselineAudit(projected);
const successorId = prepared.report.successorResourceVersionIds[0];
const successor = prepared.data.questionResources.versions.find((version) => (
  version.resourceVersionId === successorId
));
const source = prepared.data.questionResources.versions.find((version) => (
  version.resourceVersionId === 'question-observation-task-plan-12ktvxo:v5'
));
const admissions = evaluateCurrentFormalResourceQualityAdmission(
  prepared.data.questionResources.versions.filter((version) => (
    prepared.data.questionResources.registryEntries.some((entry) => (
      entry.status === 'active' && entry.currentFrozenVersionId === version.resourceVersionId
    ))
  )),
);
const governedAudit = audit.questionResults.find((result) => (
  result.questionVersionId === successorId
));

assert.equal(prepared.report.currentQuestionCount, beforeBaseline.counts.currentTasks);
assert.equal(prepared.report.currentTraceCount, beforeBaseline.counts.frozenQualityTraces);
assert.equal(projectedBaseline.counts.currentTasks, beforeBaseline.counts.currentTasks);
assert.equal(projectedBaseline.counts.currentFormalVersions, beforeBaseline.counts.currentFormalVersions);
assert.equal(projectedBaseline.counts.learningConsumableQuestions, beforeBaseline.counts.learningConsumableQuestions);
assert.deepEqual(projectedBaseline.issues, []);
assert.equal(prepared.report.successorResourceVersionIds.length, 1);
assert(successor, '《皇帝的新装》 change-effect successor is missing.');
assert.equal(successor.resourceVersionId, 'question-observation-task-plan-12ktvxo:v6');
assert.equal(successor.parentVersionId, 'question-observation-task-plan-12ktvxo:v5');
assert.equal(successor.responseFormat, 'short_text');
assert.equal(successor.questionStem, '小孩子说出“可是他什么衣服也没有穿呀”后，人们的反应发生了怎样的变化？这对揭穿骗局有什么作用？');
assert.equal(successor.rubric.length, 2);
assert.deepEqual(successor.rubric.map((item) => item.name), [
  '反应变化识别',
  '变化推动骗局揭穿',
]);
assert(successor.tags.includes(FORMAL_QUESTION_CHANGE_EFFECT_GOVERNANCE_MARKER));
assert.equal(source?.status, 'superseded');
assert(prepared.data.questionQuality.frozenQualityTraces.some((trace) => (
  trace.resourceVersionId === successor.resourceVersionId
)));
assert(governedAudit, '《皇帝的新装》 successor load audit is missing.');
assert(!['regenerate', 'decompose_or_refocus'].includes(governedAudit.disposition));
assert.equal(governedAudit.profile?.requiredRelationCount, 1);
assert.equal(governedAudit.profile?.requiredObjectCount, 1);
assert.equal(governedAudit.profile?.loadLevel, 'focused_short');
assert(governedAudit.findings.every((finding) => ![
  'hidden_rubric_requirement',
  'object_scope_overloaded',
  'relation_load_overloaded',
  'response_format_load_mismatch',
].includes(finding.code)));
assert.equal(admissions.filter((item) => item.status === 'blocked').length, 0);
assert(admissions.every((item) => item.eligibleForNewLearningSession));

const idempotent = prepareFormalQuestionChangeEffectGovernance(
  prepared.data,
  new Date().toISOString(),
);
assert.equal(idempotent.report.alreadyApplied, true);

if (apply && !prepared.report.alreadyApplied) {
  const committed = await store.applyCommand(before.revision, {
    commandType: 'apply_collection_patch',
    commandId: 'formal-question-change-effect-governance-2026-08-25-v1',
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
    successorQuestionStem: successor.questionStem,
    disposition: governedAudit.disposition,
  }, null, 2));
} else {
  const after = await store.read();
  assert.equal(after.revision, before.revision, 'Dry-run/no-op must not mutate the store.');
  assert.deepEqual(after.data, before.data, 'Dry-run/no-op must remain read-only.');
  console.log(JSON.stringify({
    mode: apply ? 'apply-noop' : 'dry-run',
    revision: before.revision,
    ...prepared.report,
    successorQuestionStem: successor.questionStem,
    disposition: governedAudit.disposition,
  }, null, 2));
}

console.log('Formal question change-effect governance passed.');
