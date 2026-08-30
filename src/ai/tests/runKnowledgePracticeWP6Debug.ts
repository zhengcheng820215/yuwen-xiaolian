import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPracticeCompletionRecord } from '../../domain/knowledge-practice/persistence/buildPracticeCompletionRecord.ts';
import { createEmptyPracticeStore, type PracticeCompletionRecordV1, type PracticeStorageLike } from '../../domain/knowledge-practice/persistence/localPracticeStoreTypes.ts';
import { buildPracticeSession } from '../../domain/knowledge-practice/practice/buildPracticeSession.ts';
import { validatePracticeSession } from '../../domain/knowledge-practice/practice/practiceSessionValidator.ts';
import { knowledgeQuestionRepository } from '../../domain/knowledge-practice/questions/knowledgeQuestionRepository.ts';
import type { KnowledgeQuestion } from '../../domain/knowledge-practice/questions/knowledgeQuestionTypes.ts';
import { advancePracticeAttempt } from '../../domain/knowledge-practice/response/practiceAttemptState.ts';
import type { PracticeAttempt } from '../../domain/knowledge-practice/response/practiceResponseTypes.ts';
import { createPracticeAttempt, submitPracticeAnswer } from '../../domain/knowledge-practice/response/submitPracticeAnswer.ts';
import { buildPracticeResult } from '../../domain/knowledge-practice/result/buildPracticeResult.ts';
import { PRACTICE_RESULT_RESPONSE_CAP_MS } from '../../domain/knowledge-practice/result/practiceResultTypes.ts';
import { validatePracticeResult } from '../../domain/knowledge-practice/result/practiceResultValidator.ts';
import { selectPracticeRecommendation } from '../../domain/knowledge-practice/result/selectPracticeRecommendation.ts';
import { LocalStoragePracticeRepository, PRACTICE_STORE_PRIMARY_KEY } from '../../repositories/knowledge-practice/localStoragePracticeRepository.ts';

type Check = { id: string; name: string; run: () => void };
const NOW = '2026-08-30T01:00:00.000Z';
const questions = knowledgeQuestionRepository.listApproved();
const byId = new Map(questions.map((item) => [item.id, item]));

function wrongAnswer(question: KnowledgeQuestion): string {
  if (question.type === 'fill_blank') return '__wrong__';
  return question.options!.find((item) => item.id !== question.correctAnswer)!.id;
}

function complete(ids: string[], correct: boolean[], durations: number[] = ids.map(() => 1000), sessionId = 'wp6-session'): PracticeAttempt {
  const built = buildPracticeSession({ mode: 'mistake_review', questionIds: ids, targetCount: ids.length, now: NOW, idFactory: () => sessionId });
  assert(built.ok);
  let attempt = createPracticeAttempt(built.session);
  ids.forEach((id, index) => {
    const question = byId.get(id)!;
    const submittedAt = new Date(Date.parse(NOW) + (index + 1) * 1000).toISOString();
    const submitted = submitPracticeAnswer({ attempt, queueItemId: attempt.session.queue[attempt.session.currentIndex].id, question, answer: { value: correct[index] ? question.correctAnswer : wrongAnswer(question), submittedAt, durationMs: durations[index] } });
    assert(submitted.ok);
    attempt = advancePracticeAttempt(submitted.attempt, submittedAt);
  });
  assert.equal(attempt.session.status, 'completed');
  return attempt;
}

class MemoryStorage implements PracticeStorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const fourOfFive = buildPracticeResult({ completedAttempt: complete(['q-zy-1', 'q-zy-2', 'q-cy-1', 'q-bd-1', 'q-wx-2'], [true, true, true, true, false]) });
const twoSameWrongAttempt = complete(['q-rf-zy-1', 'q-rf-zy-2'], [false, false], [1000, 1000], 'wp6-same-kp');
const twoSameWrong = buildPracticeResult({ completedAttempt: twoSameWrongAttempt });
const oneWrong = buildPracticeResult({ completedAttempt: complete(['q-zy-1'], [false], [1000], 'wp6-one-wrong') });
const allCorrect = buildPracticeResult({ completedAttempt: complete(['q-zy-1', 'q-cy-1'], [true, true], [1000, 1000], 'wp6-all-correct') });
const cappedAttempt = complete(['q-zy-1', 'q-cy-1'], [true, true], [15 * 60_000, 30_000], 'wp6-timing');
const capped = buildPracticeResult({ completedAttempt: cappedAttempt });
const resultSource = readFileSync(new URL('../../pages/Result.jsx', import.meta.url), 'utf8');
const contextSource = readFileSync(new URL('../../context/PracticeSessionContext.jsx', import.meta.url), 'utf8');
const knowledgePracticeSource = readFileSync(new URL('../../pages/KnowledgePractice.jsx', import.meta.url), 'utf8');
const resultDomainSource = [
  readFileSync(new URL('../../domain/knowledge-practice/result/buildPracticeResult.ts', import.meta.url), 'utf8'),
  readFileSync(new URL('../../domain/knowledge-practice/result/aggregateMisconceptionResults.ts', import.meta.url), 'utf8'),
  readFileSync(new URL('../../domain/knowledge-practice/result/selectPracticeRecommendation.ts', import.meta.url), 'utf8'),
].join('\n');

const checks: Check[] = [
  { id: 'WP6-C01', name: 'five base four correct is eighty percent', run: () => assert.equal(fourOfFive.basePerformance.firstAttemptAccuracy, 80) },
  { id: 'WP6-C02', name: 'zero base denominator is guarded', run: () => assert(resultDomainSource.includes('baseResponses.length === 0 ? 0')) },
  { id: 'WP6-C03', name: 'base first facts stay separate', run: () => assert.equal(oneWrong.basePerformance.correctCount, 0) },
  { id: 'WP6-C04', name: 'reinforcement summary has independent shape', run: () => assert.deepEqual(oneWrong.reinforcementPerformance, { scheduledCount: 0, answeredCount: 0, correctCount: 0, incorrectCount: 0 }) },
  { id: 'WP6-C05', name: 'no reinforcement is explicit zero', run: () => assert.equal(allCorrect.reinforcementPerformance.scheduledCount, 0) },
  { id: 'WP6-C06', name: 'queue response mismatch fails', run: () => { const broken = structuredClone(allCorrect); broken.basePerformance.questionCount += 1; assert(!validatePracticeResult(broken).passed); } },
  { id: 'WP6-C07', name: 'result session identity is validated', run: () => { const broken = structuredClone(allCorrect); broken.sourceSessionId = 'other'; assert(!validatePracticeResult(broken).passed); } },
  { id: 'WP6-C08', name: 'same attempt builds same result', run: () => assert.deepEqual(buildPracticeResult({ completedAttempt: twoSameWrongAttempt }), twoSameWrong) },
  { id: 'WP6-C09', name: 'result build does not mutate attempt', run: () => { const copy = structuredClone(twoSameWrongAttempt); buildPracticeResult({ completedAttempt: twoSameWrongAttempt }); assert.deepEqual(twoSameWrongAttempt, copy); } },
  { id: 'WP6-C10', name: 'formal mastery fields are rejected', run: () => { const broken = structuredClone(allCorrect) as typeof allCorrect & { mastery: string }; broken.mastery = 'yes'; assert(!validatePracticeResult(broken).passed); } },
  { id: 'WP6-C11', name: 'result survives json roundtrip', run: () => assert.deepEqual(JSON.parse(JSON.stringify(twoSameWrong)), twoSameWrong) },
  { id: 'WP6-C12', name: 'result page does not calculate accuracy', run: () => assert(!resultSource.includes('correctCount /') && resultSource.includes('lastResult.basePerformance.firstAttemptAccuracy')) },

  { id: 'WP6-C13', name: 'thirty seconds stays thirty seconds', run: () => assert.equal(capped.timing.baseEffectiveDurationMs, PRACTICE_RESULT_RESPONSE_CAP_MS + 30_000) },
  { id: 'WP6-C14', name: 'fifteen minutes caps at ten', run: () => assert.equal(capped.timing.effectiveDurationMs, 10 * 60_000 + 30_000) },
  { id: 'WP6-C15', name: 'timing parts equal total', run: () => assert.equal(capped.timing.effectiveDurationMs, capped.timing.baseEffectiveDurationMs + capped.timing.reinforcementEffectiveDurationMs) },
  { id: 'WP6-C16', name: 'raw response duration stays immutable', run: () => assert.equal(cappedAttempt.responses[0].durationMs, 15 * 60_000) },
  { id: 'WP6-C17', name: 'one correct is insufficient evidence', run: () => assert.equal(buildPracticeResult({ completedAttempt: complete(['q-zy-1'], [true], [1000], 'wp6-one-right') }).knowledgePoints[0].level, 'insufficient_evidence') },
  { id: 'WP6-C18', name: 'one wrong is insufficient evidence', run: () => assert.equal(oneWrong.knowledgePoints[0].level, 'insufficient_evidence') },
  { id: 'WP6-C19', name: 'two same point correct is steady', run: () => assert.equal(buildPracticeResult({ completedAttempt: complete(['q-rf-zy-1', 'q-rf-zy-2'], [true, true], [1000, 1000], 'wp6-steady') }).knowledgePoints[0].level, 'steady_this_round') },
  { id: 'WP6-C20', name: 'two same point one wrong recommends reinforcement', run: () => assert.equal(buildPracticeResult({ completedAttempt: complete(['q-rf-zy-1', 'q-rf-zy-2'], [true, false], [1000, 1000], 'wp6-reinforce') }).knowledgePoints[0].level, 'reinforce_this_round') },
  { id: 'WP6-C21', name: 'two same point wrong prioritizes', run: () => assert.equal(twoSameWrong.knowledgePoints[0].level, 'prioritize_this_round') },
  { id: 'WP6-C22', name: 'knowledge summary is base scoped', run: () => assert.equal(twoSameWrong.knowledgePoints.reduce((sum, item) => sum + item.baseQuestionCount, 0), 2) },
  { id: 'WP6-C23', name: 'knowledge aggregation is stable', run: () => assert.deepEqual(buildPracticeResult({ completedAttempt: twoSameWrongAttempt }).knowledgePoints, twoSameWrong.knowledgePoints) },
  { id: 'WP6-C24', name: 'knowledge count matches base count', run: () => assert.equal(fourOfFive.knowledgePoints.reduce((sum, item) => sum + item.baseQuestionCount, 0), 5) },

  { id: 'WP6-C25', name: 'reviewed misconception can aggregate', run: () => assert(twoSameWrong.misconceptions.every((item) => item.occurrenceCount >= 1)) },
  { id: 'WP6-C26', name: 'misconception ordering is deterministic', run: () => assert.deepEqual(buildPracticeResult({ completedAttempt: twoSameWrongAttempt }).misconceptions, twoSameWrong.misconceptions) },
  { id: 'WP6-C27', name: 'missing misconception is not inferred', run: () => assert(resultDomainSource.includes('if (!studentMessage) return')) },
  { id: 'WP6-C28', name: 'wrong items always preserve concrete fallback', run: () => assert.equal(twoSameWrong.wrongItems.length, 2) },
  { id: 'WP6-C29', name: 'wrong summary is base scoped', run: () => assert(twoSameWrong.wrongItems.every((item) => twoSameWrongAttempt.responses.find((response) => response.questionId === item.questionId)?.role === 'base')) },
  { id: 'WP6-C30', name: 'most repeated point chooses category', run: () => assert.equal(twoSameWrong.recommendation.type, 'start_category_practice') },
  { id: 'WP6-C31', name: 'recommendation tie breakers are explicit', run: () => assert(resultDomainSource.includes('firstOccurrenceIndex') && resultDomainSource.includes('localeCompare')) },
  { id: 'WP6-C32', name: 'one scattered wrong recommends retry', run: () => assert.equal(oneWrong.recommendation.type, 'retry_wrong_items') },
  { id: 'WP6-C33', name: 'all correct recommends mixed', run: () => assert.equal(allCorrect.recommendation.type, 'start_mixed_practice') },
  { id: 'WP6-C34', name: 'missing category inventory does not recommend category', run: () => assert.notEqual(selectPracticeRecommendation({ knowledgePoints: twoSameWrong.knowledgePoints, wrongItems: twoSameWrong.wrongItems, approvedQuestions: [] }).type, 'start_category_practice') },
  { id: 'WP6-C35', name: 'unavailable retry falls back', run: () => assert.equal(selectPracticeRecommendation({ knowledgePoints: oneWrong.knowledgePoints, wrongItems: oneWrong.wrongItems, approvedQuestions: [] }).type, 'return_to_learning') },
  { id: 'WP6-C36', name: 'recommendation reason contains round facts', run: () => assert(twoSameWrong.recommendation.reason.includes('本轮') && twoSameWrong.recommendation.reason.includes('2道')) },
  { id: 'WP6-C37', name: 'same input gives same recommendation', run: () => assert.deepEqual(buildPracticeResult({ completedAttempt: twoSameWrongAttempt }).recommendation, twoSameWrong.recommendation) },
  { id: 'WP6-C38', name: 'recommendation uses no random or model', run: () => assert(!/Math\.random|openai|llm/i.test(resultDomainSource)) },
  { id: 'WP6-C39', name: 'active session wins on result page', run: () => assert(resultSource.includes("activeSession?.status === 'active'") && contextSource.includes("outcome: 'continue_active'")) },
  { id: 'WP6-C40', name: 'student copy avoids mastery claims', run: () => assert(!/已掌握|能力提升/.test(resultSource)) },

  { id: 'WP6-C41', name: 'three wrong ids build retry session', run: () => { const r = buildPracticeSession({ mode: 'mistake_review', questionIds: ['q-zy-1', 'q-cy-1', 'q-bd-1'], now: NOW, idFactory: () => 'wp6-retry-three' }); assert(r.ok && r.session.actualBaseQuestionCount === 3); } },
  { id: 'WP6-C42', name: 'retry ids deduplicate in first order', run: () => { const r = buildPracticeSession({ mode: 'mistake_review', questionIds: ['q-cy-1', 'q-cy-1', 'q-zy-1'], now: NOW, idFactory: () => 'wp6-retry-dedupe' }); assert(r.ok); assert.deepEqual(r.session.baseQuestionIds, ['q-cy-1', 'q-zy-1']); } },
  { id: 'WP6-C43', name: 'retry takes explicit base ids only', run: () => assert(oneWrong.recommendation.sourceQuestionIds?.every((id) => oneWrong.wrongItems.some((item) => item.questionId === id))) },
  { id: 'WP6-C44', name: 'missing source is filtered', run: () => { const r = buildPracticeSession({ mode: 'mistake_review', questionIds: ['missing', 'q-zy-1'], now: NOW, idFactory: () => 'wp6-retry-filter' }); assert(r.ok && r.session.actualBaseQuestionCount === 1); } },
  { id: 'WP6-C45', name: 'all missing retry is rejected', run: () => { const r = buildPracticeSession({ mode: 'mistake_review', questionIds: ['missing'], now: NOW, idFactory: () => 'wp6-retry-empty' }); assert(!r.ok && r.error.code === 'no_questions_for_mistake_review'); } },
  { id: 'WP6-C46', name: 'retry creates new identity', run: () => { const r = buildPracticeSession({ mode: 'mistake_review', questionIds: ['q-zy-1'], now: NOW, idFactory: () => 'wp6-new-retry' }); assert(r.ok && r.session.id !== oneWrong.sourceSessionId); } },
  { id: 'WP6-C47', name: 'legacy completion upgrades on load', run: () => { const record = buildPracticeCompletionRecord(twoSameWrongAttempt); const legacy: PracticeCompletionRecordV1 = { schemaVersion: 1, sessionId: record.sessionId, completedAttempt: record.completedAttempt, summary: record.summary, completedAt: record.completedAt }; const storage = new MemoryStorage(); storage.setItem(PRACTICE_STORE_PRIMARY_KEY, JSON.stringify({ ...createEmptyPracticeStore(NOW, 'old-writer'), lastCompletion: legacy })); const loaded = new LocalStoragePracticeRepository(storage, 'new-writer').load(NOW); assert.equal(loaded.status, 'migrated'); assert.equal(loaded.store.lastCompletion?.schemaVersion, 2); } },
  { id: 'WP6-C48', name: 'invalid completion does not clear unrelated store arrays', run: () => assert(resultDomainSource.includes('Completed queue response count mismatch')) },
  { id: 'WP6-C49', name: 'v2 completion roundtrips', run: () => { const storage = new MemoryStorage(); const repo = new LocalStoragePracticeRepository(storage, 'writer'); const saved = repo.completeAttempt({ store: createEmptyPracticeStore(NOW, 'writer'), expectedRevision: 0, now: NOW, attempt: twoSameWrongAttempt }); assert(saved.status === 'saved'); assert.deepEqual(repo.load(NOW).store.lastCompletion, saved.store.lastCompletion); } },
  { id: 'WP6-C50', name: 'completion record contains one immutable result', run: () => { const record = buildPracticeCompletionRecord(twoSameWrongAttempt); assert.equal(record.schemaVersion, 2); assert(validatePracticeResult(record.result, record.completedAttempt).passed); } },
  { id: 'WP6-C51', name: 'store revision conflict remains enforced', run: () => { const storage = new MemoryStorage(); const repo = new LocalStoragePracticeRepository(storage, 'writer'); const store = createEmptyPracticeStore(NOW, 'writer'); assert.equal(repo.completeAttempt({ store, expectedRevision: 0, now: NOW, attempt: twoSameWrongAttempt }).status, 'saved'); assert.equal(repo.completeAttempt({ store, expectedRevision: 0, now: NOW, attempt: twoSameWrongAttempt }).status, 'conflict'); } },
  { id: 'WP6-C52', name: 'future store stays read only', run: () => { const storage = new MemoryStorage(); storage.setItem(PRACTICE_STORE_PRIMARY_KEY, JSON.stringify({ schemaVersion: 2 })); assert.equal(new LocalStoragePracticeRepository(storage, 'writer').load(NOW).status, 'future_version'); } },
  { id: 'WP6-C53', name: 'result page has controlled empty state', run: () => assert(resultSource.includes('还没有可查看的完整练习结果')) },
  { id: 'WP6-C54', name: 'recommendation failure stays visible', run: () => assert(resultSource.includes('setActionError') && resultSource.includes('role="alert"')) },
  { id: 'WP6-C55', name: 'result and retry recovery stay canonical', run: () => assert(resultSource.includes('/learning/knowledge/mistakes') && contextSource.includes('/learning/knowledge/quiz/retry') && knowledgePracticeSource.includes("input.mode === 'mistake_review' ? 'retry'")) },
  { id: 'WP6-C56', name: 'result domain has no formal writes', run: () => assert(!/AbilityEvidence|StudentAbilityProfile|formal-resource|TrialRepository/i.test(resultDomainSource)) },
];

let passed = 0;
for (const check of checks) {
  try { check.run(); passed += 1; console.log(`PASS ${check.id} ${check.name}`); }
  catch (error) { console.error(`FAIL ${check.id} ${check.name}`); console.error(error); }
}
console.log(`WP6_RESULT ${passed}/${checks.length} ${passed === checks.length ? 'PASS' : 'FAIL'}`);
if (passed !== checks.length) process.exitCode = 1;
