import { evaluateLearningFeedbackRevision } from '../agents/learningFeedbackRevisionEvaluationAgent.ts';
import {
  auditLearningFeedbackRevisionObservations,
  buildLearningFeedbackRevisionMetrics,
} from '../agents/learningFeedbackRevisionObservationAuditAgent.ts';
import { buildLearningObservationEventId } from '../agents/learningObservationIdentity.ts';
import { decideLearningFeedbackRevisionOffer } from '../agents/learningFeedbackRevisionOfferPolicy.ts';
import {
  IndexedDBLearningObservationOutboxRepository,
  IndexedDBLearningObservationRepository,
  IndexedDBLearningTaskAttemptRepository,
  IndexedDBQuestionCalibrationProjectionRepository,
} from '../repositories/indexedDBLearningCollectionRepositories.ts';
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
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import { LearningFeedbackRevisionPersistenceService } from '../services/learningFeedbackRevisionPersistenceService.ts';
import { LearningObservationService } from '../services/learningObservationService.ts';

const button = document.querySelector<HTMLButtonElement>('#run');
const output = document.querySelector<HTMLElement>('#result');
if (!button || !output) throw new Error('Stage 4 integration controls missing.');

const T0 = '2026-08-14T06:00:00.000Z';
const T1 = '2026-08-14T06:01:00.000Z';
const T2 = '2026-08-14T06:02:00.000Z';
const T3 = '2026-08-14T06:03:00.000Z';
const STUDENT_ID = 'student-local-primary-v1';

button.addEventListener('click', () => {
  button.disabled = true;
  output.dataset.status = 'running';
  output.textContent = '正在执行联调…';
  void run().then((result) => {
    output.dataset.status = result.status.toLowerCase();
    output.textContent = JSON.stringify(result, null, 2);
  }).catch((error) => {
    output.dataset.status = 'fail';
    output.textContent = JSON.stringify({
      status: 'FAIL',
      error: error instanceof Error ? error.stack || error.message : String(error),
    }, null, 2);
  }).finally(() => { button.disabled = false; });
});

async function run() {
  const databaseName = `learning_feedback_revision_stage4_integration_${Date.now()}`;
  const checks: string[] = [];
  try {
    const attemptRepository = new IndexedDBLearningTaskAttemptRepository(databaseName);
    const eventRepository = new IndexedDBLearningObservationRepository(databaseName);
    const outboxRepository = new IndexedDBLearningObservationOutboxRepository(databaseName);
    const projectionRepository = new IndexedDBQuestionCalibrationProjectionRepository(databaseName);
    const revisionService = new LearningFeedbackRevisionPersistenceService(attemptRepository, () => T3);
    const observationService = new LearningObservationService(eventRepository, outboxRepository, () => T3);

    const normal = await completeRevision(revisionService, 'normal');
    await projectionRepository.save(initialProjection(normal));
    const normalEvents = revisionEvents(normal);
    const validationIssues = normalEvents.flatMap((event) => validateLearningObservationEvent(event).issues);
    if (validationIssues.length > 0) throw new Error(`normal_revision_event_schema:${validationIssues.join(',')}`);
    check(true, 'normal_revision_event_schema', checks);
    const firstWrites = await recordSequentially(observationService, normalEvents);
    const retryWrites = await recordSequentially(observationService, normalEvents);
    if (!firstWrites.every((status) => status === 'created')) {
      throw new Error(`normal_revision_three_events_created:${firstWrites.join(',')}`);
    }
    check(true, 'normal_revision_three_events_created', checks);
    if (!retryWrites.every((status) => status === 'unchanged')) {
      throw new Error(`normal_revision_event_retry_idempotent:${retryWrites.join(',')}`);
    }
    check(true, 'normal_revision_event_retry_idempotent', checks);

    const skippedInitial = await createAttempt(revisionService, 'skipped');
    const skippedOffered = await revisionService.recordRevisionOfferDecision(
      skippedInitial.learningTaskAttemptId, offerDecision('skipped'), T0,
    );
    const skipped = await revisionService.completeInitialOnly(skippedOffered.learningTaskAttemptId, T1);
    check(skipped.status === 'completed_initial_only' && !skipped.revision, 'skip_revision_completes_without_revision', checks);

    const recoveryInitial = await createAttempt(revisionService, 'evaluation-recovery');
    const recoveryOffered = await revisionService.recordRevisionOfferDecision(
      recoveryInitial.learningTaskAttemptId, offerDecision('evaluation-recovery'), T0,
    );
    const recoveryDraft = await revisionService.startRevision(
      recoveryOffered.learningTaskAttemptId, offerDecision('evaluation-recovery').revisionGoal!, T1,
    );
    const recoverySubmitted = await revisionService.submitRevision(
      recoveryDraft.learningTaskAttemptId,
      '父亲停留很久并把树叶夹回原处，这些行为说明他珍惜过去，因此舍不得离开。',
      T2,
    );
    await revisionService.startRevisionEvaluation(recoverySubmitted.learningTaskAttemptId, T2);
    await revisionService.markRevisionEvaluationPendingRetry(recoverySubmitted.learningTaskAttemptId, {
      code: 'simulated_provider_unavailable', message: '评价暂时不可用。', retryable: true,
    }, T2);
    const reopenedService = new LearningFeedbackRevisionPersistenceService(
      new IndexedDBLearningTaskAttemptRepository(databaseName), () => T3,
    );
    const recovered = await reopenedService.recover(recoverySubmitted.studentId, recoverySubmitted.learningRoundId);
    check(recovered.status === 'completed'
      && recovered.record?.status === 'completed_with_revision_pending_evaluation'
      && recovered.record.revision?.status === 'evaluation_pending_retry'
      && Boolean(recovered.record.revision.revisedResponse), 'evaluation_failure_preserves_submitted_revision', checks);
    const recoveryCompleted = await reopenedService.completeRevisionEvaluation(
      recoverySubmitted.learningTaskAttemptId,
      evaluationBundle(recoverySubmitted, 'evaluation-recovery'),
      T3,
    );
    await recordSequentially(observationService, revisionEvents(recoveryCompleted));
    check(recoveryCompleted.status === 'completed_with_revision'
      && recoveryCompleted.revision?.evaluationIssue === undefined, 'evaluation_retry_completes_without_resubmission', checks);

    const eventRecoveryInitial = await createAttempt(revisionService, 'event-recovery');
    const eventRecoveryOffered = await revisionService.recordRevisionOfferDecision(
      eventRecoveryInitial.learningTaskAttemptId, offerDecision('event-recovery'), T0,
    );
    const eventRecoveryDraft = await revisionService.startRevision(
      eventRecoveryOffered.learningTaskAttemptId, offerDecision('event-recovery').revisionGoal!, T1,
    );
    const eventRecoveryEvent = revisionEvents(eventRecoveryDraft)[0];
    const failOnce = new FailOnceIndexedDBLearningObservationRepository(eventRepository);
    const recoveryObservationService = new LearningObservationService(failOnce, outboxRepository, () => T3);
    check(await recoveryObservationService.record(eventRecoveryEvent) === 'queued'
      && (await outboxRepository.listAll()).length === 1, 'event_failure_enters_outbox', checks);
    const retryReport = await recoveryObservationService.retryDue(T3);
    check(retryReport.succeeded === 1
      && (await outboxRepository.listAll()).length === 0, 'outbox_retry_recovers_event', checks);

    const attempts = await attemptRepository.listAll();
    const events = await eventRepository.listAll();
    const projections = await projectionRepository.listAll();
    const audit = auditLearningFeedbackRevisionObservations({ attempts, events, projections });
    const metrics = buildLearningFeedbackRevisionMetrics({ attempts, events, generatedAt: T3 });
    check(audit.status === 'pass' && audit.issueCount === 0, 'combined_integrity_audit_passes', checks);
    check(metrics.offerRate.rate === 1 && metrics.startRate.rate === 0.75, 'offer_and_start_denominators_are_exact', checks);
    check(metrics.completionRate.rate === 2 / 3
      && metrics.evaluationCompletionRate.rate === 1, 'completion_and_evaluation_rates_are_exact', checks);
    check(projections.length === 1
      && projections[0].attemptId === normal.initialAttemptId
      && !events.some((event) => event.eventType === 'answer_submitted'), 'revision_does_not_contaminate_initial_calibration', checks);
    check(attempts.length === 4
      && attempts.filter((attempt) => Boolean(attempt.revision)).length === 3, 'skip_and_revision_attempts_share_one_attempt_model', checks);

    return {
      status: 'PASS', passed: checks.length, total: checks.length, checks,
      audit: { status: audit.status, attempts: audit.attemptCount, revisions: audit.revisionCount, issues: audit.issueCount },
      metrics: {
        offerRate: metrics.offerRate,
        startRate: metrics.startRate,
        completionRate: metrics.completionRate,
        evaluationCompletionRate: metrics.evaluationCompletionRate,
      },
      records: { attempts: attempts.length, revisionEvents: events.length, projections: projections.length },
    };
  } finally {
    await deleteDatabase(databaseName);
  }
}

async function createAttempt(service: LearningFeedbackRevisionPersistenceService, suffix: string) {
  return service.createInitialAttempt({
    initialAttemptId: `attempt-${suffix}`,
    studentId: STUDENT_ID, learningSessionId: `session-${suffix}`,
    learningRoundId: `round-${suffix}`, operationId: `operation-${suffix}`,
    materialVersionId: 'material-stage4-integration-v1', resourceId: 'resource-stage4-integration',
    resourceVersionId: 'resource-stage4-integration-v1',
    taskRole: 'training', rubricVersion: 'rubric-stage4-integration-v1',
    initialResponse: {
      responseId: `response-${suffix}-initial`, executionSessionId: `execution-${suffix}`,
      studentId: STUDENT_ID, taskId: `task-${suffix}`,
      answerText: '父亲舍不得离开。', submittedAt: T0, usedHint: false, hintCount: 0,
    },
    initialDiagnosisId: `diagnosis-${suffix}-initial`, initialDiagnosisSchemaVersion: 'diagnosis_v1',
    initialFeedbackId: `feedback-${suffix}`, initialFeedbackSchemaVersion: 'feedback_v1', createdAt: T0,
  });
}

async function completeRevision(service: LearningFeedbackRevisionPersistenceService, suffix: string) {
  const initial = await createAttempt(service, suffix);
  const offered = await service.recordRevisionOfferDecision(initial.learningTaskAttemptId, offerDecision(suffix), T0);
  const draft = await service.startRevision(offered.learningTaskAttemptId, offerDecision(suffix).revisionGoal!, T1);
  const submitted = await service.submitRevision(
    draft.learningTaskAttemptId,
    '父亲停留很久并把树叶夹回原处，这些行为说明他珍惜过去，因此舍不得离开。',
    T2,
  );
  await service.startRevisionEvaluation(submitted.learningTaskAttemptId, T2);
  return service.completeRevisionEvaluation(submitted.learningTaskAttemptId, evaluationBundle(submitted, suffix), T3);
}

function evaluationBundle(attempt: LearningTaskAttemptRecord, suffix: string) {
  return evaluateLearningFeedbackRevision({
    revisionId: attempt.revision!.revisionId, studentId: attempt.studentId, taskId: attempt.taskId,
    abilityId: 'analysis-reasoning', abilityLabel: '分析与推理', resourceVersionId: attempt.resourceVersionId,
    rubricVersion: attempt.rubricVersion, initialAnswer: attempt.initialResponse.answerText,
    revisedAnswer: attempt.revision!.revisedResponse!.answerText, revisionGoal: attempt.revision!.revisionGoal,
    initialDiagnosisId: attempt.initialDiagnosisId, initialDiagnosis: diagnosis('partially_meets', ['evidence']),
    revisedDiagnosisId: `diagnosis-${suffix}-revised`, revisedDiagnosisSchemaVersion: 'diagnosis_v1',
    revisedDiagnosis: diagnosis('fully_meets', []), currentProfile: profile(attempt.studentId), evaluatedAt: T3,
  });
}

function offerDecision(suffix: string) {
  return decideLearningFeedbackRevisionOffer({
    taskRole: 'training', answerStatus: 'partially_meets',
    formalDiagnosisId: `diagnosis-${suffix}-initial`, formalFeedbackId: `feedback-${suffix}`,
    formalFeedbackReady: true,
    requirementCoverage: [{
      requirementId: 'evidence', requirementType: 'text_evidence', requirementText: '补充文本依据',
      required: true, status: 'missing', studentEvidence: [], taskEvidence: ['父亲停留很久'],
      source: 'formal_diagnosis', gapReasonCode: 'missing_text_evidence', gapMessage: '补充文本依据。',
    }],
    guidance: { detailsToReview: ['父亲的行为'], revisionActions: ['补充行为依据，并解释它如何支持判断。'] },
  });
}

function revisionEvents(attempt: LearningTaskAttemptRecord): LearningObservationEvent[] {
  const revision = attempt.revision!;
  const events: LearningObservationEvent[] = [event(attempt, 'revision_started', revision.revisionId, {
    kind: 'revision_started', responseId: attempt.initialResponse.responseId, attemptId: attempt.initialAttemptId,
    learningTaskAttemptId: attempt.learningTaskAttemptId, revisionId: revision.revisionId, startedAt: revision.createdAt,
  }, revision.createdAt)];
  if (revision.revisedResponse) events.push(event(attempt, 'revision_submitted', revision.revisedResponse.responseId, {
    kind: 'revision_submitted', responseId: revision.revisedResponse.responseId, attemptId: attempt.initialAttemptId,
    learningTaskAttemptId: attempt.learningTaskAttemptId, revisionId: revision.revisionId,
    initialResponseId: attempt.initialResponse.responseId, submittedAt: revision.revisedResponse.submittedAt,
  }, revision.revisedResponse.submittedAt));
  if (revision.evaluation && revision.feedbackSupportedEvidence) events.push(event(
    attempt, 'revision_evaluation_completed', revision.evaluation.revisionEvaluationId, {
      kind: 'revision_evaluation_completed', responseId: revision.revisedResponse!.responseId,
      attemptId: attempt.initialAttemptId, learningTaskAttemptId: attempt.learningTaskAttemptId,
      revisionId: revision.revisionId, revisionEvaluationId: revision.evaluation.revisionEvaluationId,
      feedbackSupportedEvidenceId: revision.feedbackSupportedEvidence.evidenceId,
      outcome: revision.evaluation.outcome, policyVersion: revision.evaluation.policyVersion,
      completedAt: revision.evaluation.evaluatedAt,
    }, revision.evaluation.evaluatedAt,
  ));
  return events;
}

function event(
  attempt: LearningTaskAttemptRecord, eventType: LearningObservationEventType,
  sourceEntityId: string, payload: LearningObservationEventPayload, occurredAt: string,
): LearningObservationEvent {
  return {
    schemaVersion: LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION,
    eventId: buildLearningObservationEventId({
      schemaVersion: LEARNING_OBSERVATION_EVENT_SCHEMA_VERSION, eventType, studentId: attempt.studentId,
      learningSessionId: attempt.learningSessionId, learningRoundId: attempt.learningRoundId, sourceEntityId,
    }),
    eventType, occurredAt, recordedAt: occurredAt, runtimeScope: 'product', studentId: attempt.studentId,
    operationId: attempt.operationId, learningSessionId: attempt.learningSessionId,
    learningRoundId: attempt.learningRoundId, materialVersionId: attempt.materialVersionId,
    resourceId: attempt.resourceId, resourceVersionId: attempt.resourceVersionId,
    taskId: attempt.taskId, sourceEntityId, appVersion: 'stage4-integration-debug', payload,
  };
}

function initialProjection(attempt: LearningTaskAttemptRecord) {
  return {
    schemaVersion: 'question_calibration_projection_v1' as const, projectionId: `projection-${attempt.initialAttemptId}`,
    attemptId: attempt.initialAttemptId, status: 'eligible' as const, runtimeScope: 'product' as const,
    studentId: attempt.studentId, operationId: attempt.operationId, learningSessionId: attempt.learningSessionId,
    learningRoundId: attempt.learningRoundId, responseId: attempt.initialResponse.responseId,
    formalDiagnosisId: attempt.initialDiagnosisId, resourceVersionId: attempt.resourceVersionId,
    itemScore: 0.5, itemScorePolicyVersion: 'rubric_required_equal_weight_v1' as const,
    totalScoreStatus: 'unavailable_single_round' as const, valid: true, completedAt: T0, projectedAt: T0, issues: [],
  };
}

function diagnosis(answerStatus: 'partially_meets' | 'fully_meets', missingRubricItems: string[]): DiagnosisResult {
  return {
    taskType: 'open_response', correct: answerStatus === 'fully_meets' ? true : null,
    strategyUsed: '结合文本分析', answerStatus, scoreBand: answerStatus === 'fully_meets' ? 'high' : 'medium',
    rubricItems: [], matchedRubricItems: ['judgement'], missingRubricItems, mainAbility: 'analysis-reasoning',
    relatedAbilities: [], surfaceError: missingRubricItems.length ? '依据不足' : '无',
    rootCause: missingRubricItems.length ? '缺少依据关系' : '无',
    errorType: missingRubricItems.length ? '分析错误' : '待验证', abilityEvidence: [],
    diagnosisSummary: missingRubricItems.length ? '部分满足' : '完整满足',
    nextTraining: '继续结合文本依据分析。', confidence: 0.86,
  };
}

function profile(studentId: string): StudentAbilityProfile {
  const link = {
    evidenceId: 'stage4-integration-independent-evidence', ability: 'analysis-reasoning',
    evidenceType: 'weakness' as const, source: 'diagnosis' as const,
    observation: '首次独立回答缺少依据。', confidence: 0.82, supportLevel: 'independent' as const,
  };
  return {
    studentId, generatedAt: T0, current_weakness: { primary: 'analysis-reasoning', secondary: [] },
    ability_status: [{ ability: 'analysis-reasoning', status: 'weak', summary: '独立依据不足',
      weakness_count: 1, positive_count: 0, growth_count: 0, insufficient_count: 0, evidence_links: [link] }],
    improvement_signals: [], continue_training_focus: '分析与推理', evidence_links: [link],
    next_step_recommendation: '继续独立训练。',
  };
}

class FailOnceIndexedDBLearningObservationRepository implements LearningObservationRepository {
  private failed = false;
  constructor(private readonly delegate: IndexedDBLearningObservationRepository) {}
  async save(value: LearningObservationEvent) {
    if (!this.failed) { this.failed = true; throw new Error('simulated_event_store_failure'); }
    return this.delegate.save(value);
  }
  getById(id: string) { return this.delegate.getById(id); }
  listByStudent(id: string) { return this.delegate.listByStudent(id); }
  listAll() { return this.delegate.listAll(); }
  listByRound(studentId: string, roundId: string) { return this.delegate.listByRound(studentId, roundId); }
  listByResourceVersion(id: string) { return this.delegate.listByResourceVersion(id); }
  clear() { return this.delegate.clear(); }
}

function check(passed: boolean, name: string, checks: string[]): void {
  if (!passed) throw new Error(name);
  checks.push(name);
}

async function recordSequentially(
  service: LearningObservationService,
  events: LearningObservationEvent[],
) {
  const statuses = [];
  for (const event of events) statuses.push(await service.record(event));
  return statuses;
}

function deleteDatabase(databaseName: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve(); request.onerror = () => resolve(); request.onblocked = () => resolve();
  });
}
