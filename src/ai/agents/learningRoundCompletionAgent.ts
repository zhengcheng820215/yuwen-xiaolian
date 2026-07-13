import { runTaskEvidenceReturnAgent } from './taskEvidenceReturnAgent.ts';
import type { AbilityEvidence } from '../schemas/abilityEvidence.schema.ts';
import type { ConcreteLearningTask } from '../schemas/concreteLearningTask.schema.ts';
import type { DiagnosisResult } from '../schemas/diagnosis.schema.ts';
import type {
  LearningRoundExecutionResult,
  LearningRoundNextStep,
  LearningRoundResult,
  LearningRoundStatus,
} from '../schemas/learningRound.schema.ts';
import type { StudentAbilityProfile } from '../schemas/studentAbilityProfile.schema.ts';
import type { TaskEvidenceReturnResult } from '../schemas/taskEvidenceReturn.schema.ts';

export type LearningRoundCompletionInput = {
  executionResult: LearningRoundExecutionResult;
  concreteTask: ConcreteLearningTask;
  previousEvidence?: AbilityEvidence[];
  currentProfile?: StudentAbilityProfile;
  diagnosisResult?: Partial<DiagnosisResult> | null;
  diagnosisResultId?: string;
  diagnosisFailed?: boolean;
  completedAt?: string;
};

export function completeLearningRound(
  input: LearningRoundCompletionInput,
): LearningRoundResult {
  const base = {
    learningRoundId: input.executionResult.learningRoundId,
    studentId: input.executionResult.studentId,
    startResult: input.executionResult.startResult,
    executionResult: input.executionResult,
  };
  const preflightIssues = validateCompletionInput(input);

  if (input.executionResult.status === 'retry_required') {
    return {
      ...base,
      status: 'retry_required',
      nextStep: 'supplement_response',
      nextStepReason: '本轮作答尚不具备进入 Evidence 回流的条件，需要学生补充或重试。',
      issues: [...input.executionResult.issues, ...preflightIssues],
    };
  }

  if (input.executionResult.status === 'abandoned') {
    return {
      ...base,
      status: 'abandoned',
      nextStep: 'stop',
      nextStepReason: '学生已中断或放弃本轮任务，本轮不进入 Evidence 回流。',
      issues: [...input.executionResult.issues, ...preflightIssues],
    };
  }

  if (preflightIssues.length > 0 || !input.executionResult.canEnterEvidenceReturn) {
    return {
      ...base,
      status: input.executionResult.status === 'review_required' ? 'review_required' : 'blocked',
      nextStep: input.executionResult.status === 'review_required' ? 'human_review' : 'stop',
      nextStepReason: '本轮执行结果不满足 Evidence 回流前置条件。',
      issues: [
        ...input.executionResult.issues,
        ...preflightIssues,
        ...(input.executionResult.canEnterEvidenceReturn ? [] : ['LearningRoundExecutionResult.canEnterEvidenceReturn=false.']),
      ],
    };
  }

  const taskEvidenceReturnResult = runTaskEvidenceReturnAgent({
    concreteTask: input.concreteTask,
    taskExecutionResult: input.executionResult.taskExecutionResult!,
    previousEvidence: input.previousEvidence,
    currentProfile: input.currentProfile,
    diagnosisResult: input.diagnosisResult,
    diagnosisResultId: input.diagnosisResultId,
    diagnosisFailed: input.diagnosisFailed,
    returnedAt: input.completedAt,
  });

  return mapEvidenceReturnToRoundResult({
    ...base,
    taskEvidenceReturnResult,
  });
}

function mapEvidenceReturnToRoundResult(input: {
  learningRoundId: string;
  studentId: string;
  startResult: LearningRoundResult['startResult'];
  executionResult: LearningRoundExecutionResult;
  taskEvidenceReturnResult: TaskEvidenceReturnResult;
}): LearningRoundResult {
  const { taskEvidenceReturnResult } = input;
  const missingSuccessObjects = missingPhase8Objects(taskEvidenceReturnResult);

  if (taskEvidenceReturnResult.status === 'evidence_returned' && missingSuccessObjects.length === 0) {
    return {
      ...input,
      status: 'completed',
      nextStep: 'continue',
      nextStepReason: '本轮已完成 Evidence 回流，并生成 GrowthMemoryRecord；下一轮策略应由新的 GrowthMemorySummary 进入 Phase 8.3 后决定。',
      issues: [],
    };
  }

  if (taskEvidenceReturnResult.status === 'evidence_returned' && missingSuccessObjects.length > 0) {
    return {
      ...input,
      status: 'review_required',
      nextStep: 'human_review',
      nextStepReason: 'TaskEvidenceReturnResult 标记为 evidence_returned，但缺少成功回流对象，需要人工复核。',
      issues: missingSuccessObjects,
    };
  }

  if (taskEvidenceReturnResult.status === 'blocked_invalid_execution') {
    return {
      ...input,
      status: 'blocked',
      nextStep: 'stop',
      nextStepReason: 'Phase 9.3 判定执行结果不能进入 Evidence 回流。',
      issues: collectIssues(taskEvidenceReturnResult),
    };
  }

  if (taskEvidenceReturnResult.status === 'diagnosis_failed') {
    return {
      ...input,
      status: 'review_required',
      nextStep: 'human_review',
      nextStepReason: 'Diagnosis Runtime 失败或输出非法，本轮需要人工复核。',
      issues: collectIssues(taskEvidenceReturnResult),
    };
  }

  return {
    ...input,
    status: 'review_required',
    nextStep: 'human_review',
    nextStepReason: 'Phase 9.3 要求人工复核，本轮不能自动完成。',
    issues: collectIssues(taskEvidenceReturnResult),
  };
}

function validateCompletionInput(input: LearningRoundCompletionInput): string[] {
  const issues: string[] = [];
  const taskExecutionResult = input.executionResult.taskExecutionResult;

  if (!taskExecutionResult) {
    issues.push('LearningRoundExecutionResult.taskExecutionResult is missing.');
    return issues;
  }
  if (input.executionResult.studentId !== input.concreteTask.studentId) {
    issues.push('LearningRoundExecutionResult.studentId does not match ConcreteLearningTask.studentId.');
  }
  if (taskExecutionResult.studentId !== input.executionResult.studentId) {
    issues.push('TaskExecutionResult.studentId does not match LearningRoundExecutionResult.studentId.');
  }
  if (taskExecutionResult.taskId !== input.concreteTask.taskId) {
    issues.push('TaskExecutionResult.taskId does not match ConcreteLearningTask.taskId.');
  }
  if (!taskExecutionResult.canEnterDiagnosisRuntime) {
    issues.push('TaskExecutionResult.canEnterDiagnosisRuntime=false.');
  }

  return issues;
}

function missingPhase8Objects(result: TaskEvidenceReturnResult): string[] {
  const issues: string[] = [];

  if (!result.diagnosisResult) issues.push('TaskEvidenceReturnResult.diagnosisResult is missing.');
  if (result.abilityEvidence.length === 0) issues.push('TaskEvidenceReturnResult.abilityEvidence is empty.');
  if (!result.evaluationResult) issues.push('TaskEvidenceReturnResult.evaluationResult is missing.');
  if (!result.profileUpdateDecision) issues.push('TaskEvidenceReturnResult.profileUpdateDecision is missing.');
  if (!result.growthMemoryRecord) issues.push('TaskEvidenceReturnResult.growthMemoryRecord is missing.');

  return issues;
}

function collectIssues(result: TaskEvidenceReturnResult): string[] {
  return result.validation.issues.length > 0
    ? result.validation.issues
    : [`TaskEvidenceReturnResult.status=${result.status}`];
}
