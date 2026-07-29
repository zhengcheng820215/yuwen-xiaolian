import { adoptSingleTrainingTaskCandidate } from '../../pages/singleTrainingTaskRegenerationState.ts';

const sourceTasks = [
  {
    localId: 'task-local-1',
    observationTaskPlanId: 'task-plan-1',
    questionStem: '题目一',
    editorDirty: false,
  },
  {
    localId: 'task-local-2',
    observationTaskPlanId: 'task-plan-2',
    questionStem: '原题目二',
    editorDirty: false,
  },
  {
    localId: 'task-local-3',
    observationTaskPlanId: 'task-plan-3',
    questionStem: '题目三',
    editorDirty: false,
  },
];
const candidate = {
  localId: 'candidate-local-2',
  observationTaskPlanId: 'task-plan-2',
  questionStem: '候选题目二',
  editorDirty: false,
};

const result = adoptSingleTrainingTaskCandidate({
  currentTasks: sourceTasks,
  sourceTaskId: 'task-plan-2',
  candidateTask: candidate,
});

expect(result.changed, 'Candidate adoption did not report a local change.');
expect(result.tasks.length === sourceTasks.length, 'Candidate adoption changed the task count.');
expect(result.tasks[0] === sourceTasks[0] && result.tasks[2] === sourceTasks[2], 'Sibling tasks were replaced.');
expect(result.tasks[1].questionStem === '候选题目二', 'Candidate content did not enter the editing buffer.');
expect(result.tasks[1].localId === 'task-local-2', 'Target local editing identity was not preserved.');
expect(result.tasks[1].observationTaskPlanId === 'task-plan-2', 'Target task identity was not preserved.');
expect(result.tasks[1].editorDirty === true, 'Adopted task was not marked dirty.');
expect(sourceTasks[1].questionStem === '原题目二', 'Source task array was mutated.');

let staleRejected = false;
try {
  adoptSingleTrainingTaskCandidate({
    currentTasks: sourceTasks,
    sourceTaskId: 'missing-task',
    candidateTask: candidate,
  });
} catch (error) {
  staleRejected = error instanceof Error && error.message === 'single_task_candidate_stale';
}
expect(staleRejected, 'A stale single-task candidate was adopted.');

console.log('Single Task Regeneration P0 Debug');
console.log('='.repeat(72));
console.log('PASS adoption updates only the local editing buffer');
console.log('PASS task count and sibling tasks remain unchanged');
console.log('PASS target editing identity remains stable');
console.log('PASS source state is immutable');
console.log('PASS stale candidates are rejected');
console.log('Result: 5 / 5 PASS');

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}
