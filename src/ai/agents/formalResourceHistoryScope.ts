import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';
import type { FrozenQuestionResourceVersion } from '../schemas/questionResourceAdmission.schema.ts';
import type { ResourceMatchRecentHistory } from '../schemas/resourceMatchQuality.schema.ts';

export function buildScopedFormalResourceHistory(input: {
  studentId: string;
  records: LearningPersistenceRecord[];
  currentVersions: FrozenQuestionResourceVersion[];
  activeLearningSessionId?: string;
  historyWindowEndedAt: string;
}): ResourceMatchRecentHistory {
  const chronologicalRecords = [...input.records]
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
  const resourceVersionConsumptionSequence = chronologicalRecords
    .flatMap(resourceVersionIdsFromRecord);
  const globalVersionIds = uniqueStrings(resourceVersionConsumptionSequence);
  const activeLearningSessionId = input.activeLearningSessionId;
  const sessionRecords = activeLearningSessionId
    ? input.records.filter((record) => recordBelongsToSession(record, activeLearningSessionId))
    : [];
  const sessionVersionIds = uniqueStrings(sessionRecords.flatMap(resourceVersionIdsFromRecord));
  const sessionVersions = sessionVersionIds
    .map((id) => input.currentVersions.find((version) => version.resourceVersionId === id))
    .filter((version): version is FrozenQuestionResourceVersion => Boolean(version));

  return {
    studentId: input.studentId,
    recentTaskIds: uniqueStrings(sessionVersions.map((version) => version.taskId)),
    recentResourceIds: uniqueStrings(sessionVersions.map((version) => version.resourceId)),
    recentResourceVersionIds: globalVersionIds,
    resourceVersionConsumptionSequence,
    recentMaterialIds: uniqueStrings(sessionVersions.flatMap((version) => (
      version.materialId ? [version.materialId] : []
    ))),
    recentExecutionSessionIds: uniqueStrings(sessionRecords.flatMap((record) => {
      const id = record.learningRoundResult?.taskExecutionResult?.executionSessionId;
      return id ? [id] : [];
    })),
    historyWindowEndedAt: input.historyWindowEndedAt,
  };
}

export function recordBelongsToSession(
  record: LearningPersistenceRecord,
  learningSessionId: string,
): boolean {
  return record.learningRoundId.startsWith(`${learningSessionId}-round-`);
}

function resourceVersionIdsFromRecord(record: LearningPersistenceRecord): string[] {
  const id = record.concreteTask?.questionMetadata.questionId;
  return id ? [id] : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
