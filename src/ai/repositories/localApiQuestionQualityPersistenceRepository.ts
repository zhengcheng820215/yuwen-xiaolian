import {
  LocalApiFormalResourceClient,
} from './localApiFormalResourceClient.ts';
import type {
  QualityBundleCurrentIdentity,
  QualityTracedFreezeCommit,
  QualityTracedFreezeResult,
  QuestionQualityPersistenceRepository,
  SemanticAssessmentCurrentIdentity,
} from './questionQualityPersistenceRepository.ts';
import type {
  QuestionQualityAssessmentRepository,
} from './questionQualityAssessmentRepository.ts';
import {
  cloneQuestionQualityPersistenceValue,
  type FrozenQuestionQualityTrace,
} from '../schemas/questionQualityPersistence.schema.ts';
import type {
  QuestionQualityAssessment,
} from '../schemas/questionQualityAssessment.schema.ts';
import type {
  QuestionQualityAssessmentBundle,
  QuestionSemanticQualityAssessment,
} from '../schemas/questionSemanticQualityAssessment.schema.ts';
import type {
  QuestionGenerationBatchQualitySummary,
  QuestionGenerationQualityBatchManifest,
} from '../schemas/questionQualityBatchSummary.schema.ts';
import type {
  TenMaterialCalibrationManifest,
  TenMaterialCalibrationReport,
} from '../schemas/questionQualityCalibration.schema.ts';

export class LocalApiQuestionQualityPersistenceRepository
implements QuestionQualityPersistenceRepository, QuestionQualityAssessmentRepository {
  private readonly client: LocalApiFormalResourceClient;

  constructor(client = new LocalApiFormalResourceClient()) {
    this.client = client;
  }

  saveDeterministicAssessment(
    value: QuestionQualityAssessment,
  ): Promise<QuestionQualityAssessment> {
    return this.saveImmutable(
      'deterministicAssessments',
      'assessmentId',
      value,
    );
  }

  saveAssessment(
    value: QuestionQualityAssessment,
  ): Promise<QuestionQualityAssessment> {
    return this.saveDeterministicAssessment(value);
  }

  async getDeterministicAssessment(
    assessmentId: string,
  ): Promise<QuestionQualityAssessment | null> {
    const state = (await this.client.read()).snapshot.data.questionQuality;
    return cloneNullable(
      state.deterministicAssessments.find(
        (item) => item.assessmentId === assessmentId,
      ),
    );
  }

  getAssessment(
    assessmentId: string,
  ): Promise<QuestionQualityAssessment | null> {
    return this.getDeterministicAssessment(assessmentId);
  }

  async listDeterministicForDraft(
    draftId: string,
  ): Promise<QuestionQualityAssessment[]> {
    const state = (await this.client.read()).snapshot.data.questionQuality;
    return state.deterministicAssessments
      .filter((item) => item.draftId === draftId)
      .sort((left, right) => (
        right.assessedDraftRevision - left.assessedDraftRevision ||
        right.assessedAt.localeCompare(left.assessedAt)
      ))
      .map(clone);
  }

  listAssessmentsForDraft(
    draftId: string,
  ): Promise<QuestionQualityAssessment[]> {
    return this.listDeterministicForDraft(draftId);
  }

  async getAssessmentForRevision(
    draftId: string,
    draftRevision: number,
  ): Promise<QuestionQualityAssessment | null> {
    const assessments = await this.listDeterministicForDraft(draftId);
    return cloneNullable(
      assessments.find(
        (assessment) => assessment.assessedDraftRevision === draftRevision,
      ),
    );
  }

  async clear(): Promise<void> {
    throw new Error(
      'Shared question quality history cannot be cleared from the review workbench.',
    );
  }

  async getCurrentDeterministic(
    draftId: string,
    revision: number,
    validationId: string,
    ruleVersion: string,
  ): Promise<QuestionQualityAssessment | null> {
    const matches = (await this.listDeterministicForDraft(draftId))
      .filter((item) => (
        item.assessedDraftRevision === revision &&
        item.validationId === validationId &&
        item.ruleVersion === ruleVersion
      ));
    return cloneNullable(matches[0]);
  }

  saveSemanticAssessment(
    value: QuestionSemanticQualityAssessment,
  ): Promise<QuestionSemanticQualityAssessment> {
    return this.saveImmutable(
      'semanticAssessments',
      'semanticAssessmentId',
      value,
    );
  }

  async getSemanticAssessment(
    semanticAssessmentId: string,
  ): Promise<QuestionSemanticQualityAssessment | null> {
    const state = (await this.client.read()).snapshot.data.questionQuality;
    return cloneNullable(
      state.semanticAssessments.find(
        (item) => item.semanticAssessmentId === semanticAssessmentId,
      ),
    );
  }

  async listSemanticForDraft(
    draftId: string,
  ): Promise<QuestionSemanticQualityAssessment[]> {
    const state = (await this.client.read()).snapshot.data.questionQuality;
    return state.semanticAssessments
      .filter((item) => item.draftId === draftId)
      .sort((left, right) => (
        right.assessedDraftRevision - left.assessedDraftRevision ||
        right.completedAt.localeCompare(left.completedAt)
      ))
      .map(clone);
  }

  async getCurrentCompletedSemantic(
    identity: SemanticAssessmentCurrentIdentity,
  ): Promise<QuestionSemanticQualityAssessment | null> {
    const matches = (await this.listSemanticForDraft(identity.draftId))
      .filter((item) => (
        item.status === 'completed' &&
        item.assessedDraftRevision === identity.draftRevision &&
        item.validationId === identity.validationId &&
        item.deterministicAssessmentId === identity.deterministicAssessmentId &&
        item.providerId === identity.providerId &&
        item.modelId === identity.modelId &&
        item.promptVersion === identity.promptVersion &&
        item.semanticRuleVersion === identity.semanticRuleVersion &&
        item.outputSchemaVersion === identity.outputSchemaVersion
      ));
    return cloneNullable(matches[0]);
  }

  saveBundle(
    value: QuestionQualityAssessmentBundle,
  ): Promise<QuestionQualityAssessmentBundle> {
    return this.saveImmutable('assessmentBundles', 'bundleId', value);
  }

  async getBundle(
    bundleId: string,
  ): Promise<QuestionQualityAssessmentBundle | null> {
    const state = (await this.client.read()).snapshot.data.questionQuality;
    return cloneNullable(
      state.assessmentBundles.find((item) => item.bundleId === bundleId),
    );
  }

  async getCurrentBundle(
    identity: QualityBundleCurrentIdentity,
  ): Promise<QuestionQualityAssessmentBundle | null> {
    const state = (await this.client.read()).snapshot.data.questionQuality;
    return cloneNullable(
      state.assessmentBundles.find((item) => (
        item.draftId === identity.draftId &&
        item.assessedDraftRevision === identity.draftRevision &&
        item.validationId === identity.validationId &&
        item.deterministicAssessmentId === identity.deterministicAssessmentId &&
        item.semanticAssessmentId === identity.semanticAssessmentId &&
        item.mergeRuleVersion === identity.mergeRuleVersion
      )),
    );
  }

  async getTrace(
    traceId: string,
  ): Promise<FrozenQuestionQualityTrace | null> {
    const state = (await this.client.read()).snapshot.data.questionQuality;
    return cloneNullable(
      state.frozenQualityTraces.find((item) => item.traceId === traceId),
    );
  }

  async getTraceForResourceVersion(
    resourceVersionId: string,
  ): Promise<FrozenQuestionQualityTrace | null> {
    const state = (await this.client.read()).snapshot.data.questionQuality;
    return cloneNullable(
      state.frozenQualityTraces.find(
        (item) => item.resourceVersionId === resourceVersionId,
      ),
    );
  }

  saveBatchManifest(
    value: QuestionGenerationQualityBatchManifest,
  ): Promise<QuestionGenerationQualityBatchManifest> {
    return this.saveImmutable('batchManifests', 'manifestId', value);
  }

  async getBatchManifest(
    manifestId: string,
  ): Promise<QuestionGenerationQualityBatchManifest | null> {
    const state = (await this.client.read()).snapshot.data.questionQuality;
    return cloneNullable(
      state.batchManifests.find((item) => item.manifestId === manifestId),
    );
  }

  saveBatchSummary(
    value: QuestionGenerationBatchQualitySummary,
  ): Promise<QuestionGenerationBatchQualitySummary> {
    return this.saveImmutable('batchSummaries', 'summaryId', value);
  }

  async getBatchSummary(
    summaryId: string,
  ): Promise<QuestionGenerationBatchQualitySummary | null> {
    const state = (await this.client.read()).snapshot.data.questionQuality;
    return cloneNullable(
      state.batchSummaries.find((item) => item.summaryId === summaryId),
    );
  }

  saveCalibrationManifest(
    value: TenMaterialCalibrationManifest,
  ): Promise<TenMaterialCalibrationManifest> {
    return this.saveImmutable('calibrationManifests', 'manifestId', value);
  }

  async getCalibrationManifest(
    manifestId: string,
  ): Promise<TenMaterialCalibrationManifest | null> {
    const state = (await this.client.read()).snapshot.data.questionQuality;
    return cloneNullable(
      state.calibrationManifests.find((item) => item.manifestId === manifestId),
    );
  }

  saveCalibrationReport(
    value: TenMaterialCalibrationReport,
  ): Promise<TenMaterialCalibrationReport> {
    return this.saveImmutable('calibrationReports', 'reportId', value);
  }

  async getCalibrationReport(
    reportId: string,
  ): Promise<TenMaterialCalibrationReport | null> {
    const state = (await this.client.read()).snapshot.data.questionQuality;
    return cloneNullable(
      state.calibrationReports.find((item) => item.reportId === reportId),
    );
  }

  async commitFreezeWithQualityTrace(
    commit: QualityTracedFreezeCommit,
  ): Promise<QualityTracedFreezeResult> {
    const envelope = await this.client.read();
    const existingTrace = envelope.snapshot.data.questionQuality.frozenQualityTraces
      .find((item) => item.traceId === commit.trace.traceId);
    const existingVersion = envelope.snapshot.data.questionResources.versions
      .find((item) => (
        item.resourceVersionId === commit.resourceCommit.version.resourceVersionId
      ));
    if (existingTrace || existingVersion) {
      if (!existingTrace || !existingVersion) {
        throw new Error('Frozen resource and quality trace are incomplete.');
      }
      if (
        !same(existingTrace, commit.trace) ||
        !same(existingVersion, commit.resourceCommit.version)
      ) {
        throw new Error(`identity_content_conflict: ${commit.trace.traceId}`);
      }
      const registryEntry = envelope.snapshot.data.questionResources.registryEntries
        .find((item) => item.resourceId === existingVersion.resourceId);
      if (!registryEntry) {
        throw new Error('Frozen version exists without a registry entry.');
      }
      return {
        version: clone(existingVersion),
        registryEntry: clone(registryEntry),
        trace: clone(existingTrace),
        inserted: false,
      };
    }

    return this.client.mutate((data) => {
      assertTraceSourcesExist(data.questionQuality, commit.trace);
      const state = data.questionResources;
      const resourceCommit = commit.resourceCommit;
      if (state.versions.some(
        (item) => item.resourceVersionId === resourceCommit.version.resourceVersionId,
      )) {
        throw new Error(
          `Resource version already exists: ${resourceCommit.version.resourceVersionId}`,
        );
      }
      const previousIndex = resourceCommit.previousVersionId
        ? state.versions.findIndex(
          (item) => item.resourceVersionId === resourceCommit.previousVersionId,
        )
        : -1;
      if (resourceCommit.previousVersionId && previousIndex < 0) {
        throw new Error(
          `Previous frozen version not found: ${resourceCommit.previousVersionId}`,
        );
      }
      state.versions.push(clone(resourceCommit.version));
      upsert(state.registryEntries, 'resourceId', resourceCommit.registryEntry);
      data.questionQuality.frozenQualityTraces.push(clone(commit.trace));
      if (previousIndex >= 0) {
        state.versions[previousIndex] = {
          ...state.versions[previousIndex],
          status: 'superseded',
          updatedAt: resourceCommit.version.frozenAt,
        };
      }
      return {
        version: resourceCommit.version,
        registryEntry: resourceCommit.registryEntry,
        trace: commit.trace,
        inserted: true,
      };
    });
  }

  private async saveImmutable<
    K extends
      | 'deterministicAssessments'
      | 'semanticAssessments'
      | 'assessmentBundles'
      | 'batchManifests'
      | 'batchSummaries'
      | 'calibrationManifests'
      | 'calibrationReports',
    T extends
      | QuestionQualityAssessment
      | QuestionSemanticQualityAssessment
      | QuestionQualityAssessmentBundle
      | QuestionGenerationQualityBatchManifest
      | QuestionGenerationBatchQualitySummary
      | TenMaterialCalibrationManifest
      | TenMaterialCalibrationReport,
  >(
    collectionName: K,
    key: keyof T,
    value: T,
  ): Promise<T> {
    const state = (await this.client.read()).snapshot.data.questionQuality;
    const collection = state[collectionName] as T[];
    const existing = collection.find((item) => item[key] === value[key]);
    if (existing) {
      if (!same(existing, value)) {
        throw new Error(`identity_content_conflict: ${String(value[key])}`);
      }
      return clone(existing);
    }
    return this.client.mutate((data) => {
      (data.questionQuality[collectionName] as T[]).push(clone(value));
      return value;
    });
  }
}

function assertTraceSourcesExist(
  state: {
    deterministicAssessments: QuestionQualityAssessment[];
    semanticAssessments: QuestionSemanticQualityAssessment[];
    assessmentBundles: QuestionQualityAssessmentBundle[];
  },
  trace: FrozenQuestionQualityTrace,
): void {
  const deterministic = state.deterministicAssessments.find(
    (item) => item.assessmentId === trace.deterministicAssessmentId,
  );
  const semantic = state.semanticAssessments.find(
    (item) => item.semanticAssessmentId === trace.semanticAssessmentId,
  );
  const bundle = state.assessmentBundles.find(
    (item) => item.bundleId === trace.bundleId,
  );
  if (!deterministic || !semantic || !bundle) {
    throw new Error('Quality trace source is not fully persisted.');
  }
  if (
    semantic.status !== 'completed' ||
    bundle.deterministicAssessmentId !== deterministic.assessmentId ||
    bundle.semanticAssessmentId !== semantic.semanticAssessmentId
  ) {
    throw new Error('Quality trace source identity is invalid.');
  }
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
  return cloneQuestionQualityPersistenceValue(value);
}

function cloneNullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : clone(value);
}
