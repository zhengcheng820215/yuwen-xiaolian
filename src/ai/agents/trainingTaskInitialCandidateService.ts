import type { QuestionCandidateRepository } from
  '../repositories/questionCandidateRepository.ts';
import {
  CANDIDATE_FIELD_KEYS,
  createQuestionCandidate,
  inspectInitialCandidateCompleteness,
  type CandidateRuntimeContext,
  type InitialCandidateCompleteness,
  type QuestionCandidate,
} from '../schemas/questionCandidate.schema.ts';
import {
  calculateQuestionEditableFieldsHash,
  type QuestionEditableFields,
} from '../schemas/workingTaskContent.schema.ts';

export type TrainingTaskInitialCandidateSource = {
  trainingTaskVersion: number;
  contentHash: string;
  content: QuestionEditableFields;
  context: CandidateRuntimeContext;
};

export interface TrainingTaskInitialCandidateGateway {
  getInitialCandidateSource(trainingTaskId: string): Promise<TrainingTaskInitialCandidateSource>;
}

export type EnsureInitialCandidateFromTrainingTaskInput = {
  trainingTaskId: string;
  expectedTrainingTaskVersion: number;
  expectedContentHash: string;
  idempotencyKey: string;
};

export type EnsureInitialCandidateFromTrainingTaskResult =
  | { status: 'created' | 'existing'; candidate: QuestionCandidate; completeness: InitialCandidateCompleteness }
  | { status: 'question_generation_required'; candidate: null; completeness: InitialCandidateCompleteness };

export class TrainingTaskInitialCandidateService {
  private readonly repository: QuestionCandidateRepository;
  private readonly gateway: TrainingTaskInitialCandidateGateway;
  private readonly clock: () => string;

  constructor(
    repository: QuestionCandidateRepository,
    gateway: TrainingTaskInitialCandidateGateway,
    clock: () => string = () => new Date().toISOString(),
  ) {
    this.repository = repository;
    this.gateway = gateway;
    this.clock = clock;
  }

  async ensureInitialCandidateFromTrainingTask(
    input: EnsureInitialCandidateFromTrainingTaskInput,
  ): Promise<EnsureInitialCandidateFromTrainingTaskResult> {
    const source = await this.gateway.getInitialCandidateSource(input.trainingTaskId);
    if (source.trainingTaskVersion !== input.expectedTrainingTaskVersion) {
      throw new Error('TRAINING_TASK_VERSION_CONFLICT');
    }
    const actualContentHash = calculateQuestionEditableFieldsHash(source.content);
    if (source.contentHash !== actualContentHash || actualContentHash !== input.expectedContentHash) {
      throw new Error('TRAINING_TASK_CONTENT_CONFLICT');
    }

    const completeness = inspectInitialCandidateCompleteness(source.content);
    if (!completeness.complete) {
      return { status: 'question_generation_required', candidate: null, completeness };
    }

    const candidateId = compatibilityCandidateId(
      input.trainingTaskId,
      input.expectedTrainingTaskVersion,
      input.expectedContentHash,
    );
    const existing = await this.repository.getCandidate(candidateId);
    if (existing) return { status: 'existing', candidate: existing, completeness };

    const candidates = await this.repository.listCandidates(input.trainingTaskId);
    await Promise.all(candidates
      .filter((candidate) => (
        candidate.status === 'ready'
        && candidate.candidateOrigin === 'training_task_compatibility_wrap'
        && candidate.candidateId !== candidateId
      ))
      .map((candidate) => this.repository.updateCandidateStatus({
        candidateId: candidate.candidateId,
        expectedStatus: 'ready',
        status: 'expired',
        occurredAt: this.clock(),
      })));

    const createdAt = this.clock();
    const candidate = createQuestionCandidate({
      candidateId,
      generationCommandId: `ensure-initial:${input.idempotencyKey}`,
      generationCommandFingerprint: input.expectedContentHash,
      trainingTaskId: input.trainingTaskId,
      candidateOrigin: 'training_task_compatibility_wrap',
      candidateType: 'initial',
      basedOnDraftId: source.context.activeDraftId,
      basedOnRevision: source.context.activeDraftRevision,
      basedOnContentHash: source.context.activeDraftContentHash,
      content: source.content,
      generationReason: '由训练任务现有完整题目确定性固化为初始题目方案。',
      changedFields: CANDIDATE_FIELD_KEYS,
      allowedFields: CANDIDATE_FIELD_KEYS,
      lockedFields: [],
      generationContext: {
        source: 'training_task_compatibility_wrap',
        modelId: 'training-task-compatibility-adapter',
        promptVersion: 'none',
        promptHash: 'none',
        ruleVersion: 'training-task-initial-candidate-v1',
        materialVersionId: source.context.materialVersionId,
        observationPlanVersion: source.context.observationPlanVersion,
        trainingTaskVersion: source.trainingTaskVersion,
        trainingTaskContentHash: source.contentHash,
        generatedAt: createdAt,
      },
      status: 'ready',
      createdAt,
    });
    try {
      return {
        status: 'created',
        candidate: await this.repository.saveCandidate(candidate),
        completeness,
      };
    } catch (error) {
      const racedCandidate = await this.repository.getCandidate(candidateId);
      if (racedCandidate) return { status: 'existing', candidate: racedCandidate, completeness };
      throw error;
    }
  }
}

function compatibilityCandidateId(
  trainingTaskId: string,
  trainingTaskVersion: number,
  contentHash: string,
): string {
  return `candidate:training-task-wrap:${encodeURIComponent(trainingTaskId)}:${trainingTaskVersion}:${contentHash}`;
}
