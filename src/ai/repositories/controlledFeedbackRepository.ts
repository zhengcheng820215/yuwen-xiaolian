import type { ControlledFeedbackResult } from '../schemas/controlledFeedbackExpression.schema.ts';

export type ControlledFeedbackWriteResult = {
  status: 'created' | 'reused' | 'conflict';
  result: ControlledFeedbackResult;
  issues: string[];
};

export type ControlledFeedbackRepository = {
  commit(result: ControlledFeedbackResult): Promise<ControlledFeedbackWriteResult>;
  getByRequestId(feedbackRequestId: string): Promise<ControlledFeedbackResult | null>;
  clear(): Promise<void>;
};

export function compareControlledFeedbackResults(
  existing: ControlledFeedbackResult,
  candidate: ControlledFeedbackResult,
): ControlledFeedbackWriteResult {
  if (existing.feedbackRequestId !== candidate.feedbackRequestId) {
    return {
      status: 'conflict',
      result: existing,
      issues: ['Controlled Feedback requestId mismatch.'],
    };
  }

  const same = stableStringify(existing) === stableStringify(candidate);
  return {
    status: same ? 'reused' : 'conflict',
    result: existing,
    issues: same ? [] : ['A different Controlled Feedback result already exists for this feedbackRequestId.'],
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
