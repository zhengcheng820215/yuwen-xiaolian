import { buildAdaptiveTaskContextSnapshot } from '../agents/adaptiveTaskContextAdapter.ts';
import { deriveAdaptiveTaskConstraints } from '../agents/adaptiveTaskConstraintsAgent.ts';
import { createAdaptiveTaskRequestEnvelope } from '../agents/adaptiveTaskRequestEnvelopeAgent.ts';
import { assessEvidenceQuality } from '../agents/evidenceQualityAssessmentAgent.ts';
import { validateStrategyConstraintAlignment } from '../agents/strategyConstraintAlignmentAgent.ts';
import { runTaskEvidenceReturnAgent } from '../agents/taskEvidenceReturnAgent.ts';
import { runTaskExecutionAgent } from '../agents/taskExecutionAgent.ts';
import { createAdaptiveTaskFulfillmentRequest } from '../agents/taskFulfillmentRequestAgent.ts';
import { createTaskRequest } from '../agents/taskRequestAgent.ts';
import { validateNextLearningStrategy } from '../agents/strategyValidationAgent.ts';
import type { AdaptiveTaskConstraintsInput } from '../schemas/adaptiveTaskConstraints.schema.ts';
import { isAdaptiveTaskConstraints } from '../schemas/adaptiveTaskConstraints.schema.ts';
import type { ConcreteLearningTask, TaskReadinessValidation } from '../schemas/concreteLearningTask.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { EvidenceConflictAssessment } from '../schemas/evidenceConflictAssessment.schema.ts';
import {
  EVIDENCE_CONFLICT_ASSESSMENT_SCHEMA_VERSION,
  EVIDENCE_CONFLICT_POLICY_VERSION,
} from '../schemas/evidenceConflictAssessment.schema.ts';
import type { EvidenceQualityAssessment } from '../schemas/evidenceQualityAssessment.schema.ts';
import {
  EVIDENCE_QUALITY_ASSESSMENT_SCHEMA_VERSION,
  EVIDENCE_QUALITY_POLICY_VERSION,
  isEvidenceQualityAssessment,
  resolveCurrentEvidenceQualityAssessment,
} from '../schemas/evidenceQualityAssessment.schema.ts';
import type { CurrentLearningContext, NextLearningStrategy } from '../schemas/nextLearningStrategy.schema.ts';

const STUDENT_ID = 'student-phase14-integration';
const ABILITY_ID = '推理';
const GENERATED_AT = '2026-07-17T14:00:00.000Z';
const RETURNED_AT = '2026-07-17T14:15:00.000Z';

type Check = { name: string; passed: boolean; detail: string };
const checks: Check[] = [];

function check(name: string, passed: boolean, detail: string): void {
  checks.push({ name, passed, detail });
}

const constraintsInput = buildConstraintsInput();
const constraintsResult = deriveAdaptiveTaskConstraints(constraintsInput);
const constraints = constraintsResult.constraints;
if (!constraints) throw new Error(`AdaptiveTaskConstraints generation failed: ${constraintsResult.issues.join(' | ')}`);

const frozenConstraints = JSON.stringify(constraints);
check('14.3 generated formal Constraints', isAdaptiveTaskConstraints(constraints), `status=${constraintsResult.status}`);
check(
  'target Evidence quality is high',
  constraints.targetEvidenceQuality === 'high',
  `targetEvidenceQuality=${constraints.targetEvidenceQuality}`,
);
check('pre-execution hint policy is no_hint', constraints.hintPolicy === 'no_hint', `hintPolicy=${constraints.hintPolicy}`);

const alignment = validateStrategyConstraintAlignment({
  strategy: constraintsInput.strategy,
  strategyValidationResult: constraintsInput.strategyValidationResult,
  adaptiveTaskContext: constraintsInput.adaptiveTaskContext,
  constraints,
  alignedAt: GENERATED_AT,
});
const taskRequest = createTaskRequest({
  strategy: constraintsInput.strategy,
  validationResult: constraintsInput.strategyValidationResult,
  createdAt: GENERATED_AT,
}).taskRequest;
if (!taskRequest) throw new Error('Approved Strategy did not produce TaskRequest.');
const envelopeResult = createAdaptiveTaskRequestEnvelope({
  taskRequest,
  adaptiveConstraints: constraints,
  alignmentResult: alignment,
});
if (!envelopeResult.envelope) throw new Error(`AdaptiveTaskRequestEnvelope failed: ${envelopeResult.issues.join(' | ')}`);
const fulfillmentResult = createAdaptiveTaskFulfillmentRequest({
  adaptiveTaskRequestEnvelope: envelopeResult.envelope,
  createdAt: GENERATED_AT,
});
check(
  'approved Constraints enter Existing TaskFulfillment',
  alignment.status === 'aligned' && Boolean(fulfillmentResult.request),
  `alignment=${alignment.status}, fulfillment=${Boolean(fulfillmentResult.request)}`,
);
check(
  'TaskFulfillment preserves the no-hint structured rule',
  Boolean(fulfillmentResult.request?.hardConstraints.some((item) => item.startsWith('hint_policy:eq:no_hint'))),
  `hardConstraints=${fulfillmentResult.request?.hardConstraints.join(',') || 'none'}`,
);

const hintedTask = buildConcreteTask('phase14-case27-hinted-task');
const hintedExecution = runTaskExecutionAgent({
  concreteTask: hintedTask,
  readiness: buildReadiness(hintedTask.taskId),
  studentAnswer: {
    answerText: '在提示后，我认为父亲想起了过去，因为他站了很久，又把树叶小心地夹回去。',
    usedHint: true,
    hintCount: 3,
    submittedAt: '2026-07-17T14:10:00.000Z',
  },
  startedAt: '2026-07-17T14:05:00.000Z',
});
if (!hintedExecution.taskExecutionResult) throw new Error('Hinted execution did not produce TaskExecutionResult.');

const hintedReturn = runTaskEvidenceReturnAgent({
  concreteTask: hintedTask,
  taskExecutionResult: hintedExecution.taskExecutionResult,
  diagnosisResult: buildDiagnosis(),
  diagnosisResultId: 'diagnosis-phase14-case27-hinted',
  returnedAt: RETURNED_AT,
});
const hintedEvidence = hintedReturn.abilityEvidence[0];
if (!hintedEvidence) throw new Error('Hinted valid execution did not produce AbilityEvidence.');

const hintedAssessment = assessEvidenceQuality({
  studentId: STUDENT_ID,
  targetAbilityId: ABILITY_ID,
  abilityEvidence: hintedEvidence,
  concreteLearningTask: hintedTask,
  taskExecutionResult: hintedExecution.taskExecutionResult,
  taskEvidenceReturnResult: hintedReturn,
  retentionContext: {
    baselineTaskId: hintedTask.taskId,
    baselineEvidenceAt: '2026-07-17T13:50:00.000Z',
    materialRelation: 'same_material',
    difficultyRelation: 'comparable',
    source: 'comparison_adapter',
    validationPassed: true,
  },
  assessedAt: '2026-07-17T14:20:00.000Z',
  timezone: 'Asia/Shanghai',
});

check('hinted response remains diagnostically valid', hintedReturn.status === 'evidence_returned', `returnStatus=${hintedReturn.status}`);
check(
  'Phase 8 was reused exactly through the existing return runtime',
  Boolean(hintedReturn.evaluationResult && hintedReturn.profileUpdateDecision && hintedReturn.growthMemoryRecord),
  `evaluation=${Boolean(hintedReturn.evaluationResult)}, decision=${Boolean(hintedReturn.profileUpdateDecision)}, memory=${Boolean(hintedReturn.growthMemoryRecord)}`,
);
check('14.1 produced a valid new Assessment', isEvidenceQualityAssessment(hintedAssessment), `assessmentId=${hintedAssessment.assessmentId}`);
check(
  'actual hinted performance was not forced to high quality',
  hintedAssessment.qualityLevel === 'low' && hintedAssessment.evaluationEligibility === 'limited',
  `quality=${hintedAssessment.qualityLevel}, eligibility=${hintedAssessment.evaluationEligibility}`,
);
check(
  'hint dependency is preserved as an observed fact',
  hintedAssessment.facts.usedHint && hintedAssessment.facts.hintCount === 3 && hintedAssessment.facts.hintDependency === 'high',
  `usedHint=${hintedAssessment.facts.usedHint}, hintCount=${hintedAssessment.facts.hintCount}, dependency=${hintedAssessment.facts.hintDependency}`,
);

const qualityResolution = resolveCurrentEvidenceQualityAssessment(hintedEvidence.id, [hintedAssessment]);
check(
  'new Assessment can be consumed by a future Strategy cycle',
  qualityResolution.status === 'resolved' && qualityResolution.assessment?.assessmentId === hintedAssessment.assessmentId,
  `resolution=${qualityResolution.status}`,
);

const repeatedHintedReturn = runTaskEvidenceReturnAgent({
  concreteTask: hintedTask,
  taskExecutionResult: hintedExecution.taskExecutionResult,
  diagnosisResult: buildDiagnosis(),
  diagnosisResultId: 'diagnosis-phase14-case27-hinted',
  returnedAt: RETURNED_AT,
});
const repeatedIds = [hintedEvidence.id, ...repeatedHintedReturn.abilityEvidence.map((item) => item.id)];
check(
  'repeated return keeps one stable Evidence identity',
  new Set(repeatedIds).size === 1,
  `evidenceIds=${repeatedIds.join(',')}`,
);

const invalidTask = buildConcreteTask('phase14-case27-invalid-task');
const invalidExecution = runTaskExecutionAgent({
  concreteTask: invalidTask,
  readiness: buildReadiness(invalidTask.taskId),
  studentAnswer: {
    answerText: '不知道',
    usedHint: false,
    hintCount: 0,
    submittedAt: '2026-07-17T14:30:00.000Z',
  },
  startedAt: '2026-07-17T14:25:00.000Z',
});
if (!invalidExecution.taskExecutionResult) throw new Error('Invalid execution did not produce TaskExecutionResult.');

const invalidReturn = runTaskEvidenceReturnAgent({
  concreteTask: invalidTask,
  taskExecutionResult: invalidExecution.taskExecutionResult,
  diagnosisResult: buildDiagnosis(),
  diagnosisResultId: 'diagnosis-phase14-case27-invalid',
  returnedAt: '2026-07-17T14:35:00.000Z',
});

check(
  'placeholder response is blocked before Diagnosis',
  invalidExecution.taskExecutionResult.status === 'submitted_invalid' && !invalidExecution.taskExecutionResult.canEnterDiagnosisRuntime,
  `executionStatus=${invalidExecution.taskExecutionResult.status}, canDiagnose=${invalidExecution.taskExecutionResult.canEnterDiagnosisRuntime}`,
);
check(
  'invalid response produces no formal Evidence or Phase 8 update',
  invalidReturn.status === 'blocked_invalid_execution' &&
    invalidReturn.abilityEvidence.length === 0 &&
    !invalidReturn.evaluationResult &&
    !invalidReturn.profileUpdateDecision &&
    !invalidReturn.growthMemoryRecord,
  `returnStatus=${invalidReturn.status}, evidenceCount=${invalidReturn.abilityEvidence.length}`,
);

check(
  'execution outcomes do not mutate the original Constraints',
  JSON.stringify(constraints) === frozenConstraints,
  `constraintsId=${constraints.constraintsId}`,
);
check(
  'not reaching target quality is not a 14.3 Runtime failure',
  constraintsResult.status === 'generated' && constraints.validation.passed,
  `constraintsStatus=${constraintsResult.status}, validation=${constraints.validation.passed}`,
);

printReport();

function buildConstraintsInput(): AdaptiveTaskConstraintsInput {
  const currentLearningContext: CurrentLearningContext = {
    contextId: 'phase14-integration-context',
    studentId: STUDENT_ID,
    currentPhase: 'retest',
    targetAbilityId: ABILITY_ID,
    allowTraining: true,
    allowRetest: true,
    allowTransfer: true,
    cognitiveLoad: 'medium',
    reviewRequired: false,
    notes: [],
  };
  const strategy: NextLearningStrategy = {
    strategyId: 'phase14-integration-strategy',
    studentId: STUDENT_ID,
    targetAbilityId: ABILITY_ID,
    action: 'independent_retest',
    reason: '需要通过无提示任务验证独立表现。',
    evidenceLinks: ['baseline-evidence-1', 'baseline-evidence-2'],
    growthMemoryRecordIds: ['phase14-integration-memory'],
    validationGoal: '验证学生能否无提示完成推理任务。',
    recommendedTaskRole: 'retest',
    limitations: [],
    strategySource: 'growth_memory',
    createdAt: GENERATED_AT,
  };
  const strategyValidationResult = validateNextLearningStrategy({
    strategy,
    currentLearningContext,
    validatedAt: GENERATED_AT,
  });
  const adaptiveTaskContext = buildAdaptiveTaskContextSnapshot({
    currentLearningContext,
    studentId: STUDENT_ID,
    targetAbilityId: ABILITY_ID,
    currentDifficultyLevel: 'same',
    recentTaskIds: ['baseline-task-1'],
    recentMaterialIds: ['baseline-material-1'],
    activeSessionId: 'phase14-integration-session',
    timezone: 'Asia/Shanghai',
  });
  const qualityAssessments = [
    buildBaselineQualityAssessment('baseline-evidence-1', 'positive', 1),
    buildBaselineQualityAssessment('baseline-evidence-2', 'growth', 2),
  ];
  return {
    strategy,
    strategyValidationResult,
    currentLearningContext,
    adaptiveTaskContext,
    qualityAssessments,
    conflictAssessment: buildAlignedConflictAssessment(qualityAssessments),
    generatedAt: GENERATED_AT,
    timezone: 'Asia/Shanghai',
  };
}

function buildBaselineQualityAssessment(
  evidenceId: string,
  evidenceType: 'positive' | 'growth',
  index: number,
): EvidenceQualityAssessment {
  return {
    assessmentId: `assessment-${evidenceId}`,
    evidenceId,
    studentId: STUDENT_ID,
    abilityId: ABILITY_ID,
    observationUnitId: `baseline-unit-${index}`,
    contextFingerprint: `baseline-context-${index}`,
    policyVersion: EVIDENCE_QUALITY_POLICY_VERSION,
    evidenceType,
    qualityLevel: 'high',
    evaluationEligibility: 'eligible',
    facts: {
      responseValid: true,
      taskAbilityAligned: true,
      diagnosisAligned: true,
      traceabilityComplete: true,
      independentPerformance: true,
      usedHint: false,
      hintCount: 0,
      hintDependency: 'none',
      taskNovelty: 'similar',
      timingType: 'delayed',
      taskRole: 'retest',
      difficultyRelation: 'comparable',
      diagnosisReliable: true,
    },
    qualityReasons: ['无提示、可追溯的延迟观察。'],
    limitations: [],
    sourceLinks: {
      taskId: `baseline-task-${index}`,
      executionSessionId: `baseline-execution-${index}`,
      responseId: `baseline-response-${index}`,
      diagnosisResultId: `baseline-diagnosis-${index}`,
      taskEvidenceReturnId: `baseline-return-${index}`,
    },
    schemaVersion: EVIDENCE_QUALITY_ASSESSMENT_SCHEMA_VERSION,
    assessedAt: GENERATED_AT,
    validation: { passed: true, issues: [] },
  };
}

function buildAlignedConflictAssessment(
  assessments: EvidenceQualityAssessment[],
): EvidenceConflictAssessment {
  return {
    conflictAssessmentId: 'phase14-integration-conflict',
    studentId: STUDENT_ID,
    abilityId: ABILITY_ID,
    status: 'aligned_positive_evidence',
    recommendation: 'proceed_to_evaluation',
    observationUnits: assessments.map((assessment, index) => ({
      observationUnitId: assessment.observationUnitId,
      studentId: STUDENT_ID,
      abilityId: ABILITY_ID,
      direction: 'positive_signal',
      evidenceIds: [assessment.evidenceId],
      qualityAssessmentIds: [assessment.assessmentId],
      effectiveQualityLevel: assessment.qualityLevel,
      effectiveEligibility: assessment.evaluationEligibility,
      taskIds: [assessment.sourceLinks.taskId],
      responseIds: [assessment.sourceLinks.responseId],
      taskRoles: [assessment.facts.taskRole],
      comparisonContextIds: [`baseline-comparison-${index + 1}`],
      comparisonClusterId: `baseline-cluster-${index + 1}`,
      limitations: [],
    })),
    observationUnitCount: assessments.length,
    comparableObservationUnitCount: assessments.length,
    independentContextCount: assessments.length,
    directionSummary: {
      positiveUnitCount: assessments.length,
      weaknessUnitCount: 0,
      mixedUnitCount: 0,
      insufficientUnitCount: 0,
    },
    eligibleEvidenceIds: assessments.map((item) => item.evidenceId),
    limitedEvidenceIds: [],
    blockedEvidenceIds: [],
    reviewRequiredEvidenceIds: [],
    currentQualityAssessmentIds: assessments.map((item) => item.assessmentId),
    supersededQualityAssessmentIds: [],
    comparisonFacts: ['两个独立观察均为正向且质量高。'],
    differenceFactors: [],
    conflictFactors: [],
    limitations: [],
    evidenceLinks: assessments.map((item) => item.evidenceId),
    schemaVersion: EVIDENCE_CONFLICT_ASSESSMENT_SCHEMA_VERSION,
    policyVersion: EVIDENCE_CONFLICT_POLICY_VERSION,
    coordinatedAt: GENERATED_AT,
    validation: { passed: true, issues: [] },
  };
}

function buildConcreteTask(taskId: string): ConcreteLearningTask {
  return {
    taskId,
    studentId: STUDENT_ID,
    sourceType: 'mock',
    sourceTaskRequestId: `${taskId}-request`,
    sourceFulfillmentRequestId: `${taskId}-fulfillment`,
    sourceStrategyId: 'phase14-integration-strategy',
    targetAbilityId: ABILITY_ID,
    targetAbilityName: ABILITY_ID,
    taskRole: 'retest',
    validationGoal: '验证学生能否根据人物动作推断心理。',
    readingText: '父亲从旧书中发现一片褪色的树叶。他捏着树叶站了很久，最后把它小心地夹回原处。',
    question: '父亲此时可能有怎样的心理？请根据他的两个动作说明理由。',
    answerRequirements: ['写出人物心理并说明动作依据。'],
    referenceAnswer: '父亲想起过去，感到怀念和不舍。',
    scoringPoints: ['人物心理判断', '动作依据', '行为与心理关系'],
    rubric: [{ name: '推理链', ability: ABILITY_ID, required: true, weight: 1 }],
    questionMetadata: {
      questionId: `${taskId}-question`,
      subject: '语文',
      grade: '七年级',
      questionType: 'reading_open_response',
      assessmentMode: 'reasoning_chain',
      mainAbility: ABILITY_ID,
      relatedAbilities: ['表达'],
      difficulty: '基础',
    },
    expectedDiagnosisFocus: ['行为线索与人物心理的推理关系'],
    createdAt: GENERATED_AT,
  };
}

function buildReadiness(taskId: string): TaskReadinessValidation {
  return {
    taskId,
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
  };
}

function buildDiagnosis(): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: true,
    strategyUsed: 'reasoning_chain',
    answerStatus: 'fully_meets',
    scoreBand: 'high',
    mainAbility: ABILITY_ID,
    relatedAbilities: ['表达'],
    surfaceError: '无明显表面错误',
    rootCause: '学生在提示后能将人物动作与心理判断建立联系。',
    errorType: '待验证',
    abilityEvidence: ['提示后能根据文本动作推断人物心理。'],
    diagnosisSummary: '本次回答完成了目标推理动作，但使用了提示。',
    nextTraining: '通过无提示任务继续验证独立表现。',
    confidence: 0.92,
  };
}

function printReport(): void {
  console.log('\nPhase 14 Integrated Case 27 Debug Report');
  console.log('========================================');
  for (const item of checks) {
    console.log(`${item.passed ? '[PASS]' : '[FAIL]'} ${item.name}: ${item.detail}`);
  }
  const passed = checks.filter((item) => item.passed).length;
  console.log('\nAcceptance');
  console.log('----------');
  console.log(`Checks: ${passed} / ${checks.length} PASS`);
  console.log(`Constraints target: ${constraints.targetEvidenceQuality}`);
  console.log(`Hinted actual quality: ${hintedAssessment.qualityLevel} / ${hintedAssessment.evaluationEligibility}`);
  console.log(`Invalid response: ${invalidReturn.status}, Evidence=${invalidReturn.abilityEvidence.length}`);
  console.log(`Result: ${passed === checks.length ? 'PASS' : 'FAIL'}`);
  if (passed !== checks.length) process.exitCode = 1;
}
