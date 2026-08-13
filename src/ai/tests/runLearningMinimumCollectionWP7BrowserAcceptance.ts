import { IndexedDBLearningObservationOutboxRepository, IndexedDBLearningObservationRepository, IndexedDBQuestionCalibrationProjectionRepository } from '../repositories/indexedDBLearningCollectionRepositories.ts';
import { LearningObservationService } from '../services/learningObservationService.ts';
import { QuestionCalibrationProjectionService } from '../services/questionCalibrationProjectionService.ts';
import { LearningCollectionIntegrityService } from '../services/learningCollectionIntegrityService.ts';
import { HEALTHY_ANSWER, HEALTHY_ROUND_ID, HEALTHY_STUDENT_ID, healthyCheckpoint, healthyEvents, healthyPersistence, healthyProjectionInput } from './learningMinimumCollectionHealthyFixture.ts';

const button = document.querySelector<HTMLButtonElement>('#run');
const output = document.querySelector<HTMLElement>('#result');
if (!button || !output) throw new Error('WP7 controls missing.');

button.addEventListener('click', () => {
  button.disabled = true;
  void run().then((result) => { output.textContent = JSON.stringify(result, null, 2); output.dataset.status = result.status.toLowerCase(); })
    .catch((error) => { output.textContent = JSON.stringify({ status: 'FAIL', error: error instanceof Error ? error.message : String(error) }, null, 2); output.dataset.status = 'fail'; })
    .finally(() => { button.disabled = false; });
});

async function run() {
  const databaseName = `wp7_final_acceptance_${Date.now()}`;
  const events = new IndexedDBLearningObservationRepository(databaseName);
  const outbox = new IndexedDBLearningObservationOutboxRepository(databaseName);
  const projections = new IndexedDBQuestionCalibrationProjectionRepository(databaseName);
  const observation = new LearningObservationService(events, outbox, () => '2026-08-13T13:05:00.000Z');
  const projection = new QuestionCalibrationProjectionService(projections);
  const checks: string[] = [];
  try {
    const writes = await Promise.all(healthyEvents().map((event) => observation.record(event)));
    check(writes.every((status) => status === 'created'), 'five_events_created', checks);
    const projected = await projection.project(healthyProjectionInput());
    check(projected.record.status === 'eligible' && projected.record.itemScore === 0.75, 'eligible_projection_0_75', checks);
    const report = new LearningCollectionIntegrityService().buildReport({ studentId: HEALTHY_STUDENT_ID, generatedAt: '2026-08-13T13:06:00.000Z', checkpoints: [healthyCheckpoint()], persistenceRecords: [healthyPersistence()], events: await events.listAll(), projections: await projections.listAll(), questionPresentedRoundIds: [HEALTHY_ROUND_ID], feedbackPresentedRoundIds: [HEALTHY_ROUND_ID], claimedIndependentSampleCount: 1 });
    check(report.status === 'pass' && report.issues.length === 0, 'integrity_pass', checks);
    const refreshed = await Promise.all(healthyEvents().map((event) => observation.record({ ...event, recordedAt: '2026-08-13T13:10:00.000Z' })));
    check(refreshed.every((status) => status === 'unchanged') && (await projection.project(healthyProjectionInput())).status === 'unchanged', 'refresh_idempotent', checks);
    check((await events.listAll()).length === 5 && (await projections.listAll()).length === 1, 'five_events_one_projection', checks);
    check((await outbox.listDue('2099-01-01T00:00:00.000Z')).length === 0, 'outbox_empty', checks);
    check(!document.body.innerText.includes('student-local-primary-v1') && !document.body.innerText.includes(HEALTHY_ANSWER), 'technical_identity_and_answer_hidden', checks);
    return { status: 'PASS', passed: checks.length, total: 7, counts: { events: 5, projections: 1, eligible: 1 }, integrity: 'pass', checks };
  } finally { await deleteDatabase(databaseName); }
}

function deleteDatabase(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => { const request = indexedDB.deleteDatabase(databaseName); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error('WP7 isolated database cleanup blocked.')); });
}
function check(condition: boolean, name: string, checks: string[]) { if (!condition) throw new Error(name); checks.push(name); }
