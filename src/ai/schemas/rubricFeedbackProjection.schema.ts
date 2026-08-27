export const RUBRIC_FEEDBACK_PROJECTION_SCHEMA_VERSION =
  'rubric_feedback_projection_v1' as const;

export const STUDENT_VISIBLE_FEEDBACK_GROUNDING_SCHEMA_VERSION =
  'student_visible_feedback_grounding_v1' as const;

export const RUBRIC_FEEDBACK_COVERAGE_STATUSES = [
  'achieved',
  'partially_achieved',
  'missing',
  'not_assessable',
] as const;

export type RubricFeedbackCoverageStatus =
  typeof RUBRIC_FEEDBACK_COVERAGE_STATUSES[number];

export const RUBRIC_FEEDBACK_OBSERVED_GAPS = [
  'conclusion_without_evidence',
  'evidence_without_explanation',
  'partial_required_aspects',
  'scope_misaligned',
  'expression_not_organized',
] as const;

export type RubricFeedbackObservedGap =
  typeof RUBRIC_FEEDBACK_OBSERVED_GAPS[number];

export type RubricFeedbackProjectionSourceLinks = {
  questionVersionId: string;
  rubricVersion?: string;
  diagnosisId?: string;
  responseId?: string;
  requirementId?: string;
  taskId?: string;
  learningRoundId?: string;
  executionSessionId?: string;
};

export type RubricFeedbackProjectionItem = {
  rubricItemId: string;
  requirementId?: string;
  importance: 'critical' | 'important' | 'supporting';
  coverageStatus: RubricFeedbackCoverageStatus;
  studentEvidenceRefs: string[];
  taskRelation: string;
  observedGap?: RubricFeedbackObservedGap;
  nextThinkingAction?: string;
  sourceLinks: RubricFeedbackProjectionSourceLinks;
};

export type RubricFeedbackProjection = {
  projectionVersion: typeof RUBRIC_FEEDBACK_PROJECTION_SCHEMA_VERSION;
  projectionId: string;
  questionVersionId: string;
  rubricVersion?: string;
  primaryItemId?: string;
  items: RubricFeedbackProjectionItem[];
  projectionStatus: 'ready' | 'limited' | 'not_assessable';
};

export type StudentVisibleFeedbackGrounding = {
  groundingVersion: typeof STUDENT_VISIBLE_FEEDBACK_GROUNDING_SCHEMA_VERSION;
  acknowledgedStudentAction?: string;
  primaryObservedGap?: RubricFeedbackObservedGap;
  safeClueLocator?: string;
  nextThinkingAction?: string;
  feedbackDepth: 'result_only' | 'thinking_prompt' | 'scaffold';
  sourceProjectionId: string;
};

const FORBIDDEN_STUDENT_VISIBLE_KEYS = new Set([
  'acceptedSignals',
  'calibrationAnswer',
  'correctOptionIds',
  'fullRubric',
  'rubric',
  'rubricDescription',
  'rubricItems',
  'weight',
]);

export function isRubricFeedbackProjection(
  value: unknown,
): value is RubricFeedbackProjection {
  if (!record(value)) return false;
  const projection = value as RubricFeedbackProjection;
  if (
    projection.projectionVersion !== RUBRIC_FEEDBACK_PROJECTION_SCHEMA_VERSION
    || !nonEmpty(projection.projectionId)
    || !nonEmpty(projection.questionVersionId)
    || (projection.rubricVersion !== undefined && !nonEmpty(projection.rubricVersion))
    || !['ready', 'limited', 'not_assessable'].includes(projection.projectionStatus)
    || !Array.isArray(projection.items)
    || !projection.items.every(isProjectionItem)
  ) return false;

  const itemIds = projection.items.map((item) => item.rubricItemId);
  if (new Set(itemIds).size !== itemIds.length) return false;
  if (projection.primaryItemId !== undefined) {
    if (!nonEmpty(projection.primaryItemId)) return false;
    const primary = projection.items.find((item) => item.rubricItemId === projection.primaryItemId);
    if (!primary || !['partially_achieved', 'missing'].includes(primary.coverageStatus)) return false;
  }
  return projection.items.every((item) => (
    item.sourceLinks.questionVersionId === projection.questionVersionId
    && (
      projection.rubricVersion === undefined
      || item.sourceLinks.rubricVersion === undefined
      || item.sourceLinks.rubricVersion === projection.rubricVersion
    )
  ));
}

export function isStudentVisibleFeedbackGrounding(
  value: unknown,
): value is StudentVisibleFeedbackGrounding {
  if (!record(value) || containsForbiddenStudentVisibleKey(value)) return false;
  const grounding = value as StudentVisibleFeedbackGrounding;
  return grounding.groundingVersion === STUDENT_VISIBLE_FEEDBACK_GROUNDING_SCHEMA_VERSION
    && optionalText(grounding.acknowledgedStudentAction)
    && (
      grounding.primaryObservedGap === undefined
      || RUBRIC_FEEDBACK_OBSERVED_GAPS.includes(grounding.primaryObservedGap)
    )
    && optionalText(grounding.safeClueLocator)
    && optionalText(grounding.nextThinkingAction)
    && ['result_only', 'thinking_prompt', 'scaffold'].includes(grounding.feedbackDepth)
    && nonEmpty(grounding.sourceProjectionId);
}

export function containsForbiddenStudentVisibleKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenStudentVisibleKey);
  if (!record(value)) return false;
  return Object.entries(value).some(([key, child]) => (
    FORBIDDEN_STUDENT_VISIBLE_KEYS.has(key)
    || containsForbiddenStudentVisibleKey(child)
  ));
}

function isProjectionItem(value: unknown): value is RubricFeedbackProjectionItem {
  if (!record(value)) return false;
  const item = value as RubricFeedbackProjectionItem;
  if (
    !nonEmpty(item.rubricItemId)
    || (item.requirementId !== undefined && !nonEmpty(item.requirementId))
    || !['critical', 'important', 'supporting'].includes(item.importance)
    || !RUBRIC_FEEDBACK_COVERAGE_STATUSES.includes(item.coverageStatus)
    || !stringArray(item.studentEvidenceRefs)
    || !nonEmpty(item.taskRelation)
    || (
      item.observedGap !== undefined
      && !RUBRIC_FEEDBACK_OBSERVED_GAPS.includes(item.observedGap)
    )
    || !optionalText(item.nextThinkingAction)
    || !sourceLinksValid(item.sourceLinks)
  ) return false;

  if (item.coverageStatus === 'achieved') {
    return item.studentEvidenceRefs.length > 0 && item.observedGap === undefined;
  }
  if (item.coverageStatus === 'partially_achieved') {
    return item.studentEvidenceRefs.length > 0
      && item.observedGap !== undefined
      && nonEmpty(item.sourceLinks.diagnosisId);
  }
  if (item.coverageStatus === 'missing') {
    return item.observedGap !== undefined && nonEmpty(item.sourceLinks.diagnosisId);
  }
  return item.observedGap === undefined && item.nextThinkingAction === undefined;
}

function sourceLinksValid(value: unknown): value is RubricFeedbackProjectionSourceLinks {
  if (!record(value)) return false;
  const links = value as RubricFeedbackProjectionSourceLinks;
  return nonEmpty(links.questionVersionId)
    && optionalText(links.rubricVersion)
    && optionalText(links.diagnosisId)
    && optionalText(links.responseId)
    && optionalText(links.requirementId)
    && optionalText(links.taskId)
    && optionalText(links.learningRoundId)
    && optionalText(links.executionSessionId);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty);
}

function optionalText(value: unknown): boolean {
  return value === undefined || nonEmpty(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
