import { validatePracticeAttempt } from '../response/practiceAttemptValidator.ts';
import { validatePersistedMistake } from './localPracticeStoreValidator.ts';
import {
  PRACTICE_COMPLETED_SESSION_LIMIT,
  PRACTICE_MISTAKE_LIMIT,
  createEmptyPracticeStore,
  type LocalPracticeStoreV0,
  type LocalPracticeStoreV1,
  type PracticeStoreIssue,
} from './localPracticeStoreTypes.ts';

function validTime(value: unknown): value is string { return typeof value === 'string' && !Number.isNaN(Date.parse(value)); }

export function migrateLocalPracticeStoreV0(value: LocalPracticeStoreV0, now: string, writerId: string): { store: LocalPracticeStoreV1; issues: PracticeStoreIssue[] } {
  const store = createEmptyPracticeStore(now, writerId);
  store.revision = 1;
  const issues: PracticeStoreIssue[] = [];
  if (value.activeAttempt) {
    if (validatePracticeAttempt(value.activeAttempt).passed && value.activeAttempt.session.status === 'active') store.activeAttempt = value.activeAttempt;
    else issues.push({ severity: 'warning', code: 'migration.active_attempt_dropped', path: 'activeAttempt', message: '旧练习状态不完整，已跳过。' });
  }
  if (Array.isArray(value.completedSessions)) {
    const byId = new Map<string, typeof value.completedSessions[number]>();
    value.completedSessions.forEach((item) => {
      if (item && typeof item.sessionId === 'string' && validTime(item.completedAt) && Array.isArray(item.baseQuestionIds)) byId.set(item.sessionId, item);
      else issues.push({ severity: 'warning', code: 'migration.completed_session_dropped', path: 'completedSessions', message: '一条旧完成摘要已跳过。' });
    });
    store.completedSessions = [...byId.values()].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)).slice(0, PRACTICE_COMPLETED_SESSION_LIMIT);
  }
  if (value.lastResult) issues.push({ severity: 'warning', code: 'migration.last_result_dropped', path: 'lastResult', message: '旧结果缺少完整作答事实，未迁移。' });
  if (Array.isArray(value.mistakes)) {
    const valid = value.mistakes.filter((item) => {
      const passed = validatePersistedMistake(item);
      if (!passed) issues.push({ severity: 'warning', code: 'migration.mistake_dropped', path: 'mistakes', message: '一条旧错题已跳过。' });
      return passed;
    });
    store.mistakes = [...new Map(valid.map((item) => [item.questionId, item])).values()].slice(0, PRACTICE_MISTAKE_LIMIT);
  }
  return { store, issues };
}
