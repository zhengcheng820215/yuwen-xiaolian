import type { QuestionResourceAdmissionRepository } from './questionResourceAdmissionRepository.ts';
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

export class InMemoryQuestionResourceAdmissionRepository
implements QuestionResourceAdmissionRepository {
  private readonly materials = new Map<string, QuestionMaterialVersion>();
  private readonly drafts = new Map<string, StructuredQuestionDraft>();
  private readonly validations = new Map<string, ResourceValidationResult>();
  private readonly reviews = new Map<string, ResourceReviewDecision>();
  private readonly versions = new Map<string, FrozenQuestionResourceVersion>();
  private readonly registry = new Map<string, ResourceRegistryEntry>();
  private failNextFreezeCommit = false;

  simulateNextFreezeCommitFailure(): void {
    this.failNextFreezeCommit = true;
  }

  async saveMaterial(material: QuestionMaterialVersion): Promise<QuestionMaterialVersion> {
    this.materials.set(material.materialVersionId, clone(material));
    return clone(material);
  }

  async getMaterial(materialVersionId: string): Promise<QuestionMaterialVersion | null> {
    return cloneNullable(this.materials.get(materialVersionId));
  }

  async saveDraft(draft: StructuredQuestionDraft): Promise<StructuredQuestionDraft> {
    this.drafts.set(draft.draftId, clone(draft));
    return clone(draft);
  }

  async getDraft(draftId: string): Promise<StructuredQuestionDraft | null> {
    return cloneNullable(this.drafts.get(draftId));
  }

  async listDrafts(): Promise<StructuredQuestionDraft[]> {
    return [...this.drafts.values()].map(clone);
  }

  async saveValidation(result: ResourceValidationResult): Promise<ResourceValidationResult> {
    this.validations.set(result.validationId, clone(result));
    return clone(result);
  }

  async getValidation(validationId: string): Promise<ResourceValidationResult | null> {
    return cloneNullable(this.validations.get(validationId));
  }

  async saveReview(decision: ResourceReviewDecision): Promise<ResourceReviewDecision> {
    const existing = this.reviews.get(decision.reviewId);
    if (existing) return clone(existing);
    this.reviews.set(decision.reviewId, clone(decision));
    return clone(decision);
  }

  async getReview(reviewId: string): Promise<ResourceReviewDecision | null> {
    return cloneNullable(this.reviews.get(reviewId));
  }

  async getVersion(resourceVersionId: string): Promise<FrozenQuestionResourceVersion | null> {
    return cloneNullable(this.versions.get(resourceVersionId));
  }

  async getVersionByDraftId(draftId: string): Promise<FrozenQuestionResourceVersion | null> {
    const version = [...this.versions.values()].find((item) => item.sourceDraftId === draftId);
    return cloneNullable(version);
  }

  async listVersions(resourceId?: string): Promise<FrozenQuestionResourceVersion[]> {
    return [...this.versions.values()]
      .filter((version) => !resourceId || version.resourceId === resourceId)
      .sort((a, b) => a.versionNumber - b.versionNumber)
      .map(clone);
  }

  async getRegistryEntry(resourceId: string): Promise<ResourceRegistryEntry | null> {
    return cloneNullable(this.registry.get(resourceId));
  }

  async listRegistryEntries(): Promise<ResourceRegistryEntry[]> {
    return [...this.registry.values()].map(clone);
  }

  async saveRegistryEntry(entry: ResourceRegistryEntry): Promise<ResourceRegistryEntry> {
    this.registry.set(entry.resourceId, clone(entry));
    return clone(entry);
  }

  async replaceRegistry(entries: ResourceRegistryEntry[]): Promise<void> {
    this.registry.clear();
    entries.forEach((entry) => this.registry.set(entry.resourceId, clone(entry)));
  }

  async commitFreeze(commit: ResourceFreezeCommit): Promise<ResourceFreezeResult> {
    const existingByDraft = await this.getVersionByDraftId(commit.version.sourceDraftId);
    if (existingByDraft) {
      const registryEntry = this.registry.get(existingByDraft.resourceId);
      if (!registryEntry) {
        throw new Error('Frozen version exists without a registry entry.');
      }
      return {
        version: existingByDraft,
        registryEntry: clone(registryEntry),
        inserted: false,
      };
    }

    if (this.failNextFreezeCommit) {
      this.failNextFreezeCommit = false;
      throw new Error('Simulated atomic freeze commit failure.');
    }

    if (this.versions.has(commit.version.resourceVersionId)) {
      throw new Error(`Resource version already exists: ${commit.version.resourceVersionId}`);
    }

    const previous = commit.previousVersionId
      ? this.versions.get(commit.previousVersionId)
      : undefined;
    if (commit.previousVersionId && !previous) {
      throw new Error(`Previous frozen version not found: ${commit.previousVersionId}`);
    }

    const previousSnapshot = previous ? clone(previous) : undefined;
    const registrySnapshot = cloneNullable(this.registry.get(commit.version.resourceId));

    try {
      this.versions.set(commit.version.resourceVersionId, clone(commit.version));
      this.registry.set(commit.registryEntry.resourceId, clone(commit.registryEntry));
      if (previous) {
        this.versions.set(previous.resourceVersionId, {
          ...clone(previous),
          status: 'superseded',
          updatedAt: commit.version.frozenAt,
        });
      }
    } catch (error) {
      this.versions.delete(commit.version.resourceVersionId);
      if (previousSnapshot) {
        this.versions.set(previousSnapshot.resourceVersionId, previousSnapshot);
      }
      if (registrySnapshot) {
        this.registry.set(registrySnapshot.resourceId, registrySnapshot);
      } else {
        this.registry.delete(commit.registryEntry.resourceId);
      }
      throw error;
    }

    return {
      version: clone(commit.version),
      registryEntry: clone(commit.registryEntry),
      inserted: true,
    };
  }

  async clear(): Promise<void> {
    this.materials.clear();
    this.drafts.clear();
    this.validations.clear();
    this.reviews.clear();
    this.versions.clear();
    this.registry.clear();
    this.failNextFreezeCommit = false;
  }
}

function clone<T>(value: T): T {
  return cloneQuestionResourceValue(value);
}

function cloneNullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : clone(value);
}
