import assert from 'node:assert/strict';
import { evaluateResponseValidity } from '../agents/taskExecutionAgent.ts';
import { answerMeetsRequiredLength, resolveReadingAnswerLengthPolicy } from '../agents/readingAnswerLengthPolicy.ts';
import { buildStudentFeedbackGrounding } from '../agents/studentFeedbackGroundingAgent.ts';
import { buildStudentThinkingAnalysis } from '../agents/studentThinkingAnalysisAgent.ts';
import { buildStudentFeedbackActionPlan } from '../agents/studentFeedbackActionPlanAgent.ts';
import { decideLearningFeedbackRevisionOffer } from '../agents/learningFeedbackRevisionOfferPolicy.ts';
import { evaluateLearningFeedbackRevision } from '../agents/learningFeedbackRevisionEvaluationAgent.ts';
import { buildRealAIDiagnosisPrompt } from '../prompts/buildRealAIDiagnosisPrompt.ts';
import { buildRealAIDiagnosisPromptV4 } from '../prompts/buildRealAIDiagnosisPromptV4.ts';
import type { ConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import type { StudentLearningFeedback, TaskRequirementCoverage } from '../schemas/studentLearningFeedback.schema.ts';
import type { StudentResponse, TaskExecutionSession } from '../schemas/taskExecution.schema.ts';

// Adapted, synthetic answers. These are deterministic contract checks, not
// claims about a real student's attainment or live model classification.
const checks: string[] = [];
const time = '2026-10-25T00:00:00.000Z';
const task: ConcreteLearningTask = {
  taskId: 'p0-reading-task', studentId: 'p0-isolated-student', sourceType: 'mock',
  targetAbilityId: 'analysis', targetAbilityName: '分析', taskRole: 'training',
  validationGoal: '结合文本说明判断', responseFormat: 'text',
  readingText: '她悄悄走到门外，又停下来听屋里的动静。过了很久，她才轻轻离开。',
  question: '她的举动表达了什么？请结合原文说明。', answerRequirements: ['建议作答 30 字左右。'],
  scoringPoints: [], rubric: [], questionMetadata: { mainAbility: 'analysis', assessmentMode: 'reasoning_chain' },
  expectedDiagnosisFocus: ['依据与判断的联系'], createdAt: time,
};
const session: TaskExecutionSession = {
  executionSessionId: 'p0-session', studentId: task.studentId, taskId: task.taskId,
  status: 'submitted', startedAt: time, submittedAt: time, usedHint: false, hintCount: 0,
};
const response = (answerText: string): StudentResponse => ({
  responseId: 'p0-response', executionSessionId: session.executionSessionId,
  studentId: task.studentId, taskId: task.taskId, answerText, submittedAt: time, usedHint: false, hintCount: 0,
});
const valid = (answer: string, currentTask = task) => evaluateResponseValidity(response(answer), session, currentTask).canDiagnose;
check('short conclusion reaches diagnosis', valid('关心孩子'));
check('selected evidence reaches diagnosis', valid('停下来听屋里的动静'));
check('empty, placeholders, symbols and question copy remain blocked',
  ['', '不知道', '！！！', task.question].every((answer) => !valid(answer)));
check('wholesale material copy remains blocked', !valid(task.readingText!));
check('ordinary configured length is advisory', resolveReadingAnswerLengthPolicy(task.question, 30).mode === 'advisory');
check('advisory count does not reject short content', answerMeetsRequiredLength('关心孩子', resolveReadingAnswerLengthPolicy(task.question, 30)));
const requiredTask = { ...task, question: `${task.question}不少于20字。` };
check('explicit length agrees with domain gate', !valid('关心孩子', requiredTask)
  && !answerMeetsRequiredLength('关心孩子', resolveReadingAnswerLengthPolicy(requiredTask.question, 30)));
check('explicit length is not replaced by generated configuration', resolveReadingAnswerLengthPolicy(requiredTask.question, 80).minimumLength === 20);
check('whitespace cannot fill explicit minimum', !valid('关心孩子                    ', requiredTask));
check('sufficient response still enters diagnosis', valid('她停下来听屋里的动静，说明她担心孩子，不忍心直接打扰。', requiredTask));

const fixtures = [
  {
    name: 'scope_misaligned', answer: '第二句是妹妹说的。',
    gap: requirement('conclusion', 'missing', '比较两句话的语气', 'conclusion_inconsistent', '说话者认错，尚未比较两句话的语气。'),
    foundation: [] as TaskRequirementCoverage[],
  },
  {
    name: 'conclusion_without_evidence', answer: '她关心孩子。',
    gap: requirement('text_evidence', 'missing', '引用支持关心的具体细节', 'missing_text_evidence', '还缺少一处支持关心的文本依据。'),
    foundation: [requirement('conclusion', 'covered', '说明人物举动的含义', undefined, undefined, ['她关心孩子'])],
  },
  {
    name: 'evidence_without_explanation', answer: '破折号拉长了声音，表现不舍。',
    gap: requirement('reasoning_relation', 'missing', '解释标点与情感的联系', 'missing_reasoning_relation', '需要解释声音拉长为什么表达不舍。'),
    foundation: [requirement('conclusion', 'covered', '说明标点的表达效果', undefined, undefined, ['表现不舍']),
      requirement('text_evidence', 'covered', '指出标点效果', undefined, undefined, ['破折号拉长了声音'])],
  },
  {
    name: 'partial_required_aspects', answer: '作者怀念过去相处的时光。',
    gap: requirement('expression', 'missing', '分别解释怀念和悔恨的具体内容', 'incomplete_task_requirement', '尚未解释悔恨的具体原因。'),
    foundation: [requirement('conclusion', 'partially_covered', '说明两种情感的具体内容', undefined, undefined, ['怀念过去相处的时光'])],
  },
];
for (const fixture of fixtures) {
  const feedback = makeFeedback([...fixture.foundation, fixture.gap], fixture.gap);
  const grounding = buildStudentFeedbackGrounding(feedback);
  const thinking = buildStudentThinkingAnalysis(feedback, grounding, response(fixture.answer));
  const plan = buildStudentFeedbackActionPlan({ feedback, grounding, thinkingAnalysis: thinking, studentResponse: response(fixture.answer), taskRole: 'training' });
  check(`${fixture.name}: grounded single action`, plan.validation.passed && plan.nextOperations.length === 1 && Boolean(plan.missingAnswerPart));
  check(`${fixture.name}: no psychological template or global label`, !/人物心理|能力差|不会理解|已经掌握/.test(JSON.stringify(plan)));
  check(`${fixture.name}: cited student spans are real`, thinking.completedSteps.every((step) => {
    const quoted = step.action.match(/“([^”]+)”/)?.[1];
    return !quoted || fixture.answer.includes(quoted);
  }));
}
const fabricated = requirement('conclusion', 'covered', '说明主题', undefined, undefined, ['学生从未说过的话']);
const fabricatedFeedback = makeFeedback([fabricated, fixtures[1].gap], fixtures[1].gap);
check('unobserved quotation is not praised', buildStudentThinkingAnalysis(fabricatedFeedback,
  buildStudentFeedbackGrounding(fabricatedFeedback), response('关心孩子')).completedSteps.length === 0);
const fabricatedGrounding = buildStudentFeedbackGrounding(fabricatedFeedback);
const fabricatedPlan = buildStudentFeedbackActionPlan({ feedback: fabricatedFeedback, grounding: fabricatedGrounding,
  thinkingAnalysis: buildStudentThinkingAnalysis(fabricatedFeedback, fabricatedGrounding, response('关心孩子')),
  studentResponse: response('关心孩子'), taskRole: 'training' });
check('action plan cannot reintroduce unobserved quote', !JSON.stringify(fabricatedPlan).includes('学生从未说过的话')
  && fabricatedPlan.acknowledgedAction === undefined);

const evidenceGap = fixtures[1].gap;
const relationGap = fixtures[2].gap;
const offer = decideLearningFeedbackRevisionOffer({
  taskRole: 'training', answerStatus: 'partially_meets', formalDiagnosisId: 'initial-diagnosis',
  formalFeedbackId: 'initial-feedback', formalFeedbackReady: true,
  requirementCoverage: [evidenceGap, relationGap], primaryGapRequirementId: relationGap.requirementId,
  rubricRequirementBindings: [{ requirementId: evidenceGap.requirementId, rubricItemId: 'r-evidence' },
    { requirementId: relationGap.requirementId, rubricItemId: 'r-relation' }],
});
check('revision follows feedback primary requirement, not array order', offer.revisionGoal?.primaryIssueCode === 'missing_reasoning_relation');
check('revision captures exact rubric binding', offer.revisionGoal?.issueRubricBindings?.[0].rubricItemIds[0] === 'r-relation');
const profile: StudentAbilityProfile = {
  studentId: task.studentId, generatedAt: time, current_weakness: { primary: 'analysis', secondary: [] },
  ability_status: [], improvement_signals: [], continue_training_focus: '分析', evidence_links: [], next_step_recommendation: '继续观察',
};
const base = {
  revisionId: 'p0-revision', studentId: task.studentId, taskId: task.taskId, abilityId: 'analysis',
  resourceVersionId: 'p0-resource-v1', rubricVersion: 'p0-rubric-v1',
  initialAnswer: '她关心孩子。', revisedAnswer: '她停下来听屋里的动静，说明她担心孩子，又不想打扰孩子。',
  revisionGoal: offer.revisionGoal!, initialDiagnosisId: 'initial-diagnosis',
  initialDiagnosis: diagnosis(['r-evidence', 'r-relation']), revisedDiagnosisId: 'revised-diagnosis',
  revisedDiagnosisSchemaVersion: 'diagnosis_v1', revisedDiagnosis: diagnosis([]), currentProfile: profile, evaluatedAt: time,
};
const original = JSON.stringify(base);
const unrelated = evaluateLearningFeedbackRevision({ ...base, revisedDiagnosis: diagnosis(['r-relation']) });
check('unrelated item improvement cannot resolve primary gap', unrelated.evaluation.outcome === 'unchanged'
  && !unrelated.evaluation.feedbackRespondedTo && unrelated.evaluation.remainingIssueCodes.includes('missing_reasoning_relation'));
check('unrelated improvement is not described as reasoning fixed', !unrelated.evaluation.improvedObservation.includes('已经补充'));
const improved = evaluateLearningFeedbackRevision(base);
check('target improvement is recognized', improved.evaluation.outcome === 'improved' && improved.evaluation.feedbackRespondedTo
  && improved.evaluation.resolvedIssueCodes.includes('missing_reasoning_relation'));
for (const answer of ['她关心孩子。', '她关心孩子！', '“她关心孩子……”']) {
  const unchanged = evaluateLearningFeedbackRevision({ ...base, revisedAnswer: answer });
  check(`no substantive revision: ${answer}`, unchanged.evaluation.outcome === 'unchanged'
    && !unchanged.evaluation.feedbackRespondedTo && unchanged.evaluation.resolvedIssueCodes.length === 0);
}
const padded = evaluateLearningFeedbackRevision({ ...base, revisedAnswer: '她关心孩子，她非常关心孩子，真的很关心孩子。', revisedDiagnosis: base.initialDiagnosis });
check('word count growth alone is not improvement', padded.evaluation.outcome === 'unchanged');
const unbound = evaluateLearningFeedbackRevision({ ...base, revisionGoal: { ...base.revisionGoal, issueRubricBindings: undefined, primaryRequirementId: undefined } });
check('legacy unbound goal stays conservative', !unbound.evaluation.feedbackRespondedTo && unbound.evaluation.resolvedIssueCodes.length === 0);
check('initial answer and diagnosis remain immutable', JSON.stringify(base) === original);
check('supported revision cannot upgrade ability status', improved.profileUpdateDecision.action === 'append_evidence_only'
  && improved.feedbackSupportedEvidence.requiresIndependentVerification
  && improved.profileAfterRevision.ability_status.every((item) => item.status !== 'stable'));
for (const build of [buildRealAIDiagnosisPrompt, buildRealAIDiagnosisPromptV4]) {
  const prompt = build({ question: task.question, referenceAnswer: '', studentAnswer: '关心孩子', questionMetadata: task.questionMetadata });
  check(`${build.name}: same calibration and rubric identities`, prompt.includes('reading_response_calibration_p0_v1')
    && prompt.includes('对象或范围错位') && prompt.includes('missingRubricItems') && prompt.includes('不等于学生独立推断'));
}
checks.forEach((name) => console.log(`PASS | ${name}`));
console.log(`Result: ${checks.length}/${checks.length} PASS (isolated deterministic fixtures; no live model or student efficacy claim)`);

function requirement(type: TaskRequirementCoverage['requirementType'], status: TaskRequirementCoverage['status'], text: string,
  gapReasonCode?: TaskRequirementCoverage['gapReasonCode'], gapMessage?: string, studentEvidence: string[] = []): TaskRequirementCoverage {
  return { requirementId: `p0-${type}`, requirementType: type, requirementText: text, required: true, status,
    studentEvidence, taskEvidence: [text], source: 'formal_diagnosis', gapReasonCode, gapMessage };
}
function makeFeedback(coverage: TaskRequirementCoverage[], gap: TaskRequirementCoverage): StudentLearningFeedback {
  return { learningRoundId: 'p0-round', studentId: task.studentId, stage: 'result', resultStatus: 'completed',
    headline: '本题反馈', summary: '本次反馈已形成。', whatYouDidWell: [], whatNeedsAttention: [gap.gapMessage!],
    nextActionText: '根据本次反馈修订。', guidance: { detailsToReview: [], revisionActions: ['对照题目，补上尚未回答的那一项。'] },
    thinkingReview: { requirementCoverage: coverage, coveredPoints: [], primaryGapRequirementId: gap.requirementId,
      primaryGap: gap.gapMessage, missingPoints: [gap.gapMessage!] }, canRetry: false, canFinishRound: true, source: 'learning_round' };
}
function diagnosis(missing: string[]): DiagnosisResult {
  return { taskType: 'open_response', correct: missing.length ? null : true, strategyUsed: '文本分析',
    answerStatus: missing.length ? 'partially_meets' : 'fully_meets', scoreBand: missing.length ? 'medium' : 'high',
    rubricItems: ['r-evidence', 'r-relation'].map((id) => ({ id, label: id, ability: 'analysis', required: true, matched: !missing.includes(id) })),
    matchedRubricItems: ['r-evidence', 'r-relation'].filter((id) => !missing.includes(id)), missingRubricItems: missing,
    mainAbility: 'analysis', relatedAbilities: [], surfaceError: '按实际内容核对', rootCause: '本次可观察内容',
    errorType: '待验证', abilityEvidence: [], diagnosisSummary: '按评分项核对', nextTraining: '补充依据与判断的关系。', confidence: 0.8 };
}
function check(name: string, value: boolean) { assert.ok(value, name); checks.push(name); }
