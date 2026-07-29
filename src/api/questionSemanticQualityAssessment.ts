import type {
  RunQuestionSemanticQualityAssessmentInput,
} from '../ai/agents/questionSemanticQualityAssessmentAgent.ts';
import type {
  QuestionSemanticQualityAssessment,
} from '../ai/schemas/questionSemanticQualityAssessment.schema.ts';

const ENDPOINT = '/__runtime/phase17-5/question-semantic-quality';

export type QuestionSemanticQualityBoundaryStatus = {
  status: 'ready' | 'unavailable';
  providerId: string;
  modelId: string;
};

export async function getQuestionSemanticQualityBoundaryStatus():
Promise<QuestionSemanticQualityBoundaryStatus> {
  const response = await fetch(ENDPOINT, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const payload = await response.json() as QuestionSemanticQualityBoundaryStatus;
  if (
    !response.ok ||
    !['ready', 'unavailable'].includes(payload.status) ||
    !payload.providerId ||
    !payload.modelId
  ) {
    throw new Error('语义质量检查服务状态不可用。');
  }
  return payload;
}

export async function requestQuestionSemanticQualityAssessment(
  input: Omit<RunQuestionSemanticQualityAssessmentInput, 'provider'>,
): Promise<QuestionSemanticQualityAssessment> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  const payload = await response.json() as {
    assessment?: QuestionSemanticQualityAssessment;
    error?: string;
  };
  if (!response.ok || !payload.assessment) {
    throw new Error(payload.error || '语义质量检查服务暂时不可用。');
  }
  return payload.assessment;
}
