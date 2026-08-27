import {
  UNIFIED_LEARNING_ENTRY_SCHEMA_VERSION,
  isUnifiedLearningActivityContext,
  isUnifiedLearningEntryState,
  type InternalLearningReviewSummary,
  type UnifiedLearningActivityContext,
  type UnifiedLearningEntryInput,
  type UnifiedLearningEntryState,
} from '../schemas/unifiedLearningEntry.schema.ts';
import type { RealLearningOperationCheckpoint } from '../schemas/realLearningOperation.schema.ts';
import {
  resolveStudentRuntimePausePresentation,
} from '../content/studentRuntimeMessages.ts';
import { toStudentFeedbackSummary } from '../content/studentFeedbackPresentation.ts';
import { buildStudentLearningNarrativeProjection } from './studentLearningNarrativeAgent.ts';
import { toStudentLearningPresentation } from '../schemas/studentLearningNarrative.schema.ts';

export function createUnifiedLearningActivityContext(input: {
  studentId: string;
  learningSessionId: string;
  currentLearningRoundId?: string;
  taskQueue?: UnifiedLearningActivityContext['taskQueue'];
  status?: UnifiedLearningActivityContext['status'];
  createdAt: string;
  updatedAt?: string;
}): UnifiedLearningActivityContext {
  const context: UnifiedLearningActivityContext = {
    schemaVersion: UNIFIED_LEARNING_ENTRY_SCHEMA_VERSION,
    studentId: input.studentId,
    learningSessionId: input.learningSessionId,
    currentLearningRoundId: input.currentLearningRoundId,
    taskQueue: input.taskQueue,
    status: input.status || 'active',
    createdAt: input.createdAt,
    updatedAt: input.updatedAt || input.createdAt,
  };
  if (!isUnifiedLearningActivityContext(context)) {
    throw new Error('UnifiedLearningActivityContext validation failed.');
  }
  return context;
}

export function buildUnifiedLearningEntryState(
  input: UnifiedLearningEntryInput,
): UnifiedLearningEntryState {
  const issues = validateInput(input);
  const active = input.activeContexts.filter((item) => item.status !== 'ended');
  const ended = input.activeContexts
    .filter((item) => item.status === 'ended')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const record = input.latestPersistenceRecord;
  const checkpoint = input.operationCheckpoint;
  const feedback = checkpoint?.controlledFeedbackResult?.studentLearningFeedback || record?.studentLearningFeedback;
  const learningPresentation = toStudentLearningPresentation(buildStudentLearningNarrativeProjection({
    studentId: input.studentId,
    currentTask: checkpoint?.concreteTask || record?.concreteTask,
    studentResponse: checkpoint?.taskExecutionResult?.studentResponse || record?.studentResponse,
    feedback,
    evidenceQualityAssessment: checkpoint?.evidenceQualityAssessment,
    growthMemorySummary: checkpoint?.updatedGrowthMemorySummary || record?.growthMemorySummary,
    nextLearningStrategy: checkpoint?.nextLearningStrategy,
    nextTaskResolution: checkpoint?.nextTaskResolution,
    delayedRetestPlan: (input.delayedRetestPlans || []).find((plan) => (
      plan.studentId === input.studentId && plan.status === 'available'
    )),
  }));
  const base = {
    schemaVersion: UNIFIED_LEARNING_ENTRY_SCHEMA_VERSION,
    studentId: input.studentId,
    hasActiveSession: active.length === 1,
    hasDraft: Boolean(record?.answerDraft?.trim()) && !record?.studentResponse,
    hasUnviewedFeedback: Boolean(record?.learningRoundResult && (record.studentLearningFeedback || record.studentRoundSummary)),
    currentRoundNumber: roundNumber(record?.learningRoundId || active[0]?.currentLearningRoundId),
    completedRoundCount: input.completedRoundCount,
    taskAvailabilityState: input.taskAvailabilityState,
    focusText: record?.concreteTask?.targetAbilityName,
    learningPresentation,
    studentVisibleIssues: [] as string[],
  };

  if (issues.length > 0 || active.length > 1) {
    return finish({
      ...base,
      status: 'review_required', priority: 1,
      title: '学习状态暂时无法恢复',
      message: '当前记录存在不一致，系统已停止恢复，不会启动新的任务，也不会改写已有记录。',
      primaryAction: 'retry_later', primaryActionText: '稍后再试', canEnterWorkspace: false,
    }, [...issues, ...(active.length > 1 ? ['multiple_active_sessions_not_allowed'] : [])]);
  }

  // A completed frozen task group must not be projected as an unfinished or
  // blocked Session merely because its last operation checkpoint is retained
  // for audit. Keep the old results immutable and offer a new Session when a
  // new formal task is available.
  if (input.sessionGroupCompleted && active.length === 1) {
    if (input.hasAvailableTask) {
      return finish({
        ...base,
        status: 'session_ended', priority: 2,
        title: '上一轮学习已经完成',
        message: '上一轮结果已经保存。现在可以开始新一轮真实学习。',
        primaryAction: 'start_new_session', primaryActionText: '开始新的学习',
        canEnterWorkspace: true,
      });
    }
    return finish({
      ...base,
      status: 'no_task', priority: 7,
      title: noTaskTitle(input.taskAvailabilityState),
      message: input.taskAvailabilityMessage || '上一轮结果已经保存，当前暂时没有新的正式任务。',
      primaryAction: 'none', primaryActionText: '暂无任务', canEnterWorkspace: false,
    });
  }

  if (
    checkpoint?.status === 'review_required' &&
    checkpoint.learningPersistenceRecordId &&
    input.hasAvailableTask &&
    active.length === 1
  ) {
    return finish({
      ...base,
      status: 'feedback_available', priority: 1,
      title: '本题学习已经完成',
      message: '本题结果已经保存。可以查看反馈，并继续完成当前题组中的下一题。',
      primaryAction: 'view_feedback', primaryActionText: '查看反馈并继续', canEnterWorkspace: true,
    });
  }
  if (checkpoint?.status === 'review_required') {
    const presentation = resolveStudentRuntimePausePresentation({
      status: 'review_required',
      nextAction: checkpoint.nextAction,
      hasFormalRoundResult: Boolean(checkpoint.learningPersistenceRecordId),
    });
    return finish({
      ...base,
      status: 'review_required', priority: 1,
      title: presentation.title,
      message: presentation.message,
      primaryAction: 'retry_later', primaryActionText: presentation.actionText, canEnterWorkspace: false,
    });
  }
  if (checkpoint?.status === 'blocked') {
    const nextResourceUnavailable = Boolean(checkpoint.learningPersistenceRecordId) &&
      checkpoint.nextTaskResolution?.status !== 'matched' &&
      (
        checkpoint.nextAction === 'prepare_resource' ||
        checkpoint.issues.every((issue) => (
          issue.startsWith('operation_identity_mismatch:') ||
          checkpoint.nextTaskResolution?.issues.includes(issue)
        ))
      );
    return finish({
      ...base,
      status: 'blocked', priority: 1,
      title: nextResourceUnavailable ? '需要检查下一任务' : '暂时无法继续',
      message: nextResourceUnavailable
        ? '本轮结果已经保存。上次未找到符合要求的下一任务，系统不会在后台自动生成；请再次检查，若仍无匹配，则需要先补充合适的正式任务。'
        : '当前任务暂时无法继续，已保留已有学习记录。',
      primaryAction: nextResourceUnavailable ? 'retry_resource' : 'retry_later',
      primaryActionText: nextResourceUnavailable ? '检查下一任务' : '稍后重试',
      canEnterWorkspace: nextResourceUnavailable,
    });
  }
  if (checkpoint?.nextAction === 'submit_answer') {
    return finish({
      ...base,
      status: 'continue_round', priority: 3,
      title: '继续完成本轮回答',
      message: '这次回答的信息还不够，可以回到原题继续补充。',
      primaryAction: 'continue_learning', primaryActionText: '继续作答', canEnterWorkspace: true,
    });
  }
  if (checkpoint?.status === 'retry_required' &&
    ['response_validated', 'diagnosis_committed', 'evidence_returned'].includes(checkpoint.stage)) {
    return finish({
      ...base,
      status: 'recovering_submission', priority: 2,
      title: '正在恢复本次提交',
      message: '系统正在恢复已经提交的结果，请不要重复提交。',
      primaryAction: 'resume_processing', primaryActionText: '查看恢复状态', canEnterWorkspace: true,
    });
  }
  if (active.length === 1 && input.taskAvailabilityState === 'stale_session') {
    return finish({
      ...base,
      status: 'blocked', priority: 2,
      title: '当前题组需要重新开始',
      message: input.taskAvailabilityMessage || '当前旧题组已经失效。已有学习结果已经保留，请结束本次学习后重新开始。',
      primaryAction: 'none', primaryActionText: '题组已失效', canEnterWorkspace: false,
    });
  }
  if (ended && active.length === 0) {
    if (!input.hasAvailableTask) {
      return finish({
        ...base,
        status: 'no_task', priority: 7,
        title: noTaskTitle(input.taskAvailabilityState),
        message: input.taskAvailabilityMessage || '本次学习结果已经保存，当前暂时没有可用任务。',
        primaryAction: 'none', primaryActionText: '暂无任务', canEnterWorkspace: false,
      });
    }
    return finish({
      ...base,
      status: 'session_ended', priority: 3,
      title: '本次学习已经结束',
      message: '已有学习结果已经保存。准备好后，可以开始新的学习。',
      primaryAction: 'start_new_session', primaryActionText: '开始新的学习', canEnterWorkspace: input.hasAvailableTask,
    });
  }
  if (record && !record.learningRoundResult) {
    return finish({
      ...base,
      status: 'continue_round', priority: 3,
      title: base.hasDraft ? '继续上次的回答' : '继续当前学习',
      message: base.hasDraft ? '上次输入的内容已经保留，可以从这里继续。' : '当前任务尚未完成，可以继续作答。',
      primaryAction: 'continue_learning', primaryActionText: '继续学习', canEnterWorkspace: true,
    });
  }

  if (active.length === 1 && input.hasAvailableTask && !record) {
    return finish({
      ...base,
      status: 'continue_round', priority: 3,
      title: '继续当前题组',
      message: `当前题组已经恢复，可以从第 ${base.currentRoundNumber || 1} 题继续。`,
      primaryAction: 'continue_learning', primaryActionText: '继续学习', canEnterWorkspace: true,
    });
  }

  const duePlan = (input.delayedRetestPlans || [])
    .filter((plan) => plan.studentId === input.studentId && plan.status === 'available' && plan.plannedRetestAt <= input.now)
    .sort((a, b) => a.plannedRetestAt.localeCompare(b.plannedRetestAt))[0];
  if (duePlan) {
    return finish({
      ...base,
      status: 'delayed_retest_available', priority: 4,
      title: '有一项复测可以开始',
      message: duePlan.whyRetestNow,
      primaryAction: 'start_retest', primaryActionText: '开始复测', canEnterWorkspace: true,
      retest: {
        targetAbilityId: duePlan.targetAbilityId,
        plannedRetestAt: duePlan.plannedRetestAt,
        whyNow: duePlan.whyRetestNow,
      },
    });
  }
  if (record?.learningRoundResult && (record.studentLearningFeedback || record.studentRoundSummary)) {
    return finish({
      ...base,
      status: 'feedback_available', priority: 5,
      title: '上次学习已经完成',
      message: record.studentLearningFeedback
        ? toStudentFeedbackSummary(record.studentLearningFeedback.summary)
        : record.studentRoundSummary?.completionSummary || '本轮结果已经保存，可以查看反馈。',
      primaryAction: 'view_feedback', primaryActionText: '查看本轮反馈', canEnterWorkspace: true,
    });
  }
  if (input.hasAvailableTask) {
    return finish({
      ...base,
      status: 'start_new_round', priority: 6,
      title: '今天从这里开始',
      message: '任务已经准备好，可以开始本次学习。',
      primaryAction: 'start_learning', primaryActionText: '开始学习', canEnterWorkspace: true,
    });
  }
  return finish({
    ...base,
    status: 'no_task', priority: 7,
    title: noTaskTitle(input.taskAvailabilityState),
    message: input.taskAvailabilityMessage || '当前没有符合学习目标的正式任务，请稍后再来。',
    primaryAction: 'none', primaryActionText: '暂无任务', canEnterWorkspace: false,
  });
}

function noTaskTitle(state: UnifiedLearningEntryInput['taskAvailabilityState']): string {
  return {
    no_formal_resource: '当前还没有正式任务',
    no_eligible_match: '当前没有符合本轮条件的新任务',
    already_used: '本轮可用任务已经完成',
    stale_session: '当前题组需要重新开始',
    available: '暂时没有可用任务',
  }[state || 'available'];
}

export function buildInternalLearningReviewSummary(
  checkpoint: RealLearningOperationCheckpoint,
): InternalLearningReviewSummary {
  const status = checkpoint.status === 'completed'
    ? 'completed'
    : checkpoint.status === 'review_required'
      ? 'review_required'
      : checkpoint.status === 'blocked'
        ? 'blocked'
        : 'recovering';
  const stageOrder = ['task_prepared', 'response_validated', 'diagnosis_committed', 'evidence_returned', 'persisted', 'next_task_ready'];
  const currentIndex = stageOrder.indexOf(checkpoint.stage);
  const labels: Record<string, string> = {
    task_prepared: '任务准备', response_validated: '作答校验', diagnosis_committed: '诊断提交',
    evidence_returned: '证据回流', persisted: '正式保存', next_task_ready: '下一任务',
  };
  const validationIssues = checkpoint.studentId && checkpoint.operationId ? [] : ['review_identity_incomplete'];
  return {
    schemaVersion: UNIFIED_LEARNING_ENTRY_SCHEMA_VERSION,
    reviewKey: checkpoint.operationId,
    studentId: checkpoint.studentId,
    status,
    actionRequired: ['review_required', 'blocked'].includes(status),
    headline: status === 'completed' ? '正式链路已完成' : status === 'review_required' ? '需要人工复核' : status === 'blocked' ? '运行已阻断' : '运行等待恢复',
    summary: status === 'completed'
      ? '本轮正式结果和下一任务均已形成。'
      : status === 'review_required'
        ? checkpoint.learningPersistenceRecordId
          ? '本轮正式结果已保存；下一任务决策需要检查。'
          : '当前结果不会自动进入 Evidence 回流。'
        : status === 'blocked'
          ? '流程已安全停止，已有正式结果不会被覆盖。'
          : '系统将从已保存的 Checkpoint 继续。',
    stages: stageOrder.map((key, index) => ({
      key,
      label: labels[key],
      status: index < currentIndex || (index === currentIndex && checkpoint.status === 'completed')
        ? 'completed'
        : index === currentIndex
          ? checkpoint.status === 'blocked' || checkpoint.status === 'review_required' ? 'blocked' : 'current'
          : 'pending',
    })),
    trace: {
      operationId: checkpoint.operationId,
      learningSessionId: checkpoint.learningSessionId,
      learningRoundId: checkpoint.learningRoundId,
      sourceResourceVersionId: checkpoint.sourceResourceVersionId,
      formalDiagnosisId: checkpoint.realDiagnosisRuntimeResult?.formalDiagnosisCommit?.formalDiagnosisId,
      evidenceIds: checkpoint.taskEvidenceReturnResult?.abilityEvidence.map((item) => item.id) || [],
      persistenceRecordId: checkpoint.learningPersistenceRecordId,
      nextResourceVersionId: checkpoint.nextTaskResolution?.resourceVersion?.resourceVersionId,
    },
    issues: checkpoint.issues.map(sanitizeIssue),
    sensitiveDataHidden: true,
    validation: { passed: validationIssues.length === 0, issues: validationIssues },
  };
}

function finish(
  state: Omit<UnifiedLearningEntryState, 'validation'>,
  validationIssues: string[] = [],
): UnifiedLearningEntryState {
  const result: UnifiedLearningEntryState = {
    ...state,
    validation: { passed: validationIssues.length === 0, issues: validationIssues },
  };
  if (!isUnifiedLearningEntryState(result)) {
    return {
      ...result,
      status: 'review_required',
      priority: 1,
      title: '学习状态暂时无法恢复',
      message: '当前学习记录暂时无法安全恢复。',
      primaryAction: 'retry_later',
      primaryActionText: '稍后再试',
      canEnterWorkspace: false,
      validation: { passed: false, issues: [...validationIssues, 'unified_entry_state_schema_invalid'] },
    };
  }
  return result;
}

function validateInput(input: UnifiedLearningEntryInput): string[] {
  const issues: string[] = [];
  if (!input.studentId.trim()) issues.push('student_id_required');
  if (!Number.isFinite(Date.parse(input.now))) issues.push('current_time_invalid');
  if (input.activeContexts.some((item) => !isUnifiedLearningActivityContext(item))) issues.push('activity_context_invalid');
  if (input.activeContexts.some((item) => item.studentId !== input.studentId)) issues.push('activity_context_student_mismatch');
  if (input.latestPersistenceRecord && input.latestPersistenceRecord.studentId !== input.studentId) issues.push('persistence_student_mismatch');
  if (input.operationCheckpoint && input.operationCheckpoint.studentId !== input.studentId) issues.push('operation_student_mismatch');
  if ((input.delayedRetestPlans || []).some((plan) => plan.studentId !== input.studentId)) issues.push('retest_plan_student_mismatch');
  return issues;
}

function roundNumber(roundId?: string): number | undefined {
  const match = roundId?.match(/(?:round-|round_)(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

function sanitizeIssue(issue: string): string {
  return issue.replace(/api[_-]?key|raw[_-]?output|prompt/gi, '[sensitive]');
}
