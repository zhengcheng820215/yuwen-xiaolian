import {
  cloneSharedFormalResourceValue,
  type SharedFormalResourceData,
} from '../schemas/sharedFormalResourcePersistence.schema.ts';
import type { MaterialObservationPlan } from '../schemas/materialObservation.schema.ts';

export type MaterialCorpusIssue = {
  code:
    | 'metadata_missing'
    | 'provenance_unverified'
    | 'cjk_internal_spacing'
    | 'fullwidth_latin'
    | 'halfwidth_chinese_punctuation'
    | 'unbalanced_quotes'
    | 'question_semantic_overlap';
  severity: 'warning' | 'review' | 'information';
  materialVersionId: string;
  materialTitle: string;
  field: 'metadata' | 'source' | 'content' | 'question';
  detail: string;
};

export type MaterialCorpusMaintenanceReport = {
  activeMaterialCount: number;
  currentTaskCount: number;
  issues: MaterialCorpusIssue[];
  supersededLinkIds: string[];
  retiredRegistryEntryIds: string[];
  archivedDraftIds: string[];
};

export function auditAndPrepareMaterialCorpusMaintenance(
  source: SharedFormalResourceData,
  now: string,
): { data: SharedFormalResourceData; report: MaterialCorpusMaintenanceReport } {
  const data = cloneSharedFormalResourceValue(source);
  const activeMaterials = data.questionResources.materials
    .filter((material) => material.status !== 'retired');
  const activeMaterialIds = new Set(activeMaterials.map((material) => material.materialVersionId));
  const currentPlans = selectCurrentPlans(data.materialObservations.plans, activeMaterialIds);
  const taskIdentitiesByMaterial = new Map<string, Set<string>>();
  for (const plan of currentPlans.values()) {
    taskIdentitiesByMaterial.set(plan.materialVersionId, new Set(plan.taskPlans.flatMap((task) => [
      task.observationTaskPlanId,
      task.taskRevisionRootId,
      task.parentObservationTaskPlanId,
    ].filter((value): value is string => Boolean(value)))));
  }

  const issues = activeMaterials.flatMap((material) => auditMaterial(material));
  const supersededLinkIds: string[] = [];
  data.materialObservations.links = data.materialObservations.links.map((link) => {
    if (link.status !== 'active' || !activeMaterialIds.has(link.materialVersionId)) return link;
    const currentTaskIds = taskIdentitiesByMaterial.get(link.materialVersionId);
    if (!currentTaskIds || currentTaskIds.has(link.observationTaskPlanId)) return link;
    supersededLinkIds.push(link.resourceObservationLinkId);
    return { ...link, status: 'superseded' };
  });

  const activeMaterialByLogicalId = new Map(activeMaterials.map((material) => [
    material.materialId,
    material,
  ]));
  const knownMaterialIds = new Set(data.questionResources.materials.map((material) => material.materialId));
  const versionsById = new Map(data.questionResources.versions.map((version) => [
    version.resourceVersionId,
    version,
  ]));
  const retiredRegistryEntryIds: string[] = [];
  data.questionResources.registryEntries = data.questionResources.registryEntries.map((entry) => {
    if (entry.status !== 'active' || !entry.currentFrozenVersionId || !entry.materialId) return entry;
    const activeMaterial = activeMaterialByLogicalId.get(entry.materialId);
    const currentVersion = versionsById.get(entry.currentFrozenVersionId);
    if (!currentVersion?.materialVersionId) return entry;
    const belongsToRetiredMaterial = !activeMaterial && knownMaterialIds.has(entry.materialId);
    const pointsToHistoricalVersion = Boolean(
      activeMaterial && currentVersion.materialVersionId !== activeMaterial.materialVersionId,
    );
    if (!belongsToRetiredMaterial && !pointsToHistoricalVersion) {
      return entry;
    }
    retiredRegistryEntryIds.push(entry.resourceId);
    return {
      ...entry,
      status: 'retired',
      updatedAt: now,
    };
  });

  const frozenSourceDraftIds = new Set(data.questionResources.versions
    .map((version) => version.sourceDraftId));
  const archivedDraftIds: string[] = [];
  data.questionResources.drafts = data.questionResources.drafts.map((draft) => {
    if (
      draft.status === 'archived' ||
      !draft.materialVersionId ||
      !activeMaterialIds.has(draft.materialVersionId) ||
      frozenSourceDraftIds.has(draft.draftId)
    ) {
      return draft;
    }
    const currentTaskIds = taskIdentitiesByMaterial.get(draft.materialVersionId);
    const draftTaskIds = [
      draft.taskId,
      ...draft.tags
        .filter((tag) => tag.startsWith('observation_task:'))
        .map((tag) => tag.slice('observation_task:'.length)),
      ...draft.tags
        .filter((tag) => tag.startsWith('observation_task_root:'))
        .map((tag) => tag.slice('observation_task_root:'.length)),
    ];
    if (!currentTaskIds || draftTaskIds.some((taskId) => currentTaskIds.has(taskId))) return draft;
    archivedDraftIds.push(draft.draftId);
    return {
      ...draft,
      status: 'archived',
      revision: draft.revision + 1,
      updatedAt: now,
    };
  });

  issues.push(...auditCurrentQuestionOverlap(data, currentPlans));
  return {
    data,
    report: {
      activeMaterialCount: activeMaterials.length,
      currentTaskCount: [...currentPlans.values()]
        .reduce((total, plan) => total + plan.taskPlans.length, 0),
      issues,
      supersededLinkIds: supersededLinkIds.sort(),
      retiredRegistryEntryIds: retiredRegistryEntryIds.sort(),
      archivedDraftIds: archivedDraftIds.sort(),
    },
  };
}

function selectCurrentPlans(
  plans: MaterialObservationPlan[],
  activeMaterialIds: Set<string>,
): Map<string, MaterialObservationPlan> {
  const selected = new Map<string, MaterialObservationPlan>();
  for (const plan of plans) {
    if (!activeMaterialIds.has(plan.materialVersionId)) continue;
    const current = selected.get(plan.materialVersionId);
    if (
      !current ||
      plan.revision > current.revision ||
      (plan.revision === current.revision && plan.updatedAt > current.updatedAt)
    ) {
      selected.set(plan.materialVersionId, plan);
    }
  }
  return selected;
}

function auditMaterial(
  material: SharedFormalResourceData['questionResources']['materials'][number],
): MaterialCorpusIssue[] {
  const issues: MaterialCorpusIssue[] = [];
  const add = (
    code: MaterialCorpusIssue['code'],
    field: MaterialCorpusIssue['field'],
    detail: string,
    severity: MaterialCorpusIssue['severity'] = 'warning',
  ) => issues.push({
    code,
    field,
    detail,
    severity,
    materialVersionId: material.materialVersionId,
    materialTitle: material.title,
  });
  if (!material.metadata) add('metadata_missing', 'metadata', '缺少作者、体裁、年级和来源核验状态。', 'review');
  else if (material.metadata.provenanceStatus !== 'verified') {
    add(
      'provenance_unverified',
      'source',
      `来源状态为 ${material.metadata.provenanceStatus}；仅作为后台治理信息，不阻断题目生产或学习。`,
      'information',
    );
  }
  const internalSpaces = material.content.match(/[\u3400-\u9fff][ \t]+[\u3400-\u9fff]/g)?.length || 0;
  if (internalSpaces > 0) add('cjk_internal_spacing', 'content', `发现 ${internalSpaces} 处中文字符间异常空格。`);
  const fullwidthLatin = material.content.match(/[Ａ-Ｚａ-ｚ]/g)?.length || 0;
  if (fullwidthLatin > 0) add('fullwidth_latin', 'content', `发现 ${fullwidthLatin} 个全角拉丁字符。`);
  const halfwidthPunctuation = material.content.match(/[\u3400-\u9fff][?!,:;]/g)?.length || 0;
  if (halfwidthPunctuation > 0) add('halfwidth_chinese_punctuation', 'content', `发现 ${halfwidthPunctuation} 处半角中文标点。`);
  const openingQuotes = material.content.match(/[“]/g)?.length || 0;
  const closingQuotes = material.content.match(/[”]/g)?.length || 0;
  if (openingQuotes !== closingQuotes) {
    add('unbalanced_quotes', 'content', `中文双引号数量不匹配：左 ${openingQuotes}，右 ${closingQuotes}。`, 'review');
  }
  return issues;
}

function auditCurrentQuestionOverlap(
  data: SharedFormalResourceData,
  currentPlans: Map<string, MaterialObservationPlan>,
): MaterialCorpusIssue[] {
  const materials = new Map(data.questionResources.materials
    .map((material) => [material.materialVersionId, material]));
  const versions = new Map(data.questionResources.versions
    .map((version) => [version.resourceVersionId, version]));
  const activeLinks = data.materialObservations.links.filter((link) => link.status === 'active');
  const issues: MaterialCorpusIssue[] = [];
  for (const plan of currentPlans.values()) {
    const taskIds = new Set(plan.taskPlans.flatMap((task) => [
      task.observationTaskPlanId,
      task.taskRevisionRootId,
      task.parentObservationTaskPlanId,
    ].filter((value): value is string => Boolean(value))));
    const stems = activeLinks
      .filter((link) => (
        link.materialVersionId === plan.materialVersionId &&
        taskIds.has(link.observationTaskPlanId)
      ))
      .map((link) => versions.get(link.resourceVersionId)?.questionStem || '')
      .filter(Boolean);
    for (let left = 0; left < stems.length; left += 1) {
      for (let right = left + 1; right < stems.length; right += 1) {
        const overlap = bigramSimilarity(stems[left], stems[right]);
        if (overlap < 0.58) continue;
        const material = materials.get(plan.materialVersionId);
        issues.push({
          code: 'question_semantic_overlap',
          severity: 'review',
          materialVersionId: plan.materialVersionId,
          materialTitle: material?.title || plan.materialId,
          field: 'question',
          detail: `当前正式题目 ${left + 1} 与 ${right + 1} 的文本重合度为 ${Math.round(overlap * 100)}%，需要检查回答对象和评分目标。`,
        });
      }
    }
  }
  return issues;
}

function bigramSimilarity(left: string, right: string): number {
  const grams = (value: string) => {
    const normalized = value.replace(/[\s，。！？；：“”‘’（）《》、]/g, '');
    return new Set(Array.from({ length: Math.max(0, normalized.length - 1) }, (_, index) => (
      normalized.slice(index, index + 2)
    )));
  };
  const leftGrams = grams(left);
  const rightGrams = grams(right);
  if (leftGrams.size === 0 || rightGrams.size === 0) return 0;
  const intersection = [...leftGrams].filter((gram) => rightGrams.has(gram)).length;
  return intersection / (leftGrams.size + rightGrams.size - intersection);
}
