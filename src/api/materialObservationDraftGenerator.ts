import type {
  MaterialObservationDraftGeneratorInput,
  MaterialObservationDraftGeneratorResult,
} from '../ai/schemas/materialObservationDraftGenerator.schema.ts';

const ENDPOINT = '/__runtime/phase17/material-observation-candidates';

export type MaterialObservationDraftGeneratorBoundaryStatus = {
  status: 'ready' | 'unavailable';
  provider?: string;
  model?: string;
};

export class MaterialObservationDraftGeneratorBoundaryError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code: string, retryable: boolean) {
    super(message);
    this.name = 'MaterialObservationDraftGeneratorBoundaryError';
    this.code = code;
    this.retryable = retryable;
  }
}

export async function getMaterialObservationDraftGeneratorStatus(): Promise<MaterialObservationDraftGeneratorBoundaryStatus> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await response.json() as Partial<MaterialObservationDraftGeneratorBoundaryStatus>;
    return response.ok && payload.status === 'ready'
      ? { status: 'ready', provider: payload.provider, model: payload.model }
      : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function requestMaterialObservationDraftCandidates(
  input: MaterialObservationDraftGeneratorInput,
): Promise<MaterialObservationDraftGeneratorResult> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  const payload = await response.json() as {
    result?: MaterialObservationDraftGeneratorResult;
    error?: string;
    code?: string;
    retryable?: boolean;
  };
  if (!response.ok || !payload.result) {
    throw new MaterialObservationDraftGeneratorBoundaryError(
      payload.error || 'AI 观测任务首稿服务暂时不可用。',
      payload.code || 'boundary_unavailable',
      payload.retryable ?? response.status >= 500,
    );
  }
  return payload.result;
}
