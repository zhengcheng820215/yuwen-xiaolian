import type { QuestionResourceAdmissionRepository } from '../repositories/questionResourceAdmissionRepository.ts';
import type { WorkingTaskContentRepository } from '../repositories/workingTaskContentRepository.ts';
import type { StructuredQuestionDraft } from '../schemas/questionResourceAdmission.schema.ts';
import {
  WORKING_TASK_CONTENT_SCHEMA_VERSION,
  calculateQuestionEditableFieldsHash,
  calculateWorkingTaskContentHash,
  cloneWorkingTaskContent,
  extractQuestionEditableFields,
  normalizeQuestionEditableFields,
  normalizeTrainingTaskEditableFields,
  type QuestionEditableFields,
  type TrainingTaskEditableFields,
  type WorkingTaskContent,
  type WorkingTaskContentState,
} from '../schemas/workingTaskContent.schema.ts';

export type SaveWorkingTaskContentInput = {
  trainingTaskId: string;
  questionLineageId: string;
  baseDraftId: string;
  baseRevision: number;
  content: QuestionEditableFields;
  taskContent?: TrainingTaskEditableFields;
  savedAt?: string;
};

export type WorkingTaskContentConflictDetails = {
  state: Extract<WorkingTaskContentState, { status: 'base_revision_conflict' }>;
  activeDraft: StructuredQuestionDraft | null;
  activeContent: QuestionEditableFields | null;
};

export class WorkingTaskContentConflictError extends Error {
  readonly code = 'WORKING_TASK_CONTENT_BASE_CONFLICT';
  readonly expectedDraftId: string;
  readonly expectedRevision: number;
  readonly actualDraftId: string;
  readonly actualRevision: number;

  constructor(input: {
    expectedDraftId: string;
    expectedRevision: number;
    actualDraftId: string;
    actualRevision: number;
  }) {
    super(
      `Working task content base conflict: expected ${input.expectedDraftId}:r${input.expectedRevision}, ` +
      `actual ${input.actualDraftId}:r${input.actualRevision}.`,
    );
    this.name = 'WorkingTaskContentConflictError';
    this.expectedDraftId = input.expectedDraftId;
    this.expectedRevision = input.expectedRevision;
    this.actualDraftId = input.actualDraftId;
    this.actualRevision = input.actualRevision;
  }
}

export async function saveWorkingTaskContent(
  workingRepository: WorkingTaskContentRepository,
  questionRepository: QuestionResourceAdmissionRepository,
  input: SaveWorkingTaskContentInput,
): Promise<WorkingTaskContent> {
  const trainingTaskId = requireText(input.trainingTaskId, 'trainingTaskId');
  const questionLineageId = requireText(input.questionLineageId, 'questionLineageId');
  const baseDraftId = requireText(input.baseDraftId, 'baseDraftId');
  requireRevision(input.baseRevision);

  const baseDraft = await questionRepository.getDraft(baseDraftId);
  if (!baseDraft) throw new Error(`Base question draft not found: ${baseDraftId}`);
  if (resolveTrainingTaskId(baseDraft) !== trainingTaskId) {
    throw new Error(
      `Working task identity mismatch: draft belongs to ${resolveTrainingTaskId(baseDraft)}, not ${trainingTaskId}.`,
    );
  }
  if (baseDraft.resourceId !== questionLineageId) {
    throw new Error(
      `Working task lineage mismatch: draft belongs to ${baseDraft.resourceId}, not ${questionLineageId}.`,
    );
  }
  const activeDraft = await findActiveLineageDraft(
    questionRepository,
    questionLineageId,
    trainingTaskId,
  );
  if (!activeDraft) throw new Error(`Active question draft not found: ${questionLineageId}`);
  if (activeDraft.draftId !== baseDraftId || activeDraft.revision !== input.baseRevision) {
    throw new WorkingTaskContentConflictError({
      expectedDraftId: baseDraftId,
      expectedRevision: input.baseRevision,
      actualDraftId: activeDraft.draftId,
      actualRevision: activeDraft.revision,
    });
  }
  if (baseDraft.revision !== input.baseRevision) {
    throw new WorkingTaskContentConflictError({
      expectedDraftId: baseDraftId,
      expectedRevision: input.baseRevision,
      actualDraftId: baseDraft.draftId,
      actualRevision: baseDraft.revision,
    });
  }

  const existing = await workingRepository.get(trainingTaskId);
  if (
    existing &&
    (existing.baseDraftId !== baseDraftId || existing.baseRevision !== input.baseRevision)
  ) {
    throw new WorkingTaskContentConflictError({
      expectedDraftId: existing.baseDraftId,
      expectedRevision: existing.baseRevision,
      actualDraftId: baseDraftId,
      actualRevision: input.baseRevision,
    });
  }

  const content = normalizeQuestionEditableFields(input.content);
  const taskContent = input.taskContent
    ? normalizeTrainingTaskEditableFields(input.taskContent)
    : undefined;
  const baseContentHash = calculateQuestionEditableFieldsHash(
    extractQuestionEditableFields(baseDraft),
  );
  const workingContent: WorkingTaskContent = {
    trainingTaskId,
    questionLineageId,
    baseDraftId,
    baseRevision: input.baseRevision,
    baseContentHash,
    content,
    taskContent,
    workingContentHash: calculateWorkingTaskContentHash(content, taskContent),
    savedAt: input.savedAt || new Date().toISOString(),
    schemaVersion: WORKING_TASK_CONTENT_SCHEMA_VERSION,
  };
  return workingRepository.save(workingContent);
}

export async function getWorkingTaskContentState(
  workingRepository: WorkingTaskContentRepository,
  questionRepository: QuestionResourceAdmissionRepository,
  trainingTaskId: string,
): Promise<WorkingTaskContentState> {
  const workingContent = await workingRepository.get(trainingTaskId);
  if (!workingContent) return { status: 'missing', workingContent: null };

  const activeDraft = await findActiveLineageDraft(
    questionRepository,
    workingContent.questionLineageId,
    workingContent.trainingTaskId,
  );
  if (!activeDraft) return conflictState(workingContent, 'base_draft_missing', null);
  if (activeDraft.draftId !== workingContent.baseDraftId) {
    return conflictState(workingContent, 'active_draft_changed', activeDraft);
  }
  if (activeDraft.revision !== workingContent.baseRevision) {
    return conflictState(workingContent, 'revision_changed', activeDraft);
  }
  const activeContentHash = calculateQuestionEditableFieldsHash(
    extractQuestionEditableFields(activeDraft),
  );
  if (activeContentHash !== workingContent.baseContentHash) {
    return conflictState(workingContent, 'base_content_changed', activeDraft);
  }
  return { status: 'current', workingContent };
}

export function hasWorkingTaskContentChanges(
  workingContent: WorkingTaskContent,
  baseDraftContent: QuestionEditableFields,
  baseTaskContent?: TrainingTaskEditableFields,
): boolean {
  return workingContent.workingContentHash !== calculateWorkingTaskContentHash(
    baseDraftContent,
    baseTaskContent,
  );
}

export async function getWorkingTaskContentConflictDetails(
  workingRepository: WorkingTaskContentRepository,
  questionRepository: QuestionResourceAdmissionRepository,
  trainingTaskId: string,
): Promise<WorkingTaskContentConflictDetails | null> {
  const state = await getWorkingTaskContentState(
    workingRepository,
    questionRepository,
    trainingTaskId,
  );
  if (state.status !== 'base_revision_conflict') return null;
  const activeDraft = await findActiveLineageDraft(
    questionRepository,
    state.workingContent.questionLineageId,
    state.workingContent.trainingTaskId,
  );
  return {
    state,
    activeDraft,
    activeContent: activeDraft ? extractQuestionEditableFields(activeDraft) : null,
  };
}

export async function rebaseWorkingTaskContent(
  workingRepository: WorkingTaskContentRepository,
  questionRepository: QuestionResourceAdmissionRepository,
  input: {
    trainingTaskId: string;
    questionLineageId: string;
    content: QuestionEditableFields;
    taskContent?: TrainingTaskEditableFields;
    savedAt?: string;
  },
): Promise<WorkingTaskContent> {
  const activeDraft = await findActiveLineageDraft(
    questionRepository,
    input.questionLineageId,
    input.trainingTaskId,
  );
  if (!activeDraft) throw new Error(`Active question draft not found: ${input.questionLineageId}`);
  await workingRepository.delete(input.trainingTaskId);
  return saveWorkingTaskContent(workingRepository, questionRepository, {
    trainingTaskId: input.trainingTaskId,
    questionLineageId: input.questionLineageId,
    baseDraftId: activeDraft.draftId,
    baseRevision: activeDraft.revision,
    content: input.content,
    taskContent: input.taskContent,
    savedAt: input.savedAt,
  });
}

export function createWorkingTaskContentInputFromDraft(
  draft: Parameters<typeof extractQuestionEditableFields>[0],
  questionLineageId: string,
): Omit<SaveWorkingTaskContentInput, 'content'> & { content: QuestionEditableFields } {
  return {
    trainingTaskId: resolveTrainingTaskId(draft),
    questionLineageId,
    baseDraftId: draft.draftId,
    baseRevision: draft.revision,
    content: extractQuestionEditableFields(draft),
  };
}

export function cloneWorkingTaskContentState(
  state: WorkingTaskContentState,
): WorkingTaskContentState {
  return cloneWorkingTaskContent(state);
}

function requireText(value: string, field: string): string {
  if (!value?.trim()) throw new Error(`${field} is required.`);
  return value.trim();
}

function requireRevision(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('baseRevision must be a positive integer.');
  }
}

async function findActiveLineageDraft(
  repository: QuestionResourceAdmissionRepository,
  questionLineageId: string,
  trainingTaskId: string,
): Promise<StructuredQuestionDraft | null> {
  return (await repository.listDrafts())
    .filter((draft) => (
      draft.resourceId === questionLineageId &&
      resolveTrainingTaskId(draft) === trainingTaskId &&
      !['rejected', 'archived'].includes(draft.status)
    ))
    .sort((left, right) => (
      right.updatedAt.localeCompare(left.updatedAt) || right.revision - left.revision
    ))[0] || null;
}

export function resolveTrainingTaskId(draft: StructuredQuestionDraft): string {
  const observationTaskRootTag = draft.tags.find((tag) => tag.startsWith('observation_task_root:'));
  if (observationTaskRootTag) {
    return observationTaskRootTag.slice('observation_task_root:'.length).trim();
  }
  const observationTaskTag = draft.tags.find((tag) => tag.startsWith('observation_task:'));
  return observationTaskTag?.slice('observation_task:'.length).trim() || draft.taskId;
}

function conflictState(
  workingContent: WorkingTaskContent,
  reason: Extract<WorkingTaskContentState, { status: 'base_revision_conflict' }>['reason'],
  activeDraft: StructuredQuestionDraft | null,
): Extract<WorkingTaskContentState, { status: 'base_revision_conflict' }> {
  return {
    status: 'base_revision_conflict',
    workingContent,
    reason,
    activeDraftId: activeDraft?.draftId || null,
    activeRevision: activeDraft?.revision || null,
    activeContentHash: activeDraft
      ? calculateQuestionEditableFieldsHash(extractQuestionEditableFields(activeDraft))
      : null,
  };
}
