import assert from 'node:assert/strict';
import {
  adoptTrainingTaskGroupCandidate,
  createTrainingTaskGroupCandidateSession,
  summarizeTrainingTaskGroupCoverage,
  toggleSupplementCandidateSelection,
} from '../../pages/trainingTaskGroupPlanningState.ts';

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
let supplementSession = createTrainingTaskGroupCandidateSession({
  candidateGroupId: 'group-supplement',
  operationType: 'supplement_group',
  basedOnPlanRevision: 2,
  candidateTasks: supplementCandidates,
});
supplementSession = toggleSupplementCandidateSelection(supplementSession, 'candidate-s1');
supplementSession = toggleSupplementCandidateSelection(supplementSession, 'candidate-s2');
const supplementResult = adoptTrainingTaskGroupCandidate({
  session: supplementSession,
  currentTasks,
  currentPlanRevision: 2,
});
assert.equal(supplementResult.tasks.length, 3);
assert.deepEqual(supplementResult.adoptedCandidateTaskIds, ['candidate-s1']);

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
