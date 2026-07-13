import type { QuestionMetadataRubricItem } from '../schemas/diagnosis.schema.ts';
import type {
  ConcreteLearningTask,
  ConcreteLearningTaskInstantiationInput,
  ConcreteLearningTaskInstantiationResult,
  TaskReadinessIssue,
  TaskReadinessValidation,
} from '../schemas/concreteLearningTask.schema.ts';
import type {
  ExecutableLearningTask,
  TaskGenerationRequest,
} from '../schemas/taskFulfillment.schema.ts';

type MockTaskTemplate = {
  readingText: string;
  question: string;
  answerRequirements: string[];
  referenceAnswer: string;
  scoringPoints: string[];
  rubric: QuestionMetadataRubricItem[];
  expectedDiagnosisFocus: string[];
};

const DEFAULT_CREATED_AT = '2026-07-13T09:00:00.000Z';

const reasoningRetestTemplate: MockTaskTemplate = {
  readingText:
    '傍晚，父亲把旧书一本本擦干净，又把折角的书页压平。' +
    '我问他为什么还要整理这些旧书，父亲说：“有些东西旧了，但不能随便丢。”' +
    '说完，他把其中一本童话书放回我的书架，站在门口看了很久。',
  question: '从父亲整理旧书并停留观看的行为中，可以推断出他怎样的心理？请结合文本说明。',
  answerRequirements: [
    '先找出文本中的关键行为或细节。',
    '说明这些行为与人物心理之间的关系。',
    '用完整句子表达推断结论。',
  ],
  referenceAnswer:
    '可以推断父亲舍不得过去与孩子共同阅读的回忆，也珍惜和牵挂孩子。依据是他仔细整理旧书，并把童话书放回书架、站在门口看了很久。',
  scoringPoints: [
    '能提取“整理旧书”“放回童话书”“站在门口看了很久”等文本线索。',
    '能从行为线索推断父亲的不舍、怀念或牵挂。',
    '能说明文本依据与心理结论之间的关系。',
  ],
  rubric: [
    {
      id: 'clue_extraction',
      name: '文本线索',
      description: '是否提取支撑推断的关键行为或细节。',
      ability: '推理',
      weight: 30,
    },
    {
      id: 'inference_chain',
      name: '推理链',
      description: '是否说明行为线索如何支持人物心理判断。',
      ability: '推理',
      weight: 40,
    },
    {
      id: 'conclusion_expression',
      name: '结论表达',
      description: '是否完整表达人物心理结论。',
      ability: '表达',
      weight: 30,
    },
  ],
  expectedDiagnosisFocus: [
    '是否能够从文本行为线索推断人物心理。',
    '是否能够说明文本依据与推断结论之间的关系。',
  ],
};

export function instantiateConcreteLearningTask(
  input: ConcreteLearningTaskInstantiationInput,
): ConcreteLearningTaskInstantiationResult {
  const inputType = input.executableTask
    ? 'executable_task'
    : input.generationRequest
      ? 'generation_request'
      : 'invalid';

  if (inputType === 'invalid') {
    const readiness = buildReadinessValidation(null, undefined, undefined);
    return {
      inputType,
      concreteTask: null,
      readiness,
    };
  }

  const concreteTask = input.executableTask
    ? buildFromExecutableTask(input.executableTask, input.createdAt)
    : buildFromGenerationRequest(input.generationRequest as TaskGenerationRequest, input.studentId, input.createdAt);

  const withOverrides = {
    ...concreteTask,
    ...input.overrides,
  };

  const readiness = buildReadinessValidation(
    withOverrides,
    input.executableTask || undefined,
    input.generationRequest || undefined,
  );

  return {
    inputType,
    concreteTask: withOverrides,
    readiness,
  };
}

export function buildReadinessValidation(
  task: ConcreteLearningTask | null,
  executableTask?: ExecutableLearningTask,
  generationRequest?: TaskGenerationRequest,
): TaskReadinessValidation {
  const issues: TaskReadinessIssue[] = [];
  const taskId = task?.taskId || 'missing-task';
  const requiresReadingText = task ? requiresReadingMaterial(task) : true;
  const hasReadingText = !requiresReadingText || isNonEmptyString(task?.readingText);
  const hasQuestion = isNonEmptyString(task?.question);
  const canDisplay = Boolean(task && hasQuestion && hasReadingText);
  const canAcceptResponse = Boolean(task && Array.isArray(task.answerRequirements) && task.answerRequirements.some(isNonEmptyString));
  const hasAssessmentBasis = Boolean(task && (
    isNonEmptyString(task.referenceAnswer) ||
    task.scoringPoints.some(isNonEmptyString) ||
    task.rubric.length > 0
  ));
  const metadataComplete = Boolean(task && (
    isNonEmptyString(task.questionMetadata?.questionType) &&
    isNonEmptyString(task.questionMetadata?.assessmentMode) &&
    isNonEmptyString(task.questionMetadata?.mainAbility) &&
    Array.isArray(task.questionMetadata?.abilityPath) &&
    task.questionMetadata.abilityPath.length > 0 &&
    Array.isArray(task.questionMetadata?.rubric) &&
    task.questionMetadata.rubric.length > 0
  ));
  const targetAbilityAligned = Boolean(task && (
    sameAbility(task.questionMetadata?.mainAbility, task.targetAbilityId) &&
    task.rubric.some((item) => sameAbility(item.ability, task.targetAbilityId))
  ));
  const sourceTaskRole = executableTask?.taskRole || generationRequest?.taskRole;
  const taskRoleAligned = Boolean(task && sourceTaskRole && task.taskRole === sourceTaskRole);
  const sourceValidationGoal = executableTask?.validationGoal || generationRequest?.validationGoal;
  const validationGoalPreserved = Boolean(task && sourceValidationGoal && task.validationGoal === sourceValidationGoal);
  const sourceTraceable = Boolean(task && (
    isNonEmptyString(task.sourceTaskRequestId) &&
    isNonEmptyString(task.sourceFulfillmentRequestId) &&
    (isNonEmptyString(task.sourceExecutableTaskId) || isNonEmptyString(task.sourceTaskGenerationRequestId))
  ));
  const canEnterDiagnosisRuntime = Boolean(
    canDisplay &&
    canAcceptResponse &&
    hasAssessmentBasis &&
    metadataComplete &&
    targetAbilityAligned,
  );

  if (!canDisplay) {
    issues.push({
      code: 'MISSING_DISPLAY_CONTENT',
      message: requiresReadingText
        ? '任务缺少可展示的题干或阅读材料。'
        : '任务缺少可展示的题干。',
      recoverable: true,
      details: { requiresReadingText },
    });
  }
  if (!canAcceptResponse) {
    issues.push({
      code: 'MISSING_RESPONSE_REQUIREMENTS',
      message: '任务缺少明确作答要求。',
      recoverable: true,
    });
  }
  if (!hasAssessmentBasis) {
    issues.push({
      code: 'MISSING_ASSESSMENT_BASIS',
      message: '任务缺少 referenceAnswer、scoringPoints 或 rubric，无法稳定诊断。',
      recoverable: true,
    });
  }
  if (!metadataComplete) {
    issues.push({
      code: 'INCOMPLETE_METADATA',
      message: '任务缺少完整 QuestionMetadata。',
      recoverable: true,
    });
  }
  if (!targetAbilityAligned) {
    issues.push({
      code: 'TARGET_ABILITY_MISMATCH',
      message: '任务目标能力与 QuestionMetadata 或 Rubric 主能力不一致。',
      recoverable: true,
      details: {
        targetAbilityId: task?.targetAbilityId,
        metadataMainAbility: task?.questionMetadata?.mainAbility,
      },
    });
  }
  if (!taskRoleAligned) {
    issues.push({
      code: 'TASK_ROLE_MISMATCH',
      message: '任务角色与上游来源不一致。',
      recoverable: true,
    });
  }
  if (!validationGoalPreserved) {
    issues.push({
      code: 'VALIDATION_GOAL_MISSING',
      message: '任务验证目标缺失或未保留上游 validationGoal。',
      recoverable: true,
    });
  }
  if (!sourceTraceable) {
    issues.push({
      code: 'SOURCE_NOT_TRACEABLE',
      message: '任务缺少可追溯的来源 ID。',
      recoverable: true,
    });
  }
  if (!canEnterDiagnosisRuntime) {
    issues.push({
      code: 'DIAGNOSIS_RUNTIME_NOT_READY',
      message: '任务尚不具备进入 Diagnosis Runtime 的条件。',
      recoverable: true,
    });
  }

  const checks = {
    canDisplay,
    canAcceptResponse,
    hasAssessmentBasis,
    metadataComplete,
    targetAbilityAligned,
    taskRoleAligned,
    validationGoalPreserved,
    sourceTraceable,
    canEnterDiagnosisRuntime,
  };

  return {
    taskId,
    canExecute: Object.values(checks).every(Boolean),
    checks,
    issues,
  };
}

function buildFromExecutableTask(
  executableTask: ExecutableLearningTask,
  createdAt = DEFAULT_CREATED_AT,
): ConcreteLearningTask {
  return {
    taskId: `concrete-${executableTask.executableTaskId}`,
    studentId: executableTask.studentId,
    sourceType: 'matched_resource',
    sourceTaskRequestId: executableTask.sourceTaskRequestId,
    sourceFulfillmentRequestId: executableTask.sourceFulfillmentRequestId,
    sourceExecutableTaskId: executableTask.executableTaskId,
    sourceStrategyId: executableTask.sourceStrategyId,
    targetAbilityId: executableTask.targetAbilityId,
    targetAbilityName: executableTask.targetAbilityId,
    taskRole: executableTask.taskRole,
    validationGoal: executableTask.validationGoal,
    ...buildTaskContent(executableTask.targetAbilityId),
    createdAt,
  };
}

function buildFromGenerationRequest(
  generationRequest: TaskGenerationRequest,
  studentId = 'demo-student',
  createdAt = DEFAULT_CREATED_AT,
): ConcreteLearningTask {
  return {
    taskId: `concrete-${generationRequest.generationRequestId}`,
    studentId,
    sourceType: 'generated_request',
    sourceTaskRequestId: generationRequest.sourceTaskRequestId,
    sourceFulfillmentRequestId: generationRequest.sourceFulfillmentRequestId,
    sourceTaskGenerationRequestId: generationRequest.generationRequestId,
    sourceStrategyId: generationRequest.sourceStrategyId,
    targetAbilityId: generationRequest.targetAbilityId,
    targetAbilityName: generationRequest.targetAbilityId,
    taskRole: generationRequest.taskRole,
    validationGoal: generationRequest.validationGoal,
    ...buildTaskContent(generationRequest.targetAbilityId),
    createdAt,
  };
}

function buildTaskContent(targetAbilityId: string): Omit<
  ConcreteLearningTask,
  | 'taskId'
  | 'studentId'
  | 'sourceType'
  | 'sourceTaskRequestId'
  | 'sourceFulfillmentRequestId'
  | 'sourceExecutableTaskId'
  | 'sourceTaskGenerationRequestId'
  | 'sourceStrategyId'
  | 'targetAbilityId'
  | 'targetAbilityName'
  | 'taskRole'
  | 'validationGoal'
  | 'createdAt'
> {
  const template = reasoningRetestTemplate;
  return {
    readingText: template.readingText,
    question: template.question,
    answerRequirements: template.answerRequirements,
    referenceAnswer: template.referenceAnswer,
    scoringPoints: template.scoringPoints,
    rubric: template.rubric,
    questionMetadata: {
      subject: '语文',
      grade: '初中',
      questionType: '推理',
      assessmentMode: 'reasoning_chain',
      mainAbility: targetAbilityId,
      relatedAbilities: ['信息提取', '理解', '表达'],
      abilityPath: ['信息提取', '语境理解', '推理链构建', '结论表达'],
      difficulty: 'same',
      rubric: template.rubric,
      trainingDirection: ['文本线索提取', '推理链表达'],
    },
    expectedDiagnosisFocus: template.expectedDiagnosisFocus,
  };
}

function requiresReadingMaterial(task: ConcreteLearningTask): boolean {
  const questionType = task.questionMetadata.questionType || '';
  const assessmentMode = task.questionMetadata.assessmentMode || '';
  const readingQuestionTypes = ['信息提取', '概括', '句子含义', '推理', '人物形象分析', '作用分析', '表达效果', '阅读简答'];

  if (readingQuestionTypes.includes(questionType)) return true;
  if (['key_points', 'reasoning_chain'].includes(assessmentMode) && questionType !== '表达') return true;
  return false;
}

function sameAbility(left: unknown, right: unknown): boolean {
  return typeof left === 'string' && typeof right === 'string' && left.trim() === right.trim();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
