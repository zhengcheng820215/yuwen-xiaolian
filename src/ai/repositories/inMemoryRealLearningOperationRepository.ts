import type {
  RealLearningOperationRepository,
  RealLearningOperationWriteResult,
} from './realLearningOperationRepository.ts';
import type { RealLearningOperationCheckpoint } from '../schemas/realLearningOperation.schema.ts';

export type InMemoryRealLearningOperationStore = Map<string, RealLearningOperationCheckpoint>;

const STAGE_ORDER: Record<RealLearningOperationCheckpoint['stage'], number> = {
  task_prepared: 1,
  response_validated: 2,
  diagnosis_committed: 3,
  evidence_returned: 4,
  persisted: 5,
  next_task_ready: 6,
};

export function createInMemoryRealLearningOperationStore(): InMemoryRealLearningOperationStore {
  return new Map<string, RealLearningOperationCheckpoint>();
}

export class InMemoryRealLearningOperationRepository implements RealLearningOperationRepository {
  private readonly records: InMemoryRealLearningOperationStore;

  constructor(records: InMemoryRealLearningOperationStore = createInMemoryRealLearningOperationStore()) {
    this.records = records;
  }

  async getByOperationId(operationId: string): Promise<RealLearningOperationCheckpoint | null> {
    return this.records.get(operationId) || null;
  }

  async save(checkpoint: RealLearningOperationCheckpoint): Promise<RealLearningOperationWriteResult> {
    const existing = this.records.get(checkpoint.operationId);
    if (!existing) {
      this.records.set(checkpoint.operationId, checkpoint);
      return { status: 'created', checkpoint, issues: [] };
    }

    const identityIssues = validateStableIdentity(existing, checkpoint);
    if (identityIssues.length > 0 || STAGE_ORDER[checkpoint.stage] < STAGE_ORDER[existing.stage]) {
      const issues = [
        ...identityIssues,
        ...(STAGE_ORDER[checkpoint.stage] < STAGE_ORDER[existing.stage]
          ? ['operation_stage_regression']
          : []),
      ];
      return { status: 'conflict', checkpoint: existing, issues };
    }

    if (stableStringify(existing) === stableStringify(checkpoint)) {
      return { status: 'reused', checkpoint: existing, issues: [] };
    }

    this.records.set(checkpoint.operationId, checkpoint);
    return { status: 'updated', checkpoint, issues: [] };
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}

function validateStableIdentity(
  existing: RealLearningOperationCheckpoint,
  incoming: RealLearningOperationCheckpoint,
): string[] {
  const keys: Array<keyof RealLearningOperationCheckpoint> = [
    'learningSessionId',
    'learningRoundId',
    'studentId',
    'sourceResourceId',
    'sourceResourceVersionId',
    'sourceTaskId',
    'diagnosisRequestId',
  ];
  return keys
    .filter((key) => existing[key] !== incoming[key])
    .map((key) => `operation_identity_conflict:${String(key)}`);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortValue(item)]),
  );
}
