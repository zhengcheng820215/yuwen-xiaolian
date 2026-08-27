import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import { buildProductRuntimeHealth } from '../services/productRuntimeHealthService.ts';
import { stableHash } from '../services/productRuntimeBaselineAuditService.ts';
import { buildProductRuntimeReliabilityWPR2BrowserReport } from '../../api/productRuntimeReliabilityWPR2BrowserAcceptance.ts';

const snapshot = await new SharedFormalResourceStore().readOnly();
const health = buildProductRuntimeHealth({ checkedAt: '2026-08-25T12:00:00.000Z', snapshot, aiConfigured: false, trial: { requestedMode: 'real_trial', effectiveMode: 'off', identityStatus: 'mismatch' } });
const formal = { revision: snapshot.revision, digest: stableHash(snapshot.data) };
const report = buildProductRuntimeReliabilityWPR2BrowserReport({ health, before: formal, after: formal, writeCounts: { formal: 0, session: 0, attempt: 0, evidence: 0, profile: 0, calibration: 0, trial: 0, workbench: 0 } });
for (const item of report.checks) { console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.id} ${item.title}`); assert(item.passed, item.evidence); }
assert.equal(report.total, 19); assert.equal(report.passed, 19);
console.log(`\nProduct Runtime Reliability WP-R2 Browser Matrix: ${report.passed}/${report.total}`);
