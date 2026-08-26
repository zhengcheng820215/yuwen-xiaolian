import type { Connect } from 'vite';
import { SharedFormalResourceStore } from './sharedFormalResourceStore.ts';
import { buildProductRuntimeHealth } from '../ai/services/productRuntimeHealthService.ts';
import type { ProductRuntimeHealth, ProductRuntimeTrialMode } from '../ai/schemas/productRuntimeHealth.schema.ts';
import { readCurrentProductRuntimeIdentity } from './productRuntimeIdentityBoundary.ts';

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
        aiConfigured: configured(process.env.DEEPSEEK_API_KEY),
        aiAvailabilityVerified: verifiedAiAvailability(), trial: safeTrialInput(),
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
    const runtimeIdentity = await readCurrentProductRuntimeIdentity(undefined, snapshot);
    return buildProductRuntimeHealth({
      checkedAt: new Date().toISOString(), snapshot,
      aiConfigured: configured(process.env.DEEPSEEK_API_KEY),
      aiAvailabilityVerified: verifiedAiAvailability(),
      buildIdentity: runtimeIdentity.identity?.runtimeIdentityDigest,
      buildIdentityContentAddressed: runtimeIdentity.status === 'available',
      runtimeIdentityVersion: runtimeIdentity.identity?.runtimeIdentityVersion,
      runtimeIdentityStatus: runtimeIdentity.status,
      trial: safeTrialInput(runtimeIdentity.status),
    });
  } catch {
    return buildProductRuntimeHealth({
      checkedAt: new Date().toISOString(), formalStoreError: true,
      aiConfigured: configured(process.env.DEEPSEEK_API_KEY),
      aiAvailabilityVerified: verifiedAiAvailability(), trial: safeTrialInput(),
    });
  }
}

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function verifiedAiAvailability(): boolean {
  return configured(process.env.DEEPSEEK_API_KEY)
    && process.env.PRODUCT_AI_PROVIDER_AVAILABILITY_VERIFIED === 'true';
}

function safeTrialInput(runtimeIdentityStatus?: 'available' | 'missing' | 'invalid' | 'dirty') {
  const mode = (value: string | undefined): ProductRuntimeTrialMode =>
    ['off', 'isolated_acceptance', 'real_trial'].includes(String(value))
      ? value as ProductRuntimeTrialMode : 'off';
  const explicit = process.env.PRODUCT_TRIAL_IDENTITY_STATUS;
  const allowed = ['aligned', 'mismatch', 'insufficient_evidence', 'missing', 'invalid', 'dirty', 'legacy_unverifiable'];
  const identity = runtimeIdentityStatus && runtimeIdentityStatus !== 'available'
    ? runtimeIdentityStatus
    : allowed.includes(String(explicit))
      ? explicit as 'aligned' | 'mismatch' | 'insufficient_evidence' | 'missing' | 'invalid' | 'dirty' | 'legacy_unverifiable'
      : 'legacy_unverifiable';
  return {
    requestedMode: mode(process.env.PRODUCT_TRIAL_REQUESTED_MODE),
    effectiveMode: mode(process.env.PRODUCT_TRIAL_EFFECTIVE_MODE),
    identityStatus: identity,
    observationAvailable: process.env.PRODUCT_TRIAL_OBSERVATION_AVAILABLE !== 'false',
  };
}
