import {
  buildFeedbackGuidedRevisionId,
  buildLearningTaskAttemptId,
  buildRevisedResponseId,
} from '../agents/learningFeedbackRevisionIdentity.ts';
import type { LearningTaskAttemptRepository } from '../repositories/learningTaskAttemptRepository.ts';
import {
  LEARNING_FEEDBACK_REVISION_SCHEMA_VERSION,
  isLearningTaskAttemptRecord,
  type LearningTaskAttemptRecord,
  type FeedbackSupportedRevisionEvidence,
  type RevisionEvaluation,
  type RevisionEvaluationIssue,
  type RevisionGoal,
} from '../schemas/learningFeedbackRevision.schema.ts';
import type { GrowthMemoryRecord } from '../schemas/growthMemory.schema.ts';
import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import type { ProfileUpdateDecision } from '../schemas/profileUpdateDecision.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import type { StudentResponse } from '../schemas/taskExecution.schema.ts';
import type { LearningFeedbackRevisionOfferDecision } from '../agents/learningFeedbackRevisionOfferPolicy.ts';

export type CreateLearningTaskAttemptInput = {
  initialAttemptId: string;
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  operationId: string;
  materialVersionId: string;
  resourceId: string;
  resourceVersionId: string;
  taskId: string;
  taskRole: RecommendedTaskRole;
  rubricVersion: string;
  initialResponse: StudentResponse;
  initialDiagnosisId: string;
  initialDiagnosisSchemaVersion: string;
  initialFeedbackId: string;
  initialFeedbackSchemaVersion: string;
  createdAt?: string;
};

export type LearningTaskAttemptRecovery = {
  status:
    | 'not_found'
    | 'feedback_ready'
    | 'revision_draft'
    | 'revision_submitted'
    | 'revision_evaluating'
    | 'revision_evaluated'
    | 'revision_evaluation_pending_retry'
    | 'completed';
  record?: LearningTaskAttemptRecord;
};

export class LearningFeedbackRevisionPersistenceService {
  private readonly repository: LearningTaskAttemptRepository;
  private readonly now: () => string;

  constructor(
    repository: LearningTaskAttemptRepository,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.repository = repository;
    this.now = now;
  }

  async createInitialAttempt(input: CreateLearningTaskAttemptInput): Promise<LearningTaskAttemptRecord> {
    const createdAt = input.createdAt || input.initialResponse.submittedAt;
    const record: LearningTaskAttemptRecord = {
      schemaVersion: LEARNING_FEEDBACK_REVISION_SCHEMA_VERSION,
      learningTaskAttemptId: buildLearningTaskAttemptId(input),
      initialAttemptId: input.initialAttemptId,
      studentId: input.studentId,
      learningSessionId: input.learningSessionId,
      learningRoundId: input.learningRoundId,
      operationId: input.operationId,
      materialVersionId: input.materialVersionId,
      resourceId: input.resourceId,
      resourceVersionId: input.resourceVersionId,
      taskId: input.taskId,
      taskRole: input.taskRole,
      rubricVersion: input.rubricVersion,
      initialResponse: structuredClone(input.initialResponse),
      initialDiagnosisId: input.initialDiagnosisId,
      initialDiagnosisSchemaVersion: input.initialDiagnosisSchemaVersion,
      initialFeedbackId: input.initialFeedbackId,
      initialFeedbackSchemaVersion: input.initialFeedbackSchemaVersion,
      status: 'feedback_presented',
      createdAt,
      updatedAt: createdAt,
    };
    if (!isLearningTaskAttemptRecord(record)) throw new Error('learning_task_attempt_input_invalid');
    const existing = await this.repository.getByInitialAttemptId(input.initialAttemptId);
    if (existing) {
      if (!sameInitialAttempt(existing, record)) {
        throw new Error('learning_task_attempt_initial_identity_conflict');
      }
      return existing;
    }
    const result = await this.repository.save(record);
    if (result.status === 'conflict') throw new Error(result.issues.join('|') || 'learning_task_attempt_conflict');
    return result.record;
  }

  async startRevision(
    learningTaskAttemptId: string,
    revisionGoal: RevisionGoal,
    occurredAt = this.now(),
  ): Promise<LearningTaskAttemptRecord> {
    const existing = await this.requireAttempt(learningTaskAttemptId);
    if (existing.revision) {
      if (existing.revision.status === 'draft'
        && JSON.stringify(existing.revision.revisionGoal) === JSON.stringify(revisionGoal)) return existing;
      throw new Error('learning_task_attempt_revision_already_started');
    }
    if (existing.status !== 'feedback_presented') {
      throw new Error('learning_task_attempt_revision_already_started');
    }
    const revisionId = buildFeedbackGuidedRevisionId({
      learningTaskAttemptId,
      initialResponseId: existing.initialResponse.responseId,
    });
    return this.saveOrThrow({
      ...existing,
      status: 'revision_draft',
      revision: {
        revisionId,
        initialResponseId: existing.initialResponse.responseId,
        status: 'draft',
        revisionGoal: structuredClone(revisionGoal),
        draftAnswer: existing.initialResponse.answerText,
        draftUpdatedAt: occurredAt,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      },
      updatedAt: occurredAt,
    });
  }

  async recordRevisionOfferDecision(
    learningTaskAttemptId: string,
    decision: LearningFeedbackRevisionOfferDecision,
    decidedAt = this.now(),
  ): Promise<LearningTaskAttemptRecord> {
    const existing = await this.requireAttempt(learningTaskAttemptId);
    const effectiveDecidedAt = existing.revisionOfferDecision?.decidedAt || decidedAt;
    const snapshot = {
      policyVersion: decision.policyVersion,
      level: decision.level,
      reason: decision.reason,
      eligible: decision.level === 'optional' || decision.level === 'recommended',
      actionLabel: decision.actionLabel,
      primaryIssueCode: decision.revisionGoal?.primaryIssueCode,
      sourceDiagnosisId: existing.initialDiagnosisId,
      sourceFeedbackId: existing.initialFeedbackId,
      decidedAt: effectiveDecidedAt,
    } as const;
    if (existing.revisionOfferDecision) {
      if (JSON.stringify(existing.revisionOfferDecision) === JSON.stringify(snapshot)) return existing;
      throw new Error('learning_task_attempt_revision_offer_immutable');
    }
    return this.saveOrThrow({
      ...existing,
      revisionOfferDecision: snapshot,
      updatedAt: decidedAt,
    });
  }

  async saveRevisionDraft(
    learningTaskAttemptId: string,
    draftAnswer: string,
    occurredAt = this.now(),
  ): Promise<LearningTaskAttemptRecord> {
    const existing = await this.requireAttempt(learningTaskAttemptId);
    if (existing.status !== 'revision_draft' || existing.revision?.status !== 'draft') {
      throw new Error('learning_task_attempt_revision_not_editable');
    }
    return this.saveOrThrow({
      ...existing,
      revision: {
        ...existing.revision,
        draftAnswer,
        draftUpdatedAt: occurredAt,
        updatedAt: occurredAt,
      },
      updatedAt: occurredAt,
    });
  }

  async submitRevision(
    learningTaskAttemptId: string,
    answerText: string,
    submittedAt = this.now(),
  ): Promise<LearningTaskAttemptRecord> {
    const existing = await this.requireAttempt(learningTaskAttemptId);
    if (existing.revision?.revisedResponse) {
      if (existing.revision.revisedResponse.answerText === answerText) return existing;
      throw new Error('learning_task_attempt_revised_response_immutable');
    }
    if (existing.status !== 'revision_draft' || existing.revision?.status !== 'draft') {
      throw new Error('learning_task_attempt_revision_not_submittable');
    }
    if (!answerText.trim()) throw new Error('learning_task_attempt_revision_answer_empty');
    const responseId = buildRevisedResponseId({ revisionId: existing.revision.revisionId });
    return this.saveOrThrow({
      ...existing,
      status: 'revision_submitted',
      revision: {
        ...existing.revision,
        status: 'submitted',
        draftAnswer: answerText,
        draftUpdatedAt: submittedAt,
        revisedResponse: {
          responseId,
          revisionId: existing.revision.revisionId,
          initialResponseId: existing.initialResponse.responseId,
          studentId: existing.studentId,
          taskId: existing.taskId,
          answerText,
          submittedAt,
        },
        updatedAt: submittedAt,
      },
      updatedAt: submittedAt,
    });
  }

  async completeInitialOnly(
    learningTaskAttemptId: string,
    completedAt = this.now(),
  ): Promise<LearningTaskAttemptRecord> {
    const existing = await this.requireAttempt(learningTaskAttemptId);
    if (existing.status !== 'feedback_presented' || existing.revision) {
      throw new Error('learning_task_attempt_initial_only_not_completable');
    }
    return this.saveOrThrow({ ...existing, status: 'completed_initial_only', updatedAt: completedAt });
  }

  async abandonRevision(
    learningTaskAttemptId: string,
    abandonedAt = this.now(),
  ): Promise<LearningTaskAttemptRecord> {
    const existing = await this.requireAttempt(learningTaskAttemptId);
    if (existing.status === 'completed_initial_only' && existing.revision?.status === 'abandoned') {
      return existing;
    }
    if (existing.status !== 'revision_draft' || existing.revision?.status !== 'draft') {
      throw new Error('learning_task_attempt_revision_not_abandonable');
    }
    return this.saveOrThrow({
      ...existing,
      status: 'completed_initial_only',
      revision: {
        ...existing.revision,
        status: 'abandoned',
        updatedAt: abandonedAt,
      },
      updatedAt: abandonedAt,
    });
  }

  async startRevisionEvaluation(
    learningTaskAttemptId: string,
    startedAt = this.now(),
  ): Promise<LearningTaskAttemptRecord> {
    const existing = await this.requireAttempt(learningTaskAttemptId);
    if (existing.status === 'revision_evaluating' || existing.status === 'completed_with_revision') return existing;
    if (existing.status === 'completed_with_revision_pending_evaluation') {
      if (existing.revision?.status !== 'evaluation_pending_retry') {
        throw new Error('learning_task_attempt_revision_retry_state_invalid');
      }
      return this.saveOrThrow({
        ...existing,
        revision: {
          ...existing.revision,
          evaluationAttemptCount: (existing.revision.evaluationAttemptCount || 0) + 1,
          updatedAt: startedAt,
        },
        updatedAt: startedAt,
      });
    }
    if (existing.status !== 'revision_submitted' || existing.revision?.status !== 'submitted') {
      throw new Error('learning_task_attempt_revision_not_evaluable');
    }
    return this.saveOrThrow({
      ...existing,
      status: 'revision_evaluating',
      revision: {
        ...existing.revision,
        status: 'evaluating',
        evaluationIssue: undefined,
        evaluationAttemptCount: (existing.revision.evaluationAttemptCount || 0) + 1,
        updatedAt: startedAt,
      },
      updatedAt: startedAt,
    });
  }

  async completeRevisionEvaluation(
    learningTaskAttemptId: string,
    bundle: {
      evaluation: RevisionEvaluation;
      feedbackSupportedEvidence: FeedbackSupportedRevisionEvidence;
      profileUpdateDecision: ProfileUpdateDecision;
      profileAfterRevision: StudentAbilityProfile;
      growthMemoryRecord: GrowthMemoryRecord;
    },
    completedAt = this.now(),
  ): Promise<LearningTaskAttemptRecord> {
    const existing = await this.requireAttempt(learningTaskAttemptId);
    if (existing.status === 'completed_with_revision' && existing.revision?.evaluation) {
      if (existing.revision.evaluation.revisionEvaluationId === bundle.evaluation.revisionEvaluationId) return existing;
      throw new Error('learning_task_attempt_revision_evaluation_immutable');
    }
    if (!existing.revision?.revisedResponse) throw new Error('learning_task_attempt_revision_response_missing');
    if (!['revision_evaluating', 'completed_with_revision_pending_evaluation'].includes(existing.status)) {
      throw new Error('learning_task_attempt_revision_evaluation_not_completable');
    }
    const evaluated: LearningTaskAttemptRecord = {
      ...existing,
      status: 'revision_evaluated',
      revision: {
        ...existing.revision,
        status: 'evaluated',
        evaluation: structuredClone(bundle.evaluation),
        feedbackSupportedEvidence: structuredClone(bundle.feedbackSupportedEvidence),
        profileUpdateDecision: structuredClone(bundle.profileUpdateDecision),
        profileAfterRevision: structuredClone(bundle.profileAfterRevision),
        growthMemoryRecord: structuredClone(bundle.growthMemoryRecord),
        evaluationIssue: undefined,
        updatedAt: completedAt,
      },
      updatedAt: completedAt,
    };
    const persisted = existing.status === 'revision_evaluating'
      ? await this.saveOrThrow(evaluated)
      : evaluated;
    return this.saveOrThrow({
      ...persisted,
      status: 'completed_with_revision',
      updatedAt: completedAt,
    });
  }

  async markRevisionEvaluationPendingRetry(
    learningTaskAttemptId: string,
    issue: Omit<RevisionEvaluationIssue, 'attemptCount' | 'lastFailedAt'>,
    failedAt = this.now(),
  ): Promise<LearningTaskAttemptRecord> {
    const existing = await this.requireAttempt(learningTaskAttemptId);
    if (existing.status === 'completed_with_revision') return existing;
    if (!existing.revision?.revisedResponse || ![
      'revision_submitted',
      'revision_evaluating',
      'completed_with_revision_pending_evaluation',
    ].includes(existing.status)) {
      throw new Error('learning_task_attempt_revision_evaluation_failure_not_recordable');
    }
    const attemptCount = Math.max(
      existing.revision.evaluationAttemptCount || 0,
      existing.revision.evaluationIssue?.attemptCount || 0,
      1,
    );
    return this.saveOrThrow({
      ...existing,
      status: 'completed_with_revision_pending_evaluation',
      revision: {
        ...existing.revision,
        status: 'evaluation_pending_retry',
        evaluationAttemptCount: attemptCount,
        evaluationIssue: {
          ...issue,
          attemptCount,
          lastFailedAt: failedAt,
        },
        updatedAt: failedAt,
      },
      updatedAt: failedAt,
    });
  }

  async recover(studentId: string, learningRoundId: string): Promise<LearningTaskAttemptRecovery> {
    const records = await this.repository.listByRound(studentId, learningRoundId);
    const record = records.at(-1);
    if (!record) return { status: 'not_found' };
    const statusMap: Record<LearningTaskAttemptRecord['status'], LearningTaskAttemptRecovery['status']> = {
      feedback_presented: 'feedback_ready',
      revision_draft: 'revision_draft',
      revision_submitted: 'revision_submitted',
      revision_evaluating: 'revision_evaluating',
      revision_evaluated: 'revision_evaluated',
      revision_evaluation_pending_retry: 'revision_evaluation_pending_retry',
      completed_initial_only: 'completed',
      completed_with_revision: 'completed',
      completed_with_revision_pending_evaluation: 'completed',
    };
    return { status: statusMap[record.status], record };
  }

  private async requireAttempt(learningTaskAttemptId: string): Promise<LearningTaskAttemptRecord> {
    const record = await this.repository.getById(learningTaskAttemptId);
    if (!record) throw new Error('learning_task_attempt_not_found');
    return record;
  }

  private async saveOrThrow(record: LearningTaskAttemptRecord): Promise<LearningTaskAttemptRecord> {
    const result = await this.repository.save(record);
    if (result.status === 'conflict') throw new Error(result.issues.join('|') || 'learning_task_attempt_conflict');
    return result.record;
  }
}

function sameInitialAttempt(
  existing: LearningTaskAttemptRecord,
  candidate: LearningTaskAttemptRecord,
): boolean {
  return existing.learningTaskAttemptId === candidate.learningTaskAttemptId
    && existing.studentId === candidate.studentId
    && existing.learningSessionId === candidate.learningSessionId
    && existing.learningRoundId === candidate.learningRoundId
    && existing.operationId === candidate.operationId
    && existing.materialVersionId === candidate.materialVersionId
    && existing.resourceId === candidate.resourceId
    && existing.resourceVersionId === candidate.resourceVersionId
    && existing.taskId === candidate.taskId
    && existing.taskRole === candidate.taskRole
    && existing.rubricVersion === candidate.rubricVersion
    && existing.initialDiagnosisId === candidate.initialDiagnosisId
    && existing.initialDiagnosisSchemaVersion === candidate.initialDiagnosisSchemaVersion
    && existing.initialFeedbackId === candidate.initialFeedbackId
    && existing.initialFeedbackSchemaVersion === candidate.initialFeedbackSchemaVersion
    && JSON.stringify(existing.initialResponse) === JSON.stringify(candidate.initialResponse)
    && existing.createdAt === candidate.createdAt;
}
