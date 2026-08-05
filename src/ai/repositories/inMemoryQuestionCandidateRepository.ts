import type { QuestionCandidateRepository } from './questionCandidateRepository.ts';
import {
  cloneQuestionCandidate,
  type CandidateCommandName,
  type CandidateCommandReceipt,
  type CandidateDecisionEvent,
  type QuestionCandidate,
  type QuestionCandidateStatus,
} from '../schemas/questionCandidate.schema.ts';
import type { ExceptionCorrectionRecord } from
  '../schemas/questionCandidateCorrection.schema.ts';

export class InMemoryQuestionCandidateRepository
implements QuestionCandidateRepository {
  private readonly candidates = new Map<string, QuestionCandidate>();
  private readonly events = new Map<string, CandidateDecisionEvent>();
  private readonly correctionRecords = new Map<string, ExceptionCorrectionRecord>();
  private readonly receipts = new Map<string, CandidateCommandReceipt>();

  async saveCandidate(candidate: QuestionCandidate): Promise<QuestionCandidate> {
    const existing = this.candidates.get(candidate.candidateId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(candidate)) {
      throw new Error(`Question candidate is immutable: ${candidate.candidateId}`);
    }
    this.candidates.set(candidate.candidateId, cloneQuestionCandidate(candidate));
    return cloneQuestionCandidate(candidate);
  }

  async getCandidate(candidateId: string): Promise<QuestionCandidate | null> {
    const candidate = this.candidates.get(candidateId);
    return candidate ? cloneQuestionCandidate(candidate) : null;
  }

  async listCandidates(trainingTaskId?: string): Promise<QuestionCandidate[]> {
    return [...this.candidates.values()]
      .filter((candidate) => !trainingTaskId || candidate.trainingTaskId === trainingTaskId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(cloneQuestionCandidate);
  }

  async updateCandidateStatus(input: {
    candidateId: string;
    expectedStatus: QuestionCandidateStatus;
    status: QuestionCandidateStatus;
    occurredAt: string;
  }): Promise<QuestionCandidate> {
    const candidate = this.candidates.get(input.candidateId);
    if (!candidate) throw new Error(`Question candidate not found: ${input.candidateId}`);
    if (candidate.status !== input.expectedStatus) {
      throw new Error(
        `Question candidate status conflict: expected ${input.expectedStatus}, actual ${candidate.status}.`,
      );
    }
    const updated: QuestionCandidate = {
      ...candidate,
      status: input.status,
      adoptedAt: input.status === 'adopted' ? input.occurredAt : candidate.adoptedAt,
    };
    this.candidates.set(input.candidateId, cloneQuestionCandidate(updated));
    return cloneQuestionCandidate(updated);
  }

  async saveDecisionEvent(event: CandidateDecisionEvent): Promise<CandidateDecisionEvent> {
    const existing = this.events.get(event.eventId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(event)) {
      throw new Error(`Candidate decision event is immutable: ${event.eventId}`);
    }
    this.events.set(event.eventId, cloneQuestionCandidate(event));
    return cloneQuestionCandidate(event);
  }

  async listDecisionEvents(candidateId?: string): Promise<CandidateDecisionEvent[]> {
    return [...this.events.values()]
      .filter((event) => !candidateId || event.candidateId === candidateId)
      .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt))
      .map(cloneQuestionCandidate);
  }

  async saveCorrectionRecord(
    record: ExceptionCorrectionRecord,
  ): Promise<ExceptionCorrectionRecord> {
    const existing = this.correctionRecords.get(record.correctionId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(record)) {
      throw new Error(`Exception correction record is immutable: ${record.correctionId}`);
    }
    this.correctionRecords.set(record.correctionId, cloneQuestionCandidate(record));
    return cloneQuestionCandidate(record);
  }

  async getCorrectionRecord(correctionId: string): Promise<ExceptionCorrectionRecord | null> {
    const record = this.correctionRecords.get(correctionId);
    return record ? cloneQuestionCandidate(record) : null;
  }

  async listCorrectionRecords(candidateId?: string): Promise<ExceptionCorrectionRecord[]> {
    return [...this.correctionRecords.values()]
      .filter((record) => !candidateId || record.candidateId === candidateId)
      .sort((left, right) => right.correctedAt.localeCompare(left.correctedAt))
      .map(cloneQuestionCandidate);
  }

  async saveCommandReceipt(receipt: CandidateCommandReceipt): Promise<CandidateCommandReceipt> {
    const key = receiptKey(receipt.command, receipt.idempotencyKey);
    const existing = this.receipts.get(key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(receipt)) {
      throw new Error(`Candidate command receipt conflict: ${key}`);
    }
    this.receipts.set(key, cloneQuestionCandidate(receipt));
    return cloneQuestionCandidate(receipt);
  }

  async getCommandReceipt(
    command: CandidateCommandName,
    idempotencyKey: string,
  ): Promise<CandidateCommandReceipt | null> {
    const receipt = this.receipts.get(receiptKey(command, idempotencyKey));
    return receipt ? cloneQuestionCandidate(receipt) : null;
  }

  async clear(): Promise<void> {
    this.candidates.clear();
    this.events.clear();
    this.correctionRecords.clear();
    this.receipts.clear();
  }
}

function receiptKey(command: CandidateCommandName, idempotencyKey: string): string {
  return `${command}:${idempotencyKey}`;
}
