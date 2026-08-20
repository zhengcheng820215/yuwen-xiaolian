import type { AuthoringFieldKey } from '../contracts/authoringFieldContract.ts';
import {
  calculateQuestionEditableFieldsHash,
  cloneWorkingTaskContent,
  normalizeQuestionEditableFields,
  type QuestionEditableFields,
} from './workingTaskContent.schema.ts';
import type { QuestionGenerationQualityEvaluation } from
  './questionGenerationQuality.schema.ts';
import {
  isSingleChoiceMinimumResponseRequirement,
  validateSingleChoiceInteraction,
} from './singleChoiceInteraction.schema.ts';

export const QUESTION_CANDIDATE_SCHEMA_VERSION = 'question-candidate-v1' as const;

export type QuestionCandidateType =
  | 'initial'
  | 'regenerated'
  | 'optimized'
  | 'formal_version_optimization'
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
  source?: 'ai_generated' | 'training_task_compatibility_wrap';
  modelId: string;
  promptVersion: string;
  promptHash: string;
  ruleVersion: string;
  materialVersionId: string;
  observationPlanVersion: number;
  trainingTaskVersion: number;
  trainingTaskContentHash?: string;
  generatedAt: string;
};

export type QuestionCandidateOrigin =
  | 'ai_generated'
  | 'training_task_compatibility_wrap';

export type CandidateRuntimeContext = {
  materialVersionId: string;
  observationPlanVersion: number;
  trainingTaskVersion: number;
  baseFormalResourceId?: string;
  baseFormalVersionId?: string;
  activeDraftId?: string;
  activeDraftRevision?: number;
  activeDraftContentHash?: string;
};

export type QuestionCandidate = {
  candidateId: string;
  generationCommandId: string;
  generationCommandFingerprint: string;
  trainingTaskId: string;
  candidateOrigin?: QuestionCandidateOrigin;
  candidateType: QuestionCandidateType;
  basedOnCandidateId?: string;
  basedOnDraftId?: string;
  basedOnRevision?: number;
  basedOnContentHash?: string;
  basedOnFormalResourceId?: string;
  basedOnFormalVersionId?: string;
  content: QuestionEditableFields;
  contentHash: string;
  generationReason: string;
  changedFields: CandidateFieldKey[];
  allowedFields: CandidateFieldKey[];
  lockedFields: CandidateFieldKey[];
  generationContext: CandidateGenerationContext;
  generationQuality?: QuestionGenerationQualityEvaluation;
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
  | 'ensureInitialCandidateFromTrainingTask'
  | 'generateTaskCandidates'
  | 'generateFormalVersionOptimizationCandidates'
  | 'regenerateTaskCandidates'
  | 'optimizeTaskCandidate'
  | 'adoptTaskCandidate'
  | 'correctTaskCandidate'
  | 'migrateWorkingTaskContent';

export type CandidateGenerationCommandName = Extract<
  CandidateCommandName,
  | 'generateTaskCandidates'
  | 'generateFormalVersionOptimizationCandidates'
  | 'regenerateTaskCandidates'
  | 'optimizeTaskCandidate'
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

export type InitialCandidateCompleteness = {
  complete: boolean;
  missingFields: CandidateFieldKey[];
};

export type QuestionCandidateContentValidationIssue = {
  code: string;
  field: 'studentTask' | 'answerAcceptance';
  message: string;
};

export type QuestionCandidateContentValidation = {
  passed: boolean;
  issues: QuestionCandidateContentValidationIssue[];
};

export function validateQuestionCandidateContent(
  content: QuestionEditableFields,
): QuestionCandidateContentValidation {
  const issues: QuestionCandidateContentValidationIssue[] = [];
  if (content.responseFormat === 'single_choice') {
    const choiceValidation = validateSingleChoiceInteraction(content.choiceInteraction);
    choiceValidation.issues.forEach((issue) => {
      issues.push({ code: issue.code, field: 'studentTask', message: issue.message });
    });
    if (content.questionType !== 'multiple_choice') {
      issues.push({
        code: 'choice.question_type',
        field: 'studentTask',
        message: 'Single-choice Candidate must use the multiple_choice question type.',
      });
    }
    if (content.options && content.options.length > 0) {
      issues.push({
        code: 'choice.legacy_options_not_allowed',
        field: 'studentTask',
        message: 'Single-choice Candidate must use stable option objects.',
      });
    }
    if (content.assessmentMode !== 'exact_match') {
      issues.push({
        code: 'choice.assessment_mode',
        field: 'studentTask',
        message: 'Single-choice Candidate must use exact_match.',
      });
    }
    if (!isSingleChoiceMinimumResponseRequirement(content.minimumAnswerRequirement)) {
      issues.push({
        code: 'choice.minimum_response_requirement',
        field: 'studentTask',
        message: 'Single-choice Candidate requires exactly one structured selection.',
      });
    }
    if (content.rubric.some((item) => item.required && (
      item.evidenceRequirement?.requireTextEvidence
      || item.evidenceRequirement?.requireExplanation
      || item.evidenceRequirement?.requireConclusion
    ))) {
      issues.push({
        code: 'choice.rubric_open_response_not_allowed',
        field: 'studentTask',
        message: 'Single-choice Rubric cannot require a written explanation, conclusion, or text evidence.',
      });
    }
    const acceptedOptionIds = content.answerAcceptance?.acceptedOptionIds || [];
    const correctOptionIds = content.choiceInteraction?.correctOptionIds || [];
    if (
      acceptedOptionIds.length !== 1 ||
      correctOptionIds.length !== 1 ||
      acceptedOptionIds[0] !== correctOptionIds[0]
    ) {
      issues.push({
        code: 'choice.answer_acceptance_mismatch',
        field: 'answerAcceptance',
        message: 'Accepted option ID must match the single correct option ID.',
      });
    }
  } else if (content.choiceInteraction !== undefined) {
    issues.push({
      code: 'choice.interaction_unused',
      field: 'studentTask',
      message: 'Choice interaction requires responseFormat single_choice.',
    });
  }
  return { passed: issues.length === 0, issues };
}

export function inspectInitialCandidateCompleteness(
  content: QuestionEditableFields,
): InitialCandidateCompleteness {
  const missingFields: CandidateFieldKey[] = [];
  if (!content.questionStem.trim()) missingFields.push('questionStem');
  if (!content.responseFormat || !content.minimumAnswerRequirement) {
    missingFields.push('studentTask');
  }
  if (!content.abilityMetadata?.abilityId?.trim()) missingFields.push('abilityTarget');
  if (!content.rubric.length || !content.rubric.some((item) => (
    Boolean(item.abilityId?.trim()) && Boolean((item.description || item.name)?.trim())
  ))) {
    missingFields.push('observationTarget');
  }
  if (!content.rubric.length) missingFields.push('rubric');
  if (!content.answerAcceptance || (
    !Array.isArray(content.answerAcceptance.acceptedKeywords)
    && !Array.isArray(content.answerAcceptance.acceptedOptionIds)
    && typeof content.answerAcceptance.semanticEquivalentAllowed !== 'boolean'
  )) {
    missingFields.push('answerAcceptance');
  }
  const hasMaterialScope = Boolean(content.materialVersionId?.trim()) && content.tags.some(
    (tag) => tag.startsWith('observation_task:'),
  );
  if (!hasMaterialScope) missingFields.push('materialScope');
  const contentValidation = validateQuestionCandidateContent(content);
  contentValidation.issues.forEach((issue) => missingFields.push(issue.field));
  return {
    complete: missingFields.length === 0,
    missingFields: uniqueFields(missingFields),
  };
}

export function createQuestionCandidate(input: Omit<
  QuestionCandidate,
  'content' | 'contentHash' | 'schemaVersion'
> & { content: QuestionEditableFields }): QuestionCandidate {
  const content = normalizeQuestionEditableFields(input.content);
  const contentValidation = validateQuestionCandidateContent(content);
  if (!contentValidation.passed) {
    throw new Error(
      `Question Candidate content is invalid: ${contentValidation.issues.map((issue) => issue.code).join(', ')}`,
    );
  }
  const contentHash = calculateQuestionEditableFieldsHash(content);
  return {
    ...cloneQuestionCandidate(input),
    candidateOrigin: input.candidateOrigin || 'ai_generated',
    content,
    contentHash,
    generationContext: {
      source: input.generationContext.source || input.candidateOrigin || 'ai_generated',
      trainingTaskContentHash: input.generationContext.trainingTaskContentHash || contentHash,
      ...cloneQuestionCandidate(input.generationContext),
    },
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
    candidate.basedOnFormalResourceId === context.baseFormalResourceId &&
    candidate.basedOnFormalVersionId === context.baseFormalVersionId &&
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
        choiceInteraction: content.choiceInteraction,
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
