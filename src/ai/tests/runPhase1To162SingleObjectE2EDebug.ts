import { prepareConcreteLearningTaskFromFrozenResource } from '../agents/frozenQuestionResourceTaskAdapter.ts';
import { summarizeGrowthMemory } from '../agents/growthMemorySummaryAgent.ts';
import { generateNextLearningStrategy } from '../agents/nextLearningStrategyAgent.ts';
import { applyProfileUpdateDecision } from '../agents/profileUpdateExecutor.ts';
import { createTaskRequest } from '../agents/taskRequestAgent.ts';
import { runTaskEvidenceReturnAgent } from '../agents/taskEvidenceReturnAgent.ts';
import { runTaskExecutionAgent } from '../agents/taskExecutionAgent.ts';
import { InMemoryLearningTaskAttemptRepository } from '../repositories/inMemoryLearningTaskAttemptRepository.ts';
import { LearningFeedbackRevisionPersistenceService } from '../services/learningFeedbackRevisionPersistenceService.ts';
import { validateNextLearningStrategy } from '../agents/strategyValidationAgent.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { CurrentLearningContext } from '../schemas/nextLearningStrategy.schema.ts';
import { getPhase161To162IntegrationDemoData } from '../../api/phase161To162IntegrationDemo.ts';
import { makeProfile } from './growthMemoryDebugFixtures.ts';

const RUN_AT = '2026-07-20T16:00:00.000Z';
const SUBMITTED_AT = '2026-07-20T16:05:00.000Z';
const STUDENT_ANSWER = '父亲捏着褪色的树叶站了很久，又小心夹回原处，说明他想起过去，因此感到怀念、不舍，也很珍惜这段回忆。';

type PreparedChain = Awaited<ReturnType<typeof prepareNormalChain>>;
type DebugCase = { name: string; run: (chain: PreparedChain) => void | Promise<void> };

async function main(): Promise<void> {
  const chain = await prepareNormalChain();
  const cases: DebugCase[] = [
    { name: 'E2E-001 formal resource reaches Evidence, Evaluation, GrowthMemory and next TaskRequest', run: caseNormalChain },
    { name: 'E2E-002 invalid numeric answer is blocked before Diagnosis and Evidence', run: caseInvalidAnswer },
    { name: 'E2E-003 Diagnosis failure does not create formal Evidence', run: caseDiagnosisFailure },
    { name: 'E2E-004 stale resource version cannot enter task execution', run: caseStaleResource },
    { name: 'E2E-005 repeated evidence return remains deterministic and idempotent', run: caseRepeatedReturn },
    { name: 'E2E-006 feedback attempt keeps concrete execution task identity', run: caseFeedbackAttemptIdentity },
  ];
  let passed = 0;
  const failures: string[] = [];

  console.log('Phase 1-16.2 Single-object E2E Debug');
  console.log('='.repeat(76));
  for (const item of cases) {
    try {
      await item.run(chain);
      passed += 1;
      console.log(`PASS ${item.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${item.name}: ${message}`);
      console.log(`FAIL ${item.name}: ${message}`);
    }
  }

  console.log('-'.repeat(76));
  console.log(`Result: ${passed} / ${cases.length} PASS`);
  console.log(`Single-object E2E: ${failures.length === 0 ? 'PASS' : 'FAIL'}`);
  console.log('Provider: deterministic diagnosis fixture (no external LLM call)');
  console.log('Education side effects: none');

  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

async function prepareNormalChain() {
  const demo = await getPhase161To162IntegrationDemoData();
  const normal = demo.cases.find((item) => item.id === 'repository-handoff');
  const stale = demo.cases.find((item) => item.id === 'registry-changed');
  expect(normal?.passed, 'Phase 16.1 -> 16.2 normal handoff fixture did not pass.');
  expect(normal?.taskResult.task, 'Quality Gate did not create an executable task.');
  expect(normal?.selectedVersion, 'Selected Frozen Resource Version is missing.');
  expect(stale, 'Registry-changed fixture is missing.');

  const qualityTask = normal!.taskResult.task!;
  const selectedVersion = normal!.selectedVersion!;
  const preparation = prepareConcreteLearningTaskFromFrozenResource({
    qualityGatedTask: qualityTask,
    resourceVersion: selectedVersion,
    createdAt: RUN_AT,
  });
  expect(preparation.status === 'prepared', `Frozen Resource preparation failed: ${preparation.issues.join(', ')}`);
  const concreteResult = preparation.concreteTaskResult;
  expect(concreteResult.concreteTask, 'ConcreteLearningTask was not created from the quality-gated task.');
  expect(concreteResult.readiness.canExecute, `Concrete task readiness failed: ${concreteResult.readiness.issues.map((item) => item.code).join(', ')}`);

  const concreteTask = concreteResult.concreteTask!;
  const execution = runTaskExecutionAgent({
    concreteTask,
    readiness: concreteResult.readiness,
    studentAnswer: {
      answerText: STUDENT_ANSWER,
      submittedAt: SUBMITTED_AT,
      elapsedSeconds: 300,
    },
    startedAt: RUN_AT,
  });
  expect(execution.taskExecutionResult?.canEnterDiagnosisRuntime, 'Valid answer did not enter Diagnosis Runtime.');

  const currentProfile = makeProfile(concreteTask.studentId, concreteTask.targetAbilityId);
  const diagnosisResult = buildDiagnosisResult(concreteTask.targetAbilityId);
  const evidenceReturn = runTaskEvidenceReturnAgent({
    concreteTask,
    taskExecutionResult: execution.taskExecutionResult!,
    currentProfile,
    diagnosisResult,
    returnedAt: SUBMITTED_AT,
  });

  return {
    demo,
    normal: normal!,
    stale: stale!,
    qualityTask,
    selectedVersion,
    concreteResult,
    concreteTask,
    execution,
    currentProfile,
    diagnosisResult,
    evidenceReturn,
  };
}

function caseNormalChain(chain: PreparedChain): void {
  const returned = chain.evidenceReturn;
  expect(chain.qualityTask.resourceId === chain.selectedVersion.resourceId, 'resourceId was lost at Quality Gate.');
  expect(chain.qualityTask.resourceVersionId === chain.selectedVersion.resourceVersionId, 'resourceVersionId was lost at Quality Gate.');
  expect(chain.qualityTask.taskId === chain.selectedVersion.taskId, 'Frozen taskId was lost at Quality Gate.');
  expect(chain.qualityTask.executableTask.sourceTaskId === chain.selectedVersion.taskId, 'Executable task no longer points to the Frozen taskId.');
  expect(chain.concreteTask.sourceExecutableTaskId === chain.qualityTask.executableTask.executableTaskId, 'Concrete task lost executable task provenance.');
  expect(chain.execution.taskExecutionResult?.taskId === chain.concreteTask.taskId, 'Execution taskId does not match ConcreteLearningTask.');
  expect(returned.status === 'evidence_returned', `Expected evidence_returned, got ${returned.status}.`);
  expect(returned.validation.traceabilityComplete, 'Evidence traceability is incomplete.');
  expect(returned.abilityEvidence.length === 1, 'Expected one new AbilityEvidence.');
  expect(returned.abilityEvidence[0].taskId === chain.concreteTask.taskId, 'AbilityEvidence taskId does not match ConcreteLearningTask.');
  expect(Boolean(returned.evaluationResult), 'EvaluationResult is missing.');
  expect(Boolean(returned.profileUpdateDecision), 'ProfileUpdateDecision is missing.');
  expect(Boolean(returned.growthMemoryRecord), 'GrowthMemoryRecord is missing.');

  const profileExecution = applyProfileUpdateDecision({
    currentProfile: chain.currentProfile,
    decision: returned.profileUpdateDecision!,
    appliedAt: SUBMITTED_AT,
  });
  const memorySummary = summarizeGrowthMemory({
    studentId: chain.concreteTask.studentId,
    abilityId: chain.concreteTask.targetAbilityId,
    records: [returned.growthMemoryRecord!],
  });
  const context = buildCurrentLearningContext(chain.concreteTask.studentId, chain.concreteTask.targetAbilityId);
  const strategy = generateNextLearningStrategy({
    growthMemorySummary: memorySummary,
    studentAbilityProfile: profileExecution.afterProfile,
    currentLearningContext: context,
    createdAt: SUBMITTED_AT,
  });
  const validation = validateNextLearningStrategy({
    strategy,
    currentLearningContext: context,
    validatedAt: SUBMITTED_AT,
  });
  const taskRequest = createTaskRequest({ strategy, validationResult: validation, createdAt: SUBMITTED_AT });

  expect(validation.isValid, `NextLearningStrategy validation failed: ${validation.validationErrors.join(', ')}`);
  expect(Boolean(taskRequest.taskRequest), 'Next TaskRequest was not created.');
  expect(taskRequest.taskRequest?.studentId === chain.concreteTask.studentId, 'Next TaskRequest studentId changed.');
  expect(taskRequest.taskRequest?.targetAbilityId === chain.concreteTask.targetAbilityId, 'Next TaskRequest ability changed unexpectedly.');
  expect(taskRequest.taskRequest?.evidenceLinks.includes(returned.abilityEvidence[0].id), 'Next TaskRequest is not grounded in the new Evidence.');
  expect(taskRequest.taskRequest?.growthMemoryRecordIds.includes(returned.growthMemoryRecord!.recordId), 'Next TaskRequest is not grounded in GrowthMemory.');
}

async function caseFeedbackAttemptIdentity(chain: PreparedChain): Promise<void> {
  const response = chain.execution.taskExecutionResult?.studentResponse;
  expect(response, 'StudentResponse is missing from the formal resource execution chain.');
  expect(
    chain.selectedVersion.taskId !== chain.concreteTask.taskId,
    'The fixture must preserve distinct formal-resource and concrete execution task identities.',
  );
  expect(
    response!.taskId === chain.concreteTask.taskId,
    'StudentResponse is not bound to the ConcreteLearningTask identity.',
  );
  const repository = new InMemoryLearningTaskAttemptRepository();
  const service = new LearningFeedbackRevisionPersistenceService(repository, () => SUBMITTED_AT);
  const attempt = await service.createInitialAttempt({
    initialAttemptId: 'attempt-phase1-16-feedback-identity',
    studentId: response!.studentId,
    learningSessionId: 'session-phase1-16-feedback-identity',
    learningRoundId: 'round-phase1-16-feedback-identity',
    operationId: 'operation-phase1-16-feedback-identity',
    materialVersionId: chain.selectedVersion.materialVersionId!,
    resourceId: chain.selectedVersion.resourceId,
    resourceVersionId: chain.selectedVersion.resourceVersionId,
    taskRole: chain.concreteTask.taskRole,
    rubricVersion: `${chain.selectedVersion.resourceVersionId}:rubric`,
    initialResponse: response!,
    initialDiagnosisId: 'diagnosis-phase1-16-feedback-identity',
    initialDiagnosisSchemaVersion: 'formal_diagnosis_commit_v1',
    initialFeedbackId: 'feedback-phase1-16-feedback-identity',
    initialFeedbackSchemaVersion: 'controlled_feedback_expression_v1',
    createdAt: response!.submittedAt,
  });
  expect(
    attempt.taskId === chain.concreteTask.taskId && attempt.taskId === response!.taskId,
    'LearningTaskAttempt did not derive taskId from the frozen StudentResponse.',
  );
  expect(
    attempt.resourceVersionId === chain.selectedVersion.resourceVersionId,
    'LearningTaskAttempt lost the independent formal resource identity.',
  );
}

function caseInvalidAnswer(chain: PreparedChain): void {
  const execution = runTaskExecutionAgent({
    concreteTask: chain.concreteTask,
    readiness: chain.concreteResult.readiness,
    studentAnswer: { answerText: '445', submittedAt: SUBMITTED_AT },
    startedAt: RUN_AT,
  });
  expect(execution.responseValidity?.status === 'placeholder', `Expected placeholder, got ${execution.responseValidity?.status}.`);
  expect(execution.taskExecutionResult?.canEnterDiagnosisRuntime === false, 'Invalid answer entered Diagnosis Runtime.');
  const returned = runTaskEvidenceReturnAgent({
    concreteTask: chain.concreteTask,
    taskExecutionResult: execution.taskExecutionResult!,
    currentProfile: chain.currentProfile,
    diagnosisResult: chain.diagnosisResult,
    returnedAt: SUBMITTED_AT,
  });
  expect(returned.status === 'blocked_invalid_execution', `Expected blocked_invalid_execution, got ${returned.status}.`);
  expect(returned.abilityEvidence.length === 0, 'Invalid answer created AbilityEvidence.');
  expect(!returned.evaluationResult && !returned.profileUpdateDecision && !returned.growthMemoryRecord, 'Invalid answer created long-term state objects.');
}

function caseDiagnosisFailure(chain: PreparedChain): void {
  const returned = runTaskEvidenceReturnAgent({
    concreteTask: chain.concreteTask,
    taskExecutionResult: chain.execution.taskExecutionResult!,
    currentProfile: chain.currentProfile,
    diagnosisFailed: true,
    diagnosisResult: null,
    returnedAt: SUBMITTED_AT,
  });
  expect(returned.status === 'diagnosis_failed', `Expected diagnosis_failed, got ${returned.status}.`);
  expect(returned.abilityEvidence.length === 0, 'Diagnosis failure created AbilityEvidence.');
  expect(!returned.evaluationResult && !returned.profileUpdateDecision && !returned.growthMemoryRecord, 'Diagnosis failure created long-term state objects.');
}

function caseStaleResource(chain: PreparedChain): void {
  expect(chain.stale.passed, 'Registry-changed integration case did not pass.');
  expect(chain.stale.taskResult.status === 'blocked', 'Stale resource created an executable task.');
  expect(chain.stale.taskResult.task === null, 'Stale resource returned a task payload.');
  expect(chain.stale.taskResult.issues.includes('selected_resource_is_no_longer_current'), 'Stale resource block reason is missing.');
}

function caseRepeatedReturn(chain: PreparedChain): void {
  const first = chain.evidenceReturn;
  const second = runTaskEvidenceReturnAgent({
    concreteTask: chain.concreteTask,
    taskExecutionResult: chain.execution.taskExecutionResult!,
    currentProfile: chain.currentProfile,
    diagnosisResult: chain.diagnosisResult,
    returnedAt: SUBMITTED_AT,
  });
  expect(first.returnId === second.returnId, 'Repeated return changed returnId.');
  expect(first.abilityEvidence[0].id === second.abilityEvidence[0].id, 'Repeated return changed evidenceId.');
  expect(first.evaluationResult?.evaluationId === second.evaluationResult?.evaluationId, 'Repeated return changed evaluationId.');
  expect(first.profileUpdateDecision?.decisionId === second.profileUpdateDecision?.decisionId, 'Repeated return changed decisionId.');
  expect(first.growthMemoryRecord?.recordId === second.growthMemoryRecord?.recordId, 'Repeated return changed GrowthMemory recordId.');
  expect(new Set([...first.abilityEvidence, ...second.abilityEvidence].map((item) => item.id)).size === 1, 'Repeated return produced more than one logical Evidence identity.');
}

function buildDiagnosisResult(mainAbility: string): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: null,
    strategyUsed: 'phase1_16_2_single_object_deterministic_fixture',
    answerStatus: 'partially_meets',
    scoreBand: 'medium',
    rubricItems: [],
    matchedRubricItems: ['文本依据'],
    missingRubricItems: ['解释关系'],
    mainAbility,
    relatedAbilities: ['comprehension', 'expression'],
    surfaceError: '答案能够提取文本动作，但依据与心理结论之间的解释仍不完整。',
    rootCause: '当前只支持“推理连接仍需验证”的候选判断，不形成长期能力结论。',
    errorType: '推理错误',
    abilityEvidence: ['能够找到父亲站了很久并小心夹回树叶的文本线索。'],
    diagnosisSummary: '本次作答部分满足要求，已出现有效文本依据，但解释关系仍需补充。',
    nextTraining: '继续练习使用文本依据解释人物心理。',
    confidence: 0.78,
  };
}

function buildCurrentLearningContext(studentId: string, targetAbilityId: string): CurrentLearningContext {
  return {
    contextId: 'phase1-16-2-e2e-next-context',
    studentId,
    currentPhase: 'observation',
    targetAbilityId,
    recentTaskRole: 'training',
    allowTraining: true,
    allowRetest: true,
    allowTransfer: true,
    recentFailureCount: 0,
    cognitiveLoad: 'medium',
    reviewRequired: false,
    notes: ['Generated from the single-object E2E GrowthMemory result.'],
  };
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void main();
