import {
  isPlanFullyPublished,
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

const taskA = { observationTaskPlanId: 'task-a' };
const taskB = { observationTaskPlanId: 'task-b' };
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
  materials: [{ materialVersionId: 'material:v1' }],
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
    link('link-a-v2', 'resource-a', 'resource-a:v2', 'active'),
    link('link-b-v1', 'resource-b', 'resource-b:v1', 'active'),
  ],
  anchors: [],
  validations: [],
  frozenVersions: [],
  draftReadiness: [],
};
const summary = summarizeMaterialResourceWorkbench(snapshot as never);
check(
  '04 顶部任务数只统计每篇素材的最新计划',
  summary.learningTaskCount === 2,
  `learningTaskCount=${summary.learningTaskCount}`,
);
check(
  '05 待审核与已发布按当前资源去重',
  summary.pendingReviewCount === 1 && summary.publishedResourceCount === 2,
  `pending=${summary.pendingReviewCount}, published=${summary.publishedResourceCount}`,
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
    resourceId,
    resourceVersionId,
    status,
  };
}
