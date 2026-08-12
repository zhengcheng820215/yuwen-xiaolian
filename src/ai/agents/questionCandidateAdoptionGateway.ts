import {
  createStructuredQuestionDraft,
  updateStructuredQuestionDraft,
} from './questionResourceAdmissionAgent.ts';
import {
  QuestionCandidateConflictError,
  type CandidateAdoptionGateway,
} from './questionCandidateService.ts';
import type { QuestionResourceAdmissionRepository } from
  '../repositories/questionResourceAdmissionRepository.ts';
import type {
  CandidateAdoptionResult,
  CandidateRuntimeContext,
  QuestionCandidate,
} from '../schemas/questionCandidate.schema.ts';
import {
  calculateQuestionEditableFieldsHash,
  extractQuestionEditableFields,
} from '../schemas/workingTaskContent.schema.ts';
import type { StructuredQuestionDraft } from
  '../schemas/questionResourceAdmission.schema.ts';

const EDITABLE_STATUSES = new Set([
  'drafted',
  'validation_failed',
  'revision_required',
]);

export class QuestionResourceCandidateAdoptionGateway implements CandidateAdoptionGateway {
  private readonly repository: QuestionResourceAdmissionRepository;

  constructor(repository: QuestionResourceAdmissionRepository) {
    this.repository = repository;
  }

  async findAdoption(input: {
    candidate: QuestionCandidate;
    expectedContext: CandidateRuntimeContext;
    idempotencyKey: string;
  }): Promise<CandidateAdoptionResult | null> {
    const candidateDraftId = deterministicDraftId(input.candidate.candidateId);
    const deterministicDraft = await this.repository.getDraft(candidateDraftId);
    if (deterministicDraft) {
      return this.toRecoveredAdoption(input.candidate, deterministicDraft);
    }

    if (!input.expectedContext.activeDraftId) return null;
    const activeDraft = await this.repository.getDraft(input.expectedContext.activeDraftId);
    if (!activeDraft || input.expectedContext.activeDraftRevision === undefined) return null;
    const expectedRevision = isTrainingTaskCompatibilityCandidate(input.candidate)
      ? input.expectedContext.activeDraftRevision
      : input.expectedContext.activeDraftRevision + 1;
    if (activeDraft.revision !== expectedRevision) return null;
    if (draftContentHash(activeDraft) !== input.candidate.contentHash) return null;
    return this.toRecoveredAdoption(input.candidate, activeDraft);
  }

  async adoptCandidate(input: {
    candidate: QuestionCandidate;
    expectedContext: CandidateRuntimeContext;
    idempotencyKey: string;
    adoptedAt: string;
  }): Promise<CandidateAdoptionResult> {
    this.assertFormalVersionCandidateIdentity(input.candidate, input.expectedContext);
    const recovered = await this.findAdoption(input);
    if (recovered) return recovered;
    await this.requireCurrentFormalVersionBase(input.candidate);

    const source = input.expectedContext.activeDraftId
      ? await this.requireExpectedDraft(input.expectedContext)
      : null;
    if (!source) {
      const taskDrafts = (await this.repository.listDrafts())
        .filter((draft) => draft.taskId === input.candidate.trainingTaskId && draft.status !== 'archived');
      const compatibleDraft = isTrainingTaskCompatibilityCandidate(input.candidate)
        ? taskDrafts.find((draft) => draftContentHash(draft) === input.candidate.contentHash)
        : null;
      if (compatibleDraft) {
        return this.toRecoveredAdoption(input.candidate, compatibleDraft);
      }
      if (taskDrafts.length > 0) {
        throw conflict(
          'CANDIDATE_BASE_REVISION_CONFLICT',
          '当前任务已经产生题目版本，请刷新候选后再采用。',
        );
      }
      const draft = await createStructuredQuestionDraft(this.repository, {
        ...input.candidate.content,
        draftId: deterministicDraftId(input.candidate.candidateId),
        resourceId: `question-${safeIdentity(input.candidate.trainingTaskId)}`,
        taskId: input.candidate.trainingTaskId,
        now: input.adoptedAt,
      });
      return this.toAdoption(input.candidate, draft, input.adoptedAt);
    }

    if (draftContentHash(source) === input.candidate.contentHash) {
      if (isTrainingTaskCompatibilityCandidate(input.candidate)) {
        return this.toRecoveredAdoption(input.candidate, source);
      }
      throw conflict('CANDIDATE_NO_CHANGES', '候选内容与当前题目版本一致，无需创建新版本。');
    }

    const frozenVersion = await this.repository.getVersionByDraftId(source.draftId);
    if (EDITABLE_STATUSES.has(source.status) && !frozenVersion) {
      const updated = await updateStructuredQuestionDraft(
        this.repository,
        source.draftId,
        input.candidate.content,
        input.adoptedAt,
        { expectedRevision: input.expectedContext.activeDraftRevision },
      );
      return this.toAdoption(input.candidate, updated, input.adoptedAt);
    }

    const successor = await createStructuredQuestionDraft(this.repository, {
      ...input.candidate.content,
      draftId: deterministicDraftId(input.candidate.candidateId),
      resourceId: source.resourceId,
      taskId: source.taskId,
      proposedVersionNumber: frozenVersion
        ? frozenVersion.versionNumber + 1
        : source.proposedVersionNumber,
      parentVersionId: frozenVersion?.resourceVersionId || source.parentVersionId,
      now: input.adoptedAt,
    });
    return this.toAdoption(input.candidate, successor, input.adoptedAt);
  }

  private assertFormalVersionCandidateIdentity(
    candidate: QuestionCandidate,
    context: CandidateRuntimeContext,
  ): void {
    if (candidate.candidateType !== 'formal_version_optimization') return;
    if (!candidate.basedOnFormalResourceId || !candidate.basedOnFormalVersionId) {
      throw conflict(
        'FORMAL_RESOURCE_CANDIDATE_BASE_REQUIRED',
        'Formal-version candidate must identify its source resource and version.',
      );
    }
    if (
      candidate.basedOnFormalResourceId !== context.baseFormalResourceId
      || candidate.basedOnFormalVersionId !== context.baseFormalVersionId
    ) {
      throw conflict(
        'FORMAL_RESOURCE_CANDIDATE_BASE_CONFLICT',
        'Formal-version candidate does not match the requested source version.',
      );
    }
  }

  private async requireCurrentFormalVersionBase(candidate: QuestionCandidate): Promise<void> {
    if (candidate.candidateType !== 'formal_version_optimization') return;
    const resourceId = candidate.basedOnFormalResourceId!;
    const versionId = candidate.basedOnFormalVersionId!;
    const [version, registry] = await Promise.all([
      this.repository.getVersion(versionId),
      this.repository.getRegistryEntry(resourceId),
    ]);
    if (
      !version
      || version.resourceId !== resourceId
      || version.status !== 'frozen'
      || registry?.status !== 'active'
      || registry.currentFrozenVersionId !== versionId
    ) {
      throw conflict(
        'FORMAL_RESOURCE_CANDIDATE_BASE_CONFLICT',
        'The formal resource has changed. Generate a new candidate from the current version.',
      );
    }
  }

  private async requireExpectedDraft(
    context: CandidateRuntimeContext,
  ): Promise<StructuredQuestionDraft> {
    const draft = await this.repository.getDraft(context.activeDraftId!);
    if (!draft) {
      throw conflict('CANDIDATE_BASE_REVISION_CONFLICT', '候选所基于的题目版本已不存在。');
    }
    const actualHash = draftContentHash(draft);
    if (
      draft.revision !== context.activeDraftRevision
      || actualHash !== context.activeDraftContentHash
    ) {
      throw conflict('CANDIDATE_BASE_REVISION_CONFLICT', '题目版本已经变化，请刷新候选后再采用。');
    }
    return draft;
  }

  private toRecoveredAdoption(
    candidate: QuestionCandidate,
    draft: StructuredQuestionDraft,
  ): CandidateAdoptionResult {
    if (draftContentHash(draft) !== candidate.contentHash) {
      throw conflict(
        'CANDIDATE_IDEMPOTENCY_CONFLICT',
        '采用命令对应的题目版本内容与当前候选不一致。',
      );
    }
    return this.toAdoption(candidate, draft, draft.updatedAt);
  }

  private toAdoption(
    candidate: QuestionCandidate,
    draft: StructuredQuestionDraft,
    adoptedAt: string,
  ): CandidateAdoptionResult {
    return {
      candidateId: candidate.candidateId,
      questionLineageId: draft.resourceId,
      draftId: draft.draftId,
      revision: draft.revision,
      contentHash: draftContentHash(draft),
      adoptedAt,
    };
  }
}

function deterministicDraftId(candidateId: string): string {
  return `candidate-draft-${safeIdentity(candidateId)}`;
}

function safeIdentity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function draftContentHash(draft: StructuredQuestionDraft): string {
  return calculateQuestionEditableFieldsHash(extractQuestionEditableFields(draft));
}

function isTrainingTaskCompatibilityCandidate(candidate: QuestionCandidate): boolean {
  return candidate.candidateOrigin === 'training_task_compatibility_wrap'
    || candidate.generationContext.source === 'training_task_compatibility_wrap';
}

function conflict(code: string, message: string): QuestionCandidateConflictError {
  return new QuestionCandidateConflictError(code, message);
}
