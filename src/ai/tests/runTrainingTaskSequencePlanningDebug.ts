import assert from 'node:assert/strict';
import {
  createDefaultTrainingTaskSequencePreference,
  planTrainingTaskSequence,
  resolvePreferredPreludeChoiceCount,
} from '../agents/trainingTaskSequencePlanner.ts';
import {
  orderFormalResourcesForLearningSequence,
  selectFormalResourceForLearningSequence,
} from '../agents/learningTaskSequenceScheduler.ts';
import {
  adoptTrainingTaskGroupCandidate,
  buildTrainingTaskSequenceTags,
  createTrainingTaskGroupCandidateSession,
  readTrainingTaskSequenceMetadata,
} from '../../pages/trainingTaskGroupPlanningState.ts';
import type { FrozenQuestionResourceVersion } from
  '../schemas/questionResourceAdmission.schema.ts';

assert.equal(resolvePreferredPreludeChoiceCount(3), 1);
assert.equal(resolvePreferredPreludeChoiceCount(5), 2);
assert.deepEqual(createDefaultTrainingTaskSequencePreference(5), {
  strategy: 'entry_first',
  reason: 'default_foundation_entry',
  preferredPreludeChoiceCount: 2,
});

const text1 = task('text-1', 'long_text', 'intermediate');
const choice1 = task('choice-1', 'single_choice', 'basic');
const text2 = task('text-2', 'short_text', 'intermediate');
const choice2 = task('choice-2', 'single_choice', 'intermediate');
const choice3 = task('choice-3', 'single_choice', 'basic');
const advancedChoice = task('choice-advanced', 'single_choice', 'advanced');

const entryPlan = planTrainingTaskSequence({
  tasks: [choice1, choice2, choice3, text1, text2, advancedChoice],
  preference: {
    strategy: 'entry_first',
    reason: 'default_foundation_entry',
    preferredPreludeChoiceCount: 2,
  },
});
assert.deepEqual(entryPlan.tasks.map((item) => item.candidateId), [
  'choice-1', 'choice-2', 'text-1', 'choice-3', 'text-2', 'choice-advanced',
]);
assert.equal(entryPlan.result.status, 'met');
assert.equal(entryPlan.result.actualPreludeChoiceCount, 2);
assert.deepEqual(entryPlan.result.preludeCandidateIds, ['choice-1', 'choice-2']);

const holisticPlan = planTrainingTaskSequence({
  tasks: [choice1, text1, text2],
  preference: {
    strategy: 'holistic_first',
    reason: 'holistic_judgment_required',
    preferredPreludeChoiceCount: 1,
  },
});
assert.deepEqual(holisticPlan.tasks.map((item) => item.candidateId), [
  'text-1', 'choice-1', 'text-2',
]);
assert.equal(holisticPlan.result.status, 'adjusted');
const holisticZeroPreludePlan = planTrainingTaskSequence({
  tasks: [choice1, text1],
  preference: {
    strategy: 'holistic_first',
    reason: 'independent_expression_baseline',
    preferredPreludeChoiceCount: 0,
  },
});
assert.deepEqual(
  holisticZeroPreludePlan.tasks.map((item) => item.candidateId),
  ['text-1', 'choice-1'],
);

const underfilledPlan = planTrainingTaskSequence({
  tasks: [text1, advancedChoice],
  preference: {
    strategy: 'entry_first',
    reason: 'default_foundation_entry',
    preferredPreludeChoiceCount: 1,
  },
});
assert.equal(underfilledPlan.result.status, 'underfilled');
assert.equal(underfilledPlan.result.reason, 'no_qualified_single_choice');
assert.deepEqual(underfilledPlan.tasks, [text1, advancedChoice]);

const rolePlan = planTrainingTaskSequence({
  tasks: [text1, { ...choice1, taskRole: 'retest' }],
  preference: {
    strategy: 'role_driven',
    reason: 'retest_after_training',
    preferredPreludeChoiceCount: 1,
  },
});
assert.deepEqual(rolePlan.tasks.map((item) => item.candidateId), ['text-1', 'choice-1']);
assert.equal(rolePlan.result.status, 'adjusted');

const existingFormalTasks = [
  { localId: 'published-text', responseFormat: 'long_text', questionStem: '已发布文本题' },
];
const supplement = createTrainingTaskGroupCandidateSession({
  candidateGroupId: 'sequence-supplement',
  operationType: 'supplement_group',
  basedOnPlanRevision: 1,
  candidateTasks: [choice1],
});
const adopted = adoptTrainingTaskGroupCandidate({
  session: supplement,
  currentTasks: existingFormalTasks,
  currentPlanRevision: 1,
});
assert.deepEqual(adopted.tasks.map((item) => item.localId || item.candidateId), [
  'published-text', 'choice-1',
]);
assert.deepEqual(existingFormalTasks.map((item) => item.localId), ['published-text']);

const entryText = version('entry-text', 'long_text', [
  'sequence-strategy:entry_first', 'sequence-rank:3',
  'sequence-prelude:false', 'sequence-prelude-count:2',
]);
const entryChoice = version('entry-choice', 'single_choice', [
  'sequence-strategy:entry_first', 'sequence-rank:1',
  'sequence-prelude:true', 'sequence-prelude-count:2',
]);
const entryChoice2 = version('entry-choice-2', 'single_choice', [
  'sequence-strategy:entry_first', 'sequence-rank:2',
  'sequence-prelude:true', 'sequence-prelude-count:2',
]);
const entryChoice3 = version('entry-choice-3', 'single_choice', [
  'sequence-strategy:entry_first', 'sequence-rank:4',
  'sequence-prelude:false', 'sequence-prelude-count:2',
]);
const entryText2 = version('entry-text-2', 'long_text', [
  'sequence-strategy:entry_first', 'sequence-rank:5',
  'sequence-prelude:false', 'sequence-prelude-count:2',
]);
const holisticText = version('holistic-text', 'long_text', [
  'sequence-strategy:holistic_first', 'sequence-rank:1',
]);
const holisticChoice = version('holistic-choice', 'single_choice', [
  'sequence-strategy:holistic_first', 'sequence-rank:2',
]);
assert.deepEqual(
  orderFormalResourcesForLearningSequence(
    [entryText2, entryChoice3, entryText, entryChoice2, entryChoice], {
      taskRole: 'training',
  }).map((item) => item.resourceVersionId),
  ['entry-choice', 'entry-choice-2', 'entry-text', 'entry-text-2', 'entry-choice-3'],
);
assert.equal(selectFormalResourceForLearningSequence(
  [holisticText, holisticChoice],
  { taskRole: 'training', materialId: 'material-1' },
)?.resourceVersionId, 'holistic-text');
assert.equal(selectFormalResourceForLearningSequence(
  [entryChoice, entryText],
  { taskRole: 'training', recentResourceVersionIds: ['entry-choice'] },
)?.resourceVersionId, 'entry-text');

const persistedSequenceTags = buildTrainingTaskSequenceTags({
  strategy: 'entry_first',
  reason: 'default_foundation_entry',
  rank: 2,
  isPrelude: true,
  preludeCount: 2,
});
assert.deepEqual(readTrainingTaskSequenceMetadata(persistedSequenceTags), {
  strategy: 'entry_first',
  reason: 'default_foundation_entry',
  rank: 2,
  isPrelude: true,
  preludeCount: 2,
});

const legacyChoice1 = version('legacy-choice-1', 'single_choice', []);
const legacyChoice2 = version('legacy-choice-2', 'single_choice', []);
const legacyChoice3 = version('legacy-choice-3', 'single_choice', []);
const legacyText = version('legacy-text', 'long_text', []);
assert.deepEqual(
  orderFormalResourcesForLearningSequence(
    [legacyChoice1, legacyChoice2, legacyChoice3, legacyText],
    { taskRole: 'training' },
  ).map((item) => item.resourceVersionId),
  ['legacy-choice-1', 'legacy-choice-2', 'legacy-text', 'legacy-choice-3'],
);

const legacyDeveloping = completeTextVersion(
  'legacy-developing',
  '结合一处描写，说明人物当时的心理。',
  1,
);
const legacyIntegrated = completeTextVersion(
  'legacy-integrated',
  '结合全文多处证据，比较两个人物并分析文章主题。',
  3,
);
assert.deepEqual(
  orderFormalResourcesForLearningSequence(
    [legacyIntegrated, legacyChoice1, legacyDeveloping],
    { taskRole: 'training' },
  ).map((item) => item.resourceVersionId),
  ['legacy-choice-1', 'legacy-developing', 'legacy-integrated'],
);

const retestText = version('retest-text', 'long_text', [], 'retest');
const retestChoice = version('retest-choice', 'single_choice', [], 'retest');
assert.deepEqual(
  orderFormalResourcesForLearningSequence([retestText, retestChoice], {
    taskRole: 'retest',
  }).map((item) => item.resourceVersionId),
  ['retest-text', 'retest-choice'],
);
const transferText = version('transfer-text', 'long_text', [], 'transfer');
const transferChoice = version('transfer-choice', 'single_choice', [], 'transfer');
assert.deepEqual(
  orderFormalResourcesForLearningSequence([transferText, transferChoice], {
    taskRole: 'transfer',
  }).map((item) => item.resourceVersionId),
  ['transfer-text', 'transfer-choice'],
);

console.log('Training task sequence planning debug: 20/20 passed.');

function task(candidateId: string, responseFormat: string, difficulty: string) {
  return { candidateId, responseFormat, difficulty, taskRole: 'training' };
}

function version(
  resourceVersionId: string,
  responseFormat: 'single_choice' | 'long_text',
  tags: string[],
  taskRole: 'training' | 'retest' | 'transfer' = 'training',
): FrozenQuestionResourceVersion {
  return {
    resourceVersionId,
    resourceId: `resource-${resourceVersionId}`,
    taskId: `task-${resourceVersionId}`,
    materialId: 'material-1',
    status: 'frozen',
    responseFormat,
    tags,
    abilityMetadata: {
      abilityId: 'comprehension',
      supportingAbilityIds: [],
      prerequisiteAbilityIds: [],
      taskRole,
      difficulty: 'basic',
    },
  } as FrozenQuestionResourceVersion;
}

function completeTextVersion(
  resourceVersionId: string,
  questionStem: string,
  rubricCount: number,
): FrozenQuestionResourceVersion {
  const base = version(resourceVersionId, 'long_text', []);
  return {
    ...base,
    title: resourceVersionId,
    questionStem,
    materialVersionId: 'material-1:v1',
    rubric: Array.from({ length: rubricCount }, (_, index) => ({
      itemId: `rubric-${index + 1}`,
      name: `评分项${index + 1}`,
      description: index === 0 ? '结合文本证据说明结论' : `补充第${index + 1}项独立分析`,
      abilityId: 'analysis',
      importance: 'critical',
      required: true,
      evidenceRequirement: {
        requireTextEvidence: true,
        requireExplanation: true,
        requireConclusion: true,
      },
      acceptedSignals: ['完成对应分析'],
    })),
    minimumAnswerRequirement: {
      responseFormat: 'long_text',
      minLength: 30,
      requireTextEvidence: true,
      requireExplanation: true,
    },
  } as FrozenQuestionResourceVersion;
}
