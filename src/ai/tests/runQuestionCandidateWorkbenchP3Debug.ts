import assert from 'node:assert/strict';
import { createQuestionCandidate } from '../schemas/questionCandidate.schema.ts';
import {
  QUESTION_CANDIDATE_WORKFLOW_STORAGE_KEY,
  resolveCandidatePanelProjection,
  resolveQuestionCandidateWorkflowMode,
} from '../../pages/questionCandidateWorkbenchState.ts';

const context = {
  materialVersionId: 'material:v1',
  observationPlanVersion: 2,
  trainingTaskVersion: 3,
};

function candidate(candidateId: string, materialVersionId = context.materialVersionId) {
  return createQuestionCandidate({
    candidateId,
    generationCommandId: `command-${candidateId}`,
    generationCommandFingerprint: `fingerprint-${candidateId}`,
    trainingTaskId: 'training-task-1',
    candidateType: 'initial',
    content: {
      materialVersionId,
      title: `候选 ${candidateId}`,
      questionStem: '请结合材料说明人物行为变化。',
      questionType: 'reading_comprehension',
      responseFormat: 'long_text',
      options: [],
      assessmentMode: 'reasoning_chain',
      answerAcceptance: {
        acceptedKeywords: ['行为变化'],
        semanticEquivalentAllowed: true,
      },
      rubric: [{
        itemId: 'rubric-1',
        name: '依据充分',
        abilityId: 'analysis',
        importance: 'critical',
        required: true,
        acceptedSignals: ['行为变化'],
      }],
      minimumAnswerRequirement: {
        minLength: 20,
        requireTextEvidence: true,
        requireExplanation: true,
      },
      abilityMetadata: {
        abilityId: 'analysis',
        supportingAbilityIds: [],
        prerequisiteAbilityIds: [],
        taskRole: 'training',
        difficulty: 'intermediate',
      },
      source: {
        sourceType: 'ai_assisted',
        description: 'P3 候选调试',
      },
      tags: ['observation_task:training-task-1'],
    },
    generationReason: '测试候选',
    changedFields: [],
    allowedFields: [],
    lockedFields: [],
    generationContext: {
      modelId: 'debug-model',
      promptVersion: 'debug-prompt-v1',
      promptHash: 'debug-hash',
      ruleVersion: 'debug-rule-v1',
      materialVersionId,
      observationPlanVersion: context.observationPlanVersion,
      trainingTaskVersion: context.trainingTaskVersion,
      generatedAt: '2026-08-05T00:00:00.000Z',
    },
    status: 'ready',
    createdAt: '2026-08-05T00:00:00.000Z',
  });
}

assert.equal(
  resolveQuestionCandidateWorkflowMode({
    routeValue: 'enabled',
    storedValue: 'legacy',
    environmentValue: false,
  }),
  'enabled',
  'route flag should have the highest priority',
);
assert.equal(
  resolveQuestionCandidateWorkflowMode({
    storedValue: 'legacy',
    developmentDefault: true,
  }),
  'legacy',
  `${QUESTION_CANDIDATE_WORKFLOW_STORAGE_KEY} should override the development default`,
);

const empty = resolveCandidatePanelProjection({ candidates: [], context });
assert.equal(empty.candidateState.state, 'not_generated');
assert.equal(empty.adoption.enabled, false, 'P3 must not expose candidate adoption');

const ready = resolveCandidatePanelProjection({
  candidates: [candidate('a'), candidate('b'), candidate('c')],
  context,
  selectedCandidateId: 'b',
  comparisonCandidateIds: ['a', 'b', 'c'],
});
assert.equal(ready.candidateState.state, 'candidate_ready');
assert.equal(ready.selectedCandidateId, 'b');
assert.deepEqual(ready.comparisonCandidateIds, ['b', 'a']);
assert.equal(ready.comparisonCandidateIds.length, 2, 'comparison must be capped at two');

const optimizing = resolveCandidatePanelProjection({
  candidates: [candidate('a')],
  context,
  operation: 'optimizing',
});
assert.equal(optimizing.candidateState.state, 'optimizing');
assert.equal(optimizing.busy, true);
assert.equal(optimizing.canOptimize, false);

const expired = resolveCandidatePanelProjection({
  candidates: [candidate('old', 'material:v0')],
  context,
});
assert.equal(expired.candidateState.state, 'candidate_expired');
assert.deepEqual(expired.readyCandidates, []);

const failed = resolveCandidatePanelProjection({
  candidates: [],
  context,
  operation: 'failed',
});
assert.equal(failed.candidateState.state, 'candidate_failed');
assert.equal(failed.busy, false);

const legacyRecovery = resolveCandidatePanelProjection({
  candidates: [candidate('a')],
  context,
  workingStatus: 'base_revision_conflict',
});
assert.equal(legacyRecovery.showsLegacyRecovery, true);

console.log('Question Candidate Workbench P3 debug passed.');
