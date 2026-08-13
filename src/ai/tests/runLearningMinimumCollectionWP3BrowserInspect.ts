import {
  LEARNING_COLLECTION_DATABASE_NAME,
  LEARNING_OBSERVATION_EVENT_STORE,
  openLearningCollectionDatabase,
} from '../repositories/indexedDBLearningCollectionRepositories.ts';
import type { LearningObservationEvent } from '../schemas/learningObservationEvent.schema.ts';

const output = document.querySelector<HTMLElement>('#result');
if (!output) throw new Error('WP3 inspector output missing.');

void inspect().then((result) => {
  output.textContent = JSON.stringify(result, null, 2);
  output.dataset.status = result.duplicateEventIds.length === 0 ? 'pass' : 'fail';
}).catch((error) => {
  output.textContent = JSON.stringify({ status: 'FAIL', error: error instanceof Error ? error.message : String(error) }, null, 2);
  output.dataset.status = 'fail';
});

async function inspect() {
  const database = await openLearningCollectionDatabase(LEARNING_COLLECTION_DATABASE_NAME);
  const events = await new Promise<LearningObservationEvent[]>((resolve, reject) => {
    const request = database.transaction(LEARNING_OBSERVATION_EVENT_STORE, 'readonly')
      .objectStore(LEARNING_OBSERVATION_EVENT_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  const productEvents = events.filter((event) => event.runtimeScope === 'product' && event.studentId === 'student-local-primary-v1');
  const counts = Object.fromEntries([
    'question_presented', 'answer_submitted', 'diagnosis_completed', 'feedback_presented', 'learning_round_completed',
  ].map((type) => [type, productEvents.filter((event) => event.eventType === type).length]));
  const ids = productEvents.map((event) => event.eventId);
  return {
    status: 'PASS',
    total: productEvents.length,
    counts,
    eventIds: ids,
    duplicateEventIds: ids.filter((id, index) => ids.indexOf(id) !== index),
    rounds: [...new Set(productEvents.map((event) => event.learningRoundId))],
    resourceVersionIds: [...new Set(productEvents.map((event) => event.resourceVersionId))],
  };
}
