import assert from 'node:assert/strict';
import { interpretComplementaryLearningObservations } from '../agents/complementaryLearningObservationAgent.ts';
import {
  createLearningPersistenceRecord,
  resolveRestoredFormalResourceVersionId,
  restoreLearningState,
} from '../agents/learningPersistenceAgent.ts';
import { buildLearningSubmissionIntentId } from '../agents/learningObservationIdentity.ts';
import { createDiagnosisProviderConfigSnapshot } from '../agents/realLLMRuntimeFoundationAgent.ts';
import { runSingleChoiceDiagnosis } from '../agents/singleChoiceDiagnosisAgent.ts';
import { runTaskExecutionAgent } from '../agents/taskExecutionAgent.ts';
import { runTaskEvidenceReturnAgent } from '../agents/taskEvidenceReturnAgent.ts';
import { isRealLLMDiagnosisRuntimeResult } from '../schemas/diagnosisRunRecord.schema.ts';
import type { QuestionCalibrationProjectionRepository } from '../repositories/questionCalibrationProjectionRepository.ts';
import { createStudentSingleChoiceDelivery, SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION } from '../schemas/singleChoiceInteraction.schema.ts';
import type { ConcreteLearningTask, TaskReadinessValidation } from '../schemas/concreteLearningTask.schema.ts';
import type { IndependentLearningObservation } from '../schemas/complementaryLearningObservation.schema.ts';
import type { QuestionCalibrationProjectionRecord } from '../schemas/questionCalibrationProjection.schema.ts';
import { QuestionCalibrationProjectionService } from '../services/questionCalibrationProjectionService.ts';

const NOW = '2026-08-18T13:00:00.000Z';
const interaction = {
  schemaVersion: SINGLE_CHOICE_INTERACTION_SCHEMA_VERSION,
  selectionMode: 'single' as const,
  options: [
    { optionId: 'opt-correct', content: '父亲舍不得孩子离开。' },
    { optionId: 'opt-surface', content: '父亲只是担心衣领没有整理好。' },
    { optionId: 'opt-entity', content: '孩子舍不得父亲离开。' },
    { optionId: 'opt-over', content: '父亲决定跟随列车离开。' },
  ],
  correctOptionIds: ['opt-correct'] as [string],
  distractorRationales: [
    { optionId: 'opt-surface', misconceptionCode: 'surface_reading' as const, diagnosisMeaning: '只看到整理衣领的表面动作。', evidenceBoundary: '结合列车启动后仍向前走的动作' },
    { optionId: 'opt-entity', misconceptionCode: 'entity_confusion' as const, diagnosisMeaning: '混淆了动作主体与情感对象。', evidenceBoundary: '核对动作的执行者' },
    { optionId: 'opt-over', misconceptionCode: 'over_inference' as const, diagnosisMeaning: '推断超过了文本提供的证据。', evidenceBoundary: '区分向前走几步与跟随离开' },
  ],
  optionSetVersion: 2,
};
const delivery = createStudentSingleChoiceDelivery(interaction, ['opt-entity', 'opt-correct', 'opt-over', 'opt-surface']);
const task: ConcreteLearningTask = {
  taskId: 'task-choice-stage3',
  studentId: 'student-local-primary-v1',
  sourceType: 'matched_resource',
  targetAbilityId: 'comprehension',
  targetAbilityName: '理解',
  taskRole: 'training',
  validationGoal: '确认学生是否理解父亲动作反映的心理。',
  readingText: '父亲反复整理孩子的衣领。列车启动后，他仍向前走了几步。',
  responseFormat: 'single_choice',
  singleChoiceDelivery: delivery,
  singleChoiceEvaluation: interaction,
  question: '父亲的动作主要反映了怎样的心理？',
  answerRequirements: ['请选择一个最符合材料和题意的答案。'],
  scoringPoints: ['能够结合连续动作判断人物心理。'],
  rubric: [{ id: 'rubric-choice', name: '人物心理判断', ability: 'comprehension', weight: 100, required: true }],
  questionMetadata: { questionId: 'resource-choice:v2', assessmentMode: 'exact_match', mainAbility: 'comprehension', relatedAbilities: [] },
  expectedDiagnosisFocus: ['人物心理判断'],
  createdAt: NOW,
};
const readiness: TaskReadinessValidation = {
  taskId: task.taskId,
  canExecute: true,
  checks: { canDisplay: true, canAcceptResponse: true, hasAssessmentBasis: true, metadataComplete: true, targetAbilityAligned: true, taskRoleAligned: true, validationGoalPreserved: true, sourceTraceable: true, canEnterDiagnosisRuntime: true },
  issues: [],
};

const cases: Array<{ name: string; run: () => void | Promise<void> }> = [
  { name: 'student delivery strips protected answer and rationales', run: () => {
    const serialized = JSON.stringify(delivery);
    assert.equal(serialized.includes('correctOptionIds'), false);
    assert.equal(serialized.includes('distractorRationales'), false);
  } },
  { name: 'one delivered option is a valid structured response', run: () => {
    assert.equal(execute('opt-correct').taskExecutionResult?.canEnterDiagnosisRuntime, true);
    assert.equal(execute('opt-correct').studentResponse?.answerText, '');
    assert.equal(execute('opt-correct').studentResponse?.singleChoiceAnswer?.selectedOptionIds[0], 'opt-correct');
  } },
  { name: 'unknown option is rejected before diagnosis', run: () => {
    const result = execute('not-delivered');
    assert.equal(result.taskExecutionResult?.canEnterDiagnosisRuntime, false);
    assert(result.responseValidity?.reasons.some((reason) => reason.includes('not delivered')));
  } },
  { name: 'option-set mismatch is rejected before diagnosis', run: () => {
    const result = execute('opt-correct', 1);
    assert.equal(result.taskExecutionResult?.canEnterDiagnosisRuntime, false);
  } },
  { name: 'correct option creates conservative formal diagnosis without provider', run: () => {
    const result = diagnose('opt-correct');
    assert.equal(result.status, 'formal_result_committed');
    assert.equal(result.formalDiagnosisCommit?.diagnosisResult?.correct, true);
    assert.equal(result.runRecord.providerRequestIds.length, 0);
    assert((result.formalDiagnosisCommit?.diagnosisResult?.confidence || 1) < 0.8);
    assert.equal(isRealLLMDiagnosisRuntimeResult(result), true);
  } },
  { name: 'choice diagnosis returns an independently traceable Evidence record', run: () => {
    const execution = execute('opt-surface').taskExecutionResult!;
    const runtime = diagnose('opt-surface');
    const result = runTaskEvidenceReturnAgent({ concreteTask: task, taskExecutionResult: execution, diagnosisResult: runtime.formalDiagnosisCommit?.diagnosisResult, diagnosisResultId: runtime.formalDiagnosisCommit?.formalDiagnosisId, returnedAt: NOW });
    assert.equal(result.status, 'evidence_returned');
    assert.equal(result.evidenceTraceLinks[0]?.responseId, execution.studentResponse?.responseId);
    assert.equal(result.abilityEvidence.length, 1);
  } },
  { name: 'distractor creates rationale-specific diagnosis', run: () => {
    const result = diagnose('opt-surface');
    const diagnosis = result.formalDiagnosisCommit?.diagnosisResult;
    assert.equal(diagnosis?.correct, false);
    assert.match(diagnosis?.diagnosisSummary || '', /表面动作/);
    assert.equal(diagnosis?.errorType, '理解错误');
  } },
  { name: 'student diagnosis does not reveal the correct option ID', run: () => {
    const serialized = JSON.stringify(diagnose('opt-over').formalDiagnosisCommit?.diagnosisResult);
    assert.equal(serialized.includes('opt-correct'), false);
  } },
  { name: 'submission identity is stable and answer-text independent', run: () => {
    const response = execute('opt-entity').studentResponse!;
    const a = buildLearningSubmissionIntentId({ responseId: response.responseId, singleChoiceAnswer: response.singleChoiceAnswer });
    const b = buildLearningSubmissionIntentId({ responseId: response.responseId, answerText: '不应参与', singleChoiceAnswer: response.singleChoiceAnswer });
    assert.equal(a, b);
  } },
  { name: 'different option selection creates a different submission identity', run: () => {
    const a = execute('opt-entity').studentResponse!;
    const b = execute('opt-over').studentResponse!;
    assert.notEqual(
      buildLearningSubmissionIntentId({ responseId: a.responseId, singleChoiceAnswer: a.singleChoiceAnswer }),
      buildLearningSubmissionIntentId({ responseId: b.responseId, singleChoiceAnswer: b.singleChoiceAnswer }),
    );
  } },
  { name: 'single-choice draft persists and restores structurally', run: () => {
    const choice = execute('opt-correct').studentResponse!.singleChoiceAnswer!;
    const record = createLearningPersistenceRecord({ studentId: task.studentId, learningRoundId: 'round-choice', concreteTask: task, singleChoiceDraft: choice, savedAt: NOW });
    const restored = restoreLearningState(record, task.studentId);
    assert.equal(restored.resumeMode, 'continue_unfinished_round');
    assert.equal(restored.restoredRecord?.singleChoiceDraft?.selectedOptionIds[0], 'opt-correct');
  } },
  { name: 'single-choice draft pins the original formal resource version', run: () => {
    const record = createLearningPersistenceRecord({
      studentId: task.studentId,
      learningRoundId: 'round-choice-pin',
      concreteTask: task,
      singleChoiceDraft: execute('opt-correct').studentResponse!.singleChoiceAnswer!,
      savedAt: NOW,
    });
    assert.equal(resolveRestoredFormalResourceVersionId({ persistenceRecord: record }), 'resource-choice:v2');
  } },
  { name: 'text draft pins the original formal resource version', run: () => {
    const textTask = {
      ...task,
      taskId: 'task-text-pin',
      responseFormat: 'text' as const,
      singleChoiceDelivery: undefined,
      singleChoiceEvaluation: undefined,
      questionMetadata: { ...task.questionMetadata, questionId: 'resource-text:v4' },
    };
    const record = createLearningPersistenceRecord({
      studentId: task.studentId,
      learningRoundId: 'round-text-pin',
      concreteTask: textTask,
      answerDraft: '这是刷新恢复验收使用的文本草稿。',
      savedAt: NOW,
    });
    assert.equal(resolveRestoredFormalResourceVersionId({ persistenceRecord: record }), 'resource-text:v4');
  } },
  { name: 'calibration projection stores option IDs version order and correctness', run: async () => {
    let saved: QuestionCalibrationProjectionRecord | undefined;
    const repository: QuestionCalibrationProjectionRepository = {
      save: async (record) => { saved = record; return { status: 'created', record, issues: [] }; },
      getByAttemptId: async () => undefined,
      listByStudent: async () => [],
    };
    const result = await new QuestionCalibrationProjectionService(repository).project({
      attemptId: 'attempt-choice', runtimeScope: 'product', studentId: task.studentId, operationId: 'operation-choice', learningSessionId: 'session-choice', learningRoundId: 'round-choice', responseId: 'response-choice', responseValidityStatus: 'valid', roundCompleted: true, completedAt: NOW, formalDiagnosisId: 'diagnosis-choice', formalDiagnosisCommitted: true, responseFormat: 'single_choice', choiceOutcome: { correct: false, selectedOptionIds: ['opt-surface'], optionSetVersion: 2, displayedOptionOrder: delivery.options.map((option) => option.optionId), misconceptionCode: 'surface_reading' }, resourceVersionId: 'resource-choice:v2', projectedAt: NOW,
    });
    assert.equal(result.record.itemScore, 0);
    assert.equal(result.record.itemScorePolicyVersion, 'single_choice_correctness_v1');
    assert.deepEqual(saved?.selectedOptionIds, ['opt-surface']);
    assert.equal(saved?.misconceptionCode, 'surface_reading');
  } },
  ...matrixCases(),
  { name: 'cross-format comparison refuses merged attempts and evidence', run: () => {
    const shared = observation('single_choice', 'strong');
    const result = interpretComplementaryLearningObservations({ choice: shared, text: { ...observation('text', 'weak'), attemptId: shared.attemptId } });
    assert.equal(result.status, 'insufficient_scope');
    assert(result.issues.includes('attempts_must_remain_independent'));
    assert.equal('mergedScore' in result, false);
  } },
  { name: 'legacy text execution remains valid', run: () => {
    const textTask = { ...task, taskId: 'task-text', responseFormat: 'text' as const, singleChoiceDelivery: undefined, singleChoiceEvaluation: undefined };
    const result = runTaskExecutionAgent({ concreteTask: textTask, readiness: { ...readiness, taskId: textTask.taskId }, studentAnswer: { answerText: '父亲的连续动作表现了离别时的不舍。' }, startedAt: NOW });
    assert.equal(result.taskExecutionResult?.canEnterDiagnosisRuntime, true);
  } },
];

let passed = 0;
for (const testCase of cases) {
  try { await testCase.run(); passed += 1; console.log(`PASS ${testCase.name}`); }
  catch (error) { console.error(`FAIL ${testCase.name}`); throw error; }
}
console.log(`Reading single-choice Stage 3 debug: ${passed}/${cases.length} passed.`);

function answer(optionId: string, optionSetVersion = 2) {
  return { responseFormat: 'single_choice' as const, selectedOptionIds: [optionId] as [string], optionSetVersion, displayedOptionOrder: delivery.options.map((option) => option.optionId) };
}
function execute(optionId: string, optionSetVersion = 2) {
  return runTaskExecutionAgent({ concreteTask: task, readiness, studentAnswer: { singleChoiceAnswer: answer(optionId, optionSetVersion), submittedAt: NOW }, startedAt: NOW });
}
function diagnose(optionId: string) {
  return runSingleChoiceDiagnosis({ concreteTask: task, taskExecutionResult: execute(optionId).taskExecutionResult!, executionMode: 'live', requestId: `diagnosis-${optionId}`, providerConfig: createDiagnosisProviderConfigSnapshot({ provider: 'none', model: 'deterministic', createdAt: NOW }), commitOnSuccess: true, startedAt: NOW });
}
function observation(responseFormat: 'single_choice' | 'text', performance: 'strong' | 'weak'): IndependentLearningObservation {
  return { responseFormat, studentId: task.studentId, materialVersionId: 'material:v1', taskId: `task-${responseFormat}`, attemptId: `attempt-${responseFormat}`, diagnosisId: `diagnosis-${responseFormat}`, evidenceId: `evidence-${responseFormat}`, abilityIds: ['comprehension'], performance, observedAt: NOW };
}
function matrixCases() {
  return [
    ['weak', 'weak', 'prerequisite_gap_hypothesis', 'prerequisite_foundation'],
    ['strong', 'weak', 'constructed_response_gap_hypothesis', 'constructed_response_training'],
    ['weak', 'strong', 'evidence_conflict', 'diagnostic_verification'],
    ['strong', 'strong', 'multi_source_positive', 'retest_or_transfer'],
  ].map(([choicePerformance, textPerformance, interpretation, trainingRoute]) => ({
    name: `cross-format matrix ${choicePerformance}/${textPerformance} routes to ${trainingRoute}`,
    run: () => {
      const result = interpretComplementaryLearningObservations({ choice: observation('single_choice', choicePerformance as 'strong' | 'weak'), text: observation('text', textPerformance as 'strong' | 'weak') });
      assert.equal(result.interpretation, interpretation);
      assert.equal(result.trainingRoute, trainingRoute);
      assert.equal(result.sourceEvidenceIds.length, 2);
      assert.equal('mergedScore' in result, false);
    },
  }));
}
