import assert from 'node:assert/strict';
import {
  applyProgressionObservation,
  createKnowledgePointProgress,
  placeInitialKnowledgePoint,
  selectDueProgressionQuestions,
  type ProgressionObservation,
  type ProgressionRules,
  type ReviewedProgressionQuestion,
} from '../../domain/knowledge-practice/progression/knowledgePointProgression.ts';
import { LocalStorageProgressionRepository, PROGRESSION_STORE_KEY } from '../../repositories/knowledge-practice/localStorageProgressionRepository.ts';

const T = '2026-01-01T00:00:00.000Z';
const HOUR = 60 * 60 * 1000;
const at = (hours: number): string => new Date(Date.parse(T) + hours * HOUR).toISOString();
const rules: ProgressionRules = {
  knowledgePointId: 'pronunciation', category: '字音字形', availableBands: [1, 2],
  contentApprovedForProgression: true, mappingVersion: 'mapping-v1', ruleVersion: 'pilot-v1',
};
const question = (id: string, band = 1, variantGroupId?: string): ReviewedProgressionQuestion => ({
  id, contentVersion: 1, knowledgePointId: 'pronunciation', band, category: '字音字形',
  approved: true, independentEligible: true, retentionEligible: true,
  ...(variantGroupId ? { variantGroupId } : {}),
});
let serial = 0;
const observation = (input: Partial<ProgressionObservation> & Pick<ProgressionObservation, 'questionId' | 'answeredAt'>): ProgressionObservation => ({
  responseId: `r-${++serial}`, sessionId: 'A', sessionCompleted: true,
  questionContentVersion: 1, knowledgePointId: 'pronunciation', band: 1,
  role: 'independent', firstAttempt: true, hadHintOrFeedback: false, correct: true,
  ...input,
});

let passed = 0;
function check(name: string, run: () => void): void {
  run();
  passed += 1;
  console.log(`PASS KP-${String(passed).padStart(2, '0')} ${name}`);
}

check('unapproved point records exposure but cannot advance', () => {
  const initial = createKnowledgePointProgress(rules, 1);
  const result = applyProgressionObservation(initial, observation({ questionId: 'q1', answeredAt: T }), question('q1'), {
    ...rules, contentApprovedForProgression: false,
  });
  assert.equal(result.reason, 'content_not_ready');
  assert.equal(result.state.currentBand, 1);
  assert.deepEqual(result.state.tasks, []);
  assert.deepEqual(result.state.exposedQuestionIds, ['q1']);
});

check('first correct creates one 24-hour task; same-session correct does not delay it', () => {
  const initial = createKnowledgePointProgress(rules, 1);
  const first = applyProgressionObservation(initial, observation({ questionId: 'q1', answeredAt: T }), question('q1'), rules).state;
  const second = applyProgressionObservation(first, observation({ questionId: 'q2', answeredAt: at(1) }), question('q2'), rules).state;
  assert.equal(second.currentBand, 1);
  assert.equal(second.bands[1].status, 'pending_independent_retest');
  assert.equal(second.tasks.length, 1);
  assert.equal(second.tasks[0].dueAt, at(24));
});

check('due boundary and distinct-session retest promote exactly one band', () => {
  const initial = createKnowledgePointProgress(rules, 1);
  const first = applyProgressionObservation(initial, observation({ questionId: 'q1', answeredAt: T }), question('q1'), rules).state;
  const taskId = first.tasks[0].id;
  const early = applyProgressionObservation(first, observation({ questionId: 'q2', answeredAt: at(24) }), question('q2'), rules);
  assert.equal(early.state.currentBand, 1); // Without a due-task role, an ordinary answer cannot consume the retest.
  const due = applyProgressionObservation(first, observation({ questionId: 'q2', answeredAt: at(24), sessionId: 'B', role: 'retest', taskId }), question('q2'), rules);
  assert.equal(due.reason, 'processed');
  assert.equal(due.promoted, true);
  assert.equal(due.state.currentBand, 2);
  assert.equal(due.state.bands[1].status, 'provisionally_stable');
  assert.equal(due.state.bands[2].status, 'training');
  assert.equal(due.state.tasks[0].kind, 'retention');
  assert.equal(due.state.tasks[0].dueAt, at(24 + 7 * 24));
  const repeat = applyProgressionObservation(due.state, { ...observation({ questionId: 'q2', answeredAt: at(24), role: 'retest', taskId }), responseId: due.state.processedResponseIds.at(-1)! }, question('q2'), rules);
  assert.equal(repeat.reason, 'duplicate_response');
  assert.equal(repeat.state.currentBand, 2);
});

check('early retest does not consume task and cannot promote', () => {
  const first = applyProgressionObservation(createKnowledgePointProgress(rules, 1), observation({ questionId: 'q1', answeredAt: T }), question('q1'), rules).state;
  const result = applyProgressionObservation(first, observation({ questionId: 'q2', answeredAt: at(23), role: 'retest', sessionId: 'B', taskId: first.tasks[0].id }), question('q2'), rules);
  assert.equal(result.reason, 'task_not_due');
  assert.equal(result.state.tasks[0].id, first.tasks[0].id);
  assert.equal(result.state.currentBand, 1);
});

check('wrong answer resets evidence and requires fresh error recheck', () => {
  const first = applyProgressionObservation(createKnowledgePointProgress(rules, 1), observation({ questionId: 'q1', answeredAt: T }), question('q1'), rules).state;
  const wrong = applyProgressionObservation(first, observation({ questionId: 'q2', answeredAt: at(2), correct: false }), question('q2'), rules).state;
  assert.equal(wrong.bands[1].status, 'training');
  assert.deepEqual(wrong.bands[1].consecutiveCorrect, []);
  assert.equal(wrong.tasks[0].kind, 'error_recheck');
  assert.equal(wrong.tasks[0].dueAt, at(26));
  const rechecked = applyProgressionObservation(wrong, observation({ questionId: 'q3', answeredAt: at(26), sessionId: 'B', role: 'recheck', taskId: wrong.tasks[0].id }), question('q3'), rules).state;
  assert.equal(rechecked.currentBand, 1);
  assert.equal(rechecked.bands[1].status, 'pending_independent_retest');
  assert.equal(rechecked.tasks[0].dueAt, at(50));
});

check('exposed variant, feedback, and abandoned answer cannot create evidence', () => {
  const first = applyProgressionObservation(createKnowledgePointProgress(rules, 1), observation({ questionId: 'q1', answeredAt: T }), question('q1', 1, 'group'), rules).state;
  const variant = applyProgressionObservation(first, observation({ questionId: 'q2', answeredAt: at(24), sessionId: 'B', role: 'retest', taskId: first.tasks[0].id }), question('q2', 1, 'group'), rules);
  assert.equal(variant.reason, 'question_exposed');
  const hinted = applyProgressionObservation(first, observation({ questionId: 'q3', answeredAt: at(1), hadHintOrFeedback: true }), question('q3'), rules);
  assert.equal(hinted.reason, 'not_independent');
  const abandoned = applyProgressionObservation(first, observation({ questionId: 'q4', answeredAt: at(1), sessionCompleted: false }), question('q4'), rules);
  assert.equal(abandoned.reason, 'not_independent');
  assert.equal(abandoned.state.tasks[0].id, first.tasks[0].id);
});

check('retention correct schedules 30 days; wrong needs two independent rechecks', () => {
  const first = applyProgressionObservation(createKnowledgePointProgress(rules, 1), observation({ questionId: 'q1', answeredAt: T }), question('q1'), rules).state;
  const promoted = applyProgressionObservation(first, observation({ questionId: 'q2', answeredAt: at(24), sessionId: 'B', role: 'retest', taskId: first.tasks[0].id }), question('q2'), rules).state;
  const retentionAt = at(24 + 7 * 24);
  const retained = applyProgressionObservation(promoted, observation({ questionId: 'q3', answeredAt: retentionAt, sessionId: 'C', role: 'retention', taskId: promoted.tasks[0].id }), question('q3'), rules).state;
  assert.equal(retained.tasks[0].dueAt, at(24 + 37 * 24));
  const lost = applyProgressionObservation(promoted, observation({ questionId: 'q4', answeredAt: retentionAt, sessionId: 'C', role: 'retention', taskId: promoted.tasks[0].id, correct: false }), question('q4'), rules).state;
  assert.equal(lost.currentBand, 2);
  assert.equal(lost.bands[1].status, 'needs_recheck');
  const once = applyProgressionObservation(lost, observation({ questionId: 'q5', answeredAt: at(24 + 8 * 24), sessionId: 'D', role: 'recheck', taskId: lost.tasks[0].id }), question('q5'), rules).state;
  assert.equal(once.bands[1].status, 'needs_recheck');
  const twice = applyProgressionObservation(once, observation({ questionId: 'q6', answeredAt: at(24 + 9 * 24), sessionId: 'E', role: 'recheck', taskId: once.tasks[0].id }), question('q6'), rules).state;
  assert.equal(twice.bands[1].status, 'provisionally_stable');
  assert.equal(twice.tasks[0].kind, 'retention');
});

check('scheduler prioritizes due error, excludes exposed items and respects category', () => {
  const first = applyProgressionObservation(createKnowledgePointProgress(rules, 1), observation({ questionId: 'q1', answeredAt: T, correct: false }), question('q1'), rules).state;
  const second = applyProgressionObservation(createKnowledgePointProgress({ ...rules, knowledgePointId: 'other', category: '成语运用' }, 1), {
    ...observation({ questionId: 'other-q1', answeredAt: T }), knowledgePointId: 'other',
  }, { ...question('other-q1'), knowledgePointId: 'other', category: '成语运用' }, {
    ...rules, knowledgePointId: 'other', category: '成语运用',
  }).state;
  const items = [question('q1'), question('q2'), { ...question('other-q2'), knowledgePointId: 'other', category: '成语运用' }];
  const selected = selectDueProgressionQuestions({
    progress: [second, first], rules: [rules, { ...rules, knowledgePointId: 'other', category: '成语运用' }],
    questions: items, now: at(24), capacity: 2,
  });
  assert.deepEqual(selected.assignments.map((item) => item.questionId), ['q2', 'other-q2']);
  assert.deepEqual(selectDueProgressionQuestions({
    progress: [second, first], rules: [rules, { ...rules, knowledgePointId: 'other', category: '成语运用' }],
    questions: items, now: at(24), capacity: 2, category: '字音字形',
  }).assignments.map((item) => item.questionId), ['q2']);
  const exhausted = selectDueProgressionQuestions({ progress: [first], rules: [rules], questions: [question('q1')], now: at(24), capacity: 5 });
  assert.deepEqual(exhausted.assignments, []);
  assert.equal(exhausted.blocked[0].reason, 'no_eligible_item');
  assert.equal(first.tasks[0].dueAt, at(24));
});

check('repeat failure requires bridge before a fresh 24-hour recheck', () => {
  const initial = applyProgressionObservation(createKnowledgePointProgress(rules, 1), observation({ questionId: 'q1', answeredAt: T }), question('q1'), rules).state;
  const passedBand = applyProgressionObservation(initial, observation({ questionId: 'q2', answeredAt: at(24), sessionId: 'B', role: 'retest', taskId: initial.tasks[0].id }), question('q2'), rules).state;
  const lost = applyProgressionObservation(passedBand, observation({ questionId: 'q3', answeredAt: at(192), sessionId: 'C', role: 'retention', taskId: passedBand.tasks[0].id, correct: false }), question('q3'), rules).state;
  const failedAgain = applyProgressionObservation(lost, observation({ questionId: 'q4', answeredAt: at(216), sessionId: 'D', role: 'recheck', taskId: lost.tasks[0].id, correct: false }), question('q4'), rules).state;
  assert.equal(failedAgain.bands[1].bridgeRequired, true);
  assert.equal(selectDueProgressionQuestions({ progress: [failedAgain], rules: [rules], questions: [question('q5')], now: at(240), capacity: 5 }).blocked[0].reason, 'bridge_required');
  const bridged = applyProgressionObservation(failedAgain, observation({ questionId: 'bridge', answeredAt: at(241), sessionId: 'E', role: 'training', correct: true }), question('bridge'), rules).state;
  assert.equal(bridged.bands[1].bridgeRequired, false);
  assert.equal(bridged.tasks[0].dueAt, at(265));
  assert.equal(bridged.currentBand, 2);
});

check('clock rollback and changed content version never promote', () => {
  const first = applyProgressionObservation(createKnowledgePointProgress(rules, 1), observation({ questionId: 'q1', answeredAt: T }), question('q1'), rules).state;
  const rollback = applyProgressionObservation(first, observation({ questionId: 'q2', answeredAt: at(-1) }), question('q2'), rules);
  assert.equal(rollback.reason, 'clock_rollback');
  assert.equal(rollback.state, first);
  const changed = applyProgressionObservation(first, observation({ questionId: 'q2', answeredAt: at(24), sessionId: 'B', role: 'retest', taskId: first.tasks[0].id }), { ...question('q2'), contentVersion: 2 }, rules);
  assert.equal(changed.reason, 'invalid_observation');
  assert.equal(changed.state.currentBand, 1);
  const mappingChanged = applyProgressionObservation(first, observation({ questionId: 'q3', answeredAt: at(24), sessionId: 'B', role: 'retest', taskId: first.tasks[0].id }), question('q3'), {
    ...rules, mappingVersion: 'mapping-v2',
  });
  assert.equal(mappingChanged.reason, 'content_review_required');
  assert.equal(mappingChanged.state.currentBand, 1);
  const blocked = selectDueProgressionQuestions({
    progress: [first], rules: [{ ...rules, mappingVersion: 'mapping-v2' }], questions: [question('q3')], now: at(24), capacity: 5,
  });
  assert.equal(blocked.blocked[0].reason, 'content_review_required');
});

check('versioned local store persists across sessions and rejects stale writes', () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
  };
  const firstTab = new LocalStorageProgressionRepository(storage, 'tab-a');
  const secondTab = new LocalStorageProgressionRepository(storage, 'tab-b');
  const empty = firstTab.load(T);
  assert.equal(empty.status, 'empty');
  if (!empty.store) throw new Error('Missing empty store');
  const point = applyProgressionObservation(createKnowledgePointProgress(rules, 1), observation({ questionId: 'q1', answeredAt: T }), question('q1'), rules).state;
  const saved = firstTab.savePoint({ point, expectedRevision: empty.store.revision, now: T });
  assert.equal(saved.status, 'saved');
  const reloaded = secondTab.load(at(1));
  assert.equal(reloaded.status, 'loaded');
  assert.equal(reloaded.store?.points[0].tasks[0].dueAt, at(24));
  const stale = secondTab.savePoint({ point, expectedRevision: 0, now: at(1) });
  assert.equal(stale.status, 'conflict');
  memory.set(PROGRESSION_STORE_KEY, '{bad-json');
  assert.equal(secondTab.load(at(2)).status, 'invalid');
  assert.equal(secondTab.savePoint({ point, expectedRevision: 1, now: at(2) }).status, 'invalid');
});

check('failed local write is reported without claiming durable progress', () => {
  const storage = {
    getItem: (_key: string) => null,
    setItem: (_key: string, _value: string) => { throw new Error('quota'); },
    removeItem: (_key: string) => {},
  };
  const repository = new LocalStorageProgressionRepository(storage, 'tab-a');
  assert.equal(repository.savePoint({ point: createKnowledgePointProgress(rules, 1), expectedRevision: 0, now: T }).status, 'write_failed');
});

check('initial placement keeps the lower band for every two-question outcome', () => {
  const lower = question('placement-low');
  const higher = { ...question('placement-high', 2), probeEligible: true };
  for (const [lowCorrect, highCorrect] of [[true, true], [true, false], [false, true], [false, false]]) {
    const placed = placeInitialKnowledgePoint({
      rules, lowerQuestion: lower, higherQuestion: higher,
      lowerObservation: observation({ questionId: lower.id, answeredAt: T, correct: lowCorrect }),
      higherObservation: observation({ questionId: higher.id, band: 2, answeredAt: at(1), correct: highCorrect }),
    });
    assert.equal(placed.status, 'provisional');
    if (placed.status !== 'provisional') throw new Error('Expected provisional placement');
    assert.equal(placed.state.currentBand, 1);
    assert.equal(placed.hasConflictingAnswers, lowCorrect !== highCorrect);
    assert.equal(placed.state.bands[1].status, lowCorrect ? 'pending_independent_retest' : 'training');
    assert.equal(placed.state.tasks[0].dueAt, at(24));
    assert.equal(placed.state.bands[2], undefined);
  }
  const unavailable = placeInitialKnowledgePoint({
    rules: { ...rules, contentApprovedForProgression: false }, lowerQuestion: lower, higherQuestion: higher,
    lowerObservation: observation({ questionId: lower.id, answeredAt: T }),
    higherObservation: observation({ questionId: higher.id, band: 2, answeredAt: at(1) }),
  });
  assert.deepEqual(unavailable, { status: 'needs_review', reason: 'content_not_ready' });
});

console.log(`KNOWLEDGE_POINT_PROGRESSION_RESULT ${passed}/${passed} PASS`);
