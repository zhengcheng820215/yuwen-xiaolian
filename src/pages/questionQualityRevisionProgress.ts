import type {
  QuestionQualityAssessment,
  QuestionQualityCheck,
} from '../ai/schemas/questionQualityAssessment.schema.ts';
import type {
  QuestionQualityRevisionProgressSnapshot,
} from '../ai/schemas/questionResourceAdmission.schema.ts';

export type QuestionQualityIssueProgressStatus =
  | 'pending'
  | 'modified_pending_recheck'
  | 'resolved';

export type QuestionQualityIssueProgressItem = {
  check: QuestionQualityCheck;
  code: string;
  message: string;
  status: QuestionQualityIssueProgressStatus;
  recheckCount: number;
  firstSeenRevision: number;
  lastSeenRevision: number;
  firstSeenAt?: string;
  lastModifiedAt?: string;
  lastRecheckedAt?: string;
  resolvedAt?: string;
  resolvedAtAssessmentId?: string;
};

export type QuestionQualityRevisionProgress = QuestionQualityRevisionProgressSnapshot;

export type QuestionQualityRepairQueue = {
  current?: QuestionQualityIssueProgressItem;
  pending: QuestionQualityIssueProgressItem[];
  awaitingRecheck: QuestionQualityIssueProgressItem[];
  resolved: QuestionQualityIssueProgressItem[];
  total: number;
};

export function createQuestionQualityRevisionProgress(
  draftId: string,
): QuestionQualityRevisionProgress {
  return {
    version: 1,
    draftId,
    items: [],
  };
}

export function reconcileQuestionQualityRevisionProgress(
  previous: QuestionQualityRevisionProgress | null,
  assessment: QuestionQualityAssessment | null | undefined,
): QuestionQualityRevisionProgress {
  const base = previous && assessment && previous.draftId === assessment.draftId
    ? previous
    : createQuestionQualityRevisionProgress(assessment?.draftId || previous?.draftId || '');

  if (!assessment || base.lastAssessmentId === assessment.assessmentId) return base;

  const warningByCheck = new Map(
    assessment.warnings.map((warning) => [warning.check, warning]),
  );
  const previousByCheck = new Map(base.items.map((item) => [item.check, item]));
  const items: QuestionQualityIssueProgressItem[] = [];

  for (const warning of assessment.warnings) {
    const prior = previousByCheck.get(warning.check);
    items.push({
      check: warning.check,
      code: warning.code,
      message: warning.message,
      status: 'pending',
      recheckCount: prior
        ? prior.recheckCount + (prior.status === 'modified_pending_recheck' ? 1 : 0)
        : 0,
      firstSeenRevision: prior?.firstSeenRevision || assessment.assessedDraftRevision,
      lastSeenRevision: assessment.assessedDraftRevision,
      firstSeenAt: prior?.firstSeenAt || assessment.assessedAt,
      lastModifiedAt: prior?.lastModifiedAt,
      lastRecheckedAt: prior?.status === 'modified_pending_recheck'
        ? assessment.assessedAt
        : prior?.lastRecheckedAt,
    });
  }

  for (const prior of base.items) {
    if (warningByCheck.has(prior.check)) continue;
    items.push({
      ...prior,
      status: 'resolved',
      lastSeenRevision: assessment.assessedDraftRevision,
      lastRecheckedAt: prior.status === 'modified_pending_recheck'
        ? assessment.assessedAt
        : prior.lastRecheckedAt,
      resolvedAt: assessment.assessedAt,
      resolvedAtAssessmentId: assessment.assessmentId,
    });
  }

  return {
    version: 1,
    draftId: assessment.draftId,
    lastAssessmentId: assessment.assessmentId,
    items,
  };
}

export function markQuestionQualityIssuesModified(
  previous: QuestionQualityRevisionProgress | null,
  assessment: QuestionQualityAssessment | null | undefined,
  affectedChecks?: QuestionQualityCheck[],
  now = new Date().toISOString(),
): QuestionQualityRevisionProgress | null {
  if (!previous && !assessment) return null;
  const base = reconcileQuestionQualityRevisionProgress(previous, assessment);
  const targetChecks = new Set(
    affectedChecks?.length
      ? affectedChecks
      : base.items.filter((item) => item.status !== 'resolved').map((item) => item.check),
  );

  return {
    ...base,
    items: base.items.map((item) => (
      item.status !== 'resolved' && targetChecks.has(item.check)
        ? { ...item, status: 'modified_pending_recheck', lastModifiedAt: now }
        : item
    )),
  };
}

export function markCurrentQuestionQualityIssueModified(
  previous: QuestionQualityRevisionProgress | null,
  assessment: QuestionQualityAssessment | null | undefined,
  affectedChecks: QuestionQualityCheck[],
  activeCheck?: QuestionQualityCheck | null,
  now = new Date().toISOString(),
): QuestionQualityRevisionProgress | null {
  if (!previous && !assessment) return null;
  const base = reconcileQuestionQualityRevisionProgress(previous, assessment);
  const queue = buildQuestionQualityRepairQueue(base);
  const current = activeCheck
    ? queue.pending.find((item) => item.check === activeCheck)
    : queue.current;
  if (!current || !affectedChecks.includes(current.check)) return base;

  return {
    ...base,
    items: base.items.map((item) => (
      item.check === current.check && item.status === 'pending'
        ? { ...item, status: 'modified_pending_recheck', lastModifiedAt: now }
        : item
    )),
  };
}

export function buildQuestionQualityRepairQueue(
  progress: QuestionQualityRevisionProgress | null | undefined,
): QuestionQualityRepairQueue {
  const items = progress?.items || [];
  const pending = items.filter((item) => item.status === 'pending');
  const awaitingRecheck = items.filter((item) => item.status === 'modified_pending_recheck');
  const resolved = items.filter((item) => item.status === 'resolved');

  return {
    current: pending[0],
    pending,
    awaitingRecheck,
    resolved,
    total: items.length,
  };
}

export function parseQuestionQualityRevisionProgress(
  value: string | QuestionQualityRevisionProgress | null | undefined,
  draftId: string,
): QuestionQualityRevisionProgress | null {
  if (!value) return null;
  try {
    const parsed = (
      typeof value === 'string' ? JSON.parse(value) : value
    ) as QuestionQualityRevisionProgress;
    if (
      parsed?.version !== 1 ||
      parsed.draftId !== draftId ||
      !Array.isArray(parsed.items)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
