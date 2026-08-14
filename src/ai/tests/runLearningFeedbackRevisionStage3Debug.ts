import assert from 'node:assert/strict';
import { evaluateLearningFeedbackRevision } from '../agents/learningFeedbackRevisionEvaluationAgent.ts';
import { InMemoryLearningTaskAttemptRepository } from '../repositories/inMemoryLearningTaskAttemptRepository.ts';
import type { DiagnosisResult, OpenResponseAnswerStatus } from '../schemas/diagnosis.schema.ts';
import type { RevisionGoal } from '../schemas/learningFeedbackRevision.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import { LearningFeedbackRevisionPersistenceService } from '../services/learningFeedbackRevisionPersistenceService.ts';

const T0 = '2026-08-14T03:00:00.000Z';
const T1 = '2026-08-14T03:01:00.000Z';
const T2 = '2026-08-14T03:02:00.000Z';
const T3 = '2026-08-14T03:03:00.000Z';
const checks: string[] = [];

async function main(): Promise<void> {
  const outcomes = [
    evaluate('improved', diagnosis('partially_meets', ['evidence']), diagnosis('fully_meets', [])).evaluation.outcome,
    evaluate('partial', diagnosis('partially_meets', ['evidence', 'relation']), diagnosis('partially_meets', ['relation'])).evaluation.outcome,
    evaluate('unchanged', diagnosis('partially_meets', ['evidence']), diagnosis('partially_meets', ['evidence'])).evaluation.outcome,
    evaluate('regressed', diagnosis('partially_meets', ['evidence']), diagnosis('does_not_meet', ['evidence', 'relation'])).evaluation.outcome,
  ];
  check(outcomes.join('|') === 'improved|partially_improved|unchanged|regressed', 'four_revision_outcomes_are_deterministic');

  const bundle = evaluate(
    'happy',
    diagnosis('partially_meets', ['evidence']),
    diagnosis('fully_meets', []),
  );
  check(bundle.evaluation.initialDiagnosisId === 'diagnosis-initial-happy'
    && bundle.evaluation.revisedDiagnosisId === 'diagnosis-revised-happy', 'evaluation_binds_both_formal_diagnoses');
  check(bundle.feedbackSupportedEvidence.supportLevel === 'feedback_supported'
    && bundle.feedbackSupportedEvidence.requiresIndependentVerification, 'revision_evidence_is_feedback_supported');
  check(bundle.feedbackSupportedEvidence.confidence <= 0.6, 'revision_evidence_confidence_is_bounded');
  check(bundle.profileUpdateDecision.action === 'append_evidence_only', 'profile_decision_is_append_only');
  check(bundle.profileAfterRevision.ability_status[0].status === currentProfile().ability_status[0].status, 'revision_does_not_change_ability_status');
  check(bundle.profileAfterRevision.ability_status[0].evidence_links.at(-1)?.supportLevel === 'feedback_supported', 'profile_keeps_support_level');
  check(bundle.growthMemoryRecord.action === 'append_evidence_only'
    && bundle.growthMemoryRecord.limitations.includes('反馈支持下的改善不能等同于独立掌握。'), 'growth_memory_keeps_revision_limitations');

  let mismatchRejected = false;
  try {
    evaluateLearningFeedbackRevision({
      ...evaluationInput('mismatch', diagnosis('partially_meets', ['evidence']), diagnosis('fully_meets', [])),
      initialDiagnosisId: 'different-diagnosis',
    });
  } catch (error) {
    mismatchRejected = error instanceof Error && error.message === 'revision_evaluation_initial_diagnosis_mismatch';
  }
  check(mismatchRejected, 'formal_diagnosis_identity_mismatch_is_blocked');

  const repository = new InMemoryLearningTaskAttemptRepository();
  const service = new LearningFeedbackRevisionPersistenceService(repository, () => T3);
  const completed = await prepareSubmitted(service, 'happy');
  const completedBundle = evaluateLearningFeedbackRevision({
    ...evaluationInput('happy', diagnosis('partially_meets', ['evidence']), diagnosis('fully_meets', [])),
    revisionId: completed.revision!.revisionId,
  });
  await service.startRevisionEvaluation(completed.learningTaskAttemptId, T2);
  const terminal = await service.completeRevisionEvaluation(completed.learningTaskAttemptId, completedBundle, T3);
  check(terminal.status === 'completed_with_revision' && terminal.revision?.status === 'evaluated', 'evaluation_bundle_reaches_terminal_state');
  check(terminal.initialResponse.answerText === '父亲舍不得离开。', 'initial_response_remains_frozen_after_evaluation');
  check((await service.completeRevisionEvaluation(completed.learningTaskAttemptId, completedBundle, T3)).status === 'completed_with_revision', 'evaluation_completion_is_idempotent');

  const pending = await prepareSubmitted(service, 'retry');
  await service.startRevisionEvaluation(pending.learningTaskAttemptId, T2);
  const failed = await service.markRevisionEvaluationPendingRetry(pending.learningTaskAttemptId, {
    code: 'provider_unavailable',
    message: '修订评价暂时不可用。',
    retryable: true,
  }, T2);
  check(failed.status === 'completed_with_revision_pending_evaluation'
    && failed.revision?.revisedResponse?.answerText.includes('文中父亲'), 'evaluation_failure_preserves_revised_response');
  const retrying = await service.startRevisionEvaluation(pending.learningTaskAttemptId, T3);
  check(retrying.revision?.evaluationAttemptCount === 2, 'automatic_retry_attempt_is_recorded');
  const retryBundle = evaluateLearningFeedbackRevision({
    ...evaluationInput('retry', diagnosis('partially_meets', ['evidence']), diagnosis('fully_meets', [])),
    revisionId: pending.revision!.revisionId,
  });
  const recovered = await service.completeRevisionEvaluation(
    pending.learningTaskAttemptId,
    retryBundle,
    T3,
  );
  check(recovered.status === 'completed_with_revision' && !recovered.revision?.evaluationIssue, 'pending_evaluation_recovers_without_resubmission');

  console.log('\nLearning Feedback Revision Stage 3 Debug');
  console.log('='.repeat(78));
  checks.forEach((name) => console.log(`PASS | ${name}`));
  console.log('-'.repeat(78));
  console.log(`Result: ${checks.length} / ${checks.length} PASS`);
}

function evaluate(id: string, initialDiagnosis: DiagnosisResult, revisedDiagnosis: DiagnosisResult) {
  return evaluateLearningFeedbackRevision(evaluationInput(id, initialDiagnosis, revisedDiagnosis));
}

function evaluationInput(id: string, initialDiagnosis: DiagnosisResult, revisedDiagnosis: DiagnosisResult) {
  return {
    revisionId: `revision-${id}`,
    studentId: 'student-local-primary-v1',
    taskId: `task-${id}`,
    abilityId: 'analysis-reasoning',
    abilityLabel: '分析与推理',
    resourceVersionId: `resource-version-${id}`,
    rubricVersion: `rubric-${id}`,
    initialAnswer: '父亲舍不得离开。',
    revisedAnswer: '父亲舍不得离开。文中父亲停留很久，这个行为说明他珍惜这段经历。',
    revisionGoal: goal(`diagnosis-initial-${id}`),
    initialDiagnosisId: `diagnosis-initial-${id}`,
    initialDiagnosis,
    revisedDiagnosisId: `diagnosis-revised-${id}`,
    revisedDiagnosisSchemaVersion: 'diagnosis_v1',
    revisedDiagnosis,
    currentProfile: currentProfile(),
    evaluatedAt: T3,
  };
}

function diagnosis(answerStatus: OpenResponseAnswerStatus, missingRubricItems: string[]): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: answerStatus === 'fully_meets' ? true : null,
    strategyUsed: '结合文本分析',
    answerStatus,
    scoreBand: answerStatus === 'fully_meets' ? 'high' : answerStatus === 'does_not_meet' ? 'low' : 'medium',
    rubricItems: [],
    matchedRubricItems: ['judgement'],
    missingRubricItems,
    mainAbility: 'analysis-reasoning',
    relatedAbilities: [],
    surfaceError: missingRubricItems.length ? '回答仍有缺口' : '无',
    rootCause: missingRubricItems.length ? '依据与判断连接不完整' : '无',
    errorType: missingRubricItems.length ? '分析错误' : '待验证',
    abilityEvidence: [],
    diagnosisSummary: missingRubricItems.length ? '部分满足要求' : '完整满足要求',
    nextTraining: '继续用文本依据解释判断。',
    confidence: 0.86,
  };
}

function currentProfile(): StudentAbilityProfile {
  const link = {
    evidenceId: 'independent-evidence-1',
    ability: 'analysis-reasoning',
    evidenceType: 'weakness' as const,
    source: 'diagnosis' as const,
    observation: '首次独立回答缺少文本依据。',
    confidence: 0.82,
    supportLevel: 'independent' as const,
  };
  return {
    studentId: 'student-local-primary-v1',
    generatedAt: T0,
    current_weakness: { primary: 'analysis-reasoning', secondary: [] },
    ability_status: [{
      ability: 'analysis-reasoning',
      status: 'weak',
      summary: '独立回答时依据不足。',
      weakness_count: 1,
      positive_count: 0,
      growth_count: 0,
      insufficient_count: 0,
      evidence_links: [link],
    }],
    improvement_signals: [],
    continue_training_focus: '分析与推理',
    evidence_links: [link],
    next_step_recommendation: '继续训练文本依据与判断关系。',
  };
}

async function prepareSubmitted(service: LearningFeedbackRevisionPersistenceService, id: string) {
  const initial = await service.createInitialAttempt({
    initialAttemptId: `attempt-${id}`,
    studentId: 'student-local-primary-v1',
    learningSessionId: 'session-stage3',
    learningRoundId: `round-${id}`,
    operationId: `operation-${id}`,
    materialVersionId: `material-version-${id}`,
    resourceId: `resource-${id}`,
    resourceVersionId: `resource-version-${id}`,
    taskId: `task-${id}`,
    taskRole: 'training',
    rubricVersion: `rubric-${id}`,
    initialResponse: {
      responseId: `response-${id}`,
      executionSessionId: `execution-${id}`,
      studentId: 'student-local-primary-v1',
      taskId: `task-${id}`,
      answerText: '父亲舍不得离开。',
      submittedAt: T0,
      usedHint: false,
      hintCount: 0,
    },
    initialDiagnosisId: `diagnosis-initial-${id}`,
    initialDiagnosisSchemaVersion: 'diagnosis_v1',
    initialFeedbackId: `feedback-${id}`,
    initialFeedbackSchemaVersion: 'feedback_v1',
    createdAt: T0,
  });
  await service.startRevision(initial.learningTaskAttemptId, goal(`diagnosis-initial-${id}`), T1);
  return service.submitRevision(
    initial.learningTaskAttemptId,
    '父亲舍不得离开。文中父亲停留很久，这个行为说明他珍惜这段经历。',
    T2,
  );
}

function goal(sourceDiagnosisId: string): RevisionGoal {
  return {
    primaryIssueCode: 'evidence',
    relatedIssueCodes: ['relation'],
    instruction: '补充文本依据，并解释依据与判断之间的关系。',
    sourceDiagnosisId,
    sourceFeedbackId: 'feedback-stage3',
  };
}

function check(passed: boolean, name: string): void {
  assert.equal(passed, true, name);
  checks.push(name);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
