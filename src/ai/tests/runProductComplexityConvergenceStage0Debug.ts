import assert from 'node:assert/strict';
import {
  auditConditionalCapability,
  auditConvergenceSurface,
} from '../agents/productComplexityConvergenceAuditAgent.ts';
import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION,
  isConditionalCapabilityAuditInput,
  isConvergenceSurfaceAuditInput,
  type ConditionalCapabilityAuditInput,
  type ConvergenceSurfaceAuditInput,
} from '../schemas/productComplexityConvergenceAudit.schema.ts';
import {
  buildDefaultProductComplexityStage0AuditSource,
  buildProductComplexityConvergenceStage0Audit,
  createEmptyProtectedSnapshot,
  renderProductComplexityConvergenceStage0Markdown,
} from '../services/productComplexityConvergenceStage0AuditService.ts';

type DebugCase = { id: string; name: string; run: () => void | Promise<void> };

const cases: DebugCase[] = [
  { id: 'C0-01', name: 'legal surface audit passes guard', run: () => assert.equal(isConvergenceSurfaceAuditInput(surface()), true) },
  { id: 'C0-02', name: 'unknown schema and audience are rejected', run: () => {
    assert.equal(isConvergenceSurfaceAuditInput({ ...surface(), schemaVersion: 'unknown' } as any), false);
    assert.equal(isConditionalCapabilityAuditInput({ ...capability(), audience: 'public' } as any), false);
  } },
  { id: 'C0-03', name: 'same facts produce stable audit result', run: () => assert.deepEqual(auditConvergenceSurface(surface()), auditConvergenceSurface(structuredClone(surface()))) },
  { id: 'C0-04', name: 'internal terminology is legal on internal page', run: () => assert.equal(auditConvergenceSurface(surface({ audience: 'internal', elements: [element('debug', 'heading', 'Candidate Gate Hash Debug')] })).findings.length, 0) },
  { id: 'C0-05', name: 'internal terminology exposure is detected', run: () => assert(has(surface({ elements: [element('debug', 'heading', 'Candidate Gate Hash')] }), 'internal_term_exposed')) },
  { id: 'C0-06', name: 'duplicate primary action is detected', run: () => assert(has(surface({ elements: [action('a'), action('b')] }), 'duplicate_primary_action')) },
  { id: 'C0-07', name: 'duplicate state fact is detected', run: () => assert(has(surface({ elements: [status('a', 'published'), status('b', 'published')] }), 'duplicate_state_message')) },
  { id: 'C0-08', name: 'non actionable status is detected', run: () => assert(has(surface({ elements: [{ ...status('a', 'idle'), actionable: false }] }), 'non_actionable_status')) },
  { id: 'C0-09', name: 'inactive revision entry is detected', run: () => assert(hasCapability(capability({ capability: 'revision', triggerActive: false, entryVisible: true }), 'conditional_feature_visible_without_trigger')) },
  { id: 'C0-10', name: 'inactive targeted entry is detected', run: () => assert(hasCapability(capability({ capability: 'targeted', triggerActive: false, entryVisible: true }), 'conditional_feature_visible_without_trigger')) },
  { id: 'C0-11', name: 'scheduler explanation is detected', run: () => assert(has(surface({ elements: [element('scheduler', 'explanation', '系统调度器决定下一题。')] }), 'scheduler_explanation_exposed')) },
  { id: 'C0-12', name: 'overloaded and fixed feedback are distinct findings', run: () => {
    const findings = auditConvergenceSurface(surface({ feedback: { issueCount: 2, guidanceCount: 2, expressionMode: 'fixed_template' } })).findings.map((item) => item.code);
    assert(findings.includes('feedback_overloaded')); assert(findings.includes('fixed_feedback_template'));
  } },
  { id: 'C0-13', name: 'local actionable error passes', run: () => assert.equal(auditConvergenceSurface(surface({ elements: [{ ...element('error', 'error', '暂时无法发布'), actionable: true, nextAction: '重试', location: 'local' }] })).findings.length, 0) },
  { id: 'C0-14', name: 'remote error location is detected', run: () => assert(has(surface({ elements: [{ ...element('error', 'error', '暂时无法发布'), actionable: true, nextAction: '重试', location: 'remote' }] }), 'hidden_error_location')) },
  { id: 'C0-15', name: 'revision trigger and exit path are traceable', run: () => assert.equal(auditConditionalCapability(capability({ capability: 'revision', triggerActive: true, entryVisible: true })).findings.length, 0) },
  { id: 'C0-16', name: 'targeted recursion is detected', run: () => assert(hasCapability(capability({ capability: 'targeted', triggerActive: true, entryVisible: true, recursiveDepth: 2 }), 'targeted_loop_risk')) },
  { id: 'C0-17', name: 'retest and transfer missing exit are detected', run: () => {
    assert(hasCapability(capability({ capability: 'retest', triggerActive: true, entryVisible: true, exitAvailable: false }), 'conditional_exit_missing'));
    assert(hasCapability(capability({ capability: 'transfer', triggerActive: true, entryVisible: true, recoveryAvailable: false }), 'conditional_exit_missing'));
  } },
  { id: 'C0-18', name: 'governance path remains read-only and canonical', run: () => assert.equal(auditConditionalCapability(capability({ capability: 'governance', triggerActive: false, entryVisible: false, benefitCode: 'repair_resource_risk' })).findings.length, 0) },
  { id: 'C0-19', name: 'calibration states remain separate source identities', run: () => {
    const awaiting = capability({ capability: 'calibration', pathId: 'calibration-awaiting-data' });
    const blocked = capability({ capability: 'calibration', pathId: 'calibration-integrity-blocked' });
    assert.notEqual(auditConditionalCapability(awaiting).pathId, auditConditionalCapability(blocked).pathId);
  } },
  { id: 'C0-20', name: 'unstructured benefit is finding only', run: () => assert(hasCapability(capability({ benefitCode: 'make_learning_better' }), 'benefit_code_unstructured')) },
  { id: 'C0-21', name: 'audit invokes no mutation command', run: () => {
    let calls = 0; const source = buildDefaultProductComplexityStage0AuditSource();
    buildProductComplexityConvergenceStage0Audit(source, () => { calls += 1; return source.protectedSnapshot; });
    assert.equal(calls, 1);
  } },
  { id: 'C0-22', name: 'formal resource registry and revision remain unchanged', run: () => {
    const snapshot = createEmptyProtectedSnapshot({ formalResourceDigest: 'formal-a', registryDigest: 'registry-a', storeRevision: 28 });
    const report = buildProductComplexityConvergenceStage0Audit({ ...buildDefaultProductComplexityStage0AuditSource(), protectedSnapshot: snapshot });
    assert.equal(report.zeroWriteVerified, true); assert.equal(report.afterSnapshot.storeRevision, 28);
  } },
  { id: 'C0-23', name: 'learning evidence profile and calibration remain unchanged', run: () => {
    const snapshot = createEmptyProtectedSnapshot({ learningSessionDigest: 's', learningAttemptDigest: 'a', evidenceDigest: 'e', profileDigest: 'p', calibrationDigest: 'c' });
    const report = buildProductComplexityConvergenceStage0Audit({ ...buildDefaultProductComplexityStage0AuditSource(), protectedSnapshot: snapshot });
    assert.deepEqual(report.beforeSnapshot, report.afterSnapshot);
  } },
  { id: 'C0-24', name: 'report summary matches findings and stage routing', run: () => {
    const report = buildProductComplexityConvergenceStage0Audit(buildDefaultProductComplexityStage0AuditSource());
    const count = report.surfaceResults.reduce((sum, item) => sum + item.findings.length, 0) + report.capabilityResults.reduce((sum, item) => sum + item.findings.length, 0);
    assert.equal(Object.values(report.findingBreakdown).reduce((sum, value) => sum + value, 0), count);
    assert.equal(Object.values(report.stageBreakdown).reduce((sum, value) => sum + value, 0), count);
    assert(renderProductComplexityConvergenceStage0Markdown(report).includes('零写入证明'));
  } },
];

async function main() {
  let passed = 0;
  for (const item of cases) {
    try { await item.run(); passed += 1; console.log(`PASS ${item.id} ${item.name}`); }
    catch (error) { console.error(`FAIL ${item.id} ${item.name}`); throw error; }
  }
  console.log(`\nProduct complexity convergence stage 0 debug: ${passed}/${cases.length} passed.`);
  if (process.argv.includes('--report')) {
    console.log('\n' + renderProductComplexityConvergenceStage0Markdown(
      buildProductComplexityConvergenceStage0Audit(buildDefaultProductComplexityStage0AuditSource()),
    ));
  }
}

function surface(patch: Partial<ConvergenceSurfaceAuditInput> = {}): ConvergenceSurfaceAuditInput {
  return { schemaVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION,
    surfaceId: 'surface', route: '/learning', stateId: 'ready', audience: 'learning_student',
    elements: [], ...patch };
}
function capability(patch: Partial<ConditionalCapabilityAuditInput> = {}): ConditionalCapabilityAuditInput {
  return { schemaVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE0_AUDIT_VERSION,
    capability: 'revision', pathId: 'path', audience: 'learning_student', triggerActive: false,
    entryVisible: false, exitAvailable: true, noActionFallbackAvailable: true,
    recoveryAvailable: true, factSource: 'canonical_projection', retirementCompatibility: true,
    ...patch };
}
function element(id: string, kind: any, text: string) { return { elementId: id, kind, text, factSource: 'canonical_projection' as const }; }
function action(id: string) { return { ...element(id, 'primary_action', '继续'), intent: 'continue' }; }
function status(id: string, factKey: string) { return { ...element(id, 'status', '已发布'), factKey, actionable: true }; }
function has(input: ConvergenceSurfaceAuditInput, code: string) { return auditConvergenceSurface(input).findings.some((item) => item.code === code); }
function hasCapability(input: ConditionalCapabilityAuditInput, code: string) { return auditConditionalCapability(input).findings.some((item) => item.code === code); }

await main();
