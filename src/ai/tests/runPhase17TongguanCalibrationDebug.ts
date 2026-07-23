import {
  createAndValidateQuestionDraftBatch,
  createMaterialProductionPlan,
  linkFrozenResourceToObservationTask,
  reviewMaterialObservationPlan,
  submitMaterialObservationPlanForReview,
} from '../agents/materialObservationApplicationService.ts';
import {
  createQuestionMaterial,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
} from '../agents/questionResourceAdmissionAgent.ts';
import { InMemoryMaterialObservationRepository } from '../repositories/inMemoryMaterialObservationRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  PHASE17_TONGGUAN_EXPECTED,
  PHASE17_TONGGUAN_MATERIAL,
  PHASE17_TONGGUAN_TASKS,
} from '../../data/phase17TongguanCalibration.ts';

const NOW = '2026-07-23T12:00:00.000Z';
const REVIEWER = 'phase17-tongguan-calibration-reviewer';
type Environment = Awaited<ReturnType<typeof createEnvironment>>;
type DebugCase = { name: string; run: (environment: Environment) => void | Promise<void> };

async function main(): Promise<void> {
  const environment = await createEnvironment();
  const cases: DebugCase[] = [
    { name: '01 calibration case contains one Material and six tasks', run: caseCounts },
    { name: '02 six tasks cover six unique primary Abilities', run: caseAbilityCoverage },
    { name: '03 all same-Material tasks remain Training', run: caseNoFalseRetestOrTransfer },
    { name: '04 Observation Focus remains structured and plan-local', run: caseObservationFocus },
    { name: '05 paragraph, range and full-text anchors are preserved', run: caseAnchorModes },
    { name: '06 every task carries production-ready Rubric and Answer Acceptance', run: caseProductionSpecification },
    { name: '07 calibration answers include complete, partial and error boundaries', run: caseCalibrationBoundaries },
    { name: '08 reviewed Plan generates six valid Drafts without generic overwrite', run: caseDraftHandoff },
    { name: '09 calibration answers remain review-only and do not enter formal Drafts', run: caseCalibrationIsolation },
    { name: '10 Retest or Transfer without comparison identity is blocked', run: caseUnsafeRoleBlocked },
    { name: '11 controlled Freeze creates six active Observation Links', run: caseFormalLinks },
    { name: '12 repeated Draft generation remains idempotent', run: caseDraftIdempotency },
  ];

  let passed = 0;
  const failures: string[] = [];
  console.log('Phase 17.2 Tongguan Material Cluster Calibration Debug');
  console.log('='.repeat(78));
  for (const item of cases) {
    try {
      await item.run(environment);
      passed += 1;
      console.log(`PASS ${item.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${item.name}: ${message}`);
      console.log(`FAIL ${item.name}: ${message}`);
    }
  }
  console.log('-'.repeat(78));
  console.log(`Result: ${passed} / ${cases.length} PASS`);
  console.log(`Material Cluster calibration: ${failures.length === 0 ? 'PASS' : 'FAIL'}`);
  console.log('External Provider calls: 0');
  console.log('Browser content owner review: PENDING');
  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function createEnvironment() {
  const resources = new InMemoryQuestionResourceAdmissionRepository();
  const observations = new InMemoryMaterialObservationRepository();
  const material = await createQuestionMaterial(resources, {
    ...PHASE17_TONGGUAN_MATERIAL,
    createdAt: NOW,
    updatedAt: NOW,
  });
  const created = await createMaterialProductionPlan(resources, observations, {
    materialVersionId: material.materialVersionId,
    tasks: PHASE17_TONGGUAN_TASKS,
    now: NOW,
  });
  expect(created.validation.passed, created.validation.issues.map((issue) => issue.code).join(','));
  await submitMaterialObservationPlanForReview(resources, observations, created.plan.materialObservationPlanId, NOW);
  await reviewMaterialObservationPlan(observations, {
    planId: created.plan.materialObservationPlanId,
    action: 'approve',
    reviewerId: REVIEWER,
    notes: '《潼关》材料、六项观测焦点、Rubric、接受边界和任务角色已完成受控校准审核。',
    now: NOW,
  });
  const plan = await observations.getPlan(created.plan.materialObservationPlanId);
  if (!plan) throw new Error('Reviewed Plan missing.');
  const draftResults = await createAndValidateQuestionDraftBatch(resources, observations, {
    planId: plan.materialObservationPlanId,
    sourceDescription: '《潼关》校准案例受控 Draft。',
    now: NOW,
  });
  return { resources, observations, material, plan, draftResults };
}

function caseCounts(): void {
  expect(PHASE17_TONGGUAN_EXPECTED.materialCount === 1, 'Material count drifted.');
  expect(PHASE17_TONGGUAN_TASKS.length === PHASE17_TONGGUAN_EXPECTED.taskCount, 'Task count drifted.');
}

function caseAbilityCoverage(environment: Environment): void {
  const abilities = new Set(environment.plan.taskPlans.map((task) => task.abilityId));
  expect(abilities.size === 6, `Expected six Abilities, got ${[...abilities].join(',')}.`);
  expect(PHASE17_TONGGUAN_EXPECTED.abilities.every((ability) => abilities.has(ability)), 'Primary Ability coverage is incomplete.');
}

function caseNoFalseRetestOrTransfer(environment: Environment): void {
  expect(environment.plan.taskPlans.every((task) => task.taskRole === 'training'), 'Same-Material progression was mislabeled as Retest or Transfer.');
}

function caseObservationFocus(environment: Environment): void {
  expect(environment.plan.taskPlans.every((task) => (
    task.observationFocus?.scope === 'plan_local'
    && Boolean(task.observationFocus.displayName)
    && Boolean(task.observationFocus.definition)
  )), 'Observation Focus was lost or promoted into a global taxonomy.');
}

async function caseAnchorModes(environment: Environment): Promise<void> {
  const anchors = await environment.observations.listAnchors(environment.material.materialVersionId);
  const types = new Set(anchors.map((anchor) => anchor.anchorType));
  expect(types.has('paragraph') && types.has('paragraph_range') && types.has('full_text'), `Anchor modes incomplete: ${[...types].join(',')}.`);
  expect(anchors.some((anchor) => anchor.anchorType === 'paragraph_range' && anchor.startParagraph === 3 && anchor.endParagraph === 4), 'Poem-line range Anchor was not preserved.');
}

function caseProductionSpecification(environment: Environment): void {
  for (const task of environment.plan.taskPlans) {
    const specification = task.resourceDraftSpecification;
    expect(specification, `${task.observationTaskPlanId} has no Draft specification.`);
    expect(specification.rubric.length >= 2, `${task.observationTaskPlanId} has an underspecified Rubric.`);
    expect(specification.answerAcceptance?.semanticEquivalentAllowed, `${task.observationTaskPlanId} blocks reasonable alternatives.`);
    expect(specification.minimumAnswerRequirement.requireTextEvidence, `${task.observationTaskPlanId} lost material grounding.`);
  }
}

function caseCalibrationBoundaries(environment: Environment): void {
  for (const task of environment.plan.taskPlans) {
    const categories = new Set((task.calibrationCases || []).map((item) => item.category));
    expect(categories.has('fully_meets'), `${task.observationTaskPlanId} lacks a complete-answer calibration.`);
    expect(categories.has('partially_meets'), `${task.observationTaskPlanId} lacks a partial-answer calibration.`);
    expect(categories.has('typical_error'), `${task.observationTaskPlanId} lacks an error calibration.`);
  }
  expect(environment.plan.taskPlans.some((task) => task.calibrationCases?.some((item) => item.category === 'reasonable_alternative')), 'Reasonable-alternative calibration is missing.');
}

async function caseDraftHandoff(environment: Environment): Promise<void> {
  expect(environment.draftResults.length === 6 && environment.draftResults.every((item) => item.validationPassed), 'Six valid Drafts were not created.');
  const drafts = await environment.resources.listDrafts();
  for (const task of environment.plan.taskPlans) {
    const draft = drafts.find((item) => item.tags.includes(`observation_task:${task.observationTaskPlanId}`));
    expect(draft, `Draft missing for ${task.observationTaskPlanId}.`);
    expect(draft.title === task.resourceDraftSpecification?.title, 'Content-specific title was replaced by a generic title.');
    expect(draft.rubric.length === task.resourceDraftSpecification?.rubric.length, 'Detailed Rubric was not preserved.');
    expect(draft.abilityMetadata.supportingAbilityIds.length === task.resourceDraftSpecification?.supportingAbilityIds.length, 'Supporting Abilities were not preserved.');
  }
}

async function caseCalibrationIsolation(environment: Environment): Promise<void> {
  const drafts = await environment.resources.listDrafts();
  expect(drafts.every((draft) => !('calibrationCases' in draft)), 'Review-only calibration answers leaked into formal Draft schema.');
  expect(environment.plan.taskPlans.every((task) => (task.calibrationCases || []).length >= 3), 'Calibration answers did not remain available in the Plan.');
}

async function caseUnsafeRoleBlocked(): Promise<void> {
  const resources = new InMemoryQuestionResourceAdmissionRepository();
  const observations = new InMemoryMaterialObservationRepository();
  const material = await createQuestionMaterial(resources, {
    ...PHASE17_TONGGUAN_MATERIAL,
    materialId: 'phase17-calibration-invalid-role',
    materialVersionId: 'phase17-calibration-invalid-role:v1',
    createdAt: NOW,
    updatedAt: NOW,
  });
  const tasks = PHASE17_TONGGUAN_TASKS.slice(0, 3).map((task) => JSON.parse(JSON.stringify(task)));
  tasks[0].taskRole = 'transfer';
  tasks[0].materialRelationIntent = 'same_context';
  tasks[0].intendedComparisonGroupId = undefined;
  const result = await createMaterialProductionPlan(resources, observations, {
    materialVersionId: material.materialVersionId,
    tasks,
    now: NOW,
  });
  const codes = result.validation.issues.map((issue) => issue.code);
  expect(!result.validation.passed, 'Unsafe Transfer Plan unexpectedly passed.');
  expect(codes.includes('task.comparison_group_missing') && codes.includes('task.transfer_context_invalid'), codes.join(','));
}

async function caseFormalLinks(environment: Environment): Promise<void> {
  const drafts = await environment.resources.listDrafts();
  for (const draft of drafts) {
    await submitQuestionResourceForReview(environment.resources, draft.draftId, NOW);
    await reviewQuestionResourceDraft(environment.resources, {
      draftId: draft.draftId,
      action: 'approve',
      reviewerId: REVIEWER,
      notes: '校准内容、Rubric 与合理异表述边界已人工复核。',
      now: NOW,
    });
    const frozen = await freezeQuestionResourceDraft(environment.resources, draft.draftId, NOW);
    const task = environment.plan.taskPlans.find((item) => draft.tags.includes(`observation_task:${item.observationTaskPlanId}`));
    if (!task) throw new Error(`Observation Task missing for ${draft.draftId}.`);
    const linked = await linkFrozenResourceToObservationTask(environment.resources, environment.observations, {
      planId: environment.plan.materialObservationPlanId,
      observationTaskPlanId: task.observationTaskPlanId,
      resourceVersionId: frozen.version.resourceVersionId,
      linkedAt: NOW,
    });
    expect(linked.link.status === 'active', linked.issues.join(','));
  }
  const links = await environment.observations.listLinks();
  expect(links.length === 6 && links.every((link) => link.status === 'active'), 'Six active formal links were not created.');
  expect(new Set(links.map((link) => link.materialId)).size === 1, 'One Material was counted as multiple Material Clusters.');
  expect(new Set(links.map((link) => link.abilityId)).size === 6, 'Formal links lost Ability aggregation.');
}

async function caseDraftIdempotency(environment: Environment): Promise<void> {
  const repeated = await createAndValidateQuestionDraftBatch(environment.resources, environment.observations, {
    planId: environment.plan.materialObservationPlanId,
    sourceDescription: 'Repeated Tongguan calibration production.',
    now: NOW,
  });
  expect(repeated.length === 6 && repeated.every((item) => item.status === 'reused'), 'Repeated generation did not reuse six Drafts.');
  expect((await environment.resources.listDrafts()).length === 6, 'Repeated generation duplicated Drafts.');
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

await main();
