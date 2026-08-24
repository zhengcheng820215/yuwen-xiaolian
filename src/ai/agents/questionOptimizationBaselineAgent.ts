import type {
  MaterialObservationPlan,
  ObservationTaskPlan,
  ResourceObservationLink,
} from '../schemas/materialObservation.schema.ts';
import type { SharedFormalResourceSnapshot } from '../schemas/sharedFormalResourcePersistence.schema.ts';

export const QUESTION_OPTIMIZATION_BASELINE_SCHEMA_VERSION =
  'question_optimization_baseline_v1' as const;

export type QuestionOptimizationBaselineItem = {
  materialId: string;
  materialVersionId: string;
  materialTitle: string;
  observationPlanId: string;
  observationPlanRevision: number;
  observationTaskPlanId: string;
  taskRevisionRootId: string;
  resourceId: string;
  resourceVersionId: string;
  contentHash: string;
  qualityTraceId: string;
  learningConsumable: boolean;
};

export type QuestionOptimizationBaselineReport = {
  schemaVersion: typeof QUESTION_OPTIMIZATION_BASELINE_SCHEMA_VERSION;
  storeRevision: number;
  storeUpdatedAt: string;
  counts: {
    activeMaterials: number;
    currentPlans: number;
    currentTasks: number;
    activeObservationLinks: number;
    activeRegistryEntries: number;
    currentFormalVersions: number;
    frozenQualityTraces: number;
    learningConsumableQuestions: number;
  };
  items: QuestionOptimizationBaselineItem[];
  issues: string[];
  baselineDigest: string;
};

export function buildQuestionOptimizationBaseline(
  snapshot: SharedFormalResourceSnapshot,
): QuestionOptimizationBaselineReport {
  const data = snapshot.data;
  const materials = data.questionResources.materials.filter((material) => material.status !== 'retired');
  const activeMaterialIds = new Set(materials.map((material) => material.materialId));
  const plans = materials.map((material) => selectCurrentPlan(
    data.materialObservations.plans.filter((plan) => plan.materialId === material.materialId),
  )).filter((plan): plan is MaterialObservationPlan => Boolean(plan));
  const activeLinks = data.materialObservations.links
    .filter((link) => link.status === 'active' && activeMaterialIds.has(link.materialId));
  const registryByResourceId = new Map(data.questionResources.registryEntries
    .filter((entry) => entry.status === 'active')
    .map((entry) => [entry.resourceId, entry]));
  const versionById = new Map(data.questionResources.versions
    .map((version) => [version.resourceVersionId, version]));
  const traceByVersionId = new Map(data.questionQuality.frozenQualityTraces
    .map((trace) => [trace.resourceVersionId, trace]));
  const materialById = new Map(materials.map((material) => [material.materialId, material]));
  const issues: string[] = [];
  const items: QuestionOptimizationBaselineItem[] = [];
  const resolvedLinkIds = new Set<string>();

  for (const plan of plans) {
    for (const task of plan.taskPlans.filter((item) => item.status !== 'cancelled')) {
      const link = resolveActiveObservationLink(activeLinks, plan, task);
      if (!link) {
        issues.push(`current_task_without_active_link:${task.observationTaskPlanId}`);
        continue;
      }
      if (resolvedLinkIds.has(link.resourceObservationLinkId)) {
        issues.push(`active_link_reused_by_current_tasks:${link.resourceObservationLinkId}`);
      }
      resolvedLinkIds.add(link.resourceObservationLinkId);
      const registry = registryByResourceId.get(link.resourceId);
      if (!registry) {
        issues.push(`active_link_without_registry:${link.resourceObservationLinkId}`);
        continue;
      }
      if (registry.currentFrozenVersionId !== link.resourceVersionId) {
        issues.push(`link_registry_head_mismatch:${link.resourceObservationLinkId}`);
      }
      const version = versionById.get(link.resourceVersionId);
      if (!version || version.status !== 'frozen') {
        issues.push(`current_frozen_version_missing:${link.resourceVersionId}`);
        continue;
      }
      const trace = traceByVersionId.get(version.resourceVersionId);
      if (!trace) issues.push(`frozen_quality_trace_missing:${version.resourceVersionId}`);
      const material = materialById.get(plan.materialId);
      const structuralIdentityConsistent = Boolean(
        material
        && plan.materialVersionId === material.materialVersionId
        && link.materialId === plan.materialId
        && link.materialVersionId === plan.materialVersionId
        && taskLineageIds(task).has(link.observationTaskPlanId)
        && version.resourceId === link.resourceId
        && version.resourceVersionId === registry.currentFrozenVersionId
        && version.materialId === plan.materialId
        && version.materialVersionId === plan.materialVersionId
      );
      const traceIdentityConsistent = !trace || Boolean(
        trace.resourceId === version.resourceId
        && trace.resourceVersionId === version.resourceVersionId
        && trace.sourceDraftId === version.sourceDraftId
        && trace.validationId === version.validationId
        && trace.reviewId === version.reviewId
      );
      const identityConsistent = structuralIdentityConsistent && traceIdentityConsistent;
      if (!identityConsistent) {
        issues.push(`learning_identity_mismatch:${task.observationTaskPlanId}`);
      }
      items.push({
        materialId: plan.materialId,
        materialVersionId: plan.materialVersionId,
        materialTitle: material?.title || plan.materialId,
        observationPlanId: plan.materialObservationPlanId,
        observationPlanRevision: plan.revision,
        observationTaskPlanId: task.observationTaskPlanId,
        taskRevisionRootId: task.taskRevisionRootId || task.observationTaskPlanId,
        resourceId: version.resourceId,
        resourceVersionId: version.resourceVersionId,
        contentHash: hashValue({
          materialVersionId: version.materialVersionId,
          taskId: version.taskId,
          title: version.title,
          questionStem: version.questionStem,
          responseFormat: version.responseFormat,
          choiceInteraction: version.choiceInteraction,
          answerAcceptance: version.answerAcceptance,
          rubric: version.rubric,
          minimumAnswerRequirement: version.minimumAnswerRequirement,
          abilityMetadata: version.abilityMetadata,
        }),
        qualityTraceId: trace?.traceId || '',
        learningConsumable: identityConsistent && Boolean(trace),
      });
    }
  }

  const scopedRegistryIds = new Set(items.map((item) => item.resourceId));
  const scopedRegistries = data.questionResources.registryEntries.filter((entry) => (
    entry.status === 'active' && scopedRegistryIds.has(entry.resourceId)
  ));
  const scopedVersionIds = new Set(items.map((item) => item.resourceVersionId));
  const scopedVersions = data.questionResources.versions.filter((version) => (
    version.status === 'frozen' && scopedVersionIds.has(version.resourceVersionId)
  ));
  const scopedTraces = data.questionQuality.frozenQualityTraces.filter((trace) => (
    scopedVersionIds.has(trace.resourceVersionId)
  ));
  const sortedItems = [...items].sort((left, right) => (
    `${left.materialId}:${left.observationTaskPlanId}`.localeCompare(
      `${right.materialId}:${right.observationTaskPlanId}`,
    )
  ));
  return {
    schemaVersion: QUESTION_OPTIMIZATION_BASELINE_SCHEMA_VERSION,
    storeRevision: snapshot.revision,
    storeUpdatedAt: snapshot.updatedAt,
    counts: {
      activeMaterials: materials.length,
      currentPlans: plans.length,
      currentTasks: plans.reduce((sum, plan) => (
        sum + plan.taskPlans.filter((task) => task.status !== 'cancelled').length
      ), 0),
      activeObservationLinks: resolvedLinkIds.size,
      activeRegistryEntries: scopedRegistries.length,
      currentFormalVersions: scopedVersions.length,
      frozenQualityTraces: scopedTraces.length,
      learningConsumableQuestions: sortedItems.filter((item) => item.learningConsumable).length,
    },
    items: sortedItems,
    issues: [...new Set(issues)].sort(),
    baselineDigest: hashValue(sortedItems.map((item) => ({
      materialVersionId: item.materialVersionId,
      observationTaskPlanId: item.observationTaskPlanId,
      resourceVersionId: item.resourceVersionId,
      contentHash: item.contentHash,
      qualityTraceId: item.qualityTraceId,
    }))),
  };
}

function resolveActiveObservationLink(
  activeLinks: ResourceObservationLink[],
  plan: MaterialObservationPlan,
  task: ObservationTaskPlan,
): ResourceObservationLink | null {
  const lineageIds = taskLineageIds(task);
  const priority = (link: ResourceObservationLink) => {
    if (link.observationTaskPlanId === task.observationTaskPlanId) return 0;
    if (link.observationTaskPlanId === task.taskRevisionRootId) return 1;
    return 2;
  };
  return activeLinks
    .filter((link) => (
      link.materialId === plan.materialId
      && link.materialVersionId === plan.materialVersionId
      && lineageIds.has(link.observationTaskPlanId)
    ))
    .sort((left, right) => (
      priority(left) - priority(right)
      || right.linkedAt.localeCompare(left.linkedAt)
      || left.resourceObservationLinkId.localeCompare(right.resourceObservationLinkId)
    ))[0] || null;
}

function taskLineageIds(task: ObservationTaskPlan): Set<string> {
  return new Set([
    task.observationTaskPlanId,
    task.taskRevisionRootId,
    task.parentObservationTaskPlanId,
  ].filter((value): value is string => Boolean(value)));
}

function selectCurrentPlan(plans: MaterialObservationPlan[]): MaterialObservationPlan | null {
  return [...plans]
    .filter((plan) => plan.status === 'reviewed')
    .sort((left, right) => right.revision - left.revision
      || right.updatedAt.localeCompare(left.updatedAt))[0] || null;
}

function hashValue(value: unknown): string {
  const serialized = JSON.stringify(normalize(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, normalize(child)]));
}
