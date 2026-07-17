import type { FormalDiagnosisCommit } from '../schemas/diagnosisRunRecord.schema.ts';
import {
  compareFormalDiagnosisCommits,
  type FormalDiagnosisCommitWriteResult,
  type FormalDiagnosisRepository,
} from './formalDiagnosisRepository.ts';

export class InMemoryFormalDiagnosisRepository implements FormalDiagnosisRepository {
  private readonly commits = new Map<string, FormalDiagnosisCommit>();

  async commit(candidate: FormalDiagnosisCommit): Promise<FormalDiagnosisCommitWriteResult> {
    const existing = this.commits.get(candidate.requestId);
    if (existing) return compareFormalDiagnosisCommits(existing, candidate);

    this.commits.set(candidate.requestId, candidate);
    return {
      status: 'created',
      commit: candidate,
      issues: [],
    };
  }

  async getByRequestId(requestId: string): Promise<FormalDiagnosisCommit | null> {
    return this.commits.get(requestId) || null;
  }

  async clear(): Promise<void> {
    this.commits.clear();
  }
}
