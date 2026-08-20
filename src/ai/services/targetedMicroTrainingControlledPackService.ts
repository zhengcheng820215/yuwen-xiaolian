import {
  createQuestionMaterial,
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
import type { QuestionResourceAdmissionRepository } from
  '../repositories/questionResourceAdmissionRepository.ts';
import type { MaterialObservationRepository } from
  '../repositories/materialObservationRepository.ts';
import type { TargetedMicroTrainingSchedulingRepository } from
  '../repositories/targetedMicroTrainingSchedulingRepository.ts';
import type {
  FrozenQuestionResourceVersion,
  QuestionMaterialVersion,
  ResourceRegistryEntry,
  ResourceReviewDecision,
  ResourceValidationResult,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import type {
  MaterialObservationPlan,
  MaterialSourceAnchor,
  MaterialStructureSnapshot,
  ResourceObservationLink,
} from '../schemas/materialObservation.schema.ts';
import {
  TARGETED_GAP_REASON_CODES,
  type TargetedGapReasonCode,
} from '../schemas/targetedMicroTraining.schema.ts';
import {
  TARGETED_MICRO_TRAINING_STAGE4_PACK_VERSION,
  buildTargetedMicroTrainingManifestHash,
  type TargetedMicroTrainingControlledPackManifest,
} from '../schemas/targetedMicroTrainingStage4.schema.ts';
import { TARGETED_MICRO_TRAINING_STAGE2_PACK } from
  '../../data/targetedMicroTrainingStage2Pack.ts';
import { TargetedMicroTrainingStage4Service } from './targetedMicroTrainingStage4Service.ts';
import type { SingleChoiceInteraction } from '../schemas/singleChoiceInteraction.schema.ts';
import { assessQuestionStemRubricAlignment } from '../patterns/questionStemRubricAlignment.ts';

const CONTROLLED_PACK_ID = 'targeted-micro-training-controlled-pack-3';
const CONTROLLED_PACK_CREATED_AT = '2026-08-20T12:00:00.000Z';

export type TargetedMicroTrainingControlledPackBundle = {
  manifest: TargetedMicroTrainingControlledPackManifest;
  materials: QuestionMaterialVersion[];
  drafts: StructuredQuestionDraft[];
  validations: ResourceValidationResult[];
  reviews: ResourceReviewDecision[];
  versions: FrozenQuestionResourceVersion[];
  registryEntries: ResourceRegistryEntry[];
  observationStructures: MaterialStructureSnapshot[];
  observationAnchors: MaterialSourceAnchor[];
  observationPlans: MaterialObservationPlan[];
  observationLinks: ResourceObservationLink[];
};

export type TargetedMicroTrainingControlledPackAudit = {
  passed: boolean;
  issues: string[];
  materialCount: number;
  frozenResourceCount: number;
  activeRegistryCount: number;
  gapCoverage: Record<TargetedGapReasonCode, number>;
};

export async function buildTargetedMicroTrainingControlledPack(input: {
  sourceSnapshotRevision: number;
  reviewedAt?: string;
}): Promise<TargetedMicroTrainingControlledPackBundle> {
  const questionRepository = new InMemoryQuestionResourceAdmissionRepository();
  const observationRepository = new InMemoryMaterialObservationRepository();
  for (const item of TARGETED_MICRO_TRAINING_STAGE2_PACK) {
    const material = await createQuestionMaterial(questionRepository, materialInput(item));
    const { plan, validation } = await createMaterialProductionPlan(
      questionRepository,
      observationRepository,
      {
        materialVersionId: material.materialVersionId,
        tasks: taskInputs(item, material.materialVersionId),
        now: CONTROLLED_PACK_CREATED_AT,
      },
    );
    if (!validation.passed) {
      throw new Error(`Controlled pack Plan failed: ${validation.issues.map((issue) => issue.code).join(',')}`);
    }
    await submitMaterialObservationPlanForReview(
      questionRepository, observationRepository, plan.materialObservationPlanId, CONTROLLED_PACK_CREATED_AT,
    );
    await reviewMaterialObservationPlan(observationRepository, {
      planId: plan.materialObservationPlanId,
      action: 'approve',
      reviewerId: 'controlled-pack-contract',
      notes: '采用受控首批资源。',
      now: CONTROLLED_PACK_CREATED_AT,
    });
    for (const task of plan.taskPlans) {
      const draftResult = await createAndValidateQuestionDraftForTask(
        questionRepository,
        observationRepository,
        {
          planId: plan.materialObservationPlanId,
          observationTaskPlanId: task.observationTaskPlanId,
          now: CONTROLLED_PACK_CREATED_AT,
        },
      );
      if (!draftResult.validationPassed) {
        throw new Error(`Controlled pack Draft failed: ${draftResult.issues.join(',')}`);
      }
      await submitQuestionResourceForReview(
        questionRepository, draftResult.draftId, CONTROLLED_PACK_CREATED_AT,
      );
      await reviewQuestionResourceDraft(questionRepository, {
        draftId: draftResult.draftId,
        action: 'approve',
        reviewerId: 'controlled-pack-contract',
        notes: '采用并发布。',
        now: CONTROLLED_PACK_CREATED_AT,
      });
      const frozen = await freezeQuestionResourceDraft(
        questionRepository, draftResult.draftId, CONTROLLED_PACK_CREATED_AT,
      );
      await linkFrozenResourceToObservationTask(questionRepository, observationRepository, {
        planId: plan.materialObservationPlanId,
        observationTaskPlanId: task.observationTaskPlanId,
        resourceVersionId: frozen.version.resourceVersionId,
        linkedAt: CONTROLLED_PACK_CREATED_AT,
      });
    }
  }

  const materials = await questionRepository.listMaterials();
  const drafts = await questionRepository.listDrafts();
  const validations = (await Promise.all(drafts.map((draft) => (
    draft.latestValidationId ? questionRepository.getValidation(draft.latestValidationId) : null
  )))).filter((item): item is ResourceValidationResult => Boolean(item));
  const reviews = await questionRepository.listReviews();
  const versions = await questionRepository.listVersions();
  const registryEntries = await questionRepository.listRegistryEntries();
  const observationStructures = await observationRepository.listStructures();
  const observationAnchors = await observationRepository.listAnchors();
  const observationPlans = await observationRepository.listPlans();
  const observationLinks = await observationRepository.listLinks();
  const coverage = assessTargetedMicroTrainingResourceCoverage({
    materials, versions, registryEntries, generatedAt: input.reviewedAt || CONTROLLED_PACK_CREATED_AT,
  });
  if (!coverage.passed || coverage.totalExecutableResourceCount !== 18) {
    throw new Error('Controlled pack resource coverage is incomplete.');
  }
  const gapCoverage = Object.fromEntries(TARGETED_GAP_REASON_CODES.map((code) => [
    code,
    versions.filter((version) => (
      version.status === 'frozen'
      && version.abilityMetadata.targetedTrainingMetadata?.primaryGapReasonCode === code
    )).length,
  ])) as Record<TargetedGapReasonCode, number>;
  const manifestSource = {
    packId: CONTROLLED_PACK_ID,
    packVersion: TARGETED_MICRO_TRAINING_STAGE4_PACK_VERSION,
    materialVersionIds: materials.map((item) => item.materialVersionId).sort(),
    resourceVersionIds: versions.map((item) => item.resourceVersionId).sort(),
    registryResourceIds: registryEntries.map((item) => item.resourceId).sort(),
    gapCoverage,
  };
  const manifest: TargetedMicroTrainingControlledPackManifest = {
    ...manifestSource,
    sourceSnapshotRevision: input.sourceSnapshotRevision,
    manifestHash: buildTargetedMicroTrainingManifestHash(manifestSource),
    reviewedAt: input.reviewedAt || CONTROLLED_PACK_CREATED_AT,
    status: 'prepared',
  };
  return {
    manifest,
    materials,
    drafts,
    validations,
    reviews,
    versions,
    registryEntries,
    observationStructures,
    observationAnchors,
    observationPlans,
    observationLinks,
  };
}

export async function importTargetedMicroTrainingControlledPack(input: {
  bundle: TargetedMicroTrainingControlledPackBundle;
  formalRepository: QuestionResourceAdmissionRepository;
  observationRepository: MaterialObservationRepository;
  governance: TargetedMicroTrainingStage4Service;
  actorId: string;
  reason: string;
}): Promise<{ insertedVersions: number; reusedVersions: number }> {
  assertBundleIdentity(input.bundle);
  await input.governance.prepareManifest(
    input.bundle.manifest,
    input.actorId,
    `${input.reason}:prepare`,
  );
  const currentRegistry = await input.formalRepository.listRegistryEntries();
  const originalMaterialStatuses = new Map<string, QuestionMaterialVersion['status']>();
  for (const materialVersionId of input.bundle.manifest.materialVersionIds) {
    const material = await input.formalRepository.getMaterial(materialVersionId);
    if (material) originalMaterialStatuses.set(materialVersionId, material.status);
  }
  for (const entry of input.bundle.registryEntries) {
    const existing = currentRegistry.find((item) => item.resourceId === entry.resourceId);
    if (existing && existing.currentFrozenVersionId !== entry.currentFrozenVersionId) {
      throw new Error(`Controlled pack cannot overwrite Registry head: ${entry.resourceId}`);
    }
  }
  let insertedVersions = 0;
  let reusedVersions = 0;
  try {
    for (const material of input.bundle.materials) {
      await input.formalRepository.saveMaterial(material);
      await input.formalRepository.setMaterialStatus(material.materialVersionId, 'active');
    }
    for (const draft of input.bundle.drafts) await input.formalRepository.saveDraft(draft);
    for (const validation of input.bundle.validations) {
      await input.formalRepository.saveValidation(validation);
    }
    for (const review of input.bundle.reviews) await input.formalRepository.saveReview(review);
    for (const version of input.bundle.versions) {
      const registryEntry = input.bundle.registryEntries.find(
        (item) => item.resourceId === version.resourceId,
      );
      if (!registryEntry) throw new Error(`Controlled pack Registry entry missing: ${version.resourceId}`);
      const existing = await input.formalRepository.getVersion(version.resourceVersionId);
      if (existing) {
        if (stableStringify(existing) !== stableStringify(version)) {
          throw new Error(`Controlled pack Frozen Version conflict: ${version.resourceVersionId}`);
        }
        const currentEntry = await input.formalRepository.getRegistryEntry(version.resourceId);
        if (!currentEntry) await input.formalRepository.saveRegistryEntry(registryEntry);
        reusedVersions += 1;
        continue;
      }
      const result = await input.formalRepository.commitFreeze({ version, registryEntry });
      if (result.inserted) insertedVersions += 1;
      else reusedVersions += 1;
    }
    for (const structure of input.bundle.observationStructures) {
      await input.observationRepository.saveStructure(structure);
    }
    for (const anchor of input.bundle.observationAnchors) {
      await input.observationRepository.saveAnchor(anchor);
    }
    for (const plan of input.bundle.observationPlans) {
      await input.observationRepository.savePlan(plan);
    }
    for (const link of input.bundle.observationLinks) {
      await input.observationRepository.saveLink(link);
    }
  } catch (error) {
    await input.formalRepository.replaceRegistry(currentRegistry);
    for (const materialVersionId of input.bundle.manifest.materialVersionIds) {
      const originalStatus = originalMaterialStatuses.get(materialVersionId);
      const material = await input.formalRepository.getMaterial(materialVersionId);
      if (material) {
        await input.formalRepository.setMaterialStatus(
          materialVersionId,
          originalStatus || 'retired',
        );
      }
    }
    throw error;
  }
  await input.governance.markManifestImported(
    input.bundle.manifest.packId,
    input.actorId,
    `${input.reason}:imported`,
  );
  return { insertedVersions, reusedVersions };
}

export async function auditTargetedMicroTrainingControlledPack(input: {
  bundle: TargetedMicroTrainingControlledPackBundle;
  formalRepository: QuestionResourceAdmissionRepository;
  observationRepository?: MaterialObservationRepository;
}): Promise<TargetedMicroTrainingControlledPackAudit> {
  const issues: string[] = [];
  try {
    assertBundleIdentity(input.bundle);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  const [materials, versions, registryEntries] = await Promise.all([
    input.formalRepository.listMaterials(),
    input.formalRepository.listVersions(),
    input.formalRepository.listRegistryEntries(),
  ]);
  const expectedMaterials = new Set(input.bundle.manifest.materialVersionIds);
  const expectedVersions = new Set(input.bundle.manifest.resourceVersionIds);
  const expectedResources = new Set(input.bundle.manifest.registryResourceIds);
  const activeMaterials = materials.filter((item) => (
    expectedMaterials.has(item.materialVersionId) && item.status === 'active'
  ));
  const frozenVersions = versions.filter((item) => (
    expectedVersions.has(item.resourceVersionId) && item.status === 'frozen'
  ));
  const activeRegistry = registryEntries.filter((item) => (
    expectedResources.has(item.resourceId)
    && item.status === 'active'
    && expectedVersions.has(item.currentFrozenVersionId || '')
  ));
  if (activeMaterials.length !== expectedMaterials.size) issues.push('Controlled pack Material is incomplete or inactive.');
  if (frozenVersions.length !== expectedVersions.size) issues.push('Controlled pack Frozen Version is incomplete.');
  if (activeRegistry.length !== expectedResources.size) issues.push('Controlled pack Registry head is incomplete or misaligned.');
  if (input.observationRepository) {
    const [structures, anchors, plans, links] = await Promise.all([
      input.observationRepository.listStructures(),
      input.observationRepository.listAnchors(),
      input.observationRepository.listPlans(),
      input.observationRepository.listLinks(),
    ]);
    const expectedStructureIds = new Set(input.bundle.observationStructures.map((item) => item.materialStructureSnapshotId));
    const expectedAnchorIds = new Set(input.bundle.observationAnchors.map((item) => item.sourceAnchorId));
    const expectedPlanIds = new Set(input.bundle.observationPlans.map((item) => item.materialObservationPlanId));
    const expectedLinkIds = new Set(input.bundle.observationLinks.map((item) => item.resourceObservationLinkId));
    if (structures.filter((item) => expectedStructureIds.has(item.materialStructureSnapshotId)).length !== expectedStructureIds.size) {
      issues.push('Controlled pack Material Structure is incomplete.');
    }
    if (anchors.filter((item) => expectedAnchorIds.has(item.sourceAnchorId)).length !== expectedAnchorIds.size) {
      issues.push('Controlled pack Source Anchor is incomplete.');
    }
    if (plans.filter((item) => expectedPlanIds.has(item.materialObservationPlanId)).length !== expectedPlanIds.size) {
      issues.push('Controlled pack Observation Plan is incomplete.');
    }
    if (links.filter((item) => expectedLinkIds.has(item.resourceObservationLinkId)).length !== expectedLinkIds.size) {
      issues.push('Controlled pack Resource Observation Link is incomplete.');
    }
  }
  const gapCoverage = Object.fromEntries(TARGETED_GAP_REASON_CODES.map((code) => [
    code,
    frozenVersions.filter((version) => (
      version.abilityMetadata.targetedTrainingMetadata?.primaryGapReasonCode === code
    )).length,
  ])) as Record<TargetedGapReasonCode, number>;
  TARGETED_GAP_REASON_CODES.forEach((code) => {
    if (gapCoverage[code] !== input.bundle.manifest.gapCoverage[code]) {
      issues.push(`Controlled pack Gap coverage mismatch: ${code}`);
    }
  });
  return {
    passed: issues.length === 0,
    issues,
    materialCount: activeMaterials.length,
    frozenResourceCount: frozenVersions.length,
    activeRegistryCount: activeRegistry.length,
    gapCoverage,
  };
}

export async function pauseTargetedMicroTrainingControlledPack(input: {
  packId: string;
  governance: TargetedMicroTrainingStage4Service;
  actorId: string;
  reason: string;
}): Promise<void> {
  await input.governance.markManifestPaused(input.packId, input.actorId, input.reason);
  await input.governance.setEnablement({
    mode: 'paused', actorId: input.actorId, reason: input.reason, packId: input.packId,
  });
}

export async function rollbackTargetedMicroTrainingControlledPack(input: {
  bundle: TargetedMicroTrainingControlledPackBundle;
  formalRepository: QuestionResourceAdmissionRepository;
  governance: TargetedMicroTrainingStage4Service;
  actorId: string;
  reason: string;
  schedulingRepository?: TargetedMicroTrainingSchedulingRepository;
  now?: string;
}): Promise<void> {
  await deactivatePackRegistry(input.formalRepository, input.bundle);
  if (input.schedulingRepository) {
    const targetedVersionIds = new Set(input.bundle.manifest.resourceVersionIds);
    for (;;) {
      const snapshot = await input.schedulingRepository.load();
      const pending = snapshot.assignments.find((assignment) => (
        assignment.status === 'pending' && targetedVersionIds.has(assignment.resourceVersionId)
      ));
      if (!pending) break;
      const result = await input.schedulingRepository.updateAssignmentStatus({
        assignmentId: pending.assignmentId,
        expectedStatus: 'pending',
        nextStatus: 'unavailable',
        expectedRevision: snapshot.revision,
        updatedAt: input.now || new Date().toISOString(),
      });
      if (result.status === 'conflict') continue;
    }
  }
  await input.governance.markManifestRolledBack(
    input.bundle.manifest.packId,
    input.actorId,
    input.reason,
  );
  await input.governance.setEnablement({
    mode: 'paused', actorId: input.actorId, reason: input.reason,
    packId: input.bundle.manifest.packId,
  });
}

async function deactivatePackRegistry(
  repository: QuestionResourceAdmissionRepository,
  bundle: TargetedMicroTrainingControlledPackBundle,
): Promise<void> {
  const resourceIds = new Set(bundle.manifest.registryResourceIds);
  const current = await repository.listRegistryEntries();
  await repository.replaceRegistry(current.filter((entry) => !resourceIds.has(entry.resourceId)));
  for (const materialVersionId of bundle.manifest.materialVersionIds) {
    const material = await repository.getMaterial(materialVersionId);
    if (material) await repository.setMaterialStatus(materialVersionId, 'retired');
  }
}

function assertBundleIdentity(bundle: TargetedMicroTrainingControlledPackBundle): void {
  const manifestHash = buildTargetedMicroTrainingManifestHash(bundle.manifest);
  if (manifestHash !== bundle.manifest.manifestHash) throw new Error('Controlled pack Manifest hash mismatch.');
  if (new Set(bundle.materials.map((item) => item.materialVersionId)).size !== bundle.materials.length
    || new Set(bundle.versions.map((item) => item.resourceVersionId)).size !== bundle.versions.length
    || new Set(bundle.registryEntries.map((item) => item.resourceId)).size !== bundle.registryEntries.length
    || new Set(bundle.observationStructures.map((item) => item.materialStructureSnapshotId)).size !== bundle.observationStructures.length
    || new Set(bundle.observationAnchors.map((item) => item.sourceAnchorId)).size !== bundle.observationAnchors.length) {
    throw new Error('Controlled pack contains duplicate identities.');
  }
  if (bundle.materials.some((material) => (
    material.usageType !== 'targeted_excerpt'
    || !material.targetedExcerptMetadata
    || !material.contentHash
    || !material.contentNormalizationPolicyVersion
  ))) {
    throw new Error('Controlled pack contains incomplete targeted Material metadata.');
  }
  if (bundle.versions.some((version) => {
    const registry = bundle.registryEntries.find((entry) => entry.resourceId === version.resourceId);
    return version.status !== 'frozen'
      || registry?.status !== 'active'
      || registry.currentFrozenVersionId !== version.resourceVersionId
      || version.materialVersionId !== version.abilityMetadata.targetedTrainingMetadata?.targetedMaterialVersionId;
  })) {
    throw new Error('Controlled pack Frozen Version and Registry identities are not aligned.');
  }
  const structureIds = new Set(
    bundle.observationStructures.map((item) => item.materialStructureSnapshotId),
  );
  const anchorIds = new Set(bundle.observationAnchors.map((item) => item.sourceAnchorId));
  const planById = new Map(
    bundle.observationPlans.map((item) => [item.materialObservationPlanId, item]),
  );
  const versionById = new Map(bundle.versions.map((item) => [item.resourceVersionId, item]));
  if (bundle.observationPlans.some((plan) => (
    !structureIds.has(plan.materialStructureSnapshotId)
    || plan.taskPlans.some((task) => (
      task.materialObservationPlanId !== plan.materialObservationPlanId
      || task.materialId !== plan.materialId
      || task.materialVersionId !== plan.materialVersionId
      || task.sourceAnchorIds.length === 0
      || task.sourceAnchorIds.some((sourceAnchorId) => !anchorIds.has(sourceAnchorId))
    ))
  ))) {
    throw new Error('Controlled pack Observation Plan trace is incomplete or misaligned.');
  }
  if (bundle.observationLinks.some((link) => {
    const plan = planById.get(link.materialObservationPlanId);
    const task = plan?.taskPlans.find(
      (item) => item.observationTaskPlanId === link.observationTaskPlanId,
    );
    const version = versionById.get(link.resourceVersionId);
    return !plan || !task || !version
      || link.status !== 'active'
      || link.resourceId !== version.resourceId
      || link.materialId !== plan.materialId
      || link.materialVersionId !== plan.materialVersionId
      || link.abilityId !== task.abilityId
      || link.taskRole !== task.taskRole;
  })) {
    throw new Error('Controlled pack Resource Observation Link trace is incomplete or misaligned.');
  }
}

function materialInput(item: typeof TARGETED_MICRO_TRAINING_STAGE2_PACK[number]) {
  // V3 uses a new immutable identity because its text stems are aligned with the
  // latest admission contract. Historical V2 resources remain auditable.
  const materialId = `targeted-v3-${item.key}`;
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
      description: 'Stage 4 受控原创针对性短片段',
      copyrightNote: '受控原创，仅用于阅读训练。',
    },
    metadata: {
      tags: ['targeted-micro-training', item.primaryGapReasonCode],
      provenanceStatus: 'verified' as const,
    },
    createdAt: CONTROLLED_PACK_CREATED_AT,
  };
}

function taskInput(
  item: typeof TARGETED_MICRO_TRAINING_STAGE2_PACK[number],
  materialVersionId: string,
) {
  const draftSpecification = resourceDraftSpecification({
    title: `${item.title} · 微训练`,
    abilityId: item.abilityId,
    expectedStudentAction: item.expectedStudentAction,
    choiceInteraction: item.choiceInteraction,
  });
  return {
    primaryDimension: item.dimension,
    abilityId: item.abilityId,
    taskRole: 'training' as const,
    difficulty: 'basic' as const,
    anchorType: 'full_text' as const,
    questionStem: alignControlledTextQuestionStem(
      item.questionStem,
      draftSpecification,
      item.choiceInteraction,
    ),
    expectedStudentAction: item.expectedStudentAction,
    designReason: '针对已确认的具体缺口，以独立短情境重新执行一次可观察阅读动作。',
    targetedTrainingMetadata: {
      primaryGapReasonCode: item.primaryGapReasonCode,
      targetedMaterialVersionId: materialVersionId,
    },
    resourceDraftSpecification: draftSpecification,
  };
}

function taskInputs(
  item: typeof TARGETED_MICRO_TRAINING_STAGE2_PACK[number],
  materialVersionId: string,
) {
  const primary = taskInput(item, materialVersionId);
  if (!item.secondaryTask) return [primary];
  const secondaryDraftSpecification = resourceDraftSpecification({
    title: `${item.title} · 微训练 2`,
    abilityId: item.secondaryTask.abilityId,
    expectedStudentAction: item.secondaryTask.expectedStudentAction,
    choiceInteraction: item.secondaryTask.choiceInteraction,
  });
  return [
    primary,
    {
      ...taskInput(item, materialVersionId),
      primaryDimension: item.secondaryTask.dimension,
      abilityId: item.secondaryTask.abilityId,
      questionStem: alignControlledTextQuestionStem(
        item.secondaryTask.questionStem,
        secondaryDraftSpecification,
        item.secondaryTask.choiceInteraction,
      ),
      expectedStudentAction: item.secondaryTask.expectedStudentAction,
      resourceDraftSpecification: secondaryDraftSpecification,
    },
  ];
}

function alignControlledTextQuestionStem(
  questionStem: string,
  specification: ReturnType<typeof resourceDraftSpecification>,
  choiceInteraction?: SingleChoiceInteraction,
): string {
  if (choiceInteraction) return questionStem;
  const alignment = assessQuestionStemRubricAlignment(questionStem, specification.rubric);
  if (alignment.aligned) return questionStem;
  const needsEvidence = alignment.hiddenDimensions.includes('text_evidence');
  const needsExplanation = alignment.hiddenDimensions.includes('explanation');
  if (needsEvidence && needsExplanation) {
    return `${questionStem} 请结合片段中的相关信息，说明判断依据。`;
  }
  if (needsEvidence) return `${questionStem} 请从片段中找出相关信息作为依据。`;
  if (needsExplanation) return `${questionStem} 请说明理由。`;
  return questionStem;
}

function resourceDraftSpecification(input: {
  title: string;
  abilityId: typeof TARGETED_MICRO_TRAINING_STAGE2_PACK[number]['abilityId'];
  expectedStudentAction: string;
  choiceInteraction?: SingleChoiceInteraction;
}) {
  const rubric = [{
    itemId: 'primary-action',
    name: '完成主要阅读动作',
    description: input.expectedStudentAction,
    abilityId: input.abilityId,
    importance: 'critical' as const,
    required: true,
    evidenceRequirement: {
      requireTextEvidence: !input.choiceInteraction,
      requireExplanation: !input.choiceInteraction && input.abilityId !== 'extraction',
      requireConclusion: !input.choiceInteraction,
    },
    acceptedSignals: [input.expectedStudentAction],
  }];
  if (input.choiceInteraction) {
    return {
      title: input.title,
      questionType: 'multiple_choice' as const,
      responseFormat: 'single_choice' as const,
      choiceInteraction: input.choiceInteraction,
      assessmentMode: 'exact_match' as const,
      answerAcceptance: {
        acceptedOptionIds: [...input.choiceInteraction.correctOptionIds],
      },
      rubric,
      minimumAnswerRequirement: {
        responseFormat: 'single_choice' as const,
        minLength: 0 as const,
        requireTextEvidence: false as const,
        requireExplanation: false as const,
        minSelections: 1 as const,
        maxSelections: 1 as const,
      },
      supportingAbilityIds: [],
      prerequisiteAbilityIds: [],
      gradeRange: '七至九年级',
      tags: ['ai-assisted', 'targeted-micro-training', 'single-choice'],
    };
  }
  return {
    title: input.title,
    questionType: 'open_short_answer' as const,
    responseFormat: 'short_text' as const,
    assessmentMode: 'key_points' as const,
    answerAcceptance: {
      acceptedKeywords: [input.expectedStudentAction],
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation'],
    },
    rubric,
    minimumAnswerRequirement: {
      minLength: 10,
      requireTextEvidence: true,
      requireExplanation: input.abilityId !== 'extraction',
    },
    supportingAbilityIds: [],
    prerequisiteAbilityIds: [],
    gradeRange: '七至九年级',
    tags: ['ai-assisted', 'targeted-micro-training'],
  };
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, sortValue(item)]));
}
