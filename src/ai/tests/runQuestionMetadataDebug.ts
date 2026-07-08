import { generateQuestionMetadata } from '../../api/questionMetadata.ts';
import type { QuestionMetadataAgentResult } from '../schemas/questionMetadata.schema.ts';
import { questionMetadataSamples } from './questionMetadata.samples.ts';

type MetadataDebugReport = {
  id: string;
  title: string;
  status: 'PASS' | 'FAIL';
  failures: string[];
  questionType: string;
  assessmentMode: string;
  mainAbility: string;
  rubric: string[];
  valid: boolean;
};

async function runQuestionMetadataDebug(): Promise<void> {
  const reports: MetadataDebugReport[] = [];

  for (const sample of questionMetadataSamples) {
    const failures: string[] = [];
    const result = await generateQuestionMetadata({
      question: sample.question,
      referenceAnswer: sample.referenceAnswer,
    });

    assertMetadataResult(result, failures);

    const { metadata, validation } = result;

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

    reports.push({
      id: sample.id,
      title: sample.title,
      status: failures.length === 0 ? 'PASS' : 'FAIL',
      failures,
      questionType: metadata.questionType,
      assessmentMode: metadata.assessmentMode,
      mainAbility: metadata.mainAbility,
      rubric: rubricNames,
      valid: validation.valid,
    });
  }

  printDebugReport(reports);

  if (reports.some((report) => report.status === 'FAIL')) {
    throw new Error('Question Metadata debug check failed.');
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

function printDebugReport(reports: MetadataDebugReport[]): void {
  const passCount = reports.filter((report) => report.status === 'PASS').length;
  const failCount = reports.length - passCount;

  console.log('\nQuestion Metadata Debug Report');
  console.log('==============================');
  console.log(`Total: ${reports.length}, PASS: ${passCount}, FAIL: ${failCount}`);

  for (const report of reports) {
    console.log(`\n[${report.status}] ${report.id} - ${report.title}`);
    console.log(`questionType: ${report.questionType}`);
    console.log(`assessmentMode: ${report.assessmentMode}`);
    console.log(`mainAbility: ${report.mainAbility}`);
    console.log(`valid: ${report.valid}`);
    console.log(`rubric: ${report.rubric.join(' / ')}`);

    if (report.failures.length > 0) {
      console.log('failures:');
      for (const failure of report.failures) {
        console.log(`- ${failure}`);
      }
    }
  }
}

runQuestionMetadataDebug().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
