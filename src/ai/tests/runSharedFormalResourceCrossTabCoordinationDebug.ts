import assert from 'node:assert/strict';
import {
  FORMAL_RESOURCE_EVENT_CHANNEL_NAME,
  FORMAL_RESOURCE_WRITE_LOCK_NAME,
  LocalApiFormalResourceClient,
  subscribeFormalResourceRevisionUpdates,
  subscribeFormalResourceWriteRuntime,
} from '../repositories/localApiFormalResourceClient.ts';
import { createEmptySharedFormalResourceData } from '../schemas/sharedFormalResourcePersistence.schema.ts';

class FakeLockManager {
  private tail = Promise.resolve();
  active = 0;
  maxActive = 0;
  calls: Array<{ name: string; mode: string; signal: AbortSignal | undefined }> = [];

  request<T>(name: string, options: { mode: 'exclusive'; signal?: AbortSignal }, callback: () => Promise<T>) {
    this.calls.push({ name, mode: options.mode, signal: options.signal });
    const execution = this.tail.then(async () => {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      this.active += 1;
      this.maxActive = Math.max(this.maxActive, this.active);
      try { return await callback(); } finally { this.active -= 1; }
    });
    this.tail = execution.then(() => undefined, () => undefined);
    return execution;
  }
}

class FakeBroadcastHub {
  channels: FakeChannel[] = [];
  create = () => {
    const channel = new FakeChannel(this);
    this.channels.push(channel);
    return channel;
  };
}

class FakeChannel {
  listeners = new Set<(event: MessageEvent) => void>();
  messages: unknown[] = [];
  private hub: FakeBroadcastHub;
  constructor(hub: FakeBroadcastHub) { this.hub = hub; }
  postMessage(message: unknown) {
    this.messages.push(message);
    this.hub.channels.filter((channel) => channel !== this).forEach((channel) => {
      channel.listeners.forEach((listener) => listener({ data: message } as MessageEvent));
    });
  }
  addEventListener(_type: 'message', listener: (event: MessageEvent) => void) { this.listeners.add(listener); }
  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void) { this.listeners.delete(listener); }
  close() { this.listeners.clear(); }
}

function createService() {
  let revision = 1;
  let data = createEmptySharedFormalResourceData();
  let gets = 0;
  const baseFetcher = async (_url: string | URL | Request, init?: RequestInit) => {
    if ((init?.method || 'GET') === 'GET') {
      gets += 1;
      return response(200, envelope(revision, data));
    }
    const body = JSON.parse(String(init?.body || '{}'));
    if (body.expectedRevision !== revision) {
      return response(409, {
        code: 'SHARED_RESOURCE_REVISION_CONFLICT',
        expectedRevision: body.expectedRevision,
        actualRevision: revision,
      });
    }
    data = body.data;
    revision += 1;
    return response(200, envelope(revision, data));
  };
  return {
    fetcherA: ((url, init) => baseFetcher(url, init)) as typeof fetch,
    fetcherB: ((url, init) => baseFetcher(url, init)) as typeof fetch,
    inspect: () => ({ revision, data, gets }),
  };
}

async function main() {
  const lockManager = new FakeLockManager();
  const hub = new FakeBroadcastHub();
  const service = createService();
  const options = {
    lockManager,
    broadcastChannelFactory: hub.create,
    random: () => 0,
    sleep: async () => undefined,
  };
  const clientA = new LocalApiFormalResourceClient('/wp-c2', service.fetcherA, 3_000, options);
  const clientB = new LocalApiFormalResourceClient('/wp-c2', service.fetcherB, 3_000, options);
  const runtimeStates: string[] = [];
  const unsubscribeRuntime = subscribeFormalResourceWriteRuntime((event) => runtimeStates.push(event.state));

  await Promise.all([
    clientA.mutate((data) => data.questionResources.materials.push({ materialVersionId: 'tab-a' } as never)),
    clientB.mutate((data) => data.questionResources.materials.push({ materialVersionId: 'tab-b' } as never)),
  ]);
  assert.equal(lockManager.maxActive, 1);
  assert(lockManager.calls.every((call) => call.name === FORMAL_RESOURCE_WRITE_LOCK_NAME));
  assert(lockManager.calls.every((call) => call.mode === 'exclusive'));
  assert.deepEqual(service.inspect().data.questionResources.materials.map((item) => item.materialVersionId), [
    'tab-a',
    'tab-b',
  ]);
  assert(runtimeStates.includes('lock_waiting'));
  assert(runtimeStates.includes('executing'));

  await clientB.read();
  const readsBeforeBroadcast = service.inspect().gets;
  const received: number[] = [];
  const unsubscribe = subscribeFormalResourceRevisionUpdates((event) => received.push(event.revision));
  await clientA.mutate((data) => data.questionResources.materials.push({ materialVersionId: 'tab-a-2' } as never));
  const afterBroadcast = await clientB.read();
  unsubscribe();
  assert(service.inspect().gets > readsBeforeBroadcast, 'remote revision must invalidate the cached read');
  assert(afterBroadcast.snapshot.data.questionResources.materials.some((item) => item.materialVersionId === 'tab-a-2'));
  assert(received.includes(afterBroadcast.snapshot.revision));

  const broadcast = hub.channels.flatMap((channel) => channel.messages).at(-1) as any;
  assert.deepEqual(Object.keys(broadcast).sort(), ['occurredAt', 'revision', 'type']);
  assert.equal(broadcast.type, 'formal_resource_revision_updated');
  assert(Number.isFinite(Date.parse(broadcast.occurredAt)));
  assert.equal(FORMAL_RESOURCE_EVENT_CHANNEL_NAME, 'formal-resource-store-events');

  const fallbackService = createService();
  const fallback = new LocalApiFormalResourceClient('/wp-c2-fallback', fallbackService.fetcherA, 3_000, {
    lockManager: null,
    broadcastChannelFactory: null,
  });
  await fallback.mutate((data) => data.questionResources.materials.push({ materialVersionId: 'fallback' } as never));
  assert.equal(fallbackService.inspect().revision, 2);
  unsubscribeRuntime();

  console.log('Shared formal resource cross-tab coordination debug: 12/12 passed');
}

function envelope(revision: number, data: ReturnType<typeof createEmptySharedFormalResourceData>) {
  return {
    snapshot: { schemaVersion: '1.0', revision, updatedAt: '2026-08-13T00:00:00.000Z', data },
    status: { initialized: true, revision },
  };
}

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
