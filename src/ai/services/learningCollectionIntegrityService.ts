import { buildLearningCalibrationAttemptId, buildLearningSubmissionIntentId } from '../agents/learningObservationIdentity.ts';
import { buildStableId } from '../agents/reviewedResourceCandidateAdapter.ts';
import { toAnonymousAttempt } from './questionCalibrationProjectionService.ts';
import {
  CURRENT_LEARNING_COLLECTION_GENERATION,
  CURRENT_LEARNING_COLLECTION_STARTED_AT,
  LEARNING_COLLECTION_INTEGRITY_SCHEMA_VERSION,
  resolveLearningCollectionIntegrityStatus,
  type LearningCollectionIntegrityScope,
  type LearningCollectionIntegrityIssue,
  type LearningCollectionIntegrityIssueCode,
  type LearningCollectionIntegrityReport,
} from '../schemas/learningCollectionIntegrity.schema.ts';
import type {
  AnswerSubmittedPayload,
  LearningObservationEvent,
  LearningObservationEventType,
} from '../schemas/learningObservationEvent.schema.ts';
import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';
import type { QuestionCalibrationProjectionRecord } from '../schemas/questionCalibrationProjection.schema.ts';
import type { RealLearningOperationCheckpoint } from '../schemas/realLearningOperation.schema.ts';

export type LearningCollectionIntegrityInput = {
  studentId: string;
  generatedAt: string;
  checkpoints: RealLearningOperationCheckpoint[];
  persistenceRecords: LearningPersistenceRecord[];
  events: LearningObservationEvent[];
  projections: QuestionCalibrationProjectionRecord[];
  questionPresentedRoundIds?: string[];
  feedbackPresentedRoundIds?: string[];
  claimedIndependentSampleCount?: number;
  scope?: LearningCollectionIntegrityScope;
};

export type ScopedLearningCollectionIntegrityInput = {
  input: LearningCollectionIntegrityInput;
  scope: LearningCollectionIntegrityScope;
  includedRoundIds: Set<string>;
  currentCollectionRoundIds: Set<string>;
  legacyRoundIds: Set<string>;
};

const EVENT_TYPES: LearningObservationEventType[] = [
  'question_presented', 'answer_submitted', 'diagnosis_completed', 'feedback_presented', 'learning_round_completed',
];
const ORDER: LearningObservationEventType[] = EVENT_TYPES;
type AnswerSubmittedEvent = LearningObservationEvent & {
  eventType: 'answer_submitted';
  payload: AnswerSubmittedPayload;
};

export class LearningCollectionIntegrityService {
  buildReport(input: LearningCollectionIntegrityInput): LearningCollectionIntegrityReport {
    const scoped = selectLearningCollectionIntegrityScope(input);
    input = scoped.input;
    const issues: LearningCollectionIntegrityIssue[] = [];
    const checkpoints = input.checkpoints.filter((item) => item.studentId === input.studentId);
    const persistence = input.persistenceRecords.filter((item) => item.studentId === input.studentId);
    const completedRoundIds = new Set(persistence
      .filter((item) => item.learningRoundResult?.status === 'completed')
      .map((item) => item.learningRoundId));
    const questionMarkers = new Set(input.questionPresentedRoundIds || []);
    const feedbackMarkers = new Set(input.feedbackPresentedRoundIds || []);
    const answerSubmittedEvents = input.events.filter(isAnswerSubmittedEvent);
    const productAnswerSubmittedEvents = answerSubmittedEvents.filter((event) => (
      event.runtimeScope === 'product' && event.studentId === input.studentId
    ));
    const answerEventsByAttempt = groupBy(productAnswerSubmittedEvents, (event) => event.payload.attemptId);
    const productProjections = input.projections.filter((record) => (
      record.runtimeScope === 'product' && record.studentId === input.studentId
    ));
    const projectionsByAttempt = groupBy(productProjections, (record) => record.attemptId);

    flagDuplicates(input.events, (event) => event.eventId, 'duplicate_event', issues);
    flagDuplicates(input.projections, (record) => record.attemptId, 'duplicate_projection', issues);
    for (const [attemptId, events] of answerEventsByAttempt) {
      if (events.length > 1) {
        add(issues, 'duplicate_event', 'fail', events[0].learningRoundId, attemptId, events.map((event) => event.eventId));
      }
      const projections = projectionsByAttempt.get(attemptId) || [];
      if (projections.length === 0) {
        add(issues, 'missing_projection', 'fail', events[0].learningRoundId, attemptId, events.map((event) => event.eventId));
      }
    }
    for (const event of input.events) {
      if (event.runtimeScope !== 'product' || event.studentId !== input.studentId) {
        add(issues, 'demo_scope_leak', 'fail', event.learningRoundId, undefined, [event.eventId]);
      }
    }
    for (const projection of input.projections) {
      if (projection.runtimeScope !== 'product' || projection.studentId !== input.studentId) {
        add(issues, 'demo_scope_leak', 'fail', projection.learningRoundId, projection.attemptId, [projection.projectionId]);
      }
    }
    for (const projection of productProjections) {
      const matchingAnswer = answerEventsByAttempt.get(projection.attemptId)?.[0];
      if (!matchingAnswer || matchingAnswer.payload.responseId !== projection.responseId) {
        add(issues, 'identity_mismatch', 'fail', projection.learningRoundId, projection.attemptId, [projection.projectionId]);
      }
    }

    for (const checkpoint of checkpoints) {
      const roundEvents = input.events.filter((event) => event.learningRoundId === checkpoint.learningRoundId);
      const roundProjections = input.projections.filter((record) => record.learningRoundId === checkpoint.learningRoundId);
      const response = checkpoint.taskExecutionResult?.studentResponse;
      const commit = checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit;
      const attemptId = response ? buildLearningCalibrationAttemptId({
        studentId: checkpoint.studentId,
        learningSessionId: checkpoint.learningSessionId,
        learningRoundId: checkpoint.learningRoundId,
        submissionIntentId: buildLearningSubmissionIntentId({ responseId: response.responseId, answerText: response.answerText }),
      }) : undefined;
      if (questionMarkers.has(checkpoint.learningRoundId) && count(roundEvents, 'question_presented') === 0) {
        add(issues, 'missing_question_presented', 'warning', checkpoint.learningRoundId, attemptId, [checkpoint.operationId]);
      }
      if (response && attemptId && !hasAttemptEvent(roundEvents, 'answer_submitted', attemptId)) {
        add(issues, 'missing_answer_submitted', 'fail', checkpoint.learningRoundId, attemptId, [response.responseId]);
      }
      if (commit?.status === 'committed' && attemptId && !hasAttemptEvent(roundEvents, 'diagnosis_completed', attemptId)) {
        add(issues, 'missing_diagnosis_completed', 'fail', checkpoint.learningRoundId, attemptId, [commit.formalDiagnosisId]);
      }
      if (feedbackMarkers.has(checkpoint.learningRoundId) && attemptId && !hasAttemptEvent(roundEvents, 'feedback_presented', attemptId)) {
        add(issues, 'missing_feedback_presented', 'warning', checkpoint.learningRoundId, attemptId, [checkpoint.operationId]);
      }
      if (completedRoundIds.has(checkpoint.learningRoundId) && attemptId && !hasAttemptEvent(roundEvents, 'learning_round_completed', attemptId)) {
        add(issues, 'missing_round_completed', 'fail', checkpoint.learningRoundId, attemptId, [checkpoint.operationId]);
      }
      for (const event of roundEvents) {
        if (event.resourceVersionId !== checkpoint.sourceResourceVersionId) {
          add(issues, 'resource_version_mismatch', 'fail', checkpoint.learningRoundId, attemptId, [event.eventId]);
        }
        const eventAttemptId = 'attemptId' in event.payload ? event.payload.attemptId : undefined;
        const responseId = 'responseId' in event.payload ? event.payload.responseId : undefined;
        const matchingAnswer = eventAttemptId ? answerEventsByAttempt.get(eventAttemptId)?.[0] : undefined;
        const diagnosisId = event.payload.kind === 'diagnosis_completed' ? event.payload.formalDiagnosisId : undefined;
        if (event.operationId !== checkpoint.operationId
          || event.learningSessionId !== checkpoint.learningSessionId
          || (eventAttemptId && (!matchingAnswer || responseId !== matchingAnswer.payload.responseId))
          || (diagnosisId && responseId === response?.responseId && diagnosisId !== commit?.formalDiagnosisId)) {
          add(issues, 'identity_mismatch', 'fail', checkpoint.learningRoundId, eventAttemptId || attemptId, [event.eventId]);
        }
      }
      for (const projection of roundProjections) {
        if (projection.resourceVersionId !== checkpoint.sourceResourceVersionId) {
          add(issues, 'resource_version_mismatch', 'fail', checkpoint.learningRoundId, projection.attemptId, [projection.projectionId]);
        }
        const matchingAnswer = answerEventsByAttempt.get(projection.attemptId)?.[0];
        if (projection.operationId !== checkpoint.operationId
          || projection.learningSessionId !== checkpoint.learningSessionId
          || !matchingAnswer
          || projection.responseId !== matchingAnswer?.payload.responseId
          || (projection.formalDiagnosisId && projection.responseId === response?.responseId && projection.formalDiagnosisId !== commit?.formalDiagnosisId)) {
          add(issues, 'identity_mismatch', 'fail', checkpoint.learningRoundId, projection.attemptId, [projection.projectionId]);
        }
        if (projection.status === 'eligible' && !completedRoundIds.has(checkpoint.learningRoundId)) {
          add(issues, 'eligible_without_completed_round', 'fail', checkpoint.learningRoundId, projection.attemptId, [projection.projectionId]);
        }
      }
      const ordered = roundEvents
        .map((event) => ({ event, rank: ORDER.indexOf(event.eventType) }))
        .sort((left, right) => left.rank - right.rank);
      for (let index = 1; index < ordered.length; index += 1) {
        if (ordered[index].event.occurredAt < ordered[index - 1].event.occurredAt) {
          add(issues, 'occurred_at_inversion', 'warning', checkpoint.learningRoundId, attemptId, [ordered[index - 1].event.eventId, ordered[index].event.eventId]);
          break;
        }
      }
    }

    const eligible = productProjections.filter((record) => record.status === 'eligible');
    const excluded = productProjections.filter((record) => record.status.startsWith('excluded_'));
    const failed = productProjections.filter((record) => record.status === 'projection_failed');
    const subjects = new Set(eligible.flatMap((record) => toAnonymousAttempt(record)?.subjectKey || []));
    if (input.claimedIndependentSampleCount !== undefined && input.claimedIndependentSampleCount > subjects.size) {
      add(issues, 'independent_sample_overcount', 'fail', undefined, undefined, eligible.map((record) => record.projectionId));
    }
    const eventCounts = Object.fromEntries(EVENT_TYPES.map((type) => [type, count(input.events, type)])) as Record<LearningObservationEventType, number>;
    const report: LearningCollectionIntegrityReport = {
      schemaVersion: LEARNING_COLLECTION_INTEGRITY_SCHEMA_VERSION,
      reportId: buildStableId('learning-collection-integrity-report', [input.studentId, input.generatedAt, scoped.scope]),
      studentId: input.studentId,
      generatedAt: input.generatedAt,
      scope: scoped.scope,
      collectionGeneration: CURRENT_LEARNING_COLLECTION_GENERATION,
      currentCollectionStartedAt: CURRENT_LEARNING_COLLECTION_STARTED_AT,
      scopeTotals: {
        includedRounds: scoped.includedRoundIds.size,
        currentCollectionRounds: scoped.currentCollectionRoundIds.size,
        legacyRounds: scoped.legacyRoundIds.size,
      },
      totals: {
        sessions: new Set(checkpoints.map((item) => item.learningSessionId)).size,
        roundsWithFormalQuestion: new Set(checkpoints.map((item) => item.learningRoundId)).size,
        completedRounds: completedRoundIds.size,
        submittedAttempts: answerEventsByAttempt.size,
        eligibleCalibrationAttempts: eligible.length,
        excludedCalibrationAttempts: excluded.length,
        projectionFailedAttempts: failed.length,
        independentSubjects: subjects.size,
      },
      eventCounts,
      issues: uniqueIssues(issues),
      status: 'pass',
    };
    report.status = resolveLearningCollectionIntegrityStatus(report.issues);
    return report;
  }
}

export function selectLearningCollectionIntegrityScope(
  input: LearningCollectionIntegrityInput,
): ScopedLearningCollectionIntegrityInput {
  const scope = input.scope || 'all_history';
  const studentCheckpoints = input.checkpoints.filter((item) => item.studentId === input.studentId);
  const currentCollectionRoundIds = new Set(studentCheckpoints
    .filter((item) => Date.parse(item.createdAt) >= Date.parse(CURRENT_LEARNING_COLLECTION_STARTED_AT))
    .map((item) => item.learningRoundId));
  const allRoundIds = new Set(studentCheckpoints.map((item) => item.learningRoundId));
  const legacyRoundIds = new Set([...allRoundIds].filter((roundId) => !currentCollectionRoundIds.has(roundId)));
  const includedRoundIds = scope === 'current_collection' ? currentCollectionRoundIds : allRoundIds;
  if (scope === 'all_history') {
    return {
      input: { ...input, scope },
      scope,
      includedRoundIds,
      currentCollectionRoundIds,
      legacyRoundIds,
    };
  }
  return {
    input: {
      ...input,
      scope,
      checkpoints: studentCheckpoints.filter((item) => includedRoundIds.has(item.learningRoundId)),
      persistenceRecords: input.persistenceRecords.filter((item) => (
        item.studentId === input.studentId && includedRoundIds.has(item.learningRoundId)
      )),
      events: input.events.filter((item) => includedRoundIds.has(item.learningRoundId)),
      projections: input.projections.filter((item) => includedRoundIds.has(item.learningRoundId)),
      questionPresentedRoundIds: input.questionPresentedRoundIds?.filter((roundId) => includedRoundIds.has(roundId)),
      feedbackPresentedRoundIds: input.feedbackPresentedRoundIds?.filter((roundId) => includedRoundIds.has(roundId)),
    },
    scope,
    includedRoundIds,
    currentCollectionRoundIds,
    legacyRoundIds,
  };
}

function count(events: LearningObservationEvent[], type: LearningObservationEventType): number {
  return events.filter((event) => event.eventType === type).length;
}

function isAnswerSubmittedEvent(event: LearningObservationEvent): event is AnswerSubmittedEvent {
  return event.eventType === 'answer_submitted' && event.payload.kind === 'answer_submitted';
}

function hasAttemptEvent(
  events: LearningObservationEvent[],
  type: LearningObservationEventType,
  attemptId: string,
): boolean {
  return events.some((event) => (
    event.eventType === type && 'attemptId' in event.payload && event.payload.attemptId === attemptId
  ));
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) || []), item]);
  return groups;
}

function flagDuplicates<T>(items: T[], key: (item: T) => string, code: LearningCollectionIntegrityIssueCode, issues: LearningCollectionIntegrityIssue[]) {
  const groups = groupBy(items, key);
  for (const [identity, records] of groups) {
    if (records.length > 1) add(issues, code, 'fail', undefined, code === 'duplicate_projection' ? identity : undefined, [identity]);
  }
}

function add(issues: LearningCollectionIntegrityIssue[], code: LearningCollectionIntegrityIssueCode, severity: 'warning' | 'fail', learningRoundId?: string, attemptId?: string, sourceIds: string[] = []) {
  issues.push({ code, severity, learningRoundId, attemptId, sourceIds, message: messageFor(code) });
}

function messageFor(code: LearningCollectionIntegrityIssueCode): string {
  return ({
    missing_question_presented: '题目可交互记录存在，但缺少题目展示事件。', missing_answer_submitted: '权威回答存在，但缺少提交事件。',
    missing_diagnosis_completed: '正式诊断已提交，但缺少诊断完成事件。', missing_feedback_presented: '反馈可见记录存在，但缺少反馈展示事件。',
    missing_round_completed: '轮次已正式完成，但缺少完成事件。', missing_projection: '提交已形成，但缺少校准投影审计。',
    duplicate_event: '同一规范事件身份出现重复记录。', duplicate_projection: '同一 Attempt 出现多份投影。',
    resource_version_mismatch: '事件或投影绑定的题目版本与权威轮次不一致。', identity_mismatch: 'Session、Round、Response 或 Diagnosis 身份链不能闭合。',
    demo_scope_leak: '非 Product 数据进入了正式采集集合。', occurred_at_inversion: '事件事实时间与正常业务顺序不一致。',
    eligible_without_completed_round: '未完成轮次被标记为有效校准样本。', independent_sample_overcount: '独立样本声明超过实际不同 subjectKey 数量。',
  })[code];
}

function uniqueIssues(issues: LearningCollectionIntegrityIssue[]): LearningCollectionIntegrityIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}|${issue.learningRoundId || ''}|${issue.attemptId || ''}|${issue.sourceIds.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
