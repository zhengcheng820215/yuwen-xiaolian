import assert from 'node:assert/strict';
import { evaluateLearningFeedbackRevision } from '../agents/learningFeedbackRevisionEvaluationAgent.ts';
import {
  auditLearningFeedbackRevisionObservations,
  buildLearningFeedbackRevisionMetrics,
} from '../agents/learningFeedbackRevisionObservationAuditAgent.ts';
import { buildLearningObservationEventId } from '../agents/learningObservationIdentity.ts';
import { decideLearningFeedbackRevisionOffer } from '../agents/learningFeedbackRevisionOfferPolicy.ts';
import {
  InMemoryLearningObservationOutboxRepository,
  InMemoryLearningObservationRepository,
} from '../repositories/inMemoryLearningCollectionRepositories.ts';
import { InMemoryLearningTaskAttemptRepository } from '../repositories/inMemoryLearningTaskAttemptRepository.ts';
import type { LearningObservationRepository } from '../repositories/learningObservationRepository.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { LearningTaskAttemptRecord } from '../schemas/learningFeedbackRevision.schema.ts';
import {
  LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION,
  validateLearningObservationEvent,
  type LearningObservationEvent,
  type LearningObservationEventPayload,
  type LearningObservationEventType,
} from '../schemas/learningObservationEvent.schema.ts';
import type { LearningObservationOutboxEntry } from '../schemas/learningObservationOutbox.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import { LearningFeedbackRevisionPersistenceService } from '../services/learningFeedbackRevisionPersistenceService.ts';
import { LearningObservationService } from '../services/learningObservationService.ts';

const T0 = '2026-08-14T04:00:00.000Z';
const T1 = '2026-08-14T04:01:00.000Z';
const T2 = '2026-08-14T04:02:00.000Z';
const T3 = '2026-08-14T04:03:00.000Z';
const checks: string[] = [];

async function main(): Promise<void> {
  const attemptRepository = new InMemoryLearningTaskAttemptRepository();
  const revisionService = new LearningFeedbackRevisionPersistenceService(attemptRepository, () => T3);
  const attempt = await completedAttempt(revisionService);
  check(Boolean(attempt.revisionOfferDecision?.eligible), 'offer_denominator_is_frozen');
  const sameOffer = await revisionService.recordRevisionOfferDecision(
    attempt.learningTaskAttemptId,
    offerDecision(),
    '2026-08-14T05:00:00.000Z',
  );
  check(sameOffer.revisionOfferDecision?.decidedAt === T0, 'offer_retry_reuses_original_decision_time');
  let offerConflict = false;
  try {
    await revisionService.recordRevisionOfferDecision(
      attempt.learningTaskAttemptId,
      { ...offerDecision(), level: 'none', reason: 'no_actionable_revision_goal', actionLabel: undefined, revisionGoal: undefined },
      T3,
    );
  } catch (error) {
    offerConflict = error instanceof Error && error.message === 'learning_task_attempt_revision_offer_immutable';
  }
  check(offerConflict, 'offer_decision_is_immutable');

  const events = revisionEvents(attempt);
  check(events.every((event) => validateLearningObservationEvent(event).passed), 'three_revision_event_payloads_are_valid');
  const forbidden = {
    ...events[1],
    payload: { ...events[1].payload, answerText: '不应进入事件的答案正文' },
  };
  check(validateLearningObservationEvent(forbidden).issues.includes('forbidden_payload_answerText'), 'revision_events_reject_answer_text');

  const eventRepository = new InMemoryLearningObservationRepository();
  const outboxRepository = new InMemoryLearningObservationOutboxRepository();
  const observationService = new LearningObservationService(eventRepository, outboxRepository, () => T3);
  const firstStatuses = await Promise.all(events.map((event) => observationService.record(event)));
  const retryStatuses = await Promise.all(events.map((event) => observationService.record(event)));
  check(firstStatuses.every((status) => status === 'created'), 'revision_events_are_recorded_after_formal_objects');
  check(retryStatuses.every((status) => status === 'unchanged') && (await eventRepository.listAll()).length === 3, 'revision_event_retry_is_idempotent');

  const passAudit = auditLearningFeedbackRevisionObservations({ attempts: [attempt], events });
  check(passAudit.status === 'pass' && passAudit.issueCount === 0, 'complete_revision_chain_passes_integrity_audit');
  const metrics = buildLearningFeedbackRevisionMetrics({ attempts: [attempt], events, generatedAt: T3 });
  check(metrics.offerRate.rate === 1 && metrics.startRate.rate === 1, 'offer_and_start_rates_use_frozen_denominator');
  check(metrics.completionRate.rate === 1 && metrics.evaluationCompletionRate.rate === 1, 'completion_rates_use_unique_events');
  check(metrics.feedbackResponseRate.rate === 1 && metrics.outcomeDistribution.improved === 1, 'evaluation_metrics_use_unique_formal_evaluation');

  const missingOfferAttempt = structuredClone(attempt);
  delete missingOfferAttempt.revisionOfferDecision;
  const missingOfferMetrics = buildLearningFeedbackRevisionMetrics({ attempts: [missingOfferAttempt], events });
  check(missingOfferMetrics.offerRate.status === 'unavailable'
    && missingOfferMetrics.offerRate.reason === 'offer_denominator_incomplete', 'missing_offer_denominator_never_becomes_fake_zero');
  const emptyMetrics = buildLearningFeedbackRevisionMetrics({ attempts: [], events: [] });
  check(emptyMetrics.completionRate.status === 'unavailable'
    && emptyMetrics.completionRate.reason === 'zero_denominator', 'zero_denominator_is_unavailable');

  const pendingOutbox = outboxEntry(events[2]);
  const pendingAudit = auditLearningFeedbackRevisionObservations({
    attempts: [attempt], events: events.slice(0, 2), outboxEntries: [pendingOutbox],
  });
  check(pendingAudit.status === 'warning'
    && pendingAudit.issues.some((item) => item.code === 'revision_event_pending_outbox'), 'pending_outbox_is_recoverable_warning');

  const duplicateAudit = auditLearningFeedbackRevisionObservations({ attempts: [attempt], events: [...events, events[0]] });
  check(duplicateAudit.status === 'fail'
    && duplicateAudit.issues.some((item) => item.code === 'revision_event_duplicate'), 'duplicate_revision_event_fails_audit');
  const mismatchedEvent = {
    ...events[1],
    payload: { ...events[1].payload, revisionId: 'wrong-revision-id' },
  } as LearningObservationEvent;
  const mismatchAudit = auditLearningFeedbackRevisionObservations({
    attempts: [attempt], events: [events[0], mismatchedEvent, events[2]],
  });
  check(mismatchAudit.status === 'fail'
    && mismatchAudit.issues.some((item) => item.code === 'revision_event_identity_mismatch'), 'event_identity_mismatch_fails_audit');

  const contaminationAudit = auditLearningFeedbackRevisionObservations({
    attempts: [attempt], events, projections: [contaminatedProjection(attempt)],
  });
  check(contaminationAudit.status === 'fail'
    && contaminationAudit.issues.some((item) => item.code === 'revision_calibration_contamination'), 'revision_calibration_contamination_fails_audit');

  const failOnceRepository = new FailOnceLearningObservationRepository();
  const recoveryOutbox = new InMemoryLearningObservationOutboxRepository();
  const recoveryService = new LearningObservationService(
    failOnceRepository,
    recoveryOutbox,
    () => T3,
    { baseRetryDelayMs: 1 },
  );
  check(await recoveryService.record(events[0]) === 'queued', 'event_failure_enters_outbox_without_blocking_revision');
  const retryReport = await recoveryService.retryDue(T3);
  check(retryReport.succeeded === 1
    && (await recoveryOutbox.listAll()).length === 0
    && (await failOnceRepository.listAll()).length === 1, 'outbox_retry_recovers_exactly_one_event');

  console.log('\nLearning Feedback Revision Stage 4 Debug');
  console.log('='.repeat(78));
  checks.forEach((name) => console.log(`PASS | ${name}`));
  console.log('-'.repeat(78));
  console.log(`Result: ${checks.length} / ${checks.length} PASS`);
}

async function completedAttempt(service: LearningFeedbackRevisionPersistenceService): Promise<LearningTaskAttemptRecord> {
  const initial = await service.createInitialAttempt({
    initialAttemptId: 'attempt-stage4-initial',
    studentId: 'student-local-primary-v1',
    learningSessionId: 'session-stage4',
    learningRoundId: 'round-stage4',
    operationId: 'operation-stage4',
    materialVersionId: 'material-stage4-v1',
    resourceId: 'resource-stage4',
    resourceVersionId: 'resource-stage4-v1',
    taskId: 'task-stage4',
    taskRole: 'training',
    rubricVersion: 'rubric-stage4-v1',
    initialResponse: {
      responseId: 'response-stage4-initial',
      executionSessionId: 'execution-stage4',
      studentId: 'student-local-primary-v1',
      taskId: 'task-stage4',
      answerText: '父亲舍不得离开。',
      submittedAt: T0,
      usedHint: false,
      hintCount: 0,
    },
    initialDiagnosisId: 'diagnosis-stage4-initial',
    initialDiagnosisSchemaVersion: 'diagnosis_v1',
    initialFeedbackId: 'feedback-stage4',
    initialFeedbackSchemaVersion: 'feedback_v1',
    createdAt: T0,
  });
  const offered = await service.recordRevisionOfferDecision(initial.learningTaskAttemptId, offerDecision(), T0);
  const drafted = await service.startRevision(offered.learningTaskAttemptId, offerDecision().revisionGoal!, T1);
  const submitted = await service.submitRevision(
    drafted.learningTaskAttemptId,
    '父亲舍不得离开。文中父亲停留很久，说明他珍惜这段经历。',
    T2,
  );
  await service.startRevisionEvaluation(submitted.learningTaskAttemptId, T2);
  const bundle = evaluateLearningFeedbackRevision({
    revisionId: submitted.revision!.revisionId,
    studentId: submitted.studentId,
    taskId: submitted.taskId,
    abilityId: 'analysis-reasoning',
    abilityLabel: '分析与推理',
    resourceVersionId: submitted.resourceVersionId,
    rubricVersion: submitted.rubricVersion,
    initialAnswer: submitted.initialResponse.answerText,
    revisedAnswer: submitted.revision!.revisedResponse!.answerText,
    revisionGoal: submitted.revision!.revisionGoal,
    initialDiagnosisId: submitted.initialDiagnosisId,
    initialDiagnosis: diagnosis('partially_meets', ['evidence']),
    revisedDiagnosisId: 'diagnosis-stage4-revised',
    revisedDiagnosisSchemaVersion: 'diagnosis_v1',
    revisedDiagnosis: diagnosis('fully_meets', []),
    currentProfile: profile(),
    evaluatedAt: T3,
  });
  return service.completeRevisionEvaluation(submitted.learningTaskAttemptId, bundle, T3);
}

function offerDecision() {
  return decideLearningFeedbackRevisionOffer({
    taskRole: 'training',
    answerStatus: 'partially_meets',
    formalDiagnosisId: 'diagnosis-stage4-initial',
    formalFeedbackId: 'feedback-stage4',
    formalFeedbackReady: true,
    requirementCoverage: [{
      requirementId: 'evidence',
      requirementType: 'text_evidence',
      requirementText: '补充文本依据',
      required: true,
      status: 'missing',
      studentEvidence: [],
      taskEvidence: ['父亲停留很久'],
      source: 'formal_diagnosis',
      gapReasonCode: 'missing_text_evidence',
      gapMessage: '补充文本依据。',
    }],
    guidance: { detailsToReview: ['父亲的行为'], revisionActions: ['补充父亲行为，并解释它如何支持判断。'] },
  });
}

function revisionEvents(attempt: LearningTaskAttemptRecord): LearningObservationEvent[] {
  const revision = attempt.revision!;
  return [
    event('revision_started', revision.revisionId, {
      kind: 'revision_started', responseId: attempt.initialResponse.responseId,
      attemptId: attempt.initialAttemptId, learningTaskAttemptId: attempt.learningTaskAttemptId,
      revisionId: revision.revisionId, startedAt: revision.createdAt,
    }, revision.createdAt),
    event('revision_submitted', revision.revisedResponse!.responseId, {
      kind: 'revision_submitted', responseId: revision.revisedResponse!.responseId,
      attemptId: attempt.initialAttemptId, learningTaskAttemptId: attempt.learningTaskAttemptId,
      revisionId: revision.revisionId, initialResponseId: attempt.initialResponse.responseId,
      submittedAt: revision.revisedResponse!.submittedAt,
    }, revision.revisedResponse!.submittedAt),
    event('revision_evaluation_completed', revision.evaluation!.revisionEvaluationId, {
      kind: 'revision_evaluation_completed', responseId: revision.revisedResponse!.responseId,
      attemptId: attempt.initialAttemptId, learningTaskAttemptId: attempt.learningTaskAttemptId,
      revisionId: revision.revisionId, revisionEvaluationId: revision.evaluation!.revisionEvaluationId,
      feedbackSupportedEvidenceId: revision.feedbackSupportedEvidence!.evidenceId,
      outcome: revision.evaluation!.outcome, policyVersion: revision.evaluation!.policyVersion,
      completedAt: revision.evaluation!.evaluatedAt,
    }, revision.evaluation!.evaluatedAt),
  ];
}

function event(
  eventType: LearningObservationEventType,
  sourceEntityId: string,
  payload: LearningObservationEventPayload,
  occurredAt: string,
): LearningObservationEvent {
  return {
    schemaVersion: LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION,
    eventId: buildLearningObservationEventId({
      schemaVersion: LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION,
      eventType,
      studentId: 'student-local-primary-v1',
      learningSessionId: 'session-stage4',
      learningRoundId: 'round-stage4',
      sourceEntityId,
    }),
    eventType,
    occurredAt,
    recordedAt: occurredAt,
    runtimeScope: 'product',
    studentId: 'student-local-primary-v1',
    operationId: 'operation-stage4',
    learningSessionId: 'session-stage4',
    learningRoundId: 'round-stage4',
    materialVersionId: 'material-stage4-v1',
    resourceId: 'resource-stage4',
    resourceVersionId: 'resource-stage4-v1',
    taskId: 'task-stage4',
    sourceEntityId,
    appVersion: 'stage4-debug',
    payload,
  };
}

function outboxEntry(eventValue: LearningObservationEvent): LearningObservationOutboxEntry {
  return {
    schemaVersion: 'learning_observation_outbox_v1',
    outboxId: `outbox-${eventValue.eventId}`,
    eventId: eventValue.eventId,
    learningRoundId: eventValue.learningRoundId,
    eventType: eventValue.eventType,
    event: eventValue,
    status: 'pending',
    retryCount: 1,
    lastError: 'temporary_failure',
    nextRetryAt: T3,
    createdAt: T3,
    updatedAt: T3,
  };
}

function contaminatedProjection(attempt: LearningTaskAttemptRecord) {
  return {
    schemaVersion: 'question_calibration_projection_v1' as const,
    projectionId: 'projection-revision-contaminated',
    attemptId: 'revision-should-not-be-projected',
    status: 'excluded_incomplete_round' as const,
    runtimeScope: 'product' as const,
    studentId: attempt.studentId,
    operationId: attempt.operationId,
    learningSessionId: attempt.learningSessionId,
    learningRoundId: attempt.learningRoundId,
    responseId: attempt.revision!.revisedResponse!.responseId,
    resourceVersionId: attempt.resourceVersionId,
    totalScoreStatus: 'unavailable_single_round' as const,
    valid: false,
    projectedAt: T3,
    issues: ['debug_contamination'],
  };
}

function diagnosis(answerStatus: 'partially_meets' | 'fully_meets', missingRubricItems: string[]): DiagnosisResult {
  return {
    taskType: 'open_response', correct: answerStatus === 'fully_meets' ? true : null,
    strategyUsed: '结合文本分析', answerStatus, scoreBand: answerStatus === 'fully_meets' ? 'high' : 'medium',
    rubricItems: [], matchedRubricItems: ['judgement'], missingRubricItems,
    mainAbility: 'analysis-reasoning', relatedAbilities: [],
    surfaceError: missingRubricItems.length ? '依据不足' : '无',
    rootCause: missingRubricItems.length ? '缺少依据关系' : '无',
    errorType: missingRubricItems.length ? '分析错误' : '待验证', abilityEvidence: [],
    diagnosisSummary: missingRubricItems.length ? '部分满足' : '完整满足',
    nextTraining: '继续结合文本依据分析。', confidence: 0.86,
  };
}

function profile(): StudentAbilityProfile {
  const link = {
    evidenceId: 'stage4-independent-evidence', ability: 'analysis-reasoning',
    evidenceType: 'weakness' as const, source: 'diagnosis' as const,
    observation: '首次独立回答缺少依据。', confidence: 0.82, supportLevel: 'independent' as const,
  };
  return {
    studentId: 'student-local-primary-v1', generatedAt: T0,
    current_weakness: { primary: 'analysis-reasoning', secondary: [] },
    ability_status: [{ ability: 'analysis-reasoning', status: 'weak', summary: '独立依据不足',
      weakness_count: 1, positive_count: 0, growth_count: 0, insufficient_count: 0, evidence_links: [link] }],
    improvement_signals: [], continue_training_focus: '分析与推理', evidence_links: [link],
    next_step_recommendation: '继续独立训练。',
  };
}

class FailOnceLearningObservationRepository implements LearningObservationRepository {
  private failed = false;
  private readonly delegate = new InMemoryLearningObservationRepository();

  async save(value: LearningObservationEvent) {
    if (!this.failed) { this.failed = true; throw new Error('temporary_event_store_failure'); }
    return this.delegate.save(value);
  }
  getById(id: string) { return this.delegate.getById(id); }
  listByStudent(id: string) { return this.delegate.listByStudent(id); }
  listAll() { return this.delegate.listAll(); }
  listByRound(studentId: string, roundId: string) { return this.delegate.listByRound(studentId, roundId); }
  listByResourceVersion(id: string) { return this.delegate.listByResourceVersion(id); }
  clear() { return this.delegate.clear(); }
}

function check(passed: boolean, name: string): void {
  assert.equal(passed, true, name);
  checks.push(name);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
