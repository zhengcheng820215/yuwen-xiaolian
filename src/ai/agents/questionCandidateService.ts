import type { QuestionCandidateRepository } from '../repositories/questionCandidateRepository.ts';
import {
  candidateContextMatches,
  candidateFieldChanged,
  cloneQuestionCandidate,
  createQuestionCandidate,
  type CandidateAdoptionResult,
  type CandidateCommandName,
  type CandidateCommandReceipt,
  type CandidateFieldKey,
  type CandidateGenerationCommandName,
  type CandidateGenerationContext,
  type CandidateRuntimeContext,
  type QuestionCandidate,
  type QuestionCandidateType,
} from '../schemas/questionCandidate.schema.ts';
import {
  calculateQuestionEditableFieldsHash,
  type QuestionEditableFields,
} from '../schemas/workingTaskContent.schema.ts';
import {
  QuestionCandidateGenerationQualityError,
  evaluateQuestionGenerationQuality,
} from './questionGenerationQualityPolicyAgent.ts';
import type { QuestionGenerationQualityEvaluation } from
  '../schemas/questionGenerationQuality.schema.ts';
import {
  READING_OPEN_RESPONSE_LOAD_GATED_CANDIDATE_RULE_VERSION,
  type ReadingOpenResponseLoadGateAssessment,
  type ReadingTaskGroupLoadGateAssessment,
} from '../schemas/readingOpenResponseLoadGate.schema.ts';
import type {
  TextResponseCandidateGenerationTrace,
  TextResponseLoadPlanningIntent,
} from '../schemas/readingOpenResponseGenerationPlanning.schema.ts';
import {
  assessReadingOpenResponseLoadGate,
} from './readingOpenResponseLoadQualityGate.ts';
import { isCandidateLoadGateAdoptable } from
  './readingOpenResponsePublicationReadiness.ts';
import { assessReadingTaskGroupLoadGate } from
  './readingTaskGroupLoadQualityGate.ts';
import {
  isTrainingTaskSequenceReason,
  isTrainingTaskSequenceStrategy,
} from '../schemas/trainingTaskSequencePlanning.schema.ts';
import {
  calculateTaskLoadSemanticsHash,
  cloneTaskLoadSemantics,
  isTaskLoadSemantics,
} from '../schemas/readingTaskLoadSemantics.schema.ts';
import { READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION } from
  '../schemas/readingTrainingProgressionAudit.schema.ts';
import { verifyTaskLoadSemantics } from './readingTaskLoadSemanticsAgent.ts';
import {
  READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION,
  type ReadingTaskGroupProgressionGateAssessment,
} from '../schemas/readingTaskGroupProgression.schema.ts';
import { assessReadingTaskGroupProgression } from
  './readingTaskGroupProgressionPlanner.ts';

const OPTIMIZABLE_FIELDS: CandidateFieldKey[] = [
  'abilityTarget',
  'specificTrainingPoint',
  'questionStem',
  'studentTask',
  'observationTarget',
  'answerAcceptance',
  'rubric',
  'materialScope',
];

type CandidateOperation = 'generate' | 'regenerate' | 'optimize';

export type GeneratedQuestionCandidate = {
  content: QuestionEditableFields;
  generationReason: string;
  changedFields: CandidateFieldKey[];
  generationContext: CandidateGenerationContext;
  generationQuality?: QuestionGenerationQualityEvaluation;
  textResponseLoadPlanning?: {
    intent: TextResponseLoadPlanningIntent;
    trace: TextResponseCandidateGenerationTrace;
  };
};

export interface QuestionCandidateGenerator {
  generate(input: {
    operation: CandidateOperation;
    trainingTaskId: string;
    count: number;
    context: CandidateRuntimeContext;
    baseCandidate?: QuestionCandidate;
    reasonCodes: string[];
    goals: string[];
    allowedFields: CandidateFieldKey[];
    lockedFields: CandidateFieldKey[];
    idempotencyKey: string;
  }): Promise<GeneratedQuestionCandidate[]>;
}

export interface QuestionCandidateContextGateway {
  getCurrentContext(trainingTaskId: string): Promise<CandidateRuntimeContext>;
  listPeerQuestionContents?(
    trainingTaskId: string,
    context: CandidateRuntimeContext,
  ): Promise<QuestionEditableFields[]>;
}

export interface CandidateAdoptionGateway {
  findAdoption?(input: {
    candidate: QuestionCandidate;
    expectedContext: CandidateRuntimeContext;
    idempotencyKey: string;
  }): Promise<CandidateAdoptionResult | null>;
  adoptCandidate(input: {
    candidate: QuestionCandidate;
    expectedContext: CandidateRuntimeContext;
    idempotencyKey: string;
    adoptedAt: string;
  }): Promise<CandidateAdoptionResult>;
}

export type GenerateTaskCandidatesInput = {
  trainingTaskId: string;
  count?: number;
  reasonCodes?: string[];
  goals?: string[];
  expectedContext?: CandidateRuntimeContext;
  idempotencyKey: string;
};

export type RegenerateTaskCandidatesInput = GenerateTaskCandidatesInput & {
  baseCandidateId: string;
};

export type GenerateFormalVersionOptimizationCandidatesInput = GenerateTaskCandidatesInput & {
  formalResourceId: string;
  baseFormalVersionId: string;
};

export type OptimizeTaskCandidateInput = {
  trainingTaskId: string;
  baseCandidateId: string;
  reasonCodes?: string[];
  goals: string[];
  allowedFields: CandidateFieldKey[];
  lockedFields: CandidateFieldKey[];
  expectedContext?: CandidateRuntimeContext;
  idempotencyKey: string;
};

export type AdoptTaskCandidateInput = {
  trainingTaskId: string;
  candidateId: string;
  expectedContentHash: string;
  expectedContext?: CandidateRuntimeContext;
  idempotencyKey: string;
  adoptedBy: string;
};

export type RejectCandidateBatchInput = {
  trainingTaskId: string;
  candidateId: string;
  idempotencyKey: string;
  rejectedBy: string;
};

export class QuestionCandidateConflictError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'QuestionCandidateConflictError';
    this.code = code;
  }
}

export class QuestionCandidateLoadGateError extends Error {
  readonly assessment: ReadingOpenResponseLoadGateAssessment;

  constructor(assessment: ReadingOpenResponseLoadGateAssessment) {
    super(`Reading open-response load gate blocked Candidate: ${assessment.blockerCodes.join(', ')}`);
    this.name = 'QuestionCandidateLoadGateError';
    this.assessment = assessment;
  }
}

export class QuestionCandidateGroupLoadGateError extends Error {
  readonly assessment: ReadingTaskGroupLoadGateAssessment;

  constructor(assessment: ReadingTaskGroupLoadGateAssessment) {
    super(`Reading task-group load gate blocked Candidate: ${assessment.blockerCodes.join(', ')}`);
    this.name = 'QuestionCandidateGroupLoadGateError';
    this.assessment = assessment;
  }
}

export class QuestionCandidateProgressionGateError extends Error {
  readonly assessment: ReadingTaskGroupProgressionGateAssessment;

  constructor(assessment: ReadingTaskGroupProgressionGateAssessment) {
    super(`Reading task-group progression gate blocked Candidate: ${assessment.blockerCodes.join(', ')}`);
    this.name = 'QuestionCandidateProgressionGateError';
    this.assessment = assessment;
  }
}

export class QuestionCandidateService {
  private readonly repository: QuestionCandidateRepository;
  private readonly generator: QuestionCandidateGenerator;
  private readonly contextGateway: QuestionCandidateContextGateway;
  private readonly adoptionGateway: CandidateAdoptionGateway;
  private readonly now: () => string;

  constructor(
    repository: QuestionCandidateRepository,
    generator: QuestionCandidateGenerator,
    contextGateway: QuestionCandidateContextGateway,
    adoptionGateway: CandidateAdoptionGateway,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.repository = repository;
    this.generator = generator;
    this.contextGateway = contextGateway;
    this.adoptionGateway = adoptionGateway;
    this.now = now;
  }

  async generateTaskCandidates(
    input: GenerateTaskCandidatesInput,
  ): Promise<QuestionCandidate[]> {
    return this.runGenerationCommand({
      command: 'generateTaskCandidates',
      operation: 'generate',
      candidateType: 'initial',
      input,
      allowedFields: OPTIMIZABLE_FIELDS,
      lockedFields: [],
    });
  }

  async regenerateTaskCandidates(
    input: RegenerateTaskCandidatesInput,
  ): Promise<QuestionCandidate[]> {
    const baseCandidate = await this.requireCandidate(
      input.baseCandidateId,
      input.trainingTaskId,
    );
    const candidates = await this.runGenerationCommand({
      command: 'regenerateTaskCandidates',
      operation: 'regenerate',
      candidateType: 'regenerated',
      input,
      baseCandidate,
      allowedFields: OPTIMIZABLE_FIELDS,
      lockedFields: [],
    });
    await this.ensureSuperseded(baseCandidate, input.idempotencyKey);
    return candidates;
  }

  async optimizeTaskCandidate(
    input: OptimizeTaskCandidateInput,
  ): Promise<QuestionCandidate[]> {
    const allowedFields = uniqueFields(input.allowedFields);
    const lockedFields = uniqueFields(input.lockedFields);
    requireNonEmptyList(allowedFields, 'allowedFields');
    requireNonEmptyList(input.goals, 'goals');
    const overlap = allowedFields.filter((field) => lockedFields.includes(field));
    if (overlap.length > 0) {
      throw new QuestionCandidateConflictError(
        'CANDIDATE_FIELD_POLICY_CONFLICT',
        `Fields cannot be both allowed and locked: ${overlap.join(', ')}.`,
      );
    }
    const baseCandidate = await this.requireCandidate(
      input.baseCandidateId,
      input.trainingTaskId,
    );
    const candidates = await this.runGenerationCommand({
      command: 'optimizeTaskCandidate',
      operation: 'optimize',
      candidateType: 'optimized',
      input: { ...input, count: 1 },
      baseCandidate,
      allowedFields,
      lockedFields,
    });
    await this.ensureOptimizationDecision(baseCandidate, candidates, input);
    return candidates;
  }

  async adoptTaskCandidate(
    input: AdoptTaskCandidateInput,
  ): Promise<CandidateAdoptionResult> {
    const trainingTaskId = requireText(input.trainingTaskId, 'trainingTaskId');
    const candidateId = requireText(input.candidateId, 'candidateId');
    const idempotencyKey = requireText(input.idempotencyKey, 'idempotencyKey');
    const adoptedBy = requireText(input.adoptedBy, 'adoptedBy');
    const requestFingerprint = fingerprint({
      trainingTaskId,
      candidateId,
      expectedContentHash: input.expectedContentHash,
      expectedContext: input.expectedContext,
      adoptedBy,
    });
    const receipt = await this.readReceipt(
      'adoptTaskCandidate',
      idempotencyKey,
      requestFingerprint,
    );
    if (receipt) {
      if (receipt.result.kind !== 'candidate_adoption') {
        throw new Error('Stored candidate adoption receipt has an invalid result type.');
      }
      await this.reconcileAdoption(candidateId, input, receipt.result.adoption);
      return cloneQuestionCandidate(receipt.result.adoption);
    }

    const candidate = await this.requireCandidate(candidateId, trainingTaskId);
    const expectedContentHash = requireText(input.expectedContentHash, 'expectedContentHash');
    if (candidate.contentHash !== expectedContentHash) {
      throw new QuestionCandidateConflictError(
        'CANDIDATE_CONTENT_CONFLICT',
        `Candidate ${candidateId} content changed before adoption.`,
      );
    }
    if (!isCandidateLoadGateAdoptable(candidate)) {
      throw new QuestionCandidateConflictError(
        'CANDIDATE_LOAD_GATE_BLOCKED_OR_STALE',
        '当前候选的输入负担检查未通过或已过期，请重新生成题目。',
      );
    }
    const expectedContext = input.expectedContext
      ? cloneQuestionCandidate(input.expectedContext)
      : await this.contextGateway.getCurrentContext(trainingTaskId);
    const recovered = await this.adoptionGateway.findAdoption?.({
      candidate: cloneQuestionCandidate(candidate),
      expectedContext,
      idempotencyKey,
    });
    if (recovered) {
      validateAdoptionResult(candidate, recovered);
      const recoveredWithLoadGate = this.attachDraftLoadGateAssessment(candidate, recovered);
      await this.repository.saveCommandReceipt({
        command: 'adoptTaskCandidate',
        idempotencyKey,
        requestFingerprint,
        result: { kind: 'candidate_adoption', adoption: recoveredWithLoadGate },
        createdAt: recovered.adoptedAt,
      });
      await this.reconcileAdoption(candidateId, input, recoveredWithLoadGate);
      return cloneQuestionCandidate(recoveredWithLoadGate);
    }
    if (candidate.status !== 'ready') {
      throw new QuestionCandidateConflictError(
        'CANDIDATE_NOT_ADOPTABLE',
        `Candidate ${candidateId} is ${candidate.status} and cannot be adopted.`,
      );
    }
    const context = await this.requireCurrentContext(
      trainingTaskId,
      input.expectedContext,
    );
    await this.ensureCandidateCurrent(candidate, context);
    const currentPeerQuestions = this.contextGateway.listPeerQuestionContents
      ? await this.contextGateway.listPeerQuestionContents(trainingTaskId, context)
      : [];
    if (context.progressionStageRuleVersion
      === READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION) {
      const currentProgressionAssessment = assessCandidateProgression({
        candidateId: candidate.candidateId,
        content: candidate.content,
        context,
        assessedAt: this.now(),
      });
      if (['blocked', 'insufficient_input'].includes(currentProgressionAssessment.decision)) {
        throw new QuestionCandidateProgressionGateError(currentProgressionAssessment);
      }
      if (candidate.taskGroupProgressionGateAssessment?.projectedGroupSnapshotHash
        !== currentProgressionAssessment.projectedGroupSnapshotHash) {
        throw new QuestionCandidateConflictError(
          'CANDIDATE_GROUP_PROGRESSION_GATE_STALE',
          '当前题组计划或任务身份已经变化，请重新检查候选后再发布。',
        );
      }
    } else {
      const currentGroupAssessment = assessCandidateTaskGroupLoad({
        candidateId: candidate.candidateId,
        trainingTaskId: candidate.trainingTaskId,
        content: candidate.content,
        loadGateAssessment: candidate.loadGateAssessment,
        context,
        peerQuestions: currentPeerQuestions,
        assessedAt: this.now(),
      });
      if (currentGroupAssessment.decision === 'blocked') {
        throw new QuestionCandidateGroupLoadGateError(currentGroupAssessment);
      }
      if (
        candidate.generationContext.ruleVersion
          === READING_OPEN_RESPONSE_LOAD_GATED_CANDIDATE_RULE_VERSION
        && candidate.groupLoadGateAssessment?.groupSnapshotHash
          !== currentGroupAssessment.groupSnapshotHash
      ) {
        throw new QuestionCandidateConflictError(
          'CANDIDATE_GROUP_LOAD_GATE_STALE',
          '当前题组顺序或内容已经变化，请重新检查候选后再发布。',
        );
      }
    }
    const adoptedAt = this.now();
    const adoption = await this.adoptionGateway.adoptCandidate({
      candidate: cloneQuestionCandidate(candidate),
      expectedContext: cloneQuestionCandidate(context),
      idempotencyKey,
      adoptedAt,
    });
    validateAdoptionResult(candidate, adoption);
    const adoptionWithLoadGate = this.attachDraftLoadGateAssessment(candidate, adoption);

    await this.repository.saveCommandReceipt({
      command: 'adoptTaskCandidate',
      idempotencyKey,
      requestFingerprint,
      result: { kind: 'candidate_adoption', adoption: adoptionWithLoadGate },
      createdAt: adoptedAt,
    });
    await this.reconcileAdoption(candidateId, input, adoptionWithLoadGate);
    return cloneQuestionCandidate(adoptionWithLoadGate);
  }

  private attachDraftLoadGateAssessment(
    candidate: QuestionCandidate,
    adoption: CandidateAdoptionResult,
  ): CandidateAdoptionResult {
    if (
      candidate.generationContext.ruleVersion
      !== READING_OPEN_RESPONSE_LOAD_GATED_CANDIDATE_RULE_VERSION
    ) {
      return cloneQuestionCandidate(adoption);
    }
    const draftAssessment = assessReadingOpenResponseLoadGate({
      subject: {
        kind: 'draft_revision',
        subjectId: adoption.draftId,
        revision: adoption.revision,
      },
      trainingTaskId: candidate.trainingTaskId,
      content: candidate.content,
      generationTrace: candidate.textResponseLoadPlanning?.trace,
      requireGenerationTrace: true,
      assessedAt: adoption.adoptedAt,
    });
    if (draftAssessment?.decision === 'blocked') {
      throw new QuestionCandidateLoadGateError(draftAssessment);
    }
    return {
      ...cloneQuestionCandidate(adoption),
      ...(draftAssessment ? { draftLoadGateAssessment: draftAssessment } : {}),
    };
  }

  async generateFormalVersionOptimizationCandidates(
    input: GenerateFormalVersionOptimizationCandidatesInput,
  ): Promise<QuestionCandidate[]> {
    const formalResourceId = requireText(input.formalResourceId, 'formalResourceId');
    const baseFormalVersionId = requireText(input.baseFormalVersionId, 'baseFormalVersionId');
    if (
      input.expectedContext?.baseFormalResourceId !== formalResourceId
      || input.expectedContext?.baseFormalVersionId !== baseFormalVersionId
    ) {
      throw new QuestionCandidateConflictError(
        'FORMAL_RESOURCE_CANDIDATE_BASE_CONFLICT',
        '正式资源版本已经变化，请刷新后重新生成新版方案。',
      );
    }
    return this.runGenerationCommand({
      command: 'generateFormalVersionOptimizationCandidates',
      operation: 'generate',
      candidateType: 'formal_version_optimization',
      input,
      allowedFields: OPTIMIZABLE_FIELDS,
      lockedFields: [],
    });
  }

  async rejectCandidateBatch(
    input: RejectCandidateBatchInput,
  ): Promise<QuestionCandidate[]> {
    const trainingTaskId = requireText(input.trainingTaskId, 'trainingTaskId');
    const candidateId = requireText(input.candidateId, 'candidateId');
    const idempotencyKey = requireText(input.idempotencyKey, 'idempotencyKey');
    const rejectedBy = requireText(input.rejectedBy, 'rejectedBy');
    const anchor = await this.requireCandidate(candidateId, trainingTaskId);
    const batch = (await this.repository.listCandidates(trainingTaskId)).filter(
      (candidate) => candidate.generationCommandId === anchor.generationCommandId,
    );
    if (batch.length === 0) {
      throw new Error(`Candidate batch not found: ${anchor.generationCommandId}`);
    }
    const invalid = batch.find((candidate) => !['ready', 'rejected'].includes(candidate.status));
    if (invalid) {
      throw new QuestionCandidateConflictError(
        'CANDIDATE_BATCH_NOT_REJECTABLE',
        `Candidate ${invalid.candidateId} is ${invalid.status} and the batch cannot be rejected.`,
      );
    }

    const rejectedAt = this.now();
    const rejected: QuestionCandidate[] = [];
    for (const candidate of batch) {
      const updated = candidate.status === 'ready'
        ? await this.repository.updateCandidateStatus({
            candidateId: candidate.candidateId,
            expectedStatus: 'ready',
            status: 'rejected',
            occurredAt: rejectedAt,
          })
        : candidate;
      const eventId = `rejected:${idempotencyKey}:${candidate.candidateId}`;
      const events = await this.repository.listDecisionEvents(candidate.candidateId);
      if (!events.some((event) => event.eventId === eventId)) {
        await this.repository.saveDecisionEvent({
          eventId,
          candidateId: candidate.candidateId,
          trainingTaskId,
          decision: 'rejected',
          reasonCodes: ['operator_discarded_batch'],
          relatedCandidateIds: batch
            .filter((item) => item.candidateId !== candidate.candidateId)
            .map((item) => item.candidateId),
          decidedBy: rejectedBy,
          decidedAt: rejectedAt,
        });
      }
      rejected.push(updated);
    }
    return rejected.map(cloneQuestionCandidate);
  }

  private async runGenerationCommand(input: {
    command: CandidateGenerationCommandName;
    operation: CandidateOperation;
    candidateType: QuestionCandidateType;
    input: GenerateTaskCandidatesInput & { baseCandidateId?: string };
    baseCandidate?: QuestionCandidate;
    allowedFields: CandidateFieldKey[];
    lockedFields: CandidateFieldKey[];
  }): Promise<QuestionCandidate[]> {
    const trainingTaskId = requireText(input.input.trainingTaskId, 'trainingTaskId');
    const idempotencyKey = requireText(input.input.idempotencyKey, 'idempotencyKey');
    const count = requireCount(input.input.count ?? 3);
    const reasonCodes = normalizeTextList(input.input.reasonCodes || []);
    const goals = normalizeTextList(input.input.goals || []);
    const requestFingerprint = fingerprint({
      trainingTaskId,
      count,
      reasonCodes,
      goals,
      expectedContext: input.input.expectedContext,
      baseCandidateId: input.baseCandidate?.candidateId,
      allowedFields: input.allowedFields,
      lockedFields: input.lockedFields,
    });
    const receipt = await this.readReceipt(input.command, idempotencyKey, requestFingerprint);
    if (receipt) return this.readGeneratedCandidates(receipt);

    const commandId = `${input.command}:${idempotencyKey}`;
    const recoverable = (await this.repository.listCandidates(trainingTaskId))
      .filter((candidate) => candidate.generationCommandId === commandId);
    if (recoverable.length > 0) {
      if (recoverable.some((candidate) => (
        candidate.generationCommandFingerprint !== requestFingerprint
      ))) {
        throw new QuestionCandidateConflictError(
          'CANDIDATE_IDEMPOTENCY_CONFLICT',
          `Idempotency key ${idempotencyKey} was already used with another request.`,
        );
      }
      if (recoverable.length !== count) {
        throw new QuestionCandidateConflictError(
          'CANDIDATE_PARTIAL_GENERATION',
          `Generation command ${commandId} recovered ${recoverable.length} of ${count} candidates.`,
        );
      }
      await this.saveGenerationReceipt(
        input.command,
        idempotencyKey,
        requestFingerprint,
        recoverable,
      );
      await this.supersedePreviousAiCandidates(
        trainingTaskId,
        recoverable.map((candidate) => candidate.candidateId),
        recoverable[0]?.createdAt || this.now(),
      );
      return recoverable.map(cloneQuestionCandidate);
    }

    const context = await this.requireCurrentContext(
      trainingTaskId,
      input.input.expectedContext,
    );
    if (input.baseCandidate) {
      if (input.baseCandidate.status !== 'ready') {
        throw new QuestionCandidateConflictError(
          'CANDIDATE_NOT_READY',
          `Candidate ${input.baseCandidate.candidateId} is ${input.baseCandidate.status}.`,
        );
      }
      await this.ensureCandidateCurrent(input.baseCandidate, context);
    }
    const generated = await this.generator.generate({
      operation: input.operation,
      trainingTaskId,
      count,
      context: cloneQuestionCandidate(context),
      baseCandidate: input.baseCandidate && cloneQuestionCandidate(input.baseCandidate),
      reasonCodes,
      goals,
      allowedFields: [...input.allowedFields],
      lockedFields: [...input.lockedFields],
      idempotencyKey,
    });
    await this.requireCurrentContext(trainingTaskId, context);
    if (generated.length !== count) {
      throw new Error(`Candidate generator returned ${generated.length}, expected ${count}.`);
    }

    const peerQuestions = this.contextGateway.listPeerQuestionContents
      ? await this.contextGateway.listPeerQuestionContents(trainingTaskId, context)
      : [];
    const generationQuality = generated.map((item, index) => {
      const evaluation = evaluateQuestionGenerationQuality({
        candidate: item.content,
        baseContentHash: context.activeDraftContentHash,
        peerQuestions: [
          ...peerQuestions,
          ...generated.slice(0, index).map((previous) => previous.content),
        ],
        portfolioQuestions: [
          ...peerQuestions,
          ...generated.map((candidate) => candidate.content),
        ],
      });
      if (evaluation.status === 'blocked') {
        throw new QuestionCandidateGenerationQualityError(evaluation);
      }
      return evaluation;
    });

    const candidates: QuestionCandidate[] = [];
    for (let index = 0; index < generated.length; index += 1) {
      const item = generated[index]!;
      const candidateId = `${commandId}:${index + 1}`;
      validateGenerationContext(item.generationContext, context);
      validateNativeTaskLoadContext(context, item.generationContext, item.content.responseFormat);
      if (input.operation === 'optimize' && input.baseCandidate) {
        validateOptimizedContent(
          input.baseCandidate.content,
          item,
          input.allowedFields,
          input.lockedFields,
        );
      }
      const loadGateAssessment = assessReadingOpenResponseLoadGate({
        subject: { kind: 'candidate', subjectId: candidateId },
        trainingTaskId,
        content: item.content,
        generationTrace: item.textResponseLoadPlanning?.trace,
        requireGenerationTrace: item.generationContext.ruleVersion
          === READING_OPEN_RESPONSE_LOAD_GATED_CANDIDATE_RULE_VERSION,
        assessedAt: item.generationContext.generatedAt,
      });
      if (loadGateAssessment?.decision === 'blocked') {
        throw new QuestionCandidateLoadGateError(loadGateAssessment);
      }
      const usesStage2Progression = context.progressionStageRuleVersion
        === READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION;
      const groupLoadGateAssessment = usesStage2Progression
        ? undefined
        : assessCandidateTaskGroupLoad({
          candidateId,
          trainingTaskId,
          content: item.content,
          loadGateAssessment: loadGateAssessment || undefined,
          context,
          peerQuestions,
          assessedAt: item.generationContext.generatedAt,
        });
      if (groupLoadGateAssessment?.decision === 'blocked') {
        throw new QuestionCandidateGroupLoadGateError(groupLoadGateAssessment);
      }
      const taskLoadSemanticsVerification = context.taskLoadSemantics
        ? verifyTaskLoadSemantics({
          trainingTaskId,
          candidateId,
          plannedSemantics: context.taskLoadSemantics,
          plannedSemanticsHash: context.taskLoadSemanticsHash,
          candidateSemantics: context.taskLoadSemantics,
          responseFormat: item.content.responseFormat,
          recomputedTextResponseLoadProfile: item.textResponseLoadPlanning?.trace.finalProfile,
        })
        : undefined;
      if (taskLoadSemanticsVerification?.status === 'mismatched') {
        throw new QuestionCandidateConflictError(
          'TASK_LOAD_SEMANTICS_CONTENT_MISMATCH',
          'Generated Candidate content does not match the authoritative Task load semantics.',
        );
      }
      const taskGroupProgressionGateAssessment = usesStage2Progression
        ? assessCandidateProgression({
          candidateId,
          content: item.content,
          context,
          assessedAt: item.generationContext.generatedAt,
        })
        : undefined;
      if (taskGroupProgressionGateAssessment
        && ['blocked', 'insufficient_input'].includes(taskGroupProgressionGateAssessment.decision)) {
        throw new QuestionCandidateProgressionGateError(taskGroupProgressionGateAssessment);
      }
      const candidate = createQuestionCandidate({
        candidateId,
        generationCommandId: commandId,
        generationCommandFingerprint: requestFingerprint,
        trainingTaskId,
        candidateType: input.candidateType,
        basedOnCandidateId: input.baseCandidate?.candidateId,
        basedOnDraftId: context.activeDraftId,
        basedOnRevision: context.activeDraftRevision,
        basedOnContentHash: context.activeDraftContentHash,
        basedOnFormalResourceId: context.baseFormalResourceId,
        basedOnFormalVersionId: context.baseFormalVersionId,
        content: item.content,
        generationReason: item.generationReason,
        changedFields: item.changedFields,
        allowedFields: input.allowedFields,
        lockedFields: input.lockedFields,
        generationContext: {
          ...item.generationContext,
          trainingModelPolicyVersion: context.trainingModelPolicyVersion,
          trainingTaskLoadSemanticsHash: context.taskLoadSemanticsHash,
          progressionStageRuleVersion: context.progressionStageRuleVersion,
          planningTaskKey: context.planningTaskKey,
          taskGroupProgressionPlanHash: context.taskGroupProgressionPlanHash,
        },
        generationQuality: generationQuality[index],
        textResponseLoadPlanning: item.textResponseLoadPlanning,
        ...(loadGateAssessment ? { loadGateAssessment } : {}),
        ...(groupLoadGateAssessment ? { groupLoadGateAssessment } : {}),
        taskLoadSemantics: cloneTaskLoadSemantics(context.taskLoadSemantics),
        taskLoadSemanticsHash: context.taskLoadSemanticsHash,
        planningTaskKey: context.planningTaskKey,
        taskGroupProgressionPlanHash: context.taskGroupProgressionPlanHash,
        ...(taskGroupProgressionGateAssessment
          ? { taskGroupProgressionGateAssessment }
          : {}),
        taskLoadSemanticsVerification,
        status: 'ready',
        createdAt: item.generationContext.generatedAt,
      });
      candidates.push(await this.repository.saveCandidate(candidate));
    }
    await this.saveGenerationReceipt(
      input.command,
      idempotencyKey,
      requestFingerprint,
      candidates,
    );
    await this.supersedePreviousAiCandidates(
      trainingTaskId,
      candidates.map((candidate) => candidate.candidateId),
      candidates[0]?.createdAt || this.now(),
    );
    return candidates.map(cloneQuestionCandidate);
  }

  private async supersedePreviousAiCandidates(
    trainingTaskId: string,
    retainedCandidateIds: string[],
    occurredAt: string,
  ): Promise<void> {
    const retained = new Set(retainedCandidateIds);
    const previousCandidates = (await this.repository.listCandidates(trainingTaskId)).filter(
      (candidate) => (
        candidate.status === 'ready'
        && candidate.candidateOrigin !== 'training_task_compatibility_wrap'
        && !retained.has(candidate.candidateId)
      ),
    );
    for (const candidate of previousCandidates) {
      await this.repository.updateCandidateStatus({
        candidateId: candidate.candidateId,
        expectedStatus: 'ready',
        status: 'superseded',
        occurredAt,
      });
    }
  }

  private async requireCandidate(
    candidateId: string,
    trainingTaskId: string,
  ): Promise<QuestionCandidate> {
    const candidate = await this.repository.getCandidate(candidateId);
    if (!candidate) throw new Error(`Question candidate not found: ${candidateId}`);
    if (candidate.trainingTaskId !== trainingTaskId) {
      throw new QuestionCandidateConflictError(
        'CANDIDATE_TASK_MISMATCH',
        `Candidate ${candidateId} belongs to ${candidate.trainingTaskId}, not ${trainingTaskId}.`,
      );
    }
    return candidate;
  }

  private async requireCurrentContext(
    trainingTaskId: string,
    expected?: CandidateRuntimeContext,
  ): Promise<CandidateRuntimeContext> {
    const current = await this.contextGateway.getCurrentContext(trainingTaskId);
    if (expected && fingerprint(expected) !== fingerprint(current)) {
      throw new QuestionCandidateConflictError(
        'CANDIDATE_CONTEXT_CONFLICT',
        'Material, observation plan, training task, or active draft changed before the command.',
      );
    }
    return current;
  }

  private async ensureCandidateCurrent(
    candidate: QuestionCandidate,
    context: CandidateRuntimeContext,
  ): Promise<void> {
    if (candidateContextMatches(candidate, context)) return;
    if (candidate.status === 'ready') {
      await this.repository.updateCandidateStatus({
        candidateId: candidate.candidateId,
        expectedStatus: 'ready',
        status: 'expired',
        occurredAt: this.now(),
      });
    }
    throw new QuestionCandidateConflictError(
      'CANDIDATE_EXPIRED',
      `Candidate ${candidate.candidateId} no longer matches the current production context.`,
    );
  }

  private async ensureSuperseded(
    baseCandidate: QuestionCandidate,
    idempotencyKey: string,
  ): Promise<void> {
    const latest = await this.repository.getCandidate(baseCandidate.candidateId);
    if (latest?.status === 'ready') {
      await this.repository.updateCandidateStatus({
        candidateId: baseCandidate.candidateId,
        expectedStatus: 'ready',
        status: 'superseded',
        occurredAt: this.now(),
      });
    }
    const eventId = `regenerated:${idempotencyKey}`;
    const existingEvents = await this.repository.listDecisionEvents(baseCandidate.candidateId);
    if (existingEvents.some((event) => event.eventId === eventId)) return;
    await this.repository.saveDecisionEvent({
      eventId,
      candidateId: baseCandidate.candidateId,
      trainingTaskId: baseCandidate.trainingTaskId,
      decision: 'regenerated',
      reasonCodes: [],
      decidedBy: 'system',
      decidedAt: this.now(),
    });
  }

  private async ensureOptimizationDecision(
    baseCandidate: QuestionCandidate,
    candidates: QuestionCandidate[],
    input: OptimizeTaskCandidateInput,
  ): Promise<void> {
    const eventId = `optimized:${input.idempotencyKey}`;
    const existingEvents = await this.repository.listDecisionEvents(baseCandidate.candidateId);
    if (existingEvents.some((event) => event.eventId === eventId)) return;
    await this.repository.saveDecisionEvent({
      eventId,
      candidateId: baseCandidate.candidateId,
      trainingTaskId: baseCandidate.trainingTaskId,
      decision: 'optimized',
      reasonCodes: normalizeTextList(input.reasonCodes || []),
      note: normalizeTextList(input.goals).join(', '),
      relatedCandidateIds: candidates.map((candidate) => candidate.candidateId),
      decidedBy: 'system',
      decidedAt: candidates[0]?.createdAt || this.now(),
    });
  }

  private async reconcileAdoption(
    candidateId: string,
    input: AdoptTaskCandidateInput,
    adoption: CandidateAdoptionResult,
  ): Promise<void> {
    const candidate = await this.requireCandidate(candidateId, input.trainingTaskId);
    if (candidate.status === 'ready') {
      await this.repository.updateCandidateStatus({
        candidateId,
        expectedStatus: 'ready',
        status: 'adopted',
        occurredAt: adoption.adoptedAt,
      });
    } else if (candidate.status !== 'adopted') {
      throw new QuestionCandidateConflictError(
        'CANDIDATE_ADOPTION_STATE_CONFLICT',
        `Candidate ${candidateId} became ${candidate.status} during adoption.`,
      );
    }
    await this.repository.saveDecisionEvent({
      eventId: `adopted:${input.idempotencyKey}`,
      candidateId,
      trainingTaskId: input.trainingTaskId,
      decision: 'adopted',
      reasonCodes: [],
      decidedBy: input.adoptedBy,
      decidedAt: adoption.adoptedAt,
    });
  }

  private async readReceipt(
    command: CandidateCommandName,
    idempotencyKey: string,
    requestFingerprint: string,
  ): Promise<CandidateCommandReceipt | null> {
    const receipt = await this.repository.getCommandReceipt(command, idempotencyKey);
    if (receipt && receipt.requestFingerprint !== requestFingerprint) {
      throw new QuestionCandidateConflictError(
        'CANDIDATE_IDEMPOTENCY_CONFLICT',
        `Idempotency key ${idempotencyKey} was already used with another request.`,
      );
    }
    return receipt;
  }

  private async readGeneratedCandidates(
    receipt: CandidateCommandReceipt,
  ): Promise<QuestionCandidate[]> {
    if (receipt.result.kind !== 'candidate_generation') {
      throw new Error('Stored candidate generation receipt has an invalid result type.');
    }
    const candidates = await Promise.all(
      receipt.result.candidateIds.map((candidateId) => this.repository.getCandidate(candidateId)),
    );
    if (candidates.some((candidate) => !candidate)) {
      throw new Error('Candidate command receipt references a missing candidate.');
    }
    return candidates.map((candidate) => cloneQuestionCandidate(candidate!));
  }

  private async saveGenerationReceipt(
    command: CandidateGenerationCommandName,
    idempotencyKey: string,
    requestFingerprint: string,
    candidates: QuestionCandidate[],
  ): Promise<void> {
    await this.repository.saveCommandReceipt({
      command,
      idempotencyKey,
      requestFingerprint,
      result: {
        kind: 'candidate_generation',
        candidateIds: candidates.map((candidate) => candidate.candidateId),
      },
      createdAt: this.now(),
    });
  }
}

function assessCandidateProgression(input: {
  candidateId: string;
  content: QuestionEditableFields;
  context: CandidateRuntimeContext;
  assessedAt: string;
}): ReadingTaskGroupProgressionGateAssessment {
  const subjects = (input.context.taskGroupProgressionSubjects || []).map((subject) => (
    subject.planningTaskKey === input.context.planningTaskKey
      ? {
        ...subject,
        subjectId: input.candidateId,
        taskLoadSemantics: input.context.taskLoadSemantics || subject.taskLoadSemantics,
        taskLoadSemanticsHash: input.context.taskLoadSemanticsHash
          || subject.taskLoadSemanticsHash,
        taskGroupProgressionPlanHash: input.context.taskGroupProgressionPlanHash,
        observationObject: input.content.title,
        sourceAnchorIdentity: input.content.tags
          .filter((tag) => tag.startsWith('source_anchor:') || tag.startsWith('paragraph:'))
          .join('|') || subject.sourceAnchorIdentity,
        scoringTargetIds: input.content.rubric.map((rubric) => (
          `${rubric.abilityId}:${rubric.name}`
        )),
      }
      : {
        ...subject,
        taskGroupProgressionPlanHash: input.context.taskGroupProgressionPlanHash,
      }
  ));
  return assessReadingTaskGroupProgression({
    plan: input.context.taskGroupProgressionPlan,
    materialVersionId: input.context.materialVersionId,
    observationPlanRevisionId: input.context.taskGroupProgressionPlan
      ?.observationPlanRevisionId
      || `observation-plan:${input.context.observationPlanVersion}`,
    subjects,
    assessedAt: input.assessedAt,
  });
}

function assessCandidateTaskGroupLoad(input: {
  candidateId: string;
  trainingTaskId: string;
  content: QuestionEditableFields;
  loadGateAssessment?: ReadingOpenResponseLoadGateAssessment;
  context: CandidateRuntimeContext;
  peerQuestions: QuestionEditableFields[];
  assessedAt: string;
}): ReadingTaskGroupLoadGateAssessment {
  const allContents = [
    ...input.peerQuestions.map((content, index) => ({
      trainingTaskId: observationTaskId(content.tags) || `peer:${index + 1}`,
      subjectId: `peer:${calculateQuestionEditableFieldsHash(content)}`,
      content,
      loadGateAssessment: assessReadingOpenResponseLoadGate({
        subject: {
          kind: 'draft_revision',
          subjectId: `peer:${calculateQuestionEditableFieldsHash(content)}`,
        },
        trainingTaskId: observationTaskId(content.tags) || `peer:${index + 1}`,
        content,
        requireGenerationTrace: false,
        assessedAt: input.assessedAt,
      }) || undefined,
    })),
    {
      trainingTaskId: input.trainingTaskId,
      subjectId: input.candidateId,
      content: input.content,
      loadGateAssessment: input.loadGateAssessment,
    },
  ];
  const sequenceTags = allContents.flatMap((item) => item.content.tags);
  const strategyValue = tagValue(sequenceTags, 'sequence-strategy');
  const reasonValue = tagValue(sequenceTags, 'sequence-reason');
  const sequenceStrategy = isTrainingTaskSequenceStrategy(strategyValue)
    ? strategyValue
    : 'entry_first';
  const sequenceReasonCode = isTrainingTaskSequenceReason(reasonValue)
    ? reasonValue
    : 'default_foundation_entry';
  const completeSequenceIdentity = isTrainingTaskSequenceStrategy(strategyValue)
    && isTrainingTaskSequenceReason(reasonValue)
    && allContents.every((item) => Boolean(
      positiveTagValue(item.content.tags, 'sequence-rank'),
    ));
  return assessReadingTaskGroupLoadGate({
    materialVersionId: input.context.materialVersionId,
    observationPlanRevisionId: `observation-plan:${input.context.observationPlanVersion}`,
    items: allContents.map((item, index) => ({
      trainingTaskId: item.trainingTaskId,
      subjectId: item.subjectId,
      responseFormat: item.content.responseFormat,
      taskRole: item.content.abilityMetadata.taskRole,
      sequenceRank: positiveTagValue(item.content.tags, 'sequence-rank') || index + 1,
      sourceAnchorIds: item.content.tags.filter((tag) => (
        tag.startsWith('source_anchor:')
        || tag.startsWith('paragraph:')
        || tag.startsWith('material_scope:')
      )),
      observationObject: item.content.title,
      scoringTargetIds: item.content.rubric.map((rubric) => (
        `${rubric.abilityId}:${rubric.name}`
      )),
      higherOrderObservationId: item.loadGateAssessment?.recomputedLoadProfile.loadLevel
        === 'integrated'
        ? item.trainingTaskId
        : undefined,
      singleGateAssessment: item.loadGateAssessment,
    })),
    sequenceStrategy,
    sequenceReasonCode,
    enforceSequence: completeSequenceIdentity,
    targetedExcerpt: sequenceTags.some((tag) => (
      tag === 'usage_type:targeted_excerpt'
      || tag.startsWith('targeted_excerpt:')
    )),
    assessedAt: input.assessedAt,
  });
}

function observationTaskId(tags: string[]): string | undefined {
  return tagValue(tags, 'observation_task');
}

function tagValue(tags: string[], prefix: string): string | undefined {
  return tags.find((tag) => tag.startsWith(`${prefix}:`))?.slice(prefix.length + 1);
}

function positiveTagValue(tags: string[], prefix: string): number | undefined {
  const value = Number(tagValue(tags, prefix));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function validateOptimizedContent(
  base: QuestionEditableFields,
  generated: GeneratedQuestionCandidate,
  allowedFields: CandidateFieldKey[],
  lockedFields: CandidateFieldKey[],
): void {
  const changedTopLevelFields = Object.keys(base).filter((field) => (
    JSON.stringify(base[field as keyof QuestionEditableFields]) !==
    JSON.stringify(generated.content[field as keyof QuestionEditableFields])
  )) as Array<keyof QuestionEditableFields>;
  const changedLocked = lockedFields.filter((field) => candidateFieldChanged(
    base,
    generated.content,
    field,
  ));
  if (changedLocked.length > 0) {
    throw new QuestionCandidateConflictError(
      'CANDIDATE_LOCKED_FIELD_CHANGE',
      `Optimization changed locked fields: ${changedLocked.join(', ')}.`,
    );
  }
  const allowedTopLevelFields = new Set(allowedFields.flatMap(candidateTopLevelFields));
  const forbidden = changedTopLevelFields.filter((field) => !allowedTopLevelFields.has(field));
  if (forbidden.length > 0) {
    throw new QuestionCandidateConflictError(
      'CANDIDATE_UNDECLARED_FIELD_CHANGE',
      `Optimization changed fields outside allowedFields: ${forbidden.join(', ')}.`,
    );
  }
  const undeclaredChanges = allowedFields.filter((field) => (
    candidateFieldChanged(base, generated.content, field) &&
    !generated.changedFields.includes(field)
  ));
  if (undeclaredChanges.length > 0) {
    throw new QuestionCandidateConflictError(
      'CANDIDATE_CHANGE_SUMMARY_MISMATCH',
      `Optimization omitted changed fields from its summary: ${undeclaredChanges.join(', ')}.`,
    );
  }
  const actualChangedFields = OPTIMIZABLE_FIELDS.filter((field) => candidateFieldChanged(
    base,
    generated.content,
    field,
  ));
  if (actualChangedFields.length === 0) {
    throw new QuestionCandidateConflictError(
      'CANDIDATE_NO_EFFECTIVE_CHANGE',
      'Optimization did not produce an effective content change.',
    );
  }
  const declaredButUnchanged = generated.changedFields.filter((field) => (
    !actualChangedFields.includes(field)
  ));
  if (declaredButUnchanged.length > 0) {
    throw new QuestionCandidateConflictError(
      'CANDIDATE_CHANGE_SUMMARY_MISMATCH',
      `Optimization declared unchanged fields: ${declaredButUnchanged.join(', ')}.`,
    );
  }
}

function candidateTopLevelFields(field: CandidateFieldKey): Array<keyof QuestionEditableFields> {
  switch (field) {
    case 'abilityTarget': return ['abilityMetadata'];
    case 'specificTrainingPoint': return ['title'];
    case 'questionStem': return ['questionStem'];
    case 'studentTask': return ['questionStem', 'responseFormat', 'options', 'choiceInteraction', 'minimumAnswerRequirement'];
    case 'observationTarget': return ['rubric'];
    case 'answerAcceptance': return ['answerAcceptance'];
    case 'rubric': return ['rubric'];
    case 'materialScope': return ['materialVersionId', 'tags'];
    case 'sourceAttribution': return ['source'];
  }
}

function validateGenerationContext(
  generated: CandidateGenerationContext,
  current: CandidateRuntimeContext,
): void {
  requireText(generated.modelId, 'generationContext.modelId');
  requireText(generated.promptVersion, 'generationContext.promptVersion');
  requireText(generated.promptHash, 'generationContext.promptHash');
  requireText(generated.ruleVersion, 'generationContext.ruleVersion');
  requireText(generated.generatedAt, 'generationContext.generatedAt');
  if (
    generated.materialVersionId !== current.materialVersionId ||
    generated.observationPlanVersion !== current.observationPlanVersion ||
    generated.trainingTaskVersion !== current.trainingTaskVersion
  ) {
    throw new QuestionCandidateConflictError(
      'CANDIDATE_GENERATION_CONTEXT_MISMATCH',
      'Generator returned a candidate for a different production context.',
    );
  }
  if (current.progressionStageRuleVersion
    === READING_TRAINING_PROGRESSIVE_LOAD_STAGE2_RULE_VERSION
    && (
      generated.progressionStageRuleVersion !== current.progressionStageRuleVersion
      || generated.planningTaskKey !== current.planningTaskKey
      || generated.taskGroupProgressionPlanHash !== current.taskGroupProgressionPlanHash
    )) {
    throw new QuestionCandidateConflictError(
      'CANDIDATE_PROGRESSION_CONTEXT_MISMATCH',
      'Generator returned a Candidate for a different task-group progression plan.',
    );
  }
}

function validateNativeTaskLoadContext(
  current: CandidateRuntimeContext,
  generated: CandidateGenerationContext,
  responseFormat: QuestionEditableFields['responseFormat'],
): void {
  if (current.trainingModelPolicyVersion === undefined) return;
  if (current.trainingModelPolicyVersion
    !== READING_TRAINING_PROGRESSIVE_LOAD_POLICY_VERSION) {
    throw new QuestionCandidateConflictError(
      'TASK_LOAD_POLICY_UNSUPPORTED',
      'Training Model policy version is not supported.',
    );
  }
  if (!current.taskLoadSemantics
    || !isTaskLoadSemantics(current.taskLoadSemantics, responseFormat)) {
    throw new QuestionCandidateConflictError(
      'TASK_LOAD_SEMANTICS_INVALID',
      'Native progressive-load Candidate requires valid inherited Task semantics.',
    );
  }
  const expectedHash = calculateTaskLoadSemanticsHash(current.taskLoadSemantics);
  if (current.taskLoadSemanticsHash !== expectedHash) {
    throw new QuestionCandidateConflictError(
      'TASK_LOAD_SEMANTICS_HASH_MISMATCH',
      'Task load semantics hash does not match the inherited semantics.',
    );
  }
  if (generated.trainingModelPolicyVersion !== current.trainingModelPolicyVersion) {
    throw new QuestionCandidateConflictError(
      'TASK_LOAD_POLICY_CONTEXT_MISMATCH',
      'Generator returned a different Training Model policy version.',
    );
  }
  if (generated.trainingTaskLoadSemanticsHash !== expectedHash) {
    throw new QuestionCandidateConflictError(
      'TASK_LOAD_GENERATION_HASH_MISMATCH',
      'Generator returned a different Task load semantics hash.',
    );
  }
}

function validateAdoptionResult(
  candidate: QuestionCandidate,
  adoption: CandidateAdoptionResult,
): void {
  if (adoption.candidateId !== candidate.candidateId) {
    throw new Error('Candidate adoption gateway returned another candidate identity.');
  }
  if (adoption.contentHash !== candidate.contentHash) {
    throw new Error('Candidate adoption gateway returned another content hash.');
  }
  requireText(adoption.questionLineageId, 'adoption.questionLineageId');
  requireText(adoption.draftId, 'adoption.draftId');
  if (!Number.isInteger(adoption.revision) || adoption.revision < 1) {
    throw new Error('adoption.revision must be a positive integer.');
  }
}

function requireText(value: string, field: string): string {
  if (!value?.trim()) throw new Error(`${field} is required.`);
  return value.trim();
}

function requireCount(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error('count must be an integer between 1 and 5.');
  }
  return value;
}

function requireNonEmptyList(values: unknown[], field: string): void {
  if (values.length === 0) throw new Error(`${field} must contain at least one item.`);
}

function normalizeTextList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueFields(fields: CandidateFieldKey[]): CandidateFieldKey[] {
  return [...new Set(fields)];
}

function fingerprint(value: unknown): string {
  const serialized = stableSerialize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}
