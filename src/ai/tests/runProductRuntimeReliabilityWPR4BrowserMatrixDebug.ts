import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import { buildProductRuntimeReliabilityWPR4BrowserReport } from '../../api/productRuntimeReliabilityWPR4BrowserAcceptance.ts';
import { buildProductRuntimeHealth } from '../services/productRuntimeHealthService.ts';

const snapshot = await new SharedFormalResourceStore().readOnly();
const health = buildProductRuntimeHealth({ checkedAt: '2026-08-26T10:00:00.000Z', snapshot,
  aiConfigured: true, aiAvailabilityVerified: true, runtimeIdentityStatus: 'missing',
  buildIdentityContentAddressed: false,
  trial: { requestedMode: 'off', effectiveMode: 'off', identityStatus: 'missing' } });
const report = buildProductRuntimeReliabilityWPR4BrowserReport({ health });
assert.equal(report.total, 18);
assert.equal(report.passed, 18);
assert.equal(report.currentEffectiveMode, 'off');
assert.equal(report.executionMode, 'isolated_browser_state_matrix');
assert(Object.values(report.writeCounts).every((value) => value === 0));
assert.deepEqual(report.checks.map((check) => check.name), [
  'Internal WP-R4 页面打开', 'Runtime Identity dirty', 'Runtime Identity clean',
  'Preflight 运行中', 'Preflight 失败', 'Preflight eligible', '保存准入包',
  '重复保存', 'Bundle 冲突', 'Preflight 过期', 'Identity 变化', '显式激活成功',
  '激活重复点击', '激活失败', '激活后刷新', 'Learning 页面', 'Workbench 页面',
  'Observation 计数',
]);
report.checks.forEach((check) => console.log(`PASS ${check.id} ${check.name}`));
console.log(`WP-R4 BROWSER MATRIX ACCEPTED ${report.passed}/${report.total}`);
