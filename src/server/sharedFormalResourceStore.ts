import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  SHARED_FORMAL_RESOURCE_SCHEMA_VERSION,
  cloneSharedFormalResourceValue,
  createEmptySharedFormalResourceData,
  type SharedFormalResourceData,
  type SharedFormalResourceSnapshot,
  type SharedFormalResourceStatus,
} from '../ai/schemas/sharedFormalResourcePersistence.schema.ts';

export type SharedFormalResourceStoreOptions = {
  storePath?: string;
  now?: () => string;
  failBeforeCommit?: () => boolean;
};

export class SharedFormalResourceConflictError extends Error {
  readonly code = 'shared_resource_revision_conflict';
  readonly expectedRevision: number;
  readonly actualRevision: number;

  constructor(expectedRevision: number, actualRevision: number) {
    super(`Shared resource revision conflict: expected ${expectedRevision}, actual ${actualRevision}.`);
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export class SharedFormalResourceStore {
  readonly storePath: string;
  readonly backupPath: string;
  private readonly now: () => string;
  private readonly failBeforeCommit: () => boolean;
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(options: SharedFormalResourceStoreOptions = {}) {
    this.storePath = resolve(
      options.storePath || process.env.FORMAL_RESOURCE_STORE_PATH || '.local-data/formal-resource-store.json',
    );
    this.backupPath = `${this.storePath}.bak`;
    this.now = options.now || (() => new Date().toISOString());
    this.failBeforeCommit = options.failBeforeCommit || (() => false);
  }

  async getStatus(): Promise<SharedFormalResourceStatus> {
    const snapshot = await this.read();
    return {
      initialized: snapshot.initialized,
      revision: snapshot.revision,
      baselineSource: snapshot.baselineSource,
      updatedAt: snapshot.updatedAt,
      storePath: this.storePath,
      backupAvailable: await fileExists(this.backupPath),
    };
  }

  async read(): Promise<SharedFormalResourceSnapshot> {
    try {
      const raw = await readFile(this.storePath, 'utf8');
      return validateSnapshot(JSON.parse(raw) as unknown);
    } catch (error) {
      if (isMissingFileError(error)) return createEmptySnapshot(this.now());
      throw error;
    }
  }

  async initialize(
    data: SharedFormalResourceData,
    baselineSource: string,
  ): Promise<SharedFormalResourceSnapshot> {
    return this.enqueueWrite(async () => {
      const current = await this.read();
      if (current.initialized) {
        throw new Error('Shared formal resource store is already initialized.');
      }
      const now = this.now();
      const next: SharedFormalResourceSnapshot = {
        schemaVersion: SHARED_FORMAL_RESOURCE_SCHEMA_VERSION,
        initialized: true,
        revision: 1,
        baselineSource: requireText(baselineSource, 'baselineSource'),
        createdAt: now,
        updatedAt: now,
        data: validateData(data),
      };
      await this.commit(next, true);
      await copyFile(this.storePath, this.backupPath);
      return cloneSharedFormalResourceValue(next);
    });
  }

  async replace(
    expectedRevision: number,
    data: SharedFormalResourceData,
  ): Promise<SharedFormalResourceSnapshot> {
    return this.enqueueWrite(async () => {
      const current = await this.read();
      if (!current.initialized) throw new Error('Shared formal resource store is not initialized.');
      if (current.revision !== expectedRevision) {
        throw new SharedFormalResourceConflictError(expectedRevision, current.revision);
      }
      const next: SharedFormalResourceSnapshot = {
        ...current,
        revision: current.revision + 1,
        updatedAt: this.now(),
        data: validateData(data),
      };
      await this.commit(next, false);
      return cloneSharedFormalResourceValue(next);
    });
  }

  async restoreBackup(): Promise<SharedFormalResourceSnapshot> {
    return this.enqueueWrite(async () => {
      const raw = await readFile(this.backupPath, 'utf8');
      const backup = validateSnapshot(JSON.parse(raw) as unknown);
      await this.commit(backup, true);
      return cloneSharedFormalResourceValue(backup);
    });
  }

  private enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(operation, operation);
    this.writeQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async commit(snapshot: SharedFormalResourceSnapshot, skipCurrentBackup: boolean): Promise<void> {
    await mkdir(dirname(this.storePath), { recursive: true });
    const temporaryPath = `${this.storePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

    if (!skipCurrentBackup && await fileExists(this.storePath)) {
      await copyFile(this.storePath, this.backupPath);
    }

    if (this.failBeforeCommit()) {
      await rm(temporaryPath, { force: true });
      throw new Error('Simulated shared resource commit failure.');
    }

    try {
      await rm(this.storePath, { force: true });
      await rename(temporaryPath, this.storePath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      if (!await fileExists(this.storePath) && await fileExists(this.backupPath)) {
        await copyFile(this.backupPath, this.storePath);
      }
      throw error;
    }
  }
}

function createEmptySnapshot(now: string): SharedFormalResourceSnapshot {
  return {
    schemaVersion: SHARED_FORMAL_RESOURCE_SCHEMA_VERSION,
    initialized: false,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    data: createEmptySharedFormalResourceData(),
  };
}

function validateSnapshot(value: unknown): SharedFormalResourceSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Shared resource snapshot must be an object.');
  const snapshot = value as SharedFormalResourceSnapshot;
  if (snapshot.schemaVersion !== SHARED_FORMAL_RESOURCE_SCHEMA_VERSION) {
    throw new Error(`Unsupported shared resource schema: ${String(snapshot.schemaVersion)}`);
  }
  if (!Number.isInteger(snapshot.revision) || snapshot.revision < 0) {
    throw new Error('Shared resource revision is invalid.');
  }
  requireText(snapshot.createdAt, 'createdAt');
  requireText(snapshot.updatedAt, 'updatedAt');
  return cloneSharedFormalResourceValue({
    ...snapshot,
    initialized: snapshot.initialized === true,
    data: validateData(snapshot.data),
  });
}

function validateData(value: SharedFormalResourceData): SharedFormalResourceData {
  if (!value?.questionResources || !value?.materialObservations) {
    throw new Error('Shared formal resource data is incomplete.');
  }
  const collections = [
    ...Object.values(value.questionResources),
    ...Object.values(value.materialObservations),
  ];
  if (collections.some((collection) => !Array.isArray(collection))) {
    throw new Error('Shared formal resource collections must be arrays.');
  }
  assertUniqueIdentity(value.questionResources.materials, 'materialVersionId');
  assertUniqueIdentity(value.questionResources.drafts, 'draftId');
  assertUniqueIdentity(value.questionResources.validations, 'validationId');
  assertUniqueIdentity(value.questionResources.reviews, 'reviewId');
  assertUniqueIdentity(value.questionResources.versions, 'resourceVersionId');
  assertUniqueIdentity(value.questionResources.registryEntries, 'resourceId');
  assertUniqueIdentity(value.materialObservations.structures, 'materialStructureSnapshotId');
  assertUniqueIdentity(value.materialObservations.anchors, 'sourceAnchorId');
  assertUniqueIdentity(value.materialObservations.plans, 'materialObservationPlanId');
  assertUniqueIdentity(value.materialObservations.validations, 'validationId');
  assertUniqueIdentity(value.materialObservations.reviews, 'reviewId');
  assertUniqueIdentity(value.materialObservations.links, 'resourceObservationLinkId');
  assertUniqueIdentity(value.materialObservations.manifests, 'resourcePackId');
  return cloneSharedFormalResourceValue(value);
}

function assertUniqueIdentity<T extends object>(values: T[], key: keyof T): void {
  const identities = new Map<unknown, string>();
  for (const value of values) {
    const id = value[key];
    const serialized = JSON.stringify(value);
    const previous = identities.get(id);
    if (previous && previous !== serialized) {
      throw new Error(`Shared resource identity conflict: ${String(id)}`);
    }
    identities.set(id, serialized);
  }
}

function requireText(value: string | undefined, field: string): string {
  if (!value?.trim()) throw new Error(`${field} is required.`);
  return value.trim();
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) return false;
    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}
