import {
  createAndValidateQuestionDraftBatch,
  createMaterialProductionPlan,
  linkFrozenResourceToObservationTask,
  reviewMaterialObservationPlan,
  submitMaterialObservationPlanForReview,
  type MaterialProductionDraftResult,
  type MaterialProductionTaskInput,
} from '../ai/agents/materialObservationApplicationService.ts';
import { createQuestionMaterial } from '../ai/agents/questionResourceAdmissionAgent.ts';
import { IndexedDBMaterialObservationRepository } from '../ai/repositories/indexedDBMaterialObservationRepository.ts';
import { IndexedDBQuestionResourceAdmissionRepository } from '../ai/repositories/indexedDBQuestionResourceAdmissionRepository.ts';
import type {
  MaterialObservationPlan,
  MaterialObservationPlanValidation,
  ResourceObservationLink,
} from '../ai/schemas/materialObservation.schema.ts';
import type {
  FrozenQuestionResourceVersion,
  QuestionMaterialVersion,
  StructuredQuestionDraft,
} from '../ai/schemas/questionResourceAdmission.schema.ts';

const resourceRepository = new IndexedDBQuestionResourceAdmissionRepository();
const observationRepository = new IndexedDBMaterialObservationRepository();

export type MaterialResourceProductionSnapshot = {
  materials: QuestionMaterialVersion[];
  plans: MaterialObservationPlan[];
  validations: MaterialObservationPlanValidation[];
  drafts: StructuredQuestionDraft[];
  frozenVersions: FrozenQuestionResourceVersion[];
  links: ResourceObservationLink[];
};

export async function getMaterialResourceProductionSnapshot(): Promise<MaterialResourceProductionSnapshot> {
  const [materials, plans, drafts, frozenVersions, links] = await Promise.all([
    resourceRepository.listMaterials(),
    observationRepository.listPlans(),
    resourceRepository.listDrafts(),
    resourceRepository.listVersions(),
    observationRepository.listLinks(),
  ]);
  const validations = (await Promise.all(plans.map((plan) => observationRepository.listValidations(plan.materialObservationPlanId)))).flat();
  return {
    materials: materials.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    plans: plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    validations: validations.sort((a, b) => b.checkedAt.localeCompare(a.checkedAt)),
    drafts: drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    frozenVersions: frozenVersions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    links: links.sort((a, b) => b.linkedAt.localeCompare(a.linkedAt)),
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

function createIdSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 12);
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
