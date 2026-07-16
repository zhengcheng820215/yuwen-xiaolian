import type {
  LearningSessionQuery,
  LearningSessionRecord,
} from '../schemas/learningSessionHistory.schema.ts';
import {
  filterLearningSessions,
  type LearningSessionRepository,
} from './learningSessionRepository.ts';

export class InMemoryLearningSessionRepository implements LearningSessionRepository {
  private readonly records = new Map<string, LearningSessionRecord>();

  async save(record: LearningSessionRecord): Promise<LearningSessionRecord> {
    this.assertRoundOwnership(record);
    this.records.set(recordKey(record.studentId, record.sessionId), record);
    return record;
  }

  async getById(studentId: string, sessionId: string): Promise<LearningSessionRecord | null> {
    return this.records.get(recordKey(studentId, sessionId)) || null;
  }

  async findByRoundId(studentId: string, learningRoundId: string): Promise<LearningSessionRecord | null> {
    return Array.from(this.records.values()).find((record) => (
      record.studentId === studentId && record.learningRoundIds.includes(learningRoundId)
    )) || null;
  }

  async query(input: LearningSessionQuery): Promise<LearningSessionRecord[]> {
    return filterLearningSessions(Array.from(this.records.values()), input);
  }

  async clear(studentId: string): Promise<void> {
    for (const key of Array.from(this.records.keys())) {
      if (key.startsWith(`${studentId}::`)) this.records.delete(key);
    }
  }

  private assertRoundOwnership(candidate: LearningSessionRecord): void {
    for (const record of this.records.values()) {
      if (record.sessionId === candidate.sessionId && record.studentId === candidate.studentId) continue;
      const duplicate = candidate.learningRoundIds.find((roundId) => record.learningRoundIds.includes(roundId));
      if (duplicate) {
        throw new Error(`learningRoundId already belongs to another session: ${duplicate}`);
      }
    }
  }
}

function recordKey(studentId: string, sessionId: string): string {
  return `${studentId}::${sessionId}`;
}
