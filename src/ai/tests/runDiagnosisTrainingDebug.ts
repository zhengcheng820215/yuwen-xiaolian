import { diagnosis } from '../../api/diagnosis.ts';
import { training } from '../../api/training.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type { TrainingResult } from '../schemas/training.schema.ts';
import { diagnosisTrainingSamples } from './diagnosisTraining.samples.ts';

type DebugCaseReport = {
  id: string;
  title: string;
  status: 'PASS' | 'FAIL';
  failures: string[];
  mainAbility: string;
  rootCause: string;
  trainingGoal: string;
  nextEvaluation: string;
};

const diagnosisRequiredFields: Array<keyof DiagnosisResult> = [
  'mainAbility',
  'rootCause',
  'abilityEvidence',
  'diagnosisSummary',
  'nextTraining',
  'confidence',
];

const trainingRequiredFields: Array<keyof TrainingResult> = [
  'targetAbility',
  'rootCause',
  'trainingGoal',
  'trainingStrategy',
  'trainingSteps',
  'practiceTasks',
  'completionCriteria',
  'nextEvaluation',
  'confidence',
];

async function runDiagnosisTrainingDebug(): Promise<void> {
  const reports: DebugCaseReport[] = [];

  for (const sample of diagnosisTrainingSamples) {
    const failures: string[] = [];
    const diagnosisResult = await diagnosis({
      question: sample.question,
      referenceAnswer: sample.referenceAnswer,
      studentAnswer: sample.studentAnswer,
      questionMetadata: sample.questionMetadata,
    });
    const trainingResult = await training({
      diagnosisResult,
      question: sample.question,
      studentAnswer: sample.studentAnswer,
    });

    assertRequiredFields('Diagnosis Result', diagnosisResult, diagnosisRequiredFields, failures);
    assertRequiredFields('Training Result', trainingResult, trainingRequiredFields, failures);
    assertConfidence('Diagnosis Result', diagnosisResult.confidence, failures);
    assertConfidence('Training Result', trainingResult.confidence, failures);

    if (diagnosisResult.mainAbility !== sample.expectedMainAbility) {
      failures.push(
        `Diagnosis mainAbility expected "${sample.expectedMainAbility}", got "${diagnosisResult.mainAbility}".`,
      );
    }

    if (
      typeof sample.expectedCorrect === 'boolean' &&
      diagnosisResult.correct !== sample.expectedCorrect
    ) {
      failures.push(
        `Diagnosis correct expected "${sample.expectedCorrect}", got "${diagnosisResult.correct}".`,
      );
    }

    if (
      sample.expectedAnswerStatus &&
      diagnosisResult.answerStatus !== sample.expectedAnswerStatus
    ) {
      failures.push(
        `Diagnosis answerStatus expected "${sample.expectedAnswerStatus}", got "${diagnosisResult.answerStatus}".`,
      );
    }

    if (
      sample.expectedScoreBand &&
      diagnosisResult.scoreBand !== sample.expectedScoreBand
    ) {
      failures.push(
        `Diagnosis scoreBand expected "${sample.expectedScoreBand}", got "${diagnosisResult.scoreBand}".`,
      );
    }

    if (!diagnosisResult.rootCause.includes(sample.expectedRootCauseKeyword)) {
      failures.push(
        `Diagnosis rootCause should include "${sample.expectedRootCauseKeyword}", got "${diagnosisResult.rootCause}".`,
      );
    }

    if (trainingResult.targetAbility !== diagnosisResult.mainAbility) {
      failures.push(
        `Training targetAbility modified upstream mainAbility: diagnosis="${diagnosisResult.mainAbility}", training="${trainingResult.targetAbility}".`,
      );
    }

    if (trainingResult.rootCause !== diagnosisResult.rootCause) {
      failures.push('Training rootCause modified upstream diagnosis rootCause.');
    }

    const trainingPayload = [
      trainingResult.trainingGoal,
      trainingResult.trainingStrategy,
      trainingResult.nextEvaluation,
      ...trainingResult.trainingSteps,
      ...trainingResult.practiceTasks,
      ...trainingResult.completionCriteria,
    ].join('\n');

    if (
      !trainingPayload.includes(diagnosisResult.mainAbility) &&
      !trainingPayload.includes(diagnosisResult.rootCause)
    ) {
      failures.push('Training plan is not aligned with diagnosis mainAbility or rootCause.');
    }

    if (!trainingPayload.includes(sample.expectedTrainingKeyword)) {
      failures.push(
        `Training plan should include "${sample.expectedTrainingKeyword}" for this sample.`,
      );
    }

    reports.push({
      id: sample.id,
      title: sample.title,
      status: failures.length === 0 ? 'PASS' : 'FAIL',
      failures,
      mainAbility: diagnosisResult.mainAbility,
      rootCause: diagnosisResult.rootCause,
      trainingGoal: trainingResult.trainingGoal,
      nextEvaluation: trainingResult.nextEvaluation,
    });
  }

  printDebugReport(reports);

  if (reports.some((report) => report.status === 'FAIL')) {
    throw new Error('Diagnosis -> Training debug check failed.');
  }
}

function assertRequiredFields<T extends Record<string, unknown>>(
  label: string,
  value: T,
  fields: Array<keyof T>,
  failures: string[],
): void {
  for (const field of fields) {
    const fieldValue = value[field];
    const isEmptyArray = Array.isArray(fieldValue) && fieldValue.length === 0;
    const isEmptyString = typeof fieldValue === 'string' && fieldValue.trim().length === 0;

    if (fieldValue === undefined || fieldValue === null || isEmptyArray || isEmptyString) {
      failures.push(`${label} missing consumable field "${String(field)}".`);
    }
  }
}

function assertConfidence(label: string, confidence: unknown, failures: string[]): void {
  if (typeof confidence !== 'number' || Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
    failures.push(`${label} confidence must be a number between 0 and 1.`);
  }
}

function printDebugReport(reports: DebugCaseReport[]): void {
  const passCount = reports.filter((report) => report.status === 'PASS').length;
  const failCount = reports.length - passCount;

  console.log('\nDiagnosis -> Training Debug Report');
  console.log('==================================');
  console.log(`Total: ${reports.length}, PASS: ${passCount}, FAIL: ${failCount}`);

  for (const report of reports) {
    console.log(`\n[${report.status}] ${report.id} - ${report.title}`);
    console.log(`mainAbility: ${report.mainAbility}`);
    console.log(`rootCause: ${report.rootCause}`);
    console.log(`trainingGoal: ${report.trainingGoal}`);
    console.log(`nextEvaluation: ${report.nextEvaluation}`);

    if (report.failures.length > 0) {
      console.log('failures:');
      for (const failure of report.failures) {
        console.log(`- ${failure}`);
      }
    }
  }
}

runDiagnosisTrainingDebug().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
