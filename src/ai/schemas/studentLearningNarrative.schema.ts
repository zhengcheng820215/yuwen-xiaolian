import type { TaskRequirementGapReasonCode } from './studentLearningFeedback.schema.ts';

export const STUDENT_LEARNING_NARRATIVE_SCHEMA_VERSION = 'student_learning_narrative_projection_v1' as const;

export type StudentLearningNarrativeScope =
  | 'current_task'
  | 'current_response'
  | 'cross_session'
  | 'next_strategy';

export type StudentLearningNarrativeSourceType =
  | 'formal_task'
  | 'student_response'
  | 'task_requirement_coverage'
  | 'learning_gap'
  | 'student_feedback'
  | 'evidence_quality'
  | 'growth_memory'
  | 'next_learning_strategy'
  | 'next_task_resolution'
  | 'delayed_retest_plan';

export type StudentLearningNarrativeStatement = {
  text: string;
  scope: StudentLearningNarrativeScope;
  sourceType: StudentLearningNarrativeSourceType;
  sourceLinks: string[];
};

export type StudentLearningNarrative = {
  taskReason?: string;
  responseAnchor?: string;
  achieved?: string;
  currentGap?: string;
  currentGapMode?: StudentLearningNarrativeGapMode;
  currentGapReasonCode?: TaskRequirementGapReasonCode;
  nextAction?: string;
  progressMeaning?: string;
  nextTaskReason?: string;
};

export type StudentLearningNarrativeGapMode =
  | 'needs_adjustment'
  | 'needs_completion'
  | 'insufficient_to_judge';

export type StudentLearningPresentation = {
  taskReason?: string;
  outcome?: {
    responseAnchor?: string;
    achieved?: string;
    primaryGap?: string;
    primaryGapMode?: StudentLearningNarrativeGapMode;
    primaryGapReasonCode?: TaskRequirementGapReasonCode;
    progressMeaning?: string;
  };
  nextAction?: string;
  continuationReason?: string;
};

export type StudentLearningPresentationContext = {
  continuationMode?: 'adaptive' | 'fixed_task_queue';
};

export type StudentLearningNarrativeProjection = {
  schemaVersion: typeof STUDENT_LEARNING_NARRATIVE_SCHEMA_VERSION;
  studentId: string;
  taskReason?: StudentLearningNarrativeStatement;
  responseAnchor?: StudentLearningNarrativeStatement;
  achieved?: StudentLearningNarrativeStatement;
  currentGap?: StudentLearningNarrativeStatement;
  currentGapMode?: StudentLearningNarrativeGapMode;
  currentGapReasonCode?: TaskRequirementGapReasonCode;
  nextAction?: StudentLearningNarrativeStatement;
  progressMeaning?: StudentLearningNarrativeStatement;
  nextTaskReason?: StudentLearningNarrativeStatement;
  validation: {
    passed: boolean;
    identityAligned: boolean;
    allStatementsTraceable: boolean;
    progressComparisonEligible: boolean;
    noInternalLanguage: boolean;
    issues: string[];
  };
};

export function toStudentLearningNarrative(
  projection: StudentLearningNarrativeProjection,
): StudentLearningNarrative | undefined {
  if (!projection.validation.passed) return undefined;
  const narrative: StudentLearningNarrative = {
    taskReason: projection.taskReason?.text,
    responseAnchor: projection.responseAnchor?.text,
    achieved: projection.achieved?.text,
    currentGap: projection.currentGap?.text,
    currentGapMode: projection.currentGapMode,
    currentGapReasonCode: projection.currentGapReasonCode,
    nextAction: projection.nextAction?.text,
    progressMeaning: projection.progressMeaning?.text,
    nextTaskReason: projection.nextTaskReason?.text,
  };
  return Object.values(narrative).some(Boolean) ? narrative : undefined;
}

export function toStudentLearningPresentation(
  projection: StudentLearningNarrativeProjection,
  context: StudentLearningPresentationContext = {},
): StudentLearningPresentation | undefined {
  const narrative = toStudentLearningNarrative(projection);
  if (!narrative) return undefined;
  const outcome = {
    responseAnchor: narrative.responseAnchor,
    achieved: narrative.achieved,
    primaryGap: narrative.currentGap,
    primaryGapMode: narrative.currentGapMode,
    primaryGapReasonCode: narrative.currentGapReasonCode,
    progressMeaning: narrative.progressMeaning,
  };
  const presentation: StudentLearningPresentation = {
    taskReason: narrative.taskReason,
    outcome: Object.values(outcome).some(Boolean) ? outcome : undefined,
    nextAction: narrative.nextAction,
    continuationReason: context.continuationMode === 'fixed_task_queue'
      ? undefined
      : narrative.nextTaskReason,
  };
  return isStudentLearningPresentation(presentation) ? presentation : undefined;
}

export function isStudentLearningNarrative(value: unknown): value is StudentLearningNarrative {
  if (!value || typeof value !== 'object') return false;
  const narrative = value as StudentLearningNarrative;
  return [
    narrative.taskReason,
    narrative.responseAnchor,
    narrative.achieved,
    narrative.currentGap,
    narrative.nextAction,
    narrative.progressMeaning,
    narrative.nextTaskReason,
  ].every((item) => item === undefined || nonEmpty(item)) &&
    (narrative.currentGapMode === undefined || isGapMode(narrative.currentGapMode)) &&
    (narrative.currentGapReasonCode === undefined || isGapReasonCode(narrative.currentGapReasonCode));
}

export function isStudentLearningPresentation(value: unknown): value is StudentLearningPresentation {
  if (!value || typeof value !== 'object') return false;
  const presentation = value as StudentLearningPresentation;
  const outcome = presentation.outcome;
  const outcomeValid = outcome === undefined || (
    Boolean(outcome) &&
    [outcome.responseAnchor, outcome.achieved, outcome.primaryGap, outcome.progressMeaning]
      .every((item) => item === undefined || nonEmpty(item)) &&
    (outcome.primaryGapMode === undefined || isGapMode(outcome.primaryGapMode)) &&
    (outcome.primaryGapReasonCode === undefined || isGapReasonCode(outcome.primaryGapReasonCode)) &&
    [outcome.responseAnchor, outcome.achieved, outcome.primaryGap, outcome.progressMeaning].some(nonEmpty)
  );
  return outcomeValid && [
    presentation.taskReason,
    presentation.nextAction,
    presentation.continuationReason,
  ].every((item) => item === undefined || nonEmpty(item)) && (
    nonEmpty(presentation.taskReason) ||
    nonEmpty(presentation.nextAction) ||
    nonEmpty(presentation.continuationReason) ||
    outcome !== undefined
  );
}

export function isStudentLearningNarrativeProjection(
  value: unknown,
): value is StudentLearningNarrativeProjection {
  if (!value || typeof value !== 'object') return false;
  const projection = value as StudentLearningNarrativeProjection;
  return projection.schemaVersion === STUDENT_LEARNING_NARRATIVE_SCHEMA_VERSION &&
    nonEmpty(projection.studentId) &&
    [
      projection.taskReason,
      projection.responseAnchor,
      projection.achieved,
      projection.currentGap,
      projection.nextAction,
      projection.progressMeaning,
      projection.nextTaskReason,
    ].every((item) => item === undefined || isStatement(item)) &&
    (projection.currentGapMode === undefined || isGapMode(projection.currentGapMode)) &&
    (projection.currentGapReasonCode === undefined || isGapReasonCode(projection.currentGapReasonCode)) &&
    typeof projection.validation?.passed === 'boolean' &&
    typeof projection.validation?.identityAligned === 'boolean' &&
    typeof projection.validation?.allStatementsTraceable === 'boolean' &&
    typeof projection.validation?.progressComparisonEligible === 'boolean' &&
    typeof projection.validation?.noInternalLanguage === 'boolean' &&
    Array.isArray(projection.validation?.issues);
}

function isStatement(value: unknown): value is StudentLearningNarrativeStatement {
  if (!value || typeof value !== 'object') return false;
  const statement = value as StudentLearningNarrativeStatement;
  return nonEmpty(statement.text) &&
    ['current_task', 'current_response', 'cross_session', 'next_strategy'].includes(statement.scope) &&
    [
      'formal_task',
      'student_response',
      'task_requirement_coverage',
      'learning_gap',
      'student_feedback',
      'evidence_quality',
      'growth_memory',
      'next_learning_strategy',
      'next_task_resolution',
      'delayed_retest_plan',
    ].includes(statement.sourceType) &&
    Array.isArray(statement.sourceLinks) &&
    statement.sourceLinks.length > 0 &&
    statement.sourceLinks.every(nonEmpty);
}

function isGapMode(value: unknown): value is StudentLearningNarrativeGapMode {
  return ['needs_adjustment', 'needs_completion', 'insufficient_to_judge'].includes(String(value));
}

function isGapReasonCode(value: unknown): value is TaskRequirementGapReasonCode {
  return [
    'conclusion_inconsistent',
    'missing_text_evidence',
    'missing_reasoning_relation',
    'incomplete_task_requirement',
    'insufficient_to_judge',
  ].includes(String(value));
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
