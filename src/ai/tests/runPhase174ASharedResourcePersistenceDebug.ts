import { createServer, request as httpRequest, type Server } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createQuestionMaterial,
  createStructuredQuestionDraft,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
  validateStructuredQuestionDraft,
} from '../agents/questionResourceAdmissionAgent.ts';
import { LocalApiFormalResourceClient } from '../repositories/localApiFormalResourceClient.ts';
import { LocalApiMaterialObservationRepository } from '../repositories/localApiMaterialObservationRepository.ts';
import { LocalApiQuestionResourceAdmissionRepository } from '../repositories/localApiQuestionResourceAdmissionRepository.ts';
import {
  cloneSharedFormalResourceValue,
  createEmptySharedFormalResourceData,
  type SharedFormalResourceData,
} from '../schemas/sharedFormalResourcePersistence.schema.ts';
import type { CreateStructuredQuestionDraftInput } from '../agents/questionResourceAdmissionAgent.ts';
import type { MaterialObservationPlan } from '../schemas/materialObservation.schema.ts';
import { createSharedFormalResourceBoundary } from '../../server/sharedFormalResourceBoundary.ts';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  assertBaselineIdentityIntegrity,
  buildSharedFormalResourceBaselineData,
  normalizeSharedFormalResourceBaselineData,
} from '../../api/sharedFormalResourcePersistence.ts';

const NOW = '2026-07-24T09:00:00.000Z';
const cases: Array<{ name: string; run: () => Promise<void> }> = [
  { name: 'A1 dual-browser reads the same shared snapshot', run: caseDualBrowserRead },
  { name: 'A2 write in browser A is visible in browser B', run: caseCrossBrowserWrite },
  { name: 'A3 review freeze and registry commit stay atomic', run: caseAtomicFreeze },
  { name: 'A4 repeated formal writes are idempotent', run: caseIdempotentWrites },
  { name: 'A5 stale snapshot replacement is blocked', run: caseStaleWriteBlocked },
  { name: 'A6 service restart restores the same formal facts', run: caseRestartRecovery },
  { name: 'A7 baseline import is explicit and identity-safe', run: caseBaselineImportSafety },
  { name: 'A8 failed commit rolls back without partial state', run: caseFailedCommitRollback },
  { name: 'A9 split UTF-8 request chunks preserve Chinese content', run: caseSplitUtf8Request },
  { name: 'A10 Plan lifecycle transitions preserve the content revision', run: casePlanLifecycleTransition },
];

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];

  console.log('Phase 17.4A Shared Formal Resource Persistence Debug');
  console.log('='.repeat(68));

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

  console.log('-'.repeat(68));
  console.log(`Result: ${passed} / ${cases.length} PASS`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function caseDualBrowserRead(): Promise<void> {
  await withRuntime(async ({ clientA, clientB }) => {
    await clientA.initialize(createEmptySharedFormalResourceData(), 'browser-a-manual-baseline');
    const [left, right] = await Promise.all([clientA.read(), clientB.read()]);
    assert(left.status.initialized && right.status.initialized, 'Both browsers must see initialized state.');
    assert(left.snapshot.revision === right.snapshot.revision, 'Shared revisions differ.');
    assert(
      JSON.stringify(left.snapshot.data) === JSON.stringify(right.snapshot.data),
      'Shared snapshots differ.',
    );
  });
}

async function caseCrossBrowserWrite(): Promise<void> {
  await withRuntime(async ({ clientA, clientB }) => {
    await clientA.initialize(createEmptySharedFormalResourceData(), 'browser-a-manual-baseline');
    const repositoryA = new LocalApiQuestionResourceAdmissionRepository(clientA);
    const repositoryB = new LocalApiQuestionResourceAdmissionRepository(clientB);
    const material = await createMaterial(repositoryA);
    const visible = await repositoryB.getMaterial(material.materialVersionId);
    assert(visible?.title === material.title, 'Browser B did not see Browser A material.');
  });
}

async function caseAtomicFreeze(): Promise<void> {
  await withRuntime(async ({ clientA, clientB }) => {
    await clientA.initialize(createEmptySharedFormalResourceData(), 'browser-a-manual-baseline');
    const repositoryA = new LocalApiQuestionResourceAdmissionRepository(clientA);
    const repositoryB = new LocalApiQuestionResourceAdmissionRepository(clientB);
    await createMaterial(repositoryA);
    const draft = await createDraft(repositoryA, 'atomic');
    const validation = await validateStructuredQuestionDraft(repositoryA, draft.draftId, NOW);
    assert(validation.passed, 'Fixture draft must validate.');
    await submitQuestionResourceForReview(repositoryA, draft.draftId, NOW);
    await reviewQuestionResourceDraft(repositoryA, {
      draftId: draft.draftId,
      action: 'approve',
      reviewerId: 'phase17.4a-reviewer',
      notes: 'Approved for shared persistence debug.',
      now: NOW,
    });
    const frozen = await freezeQuestionResourceDraft(repositoryA, draft.draftId, NOW);
    const [version, registry] = await Promise.all([
      repositoryB.getVersion(frozen.version.resourceVersionId),
      repositoryB.getRegistryEntry(frozen.version.resourceId),
    ]);
    assert(version?.sourceDraftId === draft.draftId, 'Frozen version is missing in Browser B.');
    assert(
      registry?.currentFrozenVersionId === frozen.version.resourceVersionId,
      'Registry head and frozen version were not committed together.',
    );
  });
}

async function caseIdempotentWrites(): Promise<void> {
  await withRuntime(async ({ clientA }) => {
    await clientA.initialize(createEmptySharedFormalResourceData(), 'browser-a-manual-baseline');
    const repository = new LocalApiQuestionResourceAdmissionRepository(clientA);
    const material = await createMaterial(repository);
    await repository.saveMaterial(material);
    assert((await repository.listMaterials()).length === 1, 'Repeated Material created a duplicate.');

    const draft = await createDraft(repository, 'idempotent');
    await validateStructuredQuestionDraft(repository, draft.draftId, NOW);
    await submitQuestionResourceForReview(repository, draft.draftId, NOW);
    await reviewQuestionResourceDraft(repository, {
      draftId: draft.draftId,
      action: 'approve',
      reviewerId: 'phase17.4a-reviewer',
      notes: 'Approved.',
      now: NOW,
    });
    const first = await freezeQuestionResourceDraft(repository, draft.draftId, NOW);
    const second = await freezeQuestionResourceDraft(repository, draft.draftId, NOW);
    assert(first.version.resourceVersionId === second.version.resourceVersionId, 'Freeze retry changed identity.');
    assert(!second.inserted, 'Freeze retry must report inserted=false.');
    assert((await repository.listVersions()).length === 1, 'Freeze retry created a duplicate version.');
  });
}

async function casePlanLifecycleTransition(): Promise<void> {
  await withRuntime(async ({ clientA }) => {
    await clientA.initialize(createEmptySharedFormalResourceData(), 'browser-a-manual-baseline');
    const repository = new LocalApiMaterialObservationRepository(clientA);
    const plan = materialObservationPlanFixture();
    await repository.savePlan(plan);
    const submitted = await repository.savePlan({
      ...plan,
      status: 'pending_review',
      updatedAt: '2026-07-24T09:05:00.000Z',
    });

    assert(submitted.status === 'pending_review', 'Lifecycle transition was blocked as a content conflict.');
    assert(submitted.revision === plan.revision, 'Lifecycle transition changed the content revision.');
    await assertRejectsCode(
      () => repository.savePlan({
        ...submitted,
        materialVersionId: 'material-plan:v2',
      }),
      'FORMAL_RESOURCE_REVISION_CONFLICT',
    );
  });
}

async function caseStaleWriteBlocked(): Promise<void> {
  await withRuntime(async ({ clientA, clientB }) => {
    await clientA.initialize(createEmptySharedFormalResourceData(), 'browser-a-manual-baseline');
    const [snapshotA, snapshotB] = await Promise.all([clientA.read(), clientB.read()]);
    const nextA = cloneSharedFormalResourceValue(snapshotA.snapshot.data);
    nextA.questionResources.materials.push(materialFixture('material-stale-a:v1', 'A'));
    await clientA.replace(snapshotA.snapshot.revision, nextA);

    const staleB = cloneSharedFormalResourceValue(snapshotB.snapshot.data);
    staleB.questionResources.materials.push(materialFixture('material-stale-b:v1', 'B'));
    await assertRejects(
      () => clientB.replace(snapshotB.snapshot.revision, staleB),
      'revision conflict',
    );
    const latest = await clientA.read();
    assert(
      latest.snapshot.data.questionResources.materials.some(
        (material) => material.materialVersionId === 'material-stale-a:v1',
      ),
      'Accepted write disappeared after stale conflict.',
    );
    assert(
      !latest.snapshot.data.questionResources.materials.some(
        (material) => material.materialVersionId === 'material-stale-b:v1',
      ),
      'Stale write polluted shared state.',
    );
  });
}

async function caseRestartRecovery(): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'phase174a-restart-'));
  const storePath = join(directory, 'formal-resources.json');
  let runtime = await startRuntime(storePath);
  try {
    const client = new LocalApiFormalResourceClient(runtime.endpoint);
    await client.initialize(createEmptySharedFormalResourceData(), 'browser-a-manual-baseline');
    const repository = new LocalApiQuestionResourceAdmissionRepository(client);
    await createMaterial(repository);
    await stopServer(runtime.server);

    runtime = await startRuntime(storePath);
    const restartedClient = new LocalApiFormalResourceClient(runtime.endpoint);
    const restartedRepository = new LocalApiQuestionResourceAdmissionRepository(restartedClient);
    assert((await restartedRepository.listMaterials()).length === 1, 'Restart lost formal resources.');
    assert((await restartedClient.read()).status.backupAvailable, 'Basic backup was not created.');
  } finally {
    await stopServer(runtime.server);
    await rm(directory, { recursive: true, force: true });
  }
}

async function caseBaselineImportSafety(): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'phase174a-baseline-'));
  try {
    const invalid = createEmptySharedFormalResourceData();
    invalid.questionResources.materials.push(
      materialFixture('material-conflict:v1', 'first'),
      materialFixture('material-conflict:v1', 'second'),
    );
    const invalidStore = new SharedFormalResourceStore({
      storePath: join(directory, 'invalid.json'),
    });
    await assertRejects(
      () => invalidStore.initialize(invalid, 'manually-selected-browser-a'),
      'identity conflict',
    );
    assert(!(await invalidStore.getStatus()).initialized, 'Rejected baseline initialized the store.');

    const legacy = createEmptySharedFormalResourceData();
    legacy.questionResources.materials.push(materialFixture('material-valid:v1', 'valid'));
    const { questionQuality: _quality, ...legacyWithoutQuality } = legacy;
    const valid = normalizeSharedFormalResourceBaselineData(
      legacyWithoutQuality as SharedFormalResourceData,
    );
    assert(
      valid.questionQuality.deterministicAssessments.length === 0 &&
      valid.questionQuality.semanticAssessments.length === 0 &&
      valid.questionQuality.assessmentBundles.length === 0 &&
      valid.questionQuality.frozenQualityTraces.length === 0 &&
      valid.questionQuality.batchManifests.length === 0 &&
      valid.questionQuality.batchSummaries.length === 0 &&
      valid.questionQuality.calibrationManifests.length === 0 &&
      valid.questionQuality.calibrationReports.length === 0,
      'Legacy baseline did not receive a complete empty quality state.',
    );
    assertBaselineIdentityIntegrity(valid);

    const validStore = new SharedFormalResourceStore({
      storePath: join(directory, 'valid.json'),
    });
    const initialized = await validStore.initialize(valid, 'manually-selected-browser-a');
    assert(initialized.baselineSource === 'manually-selected-browser-a', 'Baseline source was not recorded.');
    assert(initialized.data.questionResources.materials.length === 1, 'Valid baseline was not imported.');
    assert(
      initialized.data.questionQuality.deterministicAssessments.length === 0,
      'Initialized baseline did not preserve the normalized quality state.',
    );
    assert((await validStore.getStatus()).backupAvailable, 'Initialized baseline backup was not created.');

    const generated = buildSharedFormalResourceBaselineData(
      createEmptySharedFormalResourceData().questionResources,
      createEmptySharedFormalResourceData().materialObservations,
    );
    assert(
      Object.keys(generated.questionQuality).length === 8,
      'Fresh baseline export does not contain the complete quality state.',
    );

    const duplicateQualityIdentity = cloneSharedFormalResourceValue(generated);
    duplicateQualityIdentity.questionQuality.deterministicAssessments = [
      { assessmentId: 'assessment-conflict', marker: 'first' },
      { assessmentId: 'assessment-conflict', marker: 'second' },
    ] as never[];
    await assertRejects(
      async () => assertBaselineIdentityIntegrity(duplicateQualityIdentity),
      '同一 ID 存在不同内容',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function caseFailedCommitRollback(): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'phase174a-rollback-'));
  const storePath = join(directory, 'formal-resources.json');
  let failCommit = false;
  try {
    const store = new SharedFormalResourceStore({
      storePath,
      failBeforeCommit: () => failCommit,
    });
    const initialData = createEmptySharedFormalResourceData();
    initialData.questionResources.materials.push(materialFixture('material-before:v1', 'before'));
    const initialized = await store.initialize(initialData, 'manual-baseline');
    failCommit = true;
    const changed = cloneSharedFormalResourceValue(initialized.data);
    changed.questionResources.materials.push(materialFixture('material-after:v1', 'after'));
    await assertRejects(
      () => store.replace(initialized.revision, changed),
      'Simulated shared resource commit failure',
    );
    const restored = JSON.parse(await readFile(storePath, 'utf8')) as {
      data: SharedFormalResourceData;
    };
    assert(restored.data.questionResources.materials.length === 1, 'Failed write left partial data.');
    assert(
      restored.data.questionResources.materials[0].materialVersionId === 'material-before:v1',
      'Failed write changed the committed baseline.',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function caseSplitUtf8Request(): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'phase174a-utf8-'));
  const runtime = await startRuntime(join(directory, 'formal-resources.json'));
  try {
    const data = createEmptySharedFormalResourceData();
    data.questionResources.materials.push({
      ...materialFixture('material-utf8:v1', '中文跨分块测试'),
      content: '学生能够完整读取学习材料，不应出现替换字符。',
    });
    const body = Buffer.from(JSON.stringify({
      action: 'initialize',
      baselineSource: 'utf8-split-debug',
      data,
    }), 'utf8');
    const marker = Buffer.from('中文', 'utf8');
    const markerIndex = body.indexOf(marker);
    assert(markerIndex >= 0, 'UTF-8 split marker was not found.');

    const response = await postSplitBody(
      runtime.endpoint,
      body.subarray(0, markerIndex + 1),
      body.subarray(markerIndex + 1),
    );
    assert(response.statusCode === 201, `Split UTF-8 request failed (${response.statusCode}).`);

    const stored = await new LocalApiFormalResourceClient(runtime.endpoint).read();
    const material = stored.snapshot.data.questionResources.materials[0];
    assert(material.title === '中文跨分块测试', 'Split UTF-8 title was corrupted.');
    assert(!JSON.stringify(stored.snapshot.data).includes('\uFFFD'), 'Replacement character entered shared data.');
  } finally {
    await stopServer(runtime.server);
    await rm(directory, { recursive: true, force: true });
  }
}

async function withRuntime(
  action: (runtime: {
    clientA: LocalApiFormalResourceClient;
    clientB: LocalApiFormalResourceClient;
  }) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'phase174a-debug-'));
  const runtime = await startRuntime(join(directory, 'formal-resources.json'));
  try {
    await action({
      clientA: new LocalApiFormalResourceClient(runtime.endpoint),
      clientB: new LocalApiFormalResourceClient(runtime.endpoint),
    });
  } finally {
    await stopServer(runtime.server);
    await rm(directory, { recursive: true, force: true });
  }
}

function postSplitBody(
  endpoint: string,
  firstChunk: Buffer,
  secondChunk: Buffer,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': firstChunk.length + secondChunk.length,
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on('end', () => resolve({
        statusCode: response.statusCode || 0,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.on('error', reject);
    request.write(firstChunk);
    setTimeout(() => request.end(secondChunk), 5);
  });
}

async function startRuntime(storePath: string): Promise<{ server: Server; endpoint: string }> {
  const boundary = createSharedFormalResourceBoundary(
    new SharedFormalResourceStore({ storePath }),
  );
  const server = createServer((request, response) => {
    void boundary(request, response, () => {
      response.statusCode = 404;
      response.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Debug server did not expose a port.');
  return {
    server,
    endpoint: `http://127.0.0.1:${address.port}/__runtime/phase17-4/formal-resources`,
  };
}

async function stopServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function createMaterial(repository: LocalApiQuestionResourceAdmissionRepository) {
  return createQuestionMaterial(repository, {
    materialId: 'material-leaf',
    materialVersionId: 'material-leaf:v1',
    versionNumber: 1,
    title: '旧书中的树叶',
    content: '父亲整理书柜时，从一本旧书里发现一片已经褪色的树叶。他捏着树叶站了很久，最后把它小心地夹回原处。',
    source: {
      sourceType: 'manual',
      description: 'Phase 17.4A shared persistence debug material.',
      copyrightNote: 'Synthetic text for product validation.',
    },
    createdAt: NOW,
  });
}

async function createDraft(
  repository: LocalApiQuestionResourceAdmissionRepository,
  suffix: string,
) {
  const input: CreateStructuredQuestionDraftInput = {
    draftId: `draft-${suffix}`,
    resourceId: `resource-${suffix}`,
    taskId: `task-${suffix}`,
    materialVersionId: 'material-leaf:v1',
    title: '人物心理推断',
    questionStem: '父亲为什么把树叶小心地夹回原处？请结合文本说明。',
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: 'reasoning_chain',
    answerAcceptance: {
      acceptedKeywords: ['树叶', '回忆', '珍惜'],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation'],
    },
    rubric: [
      {
        itemId: 'evidence',
        name: '文本依据',
        description: '指出与判断相关的文本动作或细节。',
        abilityId: 'inference',
        importance: 'critical',
        required: true,
        evidenceRequirement: { requireTextEvidence: true },
        acceptedSignals: ['引用动作', '指出细节'],
      },
      {
        itemId: 'explanation',
        name: '解释关系',
        description: '说明文本依据与结论之间的关系。',
        abilityId: 'inference',
        importance: 'important',
        required: true,
        evidenceRequirement: { requireExplanation: true, requireConclusion: true },
        acceptedSignals: ['因果说明', '依据连接结论'],
      },
    ],
    minimumAnswerRequirement: {
      minLength: 12,
      requireTextEvidence: true,
      requireExplanation: true,
    },
    abilityMetadata: {
      abilityId: 'inference',
      supportingAbilityIds: ['extraction', 'comprehension'],
      prerequisiteAbilityIds: ['comprehension'],
      taskRole: 'diagnosis',
      difficulty: 'intermediate',
      gradeRange: '初中',
    },
    source: {
      sourceType: 'manual',
      description: 'Phase 17.4A shared persistence debug question.',
      copyrightNote: 'Synthetic content for product validation.',
    },
    tags: ['阅读理解', '人物心理', '文本依据'],
    now: NOW,
  };
  return createStructuredQuestionDraft(repository, input);
}

function materialFixture(materialVersionId: string, title: string) {
  const materialId = materialVersionId.split(':')[0];
  return {
    materialId,
    materialVersionId,
    versionNumber: 1,
    title,
    content: `${title} content`,
    source: {
      sourceType: 'manual' as const,
      description: 'Phase 17.4A fixture.',
    },
    status: 'active' as const,
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: 'question-resource-admission-v1' as const,
  };
}

function materialObservationPlanFixture(): MaterialObservationPlan {
  return {
    materialObservationPlanId: 'material-observation-plan-lifecycle',
    materialId: 'material-plan',
    materialVersionId: 'material-plan:v1',
    materialStructureSnapshotId: 'material-structure-plan',
    revision: 1,
    status: 'draft',
    dimensionReviews: [],
    taskPlans: [],
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: 'material_observation_plan_v1',
  };
}

async function assertRejects(action: () => Promise<unknown>, expectedMessage: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(
      message.toLowerCase().includes(expectedMessage.toLowerCase()),
      `Expected "${expectedMessage}", got "${message}".`,
    );
    return;
  }
  throw new Error(`Expected rejection containing: ${expectedMessage}`);
}

async function assertRejectsCode(action: () => Promise<unknown>, expectedCode: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
    assert(code === expectedCode, `Expected code "${expectedCode}", got "${code}".`);
    return;
  }
  throw new Error(`Expected rejection with code: ${expectedCode}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
