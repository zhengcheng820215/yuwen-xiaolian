import {
  isUnifiedLearningActivityContext,
  type UnifiedLearningActivityContext,
} from '../schemas/unifiedLearningEntry.schema.ts';
import type {
  UnifiedLearningEntryRepository,
  UnifiedLearningEntryWriteResult,
} from './unifiedLearningEntryRepository.ts';

const KEY_PREFIX = 'yuwen_xiaolian_unified_entry_v1:';

export class LocalStorageUnifiedLearningEntryRepository implements UnifiedLearningEntryRepository {
  async getByStudent(studentId: string): Promise<UnifiedLearningActivityContext | null> {
    const storage = requireStorage();
    const raw = storage.getItem(key(studentId));
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isUnifiedLearningActivityContext(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async save(context: UnifiedLearningActivityContext): Promise<UnifiedLearningEntryWriteResult> {
    const existing = await this.getByStudent(context.studentId);
    if (existing?.status === 'active' && context.status === 'active' &&
      existing.learningSessionId !== context.learningSessionId) {
      return { status: 'conflict', context: existing, issues: ['multiple_active_sessions_not_allowed'] };
    }
    if (existing && JSON.stringify(existing) === JSON.stringify(context)) {
      return { status: 'reused', context: existing, issues: [] };
    }
    requireStorage().setItem(key(context.studentId), JSON.stringify(context));
    return { status: existing ? 'updated' : 'created', context, issues: [] };
  }

  async clear(studentId: string): Promise<void> {
    requireStorage().removeItem(key(studentId));
  }
}

function key(studentId: string): string {
  return `${KEY_PREFIX}${studentId}`;
}

function requireStorage(): Storage {
  if (typeof localStorage === 'undefined') {
    throw new Error('LocalStorage is not available in this runtime.');
  }
  return localStorage;
}
