import {
  createAndValidateQuestionDraftBatch,
  createAndValidateQuestionDraftForTask,
  createMaterialProductionPlan,
  linkFrozenResourceToObservationTask,
  reviewMaterialObservationPlan,
  submitMaterialObservationPlanForReview,
  synchronizeQuestionDraftsFromObservationPlan,
  type MaterialProductionDraftResult,
  type MaterialProductionTaskInput,
} from '../ai/agents/materialObservationApplicationService.ts';
import { formatMaterialTitle, normalizeMaterialTitle } from '../ui/materialTitle.ts';
import {
  isPhase17BatchAMaterial,
  producePhase17BatchA,
} from '../ai/agents/phase17BatchAProductionService.ts';
import { preparePhase173BatchAPreflight } from '../ai/agents/phase173BatchAPreflightService.ts';
import {
  createQuestionMaterial,
  createQuestionMaterialRevision,
} from '../ai/agents/questionResourceAdmissionAgent.ts';
import {
  createBrowserMaterialObservationRepository,
  createBrowserQuestionResourceAdmissionRepository,
} from '../ai/repositories/formalResourceRepositoryRouter.ts';
import { LocalApiFormalResourceClient } from '../ai/repositories/localApiFormalResourceClient.ts';
import type {
  MaterialObservationPlan,
  MaterialObservationPlanValidation,
  MaterialSourceAnchor,
  ResourceObservationLink,
} from '../ai/schemas/materialObservation.schema.ts';
import type {
  FrozenQuestionResourceVersion,
  QuestionMaterialVersion,
  ResourceReviewDecision,
  ResourceValidationResult,
  StructuredQuestionDraft,
} from '../ai/schemas/questionResourceAdmission.schema.ts';
import type {
  SharedFormalResourceStatus,
} from '../ai/schemas/sharedFormalResourcePersistence.schema.ts';
import {
  PHASE17_TONGGUAN_MATERIAL,
  PHASE17_TONGGUAN_TASKS,
} from '../data/phase17TongguanCalibration.ts';
import {
  completeQuestionResourceWorkbenchQualityCheck,
  getQuestionResourceWorkbenchQualityReadiness,
  type QuestionResourceWorkbenchQualityReadiness,
} from './questionResourceWorkbench.ts';

const resourceRepository = createBrowserQuestionResourceAdmissionRepository();
const observationRepository = createBrowserMaterialObservationRepository();
const sharedResourceClient = new LocalApiFormalResourceClient();

export type MaterialResourceProductionSnapshot = {
  sharedStoreStatus: SharedFormalResourceStatus;
  materials: QuestionMaterialVersion[];
  anchors: MaterialSourceAnchor[];
  plans: MaterialObservationPlan[];
  validations: MaterialObservationPlanValidation[];
  drafts: StructuredQuestionDraft[];
  frozenVersions: FrozenQuestionResourceVersion[];
  links: ResourceObservationLink[];
  draftReadiness: MaterialProductionDraftReadiness[];
};

export type MaterialProductionDraftReadiness = QuestionResourceWorkbenchQualityReadiness & {
  draftId: string;
  validation: ResourceValidationResult | null;
  review: ResourceReviewDecision | null;
  frozenVersion: FrozenQuestionResourceVersion | null;
  observationLink: ResourceObservationLink | null;
};

export async function getMaterialResourceProductionSnapshot(): Promise<MaterialResourceProductionSnapshot> {
  const sharedEnvelope = await sharedResourceClient.read();
  if (sharedEnvelope.status.initialized) {
    const { questionResources, materialObservations } = sharedEnvelope.snapshot.data;
    return hydrateDraftQualityReadiness(buildMaterialResourceProductionSnapshot({
      materials: questionResources.materials,
      anchors: materialObservations.anchors,
      plans: materialObservations.plans,
      validations: materialObservations.validations,
      drafts: questionResources.drafts,
      resourceValidations: questionResources.validations,
      reviews: questionResources.reviews,
      frozenVersions: questionResources.versions,
      links: materialObservations.links,
    }, sharedEnvelope.status));
  }

  const [materials, anchors, plans, drafts, frozenVersions, links] = await Promise.all([
    resourceRepository.listMaterials(),
    observationRepository.listAnchors(),
    observationRepository.listPlans(),
    resourceRepository.listDrafts(),
    resourceRepository.listVersions(),
    observationRepository.listLinks(),
  ]);
  const validations = (await Promise.all(plans.map((plan) => observationRepository.listValidations(plan.materialObservationPlanId)))).flat();
  const draftReadiness = await Promise.all(drafts.map(async (draft): Promise<MaterialProductionDraftReadiness> => {
    const frozenVersion = frozenVersions.find((version) => version.sourceDraftId === draft.draftId) || null;
    const [validation, review] = await Promise.all([
      draft.latestValidationId ? resourceRepository.getValidation(draft.latestValidationId) : Promise.resolve(null),
      draft.latestReviewId ? resourceRepository.getReview(draft.latestReviewId) : Promise.resolve(null),
    ]);
    return {
      draftId: draft.draftId,
      validation,
      review,
      frozenVersion,
      observationLink: frozenVersion
        ? links.find((link) => link.resourceVersionId === frozenVersion.resourceVersionId) || null
        : null,
      qualityAssessment: null,
      semanticQualityAssessment: null,
      qualityAssessmentBundle: null,
      qualityCheckState: 'missing',
    };
  }));
  return hydrateDraftQualityReadiness(buildMaterialResourceProductionSnapshot({
    materials,
    anchors,
    plans,
    validations,
    drafts,
    resourceValidations: draftReadiness
      .map((item) => item.validation)
      .filter((item): item is ResourceValidationResult => Boolean(item)),
    reviews: draftReadiness
      .map((item) => item.review)
      .filter((item): item is ResourceReviewDecision => Boolean(item)),
    frozenVersions,
    links,
  }, sharedEnvelope.status));
}

type SnapshotCollections = {
  materials: QuestionMaterialVersion[];
  anchors: MaterialSourceAnchor[];
  plans: MaterialObservationPlan[];
  validations: MaterialObservationPlanValidation[];
  drafts: StructuredQuestionDraft[];
  resourceValidations: ResourceValidationResult[];
  reviews: ResourceReviewDecision[];
  frozenVersions: FrozenQuestionResourceVersion[];
  links: ResourceObservationLink[];
};

export function buildMaterialResourceProductionSnapshot(
  collections: SnapshotCollections,
  sharedStoreStatus: SharedFormalResourceStatus,
): MaterialResourceProductionSnapshot {
  const {
    materials,
    anchors,
    plans,
    validations,
    drafts,
    resourceValidations,
    reviews,
    frozenVersions,
    links,
  } = structuredClone(collections);
  const draftReadiness = drafts.map((draft): MaterialProductionDraftReadiness => {
    const frozenVersion = frozenVersions.find((version) => version.sourceDraftId === draft.draftId) || null;
    return {
      draftId: draft.draftId,
      validation: draft.latestValidationId
        ? resourceValidations.find((item) => item.validationId === draft.latestValidationId) || null
        : null,
      review: draft.latestReviewId
        ? reviews.find((item) => item.reviewId === draft.latestReviewId) || null
        : null,
      frozenVersion,
      observationLink: frozenVersion
        ? links.find((link) => link.resourceVersionId === frozenVersion.resourceVersionId) || null
        : null,
      qualityAssessment: null,
      semanticQualityAssessment: null,
      qualityAssessmentBundle: null,
      qualityCheckState: 'missing',
    };
  });
  return {
    sharedStoreStatus,
    materials: materials.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    anchors: anchors.sort((a, b) => a.sourceAnchorId.localeCompare(b.sourceAnchorId)),
    plans: plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    validations: validations.sort((a, b) => b.checkedAt.localeCompare(a.checkedAt)),
    drafts: drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    frozenVersions: frozenVersions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    links: links.sort((a, b) => b.linkedAt.localeCompare(a.linkedAt)),
    draftReadiness,
  };
}

async function hydrateDraftQualityReadiness(
  snapshot: MaterialResourceProductionSnapshot,
): Promise<MaterialResourceProductionSnapshot> {
  const qualityReadiness = await Promise.all(
    snapshot.drafts.map(async (draft) => [
      draft.draftId,
      await getQuestionResourceWorkbenchQualityReadiness(draft.draftId),
    ] as const),
  );
  const qualityByDraftId = new Map(qualityReadiness);
  return {
    ...snapshot,
    draftReadiness: snapshot.draftReadiness.map((item) => ({
      ...item,
      ...(qualityByDraftId.get(item.draftId) || {}),
    })),
  };
}

export async function createProductionMaterial(input: {
  title: string;
  content: string;
  description?: string;
  copyrightNote?: string;
}): Promise<QuestionMaterialVersion> {
  const duplicate = (await resourceRepository.listMaterials()).find(
    (material) => normalizeMaterialContent(material.content) === normalizeMaterialContent(input.content),
  );
  if (duplicate) {
    throw new Error(`已存在内容相同的学习材料：${formatMaterialTitle(duplicate.title)}。请直接使用已有素材。`);
  }
  const suffix = createIdSuffix();
  return createQuestionMaterial(resourceRepository, {
    materialId: `material-${suffix}`,
    materialVersionId: `material-${suffix}:v1`,
    versionNumber: 1,
    title: normalizeMaterialTitle(input.title),
    content: input.content,
    source: {
      sourceType: 'manual',
      description: input.description?.trim() || '系统自动记录：人工录入',
      copyrightNote: input.copyrightNote,
    },
  });
}

export async function stageProductionMaterialRevision(input: {
  sourceMaterialVersionId: string;
  title?: string;
  content?: string;
  description?: string;
  copyrightNote?: string;
  revisionNote: string;
  metadata?: QuestionMaterialVersion['metadata'];
}): Promise<QuestionMaterialVersion> {
  const source = await resourceRepository.getMaterial(input.sourceMaterialVersionId);
  if (!source) throw new Error(`未找到素材版本：${input.sourceMaterialVersionId}`);
  return createQuestionMaterialRevision(resourceRepository, {
    sourceMaterialVersionId: source.materialVersionId,
    title: input.title,
    content: input.content,
    source: input.description === undefined && input.copyrightNote === undefined
      ? undefined
      : {
          ...source.source,
          description: input.description ?? source.source.description,
          copyrightNote: input.copyrightNote ?? source.source.copyrightNote,
        },
    metadata: input.metadata,
    revisionNote: input.revisionNote,
  });
}

export type ProductionMaterialDisposition = {
  action: 'delete' | 'retire';
  dependencyCount: number;
};

export async function getProductionMaterialDisposition(
  materialVersionId: string,
): Promise<ProductionMaterialDisposition> {
  const [plans, anchors, drafts, versions] = await Promise.all([
    observationRepository.listPlans(materialVersionId),
    observationRepository.listAnchors(materialVersionId),
    resourceRepository.listDrafts(),
    resourceRepository.listVersions(),
  ]);
  const dependencyCount = plans.length
    + anchors.length
    + drafts.filter((draft) => draft.materialVersionId === materialVersionId).length
    + versions.filter((version) => version.materialVersionId === materialVersionId).length;
  return {
    action: dependencyCount === 0 ? 'delete' : 'retire',
    dependencyCount,
  };
}

export async function deleteUnusedProductionMaterial(
  materialVersionId: string,
): Promise<void> {
  const disposition = await getProductionMaterialDisposition(materialVersionId);
  if (disposition.action !== 'delete') {
    throw new Error('该学习材料已经进入训练任务或题目链，不能删除；请改为停用。');
  }
  await resourceRepository.deleteMaterial(materialVersionId);
}

export async function retireProductionMaterial(
  materialVersionId: string,
): Promise<QuestionMaterialVersion> {
  return resourceRepository.setMaterialStatus(materialVersionId, 'retired');
}

export async function reactivateProductionMaterial(
  materialVersionId: string,
): Promise<QuestionMaterialVersion> {
  return resourceRepository.setMaterialStatus(materialVersionId, 'active');
}

export async function createProductionObservationPlan(input: {
  materialVersionId: string;
  tasks: MaterialProductionTaskInput[];
  sourcePlanId?: string;
}) {
  return createMaterialProductionPlan(resourceRepository, observationRepository, input);
}

export async function synchronizeProductionQuestionDrafts(planId: string) {
  return synchronizeQuestionDraftsFromObservationPlan(
    resourceRepository,
    observationRepository,
    planId,
  );
}

export async function submitProductionObservationPlan(planId: string) {
  return submitMaterialObservationPlanForReview(resourceRepository, observationRepository, planId);
}

export async function approveProductionObservationPlan(planId: string) {
  return reviewMaterialObservationPlan(observationRepository, {
    planId,
    action: 'approve',
    reviewerId: 'phase17-content-reviewer',
    notes: '材料观测维度、能力动作和题目入口已人工核对。',
  });
}

export async function createProductionQuestionDrafts(planId: string): Promise<MaterialProductionDraftResult[]> {
  return createAndValidateQuestionDraftBatch(resourceRepository, observationRepository, { planId });
}

export async function createProductionQuestionDraft(
  planId: string,
  observationTaskPlanId: string,
): Promise<MaterialProductionDraftResult> {
  return createAndValidateQuestionDraftForTask(resourceRepository, observationRepository, {
    planId,
    observationTaskPlanId,
  });
}

export async function completeProductionQuestionDraftQualityChecks(planId: string) {
  const plan = await observationRepository.getPlan(planId);
  if (!plan) throw new Error(`Material Observation Plan not found: ${planId}`);

  const drafts = await resourceRepository.listDrafts();
  const results = await Promise.allSettled(plan.taskPlans.map(async (task) => {
    const draft = drafts.find((item) => (
      item.status !== 'archived' &&
      item.tags.includes(`observation_task:${task.observationTaskPlanId}`)
    ));
    if (!draft) {
      throw new Error(`Question Draft not found for Observation Task: ${task.observationTaskPlanId}`);
    }
    const bundle = await completeQuestionResourceWorkbenchQualityCheck(
      draft.draftId,
      draft.revision,
    );
    return {
      observationTaskPlanId: task.observationTaskPlanId,
      draftId: draft.draftId,
      bundleId: bundle.bundleId,
    };
  }));

  const failures = results
    .map((result, index) => ({ result, task: plan.taskPlans[index] }))
    .filter((item) => item.result.status === 'rejected');
  if (failures.length > 0) {
    throw new Error(
      `${failures.length} 道题目的完整质量检查未完成，请重试；系统不会重复创建题目。`,
    );
  }
  return results
    .filter((result): result is PromiseFulfilledResult<{
      observationTaskPlanId: string;
      draftId: string;
      bundleId: string;
    }> => result.status === 'fulfilled')
    .map((result) => result.value);
}

export async function synchronizeProductionObservationLinks(planId: string) {
  const plan = await observationRepository.getPlan(planId);
  if (!plan) throw new Error(`Material Observation Plan not found: ${planId}`);
  const [drafts, existingLinks] = await Promise.all([
    resourceRepository.listDrafts(),
    observationRepository.listLinks(),
  ]);
  const results: Array<{ observationTaskPlanId: string; status: 'linked' | 'pending'; issues: string[] }> = [];
  for (const task of plan.taskPlans) {
    const draft = drafts.find((item) => item.tags.includes(`observation_task:${task.observationTaskPlanId}`));
    const version = draft ? await resourceRepository.getVersionByDraftId(draft.draftId) : null;
    const lineageIds = [
      task.parentObservationTaskPlanId,
      task.taskRevisionRootId,
    ].filter((value): value is string => Boolean(value));
    const inheritedLink = existingLinks
      .filter((link) => (
        link.status === 'active'
        && link.materialId === plan.materialId
        && lineageIds.includes(link.observationTaskPlanId)
      ))
      .sort((left, right) => right.linkedAt.localeCompare(left.linkedAt))[0];
    const resourceVersionId = version?.resourceVersionId || inheritedLink?.resourceVersionId;
    if (!resourceVersionId) {
      results.push({ observationTaskPlanId: task.observationTaskPlanId, status: 'pending', issues: ['frozen_resource_missing'] });
      continue;
    }
    const linked = await linkFrozenResourceToObservationTask(resourceRepository, observationRepository, {
      planId,
      observationTaskPlanId: task.observationTaskPlanId,
      resourceVersionId,
    });
    results.push({
      observationTaskPlanId: task.observationTaskPlanId,
      status: linked.link.status === 'active' ? 'linked' : 'pending',
      issues: linked.issues,
    });
  }
  return results;
}

export async function loadPhase17BatchAPlansForReview() {
  return producePhase17BatchA({
    resourceRepository,
    observationRepository,
    targetState: 'plans_pending_review',
  });
}

export async function loadTongguanCalibrationPlanForReview() {
  const existingMaterial = await resourceRepository.getMaterial(PHASE17_TONGGUAN_MATERIAL.materialVersionId);
  if (!existingMaterial) {
    await createQuestionMaterial(resourceRepository, PHASE17_TONGGUAN_MATERIAL);
  }
  const existingPlans = await observationRepository.listPlans(PHASE17_TONGGUAN_MATERIAL.materialVersionId);
  const existingPlan = existingPlans.sort((left, right) => right.revision - left.revision)[0];
  if (existingPlan) {
    return {
      materialVersionId: PHASE17_TONGGUAN_MATERIAL.materialVersionId,
      materialObservationPlanId: existingPlan.materialObservationPlanId,
      status: existingPlan.status,
      reused: true,
    };
  }
  const result = await createMaterialProductionPlan(resourceRepository, observationRepository, {
    materialVersionId: PHASE17_TONGGUAN_MATERIAL.materialVersionId,
    tasks: PHASE17_TONGGUAN_TASKS,
  });
  const submitted = await submitMaterialObservationPlanForReview(
    resourceRepository,
    observationRepository,
    result.plan.materialObservationPlanId,
  );
  return {
    materialVersionId: PHASE17_TONGGUAN_MATERIAL.materialVersionId,
    materialObservationPlanId: submitted.materialObservationPlanId,
    status: submitted.status,
    reused: false,
  };
}

export function isTongguanCalibrationMaterial(materialVersionId: string): boolean {
  return materialVersionId === PHASE17_TONGGUAN_MATERIAL.materialVersionId;
}

export async function createPhase17BatchADraftsForReview(materialVersionId: string) {
  if (!isPhase17BatchAMaterial(materialVersionId)) {
    throw new Error('Selected Material is not part of Phase 17 Batch A.');
  }
  return producePhase17BatchA({
    resourceRepository,
    observationRepository,
    targetState: 'drafts_pending_review',
    materialVersionIds: [materialVersionId],
  });
}

export async function runPhase173BatchAPreflight() {
  return preparePhase173BatchAPreflight({
    resourceRepository,
    observationRepository,
    reviewerId: 'phase17.3-runtime-preflight-reviewer',
    reviewNote: '仅补充 Phase 17.3 Runtime 所需的提示策略与材料关系声明；题目、Rubric、能力和任务角色保持不变。',
  });
}

export { isPhase17BatchAMaterial };

function createIdSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 12);
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeMaterialContent(content: string): string {
  return content
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[，。！？；：“”‘’、,.!?;:'"]/g, '')
    .toLowerCase();
}
