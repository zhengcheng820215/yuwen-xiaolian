import type { RecommendedTaskRole } from './nextLearningStrategy.schema.ts';
import { isGrowthMemoryRecord, type GrowthMemoryRecord } from './growthMemory.schema.ts';
import { isProfileUpdateDecision, type ProfileUpdateDecision } from './profileUpdateDecision.schema.ts';
import { isStudentAbilityProfile, type StudentAbilityProfile } from './studentAbilityProfile.schema.ts';
import { isStudentResponse, type StudentResponse } from './taskExecution.schema.ts';

export const LEARNING_FEEDBACK_REVISION_SCHEMA_VERSION =
  'learning_feedback_revision_v1' as const;
export const REVISION_EVALUATION_SCHEMA_VERSION =
  'revision_evaluation_v2' as const;
export const FEEDBACK_SUPPORTED_REVISION_EVIDENCE_SCHEMA_VERSION =
  'feedback_supported_revision_evidence_v1' as const;

export type LearningTaskAttemptStatus =
  | 'feedback_presented'
  | 'revision_draft'
  | 'revision_submitted'
  | 'revision_evaluating'
  | 'revision_evaluated'
  | 'revision_evaluation_pending_retry'
  | 'completed_initial_only'
  | 'completed_with_revision'
  | 'completed_with_revision_pending_evaluation';

export type FeedbackGuidedRevisionStatus =
  | 'draft'
  | 'abandoned'
  | 'submitted'
  | 'evaluating'
  | 'evaluated'
  | 'evaluation_pending_retry';

export type RevisionOutcome =
  | 'improved'
  | 'partially_improved'
  | 'unchanged'
  | 'regressed';

export type RevisionGoal = {
  primaryIssueCode: string;
  relatedIssueCodes: string[];
  instruction: string;
  sourceDiagnosisId: string;
  sourceFeedbackId: string;
};

export type LearningFeedbackRevisionOfferSnapshot = {
  policyVersion: string;
  level: 'none' | 'optional' | 'recommended';
  reason: string;
  eligible: boolean;
  actionLabel?: '根据反馈修订' | '完善回答';
  primaryIssueCode?: string;
  sourceDiagnosisId: string;
  sourceFeedbackId: string;
  decidedAt: string;
};

export type RevisedResponse = {
  responseId: string;
  revisionId: string;
  initialResponseId: string;
  studentId: string;
  taskId: string;
  answerText: string;
  submittedAt: string;
};

export type RevisionEvaluation = {
  schemaVersion: typeof REVISION_EVALUATION_SCHEMA_VERSION;
  revisionEvaluationId: string;
  revisionId: string;
  outcome: RevisionOutcome;
  feedbackRespondedTo: boolean;
  resolvedIssueCodes: string[];
  remainingIssueCodes: string[];
  newIssueCodes: string[];
  improvedObservation: string;
  remainingFocus?: string;
  nextSimilarTaskAction: string;
  evaluatedAt: string;
  policyVersion: string;
  initialDiagnosisId: string;
  revisedDiagnosisId: string;
  revisedDiagnosisSchemaVersion: string;
  resourceVersionId: string;
  rubricVersion: string;
};

export type FeedbackSupportedRevisionEvidence = {
  schemaVersion: typeof FEEDBACK_SUPPORTED_REVISION_EVIDENCE_SCHEMA_VERSION;
  evidenceId: string;
  revisionId: string;
  revisionEvaluationId: string;
  studentId: string;
  taskId: string;
  abilityId: string;
  supportLevel: 'feedback_supported';
  outcome: RevisionOutcome;
  observation: string;
  resolvedIssueCodes: string[];
  remainingIssueCodes: string[];
  confidence: number;
  requiresIndependentVerification: true;
  nextVerificationRoles: Array<'retest' | 'transfer'>;
  createdAt: string;
};

export type RevisionEvaluationIssue = {
  code: string;
  message: string;
  retryable: boolean;
  attemptCount: number;
  lastFailedAt: string;
};

export type FeedbackGuidedRevision = {
  revisionId: string;
  initialResponseId: string;
  status: FeedbackGuidedRevisionStatus;
  revisionGoal: RevisionGoal;
  draftAnswer?: string;
  draftUpdatedAt?: string;
  revisedResponse?: RevisedResponse;
  evaluation?: RevisionEvaluation;
  feedbackSupportedEvidence?: FeedbackSupportedRevisionEvidence;
  profileUpdateDecision?: ProfileUpdateDecision;
  profileAfterRevision?: StudentAbilityProfile;
  growthMemoryRecord?: GrowthMemoryRecord;
  evaluationIssue?: RevisionEvaluationIssue;
  evaluationAttemptCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type LearningTaskAttemptRecord = {
  schemaVersion: typeof LEARNING_FEEDBACK_REVISION_SCHEMA_VERSION;
  learningTaskAttemptId: string;
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
  revisionOfferDecision?: LearningFeedbackRevisionOfferSnapshot;
  status: LearningTaskAttemptStatus;
  revision?: FeedbackGuidedRevision;
  createdAt: string;
  updatedAt: string;
};

export function isLearningTaskAttemptRecord(value: unknown): value is LearningTaskAttemptRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as LearningTaskAttemptRecord;
  return (
    record.schemaVersion === LEARNING_FEEDBACK_REVISION_SCHEMA_VERSION
    && isNonEmptyString(record.learningTaskAttemptId)
    && isNonEmptyString(record.initialAttemptId)
    && isNonEmptyString(record.studentId)
    && isNonEmptyString(record.learningSessionId)
    && isNonEmptyString(record.learningRoundId)
    && isNonEmptyString(record.operationId)
    && isNonEmptyString(record.materialVersionId)
    && isNonEmptyString(record.resourceId)
    && isNonEmptyString(record.resourceVersionId)
    && isNonEmptyString(record.taskId)
    && ['training', 'retest', 'transfer', 'diagnosis', 'observation'].includes(record.taskRole)
    && isNonEmptyString(record.rubricVersion)
    && isStudentResponse(record.initialResponse)
    && record.initialResponse.responseId.length > 0
    && record.initialResponse.studentId === record.studentId
    && record.initialResponse.taskId === record.taskId
    && isNonEmptyString(record.initialDiagnosisId)
    && isNonEmptyString(record.initialDiagnosisSchemaVersion)
    && isNonEmptyString(record.initialFeedbackId)
    && isNonEmptyString(record.initialFeedbackSchemaVersion)
    && (record.revisionOfferDecision === undefined || isRevisionOfferSnapshot(record.revisionOfferDecision, record))
    && isLearningTaskAttemptStatus(record.status)
    && (record.revision === undefined || isFeedbackGuidedRevision(record.revision, record))
    && isTimestamp(record.createdAt)
    && isTimestamp(record.updatedAt)
  );
}

function isRevisionOfferSnapshot(
  value: unknown,
  attempt: Pick<LearningTaskAttemptRecord, 'initialDiagnosisId' | 'initialFeedbackId'>,
): value is LearningFeedbackRevisionOfferSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as LearningFeedbackRevisionOfferSnapshot;
  const eligible = snapshot.level === 'optional' || snapshot.level === 'recommended';
  return isNonEmptyString(snapshot.policyVersion)
    && ['none', 'optional', 'recommended'].includes(snapshot.level)
    && isNonEmptyString(snapshot.reason)
    && snapshot.eligible === eligible
    && (snapshot.actionLabel === undefined || ['根据反馈修订', '完善回答'].includes(snapshot.actionLabel))
    && (snapshot.primaryIssueCode === undefined || isNonEmptyString(snapshot.primaryIssueCode))
    && snapshot.sourceDiagnosisId === attempt.initialDiagnosisId
    && snapshot.sourceFeedbackId === attempt.initialFeedbackId
    && isTimestamp(snapshot.decidedAt);
}

export function isFeedbackGuidedRevision(
  value: unknown,
  attempt?: Pick<LearningTaskAttemptRecord, 'studentId' | 'taskId' | 'initialResponse'>,
): value is FeedbackGuidedRevision {
  if (!value || typeof value !== 'object') return false;
  const revision = value as FeedbackGuidedRevision;
  if (!(
    isNonEmptyString(revision.revisionId)
    && isNonEmptyString(revision.initialResponseId)
    && isFeedbackGuidedRevisionStatus(revision.status)
    && isRevisionGoal(revision.revisionGoal)
    && (revision.draftAnswer === undefined || typeof revision.draftAnswer === 'string')
    && (revision.draftUpdatedAt === undefined || isTimestamp(revision.draftUpdatedAt))
    && (revision.revisedResponse === undefined || isRevisedResponse(revision.revisedResponse))
    && (revision.evaluation === undefined || isRevisionEvaluation(revision.evaluation))
    && (revision.feedbackSupportedEvidence === undefined || isFeedbackSupportedRevisionEvidence(revision.feedbackSupportedEvidence))
    && (revision.profileUpdateDecision === undefined || isProfileUpdateDecision(revision.profileUpdateDecision))
    && (revision.profileAfterRevision === undefined || isStudentAbilityProfile(revision.profileAfterRevision))
    && (revision.growthMemoryRecord === undefined || isGrowthMemoryRecord(revision.growthMemoryRecord))
    && (revision.evaluationIssue === undefined || isRevisionEvaluationIssue(revision.evaluationIssue))
    && (revision.evaluationAttemptCount === undefined || isNonNegativeInteger(revision.evaluationAttemptCount))
    && isTimestamp(revision.createdAt)
    && isTimestamp(revision.updatedAt)
  )) return false;

  if (attempt) {
    if (revision.initialResponseId !== attempt.initialResponse.responseId) return false;
    if (revision.revisedResponse && (
      revision.revisedResponse.revisionId !== revision.revisionId
      || revision.revisedResponse.initialResponseId !== attempt.initialResponse.responseId
      || revision.revisedResponse.studentId !== attempt.studentId
      || revision.revisedResponse.taskId !== attempt.taskId
    )) return false;
  }
  if (['submitted', 'evaluating', 'evaluated', 'evaluation_pending_retry'].includes(revision.status)
    && !revision.revisedResponse) return false;
  if (revision.status === 'evaluated' && !revision.evaluation) return false;
  if (revision.evaluation && revision.evaluation.revisionId !== revision.revisionId) return false;
  if (revision.status === 'evaluated' && !(
    revision.feedbackSupportedEvidence
    && revision.profileUpdateDecision
    && revision.profileAfterRevision
    && revision.growthMemoryRecord
  )) return false;
  if (revision.status === 'evaluation_pending_retry' && !revision.evaluationIssue) return false;
  if (revision.feedbackSupportedEvidence && (
    revision.feedbackSupportedEvidence.revisionId !== revision.revisionId
    || revision.feedbackSupportedEvidence.revisionEvaluationId !== revision.evaluation?.revisionEvaluationId
  )) return false;
  if (revision.profileUpdateDecision && revision.profileUpdateDecision.action !== 'append_evidence_only') return false;
  return true;
}

export function isRevisionEvaluation(value: unknown): value is RevisionEvaluation {
  if (!value || typeof value !== 'object') return false;
  const evaluation = value as RevisionEvaluation;
  return (
    evaluation.schemaVersion === REVISION_EVALUATION_SCHEMA_VERSION
    && isNonEmptyString(evaluation.revisionEvaluationId)
    && isNonEmptyString(evaluation.revisionId)
    && ['improved', 'partially_improved', 'unchanged', 'regressed'].includes(evaluation.outcome)
    && typeof evaluation.feedbackRespondedTo === 'boolean'
    && isStringArray(evaluation.resolvedIssueCodes)
    && isStringArray(evaluation.remainingIssueCodes)
    && isStringArray(evaluation.newIssueCodes)
    && isNonEmptyString(evaluation.improvedObservation)
    && (evaluation.remainingFocus === undefined || isNonEmptyString(evaluation.remainingFocus))
    && isNonEmptyString(evaluation.nextSimilarTaskAction)
    && isTimestamp(evaluation.evaluatedAt)
    && isNonEmptyString(evaluation.policyVersion)
    && isNonEmptyString(evaluation.initialDiagnosisId)
    && isNonEmptyString(evaluation.revisedDiagnosisId)
    && isNonEmptyString(evaluation.revisedDiagnosisSchemaVersion)
    && isNonEmptyString(evaluation.resourceVersionId)
    && isNonEmptyString(evaluation.rubricVersion)
  );
}

export function isFeedbackSupportedRevisionEvidence(
  value: unknown,
): value is FeedbackSupportedRevisionEvidence {
  if (!value || typeof value !== 'object') return false;
  const evidence = value as FeedbackSupportedRevisionEvidence;
  return (
    evidence.schemaVersion === FEEDBACK_SUPPORTED_REVISION_EVIDENCE_SCHEMA_VERSION
    && isNonEmptyString(evidence.evidenceId)
    && isNonEmptyString(evidence.revisionId)
    && isNonEmptyString(evidence.revisionEvaluationId)
    && isNonEmptyString(evidence.studentId)
    && isNonEmptyString(evidence.taskId)
    && isNonEmptyString(evidence.abilityId)
    && evidence.supportLevel === 'feedback_supported'
    && ['improved', 'partially_improved', 'unchanged', 'regressed'].includes(evidence.outcome)
    && isNonEmptyString(evidence.observation)
    && isStringArray(evidence.resolvedIssueCodes)
    && isStringArray(evidence.remainingIssueCodes)
    && isConfidence(evidence.confidence)
    && evidence.confidence <= 0.6
    && evidence.requiresIndependentVerification === true
    && Array.isArray(evidence.nextVerificationRoles)
    && evidence.nextVerificationRoles.length > 0
    && evidence.nextVerificationRoles.every((role) => role === 'retest' || role === 'transfer')
    && isTimestamp(evidence.createdAt)
  );
}

function isRevisionEvaluationIssue(value: unknown): value is RevisionEvaluationIssue {
  if (!value || typeof value !== 'object') return false;
  const issue = value as RevisionEvaluationIssue;
  return isNonEmptyString(issue.code)
    && isNonEmptyString(issue.message)
    && typeof issue.retryable === 'boolean'
    && isNonNegativeInteger(issue.attemptCount)
    && issue.attemptCount > 0
    && isTimestamp(issue.lastFailedAt);
}

function isRevisionGoal(value: unknown): value is RevisionGoal {
  if (!value || typeof value !== 'object') return false;
  const goal = value as RevisionGoal;
  return (
    isNonEmptyString(goal.primaryIssueCode)
    && isStringArray(goal.relatedIssueCodes)
    && goal.relatedIssueCodes.length <= 2
    && isNonEmptyString(goal.instruction)
    && isNonEmptyString(goal.sourceDiagnosisId)
    && isNonEmptyString(goal.sourceFeedbackId)
  );
}

function isRevisedResponse(value: unknown): value is RevisedResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as RevisedResponse;
  return (
    isNonEmptyString(response.responseId)
    && isNonEmptyString(response.revisionId)
    && isNonEmptyString(response.initialResponseId)
    && isNonEmptyString(response.studentId)
    && isNonEmptyString(response.taskId)
    && isNonEmptyString(response.answerText)
    && isTimestamp(response.submittedAt)
  );
}

function isLearningTaskAttemptStatus(value: unknown): value is LearningTaskAttemptStatus {
  return typeof value === 'string' && [
    'feedback_presented',
    'revision_draft',
    'revision_submitted',
    'revision_evaluating',
    'revision_evaluated',
    'revision_evaluation_pending_retry',
    'completed_initial_only',
    'completed_with_revision',
    'completed_with_revision_pending_evaluation',
  ].includes(value);
}

function isFeedbackGuidedRevisionStatus(value: unknown): value is FeedbackGuidedRevisionStatus {
  return typeof value === 'string'
    && ['draft', 'abandoned', 'submitted', 'evaluating', 'evaluated', 'evaluation_pending_retry'].includes(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
