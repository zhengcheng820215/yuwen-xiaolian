import type {
  RealLLMDiagnosisRuntimeResult,
} from '../ai/schemas/diagnosisRunRecord.schema.ts';
import type { RealLLMRuntimeFoundationInput } from '../ai/agents/realLLMRuntimeFoundationAgent.ts';

const ENDPOINT = '/__runtime/phase16-3/diagnose';

export type Phase163DiagnosisBoundaryStatus = {
  status: 'ready' | 'unavailable';
  provider?: string;
  model?: string;
};

export class Phase163DiagnosisBoundaryError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code: string, retryable: boolean) {
    super(message);
    this.name = 'Phase163DiagnosisBoundaryError';
    this.code = code;
    this.retryable = retryable;
  }
}

export async function getPhase163DiagnosisBoundaryStatus(): Promise<Phase163DiagnosisBoundaryStatus> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await response.json() as Partial<Phase163DiagnosisBoundaryStatus>;
    return response.ok && payload.status === 'ready'
      ? { status: 'ready', provider: payload.provider, model: payload.model }
      : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

export function isPhase163DiagnosisBoundaryUnavailable(error: unknown): boolean {
  return error instanceof Phase163DiagnosisBoundaryError && error.code === 'provider_not_configured';
}

export async function runDiagnosisThroughPhase163Boundary(
  input: RealLLMRuntimeFoundationInput,
): Promise<RealLLMDiagnosisRuntimeResult> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  const payload = await response.json() as {
    result?: RealLLMDiagnosisRuntimeResult;
    error?: string;
    code?: string;
    retryable?: boolean;
  };
  if (!response.ok || !payload.result) {
    throw new Phase163DiagnosisBoundaryError(
      payload.error || '受控 Diagnosis Runtime 暂时不可用。',
      payload.code || 'boundary_unavailable',
      payload.retryable ?? response.status >= 500,
    );
  }
  return payload.result;
}
