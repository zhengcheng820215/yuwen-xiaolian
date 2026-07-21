import type {
  RealLLMDiagnosisRuntimeResult,
} from '../ai/schemas/diagnosisRunRecord.schema.ts';
import type { RealLLMRuntimeFoundationInput } from '../ai/agents/realLLMRuntimeFoundationAgent.ts';

const ENDPOINT = '/__runtime/phase16-3/diagnose';

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
  };
  if (!response.ok || !payload.result) {
    throw new Error(payload.error || '受控 Diagnosis Runtime 暂时不可用。');
  }
  return payload.result;
}
