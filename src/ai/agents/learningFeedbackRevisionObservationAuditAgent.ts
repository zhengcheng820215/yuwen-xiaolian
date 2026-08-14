import type { LearningTaskAttemptRecord, RevisionOutcome } from '../schemas/learningFeedbackRevision.schema.ts';
import type {
  LearningObservationEvent,
  LearningObservationEventType,
} from '../schemas/learningObservationEvent.schema.ts';
import type { LearningObservationOutboxEntry } from '../schemas/learningObservationOutbox.schema.ts';
import type { QuestionCalibrationProjectionRecord } from '../schemas/questionCalibrationProjection.schema.ts';

export const LEARNING_FEEDBACK_REVISION_AUDIT_POLICY_VERSION =
  'learning_feedback_revision_audit_policy_v1' as const;

const REVISION_EVENT_TYPES = [
  'revision_started',
  'revision_submitted',
  'revision_evaluation_completed',
] as const satisfies LearningObservationEventType[];

export type LearningFeedbackRevisionAuditIssue = {
  code:
    | 'offer_decision_missing'
    | 'revision_event_pending_outbox'
    | 'revision_event_missing'
    | 'revision_event_duplicate'
    | 'revision_event_identity_mismatch'
    | 'revision_calibration_contamination'
    | 'revision_evidence_boundary_violation'
    | 'revision_terminal_bundle_incomplete';
  severity: 'warning' | 'fail';
  learningTaskAttemptId: string;
  eventType?: LearningObservationEventType;
  message: string;
};

export type LearningFeedbackRevisionAuditReport = {
  policyVersion: typeof LEARNING_FEEDBACK_REVISION_AUDIT_POLICY_VERSION;
  status: 'pass' | 'warning' | 'fail';
  attemptCount: number;
  revisionCount: number;
  issueCount: number;
  issues: LearningFeedbackRevisionAuditIssue[];
  auditedAt: string;
};

export type RevisionRateMetric = {
  status: 'available' | 'unavailable';
  numerator: number;
  denominator: number;
  rate?: number;
  reason?: 'zero_denominator' | 'offer_denominator_incomplete';
};

export type LearningFeedbackRevisionMetrics = {
  policyVersion: typeof LEARNING_FEEDBACK_REVISION_AUDIT_POLICY_VERSION;
  offerRate: RevisionRateMetric;
  startRate: RevisionRateMetric;
  completionRate: RevisionRateMetric;
  evaluationCompletionRate: RevisionRateMetric;
  feedbackResponseRate: RevisionRateMetric;
  issueResolutionRate: RevisionRateMetric;
  newIssueRate: RevisionRateMetric;
  outcomeDistribution: Record<RevisionOutcome, number>;
  generatedAt: string;
};

export function auditLearningFeedbackRevisionObservations(input: {
  attempts: LearningTaskAttemptRecord[];
  events: LearningObservationEvent[];
  outboxEntries?: LearningObservationOutboxEntry[];
  projections?: QuestionCalibrationProjectionRecord[];
  auditedAt?: string;
}): LearningFeedbackRevisionAuditReport {
  const issues: LearningFeedbackRevisionAuditIssue[] = [];
  const outboxEntries = input.outboxEntries || [];
  const projections = input.projections || [];
  const duplicateIds = duplicateValues(input.events.map((event) => event.eventId));

  for (const attempt of input.attempts) {
    if (!attempt.revisionOfferDecision) {
      issues.push(issue('offer_decision_missing', 'warning', attempt, '缺少冻结的 Revision Offer Decision，Offer 相关指标不可用。'));
    }
    const related = input.events.filter((event) => revisionEventAttemptId(event) === attempt.learningTaskAttemptId);
    for (const event of related) {
      if (duplicateIds.has(event.eventId)) {
        issues.push(issue('revision_event_duplicate', 'fail', attempt, '相同稳定 Event ID 出现多条记录。', event.eventType));
      }
      if (!revisionEventIdentityAligned(event, attempt)) {
        issues.push(issue('revision_event_identity_mismatch', 'fail', attempt, 'Revision Event 与正式 Attempt / Revision 身份不一致。', event.eventType));
      }
    }

    const revision = attempt.revision;
    if (!revision) {
      if (related.length > 0) {
        issues.push(issue('revision_event_identity_mismatch', 'fail', attempt, '没有 Revision 对象却存在 Revision Event。'));
      }
      continue;
    }

    checkExpectedEvent('revision_started', true, attempt, related, outboxEntries, issues);
    checkExpectedEvent('revision_submitted', Boolean(revision.revisedResponse), attempt, related, outboxEntries, issues);
    checkExpectedEvent('revision_evaluation_completed', Boolean(revision.evaluation), attempt, related, outboxEntries, issues);

    if (revision.status === 'evaluated' && !(
      revision.evaluation
      && revision.feedbackSupportedEvidence
      && revision.profileUpdateDecision
      && revision.profileAfterRevision
      && revision.growthMemoryRecord
    )) {
      issues.push(issue('revision_terminal_bundle_incomplete', 'fail', attempt, 'Revision 已完成但 Evaluation Bundle 不完整。'));
    }
    if (revision.feedbackSupportedEvidence && (
      revision.feedbackSupportedEvidence.supportLevel !== 'feedback_supported'
      || revision.feedbackSupportedEvidence.confidence > 0.6
      || revision.profileUpdateDecision?.action !== 'append_evidence_only'
    )) {
      issues.push(issue('revision_evidence_boundary_violation', 'fail', attempt, 'Revision Evidence 或 Profile Action 超出反馈支持边界。'));
    }

    const contaminated = projections.filter((projection) => (
      projection.responseId === revision.revisedResponse?.responseId
      || projection.attemptId === revision.revisedResponse?.responseId
    ));
    const initialProjectionCount = projections.filter((projection) => projection.attemptId === attempt.initialAttemptId).length;
    if (contaminated.length > 0 || initialProjectionCount > 1) {
      issues.push(issue('revision_calibration_contamination', 'fail', attempt, 'Revision 进入了 Initial Question Calibration Projection。'));
    }
  }

  const status = issues.some((item) => item.severity === 'fail')
    ? 'fail'
    : issues.length > 0
      ? 'warning'
      : 'pass';
  return {
    policyVersion: LEARNING_FEEDBACK_REVISION_AUDIT_POLICY_VERSION,
    status,
    attemptCount: input.attempts.length,
    revisionCount: input.attempts.filter((attempt) => Boolean(attempt.revision)).length,
    issueCount: issues.length,
    issues,
    auditedAt: input.auditedAt || new Date().toISOString(),
  };
}

export function buildLearningFeedbackRevisionMetrics(input: {
  attempts: LearningTaskAttemptRecord[];
  events: LearningObservationEvent[];
  generatedAt?: string;
}): LearningFeedbackRevisionMetrics {
  const uniqueEvents = uniqueBy(input.events, (event) => event.eventId);
  const offerComplete = input.attempts.every((attempt) => Boolean(attempt.revisionOfferDecision));
  const offers = input.attempts.flatMap((attempt) => attempt.revisionOfferDecision ? [attempt.revisionOfferDecision] : []);
  const eligibleOffers = offers.filter((offer) => offer.eligible).length;
  const started = uniqueRevisionCount(uniqueEvents, 'revision_started');
  const submitted = uniqueRevisionCount(uniqueEvents, 'revision_submitted');
  const evaluationCompleted = uniqueRevisionCount(uniqueEvents, 'revision_evaluation_completed');
  const evaluations = uniqueBy(
    input.attempts.flatMap((attempt) => attempt.revision?.evaluation ? [attempt.revision.evaluation] : []),
    (evaluation) => evaluation.revisionEvaluationId,
  );
  const outcomeDistribution: Record<RevisionOutcome, number> = {
    improved: 0,
    partially_improved: 0,
    unchanged: 0,
    regressed: 0,
  };
  for (const evaluation of evaluations) outcomeDistribution[evaluation.outcome] += 1;

  return {
    policyVersion: LEARNING_FEEDBACK_REVISION_AUDIT_POLICY_VERSION,
    offerRate: offerComplete
      ? rate(eligibleOffers, offers.length)
      : unavailable(eligibleOffers, offers.length, 'offer_denominator_incomplete'),
    startRate: offerComplete
      ? rate(started, eligibleOffers)
      : unavailable(started, eligibleOffers, 'offer_denominator_incomplete'),
    completionRate: rate(submitted, started),
    evaluationCompletionRate: rate(evaluationCompleted, submitted),
    feedbackResponseRate: rate(evaluations.filter((item) => item.feedbackRespondedTo).length, evaluations.length),
    issueResolutionRate: rate(evaluations.filter((item) => (
      item.outcome === 'improved' || item.outcome === 'partially_improved'
    )).length, evaluations.length),
    newIssueRate: rate(evaluations.filter((item) => item.newIssueCodes.length > 0).length, evaluations.length),
    outcomeDistribution,
    generatedAt: input.generatedAt || new Date().toISOString(),
  };
}

function checkExpectedEvent(
  eventType: typeof REVISION_EVENT_TYPES[number],
  expected: boolean,
  attempt: LearningTaskAttemptRecord,
  events: LearningObservationEvent[],
  outboxEntries: LearningObservationOutboxEntry[],
  issues: LearningFeedbackRevisionAuditIssue[],
): void {
  const matches = events.filter((event) => event.eventType === eventType);
  if (expected && matches.length === 0) {
    const pending = outboxEntries.some((entry) => (
      entry.eventType === eventType
      && revisionEventAttemptId(entry.event) === attempt.learningTaskAttemptId
      && entry.status !== 'failed'
    ));
    issues.push(issue(
      pending ? 'revision_event_pending_outbox' : 'revision_event_missing',
      pending ? 'warning' : 'fail',
      attempt,
      pending ? 'Revision Event 已进入 Outbox，等待安全补写。' : '正式 Revision 对象缺少对应扩展事件。',
      eventType,
    ));
  }
  if (matches.length > 1) {
    issues.push(issue('revision_event_duplicate', 'fail', attempt, '同一 Revision 阶段存在多条扩展事件。', eventType));
  }
  if (!expected && matches.length > 0) {
    issues.push(issue('revision_event_identity_mismatch', 'fail', attempt, 'Revision 阶段尚未形成却已经记录对应事件。', eventType));
  }
}

function revisionEventAttemptId(event: LearningObservationEvent): string | undefined {
  return REVISION_EVENT_TYPES.includes(event.eventType as typeof REVISION_EVENT_TYPES[number])
    && 'learningTaskAttemptId' in event.payload
    ? event.payload.learningTaskAttemptId
    : undefined;
}

function revisionEventIdentityAligned(
  event: LearningObservationEvent,
  attempt: LearningTaskAttemptRecord,
): boolean {
  const payload = event.payload;
  if (!REVISION_EVENT_TYPES.includes(event.eventType as typeof REVISION_EVENT_TYPES[number])) return true;
  if (!('learningTaskAttemptId' in payload) || !attempt.revision) return false;
  if (
    payload.learningTaskAttemptId !== attempt.learningTaskAttemptId
    || payload.attemptId !== attempt.initialAttemptId
    || payload.revisionId !== attempt.revision.revisionId
  ) return false;
  if (payload.kind === 'revision_started') return payload.responseId === attempt.initialResponse.responseId;
  if (payload.kind === 'revision_submitted') return Boolean(
    attempt.revision.revisedResponse
    && payload.responseId === attempt.revision.revisedResponse.responseId
    && payload.initialResponseId === attempt.initialResponse.responseId,
  );
  if (payload.kind === 'revision_evaluation_completed') return Boolean(
    attempt.revision.evaluation
    && attempt.revision.feedbackSupportedEvidence
    && payload.responseId === attempt.revision.revisedResponse?.responseId
    && payload.revisionEvaluationId === attempt.revision.evaluation.revisionEvaluationId
    && payload.feedbackSupportedEvidenceId === attempt.revision.feedbackSupportedEvidence.evidenceId
    && payload.outcome === attempt.revision.evaluation.outcome,
  );
  return false;
}

function uniqueRevisionCount(
  events: LearningObservationEvent[],
  eventType: typeof REVISION_EVENT_TYPES[number],
): number {
  return new Set(events.filter((event) => event.eventType === eventType)
    .map((event) => 'revisionId' in event.payload ? event.payload.revisionId : '')
    .filter(Boolean)).size;
}

function rate(numerator: number, denominator: number): RevisionRateMetric {
  return denominator === 0
    ? unavailable(numerator, denominator, 'zero_denominator')
    : { status: 'available', numerator, denominator, rate: numerator / denominator };
}

function unavailable(
  numerator: number,
  denominator: number,
  reason: NonNullable<RevisionRateMetric['reason']>,
): RevisionRateMetric {
  return { status: 'unavailable', numerator, denominator, reason };
}

function issue(
  code: LearningFeedbackRevisionAuditIssue['code'],
  severity: LearningFeedbackRevisionAuditIssue['severity'],
  attempt: LearningTaskAttemptRecord,
  message: string,
  eventType?: LearningObservationEventType,
): LearningFeedbackRevisionAuditIssue {
  return { code, severity, learningTaskAttemptId: attempt.learningTaskAttemptId, eventType, message };
}

function duplicateValues(values: string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
}

function uniqueBy<T>(values: T[], getId: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const id = getId(value);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
