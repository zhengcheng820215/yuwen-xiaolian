import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import { PRODUCT_COMPLEXITY_CONVERGENCE_PREFLIGHT_BUILD_VERSION } from '../../api/productComplexityConvergenceStage4Preflight.ts';
import {
  buildProductRuntimeBaselineAudit,
  buildProductRuntimeProtectedSnapshot,
  buildRuntimeIdentityInputAudit,
} from '../services/productRuntimeBaselineAuditService.ts';
import type {
  ProductRuntimeBaselineAudit,
  RuntimeDependencyInventoryItem,
  RuntimeRouteAudit,
} from '../schemas/productRuntimeBaselineAudit.schema.ts';

const DEFAULT_RUNTIME_URL = 'http://localhost:5174';
const LAUNCH_REPORT = 'docs/education/phase/reports/product_complexity_convergence_real_trial_activation_signoff_2026-08-25.md';

export async function runProductRuntimeBaselineAudit(
  now = new Date().toISOString(),
): Promise<ProductRuntimeBaselineAudit> {
  const store = new SharedFormalResourceStore();
  const before = await store.read();
  const protectedBefore = buildProductRuntimeProtectedSnapshot(before);
  const gitCommit = git(['rev-parse', 'HEAD']) || 'git-commit-unavailable';
  const worktreeState = git(['status', '--porcelain']) ? 'dirty' as const : 'clean' as const;
  const launchText = safeRead(LAUNCH_REPORT);
  const launchGitCommit = capture(launchText, /Git Commit \| `([^`]+)`/);
  const launchBuildVersion = capture(launchText, /Build Version \| `([^`]+)`/);
  const runtimeUrl = process.env.PRODUCT_RUNTIME_AUDIT_URL || DEFAULT_RUNTIME_URL;
  const runtime = await probeRuntime(runtimeUrl);
  const checkedAt = new Date().toISOString();
  const dependencies = buildDependencies({ runtime, storeReady: before.initialized, checkedAt });
  const routeAudits = buildRouteAudits(runtimeUrl, runtime);
  const identityInputAudit = buildRuntimeIdentityInputAudit({
    gitCommit,
    worktreeState,
    launchGitCommit,
    currentBuildVersion: PRODUCT_COMPLEXITY_CONVERGENCE_PREFLIGHT_BUILD_VERSION,
    launchBuildVersion,
    buildVersionContentAddressed: false,
  });
  const after = await store.read();
  const protectedAfter = buildProductRuntimeProtectedSnapshot(after);
  return buildProductRuntimeBaselineAudit({
    auditId: `product-runtime-wp-r0:${gitCommit.slice(0, 12)}`,
    startedAt: now,
    completedAt: checkedAt,
    gitCommit,
    worktreeState,
    snapshotBefore: before,
    snapshotAfter: after,
    protectedBefore,
    protectedAfter,
    dependencies,
    identityInputAudit,
    routeAudits,
    fixedBaselineEvidence: findFixedBaselineEvidence(),
  });
}

type RuntimeProbe = {
  reachable: boolean;
  formalBoundaryReachable: boolean;
  timedOut: boolean;
  evidenceCodes: string[];
};

async function probeRuntime(baseUrl: string): Promise<RuntimeProbe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await fetch(`${baseUrl}/__runtime/phase17-4/formal-resources`, {
      method: 'GET', signal: controller.signal, cache: 'no-store',
    });
    return {
      reachable: true,
      formalBoundaryReachable: response.ok,
      timedOut: false,
      evidenceCodes: [`runtime:http:${response.status}`],
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return {
      reachable: false,
      formalBoundaryReachable: false,
      timedOut,
      evidenceCodes: [timedOut ? 'runtime:timeout' : 'runtime:unreachable'],
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildDependencies(input: {
  runtime: RuntimeProbe;
  storeReady: boolean;
  checkedAt: string;
}): RuntimeDependencyInventoryItem[] {
  const runtimeReason = input.runtime.timedOut ? 'runtime_health_timeout' : 'runtime_unreachable';
  return [
    dependency('node-runtime', '启动本地 Runtime', ['learning_read', 'learning_submit', 'workbench_read'], 'ready', undefined, input.checkedAt, [`node:${process.version}`]),
    dependency('project-dependencies', '加载前端与本地 Boundary', ['learning_read', 'learning_submit', 'workbench_read'], 'ready', undefined, input.checkedAt, ['dependencies:present']),
    dependency('vite-runtime-5174', '承载页面和本地 Runtime Boundary', ['learning_read', 'learning_submit', 'workbench_read'], input.runtime.reachable ? 'ready' : 'not_running', input.runtime.reachable ? undefined : runtimeReason, input.checkedAt, input.runtime.evidenceCodes),
    dependency('shared-formal-resource-store', '正式材料与题目权威来源', ['learning_read', 'workbench_read'], input.storeReady ? 'ready' : 'blocked', input.storeReady ? undefined : 'formal_store_uninitialized', input.checkedAt, [`store:initialized:${input.storeReady}`]),
    dependency('shared-formal-resource-boundary', '浏览器正式资源入口', ['learning_read', 'workbench_read'], input.runtime.formalBoundaryReachable ? 'ready' : 'not_running', input.runtime.formalBoundaryReachable ? undefined : 'formal_resource_boundary_unavailable', input.checkedAt, input.runtime.evidenceCodes),
    dependency('ai-provider', '正式诊断与生成', ['learning_submit', 'workbench_ai'], process.env.DEEPSEEK_API_KEY ? 'not_checked' : 'not_configured', process.env.DEEPSEEK_API_KEY ? 'ai_provider_status_not_checked' : 'ai_provider_not_configured', input.checkedAt, [`ai:configured:${Boolean(process.env.DEEPSEEK_API_KEY)}`]),
    dependency('browser-persistence', 'Session、Attempt 与恢复', ['learning_read', 'learning_submit'], 'not_checked', 'audit_evidence_incomplete', input.checkedAt, ['browser-persistence:not-checked-by-cli']),
    dependency('trial-observation', '真实观察旁路', ['trial_observation'], 'degraded', 'trial_reentry_required', input.checkedAt, ['trial:reentry-required']),
  ];
}

function buildRouteAudits(baseUrl: string, runtime: RuntimeProbe): RuntimeRouteAudit[] {
  const reasonCodes = runtime.reachable ? [] : ['runtime_unreachable' as const];
  return [
    route('learning', `${baseUrl}/#/learning`, runtime.reachable, runtime.formalBoundaryReachable, reasonCodes),
    route('workbench', `${baseUrl}/#/material-resource-workbench`, runtime.reachable, runtime.formalBoundaryReachable, reasonCodes),
    route('internal', `${baseUrl}/#/internal`, runtime.reachable, runtime.formalBoundaryReachable, reasonCodes),
  ];
}

function route(
  routeId: RuntimeRouteAudit['routeId'],
  url: string,
  reachable: boolean,
  formalResourceBoundaryReachable: boolean,
  reasonCodes: RuntimeRouteAudit['reasonCodes'],
): RuntimeRouteAudit {
  return {
    routeId, url, reachable,
    visibleState: reachable ? 'runtime_reachable_ui_not_inspected_by_cli' : 'runtime_unreachable',
    runtimeBoundaryReachable: reachable,
    formalResourceBoundaryReachable,
    reasonCodes: [...reasonCodes],
    evidenceCodes: [reachable ? 'route:runtime-reachable' : 'route:runtime-unreachable'],
  };
}

function dependency(
  dependencyId: string,
  role: string,
  requiredFor: RuntimeDependencyInventoryItem['requiredFor'],
  status: RuntimeDependencyInventoryItem['status'],
  reasonCode: RuntimeDependencyInventoryItem['reasonCode'],
  checkedAt: string,
  evidenceCodes: string[],
): RuntimeDependencyInventoryItem {
  return { dependencyId, role, requiredFor, status, reasonCode, checkedAt, evidenceCodes };
}

function findFixedBaselineEvidence(): string[] {
  const files = [
    'src/ai/tests/runMaterialProvenanceGovernance.ts',
    'src/ai/tests/runMaterialProvenanceReadinessP103Debug.ts',
  ];
  return files.filter((file) => /activeMaterials\.length\s*,\s*12|materialCount\s*,\s*12|activeMaterialCount[^\n]*12|materials\.length[^\n]*12|24\s*!==\s*12/.test(safeRead(file)))
    .map((file) => `fixed-baseline:${file}`);
}

function git(args: string[]): string {
  try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
  catch { return ''; }
}

function safeRead(path: string): string {
  try { return readFileSync(path, 'utf8'); }
  catch { return ''; }
}

function capture(value: string, pattern: RegExp): string | undefined {
  return value.match(pattern)?.[1];
}
