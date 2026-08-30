import assert from 'node:assert/strict';
import { buildPracticeSession } from '../../domain/knowledge-practice/practice/buildPracticeSession.ts';
import {
  createPracticeSeed,
  createPracticeSessionId,
  createSeededRandom,
  hashPracticeSeed,
  seededShuffle,
} from '../../domain/knowledge-practice/practice/practiceSeed.ts';
import {
  abandonPracticeSession,
  advancePracticeSession,
  markPracticeQueueItemAnswered,
} from '../../domain/knowledge-practice/practice/practiceSessionState.ts';
import { validatePracticeSession } from '../../domain/knowledge-practice/practice/practiceSessionValidator.ts';
import { selectPracticeQuestions } from '../../domain/knowledge-practice/practice/selectPracticeQuestions.ts';
import type { CompletedPracticeSessionSummary, PracticeSession } from '../../domain/knowledge-practice/practice/practiceSessionTypes.ts';
import { knowledgeQuestionRepository } from '../../domain/knowledge-practice/questions/knowledgeQuestionRepository.ts';
import type {
  KnowledgeQuestion,
  KnowledgeQuestionCategory,
  KnowledgeQuestionRepository,
  KnowledgeQuestionQuery,
} from '../../domain/knowledge-practice/questions/knowledgeQuestionTypes.ts';

type Check = { id: string; name: string; run: () => void };

const categories: KnowledgeQuestionCategory[] = [
  '字音字形', '成语运用', '病句辨析与修改', '标点符号', '文学文化常识', '古诗文默写与理解',
];
const base = knowledgeQuestionRepository.getApprovedById('q-cy-1')!;

function fakeQuestion(index: number, overrides: Partial<KnowledgeQuestion> = {}): KnowledgeQuestion {
  return {
    ...base,
    id: `fake-question-${String(index).padStart(2, '0')}`,
    category: categories[index % categories.length],
    difficulty: ((index % 3) + 1) as 1 | 2 | 3,
    contentVersion: 1,
    ...overrides,
  };
}

function makeRepository(questions: KnowledgeQuestion[]): KnowledgeQuestionRepository {
  const matches = (question: KnowledgeQuestion, query: KnowledgeQuestionQuery = {}) => (
    (!query.category || question.category === query.category) &&
    (!query.type || question.type === query.type) &&
    (!query.status || question.contentStatus === query.status) &&
    (!query.ids || query.ids.includes(question.id))
  );
  return {
    listApproved(query = {}) { return questions.filter((item) => item.contentStatus === 'approved' && matches(item, query)).map((item) => ({ ...item })); },
    listForContentReview(query = {}) { return questions.filter((item) => matches(item, query)).map((item) => ({ ...item })); },
    getApprovedById(id) { return questions.find((item) => item.id === id && item.contentStatus === 'approved'); },
    getByIdForContentReview(id) { return questions.find((item) => item.id === id); },
  };
}

function buildFixed(overrides = {}) {
  return buildPracticeSession({
    mode: 'mixed',
    now: '2026-08-28T10:00:00.000Z',
    idFactory: () => 'kp-session-fixed-0001',
    ...overrides,
  });
}

function completeSession(session: PracticeSession): PracticeSession {
  let current = session;
  while (current.status === 'active') {
    current = markPracticeQueueItemAnswered(current, current.queue[current.currentIndex].id, '2026-08-28T10:01:00.000Z');
    current = advancePracticeSession(current, '2026-08-28T10:02:00.000Z');
  }
  return current;
}

function expectSessionIssue(session: PracticeSession, code: string): void {
  const validation = validatePracticeSession(session);
  assert(validation.issues.some((issue) => issue.code === code), `Expected ${code}, got ${validation.issues.map((issue) => issue.code).join(', ')}`);
}

const checks: Check[] = [
  { id: 'WP2-SD01', name: 'seed hash has a fixed vector', run: () => assert.equal(hashPracticeSeed('knowledge-practice'), 3675152623) },
  { id: 'WP2-SD02', name: 'same seed yields same order', run: () => assert.deepEqual(seededShuffle([1, 2, 3, 4, 5], 'same'), seededShuffle([1, 2, 3, 4, 5], 'same')) },
  { id: 'WP2-SD03', name: 'shuffle does not mutate input', run: () => { const input = [1, 2, 3]; seededShuffle(input, 'x'); assert.deepEqual(input, [1, 2, 3]); } },
  { id: 'WP2-SD04', name: 'different seeds can change order', run: () => assert.notDeepEqual(seededShuffle([1, 2, 3, 4, 5, 6], 'a'), seededShuffle([1, 2, 3, 4, 5, 6], 'b')) },
  { id: 'WP2-SD05', name: 'seeded random stays in range', run: () => { const random = createSeededRandom(1); assert(Array.from({ length: 20 }, random).every((value) => value >= 0 && value < 1)); } },
  { id: 'WP2-SD06', name: 'practice seed includes session and mode', run: () => assert.equal(createPracticeSeed('session-1', 'mixed'), 'session-1|mixed|all') },
  { id: 'WP2-SD07', name: 'generated session id satisfies lowercase id contract', run: () => assert.match(createPracticeSessionId('2026-08-28T10:00:00.000Z', () => 'ABCD-EF12'), /^[a-z0-9][a-z0-9-]*$/) },

  { id: 'WP2-C01', name: 'category selects five from eight', run: () => {
    const result = selectPracticeQuestions({ mode: 'category', category: '字音字形', targetCount: 5, seed: 'c01', candidates: Array.from({ length: 8 }, (_, index) => fakeQuestion(index, { category: '字音字形' })) });
    assert.equal(result.questions.length, 5);
  } },
  { id: 'WP2-C02', name: 'category shortage returns actual count', run: () => {
    const result = selectPracticeQuestions({ mode: 'category', category: '字音字形', targetCount: 5, seed: 'c02', candidates: Array.from({ length: 3 }, (_, index) => fakeQuestion(index, { category: '字音字形' })) });
    assert.equal(result.questions.length, 3);
    assert(result.summary.relaxationCodes.includes('candidate_shortage'));
  } },
  { id: 'WP2-C04', name: 'category excludes other categories', run: () => {
    const result = selectPracticeQuestions({ mode: 'category', category: '字音字形', seed: 'c04', candidates: [fakeQuestion(1, { category: '字音字形' }), fakeQuestion(2, { category: '成语运用' })] });
    assert(result.questions.every((item) => item.category === '字音字形'));
  } },
  { id: 'WP2-C05', name: 'selector excludes draft', run: () => {
    const result = selectPracticeQuestions({ mode: 'category', category: '字音字形', seed: 'c05', candidates: [fakeQuestion(1, { category: '字音字形', contentStatus: 'draft' }), fakeQuestion(2, { category: '字音字形' })] });
    assert.equal(result.questions.length, 1);
  } },
  { id: 'WP2-C06', name: 'selector deduplicates ids', run: () => {
    const one = fakeQuestion(1, { category: '字音字形' });
    const result = selectPracticeQuestions({ mode: 'category', category: '字音字形', seed: 'c06', candidates: [one, { ...one }] });
    assert.equal(result.questions.length, 1);
  } },
  { id: 'WP2-C07', name: 'variant group is unique when alternatives suffice', run: () => {
    const candidates = Array.from({ length: 6 }, (_, index) => fakeQuestion(index, { category: '字音字形', variantGroupId: index < 2 ? 'same-group' : undefined }));
    const result = selectPracticeQuestions({ mode: 'category', category: '字音字形', targetCount: 5, seed: 'c07', candidates });
    assert.equal(result.questions.filter((item) => item.variantGroupId === 'same-group').length, 1);
  } },
  { id: 'WP2-C08', name: 'five questions meet 2/2/1 difficulty target', run: () => {
    const candidates = [
      ...Array.from({ length: 3 }, (_, index) => fakeQuestion(index, { category: '字音字形', difficulty: 1 })),
      ...Array.from({ length: 3 }, (_, index) => fakeQuestion(index + 10, { category: '字音字形', difficulty: 2 })),
      ...Array.from({ length: 2 }, (_, index) => fakeQuestion(index + 20, { category: '字音字形', difficulty: 3 })),
    ];
    const result = selectPracticeQuestions({ mode: 'category', category: '字音字形', targetCount: 5, seed: 'c08', candidates });
    assert.deepEqual(result.summary.difficultyCounts, { 1: 2, 2: 2, 3: 1 });
  } },
  { id: 'WP2-C09', name: 'missing hard questions relaxes difficulty quota', run: () => {
    const candidates = Array.from({ length: 6 }, (_, index) => fakeQuestion(index, { category: '字音字形', difficulty: index < 3 ? 1 : 2 }));
    const result = selectPracticeQuestions({ mode: 'category', category: '字音字形', targetCount: 5, seed: 'c09', candidates });
    assert(result.summary.relaxationCodes.includes('difficulty_quota_relaxed'));
  } },
  { id: 'WP2-C10', name: 'invalid target count is rejected', run: () => assert.throws(() => selectPracticeQuestions({ mode: 'mixed', targetCount: 0, seed: 'x', candidates: [] })) },

  { id: 'WP2-M01', name: 'current approved set yields ten mixed questions', run: () => {
    const result = selectPracticeQuestions({ mode: 'mixed', seed: 'm01', candidates: knowledgeQuestionRepository.listApproved() });
    assert.equal(result.questions.length, 10);
  } },
  { id: 'WP2-M02', name: 'mixed selection covers all six available categories', run: () => {
    const result = selectPracticeQuestions({ mode: 'mixed', seed: 'm02', candidates: knowledgeQuestionRepository.listApproved() });
    assert.equal(new Set(result.questions.map((item) => item.category)).size, 6);
  } },
  { id: 'WP2-M03', name: 'mixed selection covers at least three categories', run: () => {
    const result = selectPracticeQuestions({ mode: 'mixed', seed: 'm03', candidates: Array.from({ length: 15 }, (_, index) => fakeQuestion(index)) });
    assert(new Set(result.questions.map((item) => item.category)).size >= 3);
  } },
  { id: 'WP2-M04', name: 'category cap stays at forty percent when feasible', run: () => {
    const candidates = [
      ...Array.from({ length: 8 }, (_, index) => fakeQuestion(index, { category: '字音字形' })),
      ...Array.from({ length: 4 }, (_, index) => fakeQuestion(index + 20, { category: '成语运用' })),
      ...Array.from({ length: 4 }, (_, index) => fakeQuestion(index + 30, { category: '标点符号' })),
    ];
    const result = selectPracticeQuestions({ mode: 'mixed', targetCount: 10, seed: 'm04', candidates });
    assert(Math.max(...Object.values(result.summary.categoryCounts)) <= 4);
  } },
  { id: 'WP2-M05', name: 'two categories record coverage relaxation', run: () => {
    const candidates = Array.from({ length: 12 }, (_, index) => fakeQuestion(index, { category: index < 6 ? '字音字形' : '成语运用' }));
    const result = selectPracticeQuestions({ mode: 'mixed', targetCount: 10, seed: 'm05', candidates });
    assert(result.summary.relaxationCodes.includes('category_coverage_relaxed'));
  } },
  { id: 'WP2-M06', name: 'mixed shortage never duplicates', run: () => {
    const result = selectPracticeQuestions({ mode: 'mixed', targetCount: 10, seed: 'm06', candidates: Array.from({ length: 4 }, (_, index) => fakeQuestion(index)) });
    assert.equal(result.questions.length, 4);
    assert.equal(new Set(result.questions.map((item) => item.id)).size, 4);
  } },
  { id: 'WP2-M07', name: 'variant group relaxation happens last', run: () => {
    const candidates = Array.from({ length: 6 }, (_, index) => fakeQuestion(index, { variantGroupId: index < 2 ? 'same-group' : undefined }));
    const result = selectPracticeQuestions({ mode: 'mixed', targetCount: 6, seed: 'm07', candidates });
    assert.equal(result.questions.length, 6);
    assert(result.summary.relaxationCodes.includes('variant_group_relaxed'));
  } },
  { id: 'WP2-M08', name: 'current set records missing hard difficulty', run: () => {
    const result = selectPracticeQuestions({ mode: 'mixed', seed: 'm08', candidates: knowledgeQuestionRepository.listApproved() });
    assert(result.summary.relaxationCodes.includes('difficulty_quota_relaxed'));
  } },

  { id: 'WP2-R01', name: 'fresh candidates exclude two recent sessions when sufficient', run: () => {
    const candidates = Array.from({ length: 15 }, (_, index) => fakeQuestion(index, { category: '字音字形' }));
    const history: CompletedPracticeSessionSummary[] = [
      { sessionId: 'latest', completedAt: '2026-08-28T10:00:00Z', baseQuestionIds: candidates.slice(0, 5).map((item) => item.id) },
      { sessionId: 'second', completedAt: '2026-08-27T10:00:00Z', baseQuestionIds: candidates.slice(5, 10).map((item) => item.id) },
    ];
    const result = selectPracticeQuestions({ mode: 'category', category: '字音字形', targetCount: 5, seed: 'r01', candidates, recentCompletedSessions: history });
    assert(result.questions.every((item) => Number(item.id.slice(-2)) >= 10));
  } },
  { id: 'WP2-R02', name: 'second session is reused before latest', run: () => {
    const candidates = Array.from({ length: 12 }, (_, index) => fakeQuestion(index, { category: '字音字形' }));
    const history: CompletedPracticeSessionSummary[] = [
      { sessionId: 'latest', completedAt: '2026-08-28T10:00:00Z', baseQuestionIds: candidates.slice(0, 5).map((item) => item.id) },
      { sessionId: 'second', completedAt: '2026-08-27T10:00:00Z', baseQuestionIds: candidates.slice(5, 10).map((item) => item.id) },
    ];
    const result = selectPracticeQuestions({ mode: 'category', category: '字音字形', targetCount: 5, seed: 'r02', candidates, recentCompletedSessions: history });
    assert(result.summary.relaxationCodes.includes('recent_second_session_reused'));
    assert(!result.summary.relaxationCodes.includes('recent_latest_session_reused'));
  } },
  { id: 'WP2-R03', name: 'latest session is reused only when still necessary', run: () => {
    const candidates = Array.from({ length: 8 }, (_, index) => fakeQuestion(index, { category: '字音字形' }));
    const history: CompletedPracticeSessionSummary[] = [
      { sessionId: 'latest', completedAt: '2026-08-28T10:00:00Z', baseQuestionIds: candidates.slice(0, 3).map((item) => item.id) },
      { sessionId: 'second', completedAt: '2026-08-27T10:00:00Z', baseQuestionIds: candidates.slice(3, 6).map((item) => item.id) },
    ];
    const result = selectPracticeQuestions({ mode: 'category', category: '字音字形', targetCount: 8, seed: 'r03', candidates, recentCompletedSessions: history });
    assert(result.summary.relaxationCodes.includes('recent_latest_session_reused'));
  } },
  { id: 'WP2-R05', name: 'history older than two sessions is ignored', run: () => {
    const candidates = Array.from({ length: 6 }, (_, index) => fakeQuestion(index, { category: '字音字形' }));
    const history: CompletedPracticeSessionSummary[] = [
      { sessionId: 'one', completedAt: '2026-08-28T10:00:00Z', baseQuestionIds: [] },
      { sessionId: 'two', completedAt: '2026-08-27T10:00:00Z', baseQuestionIds: [] },
      { sessionId: 'old', completedAt: '2026-08-26T10:00:00Z', baseQuestionIds: candidates.map((item) => item.id) },
    ];
    const result = selectPracticeQuestions({ mode: 'category', category: '字音字形', targetCount: 5, seed: 'r05', candidates, recentCompletedSessions: history });
    assert.equal(result.summary.reusedRecentQuestionCount, 0);
  } },

  { id: 'WP2-B01', name: 'category build creates active session', run: () => {
    const result = buildFixed({ mode: 'category', category: '字音字形', targetCount: 5 });
    assert(result.ok && result.session.status === 'active' && result.session.actualBaseQuestionCount === 5);
  } },
  { id: 'WP2-B02', name: 'mixed build creates ten-question session', run: () => {
    const result = buildFixed(); assert(result.ok && result.session.actualBaseQuestionCount === 10);
  } },
  { id: 'WP2-B03', name: 'category requires category', run: () => {
    const result = buildFixed({ mode: 'category' }); assert(!result.ok && result.error.code === 'category_required');
  } },
  { id: 'WP2-B04', name: 'mixed forbids category', run: () => {
    const result = buildFixed({ category: '字音字形' }); assert(!result.ok && result.error.code === 'category_not_allowed_for_mixed');
  } },
  { id: 'WP2-B05', name: 'empty repository returns domain error', run: () => {
    const result = buildFixed({ repository: makeRepository([]) }); assert(!result.ok && result.error.code === 'no_approved_questions');
  } },
  { id: 'WP2-B06', name: 'fixed id and time produce repeatable session', run: () => assert.deepEqual(buildFixed(), buildFixed()) },
  { id: 'WP2-B07', name: 'queue aligns with base ids', run: () => {
    const result = buildFixed(); assert(result.ok); assert.deepEqual(result.session.queue.map((item) => item.questionId), result.session.baseQuestionIds);
  } },
  { id: 'WP2-B08', name: 'queue freezes question content version', run: () => {
    const result = buildFixed(); assert(result.ok); assert(result.session.queue.every((item) => item.questionContentVersion === knowledgeQuestionRepository.getApprovedById(item.questionId)?.contentVersion));
  } },
  { id: 'WP2-B09', name: 'selection summary matches session', run: () => {
    const result = buildFixed(); assert(result.ok); assert.equal(result.session.selectionSummary.selectedCount, result.session.actualBaseQuestionCount);
  } },

  { id: 'WP2-ST01', name: 'unanswered current item cannot advance', run: () => {
    const result = buildFixed(); assert(result.ok); assert.strictEqual(advancePracticeSession(result.session, '2026-08-28T10:01:00Z'), result.session);
  } },
  { id: 'WP2-ST02', name: 'mark answered is immutable', run: () => {
    const result = buildFixed(); assert(result.ok); const original = result.session; const next = markPracticeQueueItemAnswered(original, original.queue[0].id, '2026-08-28T10:01:00Z'); assert.notStrictEqual(next, original); assert.equal(original.queue[0].status, 'pending'); assert.equal(next.queue[0].status, 'answered');
  } },
  { id: 'WP2-ST03', name: 'answered non-final item advances', run: () => {
    const result = buildFixed(); assert(result.ok); const marked = markPracticeQueueItemAnswered(result.session, result.session.queue[0].id, '2026-08-28T10:01:00Z'); assert.equal(advancePracticeSession(marked, '2026-08-28T10:02:00Z').currentIndex, 1);
  } },
  { id: 'WP2-ST04', name: 'last answered item completes session', run: () => {
    const result = buildFixed(); assert(result.ok); const completed = completeSession(result.session); assert.equal(completed.status, 'completed'); assert(completed.completedAt);
  } },
  { id: 'WP2-ST05', name: 'completed session cannot advance again', run: () => {
    const result = buildFixed(); assert(result.ok); const completed = completeSession(result.session); assert.strictEqual(advancePracticeSession(completed, '2026-08-28T11:00:00Z'), completed);
  } },
  { id: 'WP2-ST06', name: 'duplicate base ids fail validation', run: () => {
    const result = buildFixed(); assert(result.ok); const session = structuredClone(result.session); session.baseQuestionIds[1] = session.baseQuestionIds[0]; expectSessionIssue(session, 'session.base_question_duplicate');
  } },
  { id: 'WP2-ST07', name: 'queue mismatch fails validation', run: () => {
    const result = buildFixed(); assert(result.ok); const session = structuredClone(result.session); session.queue[0].questionId = 'wrong'; expectSessionIssue(session, 'session.queue_question_mismatch');
  } },
  { id: 'WP2-ST08', name: 'out-of-range index fails validation', run: () => {
    const result = buildFixed(); assert(result.ok); const session = structuredClone(result.session); session.currentIndex = 99; expectSessionIssue(session, 'session.current_index_invalid');
  } },
  { id: 'WP2-ST09', name: 'session survives json serialization', run: () => {
    const result = buildFixed(); assert(result.ok); const restored = JSON.parse(JSON.stringify(result.session)); assert(validatePracticeSession(restored).passed); assert.deepEqual(restored, result.session);
  } },
  { id: 'WP2-ST10', name: 'abandon moves active session to terminal state', run: () => {
    const result = buildFixed(); assert(result.ok); const abandoned = abandonPracticeSession(result.session, '2026-08-28T10:03:00Z'); assert.equal(abandoned.status, 'abandoned'); assert(validatePracticeSession(abandoned).passed);
  } },
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

console.log(`WP2_RESULT ${passed}/${checks.length} PASS`);
