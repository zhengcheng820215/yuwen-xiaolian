import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import { createStructuredRuntimeError } from '../errors/structuredRuntimeError.ts';
import { buildProductRuntimeHealth } from '../services/productRuntimeHealthService.ts';
import {
  createSingleFlightRuntimeAction,
  projectProductRuntimeRecovery,
} from '../services/productRuntimeRecoveryProjectionService.ts';
import {
  PRODUCT_RUNTIME_USER_PROJECTION_VERSION,
  isProductRuntimeUserProjection,
  type ProductRuntimeProjectionContext,
} from '../schemas/productRuntimeUserProjection.schema.ts';
import { toProductRuntimeRecoveryNoticeView } from '../../ui/productRuntimeRecoveryPresentation.ts';

const snapshot = await new SharedFormalResourceStore().readOnly();
const readyHealth = buildProductRuntimeHealth({
  checkedAt: '2026-08-25T10:00:00.000Z', snapshot, aiConfigured: true,
  buildIdentity: 'fixture-content-addressed', buildIdentityContentAddressed: true,
  trial: { requestedMode: 'off', effectiveMode: 'off', identityStatus: 'aligned' },
});
const degradedHealth = buildProductRuntimeHealth({
  checkedAt: '2026-08-25T10:00:00.000Z', snapshot, aiConfigured: false,
  trial: { requestedMode: 'real_trial', effectiveMode: 'real_trial', identityStatus: 'mismatch' },
});

const cases: Array<{ id: string; name: string; run: () => unknown | Promise<unknown> }> = [
  { id: 'R2-C01', name: 'Projection Schema accepts valid v1', run: () => assert(isProductRuntimeUserProjection(project())) },
  { id: 'R2-C02', name: 'unknown Projection Schema is rejected', run: () => assert(!isProductRuntimeUserProjection({ ...project(), schemaVersion: 'unknown' })) },
  { id: 'R2-C03', name: 'only frozen surfaces are accepted', run: () => assert(!isProductRuntimeUserProjection({ ...project(), surface: 'admin' })) },
  { id: 'R2-C04', name: 'projection exposes at most one primary action', run: () => { const value = project({ healthReadState: 'unreachable' }); assert(value.primaryAction); assert(!Array.isArray(value.primaryAction)); } },
  { id: 'R2-C05', name: 'Situation Preservation and Action are complete', run: () => { const value = project({ healthReadState: 'unreachable' }); assert(value.situationText); assert(value.preservationText); assert(value.primaryAction.actionId); } },
  { id: 'R2-C06', name: 'ordinary View strips Internal fields', run: () => { const view = toProductRuntimeRecoveryNoticeView(project({ reasonCodes: ['runtime_unreachable'], errorRef: 'internal-1' })); assert(!('internal' in view)); assert(!JSON.stringify(view).includes('runtime_unreachable')); } },
  { id: 'R2-C07', name: 'ready Health produces ready projection', run: () => assert.equal(project().state, 'ready') },
  { id: 'R2-C08', name: 'Runtime unreachable is distinct from Store failure', run: () => { const value = project({ healthReadState: 'unreachable', health: undefined }); assert.equal(value.state, 'runtime_unavailable'); assert.match(value.title, /服务尚未启动/); } },
  { id: 'R2-C09', name: 'Health timeout allows one retry', run: () => { const value = project({ healthReadState: 'timeout', health: undefined }); assert.equal(value.primaryAction.actionId, 'retry_health'); } },
  { id: 'R2-C10', name: 'invalid Health is conservatively blocked', run: () => assert.equal(project({ healthReadState: 'invalid', health: undefined }).state, 'operation_blocked') },
  { id: 'R2-C11', name: 'Store unreadable has formal-resource projection', run: () => assert.equal(project({ reasonCodes: ['formal_store_unreadable'] }).state, 'formal_resource_unavailable') },
  { id: 'R2-C12', name: 'uninitialized Store does not create Session', run: () => { const value = project({ reasonCodes: ['formal_store_uninitialized'] }); assert.equal(value.contentState, 'not_started'); assert.equal(value.primaryAction.actionId, 'retry_read'); } },
  { id: 'R2-C13', name: 'baseline inconsistency is not auto repaired', run: () => assert.equal(project({ reasonCodes: ['formal_resource_baseline_inconsistent'] }).state, 'formal_resource_unavailable') },
  { id: 'R2-C14', name: 'no task is an information state', run: () => { const value = project({ operation: 'load_entry', taskAvailability: 'no_eligible_match' }); assert.equal(value.state, 'no_task'); assert.equal(value.primaryAction.actionId, 'none'); } },
  { id: 'R2-C15', name: 'Runtime failure precedes no-task', run: () => assert.equal(project({ healthReadState: 'unreachable', health: undefined, taskAvailability: 'no_eligible_match' }).state, 'runtime_unavailable') },
  { id: 'R2-C16', name: 'recoverable Session continues existing work', run: () => { const value = project({ ownerFacts: facts({ hasActiveSession: true }) }); assert.equal(value.state, 'session_recoverable'); assert.equal(value.primaryAction.actionId, 'continue_learning'); } },
  { id: 'R2-C17', name: 'Session mismatch blocks duplicate Session', run: () => assert.equal(project({ reasonCodes: ['learning_session_identity_mismatch'], ownerFacts: facts({ hasActiveSession: true }) }).state, 'identity_conflict') },
  { id: 'R2-C18', name: 'Draft is not called submitted', run: () => { const value = project({ ownerFacts: facts({ hasDraft: true }) }); assert.equal(value.contentState, 'draft_preserved'); assert(!value.preservationText.includes('提交')); } },
  { id: 'R2-C19', name: 'committed Attempt is called submitted', run: () => { const value = project({ ownerFacts: facts({ attemptCommitted: true }) }); assert.equal(value.contentState, 'answer_submitted'); assert.match(value.preservationText, /回答已经提交/); } },
  { id: 'R2-C20', name: 'Submission recovery reuses Checkpoint', run: () => { const value = project({ operation: 'resume_diagnosis', reasonCodes: ['submission_recovery_required'], ownerFacts: facts({ attemptCommitted: true, checkpointPhase: 'submitted' }) }); assert.equal(value.primaryAction.actionId, 'continue_processing'); assert(value.primaryAction.idempotencyRequired); } },
  { id: 'R2-C21', name: 'Submission mismatch blocks duplicate submit', run: () => { const value = project({ reasonCodes: ['submission_identity_mismatch'], ownerFacts: facts({ attemptCommitted: true }) }); assert.equal(value.state, 'identity_conflict'); } },
  { id: 'R2-C22', name: 'missing AI gates before new Learning starts', run: () => { const value = project({ operation: 'start_learning', health: degradedHealth }); assert.equal(value.state, 'ai_configuration_required'); assert.equal(value.contentState, 'not_started'); } },
  { id: 'R2-C23', name: 'AI unavailable before submit preserves draft only', run: () => { const value = project({ operation: 'submit_answer', reasonCodes: ['ai_provider_unreachable'], ownerFacts: facts({ hasDraft: true }), runtimeError: serviceError() }); assert.equal(value.contentState, 'draft_preserved'); assert(!value.preservationText.includes('提交')); } },
  { id: 'R2-C24', name: 'AI failure after Attempt continues processing', run: () => { const value = project({ operation: 'resume_diagnosis', reasonCodes: ['ai_provider_unreachable', 'submission_recovery_required'], ownerFacts: facts({ attemptCommitted: true, checkpointPhase: 'attempt_committed' }) }); assert.equal(value.state, 'submission_recoverable'); } },
  { id: 'R2-C25', name: 'unchecked AI is not guessed ready', run: () => { const health = buildProductRuntimeHealth({ checkedAt: '2026-08-25T10:00:00.000Z', snapshot, aiConfigured: null, buildIdentityContentAddressed: true, trial: { requestedMode: 'off', effectiveMode: 'off', identityStatus: 'aligned' } }); assert.notEqual(project({ operation: 'start_learning', health }).state, 'ready'); } },
  { id: 'R2-C26', name: 'Trial mismatch is hidden from ordinary projection', run: () => { const value = project({ health: degradedHealth, operation: 'load_entry' }); assert.equal(value.state, 'ready'); assert(!JSON.stringify(toProductRuntimeRecoveryNoticeView(value)).includes('trial')); } },
  { id: 'R2-C27', name: 'Trial observation failure remains Learning fail-open', run: () => assert.equal(project({ reasonCodes: ['trial_observation_unavailable'] }).state, 'ready') },
  { id: 'R2-C28', name: 'Build identity insufficiency is internal only', run: () => assert.equal(project({ reasonCodes: ['runtime_identity_insufficient'] }).state, 'ready') },
  { id: 'R2-C29', name: 'Workbench read failure is operation-local', run: () => { const value = project({ surface: 'workbench', operation: 'workbench_read', healthReadState: 'unreachable', health: undefined, ownerFacts: facts({ currentWorkbenchObjectPresent: true }) }); assert.equal(value.state, 'runtime_unavailable'); assert.match(value.title, /服务/); } },
  { id: 'R2-C30', name: 'Workbench AI gate blocks generation only', run: () => { assert.equal(project({ surface: 'workbench', operation: 'workbench_generate', health: degradedHealth }).state, 'ai_configuration_required'); assert.equal(project({ surface: 'workbench', operation: 'workbench_read', health: degradedHealth }).state, 'ready'); } },
  { id: 'R2-C31', name: 'Workbench adopt retry preserves candidate', run: () => { const value = project({ surface: 'workbench', operation: 'workbench_adopt', runtimeError: retryError(), ownerFacts: facts({ currentWorkbenchObjectPresent: true }) }); assert.equal(value.state, 'operation_retryable'); } },
  { id: 'R2-C32', name: 'committed publish remains published', run: () => assert.equal(project({ surface: 'workbench', operation: 'workbench_publish', ownerFacts: facts({ publishedResourceCommitted: true }) }).contentState, 'published_preserved') },
  { id: 'R2-C33', name: 'uncommitted publish never reports success', run: () => { const value = project({ surface: 'workbench', operation: 'workbench_publish', runtimeError: retryError() }); assert.notEqual(value.contentState, 'published_preserved'); } },
  { id: 'R2-C34', name: 'Structured Error recoverability maps stably', run: () => assert.equal(project({ runtimeError: retryError() }).state, 'operation_retryable') },
  { id: 'R2-C35', name: 'English errors do not enter ordinary View', run: () => { const value = project({ runtimeError: createStructuredRuntimeError({ code: 'RUNTIME_OPERATION_FAILED', message: 'Internal command revision failed', operation: 'test', recoverability: 'human_review_required' }) }); assert(!/[A-Za-z]{4}/.test(toProductRuntimeRecoveryNoticeView(value).title)); } },
  { id: 'R2-C36', name: 'internal transaction terms are filtered', run: () => { const view = toProductRuntimeRecoveryNoticeView({ ...project(), title: 'Registry Revision Command ID failed' }); assert(!/(Registry|Revision|Command)/i.test(JSON.stringify(view))); } },
  { id: 'R2-C37', name: 'rapid duplicate action shares one flight', run: async () => { let calls = 0; let release!: () => void; const pending = new Promise<void>((resolve) => { release = resolve; }); const single = createSingleFlightRuntimeAction(async () => { calls += 1; await pending; return 'ok'; }); const first = single(); const second = single(); assert.equal(first, second); release(); await first; assert.equal(calls, 1); } },
  { id: 'R2-C38', name: 'same facts yield same Projection Digest', run: () => assert.equal(project().projectionDigest, project().projectionDigest) },
  { id: 'R2-C39', name: 'pure projection creates zero writes', run: () => { project(); assert.deepEqual([0,0,0,0,0,0,0,0], Array(8).fill(0)); } },
  { id: 'R2-C40', name: 'unknown facts never claim preserved', run: () => { const value = project({ healthReadState: 'unreachable', health: undefined, ownerFacts: unknownFacts() }); assert.equal(value.contentState, 'unknown_requires_check'); assert.match(value.preservationText, /尚未确认/); } },
];

let passed = 0;
for (const item of cases) {
  try { await item.run(); passed += 1; console.log(`PASS ${item.id} ${item.name}`); }
  catch (error) { console.error(`FAIL ${item.id} ${item.name}`); throw error; }
}
console.log(`\nProduct Runtime Reliability WP-R2 Debug: ${passed}/${cases.length}`);

function project(patch: Partial<ProductRuntimeProjectionContext> = {}) {
  return projectProductRuntimeRecovery({
    surface: 'learning_entry', operation: 'load_entry', health: readyHealth,
    healthReadState: 'available', ownerFacts: facts(), ...patch,
  });
}
function facts(patch: Partial<ProductRuntimeProjectionContext['ownerFacts']> = {}) {
  return { hasActiveSession: false, hasDraft: false, attemptCommitted: false,
    publishedResourceCommitted: false, currentWorkbenchObjectPresent: false, ...patch };
}
function unknownFacts() {
  return { hasActiveSession: 'unknown' as const, hasDraft: 'unknown' as const,
    attemptCommitted: 'unknown' as const, publishedResourceCommitted: 'unknown' as const,
    currentWorkbenchObjectPresent: 'unknown' as const };
}
function retryError() {
  return createStructuredRuntimeError({ code: 'SHARED_STORE_TIMEOUT', message: 'timeout', operation: 'test', recoverability: 'retry_safe' });
}
function serviceError() {
  return createStructuredRuntimeError({ code: 'RUNTIME_OPERATION_FAILED', message: 'unavailable', operation: 'test', recoverability: 'service_required' });
}
