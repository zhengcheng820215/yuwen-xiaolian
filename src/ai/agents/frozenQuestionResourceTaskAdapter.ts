import { instantiateConcreteLearningTask } from './concreteLearningTaskAgent.ts';
import type {
  ConcreteLearningTask,
  ConcreteLearningTaskInstantiationResult,
} from '../schemas/concreteLearningTask.schema.ts';
import type { QuestionMetadataRubricItem } from '../schemas/diagnosis.schema.ts';
import type { FrozenQuestionResourceVersion } from '../schemas/questionResourceAdmission.schema.ts';
import type { QualityGatedExecutableTask } from '../schemas/resourceMatchQuality.schema.ts';
import {
  buildDeterministicSingleChoiceOptionOrder,
  createStudentSingleChoiceDelivery,
} from '../schemas/singleChoiceInteraction.schema.ts';

export type FrozenQuestionResourceTaskPreparationResult = {
  status: 'prepared' | 'blocked';
  concreteTaskResult: ConcreteLearningTaskInstantiationResult;
  issues: string[];
};

export function prepareConcreteLearningTaskFromFrozenResource(input: {
  resourceVersion: FrozenQuestionResourceVersion;
  qualityGatedTask: QualityGatedExecutableTask;
  learningIntent?: ConcreteLearningTask['learningIntent'];
  createdAt?: string;
}): FrozenQuestionResourceTaskPreparationResult {
  const issues = validateIdentity(input.resourceVersion, input.qualityGatedTask);
  if (issues.length > 0) {
    return {
      status: 'blocked',
      concreteTaskResult: instantiateConcreteLearningTask({ createdAt: input.createdAt }),
      issues,
    };
  }

  const concreteTaskResult = instantiateConcreteLearningTask({
    executableTask: input.qualityGatedTask.executableTask,
    createdAt: input.createdAt,
    overrides: buildConcreteTaskOverrides(
      input.resourceVersion,
      input.qualityGatedTask.executableTask.studentId,
      input.learningIntent,
    ),
  });
  if (!concreteTaskResult.concreteTask || !concreteTaskResult.readiness.canExecute) {
    return {
      status: 'blocked',
      concreteTaskResult,
      issues: concreteTaskResult.readiness.issues.map((item) => item.code),
    };
  }

  return {
    status: 'prepared',
    concreteTaskResult,
    issues: [],
  };
}

function validateIdentity(
  version: FrozenQuestionResourceVersion,
  task: QualityGatedExecutableTask,
): string[] {
  const issues: string[] = [];
  if (version.status !== 'frozen') issues.push('resource_version_not_frozen');
  if (version.resourceId !== task.resourceId) issues.push('resource_id_mismatch');
  if (version.resourceVersionId !== task.resourceVersionId) issues.push('resource_version_id_mismatch');
  if (version.taskId !== task.taskId) issues.push('task_id_mismatch');
  if (version.taskId !== task.executableTask.sourceTaskId) issues.push('source_task_id_mismatch');
  if (version.abilityMetadata.abilityId !== task.executableTask.targetAbilityId) {
    issues.push('target_ability_mismatch');
  }
  if (version.abilityMetadata.taskRole !== task.executableTask.taskRole) {
    issues.push('task_role_mismatch');
  }
  if (version.materialId !== task.materialId) issues.push('material_id_mismatch');
  if (version.materialVersionId !== task.materialVersionId) issues.push('material_version_id_mismatch');
  return issues;
}

function buildConcreteTaskOverrides(
  version: FrozenQuestionResourceVersion,
  studentId: string,
  learningIntent?: ConcreteLearningTask['learningIntent'],
): Partial<ConcreteLearningTask> {
  const rubric: QuestionMetadataRubricItem[] = version.rubric.map((item) => ({
    id: item.itemId,
    name: item.name,
    description: [
      item.description,
      item.acceptedSignals.length > 0
        ? `可接受观察信号：${item.acceptedSignals.join('、')}。`
        : '',
    ].filter(Boolean).join(' '),
    ability: item.abilityId,
    weight: item.importance === 'critical' ? 50 : item.importance === 'important' ? 30 : 20,
    required: item.required,
  }));
  const scoringPoints = version.rubric.flatMap((item) => item.acceptedSignals || []);
  const acceptedAnswers = version.answerAcceptance?.acceptedAnswers || [];
  const acceptedKeywords = version.answerAcceptance?.acceptedKeywords || [];
  const targetAbilityId = version.abilityMetadata.abilityId;

  return {
    targetAbilityId,
    targetAbilityName: abilityDisplayName(targetAbilityId),
    learningIntent,
    readingText: version.materialSnapshot?.content,
    responseFormat: version.responseFormat === 'single_choice' ? 'single_choice' : 'text',
    singleChoiceDelivery: version.responseFormat === 'single_choice' && version.choiceInteraction
      ? createStudentSingleChoiceDelivery(
        version.choiceInteraction,
        buildDeterministicSingleChoiceOptionOrder(
          version.choiceInteraction,
          `${version.resourceVersionId}|${studentId}`,
        ),
      )
      : undefined,
    singleChoiceEvaluation: version.responseFormat === 'single_choice'
      ? version.choiceInteraction
      : undefined,
    question: version.questionStem,
    answerRequirements: buildAnswerRequirements(version),
    referenceAnswer: version.responseFormat === 'single_choice' ? undefined : acceptedAnswers[0] ||
      (scoringPoints.length > 0 ? scoringPoints.join('；') : acceptedKeywords.join('、')) ||
      undefined,
    scoringPoints: scoringPoints.length > 0 ? scoringPoints : rubric.map((item) => item.description || item.name),
    rubric,
    questionMetadata: {
      questionId: version.resourceVersionId,
      subject: '语文',
      grade: version.abilityMetadata.gradeRange || '初中',
      questionType: metadataQuestionType(version.questionType, targetAbilityId),
      assessmentMode: version.assessmentMode,
      mainAbility: targetAbilityId,
      relatedAbilities: version.abilityMetadata.supportingAbilityIds,
      abilityPath: [targetAbilityId, ...version.abilityMetadata.supportingAbilityIds],
      difficulty: mapDifficulty(version.abilityMetadata.difficulty),
      answerAcceptance: version.answerAcceptance,
      rubric,
      trainingDirection: scoringPoints,
    },
    expectedDiagnosisFocus: version.rubric.map((item) => item.description || item.name),
  };
}

function buildAnswerRequirements(version: FrozenQuestionResourceVersion): string[] {
  if (version.responseFormat === 'single_choice') {
    return ['请选择一个最符合材料和题意的答案。'];
  }
  const requirements = [`至少作答 ${version.minimumAnswerRequirement.minLength} 个字。`];
  if (version.minimumAnswerRequirement.requireTextEvidence) requirements.push('需要提供文本依据。');
  if (version.minimumAnswerRequirement.requireExplanation) requirements.push('需要说明依据与结论的关系。');
  return requirements;
}

function metadataQuestionType(questionType: string, abilityId: string): string {
  if (questionType === 'multiple_choice') return '选择';
  if (questionType === 'true_false') return '判断';
  if (questionType === 'fill_blank') return '填空';
  if (abilityId === 'inference') return '推理';
  if (abilityId === 'summarization') return '概括';
  if (abilityId === 'expression') return '表达';
  return '阅读简答';
}

function mapDifficulty(value: string): 'lower' | 'same' | 'higher' {
  if (value === 'basic') return 'lower';
  if (value === 'advanced') return 'higher';
  return 'same';
}

function abilityDisplayName(value: string): string {
  const names: Record<string, string> = {
    extraction: '信息提取',
    comprehension: '理解',
    summarization: '概括',
    analysis: '分析',
    inference: '推理',
    expression: '表达',
  };
  return names[value] || value;
}
