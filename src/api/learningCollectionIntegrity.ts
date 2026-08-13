import { IndexedDBLearningPersistenceRepository } from '../ai/repositories/indexedDBLearningPersistenceRepository.ts';
import { IndexedDBRealLearningOperationRepository } from '../ai/repositories/indexedDBRealLearningOperationRepository.ts';
import {
  IndexedDBLearningObservationRepository,
  IndexedDBQuestionCalibrationProjectionRepository,
} from '../ai/repositories/indexedDBLearningCollectionRepositories.ts';
import { LearningCollectionIntegrityService } from '../ai/services/learningCollectionIntegrityService.ts';
import type { LearningObservationEvent } from '../ai/schemas/learningObservationEvent.schema.ts';
import type { QuestionCalibrationProjectionRecord } from '../ai/schemas/questionCalibrationProjection.schema.ts';
import type { RealLearningOperationCheckpoint } from '../ai/schemas/realLearningOperation.schema.ts';
import { PHASE163_LEARNING_STUDENT_ID } from './phase163LearningIdentity.ts';

const feedbackMarkerPrefix = 'qingzhou:feedback-presentation:';

export async function loadLearningCollectionIntegrityView() {
  const operationRepository = new IndexedDBRealLearningOperationRepository();
  const eventRepository = new IndexedDBLearningObservationRepository();
  const projectionRepository = new IndexedDBQuestionCalibrationProjectionRepository();
  const [checkpoints, persistenceRecords, events, projections] = await Promise.all([
    operationRepository.listByStudent(PHASE163_LEARNING_STUDENT_ID),
    new IndexedDBLearningPersistenceRepository().listByStudent(PHASE163_LEARNING_STUDENT_ID),
    eventRepository.listAll(),
    projectionRepository.listAll(),
  ]);
  const generatedAt = new Date().toISOString();
  const service = new LearningCollectionIntegrityService();
  const report = service.buildReport({
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
  });
  return {
    report,
    rounds: checkpoints.map((checkpoint) => roundView(checkpoint, events, projections, report.issues)),
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
    projections: roundProjections.map((record) => ({ status: record.status, itemScore: record.itemScore })),
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
