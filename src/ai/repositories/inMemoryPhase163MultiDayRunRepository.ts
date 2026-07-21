import type { Phase163MultiDayRunState } from '../schemas/phase163MultiDayOperation.schema.ts';
import type { Phase163MultiDayRunRepository } from './phase163MultiDayRunRepository.ts';

export class InMemoryPhase163MultiDayRunRepository implements Phase163MultiDayRunRepository {
  private readonly records = new Map<string, Phase163MultiDayRunState>();

  async getByStudent(studentId: string): Promise<Phase163MultiDayRunState | null> {
    return this.records.get(studentId) || null;
  }

  async save(state: Phase163MultiDayRunState): Promise<Phase163MultiDayRunState> {
    const existing = this.records.get(state.studentId);
    if (existing && existing.runId !== state.runId && existing.status !== 'acceptance_ready') {
      throw new Error('An unfinished multi-day run already exists for this student.');
    }
    this.records.set(state.studentId, state);
    return state;
  }

  async clear(studentId: string): Promise<void> {
    this.records.delete(studentId);
  }
}
