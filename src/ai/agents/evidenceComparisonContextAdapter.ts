import { isAbilityEvidence, type AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import { isConcreteLearningTask, type ConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import {
  isEvidenceComparisonContext,
  type EvidenceComparisonContext,
} from '../schemas/evidenceConflictAssessment.schema.ts';
import {
  isEvidenceQualityAssessment,
  type EvidenceQualityAssessment,
} from '../schemas/evidenceQualityAssessment.schema.ts';
import { isTaskExecutionResult, type TaskExecutionResult } from '../schemas/taskExecution.schema.ts';

const DEFAULT_WINDOW_MINUTES = 30;

export type EvidenceComparisonContextInput = {
  studentId: string;
  targetAbilityId: string;
  abilityEvidence: AbilityEvidence;
  qualityAssessment: EvidenceQualityAssessment;
  concreteLearningTask: ConcreteLearningTask;
  taskExecutionResult: TaskExecutionResult;
  previousContexts?: EvidenceComparisonContext[];
  observationWindowMinutes?: number;
};

export function buildEvidenceComparisonContext(
  input: EvidenceComparisonContextInput,
): EvidenceComparisonContext {
  const evidence = input.abilityEvidence;
  const assessment = input.qualityAssessment;
  const task = input.concreteLearningTask;
  const execution = input.taskExecutionResult;
  const responseId = execution?.studentResponse?.responseId || assessment?.sourceLinks?.responseId || 'unknown-response';
  const observedAt = isTimestamp(evidence?.createdAt) ? evidence.createdAt : '1970-01-01T00:00:00.000Z';
  const windowMinutes = isPositiveInteger(input.observationWindowMinutes)
    ? input.observationWindowMinutes
    : DEFAULT_WINDOW_MINUTES;
  const observationWindowId = buildObservationWindowId(observedAt, windowMinutes);
  const materialIdentity = buildMaterialIdentity(task);
  const issues = validateInput(input, materialIdentity);
  const repeatedExecutionOf = findRepeatedExecution({
    input,
    materialIdentity,
    observationWindowId,
  });
  const comparisonContextId = buildStableId('comparison-context', [
    assessment?.observationUnitId || 'unknown-observation',
    task?.taskId || 'unknown-task',
    execution?.executionSessionId || 'unknown-execution',
    responseId,
    materialIdentity,
    observationWindowId,
    assessment?.facts?.taskRole || 'unknown-role',
    assessment?.facts?.taskNovelty || 'unknown-novelty',
    assessment?.facts?.timingType || 'unknown-timing',
    assessment?.facts?.difficultyRelation || 'unknown-difficulty',
    assessment?.facts?.hintDependency || 'unknown-hint',
  ]);

  const result: EvidenceComparisonContext = {
    comparisonContextId,
    observationUnitId: assessment?.observationUnitId || 'unknown-observation',
    studentId: input.studentId || evidence?.studentId || 'unknown-student',
    abilityId: input.targetAbilityId || evidence?.ability || 'unknown-ability',
    taskId: task?.taskId || evidence?.taskId || 'unknown-task',
    executionSessionId: execution?.executionSessionId || 'unknown-execution',
    responseId,
    materialIdentity,
    taskRole: assessment?.facts?.taskRole || task?.taskRole || 'observation',
    taskNovelty: assessment?.facts?.taskNovelty || 'unknown',
    timingType: assessment?.facts?.timingType || 'unknown',
    difficultyRelation: assessment?.facts?.difficultyRelation || 'unknown',
    hintDependency: assessment?.facts?.hintDependency || 'unknown',
    observedAt,
    observationWindowId,
    repeatedExecutionOf,
    source: 'formal_runtime_adapter',
    validation: {
      passed: issues.length === 0,
      issues,
    },
  };

  if (isEvidenceComparisonContext(result)) return result;

  return {
    ...result,
    validation: {
      passed: false,
      issues: uniqueStrings([...issues, 'EvidenceComparisonContext schema validation failed.']),
    },
  };
}

function validateInput(input: EvidenceComparisonContextInput, materialIdentity: string): string[] {
  const issues: string[] = [];
  const evidence = input.abilityEvidence;
  const assessment = input.qualityAssessment;
  const task = input.concreteLearningTask;
  const execution = input.taskExecutionResult;
  const response = execution?.studentResponse;

  if (!isAbilityEvidence(evidence)) issues.push('AbilityEvidence schema validation failed.');
  if (!isEvidenceQualityAssessment(assessment)) issues.push('EvidenceQualityAssessment schema validation failed.');
  if (!isConcreteLearningTask(task)) issues.push('ConcreteLearningTask schema validation failed.');
  if (!isTaskExecutionResult(execution)) issues.push('TaskExecutionResult schema validation failed.');
  if (evidence?.studentId !== input.studentId) issues.push('AbilityEvidence studentId mismatch.');
  if (assessment?.studentId !== input.studentId) issues.push('Quality Assessment studentId mismatch.');
  if (task?.studentId !== input.studentId) issues.push('ConcreteLearningTask studentId mismatch.');
  if (execution?.studentId !== input.studentId) issues.push('TaskExecutionResult studentId mismatch.');
  if (evidence?.ability !== input.targetAbilityId) issues.push('AbilityEvidence ability mismatch.');
  if (assessment?.abilityId !== input.targetAbilityId) issues.push('Quality Assessment ability mismatch.');
  if (task?.targetAbilityId !== input.targetAbilityId) issues.push('ConcreteLearningTask ability mismatch.');
  if (assessment?.evidenceId !== evidence?.id) issues.push('Quality Assessment evidenceId mismatch.');
  if (assessment?.evidenceType !== evidence?.evidenceType) issues.push('Quality Assessment evidenceType mismatch.');
  if (assessment?.sourceLinks?.taskId !== task?.taskId) issues.push('Quality Assessment taskId mismatch.');
  if (execution?.taskId !== task?.taskId) issues.push('TaskExecutionResult taskId mismatch.');
  if (assessment?.sourceLinks?.executionSessionId !== execution?.executionSessionId) {
    issues.push('Quality Assessment executionSessionId mismatch.');
  }
  if (!response || assessment?.sourceLinks?.responseId !== response.responseId) {
    issues.push('Quality Assessment responseId mismatch.');
  }
  if (!assessment?.validation?.passed) issues.push('Quality Assessment validation did not pass.');
  if (!isNonEmptyString(materialIdentity)) issues.push('Material identity could not be derived.');
  return uniqueStrings(issues);
}

function buildMaterialIdentity(task: ConcreteLearningTask): string {
  const material = normalizeText(task?.readingText || task?.question || '');
  return material.length > 0
    ? buildStableId('material', [material])
    : 'unknown-material';
}

function findRepeatedExecution(input: {
  input: EvidenceComparisonContextInput;
  materialIdentity: string;
  observationWindowId: string;
}): string | undefined {
  const assessment = input.input.qualityAssessment;
  const task = input.input.concreteLearningTask;
  const previous = (input.input.previousContexts || [])
    .filter((context) => context.validation.passed)
    .sort((left, right) => left.comparisonContextId.localeCompare(right.comparisonContextId));
  const repeated = previous.find((context) => (
    context.studentId === input.input.studentId &&
    context.abilityId === input.input.targetAbilityId &&
    context.observationUnitId !== assessment.observationUnitId &&
    (
      context.taskId === task.taskId ||
      (
        context.materialIdentity === input.materialIdentity &&
        context.observationWindowId === input.observationWindowId &&
        context.taskRole === assessment.facts.taskRole &&
        context.hintDependency === assessment.facts.hintDependency
      )
    )
  ));
  return repeated?.comparisonContextId;
}

function buildObservationWindowId(timestamp: string, windowMinutes: number): string {
  const windowMs = windowMinutes * 60 * 1000;
  const start = Math.floor(Date.parse(timestamp) / windowMs) * windowMs;
  return `window-${windowMinutes}m-${new Date(start).toISOString()}`;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function buildStableId(prefix: string, parts: string[]): string {
  const text = parts.join('|');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
