import type { UnifiedLearningActivityContext } from '../schemas/unifiedLearningEntry.schema.ts';

export type UnifiedLearningEntryWriteResult = {
  status: 'created' | 'updated' | 'reused' | 'conflict';
  context: UnifiedLearningActivityContext;
  issues: string[];
};

export type UnifiedLearningEntryRepository = {
  getByStudent(studentId: string): Promise<UnifiedLearningActivityContext | null>;
  save(context: UnifiedLearningActivityContext): Promise<UnifiedLearningEntryWriteResult>;
  clear(studentId: string): Promise<void>;
};
