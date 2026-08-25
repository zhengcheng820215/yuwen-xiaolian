import { runProductComplexityConvergenceStage4RealTrialPreflightBrowserAcceptance } from
  '../../api/productComplexityConvergenceStage4RealTrialPreflightBrowserAcceptance.ts';

const report = await runProductComplexityConvergenceStage4RealTrialPreflightBrowserAcceptance();
for (const check of report.checks) console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.id} ${check.title}`);
console.log(`\nStage 4 Real Trial Preflight Browser Matrix: ${report.passed}/${report.total}`);
const writes = report.formalResourceWriteCount + report.attemptWriteCount + report.evidenceWriteCount
  + report.profileWriteCount + report.realDenominatorWriteCount;
console.log(`Forbidden writes: ${writes}`);
if (report.passed !== 20 || report.total !== 20 || writes !== 0) process.exitCode = 1;
