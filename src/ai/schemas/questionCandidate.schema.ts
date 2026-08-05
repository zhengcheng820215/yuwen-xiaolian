import type { AuthoringFieldKey } from '../contracts/authoringFieldContract.ts';
import {
  calculateQuestionEditableFieldsHash,
  cloneWorkingTaskContent,
  normalizeQuestionEditableFields,
  type QuestionEditableFields,
} from './workingTaskContent.schema.ts';

export const QUESTION_CANDIDATE_SCHEMA_VERSION = 'question-candidate-v1' as const;

export type QuestionCandidateType =
  | 'initial'
  | 'regenerated'
  | 'optimized'
  | 'exception_corrected';

export type QuestionCandidateStatus =
  | 'ready'
  | 'adopted'
  | 'rejected'
  | 'expired'
  | 'superseded';

export type CandidateFieldKey = AuthoringFieldKey
  | 'answerAcceptance'
  | 'rubric'
  | 'materialScope'
  | 'sourceAttribution';

export const CANDIDATE_FIELD_KEYS: CandidateFieldKey[] = [
  'abilityTarget',
  'specificTrainingPoint',
  'questionStem',
  'studentTask',
  'observationTarget',
  'answerAcceptance',
  'rubric',
  'materialScope',
  'sourceAttribution',
];

export type CandidateGenerationContext = {
  modelId: string;
  promptVersion: string;
  promptHash: string;
  ruleVersion: string;
  materialVersionId: string;
  observationPlanVersion: number;
  trainingTaskVersion: number;
  generatedAt: string;
};

export type CandidateRuntimeContext = {
  materialVersionId: string;
  observationPlanVersion: number;
  trainingTaskVersion: number;
  activeDraftId?: string;
  activeDraftRevision?: number;
  activeDraftContentHash?: string;
};

export type QuestionCandidate = {
  candidateId: string;
  generationCommandId: string;
  generationCommandFingerprint: string;
  trainingTaskId: string;
  candidateType: QuestionCandidateType;
  basedOnCandidateId?: string;
  basedOnDraftId?: string;
  basedOnRevision?: number;
  basedOnContentHash?: string;
  content: QuestionEditableFields;
  contentHash: string;
  generationReason: string;
  changedFields: CandidateFieldKey[];
  allowedFields: CandidateFieldKey[];
  lockedFields: CandidateFieldKey[];
  generationContext: CandidateGenerationContext;
  status: QuestionCandidateStatus;
  createdAt: string;
  adoptedAt?: string;
  schemaVersion: typeof QUESTION_CANDIDATE_SCHEMA_VERSION;
};

export type CandidateDecision = 'adopted' | 'rejected' | 'regenerated' | 'optimized';

export type CandidateDecisionEvent = {
  eventId: string;
  candidateId: string;
  trainingTaskId: string;
  decision: CandidateDecision;
  reasonCodes: string[];
  note?: string;
  relatedCandidateIds?: string[];
  decidedBy: string;
  decidedAt: string;
};

export type CandidateAdoptionResult = {
  candidateId: string;
  questionLineageId: string;
  draftId: string;
  revision: number;
  contentHash: string;
  adoptedAt: string;
};

export type CandidateCommandName =
  | 'generateTaskCandidates'
  | 'regenerateTaskCandidates'
  | 'optimizeTaskCandidate'
  | 'adoptTaskCandidate'
  | 'correctTaskCandidate'
  | 'migrateWorkingTaskContent';

export type CandidateGenerationCommandName = Extract<
  CandidateCommandName,
  'generateTaskCandidates' | 'regenerateTaskCandidates' | 'optimizeTaskCandidate'
>;

export type CandidateCommandResult =
  | {
    kind: 'candidate_generation';
    candidateIds: string[];
  }
  | {
    kind: 'candidate_adoption';
    adoption: CandidateAdoptionResult;
  }
  | {
    kind: 'candidate_correction';
    candidateId: string;
    correctionId: string;
  }
  | {
    kind: 'working_content_migration';
    status: 'migrated' | 'no_changes' | 'requires_protected_resolution';
    candidateId?: string;
    correctionId?: string;
  };

export type CandidateCommandReceipt = {
  command: CandidateCommandName;
  idempotencyKey: string;
  requestFingerprint: string;
  result: CandidateCommandResult;
  createdAt: string;
};

export type TaskCandidateState =
  | 'not_generated'
  | 'generating'
  | 'candidate_ready'
  | 'optimizing'
  | 'regenerating'
  | 'candidate_failed'
  | 'candidate_expired';

export type TaskCandidateAction =
  | 'generate'
  | 'regenerate'
  | 'optimize'
  | 'adopt';

export type TaskCandidateProjection = {
  state: TaskCandidateState;
  availableActions: TaskCandidateAction[];
  readyCandidateIds: string[];
  expiredCandidateIds: string[];
};

export function createQuestionCandidate(input: Omit<
  QuestionCandidate,
  'content' | 'contentHash' | 'schemaVersion'
> & { content: QuestionEditableFields }): QuestionCandidate {
  const content = normalizeQuestionEditableFields(input.content);
  return {
    ...cloneQuestionCandidate(input),
    content,
    contentHash: calculateQuestionEditableFieldsHash(content),
    changedFields: uniqueFields(input.changedFields),
    allowedFields: uniqueFields(input.allowedFields),
    lockedFields: uniqueFields(input.lockedFields),
    schemaVersion: QUESTION_CANDIDATE_SCHEMA_VERSION,
  };
}

export function candidateContextMatches(
  candidate: QuestionCandidate,
  context: CandidateRuntimeContext,
): boolean {
  const draftIdentityMatches = candidate.basedOnDraftId === undefined
    ? context.activeDraftId === undefined
    : candidate.basedOnDraftId === context.activeDraftId;
  return candidate.generationContext.materialVersionId === context.materialVersionId &&
    candidate.generationContext.observationPlanVersion === context.observationPlanVersion &&
    candidate.generationContext.trainingTaskVersion === context.trainingTaskVersion &&
    draftIdentityMatches &&
    (candidate.basedOnRevision === undefined ||
      candidate.basedOnRevision === context.activeDraftRevision) &&
    (candidate.basedOnContentHash === undefined ||
      candidate.basedOnContentHash === context.activeDraftContentHash);
}

export function resolveTaskCandidateState(input: {
  candidates: QuestionCandidate[];
  context: CandidateRuntimeContext;
  operation?: 'generating' | 'optimizing' | 'regenerating';
  failed?: boolean;
}): TaskCandidateProjection {
  if (input.operation) {
    return {
      state: input.operation,
      availableActions: [],
      readyCandidateIds: [],
      expiredCandidateIds: [],
    };
  }
  if (input.failed) {
    return {
      state: 'candidate_failed',
      availableActions: ['generate'],
      readyCandidateIds: [],
      expiredCandidateIds: [],
    };
  }

  const readyCandidates = input.candidates.filter((candidate) => (
    candidate.status === 'ready' && candidateContextMatches(candidate, input.context)
  ));
  const expiredCandidates = input.candidates.filter((candidate) => (
    candidate.status === 'expired' ||
    (candidate.status === 'ready' && !candidateContextMatches(candidate, input.context))
  ));
  if (readyCandidates.length > 0) {
    return {
      state: 'candidate_ready',
      availableActions: ['regenerate', 'optimize', 'adopt'],
      readyCandidateIds: readyCandidates.map((candidate) => candidate.candidateId),
      expiredCandidateIds: expiredCandidates.map((candidate) => candidate.candidateId),
    };
  }
  if (expiredCandidates.length > 0) {
    return {
      state: 'candidate_expired',
      availableActions: ['generate'],
      readyCandidateIds: [],
      expiredCandidateIds: expiredCandidates.map((candidate) => candidate.candidateId),
    };
  }
  return {
    state: 'not_generated',
    availableActions: ['generate'],
    readyCandidateIds: [],
    expiredCandidateIds: [],
  };
}

export function readCandidateField(
  content: QuestionEditableFields,
  field: CandidateFieldKey,
): unknown {
  switch (field) {
    case 'abilityTarget':
      return content.abilityMetadata.abilityId;
    case 'specificTrainingPoint':
      return content.title;
    case 'questionStem':
      return content.questionStem;
    case 'studentTask':
      return {
        responseFormat: content.responseFormat,
        minimumAnswerRequirement: content.minimumAnswerRequirement,
      };
    case 'observationTarget':
      return content.rubric.map((item) => ({
        abilityId: item.abilityId,
        name: item.name,
        description: item.description,
      }));
    case 'answerAcceptance':
      return content.answerAcceptance;
    case 'rubric':
      return content.rubric;
    case 'materialScope':
      return {
        materialVersionId: content.materialVersionId,
        scopeTags: content.tags.filter((tag) => (
          tag.startsWith('paragraph:') ||
          tag.startsWith('material_scope:') ||
          tag.startsWith('observation_task:')
        )),
      };
    case 'sourceAttribution':
      return content.source;
  }
}

export function candidateFieldChanged(
  base: QuestionEditableFields,
  next: QuestionEditableFields,
  field: CandidateFieldKey,
): boolean {
  return JSON.stringify(readCandidateField(base, field)) !==
    JSON.stringify(readCandidateField(next, field));
}

export function cloneQuestionCandidate<T>(value: T): T {
  return cloneWorkingTaskContent(value);
}

function uniqueFields(fields: CandidateFieldKey[]): CandidateFieldKey[] {
  return [...new Set(fields)];
}
