import type {
  AnswerAcceptance,
  AssessmentMode,
} from './diagnosis.schema.ts';
import type { RecommendedTaskRole } from './nextLearningStrategy.schema.ts';

export const QUESTION_RESOURCE_ADMISSION_VERSION = 'phase16_1a_v1';
export const QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION = 'question_resource_admission_v1';

export const PRIMARY_ABILITY_IDS = [
  'extraction',
  'comprehension',
  'summarization',
  'analysis',
  'inference',
  'expression',
] as const;

export type PrimaryAbilityId = typeof PRIMARY_ABILITY_IDS[number];

export const QUESTION_RESOURCE_TASK_ROLES = [
  'training',
  'retest',
  'transfer',
  'diagnosis',
  'observation',
] as const satisfies readonly RecommendedTaskRole[];

export const QUESTION_RESOURCE_DIFFICULTIES = [
  'basic',
  'intermediate',
  'advanced',
] as const;

export type QuestionResourceDifficulty = typeof QUESTION_RESOURCE_DIFFICULTIES[number];

export const STRUCTURED_QUESTION_TYPES = [
  'multiple_choice',
  'true_false',
  'fill_blank',
  'open_short_answer',
  'reading_comprehension',
] as const;

export type StructuredQuestionType = typeof STRUCTURED_QUESTION_TYPES[number];

export const QUESTION_RESPONSE_FORMATS = [
  'single_choice',
  'boolean',
  'short_text',
  'long_text',
] as const;

export type QuestionResponseFormat = typeof QUESTION_RESPONSE_FORMATS[number];

export type QuestionSourceType =
  | 'manual'
  | 'imported'
  | 'ai_assisted'
  | 'ocr_assisted';

export type QuestionSource = {
  sourceType: QuestionSourceType;
  description: string;
  copyrightNote?: string;
  externalReference?: string;
};

export type QuestionMaterialVersion = {
  materialId: string;
  materialVersionId: string;
  versionNumber: number;
  status?: 'active' | 'retired';
  title: string;
  content: string;
  source: QuestionSource;
  createdAt: string;
  updatedAt: string;
  schemaVersion: typeof QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION;
};

export type QuestionRubricEvidenceRequirement = {
  requireTextEvidence?: boolean;
  requireExplanation?: boolean;
  requireConclusion?: boolean;
};

export type QuestionResourceRubricItem = {
  itemId: string;
  name: string;
  description?: string;
  abilityId: PrimaryAbilityId;
  importance: 'critical' | 'important' | 'supporting';
  required: boolean;
  evidenceRequirement?: QuestionRubricEvidenceRequirement;
  acceptedSignals: string[];
};

export type MinimumAnswerRequirement = {
  minLength: number;
  requireTextEvidence: boolean;
  requireExplanation: boolean;
};

export type QuestionAbilityMetadata = {
  abilityId: PrimaryAbilityId;
  supportingAbilityIds: PrimaryAbilityId[];
  prerequisiteAbilityIds: PrimaryAbilityId[];
  taskRole: RecommendedTaskRole;
  difficulty: QuestionResourceDifficulty;
  gradeRange?: string;
};

export type QuestionResourceDraftStatus =
  | 'drafted'
  | 'validation_failed'
  | 'pending_review'
  | 'revision_required'
  | 'reviewed'
  | 'rejected'
  | 'archived';

export type StoredQuestionQualityCheck =
  | 'materialGrounding'
  | 'observationClarity'
  | 'observationDistinctness'
  | 'discriminativePower'
  | 'difficultyCoherence'
  | 'rubricAlignment'
  | 'scopeClarity';

export type QuestionQualityRevisionProgressSnapshot = {
  version: 1;
  draftId: string;
  lastAssessmentId?: string;
  items: Array<{
    check: StoredQuestionQualityCheck;
    code: string;
    message: string;
    status: 'pending' | 'modified_pending_recheck' | 'resolved';
    recheckCount: number;
    firstSeenRevision: number;
    lastSeenRevision: number;
    resolvedAtAssessmentId?: string;
  }>;
};

export type StructuredQuestionDraft = {
  draftId: string;
  resourceId: string;
  taskId: string;
  proposedVersionNumber: number;
  parentVersionId?: string;
  materialVersionId?: string;
  title: string;
  questionStem: string;
  questionType: StructuredQuestionType;
  responseFormat: QuestionResponseFormat;
  options?: string[];
  assessmentMode: AssessmentMode;
  answerAcceptance?: AnswerAcceptance;
  rubric: QuestionResourceRubricItem[];
  minimumAnswerRequirement: MinimumAnswerRequirement;
  abilityMetadata: QuestionAbilityMetadata;
  source: QuestionSource;
  tags: string[];
  qualityRevisionProgress?: QuestionQualityRevisionProgressSnapshot;
  status: QuestionResourceDraftStatus;
  revision: number;
  latestValidationId?: string;
  latestReviewId?: string;
  createdAt: string;
  updatedAt: string;
  version: typeof QUESTION_RESOURCE_ADMISSION_VERSION;
  schemaVersion: typeof QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION;
};

export type ResourceValidationSeverity = 'error' | 'warning';

export type ResourceValidationIssue = {
  code: string;
  field: string;
  severity: ResourceValidationSeverity;
  message: string;
};

export type ResourceValidationChecks = {
  identityValid: boolean;
  contentValid: boolean;
  answerAcceptanceValid: boolean;
  rubricValid: boolean;
  abilityAndRoleValid: boolean;
  versionLineageValid: boolean;
  materialValid: boolean;
};

export type ResourceValidationResult = {
  validationId: string;
  draftId: string;
  resourceId: string;
  validatedDraftRevision: number;
  validationRuleVersion: typeof QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION;
  passed: boolean;
  checks: ResourceValidationChecks;
  issues: ResourceValidationIssue[];
  checkedAt: string;
};

export type ResourceReviewAction = 'approve' | 'revision_required' | 'reject';

export type ReviewWarningDecision = {
  warningDecisionId: string;
  draftId: string;
  draftRevision: number;
  assessmentId: string;
  warningCode: string;
  decision: 'accepted' | 'rejected';
  reviewedBy: string;
  reviewedAt: string;
};

export type ResourceReviewDecision = {
  reviewId: string;
  draftId: string;
  resourceId: string;
  reviewedDraftRevision: number;
  validationId: string;
  action: ResourceReviewAction;
  reviewerId: string;
  notes: string;
  reviewedAt: string;
  warningDecisions?: ReviewWarningDecision[];
};

export type FrozenQuestionResourceStatus = 'frozen' | 'superseded' | 'retired';

export type FrozenQuestionResourceVersion = {
  resourceId: string;
  resourceVersionId: string;
  versionNumber: number;
  parentVersionId?: string;
  sourceDraftId: string;
  materialId?: string;
  materialVersionId?: string;
  materialSnapshot?: QuestionMaterialVersion;
  taskId: string;
  title: string;
  questionStem: string;
  questionType: StructuredQuestionType;
  responseFormat: QuestionResponseFormat;
  options?: string[];
  assessmentMode: AssessmentMode;
  answerAcceptance?: AnswerAcceptance;
  rubric: QuestionResourceRubricItem[];
  minimumAnswerRequirement: MinimumAnswerRequirement;
  abilityMetadata: QuestionAbilityMetadata;
  source: QuestionSource;
  tags: string[];
  validationId: string;
  reviewId: string;
  status: FrozenQuestionResourceStatus;
  frozenAt: string;
  updatedAt: string;
  version: typeof QUESTION_RESOURCE_ADMISSION_VERSION;
  schemaVersion: typeof QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION;
};

export type ResourceRegistryStatus = 'active' | 'retired' | 'no_frozen_version';

export type ResourceRegistryEntry = {
  resourceId: string;
  currentFrozenVersionId?: string;
  status: ResourceRegistryStatus;
  latestReviewId?: string;
  latestValidationId?: string;
  materialId?: string;
  taskId: string;
  abilityId: PrimaryAbilityId;
  taskRole: RecommendedTaskRole;
  difficulty: QuestionResourceDifficulty;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: typeof QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION;
};

export type ResourceFreezeCommit = {
  version: FrozenQuestionResourceVersion;
  registryEntry: ResourceRegistryEntry;
  previousVersionId?: string;
};

export type ResourceFreezeResult = {
  version: FrozenQuestionResourceVersion;
  registryEntry: ResourceRegistryEntry;
  inserted: boolean;
};

export type ResourceRegistryConsistencyResult = {
  passed: boolean;
  issues: string[];
};

export function isPrimaryAbilityId(value: unknown): value is PrimaryAbilityId {
  return typeof value === 'string' && PRIMARY_ABILITY_IDS.includes(value as PrimaryAbilityId);
}

export function isQuestionResourceTaskRole(value: unknown): value is RecommendedTaskRole {
  return typeof value === 'string' && QUESTION_RESOURCE_TASK_ROLES.includes(value as RecommendedTaskRole);
}

export function isQuestionResourceDifficulty(value: unknown): value is QuestionResourceDifficulty {
  return typeof value === 'string' && QUESTION_RESOURCE_DIFFICULTIES.includes(value as QuestionResourceDifficulty);
}

export function isStructuredQuestionType(value: unknown): value is StructuredQuestionType {
  return typeof value === 'string' && STRUCTURED_QUESTION_TYPES.includes(value as StructuredQuestionType);
}

export function isQuestionResponseFormat(value: unknown): value is QuestionResponseFormat {
  return typeof value === 'string' && QUESTION_RESPONSE_FORMATS.includes(value as QuestionResponseFormat);
}

export function isStructuredQuestionDraft(value: unknown): value is StructuredQuestionDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as StructuredQuestionDraft;

  return (
    isNonEmptyString(draft.draftId) &&
    isNonEmptyString(draft.resourceId) &&
    isNonEmptyString(draft.taskId) &&
    isPositiveInteger(draft.proposedVersionNumber) &&
    (draft.parentVersionId === undefined || isNonEmptyString(draft.parentVersionId)) &&
    (draft.materialVersionId === undefined || isNonEmptyString(draft.materialVersionId)) &&
    typeof draft.title === 'string' &&
    typeof draft.questionStem === 'string' &&
    isStructuredQuestionType(draft.questionType) &&
    isQuestionResponseFormat(draft.responseFormat) &&
    (draft.options === undefined || Array.isArray(draft.options)) &&
    Array.isArray(draft.rubric) &&
    Boolean(draft.minimumAnswerRequirement) &&
    Boolean(draft.abilityMetadata) &&
    Boolean(draft.source) &&
    Array.isArray(draft.tags) &&
    ['drafted', 'validation_failed', 'pending_review', 'revision_required', 'reviewed', 'rejected', 'archived'].includes(draft.status) &&
    isPositiveInteger(draft.revision) &&
    isNonEmptyString(draft.createdAt) &&
    isNonEmptyString(draft.updatedAt) &&
    draft.version === QUESTION_RESOURCE_ADMISSION_VERSION &&
    draft.schemaVersion === QUESTION_RESOURCE_ADMISSION_SCHEMA_VERSION
  );
}

export function cloneQuestionResourceValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
