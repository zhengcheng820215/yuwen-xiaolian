import {
  isExistingQuestionGovernanceBatch,
  isExistingQuestionGovernanceCase,
  type ExistingQuestionGovernanceBatch,
  type ExistingQuestionGovernanceCase,
} from '../schemas/readingOpenResponseGovernance.schema.ts';
import type {
  ExistingQuestionGovernanceWriteResult,
  ReadingOpenResponseGovernanceRepository,
} from './readingOpenResponseGovernanceRepository.ts';

export class InMemoryReadingOpenResponseGovernanceRepository
implements ReadingOpenResponseGovernanceRepository {
  private readonly cases = new Map<string, ExistingQuestionGovernanceCase>();
  private readonly batches = new Map<string, ExistingQuestionGovernanceBatch>();

  async saveCase(
    governanceCase: ExistingQuestionGovernanceCase,
  ): Promise<ExistingQuestionGovernanceWriteResult> {
    if (!isExistingQuestionGovernanceCase(governanceCase)) {
      throw new Error('Existing Question Governance Case is invalid.');
    }
    const existing = this.cases.get(governanceCase.governanceCaseId);
    if (!existing) {
      this.cases.set(governanceCase.governanceCaseId, clone(governanceCase));
      return { status: 'created', governanceCase: clone(governanceCase), issues: [] };
    }
    if (stableStringify(existing) === stableStringify(governanceCase)) {
      return { status: 'unchanged', governanceCase: clone(existing), issues: [] };
    }
    if (!sameImmutableIdentity(existing, governanceCase)) {
      return {
        status: 'conflict',
        governanceCase: clone(existing),
        issues: ['governance_case_identity_conflict'],
      };
    }
    this.cases.set(governanceCase.governanceCaseId, clone(governanceCase));
    return { status: 'updated', governanceCase: clone(governanceCase), issues: [] };
  }

  async getCase(governanceCaseId: string): Promise<ExistingQuestionGovernanceCase | null> {
    const governanceCase = this.cases.get(governanceCaseId);
    return governanceCase ? clone(governanceCase) : null;
  }

  async listCases(): Promise<ExistingQuestionGovernanceCase[]> {
    return [...this.cases.values()]
      .sort((left, right) => left.priority - right.priority
        || left.createdAt.localeCompare(right.createdAt))
      .map(clone);
  }

  async saveBatch(batch: ExistingQuestionGovernanceBatch): Promise<ExistingQuestionGovernanceBatch> {
    if (!isExistingQuestionGovernanceBatch(batch)) {
      throw new Error('Existing Question Governance Batch is invalid.');
    }
    const existing = this.batches.get(batch.batchId);
    if (existing && (
      existing.createdAt !== batch.createdAt
      || existing.policyVersion !== batch.policyVersion
      || stableStringify(existing.governanceCaseIds) !== stableStringify(batch.governanceCaseIds)
    )) {
      throw new Error(`Governance batch is immutable: ${batch.batchId}`);
    }
    this.batches.set(batch.batchId, clone(batch));
    return clone(batch);
  }

  async getBatch(batchId: string): Promise<ExistingQuestionGovernanceBatch | null> {
    const batch = this.batches.get(batchId);
    return batch ? clone(batch) : null;
  }

  async listBatches(): Promise<ExistingQuestionGovernanceBatch[]> {
    return [...this.batches.values()]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(clone);
  }

  async clear(): Promise<void> {
    this.cases.clear();
    this.batches.clear();
  }
}

export function sameImmutableIdentity(
  left: ExistingQuestionGovernanceCase,
  right: ExistingQuestionGovernanceCase,
): boolean {
  return left.governanceCaseId === right.governanceCaseId
    && left.questionLineageId === right.questionLineageId
    && left.sourceResourceVersionId === right.sourceResourceVersionId
    && left.baselineAuditVersion === right.baselineAuditVersion
    && left.auditDigest === right.auditDigest
    && left.sourceDigest === right.sourceDigest
    && left.schemaVersion === right.schemaVersion;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sort(value));
}

function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, sort(item)]));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
