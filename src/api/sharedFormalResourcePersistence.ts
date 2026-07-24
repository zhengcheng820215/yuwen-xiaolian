import { IndexedDBMaterialObservationRepository } from '../ai/repositories/indexedDBMaterialObservationRepository.ts';
import { IndexedDBQuestionResourceAdmissionRepository } from '../ai/repositories/indexedDBQuestionResourceAdmissionRepository.ts';
import { LocalApiFormalResourceClient } from '../ai/repositories/localApiFormalResourceClient.ts';
import type {
  SharedFormalResourceData,
  SharedFormalResourceStatus,
} from '../ai/schemas/sharedFormalResourcePersistence.schema.ts';

const client = new LocalApiFormalResourceClient();

export type LegacyFormalResourceBaseline = {
  source: string;
  exportedAt: string;
  data: SharedFormalResourceData;
  counts: {
    materials: number;
    plans: number;
    drafts: number;
    frozenVersions: number;
    registryEntries: number;
    observationLinks: number;
  };
};

export async function getSharedFormalResourceStatus(): Promise<SharedFormalResourceStatus> {
  return (await client.read()).status;
}

export async function exportCurrentBrowserFormalResourceBaseline(
  source = describeCurrentBrowserSource(),
): Promise<LegacyFormalResourceBaseline> {
  const questionRepository = new IndexedDBQuestionResourceAdmissionRepository();
  const observationRepository = new IndexedDBMaterialObservationRepository();
  const [questionResources, materialObservations] = await Promise.all([
    questionRepository.exportSharedState(),
    observationRepository.exportSharedState(),
  ]);
  return {
    source,
    exportedAt: new Date().toISOString(),
    data: { questionResources, materialObservations },
    counts: {
      materials: questionResources.materials.length,
      plans: materialObservations.plans.length,
      drafts: questionResources.drafts.length,
      frozenVersions: questionResources.versions.length,
      registryEntries: questionResources.registryEntries.length,
      observationLinks: materialObservations.links.length,
    },
  };
}

export async function initializeSharedFormalResourceBaseline(
  baseline: LegacyFormalResourceBaseline,
): Promise<SharedFormalResourceStatus> {
  assertBaselineIdentityIntegrity(baseline.data);
  const result = await client.initialize(
    baseline.data,
    `${baseline.source} @ ${baseline.exportedAt}`,
  );
  return result.status;
}

export function downloadFormalResourceBaseline(
  baseline: LegacyFormalResourceBaseline,
): void {
  const blob = new Blob([`${JSON.stringify(baseline, null, 2)}\n`], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `formal-resource-baseline-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function assertBaselineIdentityIntegrity(data: SharedFormalResourceData): void {
  assertUniqueIdentity(data.questionResources.materials, 'materialVersionId');
  assertUniqueIdentity(data.questionResources.drafts, 'draftId');
  assertUniqueIdentity(data.questionResources.validations, 'validationId');
  assertUniqueIdentity(data.questionResources.reviews, 'reviewId');
  assertUniqueIdentity(data.questionResources.versions, 'resourceVersionId');
  assertUniqueIdentity(data.questionResources.registryEntries, 'resourceId');
  assertUniqueIdentity(data.materialObservations.structures, 'materialStructureSnapshotId');
  assertUniqueIdentity(data.materialObservations.anchors, 'sourceAnchorId');
  assertUniqueIdentity(data.materialObservations.plans, 'materialObservationPlanId');
  assertUniqueIdentity(data.materialObservations.validations, 'validationId');
  assertUniqueIdentity(data.materialObservations.reviews, 'reviewId');
  assertUniqueIdentity(data.materialObservations.links, 'resourceObservationLinkId');
  assertUniqueIdentity(data.materialObservations.manifests, 'resourcePackId');
}

function assertUniqueIdentity<T extends object>(values: T[], key: keyof T): void {
  const seen = new Map<unknown, string>();
  for (const value of values) {
    const id = value[key];
    const serialized = JSON.stringify(value);
    const existing = seen.get(id);
    if (existing && existing !== serialized) {
      throw new Error(`同一 ID 存在不同内容，基线导入已阻断：${String(id)}`);
    }
    seen.set(id, serialized);
  }
}

function describeCurrentBrowserSource(): string {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'unknown-browser';
  return `${navigator.userAgent} | ${window.location.origin}`;
}

