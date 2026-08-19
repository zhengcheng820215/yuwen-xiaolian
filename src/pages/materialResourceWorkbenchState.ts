import type {
  MaterialObservationPlan,
  ResourceObservationLink,
} from '../ai/schemas/materialObservation.schema.ts';
import type {
  QuestionMaterialVersion,
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
    taskRevisionRootId?: string;
    parentObservationTaskPlanId?: string;
    materialObservationPlanId: string;
    materialVersionId: string;
    materialTitle: string;
    title: string;
    questionStem?: string;
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
    difficulty?: string;
    responseFormat?: string;
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
    difficulty?: string;
    responseFormat?: string;
    versionNumber: number | null;
    frozenAt: string;
  }>;
};

export type CrossMaterialProductionProgress = {
  materialCount: number;
  taskCount: number;
  pendingTaskCount: number;
  publishedTaskCount: number;
  attentionTaskCount: number;
  pendingMaterialIds: string[];
};

/**
 * Older published plans can predate the rubric-description field. Reusing one
 * of those protected tasks in a supplement revision must not make an otherwise
 * valid candidate group impossible to adopt. Build an editable compatibility
 * description only from facts already present in the frozen rubric; do not
 * invent a new judging rule or mutate the historical resource.
 */
export function resolveEditableRubricDescription(item: {
  description?: string;
  name?: string;
  acceptedSignals?: string[];
}): string {
  const explicitDescription = String(item.description || '').trim();
  if (explicitDescription) return explicitDescription;
  const acceptedSignals = (item.acceptedSignals || [])
    .map((signal) => String(signal || '').trim())
    .filter(Boolean);
  if (acceptedSignals.length > 0) return `观察是否包含：${acceptedSignals.join('、')}`;
  return String(item.name || '').trim();
}

type ObservationTaskIdentity = {
  observationTaskPlanId: string;
  taskRevisionRootId?: string;
  parentObservationTaskPlanId?: string;
};

/**
 * A retired version with an active successor is version history, not a
 * user-disabled material. Only expose the latest retired version when the
 * logical material currently has no active version.
 */
export function selectUserRetiredMaterials(
  materials: QuestionMaterialVersion[],
): QuestionMaterialVersion[] {
  const activeMaterialIds = new Set(materials
    .filter((material) => material.status !== 'retired')
    .map((material) => material.materialId));
  const latestByMaterialId = new Map<string, QuestionMaterialVersion>();
  for (const material of materials) {
    if (material.status !== 'retired' || activeMaterialIds.has(material.materialId)) continue;
    const current = latestByMaterialId.get(material.materialId);
    if (
      !current ||
      material.versionNumber > current.versionNumber ||
      (
        material.versionNumber === current.versionNumber &&
        material.updatedAt > current.updatedAt
      )
    ) {
      latestByMaterialId.set(material.materialId, material);
    }
  }
  return [...latestByMaterialId.values()].sort((left, right) => (
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.title.localeCompare(right.title)
  ));
}

export function summarizeCrossMaterialProductionProgress(
  details: MaterialResourceWorkbenchDetails,
  activeMaterialIds: string[],
): CrossMaterialProductionProgress {
  const activeIds = new Set(activeMaterialIds);
  const currentTasks = details.learningTasks.filter((task) => activeIds.has(task.materialVersionId));
  const matchesTaskIdentity = (
    task: MaterialResourceWorkbenchDetails['learningTasks'][number],
    observationTaskPlanId: string,
  ) => observationTaskIdentityIds(task).includes(observationTaskPlanId);
  const publishedTaskIds = new Set(currentTasks
    .filter((task) => details.publishedResources.some((resource) => (
      matchesPublishedResourceToObservationTask(resource, task)
    )))
    .map((task) => task.observationTaskPlanId));
  const attentionItems = [
    ...details.pendingReviews,
    ...details.incompletePublications,
  ];
  const attentionTaskIds = new Set(currentTasks
    .filter((task) => (
      !publishedTaskIds.has(task.observationTaskPlanId)
      && attentionItems.some((item) => (
        item.materialVersionId === task.materialVersionId &&
        matchesTaskIdentity(task, item.observationTaskPlanId)
      ))
    ))
    .map((task) => task.observationTaskPlanId));
  const pendingMaterialIds = new Set(currentTasks
    .filter((task) => !publishedTaskIds.has(task.observationTaskPlanId))
    .map((task) => task.materialVersionId));
  const taskCount = currentTasks.length;
  const publishedTaskCount = publishedTaskIds.size;

  return {
    materialCount: activeMaterialIds.length,
    taskCount,
    pendingTaskCount: taskCount - publishedTaskCount,
    publishedTaskCount,
    attentionTaskCount: attentionTaskIds.size,
    pendingMaterialIds: [...pendingMaterialIds],
  };
}

export function selectCurrentMaterialPlan(
  plans: MaterialObservationPlan[],
  materialVersionId: string,
): MaterialObservationPlan | null {
  return selectLatestPlansByMaterial(
    plans.filter((plan) => plan.materialVersionId === materialVersionId),
  )[0] || null;
}

export function selectCurrentPlanDrafts(
  plan: MaterialObservationPlan | null,
  drafts: StructuredQuestionDraft[],
): StructuredQuestionDraft[] {
  if (!plan) return [];
  return plan.taskPlans
    .map((task) => {
      return drafts
        .filter((draft) => (
          draft.status !== 'archived' && matchesDraftToObservationTask(draft, task)
        ))
        .sort(compareMostRecent)[0] || null;
    })
    .filter((draft): draft is StructuredQuestionDraft => Boolean(draft));
}

export function observationTaskIdentityIds(
  task: ObservationTaskIdentity,
): string[] {
  return [...new Set([
    task.observationTaskPlanId,
    task.taskRevisionRootId,
    task.parentObservationTaskPlanId,
  ].filter((value): value is string => Boolean(value)))];
}

export function matchesPublishedResourceToObservationTask(
  resource: MaterialResourceWorkbenchDetails['publishedResources'][number],
  task: ObservationTaskIdentity & {
    materialVersionId?: string;
    abilityId?: string;
    taskRole?: string;
    observationGoal?: string;
    questionStem?: string;
    title?: string;
    difficulty?: string;
    responseFormat?: string;
  },
): boolean {
  if (
    resource.materialVersionId
    && task.materialVersionId
    && resource.materialVersionId !== task.materialVersionId
  ) return false;
  if (observationTaskIdentityIds(task).includes(resource.observationTaskPlanId)) return true;

  // Compatibility repair for supplement Plans created before stable task-id
  // inheritance: exact same-material stem + ability + role resolves the old link.
  if (!publishedResourceContentMatchesObservationTask(resource, task)) return false;
  return true;
}

export function publishedResourceContentMatchesObservationTask(
  resource: MaterialResourceWorkbenchDetails['publishedResources'][number],
  task: {
    abilityId?: string;
    taskRole?: string;
    observationGoal?: string;
    questionStem?: string;
    title?: string;
    difficulty?: string;
    responseFormat?: string;
  },
): boolean {
  const taskStem = task.observationGoal || task.questionStem || task.title || '';
  if (!taskStem || normalizeIdentityText(resource.title) !== normalizeIdentityText(taskStem)) return false;
  if (resource.abilityId && task.abilityId && resource.abilityId !== task.abilityId) return false;
  if (resource.taskRole && task.taskRole && resource.taskRole !== task.taskRole) return false;
  if (resource.difficulty && task.difficulty && resource.difficulty !== task.difficulty) return false;
  if (resource.responseFormat && task.responseFormat && resource.responseFormat !== task.responseFormat) return false;
  return true;
}

export function findPublishedResourceForObservationTask(
  details: MaterialResourceWorkbenchDetails,
  task: ObservationTaskIdentity & {
    materialVersionId?: string;
    abilityId?: string;
    taskRole?: string;
    observationGoal?: string;
    questionStem?: string;
    title?: string;
    difficulty?: string;
    responseFormat?: string;
  },
): MaterialResourceWorkbenchDetails['publishedResources'][number] | null {
  const direct = details.publishedResources.find((resource) => (
    matchesPublishedResourceToObservationTask(resource, task)
  ));
  if (direct) return direct;

  const taskStem = task.observationGoal || task.questionStem || task.title || '';
  const authoritativeTask = details.learningTasks.find((candidate) => {
    const sharesIdentity = observationTaskIdentityIds(candidate).some((id) => (
      observationTaskIdentityIds(task).includes(id)
    ));
    if (sharesIdentity) return true;
    return Boolean(
      taskStem
      && normalizeIdentityText(candidate.questionStem || candidate.title) === normalizeIdentityText(taskStem)
      && (!task.abilityId || candidate.abilityId === task.abilityId)
      && (!task.taskRole || candidate.taskRole === task.taskRole)
    );
  });
  if (!authoritativeTask) return null;
  return details.publishedResources.find((resource) => (
    matchesPublishedResourceToObservationTask(resource, authoritativeTask)
  )) || null;
}

export function matchesDraftToObservationTask(
  draft: StructuredQuestionDraft,
  task: MaterialObservationPlan['taskPlans'][number],
): boolean {
  const identityIds = observationTaskIdentityIds(task);
  if (identityIds.includes(draft.taskId)) return true;
  const identityTags = [
    ...identityIds.map((id) => `observation_task:${id}`),
    ...(task.taskRevisionRootId
      ? [`observation_task_root:${task.taskRevisionRootId}`]
      : []),
  ];
  return identityTags.some((tag) => draft.tags.includes(tag));
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
      readiness.frozenVersion.materialVersionId === input.plan?.materialVersionId &&
      readiness.observationLink?.status === 'active' &&
      readiness.observationLink?.materialVersionId === input.plan?.materialVersionId
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
      difficulty: version?.abilityMetadata.difficulty || '',
      responseFormat: version?.responseFormat || '',
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
        taskRevisionRootId: task.taskRevisionRootId,
        parentObservationTaskPlanId: task.parentObservationTaskPlanId,
        materialObservationPlanId: plan.materialObservationPlanId,
        materialVersionId: plan.materialVersionId,
        materialTitle,
        title: task.resourceDraftSpecification?.title || task.observationGoal,
        questionStem: task.observationGoal,
        abilityId: task.abilityId,
        taskRole: task.taskRole,
        difficulty: task.difficulty,
        responseFormat: task.resourceDraftSpecification?.responseFormat,
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

function normalizeIdentityText(value?: string): string {
  return String(value || '').trim().replace(/\s+/g, '').replace(/[，。！？；：、“”‘’]/g, '').toLowerCase();
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
