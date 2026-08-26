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
  return `sha256:${sha256Hex(typeof value === 'string' ? new TextEncoder().encode(value) : value)}`;
}

// Small synchronous SHA-256 implementation shared by Node and the browser-side
// Internal operator. Runtime Identity must be recomputable without importing a
// Node-only crypto module into the product bundle.
function sha256Hex(input: Uint8Array): string {
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const bitLength = input.length * 8;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15]; const y = w[i - 2];
      const s0 = rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3);
      const s1 = rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + k[i] + w[i]) >>> 0;
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return h.map((value) => value.toString(16).padStart(8, '0')).join('');
}

function rotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
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
