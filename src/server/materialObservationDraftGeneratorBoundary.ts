import type { Connect } from 'vite';
import {
  createMaterialObservationDraftGeneratorConfig,
  generateMaterialObservationDraftCandidates,
} from '../ai/agents/materialObservationDraftGeneratorAgent.ts';
import { DeepSeekChatDiagnosisProvider } from '../ai/providers/diagnosisProviderAdapter.ts';
import type { MaterialObservationDraftGeneratorInput } from '../ai/schemas/materialObservationDraftGenerator.schema.ts';
import { resolvePhase163DiagnosisCredential } from './phase163DiagnosisBoundary.ts';

const MAX_BODY_BYTES = 1024 * 1024;
export const MATERIAL_OBSERVATION_DRAFT_LIVE_MAX_OUTPUT_TOKENS = 8_000;
export const MATERIAL_OBSERVATION_DRAFT_LIVE_TIMEOUT_MS = 90_000;

export function createMaterialObservationDraftLiveConfig(providerName: string, model: string) {
  return createMaterialObservationDraftGeneratorConfig({
    providerName,
    model,
    temperature: 0.2,
    maxOutputTokens: MATERIAL_OBSERVATION_DRAFT_LIVE_MAX_OUTPUT_TOKENS,
    timeoutMs: MATERIAL_OBSERVATION_DRAFT_LIVE_TIMEOUT_MS,
    maxAttempts: 2,
  });
}

export function createMaterialObservationDraftGeneratorBoundary(): Connect.NextHandleFunction {
  let cachedCredential: Awaited<ReturnType<typeof resolvePhase163DiagnosisCredential>> | undefined;

  async function getCredential() {
    if (cachedCredential?.apiKey) return cachedCredential;
    cachedCredential = await resolvePhase163DiagnosisCredential();
    return cachedCredential;
  }

  return async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'GET') {
      const credential = await getCredential();
      response.statusCode = 200;
      response.end(JSON.stringify({
        status: credential.apiKey ? 'ready' : 'unavailable',
        provider: 'deepseek_chat',
        model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-v4-flash',
      }));
      return;
    }
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
          error: 'AI 观测任务首稿服务尚未配置。',
          code: 'provider_not_configured',
          retryable: false,
        }));
        return;
      }
      const body = await readJsonBody(request);
      const input = validateInput(body.input);
      const model = process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-v4-flash';
      const provider = new DeepSeekChatDiagnosisProvider({ apiKey: credential.apiKey });
      const result = await generateMaterialObservationDraftCandidates(input, {
        provider,
        config: createMaterialObservationDraftLiveConfig(provider.providerName, model),
      });
      response.statusCode = 200;
      response.end(JSON.stringify({ result }));
    } catch (error) {
      response.statusCode = 400;
      response.end(JSON.stringify({
        error: sanitizeError(error),
        code: 'material_observation_generator_failed',
        retryable: false,
      }));
    }
  };
}

function validateInput(value: unknown): MaterialObservationDraftGeneratorInput {
  if (!value || typeof value !== 'object') throw new Error('Generator input is required.');
  const input = value as MaterialObservationDraftGeneratorInput;
  if (!input.requestId?.trim() || !input.material?.materialVersionId?.trim() || !input.material?.content?.trim()) {
    throw new Error('Generator input is incomplete.');
  }
  return input;
}

function readJsonBody(request: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += String(chunk);
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
        reject(new Error('Generator request is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) as Record<string, unknown> : {});
      } catch {
        reject(new Error('Generator request must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/api[_ -]?key|authorization|bearer|raw output|prompt/i.test(message)) {
    return 'AI 观测任务首稿生成失败。';
  }
  return message.slice(0, 240);
}
