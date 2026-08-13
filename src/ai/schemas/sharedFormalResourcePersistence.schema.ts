import type {
  FirstFrozenResourcePackManifest,
  MaterialObservationPlan,
  MaterialObservationPlanValidation,
  MaterialObservationReviewDecision,
  MaterialSourceAnchor,
  MaterialStructureSnapshot,
  ResourceObservationLink,
} from './materialObservation.schema.ts';
import type {
  FrozenQuestionResourceVersion,
  QuestionMaterialVersion,
  ResourceRegistryEntry,
  ResourceReviewDecision,
  ResourceValidationResult,
  StructuredQuestionDraft,
} from './questionResourceAdmission.schema.ts';
import {
  createEmptySharedQuestionQualityState,
  type SharedQuestionQualityState,
} from './questionQualityPersistence.schema.ts';

export const LEGACY_SHARED_FORMAL_RESOURCE_SCHEMA_VERSION = '17.4A-v1' as const;
export const SHARED_FORMAL_RESOURCE_SCHEMA_VERSION = '17.5C-v1' as const;

export type SharedQuestionResourceState = {
  materials: QuestionMaterialVersion[];
  drafts: StructuredQuestionDraft[];
  validations: ResourceValidationResult[];
  reviews: ResourceReviewDecision[];
  versions: FrozenQuestionResourceVersion[];
  registryEntries: ResourceRegistryEntry[];
};

export type SharedMaterialObservationState = {
  structures: MaterialStructureSnapshot[];
  anchors: MaterialSourceAnchor[];
  plans: MaterialObservationPlan[];
  validations: MaterialObservationPlanValidation[];
  reviews: MaterialObservationReviewDecision[];
  links: ResourceObservationLink[];
  manifests: FirstFrozenResourcePackManifest[];
};

export type SharedFormalResourceData = {
  questionResources: SharedQuestionResourceState;
  materialObservations: SharedMaterialObservationState;
  questionQuality: SharedQuestionQualityState;
};

export type SharedFormalResourceSnapshot = {
  schemaVersion: typeof SHARED_FORMAL_RESOURCE_SCHEMA_VERSION;
  initialized: boolean;
  revision: number;
  baselineSource?: string;
  createdAt: string;
  updatedAt: string;
  commandReceipts?: Array<{
    commandId: string;
    fingerprint: string;
    committedRevision: number;
  }>;
  data: SharedFormalResourceData;
};

export type SharedFormalResourceStatus = {
  initialized: boolean;
  revision: number;
  baselineSource?: string;
  updatedAt: string;
  storePath?: string;
  backupAvailable: boolean;
};

export function createEmptySharedFormalResourceData(): SharedFormalResourceData {
  return {
    questionResources: {
      materials: [],
      drafts: [],
      validations: [],
      reviews: [],
      versions: [],
      registryEntries: [],
    },
    materialObservations: {
      structures: [],
      anchors: [],
      plans: [],
      validations: [],
      reviews: [],
      links: [],
      manifests: [],
    },
    questionQuality: createEmptySharedQuestionQualityState(),
  };
}

export function cloneSharedFormalResourceValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
