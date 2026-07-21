import type { Connect } from 'vite';
import {
  runRealLLMRuntimeFoundation,
  type RealLLMRuntimeFoundationInput,
} from '../ai/agents/realLLMRuntimeFoundationAgent.ts';
import { DeepSeekChatDiagnosisProvider } from '../ai/providers/diagnosisProviderAdapter.ts';
import { InMemoryFormalDiagnosisRepository } from '../ai/repositories/inMemoryFormalDiagnosisRepository.ts';

const MAX_BODY_BYTES = 512 * 1024;

export function createPhase163DiagnosisBoundary(): Connect.NextHandleFunction {
  const formalDiagnosisRepository = new InMemoryFormalDiagnosisRepository();

  return async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') {
      response.statusCode = 405;
      response.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    try {
      const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
      if (!apiKey) {
        response.statusCode = 503;
        response.end(JSON.stringify({ error: '受控 Diagnosis Runtime 尚未配置。' }));
        return;
      }
      const body = await readJsonBody(request);
      const input = validateBoundaryInput(body?.input);
      const model = process.env.DEEPSEEK_MODEL?.trim() || input.providerConfig.model;
      const provider = new DeepSeekChatDiagnosisProvider({ apiKey });
      const result = await runRealLLMRuntimeFoundation({
        ...input,
        executionMode: 'live',
        commitOnSuccess: true,
        providerConfig: {
          ...input.providerConfig,
          provider: provider.providerName,
          model,
        },
      }, {
        provider,
        formalDiagnosisRepository,
      });

      response.statusCode = 200;
      response.end(JSON.stringify({ result }));
    } catch (error) {
      response.statusCode = 400;
      response.end(JSON.stringify({
        error: error instanceof Error ? sanitizeError(error.message) : '受控 Diagnosis Runtime 执行失败。',
      }));
    }
  };
}

function validateBoundaryInput(value: unknown): RealLLMRuntimeFoundationInput {
  if (!value || typeof value !== 'object') throw new Error('Diagnosis input is required.');
  const input = value as RealLLMRuntimeFoundationInput;
  if (!input.concreteTask || !input.taskExecutionResult || !input.providerConfig) {
    throw new Error('Diagnosis input is incomplete.');
  }
  if (input.executionMode !== 'live' || input.commitOnSuccess !== true) {
    throw new Error('Only committed live Diagnosis is allowed through this boundary.');
  }
  if (!input.requestId?.trim()) throw new Error('Diagnosis requestId is required.');
  return input;
}

function readJsonBody(request: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += String(chunk);
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
        reject(new Error('Diagnosis request is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) as Record<string, unknown> : {});
      } catch {
        reject(new Error('Diagnosis request must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function sanitizeError(message: string): string {
  if (/api[_ -]?key|authorization|bearer|raw output|prompt/i.test(message)) {
    return '受控 Diagnosis Runtime 执行失败。';
  }
  return message.slice(0, 240);
}
