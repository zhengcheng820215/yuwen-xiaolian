import { assessEvidenceQuality } from '../agents/evidenceQualityAssessmentAgent.ts';
import type { AbilityEvidence, AbilityEvidenceType } from '../schemas/abilityEvidence.schema.ts';
import type { ConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import {
  isEvidenceQualityAssessment,
  resolveCurrentEvidenceQualityAssessment,
  type EvidenceQualityAssessment,
  type EvidenceQualityAssessmentInput,
  type EvidenceQualityRetentionContext,
} from '../schemas/evidenceQualityAssessment.schema.ts';
import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import type { RetentionDifficultyRelation, RetentionMaterialRelation } from '../schemas/retentionEvaluation.schema.ts';
import type { TaskEvidenceReturnResult } from '../schemas/taskEvidenceReturn.schema.ts';
import type { StudentResponse, TaskExecutionResult } from '../schemas/taskExecution.schema.ts';

type CheckResult = { passed: boolean; detail: string };
type CaseReport = {
  name: string;
  assessment: EvidenceQualityAssessment;
  passed: boolean;
  details: string[];
  failReasons: string[];
};

type BuildOptions = {
  evidenceId?: string;
  evidenceType?: AbilityEvidenceType;
  evidenceAbility?: string;
  taskAbility?: string;
  diagnosisAbility?: string;
  taskRole?: RecommendedTaskRole;
  answerText?: string;
  responseValid?: boolean;
  usedHint?: boolean;
  hintCount?: number;
  materialRelation?: RetentionMaterialRelation;
  difficultyRelation?: RetentionDifficultyRelation;
  baselineEvidenceAt?: string;
  delayedRetestPlanId?: string;
  includeRetentionContext?: boolean;
  evidenceCreatedAt?: string;
  malformedDiagnosis?: boolean;
};

const studentId = 'phase14-quality-student';
const targetAbilityId = '推理';
const taskId = 'phase14-quality-task';
const executionSessionId = 'phase14-quality-execution';
const responseId = 'phase14-quality-response';
const diagnosisResultId = 'phase14-quality-diagnosis';
const returnId = 'phase14-quality-return';
const assessedAt = '2026-07-17T10:00:00.000Z';

const cases: Array<{ name: string; run: () => CaseReport }> = [
  {
    name: 'Case 1 无提示延迟迁移 positive：high / eligible',
    run: () => runCase(
      'Case 1 无提示延迟迁移 positive：high / eligible',
      buildInput({
        taskRole: 'transfer',
        evidenceType: 'positive',
        includeRetentionContext: true,
        materialRelation: 'new_material',
        difficultyRelation: 'comparable',
        delayedRetestPlanId: 'phase14-delayed-plan',
        baselineEvidenceAt: '2026-07-10T09:00:00.000Z',
      }),
      (assessment) => [
        check(assessment.qualityLevel === 'high', `quality=${assessment.qualityLevel}`),
        check(assessment.evaluationEligibility === 'eligible', `eligibility=${assessment.evaluationEligibility}`),
        check(assessment.facts.taskNovelty === 'transfer', `novelty=${assessment.facts.taskNovelty}`),
        check(assessment.facts.timingType === 'delayed', `timing=${assessment.facts.timingType}`),
      ],
    ),
  },
  {
    name: 'Case 2 多提示即时原题 positive：low / limited',
    run: () => runCase(
      'Case 2 多提示即时原题 positive：low / limited',
      buildInput({
        taskRole: 'training',
        usedHint: true,
        hintCount: 3,
        includeRetentionContext: true,
        materialRelation: 'same_material',
        difficultyRelation: 'comparable',
        baselineEvidenceAt: '2026-07-17T08:30:00.000Z',
      }),
      (assessment) => [
        check(assessment.qualityLevel === 'low', `quality=${assessment.qualityLevel}`),
        check(assessment.evaluationEligibility === 'limited', `eligibility=${assessment.evaluationEligibility}`),
        check(assessment.facts.hintDependency === 'high', `hint=${assessment.facts.hintDependency}`),
      ],
    ),
  },
  {
    name: 'Case 3 无提示延迟迁移 weakness：high quality weakness',
    run: () => runCase(
      'Case 3 无提示延迟迁移 weakness：high quality weakness',
      buildInput({
        taskRole: 'transfer',
        evidenceType: 'weakness',
        includeRetentionContext: true,
        materialRelation: 'new_material',
        difficultyRelation: 'comparable',
        delayedRetestPlanId: 'phase14-delayed-plan',
        baselineEvidenceAt: '2026-07-10T09:00:00.000Z',
      }),
      (assessment) => [
        check(assessment.qualityLevel === 'high', `quality=${assessment.qualityLevel}`),
        check(assessment.evidenceType === 'weakness', `direction=${assessment.evidenceType}`),
        check(assessment.evaluationEligibility === 'eligible', `eligibility=${assessment.evaluationEligibility}`),
      ],
    ),
  },
  {
    name: 'Case 4 少量提示相似材料 growth：medium / limited',
    run: () => runCase(
      'Case 4 少量提示相似材料 growth：medium / limited',
      buildInput({
        taskRole: 'retest',
        evidenceType: 'growth',
        usedHint: true,
        hintCount: 1,
        includeRetentionContext: true,
        materialRelation: 'similar_material',
        difficultyRelation: 'comparable',
        baselineEvidenceAt: '2026-07-17T08:30:00.000Z',
      }),
      (assessment) => [
        check(assessment.qualityLevel === 'medium', `quality=${assessment.qualityLevel}`),
        check(assessment.evaluationEligibility === 'limited', `eligibility=${assessment.evaluationEligibility}`),
        check(assessment.facts.hintDependency === 'low', `hint=${assessment.facts.hintDependency}`),
      ],
    ),
  },
  {
    name: 'Case 5 简短但有效回答：不因字数少被阻断',
    run: () => runCase(
      'Case 5 简短但有效回答：不因字数少被阻断',
      buildInput({ answerText: '因为他舍不得。', taskRole: 'training' }),
      (assessment) => [
        check(assessment.facts.responseValid, `responseValid=${assessment.facts.responseValid}`),
        check(assessment.evaluationEligibility === 'limited', `eligibility=${assessment.evaluationEligibility}`),
        check(assessment.qualityLevel === 'low', `quality=${assessment.qualityLevel}`),
      ],
    ),
  },
  {
    name: 'Case 6 无效回答：insufficient / blocked',
    run: () => runCase(
      'Case 6 无效回答：insufficient / blocked',
      buildInput({ responseValid: false, answerText: '不知道' }),
      (assessment) => [
        check(assessment.qualityLevel === 'insufficient', `quality=${assessment.qualityLevel}`),
        check(assessment.evaluationEligibility === 'blocked', `eligibility=${assessment.evaluationEligibility}`),
        check(!assessment.facts.responseValid, `responseValid=${assessment.facts.responseValid}`),
      ],
    ),
  },
  {
    name: 'Case 7 Diagnosis 能力不对齐：blocked',
    run: () => runCase(
      'Case 7 Diagnosis 能力不对齐：blocked',
      buildInput({ diagnosisAbility: '表达' }),
      (assessment) => [
        check(assessment.evaluationEligibility === 'blocked', `eligibility=${assessment.evaluationEligibility}`),
        check(!assessment.facts.diagnosisAligned, `diagnosisAligned=${assessment.facts.diagnosisAligned}`),
        check(assessment.validation.issues.some((issue) => issue.includes('Diagnosis ability alignment')), assessment.validation.issues.join(' | ')),
      ],
    ),
  },
  {
    name: 'Case 8 追溯 Response ID 错位：blocked',
    run: () => {
      const input = buildInput({});
      input.taskEvidenceReturnResult = {
        ...input.taskEvidenceReturnResult,
        responseId: 'other-response',
      };
      return runCase('Case 8 追溯 Response ID 错位：blocked', input, (assessment) => [
        check(assessment.evaluationEligibility === 'blocked', `eligibility=${assessment.evaluationEligibility}`),
        check(!assessment.facts.traceabilityComplete, `traceability=${assessment.facts.traceabilityComplete}`),
        check(assessment.validation.issues.some((issue) => issue.includes('responseId mismatch')), assessment.validation.issues.join(' | ')),
      ]);
    },
  },
  {
    name: 'Case 9 调用方伪造独立完成：Agent 忽略派生字段',
    run: () => {
      const input = buildInput({ usedHint: true, hintCount: 2 });
      Object.assign(input, { independentPerformance: true });
      return runCase('Case 9 调用方伪造独立完成：Agent 忽略派生字段', input, (assessment) => [
        check(!assessment.facts.independentPerformance, `independent=${assessment.facts.independentPerformance}`),
        check(assessment.facts.hintDependency === 'medium', `hint=${assessment.facts.hintDependency}`),
      ]);
    },
  },
  {
    name: 'Case 10 调用方伪造迁移：正式材料关系优先',
    run: () => {
      const input = buildInput({
        taskRole: 'transfer',
        includeRetentionContext: true,
        materialRelation: 'same_material',
        difficultyRelation: 'comparable',
        baselineEvidenceAt: '2026-07-17T08:30:00.000Z',
      });
      Object.assign(input, { taskNovelty: 'transfer' });
      return runCase('Case 10 调用方伪造迁移：正式材料关系优先', input, (assessment) => [
        check(assessment.facts.taskNovelty === 'same', `novelty=${assessment.facts.taskNovelty}`),
        check(assessment.evaluationEligibility === 'review_required', `eligibility=${assessment.evaluationEligibility}`),
      ]);
    },
  },
  {
    name: 'Case 11 缺少任务比较上下文：不得输出 high',
    run: () => runCase(
      'Case 11 缺少任务比较上下文：不得输出 high',
      buildInput({ taskRole: 'training', includeRetentionContext: false }),
      (assessment) => [
        check(assessment.qualityLevel === 'low', `quality=${assessment.qualityLevel}`),
        check(assessment.evaluationEligibility === 'limited', `eligibility=${assessment.evaluationEligibility}`),
        check(assessment.facts.taskNovelty === 'unknown', `novelty=${assessment.facts.taskNovelty}`),
      ],
    ),
  },
  {
    name: 'Case 12 同一上下文重复执行：Assessment ID 稳定',
    run: () => {
      const input = buildInput({ taskRole: 'training' });
      const first = assessEvidenceQuality(input);
      const second = assessEvidenceQuality(input);
      return report('Case 12 同一上下文重复执行：Assessment ID 稳定', second, [
        check(first.assessmentId === second.assessmentId, `assessmentId=${second.assessmentId}`),
        check(first.contextFingerprint === second.contextFingerprint, `context=${second.contextFingerprint}`),
        check(first.observationUnitId === second.observationUnitId, `observation=${second.observationUnitId}`),
      ]);
    },
  },
  {
    name: 'Case 13 insufficient Evidence：insufficient / blocked',
    run: () => runCase(
      'Case 13 insufficient Evidence：insufficient / blocked',
      buildInput({ evidenceType: 'insufficient' }),
      (assessment) => [
        check(assessment.qualityLevel === 'insufficient', `quality=${assessment.qualityLevel}`),
        check(assessment.evaluationEligibility === 'blocked', `eligibility=${assessment.evaluationEligibility}`),
      ],
    ),
  },
  {
    name: 'Case 14 高 confidence 但 Diagnosis Schema 非法：blocked',
    run: () => runCase(
      'Case 14 高 confidence 但 Diagnosis Schema 非法：blocked',
      buildInput({ malformedDiagnosis: true }),
      (assessment) => [
        check(assessment.evaluationEligibility === 'blocked', `eligibility=${assessment.evaluationEligibility}`),
        check(!assessment.facts.diagnosisReliable, `diagnosisReliable=${assessment.facts.diagnosisReliable}`),
      ],
    ),
  },
  {
    name: 'Case 15 上下文补齐：生成不可变新版 Assessment',
    run: () => {
      const firstInput = buildInput({ taskRole: 'retest', includeRetentionContext: false });
      const first = assessEvidenceQuality(firstInput);
      const secondInput = buildInput({
        taskRole: 'retest',
        includeRetentionContext: true,
        materialRelation: 'new_material',
        difficultyRelation: 'comparable',
        delayedRetestPlanId: 'phase14-delayed-plan',
        baselineEvidenceAt: '2026-07-10T09:00:00.000Z',
      });
      secondInput.supersedesAssessment = first;
      const second = assessEvidenceQuality(secondInput);
      const resolution = resolveCurrentEvidenceQualityAssessment(second.evidenceId, [first, second]);
      return report('Case 15 上下文补齐：生成不可变新版 Assessment', second, [
        check(first.assessmentId !== second.assessmentId, `first=${first.assessmentId}, second=${second.assessmentId}`),
        check(first.contextFingerprint !== second.contextFingerprint, 'context fingerprint changed'),
        check(second.supersedesAssessmentId === first.assessmentId, `supersedes=${second.supersedesAssessmentId}`),
        check(resolution.status === 'resolved', `resolution=${resolution.status}`),
        check(resolution.assessment?.assessmentId === second.assessmentId, `current=${resolution.assessment?.assessmentId}`),
      ]);
    },
  },
  {
    name: 'Case 16 同一 Response 多条 Evidence：共享 observationUnitId',
    run: () => {
      const firstInput = buildInput({ evidenceId: 'phase14-evidence-a', taskRole: 'training' });
      const secondEvidence: AbilityEvidence = {
        ...firstInput.abilityEvidence,
        id: 'phase14-evidence-b',
        evidenceType: 'growth',
      };
      const sharedEvidence = [firstInput.abilityEvidence, secondEvidence];
      firstInput.taskEvidenceReturnResult = {
        ...firstInput.taskEvidenceReturnResult,
        abilityEvidence: sharedEvidence,
      };
      const secondInput: EvidenceQualityAssessmentInput = {
        ...firstInput,
        abilityEvidence: secondEvidence,
      };
      const first = assessEvidenceQuality(firstInput);
      const second = assessEvidenceQuality(secondInput);
      return report('Case 16 同一 Response 多条 Evidence：共享 observationUnitId', second, [
        check(first.assessmentId !== second.assessmentId, 'different Evidence keeps different Assessment IDs'),
        check(first.observationUnitId === second.observationUnitId, `observation=${second.observationUnitId}`),
        check(first.sourceLinks.responseId === second.sourceLinks.responseId, `response=${second.sourceLinks.responseId}`),
      ]);
    },
  },
  {
    name: 'Case 17 Assessment 分叉版本：review_required',
    run: () => {
      const first = assessEvidenceQuality(buildInput({
        taskRole: 'retest',
        includeRetentionContext: true,
        materialRelation: 'similar_material',
        difficultyRelation: 'comparable',
        baselineEvidenceAt: '2026-07-17T08:30:00.000Z',
      }));
      const second = assessEvidenceQuality(buildInput({
        taskRole: 'retest',
        includeRetentionContext: true,
        materialRelation: 'new_material',
        difficultyRelation: 'comparable',
        delayedRetestPlanId: 'phase14-delayed-plan',
        baselineEvidenceAt: '2026-07-10T09:00:00.000Z',
      }));
      const resolution = resolveCurrentEvidenceQualityAssessment(first.evidenceId, [first, second]);
      return report('Case 17 Assessment 分叉版本：review_required', second, [
        check(first.assessmentId !== second.assessmentId, 'two independent current versions exist'),
        check(resolution.status === 'review_required', `resolution=${resolution.status}`),
        check(resolution.assessment === null, `assessment=${resolution.assessment?.assessmentId || 'null'}`),
        check(resolution.issues.some((issue) => issue.includes('Expected one current')), resolution.issues.join(' | ')),
      ]);
    },
  },
];

const reports = cases.map((item) => item.run());
const passedCount = reports.filter((reportItem) => reportItem.passed).length;
const allPassed = passedCount === reports.length;

console.log('Phase 14.1 Evidence Quality Assessment Debug Report');
console.log('====================================================');
for (const reportItem of reports) {
  console.log(`\n${reportItem.passed ? 'PASS' : 'FAIL'} ${reportItem.name}`);
  console.log(`  Evidence: ${reportItem.assessment.evidenceId} / ${reportItem.assessment.evidenceType}`);
  console.log(`  Quality: ${reportItem.assessment.qualityLevel} / ${reportItem.assessment.evaluationEligibility}`);
  console.log(`  Facts: valid=${reportItem.assessment.facts.responseValid}, aligned=${reportItem.assessment.facts.taskAbilityAligned}, diagnosis=${reportItem.assessment.facts.diagnosisAligned}, trace=${reportItem.assessment.facts.traceabilityComplete}`);
  console.log(`  Context: hint=${reportItem.assessment.facts.hintDependency}, novelty=${reportItem.assessment.facts.taskNovelty}, timing=${reportItem.assessment.facts.timingType}, difficulty=${reportItem.assessment.facts.difficultyRelation}`);
  console.log(`  Observation: ${reportItem.assessment.observationUnitId}`);
  console.log(`  Context Fingerprint: ${reportItem.assessment.contextFingerprint}`);
  console.log(`  Policy: ${reportItem.assessment.policyVersion}`);
  console.log(`  Supersedes: ${reportItem.assessment.supersedesAssessmentId || 'none'}`);
  console.log(`  Validation: ${reportItem.assessment.validation.passed ? 'passed' : reportItem.assessment.validation.issues.join(' | ')}`);
  for (const detail of reportItem.details) console.log(`  - ${detail}`);
  for (const failure of reportItem.failReasons) console.log(`  ! ${failure}`);
}

console.log('\nSummary');
console.log('-------');
console.log(`Cases: ${passedCount} / ${reports.length} PASS`);
console.log(`Result: ${allPassed ? 'PASS' : 'FAIL'}`);

if (!allPassed) process.exitCode = 1;

function runCase(
  name: string,
  input: EvidenceQualityAssessmentInput,
  checks: (assessment: EvidenceQualityAssessment) => CheckResult[],
): CaseReport {
  const assessment = assessEvidenceQuality(input);
  return report(name, assessment, [
    check(isEvidenceQualityAssessment(assessment), 'schema valid'),
    ...checks(assessment),
  ]);
}

function report(
  name: string,
  assessment: EvidenceQualityAssessment,
  checks: CheckResult[],
): CaseReport {
  const failReasons = checks.filter((item) => !item.passed).map((item) => item.detail);
  return {
    name,
    assessment,
    passed: failReasons.length === 0,
    details: checks.map((item) => item.detail),
    failReasons,
  };
}

function check(passed: boolean, detail: string): CheckResult {
  return { passed, detail };
}

function buildInput(options: BuildOptions): EvidenceQualityAssessmentInput {
  const evidenceAbility = options.evidenceAbility || targetAbilityId;
  const taskAbility = options.taskAbility || targetAbilityId;
  const diagnosisAbility = options.diagnosisAbility || targetAbilityId;
  const taskRole = options.taskRole || 'training';
  const usedHint = options.usedHint || false;
  const hintCount = options.hintCount || 0;
  const responseValid = options.responseValid !== false;
  const evidenceCreatedAt = options.evidenceCreatedAt || '2026-07-17T09:00:00.000Z';
  const evidence: AbilityEvidence = {
    id: options.evidenceId || 'phase14-quality-evidence',
    studentId,
    ability: evidenceAbility,
    evidenceType: options.evidenceType || 'positive',
    detail: '学生完成了本次推理任务，正式表现已进入 Evidence Return。',
    source: taskRole === 'training' ? 'training' : 'retest',
    observation: '学生根据文本行为作出人物心理判断。',
    confidence: 0.9,
    createdAt: evidenceCreatedAt,
    taskId,
    diagnosisId: diagnosisResultId,
  };
  const task = buildTask(taskAbility, taskRole);
  const response: StudentResponse = {
    responseId,
    executionSessionId,
    studentId,
    taskId,
    answerText: options.answerText || '父亲看到旧书和树叶时想起过去，因此感到怀念和不舍。',
    submittedAt: '2026-07-17T08:55:00.000Z',
    usedHint,
    hintCount,
  };
  const execution: TaskExecutionResult = {
    executionSessionId,
    studentId,
    taskId,
    status: responseValid ? 'submitted_valid' : 'submitted_invalid',
    studentResponse: response,
    responseValidity: {
      responseId,
      status: responseValid ? 'valid' : 'placeholder',
      canDiagnose: responseValid,
      reasons: responseValid ? ['回答包含可观察表现。'] : ['占位回答不能进入诊断。'],
    },
    usedHint,
    hintCount,
    canEnterDiagnosisRuntime: responseValid,
  };
  const diagnosis = buildDiagnosis(diagnosisAbility, options.malformedDiagnosis);
  const taskReturn: TaskEvidenceReturnResult = {
    returnId,
    status: 'evidence_returned',
    studentId,
    taskId,
    executionSessionId,
    responseId,
    concreteTask: task,
    taskExecutionResult: execution,
    diagnosisResult: diagnosis,
    diagnosisResultId,
    abilityEvidence: [evidence],
    evidenceTraceLinks: [{
      taskId,
      executionSessionId,
      responseId,
      diagnosisResultId,
    }],
    supportContext: {
      usedHint,
      hintCount,
    },
    validation: {
      passed: true,
      diagnosisSchemaValid: true,
      taskDiagnosisAligned: diagnosisAbility === targetAbilityId,
      studentIdConsistent: true,
      traceabilityComplete: true,
      reviewRequired: false,
      issues: [],
    },
  };
  const retentionContext = options.includeRetentionContext
    ? buildRetentionContext(options)
    : undefined;

  return {
    studentId,
    targetAbilityId,
    abilityEvidence: evidence,
    concreteLearningTask: task,
    taskExecutionResult: execution,
    taskEvidenceReturnResult: taskReturn,
    retentionContext,
    assessedAt,
    timezone: 'Asia/Shanghai',
  };
}

function buildTask(
  ability: string,
  taskRole: RecommendedTaskRole,
): ConcreteLearningTask {
  return {
    taskId,
    studentId,
    sourceType: 'mock',
    sourceTaskRequestId: 'phase14-task-request',
    sourceFulfillmentRequestId: 'phase14-fulfillment-request',
    sourceStrategyId: 'phase14-strategy',
    targetAbilityId: ability,
    targetAbilityName: ability,
    taskRole,
    validationGoal: '观察学生能否根据文本行为推断人物心理。',
    readingText: '父亲从旧书中发现一片褪色的树叶。他捏着树叶站了很久，最后把它小心地夹回原处。',
    question: '父亲此时可能有怎样的心理？请结合文中内容说明理由。',
    answerRequirements: ['写出人物心理，并说明理由。'],
    referenceAnswer: '父亲想起过去，感到怀念和不舍。',
    scoringPoints: ['人物心理判断', '文本依据', '行为与心理关系'],
    rubric: [{ name: '推理链', ability, required: true, weight: 1 }],
    questionMetadata: {
      questionId: 'phase14-question',
      subject: '语文',
      grade: '七年级',
      questionType: 'reading_open_response',
      assessmentMode: 'reasoning_chain',
      mainAbility: ability,
      relatedAbilities: ['表达'],
      difficulty: '基础',
    },
    expectedDiagnosisFocus: ['文本行为与人物心理之间的推理关系'],
    createdAt: '2026-07-17T08:00:00.000Z',
  };
}

function buildDiagnosis(
  ability: string,
  malformed = false,
): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: true,
    strategyUsed: 'reasoning_chain',
    answerStatus: 'fully_meets',
    scoreBand: 'high',
    mainAbility: ability,
    relatedAbilities: ['表达'],
    surfaceError: '无明显表面错误',
    rootCause: malformed ? '' : '学生能够将人物动作与心理判断建立联系。',
    errorType: '待验证',
    abilityEvidence: ['能够结合文本动作推断人物心理。'],
    diagnosisSummary: '本次回答完成了目标推理动作。',
    nextTraining: '继续通过新材料验证独立迁移表现。',
    confidence: 0.99,
  };
}

function buildRetentionContext(options: BuildOptions): EvidenceQualityRetentionContext {
  return {
    delayedRetestPlanId: options.delayedRetestPlanId,
    baselineTaskId: 'phase14-baseline-task',
    baselineEvidenceAt: options.baselineEvidenceAt,
    materialRelation: options.materialRelation || 'unknown',
    difficultyRelation: options.difficultyRelation || 'unknown',
    source: options.delayedRetestPlanId ? 'delayed_retest_plan' : 'comparison_adapter',
    validationPassed: true,
  };
}
