import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

type UnknownRecord = Record<string, unknown>;

type HistoricalAuditResult = {
  storeBytes: number;
  readMs: number;
  parseMs: number;
  versionCount: number;
  registryCount: number;
  activeRegistryCount: number;
  criticalIssues: string[];
  compatibilityWarnings: string[];
};

const defaultStorePath = fileURLToPath(
  new URL('../../../.local-data/formal-resource-store.json', import.meta.url),
);
const storePath = process.argv[2] || defaultStorePath;

function asRecord(value: unknown, label: string): UnknownRecord {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
  return value as UnknownRecord;
}

function asRecordArray(value: unknown, label: string): UnknownRecord[] {
  assert(Array.isArray(value), `${label} must be an array.`);
  return value.map((item, index) => asRecord(item, `${label}[${index}]`));
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values.filter(Boolean)) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function tagsOf(record: UnknownRecord): string[] {
  return Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];
}

async function runAudit(): Promise<HistoricalAuditResult> {
  const readStartedAt = performance.now();
  const source = await readFile(storePath, 'utf8');
  const readMs = performance.now() - readStartedAt;

  const parseStartedAt = performance.now();
  const root = asRecord(JSON.parse(source), 'store');
  const data = asRecord(root.data, 'store.data');
  const questionResources = asRecord(data.questionResources, 'store.data.questionResources');
  const versions = asRecordArray(questionResources.versions, 'questionResources.versions');
  const registryEntries = asRecordArray(
    questionResources.registryEntries,
    'questionResources.registryEntries',
  );
  const validations = asRecordArray(questionResources.validations, 'questionResources.validations');
  const reviews = asRecordArray(questionResources.reviews, 'questionResources.reviews');
  const parseMs = performance.now() - parseStartedAt;

  const criticalIssues: string[] = [];
  const compatibilityWarnings: string[] = [];
  const versionsById = new Map(
    versions.map((version) => [readString(version.resourceVersionId), version]),
  );
  const validationIds = new Set(validations.map((item) => readString(item.validationId)));
  const reviewIds = new Set(reviews.map((item) => readString(item.reviewId)));

  for (const duplicate of duplicateValues(versions.map((item) => readString(item.resourceVersionId)))) {
    criticalIssues.push(`duplicate_resource_version:${duplicate}`);
  }
  for (const duplicate of duplicateValues(registryEntries.map((item) => readString(item.resourceId)))) {
    criticalIssues.push(`duplicate_registry_resource:${duplicate}`);
  }

  for (const entry of registryEntries) {
    const resourceId = readString(entry.resourceId);
    const currentVersionId = readString(entry.currentFrozenVersionId);
    if (entry.status === 'active' && !currentVersionId) {
      criticalIssues.push(`active_registry_without_head:${resourceId}`);
      continue;
    }
    if (!currentVersionId) continue;
    const currentVersion = versionsById.get(currentVersionId);
    if (!currentVersion) {
      criticalIssues.push(`registry_head_missing:${resourceId}:${currentVersionId}`);
      continue;
    }
    if (readString(currentVersion.resourceId) !== resourceId) {
      criticalIssues.push(`registry_head_resource_mismatch:${resourceId}:${currentVersionId}`);
    }
    if (currentVersion.status !== 'frozen') {
      criticalIssues.push(`registry_head_not_frozen:${resourceId}:${currentVersionId}`);
    }
  }

  for (const version of versions) {
    const versionId = readString(version.resourceVersionId);
    const validationId = readString(version.validationId);
    const reviewId = readString(version.reviewId);
    if (validationId && !validationIds.has(validationId)) {
      criticalIssues.push(`version_validation_missing:${versionId}:${validationId}`);
    }
    if (reviewId && !reviewIds.has(reviewId)) {
      criticalIssues.push(`version_review_missing:${versionId}:${reviewId}`);
    }
    if (
      version.status === 'frozen'
      && !tagsOf(version).some((tag) => tag.startsWith('hint_policy:'))
    ) {
      compatibilityWarnings.push(`legacy_hint_policy_defaulted:${versionId}`);
    }
  }

  return {
    storeBytes: Buffer.byteLength(source),
    readMs,
    parseMs,
    versionCount: versions.length,
    registryCount: registryEntries.length,
    activeRegistryCount: registryEntries.filter((item) => item.status === 'active').length,
    criticalIssues: criticalIssues.sort(),
    compatibilityWarnings: compatibilityWarnings.sort(),
  };
}

const result = await runAudit();

console.log('Formal Resource Historical Audit');
console.log('='.repeat(72));
console.log(`Store: ${storePath}`);
console.log(`Size: ${result.storeBytes} bytes`);
console.log(`Read: ${result.readMs.toFixed(2)} ms`);
console.log(`Parse and index: ${result.parseMs.toFixed(2)} ms`);
console.log(`Versions: ${result.versionCount}`);
console.log(`Registry entries: ${result.registryCount} (${result.activeRegistryCount} active)`);
console.log(`Compatibility warnings: ${result.compatibilityWarnings.length}`);
for (const warning of result.compatibilityWarnings) {
  console.log(`WARN ${warning}`);
}

assert.deepEqual(
  result.criticalIssues,
  [],
  `Historical formal-resource consistency failed:\n${result.criticalIssues.join('\n')}`,
);

// This is a regression alarm, not a product SLO. It catches accidental quadratic scans
// while leaving ample headroom for slower local machines.
assert(
  result.readMs + result.parseMs < 2_000,
  `Historical store read baseline exceeded 2000 ms: ${(result.readMs + result.parseMs).toFixed(2)} ms`,
);

console.log('PASS no critical historical consistency issues');
console.log('PASS local store read baseline is within 2000 ms');
