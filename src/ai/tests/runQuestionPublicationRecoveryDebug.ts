import {
  recoverQuestionPublicationFromFrozenVersion,
} from '../agents/questionPublicationRecoveryService.ts';
import { producePhase17BatchA } from '../agents/phase17BatchAProductionService.ts';
import { InMemoryMaterialObservationRepository } from '../repositories/inMemoryMaterialObservationRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import type { ResourceObservationLink } from '../schemas/materialObservation.schema.ts';

const NOW = '2026-07-30T08:00:00.000Z';

async function main(): Promise<void> {
  const cases = [
    ['01 existing Frozen Version completes Observation Link recovery', completesRecovery],
    ['02 failed Observation Link write reports partial completion', reportsPartialCompletion],
    ['03 repeated recovery reuses one version and one link', repeatedRecoveryIsIdempotent],
  ] as const;
  let passed = 0;
  const failures: string[] = [];

  console.log('Question Publication Recovery Debug');
  console.log('='.repeat(66));
  for (const [name, run] of cases) {
    try {
      await run();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${name}: ${message}`);
      console.log(`FAIL ${name}: ${message}`);
    }
  }
  console.log('-'.repeat(66));
  console.log(`Result: ${passed} / ${cases.length} PASS`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function completesRecovery(): Promise<void> {
  const fixture = await createFixture(false);
  const result = await recover(fixture);

  expect(result.publicationStatus === 'completed', 'Recovery did not complete.');
  expect(result.reusedFrozenVersion, 'Recovery did not report Frozen Version reuse.');
  expect(result.resourceVersionId === fixture.resourceVersionId, 'Recovery changed the formal version.');
  expect((await fixture.observations.listLinks()).length === 1, 'Recovery did not create one Observation Link.');
}

async function reportsPartialCompletion(): Promise<void> {
  const fixture = await createFixture(true);
  const result = await recover(fixture);

  expect(result.publicationStatus === 'partially_completed', 'Failed link write was not reported as partial completion.');
  expect(result.observationLinkIssues.length === 1, 'Partial completion did not include one recovery issue.');
  expect(result.observationLinkIssues[0].includes('不会创建新版本'), 'Recovery issue does not explain retry safety.');
  expect((await fixture.resources.listVersions()).length === fixture.versionCount, 'Partial failure created another formal version.');
}

async function repeatedRecoveryIsIdempotent(): Promise<void> {
  const fixture = await createFixture(true);
  const partial = await recover(fixture);
  const completed = await recover(fixture);
  const repeated = await recover(fixture);

  expect(partial.publicationStatus === 'partially_completed', 'First attempt should be partial.');
  expect(completed.publicationStatus === 'completed', 'Second attempt should complete.');
  expect(repeated.publicationStatus === 'completed', 'Repeated completed recovery should stay completed.');
  expect(completed.resourceVersionId === partial.resourceVersionId, 'Retry changed the formal version.');
  expect(repeated.resourceVersionId === completed.resourceVersionId, 'Repeated retry changed the formal version.');
  expect((await fixture.resources.listVersions()).length === fixture.versionCount, 'Repeated retry duplicated formal versions.');
  expect((await fixture.resources.listRegistryEntries()).length === fixture.registryCount, 'Repeated retry duplicated Registry entries.');
  expect((await fixture.observations.listLinks()).length === 1, 'Repeated retry duplicated Observation Links.');
}

async function createFixture(failFirstLinkWrite: boolean) {
  const resources = new InMemoryQuestionResourceAdmissionRepository();
  const sourceObservations = new InMemoryMaterialObservationRepository();
  await producePhase17BatchA({
    resourceRepository: resources,
    observationRepository: sourceObservations,
    targetState: 'controlled_frozen',
    reviewerId: 'publication-recovery-debug',
    reviewNote: 'Controlled debug fixture.',
    now: NOW,
  });

  const draft = (await resources.listDrafts())[0];
  const version = await resources.getVersionByDraftId(draft.draftId);
  expect(version, 'Fixture Frozen Version is missing.');
  const planId = readTag(draft.tags, 'observation_plan:');
  const observationTaskPlanId = readTag(draft.tags, 'observation_task:');
  expect(planId && observationTaskPlanId, 'Fixture observation reference is missing.');
  const plan = await sourceObservations.getPlan(planId);
  expect(plan, 'Fixture plan is missing.');

  const observations = new FailOnceMaterialObservationRepository(failFirstLinkWrite);
  await observations.savePlan(plan);
  return {
    resources,
    observations,
    draftId: draft.draftId,
    planId,
    observationTaskPlanId,
    resourceVersionId: version.resourceVersionId,
    versionCount: (await resources.listVersions()).length,
    registryCount: (await resources.listRegistryEntries()).length,
  };
}

function recover(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return recoverQuestionPublicationFromFrozenVersion(
    fixture.resources,
    fixture.observations,
    {
      draftId: fixture.draftId,
      planId: fixture.planId,
      observationTaskPlanId: fixture.observationTaskPlanId,
    },
  );
}

class FailOnceMaterialObservationRepository extends InMemoryMaterialObservationRepository {
  private failNextLinkWrite: boolean;

  constructor(failNextLinkWrite: boolean) {
    super();
    this.failNextLinkWrite = failNextLinkWrite;
  }

  override async saveLink(value: ResourceObservationLink) {
    if (this.failNextLinkWrite) {
      this.failNextLinkWrite = false;
      throw new Error('Simulated Observation Link storage failure.');
    }
    return super.saveLink(value);
  }
}

function readTag(tags: string[], prefix: string): string | null {
  return tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length) || null;
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main();
