import { summarizeGrowthMemory } from '../agents/growthMemorySummaryAgent.ts';
import { isGrowthMemorySummary, type GrowthMemoryRecord } from '../schemas/growthMemory.schema.ts';
import { buildGrowthMemoryRecordFixture } from './growthMemoryDebugFixtures.ts';

function runPhase823GrowthMemorySummaryDebug(): void {
  const failures: string[] = [];
  const cases = buildCases();

  console.log('\nPhase 8.2.3 Growth Memory Summary Debug');
  console.log('=======================================');

  for (const item of cases) {
    const summary = summarizeGrowthMemory({
      studentId: 'demo-student',
      abilityId: '推理',
      records: item.records,
    });

    console.log(`\n${item.name}`);
    console.log('------------------------------');
    console.log(`recentTrend: ${summary.recentTrend}`);
    console.log(`latestAction: ${summary.latestAction}`);
    console.log(`summary: ${summary.summary}`);

    if (!isGrowthMemorySummary(summary)) {
      failures.push(`${item.name}: summary should match schema.`);
    }
    if (summary.summary.includes('已经明显提升') || summary.summary.includes('稳定提升')) {
      failures.push(`${item.name}: summary should not overclaim ability growth.`);
    }

    item.expect(summary, failures);
  }

  printAcceptance(failures);
}

function buildCases(): Array<{
  name: string;
  records: GrowthMemoryRecord[];
  expect: (summary: ReturnType<typeof summarizeGrowthMemory>, failures: string[]) => void;
}> {
  return [
    {
      name: 'Case 1: append evidence only',
      records: [
        makeRecordWithAction('append_evidence_only', '2026-07-12T08:00:00.000Z'),
        makeRecordWithAction('append_evidence_only', '2026-07-12T08:10:00.000Z'),
      ],
      expect: (summary, failures) => {
        if (summary.recentTrend !== 'continued_observation') failures.push('Case 1 should be continued_observation.');
      },
    },
    {
      name: 'Case 2: retest pending',
      records: [
        makeRecordWithAction('append_evidence_only', '2026-07-12T08:00:00.000Z'),
        makeRecordWithAction('request_retest', '2026-07-12T08:20:00.000Z'),
      ],
      expect: (summary, failures) => {
        if (summary.recentTrend !== 'retest_pending') failures.push('Case 2 should be retest_pending.');
        if (summary.pendingActions.length === 0) failures.push('Case 2 should include pending actions.');
      },
    },
    {
      name: 'Case 3: fluctuating',
      records: [
        makeRecordWithAction('mark_fluctuating', '2026-07-12T08:30:00.000Z'),
        makeRecordWithAction('update_confidence', '2026-07-12T08:20:00.000Z'),
      ],
      expect: (summary, failures) => {
        if (summary.recentTrend !== 'fluctuating') failures.push('Case 3 should be fluctuating.');
      },
    },
    {
      name: 'Case 4: confidence increasing',
      records: [
        makeRecordWithAction('update_confidence', '2026-07-12T08:40:00.000Z'),
        makeRecordWithAction('update_confidence', '2026-07-12T08:30:00.000Z'),
      ],
      expect: (summary, failures) => {
        if (summary.recentTrend !== 'confidence_increasing') failures.push('Case 4 should be confidence_increasing.');
        if (!summary.limitations.some((item) => item.includes('不等于长期能力已经提升'))) {
          failures.push('Case 4 should keep anti-overclaim limitation.');
        }
      },
    },
    {
      name: 'Case 5: status improving',
      records: [
        makeRecordWithAction('update_status', '2026-07-12T08:50:00.000Z'),
      ],
      expect: (summary, failures) => {
        if (summary.recentTrend !== 'status_improving') failures.push('Case 5 should be status_improving.');
      },
    },
  ];
}

function makeRecordWithAction(
  action: GrowthMemoryRecord['action'],
  createdAt: string,
): GrowthMemoryRecord {
  const record = buildGrowthMemoryRecordFixture(undefined, { runTime: createdAt });
  return {
    ...record,
    recordId: `${record.recordId}-${action}`,
    action,
    createdAt,
    nextAction: action === 'request_retest' ? '安排同能力独立复测。' : record.nextAction,
    limitations: action === 'mark_fluctuating'
      ? [...record.limitations, '当前存在波动，不能宣布稳定提升。']
      : record.limitations,
  };
}

function printAcceptance(failures: string[]): void {
  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 8.2.3 growth memory summary debug passed.');
    return;
  }

  console.log('[FAIL] Phase 8.2.3 growth memory summary debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 8.2.3 debug check failed.');
}

runPhase823GrowthMemorySummaryDebug();
