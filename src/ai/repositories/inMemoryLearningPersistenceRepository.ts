import type { LearningPersistenceRecord } from '../schemas/learningPersistence.schema.ts';
import type { LearningPersistenceRepository } from './learningPersistenceRepository.ts';

export class InMemoryLearningPersistenceRepository implements LearningPersistenceRepository {
  private readonly records = new Map<string, LearningPersistenceRecord>();

  async save(record: LearningPersistenceRecord): Promise<LearningPersistenceRecord> {
    this.records.set(recordKey(record.studentId, record.learningRoundId), record);
    return record;
  }

  async loadLatest(studentId: string): Promise<LearningPersistenceRecord | null> {
    const records = Array.from(this.records.values())
      .filter((record) => record.studentId === studentId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return records[0] || null;
  }

  async loadByRound(studentId: string, learningRoundId: string): Promise<LearningPersistenceRecord | null> {
    return this.records.get(recordKey(studentId, learningRoundId)) || null;
  }

  async listByStudent(studentId: string): Promise<LearningPersistenceRecord[]> {
    return Array.from(this.records.values())
      .filter((record) => record.studentId === studentId)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }

  async clear(studentId: string): Promise<void> {
    for (const key of Array.from(this.records.keys())) {
      if (key.startsWith(`${studentId}::`)) {
        this.records.delete(key);
      }
    }
  }
}

function recordKey(studentId: string, learningRoundId: string): string {
  return `${studentId}::${learningRoundId}`;
}
