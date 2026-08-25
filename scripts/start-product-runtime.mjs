import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRODUCT_RUNTIME_LAUNCH_RESULT_VERSION = 'product_runtime_launch_result_v1';
export const PRODUCT_RUNTIME_HEALTH_VERSION = 'product_runtime_health_v1';
export const PRODUCT_RUNTIME_ID = 'chinese_ability_growth_system_local_runtime';
export const PRODUCT_RUNTIME_PORT = 5174;
export const PRODUCT_RUNTIME_STARTUP_TIMEOUT_MS = 20_000;
export const PRODUCT_RUNTIME_POLL_INTERVAL_MS = 250;

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PROJECT_ROOT = resolve(SCRIPT_DIR, '..');

export async function runProductRuntimeLauncher(options = {}) {
  const projectRoot = options.projectRoot || DEFAULT_PROJECT_ROOT;
  const mode = options.mode || 'start';
  const adapters = { ...defaultAdapters(), ...(options.adapters || {}) };
  const urls = runtimeUrls();
  const preflight = await runPreflight(projectRoot, adapters);
  if (preflight) return result(preflight.status, false, urls, preflight.reasonCodes);

  const listening = await adapters.isPortListening('127.0.0.1', PRODUCT_RUNTIME_PORT);
  if (listening) {
    const health = await adapters.fetchHealth(urls.healthApi, 1_500);
    if (isOurHealthyRuntime(health)) {
      return result('ALREADY_RUNNING', false, urls, health.summaryReasonCodes || [], health);
    }
    return result('BLOCKED_PORT_CONFLICT', false, urls, ['runtime_port_conflict']);
  }

  const aiConfigured = Boolean(adapters.env.DEEPSEEK_API_KEY?.trim());
  if (mode === 'check_only') {
    return result(aiConfigured ? 'CHECK_READY' : 'CHECK_DEGRADED', false, urls,
      aiConfigured ? [] : ['ai_provider_not_configured']);
  }

  const viteEntry = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = adapters.spawnRuntime(process.execPath, [
    viteEntry, '--host', '0.0.0.0', '--port', String(PRODUCT_RUNTIME_PORT), '--strictPort',
  ], { cwd: projectRoot, env: adapters.env });
  const startedAt = adapters.now();
  while (adapters.now() - startedAt < PRODUCT_RUNTIME_STARTUP_TIMEOUT_MS) {
    if (child.exitCode !== null && child.exitCode !== undefined) {
      return result('BLOCKED_CHILD_EXITED', true, urls, ['runtime_unreachable'], undefined, child.pid);
    }
    const health = await adapters.fetchHealth(urls.healthApi, 1_500);
    if (isOurHealthyRuntime(health)) {
      return result('READY', true, urls, health.summaryReasonCodes || [], health, child.pid, child);
    }
    await adapters.sleep(PRODUCT_RUNTIME_POLL_INTERVAL_MS);
  }
  if (typeof child.kill === 'function') child.kill();
  return result('BLOCKED_HEALTH_TIMEOUT', true, urls, ['runtime_health_timeout'], undefined, child.pid);
}

async function runPreflight(projectRoot, adapters) {
  if (!process.execPath) return { status: 'BLOCKED_RUNTIME_MISSING', reasonCodes: ['runtime_unreachable'] };
  const viteEntry = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  try { await adapters.access(viteEntry); }
  catch { return { status: 'BLOCKED_DEPENDENCY_MISSING', reasonCodes: ['runtime_unreachable'] }; }
  const storePath = resolve(projectRoot, adapters.env.FORMAL_RESOURCE_STORE_PATH || '.local-data/formal-resource-store.json');
  try {
    const parsed = JSON.parse(await adapters.readFile(storePath, 'utf8'));
    if (!parsed || parsed.initialized !== true) {
      return { status: 'BLOCKED_FORMAL_STORE_UNREADABLE', reasonCodes: ['formal_store_uninitialized'] };
    }
  } catch {
    return { status: 'BLOCKED_FORMAL_STORE_UNREADABLE', reasonCodes: ['formal_store_unreadable'] };
  }
  return undefined;
}

function isOurHealthyRuntime(health) {
  return health?.schemaVersion === PRODUCT_RUNTIME_HEALTH_VERSION
    && health?.instance?.productId === PRODUCT_RUNTIME_ID
    && health?.instance?.port === PRODUCT_RUNTIME_PORT
    && ['ready', 'degraded'].includes(health?.overallStatus);
}

function runtimeUrls() {
  return {
    learning: 'http://localhost:5174/learning#/learning',
    workbench: 'http://localhost:5174/#/material-resource-workbench',
    internalHealth: 'http://localhost:5174/#/internal/runtime-health',
    healthApi: 'http://127.0.0.1:5174/__runtime/health',
  };
}

function result(status, ownsChildProcess, urls, reasonCodes = [], health, childPid, child) {
  const blocked = status.startsWith('BLOCKED_');
  return {
    schemaVersion: PRODUCT_RUNTIME_LAUNCH_RESULT_VERSION,
    status,
    exitCode: blocked ? 1 : 0,
    ownsChildProcess,
    ...(childPid ? { childPid } : {}),
    ...(health ? { health } : {}),
    reasonCodes: [...new Set(reasonCodes)].sort(),
    urls,
    ...(child ? { child } : {}),
  };
}

function defaultAdapters() {
  return {
    access,
    readFile,
    env: process.env,
    now: () => Date.now(),
    sleep: (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)),
    spawnRuntime: (executable, args, options) => spawn(executable, args, {
      cwd: options.cwd, env: options.env, stdio: 'inherit', windowsHide: true,
    }),
    isPortListening: (host, port) => new Promise((resolveListening) => {
      const socket = net.createConnection({ host, port });
      const done = (listening) => { socket.destroy(); resolveListening(listening); };
      socket.setTimeout(800);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
    }),
    fetchHealth: async (url, timeoutMs) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal });
        const body = await response.json();
        return body;
      } catch { return undefined; }
      finally { clearTimeout(timer); }
    },
  };
}

function publicResult(value) {
  const { child: _child, ...safe } = value;
  return safe;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const launch = await runProductRuntimeLauncher({
    mode: process.argv.includes('--check') ? 'check_only' : 'start',
  });
  process.stdout.write(`${JSON.stringify(publicResult(launch), null, 2)}\n`);
  process.exitCode = launch.exitCode;
  if (launch.child) {
    const stopOwnedChild = () => {
      if (launch.child.exitCode === null) launch.child.kill();
    };
    process.once('SIGINT', stopOwnedChild);
    process.once('SIGTERM', stopOwnedChild);
  }
}
