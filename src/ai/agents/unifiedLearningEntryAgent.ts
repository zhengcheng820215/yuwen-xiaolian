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

export function createUnifiedLearningActivityContext(input: {
  studentId: string;
  learningSessionId: string;
  currentLearningRoundId?: string;
  status?: UnifiedLearningActivityContext['status'];
  createdAt: string;
  updatedAt?: string;
}): UnifiedLearningActivityContext {
  const context: UnifiedLearningActivityContext = {
    schemaVersion: UNIFIED_LEARNING_ENTRY_SCHEMA_VERSION,
    studentId: input.studentId,
    learningSessionId: input.learningSessionId,
    currentLearningRoundId: input.currentLearningRoundId,
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
  const base = {
    schemaVersion: UNIFIED_LEARNING_ENTRY_SCHEMA_VERSION,
    studentId: input.studentId,
    hasActiveSession: active.length === 1,
    hasDraft: Boolean(record?.answerDraft?.trim()) && !record?.studentResponse,
    hasUnviewedFeedback: Boolean(record?.learningRoundResult && (record.studentLearningFeedback || record.studentRoundSummary)),
    currentRoundNumber: roundNumber(record?.learningRoundId),
    completedRoundCount: input.completedRoundCount,
    focusText: record?.concreteTask?.targetAbilityName,
    studentVisibleIssues: [] as string[],
  };

  if (issues.length > 0 || active.length > 1) {
    return finish({
      ...base,
      status: 'review_required', priority: 1,
      title: '学习状态需要确认',
      message: '当前学习记录需要进一步确认，暂时不会启动新的任务。',
      primaryAction: 'wait_for_review', primaryActionText: '等待确认', canEnterWorkspace: false,
    }, [...issues, ...(active.length > 1 ? ['multiple_active_sessions_not_allowed'] : [])]);
  }

  if (checkpoint?.status === 'review_required') {
    return finish({
      ...base,
      status: 'review_required', priority: 1,
      title: '本次结果正在确认',
      message: '你的回答已经记录，确认完成前不会据此改变学习状态。',
      primaryAction: 'wait_for_review', primaryActionText: '稍后再看', canEnterWorkspace: false,
    });
  }
  if (checkpoint?.status === 'blocked') {
    return finish({
      ...base,
      status: 'blocked', priority: 1,
      title: '暂时无法继续',
      message: '当前任务暂时无法继续，已保留已有学习记录。',
      primaryAction: 'retry_later', primaryActionText: '稍后重试', canEnterWorkspace: false,
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
  if (ended && active.length === 0) {
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
      message: record.studentLearningFeedback?.summary || record.studentRoundSummary?.completionSummary || '本轮结果已经保存，可以查看反馈。',
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
    title: '暂时没有可用任务',
    message: '当前没有符合学习目标的正式任务，请稍后再来。',
    primaryAction: 'none', primaryActionText: '暂无任务', canEnterWorkspace: false,
  });
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
        ? '当前结果不会自动进入 Evidence 回流。'
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
      title: '学习状态需要确认',
      message: '当前学习记录暂时无法安全恢复。',
      primaryAction: 'wait_for_review',
      primaryActionText: '等待确认',
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
