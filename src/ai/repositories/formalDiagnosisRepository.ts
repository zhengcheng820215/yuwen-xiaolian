import type { FormalDiagnosisCommit } from '../schemas/diagnosisRunRecord.schema.ts';

export type FormalDiagnosisCommitWriteResult = {
  status: 'created' | 'reused' | 'conflict';
  commit: FormalDiagnosisCommit;
  issues: string[];
};

export type FormalDiagnosisRepository = {
  commit(candidate: FormalDiagnosisCommit): Promise<FormalDiagnosisCommitWriteResult>;
  getByRequestId(requestId: string): Promise<FormalDiagnosisCommit | null>;
  clear(): Promise<void>;
};

export function compareFormalDiagnosisCommits(
  existing: FormalDiagnosisCommit,
  candidate: FormalDiagnosisCommit,
): FormalDiagnosisCommitWriteResult {
  if (existing.requestId !== candidate.requestId) {
    return {
      status: 'conflict',
      commit: existing,
      issues: ['Formal Diagnosis requestId mismatch.'],
    };
  }

  const sameDiagnosis = stableStringify(existing.diagnosisResult) === stableStringify(candidate.diagnosisResult);
  return {
    status: sameDiagnosis ? 'reused' : 'conflict',
    commit: existing,
    issues: sameDiagnosis
      ? []
      : ['A different Formal Diagnosis is already committed for this requestId.'],
  };
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
