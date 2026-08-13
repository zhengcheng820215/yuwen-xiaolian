import { InMemoryLearningObservationOutboxRepository, InMemoryLearningObservationRepository, InMemoryQuestionCalibrationProjectionRepository } from '../repositories/inMemoryLearningCollectionRepositories.ts';
import { LearningObservationService } from '../services/learningObservationService.ts';
import { QuestionCalibrationProjectionService } from '../services/questionCalibrationProjectionService.ts';
import { LearningCollectionIntegrityService } from '../services/learningCollectionIntegrityService.ts';
import { HEALTHY_ROUND_ID, HEALTHY_STUDENT_ID, healthyCheckpoint, healthyEvents, healthyPersistence, healthyProjectionInput } from './learningMinimumCollectionHealthyFixture.ts';

const reports: Array<{ name: string; passed: boolean; detail: string }> = [];

async function main(): Promise<void> {
  const events = new InMemoryLearningObservationRepository();
  const outbox = new InMemoryLearningObservationOutboxRepository();
  const projections = new InMemoryQuestionCalibrationProjectionRepository();
  const observation = new LearningObservationService(events, outbox, () => '2026-08-13T13:05:00.000Z');
  const projection = new QuestionCalibrationProjectionService(projections);
  const integrity = new LearningCollectionIntegrityService();
  const statuses = await Promise.all(healthyEvents().map((event) => observation.record(event)));
  check('WP7-1 完整五事件全部落盘', statuses.every((status) => status === 'created'), statuses.join('|'));
  const projected = await projection.project(healthyProjectionInput());
  check('WP7-2 完成轮次形成 eligible Projection', projected.status === 'created' && projected.record.status === 'eligible', `${projected.status}/${projected.record.status}`);
  check('WP7-3 required Rubric 形成真实 itemScore', projected.record.itemScore === 0.75, String(projected.record.itemScore));
  check('WP7-4 匿名 Attempt 不含原文与学习链身份', Boolean(projected.anonymousAttempt) && !['studentId', 'responseId', 'answerText', 'operationId'].some((key) => key in projected.anonymousAttempt!), Object.keys(projected.anonymousAttempt || {}).join('|'));
  const report = integrity.buildReport({ studentId: HEALTHY_STUDENT_ID, generatedAt: '2026-08-13T13:06:00.000Z', checkpoints: [healthyCheckpoint()], persistenceRecords: [healthyPersistence()], events: await events.listAll(), projections: await projections.listAll(), questionPresentedRoundIds: [HEALTHY_ROUND_ID], feedbackPresentedRoundIds: [HEALTHY_ROUND_ID], claimedIndependentSampleCount: 1 });
  check('WP7-5 完整链最终报告 PASS', report.status === 'pass' && report.issues.length === 0, `${report.status}/${report.issues.length}`);
  check('WP7-6 事件与 Attempt 计数闭合', Object.values(report.eventCounts).every((count) => count === 1) && report.totals.eligibleCalibrationAttempts === 1, JSON.stringify(report.eventCounts));
  const refreshedEvents = healthyEvents().map((event) => ({ ...event, recordedAt: '2026-08-13T13:10:00.000Z' }));
  const refreshedStatuses = await Promise.all(refreshedEvents.map((event) => observation.record(event)));
  const refreshedProjection = await projection.project(healthyProjectionInput());
  check('WP7-7 刷新恢复全部幂等', refreshedStatuses.every((status) => status === 'unchanged') && refreshedProjection.status === 'unchanged', `${refreshedStatuses.join('|')}/${refreshedProjection.status}`);
  check('WP7-8 刷新后仍为五事件一 Projection', (await events.listAll()).length === 5 && (await projections.listAll()).length === 1, `events=${(await events.listAll()).length}/projections=${(await projections.listAll()).length}`);
  check('WP7-9 Outbox 无遗留', (await outbox.listDue('2099-01-01T00:00:00.000Z')).length === 0, 'due=0');
  const reportAfterRefresh = integrity.buildReport({ studentId: HEALTHY_STUDENT_ID, generatedAt: '2026-08-13T13:11:00.000Z', checkpoints: [healthyCheckpoint()], persistenceRecords: [healthyPersistence()], events: await events.listAll(), projections: await projections.listAll(), questionPresentedRoundIds: [HEALTHY_ROUND_ID], feedbackPresentedRoundIds: [HEALTHY_ROUND_ID], claimedIndependentSampleCount: 1 });
  check('WP7-10 刷新后完整性仍 PASS', reportAfterRefresh.status === 'pass', reportAfterRefresh.status);
  const invalidProjection = await projection.project({ ...healthyProjectionInput(), attemptId: 'wp7-invalid-attempt', responseId: 'wp7-invalid-response', responseValidityStatus: 'irrelevant', roundCompleted: false, completedAt: undefined, formalDiagnosisId: undefined, formalDiagnosisCommitted: false, rubricItems: undefined });
  check('WP7-11 无效输入只形成排除审计', invalidProjection.record.status === 'excluded_invalid_response' && !invalidProjection.anonymousAttempt, invalidProjection.record.status);
  check('WP7-12 无效输入不增加 eligible 样本', (await projections.listEligibleByResourceVersion('wp7-resource-version-1')).length === 1, 'eligible=1');

  console.log('\nReal Learning Minimum Collection WP7 Final Debug');
  console.log('='.repeat(78));
  reports.forEach((item) => { console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.name}`); console.log(`       ${item.detail}`); });
  const passed = reports.filter((item) => item.passed).length;
  console.log('-'.repeat(78));
  console.log(`Result: ${passed} / ${reports.length} PASS`);
  if (passed !== reports.length) throw new Error('WP7 Debug failed.');
}

function check(name: string, passed: boolean, detail: string): void { reports.push({ name, passed, detail }); }
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
