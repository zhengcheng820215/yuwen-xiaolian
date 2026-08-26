import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  DEFAULT_PROJECT_ROOT,
  PRODUCT_RUNTIME_HEALTH_VERSION,
  PRODUCT_RUNTIME_ID,
  PRODUCT_RUNTIME_PORT,
  runProductRuntimeLauncher,
} from '../../../scripts/start-product-runtime.mjs';

const health = (overallStatus = 'degraded') => ({
  schemaVersion: PRODUCT_RUNTIME_HEALTH_VERSION,
  overallStatus,
  instance: { productId: PRODUCT_RUNTIME_ID, port: PRODUCT_RUNTIME_PORT },
  summaryReasonCodes: overallStatus === 'degraded' ? ['runtime_identity_insufficient'] : [],
});
const baseAdapters = (patch: Record<string, any> = {}) => ({
  access: async () => undefined,
  readFile: async () => JSON.stringify({ initialized: true }),
  env: {
    DEEPSEEK_API_KEY: 'configured-for-fixture',
    PRODUCT_AI_PROVIDER_AVAILABILITY_VERIFIED: 'true',
  },
  now: (() => { let value = 0; return () => value; })(),
  sleep: async () => undefined,
  isPortListening: async () => false,
  fetchHealth: async () => health(),
  spawnRuntime: () => ({ pid: 43210, exitCode: null, kill: () => true }),
  ...patch,
});
const run = (adapters: Record<string, any>, mode = 'start') => runProductRuntimeLauncher({
  projectRoot: DEFAULT_PROJECT_ROOT, mode, adapters,
});

const cases: Array<{ id: string; name: string; run: () => unknown | Promise<unknown> }> = [
  { id: 'R1-L01', name: 'project root resolves from script location', run: () => assert.equal(DEFAULT_PROJECT_ROOT, resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')) },
  { id: 'R1-L02', name: 'launcher spawns current process.execPath', run: async () => { let executable = ''; await run(baseAdapters({ spawnRuntime: (value: string) => { executable = value; return child(); } })); assert.equal(executable, process.execPath); } },
  { id: 'R1-L03', name: 'missing Vite fails before spawn', run: async () => { let spawned = 0; const value = await run(baseAdapters({ access: async () => { throw new Error('missing'); }, spawnRuntime: () => { spawned += 1; return child(); } })); assert.equal(value.status, 'BLOCKED_DEPENDENCY_MISSING'); assert.equal(spawned, 0); } },
  { id: 'R1-L04', name: 'check-only never spawns and distinguishes unverified AI', run: async () => { let spawned = 0; const verified = await run(baseAdapters({ spawnRuntime: () => { spawned += 1; return child(); } }), 'check_only'); const unverified = await run(baseAdapters({ env: { DEEPSEEK_API_KEY: 'configured-for-fixture' }, spawnRuntime: () => { spawned += 1; return child(); } }), 'check_only'); assert.equal(verified.status, 'CHECK_READY'); assert.equal(unverified.status, 'CHECK_DEGRADED'); assert.deepEqual(unverified.reasonCodes, ['ai_provider_status_not_checked']); assert.equal(spawned, 0); } },
  { id: 'R1-L05', name: 'free port spawns once', run: async () => { let spawned = 0; await run(baseAdapters({ spawnRuntime: () => { spawned += 1; return child(); } })); assert.equal(spawned, 1); } },
  { id: 'R1-L06', name: 'spawn uses loopback-only fixed strict port args', run: async () => { let args: string[] = []; await run(baseAdapters({ spawnRuntime: (_: string, value: string[]) => { args = value; return child(); } })); assert.deepEqual(args.slice(-5), ['--host', '127.0.0.1', '--port', '5174', '--strictPort']); } },
  { id: 'R1-L07', name: 'healthy existing instance is reused', run: async () => { let spawned = 0; const value = await run(baseAdapters({ isPortListening: async () => true, spawnRuntime: () => { spawned += 1; return child(); } })); assert.equal(value.status, 'ALREADY_RUNNING'); assert.equal(spawned, 0); } },
  { id: 'R1-L08', name: 'unknown port owner is blocked without kill', run: async () => { let killed = 0; const value = await run(baseAdapters({ isPortListening: async () => true, fetchHealth: async () => undefined, spawnRuntime: () => ({ ...child(), kill: () => { killed += 1; } }) })); assert.equal(value.status, 'BLOCKED_PORT_CONFLICT'); assert.equal(killed, 0); } },
  { id: 'R1-L09', name: 'blocked same-product Health is not treated ready', run: async () => { const value = await run(baseAdapters({ isPortListening: async () => true, fetchHealth: async () => health('blocked') })); assert.equal(value.status, 'BLOCKED_PORT_CONFLICT'); } },
  { id: 'R1-L10', name: 'launcher polls into a degraded ready terminal', run: async () => { let calls = 0; const value = await run(baseAdapters({ fetchHealth: async () => (++calls > 1 ? health('degraded') : undefined) })); assert.equal(value.status, 'READY'); assert(calls > 1); } },
  { id: 'R1-L11', name: 'early child exit is explicit', run: async () => { const value = await run(baseAdapters({ spawnRuntime: () => ({ pid: 1, exitCode: 1, kill: () => true }), fetchHealth: async () => undefined })); assert.equal(value.status, 'BLOCKED_CHILD_EXITED'); } },
  { id: 'R1-L12', name: 'Health timeout is bounded', run: async () => { let clock = 0; let killed = 0; const value = await run(baseAdapters({ now: () => clock, sleep: async () => { clock += 10_000; }, fetchHealth: async () => undefined, spawnRuntime: () => ({ pid: 1, exitCode: null, kill: () => { killed += 1; } }) })); assert.equal(value.status, 'BLOCKED_HEALTH_TIMEOUT'); assert.equal(killed, 1); } },
  { id: 'R1-L13', name: 'launcher returns all four canonical loopback URLs', run: async () => { const value = await run(baseAdapters(), 'check_only'); assert.deepEqual(value.urls, { learning: 'http://localhost:5174/#/learning', workbench: 'http://localhost:5174/#/material-resource-workbench', internalHealth: 'http://localhost:5174/#/internal/runtime-health', healthApi: 'http://127.0.0.1:5174/__runtime/health' }); assert(!JSON.stringify(value.urls).includes('Users')); } },
  { id: 'R1-L14', name: 'unknown process receives zero cleanup operations', run: async () => { let spawnCalls = 0; const value = await run(baseAdapters({ isPortListening: async () => true, fetchHealth: async () => undefined, spawnRuntime: () => { spawnCalls += 1; return child(); } })); assert.equal(value.ownsChildProcess, false); assert.equal(spawnCalls, 0); } },
];

let passed = 0;
for (const item of cases) {
  try { await item.run(); passed += 1; console.log(`PASS ${item.id} ${item.name}`); }
  catch (error) { console.error(`FAIL ${item.id} ${item.name}`); throw error; }
}
console.log(`\nProduct Runtime Reliability WP-R1 Launcher Integration: ${passed}/${cases.length}`);

function child() { return { pid: 43210, exitCode: null, kill: () => true }; }
