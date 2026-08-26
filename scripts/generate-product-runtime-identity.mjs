import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { SharedFormalResourceStore } from '../src/server/sharedFormalResourceStore.ts';
import {
  buildFormalResourceSnapshotDigest,
  buildManifestDigest,
  buildProductRuntimeIdentity,
  normalizeRuntimeIdentityText,
  sha256,
  stableRuntimeIdentitySerialize,
} from '../src/ai/services/productRuntimeIdentityService.ts';

const root = resolve(process.cwd());
const distRoot = resolve(root, 'dist');
if (!existsSync(distRoot)) throw new Error('Production build is missing. Run npm run build first.');

const sourceFiles = await collect(['src', 'scripts/start-product-runtime.mjs', 'vite.config.js', 'package.json'],
  (path) => !path.includes('/tests/') && !path.endsWith('.test.ts') && !path.endsWith('.test.js'));
const artifactFiles = await collect(['dist'], (path) => !path.includes('/.runtime/') && !path.endsWith('.map'));
const executablePolicyFiles = sourceFiles.filter((entry) => /\/src\/ai\/(schemas|agents|services)\//.test(`/${entry.path}`));
const trialPolicyFiles = sourceFiles.filter((entry) => /productComplexityConvergence|productRuntime/.test(entry.path));
const providerFiles = sourceFiles.filter((entry) => /deepseek|realLLM|phase163DiagnosisBoundary/i.test(entry.path));
const buildConfigurationFiles = sourceFiles.filter((entry) => /(^|\/)(vite\.config\.js|package\.json|start-product-runtime\.mjs)$/.test(entry.path));
const lockPath = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].find((path) => existsSync(resolve(root, path)));
if (!lockPath) throw new Error('Dependency lockfile is missing.');

const snapshot = await new SharedFormalResourceStore().readOnly();
const gitCommit = safeGit(['rev-parse', 'HEAD']);
const worktreeState = safeGit(['status', '--porcelain']) ? 'dirty' : 'clean';
const identityInputs = {
  applicationContentDigest: buildManifestDigest(sourceFiles),
  dependencyLockDigest: sha256(await readText(lockPath)),
  buildConfigurationDigest: sha256(stableRuntimeIdentitySerialize({
    mode: 'production', base: './', productId: 'chinese_ability_growth_system_local_runtime',
    manifestDigest: buildManifestDigest(buildConfigurationFiles),
  })),
  buildArtifactManifestDigest: buildManifestDigest(artifactFiles),
  formalResourceSnapshotDigest: buildFormalResourceSnapshotDigest(snapshot),
  executablePolicyBundleDigest: buildManifestDigest(executablePolicyFiles),
  trialPolicyBundleDigest: buildManifestDigest(trialPolicyFiles),
  providerBoundaryDigest: buildManifestDigest(providerFiles),
};
const identity = buildProductRuntimeIdentity({
  identityInputs,
  evidence: {
    gitCommit: gitCommit || undefined,
    worktreeState,
    sourceFileCount: sourceFiles.length,
    artifactFileCount: artifactFiles.length,
    formalStoreRevision: snapshot.revision,
    formalMaterialCount: snapshot.data.questionResources.materials.filter((item) => item.status !== 'retired').length,
    formalQuestionCount: snapshot.data.questionResources.registryEntries.filter((item) => item.status === 'active').length,
    generatedAt: new Date().toISOString(),
  },
});
const outputPath = resolve(distRoot, '.runtime/product-runtime-identity.json');
await mkdir(resolve(distRoot, '.runtime'), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath: relative(root, outputPath), runtimeIdentityDigest: identity.runtimeIdentityDigest,
  worktreeState, sourceFileCount: sourceFiles.length, artifactFileCount: artifactFiles.length }, null, 2));

async function collect(inputs, include) {
  const files = [];
  for (const input of inputs) {
    const absolute = resolve(root, input);
    if (!existsSync(absolute)) continue;
    const stat = await import('node:fs/promises').then(({ stat }) => stat(absolute));
    if (stat.isDirectory()) await walk(absolute, files);
    else files.push(absolute);
  }
  const entries = [];
  for (const absolute of files) {
    const path = relative(root, absolute).split(sep).join('/');
    if (!include(path)) continue;
    const raw = await readFile(absolute);
    const text = isText(path) ? normalizeRuntimeIdentityText(raw.toString('utf8')) : raw;
    entries.push({ path, digest: sha256(text) });
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}
async function walk(directory, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path, files); else if (entry.isFile()) files.push(path);
  }
}
async function readText(path) { return normalizeRuntimeIdentityText(await readFile(resolve(root, path), 'utf8')); }
function isText(path) { return /\.(js|jsx|mjs|ts|tsx|json|css|html|md|yaml|yml|txt)$/.test(path); }
function safeGit(args) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); } catch { return ''; }
}
