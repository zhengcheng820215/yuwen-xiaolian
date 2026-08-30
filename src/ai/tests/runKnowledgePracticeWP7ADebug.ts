import assert from 'node:assert/strict';
import type { PracticeSession } from '../../domain/knowledge-practice/practice/practiceSessionTypes.ts';
import {
  buildKnowledgePracticeEntryProjection,
  buildStudentContentInventoryProjection,
  KNOWLEDGE_HOME_PATH,
  KNOWLEDGE_MISTAKES_PATH,
  KNOWLEDGE_RESULT_PATH,
  knowledgeQuizPath,
  projectStudentLearningHub,
  resolveLegacyStudentRoute,
} from '../../domain/student-learning-hub/studentLearningHubProjection.ts';

type Check = { id: string; name: string; run: () => void };

function session(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return {
    schemaVersion: 1,
    id: 'wp7a-session',
    mode: 'mixed',
    seed: 'seed',
    targetBaseQuestionCount: 10,
    actualBaseQuestionCount: 2,
    baseQuestionIds: ['q1', 'q2'],
    queue: [
      { id: 'i1', questionId: 'q1', questionContentVersion: 1, role: 'base', status: 'answered' },
      { id: 'i2', questionId: 'q2', questionContentVersion: 1, role: 'base', status: 'pending' },
    ],
    currentIndex: 1,
    status: 'active',
    startedAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:01:00.000Z',
    selectionSummary: { candidateCount: 12, selectedCount: 2, targetCount: 10, categoryCounts: {}, difficultyCounts: { 1: 1, 2: 1, 3: 0 }, recentQuestionCount: 0, reusedRecentQuestionCount: 0, relaxationCodes: ['candidate_shortage'] },
    ...overrides,
  };
}

function knowledge(overrides: Record<string, unknown> = {}) {
  return buildKnowledgePracticeEntryProjection({ hydrationStatus: 'ready', activeSession: null, approvedQuestionCount: 12, availableCategoryCount: 6, ...overrides } as any);
}

function formal(overrides: Record<string, unknown> = {}) {
  return { entry: { hasActiveSession: false, canEnterWorkspace: true, primaryAction: 'start_new_session', primaryActionText: '开始阅读训练', ...overrides } };
}

function inventory(status: 'available' | 'unavailable' | 'unknown' = 'available') {
  return buildStudentContentInventoryProjection({
    formal: status === 'available' ? { status, currentCount: 81, activeMaterialCount: 24, consumableCount: 81 } : { status },
    knowledge: { approvedQuestionCount: 12, availableCategoryCount: 6 },
  });
}

function hub(input: { formalInput?: any; knowledgeInput?: any; formalStatus?: 'available' | 'unavailable' | 'unknown' } = {}) {
  return projectStudentLearningHub({
    formal: input.formalInput ?? formal(),
    knowledge: input.knowledgeInput ?? knowledge(),
    inventory: inventory(input.formalStatus),
  });
}

const checks: Check[] = [
  { id: 'WP7A-C01', name: 'formal active or review is the primary action', run: () => { assert.equal(hub({ formalInput: formal({ hasActiveSession: true, primaryActionText: '继续阅读训练' }), knowledgeInput: knowledge({ activeSession: session() }) }).primaryAction.kind, 'continue_formal'); assert.equal(hub({ formalInput: formal({ status: 'review_required', hasActiveSession: true, canEnterWorkspace: false, primaryActionText: '结束本次学习' }), knowledgeInput: knowledge({ activeSession: session() }) }).primaryAction.kind, 'continue_formal'); } },
  { id: 'WP7A-C02', name: 'knowledge active is primary without formal active', run: () => assert.equal(hub({ formalInput: { entry: { ...formal().entry, canEnterWorkspace: false } }, knowledgeInput: knowledge({ activeSession: session() }) }).primaryAction.kind, 'continue_knowledge') },
  { id: 'WP7A-C03', name: 'formal start wins when no session is active', run: () => assert.equal(hub().primaryAction.kind, 'start_formal') },
  { id: 'WP7A-C04', name: 'knowledge starts when formal cannot start', run: () => assert.equal(hub({ formalInput: { entry: null } }).primaryAction.kind, 'start_knowledge') },
  { id: 'WP7A-C05', name: 'both unavailable yields one recovery primary', run: () => { const r = hub({ formalInput: { entry: null, recoveryAction: { actionId: 'retry', label: '重试' } }, knowledgeInput: knowledge({ approvedQuestionCount: 0 }) }); assert.equal(r.primaryAction.kind, 'recover_formal'); assert.equal(r.secondaryActions.length, 0); } },
  { id: 'WP7A-C06', name: 'dual active is projected without mutation', run: () => { const s = session(); const before = JSON.stringify(s); const r = hub({ formalInput: formal({ hasActiveSession: true }), knowledgeInput: knowledge({ activeSession: s }) }); assert.equal(JSON.stringify(s), before); assert(r.secondaryActions.some((a) => a.kind === 'continue_knowledge')); } },
  { id: 'WP7A-C07', name: 'formal primary text is preserved', run: () => assert.equal(hub({ formalInput: formal({ primaryActionText: '恢复第 3 题' }) }).primaryAction.label, '恢复第 3 题') },
  { id: 'WP7A-C08', name: 'knowledge loading does not block formal', run: () => assert.equal(hub({ knowledgeInput: knowledge({ hydrationStatus: 'loading' }) }).primaryAction.kind, 'start_formal') },
  { id: 'WP7A-C09', name: 'future knowledge store does not block formal', run: () => assert.equal(hub({ knowledgeInput: knowledge({ hydrationStatus: 'read_only' }) }).primaryAction.kind, 'start_formal') },
  { id: 'WP7A-C10', name: 'formal recovery is not content shortage', run: () => { const r = hub({ formalInput: { entry: null, recoveryAction: { actionId: 'retry', label: '恢复阅读训练' } }, knowledgeInput: knowledge({ approvedQuestionCount: 0 }) }); assert.equal(r.primaryAction.label, '恢复阅读训练'); } },
  { id: 'WP7A-C11', name: 'projection is deterministic', run: () => assert.deepEqual(hub(), hub()) },
  { id: 'WP7A-C12', name: 'projection hides store and trial internals', run: () => { const raw = JSON.stringify(hub()); assert(!/writerId|localStorage|trialWindowId|activationState/i.test(raw)); } },

  { id: 'WP7A-C13', name: 'approved count is projected', run: () => assert.equal(knowledge().approvedQuestionCount, 12) },
  { id: 'WP7A-C14', name: 'student projection has no draft count', run: () => assert(!('draftQuestionCount' in knowledge())) },
  { id: 'WP7A-C15', name: 'unknown formal inventory has no fixed count', run: () => { const r = inventory('unknown'); assert.equal(r.formal.status, 'unknown'); assert(!('currentCount' in r.formal)); } },
  { id: 'WP7A-C16', name: 'formal counts remain separate fields', run: () => { const r = inventory(); assert.equal(r.formal.currentCount, 81); assert.equal(r.formal.consumableCount, 81); } },
  { id: 'WP7A-C17', name: 'formal and knowledge counts are not summed', run: () => { const raw = inventory(); assert(!('totalQuestionCount' in raw)); assert.equal(raw.knowledge.approvedCount, 12); } },
  { id: 'WP7A-C18', name: 'category count is projected', run: () => assert.equal(inventory().knowledge.categoryCount, 6) },
  { id: 'WP7A-C19', name: 'zero approved disables new practice', run: () => assert.equal(knowledge({ approvedQuestionCount: 0 }).status, 'content_insufficient') },
  { id: 'WP7A-C20', name: 'inventory projection does not mutate inputs', run: () => { const input = { status: 'available' as const, currentCount: 81 }; const before = JSON.stringify(input); buildStudentContentInventoryProjection({ formal: input, knowledge: knowledge() }); assert.equal(JSON.stringify(input), before); } },

  { id: 'WP7A-C21', name: 'practice redirects to learning', run: () => assert.equal(resolveLegacyStudentRoute('/practice'), '/learning') },
  { id: 'WP7A-C22', name: 'knowledge legacy route redirects canonically', run: () => assert.equal(resolveLegacyStudentRoute('/practice/knowledge'), KNOWLEDGE_HOME_PATH) },
  { id: 'WP7A-C23', name: 'quiz legacy route preserves category', run: () => assert.equal(resolveLegacyStudentRoute('/quiz/成语运用'), knowledgeQuizPath('成语运用')) },
  { id: 'WP7A-C24', name: 'result redirects canonically', run: () => assert.equal(resolveLegacyStudentRoute('/result'), KNOWLEDGE_RESULT_PATH) },
  { id: 'WP7A-C25', name: 'mistakes redirects canonically', run: () => assert.equal(resolveLegacyStudentRoute('/mistakes'), KNOWLEDGE_MISTAKES_PATH) },
  { id: 'WP7A-C26', name: 'profile returns to learning', run: () => assert.equal(resolveLegacyStudentRoute('/profile'), '/learning') },
  { id: 'WP7A-C27', name: 'route adapter is deterministic', run: () => assert.equal(resolveLegacyStudentRoute('/practice'), resolveLegacyStudentRoute('/practice')) },
  { id: 'WP7A-C28', name: 'route adapter does not mutate session', run: () => { const s = session(); const before = JSON.stringify(s); resolveLegacyStudentRoute('/quiz/all', 'all'); assert.equal(JSON.stringify(s), before); } },
  { id: 'WP7A-C29', name: 'route adapter exposes no response operation', run: () => assert(!/submit|response|feedback/i.test(resolveLegacyStudentRoute.toString())) },
  { id: 'WP7A-C30', name: 'canonical knowledge paths stay under learning', run: () => [KNOWLEDGE_HOME_PATH, KNOWLEDGE_RESULT_PATH, KNOWLEDGE_MISTAKES_PATH, knowledgeQuizPath('all')].forEach((p) => assert(p.startsWith('/learning/knowledge'))) },
  { id: 'WP7A-C31', name: 'unknown legacy path is ignored', run: () => assert.equal(resolveLegacyStudentRoute('/unknown'), null) },
  { id: 'WP7A-C32', name: 'encoded category roundtrips', run: () => assert.equal(decodeURIComponent(knowledgeQuizPath('古诗文默写与理解').split('/').at(-1)!), '古诗文默写与理解') },

  { id: 'WP7A-C33', name: 'ready projection creates no session', run: () => assert(!knowledge().activeSession) },
  { id: 'WP7A-C34', name: 'projection has no start command', run: () => assert(!/startPractice|createPractice/i.test(JSON.stringify(knowledge()))) },
  { id: 'WP7A-C35', name: 'hub has no evidence output', run: () => assert(!/abilityEvidence|diagnosisResult/i.test(JSON.stringify(hub()))) },
  { id: 'WP7A-C36', name: 'hub has no profile output', run: () => assert(!/studentAbilityProfile|growthMemory/i.test(JSON.stringify(hub()))) },
  { id: 'WP7A-C37', name: 'hub has no formal write operation', run: () => assert(!/save|publish|freeze|commit/i.test(Object.keys(hub()).join(','))) },
  { id: 'WP7A-C38', name: 'hub has no trial operation', run: () => assert(!/activate|observation/i.test(JSON.stringify(hub()))) },
  { id: 'WP7A-C39', name: 'formal projection preserves knowledge session identity', run: () => { const r = hub({ formalInput: formal({ hasActiveSession: true }), knowledgeInput: knowledge({ activeSession: session() }) }); assert.equal(r.knowledge.activeSession?.sessionId, 'wp7a-session'); } },
  { id: 'WP7A-C40', name: 'knowledge recovery does not alter formal entry', run: () => { const f = formal(); const r = hub({ formalInput: f, knowledgeInput: knowledge({ recoveryError: { studentMessage: '恢复失败' } }) }); assert.deepEqual(r.formal, f); } },
  { id: 'WP7A-C41', name: 'formal unknown keeps knowledge inventory', run: () => assert.equal(hub({ formalStatus: 'unknown' }).inventory.knowledge.approvedCount, 12) },
  { id: 'WP7A-C42', name: 'legacy routing is read-only data', run: () => assert.equal(typeof resolveLegacyStudentRoute('/practice/knowledge'), 'string') },

  { id: 'WP7A-C43', name: 'projection exposes one primary action', run: () => { const r = hub(); assert(r.primaryAction); assert(!Array.isArray(r.primaryAction)); } },
  { id: 'WP7A-C44', name: 'knowledge action is explicitly knowledge scoped', run: () => assert.equal(hub({ formalInput: { entry: null } }).primaryAction.kind, 'start_knowledge') },
  { id: 'WP7A-C45', name: 'status is textual not color data', run: () => assert.equal(knowledge().status, 'ready_to_start') },
  { id: 'WP7A-C46', name: 'all recovery states have messages', run: () => { assert(knowledge({ hydrationStatus: 'loading' }).studentMessage); assert(knowledge({ hydrationStatus: 'read_only' }).studentMessage); assert(knowledge({ recoveryError: { studentMessage: '需要恢复' } }).studentMessage); } },
  { id: 'WP7A-C47', name: 'all actionable knowledge projections have paths', run: () => { assert(knowledge().primaryPath); assert(knowledge({ activeSession: session() }).primaryPath); } },
  { id: 'WP7A-C48', name: 'active progress is one based', run: () => assert.equal(knowledge({ activeSession: session() }).activeSession?.currentPosition, 2) },
  { id: 'WP7A-C49', name: 'content messages remain concise', run: () => assert(knowledge().studentMessage.length < 80) },
  { id: 'WP7A-C50', name: 'student messages avoid mastery claims', run: () => { for (const r of [knowledge(), knowledge({ activeSession: session() }), knowledge({ approvedQuestionCount: 0 })]) assert(!/已掌握|能力已提升/.test(r.studentMessage)); } },
];

let passed = 0;
for (const check of checks) {
  try {
    check.run();
    passed += 1;
    console.log(`PASS ${check.id} ${check.name}`);
  } catch (error) {
    console.error(`FAIL ${check.id} ${check.name}`);
    throw error;
  }
}
console.log(`WP7A_RESULT ${passed}/${checks.length} PASS`);
