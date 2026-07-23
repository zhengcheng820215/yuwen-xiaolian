import {
  PHASE17_BATCH_A_ANSWER_FIXTURES,
  PHASE17_BATCH_A_EXPECTED,
  PHASE17_BATCH_A_MATERIALS,
} from '../../data/phase17BatchAFormalResources.ts';
import {
  batchAResourceDefinitions,
  producePhase17BatchA,
  validatePhase17BatchABlueprint,
} from '../agents/phase17BatchAProductionService.ts';
import { InMemoryMaterialObservationRepository } from '../repositories/inMemoryMaterialObservationRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';

const NOW = '2026-07-23T08:00:00.000Z';
const REVIEWER = 'phase17-batch-a-controlled-content-review';
const REVIEW_NOTE = 'Batch A 材料、题目目标、Rubric、Answer Acceptance、任务角色与来源已完成受控内容复核。产品负责人浏览器人工验收仍独立记录。';

type Environment = Awaited<ReturnType<typeof createEnvironment>>;
type DebugCase = { name: string; run: (environment: Environment) => void | Promise<void> };

async function main(): Promise<void> {
  const environment = await createEnvironment();
  const cases: DebugCase[] = [
    { name: '01 frozen blueprint contains two Materials and eight unique resources', run: caseBlueprintCounts },
    { name: '02 Batch A covers four Abilities without pretending to cover all six', run: caseAbilityCoverage },
    { name: '03 one Training-to-Retest chain preserves inference and changes Material', run: caseRetestChain },
    { name: '04 one Training-to-Transfer chain preserves analysis and uses a new Material', run: caseTransferChain },
    { name: '05 every resource has content-specific Rubric and semantic Answer Acceptance', run: caseRubricAndAcceptance },
    { name: '06 controlled production creates reviewed Material Observation Plans', run: caseReviewedPlans },
    { name: '07 all eight resources are Frozen current Registry heads', run: caseFrozenRegistry },
    { name: '08 all eight Frozen resources have active Observation Links', run: caseObservationLinks },
    { name: '09 Runtime Coverage query consumes all eight formal resources', run: caseRuntimeCoverage },
    { name: '10 core-chain resources include full, partial and typical-error Fixtures', run: caseCoreFixtures },
    { name: '11 reasonable alternatives and concise valid answers remain explicit boundaries', run: caseBoundaryFixtures },
    { name: '12 Retest and Transfer roles are not silently replaced by Training', run: caseRoleBreakdown },
    { name: '13 Registry and source identities remain internally consistent', run: caseRegistryConsistency },
    { name: '14 repeated controlled production is idempotent', run: caseIdempotency },
  ];

  let passed = 0;
  const failures: string[] = [];
  console.log('Phase 17.2 Batch A First Formal Resource Pack Debug');
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
  console.log(`Batch A controlled formalization: ${failures.length === 0 ? 'PASS' : 'FAIL'}`);
  console.log('External Provider calls: 0');
console.log('Browser owner acceptance: NOT ASSERTED BY AUTOMATED DEBUG');
  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function createEnvironment() {
  const resources = new InMemoryQuestionResourceAdmissionRepository();
  const observations = new InMemoryMaterialObservationRepository();
  const result = await producePhase17BatchA({
    resourceRepository: resources,
    observationRepository: observations,
    targetState: 'controlled_frozen',
    reviewerId: REVIEWER,
    reviewNote: REVIEW_NOTE,
    now: NOW,
  });
  return { resources, observations, result };
}

function caseBlueprintCounts(): void {
  expect(validatePhase17BatchABlueprint().length === 0, validatePhase17BatchABlueprint().join(','));
  expect(PHASE17_BATCH_A_MATERIALS.length === PHASE17_BATCH_A_EXPECTED.materialCount, 'Material count mismatch.');
  expect(batchAResourceDefinitions().length === PHASE17_BATCH_A_EXPECTED.resourceCount, 'Resource count mismatch.');
}

function caseAbilityCoverage(): void {
  const abilities = new Set(batchAResourceDefinitions().map((definition) => definition.abilityId));
  expect(abilities.size === 4, `Expected four Abilities, got ${[...abilities].join(',')}.`);
  expect(!abilities.has('summarization') && !abilities.has('expression'), 'Batch A falsely filled all six Abilities.');
}

function caseRetestChain(): void {
  const chain = batchAResourceDefinitions().filter((definition) => definition.planningChainKey === 'batch-a-inference-retest');
  expect(chain.length === 2, 'Inference Retest chain must contain two resources.');
  expect(chain.every((definition) => definition.abilityId === 'inference'), 'Retest chain changed Ability.');
  expect(chain.some((definition) => definition.taskRole === 'training'), 'Retest chain has no Training source.');
  expect(chain.some((definition) => definition.taskRole === 'retest'), 'Retest chain has no Retest resource.');
  const materialIds = materialIdsFor(chain.map((definition) => definition.resourceKey));
  expect(materialIds.size === 2, 'Retest reused the original Material.');
}

function caseTransferChain(): void {
  const chain = batchAResourceDefinitions().filter((definition) => definition.planningChainKey === 'batch-a-analysis-transfer');
  expect(chain.length === 2, 'Analysis Transfer chain must contain two resources.');
  expect(chain.every((definition) => definition.abilityId === 'analysis'), 'Transfer chain changed Ability.');
  expect(chain.some((definition) => definition.taskRole === 'training'), 'Transfer chain has no Training source.');
  expect(chain.some((definition) => definition.taskRole === 'transfer' && definition.materialRelationIntent === 'new_context'), 'Transfer resource does not require a new context.');
  expect(materialIdsFor(chain.map((definition) => definition.resourceKey)).size === 2, 'Transfer reused the Training Material.');
}

function caseRubricAndAcceptance(): void {
  for (const definition of batchAResourceDefinitions()) {
    expect(definition.rubric.length >= 2, `${definition.resourceKey} has an underspecified Rubric.`);
    expect(definition.rubric.every((item) => item.abilityId === definition.abilityId && item.acceptedSignals.length > 0), `${definition.resourceKey} Rubric is not aligned.`);
    expect(definition.answerAcceptance.semanticEquivalentAllowed, `${definition.resourceKey} blocks semantic alternatives.`);
    expect(definition.minimumAnswerRequirement.requireTextEvidence, `${definition.resourceKey} does not require material grounding.`);
  }
}

async function caseReviewedPlans(environment: Environment): Promise<void> {
  const plans = await environment.observations.listPlans();
  expect(plans.length === 2, `Expected two Plans, got ${plans.length}.`);
  expect(plans.every((plan) => plan.status === 'reviewed' && plan.reviewerId === REVIEWER), 'A Plan is not reviewed or traceable.');
}

async function caseFrozenRegistry(environment: Environment): Promise<void> {
  const [versions, entries] = await Promise.all([
    environment.resources.listVersions(),
    environment.resources.listRegistryEntries(),
  ]);
  expect(versions.length === 8 && versions.every((version) => version.status === 'frozen'), 'Expected eight Frozen versions.');
  expect(entries.length === 8 && entries.every((entry) => entry.status === 'active' && entry.currentFrozenVersionId), 'Expected eight active Registry heads.');
  expect(entries.every((entry) => versions.some((version) => version.resourceVersionId === entry.currentFrozenVersionId)), 'A Registry head is missing.');
}

async function caseObservationLinks(environment: Environment): Promise<void> {
  const links = await environment.observations.listLinks();
  expect(links.length === 8, `Expected eight links, got ${links.length}.`);
  expect(links.every((link) => link.status === 'active'), 'An Observation Link is not active.');
  expect(new Set(links.map((link) => link.observationTaskPlanId)).size === 8, 'Observation Task linkage is duplicated.');
}

function caseRuntimeCoverage(environment: Environment): void {
  expect(environment.result.coverageReportId, 'Runtime Coverage report was not generated.');
  expect(environment.result.runtimeVerifiedCount === 8, `Expected eight Runtime Verified resources, got ${environment.result.runtimeVerifiedCount}.`);
  expect(environment.result.issues.length === 0, environment.result.issues.join(','));
}

function caseCoreFixtures(): void {
  const coreKeys = new Set(batchAResourceDefinitions()
    .filter((definition) => definition.planningChainKey)
    .map((definition) => definition.resourceKey));
  for (const key of coreKeys) {
    const fixtures = PHASE17_BATCH_A_ANSWER_FIXTURES.filter((fixture) => fixture.resourceKey === key);
    const categories = new Set(fixtures.map((fixture) => fixture.category));
    expect(categories.has('fully_meets') && categories.has('partially_meets') && categories.has('typical_error'), `${key} is missing a core Fixture category.`);
  }
}

function caseBoundaryFixtures(): void {
  expect(PHASE17_BATCH_A_ANSWER_FIXTURES.length === PHASE17_BATCH_A_EXPECTED.fixtureCount, 'Fixture count mismatch.');
  expect(PHASE17_BATCH_A_ANSWER_FIXTURES.some((fixture) => fixture.category === 'reasonable_alternative' && fixture.expectedAnswerStatus === 'fully_meets'), 'Reasonable alternative boundary is missing.');
  expect(PHASE17_BATCH_A_ANSWER_FIXTURES.some((fixture) => fixture.category === 'concise_valid' && fixture.expectedAnswerStatus === 'fully_meets'), 'Concise valid boundary is missing.');
  expect(PHASE17_BATCH_A_ANSWER_FIXTURES.some((fixture) => fixture.category === 'irrelevant' && fixture.expectedAnswerStatus === 'insufficient_evidence'), 'Irrelevant answer boundary is missing.');
}

function caseRoleBreakdown(environment: Environment): void {
  expect(environment.result.taskRoleBreakdown.training === 6, 'Training count mismatch.');
  expect(environment.result.taskRoleBreakdown.retest === 1, 'Retest count mismatch.');
  expect(environment.result.taskRoleBreakdown.transfer === 1, 'Transfer count mismatch.');
}

function caseRegistryConsistency(environment: Environment): void {
  expect(environment.result.registryConsistencyPassed, 'Registry consistency failed.');
  expect(environment.result.activeRegistryCount === 8, 'Active Registry count mismatch.');
  expect(environment.result.abilityIds.length === 4, 'Frozen resources lost Ability coverage.');
}

async function caseIdempotency(environment: Environment): Promise<void> {
  const second = await producePhase17BatchA({
    resourceRepository: environment.resources,
    observationRepository: environment.observations,
    targetState: 'controlled_frozen',
    reviewerId: REVIEWER,
    reviewNote: REVIEW_NOTE,
    now: NOW,
  });
  expect((await environment.resources.listMaterials()).length === 2, 'Repeated production duplicated Materials.');
  expect((await environment.resources.listDrafts()).length === 8, 'Repeated production duplicated Drafts.');
  expect((await environment.resources.listVersions()).length === 8, 'Repeated production duplicated Frozen versions.');
  expect((await environment.observations.listLinks()).length === 8, 'Repeated production duplicated Observation Links.');
  expect(second.runtimeVerifiedCount === 8 && second.issues.length === 0, second.issues.join(','));
}

function materialIdsFor(resourceKeys: string[]): Set<string> {
  return new Set(PHASE17_BATCH_A_MATERIALS
    .filter((material) => material.tasks.some((task) => resourceKeys.includes(task.resourceKey)))
    .map((material) => material.materialId));
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

await main();
