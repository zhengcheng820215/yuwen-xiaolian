import { isGrowthMemoryRecord } from '../schemas/growthMemory.schema.ts';
import { buildGrowthMemoryRecordFixture } from './growthMemoryDebugFixtures.ts';

function runPhase821GrowthMemoryRecordDebug(): void {
  const failures: string[] = [];
  const record = buildGrowthMemoryRecordFixture('update_status');

  console.log('\nPhase 8.2.1 Growth Memory Record Debug');
  console.log('======================================');
  console.log(`recordId: ${record.recordId}`);
  console.log(`action: ${record.action}`);
  console.log(`evaluationResultId: ${record.evaluationResultId}`);
  console.log(`profileUpdateDecisionId: ${record.profileUpdateDecisionId}`);
  console.log(`before status: ${record.beforeProfileSummary.abilityStatus}`);
  console.log(`after status: ${record.afterProfileSummary.abilityStatus}`);
  console.log(`relatedSessionId: ${record.relatedSessionId}`);

  if (!isGrowthMemoryRecord(record)) failures.push('GrowthMemoryRecord should match schema.');
  if (!record.evaluationResultId) failures.push('Record should keep evaluationResultId.');
  if (!record.profileUpdateDecisionId) failures.push('Record should keep profileUpdateDecisionId.');
  if (record.evidenceLinks.length < 3) failures.push('Record should keep evidence links.');
  if (record.beforeProfileSummary.abilityStatus === record.afterProfileSummary.abilityStatus) {
    failures.push('Update status case should record before/after status difference.');
  }
  if (record.relatedSessionId !== 'session-phase82-debug') failures.push('Record should preserve relatedSessionId.');
  if (/已经明显提升|稳定提升/.test(record.reason)) failures.push('Record reason should not overclaim stable growth.');

  printAcceptance(failures, 'Phase 8.2.1 growth memory record debug passed.');
}

function printAcceptance(failures: string[], passMessage: string): void {
  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log(`[PASS] ${passMessage}`);
    return;
  }

  console.log('[FAIL] Phase 8.2.1 growth memory record debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 8.2.1 debug check failed.');
}

runPhase821GrowthMemoryRecordDebug();
