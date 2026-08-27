import { IndexedDBLearningPersistenceRepository } from '../ai/repositories/indexedDBLearningPersistenceRepository.ts';
import { IndexedDBRealLearningOperationRepository } from '../ai/repositories/indexedDBRealLearningOperationRepository.ts';
import {
  IndexedDBLearningObservationRepository,
  IndexedDBQuestionCalibrationProjectionRepository,
} from '../ai/repositories/indexedDBLearningCollectionRepositories.ts';
import { IndexedDBReadingOpenResponseGovernanceRepository } from
  '../ai/repositories/indexedDBReadingOpenResponseGovernanceRepository.ts';
import { IndexedDBReadingOpenResponseProcessFactRepository } from
  '../ai/repositories/indexedDBReadingOpenResponseProcessFactRepository.ts';
import { IndexedDBProductComplexityConvergenceObservationRepository } from
  '../ai/repositories/indexedDBProductComplexityConvergenceObservationRepository.ts';
import {
  auditReadingOpenResponseCalibrationIntegrity,
  projectReadingOpenResponseVersionCalibration,
} from '../ai/agents/readingOpenResponseRealCalibrationAgent.ts';
import { buildReadingOpenResponseGovernanceProjection } from
  '../ai/agents/readingOpenResponseExistingQuestionGovernanceAgent.ts';
import {
  LearningCollectionIntegrityService,
  selectLearningCollectionIntegrityScope,
} from '../ai/services/learningCollectionIntegrityService.ts';
import type { LearningCollectionIntegrityScope } from '../ai/schemas/learningCollectionIntegrity.schema.ts';
import type { LearningObservationEvent } from '../ai/schemas/learningObservationEvent.schema.ts';
import type { QuestionCalibrationProjectionRecord } from '../ai/schemas/questionCalibrationProjection.schema.ts';
import type { RealLearningOperationCheckpoint } from '../ai/schemas/realLearningOperation.schema.ts';
import { PHASE163_LEARNING_STUDENT_ID } from './phase163LearningIdentity.ts';
import { loadPhase163FeedbackRevisionObservationReport } from './phase163LiveLearning.ts';
import { resolveTrialLearningCollectionOriginPolicy } from
  '../ai/schemas/learningCollectionOriginPolicy.ts';

const feedbackMarkerPrefix = 'qingzhou:feedback-presentation:';

export async function loadLearningCollectionIntegrityView(
  scope: LearningCollectionIntegrityScope = 'current_collection',
) {
  const operationRepository = new IndexedDBRealLearningOperationRepository();
  const eventRepository = new IndexedDBLearningObservationRepository();
  const projectionRepository = new IndexedDBQuestionCalibrationProjectionRepository();
  const processFactRepository = new IndexedDBReadingOpenResponseProcessFactRepository();
  const governanceRepository = new IndexedDBReadingOpenResponseGovernanceRepository();
  const trialRepository = new IndexedDBProductComplexityConvergenceObservationRepository();
  const [
    checkpoints,
    persistenceRecords,
    events,
    projections,
    processFacts,
    governanceCases,
    governanceBatches,
    trialActivationState,
  ] = await Promise.all([
    operationRepository.listByStudent(PHASE163_LEARNING_STUDENT_ID),
    new IndexedDBLearningPersistenceRepository().listByStudent(PHASE163_LEARNING_STUDENT_ID),
    eventRepository.listAll(),
    projectionRepository.listAll(),
    processFactRepository.listAll(),
    governanceRepository.listCases(),
    governanceRepository.listBatches(),
    trialRepository.getActivationState(),
  ]);
  const activeTrialWindow = trialActivationState?.effectiveMode === 'real_trial'
    && trialActivationState.trialWindowId
    ? await trialRepository.getTrialWindow(trialActivationState.trialWindowId)
    : undefined;
  const currentCollectionStartedAt = activeTrialWindow?.status === 'active'
    ? activeTrialWindow.startsAt
    : undefined;
  const originPolicy = resolveTrialLearningCollectionOriginPolicy(activeTrialWindow?.trialWindowId);
  const generatedAt = new Date().toISOString();
  const service = new LearningCollectionIntegrityService();
  const input = {
    studentId: PHASE163_LEARNING_STUDENT_ID,
    generatedAt,
    checkpoints,
    persistenceRecords,
    events,
    projections,
    questionPresentedRoundIds: roundsWithEvent(events, 'question_presented'),
    feedbackPresentedRoundIds: checkpoints
      .filter((checkpoint) => hasFeedbackMarker(checkpoint.learningRoundId))
      .map((checkpoint) => checkpoint.learningRoundId),
    scope,
    currentCollectionStartedAt,
    trialWindowId: activeTrialWindow?.trialWindowId,
    originPolicyVersion: originPolicy?.policyVersion,
    internalAcceptanceSessionIds: [...(originPolicy?.internalAcceptanceSessionIds || [])],
  };
  const scoped = selectLearningCollectionIntegrityScope(input);
  const report = service.buildReport(input);
  const revisionObservation = await loadPhase163FeedbackRevisionObservationReport({
    recoverPending: false,
    learningRoundIds: [...scoped.includedRoundIds],
  });
  const scopedProcessFacts = processFacts.filter((fact) => (
    scoped.includedRoundIds.has(fact.learningRoundId)
  ));
  const resourceVersionIds = [...new Set([
    ...scopedProcessFacts.map((fact) => fact.resourceVersionId),
    ...scoped.input.projections.map((projection) => projection.resourceVersionId),
  ])].sort();
  const readingOpenResponseReports = resourceVersionIds.map((resourceVersionId) => (
    projectReadingOpenResponseVersionCalibration({
      resourceVersionId,
      events: scoped.input.events,
      projections: scoped.input.projections,
      processFacts: scopedProcessFacts,
      generatedAt,
    })
  ));
  return {
    report,
    collectionBoundary: {
      source: currentCollectionStartedAt ? 'active_trial_window' : 'static_generation',
      startedAt: report.currentCollectionStartedAt,
      trialWindowId: currentCollectionStartedAt ? activeTrialWindow?.trialWindowId : undefined,
      originPolicyVersion: originPolicy?.policyVersion,
    },
    revisionObservation,
    readingOpenResponse: {
      integrity: auditReadingOpenResponseCalibrationIntegrity({
        events: scoped.input.events,
        projections: scoped.input.projections,
        processFacts: scopedProcessFacts,
      }),
      governance: buildReadingOpenResponseGovernanceProjection({
        cases: governanceCases,
        batches: governanceBatches,
        calibrationReports: readingOpenResponseReports,
      }),
      reports: readingOpenResponseReports,
    },
    rounds: scoped.input.checkpoints.map((checkpoint) => roundView(
      checkpoint,
      scoped.input.events,
      scoped.input.projections,
      report.issues,
    )),
    internalAcceptanceRounds: checkpoints
      .filter((checkpoint) => scoped.internalAcceptanceRoundIds.has(checkpoint.learningRoundId))
      .map((checkpoint) => roundView(checkpoint, events, projections, [])),
  };
}

function roundView(
  checkpoint: RealLearningOperationCheckpoint,
  events: LearningObservationEvent[],
  projections: QuestionCalibrationProjectionRecord[],
  issues: ReturnType<LearningCollectionIntegrityService['buildReport']>['issues'],
) {
  const roundEvents = events.filter((event) => event.learningRoundId === checkpoint.learningRoundId);
  const roundProjections = projections.filter((record) => record.learningRoundId === checkpoint.learningRoundId);
  return {
    learningRoundId: checkpoint.learningRoundId,
    learningSessionId: checkpoint.learningSessionId,
    resourceVersionId: checkpoint.sourceResourceVersionId,
    status: checkpoint.status,
    events: roundEvents.map((event) => ({ eventType: event.eventType, occurredAt: event.occurredAt })),
    projections: roundProjections.map((record) => ({ attemptId: record.attemptId, status: record.status, itemScore: record.itemScore })),
    issues: issues.filter((issue) => issue.learningRoundId === checkpoint.learningRoundId),
  };
}

function roundsWithEvent(events: LearningObservationEvent[], eventType: LearningObservationEvent['eventType']): string[] {
  return [...new Set(events.filter((event) => event.eventType === eventType).map((event) => event.learningRoundId))];
}

function hasFeedbackMarker(roundId: string): boolean {
  try { return window.localStorage.getItem(`${feedbackMarkerPrefix}${roundId}`) === 'presented'; }
  catch { return false; }
}
