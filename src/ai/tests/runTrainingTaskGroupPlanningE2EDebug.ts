import assert from 'node:assert/strict';
import {
  createMaterialProductionPlan,
  type MaterialProductionTaskInput,
} from '../agents/materialObservationApplicationService.ts';
import { createQuestionMaterial } from '../agents/questionResourceAdmissionAgent.ts';
import { InMemoryMaterialObservationRepository } from '../repositories/inMemoryMaterialObservationRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  adoptTrainingTaskGroupCandidate,
  createTrainingTaskGroupCandidateSession,
  type TrainingTaskGroupCandidate,
} from '../../pages/trainingTaskGroupPlanningState.ts';

const MATERIAL_VERSION_ID = 'material-task-group-planning-e2e:v1';
const NOW = '2026-07-29T10:00:00.000Z';

type EditableProductionTask = MaterialProductionTaskInput & TrainingTaskGroupCandidate & {
  localId: string;
};

async function main() {
  const resources = new InMemoryQuestionResourceAdmissionRepository();
  const observations = new InMemoryMaterialObservationRepository();
  await createQuestionMaterial(resources, {
    materialId: 'material-task-group-planning-e2e',
    materialVersionId: MATERIAL_VERSION_ID,
    versionNumber: 1,
    title: '皇帝的新装',
    content: [
      '皇帝非常喜欢漂亮的新衣服。',
      '两个骗子声称能织出愚蠢的人看不见的布。',
      '皇帝和大臣都假装看见了布料。',
      '孩子最终说出了皇帝没有穿衣服的真相。',
    ].join('\n'),
    source: {
      sourceType: 'manual',
      description: 'Training task group planning end-to-end regression fixture.',
      copyrightNote: 'Debug fixture.',
    },
    createdAt: NOW,
  });

  const initialTasks = productionTasks('initial');
  const initialSave = await createMaterialProductionPlan(resources, observations, {
    materialVersionId: MATERIAL_VERSION_ID,
    tasks: stripLocalIds(initialTasks),
    now: NOW,
  });
  assert.equal(initialSave.plan.revision, 1);

  let editBuffer = initialTasks;
  const persistedRevisionCount = async () => (
    await observations.listPlans(MATERIAL_VERSION_ID)
  ).length;

  const replacementOne = createTrainingTaskGroupCandidateSession({
    candidateGroupId: 'replacement-cycle-1',
    operationType: 'replace_group',
    basedOnPlanRevision: initialSave.plan.revision,
    candidateTasks: productionTasks('replacement-one'),
  });
  editBuffer = adoptTrainingTaskGroupCandidate({
    session: replacementOne,
    currentTasks: editBuffer,
    currentPlanRevision: initialSave.plan.revision,
  }).tasks;
  assert.equal(await persistedRevisionCount(), 1, 'Adopting the first replacement group created a Revision.');

  const supplement = createTrainingTaskGroupCandidateSession({
    candidateGroupId: 'supplement-cycle-2',
    operationType: 'supplement_group',
    basedOnPlanRevision: initialSave.plan.revision,
    candidateTasks: [supplementTask()],
  });
  editBuffer = adoptTrainingTaskGroupCandidate({
    session: supplement,
    currentTasks: editBuffer,
    currentPlanRevision: initialSave.plan.revision,
  }).tasks;
  assert.equal(await persistedRevisionCount(), 1, 'Adopting supplement candidates created a Revision.');

  const replacementTwo = createTrainingTaskGroupCandidateSession({
    candidateGroupId: 'replacement-cycle-3',
    operationType: 'replace_group',
    basedOnPlanRevision: initialSave.plan.revision,
    candidateTasks: productionTasks('replacement-two'),
  });
  editBuffer = adoptTrainingTaskGroupCandidate({
    session: replacementTwo,
    currentTasks: editBuffer,
    currentPlanRevision: initialSave.plan.revision,
  }).tasks;
  assert.equal(await persistedRevisionCount(), 1, 'Adopting the second replacement group created a Revision.');

  const finalSave = await createMaterialProductionPlan(resources, observations, {
    materialVersionId: MATERIAL_VERSION_ID,
    tasks: stripLocalIds(editBuffer),
    now: '2026-07-29T10:30:00.000Z',
  });
  const persistedPlans = (await observations.listPlans(MATERIAL_VERSION_ID))
    .sort((left, right) => left.revision - right.revision);

  assert.equal(finalSave.plan.revision, 1);
  assert.equal(
    finalSave.plan.materialObservationPlanId,
    initialSave.plan.materialObservationPlanId,
    'Final save replaced the unique working draft instead of updating it.',
  );
  assert.equal(persistedPlans.length, 1, 'Candidate adoption and final save must keep one working Revision.');
  assert.deepEqual(persistedPlans.map((plan) => plan.revision), [1]);
  assert.deepEqual(
    finalSave.plan.taskPlans.map((task) => task.observationGoal),
    editBuffer.map((task) => task.questionStem),
    'The final candidate selection was not persisted to the working Revision.',
  );

  console.log('PASS multiple candidate cycles update exactly one working Revision');
  console.log(`Candidate adoption cycles: 3; persisted Revisions: ${persistedPlans.length}`);
}

function productionTasks(prefix: string): EditableProductionTask[] {
  return [
    task(`${prefix}-fact`, 'fact', 'extraction', 'basic', 2, `${prefix}：骗子宣称布料有什么特点？`),
    task(`${prefix}-character`, 'character', 'analysis', 'intermediate', 3, `${prefix}：皇帝和大臣为什么假装看见布料？`),
    task(`${prefix}-theme`, 'theme', 'comprehension', 'intermediate', 4, `${prefix}：孩子说出真相表现了怎样的主题？`),
  ];
}

function supplementTask(): EditableProductionTask {
  return task(
    'supplement-expression',
    'language',
    'expression',
    'intermediate',
    4,
    '补充：请用简洁语言评价孩子说出真相的行为。',
  );
}

function task(
  localId: string,
  primaryDimension: MaterialProductionTaskInput['primaryDimension'],
  abilityId: string,
  difficulty: MaterialProductionTaskInput['difficulty'],
  startParagraph: number,
  questionStem: string,
): EditableProductionTask {
  return {
    localId,
    primaryDimension,
    abilityId,
    taskRole: 'training',
    difficulty,
    startParagraph,
    questionStem,
    expectedStudentAction: `完成任务：${questionStem}`,
    designReason: `验证 ${abilityId} 能力。`,
    materialRelationIntent: 'same_context',
  };
}

function stripLocalIds(tasks: EditableProductionTask[]): MaterialProductionTaskInput[] {
  return tasks.map(({ localId: _localId, candidateId: _candidateId, ...taskInput }) => taskInput);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
