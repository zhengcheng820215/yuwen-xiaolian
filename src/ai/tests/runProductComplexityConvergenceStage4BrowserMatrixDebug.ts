import { runProductComplexityConvergenceStage4BrowserAcceptance } from
  '../../api/productComplexityConvergenceStage4BrowserAcceptance.ts';

const report = await runProductComplexityConvergenceStage4BrowserAcceptance();
for (const check of report.checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.id} ${check.title}`);
}
console.log(`\nProduct Complexity Convergence Stage 4 Browser Matrix: ${report.passed}/${report.total}`);
console.log(`Real trial denominator writes: ${report.realTrialDenominatorWriteCount}`);
if (report.passed !== report.total || report.realTrialDenominatorWriteCount !== 0) process.exitCode = 1;
