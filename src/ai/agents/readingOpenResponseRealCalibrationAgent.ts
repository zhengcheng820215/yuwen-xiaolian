import type { LearningObservationEvent } from
  '../schemas/learningObservationEvent.schema.ts';
import type { QuestionCalibrationProjectionRecord } from
  '../schemas/questionCalibrationProjection.schema.ts';
import {
  PRODUCT_LEARNING_STUDENT_ID,
} from '../schemas/learningObservationEvent.schema.ts';
import {
  READING_OPEN_RESPONSE_CALIBRATION_POLICY_VERSION,
  READING_OPEN_RESPONSE_TIMING_POLICY_VERSION,
  isReadingOpenResponseLearningProcessFact,
  type ReadingOpenResponseLearningProcessFact,
  type ReadingOpenResponseVersionCalibrationReport,
} from '../schemas/readingOpenResponseGovernance.schema.ts';

export type ReadingOpenResponseCalibrationIntegrityReport = {
  passed: boolean;
  issueCounts: Record<string, number>;
  productFactCount: number;
  excludedFactCount: number;
  eligibleProjectionCount: number;
};

export function projectReadingOpenResponseVersionCalibration(input: {
  resourceVersionId: string;
  events: LearningObservationEvent[];
  projections: QuestionCalibrationProjectionRecord[];
  processFacts: ReadingOpenResponseLearningProcessFact[];
  generatedAt: string;
  minimumIndependentSubjectCount?: number;
}): ReadingOpenResponseVersionCalibrationReport {
  const minimumIndependentSubjectCount = input.minimumIndependentSubjectCount ?? 30;
  if (!Number.isInteger(minimumIndependentSubjectCount) || minimumIndependentSubjectCount < 1) {
    throw new Error('minimumIndependentSubjectCount must be a positive integer.');
  }
  const events = input.events.filter((event) => (
    event.resourceVersionId === input.resourceVersionId
    && event.runtimeScope === 'product'
  ));
  const facts = deduplicateFacts(input.processFacts.filter((fact) => (
    fact.resourceVersionId === input.resourceVersionId
    && fact.runtimeScope === 'product'
    && isReadingOpenResponseLearningProcessFact(fact)
  )));
  const allVersionProjections = input.projections.filter((projection) => (
    projection.resourceVersionId === input.resourceVersionId
  ));
  const eligibleProjections = deduplicateProjections(allVersionProjections.filter((projection) => (
    projection.status === 'eligible'
    && projection.runtimeScope === 'product'
    && projection.valid
  )));
  const independentSubjectCount = new Set(
    eligibleProjections.map((projection) => projection.studentId),
  ).size;
  const submittedAttemptIds = new Set(events.flatMap((event) => (
    event.eventType === 'answer_submitted' ? [event.payload.attemptId] : []
  )));
  const completedAttemptIds = new Set(events.flatMap((event) => (
    event.eventType === 'learning_round_completed' ? [event.payload.attemptId] : []
  )));
  const revisionOutcomeCounts = {
    improved: 0,
    partially_improved: 0,
    unchanged: 0,
    regressed: 0,
  };
  for (const event of events) {
    if (event.eventType === 'revision_evaluation_completed') {
      revisionOutcomeCounts[event.payload.outcome] += 1;
    }
  }
  const resultDistribution = {
    does_not_meet: 0,
    partially_meets: 0,
    meets: 0,
  };
  for (const projection of eligibleProjections) {
    if ((projection.itemScore || 0) <= 0) resultDistribution.does_not_meet += 1;
    else if ((projection.itemScore || 0) >= 1) resultDistribution.meets += 1;
    else resultDistribution.partially_meets += 1;
  }
  const excludedCounts: Record<string, number> = {};
  for (const projection of allVersionProjections) {
    if (projection.status === 'eligible') continue;
    excludedCounts[projection.status] = (excludedCounts[projection.status] || 0) + 1;
  }
  for (const fact of facts) {
    if (fact.responseValidity === 'valid') continue;
    const key = `response_${fact.responseValidity}`;
    excludedCounts[key] = (excludedCounts[key] || 0) + 1;
  }
  const firstInputDelays = facts.flatMap((fact) => duration(fact.presentedAt, fact.firstInputAt));
  const activeResponseDurations = facts.flatMap((fact) => duration(
    fact.firstInputAt,
    fact.submittedAt,
  ));
  const completionDurations = facts.flatMap((fact) => duration(
    fact.presentedAt,
    fact.completedAt,
  ));
  const retestFacts = facts.filter((fact) => fact.followUpRole === 'retest');
  const transferFacts = facts.filter((fact) => fact.followUpRole === 'transfer');
  const status = eligibleProjections.length === 0
    ? 'awaiting_data'
    : independentSubjectCount < minimumIndependentSubjectCount
      ? 'insufficient_sample'
      : 'calibrated';
  const limitations = status === 'awaiting_data'
    ? ['尚无真实、完整且符合资格的产品作答，只保留工程与排除事实。']
    : status === 'insufficient_sample'
      ? [
          `当前有 ${eligibleProjections.length} 份有效作答、${independentSubjectCount} 个独立使用者；${minimumIndependentSubjectCount} 份阈值仅为当前产品治理试运行门槛。`,
        ]
      : ['已达到当前试运行计算门槛；结果不等同于统计学稳定或教育效果已验证。'];

  return {
    resourceVersionId: input.resourceVersionId,
    status,
    presentedCount: new Set(events.flatMap((event) => (
      event.eventType === 'question_presented' ? [event.payload.presentationId] : []
    ))).size,
    submittedCount: submittedAttemptIds.size,
    eligibleSampleCount: eligibleProjections.length,
    independentSubjectCount,
    completedCount: completedAttemptIds.size,
    invalidResponseCount: facts.filter((fact) => fact.responseValidity !== 'valid').length,
    exitCount: facts.filter((fact) => Boolean(fact.taskExitReason)).length,
    hintOpenedCount: facts.filter((fact) => fact.hintOpened).length,
    revisionOfferedCount: facts.filter((fact) => fact.revisionOffered).length,
    revisionSubmittedCount: facts.filter((fact) => fact.revisionSubmitted).length,
    revisionOutcomeCounts,
    resultDistribution,
    followUpRecurrence: {
      retestObserved: retestFacts.length,
      transferObserved: transferFacts.length,
      sameGapRecurred: [...retestFacts, ...transferFacts]
        .filter((fact) => fact.sameGapRecurred).length,
    },
    ...(firstInputDelays.length > 0
      ? { medianFirstInputDelayMs: median(firstInputDelays) }
      : {}),
    ...(activeResponseDurations.length > 0
      ? { medianActiveResponseMs: median(activeResponseDurations) }
      : {}),
    ...(completionDurations.length > 0
      ? { medianCompletionMs: median(completionDurations) }
      : {}),
    minimumIndependentSubjectCount,
    excludedCounts,
    generatedAt: input.generatedAt,
    policyVersion: READING_OPEN_RESPONSE_CALIBRATION_POLICY_VERSION,
    timingPolicyVersion: READING_OPEN_RESPONSE_TIMING_POLICY_VERSION,
    limitations,
  };
}

export function auditReadingOpenResponseCalibrationIntegrity(input: {
  events: LearningObservationEvent[];
  projections: QuestionCalibrationProjectionRecord[];
  processFacts: ReadingOpenResponseLearningProcessFact[];
}): ReadingOpenResponseCalibrationIntegrityReport {
  const issueCounts: Record<string, number> = {};
  const note = (code: string) => { issueCounts[code] = (issueCounts[code] || 0) + 1; };
  const factIds = new Set<string>();
  for (const fact of input.processFacts) {
    if (!isReadingOpenResponseLearningProcessFact(fact)) {
      note('invalid_process_fact');
      continue;
    }
    if (factIds.has(fact.attemptId)) note('duplicate_process_fact_attempt');
    factIds.add(fact.attemptId);
    if (fact.runtimeScope === 'product' && fact.studentId !== PRODUCT_LEARNING_STUDENT_ID) {
      note('product_student_identity_mismatch');
    }
  }
  const projectionAttempts = new Set<string>();
  for (const projection of input.projections) {
    if (projectionAttempts.has(projection.attemptId)) note('duplicate_projection_attempt');
    projectionAttempts.add(projection.attemptId);
    if (projection.status === 'eligible' && projection.runtimeScope !== 'product') {
      note('eligible_non_product_projection');
    }
    if (
      projection.status === 'eligible'
      && projection.runtimeScope === 'product'
      && !factIds.has(projection.attemptId)
    ) {
      note('eligible_projection_missing_process_fact');
    }
  }
  for (const event of input.events) {
    if (event.runtimeScope !== 'product') note('non_product_event');
  }
  return {
    passed: Object.keys(issueCounts).length === 0,
    issueCounts,
    productFactCount: input.processFacts.filter((fact) => fact.runtimeScope === 'product').length,
    excludedFactCount: input.processFacts.filter((fact) => fact.runtimeScope !== 'product').length,
    eligibleProjectionCount: input.projections.filter((item) => item.status === 'eligible').length,
  };
}

function deduplicateFacts(
  facts: ReadingOpenResponseLearningProcessFact[],
): ReadingOpenResponseLearningProcessFact[] {
  return [...new Map(facts.map((fact) => [fact.attemptId, fact])).values()];
}

function deduplicateProjections(
  projections: QuestionCalibrationProjectionRecord[],
): QuestionCalibrationProjectionRecord[] {
  return [...new Map(projections.map((projection) => [projection.attemptId, projection])).values()];
}

function duration(start?: string, end?: string): number[] {
  if (!start || !end) return [];
  const value = Date.parse(end) - Date.parse(start);
  return Number.isFinite(value) && value >= 0 ? [value] : [];
}

function median(values: number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]!
    : Math.round((ordered[middle - 1]! + ordered[middle]!) / 2);
}
