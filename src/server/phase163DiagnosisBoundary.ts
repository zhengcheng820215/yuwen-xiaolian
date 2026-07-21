import type { Connect } from 'vite';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  runRealLLMRuntimeFoundation,
  type RealLLMRuntimeFoundationInput,
} from '../ai/agents/realLLMRuntimeFoundationAgent.ts';
import { DeepSeekChatDiagnosisProvider } from '../ai/providers/diagnosisProviderAdapter.ts';
import { InMemoryFormalDiagnosisRepository } from '../ai/repositories/inMemoryFormalDiagnosisRepository.ts';

const MAX_BODY_BYTES = 512 * 1024;
const DEFAULT_KEYCHAIN_SERVICE = 'yuwen-xiaolian-deepseek-api-key';
const execFileAsync = promisify(execFile);

export type Phase163DiagnosisCredentialResolution = {
  apiKey?: string;
  source: 'environment' | 'macos_keychain' | 'unavailable';
};

export async function resolvePhase163DiagnosisCredential(input: {
  environment?: NodeJS.ProcessEnv;
  keychainReader?: (account: string, service: string) => Promise<string | undefined>;
} = {}): Promise<Phase163DiagnosisCredentialResolution> {
  const environment = input.environment || process.env;
  const environmentKey = environment.DEEPSEEK_API_KEY?.trim();
  if (environmentKey) return { apiKey: environmentKey, source: 'environment' };

  if (process.platform !== 'darwin' && !input.keychainReader) {
    return { source: 'unavailable' };
  }

  const account = environment.DEEPSEEK_KEYCHAIN_ACCOUNT?.trim() || environment.USER?.trim();
  const service = environment.DEEPSEEK_KEYCHAIN_SERVICE?.trim() || DEFAULT_KEYCHAIN_SERVICE;
  if (!account) return { source: 'unavailable' };

  const keychainReader = input.keychainReader || readMacOSKeychainSecret;
  const keychainKey = (await keychainReader(account, service))?.trim();
  return keychainKey
    ? { apiKey: keychainKey, source: 'macos_keychain' }
    : { source: 'unavailable' };
}

export function createPhase163DiagnosisBoundary(): Connect.NextHandleFunction {
  const formalDiagnosisRepository = new InMemoryFormalDiagnosisRepository();
  let cachedCredential: Phase163DiagnosisCredentialResolution | undefined;

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
          error: '受控 Diagnosis Runtime 尚未配置。',
          code: 'provider_not_configured',
          retryable: false,
        }));
        return;
      }
      const body = await readJsonBody(request);
      const input = validateBoundaryInput(body?.input);
      const model = process.env.DEEPSEEK_MODEL?.trim() || input.providerConfig.model;
      const provider = new DeepSeekChatDiagnosisProvider({ apiKey: credential.apiKey });
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
        code: 'boundary_request_failed',
        retryable: false,
      }));
    }
  };
}

async function readMacOSKeychainSecret(account: string, service: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('security', [
      'find-generic-password',
      '-a', account,
      '-s', service,
      '-w',
    ], {
      timeout: 5_000,
      maxBuffer: 16 * 1024,
      env: process.env,
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
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
