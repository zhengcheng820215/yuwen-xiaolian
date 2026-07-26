import { getPhase175C3ABatchQualitySummaryDemoData } from '../../api/phase175C3ABatchQualitySummaryDemo.ts';
import {
  QUESTION_QUALITY_BATCH_SUMMARY_RULE_VERSION,
  isQuestionGenerationBatchQualitySummary,
} from '../schemas/questionQualityBatchSummary.schema.ts';

const demo = getPhase175C3ABatchQualitySummaryDemoData();
const byId = (id: string) => demo.cases.find((item) => item.id === id);

const checks: Array<{ name: string; passed: boolean }> = [
  { name: '01 five acceptance cases exist', passed: demo.cases.length === 5 },
  { name: '02 complete status is visible', passed: byId('complete')?.summary.status === 'complete' },
  { name: '03 complete coverage is 100%', passed: byId('complete')?.summary.metrics.currentAssessmentCoverage.value === 1 },
  { name: '04 incomplete status is visible', passed: byId('incomplete')?.summary.status === 'incomplete' },
  { name: '05 missing assessment is counted', passed: byId('incomplete')?.summary.counts.missingAssessmentCount === 1 },
  { name: '06 mixed version status is visible', passed: byId('mixed-versions')?.summary.status === 'mixed_versions' },
  { name: '07 stale assessment is counted', passed: (byId('mixed-versions')?.summary.counts.staleAssessmentCount || 0) > 0 },
  { name: '08 duplicate bundle blocks summary', passed: byId('blocked')?.summary.status === 'blocked' },
  { name: '09 duplicate bundle issue is visible', passed: Boolean(byId('blocked')?.summary.issues.some((issue) => issue.startsWith('duplicate_current_bundle:'))) },
  { name: '10 zero denominator stays null', passed: byId('zero-denominator')?.summary.metrics.contractValidationPassRate.value === null },
  { name: '11 summaries satisfy formal schema', passed: demo.cases.every((item) => isQuestionGenerationBatchQualitySummary(item.summary)) },
  { name: '12 summary rule identity is current', passed: demo.cases.every((item) => item.summary.summaryRuleVersion === QUESTION_QUALITY_BATCH_SUMMARY_RULE_VERSION) },
  { name: '13 demo boundary protects real workbench', passed: /不写真实录题工作台/.test(demo.runtimeBoundary) },
];

let passed = 0;
console.log('Phase 17.5C3A Batch Quality Summary Demo Debug');
for (const check of checks) {
  if (check.passed) {
    passed += 1;
    console.log(`PASS ${check.name}`);
  } else {
    console.error(`FAIL ${check.name}`);
  }
}
console.log(`\nResult: ${passed}/${checks.length} passed`);
if (passed !== checks.length) process.exitCode = 1;
