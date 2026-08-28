import type { Connect } from 'vite';
import { SharedFormalResourceStore } from './sharedFormalResourceStore.ts';
import { buildProductRuntimeHealth } from '../ai/services/productRuntimeHealthService.ts';
import type { ProductRuntimeHealth, ProductRuntimeTrialMode } from '../ai/schemas/productRuntimeHealth.schema.ts';
import { readCurrentProductRuntimeIdentity } from './productRuntimeIdentityBoundary.ts';
import { readProductRuntimeTrialProjection } from './productRuntimeTrialControlBoundary.ts';
import {
  resolvePhase163DiagnosisCredential,
  type Phase163DiagnosisCredentialResolution,
} from './phase163DiagnosisBoundary.ts';

export type ProductRuntimeHealthReader = () => Promise<ProductRuntimeHealth>;
export type ProductRuntimeCredentialReader = () => Promise<Phase163DiagnosisCredentialResolution>;

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
      const aiConfigured = await resolveProductRuntimeAiConfigured();
      const health = buildProductRuntimeHealth({
        checkedAt: new Date().toISOString(), formalStoreError: true,
        aiConfigured,
        aiAvailabilityVerified: verifiedAiAvailability(aiConfigured), trial: safeTrialInput(),
      });
      response.statusCode = 503;
      response.end(JSON.stringify(health));
    }
  };
}

export async function readCurrentProductRuntimeHealth(): Promise<ProductRuntimeHealth> {
  const store = new SharedFormalResourceStore();
  const aiConfigured = await resolveProductRuntimeAiConfigured();
  try {
    const snapshot = await store.readOnly();
    const runtimeIdentity = await readCurrentProductRuntimeIdentity(undefined, snapshot);
    const trial = await readProductRuntimeTrialProjection({
      runtimeIdentityStatus: runtimeIdentity.status,
      runtimeIdentity: runtimeIdentity.identity,
    });
    return buildProductRuntimeHealth({
      checkedAt: new Date().toISOString(), snapshot,
      aiConfigured,
      aiAvailabilityVerified: verifiedAiAvailability(aiConfigured),
      buildIdentity: runtimeIdentity.identity?.runtimeIdentityDigest,
      buildIdentityContentAddressed: runtimeIdentity.status === 'available',
      runtimeIdentityVersion: runtimeIdentity.identity?.runtimeIdentityVersion,
      runtimeIdentityStatus: runtimeIdentity.status,
      trial,
    });
  } catch {
    return buildProductRuntimeHealth({
      checkedAt: new Date().toISOString(), formalStoreError: true,
      aiConfigured,
      aiAvailabilityVerified: verifiedAiAvailability(aiConfigured), trial: safeTrialInput(),
    });
  }
}

export async function resolveProductRuntimeAiConfigured(
  readCredential: ProductRuntimeCredentialReader = resolvePhase163DiagnosisCredential,
): Promise<boolean | null> {
  try {
    const credential = await readCredential();
    return credential.source === 'unavailable' ? false : Boolean(credential.apiKey);
  } catch {
    // “未能检查”不同于“确认未配置”，避免把临时 Keychain 读取失败投射成配置缺失。
    return null;
  }
}

function verifiedAiAvailability(aiConfigured: boolean | null): boolean {
  return aiConfigured === true && process.env.PRODUCT_AI_PROVIDER_AVAILABILITY_VERIFIED === 'true';
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
