import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import { validatePreAnswerLearningGuidance } from
  '../content/preAnswerLearningGuidance.ts';
import { buildQuestionOptimizationBaseline } from
  '../agents/questionOptimizationBaselineAgent.ts';
import { buildFormalQuestionHintFeedbackBatchAudit } from
  '../services/formalQuestionHintFeedbackBatchAuditService.ts';

const store = new SharedFormalResourceStore();
const before = await store.read();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');
const beforeSerialized = JSON.stringify(before.data);
const baseline = buildQuestionOptimizationBaseline(before);
const report = buildFormalQuestionHintFeedbackBatchAudit(before);

assert.equal(report.currentQuestionCount, baseline.counts.currentFormalVersions);
assert.equal(report.items.length, report.currentQuestionCount);
assert.equal(new Set(report.items.map((item) => item.resourceVersionId)).size, report.items.length);
assert(report.items.every((item) => item.feedbackTarget.trim().length > 0));
assert(report.items.every((item) => item.feedbackProjection.targetCode.trim().length > 0));
assert(report.items
  .filter((item) => item.feedbackProjection.confidence === 'low')
  .every((item) => Boolean(item.feedbackProjection.fallbackReason)));
assert(report.items
  .filter((item) => item.hintProjection.status === 'ready')
  .every((item) => (
    Boolean(item.hintProjection.clue)
    && Boolean(item.hintProjection.thinkingAction)
    && Boolean(item.hintProjection.hint)
  )));
assert.equal(
  report.items.flatMap((item) => item.findings)
    .filter((finding) => finding.code === 'hint_generic_fallback_copy').length,
  0,
);

const genericValidation = validatePreAnswerLearningGuidance({
  goal: '练习分析。',
  clue: '具体描写',
  thinkingAction: '想一想表现了什么',
  hint: '留意具体描写，想一想表现了什么。',
});
assert.equal(genericValidation.passed, false);
assert(genericValidation.issues.includes('clue_not_locatable'));
assert(genericValidation.issues.includes('thinking_action_not_executable'));
assert(genericValidation.issues.includes('generic_fallback_copy'));

const after = await store.read();
assert.equal(after.revision, before.revision, 'Batch audit must not mutate Store revision.');
assert.equal(JSON.stringify(after.data), beforeSerialized, 'Batch audit must remain read-only.');

console.log(JSON.stringify({
  schemaVersion: report.schemaVersion,
  mode: 'read-only',
  storeRevision: report.storeRevision,
  currentQuestionCount: report.currentQuestionCount,
  summary: report.summary,
  findingBreakdown: report.findingBreakdown,
  targetBreakdown: report.targetBreakdown,
  materialBreakdown: report.materialBreakdown,
  blockedItems: report.items
    .filter((item) => item.disposition === 'blocked')
    .map(compactItem),
  advisoryItems: report.items
    .filter((item) => item.disposition === 'advisory')
    .map(compactItem),
  hintHiddenItems: report.items
    .filter((item) => item.hintProjection.status === 'hidden_by_quality_gate')
    .map((item) => ({
      materialTitle: item.materialTitle,
      resourceVersionId: item.resourceVersionId,
      questionStem: item.questionStem,
    })),
}, null, 2));

console.log('Formal question hint and feedback batch audit passed.');

function compactItem(item: (typeof report.items)[number]) {
  return {
    materialTitle: item.materialTitle,
    resourceVersionId: item.resourceVersionId,
    questionStem: item.questionStem,
    feedbackTarget: item.feedbackTarget,
    feedbackProjection: item.feedbackProjection,
    findings: item.findings.map((finding) => ({
      code: finding.code,
      severity: finding.severity,
    })),
  };
}
