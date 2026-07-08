import { generateQuestionMetadata } from '../../api/questionMetadata.ts';
import { runDiagnosisAgent } from '../agents/diagnosisAgent.ts';
import type { QuestionMetadataAgentResult } from '../schemas/questionMetadata.schema.ts';
import { questionMetadataSamples } from './questionMetadata.samples.ts';

const LOW_CONFIDENCE_THRESHOLD = 0.75;
const ACCEPTANCE_THRESHOLDS = {
  overallPassRate: 0.9,
  typePassRate: 0.85,
  validatorFailCount: 0,
  crashCount: 0,
  metadataMissingFieldCount: 0,
} as const;

type MetadataDebugReport = {
  id: string;
  title: string;
  status: 'PASS' | 'FAIL';
  failures: string[];
  metadataMissingFields: string[];
  crashed: boolean;
  crashMessage?: string;
  expectedPattern: string;
  expectedQuestionType: string;
  expectedAssessmentMode: string;
  expectedMainAbility: string;
  questionType: string;
  assessmentMode: string;
  mainAbility: string;
  rubric: string[];
  valid: boolean;
  confidence: number;
  matchedPattern: string;
  diagnosisReachable: boolean;
};

type QualityMetrics = {
  total: number;
  passCount: number;
  failCount: number;
  passRate: number;
  lowConfidenceCount: number;
  validatorFailCount: number;
  questionTypeErrorCount: number;
  assessmentModeErrorCount: number;
  mainAbilityErrorCount: number;
  patternErrorCount: number;
  diagnosisUnreachableCount: number;
  crashCount: number;
  metadataMissingFieldCount: number;
  typeSummaries: Array<{
    questionType: string;
    total: number;
    pass: number;
    fail: number;
    passRate: number;
  }>;
};

type AcceptanceCheck = {
  name: string;
  required: string;
  actual: string;
  passed: boolean;
};

async function runQuestionMetadataDebug(): Promise<void> {
  const reports: MetadataDebugReport[] = [];

  for (const sample of questionMetadataSamples) {
    const failures: string[] = [];
    let result: QuestionMetadataAgentResult | null = null;
    let crashed = false;
    let crashMessage: string | undefined;

    try {
      result = await generateQuestionMetadata({
        question: sample.question,
        referenceAnswer: sample.referenceAnswer,
      });
    } catch (error) {
      crashed = true;
      crashMessage = error instanceof Error ? error.message : String(error);
      failures.push(`metadata generation crashed: ${crashMessage}.`);
    }

    if (!result) {
      reports.push(createCrashReport(sample, failures, crashed, crashMessage));
      continue;
    }

    const metadataMissingFields = getMissingMetadataFields(result);
    failures.push(...metadataMissingFields.map((field) => `metadata missing ${field}.`));
    assertMetadataResult(result, failures);

    const { metadata, validation } = result;

    if (result.matchedPattern !== sample.expectedPattern) {
      failures.push(
        `matchedPattern expected "${sample.expectedPattern}", got "${result.matchedPattern}".`,
      );
    }

    if (metadata.questionType !== sample.expectedQuestionType) {
      failures.push(
        `questionType expected "${sample.expectedQuestionType}", got "${metadata.questionType}".`,
      );
    }

    if (metadata.assessmentMode !== sample.expectedAssessmentMode) {
      failures.push(
        `assessmentMode expected "${sample.expectedAssessmentMode}", got "${metadata.assessmentMode}".`,
      );
    }

    if (metadata.mainAbility !== sample.expectedMainAbility) {
      failures.push(
        `mainAbility expected "${sample.expectedMainAbility}", got "${metadata.mainAbility}".`,
      );
    }

    if (!validation.valid) {
      failures.push(`validation should be valid, got errors: ${validation.errors.join(' | ')}`);
    }

    const rubricNames = metadata.rubric.map((item) => item.name);
    const rubricPayload = rubricNames.join('\n');

    for (const keyword of sample.expectedRubricKeywords) {
      if (!rubricPayload.includes(keyword)) {
        failures.push(`rubric should include "${keyword}", got "${rubricNames.join(', ')}".`);
      }
    }

    const diagnosisReachable = await canEnterDiagnosis({
      question: sample.question,
      referenceAnswer: sample.referenceAnswer,
      studentAnswer: sample.studentAnswer,
      questionMetadata: metadata,
    }, failures);

    reports.push({
      id: sample.id,
      title: sample.title,
      status: failures.length === 0 ? 'PASS' : 'FAIL',
      failures,
      metadataMissingFields,
      crashed,
      crashMessage,
      expectedPattern: sample.expectedPattern,
      expectedQuestionType: sample.expectedQuestionType,
      expectedAssessmentMode: sample.expectedAssessmentMode,
      expectedMainAbility: sample.expectedMainAbility,
      questionType: metadata.questionType,
      assessmentMode: metadata.assessmentMode,
      mainAbility: metadata.mainAbility,
      rubric: rubricNames,
      valid: validation.valid,
      confidence: result.confidence,
      matchedPattern: result.matchedPattern,
      diagnosisReachable,
    });
  }

  const metrics = createQualityMetrics(reports);
  const acceptanceChecks = createAcceptanceChecks(metrics);

  printDebugReport(reports, metrics, acceptanceChecks);

  if (acceptanceChecks.some((check) => !check.passed)) {
    throw new Error('Question Metadata acceptance gate failed.');
  }
}

function assertMetadataResult(result: QuestionMetadataAgentResult, failures: string[]): void {
  const { metadata, validation, confidence } = result;

  if (!metadata.questionType) failures.push('metadata missing questionType.');
  if (!metadata.assessmentMode) failures.push('metadata missing assessmentMode.');
  if (!metadata.mainAbility) failures.push('metadata missing mainAbility.');
  if (!Array.isArray(metadata.abilityPath) || metadata.abilityPath.length === 0) {
    failures.push('metadata missing abilityPath.');
  }
  if (!Array.isArray(metadata.rubric) || metadata.rubric.length === 0) {
    failures.push('metadata missing rubric.');
  }
  if (!Array.isArray(validation.errors) || !Array.isArray(validation.warnings)) {
    failures.push('validation result must include errors and warnings arrays.');
  }
  if (typeof confidence !== 'number' || Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
    failures.push('confidence must be a number between 0 and 1.');
  }
}

function getMissingMetadataFields(result: QuestionMetadataAgentResult): string[] {
  const { metadata } = result;
  const missingFields: string[] = [];

  if (!metadata.questionType) missingFields.push('questionType');
  if (!metadata.assessmentMode) missingFields.push('assessmentMode');
  if (!metadata.mainAbility) missingFields.push('mainAbility');
  if (!Array.isArray(metadata.abilityPath) || metadata.abilityPath.length === 0) {
    missingFields.push('abilityPath');
  }
  if (!Array.isArray(metadata.rubric) || metadata.rubric.length === 0) {
    missingFields.push('rubric');
  }

  return missingFields;
}

function createCrashReport(
  sample: (typeof questionMetadataSamples)[number],
  failures: string[],
  crashed: boolean,
  crashMessage?: string,
): MetadataDebugReport {
  return {
    id: sample.id,
    title: sample.title,
    status: 'FAIL',
    failures,
    metadataMissingFields: ['metadata'],
    crashed,
    crashMessage,
    expectedPattern: sample.expectedPattern,
    expectedQuestionType: sample.expectedQuestionType,
    expectedAssessmentMode: sample.expectedAssessmentMode,
    expectedMainAbility: sample.expectedMainAbility,
    questionType: '生成失败',
    assessmentMode: '生成失败',
    mainAbility: '生成失败',
    rubric: [],
    valid: false,
    confidence: 0,
    matchedPattern: '生成失败',
    diagnosisReachable: false,
  };
}

async function canEnterDiagnosis(
  input: Parameters<typeof runDiagnosisAgent>[0],
  failures: string[],
): Promise<boolean> {
  try {
    const diagnosisResult = await withConsoleSilenced(() => runDiagnosisAgent(input));

    const requiredFields: Array<keyof typeof diagnosisResult> = [
      'mainAbility',
      'rootCause',
      'abilityEvidence',
      'diagnosisSummary',
      'nextTraining',
      'confidence',
    ];

    for (const field of requiredFields) {
      const value = diagnosisResult[field];
      if (value === undefined || value === null || value === '') {
        failures.push(`diagnosis result missing ${String(field)}.`);
      }
    }

    if (!Array.isArray(diagnosisResult.abilityEvidence)) {
      failures.push('diagnosis result abilityEvidence must be an array.');
    }

    if (
      typeof diagnosisResult.confidence !== 'number' ||
      Number.isNaN(diagnosisResult.confidence) ||
      diagnosisResult.confidence < 0 ||
      diagnosisResult.confidence > 1
    ) {
      failures.push('diagnosis confidence must be a number between 0 and 1.');
    }

    return true;
  } catch (error) {
    failures.push(`diagnosis should be reachable, got error: ${error instanceof Error ? error.message : String(error)}.`);
    return false;
  }
}

async function withConsoleSilenced<T>(callback: () => Promise<T>): Promise<T> {
  const originalLog = console.log;
  console.log = () => undefined;
  try {
    return await callback();
  } finally {
    console.log = originalLog;
  }
}

function printDebugReport(
  reports: MetadataDebugReport[],
  metrics: QualityMetrics,
  acceptanceChecks: AcceptanceCheck[],
): void {
  console.log('\nQuestion Metadata Debug Report');
  console.log('==============================');
  printQualityMetrics(metrics);
  printAcceptanceGate(acceptanceChecks);

  for (const report of reports) {
    console.log(`\n[${report.status}] ${report.id} - ${report.title}`);
    console.log(`matchedPattern: ${report.matchedPattern}`);
    console.log(`expectedPattern: ${report.expectedPattern}`);
    console.log(`expectedQuestionType: ${report.expectedQuestionType}`);
    console.log(`questionType: ${report.questionType}`);
    console.log(`expectedAssessmentMode: ${report.expectedAssessmentMode}`);
    console.log(`assessmentMode: ${report.assessmentMode}`);
    console.log(`expectedMainAbility: ${report.expectedMainAbility}`);
    console.log(`mainAbility: ${report.mainAbility}`);
    console.log(`confidence: ${formatPercent(report.confidence)}`);
    console.log(`valid: ${report.valid}`);
    console.log(`crashed: ${report.crashed}`);
    if (report.crashMessage) console.log(`crashMessage: ${report.crashMessage}`);
    console.log(`metadataMissingFields: ${report.metadataMissingFields.join(', ') || 'none'}`);
    console.log(`diagnosisReachable: ${report.diagnosisReachable}`);
    console.log(`rubric: ${report.rubric.join(' / ')}`);

    if (report.failures.length > 0) {
      console.log('failures:');
      for (const failure of report.failures) {
        console.log(`- ${failure}`);
      }
    }
  }
}

function createQualityMetrics(reports: MetadataDebugReport[]): QualityMetrics {
  const passCount = reports.filter((report) => report.status === 'PASS').length;
  const failCount = reports.length - passCount;
  const typeSummaryMap = new Map<string, { total: number; pass: number }>();

  for (const report of reports) {
    const current = typeSummaryMap.get(report.expectedQuestionType) || { total: 0, pass: 0 };
    current.total += 1;
    if (report.status === 'PASS') current.pass += 1;
    typeSummaryMap.set(report.expectedQuestionType, current);
  }

  return {
    total: reports.length,
    passCount,
    failCount,
    passRate: getRate(passCount, reports.length),
    lowConfidenceCount: reports.filter((report) => report.confidence < LOW_CONFIDENCE_THRESHOLD).length,
    validatorFailCount: reports.filter((report) => !report.valid).length,
    questionTypeErrorCount: reports.filter((report) => report.questionType !== report.expectedQuestionType).length,
    assessmentModeErrorCount: reports.filter((report) => report.assessmentMode !== report.expectedAssessmentMode).length,
    mainAbilityErrorCount: reports.filter((report) => report.mainAbility !== report.expectedMainAbility).length,
    patternErrorCount: reports.filter((report) => report.matchedPattern !== report.expectedPattern).length,
    diagnosisUnreachableCount: reports.filter((report) => !report.diagnosisReachable).length,
    crashCount: reports.filter((report) => report.crashed).length,
    metadataMissingFieldCount: reports.reduce((sum, report) => sum + report.metadataMissingFields.length, 0),
    typeSummaries: [...typeSummaryMap.entries()].map(([questionType, value]) => ({
      questionType,
      total: value.total,
      pass: value.pass,
      fail: value.total - value.pass,
      passRate: getRate(value.pass, value.total),
    })),
  };
}

function printQualityMetrics(metrics: QualityMetrics): void {
  console.log(`Total: ${metrics.total}`);
  console.log(`PASS: ${metrics.passCount}`);
  console.log(`FAIL: ${metrics.failCount}`);
  console.log(`PASS Rate: ${formatPercent(metrics.passRate)}`);
  console.log(`Low Confidence (< ${formatPercent(LOW_CONFIDENCE_THRESHOLD)}): ${metrics.lowConfidenceCount}`);
  console.log(`Validator Fail: ${metrics.validatorFailCount}`);
  console.log(`QuestionType Errors: ${metrics.questionTypeErrorCount}`);
  console.log(`AssessmentMode Errors: ${metrics.assessmentModeErrorCount}`);
  console.log(`MainAbility Errors: ${metrics.mainAbilityErrorCount}`);
  console.log(`Pattern Errors: ${metrics.patternErrorCount}`);
  console.log(`Diagnosis Unreachable: ${metrics.diagnosisUnreachableCount}`);
  console.log(`Crash Count: ${metrics.crashCount}`);
  console.log(`Metadata Missing Fields: ${metrics.metadataMissingFieldCount}`);

  console.log('\nQuestion Type Summary');
  console.log('---------------------');

  for (const value of metrics.typeSummaries) {
    console.log(
      `${value.questionType}: ${value.pass} / ${value.total} ` +
      `(FAIL: ${value.fail}, PASS Rate: ${formatPercent(value.passRate)})`,
    );
  }
}

function createAcceptanceChecks(metrics: QualityMetrics): AcceptanceCheck[] {
  const typeFailures = metrics.typeSummaries.filter(
    (summary) => summary.passRate < ACCEPTANCE_THRESHOLDS.typePassRate,
  );

  return [
    {
      name: 'Overall PASS Rate',
      required: `>= ${formatPercent(ACCEPTANCE_THRESHOLDS.overallPassRate)}`,
      actual: formatPercent(metrics.passRate),
      passed: metrics.passRate >= ACCEPTANCE_THRESHOLDS.overallPassRate,
    },
    {
      name: 'Each Type PASS Rate',
      required: `>= ${formatPercent(ACCEPTANCE_THRESHOLDS.typePassRate)}`,
      actual: typeFailures.length === 0
        ? 'all passed'
        : typeFailures.map((item) => `${item.questionType}: ${formatPercent(item.passRate)}`).join(', '),
      passed: typeFailures.length === 0,
    },
    {
      name: 'Validator Fail',
      required: String(ACCEPTANCE_THRESHOLDS.validatorFailCount),
      actual: String(metrics.validatorFailCount),
      passed: metrics.validatorFailCount === ACCEPTANCE_THRESHOLDS.validatorFailCount,
    },
    {
      name: 'Crash Count',
      required: String(ACCEPTANCE_THRESHOLDS.crashCount),
      actual: String(metrics.crashCount),
      passed: metrics.crashCount === ACCEPTANCE_THRESHOLDS.crashCount,
    },
    {
      name: 'Metadata Missing Fields',
      required: String(ACCEPTANCE_THRESHOLDS.metadataMissingFieldCount),
      actual: String(metrics.metadataMissingFieldCount),
      passed: metrics.metadataMissingFieldCount === ACCEPTANCE_THRESHOLDS.metadataMissingFieldCount,
    },
  ];
}

function printAcceptanceGate(checks: AcceptanceCheck[]): void {
  const passed = checks.every((check) => check.passed);

  console.log('\nAcceptance Gate');
  console.log('---------------');

  for (const check of checks) {
    console.log(
      `[${check.passed ? 'PASS' : 'FAIL'}] ${check.name}: ` +
      `required ${check.required}, actual ${check.actual}`,
    );
  }

  console.log(`Gate Result: ${passed ? 'PASS' : 'FAIL'}`);
}

function getRate(value: number, total: number): number {
  if (total === 0) return 0;
  return value / total;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

runQuestionMetadataDebug().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
