import type { Connect } from 'vite';
import {
  InMemoryQuestionSemanticQualityAssessmentSessionCache,
  runQuestionSemanticQualityAssessment,
} from '../ai/agents/questionSemanticQualityAssessmentAgent.ts';
import {
  DeepSeekChatDiagnosisProvider,
  ScriptedDiagnosisProviderAdapter,
} from '../ai/providers/diagnosisProviderAdapter.ts';
import type {
  RunQuestionSemanticQualityAssessmentInput,
} from '../ai/agents/questionSemanticQualityAssessmentAgent.ts';
import { resolvePhase163DiagnosisCredential } from './phase163DiagnosisBoundary.ts';

const MAX_BODY_BYTES = 1024 * 1024 * 2;
const DEFAULT_MODEL = 'deepseek-v4-flash';
const PROVIDER_ID = 'deepseek_chat';

export function createQuestionSemanticQualityAssessmentBoundary():
Connect.NextHandleFunction {
  const cache = new InMemoryQuestionSemanticQualityAssessmentSessionCache();
  let cachedCredential:
    Awaited<ReturnType<typeof resolvePhase163DiagnosisCredential>> | undefined;

  async function getCredential() {
    if (cachedCredential?.apiKey) return cachedCredential;
    cachedCredential = await resolvePhase163DiagnosisCredential();
    return cachedCredential;
  }

  return async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    const model = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL;

    if (request.method === 'GET') {
      const credential = await getCredential();
      response.statusCode = 200;
      response.end(JSON.stringify({
        status: credential.apiKey ? 'ready' : 'unavailable',
        providerId: PROVIDER_ID,
        modelId: model,
      }));
      return;
    }
    if (request.method !== 'POST') {
      response.statusCode = 405;
      response.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    try {
      const body = await readJsonBody(request);
      const input = validateInput(body.input);
      const credential = await getCredential();
      const provider = credential.apiKey
        ? new DeepSeekChatDiagnosisProvider({ apiKey: credential.apiKey })
        : new ScriptedDiagnosisProviderAdapter([{
          type: 'error',
          category: 'provider_unavailable',
          retryable: false,
          message: 'Semantic quality provider is not configured.',
        }], PROVIDER_ID);
      const assessment = await runQuestionSemanticQualityAssessment({
        ...input,
        provider: {
          providerId: PROVIDER_ID,
          modelId: model,
          timeoutMs: 90_000,
          temperature: 0,
          maxOutputTokens: 1_800,
        },
      }, { provider, cache });
      response.statusCode = 200;
      response.end(JSON.stringify({ assessment }));
    } catch (error) {
      response.statusCode = 400;
      response.end(JSON.stringify({
        error: sanitizeError(error),
        code: 'question_semantic_quality_failed',
      }));
    }
  };
}

function validateInput(
  value: unknown,
): Omit<RunQuestionSemanticQualityAssessmentInput, 'provider'> {
  if (!value || typeof value !== 'object') {
    throw new Error('Semantic quality assessment input is required.');
  }
  const input = value as Omit<
    RunQuestionSemanticQualityAssessmentInput,
    'provider'
  >;
  if (
    !input.requestId?.trim() ||
    !input.draft?.draftId?.trim() ||
    !input.validation?.validationId?.trim() ||
    !input.material?.materialVersionId?.trim() ||
    !input.deterministicAssessment?.assessmentId?.trim()
  ) {
    throw new Error('Semantic quality assessment input is incomplete.');
  }
  return input;
}

function readJsonBody(
  request: Connect.IncomingMessage,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += String(chunk);
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
        reject(new Error('Semantic quality assessment request is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) as Record<string, unknown> : {});
      } catch {
        reject(new Error('Semantic quality assessment request must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/api[_ -]?key|authorization|bearer|raw output|prompt/i.test(message)) {
    return 'Semantic quality assessment failed.';
  }
  return message.slice(0, 240);
}
