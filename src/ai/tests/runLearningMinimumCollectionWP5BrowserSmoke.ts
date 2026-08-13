import { IndexedDBQuestionCalibrationProjectionRepository } from '../repositories/indexedDBLearningCollectionRepositories.ts';
import { QuestionCalibrationProjectionService } from '../services/questionCalibrationProjectionService.ts';
import type { QuestionCalibrationProjectionInput } from '../services/questionCalibrationProjectionService.ts';

const button = document.querySelector<HTMLButtonElement>('#run');
const output = document.querySelector<HTMLElement>('#result');
if (!button || !output) throw new Error('WP5 smoke controls missing.');

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
  const databaseName = `wp5_learning_collection_smoke_${Date.now()}`;
  const repository = new IndexedDBQuestionCalibrationProjectionRepository(databaseName);
  const service = new QuestionCalibrationProjectionService(repository);
  const checks: string[] = [];
  try {
    const excluded = await service.project(input({ roundCompleted: false, completedAt: undefined }));
    check(excluded.status === 'created' && excluded.record.status === 'excluded_incomplete_round', 'excluded_projection_created', checks);
    const eligible = await service.project(input());
    check(eligible.status === 'updated' && eligible.record.status === 'eligible', 'projection_upgraded_to_eligible', checks);
    check(eligible.record.itemScore === 0.75, 'required_rubric_score_0_75', checks);
    check(eligible.record.totalScore === undefined && eligible.record.totalScoreStatus === 'unavailable_single_round', 'single_round_total_unavailable', checks);
    check(Boolean(eligible.anonymousAttempt) && !('studentId' in eligible.anonymousAttempt!), 'anonymous_attempt_exported', checks);
    const repeated = await service.project(input());
    check(repeated.status === 'unchanged' && (await repository.listEligibleByResourceVersion('resource-version-wp5')).length === 1, 'repeat_projection_idempotent', checks);
    return { status: 'PASS', passed: checks.length, total: 6, checks };
  } finally {
    await deleteDatabase(databaseName);
  }
}

function input(overrides: Partial<QuestionCalibrationProjectionInput> = {}): QuestionCalibrationProjectionInput {
  return {
    attemptId: 'attempt-wp5-browser', runtimeScope: 'product', studentId: 'student-local-primary-v1',
    operationId: 'operation-wp5-browser', learningSessionId: 'session-wp5-browser', learningRoundId: 'round-wp5-browser',
    responseId: 'response-wp5-browser', responseValidityStatus: 'valid', roundCompleted: true,
    completedAt: '2026-08-13T12:00:00.000Z', formalDiagnosisId: 'diagnosis-wp5-browser', formalDiagnosisCommitted: true,
    rubricItems: [
      { id: 'r1', label: '一', ability: 'analysis', required: true, matched: true },
      { id: 'r2', label: '二', ability: 'analysis', required: true, matched: true },
      { id: 'r3', label: '三', ability: 'analysis', required: true, matched: true },
      { id: 'r4', label: '四', ability: 'analysis', required: true, matched: false },
    ],
    resourceVersionId: 'resource-version-wp5', projectedAt: '2026-08-13T12:00:00.000Z', ...overrides,
  };
}

function deleteDatabase(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Isolated WP5 smoke database cleanup blocked.'));
  });
}

function check(condition: boolean, name: string, checks: string[]): void {
  if (!condition) throw new Error(name);
  checks.push(name);
}
