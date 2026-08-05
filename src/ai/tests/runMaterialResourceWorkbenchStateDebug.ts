import {
  buildMaterialResourceWorkbenchDetails,
  isPlanFullyPublished,
  scopeMaterialResourceWorkbenchDetails,
  selectCurrentPlanDrafts,
  summarizeMaterialResourceWorkbench,
} from '../../pages/materialResourceWorkbenchState.ts';

type CaseResult = {
  name: string;
  passed: boolean;
  detail: string;
};

const cases: CaseResult[] = [];

function check(name: string, condition: boolean, detail: string): void {
  cases.push({ name, passed: condition, detail });
}

const taskA = {
  observationTaskPlanId: 'task-a',
  observationGoal: '任务 A',
  abilityId: 'analysis',
  taskRole: 'training',
  difficulty: 'intermediate',
};
const taskB = {
  observationTaskPlanId: 'task-b',
  observationGoal: '任务 B',
  abilityId: 'comprehension',
  taskRole: 'training',
  difficulty: 'basic',
};
const planV1 = {
  materialObservationPlanId: 'plan-v1',
  materialVersionId: 'material:v1',
  revision: 1,
  updatedAt: '2026-07-23T08:00:00.000Z',
  taskPlans: [taskA, taskB],
};
const planV2 = {
  ...planV1,
  materialObservationPlanId: 'plan-v2',
  revision: 2,
  updatedAt: '2026-07-23T09:00:00.000Z',
};
const oldDraftA = draft({
  draftId: 'draft-a-v1',
  resourceId: 'resource-a',
  taskId: 'task-a',
  planId: 'plan-v2',
  observationTaskPlanId: 'task-a',
  proposedVersionNumber: 1,
  status: 'reviewed',
  updatedAt: '2026-07-23T09:00:00.000Z',
});
const currentDraftA = draft({
  draftId: 'draft-a-v2',
  resourceId: 'resource-a',
  taskId: 'task-a',
  planId: 'plan-v2',
  observationTaskPlanId: 'task-a',
  proposedVersionNumber: 2,
  status: 'reviewed',
  updatedAt: '2026-07-23T10:00:00.000Z',
});
const currentDraftB = draft({
  draftId: 'draft-b-v1',
  resourceId: 'resource-b',
  taskId: 'task-b',
  planId: 'plan-v2',
  observationTaskPlanId: 'task-b',
  proposedVersionNumber: 1,
  status: 'pending_review',
  updatedAt: '2026-07-23T10:00:00.000Z',
});

const selectedDrafts = selectCurrentPlanDrafts(
  planV2 as never,
  [oldDraftA, currentDraftA, currentDraftB] as never,
);
check(
  '01 历史 Draft 不进入当前计划计数',
  selectedDrafts.length === 2 && selectedDrafts[0]?.draftId === 'draft-a-v2',
  `selected=${selectedDrafts.map((item) => item.draftId).join(',')}`,
);

check(
  '02 部分 Freeze 不得显示正式发布完成',
  !isPlanFullyPublished({
    plan: planV2 as never,
    currentDrafts: selectedDrafts as never,
    draftReadiness: [
      readiness(currentDraftA.draftId, true, true),
      readiness(currentDraftB.draftId, false, false),
    ] as never,
  }),
  'one of two tasks is not frozen',
);

check(
  '03 全部 Freeze 且 active Link 才算正式发布',
  isPlanFullyPublished({
    plan: planV2 as never,
    currentDrafts: selectedDrafts as never,
    draftReadiness: [
      readiness(currentDraftA.draftId, true, true),
      readiness(currentDraftB.draftId, true, true),
    ] as never,
  }),
  'all current tasks are frozen and linked',
);

const snapshot = {
  materials: [
    { materialVersionId: 'material:v1', title: '测试材料', status: 'active' },
    { materialVersionId: 'material:v2', title: '另一篇材料', status: 'active' },
  ],
  plans: [planV1, planV2],
  drafts: [
    oldDraftA,
    currentDraftA,
    currentDraftB,
    draft({
      draftId: 'unrelated-draft',
      resourceId: 'unrelated-resource',
      taskId: 'unrelated-task',
      planId: 'unrelated-plan',
      observationTaskPlanId: 'unrelated-task',
      proposedVersionNumber: 1,
      status: 'pending_review',
      updatedAt: '2026-07-23T11:00:00.000Z',
      phase17: false,
    }),
  ],
  links: [
    link('link-a-v1', 'resource-a', 'resource-a:v1', 'superseded'),
    link('link-a-invalid', 'resource-a', 'resource-a:v0', 'invalid'),
    link('link-a-v2', 'resource-a', 'resource-a:v2', 'active'),
    link('link-b-v1', 'resource-b', 'resource-b:v1', 'active'),
    link('link-c-v1', 'resource-c', 'resource-c:v1', 'invalid'),
  ],
  anchors: [],
  validations: [],
  frozenVersions: [
    frozenVersion('resource-a:v2', 'material:v1', '分析题', 'draft-a-v2'),
    frozenVersion('resource-b:v1', 'material:v1', '理解题', 'draft-b-v1'),
    frozenVersion('resource-c:v1', 'material:v1', '发布未完成题', 'draft-c-v1'),
  ],
  draftReadiness: [],
};
const summary = summarizeMaterialResourceWorkbench(snapshot as never);
check(
  '04 汇总任务数只统计每篇素材的最新计划',
  summary.learningTaskCount === 2,
  `learningTaskCount=${summary.learningTaskCount}`,
);
check(
  '05 待审核与已发布按当前资源去重',
  summary.pendingReviewCount === 1 && summary.publishedResourceCount === 2,
  `pending=${summary.pendingReviewCount}, published=${summary.publishedResourceCount}`,
);
const details = buildMaterialResourceWorkbenchDetails(snapshot as never);
check(
  '06 汇总数字与可查看明细数量一致',
  details.materials.length === summary.materialCount
    && details.learningTasks.length === summary.learningTaskCount
    && details.pendingReviews.length === summary.pendingReviewCount
    && details.publishedResources.length === summary.publishedResourceCount,
  `materials=${details.materials.length}, tasks=${details.learningTasks.length}, pending=${details.pendingReviews.length}, published=${details.publishedResources.length}`,
);
check(
  '07 待审核明细只保留当前资源版本',
  details.pendingReviews[0]?.draftId === 'draft-b-v1',
  `pendingDraft=${details.pendingReviews[0]?.draftId}`,
);
check(
  '08 学习材料明细包含已规划任务数量',
  details.materials[0]?.plannedTaskCount === 2,
  `plannedTaskCount=${details.materials[0]?.plannedTaskCount}`,
);
const scopedDetails = scopeMaterialResourceWorkbenchDetails(details, 'material:v1');
check(
  '09 当前素材统计不混入其他素材',
  scopedDetails.materials.length === 1
    && scopedDetails.learningTasks.length === 2
    && scopedDetails.pendingReviews.length === 1
    && scopedDetails.publishedResources.length === 2,
  `materials=${scopedDetails.materials.length}, tasks=${scopedDetails.learningTasks.length}, pending=${scopedDetails.pendingReviews.length}, published=${scopedDetails.publishedResources.length}`,
);
check(
  '10 待审核与已发布题目共用素材计划顺序',
  details.pendingReviews[0]?.questionNumber === 2
    && details.publishedResources.map((item) => item.questionNumber).join(',') === '1,2',
  `pending=${details.pendingReviews[0]?.questionNumber}, published=${details.publishedResources.map((item) => item.questionNumber).join(',')}`,
);
check(
  '11 无有效发布关联的正式题目单独显示为发布未完成',
  scopedDetails.incompletePublications.length === 1
    && scopedDetails.incompletePublications[0]?.resourceId === 'resource-c',
  `incomplete=${scopedDetails.incompletePublications.map((item) => item.resourceId).join(',')}`,
);
check(
  '12 正式版本来源草稿与当前修订草稿分别读取',
  scopedDetails.publishedResources[0]?.sourceDraftId === 'draft-a-v2'
    && scopedDetails.publishedResources[0]?.activeRepairDraftId === '',
  `source=${scopedDetails.publishedResources[0]?.sourceDraftId}, repair=${scopedDetails.publishedResources[0]?.activeRepairDraftId}`,
);

const successorTaskA = {
  ...taskA,
  observationTaskPlanId: 'task-a-successor',
  taskRevisionRootId: 'task-a',
  parentObservationTaskPlanId: 'task-a',
};
const lineagePlan = {
  ...planV2,
  materialObservationPlanId: 'plan-v3',
  revision: 3,
  taskPlans: [successorTaskA],
};
const lineageDrafts = selectCurrentPlanDrafts(
  lineagePlan as never,
  [currentDraftA] as never,
);
check(
  '13 计划继承任务按血缘恢复原有 Draft',
  lineageDrafts.length === 1 && lineageDrafts[0]?.draftId === currentDraftA.draftId,
  `selected=${lineageDrafts.map((item) => item.draftId).join(',')}`,
);

console.log('Phase 17.2 Material Resource Workbench State Debug');
console.log('='.repeat(76));
for (const result of cases) {
  console.log(`${result.passed ? 'PASS' : 'FAIL'} | ${result.name}`);
  console.log(`       ${result.detail}`);
}
console.log('-'.repeat(76));
const passed = cases.filter((result) => result.passed).length;
console.log(`Result: ${passed} / ${cases.length} PASS`);
if (passed !== cases.length) process.exitCode = 1;

function draft(input: {
  draftId: string;
  resourceId: string;
  taskId: string;
  planId: string;
  observationTaskPlanId: string;
  proposedVersionNumber: number;
  status: string;
  updatedAt: string;
  phase17?: boolean;
}) {
  return {
    ...input,
    materialVersionId: 'material:v1',
    title: `题目 ${input.taskId}`,
    questionStem: `题干 ${input.taskId}`,
    abilityMetadata: {
      abilityId: 'analysis',
      supportingAbilityIds: [],
      prerequisiteAbilityIds: [],
      taskRole: 'training',
      difficulty: 'intermediate',
    },
    revision: 1,
    tags: [
      ...(input.phase17 === false ? [] : ['phase17.2']),
      `observation_plan:${input.planId}`,
      `observation_task:${input.observationTaskPlanId}`,
    ],
  };
}

function readiness(draftId: string, frozen: boolean, linked: boolean) {
  return {
    draftId,
    validation: null,
    review: null,
    frozenVersion: frozen ? { resourceVersionId: `${draftId}:frozen` } : null,
    observationLink: linked ? { status: 'active' } : null,
  };
}

function link(
  resourceObservationLinkId: string,
  resourceId: string,
  resourceVersionId: string,
  status: string,
) {
  return {
    resourceObservationLinkId,
    materialObservationPlanId: 'plan-v2',
    observationTaskPlanId: resourceId.replace('resource-', 'task-'),
    resourceId,
    resourceVersionId,
    status,
  };
}

function frozenVersion(
  resourceVersionId: string,
  materialVersionId: string,
  title: string,
  sourceDraftId: string,
) {
  return {
    resourceVersionId,
    sourceDraftId,
    materialVersionId,
    title,
    questionStem: title,
    abilityMetadata: {
      abilityId: 'analysis',
      taskRole: 'training',
    },
  };
}
