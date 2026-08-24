import assert from 'node:assert/strict';
import { runReadingOpenResponseStage4BrowserAcceptance } from
  '../../api/readingOpenResponseStage4BrowserAcceptance.ts';

const report = await runReadingOpenResponseStage4BrowserAcceptance();

assert.equal(report.runtimeScope, 'debug');
assert.equal(report.total, 16);
assert.equal(report.checks.length, 16);
assert.equal(new Set(report.checks.map((item) => item.id)).size, 16);
assert.equal(report.passed, 16);
assert.equal(report.checks.every((item) => item.passed), true);

for (const item of report.checks) {
  console.log(`PASS ${item.id} ${item.title}`);
}
console.log(`\nReading Open Response Stage 4 Browser Matrix: ${report.passed}/${report.total} passed.`);
