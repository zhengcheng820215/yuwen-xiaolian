import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import { buildProductRuntimeReliabilityWPR3BrowserReport } from '../../api/productRuntimeReliabilityWPR3BrowserAcceptance.ts';
import { buildProductRuntimeHealth } from '../services/productRuntimeHealthService.ts';

const snapshot = await new SharedFormalResourceStore().readOnly();
const health = buildProductRuntimeHealth({
  checkedAt: '2026-08-26T10:00:00.000Z', snapshot, aiConfigured: true, aiAvailabilityVerified: true,
  runtimeIdentityStatus: 'missing', buildIdentityContentAddressed: false,
  trial: { requestedMode: 'real_trial', effectiveMode: 'real_trial', identityStatus: 'legacy_unverifiable' },
});
const report = buildProductRuntimeReliabilityWPR3BrowserReport({ health });
assert.equal(report.total, 16);
assert.equal(report.passed, 16);
assert(Object.values(report.writeCounts).every((count) => count === 0));
report.checks.forEach((check) => console.log(`PASS ${check.id} ${check.name}`));
console.log(`WP-R3 BROWSER MATRIX ACCEPTED ${report.passed}/${report.total}`);
