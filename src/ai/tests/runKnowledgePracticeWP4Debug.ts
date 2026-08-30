import assert from 'node:assert/strict';
import { buildPracticeSession } from '../../domain/knowledge-practice/practice/buildPracticeSession.ts';
import { buildPracticeCompletionRecord } from '../../domain/knowledge-practice/persistence/buildPracticeCompletionRecord.ts';
import { createEmptyPracticeStore, type PracticeStorageLike } from '../../domain/knowledge-practice/persistence/localPracticeStoreTypes.ts';
import { buildPersistedKnowledgeMistake, upsertPersistedMistake } from '../../domain/knowledge-practice/persistence/persistedKnowledgeMistake.ts';
import { validateLocalPracticeStore } from '../../domain/knowledge-practice/persistence/localPracticeStoreValidator.ts';
import { knowledgeQuestionRepository } from '../../domain/knowledge-practice/questions/knowledgeQuestionRepository.ts';
import { advancePracticeAttempt } from '../../domain/knowledge-practice/response/practiceAttemptState.ts';
import { createPracticeAttempt, submitPracticeAnswer } from '../../domain/knowledge-practice/response/submitPracticeAnswer.ts';
import { LocalStoragePracticeRepository, PRACTICE_STORE_BACKUP_KEY, PRACTICE_STORE_PRIMARY_KEY, PRACTICE_STORE_QUARANTINE_KEY } from '../../repositories/knowledge-practice/localStoragePracticeRepository.ts';

const NOW = '2026-08-29T08:00:00.000Z';
const LATER = '2026-08-29T08:01:00.000Z';
const question = knowledgeQuestionRepository.getApprovedById('q-cy-1')!;
type Check = { id: string; name: string; run: () => void };

class MemoryStorage implements PracticeStorageLike {
  values = new Map<string, string>();
  failRead = false;
  failWrite = false;
  getItem(key: string) { if (this.failRead) throw new Error('SecurityError'); return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite) throw new Error('QuotaExceededError'); this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function fresh(storage = new MemoryStorage(), writer = 'writer-a') {
  return { storage, repo: new LocalStoragePracticeRepository(storage, writer), store: createEmptyPracticeStore(NOW, writer) };
}

function activeAttempt() {
  const built = buildPracticeSession({ mode: 'category', category: question.category, targetCount: 1, now: NOW, idFactory: () => 'wp4-session' });
  assert(built.ok);
  const session = { ...built.session, baseQuestionIds: [question.id], queue: [{ ...built.session.queue[0], questionId: question.id, questionContentVersion: question.contentVersion }] };
  return createPracticeAttempt(session);
}

function threeQuestionAttempt() {
  const built = buildPracticeSession({ mode: 'category', category: '字音字形', targetCount: 3, now: NOW, idFactory: () => 'wp4-three-session' });
  assert(built.ok);
  return createPracticeAttempt(built.session);
}

function answeredAttempt(correct = false) {
  const attempt = activeAttempt();
  const answer = correct ? question.correctAnswer : question.options!.find((item) => item.id !== question.correctAnswer)!.id;
  const result = submitPracticeAnswer({ attempt, queueItemId: attempt.session.queue[0].id, question, answer: { value: answer, submittedAt: LATER, durationMs: 20_000 } });
  assert(result.ok);
  return result;
}

function completedAttempt(correct = false) {
  return advancePracticeAttempt(answeredAttempt(correct).attempt, '2026-08-29T08:02:00.000Z');
}

const checks: Check[] = [
  { id: 'WP4-S01', name: 'empty storage loads empty v1 store', run: () => { const { repo } = fresh(); const r = repo.load(NOW); assert.equal(r.status, 'empty'); assert.equal(r.store.revision, 0); } },
  { id: 'WP4-S02', name: 'active attempt saves completely', run: () => { const { repo, storage, store } = fresh(); const r = repo.saveActiveAttempt({ store, expectedRevision: 0, now: NOW, attempt: activeAttempt() }); assert.equal(r.status, 'saved'); assert.equal(JSON.parse(storage.getItem(PRACTICE_STORE_PRIMARY_KEY)!).activeAttempt.session.id, 'wp4-session'); } },
  { id: 'WP4-S03', name: 'previous primary becomes backup', run: () => { const { repo, storage, store } = fresh(); const first = repo.saveActiveAttempt({ store, expectedRevision: 0, now: NOW, attempt: activeAttempt() }); assert(first.status === 'saved'); const answer = answeredAttempt().attempt; repo.saveActiveAttempt({ store: first.store, expectedRevision: 1, now: LATER, attempt: answer }); assert.equal(JSON.parse(storage.getItem(PRACTICE_STORE_BACKUP_KEY)!).revision, 1); } },
  { id: 'WP4-S04', name: 'readback preserves revision', run: () => { const { repo, store } = fresh(); const saved = repo.saveActiveAttempt({ store, expectedRevision: 0, now: NOW, attempt: activeAttempt() }); assert(saved.status === 'saved'); assert.equal(repo.load(LATER).store.revision, 1); } },
  { id: 'WP4-S05', name: 'same content is reused', run: () => { const { repo, store } = fresh(); const attempt = activeAttempt(); const first = repo.saveActiveAttempt({ store, expectedRevision: 0, now: NOW, attempt }); assert(first.status === 'saved'); const second = repo.saveActiveAttempt({ store: first.store, expectedRevision: 1, now: LATER, attempt }); assert.equal(second.status, 'reused'); assert.equal(second.store.revision, 1); } },
  { id: 'WP4-S06', name: 'stale revision conflicts', run: () => { const { repo, store } = fresh(); repo.saveActiveAttempt({ store, expectedRevision: 0, now: NOW, attempt: activeAttempt() }); const r = repo.saveActiveAttempt({ store, expectedRevision: 0, now: LATER, attempt: activeAttempt() }); assert.equal(r.status, 'conflict'); } },
  { id: 'WP4-S07', name: 'unavailable storage does not throw', run: () => { const repo = new LocalStoragePracticeRepository(null, 'x'); assert.equal(repo.load(NOW).status, 'unavailable'); } },
  { id: 'WP4-S08', name: 'quota error keeps memory candidate', run: () => { const { repo, storage, store } = fresh(); storage.failWrite = true; const r = repo.saveActiveAttempt({ store, expectedRevision: 0, now: NOW, attempt: activeAttempt() }); assert.equal(r.status, 'failed'); assert(r.status === 'failed' && r.store.activeAttempt); } },
  { id: 'WP4-S09', name: 'invalid attempt is controlled failure', run: () => { const { repo, store } = fresh(); const attempt = activeAttempt(); (attempt as any).responses = null; const r = repo.saveActiveAttempt({ store, expectedRevision: 0, now: NOW, attempt }); assert.equal(r.status, 'failed'); } },
  { id: 'WP4-S10', name: 'oversized store is rejected', run: () => { const { repo, store } = fresh(); const attempt = activeAttempt(); (attempt.session as any).padding = 'x'.repeat(600_000); const r = repo.saveActiveAttempt({ store, expectedRevision: 0, now: NOW, attempt }); assert.equal(r.status, 'failed'); } },

  { id: 'WP4-L01', name: 'valid v1 primary loads', run: () => { const { repo, store } = fresh(); const saved = repo.saveActiveAttempt({ store, expectedRevision: 0, now: NOW, attempt: activeAttempt() }); assert(saved.status === 'saved'); assert.equal(repo.load(LATER).status, 'loaded'); } },
  { id: 'WP4-L02', name: 'damaged primary recovers backup', run: () => { const { repo, storage, store } = fresh(); const first = repo.saveActiveAttempt({ store, expectedRevision: 0, now: NOW, attempt: activeAttempt() }); assert(first.status === 'saved'); const second = repo.saveActiveAttempt({ store: first.store, expectedRevision: 1, now: LATER, attempt: answeredAttempt().attempt }); assert(second.status === 'saved'); storage.setItem(PRACTICE_STORE_PRIMARY_KEY, '{bad'); assert.equal(repo.load(LATER).status, 'recovered_from_backup'); } },
  { id: 'WP4-L03', name: 'both records damaged returns empty', run: () => { const { repo, storage } = fresh(); storage.setItem(PRACTICE_STORE_PRIMARY_KEY, '{bad'); storage.setItem(PRACTICE_STORE_BACKUP_KEY, '{bad'); const r = repo.load(NOW); assert.equal(r.status, 'damaged'); assert.equal(r.store.activeAttempt, null); } },
  { id: 'WP4-L04', name: 'damage writes minimal quarantine metadata', run: () => { const { repo, storage } = fresh(); storage.setItem(PRACTICE_STORE_PRIMARY_KEY, '{bad'); repo.load(NOW); const raw = storage.getItem(PRACTICE_STORE_QUARANTINE_KEY)!; assert(raw.includes('issueCodes')); assert(!raw.includes('{bad')); } },
  { id: 'WP4-L05', name: 'v0 active attempt migrates', run: () => { const { repo, storage } = fresh(); storage.setItem(PRACTICE_STORE_PRIMARY_KEY, JSON.stringify({ activeAttempt: activeAttempt() })); const r = repo.load(NOW); assert.equal(r.status, 'migrated'); assert.equal(r.store.activeAttempt?.session.id, 'wp4-session'); } },
  { id: 'WP4-L06', name: 'legacy result without attempt is dropped', run: () => { const { repo, storage } = fresh(); storage.setItem(PRACTICE_STORE_PRIMARY_KEY, JSON.stringify({ lastResult: { score: 90 } })); const r = repo.load(NOW); assert.equal(r.status, 'migrated'); assert.equal(r.store.lastCompletion, null); assert(r.issues?.some((i) => i.code === 'migration.last_result_dropped')); } },
  { id: 'WP4-L07', name: 'future schema is never overwritten', run: () => { const { repo, storage, store } = fresh(); const raw = JSON.stringify({ schemaVersion: 9, precious: true }); storage.setItem(PRACTICE_STORE_PRIMARY_KEY, raw); assert.equal(repo.load(NOW).status, 'future_version'); const w = repo.saveActiveAttempt({ store, expectedRevision: 0, now: NOW, attempt: activeAttempt() }); assert.equal(w.status, 'failed'); assert.equal(storage.getItem(PRACTICE_STORE_PRIMARY_KEY), raw); } },
  { id: 'WP4-L08', name: 'invalid active attempt is isolated', run: () => { const { repo, storage, store } = fresh(); storage.setItem(PRACTICE_STORE_PRIMARY_KEY, JSON.stringify({ ...store, activeAttempt: { schemaVersion: 1 } })); const r = repo.load(NOW); assert.equal(r.status, 'loaded'); assert.equal(r.store.activeAttempt, null); } },
  { id: 'WP4-L10', name: 'single invalid mistake is isolated', run: () => { const { repo, storage, store } = fresh(); const valid = buildPersistedKnowledgeMistake(question, answeredAttempt(false).response); storage.setItem(PRACTICE_STORE_PRIMARY_KEY, JSON.stringify({ ...store, mistakes: [valid, { bad: true }] })); const r = repo.load(NOW); assert.equal(r.status, 'loaded'); assert.equal(r.store.mistakes.length, 1); } },
  { id: 'WP4-L09', name: 'completed session cannot restore as active', run: () => { const { repo, storage, store } = fresh(); storage.setItem(PRACTICE_STORE_PRIMARY_KEY, JSON.stringify({ ...store, activeAttempt: completedAttempt() })); const r = repo.load(NOW); assert.equal(r.status, 'loaded'); assert.equal(r.store.activeAttempt, null); } },

  { id: 'WP4-A01', name: 'pending attempt roundtrips', run: () => { const { repo, store } = fresh(); const r = repo.saveActiveAttempt({ store, expectedRevision: 0, now: NOW, attempt: activeAttempt() }); assert(r.status === 'saved'); assert.equal(repo.load(LATER).store.activeAttempt?.session.currentIndex, 0); } },
  { id: 'WP4-A02', name: 'feedback state roundtrips', run: () => { const { repo, store } = fresh(); const result = answeredAttempt(); const r = repo.saveActiveAttempt({ store, expectedRevision: 0, now: LATER, attempt: result.attempt }); assert(r.status === 'saved'); const loaded = repo.load(LATER).store.activeAttempt!; assert.equal(loaded.responses[0].submittedAnswer, result.response.submittedAnswer); assert(loaded.feedbackByResponseId[result.response.id]); } },
  { id: 'WP4-A03', name: 'response duration stays immutable', run: () => { const { repo, store } = fresh(); const result = answeredAttempt(); repo.saveActiveAttempt({ store, expectedRevision: 0, now: LATER, attempt: result.attempt }); assert.equal(repo.load(LATER).store.activeAttempt?.responses[0].durationMs, 20_000); } },
  { id: 'WP4-A03B', name: 'two answered questions recover at third question', run: () => { const { repo, store } = fresh(); let attempt = threeQuestionAttempt(); for (let index = 0; index < 2; index += 1) { const item = attempt.session.queue[attempt.session.currentIndex]; const q = knowledgeQuestionRepository.getApprovedById(item.questionId)!; const submitted = submitPracticeAnswer({ attempt, queueItemId: item.id, question: q, answer: { value: q.correctAnswer, submittedAt: LATER, durationMs: 1_000 } }); assert(submitted.ok); attempt = advancePracticeAttempt(submitted.attempt, `2026-08-29T08:0${index + 2}:00.000Z`); } const saved = repo.saveActiveAttempt({ store, expectedRevision: 0, now: LATER, attempt }); assert(saved.status === 'saved'); assert.equal(repo.load(LATER).store.activeAttempt?.session.currentIndex, 2); } },
  { id: 'WP4-A04', name: 'completion clears active attempt', run: () => { const { repo, store } = fresh(); const r = repo.completeAttempt({ store, expectedRevision: 0, now: LATER, attempt: completedAttempt() }); assert(r.status === 'saved'); assert.equal(r.store.activeAttempt, null); } },
  { id: 'WP4-A05', name: 'completion stores full attempt', run: () => { const { repo, store } = fresh(); const r = repo.completeAttempt({ store, expectedRevision: 0, now: LATER, attempt: completedAttempt() }); assert(r.status === 'saved'); assert.equal(r.store.lastCompletion?.completedAttempt.responses.length, 1); } },
  { id: 'WP4-A06', name: 'abandon clears active and records id', run: () => { const { repo, store } = fresh(); const attempt = activeAttempt(); const abandoned = { ...attempt, session: { ...attempt.session, status: 'abandoned' as const, abandonedAt: LATER, updatedAt: LATER } }; const r = repo.abandonAttempt({ store: { ...store, activeAttempt: attempt }, expectedRevision: 0, now: LATER, attempt: abandoned }); assert(r.status === 'saved'); assert.equal(r.store.lastAbandonedSessionId, 'wp4-session'); } },

  { id: 'WP4-H01', name: 'completion summary matches attempt facts', run: () => { const record = buildPracticeCompletionRecord(completedAttempt(false)); assert.equal(record.summary.baseQuestionCount, 1); assert.equal(record.summary.firstAttemptCorrectCount, 0); assert.equal(record.summary.mistakeCount, 1); } },
  { id: 'WP4-H02', name: 'completion store validates', run: () => { const { repo, store } = fresh(); const r = repo.completeAttempt({ store, expectedRevision: 0, now: LATER, attempt: completedAttempt(true) }); assert(r.status === 'saved'); assert(validateLocalPracticeStore(r.store).passed); } },
  { id: 'WP4-H03', name: 'wrong response builds readable snapshot mistake', run: () => { const result = answeredAttempt(false); const mistake = buildPersistedKnowledgeMistake(question, result.response); assert.equal(mistake.stemSnapshot, question.stem); assert.equal(mistake.status, 'active'); assert(!mistake.wrongAnswer.startsWith('opt-')); assert(!mistake.correctAnswerText.startsWith('opt-')); } },
  { id: 'WP4-H04', name: 'same question upserts without duplicate', run: () => { const result = answeredAttempt(false); const first = buildPersistedKnowledgeMistake(question, result.response); const second = { ...first, responseId: 'new-response', lastWrongAt: '2026-08-30T08:00:00Z' }; const rows = upsertPersistedMistake([first], second); assert.equal(rows.length, 1); assert.equal(rows[0].responseId, 'new-response'); assert.equal(rows[0].firstWrongAt, first.firstWrongAt); } },
  { id: 'WP4-H05', name: 'resolved mistake persists', run: () => { const { repo, store } = fresh(); const mistake = buildPersistedKnowledgeMistake(question, answeredAttempt(false).response); const seeded = { ...store, mistakes: [mistake] }; const r = repo.resolveMistake({ store: seeded, expectedRevision: 0, now: LATER, questionId: question.id }); assert(r.status === 'saved'); assert.equal(r.store.mistakes[0].status, 'resolved'); } },
  { id: 'WP4-H06', name: 'new wrong answer reactivates resolved', run: () => { const base = buildPersistedKnowledgeMistake(question, answeredAttempt(false).response); const rows = upsertPersistedMistake([{ ...base, status: 'resolved' }], { ...base, responseId: 'again' }); assert.equal(rows[0].status, 'active'); } },
];

let passed = 0;
for (const check of checks) {
  try { check.run(); passed += 1; console.log(`PASS ${check.id} ${check.name}`); }
  catch (error) { console.error(`FAIL ${check.id} ${check.name}`); console.error(error); }
}
console.log(`WP4_RESULT ${passed}/${checks.length} ${passed === checks.length ? 'PASS' : 'FAIL'}`);
if (passed !== checks.length) process.exitCode = 1;
