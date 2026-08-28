import type { Connect } from 'vite';
import type { IncomingMessage } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  validateRubricAlignedFeedbackTrialActivation,
  type RubricAlignedFeedbackTrialActivation,
} from '../ai/schemas/rubricAlignedFeedbackTrial.schema.ts';
import { readCurrentProductRuntimeIdentity } from './productRuntimeIdentityBoundary.ts';

export const RUBRIC_ALIGNED_FEEDBACK_TRIAL_CONTROL_VERSION =
  'rubric_aligned_feedback_trial_control_v1' as const;

type TrialControlAudit = {
  auditId: string;
  action: 'draft_saved' | 'activated' | 'paused' | 'rolled_back' | 'completed';
  trialId: string;
  occurredAt: string;
};

type TrialControlFile = {
  controlVersion: typeof RUBRIC_ALIGNED_FEEDBACK_TRIAL_CONTROL_VERSION;
  draft?: RubricAlignedFeedbackTrialActivation;
  active?: RubricAlignedFeedbackTrialActivation;
  audits: TrialControlAudit[];
};

export function createRubricAlignedFeedbackTrialControlBoundary(
  statePath = defaultStatePath(),
): Connect.NextHandleFunction {
  return async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method === 'GET') {
      const file = await readState(statePath);
      const identity = await readCurrentProductRuntimeIdentity();
      const active = file.active;
      const identityAligned = Boolean(active && identity.status === 'available'
        && identity.identity?.runtimeIdentityDigest === active.runtimeIdentityDigest);
      response.statusCode = 200;
      response.end(JSON.stringify({
        controlVersion: RUBRIC_ALIGNED_FEEDBACK_TRIAL_CONTROL_VERSION,
        status: active ? 'available' : file.draft ? 'draft_only' : 'not_configured',
        activation: identityAligned ? active : undefined,
        draftTrialId: file.draft?.trialId,
        identityAligned,
        reasonCodes: active && !identityAligned ? ['runtime_identity_mismatch'] : [],
      }));
      return;
    }
    if (request.method !== 'POST') {
      response.statusCode = 405;
      response.end(JSON.stringify({ status: 'rejected', code: 'method_not_allowed' }));
      return;
    }
    try {
      const body = await readJsonBody(request) as Record<string, unknown>;
      const action = String(body.action || '');
      const current = await readState(statePath);
      if (action === 'save_draft') {
        const activation = body.activation as RubricAlignedFeedbackTrialActivation;
        const issues = validateRubricAlignedFeedbackTrialActivation(activation);
        if (issues.length || activation.status !== 'shadow_ready') {
          throw new Error(`trial_draft_invalid:${issues.join(',') || 'status_not_shadow_ready'}`);
        }
        await assertRuntimeIdentity(activation.runtimeIdentityDigest);
        const next = withAudit({ ...current, draft: activation }, 'draft_saved', activation);
        await writeState(next, statePath);
        response.statusCode = 200;
        response.end(JSON.stringify({ status: 'draft_saved', trialId: activation.trialId }));
        return;
      }
      if (action === 'activate') {
        if (!current.draft) throw new Error('trial_draft_missing');
        await assertRuntimeIdentity(current.draft.runtimeIdentityDigest);
        const occurredAt = String(body.occurredAt || new Date().toISOString());
        const active: RubricAlignedFeedbackTrialActivation = {
          ...current.draft,
          status: 'student_visible_active',
          activatedBy: String(body.activatedBy || current.draft.activatedBy),
          activatedAt: occurredAt,
        };
        const next = withAudit({ ...current, active }, 'activated', active, occurredAt);
        await writeState(next, statePath);
        response.statusCode = 200;
        response.end(JSON.stringify({ status: 'activated', trialId: active.trialId }));
        return;
      }
      if (['pause', 'rollback', 'complete'].includes(action)) {
        if (!current.active) throw new Error('active_trial_missing');
        const occurredAt = String(body.occurredAt || new Date().toISOString());
        const status = action === 'pause' ? 'paused'
          : action === 'rollback' ? 'rolled_back' : 'completed';
        const updated = { ...current.active, status } as RubricAlignedFeedbackTrialActivation;
        const next = withAudit({ ...current, active: updated },
          action === 'pause' ? 'paused' : action === 'rollback' ? 'rolled_back' : 'completed',
          updated, occurredAt);
        await writeState(next, statePath);
        response.statusCode = 200;
        response.end(JSON.stringify({ status, trialId: updated.trialId }));
        return;
      }
      throw new Error('trial_action_invalid');
    } catch (error) {
      response.statusCode = 409;
      response.end(JSON.stringify({
        status: 'rejected',
        code: error instanceof Error ? error.message : 'trial_control_failed',
      }));
    }
  };
}

async function assertRuntimeIdentity(expectedDigest: string): Promise<void> {
  const identity = await readCurrentProductRuntimeIdentity();
  if (identity.status !== 'available' || !identity.identity
    || identity.identity.runtimeIdentityDigest !== expectedDigest) {
    throw new Error('trial_runtime_identity_mismatch');
  }
}

function withAudit(
  file: TrialControlFile,
  action: TrialControlAudit['action'],
  activation: RubricAlignedFeedbackTrialActivation,
  occurredAt = new Date().toISOString(),
): TrialControlFile {
  const audit: TrialControlAudit = {
    auditId: `${activation.trialId}:${action}:${occurredAt}`,
    action,
    trialId: activation.trialId,
    occurredAt,
  };
  return { ...file, audits: [...file.audits, audit] };
}

async function readState(path: string): Promise<TrialControlFile> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as TrialControlFile;
    if (value.controlVersion === RUBRIC_ALIGNED_FEEDBACK_TRIAL_CONTROL_VERSION
      && Array.isArray(value.audits)) return value;
  } catch { /* default closed */ }
  return { controlVersion: RUBRIC_ALIGNED_FEEDBACK_TRIAL_CONTROL_VERSION, audits: [] };
}

async function writeState(state: TrialControlFile, path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: 'utf8', mode: 0o600,
  });
  await rename(temporaryPath, path);
}

function defaultStatePath(): string {
  return process.env.RUBRIC_ALIGNED_FEEDBACK_TRIAL_CONTROL_PATH
    || resolve('dist/.runtime/rubric-aligned-feedback-trial-control.json');
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 128 * 1024) {
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
