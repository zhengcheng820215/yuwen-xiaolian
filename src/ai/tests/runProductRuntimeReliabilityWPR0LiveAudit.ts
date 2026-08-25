import assert from 'node:assert/strict';
import { runProductRuntimeBaselineAudit } from '../agents/productRuntimeBaselineAuditAgent.ts';
import { isProductRuntimeBaselineAudit } from '../schemas/productRuntimeBaselineAudit.schema.ts';
import { renderProductRuntimeBaselineAuditMarkdown } from '../services/productRuntimeBaselineAuditService.ts';

const report = await runProductRuntimeBaselineAudit();
assert(isProductRuntimeBaselineAudit(report));
assert(report.zeroWriteComparison.verified, 'WP-R0 live audit must remain read-only.');
console.log(JSON.stringify(report, null, 2));
console.log('\n' + renderProductRuntimeBaselineAuditMarkdown(report));
