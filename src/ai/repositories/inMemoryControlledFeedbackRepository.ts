import type { ControlledFeedbackResult } from '../schemas/controlledFeedbackExpression.schema.ts';
import {
  compareControlledFeedbackResults,
  type ControlledFeedbackRepository,
  type ControlledFeedbackWriteResult,
} from './controlledFeedbackRepository.ts';

export class InMemoryControlledFeedbackRepository implements ControlledFeedbackRepository {
  private readonly records = new Map<string, ControlledFeedbackResult>();

  async commit(result: ControlledFeedbackResult): Promise<ControlledFeedbackWriteResult> {
    const existing = this.records.get(result.feedbackRequestId);
    if (existing) return compareControlledFeedbackResults(existing, result);

    this.records.set(result.feedbackRequestId, result);
    return { status: 'created', result, issues: [] };
  }

  async getByRequestId(feedbackRequestId: string): Promise<ControlledFeedbackResult | null> {
    return this.records.get(feedbackRequestId) || null;
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}
