import type {
  StructuredQuestionDraft,
} from './questionResourceAdmission.schema.ts';
import { normalizeQuestionRuntimePolicyTags } from './questionResourceAdmission.schema.ts';

export const WORKING_TASK_CONTENT_SCHEMA_VERSION = 'working-task-content-v2' as const;

export type QuestionEditableFields = Pick<
  StructuredQuestionDraft,
  | 'materialVersionId'
  | 'title'
  | 'questionStem'
  | 'questionType'
  | 'responseFormat'
  | 'options'
  | 'assessmentMode'
  | 'answerAcceptance'
  | 'rubric'
  | 'minimumAnswerRequirement'
  | 'abilityMetadata'
  | 'source'
  | 'tags'
>;

export type TrainingTaskEditableFields = {
  primaryDimension: string;
  abilityId: string;
  focusDisplayName: string;
  focusDefinition: string;
  questionStem: string;
  expectedStudentAction: string;
  designReason: string;
  taskRole: string;
  difficulty: string;
  anchorType: string;
  startParagraph?: number;
  endParagraph?: number;
  supportingAbilityIdsText: string;
  comparisonGroupId: string;
  assessmentMode: string;
  questionType: string;
  responseFormat: string;
  acceptedKeywordsText: string;
  semanticEquivalentAllowed: boolean;
  minLength: number;
  rubric: Array<{
    localId: string;
    name: string;
    abilityId: string;
    description: string;
    acceptedSignalsText: string;
  }>;
  calibrationCases: Array<{
    localId: string;
    category: string;
    answerText: string;
  }>;
};

export type WorkingTaskContent = {
  trainingTaskId: string;
  questionLineageId: string;
  baseDraftId: string;
  baseRevision: number;
  baseContentHash: string;
  content: QuestionEditableFields;
  taskContent?: TrainingTaskEditableFields;
  workingContentHash: string;
  savedAt: string;
  schemaVersion: typeof WORKING_TASK_CONTENT_SCHEMA_VERSION;
};

export type WorkingTaskContentState =
  | { status: 'missing'; workingContent: null }
  | { status: 'current'; workingContent: WorkingTaskContent }
  | {
    status: 'base_revision_conflict';
    workingContent: WorkingTaskContent;
    reason: 'active_draft_changed' | 'revision_changed' | 'base_content_changed' | 'base_draft_missing';
    activeDraftId: string | null;
    activeRevision: number | null;
    activeContentHash: string | null;
  };

type LegacyWorkingTaskContentV1 = Omit<
  WorkingTaskContent,
  'baseContentHash' | 'workingContentHash' | 'schemaVersion'
> & {
  contentHash: string;
  schemaVersion: 'working-task-content-v1';
};

export function extractQuestionEditableFields(
  draft: StructuredQuestionDraft,
): QuestionEditableFields {
  return normalizeQuestionEditableFields({
    materialVersionId: draft.materialVersionId,
    title: draft.title,
    questionStem: draft.questionStem,
    questionType: draft.questionType,
    responseFormat: draft.responseFormat,
    options: draft.options,
    assessmentMode: draft.assessmentMode,
    answerAcceptance: draft.answerAcceptance,
    rubric: draft.rubric,
    minimumAnswerRequirement: draft.minimumAnswerRequirement,
    abilityMetadata: draft.abilityMetadata,
    source: draft.source,
    tags: draft.tags,
  });
}

export function normalizeQuestionEditableFields(
  content: QuestionEditableFields,
): QuestionEditableFields {
  const normalized = normalizeValue(content) as QuestionEditableFields;
  return {
    ...normalized,
    tags: normalizeQuestionRuntimePolicyTags(
      normalized.tags,
      normalized.abilityMetadata.taskRole,
    ),
  };
}

export function calculateQuestionEditableFieldsHash(
  content: QuestionEditableFields,
): string {
  return calculateNormalizedHash(normalizeQuestionEditableFields(content));
}

export function calculateWorkingTaskContentHash(
  content: QuestionEditableFields,
  taskContent?: TrainingTaskEditableFields,
): string {
  if (!taskContent) return calculateQuestionEditableFieldsHash(content);
  return calculateNormalizedHash({
    questionContent: normalizeQuestionEditableFields(content),
    taskContent: normalizeTrainingTaskEditableFields(taskContent),
  });
}

export function normalizeTrainingTaskEditableFields(
  content: TrainingTaskEditableFields,
): TrainingTaskEditableFields {
  return normalizeValue(content) as TrainingTaskEditableFields;
}

export function cloneWorkingTaskContent<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function migrateWorkingTaskContent(
  value: WorkingTaskContent | LegacyWorkingTaskContentV1,
  baseContentHash?: string,
): WorkingTaskContent {
  if (value.schemaVersion === WORKING_TASK_CONTENT_SCHEMA_VERSION) {
    return cloneWorkingTaskContent(value);
  }
  return {
    trainingTaskId: value.trainingTaskId,
    questionLineageId: value.questionLineageId,
    baseDraftId: value.baseDraftId,
    baseRevision: value.baseRevision,
    baseContentHash: baseContentHash || value.contentHash,
    content: normalizeQuestionEditableFields(value.content),
    taskContent: undefined,
    workingContentHash: value.contentHash,
    savedAt: value.savedAt,
    schemaVersion: WORKING_TASK_CONTENT_SCHEMA_VERSION,
  };
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.replace(/[\t ]+$/g, ''))
      .join('\n')
      .trim();
  }
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, normalizeValue(child)]),
  );
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}

function calculateNormalizedHash(value: unknown): string {
  const serialized = stableSerialize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
