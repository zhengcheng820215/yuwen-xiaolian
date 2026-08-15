import assert from 'node:assert/strict';
import { decideLearningFeedbackRevisionOffer } from '../agents/learningFeedbackRevisionOfferPolicy.ts';
import { InMemoryLearningTaskAttemptRepository } from '../repositories/inMemoryLearningTaskAttemptRepository.ts';
import type { TaskRequirementCoverage } from '../schemas/studentLearningFeedback.schema.ts';
import { LearningFeedbackRevisionPersistenceService } from '../services/learningFeedbackRevisionPersistenceService.ts';

const T0 = '2026-08-14T02:00:00.000Z';
const T1 = '2026-08-14T02:01:00.000Z';
const T2 = '2026-08-14T02:02:00.000Z';
const T3 = '2026-08-14T02:03:00.000Z';
const checks: string[] = [];

async function main(): Promise<void> {
  const missing = decideLearningFeedbackRevisionOffer(offerInput([
    coverage('evidence', 'text_evidence', 'missing', 'missing_text_evidence'),
    coverage('reasoning', 'reasoning_relation', 'partially_covered', 'missing_reasoning_relation'),
  ]));
  check(missing.level === 'recommended' && missing.actionLabel === '根据反馈修订', 'missing_requirement_recommends_revision');
  check(missing.revisionGoal?.primaryIssueCode === 'missing_text_evidence', 'missing_requirement_becomes_primary_goal');
  check(missing.revisionGoal?.relatedIssueCodes[0] === 'missing_reasoning_relation', 'secondary_gap_is_bounded_related_goal');
  check(missing.revisionGoal?.sourceDiagnosisId === 'diagnosis-stage2' && missing.revisionGoal.sourceFeedbackId === 'feedback-stage2', 'revision_goal_keeps_formal_sources');
  check(missing.revisionGoal?.instruction === '补充一句原文依据，并解释它如何支持判断。', 'formal_guidance_drives_revision_instruction');

  const partial = decideLearningFeedbackRevisionOffer(offerInput([
    coverage('reasoning', 'reasoning_relation', 'partially_covered', 'missing_reasoning_relation'),
  ]));
  check(partial.level === 'optional' && partial.actionLabel === '完善回答', 'partial_requirement_offers_optional_revision');

  check(decideLearningFeedbackRevisionOffer({ ...offerInput([]), answerStatus: 'fully_meets' }).level === 'none', 'fully_meets_has_no_revision_offer');
  check(decideLearningFeedbackRevisionOffer({ ...offerInput([]), answerStatus: 'does_not_meet' }).level === 'none', 'does_not_meet_has_no_revision_offer');
  check(decideLearningFeedbackRevisionOffer({ ...offerInput([]), answerStatus: 'insufficient_evidence' }).level === 'none', 'insufficient_evidence_has_no_revision_offer');
  check(decideLearningFeedbackRevisionOffer({ ...offerInput([]), formalFeedbackReady: false }).level === 'none', 'unready_formal_feedback_has_no_revision_offer');
  check(decideLearningFeedbackRevisionOffer({ ...offerInput([]), taskRole: 'retest' }).level === 'none', 'retest_role_has_no_revision_offer');
  check(decideLearningFeedbackRevisionOffer({ ...offerInput([]), taskRole: 'transfer' }).level === 'none', 'transfer_role_has_no_revision_offer');
  check(decideLearningFeedbackRevisionOffer({ ...offerInput([]), taskRole: 'diagnosis' }).level === 'none', 'diagnosis_role_has_no_revision_offer');
  check(decideLearningFeedbackRevisionOffer({ ...offerInput([]), taskRole: 'observation' }).level === 'none', 'observation_role_has_no_revision_offer');
  check(decideLearningFeedbackRevisionOffer(offerInput([
    coverage('unknown', 'text_evidence', 'missing', 'insufficient_to_judge'),
  ])).level === 'none', 'insufficient_to_judge_gap_is_not_actionable');
  check(decideLearningFeedbackRevisionOffer(offerInput([
    coverage('optional', 'expression', 'missing', 'incomplete_task_requirement', false),
  ])).level === 'none', 'optional_requirement_does_not_trigger_revision');

  const repository = new InMemoryLearningTaskAttemptRepository();
  const service = new LearningFeedbackRevisionPersistenceService(repository, () => T3);
  const initial = await service.createInitialAttempt(attemptInput());
  const draft = await service.startRevision(initial.learningTaskAttemptId, missing.revisionGoal!, T1);
  check(draft.revision?.draftAnswer === initial.initialResponse.answerText, 'revision_mode_prefills_frozen_initial_answer');

  const changedAnswer = `${initial.initialResponse.answerText} 文中父亲在原地停留很久，说明他舍不得离开。`;
  const saved = await service.saveRevisionDraft(initial.learningTaskAttemptId, changedAnswer, T2);
  check(saved.revision?.draftAnswer === changedAnswer && saved.revision.draftUpdatedAt === T2, 'revision_draft_is_saved');
  const recovered = await service.recover(initial.studentId, initial.learningRoundId);
  check(recovered.status === 'revision_draft' && recovered.record?.revision?.draftAnswer === changedAnswer, 'revision_draft_is_recovered_after_reload');
  check((await service.createInitialAttempt(attemptInput())).revision?.draftAnswer === changedAnswer, 'formal_feedback_reload_reuses_progressed_attempt');

  const submitted = await service.submitRevision(initial.learningTaskAttemptId, changedAnswer, T3);
  check(submitted.status === 'revision_submitted', 'revision_submission_reaches_stage2_terminal_state');
  check(submitted.initialResponse.answerText === attemptInput().initialResponse.answerText, 'revision_never_overwrites_initial_response');
  check(submitted.revision?.revisedResponse?.answerText === changedAnswer, 'revised_response_is_stored_separately');
  check((await service.createInitialAttempt(attemptInput())).status === 'revision_submitted', 'submitted_revision_recovers_without_duplicate_attempt');

  let secondRevisionRejected = false;
  try {
    await service.startRevision(initial.learningTaskAttemptId, missing.revisionGoal!, T3);
  } catch (error) {
    secondRevisionRejected = error instanceof Error && error.message === 'learning_task_attempt_revision_already_started';
  }
  check(secondRevisionRejected, 'only_one_feedback_guided_revision_is_allowed');

  const skipped = await service.createInitialAttempt(attemptInput('round-stage2-skip', 'attempt-stage2-skip', 'response-stage2-skip'));
  check((await service.completeInitialOnly(skipped.learningTaskAttemptId, T3)).status === 'completed_initial_only', 'student_can_continue_without_revision');

  const abandonedInitial = await service.createInitialAttempt(attemptInput('round-stage2-abandon', 'attempt-stage2-abandon', 'response-stage2-abandon'));
  const abandonedDraft = await service.startRevision(abandonedInitial.learningTaskAttemptId, missing.revisionGoal!, T1);
  await service.saveRevisionDraft(abandonedInitial.learningTaskAttemptId, `${abandonedDraft.initialResponse.answerText} 尚未提交的补充。`, T2);
  const abandoned = await service.abandonRevision(abandonedInitial.learningTaskAttemptId, T3);
  check(abandoned.status === 'completed_initial_only' && abandoned.revision?.status === 'abandoned', 'unsubmitted_revision_can_finish_as_initial_only');
  check(abandoned.revision?.draftAnswer?.includes('尚未提交的补充'), 'abandoned_revision_keeps_draft_for_audit_without_becoming_response');

  console.log('\nLearning Feedback Revision Stage 2 Debug');
  console.log('='.repeat(78));
  checks.forEach((name) => console.log(`PASS | ${name}`));
  console.log('-'.repeat(78));
  console.log(`Result: ${checks.length} / ${checks.length} PASS`);
}

function offerInput(requirementCoverage: TaskRequirementCoverage[]) {
  return {
    taskRole: 'training' as const,
    answerStatus: 'partially_meets' as const,
    formalDiagnosisId: 'diagnosis-stage2',
    formalFeedbackId: 'feedback-stage2',
    formalFeedbackReady: true,
    requirementCoverage,
    guidance: {
      detailsToReview: ['需要补充文本依据。'],
      revisionActions: ['补充一句原文依据，并解释它如何支持判断。'],
    },
  };
}

function coverage(
  requirementId: string,
  requirementType: TaskRequirementCoverage['requirementType'],
  status: TaskRequirementCoverage['status'],
  gapReasonCode: TaskRequirementCoverage['gapReasonCode'],
  required = true,
): TaskRequirementCoverage {
  return {
    requirementId,
    requirementType,
    requirementText: `完成${requirementId}要求`,
    required,
    status,
    studentEvidence: [],
    taskEvidence: ['材料依据'],
    source: 'formal_diagnosis',
    gapMessage: `需要补充${requirementId}。`,
    gapReasonCode,
  };
}

function attemptInput(
  learningRoundId = 'round-stage2',
  initialAttemptId = 'attempt-stage2',
  responseId = 'response-stage2',
) {
  return {
    initialAttemptId,
    studentId: 'student-local-primary-v1',
    learningSessionId: 'session-stage2',
    learningRoundId,
    operationId: `operation-${learningRoundId}`,
    materialVersionId: 'material-version-stage2',
    resourceId: 'resource-stage2',
    resourceVersionId: 'resource-version-stage2',
    taskRole: 'training' as const,
    rubricVersion: 'rubric-stage2-v1',
    initialResponse: {
      responseId,
      executionSessionId: `execution-${learningRoundId}`,
      studentId: 'student-local-primary-v1',
      taskId: `task-${learningRoundId}`,
      answerText: '父亲舍不得离开，因为他很珍惜这段经历。',
      submittedAt: T0,
      usedHint: false,
      hintCount: 0,
    },
    initialDiagnosisId: `diagnosis-${learningRoundId}`,
    initialDiagnosisSchemaVersion: 'formal_diagnosis_commit_v1',
    initialFeedbackId: `feedback-${learningRoundId}`,
    initialFeedbackSchemaVersion: 'controlled_feedback_expression_v1',
    createdAt: T0,
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
