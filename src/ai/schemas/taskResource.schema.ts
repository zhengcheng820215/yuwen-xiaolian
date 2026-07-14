import type { QuestionMetadataRubricItem } from './diagnosis.schema.ts';
import type { AvailableTaskResource } from './taskFulfillment.schema.ts';

export const TASK_RESOURCE_VERSION = 'phase12_2_v1';
export const TASK_RESOURCE_SCHEMA_VERSION = 'task_resource_v1';

export type TaskResourceQuestionType =
  | 'reading_open_response'
  | 'sentence_interpretation'
  | 'expression'
  | 'micro_writing';

export const TASK_RESOURCE_QUESTION_TYPES: TaskResourceQuestionType[] = [
  'reading_open_response',
  'sentence_interpretation',
  'expression',
  'micro_writing',
];

export type TaskResourceSourceType = 'manual' | 'textbook' | 'exam';

export type TaskResourceSource = {
  type: TaskResourceSourceType;
  description?: string;
  title?: string;
  grade?: string;
  edition?: string;
  year?: string;
  pageOrQuestionNo?: string;
};

export type TaskResourceInput = {
  title?: string;
  externalResourceId?: string;
  readingText?: string;
  questionText: string;
  answerRequirements: string[];
  questionType: TaskResourceQuestionType;
  targetAbilityId: string;
  referenceAnswer?: string;
  assessmentBasis: string[];
  rubric?: QuestionMetadataRubricItem[];
  source: TaskResourceSource;
};

export type TaskResourceDraftStatus = 'draft' | 'validation_failed' | 'ready';
export type TaskResourceStatus = 'ready' | 'active';

export type TaskResourceDraft = {
  draftId: string;
  studentId?: string;
  input: TaskResourceInput;
  status: TaskResourceDraftStatus;
  createdAt: string;
  updatedAt: string;
  version: typeof TASK_RESOURCE_VERSION;
  schemaVersion: typeof TASK_RESOURCE_SCHEMA_VERSION;
};

export type TaskResourceValidationIssue = {
  code: string;
  message: string;
  blocking: boolean;
};

export type TaskResourceValidationResult = {
  draftId: string;
  canSaveDraft: boolean;
  canCreateResource: boolean;
  canEnterTaskFulfillment: boolean;
  checks: {
    hasQuestionText: boolean;
    hasAnswerRequirements: boolean;
    hasAssessmentBasis: boolean;
    hasTargetAbility: boolean;
    hasSource: boolean;
    readingTextRequired: boolean;
    readingTextProvided: boolean;
    abilityAligned: boolean;
    metadataReady: boolean;
    traceable: boolean;
    resourceIdUnique: boolean;
  };
  issues: TaskResourceValidationIssue[];
};

export type TaskResource = {
  resourceId: string;
  externalResourceId?: string;
  title: string;
  readingText?: string;
  questionText: string;
  answerRequirements: string[];
  questionType: TaskResourceQuestionType;
  targetAbilityId: string;
  referenceAnswer?: string;
  assessmentBasis: string[];
  rubric: QuestionMetadataRubricItem[];
  status: TaskResourceStatus;
  source: TaskResourceSource;
  availableTaskResource: AvailableTaskResource;
  createdAt: string;
  updatedAt: string;
  version: typeof TASK_RESOURCE_VERSION;
  schemaVersion: typeof TASK_RESOURCE_SCHEMA_VERSION;
};

export function isTaskResourceDraft(value: unknown): value is TaskResourceDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as TaskResourceDraft;

  return (
    isNonEmptyString(draft.draftId) &&
    (!draft.studentId || isNonEmptyString(draft.studentId)) &&
    ['draft', 'validation_failed', 'ready'].includes(draft.status) &&
    isTaskResourceInput(draft.input) &&
    isNonEmptyString(draft.createdAt) &&
    isNonEmptyString(draft.updatedAt) &&
    draft.version === TASK_RESOURCE_VERSION &&
    draft.schemaVersion === TASK_RESOURCE_SCHEMA_VERSION
  );
}

export function isTaskResourceValidationResult(value: unknown): value is TaskResourceValidationResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as TaskResourceValidationResult;

  return (
    isNonEmptyString(result.draftId) &&
    typeof result.canSaveDraft === 'boolean' &&
    typeof result.canCreateResource === 'boolean' &&
    typeof result.canEnterTaskFulfillment === 'boolean' &&
    Boolean(result.checks) &&
    Object.values(result.checks).every((item) => typeof item === 'boolean') &&
    Array.isArray(result.issues) &&
    result.issues.every((issue) => (
      isNonEmptyString(issue.code) &&
      isNonEmptyString(issue.message) &&
      typeof issue.blocking === 'boolean'
    ))
  );
}

export function isTaskResource(value: unknown): value is TaskResource {
  if (!value || typeof value !== 'object') return false;
  const resource = value as TaskResource;

  return (
    isNonEmptyString(resource.resourceId) &&
    isNonEmptyString(resource.title) &&
    isNonEmptyString(resource.questionText) &&
    nonEmptyStringArray(resource.answerRequirements) &&
    TASK_RESOURCE_QUESTION_TYPES.includes(resource.questionType) &&
    isNonEmptyString(resource.targetAbilityId) &&
    Array.isArray(resource.assessmentBasis) &&
    Array.isArray(resource.rubric) &&
    resource.rubric.length > 0 &&
    ['ready', 'active'].includes(resource.status) &&
    isTaskResourceSource(resource.source) &&
    Boolean(resource.availableTaskResource) &&
    isNonEmptyString(resource.createdAt) &&
    isNonEmptyString(resource.updatedAt) &&
    resource.version === TASK_RESOURCE_VERSION &&
    resource.schemaVersion === TASK_RESOURCE_SCHEMA_VERSION
  );
}

export function isTaskResourceInput(value: unknown): value is TaskResourceInput {
  if (!value || typeof value !== 'object') return false;
  const input = value as TaskResourceInput;

  return (
    (!input.title || isNonEmptyString(input.title)) &&
    (!input.externalResourceId || isNonEmptyString(input.externalResourceId)) &&
    (!input.readingText || isNonEmptyString(input.readingText)) &&
    typeof input.questionText === 'string' &&
    Array.isArray(input.answerRequirements) &&
    input.answerRequirements.every((item) => typeof item === 'string') &&
    TASK_RESOURCE_QUESTION_TYPES.includes(input.questionType) &&
    typeof input.targetAbilityId === 'string' &&
    (!input.referenceAnswer || isNonEmptyString(input.referenceAnswer)) &&
    Array.isArray(input.assessmentBasis) &&
    input.assessmentBasis.every((item) => typeof item === 'string') &&
    (!input.rubric || Array.isArray(input.rubric)) &&
    isTaskResourceSource(input.source)
  );
}

export function isTaskResourceSource(value: unknown): value is TaskResourceSource {
  if (!value || typeof value !== 'object') return false;
  const source = value as TaskResourceSource;

  return (
    ['manual', 'textbook', 'exam'].includes(source.type) &&
    (!source.description || isNonEmptyString(source.description)) &&
    (!source.title || isNonEmptyString(source.title)) &&
    (!source.grade || isNonEmptyString(source.grade)) &&
    (!source.edition || isNonEmptyString(source.edition)) &&
    (!source.year || isNonEmptyString(source.year)) &&
    (!source.pageOrQuestionNo || isNonEmptyString(source.pageOrQuestionNo))
  );
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
