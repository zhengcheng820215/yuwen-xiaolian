import type { Connect } from 'vite';
import { SharedFormalResourceStore } from './sharedFormalResourceStore.ts';
import { buildProductRuntimeHealth } from '../ai/services/productRuntimeHealthService.ts';
import type { ProductRuntimeHealth, ProductRuntimeTrialMode } from '../ai/schemas/productRuntimeHealth.schema.ts';

export type ProductRuntimeHealthReader = () => Promise<ProductRuntimeHealth>;

export function createProductRuntimeHealthBoundary(
  readHealth: ProductRuntimeHealthReader = readCurrentProductRuntimeHealth,
): Connect.NextHandleFunction {
  return async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method !== 'GET') {
      response.statusCode = 405;
      response.end(JSON.stringify({ code: 'method_not_allowed' }));
      return;
    }
    try {
      const health = await readHealth();
      response.statusCode = health.overallStatus === 'blocked' ? 503 : 200;
      response.end(JSON.stringify(health));
    } catch {
      const health = buildProductRuntimeHealth({
        checkedAt: new Date().toISOString(), formalStoreError: true,
        aiConfigured: configured(process.env.DEEPSEEK_API_KEY), trial: safeTrialInput(),
      });
      response.statusCode = 503;
      response.end(JSON.stringify(health));
    }
  };
}

export async function readCurrentProductRuntimeHealth(): Promise<ProductRuntimeHealth> {
  const store = new SharedFormalResourceStore();
  try {
    const snapshot = await store.readOnly();
    return buildProductRuntimeHealth({
      checkedAt: new Date().toISOString(), snapshot,
      aiConfigured: configured(process.env.DEEPSEEK_API_KEY),
      buildIdentity: process.env.PRODUCT_RUNTIME_BUILD_IDENTITY,
      buildIdentityContentAddressed: process.env.PRODUCT_RUNTIME_BUILD_IDENTITY_CONTENT_ADDRESSED === 'true',
      trial: safeTrialInput(),
    });
  } catch {
    return buildProductRuntimeHealth({
      checkedAt: new Date().toISOString(), formalStoreError: true,
      aiConfigured: configured(process.env.DEEPSEEK_API_KEY), trial: safeTrialInput(),
    });
  }
}

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function safeTrialInput() {
  const mode = (value: string | undefined): ProductRuntimeTrialMode =>
    ['off', 'isolated_acceptance', 'real_trial'].includes(String(value))
      ? value as ProductRuntimeTrialMode : 'off';
  const identity = ['aligned', 'mismatch', 'insufficient_evidence'].includes(String(process.env.PRODUCT_TRIAL_IDENTITY_STATUS))
    ? process.env.PRODUCT_TRIAL_IDENTITY_STATUS as 'aligned' | 'mismatch' | 'insufficient_evidence'
    : 'mismatch';
  return {
    requestedMode: mode(process.env.PRODUCT_TRIAL_REQUESTED_MODE),
    effectiveMode: mode(process.env.PRODUCT_TRIAL_EFFECTIVE_MODE),
    identityStatus: identity,
    observationAvailable: process.env.PRODUCT_TRIAL_OBSERVATION_AVAILABLE !== 'false',
  };
}
