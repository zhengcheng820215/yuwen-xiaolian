import type { Connect } from 'vite';
import {
  createQuestionStemOptimizationConfig,
  optimizeQuestionStem,
} from '../ai/agents/questionStemOptimizationAgent.ts';
import { DeepSeekChatDiagnosisProvider } from '../ai/providers/diagnosisProviderAdapter.ts';
import type {
  QuestionStemOptimizationInput,
} from '../ai/schemas/questionStemOptimization.schema.ts';
import { resolvePhase163DiagnosisCredential } from './phase163DiagnosisBoundary.ts';

const MAX_BODY_BYTES = 1024 * 1024;

export function createQuestionStemOptimizationBoundary(): Connect.NextHandleFunction {
  let cachedCredential: Awaited<ReturnType<typeof resolvePhase163DiagnosisCredential>> | undefined;

  async function getCredential() {
    if (cachedCredential?.apiKey) return cachedCredential;
    cachedCredential = await resolvePhase163DiagnosisCredential();
    return cachedCredential;
  }

  return async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') {
      response.statusCode = 405;
      response.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    try {
      const credential = await getCredential();
      if (!credential.apiKey) {
        response.statusCode = 503;
        response.end(JSON.stringify({
          error: 'AI 题干优化服务尚未配置。',
          code: 'provider_not_configured',
          retryable: false,
        }));
        return;
      }
      const body = await readJsonBody(request);
      const input = body.input as QuestionStemOptimizationInput;
      const model = process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-v4-flash';
      const provider = new DeepSeekChatDiagnosisProvider({ apiKey: credential.apiKey });
      const result = await optimizeQuestionStem(input, {
        provider,
        config: createQuestionStemOptimizationConfig({
          providerName: provider.providerName,
          model,
        }),
      });
      response.statusCode = 200;
      response.end(JSON.stringify({ result }));
    } catch (error) {
      response.statusCode = 400;
      response.end(JSON.stringify({
        error: sanitizeError(error),
        code: 'question_stem_optimization_failed',
        retryable: false,
      }));
    }
  };
}

function readJsonBody(request: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += String(chunk);
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
        reject(new Error('题干优化请求内容过大。'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) as Record<string, unknown> : {});
      } catch {
        reject(new Error('题干优化请求格式不正确。'));
      }
    });
    request.on('error', reject);
  });
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/api[_ -]?key|authorization|bearer|raw output|prompt|provider/i.test(message)) {
    return 'AI 题干优化服务暂时不可用，请稍后重试。';
  }
  return message.slice(0, 180);
}
