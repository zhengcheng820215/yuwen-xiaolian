export const PRODUCT_RUNTIME_IDENTITY_VERSION = 'product_runtime_identity_v1' as const;
export const PRODUCT_RUNTIME_IDENTITY_CANONICALIZATION_VERSION =
  'product_runtime_identity_c14n_v1' as const;
export const PRODUCT_RUNTIME_IDENTITY_HASH_ALGORITHM = 'sha256' as const;
export const PRODUCT_RUNTIME_IDENTITY_PRODUCT_ID =
  'chinese_ability_growth_system_local_runtime' as const;
export const REAL_TRIAL_RUNTIME_IDENTITY_BINDING_VERSION =
  'real_trial_runtime_identity_binding_v1' as const;

export type Sha256Digest = `sha256:${string}`;

export type ProductRuntimeIdentityInputs = {
  applicationContentDigest: Sha256Digest;
  dependencyLockDigest: Sha256Digest;
  buildConfigurationDigest: Sha256Digest;
  buildArtifactManifestDigest: Sha256Digest;
  formalResourceSnapshotDigest: Sha256Digest;
  executablePolicyBundleDigest: Sha256Digest;
  trialPolicyBundleDigest: Sha256Digest;
  providerBoundaryDigest: Sha256Digest;
};

export type ProductRuntimeIdentityEvidence = {
  gitCommit?: string;
  worktreeState: 'clean' | 'dirty' | 'unknown';
  sourceFileCount: number;
  artifactFileCount: number;
  formalStoreRevision?: number;
  formalMaterialCount?: number;
  formalQuestionCount?: number;
  generatedAt: string;
};

export type ProductRuntimeIdentity = {
  runtimeIdentityVersion: typeof PRODUCT_RUNTIME_IDENTITY_VERSION;
  productId: typeof PRODUCT_RUNTIME_IDENTITY_PRODUCT_ID;
  canonicalizationVersion: typeof PRODUCT_RUNTIME_IDENTITY_CANONICALIZATION_VERSION;
  hashAlgorithm: typeof PRODUCT_RUNTIME_IDENTITY_HASH_ALGORITHM;
  identityInputs: ProductRuntimeIdentityInputs;
  runtimeIdentityDigest: Sha256Digest;
  evidence: ProductRuntimeIdentityEvidence;
};

export type ProductRuntimeIdentityStatus = 'available' | 'missing' | 'invalid' | 'dirty';
export type TrialRuntimeIdentityAlignment = ProductRuntimeIdentityStatus
  | 'aligned' | 'mismatch' | 'legacy_unverifiable';

export type RealTrialRuntimeIdentityBinding = {
  bindingVersion: typeof REAL_TRIAL_RUNTIME_IDENTITY_BINDING_VERSION;
  bindingId: string;
  launchRecordId: string;
  trialWindowId: string;
  runtimeIdentityVersion: typeof PRODUCT_RUNTIME_IDENTITY_VERSION;
  runtimeIdentityDigest: Sha256Digest;
  formalResourceSnapshotDigest: Sha256Digest;
  executablePolicyBundleDigest: Sha256Digest;
  trialPolicyBundleDigest: Sha256Digest;
  boundAt: string;
};

const SHA256 = /^sha256:[a-f0-9]{64}$/;

export function isSha256Digest(value: unknown): value is Sha256Digest {
  return typeof value === 'string' && SHA256.test(value);
}

export function validateProductRuntimeIdentity(identity: ProductRuntimeIdentity): string[] {
  const issues: string[] = [];
  if (identity.runtimeIdentityVersion !== PRODUCT_RUNTIME_IDENTITY_VERSION) issues.push('runtime_identity_version_invalid');
  if (identity.productId !== PRODUCT_RUNTIME_IDENTITY_PRODUCT_ID) issues.push('runtime_identity_product_invalid');
  if (identity.canonicalizationVersion !== PRODUCT_RUNTIME_IDENTITY_CANONICALIZATION_VERSION
    || identity.hashAlgorithm !== PRODUCT_RUNTIME_IDENTITY_HASH_ALGORITHM) issues.push('runtime_identity_canonicalization_invalid');
  if (!identity.identityInputs || Object.values(identity.identityInputs).length !== 8
    || Object.values(identity.identityInputs).some((digest) => !isSha256Digest(digest))) issues.push('runtime_identity_inputs_invalid');
  if (!isSha256Digest(identity.runtimeIdentityDigest)) issues.push('runtime_identity_digest_invalid');
  if (!identity.evidence || !['clean', 'dirty', 'unknown'].includes(identity.evidence.worktreeState)
    || !nonNegativeInteger(identity.evidence.sourceFileCount)
    || !nonNegativeInteger(identity.evidence.artifactFileCount)
    || !timestamp(identity.evidence.generatedAt)) issues.push('runtime_identity_evidence_invalid');
  return [...new Set(issues)];
}

export function validateRealTrialRuntimeIdentityBinding(
  binding: RealTrialRuntimeIdentityBinding,
): string[] {
  const issues: string[] = [];
  if (binding.bindingVersion !== REAL_TRIAL_RUNTIME_IDENTITY_BINDING_VERSION) issues.push('runtime_identity_binding_version_invalid');
  if (![binding.bindingId, binding.launchRecordId, binding.trialWindowId].every(nonEmpty)) issues.push('runtime_identity_binding_identity_invalid');
  if (binding.runtimeIdentityVersion !== PRODUCT_RUNTIME_IDENTITY_VERSION
    || !isSha256Digest(binding.runtimeIdentityDigest)
    || !isSha256Digest(binding.formalResourceSnapshotDigest)
    || !isSha256Digest(binding.executablePolicyBundleDigest)
    || !isSha256Digest(binding.trialPolicyBundleDigest)) issues.push('runtime_identity_binding_digest_invalid');
  if (!timestamp(binding.boundAt)) issues.push('runtime_identity_binding_time_invalid');
  return [...new Set(issues)];
}

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
function nonNegativeInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
function timestamp(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
