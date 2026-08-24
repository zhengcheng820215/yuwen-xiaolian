import type { LearningProgressionContextSnapshot } from
  '../schemas/learningProgressionContext.schema.ts';
import type { LearningObservationEvent } from
  '../schemas/learningObservationEvent.schema.ts';
import type { ProgressionSupportMode } from
  '../schemas/progressionPerformanceObservation.schema.ts';
import type { ProgressiveLoadStage4Repository } from
  '../repositories/progressiveLoadStage4Repository.ts';
import {
  PROGRESSIVE_LOAD_CALIBRATION_EVENT_SCHEMA_VERSION,
  PROGRESSIVE_LOAD_CALIBRATION_OUTBOX_SCHEMA_VERSION,
  PROGRESSIVE_LOAD_CALIBRATION_PROJECTION_SCHEMA_VERSION,
  isProgressiveLoadCalibrationEvent,
  stableProgressiveLoadId,
  type ProgressiveLoadCalibrationEvent,
  type ProgressiveLoadCalibrationEventType,
  type ProgressiveLoadCalibrationProjection,
  type ProgressiveLoadCalibrationThresholdPolicy,
  type ProgressiveLoadSupportMode,
} from '../schemas/progressiveLoadStage4.schema.ts';

export type ProgressiveLoadCalibrationIntegrityReport = {
  total: number;
  eligible: number;
  excluded: number;
  duplicateEventCount: number;
  issues: string[];
  excludedCounts: Record<string, number>;
};

export class ProgressiveLoadCalibrationService {
  private readonly repository: ProgressiveLoadStage4Repository;
  private readonly now: () => string;

  constructor(
    repository: ProgressiveLoadStage4Repository,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.repository = repository;
    this.now = now;
  }

  async recordFromLearningObservation(input: {
    observation: LearningObservationEvent;
    context: LearningProgressionContextSnapshot;
    supportMode?: ProgressiveLoadSupportMode | ProgressionSupportMode;
    responseFormat?: 'text' | 'single_choice';
    taskLoadRisk?: boolean;
    eventTypeOverride?: ProgressiveLoadCalibrationEventType;
  }): Promise<'created' | 'unchanged' | 'conflict' | 'queued' | 'dropped'> {
    const event = buildProgressiveLoadCalibrationEvent(input);
    if (!event) return 'dropped';
    return this.recordEvent(event);
  }

  async recordEvent(
    event: ProgressiveLoadCalibrationEvent,
  ): Promise<'created' | 'unchanged' | 'conflict' | 'queued' | 'dropped'> {
    if (!isProgressiveLoadCalibrationEvent(event)) return 'dropped';
    try {
      return (await this.repository.saveEvent(event)).status;
    } catch (error) {
      try {
        const now = this.now();
        const outboxId = stableProgressiveLoadId('progressive-calibration-outbox', [event.eventId]);
        const existing = await this.repository.getOutboxEntry(outboxId);
        await this.repository.saveOutboxEntry({
          schemaVersion: PROGRESSIVE_LOAD_CALIBRATION_OUTBOX_SCHEMA_VERSION,
          outboxId,
          eventId: event.eventId,
          event: existing?.event || event,
          status: existing?.status || 'pending',
          retryCount: existing?.retryCount || 0,
          lastError: error instanceof Error ? error.message : String(error),
          nextRetryAt: existing?.nextRetryAt || now,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        });
        return 'queued';
      } catch {
        // Calibration is observational and must never block the Learning main chain.
        return 'dropped';
      }
    }
  }

  async retryDue(now = this.now(), limit = 50) {
    const report = { processed: 0, succeeded: 0, failed: 0, issues: [] as string[] };
    let due;
    try { due = (await this.repository.listDueOutboxEntries(now)).slice(0, limit); }
    catch (error) { report.issues.push(error instanceof Error ? error.message : String(error)); return report; }
    for (const entry of due) {
      report.processed += 1;
      try {
        await this.repository.saveOutboxEntry({ ...entry, status: 'retrying', updatedAt: now });
        const result = await this.repository.saveEvent(entry.event);
        if (result.status === 'created' || result.status === 'unchanged') {
          await this.repository.deleteOutboxEntry(entry.outboxId);
          report.succeeded += 1;
          continue;
        }
        throw new Error(result.issues.join(',') || 'progressive_event_conflict');
      } catch (error) {
        const retryCount = entry.retryCount + 1;
        const failed = retryCount >= 5;
        try {
          await this.repository.saveOutboxEntry({
            ...entry,
            status: failed ? 'failed' : 'pending',
            retryCount,
            lastError: error instanceof Error ? error.message : String(error),
            nextRetryAt: failed ? now : new Date(Date.parse(now) + Math.min(300_000, 1000 * 2 ** (retryCount - 1))).toISOString(),
            updatedAt: now,
          });
        } catch { /* Non-critical observation recovery remains isolated. */ }
        report.failed += 1;
        report.issues.push(`${entry.eventId}:${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return report;
  }

  async rebuildProjections(policy: ProgressiveLoadCalibrationThresholdPolicy) {
    await this.repository.saveThresholdPolicy(policy);
    const events = await this.repository.listEvents();
    const groups = new Map<string, ProgressiveLoadCalibrationEvent[]>();
    for (const event of events) {
      const key = projectionGroupKey(event);
      groups.set(key, [...(groups.get(key) || []), event]);
    }
    const results: ProgressiveLoadCalibrationProjection[] = [];
    for (const group of groups.values()) {
      const projection = buildProgressiveLoadCalibrationProjection({
        events: group, policy, generatedAt: this.now(),
      });
      results.push(await this.repository.saveProjection(projection));
    }
    return results;
  }

  async confirmCalibrated(projectionId: string) {
    const projection = (await this.repository.listProjections())
      .find((item) => item.projectionId === projectionId);
    if (!projection) throw new Error('progressive_calibration_projection_not_found');
    if (projection.status !== 'review_ready') {
      throw new Error('progressive_calibration_projection_not_review_ready');
    }
    return this.repository.saveProjection({ ...projection, status: 'calibrated' });
  }
}

export function buildProgressiveLoadCalibrationEvent(input: {
  observation: LearningObservationEvent;
  context: LearningProgressionContextSnapshot;
  supportMode?: ProgressiveLoadSupportMode | ProgressionSupportMode;
  responseFormat?: 'text' | 'single_choice';
  taskLoadRisk?: boolean;
  eventTypeOverride?: ProgressiveLoadCalibrationEventType;
}): ProgressiveLoadCalibrationEvent | null {
  const mapped = input.eventTypeOverride || mapEventType(input.observation.eventType);
  if (!mapped || input.context.resourceVersionId !== input.observation.resourceVersionId
    || input.context.materialVersionId !== input.observation.materialVersionId
    || input.context.learningSessionId !== input.observation.learningSessionId
    || input.context.learningRoundId !== input.observation.learningRoundId) return null;
  const supportMode = normalizeSupportMode(input.supportMode)
    || supportModeFor(input.observation, mapped);
  const event: ProgressiveLoadCalibrationEvent = {
    schemaVersion: PROGRESSIVE_LOAD_CALIBRATION_EVENT_SCHEMA_VERSION,
    eventId: stableProgressiveLoadId('progressive-calibration-event', [
      input.observation.eventId, mapped, supportMode, input.context.snapshotHash,
    ]),
    sourceObservationEventId: input.observation.eventId,
    eventType: mapped,
    runtimeScope: 'product',
    studentId: input.observation.studentId,
    learningSessionId: input.observation.learningSessionId,
    learningRoundId: input.observation.learningRoundId,
    learningTaskAttemptId: input.context.learningTaskAttemptId,
    resourceVersionId: input.observation.resourceVersionId,
    materialVersionId: input.observation.materialVersionId,
    progressionPlanHash: input.context.taskGroupProgressionPlanHash,
    taskLoadSemanticsHash: input.context.taskLoadSemanticsHash,
    observationThreadId: input.context.taskLoadSemantics?.observationThreadId,
    sequenceRank: input.context.sequenceRank,
    supportMode,
    responseFormat: input.responseFormat || (input.observation.payload.kind === 'answer_submitted'
      ? input.observation.payload.responseFormat : undefined),
    taskLoadRisk: input.taskLoadRisk,
    occurredAt: input.observation.occurredAt,
    source: 'real_learning',
  };
  return isProgressiveLoadCalibrationEvent(event) ? event : null;
}

export function auditProgressiveLoadCalibrationEvents(
  values: unknown[],
): ProgressiveLoadCalibrationIntegrityReport {
  const ids = new Set<string>();
  const issues: string[] = [];
  const excludedCounts: Record<string, number> = {};
  let eligible = 0;
  let duplicateEventCount = 0;
  for (const value of values) {
    if (!isProgressiveLoadCalibrationEvent(value)) {
      increment(excludedCounts, 'schema_or_identity_invalid');
      issues.push('schema_or_identity_invalid');
      continue;
    }
    if (ids.has(value.eventId)) {
      duplicateEventCount += 1;
      increment(excludedCounts, 'duplicate_event');
      continue;
    }
    ids.add(value.eventId);
    if (value.runtimeScope !== 'product' || value.source !== 'real_learning') {
      increment(excludedCounts, 'isolated_or_non_product');
      continue;
    }
    eligible += 1;
  }
  return {
    total: values.length,
    eligible,
    excluded: values.length - eligible,
    duplicateEventCount,
    issues: [...new Set(issues)],
    excludedCounts,
  };
}

export function buildProgressiveLoadCalibrationProjection(input: {
  events: ProgressiveLoadCalibrationEvent[];
  policy: ProgressiveLoadCalibrationThresholdPolicy;
  generatedAt: string;
  identity?: {
    resourceVersionId: string;
    materialVersionId: string;
    progressionPlanHash?: string;
    taskLoadSemanticsHash?: string;
    observationThreadId?: string;
    sequenceRank?: number;
    supportMode: ProgressiveLoadSupportMode;
    responseFormat?: 'text' | 'single_choice';
  };
}): ProgressiveLoadCalibrationProjection {
  const sample = input.events[0];
  const identity = input.identity || (sample ? {
    resourceVersionId: sample.resourceVersionId,
    materialVersionId: sample.materialVersionId,
    progressionPlanHash: sample.progressionPlanHash,
    taskLoadSemanticsHash: sample.taskLoadSemanticsHash,
    observationThreadId: sample.observationThreadId,
    sequenceRank: sample.sequenceRank,
    supportMode: sample.supportMode,
    responseFormat: sample.responseFormat,
  } : null);
  if (!identity) throw new Error('progressive_calibration_projection_identity_required');
  const matching = input.events.filter((event) => projectionGroupKey(event)
    === projectionGroupKey({ ...event, ...identity }));
  const integrity = auditProgressiveLoadCalibrationEvents(matching);
  const eligible = matching.filter((event) => event.runtimeScope === 'product'
    && event.source === 'real_learning');
  const count = (type: ProgressiveLoadCalibrationEventType) => (
    eligible.filter((event) => event.eventType === type).length
  );
  const validInitial = new Set(eligible.filter((event) => (
    event.eventType === 'valid_response_submitted'
    && event.supportMode === 'initial_independent'
  )).map((event) => event.learningTaskAttemptId));
  const distinctLearners = new Set(eligible.filter((event) => (
    event.eventType === 'valid_response_submitted'
  )).map((event) => event.studentId));
  const integrityRate = integrity.total === 0 ? 1 : integrity.eligible / integrity.total;
  const limitations: string[] = [];
  if (validInitial.size < input.policy.reviewReadyValidAttemptCount) {
    limitations.push(`当前有效独立首答 ${validInitial.size} 份，尚未达到试运行复核门槛 ${input.policy.reviewReadyValidAttemptCount} 份。`);
  }
  if (input.policy.minimumDistinctLearnerCount
    && distinctLearners.size < input.policy.minimumDistinctLearnerCount) {
    limitations.push(`当前独立学习者 ${distinctLearners.size} 人，低于策略要求 ${input.policy.minimumDistinctLearnerCount} 人。`);
  }
  if (integrityRate < input.policy.integrityRateFloor) {
    limitations.push('事件身份完整率低于当前策略下限，禁止形成校准结论。');
  }
  const status = resolveStatus({
    eventCount: eligible.length,
    validAttemptCount: validInitial.size,
    distinctLearnerCount: distinctLearners.size,
    integrityRate,
    policy: input.policy,
  });
  const projectionId = stableProgressiveLoadId('progressive-calibration-projection', [
    identity.resourceVersionId, identity.progressionPlanHash || 'no-plan',
    identity.supportMode, identity.responseFormat || 'unknown', input.policy.policyVersion,
  ]);
  return {
    schemaVersion: PROGRESSIVE_LOAD_CALIBRATION_PROJECTION_SCHEMA_VERSION,
    projectionId,
    ...identity,
    status,
    presentedCount: count('task_presented'),
    validInitialAttemptCount: validInitial.size,
    invalidResponseCount: count('invalid_response_rejected'),
    completedCount: count('task_completed'),
    abandonedCount: count('task_abandoned'),
    hintOpenedCount: count('hint_opened'),
    revisionOfferedCount: count('revision_offered'),
    revisionSubmittedCount: count('revision_submitted'),
    nextTaskEnteredCount: count('next_task_entered'),
    sessionResumeCount: count('session_resumed'),
    taskLoadRiskCount: eligible.filter((event) => event.taskLoadRisk).length,
    distinctLearnerCount: distinctLearners.size,
    identityIntegrityFailureCount: integrity.excluded,
    integrityRate,
    excludedCounts: integrity.excludedCounts,
    limitations,
    policyVersion: input.policy.policyVersion,
    generatedAt: input.generatedAt,
  };
}

function resolveStatus(input: {
  eventCount: number;
  validAttemptCount: number;
  distinctLearnerCount: number;
  integrityRate: number;
  policy: ProgressiveLoadCalibrationThresholdPolicy;
}): ProgressiveLoadCalibrationProjection['status'] {
  if (input.integrityRate < input.policy.integrityRateFloor) return 'integrity_blocked';
  if (input.eventCount === 0) return 'awaiting_data';
  if (input.validAttemptCount === 0) return 'collecting';
  if (input.policy.minimumDistinctLearnerCount
    && input.distinctLearnerCount < input.policy.minimumDistinctLearnerCount) {
    return 'insufficient_sample';
  }
  return input.validAttemptCount >= input.policy.reviewReadyValidAttemptCount
    ? 'review_ready' : 'collecting';
}

function mapEventType(type: LearningObservationEvent['eventType']): ProgressiveLoadCalibrationEventType | null {
  if (type === 'question_presented') return 'task_presented';
  if (type === 'answer_submitted') return 'valid_response_submitted';
  if (type === 'revision_started') return 'revision_offered';
  if (type === 'revision_submitted') return 'revision_submitted';
  if (type === 'learning_round_completed') return 'task_completed';
  return null;
}

function supportModeFor(
  _observation: LearningObservationEvent,
  type: ProgressiveLoadCalibrationEventType,
): ProgressiveLoadSupportMode {
  return type === 'revision_offered' || type === 'revision_submitted'
    ? 'feedback_revision' : 'initial_independent';
}

function normalizeSupportMode(
  value: ProgressiveLoadSupportMode | ProgressionSupportMode | undefined,
): ProgressiveLoadSupportMode | undefined {
  if (value === 'independent_initial') return 'initial_independent';
  if (value === 'hint_supported_initial') return 'hint_supported';
  return value;
}

function projectionGroupKey(event: Pick<ProgressiveLoadCalibrationEvent,
  'resourceVersionId' | 'materialVersionId' | 'progressionPlanHash'
  | 'taskLoadSemanticsHash' | 'observationThreadId' | 'sequenceRank'
  | 'supportMode' | 'responseFormat'>): string {
  return JSON.stringify([event.resourceVersionId, event.materialVersionId,
    event.progressionPlanHash || '', event.taskLoadSemanticsHash || '',
    event.observationThreadId || '', event.sequenceRank || 0,
    event.supportMode, event.responseFormat || '']);
}

function increment(record: Record<string, number>, key: string) {
  record[key] = (record[key] || 0) + 1;
}
