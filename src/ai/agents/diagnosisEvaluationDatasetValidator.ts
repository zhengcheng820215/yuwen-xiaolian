import { isConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import {
  DIAGNOSIS_EVALUATION_DATASET_SCHEMA_VERSION,
  type DiagnosisDatasetValidationResult,
  type DiagnosisEvaluationDataset,
  type DiagnosisEvaluationSample,
} from '../schemas/diagnosisQualityEvaluation.schema.ts';
import { isTaskExecutionResult } from '../schemas/taskExecution.schema.ts';

const REQUIRED_CATEGORIES = [
  'full_high_quality',
  'correct_insufficient_basis',
  'correct_judgement_wrong_explanation',
  'detail_correct_judgement_wrong',
  'partially_correct',
  'concise_valid',
  'reasonable_alternative',
  'colloquial_expression',
  'irrelevant',
  'copied_prompt_or_material',
  'unknown_placeholder',
  'prompt_injection',
] as const;

const REQUIRED_ABILITIES = ['推理', '理解', '概括', '表达'];

export function validateDiagnosisEvaluationDataset(
  dataset: DiagnosisEvaluationDataset,
): DiagnosisDatasetValidationResult {
  const issues: string[] = [];
  const categoryCounts: Record<string, number> = {};
  const abilityCounts: Record<string, number> = {};

  if (dataset.schemaVersion !== DIAGNOSIS_EVALUATION_DATASET_SCHEMA_VERSION) {
    issues.push('Dataset schemaVersion is unsupported.');
  }
  if (dataset.samples.length < 30 || dataset.samples.length > 50) {
    issues.push('Dataset v1 must contain 30 to 50 samples.');
  }
  if (dataset.sampleIds.length !== dataset.samples.length) {
    issues.push('sampleIds count must equal samples count.');
  }

  const uniqueIds = new Set<string>();
  for (const sample of dataset.samples) {
    categoryCounts[sample.category] = (categoryCounts[sample.category] || 0) + 1;
    abilityCounts[sample.targetAbilityId] = (abilityCounts[sample.targetAbilityId] || 0) + 1;
    if (uniqueIds.has(sample.sampleId)) issues.push(`Duplicate sampleId: ${sample.sampleId}.`);
    uniqueIds.add(sample.sampleId);
    issues.push(...validateSample(sample));
  }

  if (new Set(dataset.sampleIds).size !== dataset.sampleIds.length) {
    issues.push('sampleIds contains duplicates.');
  }
  if (dataset.sampleIds.some((id) => !uniqueIds.has(id))) {
    issues.push('sampleIds contains an ID not present in samples.');
  }
  for (const category of REQUIRED_CATEGORIES) {
    if (!categoryCounts[category]) issues.push(`Missing required category: ${category}.`);
  }
  for (const ability of REQUIRED_ABILITIES) {
    if (!abilityCounts[ability]) issues.push(`Missing required ability: ${ability}.`);
  }

  return {
    datasetId: dataset.datasetId,
    datasetVersion: dataset.datasetVersion,
    passed: issues.length === 0,
    sampleCount: dataset.samples.length,
    categoryCounts,
    abilityCounts,
    issues,
  };
}

function validateSample(sample: DiagnosisEvaluationSample): string[] {
  const issues: string[] = [];
  const prefix = `${sample.sampleId}: `;
  if (!sample.deidentified) issues.push(`${prefix}sample must be deidentified.`);
  if (!isConcreteLearningTask(sample.concreteTask)) issues.push(`${prefix}ConcreteLearningTask is invalid.`);
  if (!isTaskExecutionResult(sample.taskExecutionResult)) issues.push(`${prefix}TaskExecutionResult is invalid.`);
  if (sample.targetAbilityId !== sample.concreteTask.targetAbilityId) {
    issues.push(`${prefix}target ability does not match task.`);
  }
  if (sample.taskExecutionResult.taskId !== sample.concreteTask.taskId ||
      sample.taskExecutionResult.studentId !== sample.concreteTask.studentId) {
    issues.push(`${prefix}task or student identity is mismatched.`);
  }
  if (sample.validityExpectation === 'should_be_blocked_by_validity_gate' &&
      sample.taskExecutionResult.canEnterDiagnosisRuntime) {
    issues.push(`${prefix}invalid response is allowed to enter Diagnosis Runtime.`);
  }
  if (sample.validityExpectation !== 'should_be_blocked_by_validity_gate' &&
      !sample.taskExecutionResult.canEnterDiagnosisRuntime) {
    issues.push(`${prefix}diagnosable response is blocked by validity gate.`);
  }

  const boundaries = sample.expectedBoundaries;
  if (boundaries.allowedMainAbilities.length === 0) issues.push(`${prefix}allowedMainAbilities is empty.`);
  if (boundaries.allowedAnswerStatuses.length === 0) issues.push(`${prefix}allowedAnswerStatuses is empty.`);
  if (boundaries.acceptableRootCausePatterns.length === 0) {
    issues.push(`${prefix}acceptableRootCausePatterns is empty.`);
  }
  if (boundaries.reviewerAgreement === 'disagreed') {
    issues.push(`${prefix}human annotation is not agreed.`);
  }
  const forbidden = new Set(boundaries.forbiddenClaims.map(normalize));
  for (const fact of boundaries.requiredFacts) {
    if (forbidden.has(normalize(fact))) {
      issues.push(`${prefix}requiredFacts conflicts with forbiddenClaims: ${fact}.`);
    }
  }
  return issues;
}

function normalize(value: string): string {
  return value.replace(/[\s，。！？；：“”‘’、,.!?;:'"-]/g, '').toLowerCase();
}
