import type { QuestionResourceAdmissionRepository } from './questionResourceAdmissionRepository.ts';
import { LocalApiFormalResourceClient } from './localApiFormalResourceClient.ts';
import {
  cloneQuestionResourceValue,
  type FrozenQuestionResourceVersion,
  type QuestionMaterialVersion,
  type ResourceFreezeCommit,
  type ResourceFreezeResult,
  type ResourceRegistryEntry,
  type ResourceReviewDecision,
  type ResourceValidationResult,
  type StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';

export class LocalApiQuestionResourceAdmissionRepository
implements QuestionResourceAdmissionRepository {
  private readonly client: LocalApiFormalResourceClient;

  constructor(client = new LocalApiFormalResourceClient()) {
    this.client = client;
  }

  async saveMaterial(material: QuestionMaterialVersion): Promise<QuestionMaterialVersion> {
    const envelope = await this.client.read();
    const existing = envelope.snapshot.data.questionResources.materials
      .find((item) => item.materialVersionId === material.materialVersionId);
    if (existing) {
      if (!sameMaterialVersion(existing, material)) {
        throw new Error('Material Version is immutable. Create a new version.');
      }
      return clone(existing);
    }
    return this.client.mutate((data) => {
      data.questionResources.materials.push(clone(material));
      return material;
    });
  }

  async getMaterial(materialVersionId: string): Promise<QuestionMaterialVersion | null> {
    const state = (await this.client.read()).snapshot.data.questionResources;
    return cloneNullable(state.materials.find((item) => item.materialVersionId === materialVersionId));
  }

  async listMaterials(): Promise<QuestionMaterialVersion[]> {
    return (await this.client.read()).snapshot.data.questionResources.materials
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(clone);
  }

  async setMaterialStatus(
    materialVersionId: string,
    status: 'active' | 'retired',
  ): Promise<QuestionMaterialVersion> {
    return this.client.mutate((data) => {
      const index = data.questionResources.materials
        .findIndex((item) => item.materialVersionId === materialVersionId);
      if (index < 0) throw new Error(`Material not found: ${materialVersionId}`);
      const updated = {
        ...data.questionResources.materials[index],
        status,
      };
      data.questionResources.materials[index] = updated;
      return updated;
    });
  }

  async deleteMaterial(materialVersionId: string): Promise<void> {
    await this.client.mutate((data) => {
      const before = data.questionResources.materials.length;
      data.questionResources.materials = data.questionResources.materials
        .filter((item) => item.materialVersionId !== materialVersionId);
      if (before === data.questionResources.materials.length) {
        throw new Error(`Material not found: ${materialVersionId}`);
      }
      return null;
    });
  }

  async saveDraft(draft: StructuredQuestionDraft): Promise<StructuredQuestionDraft> {
    return this.client.mutate((data) => {
      const collection = data.questionResources.drafts;
      const index = collection.findIndex((item) => item.draftId === draft.draftId);
      if (index >= 0) assertDraftRevision(collection[index], draft);
      upsert(collection, 'draftId', draft);
      return draft;
    });
  }

  async getDraft(draftId: string): Promise<StructuredQuestionDraft | null> {
    const state = (await this.client.read()).snapshot.data.questionResources;
    return cloneNullable(state.drafts.find((item) => item.draftId === draftId));
  }

  async listDrafts(): Promise<StructuredQuestionDraft[]> {
    return (await this.client.read()).snapshot.data.questionResources.drafts.map(clone);
  }

  async deleteDraft(draftId: string): Promise<void> {
    await this.client.mutate((data) => {
      const before = data.questionResources.drafts.length;
      data.questionResources.drafts = data.questionResources.drafts
        .filter((item) => item.draftId !== draftId);
      if (before === data.questionResources.drafts.length) {
        throw new Error(`Draft not found: ${draftId}`);
      }
      data.questionResources.validations = data.questionResources.validations
        .filter((item) => item.draftId !== draftId);
      data.questionResources.reviews = data.questionResources.reviews
        .filter((item) => item.draftId !== draftId);
      return null;
    });
  }

  async saveValidation(result: ResourceValidationResult): Promise<ResourceValidationResult> {
    return this.saveImmutable('validations', 'validationId', result);
  }

  async getValidation(validationId: string): Promise<ResourceValidationResult | null> {
    const state = (await this.client.read()).snapshot.data.questionResources;
    return cloneNullable(state.validations.find((item) => item.validationId === validationId));
  }

  async saveReview(decision: ResourceReviewDecision): Promise<ResourceReviewDecision> {
    return this.saveImmutable('reviews', 'reviewId', decision);
  }

  async getReview(reviewId: string): Promise<ResourceReviewDecision | null> {
    const state = (await this.client.read()).snapshot.data.questionResources;
    return cloneNullable(state.reviews.find((item) => item.reviewId === reviewId));
  }

  async listReviews(resourceId?: string): Promise<ResourceReviewDecision[]> {
    return (await this.client.read()).snapshot.data.questionResources.reviews
      .filter((review) => !resourceId || review.resourceId === resourceId)
      .sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt))
      .map(clone);
  }

  async getVersion(resourceVersionId: string): Promise<FrozenQuestionResourceVersion | null> {
    const state = (await this.client.read()).snapshot.data.questionResources;
    return cloneNullable(state.versions.find((item) => item.resourceVersionId === resourceVersionId));
  }

  async getVersionByDraftId(draftId: string): Promise<FrozenQuestionResourceVersion | null> {
    const state = (await this.client.read()).snapshot.data.questionResources;
    return cloneNullable(state.versions.find((item) => item.sourceDraftId === draftId));
  }

  async listVersions(resourceId?: string): Promise<FrozenQuestionResourceVersion[]> {
    return (await this.client.read()).snapshot.data.questionResources.versions
      .filter((version) => !resourceId || version.resourceId === resourceId)
      .sort((a, b) => a.versionNumber - b.versionNumber)
      .map(clone);
  }

  async getRegistryEntry(resourceId: string): Promise<ResourceRegistryEntry | null> {
    const state = (await this.client.read()).snapshot.data.questionResources;
    return cloneNullable(state.registryEntries.find((item) => item.resourceId === resourceId));
  }

  async listRegistryEntries(): Promise<ResourceRegistryEntry[]> {
    return (await this.client.read()).snapshot.data.questionResources.registryEntries.map(clone);
  }

  async saveRegistryEntry(entry: ResourceRegistryEntry): Promise<ResourceRegistryEntry> {
    return this.client.mutate((data) => {
      upsert(data.questionResources.registryEntries, 'resourceId', entry);
      return entry;
    });
  }

  async replaceRegistry(entries: ResourceRegistryEntry[]): Promise<void> {
    await this.client.mutate((data) => {
      data.questionResources.registryEntries = entries.map(clone);
      return null;
    });
  }

  async commitFreeze(commit: ResourceFreezeCommit): Promise<ResourceFreezeResult> {
    const envelope = await this.client.read();
    const existing = envelope.snapshot.data.questionResources.versions
      .find((item) => item.sourceDraftId === commit.version.sourceDraftId);
    if (existing) {
      const registryEntry = envelope.snapshot.data.questionResources.registryEntries
        .find((item) => item.resourceId === existing.resourceId);
      if (!registryEntry) throw new Error('Frozen version exists without a registry entry.');
      return { version: clone(existing), registryEntry: clone(registryEntry), inserted: false };
    }

    return this.client.mutate((data) => {
      const state = data.questionResources;
      if (state.versions.some((item) => item.resourceVersionId === commit.version.resourceVersionId)) {
        throw new Error(`Resource version already exists: ${commit.version.resourceVersionId}`);
      }
      const previousIndex = commit.previousVersionId
        ? state.versions.findIndex((item) => item.resourceVersionId === commit.previousVersionId)
        : -1;
      if (commit.previousVersionId && previousIndex < 0) {
        throw new Error(`Previous frozen version not found: ${commit.previousVersionId}`);
      }
      state.versions.push(clone(commit.version));
      upsert(state.registryEntries, 'resourceId', commit.registryEntry);
      if (previousIndex >= 0) {
        state.versions[previousIndex] = {
          ...state.versions[previousIndex],
          status: 'superseded',
          updatedAt: commit.version.frozenAt,
        };
      }
      return {
        version: commit.version,
        registryEntry: commit.registryEntry,
        inserted: true,
      };
    });
  }

  async clear(): Promise<void> {
    throw new Error('Shared formal resource store cannot be cleared from the workbench.');
  }

  private async saveImmutable<
    K extends 'validations' | 'reviews',
    T extends ResourceValidationResult | ResourceReviewDecision,
  >(collectionName: K, key: keyof T, value: T): Promise<T> {
    const envelope = await this.client.read();
    const collection = envelope.snapshot.data.questionResources[collectionName] as T[];
    const existing = collection.find((item) => item[key] === value[key]);
    if (existing) {
      if (!same(existing, value)) throw new Error(`Immutable record conflict: ${String(value[key])}`);
      return clone(existing);
    }
    return this.client.mutate((data) => {
      (data.questionResources[collectionName] as T[]).push(clone(value));
      return value;
    });
  }
}

function assertDraftRevision(existing: StructuredQuestionDraft, incoming: StructuredQuestionDraft): void {
  if (same(existing, incoming)) return;
  if (incoming.revision < existing.revision) {
    throw new Error(`Draft revision conflict: ${incoming.draftId}`);
  }
  if (
    incoming.revision === existing.revision &&
    !sameDraftEducationalContent(existing, incoming)
  ) {
    throw new Error(`Draft revision conflict: ${incoming.draftId}`);
  }
}

function sameDraftEducationalContent(
  left: StructuredQuestionDraft,
  right: StructuredQuestionDraft,
): boolean {
  const {
    status: _leftStatus,
    latestValidationId: _leftValidation,
    latestReviewId: _leftReview,
    reviewSubmittedAt: _leftReviewSubmittedAt,
    reviewSubmittedBy: _leftReviewSubmittedBy,
    reviewSubmissionCount: _leftReviewSubmissionCount,
    reviewSubmissionHistory: _leftReviewSubmissionHistory,
    warningAcknowledgements: _leftWarningAcknowledgements,
    revisionRequestedAt: _leftRevisionRequestedAt,
    revisionRequestCount: _leftRevisionRequestCount,
    updatedAt: _leftUpdatedAt,
    ...leftContent
  } = left;
  const {
    status: _rightStatus,
    latestValidationId: _rightValidation,
    latestReviewId: _rightReview,
    reviewSubmittedAt: _rightReviewSubmittedAt,
    reviewSubmittedBy: _rightReviewSubmittedBy,
    reviewSubmissionCount: _rightReviewSubmissionCount,
    reviewSubmissionHistory: _rightReviewSubmissionHistory,
    warningAcknowledgements: _rightWarningAcknowledgements,
    revisionRequestedAt: _rightRevisionRequestedAt,
    revisionRequestCount: _rightRevisionRequestCount,
    updatedAt: _rightUpdatedAt,
    ...rightContent
  } = right;
  return same(leftContent, rightContent);
}

function sameMaterialVersion(left: QuestionMaterialVersion, right: QuestionMaterialVersion): boolean {
  const { status: _leftStatus, ...leftValue } = left;
  const { status: _rightStatus, ...rightValue } = right;
  return same(leftValue, rightValue);
}

function upsert<T extends object, K extends keyof T>(
  collection: T[],
  key: K,
  value: T,
): void {
  const index = collection.findIndex((item) => item[key] === value[key]);
  if (index >= 0) collection[index] = clone(value);
  else collection.push(clone(value));
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone<T>(value: T): T {
  return cloneQuestionResourceValue(value);
}

function cloneNullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : clone(value);
}
