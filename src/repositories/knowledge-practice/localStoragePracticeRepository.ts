import { buildCompletedSessionSummary, buildPracticeCompletionRecord, isLegacyPracticeCompletionRecord, upgradePracticeCompletionRecord } from '../../domain/knowledge-practice/persistence/buildPracticeCompletionRecord.ts';
import { migrateLocalPracticeStoreV0 } from '../../domain/knowledge-practice/persistence/migrateLocalPracticeStore.ts';
import { validateLocalPracticeStore, validatePersistedMistake } from '../../domain/knowledge-practice/persistence/localPracticeStoreValidator.ts';
import {
  PRACTICE_COMPLETED_SESSION_LIMIT,
  PRACTICE_STORE_MAX_BYTES,
  createEmptyPracticeStore,
  type LocalPracticeStoreV0,
  type LocalPracticeStoreV1,
  type PersistedKnowledgeMistake,
  type PracticeStorageLike,
  type PracticeStoreIssue,
  type PracticeStoreLoadResult,
  type PracticeStoreWriteResult,
} from '../../domain/knowledge-practice/persistence/localPracticeStoreTypes.ts';
import type { PracticeAttempt } from '../../domain/knowledge-practice/response/practiceResponseTypes.ts';
import { validatePracticeAttempt } from '../../domain/knowledge-practice/response/practiceAttemptValidator.ts';

export const PRACTICE_STORE_PRIMARY_KEY = 'yuwen_knowledge_practice_store_v1';
export const PRACTICE_STORE_BACKUP_KEY = 'yuwen_knowledge_practice_store_backup_v1';
export const PRACTICE_STORE_QUARANTINE_KEY = 'yuwen_knowledge_practice_quarantine_v1';

type CommitInput = { store: LocalPracticeStoreV1; expectedRevision: number; now: string };
type SaveAttemptInput = CommitInput & { attempt: PracticeAttempt; mistakes?: PersistedKnowledgeMistake[] };
type ResolveMistakeInput = CommitInput & { questionId: string };

const issue = (code: string, message: string, path = '', severity: 'error' | 'warning' = 'error'): PracticeStoreIssue => ({ code, message, path, severity });

function content(value: LocalPracticeStoreV1): string {
  const { revision: _revision, writerId: _writerId, updatedAt: _updatedAt, ...rest } = value;
  return JSON.stringify(rest);
}

function parseCurrent(raw: string | null): { kind: 'empty' } | { kind: 'valid'; store: LocalPracticeStoreV1 } | { kind: 'future' } | { kind: 'invalid' } {
  if (raw === null) return { kind: 'empty' };
  try {
    const value = JSON.parse(raw);
    if (Number.isInteger(value?.schemaVersion) && value.schemaVersion > 1) return { kind: 'future' };
    if (value?.schemaVersion !== 1) return { kind: 'invalid' };
    const validation = validateLocalPracticeStore(value);
    return validation.passed ? { kind: 'valid', store: value } : { kind: 'invalid' };
  } catch { return { kind: 'invalid' }; }
}

function repairPartialV1(value: unknown, now: string, writerId: string): { store: LocalPracticeStoreV1; issues: PracticeStoreIssue[] } | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as LocalPracticeStoreV1;
  if (source.schemaVersion !== 1 || !Number.isInteger(source.revision) || source.revision < 0 || !Array.isArray(source.completedSessions) || !Array.isArray(source.mistakes)) return null;
  const issues: PracticeStoreIssue[] = [];
  const activeAttempt = source.activeAttempt && validatePracticeAttempt(source.activeAttempt).passed && source.activeAttempt.session.status === 'active'
    ? source.activeAttempt
    : null;
  if (source.activeAttempt && !activeAttempt) issues.push(issue('repair.active_attempt_dropped', '无法恢复不完整的进行中练习。', 'activeAttempt', 'warning'));
  const completed = source.completedSessions.filter((item) => item && typeof item.sessionId === 'string' && typeof item.completedAt === 'string' && !Number.isNaN(Date.parse(item.completedAt)) && Array.isArray(item.baseQuestionIds));
  const completedSessions = [...new Map(completed.map((item) => [item.sessionId, item])).values()].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)).slice(0, 10);
  if (completedSessions.length !== source.completedSessions.length) issues.push(issue('repair.completed_sessions_filtered', '部分完成历史已隔离。', 'completedSessions', 'warning'));
  const validMistakes = source.mistakes.filter(validatePersistedMistake);
  const mistakes = [...new Map(validMistakes.map((item) => [item.questionId, item])).values()].slice(0, 200);
  if (mistakes.length !== source.mistakes.length) issues.push(issue('repair.mistakes_filtered', '部分错题记录已隔离。', 'mistakes', 'warning'));
  let lastCompletion = source.lastCompletion ?? null;
  if (lastCompletion) {
    const candidate = { ...source, activeAttempt: null, completedSessions, mistakes, lastCompletion, updatedAt: now, writerId };
    if (!validateLocalPracticeStore(candidate).passed) {
      lastCompletion = null;
      issues.push(issue('repair.last_completion_dropped', '最近结果记录不完整，已隔离。', 'lastCompletion', 'warning'));
    }
  }
  const store: LocalPracticeStoreV1 = {
    schemaVersion: 1,
    revision: source.revision,
    activeAttempt,
    completedSessions,
    lastCompletion,
    mistakes,
    ...(typeof source.lastAbandonedSessionId === 'string' ? { lastAbandonedSessionId: source.lastAbandonedSessionId } : {}),
    updatedAt: now,
    writerId,
  };
  return validateLocalPracticeStore(store).passed ? { store, issues } : null;
}

export class LocalStoragePracticeRepository {
  private readonly storage: PracticeStorageLike | null;
  private readonly writerId: string;

  constructor(storage: PracticeStorageLike | null, writerId: string) {
    this.storage = storage;
    this.writerId = writerId;
  }

  private empty(now: string) { return createEmptyPracticeStore(now, this.writerId); }

  private quarantine(now: string, codes: string[]) {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(PRACTICE_STORE_QUARANTINE_KEY);
      const previous = raw ? JSON.parse(raw) : [];
      const rows = Array.isArray(previous) ? previous : [];
      this.storage.setItem(PRACTICE_STORE_QUARANTINE_KEY, JSON.stringify([{ occurredAt: now, issueCodes: codes.slice(0, 10) }, ...rows].slice(0, 5)));
    } catch { /* quarantine must never block recovery */ }
  }

  load(now: string): PracticeStoreLoadResult {
    if (!this.storage) return { status: 'unavailable', store: this.empty(now), issues: [issue('storage.unavailable', '当前浏览器无法使用本地存储。')] };
    let primary: string | null;
    try { primary = this.storage.getItem(PRACTICE_STORE_PRIMARY_KEY); }
    catch { return { status: 'unavailable', store: this.empty(now), issues: [issue('storage.read_failed', '本地练习记录暂时无法读取。')] }; }
    if (primary === null) return { status: 'empty', store: this.empty(now) };

    let parsed: unknown;
    try { parsed = JSON.parse(primary); }
    catch { return this.recoverBackup(now, [issue('store.primary_json_invalid', '主练习记录已损坏。')]); }
    if (Number.isInteger((parsed as { schemaVersion?: number })?.schemaVersion) && (parsed as { schemaVersion: number }).schemaVersion > 1) {
      return { status: 'future_version', store: this.empty(now), issues: [issue('store.unsupported_future_version', '当前版本无法读取较新的练习记录。')] };
    }
    if ((parsed as { schemaVersion?: number })?.schemaVersion === undefined) {
      const migrated = migrateLocalPracticeStoreV0(parsed as LocalPracticeStoreV0, now, this.writerId);
      const validation = validateLocalPracticeStore(migrated.store);
      if (!validation.passed) return this.recoverBackup(now, [...migrated.issues, ...validation.issues]);
      const persisted = this.persistLoadedMigration(migrated.store, primary);
      if (!persisted) migrated.issues.push(issue('migration.write_failed', '旧记录已恢复到内存，但暂未保存。', '', 'warning'));
      return { status: 'migrated', store: migrated.store, fromVersion: 0, issues: migrated.issues };
    }
    const validation = validateLocalPracticeStore(parsed);
    if (validation.passed) {
      const loaded = parsed as LocalPracticeStoreV1;
      if (isLegacyPracticeCompletionRecord(loaded.lastCompletion)) {
        try {
          const upgraded = { ...loaded, lastCompletion: upgradePracticeCompletionRecord(loaded.lastCompletion), updatedAt: now, writerId: this.writerId };
          const upgradedValidation = validateLocalPracticeStore(upgraded);
          if (upgradedValidation.passed) {
            this.persistLoadedMigration(upgraded, primary);
            return { status: 'migrated', store: upgraded, fromVersion: 1, issues: [issue('migration.completion_result_upgraded', '旧版练习结果已升级。', 'lastCompletion', 'warning')] };
          }
        } catch { /* keep the valid legacy record; UI will use a controlled empty result */ }
      }
      return { status: 'loaded', store: loaded, issues: validation.issues };
    }
    const repaired = repairPartialV1(parsed, now, this.writerId);
    if (repaired) {
      this.quarantine(now, [...validation.issues.map((item) => item.code), ...repaired.issues.map((item) => item.code)]);
      this.persistLoadedMigration(repaired.store, primary);
      return { status: 'loaded', store: repaired.store, issues: repaired.issues };
    }
    return this.recoverBackup(now, validation.issues);
  }

  private persistLoadedMigration(store: LocalPracticeStoreV1, oldRaw: string): boolean {
    try {
      this.storage!.setItem(PRACTICE_STORE_BACKUP_KEY, oldRaw);
      this.storage!.setItem(PRACTICE_STORE_PRIMARY_KEY, JSON.stringify(store));
      return true;
    } catch { return false; }
  }

  private recoverBackup(now: string, primaryIssues: PracticeStoreIssue[]): PracticeStoreLoadResult {
    try {
      const backup = this.storage!.getItem(PRACTICE_STORE_BACKUP_KEY);
      if (backup) {
        const parsed = JSON.parse(backup);
        const validation = validateLocalPracticeStore(parsed);
        if (validation.passed) {
          try { this.storage!.setItem(PRACTICE_STORE_PRIMARY_KEY, backup); } catch { /* memory recovery remains valid */ }
          return { status: 'recovered_from_backup', store: parsed, issues: primaryIssues };
        }
      }
    } catch { /* fall through to controlled empty state */ }
    const codes = primaryIssues.map((item) => item.code);
    this.quarantine(now, codes);
    return { status: 'damaged', store: this.empty(now), issues: primaryIssues };
  }

  private write(input: CommitInput, transform: (store: LocalPracticeStoreV1) => LocalPracticeStoreV1): PracticeStoreWriteResult {
    const memoryCandidate = transform(input.store);
    if (!this.storage) return { status: 'unavailable', store: memoryCandidate, issues: [issue('storage.unavailable', '当前进度仅保存在本页面内存中。')] };
    let raw: string | null;
    try { raw = this.storage.getItem(PRACTICE_STORE_PRIMARY_KEY); }
    catch { return { status: 'unavailable', store: memoryCandidate, issues: [issue('storage.read_failed', '保存前无法读取本地记录。')] }; }
    const current = parseCurrent(raw);
    if (current.kind === 'future') return { status: 'failed', store: memoryCandidate, issues: [issue('store.unsupported_future_version', '检测到较新版本记录，未覆盖原数据。')] };
    if (current.kind === 'invalid') return { status: 'failed', store: memoryCandidate, issues: [issue('store.current_invalid', '现有本地记录异常，未覆盖原数据。')] };
    const revision = current.kind === 'valid' ? current.store.revision : 0;
    if (revision !== input.expectedRevision) {
      return current.kind === 'valid'
        ? { status: 'conflict', latest: current.store, issues: [issue('store.revision_conflict', '练习已在另一个页面更新，请重新载入最新进度。')] }
        : { status: 'conflict', latest: this.empty(input.now), issues: [issue('store.revision_conflict', '本地练习记录已变化。')] };
    }
    const candidate: LocalPracticeStoreV1 = { ...memoryCandidate, schemaVersion: 1, revision: revision + 1, updatedAt: input.now, writerId: this.writerId };
    const validation = validateLocalPracticeStore(candidate);
    if (!validation.passed) return { status: 'failed', store: memoryCandidate, issues: validation.issues };
    if (current.kind === 'valid' && content(current.store) === content(candidate)) return { status: 'reused', store: current.store };
    let serialized: string;
    try { serialized = JSON.stringify(candidate); }
    catch { return { status: 'failed', store: memoryCandidate, issues: [issue('store.serialization_failed', '练习状态无法序列化。')] }; }
    if (new TextEncoder().encode(serialized).length > PRACTICE_STORE_MAX_BYTES) return { status: 'failed', store: memoryCandidate, issues: [issue('store.size_limit', '练习记录超过本地存储限制。')] };
    try {
      if (raw !== null) this.storage.setItem(PRACTICE_STORE_BACKUP_KEY, raw);
      this.storage.setItem(PRACTICE_STORE_PRIMARY_KEY, serialized);
      return { status: 'saved', store: candidate };
    } catch { return { status: 'failed', store: memoryCandidate, issues: [issue('storage.write_failed', '本次进度未能保存，但可以继续当前练习。')] }; }
  }

  saveActiveAttempt(input: SaveAttemptInput): PracticeStoreWriteResult {
    return this.write(input, (store) => ({ ...store, activeAttempt: input.attempt, mistakes: input.mistakes ?? store.mistakes }));
  }

  completeAttempt(input: SaveAttemptInput): PracticeStoreWriteResult {
    const record = buildPracticeCompletionRecord(input.attempt);
    const summary = buildCompletedSessionSummary(input.attempt);
    return this.write(input, (store) => ({
      ...store,
      activeAttempt: null,
      lastCompletion: record,
      completedSessions: [summary, ...store.completedSessions.filter((item) => item.sessionId !== summary.sessionId)].slice(0, PRACTICE_COMPLETED_SESSION_LIMIT),
      mistakes: input.mistakes ?? store.mistakes,
    }));
  }

  abandonAttempt(input: SaveAttemptInput): PracticeStoreWriteResult {
    return this.write(input, (store) => ({ ...store, activeAttempt: null, lastAbandonedSessionId: input.attempt.session.id, mistakes: input.mistakes ?? store.mistakes }));
  }

  resolveMistake(input: ResolveMistakeInput): PracticeStoreWriteResult {
    return this.write(input, (store) => ({ ...store, mistakes: store.mistakes.map((item) => item.questionId === input.questionId ? { ...item, status: 'resolved' as const } : item) }));
  }
}

export function createBrowserPracticeRepository(writerId: string): LocalStoragePracticeRepository {
  let storage: PracticeStorageLike | null = null;
  try { if (typeof window !== 'undefined') storage = window.localStorage; } catch { storage = null; }
  return new LocalStoragePracticeRepository(storage, writerId);
}
