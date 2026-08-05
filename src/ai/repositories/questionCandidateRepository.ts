import type {
  CandidateCommandName,
  CandidateCommandReceipt,
  CandidateDecisionEvent,
  QuestionCandidate,
  QuestionCandidateStatus,
} from '../schemas/questionCandidate.schema.ts';

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
  saveCommandReceipt(receipt: CandidateCommandReceipt): Promise<CandidateCommandReceipt>;
  getCommandReceipt(
    command: CandidateCommandName,
    idempotencyKey: string,
  ): Promise<CandidateCommandReceipt | null>;
  clear(): Promise<void>;
}
