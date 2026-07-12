import { GrowthMemoryStore } from '../agents/growthMemoryStore.ts';
import { buildGrowthMemoryRecordFixture } from './growthMemoryDebugFixtures.ts';

function runPhase822GrowthMemoryStoreDebug(): void {
  const failures: string[] = [];
  const store = new GrowthMemoryStore();
  const reasoningRecord = buildGrowthMemoryRecordFixture('update_status');
  const expressionRecord = buildGrowthMemoryRecordFixture('update_status', {
    targetAbility: '表达',
    runTime: '2026-07-12T08:25:00.000Z',
    relatedSessionId: 'session-expression',
  });
  const otherStudentRecord = buildGrowthMemoryRecordFixture('update_status', {
    student: 'another-student',
    targetAbility: '推理',
    runTime: '2026-07-12T08:30:00.000Z',
    relatedSessionId: 'session-other',
  });

  const firstSave = store.save(reasoningRecord);
  const duplicateSave = store.save(reasoningRecord);
  store.save(expressionRecord);
  store.save(otherStudentRecord);

  const byId = store.getByRecordId(reasoningRecord.recordId);
  const byStudent = store.queryByStudentId('demo-student');
  const byAbility = store.queryByAbilityId('推理');
  const byStudentAndAbility = store.queryByStudentAndAbility({
    studentId: 'demo-student',
    abilityId: '推理',
  });

  console.log('\nPhase 8.2.2 Growth Memory Store Debug');
  console.log('=====================================');
  console.log(`inserted first: ${firstSave.inserted}`);
  console.log(`inserted duplicate: ${duplicateSave.inserted}`);
  console.log(`query demo-student count: ${byStudent.length}`);
  console.log(`query 推理 count: ${byAbility.length}`);
  console.log(`query demo-student/推理 count: ${byStudentAndAbility.length}`);

  if (!firstSave.inserted) failures.push('First save should insert record.');
  if (duplicateSave.inserted) failures.push('Duplicate recordId should not insert again.');
  if (!byId) failures.push('Should query record by recordId.');
  if (byStudent.length !== 2) failures.push('demo-student should have two records.');
  if (byAbility.length !== 2) failures.push('推理 should include two students.');
  if (byStudentAndAbility.length !== 1) failures.push('studentId + abilityId query should isolate one record.');
  if (byStudent.some((record) => record.studentId !== 'demo-student')) failures.push('Student query should not mix students.');
  if (byStudentAndAbility.some((record) => record.abilityId !== '推理')) failures.push('Ability query should not mix abilities.');
  if (store.list()[0]?.createdAt < store.list()[1]?.createdAt) failures.push('Store list should sort newest first.');

  printAcceptance(failures);
}

function printAcceptance(failures: string[]): void {
  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 8.2.2 growth memory store debug passed.');
    return;
  }

  console.log('[FAIL] Phase 8.2.2 growth memory store debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 8.2.2 debug check failed.');
}

runPhase822GrowthMemoryStoreDebug();
