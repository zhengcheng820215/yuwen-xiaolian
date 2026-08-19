import {
  buildMaterialResourceWorkbenchDetails,
  findPublishedResourceForObservationTask,
  isPlanFullyPublished,
  publishedResourceContentMatchesObservationTask,
  scopeMaterialResourceWorkbenchDetails,
  selectUserRetiredMaterials,
  selectCurrentMaterialPlan,
  selectCurrentPlanDrafts,
  resolveEditableRubricDescription,
  summarizeCrossMaterialProductionProgress,
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

const taskIdOnlyDraft = {
  ...currentDraftA,
  draftId: 'draft-task-id-only',
  tags: currentDraftA.tags.filter((tag) => !tag.startsWith('observation_task:')),
  updatedAt: '2026-08-06T12:00:00.000Z',
};
check(
  '01 历史 Draft 不进入当前计划计数',
  selectedDrafts.length === 2 && selectedDrafts[0]?.draftId === 'draft-a-v2',
  `selected=${selectedDrafts.map((item) => item.draftId).join(',')}`,
);
check(
  '01a 候选采用 Draft 缺少旧身份标签时仍可按 taskId 恢复',
  selectCurrentPlanDrafts(planV2 as never, [taskIdOnlyDraft] as never)[0]?.draftId
    === taskIdOnlyDraft.draftId,
  'candidate-adopted Draft remains visible through taskId fallback',
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

const batchProgress = summarizeCrossMaterialProductionProgress({
  materials: [
    { materialVersionId: 'material:v1', title: '材料一', plannedTaskCount: 2 },
    { materialVersionId: 'material:v2', title: '材料二', plannedTaskCount: 2 },
  ],
  learningTasks: [
    { observationTaskPlanId: 'task-1', materialObservationPlanId: 'plan-1', materialVersionId: 'material:v1', materialTitle: '材料一', title: '题目一', abilityId: 'analysis', taskRole: 'training', difficulty: 'basic' },
    { observationTaskPlanId: 'task-2', materialObservationPlanId: 'plan-1', materialVersionId: 'material:v1', materialTitle: '材料一', title: '题目二', abilityId: 'analysis', taskRole: 'training', difficulty: 'basic' },
    { observationTaskPlanId: 'task-3', materialObservationPlanId: 'plan-2', materialVersionId: 'material:v2', materialTitle: '材料二', title: '题目三', abilityId: 'analysis', taskRole: 'training', difficulty: 'basic' },
    { observationTaskPlanId: 'task-retired', materialObservationPlanId: 'plan-3', materialVersionId: 'material:retired', materialTitle: '停用材料', title: '旧题', abilityId: 'analysis', taskRole: 'training', difficulty: 'basic' },
  ],
  pendingReviews: [
    { draftId: 'draft-2', observationTaskPlanId: 'task-2', questionNumber: 2, materialObservationPlanId: 'plan-1', materialVersionId: 'material:v1', materialTitle: '材料一', title: '题目二', abilityId: 'analysis', status: 'pending_review' },
  ],
  incompletePublications: [],
  publishedResources: [
    { observationTaskPlanId: 'task-1', materialObservationPlanId: 'plan-1', materialVersionId: 'material:v1' },
    { observationTaskPlanId: 'task-retired', materialObservationPlanId: 'plan-3', materialVersionId: 'material:retired' },
  ],
} as never, ['material:v1', 'material:v2']);
check(
  '14 跨材料进度只统计活动素材当前任务身份',
  batchProgress.materialCount === 2
    && batchProgress.taskCount === 3
    && batchProgress.publishedTaskCount === 1
    && batchProgress.pendingTaskCount === 2,
  `materials=${batchProgress.materialCount}, tasks=${batchProgress.taskCount}, published=${batchProgress.publishedTaskCount}, pending=${batchProgress.pendingTaskCount}`,
);
check(
  '15 待处理材料身份可用于全量列表状态标注',
  batchProgress.attentionTaskCount === 1
    && batchProgress.pendingMaterialIds.join(',') === 'material:v1,material:v2',
  `attention=${batchProgress.attentionTaskCount}, pendingMaterials=${batchProgress.pendingMaterialIds.join(',')}`,
);
check(
  '16 规范当前 Plan 按 revision 优先且不恢复历史 Plan',
  selectCurrentMaterialPlan([
    { ...planV2, materialObservationPlanId: 'plan-history', revision: 2, updatedAt: '2026-08-13T12:00:00.000Z' },
    { ...planV2, materialObservationPlanId: 'plan-current', revision: 3, updatedAt: '2026-08-12T12:00:00.000Z' },
  ] as never, 'material:v1')?.materialObservationPlanId === 'plan-current',
  'revision 3 must remain canonical even when revision 2 has a later updatedAt',
);
const lineageAwareBatchProgress = summarizeCrossMaterialProductionProgress({
  materials: [
    { materialVersionId: 'material:lineage', title: '修订材料', plannedTaskCount: 2 },
  ],
  learningTasks: [
    {
      observationTaskPlanId: 'task-successor',
      taskRevisionRootId: 'task-root',
      parentObservationTaskPlanId: 'task-parent',
      materialObservationPlanId: 'plan-current',
      materialVersionId: 'material:lineage',
      materialTitle: '修订材料',
      title: '继承题目',
      abilityId: 'analysis',
      taskRole: 'training',
      difficulty: 'basic',
    },
    {
      observationTaskPlanId: 'task-new',
      materialObservationPlanId: 'plan-current',
      materialVersionId: 'material:lineage',
      materialTitle: '修订材料',
      title: '新增题目',
      abilityId: 'analysis',
      taskRole: 'training',
      difficulty: 'basic',
    },
  ],
  pendingReviews: [],
  incompletePublications: [],
  publishedResources: [
    { observationTaskPlanId: 'task-root', materialObservationPlanId: 'plan-current', materialVersionId: 'material:lineage' },
    { observationTaskPlanId: 'task-new', materialObservationPlanId: 'plan-current', materialVersionId: 'material:lineage' },
  ],
} as never, ['material:lineage']);
check(
  '17 批次统计按任务血缘识别既有正式资源',
  lineageAwareBatchProgress.publishedTaskCount === 2
    && lineageAwareBatchProgress.pendingTaskCount === 0
    && lineageAwareBatchProgress.pendingMaterialIds.length === 0,
  `published=${lineageAwareBatchProgress.publishedTaskCount}, pending=${lineageAwareBatchProgress.pendingTaskCount}, pendingMaterials=${lineageAwareBatchProgress.pendingMaterialIds.join(',') || 'none'}`,
);
const staleMaterialProgress = summarizeCrossMaterialProductionProgress({
  ...lineageAwareBatchProgress,
  materials: [{ materialVersionId: 'material:v2', title: '新版材料', plannedTaskCount: 1 }],
  learningTasks: [{
    observationTaskPlanId: 'task-v2',
    materialObservationPlanId: 'plan-v2',
    materialVersionId: 'material:v2',
    materialTitle: '新版材料',
    title: '新版题目',
    abilityId: 'analysis',
    taskRole: 'training',
    difficulty: 'basic',
  }],
  pendingReviews: [],
  incompletePublications: [],
  publishedResources: [{
    observationTaskPlanId: 'task-v2',
    materialObservationPlanId: 'plan-v1',
    materialVersionId: 'material:v1',
  }],
} as never, ['material:v2']);
check(
  '18 旧材料或旧 Plan 的活动资源不得计入新版发布数',
  staleMaterialProgress.publishedTaskCount === 0 && staleMaterialProgress.pendingTaskCount === 1,
  `published=${staleMaterialProgress.publishedTaskCount}, pending=${staleMaterialProgress.pendingTaskCount}`,
);

const supplementedPlanProgress = summarizeCrossMaterialProductionProgress({
  materials: [
    { materialVersionId: 'material:supplement', title: '补充任务材料', plannedTaskCount: 5 },
  ],
  learningTasks: [
    ...['a', 'b', 'c'].map((suffix) => ({
      observationTaskPlanId: `task-${suffix}-current`,
      taskRevisionRootId: suffix === 'a' ? 'task-a-lost-root' : `task-${suffix}-published`,
      parentObservationTaskPlanId: suffix === 'a' ? 'task-a-lost-parent' : `task-${suffix}-published`,
      materialObservationPlanId: 'plan-supplemented',
      materialVersionId: 'material:supplement',
      materialTitle: '补充任务材料',
      title: `既有题目 ${suffix}`,
      abilityId: 'analysis',
      taskRole: 'training',
      difficulty: 'intermediate',
    })),
    {
      observationTaskPlanId: 'task-choice-new',
      materialObservationPlanId: 'plan-supplemented',
      materialVersionId: 'material:supplement',
      materialTitle: '补充任务材料',
      title: '新增单选',
      abilityId: 'comprehension',
      taskRole: 'training',
      difficulty: 'basic',
    },
    {
      observationTaskPlanId: 'task-text-new',
      materialObservationPlanId: 'plan-supplemented',
      materialVersionId: 'material:supplement',
      materialTitle: '补充任务材料',
      title: '新增文本题',
      abilityId: 'comprehension',
      taskRole: 'training',
      difficulty: 'basic',
    },
  ],
  pendingReviews: [],
  incompletePublications: [],
  publishedResources: [
    ...['a', 'b', 'c'].map((suffix) => ({
      observationTaskPlanId: `task-${suffix}-published`,
      materialObservationPlanId: 'plan-before-supplement',
      materialVersionId: 'material:supplement',
      title: `既有题目 ${suffix}`,
      abilityId: 'analysis',
      taskRole: 'training',
    })),
    {
      observationTaskPlanId: 'task-choice-new',
      materialObservationPlanId: 'plan-supplemented',
      materialVersionId: 'material:supplement',
    },
  ],
} as never, ['material:supplement']);
check(
  '19 补充计划发布单选后只增加目标题且继承原三题',
  supplementedPlanProgress.taskCount === 5
    && supplementedPlanProgress.publishedTaskCount === 4
    && supplementedPlanProgress.pendingTaskCount === 1
    && supplementedPlanProgress.pendingMaterialIds.join(',') === 'material:supplement',
  `tasks=${supplementedPlanProgress.taskCount}, published=${supplementedPlanProgress.publishedTaskCount}, pending=${supplementedPlanProgress.pendingTaskCount}; task-a uses exact-stem compatibility repair`,
);
check(
  '20 正式版本仅在当前任务定义未变化时保持已发布',
  publishedResourceContentMatchesObservationTask({
    title: '母亲为什么挡在窗前？',
    abilityId: 'comprehension',
    taskRole: 'training',
    difficulty: 'basic',
    responseFormat: 'single_choice',
  } as never, {
    questionStem: '母亲为什么挡在窗前？',
    abilityId: 'comprehension',
    taskRole: 'training',
    difficulty: 'basic',
    responseFormat: 'single_choice',
  })
    && !publishedResourceContentMatchesObservationTask({
      title: '母亲为什么挡在窗前？',
      abilityId: 'comprehension',
      taskRole: 'training',
      difficulty: 'basic',
      responseFormat: 'single_choice',
    } as never, {
      questionStem: '母亲为什么挡在窗前？',
      abilityId: 'analysis',
      taskRole: 'training',
      difficulty: 'basic',
      responseFormat: 'long_text',
    }),
  'same definition remains published; changed ability/format requires a successor publication',
);
check(
  '21 卡片使用权威任务身份恢复补充计划前的正式资源',
  findPublishedResourceForObservationTask({
    materials: [],
    learningTasks: [{
      observationTaskPlanId: 'task-current',
      taskRevisionRootId: 'task-published',
      materialObservationPlanId: 'plan-current',
      materialVersionId: 'material:card',
      materialTitle: '卡片材料',
      title: '分析母亲挡在窗前的作用',
      questionStem: '分析母亲挡在窗前的作用',
      abilityId: 'analysis',
      taskRole: 'training',
      difficulty: 'intermediate',
    }],
    pendingReviews: [],
    incompletePublications: [],
    publishedResources: [{
      observationTaskPlanId: 'task-published',
      materialObservationPlanId: 'plan-before-supplement',
      materialVersionId: 'material:card',
      title: '分析母亲挡在窗前的作用',
      abilityId: 'analysis',
      taskRole: 'training',
    }],
  } as never, {
    observationTaskPlanId: 'editable-card-id',
    questionStem: '分析母亲挡在窗前的作用',
    abilityId: 'analysis',
    taskRole: 'training',
  })?.observationTaskPlanId === 'task-published',
  'editable card resolves through the canonical learning-task lineage',
);

const retiredProjection = selectUserRetiredMaterials([
  { materialId: 'material-a', materialVersionId: 'material-a:v1', versionNumber: 1, status: 'retired', title: '材料A', updatedAt: '2026-08-12T00:00:00.000Z' },
  { materialId: 'material-a', materialVersionId: 'material-a:v2', versionNumber: 2, status: 'active', title: '材料A', updatedAt: '2026-08-13T00:00:00.000Z' },
  { materialId: 'material-b', materialVersionId: 'material-b:v1', versionNumber: 1, status: 'retired', title: '材料B', updatedAt: '2026-08-11T00:00:00.000Z' },
  { materialId: 'material-b', materialVersionId: 'material-b:v2', versionNumber: 2, status: 'retired', title: '材料B', updatedAt: '2026-08-12T00:00:00.000Z' },
] as never);
check(
  '22 被新版替代的历史版本不计入停用素材',
  retiredProjection.length === 1 && retiredProjection[0]?.materialVersionId === 'material-b:v2',
  `retired=${retiredProjection.map((item) => item.materialVersionId).join(',')}`,
);

check(
  '23 历史评分项缺少描述时使用既有接受信号兼容补全',
  resolveEditableRubricDescription({
    name: '内容概括',
    acceptedSignals: ['新绿', '嫩芽', '生命'],
  }) === '观察是否包含：新绿、嫩芽、生命',
  'legacy published rubric can join a supplement revision without changing its judging facts',
);
check(
  '24 新版评分项的明确描述保持原样',
  resolveEditableRubricDescription({
    name: '内容概括',
    description: '学生能够概括春日景物共同呈现的生命感。',
    acceptedSignals: ['新绿'],
  }) === '学生能够概括春日景物共同呈现的生命感。',
  'explicit rubric description remains authoritative',
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
    frozenVersion: frozen ? {
      resourceVersionId: `${draftId}:frozen`,
      materialVersionId: 'material:v1',
    } : null,
    observationLink: linked ? {
      status: 'active',
      materialVersionId: 'material:v1',
      materialObservationPlanId: 'plan-v2',
    } : null,
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
