import { instantiateConcreteLearningTask } from './concreteLearningTaskAgent.ts';
import { branchTaskFulfillment } from './taskFulfillmentBranchingAgent.ts';
import { matchTaskResources } from './taskResourceMatchingAgent.ts';
import type {
  ConcreteLearningTask,
  ConcreteLearningTaskInstantiationResult,
} from '../schemas/concreteLearningTask.schema.ts';
import type { AssessmentMode, QuestionMetadataRubricItem } from '../schemas/diagnosis.schema.ts';
import type { RecommendedTaskRole } from '../schemas/nextLearningStrategy.schema.ts';
import type {
  AvailableTaskResource,
  TaskFulfillmentRequest,
  TaskResourceMatchResult,
} from '../schemas/taskFulfillment.schema.ts';
import {
  TASK_RESOURCE_SCHEMA_VERSION,
  TASK_RESOURCE_VERSION,
  type TaskResource,
  type TaskResourceDraft,
  type TaskResourceInput,
  type TaskResourceQuestionType,
  type TaskResourceValidationResult,
} from '../schemas/taskResource.schema.ts';

export type CreateTaskResourceDraftInput = {
  input: TaskResourceInput;
  studentId?: string;
  draftId?: string;
  createdAt?: string;
};

export type TaskResourceCreationInput = {
  draft: TaskResourceDraft;
  existingResourceIds?: string[];
  createdAt?: string;
  resourceId?: string;
  taskRole?: RecommendedTaskRole;
};

export type TaskResourcePreparationInput = {
  resource: TaskResource;
  fulfillmentRequest: TaskFulfillmentRequest;
  createdAt?: string;
};

export type TaskResourcePreparationResult = {
  resource: TaskResource;
  availableTaskResource: AvailableTaskResource;
  matchResult: TaskResourceMatchResult;
  concreteTaskResult: ConcreteLearningTaskInstantiationResult;
};

export function createTaskResourceDraft(input: CreateTaskResourceDraftInput): TaskResourceDraft {
  const now = input.createdAt || new Date().toISOString();
  const draft: TaskResourceDraft = {
    draftId: input.draftId || `draft-${stableId(input.input.questionText || now)}`,
    studentId: input.studentId,
    input: normalizeInput(input.input),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    version: TASK_RESOURCE_VERSION,
    schemaVersion: TASK_RESOURCE_SCHEMA_VERSION,
  };
  const validation = validateTaskResourceDraft(draft);

  return {
    ...draft,
    status: validation.canCreateResource ? 'ready' : validation.issues.length > 0 ? 'validation_failed' : 'draft',
  };
}

export function validateTaskResourceDraft(
  draft: TaskResourceDraft,
  existingResourceIds: string[] = [],
  resourceId = buildResourceId(draft),
): TaskResourceValidationResult {
  const input = draft.input;
  const readingTextRequired = requiresReadingText(input.questionType);
  const readingTextProvided = !readingTextRequired || hasText(input.readingText);
  const validRubric = normalizeRubric(input.rubric, input.assessmentBasis, input.targetAbilityId);
  const hasAssessmentBasis = (
    hasText(input.referenceAnswer) ||
    input.assessmentBasis.some(hasText) ||
    validRubric.length > 0
  );
  const hasSource = isTraceableSource(input.source);
  const abilityAligned = (
    hasText(input.targetAbilityId) &&
    (validRubric.length === 0 || validRubric.some((item) => item.ability === input.targetAbilityId))
  );
  const checks = {
    hasQuestionText: hasText(input.questionText),
    hasAnswerRequirements: input.answerRequirements.some(hasText),
    hasAssessmentBasis,
    hasTargetAbility: hasText(input.targetAbilityId),
    hasSource,
    readingTextRequired,
    readingTextProvided,
    abilityAligned,
    metadataReady: hasText(input.questionType) && hasAssessmentBasis,
    traceable: hasSource,
    resourceIdUnique: !existingResourceIds.includes(resourceId),
  };
  const issues = buildValidationIssues(checks);
  const blockingIssues = issues.filter((issue) => issue.blocking);

  return {
    draftId: draft.draftId,
    canSaveDraft: true,
    canCreateResource: blockingIssues.length === 0,
    canEnterTaskFulfillment: blockingIssues.length === 0,
    checks,
    issues,
  };
}

export function createTaskResource(input: TaskResourceCreationInput): {
  resource: TaskResource | null;
  validation: TaskResourceValidationResult;
} {
  const resourceId = input.resourceId || buildResourceId(input.draft);
  const validation = validateTaskResourceDraft(input.draft, input.existingResourceIds || [], resourceId);

  if (!validation.canCreateResource) {
    return {
      resource: null,
      validation,
    };
  }

  const now = input.createdAt || new Date().toISOString();
  const normalizedInput = normalizeInput(input.draft.input);
  const rubric = normalizeRubric(
    normalizedInput.rubric,
    normalizedInput.assessmentBasis,
    normalizedInput.targetAbilityId,
  );
  const resource: TaskResource = {
    resourceId,
    externalResourceId: normalizedInput.externalResourceId,
    title: normalizedInput.title || buildDefaultTitle(normalizedInput),
    readingText: normalizedInput.readingText,
    questionText: normalizedInput.questionText,
    answerRequirements: normalizedInput.answerRequirements,
    questionType: normalizedInput.questionType,
    targetAbilityId: normalizedInput.targetAbilityId,
    referenceAnswer: normalizedInput.referenceAnswer,
    assessmentBasis: normalizedInput.assessmentBasis,
    rubric,
    status: 'ready',
    source: normalizedInput.source,
    availableTaskResource: buildAvailableTaskResource(resourceId, normalizedInput, input.taskRole || 'retest'),
    createdAt: now,
    updatedAt: now,
    version: TASK_RESOURCE_VERSION,
    schemaVersion: TASK_RESOURCE_SCHEMA_VERSION,
  };

  return {
    resource,
    validation,
  };
}

export function prepareConcreteLearningTaskFromResource(
  input: TaskResourcePreparationInput,
): TaskResourcePreparationResult {
  const availableTaskResource = input.resource.availableTaskResource;
  const matchResult = matchTaskResources({
    fulfillmentRequest: input.fulfillmentRequest,
    availableTaskResources: [availableTaskResource],
  });
  const branchResult = branchTaskFulfillment({
    fulfillmentRequest: input.fulfillmentRequest,
    matchResult,
    availableTaskResources: [availableTaskResource],
    createdAt: input.createdAt,
  });
  const concreteTaskResult = instantiateConcreteLearningTask({
    executableTask: branchResult.executableTask,
    generationRequest: branchResult.generationRequest,
    studentId: input.fulfillmentRequest.studentId,
    createdAt: input.createdAt,
    overrides: branchResult.executableTask
      ? buildConcreteTaskOverrides(input.resource, input.fulfillmentRequest)
      : undefined,
  });

  return {
    resource: input.resource,
    availableTaskResource,
    matchResult,
    concreteTaskResult,
  };
}

function buildConcreteTaskOverrides(
  resource: TaskResource,
  request: TaskFulfillmentRequest,
): Partial<ConcreteLearningTask> {
  return {
    readingText: resource.readingText,
    question: resource.questionText,
    answerRequirements: resource.answerRequirements,
    referenceAnswer: resource.referenceAnswer,
    scoringPoints: resource.assessmentBasis,
    rubric: resource.rubric,
    targetAbilityId: resource.targetAbilityId,
    targetAbilityName: resource.targetAbilityId,
    validationGoal: request.validationGoal,
    questionMetadata: {
      questionId: resource.resourceId,
      subject: '语文',
      grade: resource.source.grade || '初中',
      questionType: mapToMetadataQuestionType(resource.questionType, resource.targetAbilityId),
      assessmentMode: mapAssessmentMode(resource.questionType),
      mainAbility: resource.targetAbilityId,
      relatedAbilities: inferRelatedAbilities(resource.targetAbilityId),
      abilityPath: inferAbilityPath(resource.targetAbilityId),
      difficulty: request.difficultyRange.preferred,
      rubric: resource.rubric,
      trainingDirection: resource.assessmentBasis,
    },
    expectedDiagnosisFocus: resource.assessmentBasis.length > 0
      ? resource.assessmentBasis
      : resource.rubric.map((item) => item.name),
  };
}

function buildAvailableTaskResource(
  resourceId: string,
  input: TaskResourceInput,
  taskRole: RecommendedTaskRole,
): AvailableTaskResource {
  return {
    taskId: resourceId,
    taskRole,
    targetAbilityIds: [input.targetAbilityId],
    difficulty: 'same',
    contentType: requiresReadingText(input.questionType) ? 'comparable_text' : 'short_text',
    questionType: 'open_response',
    responseMode: 'written',
    capabilities: inferCapabilities(input),
    validationTags: inferValidationTags(taskRole),
    source: 'manual',
    title: input.title || buildDefaultTitle(input),
    contentRef: `task-resource://${resourceId}/content`,
    questionRef: `task-resource://${resourceId}/question`,
    rubricRef: `task-resource://${resourceId}/rubric`,
  };
}

function buildValidationIssues(
  checks: TaskResourceValidationResult['checks'],
): TaskResourceValidationResult['issues'] {
  const issues: TaskResourceValidationResult['issues'] = [];

  if (!checks.hasQuestionText) issues.push(issue('MISSING_QUESTION_TEXT', '题干不能为空。'));
  if (!checks.hasAnswerRequirements) issues.push(issue('MISSING_ANSWER_REQUIREMENTS', '作答要求至少需要一条。'));
  if (!checks.hasAssessmentBasis) issues.push(issue('MISSING_ASSESSMENT_BASIS', '缺少 referenceAnswer、assessmentBasis 或有效 rubric。'));
  if (!checks.hasTargetAbility) issues.push(issue('MISSING_TARGET_ABILITY', '目标能力不能为空。'));
  if (checks.readingTextRequired && !checks.readingTextProvided) issues.push(issue('MISSING_READING_TEXT', '阅读类题目必须提供阅读材料。'));
  if (!checks.hasSource) issues.push(issue('SOURCE_NOT_TRACEABLE', '题目来源不可追溯。'));
  if (!checks.abilityAligned) issues.push(issue('TARGET_ABILITY_MISMATCH', '目标能力与 rubric 能力不一致。'));
  if (!checks.resourceIdUnique) issues.push(issue('DUPLICATE_RESOURCE_ID', 'resourceId 已存在，不能静默覆盖正式资源。'));

  return issues;
}

function issue(code: string, message: string): TaskResourceValidationResult['issues'][number] {
  return {
    code,
    message,
    blocking: true,
  };
}

function normalizeInput(input: TaskResourceInput): TaskResourceInput {
  return {
    ...input,
    title: cleanOptional(input.title),
    externalResourceId: cleanOptional(input.externalResourceId),
    readingText: cleanOptional(input.readingText),
    questionText: input.questionText.trim(),
    answerRequirements: input.answerRequirements.map((item) => item.trim()).filter(Boolean),
    targetAbilityId: input.targetAbilityId.trim(),
    referenceAnswer: cleanOptional(input.referenceAnswer),
    assessmentBasis: input.assessmentBasis.map((item) => item.trim()).filter(Boolean),
    rubric: input.rubric?.filter((item) => hasText(item.name) || hasText(item.description)),
    source: {
      ...input.source,
      description: cleanOptional(input.source.description),
      title: cleanOptional(input.source.title),
      grade: cleanOptional(input.source.grade),
      edition: cleanOptional(input.source.edition),
      year: cleanOptional(input.source.year),
      pageOrQuestionNo: cleanOptional(input.source.pageOrQuestionNo),
    },
  };
}

function normalizeRubric(
  rubric: QuestionMetadataRubricItem[] | undefined,
  assessmentBasis: string[],
  targetAbilityId: string,
): QuestionMetadataRubricItem[] {
  const explicitRubric = (rubric || []).filter((item) => hasText(item.name) || hasText(item.description));
  if (explicitRubric.length > 0) {
    return explicitRubric.map((item, index) => ({
      id: item.id || `rubric_${index + 1}`,
      name: item.name || item.description || `评价点 ${index + 1}`,
      description: item.description || item.name,
      ability: item.ability || targetAbilityId,
      weight: item.weight || Math.round(100 / explicitRubric.length),
      required: item.required ?? true,
    }));
  }

  return assessmentBasis
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index, list) => ({
      id: `basis_${index + 1}`,
      name: `评价依据 ${index + 1}`,
      description: item,
      ability: targetAbilityId,
      weight: Math.round(100 / list.length),
      required: true,
    }));
}

function inferCapabilities(input: TaskResourceInput): string[] {
  const base = ['open_response', 'ability_observation', 'independent_answer'];
  if (requiresReadingText(input.questionType)) base.push('text_evidence');
  if (input.targetAbilityId === '推理') base.push('inference_chain');
  if (input.targetAbilityId === '表达') base.push('focused_practice');
  return unique(base);
}

function inferValidationTags(taskRole: RecommendedTaskRole): string[] {
  if (taskRole === 'retest') return ['independent_retest', 'general_validation'];
  if (taskRole === 'training') return ['focused_training', 'general_validation'];
  if (taskRole === 'transfer') return ['transfer_validation', 'general_validation'];
  if (taskRole === 'diagnosis') return ['diagnostic_probe', 'general_validation'];
  return ['general_validation'];
}

function requiresReadingText(questionType: TaskResourceQuestionType): boolean {
  return questionType === 'reading_open_response';
}

function isTraceableSource(source: TaskResourceInput['source']): boolean {
  if (!source || !['manual', 'textbook', 'exam'].includes(source.type)) return false;
  if (source.type === 'manual') return true;
  return [
    source.description,
    source.title,
    source.grade,
    source.edition,
    source.year,
    source.pageOrQuestionNo,
  ].some(hasText);
}

function mapAssessmentMode(questionType: TaskResourceQuestionType): AssessmentMode {
  if (questionType === 'expression' || questionType === 'micro_writing') return 'expression_quality';
  return 'reasoning_chain';
}

function mapToMetadataQuestionType(questionType: TaskResourceQuestionType, ability: string): string {
  if (questionType === 'sentence_interpretation') return '句子含义';
  if (questionType === 'expression') return '表达';
  if (questionType === 'micro_writing') return '表达';
  return ability;
}

function inferRelatedAbilities(ability: string): string[] {
  if (ability === '推理') return ['信息提取', '理解', '表达'];
  if (ability === '概括') return ['信息提取', '要点筛选', '表达'];
  if (ability === '理解') return ['信息提取', '语境分析', '表达'];
  return ['信息提取', '理解', '表达'];
}

function inferAbilityPath(ability: string): string[] {
  if (ability === '推理') return ['信息提取', '语境理解', '推理链构建', '结论表达'];
  if (ability === '概括') return ['信息提取', '要点筛选', '主题提炼', '简洁表达'];
  if (ability === '理解') return ['字词理解', '语境分析', '深层含义理解', '情感体会'];
  return ['理解任务要求', '组织答案', '清晰表达'];
}

function buildResourceId(draft: TaskResourceDraft): string {
  return `resource-${stableId(`${draft.draftId}-${draft.input.questionText}`)}`;
}

function buildDefaultTitle(input: TaskResourceInput): string {
  const ability = input.targetAbilityId || '语文';
  if (input.questionType === 'reading_open_response') return `${ability}阅读题`;
  if (input.questionType === 'sentence_interpretation') return `${ability}句子含义题`;
  if (input.questionType === 'micro_writing') return `${ability}微写作题`;
  return `${ability}表达题`;
}

function stableId(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function cleanOptional(value: string | undefined): string | undefined {
  const cleanValue = value?.trim();
  return cleanValue || undefined;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
