import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { relative, resolve, sep } from 'node:path';
import type { SharedFormalResourceSnapshot } from '../ai/schemas/sharedFormalResourcePersistence.schema.ts';
import type { ProductRuntimeIdentity } from '../ai/schemas/productRuntimeIdentity.schema.ts';
import type { Connect } from 'vite';
import {
  buildFormalResourceSnapshotDigest,
  buildManifestDigest,
  normalizeRuntimeIdentityText,
  resolveProductRuntimeIdentityStatus,
  sha256,
} from '../ai/services/productRuntimeIdentityService.ts';

export function createProductRuntimeIdentityBoundary(): Connect.NextHandleFunction {
  return async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method !== 'GET') {
      response.statusCode = 405;
      response.end(JSON.stringify({ code: 'method_not_allowed' }));
      return;
    }
    const result = await readCurrentProductRuntimeIdentity();
    response.statusCode = result.status === 'available' ? 200 : 409;
    response.end(JSON.stringify({
      schemaVersion: 'product_runtime_identity_read_result_v1',
      status: result.status,
      issueCodes: result.issueCodes,
      identity: result.identity,
    }));
  };
}

export async function readCurrentProductRuntimeIdentity(
  identityPath = process.env.PRODUCT_RUNTIME_IDENTITY_PATH
    || resolve('dist/.runtime/product-runtime-identity.json'),
  formalSnapshot?: SharedFormalResourceSnapshot,
): Promise<{ identity?: ProductRuntimeIdentity; status: 'available' | 'missing' | 'invalid' | 'dirty'; issueCodes: string[] }> {
  try {
    const identity = JSON.parse(await readFile(identityPath, 'utf8')) as ProductRuntimeIdentity;
    const resolved = resolveProductRuntimeIdentityStatus(identity);
    if (resolved.status !== 'available') return { identity, ...resolved };
    if (currentWorktreeIsDirty()) return {
      identity, status: 'dirty', issueCodes: ['runtime_identity_dirty'],
    };
    if (formalSnapshot
      && buildFormalResourceSnapshotDigest(formalSnapshot)
        !== identity.identityInputs.formalResourceSnapshotDigest) return {
      identity, status: 'invalid', issueCodes: ['runtime_identity_formal_snapshot_mismatch'],
    };
    if (await currentArtifactManifestDigest()
      !== identity.identityInputs.buildArtifactManifestDigest) return {
      identity, status: 'invalid', issueCodes: ['runtime_identity_artifact_manifest_mismatch'],
    };
    return { identity, ...resolved };
  } catch (error) {
    const missing = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
    return missing
      ? { status: 'missing', issueCodes: ['runtime_identity_missing'] }
      : { status: 'invalid', issueCodes: ['runtime_identity_invalid'] };
  }
}

async function currentArtifactManifestDigest() {
  const root = resolve(process.cwd());
  const dist = resolve(root, 'dist');
  const files: string[] = [];
  await walk(dist, files);
  const entries = [];
  for (const absolute of files) {
    const path = relative(root, absolute).split(sep).join('/');
    if (path.includes('/.runtime/') || path.endsWith('.map')) continue;
    const raw = await readFile(absolute);
    const content = /\.(js|jsx|mjs|ts|tsx|json|css|html|md|yaml|yml|txt)$/.test(path)
      ? normalizeRuntimeIdentityText(raw.toString('utf8')) : raw;
    entries.push({ path, digest: sha256(content) });
  }
  return buildManifestDigest(entries);
}

async function walk(directory: string, files: string[]): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path, files);
    else if (entry.isFile()) files.push(path);
  }
}

function currentWorktreeIsDirty(): boolean {
  try {
    return execFileSync('git', ['status', '--porcelain'], {
      cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().length > 0;
  } catch {
    return false;
  }
}
