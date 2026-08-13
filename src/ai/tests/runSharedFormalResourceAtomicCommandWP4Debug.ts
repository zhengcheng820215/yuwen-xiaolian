import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalApiFormalResourceClient } from '../repositories/localApiFormalResourceClient.ts';
import { createEmptySharedFormalResourceData } from '../schemas/sharedFormalResourcePersistence.schema.ts';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import { SHARED_FORMAL_RESOURCE_CAPABILITIES } from '../../server/sharedFormalResourceBoundary.ts';

async function main() {
  assert.deepEqual(SHARED_FORMAL_RESOURCE_CAPABILITIES.atomicCommands, [
    'save-plan',
    'save-draft',
    'save-validation',
    'save-quality-bundle',
    'record-review',
    'commit-publication',
    'recover-publication',
  ]);
  await caseStoreAtomicCommandAndIdempotency();
  await caseInvalidPatchRollsBack();
  await caseClientUsesAdvertisedCommand();
  await caseAdvertisedCommandFailureDoesNotFallback();
  await caseLegacyCapabilityFallback();
  console.log('Shared formal resource atomic command WP-C4 debug: 12/12 passed');
}

async function caseStoreAtomicCommandAndIdempotency() {
  await withStore(async (store) => {
    await store.initialize(createEmptySharedFormalResourceData(), 'wp-c4');
    const material = { materialVersionId: 'atomic-material' } as never;
    const command = {
      commandType: 'apply_collection_patch' as const,
      commandId: 'wp-c4:atomic:1',
      patches: [{
        scope: 'questionResources' as const,
        collection: 'materials',
        values: [material],
      }],
    };
    const committed = await store.applyCommand(1, command);
    assert.equal(committed.revision, 2);
    assert.equal(committed.data.questionResources.materials[0]?.materialVersionId, 'atomic-material');
    const repeated = await store.applyCommand(1, command);
    assert.equal(repeated.revision, 2, 'same command must not increment Revision twice');
    const restartedStore = new SharedFormalResourceStore({ storePath: store.storePath });
    const afterRestart = await restartedStore.applyCommand(1, command);
    assert.equal(afterRestart.revision, 2, 'command receipt must survive service restart');
    await assert.rejects(
      store.applyCommand(2, { ...command, patches: [{ ...command.patches[0], values: [] }] }),
      /command identity conflict/,
    );
  });
}

async function caseInvalidPatchRollsBack() {
  await withStore(async (store) => {
    await store.initialize(createEmptySharedFormalResourceData(), 'wp-c4-rollback');
    await assert.rejects(store.applyCommand(1, {
      commandType: 'apply_collection_patch',
      commandId: 'wp-c4:invalid',
      patches: [{ scope: 'questionResources', collection: 'unknown', values: [] }],
    }), /Unsupported shared resource collection/);
    const after = await store.read();
    assert.equal(after.revision, 1);
    assert.equal(after.data.questionResources.materials.length, 0);
  });
}

async function caseClientUsesAdvertisedCommand() {
  const actions: string[] = [];
  const fetcher = createFetcher({ capabilities: true, actions });
  const client = new LocalApiFormalResourceClient('/wp-c4-command', fetcher);
  await client.mutate((data) => {
    data.questionResources.materials.push({ materialVersionId: 'command-path' } as never);
  });
  assert.deepEqual(actions, ['GET', 'command']);
}

async function caseAdvertisedCommandFailureDoesNotFallback() {
  const actions: string[] = [];
  const fetcher = createFetcher({ capabilities: true, actions, failCommand: true });
  const client = new LocalApiFormalResourceClient('/wp-c4-no-silent-fallback', fetcher);
  await assert.rejects(client.mutate((data) => {
    data.questionResources.materials.push({ materialVersionId: 'must-fail' } as never);
  }), /atomic command failed/);
  assert.deepEqual(actions, ['GET', 'command']);
}

async function caseLegacyCapabilityFallback() {
  const actions: string[] = [];
  const fetcher = createFetcher({ capabilities: false, actions });
  const client = new LocalApiFormalResourceClient('/wp-c4-legacy', fetcher);
  await client.mutate((data) => {
    data.questionResources.materials.push({ materialVersionId: 'legacy-path' } as never);
  });
  assert.deepEqual(actions, ['GET', 'replace']);
}

function createFetcher(input: { capabilities: boolean; actions: string[]; failCommand?: boolean }): typeof fetch {
  let revision = 1;
  let data = createEmptySharedFormalResourceData();
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    if ((init?.method || 'GET') === 'GET') {
      input.actions.push('GET');
      return response(200, envelope(revision, data, input.capabilities));
    }
    const body = JSON.parse(String(init?.body || '{}'));
    input.actions.push(body.action);
    if (body.action === 'command' && input.failCommand) {
      return response(400, { error: 'atomic command failed' });
    }
    if (body.action === 'command') {
      for (const patch of body.command.patches) {
        (data as any)[patch.scope][patch.collection] = patch.values;
      }
    } else {
      data = body.data;
    }
    revision += 1;
    return response(200, {
      ...envelope(revision, data, input.capabilities),
      ...(body.action === 'command' ? {
        commandReceipt: {
          commandId: body.command.commandId,
          commandType: body.command.commandType,
          committedRevision: revision,
        },
      } : {}),
    });
  }) as typeof fetch;
}

function envelope(revision: number, data: ReturnType<typeof createEmptySharedFormalResourceData>, capabilities: boolean) {
  return {
    snapshot: { schemaVersion: '1.0', initialized: true, revision, createdAt: '2026-08-13T00:00:00.000Z', updatedAt: '2026-08-13T00:00:00.000Z', data },
    status: { initialized: true, revision },
    ...(capabilities ? { capabilities: { atomicCollectionPatch: '1.0' } } : {}),
  };
}

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function withStore(action: (store: SharedFormalResourceStore) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'wp-c4-'));
  try {
    await action(new SharedFormalResourceStore({ storePath: join(directory, 'store.json') }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
