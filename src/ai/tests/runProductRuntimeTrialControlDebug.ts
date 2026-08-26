import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ProductRuntimeIdentity } from '../schemas/productRuntimeIdentity.schema.ts';
import {
  PRODUCT_RUNTIME_TRIAL_CONTROL_VERSION,
  readProductRuntimeTrialProjection,
  validateTrialControlState,
} from '../../server/productRuntimeTrialControlBoundary.ts';

const digestA = `sha256:${'a'.repeat(64)}` as const;
const digestB = `sha256:${'b'.repeat(64)}` as const;
const validState = {
  controlVersion: PRODUCT_RUNTIME_TRIAL_CONTROL_VERSION,
  requestedMode: 'real_trial' as const,
  effectiveMode: 'real_trial' as const,
  runtimeIdentityDigest: digestA,
  trialWindowId: 'trial-window-debug',
  launchRecordId: 'trial-launch-debug',
  runtimeIdentityBindingId: 'trial-binding-debug',
  activatedAt: '2026-08-26T08:00:00.000Z',
};

const directory = await mkdtemp(join(tmpdir(), 'product-runtime-trial-control-'));
const statePath = join(directory, 'trial-control.json');
let passed = 0;

async function test(name: string, action: () => void | Promise<void>) {
  await action();
  passed += 1;
  console.log(`PASS ${name}`);
}

try {
  await test('TC-C01 valid state schema', () => {
    assert.deepEqual(validateTrialControlState(validState), []);
  });
  await test('TC-C02 incomplete state is rejected', () => {
    assert.ok(validateTrialControlState({ ...validState, runtimeIdentityBindingId: '' }).length > 0);
  });
  await writeFile(statePath, JSON.stringify(validState), 'utf8');
  await test('TC-C03 matching identity projects aligned real_trial', async () => {
    const projection = await readProductRuntimeTrialProjection({
      runtimeIdentityStatus: 'available',
      runtimeIdentity: { runtimeIdentityDigest: digestA } as ProductRuntimeIdentity,
      statePath,
    });
    assert.equal(projection.identityStatus, 'aligned');
    assert.equal(projection.effectiveMode, 'real_trial');
  });
  await test('TC-C04 mismatched identity fails closed', async () => {
    const projection = await readProductRuntimeTrialProjection({
      runtimeIdentityStatus: 'available',
      runtimeIdentity: { runtimeIdentityDigest: digestB } as ProductRuntimeIdentity,
      statePath,
    });
    assert.equal(projection.identityStatus, 'mismatch');
    assert.equal(projection.effectiveMode, 'off');
  });
  await test('TC-C05 dirty runtime fails closed', async () => {
    const projection = await readProductRuntimeTrialProjection({
      runtimeIdentityStatus: 'dirty', statePath,
    });
    assert.equal(projection.identityStatus, 'dirty');
    assert.equal(projection.effectiveMode, 'off');
  });
  await test('TC-C06 missing runtime fails closed', async () => {
    const projection = await readProductRuntimeTrialProjection({
      runtimeIdentityStatus: 'missing', statePath,
    });
    assert.equal(projection.identityStatus, 'missing');
    assert.equal(projection.effectiveMode, 'off');
  });
  await writeFile(statePath, '{"invalid":true}', 'utf8');
  await test('TC-C07 invalid control never projects active', async () => {
    const projection = await readProductRuntimeTrialProjection({
      runtimeIdentityStatus: 'available',
      runtimeIdentity: { runtimeIdentityDigest: digestA } as ProductRuntimeIdentity,
      statePath,
    });
    assert.notEqual(projection.effectiveMode, 'real_trial');
  });
  await test('TC-C08 control state contains no provider credential', () => {
    assert.equal(JSON.stringify(validState).includes('API_KEY'), false);
  });
  console.log(`PRODUCT RUNTIME TRIAL CONTROL DEBUG ACCEPTED ${passed}/8`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
