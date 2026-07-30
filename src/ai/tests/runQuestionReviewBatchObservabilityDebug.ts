import {
  summarizeQuestionReviewBatchObservability,
} from '../agents/questionReviewBatchObservability.ts';
import type {
  FrozenQuestionResourceVersion,
  ResourceReviewDecision,
  ResourceValidationResult,
  StructuredQuestionDraft,
} from '../schemas/questionResourceAdmission.schema.ts';
import type {
  QuestionQualityAssessment,
} from '../schemas/questionQualityAssessment.schema.ts';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function draft(
  draftId: string,
  overrides: Partial<StructuredQuestionDraft> = {},
): StructuredQuestionDraft {
  return {
    draftId,
    resourceId: `resource-${draftId}`,
    taskId: `task-${draftId}`,
    title: draftId,
    revision: 2,
    status: 'drafted',
    reviewSubmittedAt: '2026-07-30T10:00:00.000Z',
    qualityRevisionProgress: {
      version: 1,
      draftId,
      items: [],
    },
    ...overrides,
  } as StructuredQuestionDraft;
}

function validation(
  draftId: string,
  passed: boolean,
): ResourceValidationResult {
  return {
    validationId: `validation-${draftId}`,
    draftId,
    validatedDraftRevision: 2,
    passed,
    issues: passed
      ? []
      : [{ code: 'blocked', field: 'questionStem', severity: 'error', message: 'blocked' }],
  } as ResourceValidationResult;
}

function review(
  draftId: string,
  decisions: ResourceReviewDecision['warningDecisions'] = [],
): ResourceReviewDecision {
  return {
    reviewId: `review-${draftId}`,
    draftId,
    reviewedDraftRevision: 2,
    reviewedAt: '2026-07-30T10:30:00.000Z',
    warningDecisions: decisions,
  } as ResourceReviewDecision;
}

function assessment(
  draftId: string,
  warningCodes: string[],
): QuestionQualityAssessment {
  return {
    assessmentId: `assessment-${draftId}`,
    draftId,
    assessedDraftRevision: 2,
    warnings: warningCodes.map((code) => ({
      code,
      check: 'difficultyCoherence',
      severity: 'warning',
      message: code,
      evidenceRefs: [],
    })),
  } as QuestionQualityAssessment;
}

const blocked = draft('blocked', { status: 'validation_failed' });
const warning = draft('warning', {
  status: 'reviewed',
  qualityRevisionProgress: {
    version: 1,
    draftId: 'warning',
    items: [
      {
        check: 'difficultyCoherence',
        code: 'warning.difficulty',
        message: 'difficulty warning',
        status: 'pending',
        recheckCount: 2,
        firstSeenRevision: 1,
        lastSeenRevision: 2,
        firstSeenAt: '2026-07-30T09:00:00.000Z',
        lastModifiedAt: '2026-07-30T09:20:00.000Z',
        lastRecheckedAt: '2026-07-30T09:40:00.000Z',
      },
      {
        check: 'scopeClarity',
        code: 'warning.resolved',
        message: 'resolved warning',
        status: 'resolved',
        recheckCount: 0,
        firstSeenRevision: 1,
        lastSeenRevision: 1,
        firstSeenAt: '2026-07-30T09:00:00.000Z',
        resolvedAt: '2026-07-30T10:00:00.000Z',
      },
    ],
  },
});
const awaiting = draft('awaiting', {
  qualityRevisionProgress: {
    version: 1,
    draftId: 'awaiting',
    items: [
      {
        check: 'scopeClarity',
        code: 'warning.scope',
        message: 'scope warning',
        status: 'modified_pending_recheck',
        recheckCount: 0,
        firstSeenRevision: 2,
        lastSeenRevision: 2,
      },
    ],
  },
});
const oldPublished = draft('old-published', {
  status: 'reviewed',
  reviewSubmittedAt: undefined,
  qualityRevisionProgress: {
    version: 1,
    draftId: 'old-published',
    items: [{
      check: 'scopeClarity',
      code: 'warning.historical',
      message: 'historical warning',
      status: 'pending',
      recheckCount: 0,
      firstSeenRevision: 1,
      lastSeenRevision: 1,
    }],
  },
});
const publishedVersion = {
  sourceDraftId: oldPublished.draftId,
  frozenAt: '2026-07-30T11:00:00.000Z',
} as FrozenQuestionResourceVersion;

const summary = summarizeQuestionReviewBatchObservability([
  { draft: blocked, validation: validation(blocked.draftId, false) },
  {
    draft: warning,
    validation: validation(warning.draftId, true),
    qualityAssessment: assessment(warning.draftId, ['warning.difficulty']),
    review: review(warning.draftId, [{
      assessmentId: 'assessment-warning',
      warningCode: 'warning.difficulty',
      decision: 'accepted',
      reviewedBy: 'reviewer',
      reviewedAt: '2026-07-30T10:30:00.000Z',
    }]),
  },
  {
    draft: awaiting,
    validation: validation(awaiting.draftId, true),
    qualityAssessment: assessment(awaiting.draftId, ['warning.scope']),
  },
  {
    draft: draft('assessment-only', { status: 'pending_review' }),
    validation: validation('assessment-only', true),
    qualityAssessment: assessment('assessment-only', ['warning.assessment-only']),
  },
  {
    draft: oldPublished,
    validation: validation(oldPublished.draftId, true),
    review: review(oldPublished.draftId),
    frozenVersion: publishedVersion,
  },
]);

assert(summary.total === 5, 'Batch total is incorrect.');
assert(summary.blockedDraftCount === 1, 'Blocked draft count is incorrect.');
assert(summary.awaitingRecheckDraftCount === 1, 'Awaiting recheck count is incorrect.');
assert(summary.warningDraftCount === 2, 'Assessment warnings must appear in the batch summary.');
assert(summary.activeWarningCount === 2, 'Resolved review warnings must not remain active.');
assert(summary.repeatedModificationCount === 2, 'Repeated modification count is incorrect.');
assert(summary.warningAcceptanceRate === 1, 'Warning acceptance rate is incorrect.');
assert(summary.averageReviewDurationMinutes === 30, 'Review duration is incorrect.');
assert(summary.averagePublicationDurationMinutes === 30, 'Publication duration is incorrect.');
assert(summary.averageIssueResolutionMinutes === 60, 'Issue resolution duration is incorrect.');
assert(
  summary.items.find((item) => item.draftId === oldPublished.draftId)?.reviewDurationMinutes === null,
  'Legacy data must not infer review duration from updatedAt.',
);
assert(
  summary.items.find((item) => item.draftId === oldPublished.draftId)?.activeWarningCount === 0,
  'Published items must not expose historical warnings as active work.',
);

const empty = summarizeQuestionReviewBatchObservability([]);
assert(empty.blockerRate === null, 'Empty batch blocker rate should be unavailable.');
assert(empty.warningAcceptanceRate === null, 'Undecided warning rate should be unavailable.');

console.log('Question review batch observability: 12/12 checks passed.');
