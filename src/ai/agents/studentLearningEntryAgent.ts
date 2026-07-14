import type { LearningRoundStartResult } from '../schemas/learningRound.schema.ts';
import type {
  StudentLearningEntryInput,
  StudentLearningEntryState,
  StudentLearningEntryStatus,
  StudentLearningViewStatus,
} from '../schemas/studentLearningEntry.schema.ts';

const MIN_ANSWER_LENGTH = 2;

export function buildStudentLearningEntryState(
  input: StudentLearningEntryInput,
): StudentLearningEntryState {
  const { startResult } = input;
  const answerDraft = input.answerDraft || '';
  const concreteTask = startResult.concreteTask;
  const readiness = startResult.taskReadinessValidation;
  const canUseTask = startResult.status === 'ready_for_execution' &&
    Boolean(concreteTask) &&
    readiness?.canExecute === true;
  const displayTask = canUseTask ? concreteTask : undefined;
  const status = getEntryStatus(startResult);
  const canAnswer = canUseTask;
  const canSubmit = canAnswer && hasMinimumAnswerDraft(answerDraft);

  return {
    learningRoundId: startResult.learningRoundId,
    studentId: startResult.studentId,
    status,
    viewStatus: getViewStatus(status),
    taskTitle: displayTask ? buildTaskTitle(displayTask.taskRole, displayTask.targetAbilityName) : '学习任务暂未准备好',
    readingText: displayTask?.readingText,
    questionText: displayTask?.question || '当前任务暂时无法展示，请稍后重试。',
    answerRequirements: displayTask?.answerRequirements || ['请等待任务准备完成后再作答。'],
    successCriteriaText: displayTask?.scoringPoints?.length
      ? displayTask.scoringPoints
      : ['答案需要回应题目要求，并提供可分析的文本依据。'],
    studentRoundFocus: {
      title: displayTask ? `本轮关注：${displayTask.targetAbilityName}` : '本轮任务暂不可用',
      description: displayTask
        ? buildRoundFocusDescription(displayTask.targetAbilityName, displayTask.validationGoal)
        : '系统还没有准备好完整任务，请稍后重试。',
    },
    canAnswer,
    canSubmit,
    message: buildMessage(startResult, canAnswer, canSubmit, answerDraft),
    debugState: {
      startStatus: startResult.status,
      taskReadiness: readiness?.canExecute,
      sourceType: concreteTask?.sourceType,
      issues: collectIssues(startResult),
    },
  };
}

function getEntryStatus(startResult: LearningRoundStartResult): StudentLearningEntryStatus {
  if (startResult.status === 'ready_for_execution') {
    if (startResult.concreteTask && startResult.taskReadinessValidation?.canExecute) {
      return 'ready_to_answer';
    }

    return 'blocked';
  }

  if (startResult.status === 'review_required') return 'blocked';
  if (startResult.nextAction === 'regenerate_task' || startResult.nextAction === 'regenerate_strategy') {
    return 'retry_required';
  }

  return 'blocked';
}

function getViewStatus(status: StudentLearningEntryStatus): StudentLearningViewStatus {
  if (status === 'loading_task') return 'loading_task';
  if (status === 'ready_to_answer') return 'ready';
  return 'error';
}

function buildTaskTitle(taskRole: string, abilityName: string): string {
  const roleLabels: Record<string, string> = {
    training: '练习',
    retest: '复测',
    transfer: '迁移验证',
    diagnosis: '诊断',
    observation: '观察',
  };
  const roleLabel = roleLabels[taskRole] || '学习任务';
  return `${abilityName}${roleLabel}`;
}

function buildRoundFocusDescription(abilityName: string, validationGoal: string): string {
  if (validationGoal.trim()) {
    return validationGoal;
  }

  return `本轮会重点观察你是否能完成「${abilityName}」相关的思考动作。`;
}

function hasMinimumAnswerDraft(answerDraft: string): boolean {
  return answerDraft.trim().length >= MIN_ANSWER_LENGTH;
}

function buildMessage(
  startResult: LearningRoundStartResult,
  canAnswer: boolean,
  canSubmit: boolean,
  answerDraft: string,
): string {
  if (!canAnswer) {
    const issue = collectIssues(startResult)[0];
    return issue || '本轮任务还没有准备完整，请稍后重试。';
  }

  if (!canSubmit && !answerDraft.trim()) {
    return '本轮任务已经准备好，请阅读材料并输入你的答案。';
  }

  if (!canSubmit) {
    return '答案还太少，请至少写出一句完整想法。';
  }

  return '答案已具备最低提交条件，可以提交。';
}

function collectIssues(startResult: LearningRoundStartResult): string[] {
  const readinessIssues = startResult.taskReadinessValidation?.issues.map((issue) => issue.message) || [];
  return [...startResult.issues, ...readinessIssues].filter(Boolean);
}
