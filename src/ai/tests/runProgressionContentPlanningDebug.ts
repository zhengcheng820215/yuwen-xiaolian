import assert from 'node:assert/strict';
import { knowledgeQuestionRepository } from '../../domain/knowledge-practice/questions/knowledgeQuestionRepository.ts';
import type { KnowledgeQuestion } from '../../domain/knowledge-practice/questions/knowledgeQuestionTypes.ts';
import { applyProgressionObservation, createKnowledgePointProgress } from '../../domain/knowledge-practice/progression/knowledgePointProgression.ts';
import { auditProgressionContent, type ProgressionContentManifest } from '../../domain/knowledge-practice/progression/progressionContentReadiness.ts';
import { PROGRESSION_PILOT_CONTENT } from '../../domain/knowledge-practice/progression/progressionPilotContent.ts';
import { planProgressionPractice } from '../../domain/knowledge-practice/progression/planProgressionPractice.ts';

const T = '2026-01-01T00:00:00.000Z';
const approvedBank = knowledgeQuestionRepository.listApproved();
const base = approvedBank.find((item) => item.category === '字音字形')!;
const makeQuestion = (id: string, variantGroupId?: string): KnowledgeQuestion => ({
  ...base, id, knowledgePoint: '合成测试知识点', contentVersion: 1,
  ...(variantGroupId ? { variantGroupId } : { variantGroupId: undefined }),
});
const bank = [
  ...Array.from({ length: 6 }, (_, index) => makeQuestion(`pilot-${index + 1}`, index === 0 ? 'pilot-variant' : undefined)),
  makeQuestion('pilot-reinforcement', 'pilot-variant'), makeQuestion('pilot-transfer'),
];
const manifest: ProgressionContentManifest = {
  knowledgePointId: 'pilot-point', knowledgePointLabel: '合成测试知识点', category: '字音字形',
  mappingVersion: 'mapping-v1', ruleVersion: 'pilot-v1', reviewStatus: 'approved',
  reviewedBy: 'test-reviewer', reviewedAt: T,
  bands: [
    { band: 1, cognitiveDemand: '识别单一语境线索' },
    { band: 2, cognitiveDemand: '比较两个语境线索', transitionFromPrevious: '增加一次比较判断' },
  ],
  questions: bank.map((question, index) => ({
    id: question.id, contentVersion: question.contentVersion, knowledgePointId: 'pilot-point',
    band: index < 3 || index === 6 || index === 7 ? 1 : 2, category: question.category,
    approved: true, independentEligible: index < 6, retentionEligible: index < 6,
    independenceReviewed: true,
    role: index < 6 ? 'independent' : index === 6 ? 'reinforcement' : 'transfer',
    ...(question.variantGroupId ? { variantGroupId: question.variantGroupId } : {}),
  })),
  reinforcementPairs: [['pilot-1', 'pilot-reinforcement']],
};

let passed = 0;
function check(name: string, run: () => void): void {
  run();
  console.log(`PASS CONTENT-PLAN-${++passed} ${name}`);
}

check('real pilot catalog remains blocked with zero eligible questions', () => {
  for (const pilot of PROGRESSION_PILOT_CONTENT) {
    const result = auditProgressionContent(pilot, approvedBank);
    assert.equal(result.ready, false);
    assert.equal(result.rules.contentApprovedForProgression, false);
    assert.deepEqual(result.eligibleQuestions, []);
  }
});

check('approved synthetic pool opens only with adjacent bands and complete independent inventory', () => {
  const result = auditProgressionContent(manifest, bank);
  assert.equal(result.ready, true, JSON.stringify(result.issues));
  assert.equal(result.eligibleQuestions.length, 6);
  assert.deepEqual(result.rules.availableBands, [1, 2]);
});

check('review, version, independence and variant failures each close the gate', () => {
  const scenarios: [ProgressionContentManifest, KnowledgeQuestion[], string][] = [
    [{ ...manifest, reviewStatus: 'pending' }, bank, 'review_pending'],
    [manifest, bank.map((question) => question.id === 'pilot-1' ? { ...question, contentVersion: 2 } : question), 'question_not_matching_approved_bank'],
    [{ ...manifest, questions: manifest.questions.map((item) => item.id === 'pilot-2' ? { ...item, independenceReviewed: false } : item) }, bank, 'independence_review_missing'],
    [{ ...manifest, questions: manifest.questions.map((item) => item.id === 'pilot-2' ? { ...item, variantGroupId: 'pilot-variant' } : item) }, bank, 'independent_pool_too_small'],
  ];
  for (const [input, questions, code] of scenarios) {
    const result = auditProgressionContent(input, questions);
    assert.equal(result.ready, false);
    assert(result.issues.some((issue) => issue.code === code), code);
    assert.deepEqual(result.eligibleQuestions, []);
  }
});

check('due retest takes first slot; reserved evidence and shared variant do not enter ordinary fill', () => {
  const readiness = auditProgressionContent(manifest, bank);
  const firstQuestion = readiness.eligibleQuestions[0];
  const initial = createKnowledgePointProgress(readiness.rules, 1);
  const first = applyProgressionObservation(initial, {
    responseId: 'response-1', sessionId: 'session-a', sessionCompleted: true,
    questionId: firstQuestion.id, questionContentVersion: 1, knowledgePointId: 'pilot-point', band: 1,
    role: 'independent', answeredAt: T, firstAttempt: true, hadHintOrFeedback: false, correct: true,
  }, firstQuestion, readiness.rules).state;
  const ordinary = approvedBank.filter((item) => item.category === '字音字形' && item.id !== base.id).slice(0, 3);
  const plan = planProgressionPractice({
    mode: 'category', category: '字音字形', targetCount: 3, seed: 'session-b', now: '2026-01-02T00:00:00.000Z',
    candidates: [...bank, ...ordinary], progress: [first], readiness: [readiness],
  });
  assert.equal(plan.dueAssignments.length, 1);
  assert.equal(plan.dueAssignments[0].taskId, first.tasks[0].id);
  assert.equal(plan.questions[0].id, plan.dueAssignments[0].questionId);
  assert.equal(plan.questions.length, 3);
  assert(plan.questions.slice(1).every((item) => !item.id.startsWith('pilot-')));
  assert.equal(first.tasks[0].dueAt, '2026-01-02T00:00:00.000Z');
});

check('before due and in unready catalog, no retest is silently consumed', () => {
  const readiness = auditProgressionContent(manifest, bank);
  const firstQuestion = readiness.eligibleQuestions[0];
  const first = applyProgressionObservation(createKnowledgePointProgress(readiness.rules, 1), {
    responseId: 'response-early', sessionId: 'session-a', sessionCompleted: true,
    questionId: firstQuestion.id, questionContentVersion: 1, knowledgePointId: 'pilot-point', band: 1,
    role: 'independent', answeredAt: T, firstAttempt: true, hadHintOrFeedback: false, correct: true,
  }, firstQuestion, readiness.rules).state;
  const early = planProgressionPractice({
    mode: 'category', category: '字音字形', targetCount: 2, seed: 'early', now: '2026-01-01T23:59:00.000Z',
    candidates: bank, progress: [first], readiness: [readiness],
  });
  assert.equal(early.dueAssignments.length, 0);
  assert.equal(early.questions.length, 0); // Every progression item stays reserved until its role is scheduled.
  const blocked = planProgressionPractice({
    mode: 'category', category: '字音字形', targetCount: 2, seed: 'blocked', now: '2026-01-02T00:00:00.000Z',
    candidates: bank, progress: [first], readiness: [{ ...readiness, ready: false, rules: { ...readiness.rules, contentApprovedForProgression: false }, eligibleQuestions: [], protectedQuestionIds: [] }],
  });
  assert.equal(blocked.dueAssignments.length, 0);
  assert.equal(blocked.blocked[0].reason, 'content_not_ready');
  assert.equal(first.tasks[0].dueAt, '2026-01-02T00:00:00.000Z');
});

console.log(`PROGRESSION_CONTENT_PLANNING_RESULT ${passed}/${passed} PASS`);
