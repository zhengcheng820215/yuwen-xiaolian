import { createHash } from 'node:crypto';
import type { SharedFormalResourceSnapshot } from '../schemas/sharedFormalResourcePersistence.schema.ts';
import {
  PRODUCT_RUNTIME_IDENTITY_CANONICALIZATION_VERSION,
  PRODUCT_RUNTIME_IDENTITY_HASH_ALGORITHM,
  PRODUCT_RUNTIME_IDENTITY_PRODUCT_ID,
  PRODUCT_RUNTIME_IDENTITY_VERSION,
  validateProductRuntimeIdentity,
  validateRealTrialRuntimeIdentityBinding,
  type ProductRuntimeIdentity,
  type ProductRuntimeIdentityEvidence,
  type ProductRuntimeIdentityInputs,
  type ProductRuntimeIdentityStatus,
  type RealTrialRuntimeIdentityBinding,
  type Sha256Digest,
  type TrialRuntimeIdentityAlignment,
} from '../schemas/productRuntimeIdentity.schema.ts';

export function sha256(value: string | Uint8Array): Sha256Digest {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function normalizeRuntimeIdentityText(value: string): string {
  return value.replaceAll('\r\n', '\n').replaceAll('\r', '\n').normalize('NFC');
}

export function stableRuntimeIdentitySerialize(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function buildManifestDigest(entries: Array<{ path: string; digest: Sha256Digest }>): Sha256Digest {
  const canonical = [...entries]
    .map((entry) => ({ path: entry.path.replaceAll('\\', '/').normalize('NFC'), digest: entry.digest }))
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((entry) => `${entry.path}\0${entry.digest}`)
    .join('\n');
  return sha256(canonical);
}

export function buildProductRuntimeIdentity(input: {
  identityInputs: ProductRuntimeIdentityInputs;
  evidence: ProductRuntimeIdentityEvidence;
}): ProductRuntimeIdentity {
  const digestInput = {
    runtimeIdentityVersion: PRODUCT_RUNTIME_IDENTITY_VERSION,
    productId: PRODUCT_RUNTIME_IDENTITY_PRODUCT_ID,
    canonicalizationVersion: PRODUCT_RUNTIME_IDENTITY_CANONICALIZATION_VERSION,
    hashAlgorithm: PRODUCT_RUNTIME_IDENTITY_HASH_ALGORITHM,
    identityInputs: input.identityInputs,
  };
  return {
    ...digestInput,
    runtimeIdentityDigest: sha256(stableRuntimeIdentitySerialize(digestInput)),
    evidence: structuredClone(input.evidence),
  };
}

export function resolveProductRuntimeIdentityStatus(
  identity?: ProductRuntimeIdentity,
): { status: ProductRuntimeIdentityStatus; issueCodes: string[] } {
  if (!identity) return { status: 'missing', issueCodes: ['runtime_identity_missing'] };
  const issues = validateProductRuntimeIdentity(identity);
  const rebuilt = buildProductRuntimeIdentity({ identityInputs: identity.identityInputs, evidence: identity.evidence });
  if (rebuilt.runtimeIdentityDigest !== identity.runtimeIdentityDigest) issues.push('runtime_identity_digest_mismatch');
  if (issues.length) return { status: 'invalid', issueCodes: [...new Set(issues)] };
  if (identity.evidence.worktreeState !== 'clean') return { status: 'dirty', issueCodes: ['runtime_identity_dirty'] };
  return { status: 'available', issueCodes: [] };
}

export function compareTrialRuntimeIdentity(input: {
  currentIdentity?: ProductRuntimeIdentity;
  binding?: RealTrialRuntimeIdentityBinding;
}): { alignment: TrialRuntimeIdentityAlignment; reasonCodes: string[] } {
  const current = resolveProductRuntimeIdentityStatus(input.currentIdentity);
  if (current.status !== 'available') return { alignment: current.status, reasonCodes: current.issueCodes };
  if (!input.binding) return { alignment: 'legacy_unverifiable', reasonCodes: ['trial_runtime_identity_binding_missing', 'legacy_launch_identity_unverifiable'] };
  const bindingIssues = validateRealTrialRuntimeIdentityBinding(input.binding);
  if (bindingIssues.length) return { alignment: 'invalid', reasonCodes: bindingIssues };
  const aligned = input.binding.runtimeIdentityDigest === input.currentIdentity!.runtimeIdentityDigest
    && input.binding.runtimeIdentityVersion === input.currentIdentity!.runtimeIdentityVersion
    && input.binding.formalResourceSnapshotDigest
      === input.currentIdentity!.identityInputs.formalResourceSnapshotDigest
    && input.binding.executablePolicyBundleDigest
      === input.currentIdentity!.identityInputs.executablePolicyBundleDigest
    && input.binding.trialPolicyBundleDigest
      === input.currentIdentity!.identityInputs.trialPolicyBundleDigest;
  return aligned
    ? { alignment: 'aligned', reasonCodes: [] }
    : { alignment: 'mismatch', reasonCodes: ['runtime_identity_mismatch'] };
}

export function buildFormalResourceSnapshotDigest(snapshot: SharedFormalResourceSnapshot): Sha256Digest {
  const resources = snapshot.data.questionResources;
  const activeEntries = resources.registryEntries.filter((entry) => entry.status === 'active');
  const currentVersionIds = new Set(activeEntries.map((entry) => entry.currentFrozenVersionId));
  const currentVersions = resources.versions.filter((version) => currentVersionIds.has(version.resourceVersionId));
  const canonical = {
    schemaVersion: snapshot.schemaVersion,
    materials: resources.materials.filter((material) => material.status !== 'retired')
      .map(stripVolatile).sort(byIdentity),
    registryEntries: activeEntries.map(stripVolatile).sort(byIdentity),
    versions: currentVersions.map(stripVolatile).sort(byIdentity),
  };
  return sha256(stableRuntimeIdentitySerialize(canonical));
}

function normalize(value: unknown): unknown {
  if (typeof value === 'string') return normalizeRuntimeIdentityText(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, normalize(nested)]));
  return value;
}

function stripVolatile<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !['createdAt', 'updatedAt', 'publishedAt', 'recordedAt'].includes(key)));
}
function byIdentity(left: Record<string, unknown>, right: Record<string, unknown>): number {
  const identity = (value: Record<string, unknown>) => [
    value.materialId, value.materialVersionId, value.resourceId, value.resourceVersionId, value.registryEntryId,
  ].filter(Boolean).join(':');
  return identity(left).localeCompare(identity(right));
}
