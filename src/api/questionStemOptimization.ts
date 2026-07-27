import type {
  QuestionStemOptimizationInput,
  QuestionStemOptimizationResult,
} from '../ai/schemas/questionStemOptimization.schema.ts';

const ENDPOINT = '/__runtime/phase17-5/question-stem-optimization';

export async function requestQuestionStemOptimization(
  input: QuestionStemOptimizationInput,
): Promise<QuestionStemOptimizationResult> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  const payload = await response.json() as {
    result?: QuestionStemOptimizationResult;
    error?: string;
  };
  if (!response.ok || !payload.result) {
    throw new Error(payload.error || 'AI 题干优化服务暂时不可用，请稍后重试。');
  }
  return payload.result;
}
