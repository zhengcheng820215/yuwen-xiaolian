import assert from 'node:assert/strict';
import {
  adoptTrainingTaskGroupCandidate,
  createTrainingTaskGroupCandidateSession,
  MAX_TRAINING_TASK_COUNT,
  resolveTrainingTaskGenerationRequest,
  summarizeTrainingTaskGroupCoverage,
} from '../../pages/trainingTaskGroupPlanningState.ts';

assert.deepEqual(resolveTrainingTaskGenerationRequest('replace_group', 0), {
  candidateCount: 3,
  planningIntent: 'initial',
});
assert.deepEqual(resolveTrainingTaskGenerationRequest('replace_group', 3), {
  candidateCount: 3,
  planningIntent: 'replacement',
});
assert.deepEqual(resolveTrainingTaskGenerationRequest('supplement_group', 3), {
  candidateCount: 2,
  planningIntent: 'supplement',
});
assert.deepEqual(resolveTrainingTaskGenerationRequest('supplement_group', 4), {
  candidateCount: 1,
  planningIntent: 'supplement',
});
assert.deepEqual(resolveTrainingTaskGenerationRequest('supplement_group', 5), {
  candidateCount: 0,
  planningIntent: 'supplement',
});

const currentTasks = [
  { localId: 'task-a', abilityId: 'analysis', primaryDimension: 'character', questionStem: '分析人物心理。' },
  { localId: 'task-b', abilityId: 'summarization', primaryDimension: 'plot', questionStem: '概括情节发展。' },
];
const replacements = [
  { localId: 'candidate-r1', abilityId: 'comprehension', primaryDimension: 'language', questionStem: '理解关键语句。' },
  { localId: 'candidate-r2', abilityId: 'expression', primaryDimension: 'theme', questionStem: '表达主题理解。' },
];

const replacementSession = createTrainingTaskGroupCandidateSession({
  candidateGroupId: 'group-replace',
  operationType: 'replace_group',
  basedOnPlanRevision: 2,
  candidateTasks: replacements,
});
assert.deepEqual(replacementSession.selectedCandidateTaskIds, ['candidate-r1', 'candidate-r2']);
assert.deepEqual(
  adoptTrainingTaskGroupCandidate({
    session: replacementSession,
    currentTasks,
    currentPlanRevision: 2,
  }).tasks,
  replacements,
);

const initialGroupResult = adoptTrainingTaskGroupCandidate({
  session: createTrainingTaskGroupCandidateSession({
    candidateGroupId: 'group-initial',
    operationType: 'replace_group',
    basedOnPlanRevision: 0,
    candidateTasks: replacements,
  }),
  currentTasks: [],
  currentPlanRevision: 0,
});
assert.equal(initialGroupResult.changed, true);
assert.deepEqual(initialGroupResult.tasks, replacements);
assert.deepEqual(initialGroupResult.adoptedCandidateTaskIds, ['candidate-r1', 'candidate-r2']);

const protectedReplacementResult = adoptTrainingTaskGroupCandidate({
  session: replacementSession,
  currentTasks,
  currentPlanRevision: 2,
  protectedTaskIds: ['task-a'],
});
assert.deepEqual(
  protectedReplacementResult.tasks.map((task) => task.localId),
  ['task-a', 'candidate-r1', 'candidate-r2'],
);
assert.deepEqual(
  protectedReplacementResult.adoptedCandidateTaskIds,
  ['candidate-r1', 'candidate-r2'],
);
assert.deepEqual(
  summarizeTrainingTaskGroupCoverage(protectedReplacementResult.tasks),
  {
    taskCount: 3,
    abilityIds: ['analysis', 'comprehension', 'expression'],
    dimensionIds: ['character', 'language', 'theme'],
  },
);

const supplementCandidates = [
  { localId: 'candidate-s1', abilityId: 'expression', primaryDimension: 'character', questionStem: '评价人物形象。' },
  { localId: 'candidate-s2', abilityId: 'analysis', primaryDimension: 'character', questionStem: '分析人物心理。' },
];
const supplementSession = createTrainingTaskGroupCandidateSession({
  candidateGroupId: 'group-supplement',
  operationType: 'supplement_group',
  basedOnPlanRevision: 2,
  candidateTasks: supplementCandidates,
});
assert.deepEqual(supplementSession.selectedCandidateTaskIds, ['candidate-s1', 'candidate-s2']);
const supplementResult = adoptTrainingTaskGroupCandidate({
  session: supplementSession,
  currentTasks,
  currentPlanRevision: 2,
});
assert.equal(supplementResult.tasks.length, 3);
assert.deepEqual(supplementResult.adoptedCandidateTaskIds, ['candidate-s1']);

const capacityResult = adoptTrainingTaskGroupCandidate({
  session: {
    ...supplementSession,
    selectedCandidateTaskIds: ['candidate-s1', 'candidate-s2'],
  },
  currentTasks: [
    ...currentTasks,
    { localId: 'task-c', abilityId: 'inference', primaryDimension: 'causality', questionStem: '解释原因。' },
    { localId: 'task-d', abilityId: 'expression', primaryDimension: 'language', questionStem: '组织表达。' },
  ],
  currentPlanRevision: 2,
  maxTasks: MAX_TRAINING_TASK_COUNT,
});
assert.equal(capacityResult.tasks.length, MAX_TRAINING_TASK_COUNT);
assert.equal(capacityResult.adoptedCandidateTaskIds.length, 1);

assert.throws(
  () => adoptTrainingTaskGroupCandidate({
    session: supplementSession,
    currentTasks,
    currentPlanRevision: 3,
  }),
  /candidate_revision_stale/,
);
assert.deepEqual(currentTasks.map((task) => task.localId), ['task-a', 'task-b']);

console.log('Training task group planning debug passed.');
