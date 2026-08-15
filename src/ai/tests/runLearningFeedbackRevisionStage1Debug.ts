import assert from 'node:assert/strict';
import {
  buildFeedbackGuidedRevisionId,
  buildLearningTaskAttemptId,
  buildRevisionEvaluationId,
} from '../agents/learningFeedbackRevisionIdentity.ts';
import { evaluateLearningFeedbackRevision } from '../agents/learningFeedbackRevisionEvaluationAgent.ts';
import { InMemoryLearningTaskAttemptRepository } from '../repositories/inMemoryLearningTaskAttemptRepository.ts';
import {
  REVISION_EVALUATION_SCHEMA_VERSION,
  isLearningTaskAttemptRecord,
  isRevisionEvaluation,
  type LearningTaskAttemptRecord,
  type RevisionEvaluation,
  type RevisionGoal,
} from '../schemas/learningFeedbackRevision.schema.ts';
import { LearningFeedbackRevisionPersistenceService } from '../services/learningFeedbackRevisionPersistenceService.ts';

const T0 = '2026-08-14T01:00:00.000Z';
const T1 = '2026-08-14T01:01:00.000Z';
const T2 = '2026-08-14T01:02:00.000Z';
const T3 = '2026-08-14T01:03:00.000Z';
const T4 = '2026-08-14T01:04:00.000Z';
const checks: string[] = [];

async function main(): Promise<void> {
  const repository = new InMemoryLearningTaskAttemptRepository();
  const service = new LearningFeedbackRevisionPersistenceService(repository, () => T4);
  const input = attemptInput('round-stage1-a', 'attempt-initial-a', 'response-initial-a');
  const identityInput = { ...input, taskId: input.initialResponse.taskId };

  const stableId = buildLearningTaskAttemptId(identityInput);
  check(stableId === buildLearningTaskAttemptId(identityInput), 'stable_learning_task_attempt_id');
  check(stableId !== buildLearningTaskAttemptId({ ...identityInput, learningRoundId: 'round-stage1-b' }), 'round_changes_attempt_identity');

  const initial = await service.createInitialAttempt(input);
  check(isLearningTaskAttemptRecord(initial), 'initial_attempt_schema_valid');
  check(initial.status === 'feedback_presented' && initial.initialResponse.answerText === input.initialResponse.answerText, 'initial_response_frozen_in_attempt');
  check((await service.createInitialAttempt(input)).learningTaskAttemptId === initial.learningTaskAttemptId
    && (await repository.listAll()).length === 1, 'initial_attempt_retry_idempotent');

  const loadedCopy = await repository.getById(initial.learningTaskAttemptId);
  assert(loadedCopy);
  loadedCopy.initialResponse.answerText = '外部对象试图修改初答';
  check((await repository.getById(initial.learningTaskAttemptId))?.initialResponse.answerText === input.initialResponse.answerText, 'repository_returns_defensive_clone');

  const initialMutation = await repository.save({
    ...initial,
    initialResponse: { ...initial.initialResponse, answerText: '覆盖首次回答' },
    updatedAt: T1,
  });
  check(initialMutation.status === 'conflict'
    && initialMutation.issues.includes('learning_task_attempt_initial_response_immutable'), 'initial_response_mutation_blocked');

  const duplicateInitialIdentity = await repository.save({
    ...initial,
    learningTaskAttemptId: 'different-learning-task-attempt-id',
  });
  check(duplicateInitialIdentity.status === 'conflict'
    && duplicateInitialIdentity.issues.includes('learning_task_attempt_initial_identity_conflict'), 'initial_attempt_unique_index_semantics');

  const revision = await service.startRevision(initial.learningTaskAttemptId, goal(), T1);
  const expectedRevisionId = buildFeedbackGuidedRevisionId({
    learningTaskAttemptId: initial.learningTaskAttemptId,
    initialResponseId: initial.initialResponse.responseId,
  });
  check(revision.status === 'revision_draft'
    && revision.revision?.revisionId === expectedRevisionId, 'revision_identity_created');
  check(revision.revision?.draftAnswer === initial.initialResponse.answerText, 'revision_draft_prefills_initial_answer');
  check((await service.startRevision(initial.learningTaskAttemptId, goal(), T1)).revision?.revisionId === expectedRevisionId, 'revision_start_retry_idempotent');

  const draft = await service.saveRevisionDraft(
    initial.learningTaskAttemptId,
    `${initial.initialResponse.answerText} 我补充了文中父亲停留很久的行为依据。`,
    T2,
  );
  check(draft.revision?.status === 'draft' && draft.revision.draftUpdatedAt === T2, 'revision_draft_updated');
  const recoveredDraft = await service.recover(initial.studentId, initial.learningRoundId);
  check(recoveredDraft.status === 'revision_draft'
    && recoveredDraft.record?.revision?.draftAnswer === draft.revision?.draftAnswer, 'revision_draft_recovered_by_round');

  const submitted = await service.submitRevision(
    initial.learningTaskAttemptId,
    draft.revision?.draftAnswer || '',
    T3,
  );
  check(submitted.status === 'revision_submitted'
    && submitted.revision?.revisedResponse?.responseId !== submitted.initialResponse.responseId, 'revised_response_stored_separately');
  check((await service.submitRevision(initial.learningTaskAttemptId, draft.revision?.draftAnswer || '', T4)).status === 'revision_submitted', 'revision_submit_retry_idempotent');

  let changedRevisionRejected = false;
  try {
    await service.submitRevision(initial.learningTaskAttemptId, '提交后试图覆盖修订答案', T4);
  } catch (error) {
    changedRevisionRejected = error instanceof Error
      && error.message === 'learning_task_attempt_revised_response_immutable';
  }
  check(changedRevisionRejected, 'submitted_revision_is_immutable');

  const directMutation = await repository.save({
    ...submitted,
    revision: submitted.revision ? {
      ...submitted.revision,
      revisedResponse: submitted.revision.revisedResponse ? {
        ...submitted.revision.revisedResponse,
        answerText: 'Repository 层覆盖修订答案',
      } : undefined,
    } : undefined,
    updatedAt: T4,
  });
  check(directMutation.status === 'conflict', 'repository_blocks_revised_response_mutation');

  const evaluating: LearningTaskAttemptRecord = {
    ...submitted,
    status: 'revision_evaluating',
    revision: { ...submitted.revision!, status: 'evaluating', updatedAt: T4 },
    updatedAt: T4,
  };
  check((await repository.save(evaluating)).status === 'updated', 'revision_evaluating_transition_allowed');

  const bundle = evaluateLearningFeedbackRevision({
    revisionId: submitted.revision!.revisionId,
    studentId: submitted.studentId,
    taskId: submitted.taskId,
    abilityId: 'analysis-reasoning',
    abilityLabel: '分析与推理',
    resourceVersionId: submitted.resourceVersionId,
    rubricVersion: submitted.rubricVersion,
    initialAnswer: submitted.initialResponse.answerText,
    revisedAnswer: submitted.revision!.revisedResponse!.answerText,
    revisionGoal: submitted.revision!.revisionGoal,
    initialDiagnosisId: submitted.initialDiagnosisId,
    initialDiagnosis: diagnosis('partially_meets', ['missing_text_evidence']),
    revisedDiagnosisId: 'diagnosis-revised-stage1',
    revisedDiagnosisSchemaVersion: 'diagnosis_v1',
    revisedDiagnosis: diagnosis('fully_meets', []),
    currentProfile: profile(),
    evaluatedAt: T4,
  });
  const evaluation = bundle.evaluation;
  check(isRevisionEvaluation(evaluation), 'revision_evaluation_schema_ready');
  const evaluated: LearningTaskAttemptRecord = {
    ...evaluating,
    status: 'revision_evaluated',
    revision: {
      ...evaluating.revision!,
      status: 'evaluated',
      evaluation,
      feedbackSupportedEvidence: bundle.feedbackSupportedEvidence,
      profileUpdateDecision: bundle.profileUpdateDecision,
      profileAfterRevision: bundle.profileAfterRevision,
      growthMemoryRecord: bundle.growthMemoryRecord,
      updatedAt: T4,
    },
  };
  check((await repository.save(evaluated)).status === 'updated', 'revision_evaluated_transition_persisted');
  const completed = { ...evaluated, status: 'completed_with_revision' as const };
  check((await repository.save(completed)).status === 'updated', 'completed_with_revision_transition_persisted');
  const regression = await repository.save({
    ...completed,
    status: 'revision_draft',
    revision: { ...completed.revision!, status: 'draft', revisedResponse: undefined, evaluation: undefined },
  });
  check(regression.status === 'conflict', 'terminal_state_regression_blocked');

  const secondInput = attemptInput('round-stage1-b', 'attempt-initial-b', 'response-initial-b');
  const second = await service.createInitialAttempt(secondInput);
  const initialOnly = await service.completeInitialOnly(second.learningTaskAttemptId, T4);
  check(initialOnly.status === 'completed_initial_only' && !initialOnly.revision, 'initial_only_completion_has_no_revision');

  const invalid = await repository.save({ ...second, initialDiagnosisId: '' });
  check(invalid.status === 'conflict'
    && invalid.issues.includes('learning_task_attempt_schema_invalid'), 'invalid_schema_rejected');
  check((await repository.listByStudent(initial.studentId)).length === 2, 'student_query_returns_two_learning_attempts');
  check((await repository.getByInitialAttemptId(initial.initialAttemptId))?.learningTaskAttemptId === initial.learningTaskAttemptId, 'recover_by_initial_attempt_id');

  console.log('\nLearning Feedback Revision Stage 1 Debug');
  console.log('='.repeat(78));
  checks.forEach((name) => console.log(`PASS | ${name}`));
  console.log('-'.repeat(78));
  console.log(`Result: ${checks.length} / ${checks.length} PASS`);
}

function attemptInput(learningRoundId: string, initialAttemptId: string, responseId: string) {
  return {
    initialAttemptId,
    studentId: 'student-local-primary-v1',
    learningSessionId: 'session-stage1',
    learningRoundId,
    operationId: `operation-${learningRoundId}`,
    materialVersionId: 'material-version-stage1',
    resourceId: 'resource-stage1',
    resourceVersionId: 'resource-version-stage1',
    taskRole: 'training' as const,
    rubricVersion: 'rubric-stage1-v1',
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

function goal(): RevisionGoal {
  return {
    primaryIssueCode: 'missing_text_evidence',
    relatedIssueCodes: ['missing_reasoning_relation'],
    instruction: '补充父亲行为对应的文本依据，并说明这个行为为什么能支持你的判断。',
    sourceDiagnosisId: 'diagnosis-round-stage1-a',
    sourceFeedbackId: 'feedback-round-stage1-a',
  };
}

function buildEvaluation(revisionId: string): RevisionEvaluation {
  const policyVersion = 'revision_evaluation_policy_v1';
  return {
    schemaVersion: REVISION_EVALUATION_SCHEMA_VERSION,
    revisionEvaluationId: buildRevisionEvaluationId({ revisionId, policyVersion }),
    revisionId,
    outcome: 'improved',
    feedbackRespondedTo: true,
    resolvedIssueCodes: ['missing_text_evidence'],
    remainingIssueCodes: ['missing_reasoning_relation'],
    newIssueCodes: [],
    improvedObservation: '修订答案补充了父亲停留很久这一行为依据。',
    remainingFocus: '还需要进一步说明行为与人物心理之间的关系。',
    nextSimilarTaskAction: '先找出人物的具体行为，再解释该行为支持什么判断。',
    evaluatedAt: T4,
    policyVersion,
    initialDiagnosisId: 'diagnosis-round-stage1-a',
    revisedDiagnosisId: 'diagnosis-revised-stage1',
    revisedDiagnosisSchemaVersion: 'diagnosis_v1',
    resourceVersionId: 'resource-version-stage1',
    rubricVersion: 'rubric-stage1-v1',
  };
}

function diagnosis(answerStatus: 'partially_meets' | 'fully_meets', missingRubricItems: string[]) {
  return {
    taskType: 'open_response' as const,
    correct: answerStatus === 'fully_meets' ? true : null,
    strategyUsed: '结合文本分析',
    answerStatus,
    scoreBand: answerStatus === 'fully_meets' ? 'high' as const : 'medium' as const,
    rubricItems: [],
    matchedRubricItems: ['judgement'],
    missingRubricItems,
    mainAbility: 'analysis-reasoning',
    relatedAbilities: [],
    surfaceError: missingRubricItems.length ? '依据不足' : '无',
    rootCause: missingRubricItems.length ? '缺少文本依据' : '无',
    errorType: missingRubricItems.length ? '分析错误' as const : '待验证' as const,
    abilityEvidence: [],
    diagnosisSummary: missingRubricItems.length ? '部分满足' : '完整满足',
    nextTraining: '继续结合文本依据分析。',
    confidence: 0.85,
  };
}

function profile() {
  const link = {
    evidenceId: 'stage1-independent-evidence',
    ability: 'analysis-reasoning',
    evidenceType: 'weakness' as const,
    source: 'diagnosis' as const,
    observation: '首次回答缺少依据。',
    confidence: 0.8,
    supportLevel: 'independent' as const,
  };
  return {
    studentId: 'student-local-primary-v1',
    generatedAt: T0,
    current_weakness: { primary: 'analysis-reasoning', secondary: [] },
    ability_status: [{
      ability: 'analysis-reasoning', status: 'weak' as const, summary: '依据不足',
      weakness_count: 1, positive_count: 0, growth_count: 0, insufficient_count: 0,
      evidence_links: [link],
    }],
    improvement_signals: [],
    continue_training_focus: '分析与推理',
    evidence_links: [link],
    next_step_recommendation: '继续训练。',
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
