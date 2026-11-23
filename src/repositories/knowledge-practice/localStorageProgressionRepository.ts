import type { PracticeStorageLike } from '../../domain/knowledge-practice/persistence/localPracticeStoreTypes.ts';
import type { KnowledgePointProgress } from '../../domain/knowledge-practice/progression/knowledgePointProgression.ts';

export const PROGRESSION_STORE_KEY = 'yuwen_knowledge_point_progression_v1';
export const PROGRESSION_STORE_BACKUP_KEY = 'yuwen_knowledge_point_progression_backup_v1';
const MAX_BYTES = 256 * 1024;

export type ProgressionStore = {
  schemaVersion: 1;
  revision: number;
  updatedAt: string;
  writerId: string;
  points: KnowledgePointProgress[];
};

export type ProgressionLoadResult =
  | { status: 'empty' | 'loaded' | 'recovered_from_backup'; store: ProgressionStore }
  | { status: 'unavailable' | 'invalid' | 'future_version'; store: null };

export type ProgressionSaveResult =
  | { status: 'saved'; store: ProgressionStore }
  | { status: 'conflict'; latest: ProgressionStore }
  | { status: 'unavailable' | 'invalid' | 'future_version' | 'size_limit' | 'write_failed'; store: null };

const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0) && new Set(value).size === value.length;

function validCorrect(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return ['responseId', 'sessionId', 'questionId'].every((key) => typeof item[key] === 'string' && item[key].length > 0)
    && validDate(item.answeredAt);
}

function validProgress(value: unknown): value is KnowledgePointProgress {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (item.schemaVersion !== 1 || typeof item.knowledgePointId !== 'string' || !item.knowledgePointId
    || typeof item.mappingVersion !== 'string' || !item.mappingVersion
    || typeof item.ruleVersion !== 'string' || !item.ruleVersion
    || !Number.isInteger(item.currentBand) || (item.currentBand as number) < 1
    || !strings(item.exposedQuestionIds) || !strings(item.exposedVariantGroupIds)
    || !strings(item.processedResponseIds) || !Array.isArray(item.tasks)
    || !item.bands || typeof item.bands !== 'object' || Array.isArray(item.bands)
    || (item.lastObservedAt !== undefined && !validDate(item.lastObservedAt))) return false;
  const bands = item.bands as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(bands, String(item.currentBand))) return false;
  for (const [key, value] of Object.entries(bands)) {
    if (!/^[1-9]\d*$/.test(key) || !value || typeof value !== 'object') return false;
    const band = value as Record<string, unknown>;
    if (!['training', 'pending_independent_retest', 'provisionally_stable', 'needs_recheck'].includes(String(band.status))
      || !Array.isArray(band.consecutiveCorrect) || !band.consecutiveCorrect.every(validCorrect)
      || !Array.isArray(band.recheckCorrect) || !band.recheckCorrect.every(validCorrect)
      || typeof band.bridgeRequired !== 'boolean') return false;
  }
  const taskIds = new Set<string>();
  const taskBands = new Set<number>();
  for (const raw of item.tasks) {
    if (!raw || typeof raw !== 'object') return false;
    const task = raw as Record<string, unknown>;
    if (typeof task.id !== 'string' || !task.id || taskIds.has(task.id)
      || !['independent_retest', 'error_recheck', 'retention'].includes(String(task.kind))
      || !Number.isInteger(task.band) || !Object.prototype.hasOwnProperty.call(bands, String(task.band))
      || taskBands.has(task.band as number) || !validDate(task.dueAt)
      || typeof task.createdByResponseId !== 'string' || !task.createdByResponseId) return false;
    taskIds.add(task.id);
    taskBands.add(task.band as number);
  }
  return true;
}

function validStore(value: unknown): value is ProgressionStore {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (item.schemaVersion !== 1 || !Number.isInteger(item.revision) || (item.revision as number) < 0
    || !validDate(item.updatedAt) || typeof item.writerId !== 'string' || !item.writerId
    || !Array.isArray(item.points) || !item.points.every(validProgress)) return false;
  const pointIds = item.points.map((point: KnowledgePointProgress) => point.knowledgePointId);
  return new Set(pointIds).size === pointIds.length;
}

type ParsedStore =
  | { status: 'empty' | 'invalid' | 'future_version'; store: null }
  | { status: 'loaded'; store: ProgressionStore };

function parse(raw: string | null): ParsedStore {
  if (raw === null) return { status: 'empty', store: null };
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (Number.isInteger(value?.schemaVersion) && (value.schemaVersion as number) > 1) return { status: 'future_version', store: null };
    return validStore(value) ? { status: 'loaded', store: value } : { status: 'invalid', store: null };
  } catch { return { status: 'invalid', store: null }; }
}

export class LocalStorageProgressionRepository {
  private readonly storage: PracticeStorageLike | null;
  private readonly writerId: string;

  constructor(storage: PracticeStorageLike | null, writerId: string) {
    this.storage = storage;
    this.writerId = writerId;
  }

  private empty(now: string): ProgressionStore {
    return { schemaVersion: 1, revision: 0, updatedAt: now, writerId: this.writerId, points: [] };
  }

  load(now: string): ProgressionLoadResult {
    if (!this.storage) return { status: 'unavailable', store: null };
    let raw: string | null;
    try { raw = this.storage.getItem(PROGRESSION_STORE_KEY); }
    catch { return { status: 'unavailable', store: null }; }
    if (raw === null) return { status: 'empty', store: this.empty(now) };
    const primary = parse(raw);
    if (primary.status === 'loaded' || primary.status === 'future_version') return primary;
    try {
      const backup = parse(this.storage.getItem(PROGRESSION_STORE_BACKUP_KEY));
      if (backup.status === 'loaded') return { status: 'recovered_from_backup', store: backup.store };
    } catch { /* preserve the invalid result */ }
    return { status: 'invalid', store: null };
  }

  savePoint(input: { point: KnowledgePointProgress; expectedRevision: number; now: string }): ProgressionSaveResult {
    if (!this.storage) return { status: 'unavailable', store: null };
    if (!validProgress(input.point) || !validDate(input.now) || !Number.isInteger(input.expectedRevision)) return { status: 'invalid', store: null };
    let raw: string | null;
    try { raw = this.storage.getItem(PROGRESSION_STORE_KEY); }
    catch { return { status: 'unavailable', store: null }; }
    const parsed = parse(raw);
    if (parsed.status === 'future_version') return { status: 'future_version', store: null };
    if (parsed.status === 'invalid') return { status: 'invalid', store: null };
    const current = parsed.status === 'empty' ? this.empty(input.now) : parsed.store;
    if (current.revision !== input.expectedRevision) return { status: 'conflict', latest: current };
    const candidate: ProgressionStore = {
      schemaVersion: 1,
      revision: current.revision + 1,
      updatedAt: input.now,
      writerId: this.writerId,
      points: [...current.points.filter((point) => point.knowledgePointId !== input.point.knowledgePointId), input.point],
    };
    if (!validStore(candidate)) return { status: 'invalid', store: null };
    const serialized = JSON.stringify(candidate);
    if (new TextEncoder().encode(serialized).length > MAX_BYTES) return { status: 'size_limit', store: null };
    try {
      if (raw !== null) this.storage.setItem(PROGRESSION_STORE_BACKUP_KEY, raw);
      this.storage.setItem(PROGRESSION_STORE_KEY, serialized);
      return { status: 'saved', store: candidate };
    } catch { return { status: 'write_failed', store: null }; }
  }
}

export function createBrowserProgressionRepository(writerId: string): LocalStorageProgressionRepository {
  let storage: PracticeStorageLike | null = null;
  try { if (typeof window !== 'undefined') storage = window.localStorage; } catch { storage = null; }
  return new LocalStorageProgressionRepository(storage, writerId);
}
