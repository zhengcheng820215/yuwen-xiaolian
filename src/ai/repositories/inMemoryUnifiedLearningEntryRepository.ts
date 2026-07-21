import type { UnifiedLearningActivityContext } from '../schemas/unifiedLearningEntry.schema.ts';
import type {
  UnifiedLearningEntryRepository,
  UnifiedLearningEntryWriteResult,
} from './unifiedLearningEntryRepository.ts';

export type InMemoryUnifiedLearningEntryStore = Map<string, UnifiedLearningActivityContext>;

export function createInMemoryUnifiedLearningEntryStore(): InMemoryUnifiedLearningEntryStore {
  return new Map<string, UnifiedLearningActivityContext>();
}

export class InMemoryUnifiedLearningEntryRepository implements UnifiedLearningEntryRepository {
  private readonly store: InMemoryUnifiedLearningEntryStore;

  constructor(store: InMemoryUnifiedLearningEntryStore = createInMemoryUnifiedLearningEntryStore()) {
    this.store = store;
  }

  async getByStudent(studentId: string): Promise<UnifiedLearningActivityContext | null> {
    return this.store.get(studentId) || null;
  }

  async save(context: UnifiedLearningActivityContext): Promise<UnifiedLearningEntryWriteResult> {
    const existing = this.store.get(context.studentId);
    if (existing?.status === 'active' && context.status === 'active' &&
      existing.learningSessionId !== context.learningSessionId) {
      return { status: 'conflict', context: existing, issues: ['multiple_active_sessions_not_allowed'] };
    }
    if (existing && JSON.stringify(existing) === JSON.stringify(context)) {
      return { status: 'reused', context: existing, issues: [] };
    }
    this.store.set(context.studentId, context);
    return { status: existing ? 'updated' : 'created', context, issues: [] };
  }

  async clear(studentId: string): Promise<void> {
    this.store.delete(studentId);
  }
}
