export const MATERIAL_WORKBENCH_SELECTION_SESSION_KEY = 'material-resource-workbench:selection:v1';

export type MaterialWorkbenchSelection = {
  materialVersionId: string;
  planId: string;
};

type SessionStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type MaterialOption = {
  materialVersionId: string;
  status?: string;
};

type PlanOption = {
  materialObservationPlanId: string;
  materialVersionId: string;
  revision?: number;
  updatedAt?: string;
};

export function resolveMaterialPlanSelection(input: {
  materialVersionId: string;
  plans: PlanOption[];
  rememberedPlanId?: string;
  routeMaterialVersionId?: string;
  routePlanId?: string;
}): string {
  const matchingPlans = input.plans.filter(
    (plan) => plan.materialVersionId === input.materialVersionId,
  );
  const matchingPlanIds = new Set(
    matchingPlans.map((plan) => plan.materialObservationPlanId),
  );
  const canonicalPlanId = selectCanonicalPlanId(matchingPlans);
  const routePlanId = input.routeMaterialVersionId === input.materialVersionId
    ? input.routePlanId
    : '';
  return [
    canonicalPlanId,
    input.rememberedPlanId,
    routePlanId,
  ].find((candidate) => Boolean(candidate && matchingPlanIds.has(candidate))) || '';
}

export function resolveMaterialWorkbenchSelection(input: {
  materials: MaterialOption[];
  plans: PlanOption[];
  preferred?: Partial<MaterialWorkbenchSelection>;
  current?: Partial<MaterialWorkbenchSelection>;
  remembered?: Partial<MaterialWorkbenchSelection> | null;
}): MaterialWorkbenchSelection {
  const activeMaterialIds = new Set(
    input.materials
      .filter((material) => material.status !== 'retired')
      .map((material) => material.materialVersionId),
  );
  const materialVersionId = [
    input.preferred?.materialVersionId,
    input.current?.materialVersionId,
    input.remembered?.materialVersionId,
  ].find((candidate) => Boolean(candidate && activeMaterialIds.has(candidate))) || '';
  const matchingPlans = input.plans.filter((plan) => plan.materialVersionId === materialVersionId);
  const matchingPlanIds = new Set(matchingPlans.map((plan) => plan.materialObservationPlanId));
  const planId = [
    selectCanonicalPlanId(matchingPlans),
    input.preferred?.planId,
    input.current?.planId,
    input.remembered?.planId,
  ].find((candidate) => Boolean(candidate && matchingPlanIds.has(candidate))) || '';

  return { materialVersionId, planId };
}

function selectCanonicalPlanId(plans: PlanOption[]): string {
  return [...plans]
    .sort((left, right) => (
      (right.revision || 0) - (left.revision || 0)
      || (right.updatedAt || '').localeCompare(left.updatedAt || '')
    ))[0]?.materialObservationPlanId || '';
}

export function shouldOpenExistingMaterialMode(input: {
  isInitialResolution: boolean;
  preferredMaterialVersionId?: string;
  resolvedMaterialVersionId: string;
}): boolean {
  if (!input.resolvedMaterialVersionId) return false;
  return input.isInitialResolution
    || input.preferredMaterialVersionId === input.resolvedMaterialVersionId;
}

export function readMaterialWorkbenchSelection(
  storage = getBrowserSessionStorage(),
): MaterialWorkbenchSelection | null {
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(MATERIAL_WORKBENCH_SELECTION_SESSION_KEY) || 'null');
    if (!parsed || typeof parsed.materialVersionId !== 'string') return null;
    return {
      materialVersionId: parsed.materialVersionId,
      planId: typeof parsed.planId === 'string' ? parsed.planId : '',
    };
  } catch {
    storage.removeItem(MATERIAL_WORKBENCH_SELECTION_SESSION_KEY);
    return null;
  }
}

export function writeMaterialWorkbenchSelection(
  selection: MaterialWorkbenchSelection,
  storage = getBrowserSessionStorage(),
): void {
  if (!storage) return;
  if (!selection.materialVersionId) {
    storage.removeItem(MATERIAL_WORKBENCH_SELECTION_SESSION_KEY);
    return;
  }
  storage.setItem(MATERIAL_WORKBENCH_SELECTION_SESSION_KEY, JSON.stringify(selection));
}

export function clearMaterialWorkbenchSelection(
  storage = getBrowserSessionStorage(),
): void {
  storage?.removeItem(MATERIAL_WORKBENCH_SELECTION_SESSION_KEY);
}

function getBrowserSessionStorage(): SessionStorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
