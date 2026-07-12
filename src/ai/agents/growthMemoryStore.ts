import type { GrowthMemoryRecord } from '../schemas/growthMemory.schema.ts';

export type GrowthMemoryStoreSaveResult = {
  record: GrowthMemoryRecord;
  inserted: boolean;
};

export class GrowthMemoryStore {
  private readonly records = new Map<string, GrowthMemoryRecord>();

  save(record: GrowthMemoryRecord): GrowthMemoryStoreSaveResult {
    const existing = this.records.get(record.recordId);
    if (existing) {
      return {
        record: existing,
        inserted: false,
      };
    }

    this.records.set(record.recordId, cloneRecord(record));
    return {
      record: cloneRecord(record),
      inserted: true,
    };
  }

  getByRecordId(recordId: string): GrowthMemoryRecord | undefined {
    const record = this.records.get(recordId);
    return record ? cloneRecord(record) : undefined;
  }

  queryByStudentId(studentId: string): GrowthMemoryRecord[] {
    return this.sortedRecords().filter((record) => record.studentId === studentId);
  }

  queryByAbilityId(abilityId: string): GrowthMemoryRecord[] {
    return this.sortedRecords().filter((record) => record.abilityId === abilityId);
  }

  queryByStudentAndAbility(input: {
    studentId: string;
    abilityId: string;
    limit?: number;
  }): GrowthMemoryRecord[] {
    const records = this.sortedRecords().filter((record) => (
      record.studentId === input.studentId &&
      record.abilityId === input.abilityId
    ));

    return input.limit ? records.slice(0, input.limit) : records;
  }

  list(): GrowthMemoryRecord[] {
    return this.sortedRecords();
  }

  clear(): void {
    this.records.clear();
  }

  private sortedRecords(): GrowthMemoryRecord[] {
    return [...this.records.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(cloneRecord);
  }
}

function cloneRecord(record: GrowthMemoryRecord): GrowthMemoryRecord {
  return JSON.parse(JSON.stringify(record)) as GrowthMemoryRecord;
}
