import type {
  FrozenQuestionResourceVersion,
  ResourceReviewDecision,
  ResourceValidationResult,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import type {
  QuestionQualityAssessment,
} from '../schemas/questionQualityAssessment.schema.ts';

export type QuestionReviewBatchItemState =
  | 'blocked'
  | 'warning'
  | 'awaiting_recheck'
  | 'pending_review'
  | 'approved'
  | 'published'
  | 'needs_check';

export type QuestionReviewBatchObservabilityItem = {
  draftId: string;
  title: string;
  revision: number;
  state: QuestionReviewBatchItemState;
  blockerCount: number;
  activeWarningCount: number;
  repeatedModificationCount: number;
  reviewDurationMinutes: number | null;
  publicationDurationMinutes: number | null;
  averageIssueResolutionMinutes: number | null;
};

export type QuestionReviewBatchObservability = {
  total: number;
  blockedDraftCount: number;
  warningDraftCount: number;
  awaitingRecheckDraftCount: number;
  activeWarningCount: number;
  repeatedModificationCount: number;
  acceptedWarningCount: number;
  rejectedWarningCount: number;
  blockerRate: number | null;
  warningAcceptanceRate: number | null;
  averageReviewDurationMinutes: number | null;
  averagePublicationDurationMinutes: number | null;
  averageIssueResolutionMinutes: number | null;
  items: QuestionReviewBatchObservabilityItem[];
};

export type QuestionReviewBatchObservabilityRecord = {
  draft: StructuredQuestionDraft;
  validation?: ResourceValidationResult | null;
  review?: ResourceReviewDecision | null;
  qualityAssessment?: QuestionQualityAssessment | null;
  frozenVersion?: FrozenQuestionResourceVersion | null;
};

export function summarizeQuestionReviewBatchObservability(
  records: QuestionReviewBatchObservabilityRecord[],
): QuestionReviewBatchObservability {
  const items = records.map(toItem);
  const acceptedWarningCount = records.reduce((total, record) => (
    total + (record.review?.warningDecisions || [])
      .filter((decision) => decision.decision === 'accepted').length
  ), 0);
  const rejectedWarningCount = records.reduce((total, record) => (
    total + (record.review?.warningDecisions || [])
      .filter((decision) => decision.decision === 'rejected').length
  ), 0);
  const decidedWarningCount = acceptedWarningCount + rejectedWarningCount;

  return {
    total: items.length,
    blockedDraftCount: items.filter((item) => item.state === 'blocked').length,
    warningDraftCount: items.filter((item) => item.activeWarningCount > 0).length,
    awaitingRecheckDraftCount: items.filter((item) => item.state === 'awaiting_recheck').length,
    activeWarningCount: items.reduce((total, item) => total + item.activeWarningCount, 0),
    repeatedModificationCount: items.reduce(
      (total, item) => total + item.repeatedModificationCount,
      0,
    ),
    acceptedWarningCount,
    rejectedWarningCount,
    blockerRate: items.length
      ? items.filter((item) => item.state === 'blocked').length / items.length
      : null,
    warningAcceptanceRate: decidedWarningCount
      ? acceptedWarningCount / decidedWarningCount
      : null,
    averageReviewDurationMinutes: average(
      items.map((item) => item.reviewDurationMinutes),
    ),
    averagePublicationDurationMinutes: average(
      items.map((item) => item.publicationDurationMinutes),
    ),
    averageIssueResolutionMinutes: average(
      items.map((item) => item.averageIssueResolutionMinutes),
    ),
    items,
  };
}

function toItem(
  record: QuestionReviewBatchObservabilityRecord,
): QuestionReviewBatchObservabilityItem {
  const progressItems = record.draft.qualityRevisionProgress?.items || [];
  const decidedWarningCodes = new Set(
    record.review?.reviewedDraftRevision === record.draft.revision
      ? (record.review.warningDecisions || []).map((decision) => decision.warningCode)
      : [],
  );
  const activeItems = record.frozenVersion
    ? []
    : progressItems.filter(
      (item) => item.status !== 'resolved' && !decidedWarningCodes.has(item.code),
    );
  const assessmentWarnings = !record.frozenVersion &&
    record.qualityAssessment?.assessedDraftRevision === record.draft.revision
    ? record.qualityAssessment.warnings.filter(
      (warning) => !decidedWarningCodes.has(warning.code),
    )
    : [];
  const activeWarningCodes = new Set([
    ...activeItems.map((item) => item.code),
    ...assessmentWarnings.map((warning) => warning.code),
  ]);
  const awaitingRecheck = activeItems.some(
    (item) => item.status === 'modified_pending_recheck',
  );
  const validationIsCurrent = Boolean(
    record.validation &&
    record.validation.validatedDraftRevision === record.draft.revision,
  );
  const blockerCount = validationIsCurrent
    ? (record.validation?.issues || []).filter((issue) => issue.severity === 'error').length
    : 0;
  const resolvedDurations = progressItems
    .filter((item) => item.firstSeenAt && item.resolvedAt)
    .map((item) => durationMinutes(item.firstSeenAt!, item.resolvedAt!))
    .filter((value): value is number => value !== null);
  const reviewDurationMinutes = durationMinutes(
    record.draft.reviewSubmittedAt,
    record.review?.reviewedAt,
  );
  const publicationDurationMinutes = durationMinutes(
    record.review?.reviewedAt,
    record.frozenVersion?.frozenAt,
  );

  return {
    draftId: record.draft.draftId,
    title: record.draft.title,
    revision: record.draft.revision,
    state: resolveState(record, blockerCount, activeWarningCodes.size, awaitingRecheck),
    blockerCount,
    activeWarningCount: activeWarningCodes.size,
    repeatedModificationCount: progressItems.reduce(
      (total, item) => total + item.recheckCount,
      0,
    ),
    reviewDurationMinutes,
    publicationDurationMinutes,
    averageIssueResolutionMinutes: average(resolvedDurations),
  };
}

function resolveState(
  record: QuestionReviewBatchObservabilityRecord,
  blockerCount: number,
  activeWarningCount: number,
  awaitingRecheck: boolean,
): QuestionReviewBatchItemState {
  if (record.frozenVersion) return 'published';
  if (blockerCount > 0 || record.draft.status === 'validation_failed') return 'blocked';
  if (awaitingRecheck) return 'awaiting_recheck';
  if (activeWarningCount > 0) return 'warning';
  if (record.draft.status === 'reviewed') return 'approved';
  if (record.draft.status === 'pending_review') return 'pending_review';
  return 'needs_check';
}

function durationMinutes(
  startedAt?: string,
  completedAt?: string,
): number | null {
  if (!startedAt || !completedAt) return null;
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
    return null;
  }
  return Math.round(((completed - started) / 60000) * 10) / 10;
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (!present.length) return null;
  return Math.round(
    (present.reduce((total, value) => total + value, 0) / present.length) * 10,
  ) / 10;
}
