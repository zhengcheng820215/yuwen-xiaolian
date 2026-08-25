import { normalizeRuntimeError } from '../errors/structuredRuntimeError.ts';
import {
  PRODUCT_RUNTIME_USER_PROJECTION_VERSION,
  type ProductRuntimeContentState,
  type ProductRuntimeProjectionContext,
  type ProductRuntimeUserAction,
  type ProductRuntimeUserProjection,
  type ProductRuntimeUserProjectionState,
} from '../schemas/productRuntimeUserProjection.schema.ts';
import type { ProductRuntimeReasonCode } from '../schemas/productRuntimeBaselineAudit.schema.ts';
import { stableHash } from './productRuntimeBaselineAuditService.ts';

const FORMAL_BLOCKS: ProductRuntimeReasonCode[] = [
  'formal_store_unreadable', 'formal_store_uninitialized',
  'formal_resource_boundary_unavailable', 'formal_resource_baseline_inconsistent',
];
const IDENTITY_BLOCKS: ProductRuntimeReasonCode[] = [
  'task_identity_mismatch', 'learning_session_identity_mismatch', 'submission_identity_mismatch',
];
const ORDINARY_IGNORED: ProductRuntimeReasonCode[] = [
  'trial_identity_mismatch', 'trial_reentry_required', 'trial_observation_unavailable',
  'runtime_identity_insufficient',
];

export function projectProductRuntimeRecovery(context: ProductRuntimeProjectionContext): ProductRuntimeUserProjection {
  const contentState = resolveContentState(context);
  const allCodes = unique([
    ...(context.health?.summaryReasonCodes || []),
    ...(context.reasonCodes || []),
  ]);
  const ordinaryCodes = allCodes.filter((code) => !ORDINARY_IGNORED.includes(code));
  let projection: Omit<ProductRuntimeUserProjection, 'schemaVersion' | 'internal' | 'projectionDigest'>;

  if (ordinaryCodes.some((code) => IDENTITY_BLOCKS.includes(code))) {
    projection = make(context, contentState, 'identity_conflict', 'blocked',
      context.surface === 'workbench' ? '当前工作内容需要重新确认' : '当前学习需要重新打开确认',
      '系统检测到当前内容与正在处理的版本不一致。', action('return_to_entry'));
  } else if (ordinaryCodes.some((code) => FORMAL_BLOCKS.includes(code)) || context.taskAvailability === 'no_formal_resource') {
    projection = make(context, contentState, 'formal_resource_unavailable', 'blocked',
      '正式学习任务暂时无法读取', '当前不能读取或开始新的正式任务。', action('retry_read'));
  } else if (context.healthReadState === 'unreachable' || ordinaryCodes.includes('runtime_unreachable')) {
    projection = make(context, contentState, 'runtime_unavailable', 'blocked',
      context.surface === 'workbench' ? '当前服务尚未启动' : '学习服务尚未启动',
      '服务启动后可以从当前工作继续。', action('retry_health'));
  } else if (context.healthReadState === 'timeout' || ordinaryCodes.includes('runtime_health_timeout')) {
    projection = make(context, contentState, 'runtime_unavailable', 'recoverable',
      '服务检查暂时没有完成', '可以重新检查当前服务状态。', action('retry_health'));
  } else if (context.healthReadState === 'invalid') {
    projection = make(context, contentState, 'operation_blocked', 'blocked',
      '当前服务状态暂时无法确认', '系统不会在状态未确认时开始新的正式操作。', action('retry_health'));
  } else if (ordinaryCodes.includes('submission_recovery_required') || (context.ownerFacts.attemptCommitted === true && Boolean(context.ownerFacts.checkpointPhase))) {
    projection = make(context, contentState, 'submission_recoverable', 'recoverable',
      '恢复本次提交', '回答已经提交，反馈处理尚未完成。', action('continue_processing'));
  } else if (ordinaryCodes.includes('learning_session_recovery_required') || context.ownerFacts.hasActiveSession === true) {
    projection = make(context, contentState, 'session_recoverable', 'recoverable',
      '可以继续上次学习', '系统找到了尚未完成的学习。', action('continue_learning'));
  } else if (requiresAi(context.operation) && (ordinaryCodes.includes('ai_provider_not_configured') || context.health?.aiProvider.status === 'not_configured')) {
    projection = make(context, contentState, 'ai_configuration_required', 'blocked',
      context.surface === 'workbench' ? 'AI 服务尚未配置' : '当前学习反馈服务尚未配置',
      context.surface === 'workbench' ? '当前生成或优化操作尚未开始。' : '当前不能开始需要反馈的新学习。',
      action(context.surface === 'learning_entry' ? 'none' : 'return_to_entry'));
  } else if (requiresAi(context.operation) && context.health?.aiProvider.status === 'not_checked') {
    projection = make(context, contentState, 'operation_blocked', 'blocked',
      '反馈服务状态尚未确认', '系统不会在服务状态未确认时开始需要反馈的新操作。',
      action('retry_health'));
  } else if (requiresAi(context.operation) && (ordinaryCodes.includes('ai_provider_unreachable') || context.runtimeError?.recoverability === 'service_required')) {
    projection = make(context, contentState, 'ai_temporarily_unavailable', 'recoverable',
      '反馈服务暂时不可用', contentState === 'answer_submitted'
        ? '已经提交的回答正在等待继续处理。' : '可以保留当前输入，稍后重新尝试。',
      action(contentState === 'answer_submitted' ? 'continue_processing' : 'retry_current_operation'));
  } else if (context.taskAvailability && ['no_eligible_match', 'already_used'].includes(context.taskAvailability)) {
    projection = make(context, contentState, 'no_task', 'information',
      '当前暂时没有可开始的学习任务', '服务与正式资源读取正常。', action('none'));
  } else if (context.runtimeError) {
    const error = normalizeRuntimeError(context.runtimeError);
    const retryable = ['retry_safe', 'reload_required'].includes(error.recoverability);
    projection = make(context, contentState, retryable ? 'operation_retryable' : 'operation_blocked', retryable ? 'recoverable' : 'blocked',
      retryable ? '本次操作尚未完成' : '当前操作暂时无法继续',
      retryable ? '现有工作内容已经保留，可以安全重试。' : '系统没有改变现有正式数据。',
      action(retryable ? 'retry_current_operation' : 'return_to_entry'));
  } else {
    projection = make(context, contentState, 'ready', 'neutral',
      context.surface === 'workbench' ? '工作台可以继续使用' : '学习状态已就绪',
      '当前所需服务与数据可以读取。', action('none'));
  }

  const withoutDigest = {
    schemaVersion: PRODUCT_RUNTIME_USER_PROJECTION_VERSION,
    ...projection,
    internal: {
      reasonCodes: ordinaryCodes,
      errorRef: context.errorRef,
      healthFactDigest: context.health?.factDigest,
    },
  };
  return { ...withoutDigest, projectionDigest: stableHash(withoutDigest) };
}

function make(
  context: ProductRuntimeProjectionContext,
  contentState: ProductRuntimeContentState,
  state: ProductRuntimeUserProjectionState,
  tone: ProductRuntimeUserProjection['tone'],
  title: string,
  situationText: string,
  primaryAction: ProductRuntimeUserAction,
) {
  const resolvedPrimaryAction = context.surface === 'workbench' && primaryAction.actionId === 'return_to_entry'
    ? { ...primaryAction, label: '返回工作台' }
    : primaryAction;
  return {
    surface: context.surface, state, tone, title, situationText, contentState,
    preservationText: preservationText(contentState, context.surface), primaryAction: resolvedPrimaryAction,
    ...(context.surface === 'learning_workspace' && primaryAction.actionId !== 'return_to_entry'
      ? { secondaryAction: { actionId: 'return_to_entry' as const, label: '返回学习入口' as const, emphasis: 'secondary' as const } } : {}),
  };
}

function resolveContentState(context: ProductRuntimeProjectionContext): ProductRuntimeContentState {
  if (context.ownerFacts.publishedResourceCommitted === true) return 'published_preserved';
  if (context.ownerFacts.attemptCommitted === true) return 'answer_submitted';
  if (context.ownerFacts.hasDraft === true) return 'draft_preserved';
  if (context.ownerFacts.hasActiveSession === true) return 'progress_preserved';
  if (context.surface === 'workbench' && context.ownerFacts.currentWorkbenchObjectPresent === true) return 'progress_preserved';
  const facts = context.ownerFacts;
  if ([facts.hasActiveSession, facts.hasDraft, facts.attemptCommitted,
    facts.publishedResourceCommitted, facts.currentWorkbenchObjectPresent].includes('unknown')) return 'unknown_requires_check';
  return 'not_started';
}

function preservationText(state: ProductRuntimeContentState, surface: ProductRuntimeProjectionContext['surface']): string {
  if (state === 'progress_preserved' && surface === 'workbench') return '当前工作对象已经保留。';
  return {
    not_started: '本次正式操作尚未开始，现有数据没有变化。',
    draft_preserved: '上次输入的答案草稿已经保留。',
    progress_preserved: '上次学习进度已经保留。',
    answer_submitted: '回答已经提交，无需重复提交。',
    published_preserved: '已经发布的正式结果保持不变。',
    unknown_requires_check: '现有内容状态尚未确认，系统不会假定已经保存。',
  }[state];
}

function action(id: ProductRuntimeUserAction['actionId']): ProductRuntimeUserAction {
  const label = {
    retry_health: '重新尝试', retry_read: '重新尝试', continue_learning: '继续学习',
    continue_processing: '继续处理', retry_current_operation: '重新尝试当前操作',
    return_to_entry: '返回学习入口', none: '',
  }[id];
  return { actionId: id, label, emphasis: id === 'none' ? 'none' : 'primary', idempotencyRequired: ['continue_learning', 'continue_processing', 'retry_current_operation'].includes(id) };
}

function requiresAi(operation?: ProductRuntimeProjectionContext['operation']): boolean {
  return ['start_learning', 'submit_answer', 'resume_diagnosis', 'workbench_generate'].includes(operation || '');
}

function unique(values: ProductRuntimeReasonCode[]): ProductRuntimeReasonCode[] {
  return [...new Set(values)].sort();
}

export function createSingleFlightRuntimeAction<T>(action: () => Promise<T>): () => Promise<T> {
  let running: Promise<T> | undefined;
  return () => {
    if (running) return running;
    running = Promise.resolve().then(action).finally(() => { running = undefined; });
    return running;
  };
}
