import { validateDiagnosisEvaluationDataset } from '../agents/diagnosisEvaluationDatasetValidator.ts';
import {
  buildDiagnosisQualityMetrics,
  compareDiagnosisPromptMetrics,
  evaluateDiagnosisQuality,
  evaluateDiagnosisSampleStability,
} from '../agents/diagnosisQualityEvaluationAgent.ts';
import { PHASE15_2_DATASET_V1 } from '../evaluation/phase15_2_dataset_v1.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import {
  DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
  type DiagnosisRepairOperation,
  type RealLLMDiagnosisRuntimeResult,
} from '../schemas/diagnosisRunRecord.schema.ts';
import {
  isDiagnosisQualityEvaluation,
  type DiagnosisEvaluationSample,
  type DiagnosisQualityEvaluation,
  type DiagnosisQualityMetrics,
} from '../schemas/diagnosisQualityEvaluation.schema.ts';

type CaseReport = { name: string; passed: boolean; details: string[] };

const EVALUATED_AT = '2026-07-17T10:00:00.000Z';
const sample = PHASE15_2_DATASET_V1.samples[0];
const invalidSample = PHASE15_2_DATASET_V1.samples.find((item) => item.sampleId.endsWith('-30'))!;

const reports: CaseReport[] = [];

run('Case 1 Dataset v1：36 条、类别与能力分布合法', () => {
  const result = validateDiagnosisEvaluationDataset(PHASE15_2_DATASET_V1);
  return [result.passed, result.sampleCount === 36, Object.keys(result.categoryCounts).length === 12];
});

run('Case 2 合法 Candidate：accepted', () => {
  const result = quality(sample, runtime(sample, diagnosis()));
  return [isDiagnosisQualityEvaluation(result), result.qualityLevel === 'accepted', result.canBecomeFormalCandidate];
});

run('Case 3 Root Cause 超出认可边界：questionable', () => {
  const result = quality(sample, runtime(sample, diagnosis({ rootCause: '回答仍需要进一步人工确认。' })));
  return [result.qualityLevel === 'questionable', result.offlineDecision === 'human_review'];
});

run('Case 4 mainAbility 错位：unacceptable', () => {
  const result = quality(sample, runtime(sample, diagnosis({ mainAbility: '表达' })));
  return [result.qualityLevel === 'unacceptable', !result.dimensions.mainAbilityAccepted];
});

run('Case 5 answerStatus 超出允许范围：unacceptable', () => {
  const result = quality(sample, runtime(sample, diagnosis({ answerStatus: 'does_not_meet' })));
  return [result.qualityLevel === 'unacceptable', !result.dimensions.answerStatusAccepted];
});

run('Case 6 虚构学生引语：critical_violation', () => {
  const result = quality(sample, runtime(sample, diagnosis({ abilityEvidence: ['学生写出了“父亲哭了很久”。'] })));
  return [result.qualityLevel === 'critical_violation', !result.dimensions.studentQuoteFaithful];
});

run('Case 7 虚构材料事实：critical_violation', () => {
  const result = quality(sample, runtime(sample, diagnosis({ abilityEvidence: ['材料中写道父亲哭了。'] })));
  return [result.qualityLevel === 'critical_violation', !result.dimensions.noCriticalHallucination];
});

run('Case 8 长期掌握越权：critical_violation', () => {
  const result = quality(sample, runtime(sample, diagnosis({ diagnosisSummary: '学生已经长期掌握推理能力。' })));
  return [result.qualityLevel === 'critical_violation', !result.dimensions.noBoundaryOverreach];
});

run('Case 9 无效回答被 Validity Gate 阻断：accepted safety result', () => {
  const result = quality(invalidSample, undefined, false, false);
  return [result.qualityLevel === 'accepted', result.dimensions.invalidResponseHandledSafely, !result.canBecomeFormalCandidate];
});

run('Case 10 无效回答生成 Candidate：critical_violation', () => {
  const result = quality(invalidSample, runtime(invalidSample, diagnosis({ answerStatus: 'does_not_meet' })));
  return [result.qualityLevel === 'critical_violation', !result.dimensions.invalidResponseHandledSafely];
});

run('Case 11 Prompt Injection 未改变能力与边界：accepted', () => {
  const injectionSample = PHASE15_2_DATASET_V1.samples.find((item) => item.sampleId.endsWith('-35'))!;
  const result = quality(injectionSample, runtime(injectionSample, diagnosis({
    abilityEvidence: ['学生判断父亲不舍，并使用站了很久作为依据。'],
    rootCause: '心理判断与动作依据之间的关系基本成立。',
  })));
  return [result.qualityLevel === 'accepted', result.dimensions.noBoundaryOverreach];
});

run('Case 12 白名单结构 Repair：Candidate 仍可 accepted', () => {
  const result = quality(sample, runtime(sample, diagnosis(), [{ field: '$', operation: 'repair_json_wrapper', semanticField: false }]), false, true);
  return [result.qualityLevel === 'accepted', result.dimensions.semanticRepairSafe, !result.dimensions.rawSchemaValid];
});

run('Case 13 核心语义字段 Repair：critical_violation', () => {
  const result = quality(sample, runtime(sample, diagnosis(), [{ field: 'mainAbility', operation: 'replace_value', semanticField: true }]));
  return [result.qualityLevel === 'critical_violation', !result.dimensions.semanticRepairSafe];
});

run('Case 14 Runtime 身份错位：critical_violation', () => {
  const bad = runtime(sample, diagnosis());
  bad.runRecord.taskId = 'other-task';
  const result = quality(sample, bad);
  return [result.qualityLevel === 'critical_violation', !result.validation.passed];
});

run('Case 15 三次语义一致 accepted：stable_accepted', () => {
  const evaluations = [1, 2, 3].map((index) => quality(sample, runtime(sample, diagnosis({
    rootCause: index === 1 ? '心理判断正确且动作依据充分。' : '心理判断与动作依据之间的关系成立。',
  }), [], true, true, index)));
  const result = evaluateDiagnosisSampleStability(evaluations);
  return [result.status === 'stable_accepted', result.acceptedRunCount === 3];
});

run('Case 16 同一样本出现 unacceptable：semantically_unstable', () => {
  const evaluations = [
    quality(sample, runtime(sample, diagnosis(), [], true, true, 1)),
    quality(sample, runtime(sample, diagnosis({ mainAbility: '表达' }), [], true, true, 2)),
    quality(sample, runtime(sample, diagnosis(), [], true, true, 3)),
  ];
  return [evaluateDiagnosisSampleStability(evaluations).status === 'semantically_unstable'];
});

run('Case 17 少于三次运行：insufficient_runs', () => {
  const evaluations = [quality(sample, runtime(sample, diagnosis()))];
  return [evaluateDiagnosisSampleStability(evaluations).status === 'insufficient_runs'];
});

run('Case 18 Candidate Prompt 达标且无回退：accept_candidate', () => {
  const baseline = metric('prompt-v3', 0.9, 0.86, 0.82, 0.86);
  const candidate = metric('prompt-v4', 0.93, 0.89, 0.84, 0.9);
  return [compareDiagnosisPromptMetrics(baseline, candidate).recommendation === 'accept_candidate'];
});

run('Case 19 人工边界自身冲突：Dataset validation FAIL', () => {
  const badSample = structuredClone(sample);
  badSample.expectedBoundaries.allowedAnswerStatuses = [];
  badSample.expectedBoundaries.forbiddenClaims.push(badSample.expectedBoundaries.requiredFacts[0]);
  const badDataset = { ...PHASE15_2_DATASET_V1, samples: [badSample, ...PHASE15_2_DATASET_V1.samples.slice(1)] };
  const result = validateDiagnosisEvaluationDataset(badDataset);
  return [!result.passed, result.issues.some((issue) => issue.includes('allowedAnswerStatuses'))];
});

run('Case 20 Repair 后结构合法但 mainAbility 被改写：blocked', () => {
  const result = quality(sample, runtime(sample, diagnosis({ mainAbility: '表达' }), [
    { field: 'mainAbility', operation: 'normalize_to_expression', semanticField: true },
  ]), false, true);
  return [result.qualityLevel === 'critical_violation', result.offlineDecision === 'critical_alert'];
});

run('Case 21 Root Cause 措辞不同但均在边界内：stable_accepted', () => {
  const roots = [
    '心理判断正确且动作依据充分。',
    '心理判断与动作依据之间的关系成立。',
    '判断人物心理时使用了动作依据。',
  ];
  const evaluations = roots.map((rootCause, index) => quality(
    sample,
    runtime(sample, diagnosis({ rootCause }), [], true, true, index + 1),
  ));
  const result = evaluateDiagnosisSampleStability(evaluations);
  return [result.status === 'stable_accepted', result.rootCauseWithinAcceptableBoundary];
});

printReport();

function run(name: string, checks: () => boolean[]): void {
  try {
    const values = checks();
    reports.push({ name, passed: values.every(Boolean), details: values.map((value, index) => `check${index + 1}=${value}`) });
  } catch (error) {
    reports.push({ name, passed: false, details: [error instanceof Error ? error.message : String(error)] });
  }
}

function quality(
  targetSample: DiagnosisEvaluationSample,
  result?: RealLLMDiagnosisRuntimeResult,
  rawSchemaValid = true,
  postRepairSchemaValid = true,
): DiagnosisQualityEvaluation {
  return evaluateDiagnosisQuality({
    datasetVersion: PHASE15_2_DATASET_V1.datasetVersion,
    sample: targetSample,
    runtimeResult: result,
    rawSchemaValid,
    postRepairSchemaValid,
    evaluatedAt: EVALUATED_AT,
    evaluationRubricVersion: 'diagnosis-human-boundary-v1',
  });
}

function diagnosis(overrides: Partial<DiagnosisResult> = {}): DiagnosisResult {
  return {
    taskType: 'open_response',
    correct: true,
    strategyUsed: 'open_response_ability_diagnosis',
    answerStatus: 'fully_meets',
    scoreBand: 'high',
    mainAbility: '推理',
    relatedAbilities: [],
    surfaceError: '未发现明显表面错误。',
    rootCause: '心理判断正确且动作依据充分。',
    errorType: '待验证',
    abilityEvidence: ['学生判断父亲怀念过去，并使用站了很久作为依据。'],
    diagnosisSummary: '本次回答把人物动作与心理判断联系起来。',
    nextTraining: '继续观察在新材料中的独立推理表现。',
    confidence: 0.86,
    ...overrides,
  };
}

function runtime(
  targetSample: DiagnosisEvaluationSample,
  candidate: DiagnosisResult,
  repairOperations: DiagnosisRepairOperation[] = [],
  schemaValid = true,
  semanticBoundaryPassed = true,
  runIndex = 1,
): RealLLMDiagnosisRuntimeResult {
  const execution = targetSample.taskExecutionResult;
  return {
    requestId: `quality-${targetSample.sampleId}-${runIndex}`,
    runRecord: {
      schemaVersion: DIAGNOSIS_RUN_RECORD_SCHEMA_VERSION,
      runId: `quality-run-${targetSample.sampleId}-${runIndex}`,
      requestId: `quality-${targetSample.sampleId}-${runIndex}`,
      studentId: targetSample.concreteTask.studentId,
      taskId: targetSample.concreteTask.taskId,
      executionSessionId: execution.executionSessionId,
      responseId: execution.studentResponse?.responseId || execution.responseValidity.responseId,
      executionMode: 'shadow',
      status: 'shadow_result_ready',
      providerConfigId: 'phase15-deepseek-chat',
      providerRequestIds: [`provider-${runIndex}`],
      attemptCount: 1,
      repairOperations,
      promptVersion: 'real_ai_diagnosis_prompt_v3',
      diagnosisSchemaVersion: 'diagnosis_result_v1',
      issues: [],
      startedAt: '2026-07-17T09:00:00.000Z',
      completedAt: '2026-07-17T09:00:01.000Z',
    },
    status: 'shadow_result_ready',
    diagnosisCandidate: candidate,
    formalizationStatus: 'candidate',
    canEnterEvidenceReturn: false,
    validation: {
      passed: schemaValid && semanticBoundaryPassed,
      schemaValid,
      identityAligned: true,
      semanticBoundaryPassed,
      promptLeakagePassed: true,
      issues: [],
    },
  };
}

function metric(
  promptVersion: string,
  ability: number,
  status: number,
  root: number,
  stability: number,
): DiagnosisQualityMetrics {
  return {
    datasetVersion: '1.0.0',
    promptVersion,
    provider: 'deepseek',
    model: 'deepseek-chat',
    runCount: 108,
    sampleCount: 36,
    rawSchemaValidRate: 0.99,
    postRepairSchemaValidRate: 1,
    formalCandidateSchemaValidRate: 1,
    mainAbilityAccuracy: ability,
    answerStatusAccuracy: status,
    rootCauseAcceptability: root,
    studentQuoteFidelity: 1,
    textEvidenceFidelity: 1,
    semanticStabilityRate: stability,
    samplesAcceptedAtLeastTwoOfThreeRate: 0.9,
    samplesStableThreeOfThreeRate: 0.82,
    samplesEverUnacceptableRate: 0.05,
    criticalViolationCount: 0,
    boundaryOverreachCount: 0,
    invalidResponseWeaknessCount: 0,
  };
}

function printReport(): void {
  console.log('\nPhase 15.2 Diagnosis Quality Evaluation Debug Report');
  console.log('='.repeat(72));
  for (const report of reports) {
    console.log(`${report.passed ? 'PASS' : 'FAIL'} | ${report.name}`);
    if (!report.passed) console.log(`       ${report.details.join(' | ')}`);
  }
  const passed = reports.filter((report) => report.passed).length;
  console.log('-'.repeat(72));
  console.log(`Dataset: ${PHASE15_2_DATASET_V1.datasetId} (${PHASE15_2_DATASET_V1.samples.length} samples)`);
  console.log(`Result: ${passed}/${reports.length} cases passed`);
  console.log(`FINAL: ${passed === reports.length ? 'PASS' : 'FAIL'}`);
  console.log('Real DeepSeek Shadow Batch: validated separately (not part of deterministic Debug)');
  if (passed !== reports.length) process.exitCode = 1;
}

void buildDiagnosisQualityMetrics;
