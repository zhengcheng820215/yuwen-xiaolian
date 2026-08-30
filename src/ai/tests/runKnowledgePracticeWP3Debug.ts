import assert from 'node:assert/strict';
import { buildPracticeSession } from '../../domain/knowledge-practice/practice/buildPracticeSession.ts';
import type { KnowledgeQuestion } from '../../domain/knowledge-practice/questions/knowledgeQuestionTypes.ts';
import { knowledgeQuestionRepository } from '../../domain/knowledge-practice/questions/knowledgeQuestionRepository.ts';
import { buildAnswerFeedback } from '../../domain/knowledge-practice/response/buildAnswerFeedback.ts';
import { evaluateKnowledgeAnswer } from '../../domain/knowledge-practice/response/evaluateKnowledgeAnswer.ts';
import { advancePracticeAttempt } from '../../domain/knowledge-practice/response/practiceAttemptState.ts';
import { validatePracticeAttempt } from '../../domain/knowledge-practice/response/practiceAttemptValidator.ts';
import type { PracticeAttempt, PracticeResponse, SubmittedPracticeAnswer } from '../../domain/knowledge-practice/response/practiceResponseTypes.ts';
import { createPracticeAttempt, submitPracticeAnswer } from '../../domain/knowledge-practice/response/submitPracticeAnswer.ts';
import { MAX_PRACTICE_QUESTION_DURATION_MS } from '../../domain/knowledge-practice/response/validateSubmittedAnswer.ts';

type Check = { id: string; name: string; run: () => void };
const NOW = '2026-08-29T08:01:00.000Z';
const choice = knowledgeQuestionRepository.getApprovedById('q-cy-1')!;
const truth = knowledgeQuestionRepository.getApprovedById('q-zy-3')!;
const fill = knowledgeQuestionRepository.getApprovedById('q-gs-1')!;

function answer(value: string, overrides: Partial<SubmittedPracticeAnswer> = {}): SubmittedPracticeAnswer {
  return { value, submittedAt: NOW, durationMs: 12_345, ...overrides };
}

function sessionFor(question: KnowledgeQuestion) {
  const result = buildPracticeSession({
    mode: 'category',
    category: question.category,
    targetCount: 1,
    now: '2026-08-29T08:00:00.000Z',
    idFactory: () => `kp-session-wp3-${question.id}`,
  });
  assert(result.ok);
  return {
    ...result.session,
    baseQuestionIds: [question.id],
    queue: [{
      ...result.session.queue[0],
      questionId: question.id,
      questionContentVersion: question.contentVersion,
    }],
  };
}

function attemptFor(question = choice): PracticeAttempt {
  return createPracticeAttempt(sessionFor(question));
}

function submit(question: KnowledgeQuestion, value: string, attempt = attemptFor(question)) {
  return submitPracticeAnswer({
    attempt,
    queueItemId: attempt.session.queue[attempt.session.currentIndex].id,
    question,
    answer: answer(value),
  });
}

function fakeFill(overrides: Partial<KnowledgeQuestion> = {}): KnowledgeQuestion {
  return {
    ...fill,
    id: 'fake-fill',
    correctAnswer: '甲 乙',
    acceptedAnswers: ['甲 乙', '甲乙'],
    answerNormalization: ['normalize_fullwidth_space', 'trim', 'collapse_whitespace', 'ignore_terminal_punctuation'],
    ...overrides,
  };
}

function expectEvaluationError(question: KnowledgeQuestion, input: SubmittedPracticeAnswer, code: string) {
  const result = evaluateKnowledgeAnswer(question, input);
  assert(!result.ok && result.error.code === code, `Expected ${code}`);
}

function expectAttemptIssue(attempt: PracticeAttempt, code: string) {
  const result = validatePracticeAttempt(attempt);
  assert(result.issues.some((issue) => issue.code === code), `Expected ${code}; got ${result.issues.map((issue) => issue.code).join(', ')}`);
}

const checks: Check[] = [
  { id: 'WP3-E01', name: 'single choice correct option id is correct', run: () => { const result = evaluateKnowledgeAnswer(choice, answer(choice.correctAnswer)); assert(result.ok && result.evaluation.isCorrect); } },
  { id: 'WP3-E02', name: 'single choice wrong option id is incorrect', run: () => { const wrong = choice.options!.find((item) => item.id !== choice.correctAnswer)!.id; const result = evaluateKnowledgeAnswer(choice, answer(wrong)); assert(result.ok && !result.evaluation.isCorrect); } },
  { id: 'WP3-E03', name: 'true false uses fixed option id', run: () => { const result = evaluateKnowledgeAnswer(truth, answer(truth.correctAnswer)); assert(result.ok && result.evaluation.isCorrect); } },
  { id: 'WP3-E04', name: 'invalid option id is rejected', run: () => expectEvaluationError(choice, answer('opt-missing'), 'option_invalid') },
  { id: 'WP3-E05', name: 'option display text is rejected', run: () => expectEvaluationError(choice, answer(choice.options![0].text), 'option_invalid') },
  { id: 'WP3-E06', name: 'fill trims declared outer whitespace', run: () => { const result = evaluateKnowledgeAnswer(fakeFill(), answer('  甲 乙  ')); assert(result.ok && result.evaluation.isCorrect); } },
  { id: 'WP3-E07', name: 'fill collapses declared whitespace', run: () => { const result = evaluateKnowledgeAnswer(fakeFill(), answer('甲     乙')); assert(result.ok && result.evaluation.isCorrect); } },
  { id: 'WP3-E08', name: 'fill normalizes declared fullwidth space', run: () => { const result = evaluateKnowledgeAnswer(fakeFill(), answer('甲　乙')); assert(result.ok && result.evaluation.isCorrect); } },
  { id: 'WP3-E09', name: 'terminal punctuation ignored only when declared', run: () => { const yes = evaluateKnowledgeAnswer(fakeFill(), answer('甲乙。')); const no = evaluateKnowledgeAnswer(fakeFill({ answerNormalization: ['trim'] }), answer('甲乙。')); assert(yes.ok && yes.evaluation.isCorrect && no.ok && !no.evaluation.isCorrect); } },
  { id: 'WP3-E10', name: 'explicit accepted answer matches', run: () => { const result = evaluateKnowledgeAnswer(fakeFill(), answer('甲乙')); assert(result.ok && result.evaluation.isCorrect); } },
  { id: 'WP3-E11', name: 'undeclared synonym stays incorrect', run: () => { const result = evaluateKnowledgeAnswer(fakeFill(), answer('甲和乙')); assert(result.ok && !result.evaluation.isCorrect); } },
  { id: 'WP3-E12', name: 'typo stays incorrect', run: () => { const result = evaluateKnowledgeAnswer(fill, answer('江春入旧念')); assert(result.ok && !result.evaluation.isCorrect); } },
  { id: 'WP3-E13', name: 'blank answer is rejected', run: () => expectEvaluationError(fill, answer('   '), 'answer_empty') },
  { id: 'WP3-E14', name: 'punctuation only is rejected', run: () => expectEvaluationError(fill, answer('！？。'), 'answer_punctuation_only') },
  { id: 'WP3-E15', name: 'too long answer is rejected', run: () => expectEvaluationError(fill, answer('字'.repeat(201)), 'answer_too_long') },
  { id: 'WP3-E16', name: 'control character is rejected', run: () => expectEvaluationError(fill, answer('江春\n入旧年'), 'answer_control_character') },
  { id: 'WP3-E17', name: 'invalid duration is rejected', run: () => expectEvaluationError(fill, answer(fill.correctAnswer, { durationMs: -1 }), 'duration_invalid') },
  { id: 'WP3-E18', name: 'duration is capped at thirty minutes', run: () => { const result = evaluateKnowledgeAnswer(fill, answer(fill.correctAnswer, { durationMs: MAX_PRACTICE_QUESTION_DURATION_MS + 5_000 })); assert(result.ok && result.durationMs === MAX_PRACTICE_QUESTION_DURATION_MS); } },
  { id: 'WP3-E19', name: 'invalid submitted time is rejected', run: () => expectEvaluationError(fill, answer(fill.correctAnswer, { submittedAt: 'invalid' }), 'submitted_at_invalid') },

  { id: 'WP3-R01', name: 'first valid submit creates response', run: () => { const result = submit(choice, choice.correctAnswer); assert(result.ok && result.outcome === 'created'); } },
  { id: 'WP3-R02', name: 'response freezes session queue and question identity', run: () => { const attempt = attemptFor(); const result = submit(choice, choice.correctAnswer, attempt); assert(result.ok); assert.equal(result.response.sessionId, attempt.session.id); assert.equal(result.response.queueItemId, attempt.session.queue[0].id); assert.equal(result.response.questionContentVersion, attempt.session.queue[0].questionContentVersion); } },
  { id: 'WP3-R03', name: 'same submit returns original response', run: () => { const first = submit(choice, choice.correctAnswer); assert(first.ok); const second = submitPracticeAnswer({ attempt: first.attempt, queueItemId: first.response.queueItemId, question: choice, answer: answer(choice.correctAnswer) }); assert(second.ok && second.outcome === 'already_submitted' && second.response === first.response); } },
  { id: 'WP3-R04', name: 'different duplicate answer cannot overwrite first fact', run: () => { const wrong = choice.options!.find((item) => item.id !== choice.correctAnswer)!.id; const first = submit(choice, wrong); assert(first.ok); const second = submitPracticeAnswer({ attempt: first.attempt, queueItemId: first.response.queueItemId, question: choice, answer: answer(choice.correctAnswer) }); assert(second.ok && second.response.submittedAnswer === wrong && !second.response.isCorrect); } },
  { id: 'WP3-R05', name: 'duplicate keeps original time and duration', run: () => { const first = submit(choice, choice.correctAnswer); assert(first.ok); const second = submitPracticeAnswer({ attempt: first.attempt, queueItemId: first.response.queueItemId, question: choice, answer: answer(choice.correctAnswer, { submittedAt: '2026-08-29T09:00:00Z', durationMs: 99_999 }) }); assert(second.ok && second.response.answeredAt === NOW && second.response.durationMs === 12_345); } },
  { id: 'WP3-R06', name: 'non-current queue item is rejected', run: () => { const attempt = attemptFor(); const result = submitPracticeAnswer({ attempt, queueItemId: 'wrong-item', question: choice, answer: answer(choice.correctAnswer) }); assert(!result.ok && result.error.code === 'queue_item_not_current'); } },
  { id: 'WP3-R07', name: 'completed session rejects submit', run: () => { const first = submit(choice, choice.correctAnswer); assert(first.ok); const completed = advancePracticeAttempt(first.attempt, '2026-08-29T08:02:00Z'); const result = submitPracticeAnswer({ attempt: completed, queueItemId: completed.session.queue[0].id, question: choice, answer: answer(choice.correctAnswer) }); assert(!result.ok && result.error.code === 'session_not_active'); } },
  { id: 'WP3-R08', name: 'content version mismatch rejects without queue mutation', run: () => { const attempt = attemptFor(); const changed = { ...choice, contentVersion: choice.contentVersion + 1 }; const result = submitPracticeAnswer({ attempt, queueItemId: attempt.session.queue[0].id, question: changed, answer: answer(changed.correctAnswer) }); assert(!result.ok && result.error.code === 'question_version_mismatch'); assert.equal(attempt.session.queue[0].status, 'pending'); } },
  { id: 'WP3-R09', name: 'created response atomically answers queue item', run: () => { const result = submit(choice, choice.correctAnswer); assert(result.ok && result.attempt.responses.length === 1 && result.attempt.session.queue[0].status === 'answered'); } },
  { id: 'WP3-R10', name: 'failed submit leaves attempt unchanged', run: () => { const attempt = attemptFor(); const result = submit(choice, 'invalid', attempt); assert(!result.ok); assert.deepEqual(attempt, attemptFor()); } },
  { id: 'WP3-R11', name: 'submit does not mutate input attempt', run: () => { const attempt = attemptFor(); const snapshot = structuredClone(attempt); submit(choice, choice.correctAnswer, attempt); assert.deepEqual(attempt, snapshot); } },
  { id: 'WP3-R12', name: 'attempt survives json serialization', run: () => { const result = submit(choice, choice.correctAnswer); assert(result.ok); const parsed = JSON.parse(JSON.stringify(result.attempt)); assert(validatePracticeAttempt(parsed).passed); } },

  { id: 'WP3-F01', name: 'correct feedback uses correct option analysis', run: () => { const result = submit(choice, choice.correctAnswer); assert(result.ok); assert.equal(result.feedback.keyEvidence, choice.answerAnalysis![choice.correctAnswer]); } },
  { id: 'WP3-F02', name: 'wrong feedback uses selected option analysis', run: () => { const wrong = choice.options!.find((item) => item.id !== choice.correctAnswer)!.id; const result = submit(choice, wrong); assert(result.ok); assert.equal(result.feedback.currentChoiceExplanation, choice.answerAnalysis![wrong]); } },
  { id: 'WP3-F03', name: 'reviewed misconception maps to selected answer', run: () => { const wrong = Object.keys(choice.misconceptionByAnswer || {})[0]; assert(wrong); const result = submit(choice, wrong); assert(result.ok); assert.equal(result.feedback.misconception?.code, choice.misconceptionByAnswer![wrong].code); } },
  { id: 'WP3-F04', name: 'missing misconception does not infer cause', run: () => { const question = { ...choice, misconceptionByAnswer: {} }; const response = { ...(submit(choice, choice.options!.find((item) => item.id !== choice.correctAnswer)!.id) as Extract<ReturnType<typeof submit>, { ok: true }>).response }; const feedback = buildAnswerFeedback(question, response); assert.equal(feedback.misconception, undefined); assert(feedback.contentFallbacks.includes('misconception_missing')); } },
  { id: 'WP3-F05', name: 'missing choice analysis uses explicit fallback', run: () => { const wrong = choice.options!.find((item) => item.id !== choice.correctAnswer)!.id; const question = { ...choice, answerAnalysis: { [choice.correctAnswer]: choice.answerAnalysis![choice.correctAnswer] } }; const base = submit(choice, wrong); assert(base.ok); const feedback = buildAnswerFeedback(question, base.response); assert(feedback.contentFallbacks.includes('choice_analysis_missing')); } },
  { id: 'WP3-F06', name: 'missing correct analysis uses general explanation', run: () => { const response = submit(choice, choice.correctAnswer); assert(response.ok); const feedback = buildAnswerFeedback({ ...choice, answerAnalysis: {} }, response.response); assert.equal(feedback.keyEvidence, choice.explanation); assert(feedback.contentFallbacks.includes('key_evidence_from_general_explanation')); } },
  { id: 'WP3-F07', name: 'fill feedback shows submitted and correct answer', run: () => { const result = submit(fill, '错误答案'); assert(result.ok); assert.equal(result.feedback.submittedAnswerText, '错误答案'); assert.equal(result.feedback.correctAnswerText, fill.correctAnswer); } },
  { id: 'WP3-F08', name: 'feedback exposes at most three reviewed steps', run: () => { const result = submit(choice, choice.correctAnswer); assert(result.ok); assert.deepEqual(result.feedback.solutionSteps, choice.solutionSteps.slice(0, 3)); } },
  { id: 'WP3-F09', name: 'feedback construction is deterministic', run: () => { const result = submit(choice, choice.correctAnswer); assert(result.ok); assert.deepEqual(buildAnswerFeedback(choice, result.response), buildAnswerFeedback(choice, result.response)); } },
  { id: 'WP3-F10', name: 'feedback avoids long-term mastery claims', run: () => { const result = submit(choice, choice.correctAnswer); assert(result.ok); const text = JSON.stringify(result.feedback); assert(!/(已掌握|能力提升|基础差|很粗心)/u.test(text)); } },

  { id: 'WP3-A01', name: 'answered item without response fails validation', run: () => { const attempt = attemptFor(); attempt.session.queue[0].status = 'answered'; expectAttemptIssue(attempt, 'attempt.answered_response_mismatch'); } },
  { id: 'WP3-A02', name: 'pending item with response fails validation', run: () => { const result = submit(choice, choice.correctAnswer); assert(result.ok); result.attempt.session.queue[0].status = 'pending'; expectAttemptIssue(result.attempt, 'attempt.pending_response_mismatch'); } },
  { id: 'WP3-A03', name: 'duplicate response key fails validation', run: () => { const result = submit(choice, choice.correctAnswer); assert(result.ok); result.attempt.responses.push({ ...result.response, id: `${result.response.id}-copy` }); result.attempt.feedbackByResponseId[`${result.response.id}-copy`] = { ...result.feedback, responseId: `${result.response.id}-copy` }; expectAttemptIssue(result.attempt, 'attempt.response_key_duplicate'); } },
  { id: 'WP3-A04', name: 'missing queue reference fails validation', run: () => { const result = submit(choice, choice.correctAnswer); assert(result.ok); result.response.queueItemId = 'missing'; expectAttemptIssue(result.attempt, 'attempt.response_queue_missing'); } },
  { id: 'WP3-A05', name: 'question version mismatch fails validation', run: () => { const result = submit(choice, choice.correctAnswer); assert(result.ok); result.response.questionContentVersion += 1; expectAttemptIssue(result.attempt, 'attempt.response_queue_mismatch'); } },
  { id: 'WP3-A06', name: 'feedback referencing missing response fails validation', run: () => { const attempt = attemptFor(); attempt.feedbackByResponseId.ghost = { schemaVersion: 1, responseId: 'ghost', result: 'correct', headline: 'x', submittedAnswerText: 'x', correctAnswerText: 'x', keyEvidence: 'x', knowledgePoint: 'x', solutionSteps: [], contentFallbacks: [] }; expectAttemptIssue(attempt, 'attempt.feedback_response_missing'); } },
  { id: 'WP3-A07', name: 'response missing feedback fails validation', run: () => { const result = submit(choice, choice.correctAnswer); assert(result.ok); delete result.attempt.feedbackByResponseId[result.response.id]; expectAttemptIssue(result.attempt, 'attempt.response_feedback_missing'); } },
  { id: 'WP3-A08', name: 'invalid response duration fails validation', run: () => { const result = submit(choice, choice.correctAnswer); assert(result.ok); result.response.durationMs = -1; expectAttemptIssue(result.attempt, 'attempt.response_duration_invalid'); } },
];

let passed = 0;
for (const check of checks) {
  try {
    check.run();
    passed += 1;
    console.log(`PASS ${check.id} ${check.name}`);
  } catch (error) {
    console.error(`FAIL ${check.id} ${check.name}`);
    console.error(error);
  }
}
console.log(`WP3_RESULT ${passed}/${checks.length} ${passed === checks.length ? 'PASS' : 'FAIL'}`);
if (passed !== checks.length) process.exitCode = 1;
