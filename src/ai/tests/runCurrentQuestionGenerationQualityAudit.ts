import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  analyzeQuestionPortfolioGradient,
  evaluateQuestionGenerationQuality,
} from '../agents/questionGenerationQualityPolicyAgent.ts';
import { buildQuestionOptimizationBaseline } from '../agents/questionOptimizationBaselineAgent.ts';
import type { QuestionEditableFields } from '../schemas/workingTaskContent.schema.ts';

const store = new SharedFormalResourceStore();
const before = await store.read();
const baseline = buildQuestionOptimizationBaseline(before);
const versionById = new Map(before.data.questionResources.versions
  .map((version) => [version.resourceVersionId, version]));
const items = baseline.items.map((item) => {
  const version = versionById.get(item.resourceVersionId);
  assert(version, `Formal version missing: ${item.resourceVersionId}`);
  const content: QuestionEditableFields = {
    materialVersionId: version.materialVersionId,
    title: version.title,
    questionStem: version.questionStem,
    questionType: version.questionType,
    responseFormat: version.responseFormat,
    options: version.options,
    choiceInteraction: version.choiceInteraction,
    assessmentMode: version.assessmentMode,
    answerAcceptance: version.answerAcceptance,
    rubric: version.rubric,
    minimumAnswerRequirement: version.minimumAnswerRequirement,
    abilityMetadata: version.abilityMetadata,
    source: version.source,
    tags: version.tags,
  };
  return { baseline: item, content };
});

const results = items.map((item) => ({
  materialTitle: item.baseline.materialTitle,
  resourceVersionId: item.baseline.resourceVersionId,
  questionStem: item.content.questionStem,
  evaluation: evaluateQuestionGenerationQuality({
    candidate: item.content,
    peerQuestions: items
      .filter((peer) => peer.baseline.materialVersionId === item.baseline.materialVersionId
        && peer.baseline.resourceVersionId !== item.baseline.resourceVersionId)
      .map((peer) => peer.content),
    includePortfolioGuidance: false,
  }),
}));
const materialGuidance = [...new Set(items.map((item) => item.baseline.materialVersionId))]
  .map((materialVersionId) => {
    const materialItems = items.filter((item) => item.baseline.materialVersionId === materialVersionId);
    return {
      materialVersionId,
      materialTitle: materialItems[0]?.baseline.materialTitle,
      responseFormatBreakdown: materialItems.reduce<Record<string, number>>((counts, item) => {
        counts[item.content.responseFormat] = (counts[item.content.responseFormat] || 0) + 1;
        return counts;
      }, {}),
      defaultSingleChoiceTarget: defaultSingleChoiceTarget(materialItems.length),
      ...analyzeQuestionPortfolioGradient(materialItems.map((item) => item.content)),
    };
  })
  .filter((item) => item.findings.length > 0);
const after = await store.read();
assert.equal(after.revision, before.revision);
assert.deepEqual(after.data, before.data, 'Current-question quality audit must be read-only.');
assert.equal(results.length, baseline.counts.currentFormalVersions);
assert.equal(
  items.filter((item) => item.content.responseFormat === 'single_choice'
    && item.content.choiceInteraction !== undefined).length,
  items.filter((item) => item.content.responseFormat === 'single_choice').length,
  'Current-question quality audit must preserve every single-choice interaction.',
);

console.log(JSON.stringify({
  storeRevision: before.revision,
  baselineDigest: baseline.baselineDigest,
  questionCount: results.length,
  blocked: results.filter((item) => item.evaluation.status === 'blocked').length,
  guided: results.filter((item) => item.evaluation.status === 'ready_with_guidance').length,
  ready: results.filter((item) => item.evaluation.status === 'ready').length,
  responseFormatBreakdown: items.reduce<Record<string, number>>((counts, item) => {
    counts[item.content.responseFormat] = (counts[item.content.responseFormat] || 0) + 1;
    return counts;
  }, {}),
  questionSpecificFindings: results
    .filter((item) => item.evaluation.findings.length > 0)
    .map((item) => ({
      materialTitle: item.materialTitle,
      resourceVersionId: item.resourceVersionId,
      status: item.evaluation.status,
      findings: item.evaluation.findings.map((finding) => ({
        code: finding.code,
        severity: finding.severity,
        message: finding.message,
      })),
    })),
  materialGuidance: materialGuidance.map((item) => ({
    materialVersionId: item.materialVersionId,
    materialTitle: item.materialTitle,
    questionCount: item.questionCount,
    abilityBreakdown: item.abilityBreakdown,
    difficultyBreakdown: item.difficultyBreakdown,
    responseFormatBreakdown: item.responseFormatBreakdown,
    defaultSingleChoiceTarget: item.defaultSingleChoiceTarget,
    singleChoiceGap: Math.max(
      0,
      item.defaultSingleChoiceTarget - (item.responseFormatBreakdown.single_choice || 0),
    ),
    findings: item.findings.map((finding) => ({
      code: finding.code,
      severity: finding.severity,
      message: finding.message,
    })),
  })),
}, null, 2));
console.log('Current formal-question generation-quality audit passed (read-only).');

function defaultSingleChoiceTarget(taskCount: number): number {
  if (taskCount >= 5) return 2;
  if (taskCount >= 3) return 1;
  return 0;
}
