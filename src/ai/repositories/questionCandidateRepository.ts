import type {
  CandidateCommandName,
  CandidateCommandReceipt,
  CandidateDecisionEvent,
  QuestionCandidate,
  QuestionCandidateStatus,
} from '../schemas/questionCandidate.schema.ts';
import type { ExceptionCorrectionRecord } from
  '../schemas/questionCandidateCorrection.schema.ts';

export interface QuestionCandidateRepository {
  saveCandidate(candidate: QuestionCandidate): Promise<QuestionCandidate>;
  getCandidate(candidateId: string): Promise<QuestionCandidate | null>;
  listCandidates(trainingTaskId?: string): Promise<QuestionCandidate[]>;
  updateCandidateStatus(input: {
    candidateId: string;
    expectedStatus: QuestionCandidateStatus;
    status: QuestionCandidateStatus;
    occurredAt: string;
  }): Promise<QuestionCandidate>;
  saveDecisionEvent(event: CandidateDecisionEvent): Promise<CandidateDecisionEvent>;
  listDecisionEvents(candidateId?: string): Promise<CandidateDecisionEvent[]>;
  saveCorrectionRecord(record: ExceptionCorrectionRecord): Promise<ExceptionCorrectionRecord>;
  getCorrectionRecord(correctionId: string): Promise<ExceptionCorrectionRecord | null>;
  listCorrectionRecords(candidateId?: string): Promise<ExceptionCorrectionRecord[]>;
  saveCommandReceipt(receipt: CandidateCommandReceipt): Promise<CandidateCommandReceipt>;
  getCommandReceipt(
    command: CandidateCommandName,
    idempotencyKey: string,
  ): Promise<CandidateCommandReceipt | null>;
  clear(): Promise<void>;
}
