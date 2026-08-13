import {
  IndexedDBLearningObservationOutboxRepository,
  IndexedDBLearningObservationRepository,
} from '../repositories/indexedDBLearningCollectionRepositories.ts';
import { LearningObservationService } from '../services/learningObservationService.ts';
import type { LearningObservationEvent } from '../schemas/learningObservationEvent.schema.ts';
import type { LearningObservationOutboxEntry } from '../schemas/learningObservationOutbox.schema.ts';

const button = document.querySelector<HTMLButtonElement>('#run');
const output = document.querySelector<HTMLElement>('#result');
if (!button || !output) throw new Error('WP4 smoke controls missing.');

button.addEventListener('click', () => {
  button.disabled = true;
  void run().then((result) => {
    output.textContent = JSON.stringify(result, null, 2);
    output.dataset.status = result.status.toLowerCase();
  }).catch((error) => {
    output.textContent = JSON.stringify({ status: 'FAIL', error: error instanceof Error ? error.message : String(error) }, null, 2);
    output.dataset.status = 'fail';
  }).finally(() => { button.disabled = false; });
});

async function run() {
  const databaseName = `wp4_learning_collection_smoke_${Date.now()}`;
  const events = new IndexedDBLearningObservationRepository(databaseName);
  const outbox = new IndexedDBLearningObservationOutboxRepository(databaseName);
  const service = new LearningObservationService(events, outbox, () => '2026-08-13T12:00:00.000Z');
  const source = event();
  const entry = outboxEntry(source);
  const checks: string[] = [];
  try {
    check((await outbox.save(entry)).status === 'created', 'outbox_seeded', checks);
    const recovered = await service.retryDue('2026-08-13T12:00:00.000Z');
    check(recovered.processed === 1 && recovered.succeeded === 1, 'due_retry_succeeded', checks);
    check((await events.getById(source.eventId))?.occurredAt === source.occurredAt, 'original_occurred_at_preserved', checks);
    check(!(await outbox.getById(entry.outboxId)), 'outbox_deleted_after_success', checks);
    check((await service.retryDue('2026-08-13T12:01:00.000Z')).processed === 0, 'repeat_retry_noop', checks);
    check((await events.listByRound(source.studentId, source.learningRoundId)).length === 1, 'single_event_after_repeat', checks);
    return { status: 'PASS', passed: checks.length, total: 6, checks };
  } finally {
    await deleteDatabase(databaseName);
  }
}

function event(): LearningObservationEvent {
  return {
    schemaVersion: 'learning_observation_event_v1', eventId: 'event-wp4-browser-1', eventType: 'answer_submitted',
    occurredAt: '2026-08-13T11:59:00.000Z', recordedAt: '2026-08-13T12:00:00.000Z', runtimeScope: 'product',
    studentId: 'student-local-primary-v1', operationId: 'operation-wp4-browser-1', learningSessionId: 'session-wp4-browser-1',
    learningRoundId: 'round-wp4-browser-1', materialVersionId: 'material-wp4-browser-1', resourceId: 'resource-wp4-browser-1',
    resourceVersionId: 'resource-version-wp4-browser-1', taskId: 'task-wp4-browser-1', sourceEntityId: 'submission-wp4-browser-1',
    appVersion: 'wp4-browser-smoke', payload: { kind: 'answer_submitted', responseId: 'response-wp4-browser-1', attemptId: 'attempt-wp4-browser-1', submittedAt: '2026-08-13T11:59:00.000Z' },
  };
}

function outboxEntry(source: LearningObservationEvent): LearningObservationOutboxEntry {
  return {
    schemaVersion: 'learning_observation_outbox_v1', outboxId: 'outbox-wp4-browser-1', eventId: source.eventId,
    learningRoundId: source.learningRoundId, eventType: source.eventType, event: source, status: 'pending', retryCount: 0,
    lastError: 'simulated_initial_write_failure', nextRetryAt: '2026-08-13T12:00:00.000Z',
    createdAt: '2026-08-13T12:00:00.000Z', updatedAt: '2026-08-13T12:00:00.000Z',
  };
}

function deleteDatabase(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Isolated WP4 smoke database cleanup blocked.'));
  });
}

function check(condition: boolean, name: string, checks: string[]): void {
  if (!condition) throw new Error(name);
  checks.push(name);
}
