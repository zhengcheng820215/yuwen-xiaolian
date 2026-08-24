import type { QuestionCandidateRepository } from
  '../repositories/questionCandidateRepository.ts';
import type { QuestionResourceAdmissionRepository } from
  '../repositories/questionResourceAdmissionRepository.ts';
import type { WorkingTaskContentRepository } from
  '../repositories/workingTaskContentRepository.ts';
import {
  CANDIDATE_FIELD_KEYS,
  candidateContextMatches,
  candidateFieldChanged,
  cloneQuestionCandidate,
  createQuestionCandidate,
  type CandidateFieldKey,
  type CandidateRuntimeContext,
  type QuestionCandidate,
} from '../schemas/questionCandidate.schema.ts';
import {
  QUESTION_CANDIDATE_CORRECTION_SCHEMA_VERSION,
  type ExceptionCorrectionPermissionRole,
  type ExceptionCorrectionReasonCode,
  type ExceptionCorrectionRecord,
  type ExceptionCorrectionTargetType,
  type WorkingContentMigrationResult,
} from '../schemas/questionCandidateCorrection.schema.ts';
import {
  calculateQuestionEditableFieldsHash,
  extractQuestionEditableFields,
  normalizeQuestionEditableFields,
  type QuestionEditableFields,
} from '../schemas/workingTaskContent.schema.ts';
import {
  getWorkingTaskContentState,
  resolveTrainingTaskId,
} from './workingTaskContentService.ts';
import { cloneTaskLoadSemantics } from
  '../schemas/readingTaskLoadSemantics.schema.ts';
import { verifyTaskLoadSemantics } from './readingTaskLoadSemanticsAgent.ts';

const CORRECTION_RULE_VERSION = 'question-candidate-correction-p5-v1';
const AUTHORIZED_ROLES: ExceptionCorrectionPermissionRole[] = [
  'resource_admin',
  'quality_reviewer',
];
const SUPPORTED_TOP_LEVEL_FIELDS = new Set<keyof QuestionEditableFields>([
  'materialVersionId',
  'title',
  'questionStem',
  'responseFormat',
  'options',
  'answerAcceptance',
  'rubric',
  'minimumAnswerRequirement',
  'abilityMetadata',
  'source',
  'tags',
]);

export type CreateExceptionCorrectionCandidateInput = {
  trainingTaskId: string;
  targetType: ExceptionCorrectionTargetType;
  targetId: string;
  correctedContent: QuestionEditableFields;
  reasonCode: ExceptionCorrectionReasonCode;
  note?: string;
  correctedBy: string;
  permissionRole: ExceptionCorrectionPermissionRole;
  expectedContext: CandidateRuntimeContext;
  idempotencyKey: string;
  sourceWorkingContentHash?: string;
};

export type ExceptionCorrectionCandidateResult = {
  candidate: QuestionCandidate;
  correctionRecord: ExceptionCorrectionRecord;
};

export class QuestionCandidateCorrectionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'QuestionCandidateCorrectionError';
    this.code = code;
  }
}

export class QuestionCandidateCorrectionService {
  private readonly candidateRepository: QuestionCandidateRepository;
  private readonly questionRepository: QuestionResourceAdmissionRepository;
  private readonly workingRepository: WorkingTaskContentRepository;
  private readonly now: () => string;

  constructor(
    candidateRepository: QuestionCandidateRepository,
    questionRepository: QuestionResourceAdmissionRepository,
    workingRepository: WorkingTaskContentRepository,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.candidateRepository = candidateRepository;
    this.questionRepository = questionRepository;
    this.workingRepository = workingRepository;
    this.now = now;
  }

  async createExceptionCorrectionCandidate(
    input: CreateExceptionCorrectionCandidateInput,
  ): Promise<ExceptionCorrectionCandidateResult> {
    const normalized = normalizeCorrectionInput(input);
    authorizeCorrection(normalized.permissionRole);
    const requestFingerprint = fingerprint(normalized);
    const receipt = await this.candidateRepository.getCommandReceipt(
      'correctTaskCandidate',
      normalized.idempotencyKey,
    );
    if (receipt) {
      assertReceiptFingerprint(receipt.requestFingerprint, requestFingerprint);
      if (receipt.result.kind !== 'candidate_correction') {
        throw new Error('Stored correction receipt has an invalid result type.');
      }
      return this.readCorrectionResult(
        receipt.result.candidateId,
        receipt.result.correctionId,
      );
    }

    const base = await this.resolveBase(normalized);
    const changedFields = resolveChangedFields(base.content, normalized.correctedContent);
    const unsupportedFields = resolveUnsupportedTopLevelChanges(
      base.content,
      normalized.correctedContent,
    );
    if (unsupportedFields.length > 0) {
      throw new QuestionCandidateCorrectionError(
        'CORRECTION_FIELD_NOT_SUPPORTED',
        `Exception correction cannot change unsupported fields: ${unsupportedFields.join(', ')}.`,
      );
    }
    if (changedFields.length === 0) {
      throw new QuestionCandidateCorrectionError(
        'CORRECTION_NO_CHANGES',
        'Exception correction did not change any supported field.',
      );
    }

    const correctedAt = this.now();
    const commandId = `correctTaskCandidate:${normalized.idempotencyKey}`;
    const candidateId = `${commandId}:1`;
    const correctionId = `exception-correction:${normalized.idempotencyKey}`;
    const existingCandidate = await this.candidateRepository.getCandidate(candidateId);
    if (existingCandidate) {
      if (existingCandidate.generationCommandFingerprint !== requestFingerprint) {
        throw idempotencyConflict(normalized.idempotencyKey);
      }
      const record = await this.candidateRepository.getCorrectionRecord(correctionId);
      if (!record) throw new Error('Correction candidate exists without its audit record.');
      await this.saveCorrectionReceipt(
        normalized.idempotencyKey,
        requestFingerprint,
        candidateId,
        correctionId,
        correctedAt,
      );
      return { candidate: existingCandidate, correctionRecord: record };
    }

    const lockedFields = CANDIDATE_FIELD_KEYS.filter(
      (field) => !changedFields.includes(field),
    );
    const candidate = createQuestionCandidate({
      candidateId,
      generationCommandId: commandId,
      generationCommandFingerprint: requestFingerprint,
      trainingTaskId: normalized.trainingTaskId,
      candidateType: 'exception_corrected',
      basedOnCandidateId: base.candidate?.candidateId,
      basedOnDraftId: base.draftId,
      basedOnRevision: base.revision,
      basedOnContentHash: base.contentHash,
      content: normalized.correctedContent,
      generationReason: correctionReason(normalized.reasonCode, normalized.note),
      changedFields,
      allowedFields: changedFields,
      lockedFields,
      generationContext: {
        modelId: 'human-exception-correction',
        promptVersion: 'exception-correction-v1',
        promptHash: requestFingerprint,
        ruleVersion: CORRECTION_RULE_VERSION,
        materialVersionId: normalized.expectedContext.materialVersionId,
        observationPlanVersion: normalized.expectedContext.observationPlanVersion,
        trainingTaskVersion: normalized.expectedContext.trainingTaskVersion,
        trainingModelPolicyVersion: normalized.expectedContext.trainingModelPolicyVersion,
        trainingTaskLoadSemanticsHash: normalized.expectedContext.taskLoadSemanticsHash,
        generatedAt: correctedAt,
      },
      taskLoadSemantics: cloneTaskLoadSemantics(
        normalized.expectedContext.taskLoadSemantics,
      ),
      taskLoadSemanticsHash: normalized.expectedContext.taskLoadSemanticsHash,
      taskLoadSemanticsVerification: normalized.expectedContext.taskLoadSemantics
        ? verifyTaskLoadSemantics({
          trainingTaskId: normalized.trainingTaskId,
          candidateId,
          plannedSemantics: normalized.expectedContext.taskLoadSemantics,
          plannedSemanticsHash: normalized.expectedContext.taskLoadSemanticsHash,
          responseFormat: normalized.correctedContent.responseFormat,
        })
        : undefined,
      status: 'ready',
      createdAt: correctedAt,
    });
    const correctionRecord: ExceptionCorrectionRecord = {
      correctionId,
      candidateId,
      trainingTaskId: normalized.trainingTaskId,
      targetType: normalized.targetType,
      targetId: normalized.targetId,
      reasonCode: normalized.reasonCode,
      beforeHash: base.contentHash,
      afterHash: candidate.contentHash,
      changedFields,
      correctedBy: normalized.correctedBy,
      permissionRole: normalized.permissionRole,
      note: normalized.note,
      sourceWorkingContentHash: normalized.sourceWorkingContentHash,
      correctedAt,
      schemaVersion: QUESTION_CANDIDATE_CORRECTION_SCHEMA_VERSION,
    };
    await this.candidateRepository.saveCandidate(candidate);
    await this.candidateRepository.saveCorrectionRecord(correctionRecord);
    await this.saveCorrectionReceipt(
      normalized.idempotencyKey,
      requestFingerprint,
      candidateId,
      correctionId,
      correctedAt,
    );
    return {
      candidate: cloneQuestionCandidate(candidate),
      correctionRecord: cloneQuestionCandidate(correctionRecord),
    };
  }

  async migrateWorkingTaskContent(input: {
    trainingTaskId: string;
    correctedBy: string;
    permissionRole: ExceptionCorrectionPermissionRole;
    expectedContext: CandidateRuntimeContext;
    idempotencyKey: string;
  }): Promise<WorkingContentMigrationResult> {
    authorizeCorrection(input.permissionRole);
    const trainingTaskId = requireText(input.trainingTaskId, 'trainingTaskId');
    const idempotencyKey = requireText(input.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint({
      trainingTaskId,
      correctedBy: input.correctedBy,
      permissionRole: input.permissionRole,
      expectedContext: input.expectedContext,
    });
    const receipt = await this.candidateRepository.getCommandReceipt(
      'migrateWorkingTaskContent',
      idempotencyKey,
    );
    if (receipt) {
      assertReceiptFingerprint(receipt.requestFingerprint, requestFingerprint);
      if (receipt.result.kind !== 'working_content_migration') {
        throw new Error('Stored migration receipt has an invalid result type.');
      }
      return {
        status: receipt.result.status,
        trainingTaskId,
        ...(receipt.result.candidateId && receipt.result.correctionId
          ? {
            candidateId: receipt.result.candidateId,
            correctionId: receipt.result.correctionId,
          }
          : {}),
        ...(receipt.result.status === 'requires_protected_resolution'
          ? { reason: 'contains_training_task_fields' as const }
          : {}),
      } as WorkingContentMigrationResult;
    }

    const state = await getWorkingTaskContentState(
      this.workingRepository,
      this.questionRepository,
      trainingTaskId,
    );
    if (state.status === 'missing') return { status: 'missing', trainingTaskId };
    if (state.status === 'base_revision_conflict') {
      return {
        status: 'base_revision_conflict',
        trainingTaskId,
        reason: state.reason,
      };
    }
    const working = state.workingContent;
    const baseDraft = await this.questionRepository.getDraft(working.baseDraftId);
    if (!baseDraft) {
      return {
        status: 'base_revision_conflict',
        trainingTaskId,
        reason: 'base_draft_missing',
      };
    }
    const baseContent = extractQuestionEditableFields(baseDraft);
    const unsupportedFields = resolveUnsupportedTopLevelChanges(baseContent, working.content);
    if (working.taskContent || unsupportedFields.length > 0) {
      await this.saveMigrationReceipt({
        idempotencyKey,
        requestFingerprint,
        status: 'requires_protected_resolution',
      });
      return {
        status: 'requires_protected_resolution',
        trainingTaskId,
        reason: 'contains_training_task_fields',
      };
    }
    if (calculateQuestionEditableFieldsHash(baseContent) ===
      calculateQuestionEditableFieldsHash(working.content)) {
      await this.saveMigrationReceipt({
        idempotencyKey,
        requestFingerprint,
        status: 'no_changes',
      });
      await this.workingRepository.delete(trainingTaskId);
      return { status: 'no_changes', trainingTaskId };
    }

    const correction = await this.createExceptionCorrectionCandidate({
      trainingTaskId,
      targetType: 'question_revision',
      targetId: `${working.baseDraftId}:r${working.baseRevision}`,
      correctedContent: working.content,
      reasonCode: 'legacy_working_content',
      note: '由旧人工工作内容迁移为异常纠错候选。',
      correctedBy: requireText(input.correctedBy, 'correctedBy'),
      permissionRole: input.permissionRole,
      expectedContext: input.expectedContext,
      idempotencyKey: `migration-correction:${idempotencyKey}`,
      sourceWorkingContentHash: working.workingContentHash,
    });
    await this.saveMigrationReceipt({
      idempotencyKey,
      requestFingerprint,
      status: 'migrated',
      candidateId: correction.candidate.candidateId,
      correctionId: correction.correctionRecord.correctionId,
    });
    await this.workingRepository.delete(trainingTaskId);
    return {
      status: 'migrated',
      trainingTaskId,
      candidateId: correction.candidate.candidateId,
      correctionId: correction.correctionRecord.correctionId,
    };
  }

  private async resolveBase(input: ReturnType<typeof normalizeCorrectionInput>): Promise<{
    content: QuestionEditableFields;
    contentHash: string;
    candidate?: QuestionCandidate;
    draftId?: string;
    revision?: number;
  }> {
    if (input.targetType === 'candidate') {
      const candidate = await this.candidateRepository.getCandidate(input.targetId);
      if (!candidate) throw new Error(`Question candidate not found: ${input.targetId}`);
      if (candidate.trainingTaskId !== input.trainingTaskId) {
        throw new QuestionCandidateCorrectionError(
          'CORRECTION_TASK_MISMATCH',
          'Correction target belongs to another training task.',
        );
      }
      if (candidate.status !== 'ready' || !candidateContextMatches(candidate, input.expectedContext)) {
        throw new QuestionCandidateCorrectionError(
          'CORRECTION_TARGET_NOT_CURRENT',
          'Only a current ready candidate can be corrected.',
        );
      }
      return {
        content: candidate.content,
        contentHash: candidate.contentHash,
        candidate,
        draftId: candidate.basedOnDraftId,
        revision: candidate.basedOnRevision,
      };
    }

    const draftId = input.targetId.split(':r')[0] || input.targetId;
    const draft = await this.questionRepository.getDraft(draftId);
    if (!draft) throw new Error(`Question draft not found: ${draftId}`);
    if (resolveTrainingTaskId(draft) !== input.trainingTaskId) {
      throw new QuestionCandidateCorrectionError(
        'CORRECTION_TASK_MISMATCH',
        'Correction target belongs to another training task.',
      );
    }
    if (
      input.expectedContext.activeDraftId !== draft.draftId ||
      input.expectedContext.activeDraftRevision !== draft.revision
    ) {
      throw new QuestionCandidateCorrectionError(
        'CORRECTION_TARGET_NOT_CURRENT',
        'Question revision changed before the correction candidate was created.',
      );
    }
    const content = extractQuestionEditableFields(draft);
    const contentHash = calculateQuestionEditableFieldsHash(content);
    if (input.expectedContext.activeDraftContentHash !== contentHash) {
      throw new QuestionCandidateCorrectionError(
        'CORRECTION_TARGET_NOT_CURRENT',
        'Question content changed before the correction candidate was created.',
      );
    }
    return { content, contentHash, draftId: draft.draftId, revision: draft.revision };
  }

  private async readCorrectionResult(
    candidateId: string,
    correctionId: string,
  ): Promise<ExceptionCorrectionCandidateResult> {
    const [candidate, correctionRecord] = await Promise.all([
      this.candidateRepository.getCandidate(candidateId),
      this.candidateRepository.getCorrectionRecord(correctionId),
    ]);
    if (!candidate || !correctionRecord) {
      throw new Error('Correction receipt references missing persisted data.');
    }
    return { candidate, correctionRecord };
  }

  private async saveCorrectionReceipt(
    idempotencyKey: string,
    requestFingerprint: string,
    candidateId: string,
    correctionId: string,
    createdAt: string,
  ): Promise<void> {
    await this.candidateRepository.saveCommandReceipt({
      command: 'correctTaskCandidate',
      idempotencyKey,
      requestFingerprint,
      result: { kind: 'candidate_correction', candidateId, correctionId },
      createdAt,
    });
  }

  private async saveMigrationReceipt(input: {
    idempotencyKey: string;
    requestFingerprint: string;
    status: 'migrated' | 'no_changes' | 'requires_protected_resolution';
    candidateId?: string;
    correctionId?: string;
  }): Promise<void> {
    await this.candidateRepository.saveCommandReceipt({
      command: 'migrateWorkingTaskContent',
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.requestFingerprint,
      result: {
        kind: 'working_content_migration',
        status: input.status,
        candidateId: input.candidateId,
        correctionId: input.correctionId,
      },
      createdAt: this.now(),
    });
  }
}

function normalizeCorrectionInput(input: CreateExceptionCorrectionCandidateInput) {
  const reasonCode = input.reasonCode;
  const note = input.note?.trim() || undefined;
  if (reasonCode === 'other' && !note) {
    throw new QuestionCandidateCorrectionError(
      'CORRECTION_NOTE_REQUIRED',
      'A note is required for the other correction reason.',
    );
  }
  return {
    ...input,
    trainingTaskId: requireText(input.trainingTaskId, 'trainingTaskId'),
    targetId: requireText(input.targetId, 'targetId'),
    correctedBy: requireText(input.correctedBy, 'correctedBy'),
    idempotencyKey: requireText(input.idempotencyKey, 'idempotencyKey'),
    correctedContent: normalizeQuestionEditableFields(input.correctedContent),
    note,
  };
}

function authorizeCorrection(role: ExceptionCorrectionPermissionRole): void {
  if (AUTHORIZED_ROLES.includes(role)) return;
  throw new QuestionCandidateCorrectionError(
    'CORRECTION_FORBIDDEN',
    'Current role cannot create an exception correction candidate.',
  );
}

function resolveChangedFields(
  base: QuestionEditableFields,
  corrected: QuestionEditableFields,
): CandidateFieldKey[] {
  return CANDIDATE_FIELD_KEYS.filter((field) => candidateFieldChanged(base, corrected, field));
}

function resolveUnsupportedTopLevelChanges(
  base: QuestionEditableFields,
  corrected: QuestionEditableFields,
): Array<keyof QuestionEditableFields> {
  return (Object.keys(base) as Array<keyof QuestionEditableFields>).filter((field) => (
    JSON.stringify(base[field]) !== JSON.stringify(corrected[field]) &&
    !SUPPORTED_TOP_LEVEL_FIELDS.has(field)
  ));
}

function correctionReason(reasonCode: ExceptionCorrectionReasonCode, note?: string): string {
  return note ? `${reasonCode}: ${note}` : reasonCode;
}

function requireText(value: string, field: string): string {
  if (!value?.trim()) throw new Error(`${field} is required.`);
  return value.trim();
}

function fingerprint(value: unknown): string {
  const serialized = JSON.stringify(sortValue(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValue(child)]),
  );
}

function assertReceiptFingerprint(actual: string, expected: string): void {
  if (actual === expected) return;
  throw idempotencyConflict('provided');
}

function idempotencyConflict(idempotencyKey: string): QuestionCandidateCorrectionError {
  return new QuestionCandidateCorrectionError(
    'CORRECTION_IDEMPOTENCY_CONFLICT',
    `Idempotency key ${idempotencyKey} was already used with another request.`,
  );
}
