import type {
  RealLLMDiagnosisRuntimeResult,
} from '../ai/schemas/diagnosisRunRecord.schema.ts';
import type { RealLLMRuntimeFoundationInput } from '../ai/agents/realLLMRuntimeFoundationAgent.ts';
import { runSingleChoiceDiagnosis } from '../ai/agents/singleChoiceDiagnosisAgent.ts';

const ENDPOINT = '/__runtime/phase16-3/diagnose';
export const PHASE163_DIAGNOSIS_STATUS_TIMEOUT_MS = 5_000;
export const PHASE163_DIAGNOSIS_REQUEST_TIMEOUT_MS = 70_000;

type Phase163DiagnosisBoundaryRequestOptions = {
  timeoutMs?: number;
};

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

export async function getPhase163DiagnosisBoundaryStatus(
  options: Phase163DiagnosisBoundaryRequestOptions = {},
): Promise<Phase163DiagnosisBoundaryStatus> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    normalizeTimeout(options.timeoutMs, PHASE163_DIAGNOSIS_STATUS_TIMEOUT_MS),
  );
  try {
    const response = await fetch(ENDPOINT, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json() as Partial<Phase163DiagnosisBoundaryStatus>;
    return response.ok && payload.status === 'ready'
      ? { status: 'ready', provider: payload.provider, model: payload.model }
      : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

export function isPhase163DiagnosisBoundaryUnavailable(error: unknown): boolean {
  return error instanceof Phase163DiagnosisBoundaryError && error.code === 'provider_not_configured';
}

export async function runDiagnosisThroughPhase163Boundary(
  input: RealLLMRuntimeFoundationInput,
  options: Phase163DiagnosisBoundaryRequestOptions = {},
): Promise<RealLLMDiagnosisRuntimeResult> {
  if (input.concreteTask.responseFormat === 'single_choice') {
    return runSingleChoiceDiagnosis(input);
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    normalizeTimeout(options.timeoutMs, PHASE163_DIAGNOSIS_REQUEST_TIMEOUT_MS),
  );
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
      signal: controller.signal,
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
  } catch (error) {
    if (isAbortError(error)) {
      throw new Phase163DiagnosisBoundaryError(
        '本次分析等待时间较长，回答已经保留。请重新分析或返回修改。',
        'diagnosis_request_timeout',
        true,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeTimeout(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
