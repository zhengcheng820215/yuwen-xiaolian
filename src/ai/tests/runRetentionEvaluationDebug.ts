import { evaluateRetention } from '../agents/retentionEvaluationAgent.ts';
import type { AbilityEvidence, AbilityEvidenceType } from '../schemas/abilityEvidence.schema.ts';
import type { ConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import {
  DELAYED_RETEST_POLICY_VERSION,
  DELAYED_RETEST_SCHEDULING_SCHEMA_VERSION,
  type DelayedRetestPlan,
} from '../schemas/delayedRetestScheduling.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { EvaluationResult } from '../schemas/evaluationResult.schema.ts';
import type { GrowthMemoryRecord } from '../schemas/growthMemory.schema.ts';
import type { ProfileUpdateDecision } from '../schemas/profileUpdateDecision.schema.ts';
import {
  isRetentionEvaluationResult,
  type RetentionDifficultyRelation,
  type RetentionEvaluationInput,
  type RetentionEvaluationResult,
  type RetentionMaterialRelation,
} from '../schemas/retentionEvaluation.schema.ts';
import type { TaskEvidenceReturnResult } from '../schemas/taskEvidenceReturn.schema.ts';
import type { StudentResponse, TaskExecutionResult } from '../schemas/taskExecution.schema.ts';

type CheckResult = { passed: boolean; detail: string };
type CaseReport = {
  name: string;
  result: RetentionEvaluationResult;
  passed: boolean;
  details: string[];
  failReasons: string[];
};

const studentId = 'phase13-retention-student';
const targetAbilityId = '推理';
const baselineAt = '2026-07-01T08:00:00.000Z';
const plannedRetestAt = '2026-07-10T08:00:00.000Z';
const delayedAt = '2026-07-10T08:30:00.000Z';
const evaluatedAt = '2026-07-10T09:00:00.000Z';

const cases: Array<{ name: string; run: () => CaseReport }> = [
  {
    name: 'Case 1 可比、无提示、延迟 positive：retained',
    run: () => runCase(
      'Case 1 可比、无提示、延迟 positive：retained',
      buildInput({ baselineType: 'growth', delayedTypes: ['positive'] }),
      (result) => [
        check(result.status === 'retained', `status=${result.status}`),
        check(result.comparability.status === 'comparable', `comparability=${result.comparability.status}`),
        check(result.existingPhase8ResultLink.mode === 'reuse_existing', `link=${result.existingPhase8ResultLink.mode}`),
      ],
    ),
  },
  {
    name: 'Case 2 baseline positive + delayed growth：不做等级降级',
    run: () => runCase(
      'Case 2 baseline positive + delayed growth：不做等级降级',
      buildInput({ baselineType: 'positive', delayedTypes: ['growth'] }),
      (result) => [
        check(result.status === 'retained', `status=${result.status}`),
        check(result.comparability.status === 'comparable', `comparability=${result.comparability.status}`),
      ],
    ),
  },
  {
    name: 'Case 3 延迟 Evidence 方向冲突：performance_fluctuated',
    run: () => runCase(
      'Case 3 延迟 Evidence 方向冲突：performance_fluctuated',
      buildInput({ delayedTypes: ['positive', 'weakness'] }),
      (result) => [
        check(result.status === 'performance_fluctuated', `status=${result.status}`),
        check(result.followUp === 'collect_more_evidence', `followUp=${result.followUp}`),
      ],
    ),
  },
  {
    name: 'Case 4 可比延迟 weakness：declined_observation',
    run: () => runCase(
      'Case 4 可比延迟 weakness：declined_observation',
      buildInput({ delayedTypes: ['weakness'] }),
      (result) => [
        check(result.status === 'declined_observation', `status=${result.status}`),
        check(!result.observations.some((item) => item.includes('能力已经下降')), result.observations.join(' | ')),
      ],
    ),
  },
  {
    name: 'Case 5 延迟 insufficient：insufficient_evidence',
    run: () => runCase(
      'Case 5 延迟 insufficient：insufficient_evidence',
      buildInput({ delayedTypes: ['insufficient'] }),
      (result) => [
        check(result.status === 'insufficient_evidence', `status=${result.status}`),
        check(result.comparability.status === 'not_comparable', `comparability=${result.comparability.status}`),
      ],
    ),
  },
  {
    name: 'Case 6 缺少延迟 Evidence：insufficient_evidence',
    run: () => runCase(
      'Case 6 缺少延迟 Evidence：insufficient_evidence',
      buildInput({ delayedTypes: [] }),
      (result) => [
        check(result.status === 'insufficient_evidence', `status=${result.status}`),
        check(result.delayedEvidenceIds.length === 0, `delayedEvidence=${result.delayedEvidenceIds.length}`),
        check(result.existingPhase8ResultLink.mode === 'blocked', `link=${result.existingPhase8ResultLink.mode}`),
      ],
    ),
  },
  {
    name: 'Case 7 studentId 不一致：review_required',
    run: () => {
      const input = buildInput({ delayedTypes: ['positive'] });
      input.delayedTaskEvidenceReturnResult = {
        ...input.delayedTaskEvidenceReturnResult,
        studentId: 'other-student',
      };
      return runCase('Case 7 studentId 不一致：review_required', input, (result) => [
        check(result.status === 'review_required', `status=${result.status}`),
        check(result.existingPhase8ResultLink.mode === 'blocked', `link=${result.existingPhase8ResultLink.mode}`),
        check(result.validation.issues.some((issue) => issue.includes('studentId mismatch')), result.validation.issues.join(' | ')),
      ]);
    },
  },
  {
    name: 'Case 8 ability 不一致：review_required',
    run: () => {
      const input = buildInput({ delayedTypes: ['positive'] });
      input.delayedTaskEvidenceReturnResult = {
        ...input.delayedTaskEvidenceReturnResult,
        abilityEvidence: input.delayedTaskEvidenceReturnResult.abilityEvidence.map((evidence) => ({
          ...evidence,
          ability: '表达',
        })),
      };
      return runCase('Case 8 ability 不一致：review_required', input, (result) => [
        check(result.status === 'review_required', `status=${result.status}`),
        check(result.existingPhase8ResultLink.mode === 'blocked', `link=${result.existingPhase8ResultLink.mode}`),
        check(result.validation.issues.some((issue) => issue.includes('ability mismatch')), result.validation.issues.join(' | ')),
      ]);
    },
  },
  {
    name: 'Case 9 requireNewMaterial 但使用同一材料：review_required',
    run: () => runCase(
      'Case 9 requireNewMaterial 但使用同一材料：review_required',
      buildInput({ delayedTypes: ['positive'], materialRelation: 'same_material' }),
      (result) => [
        check(result.status === 'review_required', `status=${result.status}`),
        check(result.existingPhase8ResultLink.mode === 'blocked', `link=${result.existingPhase8ResultLink.mode}`),
        check(result.validation.issues.some((issue) => issue.includes('same material')), result.validation.issues.join(' | ')),
      ],
    ),
  },
  {
    name: 'Case 10 使用提示后完成：partially_retained',
    run: () => runCase(
      'Case 10 使用提示后完成：partially_retained',
      buildInput({ delayedTypes: ['positive'], usedHint: true, hintCount: 1 }),
      (result) => [
        check(result.status === 'partially_retained', `status=${result.status}`),
        check(result.comparability.status === 'limited', `comparability=${result.comparability.status}`),
        check(result.followUp === 'independent_retest', `followUp=${result.followUp}`),
      ],
    ),
  },
  {
    name: 'Case 11 无效 Response 仍生成 Evidence：review_required',
    run: () => {
      const input = buildInput({ delayedTypes: ['positive'] });
      const invalidExecution: TaskExecutionResult = {
        ...input.delayedTaskExecutionResult,
        status: 'submitted_invalid',
        responseValidity: {
          ...input.delayedTaskExecutionResult.responseValidity,
          status: 'placeholder',
          canDiagnose: false,
          reasons: ['占位回答不能进入诊断。'],
        },
        canEnterDiagnosisRuntime: false,
      };
      input.delayedTaskExecutionResult = invalidExecution;
      input.delayedTaskEvidenceReturnResult = {
        ...input.delayedTaskEvidenceReturnResult,
        taskExecutionResult: invalidExecution,
      };
      return runCase('Case 11 无效 Response 仍生成 Evidence：review_required', input, (result) => [
        check(result.status === 'review_required', `status=${result.status}`),
        check(result.existingPhase8ResultLink.mode === 'blocked', `link=${result.existingPhase8ResultLink.mode}`),
        check(!result.comparisonFacts.responseValid, `responseValid=${result.comparisonFacts.responseValid}`),
        check(result.validation.issues.some((issue) => issue.includes('not valid for diagnosis')), result.validation.issues.join(' | ')),
      ]);
    },
  },
  {
    name: 'Case 12 Evidence 时间顺序错误：review_required',
    run: () => runCase(
      'Case 12 Evidence 时间顺序错误：review_required',
      buildInput({ delayedTypes: ['positive'], delayedAt: '2026-06-30T08:00:00.000Z' }),
      (result) => [
        check(result.status === 'review_required', `status=${result.status}`),
        check(result.existingPhase8ResultLink.mode === 'blocked', `link=${result.existingPhase8ResultLink.mode}`),
        check(result.validation.issues.some((issue) => issue.includes('before baseline')), result.validation.issues.join(' | ')),
      ],
    ),
  },
  {
    name: 'Case 13 重复执行：ID 和 Phase 8 关联保持幂等',
    run: () => {
      const input = buildInput({ delayedTypes: ['positive'] });
      const first = evaluateRetention(input);
      const second = evaluateRetention(input);
      return report('Case 13 重复执行：ID 和 Phase 8 关联保持幂等', second, [
        check(first.retentionEvaluationId === second.retentionEvaluationId, `id=${second.retentionEvaluationId}`),
        check(first.existingPhase8ResultLink.idempotencyKey === second.existingPhase8ResultLink.idempotencyKey, `key=${second.existingPhase8ResultLink.idempotencyKey}`),
        check(first.existingPhase8ResultLink.evaluationResultId === second.existingPhase8ResultLink.evaluationResultId, `evaluation=${second.existingPhase8ResultLink.evaluationResultId}`),
      ]);
    },
  },
  {
    name: 'Case 14 Phase 9.3 已完成正式回流：reuse_existing',
    run: () => runCase(
      'Case 14 Phase 9.3 已完成正式回流：reuse_existing',
      buildInput({ delayedTypes: ['positive'] }),
      (result) => [
        check(result.existingPhase8ResultLink.mode === 'reuse_existing', `mode=${result.existingPhase8ResultLink.mode}`),
        check(Boolean(result.existingPhase8ResultLink.evaluationResultId), `evaluation=${result.existingPhase8ResultLink.evaluationResultId}`),
        check(Boolean(result.existingPhase8ResultLink.profileUpdateDecisionId), `decision=${result.existingPhase8ResultLink.profileUpdateDecisionId}`),
        check(Boolean(result.existingPhase8ResultLink.growthMemoryRecordId), `memory=${result.existingPhase8ResultLink.growthMemoryRecordId}`),
      ],
    ),
  },
  {
    name: 'Case 15 调用方伪造 comparable：Agent 重新计算',
    run: () => {
      const input = buildInput({
        delayedTypes: ['positive'],
        materialRelation: 'unknown',
        difficultyRelation: 'unknown',
      });
      Object.assign(input.taskComparisonSource, {
        comparabilityStatus: 'comparable',
        comparisonReasons: ['caller says comparable'],
        validation: { passed: true, issues: [] },
      });
      return runCase('Case 15 调用方伪造 comparable：Agent 重新计算', input, (result) => [
        check(result.comparability.status === 'not_comparable', `comparability=${result.comparability.status}`),
        check(result.status === 'insufficient_evidence', `status=${result.status}`),
      ]);
    },
  },
  {
    name: 'Case 16 Phase 8 正式结果身份错位：review_required',
    run: () => {
      const input = buildInput({ delayedTypes: ['positive'] });
      const evaluationResult = input.delayedTaskEvidenceReturnResult.evaluationResult as EvaluationResult;
      input.delayedTaskEvidenceReturnResult = {
        ...input.delayedTaskEvidenceReturnResult,
        evaluationResult: {
          ...evaluationResult,
          studentId: 'other-student',
        },
      };
      return runCase('Case 16 Phase 8 正式结果身份错位：review_required', input, (result) => [
        check(result.status === 'review_required', `status=${result.status}`),
        check(result.existingPhase8ResultLink.mode === 'blocked', `link=${result.existingPhase8ResultLink.mode}`),
        check(result.validation.issues.some((issue) => issue.includes('EvaluationResult studentId mismatch')), result.validation.issues.join(' | ')),
      ]);
    },
  },
];

const reports = cases.map((item) => item.run());
const passed = reports.filter((item) => item.passed).length;

console.log('Phase 13.3 Retention Evaluation Debug Report');
console.log('==============================================');
for (const item of reports) {
  console.log(`\n[${item.passed ? 'PASS' : 'FAIL'}] ${item.name}`);
  console.log(`- Status: ${item.result.status}`);
  console.log(`- Comparability: ${item.result.comparability.status}`);
  console.log(`- Evidence: ${item.result.baselineEvidenceIds.join(',') || 'none'} -> ${item.result.delayedEvidenceIds.join(',') || 'none'}`);
  console.log(`- Phase 8 Link: ${item.result.existingPhase8ResultLink.mode}`);
  console.log(`- Follow Up: ${item.result.followUp}`);
  console.log(`- Confidence: ${item.result.confidence}`);
  console.log(`- Validation: ${item.result.validation.passed ? 'PASS' : item.result.validation.issues.join('; ')}`);
  for (const reason of item.failReasons) console.log(`- FAIL: ${reason}`);
}
console.log('\nSummary');
console.log('-------');
console.log(`Cases: ${reports.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${reports.length - passed}`);
console.log(`Result: ${passed === reports.length ? 'PASS' : 'FAIL'}`);

if (passed !== reports.length) process.exitCode = 1;

function runCase(
  name: string,
  input: RetentionEvaluationInput,
  checks: (result: RetentionEvaluationResult) => CheckResult[],
): CaseReport {
  const result = evaluateRetention(input);
  return report(name, result, [
    check(isRetentionEvaluationResult(result), 'RetentionEvaluationResult schema valid'),
    ...checks(result),
  ]);
}

function report(name: string, result: RetentionEvaluationResult, checks: CheckResult[]): CaseReport {
  return {
    name,
    result,
    passed: checks.every((item) => item.passed),
    details: checks.map((item) => item.detail),
    failReasons: checks.filter((item) => !item.passed).map((item) => item.detail),
  };
}

function check(passed: boolean, detail: string): CheckResult {
  return { passed, detail };
}

function buildInput(options: {
  baselineType?: Extract<AbilityEvidenceType, 'positive' | 'growth'>;
  delayedTypes?: AbilityEvidenceType[];
  materialRelation?: RetentionMaterialRelation;
  difficultyRelation?: RetentionDifficultyRelation;
  usedHint?: boolean;
  hintCount?: number;
  delayedAt?: string;
} = {}): RetentionEvaluationInput {
  const baselineType = options.baselineType || 'positive';
  const delayedTypes = options.delayedTypes ?? ['positive'];
  const actualDelayedAt = options.delayedAt || delayedAt;
  const baselineTask = buildTask('phase13-baseline-task', 'training', baselineAt, '旧材料：父亲整理旧书。');
  const delayedTask = buildTask('phase13-delayed-task', 'retest', plannedRetestAt, '新材料：母亲收起旧照片。');
  const baseline = buildEvidence({
    id: `baseline-${baselineType}`,
    type: baselineType,
    createdAt: baselineAt,
    taskId: baselineTask.taskId,
    diagnosisId: 'diagnosis-baseline',
    source: baselineType === 'growth' ? 'training' : 'retest',
  });
  const execution = buildExecution(delayedTask, Boolean(options.usedHint), options.hintCount || 0);
  const delayedEvidence = delayedTypes.map((type, index) => buildEvidence({
    id: `delayed-${type}-${index + 1}`,
    type,
    createdAt: actualDelayedAt,
    taskId: delayedTask.taskId,
    diagnosisId: 'diagnosis-delayed',
    source: 'diagnosis',
  }));
  const taskReturn = buildTaskEvidenceReturn({
    task: delayedTask,
    execution,
    evidence: delayedEvidence,
    returnedAt: actualDelayedAt,
  });

  return {
    studentId,
    targetAbilityId,
    delayedRetestPlan: buildPlan(baseline.id),
    baselineEvidence: [baseline],
    baselineTask,
    delayedTask,
    delayedTaskExecutionResult: execution,
    delayedTaskEvidenceReturnResult: taskReturn,
    taskComparisonSource: {
      materialRelation: options.materialRelation || 'new_material',
      difficultyRelation: options.difficultyRelation || 'comparable',
      source: 'comparison_adapter',
    },
    evaluatedAt,
    timezone: 'Asia/Shanghai',
  };
}

function buildPlan(baselineEvidenceId: string): DelayedRetestPlan {
  return {
    planId: 'phase13-retention-plan',
    candidateId: 'phase13-retention-candidate',
    studentId,
    targetAbilityId,
    sourceSessionIds: ['phase13-baseline-session'],
    sourceEvidenceIds: [baselineEvidenceId],
    baselineEvidenceId,
    scheduledAt: '2026-07-08T08:00:00.000Z',
    plannedRetestAt,
    status: 'available',
    whyRetestNow: '基线 Evidence 已达到延迟复测时间。',
    retestGoal: '在新材料中重新观察推理表现。',
    validationGoal: '验证相关表现能否在延迟、无提示和新材料条件下再次出现。',
    requestedTaskRole: 'retest',
    requireNewMaterial: true,
    allowHint: false,
    constraints: ['使用新材料。', '保持目标能力一致。'],
    policyVersion: DELAYED_RETEST_POLICY_VERSION,
    schemaVersion: DELAYED_RETEST_SCHEDULING_SCHEMA_VERSION,
    createdAt: '2026-07-08T08:00:00.000Z',
    updatedAt: '2026-07-08T08:00:00.000Z',
    validation: { passed: true, issues: [] },
  };
}

function buildTask(
  taskId: string,
  taskRole: ConcreteLearningTask['taskRole'],
  createdAt: string,
  readingText: string,
): ConcreteLearningTask {
  return {
    taskId,
    studentId,
    sourceType: 'mock',
    sourceTaskRequestId: `request-${taskId}`,
    targetAbilityId,
    targetAbilityName: targetAbilityId,
    taskRole,
    validationGoal: '观察学生能否根据文本行为推断人物心理。',
    readingText,
    question: '人物此时有怎样的心理？请结合文本说明。',
    answerRequirements: ['写出人物心理并说明文本依据。'],
    referenceAnswer: '人物珍惜过去的回忆，相关动作体现了留恋。',
    scoringPoints: ['心理判断合理', '引用文本行为', '说明行为与心理关系'],
    rubric: [{ id: 'reasoning', name: '推理', ability: targetAbilityId, required: true }],
    questionMetadata: {
      questionId: `question-${taskId}`,
      questionType: 'reading_open_response',
      assessmentMode: 'reasoning_chain',
      mainAbility: targetAbilityId,
      difficulty: '基础',
      rubric: [{ id: 'reasoning', name: '推理', ability: targetAbilityId, required: true }],
    },
    expectedDiagnosisFocus: ['文本行为与人物心理之间的推理关系'],
    createdAt,
  };
}

function buildEvidence(input: {
  id: string;
  type: AbilityEvidenceType;
  createdAt: string;
  taskId: string;
  diagnosisId: string;
  source: AbilityEvidence['source'];
}): AbilityEvidence {
  return {
    id: input.id,
    studentId,
    ability: targetAbilityId,
    evidenceType: input.type,
    reason: input.type === 'weakness' ? 'reasoning_error' : undefined,
    detail: `正式 ${input.type} Evidence。`,
    source: input.source,
    observation: `学生形成 ${input.type} 方向的可观察表现。`,
    confidence: 0.8,
    createdAt: input.createdAt,
    taskId: input.taskId,
    diagnosisId: input.diagnosisId,
  };
}

function buildExecution(
  task: ConcreteLearningTask,
  usedHint: boolean,
  hintCount: number,
): TaskExecutionResult {
  const response: StudentResponse = {
    responseId: 'phase13-delayed-response',
    executionSessionId: 'phase13-delayed-execution',
    studentId,
    taskId: task.taskId,
    answerText: '人物很留恋过去，因为他把旧照片看了很久，又轻轻收好。',
    submittedAt: '2026-07-10T08:20:00.000Z',
    usedHint,
    hintCount,
  };
  return {
    executionSessionId: response.executionSessionId,
    studentId,
    taskId: task.taskId,
    status: 'submitted_valid',
    studentResponse: response,
    responseValidity: {
      responseId: response.responseId,
      status: 'valid',
      canDiagnose: true,
      reasons: ['答案包含可观察的判断与文本依据。'],
    },
    usedHint,
    hintCount,
    canEnterDiagnosisRuntime: true,
  };
}

function buildTaskEvidenceReturn(input: {
  task: ConcreteLearningTask;
  execution: TaskExecutionResult;
  evidence: AbilityEvidence[];
  returnedAt: string;
}): TaskEvidenceReturnResult {
  const diagnosisResult = buildDiagnosisResult();
  const evaluation = input.evidence.length > 0
    ? buildEvaluation(input.evidence, input.returnedAt)
    : undefined;
  const decision = evaluation
    ? buildDecision(evaluation, input.evidence, input.returnedAt)
    : undefined;
  const memory = evaluation && decision
    ? buildGrowthMemory(evaluation, decision, input.evidence, input.returnedAt)
    : undefined;
  return {
    returnId: 'phase13-task-evidence-return',
    status: 'evidence_returned',
    studentId,
    taskId: input.task.taskId,
    executionSessionId: input.execution.executionSessionId,
    responseId: input.execution.studentResponse?.responseId,
    concreteTask: input.task,
    taskExecutionResult: input.execution,
    diagnosisResult,
    diagnosisResultId: 'diagnosis-delayed',
    abilityEvidence: input.evidence,
    evidenceTraceLinks: input.evidence.map(() => ({
      taskId: input.task.taskId,
      executionSessionId: input.execution.executionSessionId,
      responseId: input.execution.studentResponse?.responseId || 'missing-response',
      diagnosisResultId: 'diagnosis-delayed',
    })),
    evaluationResult: evaluation,
    profileUpdateDecision: decision,
    growthMemoryRecord: memory,
    supportContext: {
      usedHint: input.execution.usedHint,
      hintCount: input.execution.hintCount,
    },
    validation: {
      passed: true,
      diagnosisSchemaValid: true,
      taskDiagnosisAligned: true,
      studentIdConsistent: true,
      traceabilityComplete: true,
      reviewRequired: false,
      issues: [],
    },
  };
}

function buildDiagnosisResult(): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: true,
    strategyUsed: 'phase13_retention_mock',
    answerStatus: 'fully_meets',
    scoreBand: 'high',
    rubricItems: [],
    matchedRubricItems: ['心理判断', '文本依据'],
    missingRubricItems: [],
    mainAbility: targetAbilityId,
    relatedAbilities: ['理解', '表达'],
    surfaceError: '本次作答能够回应任务要求。',
    rootCause: '学生能够根据文本行为推断人物心理。',
    errorType: '待验证',
    abilityEvidence: ['学生能够使用文本行为支持心理判断。'],
    diagnosisSummary: '本次表现达到任务要求。',
    nextTraining: '继续观察相同能力在新情境中的表现。',
    confidence: 0.82,
  };
}

function buildEvaluation(evidence: AbilityEvidence[], createdAt: string): EvaluationResult {
  return {
    evaluationId: 'phase13-existing-evaluation',
    studentId,
    abilityId: targetAbilityId,
    abilityLabel: targetAbilityId,
    evidenceSufficiency: 'limited',
    growthLevel: 'early_signal',
    weaknessEvidenceCount: evidence.filter((item) => item.evidenceType === 'weakness').length,
    positiveEvidenceCount: evidence.filter((item) => item.evidenceType === 'positive').length,
    growthEvidenceCount: evidence.filter((item) => item.evidenceType === 'growth').length,
    insufficientEvidenceCount: evidence.filter((item) => item.evidenceType === 'insufficient').length,
    hasIndependentRetestEvidence: true,
    hasTransferEvidence: false,
    conflictStatus: evidence.some((item) => item.evidenceType === 'weakness') && evidence.some((item) => ['growth', 'positive'].includes(item.evidenceType))
      ? 'significant'
      : 'none',
    confidence: 0.72,
    summary: '延迟复测 Evidence 已由 Existing Phase 8 Runtime 正式评估。',
    limitations: ['单次延迟复测不证明长期掌握。'],
    nextAction: 'maintenance',
    evidenceLinks: evidence.map((item) => item.id),
    createdAt,
  };
}

function buildDecision(
  evaluation: EvaluationResult,
  evidence: AbilityEvidence[],
  createdAt: string,
): ProfileUpdateDecision {
  return {
    decisionId: 'phase13-existing-profile-decision',
    studentId,
    abilityId: targetAbilityId,
    abilityLabel: targetAbilityId,
    action: 'append_evidence_only',
    reason: '记录本次正式延迟复测 Evidence，继续观察。',
    appendEvidenceIds: evidence.map((item) => item.id),
    warnings: [],
    evidenceLinks: evaluation.evidenceLinks,
    createdAt,
  };
}

function buildGrowthMemory(
  evaluation: EvaluationResult,
  decision: ProfileUpdateDecision,
  evidence: AbilityEvidence[],
  createdAt: string,
): GrowthMemoryRecord {
  return {
    recordId: 'phase13-existing-growth-memory',
    studentId,
    abilityId: targetAbilityId,
    abilityLabel: targetAbilityId,
    createdAt,
    evaluationResultId: evaluation.evaluationId,
    profileUpdateDecisionId: decision.decisionId,
    evidenceLinks: evidence.map((item) => item.id),
    action: decision.action,
    beforeProfileSummary: {
      abilityId: targetAbilityId,
      abilityStatus: 'improving',
      evidenceCount: 2,
    },
    afterProfileSummary: {
      abilityId: targetAbilityId,
      abilityStatus: 'improving',
      evidenceCount: 2 + evidence.length,
    },
    reason: '延迟复测结果已完成正式回流。',
    limitations: ['保持性观察由 Phase 13.3 另行生成。'],
    nextAction: 'continue_observation',
    sourceRuntime: 'phase9_3_task_evidence_return',
    relatedSessionId: 'phase13-delayed-execution',
  };
}
