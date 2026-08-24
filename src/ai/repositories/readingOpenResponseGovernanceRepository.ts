import type {
  ExistingQuestionGovernanceBatch,
  ExistingQuestionGovernanceCase,
} from '../schemas/readingOpenResponseGovernance.schema.ts';

export type ExistingQuestionGovernanceWriteResult = {
  status: 'created' | 'updated' | 'unchanged' | 'conflict';
  governanceCase: ExistingQuestionGovernanceCase;
  issues: string[];
};

export interface ReadingOpenResponseGovernanceRepository {
  saveCase(
    governanceCase: ExistingQuestionGovernanceCase,
  ): Promise<ExistingQuestionGovernanceWriteResult>;
  getCase(governanceCaseId: string): Promise<ExistingQuestionGovernanceCase | null>;
  listCases(): Promise<ExistingQuestionGovernanceCase[]>;
  saveBatch(batch: ExistingQuestionGovernanceBatch): Promise<ExistingQuestionGovernanceBatch>;
  getBatch(batchId: string): Promise<ExistingQuestionGovernanceBatch | null>;
  listBatches(): Promise<ExistingQuestionGovernanceBatch[]>;
  clear(): Promise<void>;
}
