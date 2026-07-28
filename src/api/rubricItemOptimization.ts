import type {
  RubricItemOptimizationInput,
  RubricItemOptimizationResult,
} from '../ai/schemas/rubricItemOptimization.schema.ts';

const ENDPOINT = '/__runtime/phase17-5/rubric-item-optimization';

export async function requestRubricItemOptimization(
  input: RubricItemOptimizationInput,
): Promise<RubricItemOptimizationResult> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  const payload = await response.json() as {
    result?: RubricItemOptimizationResult;
    error?: string;
  };
  if (!response.ok || !payload.result) {
    throw new Error(payload.error || 'AI 评分项优化服务暂时不可用，请稍后重试。');
  }
  return payload.result;
}
