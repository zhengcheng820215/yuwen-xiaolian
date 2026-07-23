import {
  createAndValidateQuestionDraftBatch,
  createMaterialProductionPlan,
  reviewMaterialObservationPlan,
  submitMaterialObservationPlanForReview,
  type MaterialProductionTaskInput,
} from '../agents/materialObservationApplicationService.ts';
import {
  createQuestionMaterial,
  submitQuestionResourceForReview,
} from '../agents/questionResourceAdmissionAgent.ts';
import { InMemoryMaterialObservationRepository } from '../repositories/inMemoryMaterialObservationRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import type { StructuredQuestionDraft } from '../schemas/questionResourceAdmission.schema.ts';

const NOW = '2026-07-22T10:00:00.000Z';
type Fixture = Awaited<ReturnType<typeof createFixture>>;
type DebugCase = { name: string; run: () => void | Promise<void> };

const cases: DebugCase[] = [
  { name: '01 one Material creates a valid 3-task production Plan', run: caseCreatesPlan },
  { name: '02 production batch enforces the 3-to-6 task boundary', run: caseTaskCountBoundary },
  { name: '03 duplicate question stems are blocked', run: caseDuplicateStem },
  { name: '04 invalid paragraph anchor creates no formal Plan', run: caseInvalidParagraph },
  { name: '05 metadata is inherited from reviewed Observation Task', run: caseMetadataInheritance },
  { name: '06 unreviewed Plan cannot create question Drafts', run: caseReviewGate },
  { name: '07 reviewed Plan creates and validates all Drafts', run: caseBatchCreatesDrafts },
  { name: '08 repeated batch reuses Drafts without duplication', run: caseBatchIdempotency },
  { name: '09 repeated batch does not mutate a pending-review Draft', run: caseNonEditableDraftProtected },
  { name: '10 one Draft failure does not erase successful siblings', run: casePartialFailureIsolation },
  { name: '11 batch creation never auto-freezes or updates Registry', run: caseNoAutomaticFormalization },
  { name: '12 a revised Plan keeps explicit lineage', run: casePlanRevisionLineage },
  { name: '13 Draft handoff preserves Rubric and Answer Acceptance', run: caseDraftHandoffContent },
];

async function main() {
  let passed = 0;
  const failures: string[] = [];
  console.log('Phase 17.2 Minimal Material Resource Production Debug');
  console.log('='.repeat(72));
  for (const item of cases) {
    try {
      await item.run();
      passed += 1;
      console.log(`PASS ${item.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${item.name}: ${message}`);
      console.log(`FAIL ${item.name}: ${message}`);
    }
  }
  console.log('-'.repeat(72));
  console.log(`Result: ${passed} / ${cases.length} PASS`);
  console.log(`Phase 17.2 Minimal Production Workspace Engineering: ${failures.length ? 'FAIL' : 'PASS'}`);
  if (failures.length) {
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function caseCreatesPlan() {
  const fixture = await createFixture();
  expect(fixture.validation.passed, fixture.validation.issues.map((issue) => issue.code).join(','));
  expect(fixture.plan.taskPlans.length === 3, 'Production Plan did not preserve the three tasks.');
  const anchors = await fixture.observations.listAnchors(fixture.material.materialVersionId);
  expect(fixture.plan.taskPlans.every((task) => task.sourceAnchorIds.length === 1 && anchors.some((anchor) => anchor.sourceAnchorId === task.sourceAnchorIds[0])), 'A Task does not resolve to a formal Source Anchor.');
}

async function caseTaskCountBoundary() {
  const fixture = await createRepositories();
  await rejects(() => createMaterialProductionPlan(fixture.resources, fixture.observations, {
    materialVersionId: fixture.material.materialVersionId,
    tasks: tasks().slice(0, 2), now: NOW,
  }), '3 to 6');
  await rejects(() => createMaterialProductionPlan(fixture.resources, fixture.observations, {
    materialVersionId: fixture.material.materialVersionId,
    tasks: [...tasks(), ...tasks().map((task, index) => ({ ...task, questionStem: `${task.questionStem}${index + 1}` })), tasks()[0]], now: NOW,
  }), '3 to 6');
}

async function caseDuplicateStem() {
  const fixture = await createRepositories();
  const input = tasks();
  input[1].questionStem = input[0].questionStem;
  await rejects(() => createMaterialProductionPlan(fixture.resources, fixture.observations, {
    materialVersionId: fixture.material.materialVersionId, tasks: input, now: NOW,
  }), 'distinct question stems');
}

async function caseInvalidParagraph() {
  const fixture = await createRepositories();
  const input = tasks();
  input[1].startParagraph = 99;
  await rejects(() => createMaterialProductionPlan(fixture.resources, fixture.observations, {
    materialVersionId: fixture.material.materialVersionId, tasks: input, now: NOW,
  }), 'paragraph range');
  expect((await fixture.observations.listPlans()).length === 0, 'Failed anchor creation polluted formal Plans.');
}

async function caseMetadataInheritance() {
  const fixture = await reviewedFixture();
  const results = await createAndValidateQuestionDraftBatch(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, now: NOW });
  const task = fixture.plan.taskPlans[1];
  const draft = (await fixture.resources.listDrafts()).find((item) => item.draftId === results[1].draftId)!;
  expect(draft.materialVersionId === fixture.material.materialVersionId, 'Material identity was not inherited.');
  expect(draft.abilityMetadata.abilityId === task.abilityId && draft.abilityMetadata.taskRole === task.taskRole && draft.abilityMetadata.difficulty === task.difficulty, 'Ability, role or difficulty drifted during adaptation.');
  expect(draft.tags.includes(`observation_task:${task.observationTaskPlanId}`), 'Observation Task trace tag is missing.');
}

async function caseReviewGate() {
  const fixture = await createFixture();
  await rejects(() => createAndValidateQuestionDraftBatch(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId }), 'reviewed');
  expect((await fixture.resources.listDrafts()).length === 0, 'Unreviewed Plan created Drafts.');
}

async function caseBatchCreatesDrafts() {
  const fixture = await reviewedFixture();
  const results = await createAndValidateQuestionDraftBatch(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, now: NOW });
  expect(results.length === 3 && results.every((item) => item.status === 'created' && item.validationPassed), JSON.stringify(results));
  expect((await fixture.resources.listDrafts()).length === 3, 'Batch did not persist all Drafts.');
}

async function caseBatchIdempotency() {
  const fixture = await reviewedFixture();
  await createAndValidateQuestionDraftBatch(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, now: NOW });
  const repeated = await createAndValidateQuestionDraftBatch(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, now: NOW });
  expect(repeated.every((item) => item.status === 'reused'), 'Repeated batch did not report reuse.');
  expect((await fixture.resources.listDrafts()).length === 3, 'Repeated batch duplicated Drafts.');
}

async function caseNonEditableDraftProtected() {
  const fixture = await reviewedFixture();
  const first = await createAndValidateQuestionDraftBatch(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, now: NOW });
  await submitQuestionResourceForReview(fixture.resources, first[0].draftId, NOW);
  await createAndValidateQuestionDraftBatch(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, now: NOW });
  const draft = await fixture.resources.getDraft(first[0].draftId);
  expect(draft?.status === 'pending_review', 'Repeated production moved a pending-review Draft back to drafted.');
}

async function casePartialFailureIsolation() {
  const resources = new FailSecondProductionDraftRepository();
  const fixture = await createFixture({ resources });
  await reviewPlan(fixture);
  const results = await createAndValidateQuestionDraftBatch(resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, now: NOW });
  expect(results.filter((item) => item.status === 'failed').length === 1, JSON.stringify(results));
  expect(results.filter((item) => item.status === 'created').length === 2, 'Successful sibling Drafts were lost.');
  expect((await resources.listDrafts()).length === 2, 'Partial failure polluted or erased successful Drafts.');
}

async function caseNoAutomaticFormalization() {
  const fixture = await reviewedFixture();
  await createAndValidateQuestionDraftBatch(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, now: NOW });
  expect((await fixture.resources.listVersions()).length === 0, 'Production batch auto-froze a resource.');
  expect((await fixture.resources.listRegistryEntries()).length === 0, 'Production batch changed Resource Registry.');
  expect((await fixture.observations.listLinks()).length === 0, 'Production batch created a formal Resource Observation Link.');
}

async function casePlanRevisionLineage() {
  const fixture = await createFixture();
  const second = await createMaterialProductionPlan(fixture.resources, fixture.observations, {
    materialVersionId: fixture.material.materialVersionId,
    tasks: tasks().map((task, index) => ({ ...task, questionStem: `${task.questionStem}（修订 ${index + 1}）` })),
    now: '2026-07-22T11:00:00.000Z',
  });
  expect(second.plan.revision === 2 && second.plan.parentPlanId === fixture.plan.materialObservationPlanId, 'Plan revision lineage is incomplete.');
}

async function caseDraftHandoffContent() {
  const fixture = await reviewedFixture();
  await createAndValidateQuestionDraftBatch(fixture.resources, fixture.observations, { planId: fixture.plan.materialObservationPlanId, now: NOW });
  const drafts = await fixture.resources.listDrafts();
  expect(drafts.every((draft) => draft.rubric.length > 0), 'A production Draft lost its Rubric during handoff.');
  expect(drafts.every((draft) => draft.answerAcceptance?.semanticEquivalentAllowed), 'A production Draft lost its Answer Acceptance boundary.');
  expect(drafts.every((draft) => draft.latestValidationId), 'A production Draft cannot locate its field-level validation result.');
}

async function reviewedFixture() {
  const fixture = await createFixture();
  await reviewPlan(fixture);
  fixture.plan = (await fixture.observations.getPlan(fixture.plan.materialObservationPlanId))!;
  return fixture;
}

async function reviewPlan(fixture: Fixture) {
  await submitMaterialObservationPlanForReview(fixture.resources, fixture.observations, fixture.plan.materialObservationPlanId, NOW);
  await reviewMaterialObservationPlan(fixture.observations, {
    planId: fixture.plan.materialObservationPlanId,
    action: 'approve',
    reviewerId: 'phase17-reviewer',
    notes: 'Observation design reviewed.',
    now: NOW,
  });
}

async function createFixture(options: { resources?: InMemoryQuestionResourceAdmissionRepository } = {}) {
  const base = await createRepositories(options.resources);
  const result = await createMaterialProductionPlan(base.resources, base.observations, {
    materialVersionId: base.material.materialVersionId,
    tasks: tasks(),
    now: NOW,
  });
  return { ...base, ...result };
}

async function createRepositories(resources = new InMemoryQuestionResourceAdmissionRepository()) {
  const observations = new InMemoryMaterialObservationRepository();
  const material = await createQuestionMaterial(resources, {
    materialId: 'material-phase17-production',
    materialVersionId: 'material-phase17-production:v1',
    versionNumber: 1,
    title: '雨中的母亲',
    content: '雨忽然大了起来，母亲撑开伞。\n母亲把伞更多地推向孩子，自己的肩膀被雨淋湿。\n孩子抬头看见母亲湿透的衣袖，握紧了她的手。',
    source: { sourceType: 'manual', description: 'Phase 17.2 production debug material.', copyrightNote: 'Debug fixture.' },
    createdAt: NOW,
  });
  return { resources, observations, material };
}

function tasks(): MaterialProductionTaskInput[] {
  return [
    {
      primaryDimension: 'fact', abilityId: 'extraction', taskRole: 'training', difficulty: 'basic', startParagraph: 2,
      questionStem: '母亲撑伞时做了哪些具体动作？', expectedStudentAction: '提取母亲推伞和自己淋雨的动作。', designReason: '观察学生能否找到显性事实。', materialRelationIntent: 'same_context',
    },
    {
      primaryDimension: 'character', abilityId: 'inference', taskRole: 'retest', difficulty: 'intermediate', startParagraph: 2,
      questionStem: '从母亲撑伞的动作中，可以推断出她怎样的心理？请说明理由。', expectedStudentAction: '根据动作推断人物心理并建立依据关系。', designReason: '观察学生能否从显性动作推导隐性心理。', intendedComparisonGroupId: 'phase17-production-inference', materialRelationIntent: 'similar_context',
    },
    {
      primaryDimension: 'theme', abilityId: 'comprehension', taskRole: 'transfer', difficulty: 'intermediate', startParagraph: 3,
      questionStem: '结合全文内容，说说这段文字主要表达了怎样的亲情。', expectedStudentAction: '整合全文事实并理解情感表达。', designReason: '观察学生能否从局部事实形成整体理解。', intendedComparisonGroupId: 'phase17-production-comprehension', materialRelationIntent: 'new_context',
    },
  ];
}

class FailSecondProductionDraftRepository extends InMemoryQuestionResourceAdmissionRepository {
  private productionWrites = 0;
  override async saveDraft(draft: StructuredQuestionDraft) {
    if (draft.tags.includes('phase17.2') && draft.status === 'drafted' && !draft.latestValidationId) {
      this.productionWrites += 1;
      if (this.productionWrites === 2) throw new Error('Simulated second Draft persistence failure.');
    }
    return super.saveDraft(draft);
  }
}

async function rejects(action: () => Promise<unknown>, fragment: string) {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message.toLowerCase().includes(fragment.toLowerCase()), `Unexpected error: ${message}`);
    return;
  }
  throw new Error(`Expected rejection containing: ${fragment}`);
}
function expect(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

main().catch((error) => { console.error(error); process.exitCode = 1; });
