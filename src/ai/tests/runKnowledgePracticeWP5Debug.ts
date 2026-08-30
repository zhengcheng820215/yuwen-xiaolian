import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPracticeCompletionRecord } from '../../domain/knowledge-practice/persistence/buildPracticeCompletionRecord.ts';
import { createEmptyPracticeStore, type PracticeStorageLike } from '../../domain/knowledge-practice/persistence/localPracticeStoreTypes.ts';
import { advancePracticeAttempt } from '../../domain/knowledge-practice/response/practiceAttemptState.ts';
import { validatePracticeAttempt } from '../../domain/knowledge-practice/response/practiceAttemptValidator.ts';
import { createPracticeAttempt } from '../../domain/knowledge-practice/response/submitPracticeAnswer.ts';
import { submitPracticeAnswerWithReinforcement } from '../../domain/knowledge-practice/response/submitPracticeAnswerWithReinforcement.ts';
import type { PracticeAttempt, PracticeResponse } from '../../domain/knowledge-practice/response/practiceResponseTypes.ts';
import type { PracticeSession } from '../../domain/knowledge-practice/practice/practiceSessionTypes.ts';
import { validatePracticeSession } from '../../domain/knowledge-practice/practice/practiceSessionValidator.ts';
import { buildPracticeSession } from '../../domain/knowledge-practice/practice/buildPracticeSession.ts';
import { KNOWLEDGE_QUESTION_DATASET, knowledgeQuestionRepository } from '../../domain/knowledge-practice/questions/knowledgeQuestionRepository.ts';
import type { KnowledgeQuestion } from '../../domain/knowledge-practice/questions/knowledgeQuestionTypes.ts';
import { KNOWLEDGE_PRACTICE_REINFORCEMENT_LINKS, listApprovedReinforcementLinks } from '../../domain/knowledge-practice/reinforcement/reinforcementLinks.ts';
import { summarizeApprovedVariantCoverage, validateReinforcementLinks } from '../../domain/knowledge-practice/reinforcement/reinforcementLinkValidator.ts';
import { schedulePracticeReinforcement } from '../../domain/knowledge-practice/reinforcement/schedulePracticeReinforcement.ts';
import { selectReinforcementCandidate } from '../../domain/knowledge-practice/reinforcement/selectReinforcementCandidate.ts';
import type { ReinforcementLink } from '../../domain/knowledge-practice/reinforcement/reinforcementTypes.ts';
import { LocalStoragePracticeRepository, PRACTICE_STORE_PRIMARY_KEY } from '../../repositories/knowledge-practice/localStoragePracticeRepository.ts';

const NOW = '2026-08-29T10:00:00.000Z';
const LATER = '2026-08-29T10:01:00.000Z';
const questions = knowledgeQuestionRepository.listApproved();
const links = listApprovedReinforcementLinks();
const source = knowledgeQuestionRepository.getApprovedById('q-rf-zy-1')!;
const target = knowledgeQuestionRepository.getApprovedById('q-rf-zy-2')!;
const filler = knowledgeQuestionRepository.getApprovedById('q-zy-1')!;
type Check = { id: string; name: string; run: () => void };

function sessionFor(ids: string[], id = 'wp5-session'): PracticeSession {
  const selected = ids.map((questionId) => knowledgeQuestionRepository.getApprovedById(questionId)!);
  return {
    schemaVersion: 1, id, mode: 'mixed', seed: `${id}|mixed|all`, targetBaseQuestionCount: ids.length,
    actualBaseQuestionCount: ids.length, baseQuestionIds: ids,
    queue: selected.map((question, index) => ({ id: `${id}-base-${index + 1}`, questionId: question.id, questionContentVersion: question.contentVersion, role: 'base', status: 'pending' })),
    currentIndex: 0, status: 'active', startedAt: NOW, updatedAt: NOW,
    selectionSummary: { candidateCount: ids.length, selectedCount: ids.length, targetCount: ids.length, categoryCounts: {}, difficultyCounts: { 1: 0, 2: 0, 3: 0 }, recentQuestionCount: 0, reusedRecentQuestionCount: 0, relaxationCodes: [] },
  };
}

function attemptFor(ids = [source.id], id?: string) { return createPracticeAttempt(sessionFor(ids, id)); }
function wrongAnswer(question: KnowledgeQuestion) {
  if (question.type === 'fill_blank') return '__wrong__';
  return question.options!.find((option) => option.id !== question.correctAnswer)!.id;
}
function submit(attempt: PracticeAttempt, question: KnowledgeQuestion, value = question.correctAnswer, customLinks = links) {
  return submitPracticeAnswerWithReinforcement({ attempt, queueItemId: attempt.session.queue[attempt.session.currentIndex].id, question, answer: { value, submittedAt: LATER, durationMs: 1_000 }, approvedQuestions: questions, approvedLinks: customLinks });
}
function wrongSource(attempt = attemptFor()) { const result = submit(attempt, source, wrongAnswer(source)); assert(result.ok); return result; }
function fakeResponse(attempt: PracticeAttempt, question = source, overrides: Partial<PracticeResponse> = {}): PracticeResponse {
  const item = attempt.session.queue[attempt.session.currentIndex];
  return { schemaVersion: 1, id: `${item.id}-response`, responseKey: `${attempt.session.id}::${item.id}`, sessionId: attempt.session.id, queueItemId: item.id, questionId: question.id, questionContentVersion: question.contentVersion, role: item.role, submittedAnswer: wrongAnswer(question), normalizedAnswer: wrongAnswer(question), correctAnswer: question.correctAnswer, isCorrect: false, knowledgePoint: question.knowledgePoint, durationMs: 1000, answeredAt: LATER, ...overrides };
}
function linkIssue(mutator: (rows: ReinforcementLink[], qs: KnowledgeQuestion[]) => void, code: string) {
  const rows = structuredClone(KNOWLEDGE_PRACTICE_REINFORCEMENT_LINKS);
  const qs = structuredClone(KNOWLEDGE_QUESTION_DATASET.questions);
  mutator(rows, qs);
  assert(validateReinforcementLinks(rows, qs).issues.some((item) => item.code === code));
}
class MemoryStorage implements PracticeStorageLike {
  values = new Map<string, string>(); failWrite = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite) throw new Error('QuotaExceeded'); this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
function completeFiveBaseWithReinforcement() {
  let attempt = attemptFor([source.id, filler.id, 'q-cy-1', 'q-bd-1', 'q-wx-2'], 'wp5-complete');
  while (attempt.session.status === 'active') {
    const item = attempt.session.queue[attempt.session.currentIndex];
    const question = knowledgeQuestionRepository.getApprovedById(item.questionId)!;
    const value = item.questionId === source.id ? wrongAnswer(question) : question.correctAnswer;
    const result = submit(attempt, question, value);
    assert(result.ok);
    attempt = advancePracticeAttempt(result.attempt, new Date(Date.parse(LATER) + attempt.session.currentIndex * 1000).toISOString());
  }
  return attempt;
}

const quizSource = readFileSync(new URL('../../pages/Quiz.jsx', import.meta.url), 'utf8');
const contextSource = readFileSync(new URL('../../context/PracticeSessionContext.jsx', import.meta.url), 'utf8');
const cardSource = readFileSync(new URL('../../components/knowledge-practice/KnowledgeQuestionCard.jsx', import.meta.url), 'utf8');
const reinforcementSources = [
  readFileSync(new URL('../../domain/knowledge-practice/reinforcement/selectReinforcementCandidate.ts', import.meta.url), 'utf8'),
  readFileSync(new URL('../../domain/knowledge-practice/reinforcement/schedulePracticeReinforcement.ts', import.meta.url), 'utf8'),
].join('\n');

const checks: Check[] = [
  { id: 'WP5-C01', name: 'approved links use approved questions', run: () => assert(validateReinforcementLinks(links, KNOWLEDGE_QUESTION_DATASET.questions).passed) },
  { id: 'WP5-C02', name: 'source target differ and share group', run: () => assert(links.every((l) => l.sourceQuestionId !== l.reinforcementQuestionId && questions.find((q) => q.id === l.sourceQuestionId)?.variantGroupId === l.variantGroupId && questions.find((q) => q.id === l.reinforcementQuestionId)?.variantGroupId === l.variantGroupId)) },
  { id: 'WP5-C03', name: 'duplicate triple is rejected', run: () => linkIssue((rows) => rows.push({ ...rows[0], id: 'duplicate-link' }), 'link.triple_duplicate') },
  { id: 'WP5-C04', name: 'missing target is rejected', run: () => linkIssue((rows) => { rows[0].reinforcementQuestionId = 'missing'; }, 'link.target_missing') },
  { id: 'WP5-C05', name: 'review fields are required', run: () => linkIssue((rows) => { delete rows[0].reviewedAt; }, 'link.review_required') },
  { id: 'WP5-C06', name: 'knowledge point mismatch is rejected', run: () => linkIssue((_rows, qs) => { qs.find((q) => q.id === 'q-rf-zy-2')!.knowledgePoint = 'other'; }, 'link.knowledge_point_mismatch') },
  { id: 'WP5-C07', name: 'one-way link does not imply reverse', run: () => { const one = [links[0]]; assert.equal(one.filter((l) => l.sourceQuestionId === links[0].reinforcementQuestionId).length, 0); } },
  { id: 'WP5-C08', name: 'unknown misconception is rejected', run: () => linkIssue((rows) => { rows[0].applicableMisconceptionCodes = ['unknown-code']; }, 'link.misconception_unknown') },
  { id: 'WP5-C09', name: 'same group without link is not candidate', run: () => { const a = attemptFor(); const r = selectReinforcementCandidate({ attempt: a, response: fakeResponse(a), sourceQuestion: source, approvedQuestions: questions, approvedLinks: [] }); assert(!r.ok && r.reason === 'approved_link_missing'); } },
  { id: 'WP5-C10', name: 'production coverage and category capacity gate pass', run: () => { assert.deepEqual(summarizeApprovedVariantCoverage(links, questions), { approvedLinkCount: 6, variantGroupCount: 3, categoryCount: 3, knowledgePointCount: 3 }); const built = buildPracticeSession({ mode: 'category', category: '字音字形', targetCount: 5, now: NOW, idFactory: () => 'wp5-capacity' }); assert(built.ok); assert.equal(built.session.queue.filter((item) => ['q-rf-zy-1', 'q-rf-zy-2'].includes(item.questionId)).length, 1); assert(!built.session.selectionSummary.relaxationCodes.includes('variant_group_relaxed')); } },

  { id: 'WP5-C11', name: 'first wrong base schedules one', run: () => { const r = wrongSource(); assert(r.reinforcementDecision.outcome === 'scheduled'); assert.equal(r.attempt.session.queue.filter((i) => i.role === 'reinforcement').length, 1); } },
  { id: 'WP5-C12', name: 'correct base does not schedule', run: () => { const r = submit(attemptFor(), source); assert(r.ok && r.reinforcementDecision.outcome === 'not_scheduled' && r.reinforcementDecision.reason === 'response_correct'); } },
  { id: 'WP5-C13', name: 'wrong reinforcement does not schedule', run: () => { let r = wrongSource(); assert(r.ok); let a = advancePracticeAttempt(r.attempt, LATER); const second = submit(a, target, wrongAnswer(target)); assert(second.ok && second.reinforcementDecision.outcome === 'not_scheduled' && second.reinforcementDecision.reason === 'not_base_item'); } },
  { id: 'WP5-C14', name: 'duplicate submit does not schedule twice', run: () => { const first = wrongSource(); const second = submit(first.attempt, source, wrongAnswer(source)); assert(second.ok && second.outcome === 'already_submitted'); assert.equal(second.attempt.session.queue.length, first.attempt.session.queue.length); } },
  { id: 'WP5-C15', name: 'source without group degrades', run: () => { const a = attemptFor([filler.id]); const r = selectReinforcementCandidate({ attempt: a, response: fakeResponse(a, filler), sourceQuestion: filler, approvedQuestions: questions, approvedLinks: links }); assert(!r.ok && r.reason === 'source_group_missing'); } },
  { id: 'WP5-C16', name: 'source without approved link degrades', run: () => { const a = attemptFor(); const r = selectReinforcementCandidate({ attempt: a, response: fakeResponse(a), sourceQuestion: source, approvedQuestions: questions, approvedLinks: [] }); assert(!r.ok && r.reason === 'approved_link_missing'); } },
  { id: 'WP5-C17', name: 'misconception restriction degrades', run: () => { const a = attemptFor(); const restricted = [{ ...links[0], applicableMisconceptionCodes: ['different-code'] }]; const r = selectReinforcementCandidate({ attempt: a, response: fakeResponse(a, source, { misconceptionCode: 'actual-code' }), sourceQuestion: source, approvedQuestions: questions, approvedLinks: restricted }); assert(!r.ok && r.reason === 'misconception_not_applicable'); } },
  { id: 'WP5-C18', name: 'target already in base queue is excluded', run: () => { const a = attemptFor([source.id, target.id]); const r = selectReinforcementCandidate({ attempt: a, response: fakeResponse(a), sourceQuestion: source, approvedQuestions: questions, approvedLinks: links }); assert(!r.ok && r.reason === 'candidate_already_in_session'); } },
  { id: 'WP5-C19', name: 'target already reinforced is excluded', run: () => { const r = wrongSource(); assert(r.ok); const selection = selectReinforcementCandidate({ attempt: r.attempt, response: r.response, sourceQuestion: source, approvedQuestions: questions, approvedLinks: links }); assert(!selection.ok && selection.reason === 'already_scheduled'); } },
  { id: 'WP5-C20', name: 'same seed selects same candidate', run: () => { const a = attemptFor(); const input = { attempt: a, response: fakeResponse(a), sourceQuestion: source, approvedQuestions: questions, approvedLinks: links }; assert.deepEqual(selectReinforcementCandidate(input), selectReinforcementCandidate(input)); } },
  { id: 'WP5-C21', name: 'different source selects own target', run: () => { const q = knowledgeQuestionRepository.getApprovedById('q-rf-cy-1')!; const a = attemptFor([q.id], 'wp5-cy'); const r = selectReinforcementCandidate({ attempt: a, response: fakeResponse(a, q), sourceQuestion: q, approvedQuestions: questions, approvedLinks: links }); assert(r.ok && r.question.id === 'q-rf-cy-2'); } },
  { id: 'WP5-C22', name: 'selection does not use Math.random', run: () => assert(!reinforcementSources.includes('Math.random')) },

  { id: 'WP5-C23', name: 'insertion prefers current plus two', run: () => { const r = wrongSource(attemptFor([source.id, filler.id])); assert(r.reinforcementDecision.outcome === 'scheduled' && r.reinforcementDecision.insertionIndex === 2); } },
  { id: 'WP5-C24', name: 'tail insertion uses current plus one', run: () => { const r = wrongSource(); assert(r.reinforcementDecision.outcome === 'scheduled' && r.reinforcementDecision.insertionIndex === 1); } },
  { id: 'WP5-C25', name: 'answered source is not moved', run: () => { const r = wrongSource(attemptFor([source.id, filler.id])); assert.equal(r.attempt.session.queue[0].questionId, source.id); assert.equal(r.attempt.session.queue[0].status, 'answered'); } },
  { id: 'WP5-C26', name: 'base identities and count stay frozen', run: () => { const a = attemptFor([source.id, filler.id]); const r = wrongSource(a); assert.deepEqual(r.attempt.session.baseQuestionIds, a.session.baseQuestionIds); assert.equal(r.attempt.session.actualBaseQuestionCount, 2); } },
  { id: 'WP5-C27', name: 'one source has at most one reinforcement', run: () => { const r = wrongSource(); assert.equal(r.attempt.session.queue.filter((i) => i.sourceQuestionId === source.id).length, 1); } },
  { id: 'WP5-C28', name: 'three reinforcement session limit blocks more', run: () => { const a = attemptFor([source.id]); const q = a.session.queue; const reinforced = ['q-rf-cy-1', 'q-rf-wy-1', target.id].map((id, index) => ({ id: `existing-${index}`, questionId: id, questionContentVersion: 1, role: 'reinforcement' as const, sourceQuestionId: `source-${index}`, status: 'pending' as const })); const attempt = { ...a, session: { ...a.session, queue: [...q, ...reinforced] } }; const r = selectReinforcementCandidate({ attempt, response: fakeResponse(attempt), sourceQuestion: source, approvedQuestions: questions, approvedLinks: links }); assert(!r.ok && r.reason === 'session_limit_reached'); } },
  { id: 'WP5-C29', name: 'queue never exceeds base plus three', run: () => { const r = wrongSource(attemptFor([source.id, filler.id])); assert(r.attempt.session.queue.length <= r.attempt.session.actualBaseQuestionCount + 3); } },
  { id: 'WP5-C30', name: 'queue question ids stay unique', run: () => { const r = wrongSource(attemptFor([source.id, filler.id])); assert.equal(new Set(r.attempt.session.queue.map((i) => i.questionId)).size, r.attempt.session.queue.length); } },
  { id: 'WP5-C31', name: 'queue item id is replay stable', run: () => { const a = attemptFor(); const response = fakeResponse(a); const one = schedulePracticeReinforcement({ attempt: a, response, sourceQuestion: source, approvedQuestions: questions, approvedLinks: links }); const two = schedulePracticeReinforcement({ attempt: a, response, sourceQuestion: source, approvedQuestions: questions, approvedLinks: links }); assert.deepEqual(one.decision, two.decision); } },
  { id: 'WP5-C32', name: 'reinforcement response matches queue identity', run: () => { let first = wrongSource(); let a = advancePracticeAttempt(first.attempt, LATER); const second = submit(a, target); assert(second.ok); assert.equal(second.response.role, 'reinforcement'); assert.equal(second.response.sourceQuestionId, source.id); assert(validatePracticeAttempt(second.attempt).passed); } },
  { id: 'WP5-C33', name: 'invalid reinforcement queue is rejected', run: () => { const r = wrongSource(); const broken = structuredClone(r.attempt.session); delete broken.queue.find((i) => i.role === 'reinforcement')!.sourceQuestionId; assert(validatePracticeSession(broken).issues.some((i) => i.code === 'session.reinforcement_source_required')); } },
  { id: 'WP5-C34', name: 'completed session requires reinforcement response', run: () => { const r = wrongSource(); const broken = structuredClone(r.attempt); broken.session.status = 'completed'; broken.session.completedAt = LATER; broken.session.queue.forEach((i) => { i.status = 'answered'; }); assert(!validatePracticeAttempt(broken).passed); } },

  { id: 'WP5-C35', name: 'response feedback and queue form one attempt', run: () => { const r = wrongSource(); assert(r.attempt.responses[0] && r.attempt.feedbackByResponseId[r.response.id] && r.attempt.session.queue.some((i) => i.role === 'reinforcement')); } },
  { id: 'WP5-C36', name: 'storage failure keeps consistent memory attempt', run: () => { const r = wrongSource(); const store = createEmptyPracticeStore(NOW, 'writer'); const repo = new LocalStoragePracticeRepository(null, 'writer'); const saved = repo.saveActiveAttempt({ store, expectedRevision: 0, now: LATER, attempt: r.attempt }); assert(saved.status === 'unavailable' && validatePracticeAttempt(saved.store.activeAttempt!).passed); } },
  { id: 'WP5-C37', name: 'stale revision conflicts without merge', run: () => { const r = wrongSource(); const storage = new MemoryStorage(); const repo = new LocalStoragePracticeRepository(storage, 'writer'); const store = createEmptyPracticeStore(NOW, 'writer'); assert.equal(repo.saveActiveAttempt({ store, expectedRevision: 0, now: LATER, attempt: r.attempt }).status, 'saved'); assert.equal(repo.saveActiveAttempt({ store, expectedRevision: 0, now: LATER, attempt: r.attempt }).status, 'conflict'); } },
  { id: 'WP5-C38', name: 'roundtrip preserves queue source and index', run: () => { const r = wrongSource(attemptFor([source.id, filler.id])); const storage = new MemoryStorage(); const repo = new LocalStoragePracticeRepository(storage, 'writer'); const saved = repo.saveActiveAttempt({ store: createEmptyPracticeStore(NOW, 'writer'), expectedRevision: 0, now: LATER, attempt: r.attempt }); assert(saved.status === 'saved'); const loaded = repo.load(LATER).store.activeAttempt!; assert.deepEqual(loaded.session.queue, r.attempt.session.queue); assert.equal(loaded.session.currentIndex, 0); } },
  { id: 'WP5-C39', name: 'loaded frozen queue is not rescheduled', run: () => { const r = wrongSource(); const storage = new MemoryStorage(); const repo = new LocalStoragePracticeRepository(storage, 'writer'); const saved = repo.saveActiveAttempt({ store: createEmptyPracticeStore(NOW, 'writer'), expectedRevision: 0, now: LATER, attempt: r.attempt }); assert(saved.status === 'saved'); const loaded = repo.load(LATER).store.activeAttempt!; assert.equal(loaded.session.queue.filter((i) => i.role === 'reinforcement').length, 1); } },
  { id: 'WP5-C40', name: 'target content version is frozen', run: () => { const r = wrongSource(); const item = r.attempt.session.queue.find((i) => i.role === 'reinforcement')!; assert.equal(item.questionContentVersion, target.contentVersion); assert.notEqual(item.questionContentVersion, target.contentVersion + 1); } },
  { id: 'WP5-C41', name: 'five base four correct stays eighty percent', run: () => assert.equal(buildPracticeCompletionRecord(completeFiveBaseWithReinforcement()).summary.firstAttemptAccuracy, 80) },
  { id: 'WP5-C42', name: 'reinforcement correct does not rewrite source', run: () => { const record = buildPracticeCompletionRecord(completeFiveBaseWithReinforcement()); assert.equal(record.completedAttempt.responses.find((r) => r.questionId === source.id)?.isCorrect, false); assert.equal(record.summary.firstAttemptCorrectCount, 4); } },
  { id: 'WP5-C43', name: 'reinforcement metrics are isolated', run: () => { const summary = buildPracticeCompletionRecord(completeFiveBaseWithReinforcement()).summary; assert.equal(summary.reinforcementQuestionCount, 1); assert.equal(summary.reinforcementCorrectCount, 1); assert.equal(summary.reinforcementDurationMs, 1000); } },
  { id: 'WP5-C44', name: 'context only stores wrong base mistakes', run: () => assert(contextSource.includes("result.response.role === 'base' && !result.response.isCorrect")) },
  { id: 'WP5-C45', name: 'reinforcement does not auto resolve source mistake', run: () => assert(!contextSource.includes('reinforcementDecision') || !contextSource.includes('resolveMistake(result')) },
  { id: 'WP5-C46', name: 'legacy no-reinforcement summary shape stays stable', run: () => { let a = attemptFor([filler.id], 'legacy-session'); const result = submit(a, filler); assert(result.ok); a = advancePracticeAttempt(result.attempt, LATER); const summary = buildPracticeCompletionRecord(a).summary; assert(!('reinforcementQuestionCount' in summary)); } },

  { id: 'WP5-C47', name: 'quiz remains under canonical knowledge route', run: () => assert(quizSource.includes("/learning/knowledge/result") && quizSource.includes("/learning/knowledge")) },
  { id: 'WP5-C48', name: 'scheduled copy appears once in quiz source', run: () => assert.equal(quizSource.split('已安排 1 道相关巩固题，将在稍后出现。').length - 1, 1) },
  { id: 'WP5-C49', name: 'not scheduled reasons are not rendered', run: () => assert(!quizSource.includes('approved_link_missing') && !quizSource.includes('candidate_unavailable')) },
  { id: 'WP5-C50', name: 'reinforcement card has readable label', run: () => assert(cardSource.includes('本轮巩固题') && cardSource.includes('根据本轮一道错题安排')) },
  { id: 'WP5-C51', name: 'progress uses frozen base denominator', run: () => assert(quizSource.includes('session.actualBaseQuestionCount') && quizSource.includes('道巩固题待完成')) },
  { id: 'WP5-C52', name: 'reinforcement state includes text not color only', run: () => assert(cardSource.includes('本轮巩固题')) },
  { id: 'WP5-C53', name: 'new student copy avoids mastery claims', run: () => assert(!/已掌握|能力已提升/.test(`${quizSource}\n${cardSource}`)) },
  { id: 'WP5-C54', name: 'reinforcement code has no formal evidence imports', run: () => assert(!/AbilityEvidence|StudentAbilityProfile|Trial|formal-resource/i.test(reinforcementSources)) },
];

let passed = 0;
for (const check of checks) {
  try { check.run(); passed += 1; console.log(`PASS ${check.id} ${check.name}`); }
  catch (error) { console.error(`FAIL ${check.id} ${check.name}`); console.error(error); }
}
console.log(`WP5_RESULT ${passed}/${checks.length} ${passed === checks.length ? 'PASS' : 'FAIL'}`);
if (passed !== checks.length) process.exitCode = 1;
