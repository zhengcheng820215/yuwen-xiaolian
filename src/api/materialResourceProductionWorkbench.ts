import {
  createAndValidateQuestionDraftBatch,
  createMaterialProductionPlan,
  linkFrozenResourceToObservationTask,
  reviewMaterialObservationPlan,
  submitMaterialObservationPlanForReview,
  type MaterialProductionDraftResult,
  type MaterialProductionTaskInput,
} from '../ai/agents/materialObservationApplicationService.ts';
import {
  isPhase17BatchAMaterial,
  producePhase17BatchA,
} from '../ai/agents/phase17BatchAProductionService.ts';
import { preparePhase173BatchAPreflight } from '../ai/agents/phase173BatchAPreflightService.ts';
import { createQuestionMaterial } from '../ai/agents/questionResourceAdmissionAgent.ts';
import { IndexedDBMaterialObservationRepository } from '../ai/repositories/indexedDBMaterialObservationRepository.ts';
import { IndexedDBQuestionResourceAdmissionRepository } from '../ai/repositories/indexedDBQuestionResourceAdmissionRepository.ts';
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
import {
  PHASE17_TONGGUAN_MATERIAL,
  PHASE17_TONGGUAN_TASKS,
} from '../data/phase17TongguanCalibration.ts';

const resourceRepository = new IndexedDBQuestionResourceAdmissionRepository();
const observationRepository = new IndexedDBMaterialObservationRepository();

export type MaterialResourceProductionSnapshot = {
  materials: QuestionMaterialVersion[];
  anchors: MaterialSourceAnchor[];
  plans: MaterialObservationPlan[];
  validations: MaterialObservationPlanValidation[];
  drafts: StructuredQuestionDraft[];
  frozenVersions: FrozenQuestionResourceVersion[];
  links: ResourceObservationLink[];
  draftReadiness: MaterialProductionDraftReadiness[];
};

export type MaterialProductionDraftReadiness = {
  draftId: string;
  validation: ResourceValidationResult | null;
  review: ResourceReviewDecision | null;
  frozenVersion: FrozenQuestionResourceVersion | null;
  observationLink: ResourceObservationLink | null;
};

export async function getMaterialResourceProductionSnapshot(): Promise<MaterialResourceProductionSnapshot> {
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
    };
  }));
  return {
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

export async function createProductionMaterial(input: {
  title: string;
  content: string;
  description: string;
  copyrightNote?: string;
}): Promise<QuestionMaterialVersion> {
  const suffix = createIdSuffix();
  return createQuestionMaterial(resourceRepository, {
    materialId: `material-${suffix}`,
    materialVersionId: `material-${suffix}:v1`,
    versionNumber: 1,
    title: input.title,
    content: input.content,
    source: {
      sourceType: 'manual',
      description: input.description,
      copyrightNote: input.copyrightNote,
    },
  });
}

export async function createProductionObservationPlan(input: {
  materialVersionId: string;
  tasks: MaterialProductionTaskInput[];
}) {
  return createMaterialProductionPlan(resourceRepository, observationRepository, input);
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

export async function synchronizeProductionObservationLinks(planId: string) {
  const plan = await observationRepository.getPlan(planId);
  if (!plan) throw new Error(`Material Observation Plan not found: ${planId}`);
  const drafts = await resourceRepository.listDrafts();
  const results: Array<{ observationTaskPlanId: string; status: 'linked' | 'pending'; issues: string[] }> = [];
  for (const task of plan.taskPlans) {
    const draft = drafts.find((item) => item.tags.includes(`observation_task:${task.observationTaskPlanId}`));
    const version = draft ? await resourceRepository.getVersionByDraftId(draft.draftId) : null;
    if (!version) {
      results.push({ observationTaskPlanId: task.observationTaskPlanId, status: 'pending', issues: ['frozen_resource_missing'] });
      continue;
    }
    const linked = await linkFrozenResourceToObservationTask(resourceRepository, observationRepository, {
      planId,
      observationTaskPlanId: task.observationTaskPlanId,
      resourceVersionId: version.resourceVersionId,
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
