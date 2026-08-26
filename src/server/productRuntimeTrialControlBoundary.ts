import type { Connect } from 'vite';
import type { IncomingMessage } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { ProductRuntimeIdentity } from '../ai/schemas/productRuntimeIdentity.schema.ts';
import type { ProductRuntimeTrialMode } from '../ai/schemas/productRuntimeHealth.schema.ts';
import { readCurrentProductRuntimeIdentity } from './productRuntimeIdentityBoundary.ts';

export const PRODUCT_RUNTIME_TRIAL_CONTROL_VERSION = 'product_runtime_trial_control_v1' as const;

export type ProductRuntimeTrialControlState = {
  controlVersion: typeof PRODUCT_RUNTIME_TRIAL_CONTROL_VERSION;
  requestedMode: 'real_trial';
  effectiveMode: 'real_trial';
  runtimeIdentityDigest: `sha256:${string}`;
  trialWindowId: string;
  launchRecordId: string;
  runtimeIdentityBindingId: string;
  activatedAt: string;
};

type RuntimeIdentityStatus = 'available' | 'missing' | 'invalid' | 'dirty';
type TrialIdentityStatus = 'aligned' | 'mismatch' | 'insufficient_evidence'
  | 'missing' | 'invalid' | 'dirty' | 'legacy_unverifiable';

export function createProductRuntimeTrialControlBoundary(
  statePath = trialControlPath(),
): Connect.NextHandleFunction {
  return async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method === 'GET') {
      const identity = await readCurrentProductRuntimeIdentity();
      response.statusCode = 200;
      response.end(JSON.stringify(await readProductRuntimeTrialProjection({
        runtimeIdentityStatus: identity.status,
        runtimeIdentity: identity.identity,
        statePath,
      })));
      return;
    }
    if (request.method !== 'POST') {
      response.statusCode = 405;
      response.end(JSON.stringify({ code: 'method_not_allowed' }));
      return;
    }
    try {
      const body = await readJsonBody(request);
      const issues = validateTrialControlState(body);
      if (issues.length) throw new Error(`trial_control_invalid:${issues.join(',')}`);
      const identity = await readCurrentProductRuntimeIdentity();
      if (identity.status !== 'available' || !identity.identity
        || (body as ProductRuntimeTrialControlState).runtimeIdentityDigest
          !== identity.identity.runtimeIdentityDigest) {
        throw new Error('trial_control_runtime_identity_mismatch');
      }
      await writeTrialControlState(body as ProductRuntimeTrialControlState, statePath);
      const confirmed = await readTrialControlState(statePath);
      if (!confirmed || JSON.stringify(confirmed) !== JSON.stringify(body)) {
        throw new Error('trial_control_confirmation_failed');
      }
      response.statusCode = 200;
      response.end(JSON.stringify({ status: 'activated', state: confirmed }));
    } catch (error) {
      response.statusCode = 409;
      response.end(JSON.stringify({
        status: 'rejected',
        code: error instanceof Error ? error.message : 'trial_control_write_failed',
      }));
    }
  };
}

export async function readProductRuntimeTrialProjection(input: {
  runtimeIdentityStatus: RuntimeIdentityStatus;
  runtimeIdentity?: ProductRuntimeIdentity;
  statePath?: string;
}): Promise<{
  requestedMode: ProductRuntimeTrialMode;
  effectiveMode: ProductRuntimeTrialMode;
  identityStatus: TrialIdentityStatus;
  observationAvailable: boolean;
}> {
  if (input.runtimeIdentityStatus !== 'available') return {
    requestedMode: 'off', effectiveMode: 'off',
    identityStatus: input.runtimeIdentityStatus, observationAvailable: true,
  };
  const state = await readTrialControlState(input.statePath || trialControlPath());
  if (!state) return environmentTrialProjection();
  if (!input.runtimeIdentity
    || state.runtimeIdentityDigest !== input.runtimeIdentity.runtimeIdentityDigest) return {
    requestedMode: state.requestedMode, effectiveMode: 'off',
    identityStatus: 'mismatch', observationAvailable: true,
  };
  return {
    requestedMode: state.requestedMode, effectiveMode: state.effectiveMode,
    identityStatus: 'aligned', observationAvailable: true,
  };
}

export async function readTrialControlState(
  statePath = trialControlPath(),
): Promise<ProductRuntimeTrialControlState | undefined> {
  try {
    const value = JSON.parse(await readFile(statePath, 'utf8'));
    return validateTrialControlState(value).length ? undefined : value;
  } catch { return undefined; }
}

async function writeTrialControlState(
  state: ProductRuntimeTrialControlState,
  statePath: string,
): Promise<void> {
  await mkdir(dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporaryPath, statePath);
}

export function validateTrialControlState(value: unknown): string[] {
  if (!value || typeof value !== 'object') return ['state_not_object'];
  const state = value as Record<string, unknown>;
  const issues: string[] = [];
  if (state.controlVersion !== PRODUCT_RUNTIME_TRIAL_CONTROL_VERSION) issues.push('control_version_invalid');
  if (state.requestedMode !== 'real_trial' || state.effectiveMode !== 'real_trial') issues.push('mode_invalid');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(state.runtimeIdentityDigest || ''))) issues.push('runtime_identity_digest_invalid');
  for (const field of ['trialWindowId', 'launchRecordId', 'runtimeIdentityBindingId'] as const) {
    if (!String(state[field] || '').trim()) issues.push(`${field}_missing`);
  }
  if (!Number.isFinite(Date.parse(String(state.activatedAt || '')))) issues.push('activated_at_invalid');
  return issues;
}

function environmentTrialProjection() {
  const mode = (value: string | undefined): ProductRuntimeTrialMode =>
    ['off', 'isolated_acceptance', 'real_trial'].includes(String(value))
      ? value as ProductRuntimeTrialMode : 'off';
  const explicit = process.env.PRODUCT_TRIAL_IDENTITY_STATUS;
  const allowed: TrialIdentityStatus[] = ['aligned', 'mismatch', 'insufficient_evidence',
    'missing', 'invalid', 'dirty', 'legacy_unverifiable'];
  return {
    requestedMode: mode(process.env.PRODUCT_TRIAL_REQUESTED_MODE),
    effectiveMode: mode(process.env.PRODUCT_TRIAL_EFFECTIVE_MODE),
    identityStatus: allowed.includes(explicit as TrialIdentityStatus)
      ? explicit as TrialIdentityStatus : 'legacy_unverifiable' as const,
    observationAvailable: process.env.PRODUCT_TRIAL_OBSERVATION_AVAILABLE !== 'false',
  };
}

function trialControlPath(): string {
  return process.env.PRODUCT_RUNTIME_TRIAL_CONTROL_PATH
    || resolve('dist/.runtime/product-runtime-trial-control.json');
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 64 * 1024) {
        reject(new Error('trial_control_payload_too_large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try { resolveBody(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('trial_control_json_invalid')); }
    });
    request.on('error', reject);
  });
}
