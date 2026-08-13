import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import { auditAndPrepareMaterialCorpusMaintenance } from '../agents/materialCorpusMaintenanceAgent.ts';

const apply = process.argv.includes('--apply');
const store = new SharedFormalResourceStore();
const snapshot = await store.read();
if (!snapshot.initialized) throw new Error('Shared formal resource store is not initialized.');
const now = new Date().toISOString();
const { data, report } = auditAndPrepareMaterialCorpusMaintenance(snapshot.data, now);

console.log('Material Corpus Maintenance');
console.log('='.repeat(72));
console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
console.log(`Shared Store revision: ${snapshot.revision}`);
console.log(`Active materials: ${report.activeMaterialCount}`);
console.log(`Current tasks: ${report.currentTaskCount}`);
const actionableIssues = report.issues.filter((issue) => issue.severity !== 'information');
const governanceInformation = report.issues.filter((issue) => issue.severity === 'information');
console.log(`Actionable corpus issues: ${actionableIssues.length}`);
for (const issue of actionableIssues) {
  console.log(`- [${issue.severity}] ${issue.materialTitle} ${issue.code}: ${issue.detail}`);
}
console.log(`Governance information: ${governanceInformation.length}`);
for (const issue of governanceInformation) {
  console.log(`- [${issue.severity}] ${issue.materialTitle} ${issue.code}: ${issue.detail}`);
}
console.log(`Historical active links to supersede: ${report.supersededLinkIds.length}`);
report.supersededLinkIds.forEach((id) => console.log(`- ${id}`));
console.log(`Historical Registry entries to retire: ${report.retiredRegistryEntryIds.length}`);
report.retiredRegistryEntryIds.forEach((id) => console.log(`- ${id}`));
console.log(`Stale drafts to archive: ${report.archivedDraftIds.length}`);
report.archivedDraftIds.forEach((id) => console.log(`- ${id}`));

if (apply) {
  const changed = report.supersededLinkIds.length > 0
    || report.retiredRegistryEntryIds.length > 0
    || report.archivedDraftIds.length > 0;
  if (!changed) {
    console.log('No lifecycle changes required.');
  } else {
    const next = await store.replace(snapshot.revision, data);
    console.log(`Applied atomically. Shared Store revision: ${next.revision}`);
  }
} else {
  console.log('No data was changed. Re-run with --apply after reviewing this report.');
}
