import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import { prepareMaterialCorpusOptimization } from '../agents/materialCorpusOptimizationAgent.ts';
import { auditAndPrepareMaterialCorpusMaintenance } from '../agents/materialCorpusMaintenanceAgent.ts';

const apply = process.argv.includes('--apply');
const store = new SharedFormalResourceStore();
const snapshot = await store.read();
if (!snapshot.initialized) throw new Error('Shared formal resource store is not initialized.');

const now = new Date().toISOString();
const baselineAudit = auditAndPrepareMaterialCorpusMaintenance(snapshot.data, now).report;
const activeMaterialVersionIds = new Set(snapshot.data.questionResources.materials
  .filter((material) => material.status !== 'retired')
  .map((material) => material.materialVersionId));
const activeResourceVersionIds = new Set(snapshot.data.materialObservations.links
  .filter((link) => link.status === 'active' && activeMaterialVersionIds.has(link.materialVersionId))
  .map((link) => link.resourceVersionId));
const baselineTraceCount = snapshot.data.questionQuality.frozenQualityTraces
  .filter((trace) => activeResourceVersionIds.has(trace.resourceVersionId))
  .length;
const result = prepareMaterialCorpusOptimization(snapshot.data, now);
const corpusAudit = auditAndPrepareMaterialCorpusMaintenance(result.data, now).report;
const blockingIssues = corpusAudit.issues.filter((issue) => (
  ['cjk_internal_spacing', 'fullwidth_latin', 'halfwidth_chinese_punctuation', 'unbalanced_quotes', 'metadata_missing']
    .includes(issue.code)
));
if (result.report.activeMaterialCount !== baselineAudit.activeMaterialCount) {
  throw new Error(
    `Active material count changed unexpectedly: before=${baselineAudit.activeMaterialCount}, after=${result.report.activeMaterialCount}.`,
  );
}
if (
  result.report.currentQuestionCount !== baselineAudit.currentTaskCount
  || result.report.currentTraceCount !== baselineTraceCount
) {
  throw new Error(
    `Current formal resource projection changed unexpectedly: expected questions=${baselineAudit.currentTaskCount}, traces=${baselineTraceCount}; received questions=${result.report.currentQuestionCount}, traces=${result.report.currentTraceCount}.`,
  );
}
if (blockingIssues.length > 0) {
  throw new Error(`Corpus optimization left blocking issues: ${blockingIssues.map((item) => `${item.materialTitle}:${item.code}`).join(', ')}`);
}

if (apply && !result.report.alreadyApplied) {
  const committed = await store.replace(snapshot.revision, result.data);
  console.log(JSON.stringify({
    mode: 'apply',
    beforeRevision: snapshot.revision,
    afterRevision: committed.revision,
    ...result.report,
    remainingGovernanceFindings: corpusAudit.issues,
  }, null, 2));
} else {
  console.log(JSON.stringify({
    mode: apply ? 'apply-noop' : 'dry-run',
    revision: snapshot.revision,
    ...result.report,
    remainingGovernanceFindings: corpusAudit.issues,
  }, null, 2));
}
