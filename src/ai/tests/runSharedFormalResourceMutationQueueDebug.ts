import assert from 'node:assert/strict';
import {
  LocalApiFormalResourceClient,
  LOCAL_FORMAL_RESOURCE_MUTATION_BACKOFF_MS,
} from '../repositories/localApiFormalResourceClient.ts';
import { createEmptySharedFormalResourceData } from '../schemas/sharedFormalResourcePersistence.schema.ts';

type ServiceMode = 'normal' | 'conflict_once' | 'conflict_seven' | 'conflict_always' | 'server_error';

function createService(mode: ServiceMode) {
  let revision = 1;
  let data = createEmptySharedFormalResourceData();
  let activeRequests = 0;
  let maxActiveRequests = 0;
  let gets = 0;
  let posts = 0;
  const sequence: string[] = [];

  const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
    activeRequests += 1;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    try {
      await Promise.resolve();
      if ((init?.method || 'GET') === 'GET') {
        gets += 1;
        sequence.push(`GET:r${revision}`);
        return response(200, envelope(revision, data));
      }
      posts += 1;
      const body = JSON.parse(String(init?.body || '{}'));
      sequence.push(`POST:r${body.expectedRevision}`);
      if (mode === 'server_error') return response(500, { error: 'server failed' });
      if (
        mode === 'conflict_always'
        || (mode === 'conflict_once' && posts === 1)
        || (mode === 'conflict_seven' && posts <= 7)
      ) {
        const expectedRevision = body.expectedRevision;
        revision += 1;
        if (mode === 'conflict_once') {
          data.questionResources.materials.push({ materialVersionId: 'external-write' } as never);
        }
        return response(409, {
          code: 'SHARED_RESOURCE_REVISION_CONFLICT',
          expectedRevision,
          actualRevision: revision,
        });
      }
      assert.equal(body.expectedRevision, revision);
      data = body.data;
      revision += 1;
      return response(200, envelope(revision, data));
    } finally {
      activeRequests -= 1;
    }
  }) as typeof fetch;

  return {
    fetcher,
    inspect: () => ({ revision, data, gets, posts, sequence, maxActiveRequests }),
  };
}

async function main() {
  await caseSharedFifoQueue();
  await caseConflictReloadsAndReapplies();
  await caseSevenConflictsThenSuccess();
  await caseEightAttemptExhaustion();
  await caseTimeBoundExhaustion();
  await caseNonConflictFailsImmediately();
  await caseQueueFailureDoesNotBlockNextMutation();
  console.log('Shared formal resource mutation queue debug: 10/10 passed');
}

async function caseSharedFifoQueue() {
  const service = createService('normal');
  const clientA = new LocalApiFormalResourceClient('/wp-c1-fifo', service.fetcher);
  const clientB = new LocalApiFormalResourceClient('/wp-c1-fifo', service.fetcher);
  await Promise.all([
    clientA.mutate((data) => data.questionResources.materials.push({ materialVersionId: 'a' } as never)),
    clientB.mutate((data) => data.questionResources.materials.push({ materialVersionId: 'b' } as never)),
  ]);
  const state = service.inspect();
  assert.deepEqual(state.sequence, ['GET:r1', 'POST:r1', 'GET:r2', 'POST:r2']);
  assert.deepEqual(state.data.questionResources.materials.map((item) => item.materialVersionId), ['a', 'b']);
}

async function caseConflictReloadsAndReapplies() {
  const service = createService('conflict_once');
  let mutationCalls = 0;
  const delays: number[] = [];
  const client = new LocalApiFormalResourceClient('/wp-c1-reload', service.fetcher, 3_000, {
    random: () => 0,
    sleep: async (milliseconds) => { delays.push(milliseconds); },
  });
  await client.mutate((data) => {
    mutationCalls += 1;
    data.questionResources.materials.push({ materialVersionId: 'local-write' } as never);
  });
  const state = service.inspect();
  assert.equal(mutationCalls, 2);
  assert.equal(state.gets, 2);
  assert.deepEqual(delays, [100]);
  assert.deepEqual(state.data.questionResources.materials.map((item) => item.materialVersionId), [
    'external-write',
    'local-write',
  ]);
}

async function caseEightAttemptExhaustion() {
  const service = createService('conflict_always');
  const delays: number[] = [];
  const client = new LocalApiFormalResourceClient('/wp-c1-attempts', service.fetcher, 3_000, {
    random: () => 0,
    sleep: async (milliseconds) => { delays.push(milliseconds); },
  });
  await assert.rejects(client.mutate((data) => {
    data.questionResources.materials.push({ materialVersionId: 'exhausted' } as never);
  }), (error: any) => (
    error.code === 'SHARED_STORE_REVISION_CONFLICT' && error.recoverability === 'retry_safe'
  ));
  assert.equal(service.inspect().posts, 8);
  assert.deepEqual(delays, [...LOCAL_FORMAL_RESOURCE_MUTATION_BACKOFF_MS]);
}

async function caseSevenConflictsThenSuccess() {
  const service = createService('conflict_seven');
  let mutationCalls = 0;
  const delays: number[] = [];
  const client = new LocalApiFormalResourceClient('/wp-c1-seven-conflicts', service.fetcher, 3_000, {
    random: () => 0,
    sleep: async (milliseconds) => { delays.push(milliseconds); },
  });
  await client.mutate((data) => {
    mutationCalls += 1;
    data.questionResources.materials.push({ materialVersionId: 'after-seven-conflicts' } as never);
  });
  assert.equal(service.inspect().posts, 8);
  assert.equal(service.inspect().gets, 8);
  assert.equal(mutationCalls, 8);
  assert.deepEqual(delays, [...LOCAL_FORMAL_RESOURCE_MUTATION_BACKOFF_MS]);
  assert.deepEqual(
    service.inspect().data.questionResources.materials.map((item) => item.materialVersionId),
    ['after-seven-conflicts'],
  );
}

async function caseTimeBoundExhaustion() {
  const service = createService('conflict_always');
  let now = 0;
  const client = new LocalApiFormalResourceClient('/wp-c1-timeout', service.fetcher, 3_000, {
    mutationTimeoutMs: 250,
    random: () => 0,
    now: () => now,
    sleep: async (milliseconds) => { now += milliseconds; },
  });
  await assert.rejects(client.mutate((data) => {
    data.questionResources.materials.push({ materialVersionId: 'time-bound' } as never);
  }), (error: any) => error.code === 'SHARED_STORE_REVISION_CONFLICT');
  assert.equal(now, 250);
  assert.equal(service.inspect().posts, 2);
}

async function caseNonConflictFailsImmediately() {
  const service = createService('server_error');
  const client = new LocalApiFormalResourceClient('/wp-c1-no-retry', service.fetcher, 3_000, {
    sleep: async () => { throw new Error('must not retry'); },
  });
  await assert.rejects(client.mutate((data) => {
    data.questionResources.materials.push({ materialVersionId: 'server-error' } as never);
  }), /server failed/);
  assert.equal(service.inspect().posts, 1);
}

async function caseQueueFailureDoesNotBlockNextMutation() {
  const service = createService('normal');
  const client = new LocalApiFormalResourceClient('/wp-c1-failure-release', service.fetcher);
  const failed = client.mutate(() => { throw new Error('domain failure'); });
  const succeeded = client.mutate((data) => {
    data.questionResources.materials.push({ materialVersionId: 'after-failure' } as never);
    return 'continued';
  });
  await assert.rejects(failed, /domain failure/);
  assert.equal(await succeeded, 'continued');
  assert.deepEqual(
    service.inspect().data.questionResources.materials.map((item) => item.materialVersionId),
    ['after-failure'],
  );
}

function envelope(revision: number, data: ReturnType<typeof createEmptySharedFormalResourceData>) {
  return {
    snapshot: { schemaVersion: '1.0', revision, updatedAt: '2026-08-13T00:00:00.000Z', data },
    status: { initialized: true, revision },
  };
}

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
