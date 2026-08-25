import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import { buildProductRuntimeHealth } from '../services/productRuntimeHealthService.ts';
import { buildProductRuntimeReliabilityWPR1BrowserReport } from '../../api/productRuntimeReliabilityWPR1BrowserAcceptance.ts';
import { buildProductRuntimeProtectedSnapshot } from '../services/productRuntimeBaselineAuditService.ts';

const snapshot = await new SharedFormalResourceStore().readOnly();
const health = buildProductRuntimeHealth({
  checkedAt: '2026-08-25T10:00:00.000Z', snapshot, aiConfigured: false,
  trial: { requestedMode: 'real_trial', effectiveMode: 'real_trial', identityStatus: 'mismatch' },
});
const protectedSnapshot = buildProductRuntimeProtectedSnapshot(snapshot);
const formal = {
  revision: snapshot.revision,
  digest: protectedSnapshot.formalResourceDigest,
  activeMaterialCount: health.formalResourceStore.activeMaterialCount!,
  currentQuestionCount: health.formalResourceStore.currentQuestionCount!,
  learningConsumableQuestionCount: health.formalResourceStore.learningConsumableQuestionCount!,
};
const report = buildProductRuntimeReliabilityWPR1BrowserReport({
  health, launcherStatus: 'ALREADY_RUNNING', before: formal, after: formal,
  ordinaryPageMutationCount: 0, attemptWriteCount: 0, evidenceWriteCount: 0,
  profileWriteCount: 0, calibrationWriteCount: 0, trialStateWriteCount: 0,
  visibleText: 'Runtime degraded；AI 未配置；Trial 需要重新准入。',
});
for (const item of report.checks) {
  assert(item.passed, `${item.id} failed: ${item.evidence}`);
  console.log(`PASS ${item.id} ${item.title}`);
}
assert.equal(report.total, 14);
assert.equal(report.passed, 14);
console.log(`\nProduct Runtime Reliability WP-R1 Browser Matrix: ${report.passed}/${report.total}`);
