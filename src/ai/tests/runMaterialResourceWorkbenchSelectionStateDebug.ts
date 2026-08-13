import {
  clearMaterialWorkbenchSelection,
  readMaterialWorkbenchSelection,
  resolveMaterialPlanSelection,
  resolveMaterialWorkbenchSelection,
  shouldOpenExistingMaterialMode,
  writeMaterialWorkbenchSelection,
} from '../../pages/materialResourceWorkbenchSelectionState.ts';

type CaseResult = {
  name: string;
  passed: boolean;
  detail: string;
};

const cases: CaseResult[] = [];
const materials = [
  { materialVersionId: 'material-a:v1', status: 'active' },
  { materialVersionId: 'material-b:v1', status: 'active' },
  { materialVersionId: 'material-retired:v1', status: 'retired' },
];
const plans = [
  { materialObservationPlanId: 'plan-a', materialVersionId: 'material-a:v1' },
  { materialObservationPlanId: 'plan-b', materialVersionId: 'material-b:v1' },
];

check(
  '01 URL 素材优先于当前状态和会话记忆',
  resolveMaterialWorkbenchSelection({
    materials,
    plans,
    preferred: { materialVersionId: 'material-b:v1', planId: 'plan-b' },
    current: { materialVersionId: 'material-a:v1', planId: 'plan-a' },
    remembered: { materialVersionId: 'material-a:v1', planId: 'plan-a' },
  }).materialVersionId === 'material-b:v1',
  'preferred material should win',
);

check(
  '02 当前组件选择优先于会话记忆',
  resolveMaterialWorkbenchSelection({
    materials,
    plans,
    current: { materialVersionId: 'material-b:v1', planId: 'plan-b' },
    remembered: { materialVersionId: 'material-a:v1', planId: 'plan-a' },
  }).materialVersionId === 'material-b:v1',
  'current material should win',
);

check(
  '03 重新进入页面时恢复会话素材',
  resolveMaterialWorkbenchSelection({
    materials,
    plans,
    remembered: { materialVersionId: 'material-a:v1', planId: 'plan-a' },
  }).materialVersionId === 'material-a:v1',
  'remembered material should be restored',
);

check(
  '04 已停用素材不会从会话恢复',
  resolveMaterialWorkbenchSelection({
    materials,
    plans,
    remembered: { materialVersionId: 'material-retired:v1', planId: '' },
  }).materialVersionId === '',
  'retired material should be rejected',
);

const fallbackPlan = resolveMaterialWorkbenchSelection({
  materials,
  plans,
  remembered: { materialVersionId: 'material-a:v1', planId: 'stale-plan' },
});
check(
  '05 失效 Plan 自动回落到当前素材有效 Plan',
  fallbackPlan.planId === 'plan-a',
  `planId=${fallbackPlan.planId}`,
);

const memoryStorage = createMemoryStorage();
writeMaterialWorkbenchSelection(
  { materialVersionId: 'material-a:v1', planId: 'plan-a' },
  memoryStorage,
);
check(
  '06 会话选择可写入并读取',
  readMaterialWorkbenchSelection(memoryStorage)?.planId === 'plan-a',
  'selection should round-trip',
);
clearMaterialWorkbenchSelection(memoryStorage);
check(
  '07 清除后不再恢复会话选择',
  readMaterialWorkbenchSelection(memoryStorage) === null,
  'selection should be cleared',
);

check(
  '08 首次恢复有效素材时自动进入已有素材',
  shouldOpenExistingMaterialMode({
    isInitialResolution: true,
    resolvedMaterialVersionId: 'material-a:v1',
  }),
  'initial remembered selection should open existing mode',
);

check(
  '09 后续普通刷新不强制离开素材录入页卡',
  !shouldOpenExistingMaterialMode({
    isInitialResolution: false,
    resolvedMaterialVersionId: 'material-a:v1',
  }),
  'non-initial refresh should preserve the visible mode',
);

check(
  '10 material switch always enters the canonical first plan',
  resolveMaterialPlanSelection({
    materialVersionId: 'material-a:v1',
    plans: [
      { materialObservationPlanId: 'plan-a-published', materialVersionId: 'material-a:v1', revision: 1, updatedAt: '2026-08-13T12:00:00.000Z' },
      { materialObservationPlanId: 'plan-a-newer', materialVersionId: 'material-a:v1', revision: 2, updatedAt: '2026-08-12T12:00:00.000Z' },
    ],
    rememberedPlanId: 'plan-a-published',
    routeMaterialVersionId: 'material-a:v1',
    routePlanId: 'plan-a-published',
  }) === 'plan-a-newer',
  'canonical plan must win over remembered or route history',
);

check(
  '11 route plan cannot leak into another material',
  resolveMaterialPlanSelection({
    materialVersionId: 'material-b:v1',
    plans: [
      { materialObservationPlanId: 'plan-b', materialVersionId: 'material-b:v1' },
    ],
    routeMaterialVersionId: 'material-a:v1',
    routePlanId: 'plan-a',
  }) === 'plan-b',
  'route plan from another material must not leak into selection',
);

const failures = cases.filter((item) => !item.passed);
for (const item of cases) {
  console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.name} — ${item.detail}`);
}
if (failures.length) {
  throw new Error(`${failures.length} material workbench selection checks failed.`);
}
console.log(`Material workbench selection debug: ${cases.length}/${cases.length} PASS`);

function check(name: string, passed: boolean, detail: string): void {
  cases.push({ name, passed, detail });
}

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) || null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}
