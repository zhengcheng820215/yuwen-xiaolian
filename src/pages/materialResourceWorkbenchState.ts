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

const ACTIVE_REVISION_STATUSES = new Set<QuestionResourceDraftStatus>([
  'drafted',
  'validation_failed',
  'pending_review',
  'revision_required',
  'reviewed',
]);

export type MaterialResourceWorkbenchSummary = {
  materialCount: number;
  learningTaskCount: number;
  pendingReviewCount: number;
  publishedResourceCount: number;
};

export type MaterialResourceWorkbenchDetails = {
  materials: Array<{
    materialVersionId: string;
    title: string;
    plannedTaskCount: number;
  }>;
  learningTasks: Array<{
    observationTaskPlanId: string;
    materialObservationPlanId: string;
    materialVersionId: string;
    materialTitle: string;
    title: string;
    abilityId: string;
    taskRole: string;
    difficulty: string;
  }>;
  pendingReviews: Array<{
    draftId: string;
    observationTaskPlanId: string;
    questionNumber: number | null;
    materialObservationPlanId: string;
    materialVersionId: string;
    materialTitle: string;
    title: string;
    abilityId: string;
    status: QuestionResourceDraftStatus;
  }>;
  incompletePublications: Array<{
    draftId: string;
    sourceDraftId: string;
    activeRepairDraftId: string;
    resourceId: string;
    resourceVersionId: string;
    observationTaskPlanId: string;
    questionNumber: number | null;
    materialObservationPlanId: string;
    materialVersionId: string;
    materialTitle: string;
    title: string;
    abilityId: string;
    taskRole: string;
    versionNumber: number | null;
    frozenAt: string;
  }>;
  publishedResources: Array<{
    draftId: string;
    sourceDraftId: string;
    activeRepairDraftId: string;
    resourceId: string;
    resourceVersionId: string;
    observationTaskPlanId: string;
    questionNumber: number | null;
    materialObservationPlanId: string;
    materialVersionId: string;
    materialTitle: string;
    title: string;
    abilityId: string;
    taskRole: string;
    versionNumber: number | null;
    frozenAt: string;
  }>;
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

export function buildMaterialResourceWorkbenchDetails(
  snapshot: MaterialResourceProductionSnapshot,
): MaterialResourceWorkbenchDetails {
  const materialByVersionId = new Map(
    snapshot.materials.map((material) => [material.materialVersionId, material]),
  );
  const latestPlans = selectLatestPlansByMaterial(snapshot.plans);
  const latestPlanByMaterialVersionId = new Map(
    latestPlans.map((plan) => [plan.materialVersionId, plan]),
  );
  const questionNumberByTaskId = new Map(
    latestPlans.flatMap((plan) => (
      plan.taskPlans.map((task, index) => [task.observationTaskPlanId, index + 1] as const)
    )),
  );
  const currentDrafts = selectLatestDraftsByResource(
    snapshot.drafts.filter((draft) => draft.tags.includes('phase17.2')),
  );
  const frozenByVersionId = new Map(
    snapshot.frozenVersions.map((version) => [version.resourceVersionId, version]),
  );
  const activePublishedByResource = new Map<string, ResourceObservationLink>();
  const incompletePublicationByResource = new Map<string, ResourceObservationLink>();

  for (const link of snapshot.links) {
    if (link.status === 'active' && !activePublishedByResource.has(link.resourceId)) {
      activePublishedByResource.set(link.resourceId, link);
    }
  }
  for (const link of snapshot.links) {
    if (
      link.status === 'invalid' &&
      !activePublishedByResource.has(link.resourceId) &&
      !incompletePublicationByResource.has(link.resourceId)
    ) {
      incompletePublicationByResource.set(link.resourceId, link);
    }
  }

  const publicationDetails = (link: ResourceObservationLink) => {
    const version = frozenByVersionId.get(link.resourceVersionId);
    const materialVersionId = version?.materialVersionId || link.materialVersionId || '';
    const activeRepairDraft = currentDrafts.find((draft) => (
      draft.resourceId === link.resourceId &&
      draft.parentVersionId === link.resourceVersionId &&
      ACTIVE_REVISION_STATUSES.has(draft.status)
    ));
    return {
      draftId: activeRepairDraft?.draftId || version?.sourceDraftId || '',
      sourceDraftId: version?.sourceDraftId || '',
      activeRepairDraftId: activeRepairDraft?.draftId || '',
      resourceId: link.resourceId,
      resourceVersionId: link.resourceVersionId,
      observationTaskPlanId: link.observationTaskPlanId,
      questionNumber: questionNumberByTaskId.get(link.observationTaskPlanId) || null,
      materialObservationPlanId: link.materialObservationPlanId,
      materialVersionId,
      materialTitle: materialByVersionId.get(materialVersionId)?.title || '未命名材料',
      title: version?.questionStem || version?.title || '未命名练习',
      abilityId: version?.abilityMetadata.abilityId || link.abilityId || '',
      taskRole: version?.abilityMetadata.taskRole || link.taskRole || '',
      versionNumber: version?.versionNumber || null,
      frozenAt: version?.frozenAt || '',
    };
  };

  return {
    materials: snapshot.materials
      .filter((material) => material.status !== 'retired')
      .map((material) => ({
        materialVersionId: material.materialVersionId,
        title: material.title,
        plannedTaskCount: latestPlanByMaterialVersionId.get(material.materialVersionId)?.taskPlans.length || 0,
      })),
    learningTasks: latestPlans.flatMap((plan) => {
      const materialTitle = materialByVersionId.get(plan.materialVersionId)?.title || '未命名材料';
      return plan.taskPlans.map((task) => ({
        observationTaskPlanId: task.observationTaskPlanId,
        materialObservationPlanId: plan.materialObservationPlanId,
        materialVersionId: plan.materialVersionId,
        materialTitle,
        title: task.resourceDraftSpecification?.title || task.observationGoal,
        abilityId: task.abilityId,
        taskRole: task.taskRole,
        difficulty: task.difficulty,
      }));
    }),
    pendingReviews: currentDrafts
      .filter((draft) => REVIEW_PENDING_STATUSES.has(draft.status))
      .map((draft) => {
        const observationTaskPlanId = tagValue(draft.tags, 'observation_task:');
        return {
          draftId: draft.draftId,
          observationTaskPlanId,
          questionNumber: questionNumberByTaskId.get(observationTaskPlanId) || null,
          materialObservationPlanId: tagValue(draft.tags, 'observation_plan:'),
          materialVersionId: draft.materialVersionId || '',
          materialTitle: materialByVersionId.get(draft.materialVersionId || '')?.title || '未命名材料',
          title: draft.questionStem || draft.title,
          abilityId: draft.abilityMetadata.abilityId,
          status: draft.status,
        };
      }),
    incompletePublications: [...incompletePublicationByResource.values()].map(publicationDetails),
    publishedResources: [...activePublishedByResource.values()].map(publicationDetails),
  };
}

export function scopeMaterialResourceWorkbenchDetails(
  details: MaterialResourceWorkbenchDetails,
  materialVersionId: string,
): MaterialResourceWorkbenchDetails {
  if (!materialVersionId) {
    return {
      materials: [],
      learningTasks: [],
      pendingReviews: [],
      incompletePublications: [],
      publishedResources: [],
    };
  }
  return {
    materials: details.materials.filter(
      (item) => item.materialVersionId === materialVersionId,
    ),
    learningTasks: details.learningTasks.filter(
      (item) => item.materialVersionId === materialVersionId,
    ),
    pendingReviews: details.pendingReviews.filter(
      (item) => item.materialVersionId === materialVersionId,
    ),
    incompletePublications: details.incompletePublications.filter(
      (item) => item.materialVersionId === materialVersionId,
    ),
    publishedResources: details.publishedResources.filter(
      (item) => item.materialVersionId === materialVersionId,
    ),
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

function tagValue(tags: string[], prefix: string): string {
  return tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length) || '';
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
