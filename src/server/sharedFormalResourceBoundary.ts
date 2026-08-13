import type { Connect } from 'vite';
import type { SharedFormalResourceData } from '../ai/schemas/sharedFormalResourcePersistence.schema.ts';
import {
  SharedFormalResourceConflictError,
  SharedFormalResourceStore,
  type SharedFormalResourceAtomicCommand,
} from './sharedFormalResourceStore.ts';

const MAX_BODY_BYTES = 20 * 1024 * 1024;
export const SHARED_FORMAL_RESOURCE_CAPABILITIES = {
  atomicCollectionPatch: '1.0',
  atomicCommands: [
    'save-plan',
    'save-draft',
    'save-validation',
    'save-quality-bundle',
    'record-review',
    'commit-publication',
    'recover-publication',
  ],
} as const;

export function createSharedFormalResourceBoundary(
  store = new SharedFormalResourceStore(),
): Connect.NextHandleFunction {
  return async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');

    try {
      if (request.method === 'GET') {
        const snapshot = await store.read();
        const status = await store.getStatus();
        response.statusCode = 200;
        response.end(JSON.stringify({ snapshot, status, capabilities: SHARED_FORMAL_RESOURCE_CAPABILITIES }));
        return;
      }

      if (request.method !== 'POST') {
        response.statusCode = 405;
        response.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }

      const body = await readJsonBody(request);
      if (body.action === 'initialize') {
        const snapshot = await store.initialize(
          body.data as SharedFormalResourceData,
          String(body.baselineSource || ''),
        );
        response.statusCode = 201;
        response.end(JSON.stringify({ snapshot, status: await store.getStatus() }));
        return;
      }

      if (body.action === 'replace') {
        const snapshot = await store.replace(
          Number(body.expectedRevision),
          body.data as SharedFormalResourceData,
        );
        response.statusCode = 200;
        response.end(JSON.stringify({ snapshot, status: await store.getStatus() }));
        return;
      }

      if (body.action === 'command') {
        const snapshot = await store.applyCommand(
          Number(body.expectedRevision),
          body.command as SharedFormalResourceAtomicCommand,
        );
        response.statusCode = 200;
        response.end(JSON.stringify({
          snapshot,
          status: await store.getStatus(),
          capabilities: SHARED_FORMAL_RESOURCE_CAPABILITIES,
          commandReceipt: {
            commandId: (body.command as SharedFormalResourceAtomicCommand).commandId,
            commandType: (body.command as SharedFormalResourceAtomicCommand).commandType,
            committedRevision: snapshot.revision,
          },
        }));
        return;
      }

      if (body.action === 'restore_backup') {
        const snapshot = await store.restoreBackup();
        response.statusCode = 200;
        response.end(JSON.stringify({ snapshot, status: await store.getStatus() }));
        return;
      }

      response.statusCode = 400;
      response.end(JSON.stringify({ error: 'Unsupported shared resource action.' }));
    } catch (error) {
      if (error instanceof SharedFormalResourceConflictError) {
        response.statusCode = 409;
        response.end(JSON.stringify({
          error: error.message,
          code: error.code,
          expectedRevision: error.expectedRevision,
          actualRevision: error.actualRevision,
        }));
        return;
      }
      response.statusCode = 400;
      response.end(JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        code: 'shared_resource_operation_failed',
      }));
    }
  };
}

function readJsonBody(request: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let receivedBytes = 0;
    request.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buffer);
      receivedBytes += buffer.byteLength;
      if (receivedBytes > MAX_BODY_BYTES) {
        reject(new Error('Shared resource request is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) as Record<string, unknown> : {});
      } catch {
        reject(new Error('Shared resource request must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}
