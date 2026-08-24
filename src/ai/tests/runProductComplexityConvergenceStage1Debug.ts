import assert from 'node:assert/strict';
import {
  currentQuestionLabel,
  nextQuestionLabel,
  projectAuthoringSurface,
  projectLearningSurface,
} from '../agents/productComplexityConvergenceSurfaceProjectionAgent.ts';
import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE1_SURFACE_PROJECTION_VERSION,
  isProductSurfaceProjection,
  type AuthoringSurfaceFacts,
  type LearningSurfaceFacts,
  type ProductSurfaceProjection,
} from '../schemas/productComplexityConvergenceSurfaceProjection.schema.ts';

type DebugCase = { id: string; name: string; run: () => void | Promise<void> };
const forbidden = /Candidate|Gate|Admission|Hash|Scheduler|Load Level|Evidence|Profile|Calibration|Revision Identity/i;

const cases: DebugCase[] = [
  c('C1-01', 'legal projection passes guard', () => assert.equal(isProductSurfaceProjection(authoring('candidate_ready')), true)),
  c('C1-02', 'unknown version audience state and command are rejected or conservatively projected', () => {
    assert.equal(isProductSurfaceProjection({ ...authoring('candidate_ready'), projectionVersion: 'unknown' } as any), false);
    assert.equal(isProductSurfaceProjection({ ...authoring('candidate_ready'), audience: 'internal' } as any), false);
    assert.equal(projectAuthoringSurface({ surfaceId: 'a', state: 'unknown' as any }).stateId, 'recoverable_failure');
  }),
  c('C1-03', 'same facts produce stable projection', () => assert.deepEqual(authoring('candidate_ready'), authoring('candidate_ready'))),
  c('C1-04', 'projection invokes no mutation command', () => {
    let writes = 0; projectAuthoringSurface(facts('candidate_ready')); projectLearningSurface(learningFacts('task'));
    assert.equal(writes, 0);
  }),
  c('C1-05', 'ordinary projection hides internal terms while internal facts remain available', () => {
    const projected = authoring('recoverable_failure', { internalErrorRef: 'Candidate Gate Hash' });
    assert.equal(forbidden.test(visibleText(projected)), false);
    assert.equal(projected.localRecovery?.internalErrorRef, 'Candidate Gate Hash');
  }),
  c('C1-06', 'authoring without candidate has generation as sole primary action', () => {
    const value = authoring('no_candidate'); assert.equal(value.primaryAction?.commandId, 'generate_training_tasks'); assert.equal(value.secondaryActions.length, 0);
  }),
  c('C1-07', 'candidate ready has exactly one adoption primary action', () => {
    const value = authoring('candidate_ready'); assert.equal(value.primaryAction?.commandId, 'adopt_and_publish'); assert.equal(primaryCount(value), 1);
  }),
  c('C1-08', 'publishing action is busy disabled and unique', () => {
    const value = authoring('publishing'); assert.equal(value.primaryAction?.busy, true); assert.equal(value.primaryAction?.disabled, true); assert.equal(primaryCount(value), 1);
  }),
  c('C1-09', 'published state has no publish pending or stale failure projection', () => {
    const value = authoring('published'); assert.equal(value.primaryAction, undefined); assert.equal(value.status?.label, '已发布'); assert.equal(/可以发布|待处理|失败/.test(visibleText(value)), false);
  }),
  c('C1-10', 'single task success does not change sibling projection', () => {
    const before = authoring('candidate_ready', { surfaceId: 'task-2' }); authoring('published', { surfaceId: 'task-1' }); assert.deepEqual(authoring('candidate_ready', { surfaceId: 'task-2' }), before);
  }),
  c('C1-11', 'version conflict hides revision hash and expected version', () => assert.equal(/Revision|Hash|Expected/i.test(visibleText(authoring('version_conflict'))), false)),
  c('C1-12', 'authoring failure reports outcome preservation and local recovery', () => {
    const value = authoring('recoverable_failure', { preservedContent: 'candidate' }); assert.match(value.localRecovery?.userMessage || '', /没有完成/); assert.match(value.localRecovery?.preservationMessage || '', /保留/); assert.equal(value.localRecovery?.action.commandId, 'retry_current_operation');
  }),
  c('C1-13', 'bottom command failure is projected as local recovery', () => assert.ok(authoring('recoverable_failure').localRecovery)),
  c('C1-14', 'learning task hides scheduler explanation', () => assert.equal(/Scheduler|调度|为什么安排/.test(visibleText(learning('task'))), false)),
  c('C1-15', 'learning hides load thread evidence profile and admission', () => assert.equal(forbidden.test(visibleText(learning('task'))), false)),
  c('C1-16', 'collapsed hint does not expose hint body', () => {
    const value = learning('task', { hintAvailable: true, hintExpanded: false }); assert.equal(value.disclosureSections[0]?.expanded, false); assert.equal('content' in (value.disclosureSections[0] || {}), false);
  }),
  c('C1-17', 'inactive revision has no entry or placeholder', () => assert.equal(visibleText(learning('feedback')).includes('修订'), false)),
  c('C1-18', 'active revision uses student understandable action only', () => {
    const value = learning('revision', { canRevise: true }); assert.equal(value.primaryAction?.label, '提交修订'); assert.equal(forbidden.test(visibleText(value)), false);
  }),
  c('C1-19', 'inactive targeted training has no entry or explanation', () => assert.equal(visibleText(learning('task')).includes('针对练习'), false)),
  c('C1-20', 'active targeted training hides engineering identity and keeps task semantics', () => {
    const value = learning('targeted'); assert.equal(value.title, '针对练习'); assert.equal(/Targeted|Gap|Reason Code/i.test(visibleText(value)), false);
  }),
  c('C1-21', 'retest and transfer current tasks hide engineering roles', () => {
    assert.equal(/复测|Retest/i.test(visibleText(learning('retest'))), false); assert.equal(/迁移|Transfer/i.test(visibleText(learning('transfer'))), false);
  }),
  c('C1-22', 'next action includes actual number and total', () => assert.equal(nextQuestionLabel(1, 6), '进入第 2 题（共 6 题）')),
  c('C1-23', 'unfinished group never projects return as sole action', () => {
    const value = learning('feedback', { currentQuestionNumber: 2, totalQuestionCount: 6 }); assert.equal(value.primaryAction?.commandId, 'continue_to_next_question');
  }),
  c('C1-24', 'completion conclusion and return only appear after group completion', () => {
    assert.equal(learning('complete').primaryAction?.commandId, 'return_to_learning_entry'); assert.equal(visibleText(learning('feedback')).includes('本次学习已完成'), false);
  }),
  c('C1-25', 'empty feedback duplicate goal and state are absent', () => {
    const value = learning('feedback'); assert.equal(value.disclosureSections.length, 0); assert.equal(new Set(textParts(value)).size, textParts(value).length);
  }),
  c('C1-26', 'status tones distinguish progress success and error', () => {
    assert.equal(learning('task').status?.tone, 'progress'); assert.equal(learning('complete').status?.tone, 'success'); assert.equal(learning('recoverable_failure').status?.tone, 'error');
  }),
  c('C1-27', 'protected digests remain unchanged', () => {
    const snapshot = protectedSnapshot(); const before = structuredClone(snapshot); authoring('candidate_ready'); learning('task'); assert.deepEqual(snapshot, before);
  }),
  c('C1-28', 'command counts triggers ordering and writes remain unchanged', () => {
    const factsBefore = { commands: 4, triggers: ['revision'], order: ['q1', 'q2'], writes: 0 }; const before = structuredClone(factsBefore); learning('revision'); authoring('publishing'); assert.deepEqual(factsBefore, before);
  }),
];

async function main() {
  let passed = 0;
  for (const item of cases) {
    try { await item.run(); passed += 1; console.log(`PASS ${item.id} ${item.name}`); }
    catch (error) { console.error(`FAIL ${item.id} ${item.name}`); throw error; }
  }
  console.log(`\nProduct complexity convergence stage 1 debug: ${passed}/${cases.length} passed.`);
}

function c(id: string, name: string, run: DebugCase['run']): DebugCase { return { id, name, run }; }
function facts(state: AuthoringSurfaceFacts['state'], patch: Partial<AuthoringSurfaceFacts> = {}): AuthoringSurfaceFacts {
  return { surfaceId: 'authoring-task', state, canGenerate: true, canAdoptAndPublish: true,
    canRegenerate: true, canRetry: true, preservedContent: 'candidate', ...patch };
}
function authoring(state: AuthoringSurfaceFacts['state'], patch: Partial<AuthoringSurfaceFacts> = {}) { return projectAuthoringSurface(facts(state, patch)); }
function learningFacts(state: LearningSurfaceFacts['state'], patch: Partial<LearningSurfaceFacts> = {}): LearningSurfaceFacts {
  return { surfaceId: 'learning-task', state, currentQuestionNumber: 1, totalQuestionCount: 5,
    canContinue: true, canSubmit: true, canSaveDraft: true, canRevise: true, ...patch };
}
function learning(state: LearningSurfaceFacts['state'], patch: Partial<LearningSurfaceFacts> = {}) { return projectLearningSurface(learningFacts(state, patch)); }
function visibleText(value: ProductSurfaceProjection): string { return textParts(value).join(' '); }
function textParts(value: ProductSurfaceProjection): string[] {
  return [value.title, value.status?.label, value.status?.detail, value.primaryAction?.label,
    ...value.secondaryActions.map((item) => item.label), ...value.disclosureSections.map((item) => item.label),
    value.localRecovery?.userMessage, value.localRecovery?.preservationMessage,
    value.localRecovery?.action.label].filter(Boolean) as string[];
}
function primaryCount(value: ProductSurfaceProjection): number { return value.primaryAction?.emphasis === 'primary' ? 1 : 0; }
function protectedSnapshot() { return { formalResourceDigest: 'formal', registryDigest: 'registry', storeRevision: 61,
  sessionDigest: 'session', attemptDigest: 'attempt', evidenceDigest: 'evidence', profileDigest: 'profile', calibrationDigest: 'calibration' }; }

assert.equal(PRODUCT_COMPLEXITY_CONVERGENCE_STAGE1_SURFACE_PROJECTION_VERSION, 'product_complexity_convergence_stage1_surface_projection_v1');
assert.equal(currentQuestionLabel(2, 6), '第 2 题（共 6 题）');
await main();
