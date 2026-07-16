import type {
  LearningSessionQuery,
  LearningSessionRecord,
} from '../schemas/learningSessionHistory.schema.ts';

export type LearningSessionRepository = {
  save(record: LearningSessionRecord): Promise<LearningSessionRecord>;
  getById(studentId: string, sessionId: string): Promise<LearningSessionRecord | null>;
  findByRoundId(studentId: string, learningRoundId: string): Promise<LearningSessionRecord | null>;
  query(input: LearningSessionQuery): Promise<LearningSessionRecord[]>;
  clear(studentId: string): Promise<void>;
};

export function filterLearningSessions(
  records: LearningSessionRecord[],
  query: LearningSessionQuery,
): LearningSessionRecord[] {
  const filtered = records
    .filter((record) => record.studentId === query.studentId)
    .filter((record) => !query.abilityId || record.targetAbilityIds.includes(query.abilityId))
    .filter((record) => !query.startedFrom || Date.parse(record.startedAt) >= Date.parse(query.startedFrom))
    .filter((record) => !query.startedTo || Date.parse(record.startedAt) <= Date.parse(query.startedTo))
    .filter((record) => !query.status || record.status === query.status)
    .filter((record) => (
      query.hasUnfinishedRound === undefined ||
      Boolean(record.unfinishedRoundId) === query.hasUnfinishedRound
    ))
    .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt));

  return query.limit ? filtered.slice(0, query.limit) : filtered;
}
