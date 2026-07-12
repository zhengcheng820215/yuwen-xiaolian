import { GrowthMemoryStore } from '../agents/growthMemoryStore.ts';
import { summarizeGrowthMemory } from '../agents/growthMemorySummaryAgent.ts';
import { isGrowthMemoryRecord, isGrowthMemorySummary } from '../schemas/growthMemory.schema.ts';
import { buildGrowthMemoryRecordFixture } from './growthMemoryDebugFixtures.ts';

function runPhase82Debug(): void {
  const failures: string[] = [];
  const store = new GrowthMemoryStore();
  const record = buildGrowthMemoryRecordFixture('update_status', {
    relatedSessionId: 'session-phase82-main',
  });
  const saveResult = store.save(record);
  const queriedRecords = store.queryByStudentAndAbility({
    studentId: record.studentId,
    abilityId: record.abilityId,
  });
  const summary = summarizeGrowthMemory({
    studentId: record.studentId,
    abilityId: record.abilityId,
    records: queriedRecords,
  });

  console.log('\nPhase 8.2 Growth Memory Minimum Loop Debug');
  console.log('==========================================');
  console.log(`recordId: ${record.recordId}`);
  console.log(`save inserted: ${saveResult.inserted}`);
  console.log(`query count: ${queriedRecords.length}`);
  console.log(`summary trend: ${summary.recentTrend}`);
  console.log(`summary text: ${summary.summary}`);

  if (!isGrowthMemoryRecord(record)) failures.push('GrowthMemoryRecord should match schema.');
  if (!saveResult.inserted) failures.push('Record should be inserted into store.');
  if (queriedRecords.length !== 1) failures.push('Store should return one scoped record.');
  if (!isGrowthMemorySummary(summary)) failures.push('GrowthMemorySummary should match schema.');
  if (summary.recentTrend !== 'status_improving') failures.push(`Expected status_improving, got ${summary.recentTrend}.`);
  if (summary.summary.includes('已经明显提升') || summary.summary.includes('稳定提升')) {
    failures.push('Summary should describe history, not overclaim stable growth.');
  }

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 8.2 growth memory minimum loop debug passed.');
    return;
  }

  console.log('[FAIL] Phase 8.2 growth memory minimum loop debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 8.2 debug check failed.');
}

runPhase82Debug();
