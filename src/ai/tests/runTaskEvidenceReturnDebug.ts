import { instantiateConcreteLearningTask } from '../agents/concreteLearningTaskAgent.ts';
import { runTaskEvidenceReturnAgent } from '../agents/taskEvidenceReturnAgent.ts';
import { runTaskExecutionAgent } from '../agents/taskExecutionAgent.ts';
import { branchTaskFulfillment } from '../agents/taskFulfillmentBranchingAgent.ts';
import { matchTaskResources } from '../agents/taskResourceMatchingAgent.ts';
import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type { ConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import { isEvaluationResult } from '../schemas/evaluationResult.schema.ts';
import { isGrowthMemoryRecord } from '../schemas/growthMemory.schema.ts';
import { isProfileUpdateDecision } from '../schemas/profileUpdateDecision.schema.ts';
import type { TaskExecutionResult } from '../schemas/taskExecution.schema.ts';
import {
  isTaskEvidenceReturnResult,
  type TaskEvidenceReturnResult,
  type TaskEvidenceReturnStatus,
} from '../schemas/taskEvidenceReturn.schema.ts';
import {
  buildFulfillmentRequestFixture,
  buildMockTaskResources,
  phase84RunAt,
} from './taskFulfillmentDebugFixtures.ts';

type DebugCase = {
  id: string;
  title: string;
  result: TaskEvidenceReturnResult;
  expectedStatus: TaskEvidenceReturnStatus;
  expectedEvidenceCount: number;
  expectedReviewRequired?: boolean;
  expectedUsedHint?: boolean;
};

const phase93RunAt = '2026-07-13T11:30:00.000Z';

function runTaskEvidenceReturnDebug(): void {
  const concreteTask = buildReadyConcreteTask();
  const validExecution = buildExecutionResult(concreteTask, {
    answerText: '父亲看到旧书和树叶时停了很久，说明他想起过去和孩子读书的经历，所以内心有不舍、怀念和牵挂。',
  });
  const invalidExecution = buildExecutionResult(concreteTask, {
    answerText: '',
  });
  const hintExecution = buildExecutionResult(concreteTask, {
    answerText: '父亲舍不得过去和孩子一起读书的时光，也很牵挂孩子。',
    usedHint: true,
    hintCount: 2,
  });
  const previousEvidence = buildPreviousEvidence(concreteTask.studentId, concreteTask.targetAbilityId);

  const cases: DebugCase[] = [
    {
      id: 'case_1_valid_return',
      title: 'valid execution returns evidence to Phase 8 runtime',
      result: runTaskEvidenceReturnAgent({
        concreteTask,
        taskExecutionResult: validExecution,
        previousEvidence,
        diagnosisResult: buildDiagnosisResult(concreteTask.targetAbilityId, 'partially_meets'),
        diagnosisResultId: 'diagnosis-case-1',
        returnedAt: phase93RunAt,
      }),
      expectedStatus: 'evidence_returned',
      expectedEvidenceCount: 1,
    },
    {
      id: 'case_2_invalid_execution_blocked',
      title: 'invalid execution is blocked before diagnosis',
      result: runTaskEvidenceReturnAgent({
        concreteTask,
        taskExecutionResult: invalidExecution,
        previousEvidence,
        diagnosisResult: buildDiagnosisResult(concreteTask.targetAbilityId, 'does_not_meet'),
        diagnosisResultId: 'diagnosis-case-2',
        returnedAt: phase93RunAt,
      }),
      expectedStatus: 'blocked_invalid_execution',
      expectedEvidenceCount: 0,
    },
    {
      id: 'case_3_used_hint_preserved',
      title: 'hint usage is preserved in support context',
      result: runTaskEvidenceReturnAgent({
        concreteTask,
        taskExecutionResult: hintExecution,
        previousEvidence,
        diagnosisResult: buildDiagnosisResult(concreteTask.targetAbilityId, 'partially_meets'),
        diagnosisResultId: 'diagnosis-case-3',
        returnedAt: phase93RunAt,
      }),
      expectedStatus: 'evidence_returned',
      expectedEvidenceCount: 1,
      expectedUsedHint: true,
    },
    {
      id: 'case_4_diagnosis_aligned',
      title: 'diagnosis ability is aligned with target ability',
      result: runTaskEvidenceReturnAgent({
        concreteTask,
        taskExecutionResult: validExecution,
        previousEvidence,
        diagnosisResult: buildDiagnosisResult(concreteTask.targetAbilityId, 'fully_meets'),
        diagnosisResultId: 'diagnosis-case-4',
        returnedAt: phase93RunAt,
      }),
      expectedStatus: 'evidence_returned',
      expectedEvidenceCount: 1,
    },
    {
      id: 'case_5_diagnosis_misaligned',
      title: 'diagnosis ability mismatch requires review',
      result: runTaskEvidenceReturnAgent({
        concreteTask,
        taskExecutionResult: validExecution,
        previousEvidence,
        diagnosisResult: buildDiagnosisResult('表达', 'partially_meets'),
        diagnosisResultId: 'diagnosis-case-5',
        returnedAt: phase93RunAt,
      }),
      expectedStatus: 'review_required',
      expectedEvidenceCount: 0,
      expectedReviewRequired: true,
    },
    {
      id: 'case_6_diagnosis_schema_failed',
      title: 'invalid diagnosis schema does not generate evidence',
      result: runTaskEvidenceReturnAgent({
        concreteTask,
        taskExecutionResult: validExecution,
        previousEvidence,
        diagnosisResult: {
          taskType: 'open_response',
          strategyUsed: 'mock_invalid_schema',
          relatedAbilities: [],
          confidence: 0.72,
        },
        diagnosisResultId: 'diagnosis-case-6',
        returnedAt: phase93RunAt,
      }),
      expectedStatus: 'diagnosis_failed',
      expectedEvidenceCount: 0,
    },
  ];

  const failures = validateCases(cases);
  printReport(cases, failures);
}

function buildReadyConcreteTask(): ConcreteLearningTask {
  const resources = buildMockTaskResources();
  const fulfillmentRequest = buildFulfillmentRequestFixture();
  const matchResult = matchTaskResources({
    fulfillmentRequest,
    availableTaskResources: resources,
  });
  const branchResult = branchTaskFulfillment({
    fulfillmentRequest,
    matchResult,
    availableTaskResources: resources,
    createdAt: phase84RunAt,
  });

  if (!branchResult.executableTask) {
    throw new Error('Phase 9.3 debug fixture failed: missing executableTask.');
  }

  const concreteResult = instantiateConcreteLearningTask({
    executableTask: branchResult.executableTask,
    createdAt: phase84RunAt,
  });

  if (!concreteResult.concreteTask || !concreteResult.readiness.canExecute) {
    throw new Error('Phase 9.3 debug fixture failed: ConcreteLearningTask is not ready.');
  }

  return concreteResult.concreteTask;
}

function buildExecutionResult(
  concreteTask: ConcreteLearningTask,
  studentAnswer: Parameters<typeof runTaskExecutionAgent>[0]['studentAnswer'],
): TaskExecutionResult {
  const execution = runTaskExecutionAgent({
    concreteTask,
    readiness: {
      taskId: concreteTask.taskId,
      canExecute: true,
      checks: {
        canDisplay: true,
        canAcceptResponse: true,
        hasAssessmentBasis: true,
        metadataComplete: true,
        targetAbilityAligned: true,
        taskRoleAligned: true,
        validationGoalPreserved: true,
        sourceTraceable: true,
        canEnterDiagnosisRuntime: true,
      },
      issues: [],
    },
    studentAnswer,
  });

  if (!execution.taskExecutionResult) {
    throw new Error('Phase 9.3 debug fixture failed: missing TaskExecutionResult.');
  }

  return execution.taskExecutionResult;
}

function buildDiagnosisResult(
  mainAbility: string,
  answerStatus: DiagnosisResult['answerStatus'],
): DiagnosisResult {
  const correct = answerStatus === 'fully_meets'
    ? true
    : answerStatus === 'does_not_meet'
      ? false
      : null;

  return {
    taskType: 'open_response',
    correct,
    strategyUsed: 'phase9_3_mock_diagnosis',
    answerStatus,
    scoreBand: answerStatus === 'fully_meets' ? 'high' : answerStatus === 'partially_meets' ? 'medium' : 'low',
    rubricItems: [],
    matchedRubricItems: answerStatus === 'fully_meets' ? ['文本线索', '心理推断', '结论表达'] : ['文本线索'],
    missingRubricItems: answerStatus === 'fully_meets' ? [] : ['推理链说明'],
    mainAbility,
    relatedAbilities: ['信息提取', '理解', '表达'],
    surfaceError: answerStatus === 'fully_meets'
      ? '本次作答能够回应任务要求。'
      : '答案能够提到部分线索，但推理链说明仍不完整。',
    rootCause: answerStatus === 'fully_meets'
      ? '学生能够从文本线索推出人物心理。'
      : '学生尚未完整建立“文本线索 -> 人物心理 -> 结论表达”的推理链。',
    errorType: answerStatus === 'fully_meets' ? '待验证' : '推理错误',
    abilityEvidence: answerStatus === 'fully_meets'
      ? ['学生能够结合文本线索说明人物心理。']
      : ['学生提到文本线索，但未充分说明线索与心理之间的关系。'],
    diagnosisSummary: answerStatus === 'fully_meets'
      ? '本次作答基本满足推理任务要求。'
      : '本次作答可以形成薄弱证据，后续应继续训练推理链表达。',
    nextTraining: answerStatus === 'fully_meets'
      ? '进入迁移复测或降低该能力训练优先级。'
      : '继续进行文本线索到人物心理的推理链训练。',
    confidence: answerStatus === 'fully_meets' ? 0.82 : 0.74,
  };
}

function buildPreviousEvidence(studentId: string, ability: string): AbilityEvidence[] {
  return [
    {
      id: 'phase9-3-prev-reasoning-001',
      studentId,
      ability,
      evidenceType: 'weakness',
      reason: 'reasoning_error',
      detail: '学生此前能够描述表层行为，但缺少从文本线索到人物心理的推理链。',
      source: 'diagnosis',
      observation: '学生作答停留在行为描述，未说明依据如何推出结论。',
      rootCause: '推理链不完整。',
      confidence: 0.72,
      createdAt: '2026-07-12T11:00:00.000Z',
      taskId: 'previous-task-001',
      diagnosisId: 'previous-diagnosis-001',
    },
  ];
}

function validateCases(cases: DebugCase[]): string[] {
  const failures: string[] = [];

  for (const item of cases) {
    const result = item.result;

    if (!isTaskEvidenceReturnResult(result)) {
      failures.push(`${item.id}: TaskEvidenceReturnResult schema invalid.`);
    }
    if (result.status !== item.expectedStatus) {
      failures.push(`${item.id}: expected status=${item.expectedStatus}, got ${result.status}.`);
    }
    if (result.abilityEvidence.length !== item.expectedEvidenceCount) {
      failures.push(`${item.id}: expected evidence count=${item.expectedEvidenceCount}, got ${result.abilityEvidence.length}.`);
    }
    if (item.expectedReviewRequired && !result.validation.reviewRequired) {
      failures.push(`${item.id}: expected reviewRequired=true.`);
    }
    if (item.expectedUsedHint && !result.supportContext.usedHint) {
      failures.push(`${item.id}: expected supportContext.usedHint=true.`);
    }
    if (item.expectedUsedHint && result.supportContext.hintCount <= 0) {
      failures.push(`${item.id}: expected supportContext.hintCount > 0.`);
    }
    if (result.status === 'evidence_returned') {
      if (!result.evaluationResult || !isEvaluationResult(result.evaluationResult)) {
        failures.push(`${item.id}: expected valid EvaluationResult.`);
      }
      if (!result.profileUpdateDecision || !isProfileUpdateDecision(result.profileUpdateDecision)) {
        failures.push(`${item.id}: expected valid ProfileUpdateDecision.`);
      }
      if (!result.growthMemoryRecord || !isGrowthMemoryRecord(result.growthMemoryRecord)) {
        failures.push(`${item.id}: expected valid GrowthMemoryRecord.`);
      }
      if (!result.validation.traceabilityComplete) {
        failures.push(`${item.id}: expected traceabilityComplete=true.`);
      }
    }
    if (result.status === 'diagnosis_failed' && result.abilityEvidence.length > 0) {
      failures.push(`${item.id}: diagnosis_failed must not generate evidence.`);
    }
    if (result.status === 'review_required' && result.abilityEvidence.length > 0) {
      failures.push(`${item.id}: review_required must not directly generate target evidence.`);
    }
    if (result.status === 'blocked_invalid_execution' && result.diagnosisResult) {
      failures.push(`${item.id}: blocked execution must not keep diagnosis result.`);
    }
  }

  return failures;
}

function printReport(cases: DebugCase[], failures: string[]): void {
  console.log('\nPhase 9.3 Task Evidence Return Debug');
  console.log('====================================');

  for (const item of cases) {
    const result = item.result;
    const passed = !failures.some((failure) => failure.startsWith(`${item.id}:`));

    console.log(`\n[${passed ? 'PASS' : 'FAIL'}] ${item.id}`);
    console.log(`title: ${item.title}`);
    console.log(`studentId: ${result.studentId}`);
    console.log(`taskId: ${result.taskId}`);
    console.log(`executionSessionId: ${result.executionSessionId}`);
    console.log(`responseId: ${result.responseId || 'none'}`);
    console.log(`taskExecutionResult.status: ${result.taskExecutionResult.status}`);
    console.log(`canEnterDiagnosisRuntime: ${result.taskExecutionResult.canEnterDiagnosisRuntime}`);
    console.log(`usedHint: ${result.supportContext.usedHint}`);
    console.log(`hintCount: ${result.supportContext.hintCount}`);
    console.log(`diagnosisStatus: ${result.validation.diagnosisSchemaValid ? 'valid' : 'invalid_or_not_run'}`);
    console.log(`diagnosisResult.mainAbility: ${result.diagnosisResult?.mainAbility || 'none'}`);
    console.log(`targetAbility: ${result.concreteTask.targetAbilityId}`);
    console.log(`taskDiagnosisAligned: ${result.validation.taskDiagnosisAligned}`);
    console.log(`generatedEvidenceCount: ${result.abilityEvidence.length}`);
    console.log(`traceabilityComplete: ${result.validation.traceabilityComplete}`);
    console.log(`evaluationResult: ${result.evaluationResult?.evaluationId || 'none'}`);
    console.log(`profileUpdateDecision: ${result.profileUpdateDecision?.action || 'none'}`);
    console.log(`growthMemoryRecord: ${result.growthMemoryRecord?.recordId || 'none'}`);
    console.log(`final status: ${result.status}`);
    console.log(`validation issues: ${result.validation.issues.join(' / ') || 'none'}`);
  }

  console.log('\nAcceptance');
  console.log('----------');
  if (failures.length === 0) {
    console.log('[PASS] Phase 9.3 task evidence return debug passed.');
    return;
  }

  console.log('[FAIL] Phase 9.3 debug failed.');
  for (const failure of failures) console.log(`- ${failure}`);
  throw new Error('Phase 9.3 debug check failed.');
}

runTaskEvidenceReturnDebug();
