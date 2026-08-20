import { strict as assert } from 'node:assert';
import {
  createQuestionMaterial,
  createQuestionMaterialRevision,
  freezeQuestionResourceDraft,
  reviewQuestionResourceDraft,
  submitQuestionResourceForReview,
} from '../agents/questionResourceAdmissionAgent.ts';
import {
  createAndValidateQuestionDraftForTask,
  createMaterialProductionPlan,
  linkFrozenResourceToObservationTask,
  reviewMaterialObservationPlan,
  submitMaterialObservationPlanForReview,
} from '../agents/materialObservationApplicationService.ts';
import { assessTargetedMicroTrainingResourceCoverage } from
  '../agents/targetedMicroTrainingResourceCoverageAgent.ts';
import { InMemoryMaterialObservationRepository } from
  '../repositories/inMemoryMaterialObservationRepository.ts';
import { InMemoryQuestionResourceAdmissionRepository } from
  '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';
import {
  buildMaterialContentHash,
  normalizeMaterialContentForIdentity,
  validateTargetedMaterialUsage,
} from '../schemas/targetedMicroTraining.schema.ts';
import { TARGETED_MICRO_TRAINING_STAGE2_PACK } from
  '../../data/targetedMicroTrainingStage2Pack.ts';

const NOW = '2026-08-20T12:00:00.000Z';
const questionRepository = new InMemoryQuestionResourceAdmissionRepository();
const observationRepository = new InMemoryMaterialObservationRepository();

const cases: Array<{ name: string; run: () => Promise<void> | void }> = [
  { name: '01 normalization removes formatting noise but preserves punctuation', run: normalizationPolicy },
  { name: '02 normalized hash is deterministic', run: deterministicHash },
  { name: '03 punctuation changes identity', run: punctuationIdentity },
  { name: '04 targeted Material creation derives hash and policy', run: targetedMaterialCreation },
  { name: '05 supplied mismatched hash is rejected', run: mismatchedHashBoundary },
  { name: '06 targeted Material requires complete metadata', run: targetedMetadataBoundary },
  { name: '07 targeted Material revision inherits usage identity', run: targetedRevisionInheritance },
  { name: '08 targeted Material revision recalculates hash', run: targetedRevisionHash },
  { name: '09 ordinary revision cannot flip Material usage', run: revisionUsageBoundary },
  { name: '10 historical core Material remains compatible', run: historicalCoreCompatibility },
  { name: '11 first controlled pack contains twelve excerpts', run: packSize },
  { name: '12 first controlled pack covers all four Gaps three times', run: packGapDistribution },
  { name: '13 production pipeline publishes eighteen isolated resources', run: publishPack },
  { name: '14 targeted Plan accepts one Training Task', run: targetedOneTask },
  { name: '15 targeted Plan rejects more than two tasks', run: targetedTaskCountBoundary },
  { name: '16 targeted Plan rejects non-training role', run: targetedRoleBoundary },
  { name: '17 targeted Plan rejects missing primary Gap identity', run: missingPrimaryGapBoundary },
  { name: '18 targeted Plan rejects Gap outside Material scope', run: gapScopeBoundary },
  { name: '19 targeted Plan rejects Ability outside Material scope', run: abilityScopeBoundary },
  { name: '20 Draft preserves targeted resource metadata', run: draftMetadataTrace },
  { name: '21 Frozen Version preserves targeted Material snapshot', run: frozenMaterialSnapshot },
  { name: '22 Frozen Version preserves primary Gap identity', run: frozenGapTrace },
  { name: '23 Registry exposes primary Gap identity', run: registryGapTrace },
  { name: '24 active Observation Link preserves targeted identity', run: observationLinkTrace },
  { name: '25 each Gap has at least three active targeted Materials', run: coverageMaterials },
  { name: '26 each Gap has at least three executable resources', run: coverageResources },
  { name: '27 each Gap has at least three Registry links', run: coverageRegistry },
  { name: '28 Gap by Ability matrix is readable', run: coverageMatrix },
  { name: '29 coverage report passes only current Frozen heads', run: coverageCurrentHead },
  { name: '30 incomplete inventory fails coverage', run: incompleteCoverageBoundary },
  { name: '31 serialized snapshot restores Stage 2 identities', run: snapshotRoundTrip },
  { name: '32 publication retry reuses Frozen Version and Registry head', run: publicationIdempotency },
];

let coverage = assessTargetedMicroTrainingResourceCoverage({ materials: [], versions: [], registryEntries: [] });

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  console.log('Targeted Micro-training Stage 2 Debug');
  console.log('='.repeat(58));
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
  console.log('-'.repeat(58));
  console.log(`Result: ${passed}/${cases.length} passed`);
  if (failures.length) {
    failures.forEach((failure) => console.error(failure));
    process.exitCode = 1;
  }
}

function normalizationPolicy(): void {
  assert.equal(
    normalizeMaterialContentForIdentity('\uFEFF甲\t乙。\r\n\r\n\r\n 丙'),
    '甲 乙。\n\n丙',
  );
}

function deterministicHash(): void {
  assert.equal(buildMaterialContentHash('甲\r\n乙'), buildMaterialContentHash('甲\n乙'));
}

function punctuationIdentity(): void {
  assert.notEqual(buildMaterialContentHash('为什么？'), buildMaterialContentHash('为什么。'));
}

async function targetedMaterialCreation(): Promise<void> {
  const item = TARGETED_MICRO_TRAINING_STAGE2_PACK[0];
  const material = await createQuestionMaterial(questionRepository, materialInput(item));
  assert.equal(material.contentHash, buildMaterialContentHash(item.content));
  assert.equal(material.contentNormalizationPolicyVersion, 'material_content_normalization_v1');
}

async function mismatchedHashBoundary(): Promise<void> {
  await rejects(() => createQuestionMaterial(questionRepository, {
    ...materialInput(TARGETED_MICRO_TRAINING_STAGE2_PACK[1]),
    materialId: 'mismatch-material', materialVersionId: 'mismatch-material:v1', contentHash: 'wrong',
  }), 'does not match');
}

function targetedMetadataBoundary(): void {
  const validation = validateTargetedMaterialUsage({
    usageType: 'targeted_excerpt',
    contentHash: buildMaterialContentHash('正文'),
    contentNormalizationPolicyVersion: 'material_content_normalization_v1',
  });
  assert.equal(validation.passed, false);
  assert(validation.issues.some((issue) => issue.code === 'material.targeted_metadata'));
}

async function targetedRevisionInheritance(): Promise<void> {
  const source = await ensureMaterial(TARGETED_MICRO_TRAINING_STAGE2_PACK[0]);
  const revision = await createQuestionMaterialRevision(questionRepository, {
    sourceMaterialVersionId: source.materialVersionId,
    revisionNote: 'Stage 2 inheritance check',
    now: '2026-08-20T12:01:00.000Z',
  });
  assert.equal(revision.usageType, 'targeted_excerpt');
  assert.deepEqual(revision.targetedExcerptMetadata, source.targetedExcerptMetadata);
}

async function targetedRevisionHash(): Promise<void> {
  const revision = await questionRepository.getMaterial('targeted-evidence-1:v2');
  assert(revision);
  assert.equal(revision.contentHash, buildMaterialContentHash(revision.content));
}

async function revisionUsageBoundary(): Promise<void> {
  await rejects(() => createQuestionMaterialRevision(questionRepository, {
    sourceMaterialVersionId: 'targeted-evidence-1:v1', revisionNote: 'invalid flip', usageType: 'core_reading',
  }), 'cannot change');
}

async function historicalCoreCompatibility(): Promise<void> {
  const material = await createQuestionMaterial(questionRepository, {
    materialId: 'legacy-core', materialVersionId: 'legacy-core:v1', versionNumber: 1,
    title: '历史核心材料', content: '历史正文。',
    source: { sourceType: 'manual', description: '历史记录' },
    createdAt: NOW,
  });
  assert.equal(material.usageType, undefined);
}

function packSize(): void { assert.equal(TARGETED_MICRO_TRAINING_STAGE2_PACK.length, 12); }

function packGapDistribution(): void {
  const counts = new Map<string, number>();
  TARGETED_MICRO_TRAINING_STAGE2_PACK.forEach((item) => counts.set(
    item.primaryGapReasonCode,
    (counts.get(item.primaryGapReasonCode) || 0) + 1,
  ));
  assert.deepEqual([...counts.values()].sort(), [3, 3, 3, 3]);
}

async function publishPack(): Promise<void> {
  for (const item of TARGETED_MICRO_TRAINING_STAGE2_PACK) {
    const material = await ensureMaterial(item);
    const tasks = taskInputs(item, material.materialVersionId);
    const { plan, validation } = await createMaterialProductionPlan(
      questionRepository,
      observationRepository,
      { materialVersionId: material.materialVersionId, tasks, now: NOW },
    );
    assert.equal(validation.passed, true, validation.issues.map((issue) => issue.code).join(','));
    await submitMaterialObservationPlanForReview(questionRepository, observationRepository, plan.materialObservationPlanId, NOW);
    await reviewMaterialObservationPlan(observationRepository, {
      planId: plan.materialObservationPlanId, action: 'approve', reviewerId: 'stage2-acceptance', notes: '采用受控首批资源。', now: NOW,
    });
    for (const taskPlan of plan.taskPlans) {
      const draftResult = await createAndValidateQuestionDraftForTask(
        questionRepository,
        observationRepository,
        { planId: plan.materialObservationPlanId, observationTaskPlanId: taskPlan.observationTaskPlanId, now: NOW },
      );
      assert.equal(draftResult.validationPassed, true, draftResult.issues.join(','));
      await submitQuestionResourceForReview(questionRepository, draftResult.draftId, NOW);
      await reviewQuestionResourceDraft(questionRepository, {
        draftId: draftResult.draftId, action: 'approve', reviewerId: 'stage2-acceptance', notes: '采用并发布。', now: NOW,
      });
      const frozen = await freezeQuestionResourceDraft(questionRepository, draftResult.draftId, NOW);
      const linked = await linkFrozenResourceToObservationTask(questionRepository, observationRepository, {
        planId: plan.materialObservationPlanId,
        observationTaskPlanId: taskPlan.observationTaskPlanId,
        resourceVersionId: frozen.version.resourceVersionId,
        linkedAt: NOW,
      });
      assert.equal(linked.link.status, 'active', linked.issues.join(','));
    }
  }
  coverage = assessTargetedMicroTrainingResourceCoverage({
    materials: await questionRepository.listMaterials(),
    versions: await questionRepository.listVersions(),
    registryEntries: await questionRepository.listRegistryEntries(),
    generatedAt: NOW,
  });
  assert.equal(coverage.passed, true);
  assert.equal(coverage.totalExecutableResourceCount, 18);
}

async function targetedOneTask(): Promise<void> {
  const plans = await observationRepository.listPlans('targeted-conclusion-1:v1');
  assert.equal(plans[0].taskPlans.length, 1);
}

async function targetedTaskCountBoundary(): Promise<void> {
  const item = TARGETED_MICRO_TRAINING_STAGE2_PACK[0];
  await rejects(() => createMaterialProductionPlan(questionRepository, observationRepository, {
    materialVersionId: 'targeted-evidence-1:v1',
    tasks: [0, 1, 2].map((index) => ({ ...taskInput(item, 'targeted-evidence-1:v1'), questionStem: `${item.questionStem}${index}` })),
  }), '1 to 2');
}

async function targetedRoleBoundary(): Promise<void> {
  const item = TARGETED_MICRO_TRAINING_STAGE2_PACK[0];
  await rejects(() => createMaterialProductionPlan(questionRepository, observationRepository, {
    materialVersionId: 'targeted-evidence-1:v1',
    tasks: [{ ...taskInput(item, 'targeted-evidence-1:v1'), taskRole: 'retest' }],
  }), 'training role');
}

async function missingPrimaryGapBoundary(): Promise<void> {
  const item = TARGETED_MICRO_TRAINING_STAGE2_PACK[0];
  const task = taskInput(item, 'targeted-evidence-1:v1');
  delete (task as { targetedTrainingMetadata?: unknown }).targetedTrainingMetadata;
  await rejects(() => createMaterialProductionPlan(questionRepository, observationRepository, {
    materialVersionId: 'targeted-evidence-1:v1', tasks: [task],
  }), 'primary Gap');
}

async function gapScopeBoundary(): Promise<void> {
  const item = TARGETED_MICRO_TRAINING_STAGE2_PACK[0];
  const task = taskInput(item, 'targeted-evidence-1:v1');
  task.targetedTrainingMetadata!.primaryGapReasonCode = 'conclusion_inconsistent';
  await rejects(() => createMaterialProductionPlan(questionRepository, observationRepository, {
    materialVersionId: 'targeted-evidence-1:v1', tasks: [task],
  }), 'outside Material support');
}

async function abilityScopeBoundary(): Promise<void> {
  const item = TARGETED_MICRO_TRAINING_STAGE2_PACK[0];
  const task = taskInput(item, 'targeted-evidence-1:v1');
  task.abilityId = 'expression';
  await rejects(() => createMaterialProductionPlan(questionRepository, observationRepository, {
    materialVersionId: 'targeted-evidence-1:v1', tasks: [task],
  }), 'outside Material support');
}

async function draftMetadataTrace(): Promise<void> {
  const drafts = await questionRepository.listDrafts();
  assert(drafts.every((draft) => draft.materialVersionId === 'legacy-core:v1'
    || Boolean(draft.abilityMetadata.targetedTrainingMetadata)));
}

async function frozenMaterialSnapshot(): Promise<void> {
  const versions = await questionRepository.listVersions();
  assert(versions.every((version) => version.materialSnapshot?.usageType === 'targeted_excerpt'));
}

async function frozenGapTrace(): Promise<void> {
  const versions = await questionRepository.listVersions();
  assert(versions.every((version) => Boolean(version.abilityMetadata.targetedTrainingMetadata?.primaryGapReasonCode)));
}

async function registryGapTrace(): Promise<void> {
  const entries = await questionRepository.listRegistryEntries();
  assert(entries.every((entry) => Boolean(entry.targetedTrainingMetadata?.primaryGapReasonCode)));
}

async function observationLinkTrace(): Promise<void> {
  const links = await observationRepository.listLinks();
  assert(links.every((link) => link.status === 'active' && Boolean(link.targetedTrainingMetadata)));
}

function coverageMaterials(): void { assert(coverage.gapCoverage.every((item) => item.activeMaterialCount >= 3)); }
function coverageResources(): void { assert(coverage.gapCoverage.every((item) => item.executableResourceCount >= 3)); }
function coverageRegistry(): void { assert(coverage.gapCoverage.every((item) => item.activeRegistryLinkCount >= 3)); }
function coverageMatrix(): void {
  assert.equal(coverage.matrix.length, 24);
  assert(coverage.matrix.some((cell) => cell.executableResourceCount > 0));
}
function coverageCurrentHead(): void { assert.equal(coverage.totalExecutableResourceCount, 18); }

async function incompleteCoverageBoundary(): Promise<void> {
  const report = assessTargetedMicroTrainingResourceCoverage({
    materials: (await questionRepository.listMaterials()).slice(0, 2),
    versions: (await questionRepository.listVersions()).slice(0, 2),
    registryEntries: (await questionRepository.listRegistryEntries()).slice(0, 2),
  });
  assert.equal(report.passed, false);
}

async function snapshotRoundTrip(): Promise<void> {
  const snapshot = JSON.parse(JSON.stringify({
    materials: await questionRepository.listMaterials(),
    versions: await questionRepository.listVersions(),
    registryEntries: await questionRepository.listRegistryEntries(),
  }));
  const report = assessTargetedMicroTrainingResourceCoverage(snapshot);
  assert.equal(report.passed, true);
}

async function publicationIdempotency(): Promise<void> {
  const version = (await questionRepository.listVersions())[0];
  const retry = await freezeQuestionResourceDraft(questionRepository, version.sourceDraftId, NOW);
  assert.equal(retry.inserted, false);
  assert.equal(retry.registryEntry.currentFrozenVersionId, version.resourceVersionId);
}

function materialInput(item: typeof TARGETED_MICRO_TRAINING_STAGE2_PACK[number]) {
  const materialId = `targeted-${item.key}`;
  return {
    materialId,
    materialVersionId: `${materialId}:v1`,
    versionNumber: 1,
    title: item.title,
    content: item.content,
    usageType: 'targeted_excerpt' as const,
    contentNormalizationPolicyVersion: 'material_content_normalization_v1' as const,
    targetedExcerptMetadata: {
      targetAbilityIds: item.secondaryTask && item.secondaryTask.abilityId !== item.abilityId
        ? [item.abilityId, item.secondaryTask.abilityId]
        : [item.abilityId],
      supportedGapReasonCodes: [item.primaryGapReasonCode],
      sourceRelation: 'controlled_original' as const,
      intendedTaskCount: item.secondaryTask ? 2 as const : 1 as const,
    },
    source: {
      sourceType: 'manual' as const,
      description: 'Stage 2 受控原创针对性短片段',
      copyrightNote: '受控原创，仅用于阅读训练。',
    },
    metadata: { tags: ['targeted-micro-training', item.primaryGapReasonCode], provenanceStatus: 'verified' as const },
    createdAt: NOW,
  };
}

async function ensureMaterial(item: typeof TARGETED_MICRO_TRAINING_STAGE2_PACK[number]) {
  const input = materialInput(item);
  return (await questionRepository.getMaterial(input.materialVersionId))
    || createQuestionMaterial(questionRepository, input);
}

function taskInput(
  item: typeof TARGETED_MICRO_TRAINING_STAGE2_PACK[number],
  materialVersionId: string,
) {
  return {
    primaryDimension: item.dimension,
    abilityId: item.abilityId,
    taskRole: 'training' as const,
    difficulty: 'basic' as const,
    anchorType: 'full_text' as const,
    questionStem: item.questionStem,
    expectedStudentAction: item.expectedStudentAction,
    designReason: '针对已确认的具体缺口，以独立短情境重新执行一次可观察阅读动作。',
    targetedTrainingMetadata: {
      primaryGapReasonCode: item.primaryGapReasonCode,
      targetedMaterialVersionId: materialVersionId,
    },
    resourceDraftSpecification: {
      title: `${item.title} · 微训练`,
      questionType: 'open_short_answer' as const,
      responseFormat: 'short_text' as const,
      assessmentMode: 'key_points' as const,
      answerAcceptance: {
        acceptedKeywords: [item.expectedStudentAction],
        semanticEquivalentAllowed: true,
        normalizationRules: ['trim', 'ignore_punctuation'],
      },
      rubric: [{
        itemId: 'primary-action', name: '完成主要阅读动作', description: item.expectedStudentAction,
        abilityId: item.abilityId, importance: 'critical' as const, required: true,
        evidenceRequirement: { requireTextEvidence: true, requireExplanation: item.abilityId !== 'extraction', requireConclusion: true },
        acceptedSignals: [item.expectedStudentAction],
      }],
      minimumAnswerRequirement: { minLength: 10, requireTextEvidence: true, requireExplanation: item.abilityId !== 'extraction' },
      supportingAbilityIds: [], prerequisiteAbilityIds: [], gradeRange: '七至九年级', tags: ['ai-assisted', 'targeted-micro-training'],
    },
  };
}

function taskInputs(
  item: typeof TARGETED_MICRO_TRAINING_STAGE2_PACK[number],
  materialVersionId: string,
) {
  const primary = taskInput(item, materialVersionId);
  if (!item.secondaryTask) return [primary];
  return [
    primary,
    {
      ...taskInput(item, materialVersionId),
      primaryDimension: item.secondaryTask.dimension,
      abilityId: item.secondaryTask.abilityId,
      questionStem: item.secondaryTask.questionStem,
      expectedStudentAction: item.secondaryTask.expectedStudentAction,
      resourceDraftSpecification: {
        ...primary.resourceDraftSpecification,
        title: `${item.title} · 微训练 2`,
        answerAcceptance: {
          ...primary.resourceDraftSpecification.answerAcceptance,
          acceptedKeywords: [item.secondaryTask.expectedStudentAction],
        },
        rubric: [{
          ...primary.resourceDraftSpecification.rubric[0],
          abilityId: item.secondaryTask.abilityId,
          description: item.secondaryTask.expectedStudentAction,
          acceptedSignals: [item.secondaryTask.expectedStudentAction],
        }],
      },
    },
  ];
}

async function rejects(action: () => Promise<unknown>, expected: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => (
    error instanceof Error && error.message.includes(expected)
  ));
}

await main();
