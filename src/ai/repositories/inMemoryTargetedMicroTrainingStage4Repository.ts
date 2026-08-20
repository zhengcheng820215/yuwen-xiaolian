import {
  createEmptyTargetedMicroTrainingStage4Snapshot,
  isTargetedMicroTrainingStage4Snapshot,
  type TargetedMicroTrainingStage4Snapshot,
} from '../schemas/targetedMicroTrainingStage4.schema.ts';
import type {
  TargetedMicroTrainingStage4Repository,
  TargetedMicroTrainingStage4WriteResult,
} from './targetedMicroTrainingStage4Repository.ts';

export class InMemoryTargetedMicroTrainingStage4Repository
implements TargetedMicroTrainingStage4Repository {
  private snapshot: TargetedMicroTrainingStage4Snapshot;

  constructor(now = new Date().toISOString()) {
    this.snapshot = createEmptyTargetedMicroTrainingStage4Snapshot(now);
  }

  async load(): Promise<TargetedMicroTrainingStage4Snapshot> {
    return clone(this.snapshot);
  }

  async save(
    snapshot: TargetedMicroTrainingStage4Snapshot,
    expectedRevision: number,
  ): Promise<TargetedMicroTrainingStage4WriteResult> {
    if (expectedRevision !== this.snapshot.revision) {
      return { status: 'conflict', snapshot: clone(this.snapshot) };
    }
    const next = normalizeTargetedMicroTrainingStage4Write(snapshot, expectedRevision);
    if (stableStringify(withoutRevision(next)) === stableStringify(withoutRevision(this.snapshot))) {
      return { status: 'unchanged', snapshot: clone(this.snapshot) };
    }
    this.snapshot = next;
    return { status: 'committed', snapshot: clone(this.snapshot) };
  }

  async clear(): Promise<void> {
    this.snapshot = createEmptyTargetedMicroTrainingStage4Snapshot(new Date().toISOString());
  }
}

export function normalizeTargetedMicroTrainingStage4Write(
  snapshot: TargetedMicroTrainingStage4Snapshot,
  expectedRevision: number,
): TargetedMicroTrainingStage4Snapshot {
  const next = clone({ ...snapshot, revision: expectedRevision + 1 });
  if (!isTargetedMicroTrainingStage4Snapshot(next)) {
    throw new Error('Targeted micro-training Stage 4 snapshot is invalid.');
  }
  assertUnique(next.manifests, 'packId', 'Pack Manifest');
  assertUnique(next.audits, 'auditId', 'Pack Audit');
  assertUnique(next.events, 'eventId', 'Runtime Event');
  assertUnique(next.outbox, 'outboxId', 'Outbox Entry');
  assertUnique(next.episodes, 'episodeId', 'Calibration Episode');
  assertUnique(next.followUps, 'observationId', 'Follow-up Observation');
  assertUnique(next.decisions, 'decisionId', 'Calibration Decision');
  return next;
}

function assertUnique<T extends object>(values: T[], key: keyof T, label: string): void {
  const seen = new Map<unknown, string>();
  values.forEach((value) => {
    const id = value[key];
    const serialized = stableStringify(value);
    const existing = seen.get(id);
    if (existing && existing !== serialized) {
      throw new Error(`${label} identity conflict: ${String(id)}`);
    }
    seen.set(id, serialized);
  });
}

function withoutRevision(snapshot: TargetedMicroTrainingStage4Snapshot) {
  const { revision: _revision, updatedAt: _updatedAt, ...semantic } = snapshot;
  return semantic;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, sortValue(item)]));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

