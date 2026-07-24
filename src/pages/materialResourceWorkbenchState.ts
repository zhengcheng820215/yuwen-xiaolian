import type {
  MaterialObservationPlan,
  ResourceObservationLink,
} from '../ai/schemas/materialObservation.schema.ts';
import type {
  QuestionResourceDraftStatus,
  StructuredQuestionDraft,
} from '../ai/schemas/questionResourceAdmission.schema.ts';
import type {
  MaterialProductionDraftReadiness,
  MaterialResourceProductionSnapshot,
} from '../api/materialResourceProductionWorkbench.ts';

const REVIEW_PENDING_STATUSES = new Set<QuestionResourceDraftStatus>([
  'drafted',
  'validation_failed',
  'pending_review',
  'revision_required',
]);

export type MaterialResourceWorkbenchSummary = {
  materialCount: number;
  learningTaskCount: number;
  pendingReviewCount: number;
  publishedResourceCount: number;
};

export function selectCurrentPlanDrafts(
  plan: MaterialObservationPlan | null,
  drafts: StructuredQuestionDraft[],
): StructuredQuestionDraft[] {
  if (!plan) return [];
  const planTag = `observation_plan:${plan.materialObservationPlanId}`;
  return plan.taskPlans
    .map((task) => {
      const taskTag = `observation_task:${task.observationTaskPlanId}`;
      return drafts
        .filter((draft) => draft.tags.includes(planTag) && draft.tags.includes(taskTag))
        .sort(compareMostRecent)[0] || null;
    })
    .filter((draft): draft is StructuredQuestionDraft => Boolean(draft));
}

export function isPlanFullyPublished(input: {
  plan: MaterialObservationPlan | null;
  currentDrafts: StructuredQuestionDraft[];
  draftReadiness: MaterialProductionDraftReadiness[];
}): boolean {
  if (!input.plan || input.plan.taskPlans.length === 0) return false;
  if (input.currentDrafts.length !== input.plan.taskPlans.length) return false;
  const readinessByDraftId = new Map(
    input.draftReadiness.map((item) => [item.draftId, item]),
  );
  return input.currentDrafts.every((draft) => {
    const readiness = readinessByDraftId.get(draft.draftId);
    return Boolean(
      readiness?.frozenVersion &&
      readiness.observationLink?.status === 'active',
    );
  });
}

export function summarizeMaterialResourceWorkbench(
  snapshot: MaterialResourceProductionSnapshot,
): MaterialResourceWorkbenchSummary {
  const latestPlans = selectLatestPlansByMaterial(snapshot.plans);
  const currentDrafts = selectLatestDraftsByResource(
    snapshot.drafts.filter((draft) => draft.tags.includes('phase17.2')),
  );
  return {
    materialCount: snapshot.materials.filter((material) => material.status !== 'retired').length,
    learningTaskCount: latestPlans.reduce(
      (total, plan) => total + plan.taskPlans.length,
      0,
    ),
    pendingReviewCount: currentDrafts.filter(
      (draft) => REVIEW_PENDING_STATUSES.has(draft.status),
    ).length,
    publishedResourceCount: new Set(
      snapshot.links
        .filter((link) => link.status === 'active')
        .map((link) => link.resourceId),
    ).size,
  };
}

function selectLatestPlansByMaterial(
  plans: MaterialObservationPlan[],
): MaterialObservationPlan[] {
  const latestByMaterial = new Map<string, MaterialObservationPlan>();
  for (const plan of plans) {
    const current = latestByMaterial.get(plan.materialVersionId);
    if (!current || comparePlanRecency(plan, current) < 0) {
      latestByMaterial.set(plan.materialVersionId, plan);
    }
  }
  return [...latestByMaterial.values()];
}

function selectLatestDraftsByResource(
  drafts: StructuredQuestionDraft[],
): StructuredQuestionDraft[] {
  const latestByResource = new Map<string, StructuredQuestionDraft>();
  for (const draft of drafts) {
    const current = latestByResource.get(draft.resourceId);
    if (!current || compareMostRecent(draft, current) < 0) {
      latestByResource.set(draft.resourceId, draft);
    }
  }
  return [...latestByResource.values()];
}

function comparePlanRecency(
  left: MaterialObservationPlan,
  right: MaterialObservationPlan,
): number {
  if (left.revision !== right.revision) return right.revision - left.revision;
  return right.updatedAt.localeCompare(left.updatedAt);
}

function compareMostRecent(
  left: StructuredQuestionDraft,
  right: StructuredQuestionDraft,
): number {
  if (left.proposedVersionNumber !== right.proposedVersionNumber) {
    return right.proposedVersionNumber - left.proposedVersionNumber;
  }
  if (left.revision !== right.revision) return right.revision - left.revision;
  return right.updatedAt.localeCompare(left.updatedAt);
}

export function activeLinksForPlan(
  plan: MaterialObservationPlan | null,
  links: ResourceObservationLink[],
): ResourceObservationLink[] {
  if (!plan) return [];
  return links.filter((link) => (
    link.materialObservationPlanId === plan.materialObservationPlanId &&
    link.status === 'active'
  ));
}
