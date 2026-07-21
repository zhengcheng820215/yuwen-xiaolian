import type { Phase163MultiDayRunState } from '../schemas/phase163MultiDayOperation.schema.ts';

export type Phase163MultiDayRunRepository = {
  getByStudent(studentId: string): Promise<Phase163MultiDayRunState | null>;
  save(state: Phase163MultiDayRunState): Promise<Phase163MultiDayRunState>;
  clear(studentId: string): Promise<void>;
};
