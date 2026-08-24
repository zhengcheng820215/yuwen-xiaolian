import {
  READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION,
  TEXT_RESPONSE_LOAD_DISPOSITIONS,
  TEXT_RESPONSE_LOAD_FINDING_CODES,
  type TextResponseLoadDisposition,
  type TextResponseLoadFindingCode,
} from './readingOpenResponseInputLoad.schema.ts';

export const READING_OPEN_RESPONSE_GOVERNANCE_SCHEMA_VERSION =
  'reading_open_response_governance_v1' as const;
export const READING_OPEN_RESPONSE_GOVERNANCE_POLICY_VERSION =
  'reading_open_response_governance_policy_v1' as const;
export const READING_OPEN_RESPONSE_CALIBRATION_POLICY_VERSION =
  'reading_open_response_real_calibration_policy_v1' as const;
export const READING_OPEN_RESPONSE_TIMING_POLICY_VERSION =
  'reading_open_response_timing_policy_v1' as const;

export const EXISTING_QUESTION_GOVERNANCE_STATUSES = [
  'queued',
  'candidate_ready',
  'blocked',
  'adopted',
  'published',
  'rejected',
  'deferred',
  'stale',
] as const;

export type ExistingQuestionGovernanceStatus =
  typeof EXISTING_QUESTION_GOVERNANCE_STATUSES[number];

export type ExistingQuestionGovernancePriority = 1 | 2 | 3;

export type ExistingQuestionGovernanceCase = {
  governanceCaseId: string;
  questionLineageId: string;
  sourceResourceVersionId: string;
  materialVersionId: string;
  observationTaskPlanId: string;
  baselineAuditVersion: typeof READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION;
  sourceDigest: string;
  auditDigest: string;
  disposition: TextResponseLoadDisposition;
  findingCodes: TextResponseLoadFindingCode[];
  priority: ExistingQuestionGovernancePriority;
  status: ExistingQuestionGovernanceStatus;
  generationAttemptCount: 0 | 1 | 2;
  activeCandidateId?: string;
  successorResourceVersionId?: string;
  lastFailureCodes?: string[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: typeof READING_OPEN_RESPONSE_GOVERNANCE_SCHEMA_VERSION;
};

export type ExistingQuestionGovernanceCaseInput = Omit<
  ExistingQuestionGovernanceCase,
  | 'governanceCaseId'
  | 'priority'
  | 'status'
  | 'generationAttemptCount'
  | 'createdAt'
  | 'updatedAt'
  | 'schemaVersion'
  | 'activeCandidateId'
  | 'successorResourceVersionId'
  | 'lastFailureCodes'
>;

export type ExistingQuestionGovernanceBatch = {
  batchId: string;
  governanceCaseIds: string[];
  status: 'planned' | 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
  policyVersion: typeof READING_OPEN_RESPONSE_GOVERNANCE_POLICY_VERSION;
};

export type ExistingQuestionGenerationConstraint = {
  findingCode: TextResponseLoadFindingCode;
  goal: string;
  lockedPrinciples: string[];
};

export type ReadingOpenResponseLearningProcessFact = {
  attemptId: string;
  runtimeScope: 'product' | 'demo' | 'fixture' | 'debug';
  studentId: string;
  learningSessionId: string;
  learningRoundId: string;
  materialVersionId: string;
  resourceVersionId: string;
  presentedAt: string;
  firstInputAt?: string;
  submittedAt?: string;
  completedAt?: string;
  lastActivityAt?: string;
  hintOpened: boolean;
  responseValidity: 'valid' | 'empty' | 'placeholder' | 'irrelevant' | 'insufficient';
  revisionOffered: boolean;
  revisionSubmitted: boolean;
  taskExitReason?: 'student_exit' | 'session_expired' | 'technical_interruption';
  followUpRole?: 'training' | 'retest' | 'transfer';
  sameGapRecurred?: boolean;
  timingPolicyVersion: typeof READING_OPEN_RESPONSE_TIMING_POLICY_VERSION;
};

export type ReadingOpenResponseVersionCalibrationReport = {
  resourceVersionId: string;
  status: 'awaiting_data' | 'insufficient_sample' | 'calibrated';
  presentedCount: number;
  submittedCount: number;
  eligibleSampleCount: number;
  independentSubjectCount: number;
  completedCount: number;
  invalidResponseCount: number;
  exitCount: number;
  hintOpenedCount: number;
  revisionOfferedCount: number;
  revisionSubmittedCount: number;
  revisionOutcomeCounts: Record<'improved' | 'partially_improved' | 'unchanged' | 'regressed', number>;
  resultDistribution: Record<'does_not_meet' | 'partially_meets' | 'meets', number>;
  followUpRecurrence: {
    retestObserved: number;
    transferObserved: number;
    sameGapRecurred: number;
  };
  medianFirstInputDelayMs?: number;
  medianActiveResponseMs?: number;
  medianCompletionMs?: number;
  minimumIndependentSubjectCount: number;
  excludedCounts: Record<string, number>;
  generatedAt: string;
  policyVersion: typeof READING_OPEN_RESPONSE_CALIBRATION_POLICY_VERSION;
  timingPolicyVersion: typeof READING_OPEN_RESPONSE_TIMING_POLICY_VERSION;
  limitations: string[];
};

export function isExistingQuestionGovernanceCase(
  value: unknown,
): value is ExistingQuestionGovernanceCase {
  if (!value || typeof value !== 'object') return false;
  const item = value as ExistingQuestionGovernanceCase & Record<string, unknown>;
  const forbiddenContentCopies = [
    'content',
    'questionStem',
    'rubric',
    'answerAcceptance',
    'readingText',
  ];
  return item.schemaVersion === READING_OPEN_RESPONSE_GOVERNANCE_SCHEMA_VERSION
    && nonEmpty(item.governanceCaseId)
    && nonEmpty(item.questionLineageId)
    && nonEmpty(item.sourceResourceVersionId)
    && nonEmpty(item.materialVersionId)
    && nonEmpty(item.observationTaskPlanId)
    && item.baselineAuditVersion === READING_OPEN_RESPONSE_INPUT_LOAD_AUDIT_VERSION
    && nonEmpty(item.sourceDigest)
    && nonEmpty(item.auditDigest)
    && (TEXT_RESPONSE_LOAD_DISPOSITIONS as readonly string[]).includes(item.disposition)
    && Array.isArray(item.findingCodes)
    && item.findingCodes.every((code) => (
      (TEXT_RESPONSE_LOAD_FINDING_CODES as readonly string[]).includes(code)
    ))
    && [1, 2, 3].includes(item.priority)
    && (EXISTING_QUESTION_GOVERNANCE_STATUSES as readonly string[]).includes(item.status)
    && [0, 1, 2].includes(item.generationAttemptCount)
    && optionalText(item.activeCandidateId)
    && optionalText(item.successorResourceVersionId)
    && (item.lastFailureCodes === undefined || (
      Array.isArray(item.lastFailureCodes)
      && item.lastFailureCodes.every(nonEmpty)
    ))
    && timestamp(item.createdAt)
    && timestamp(item.updatedAt)
    && forbiddenContentCopies.every((field) => !(field in item));
}

export function isExistingQuestionGovernanceBatch(
  value: unknown,
): value is ExistingQuestionGovernanceBatch {
  if (!value || typeof value !== 'object') return false;
  const batch = value as ExistingQuestionGovernanceBatch;
  return nonEmpty(batch.batchId)
    && Array.isArray(batch.governanceCaseIds)
    && batch.governanceCaseIds.length >= 1
    && batch.governanceCaseIds.length <= 5
    && new Set(batch.governanceCaseIds).size === batch.governanceCaseIds.length
    && batch.governanceCaseIds.every(nonEmpty)
    && ['planned', 'active', 'paused', 'completed'].includes(batch.status)
    && timestamp(batch.createdAt)
    && timestamp(batch.updatedAt)
    && batch.policyVersion === READING_OPEN_RESPONSE_GOVERNANCE_POLICY_VERSION;
}

export function isReadingOpenResponseLearningProcessFact(
  value: unknown,
): value is ReadingOpenResponseLearningProcessFact {
  if (!value || typeof value !== 'object') return false;
  const fact = value as ReadingOpenResponseLearningProcessFact;
  return nonEmpty(fact.attemptId)
    && ['product', 'demo', 'fixture', 'debug'].includes(fact.runtimeScope)
    && nonEmpty(fact.studentId)
    && nonEmpty(fact.learningSessionId)
    && nonEmpty(fact.learningRoundId)
    && nonEmpty(fact.materialVersionId)
    && nonEmpty(fact.resourceVersionId)
    && timestamp(fact.presentedAt)
    && optionalTimestamp(fact.firstInputAt)
    && optionalTimestamp(fact.submittedAt)
    && optionalTimestamp(fact.completedAt)
    && optionalTimestamp(fact.lastActivityAt)
    && typeof fact.hintOpened === 'boolean'
    && ['valid', 'empty', 'placeholder', 'irrelevant', 'insufficient']
      .includes(fact.responseValidity)
    && typeof fact.revisionOffered === 'boolean'
    && typeof fact.revisionSubmitted === 'boolean'
    && (fact.taskExitReason === undefined || [
      'student_exit',
      'session_expired',
      'technical_interruption',
    ].includes(fact.taskExitReason))
    && (fact.followUpRole === undefined || ['training', 'retest', 'transfer']
      .includes(fact.followUpRole))
    && (fact.sameGapRecurred === undefined || typeof fact.sameGapRecurred === 'boolean')
    && fact.timingPolicyVersion === READING_OPEN_RESPONSE_TIMING_POLICY_VERSION;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function optionalText(value: unknown): boolean {
  return value === undefined || nonEmpty(value);
}

function timestamp(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}

function optionalTimestamp(value: unknown): boolean {
  return value === undefined || timestamp(value);
}
