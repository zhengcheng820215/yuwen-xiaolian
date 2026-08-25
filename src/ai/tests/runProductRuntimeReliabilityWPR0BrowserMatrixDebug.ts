import assert from 'node:assert/strict';
import { buildProductRuntimeReliabilityWPR0BrowserReport } from '../../api/productRuntimeReliabilityWPR0BrowserAcceptance.ts';

const report = buildProductRuntimeReliabilityWPR0BrowserReport({
  currentUrl: 'http://localhost:5174/#/internal/acceptance/product-runtime-reliability-wp-r0',
  runtimeReachable: false,
  formalBoundaryReachable: false,
  learningVisibleState: 'runtime_unreachable',
  reasonCodes: ['runtime_unreachable'],
  beforeFormalDigest: 'formal:unchanged',
  afterFormalDigest: 'formal:unchanged',
  consoleEvidenceClassified: true,
  sensitiveContentIncluded: false,
  mutationCallCount: 0,
  trialStateWriteCount: 0,
});

assert.equal(report.total, 12);
assert.equal(report.passed, 12);
assert.deepEqual(report.checks.map((item) => item.id), Array.from({ length: 12 }, (_, index) => `R0-B${String(index + 1).padStart(2, '0')}`));
assert.equal(report.formalResourceWriteCount, 0);
assert.equal(report.studentAttemptWriteCount, 0);
assert.equal(report.evidenceWriteCount, 0);
assert.equal(report.profileWriteCount, 0);
assert.equal(report.realCalibrationDenominatorWriteCount, 0);
assert.equal(report.trialStateWriteCount, 0);
assert.equal(JSON.stringify(report).includes('sk-'), false);
console.log('Product Runtime Reliability WP-R0 Browser Matrix: 12/12');
