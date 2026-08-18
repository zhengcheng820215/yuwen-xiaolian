import {
  normalizeRuntimeError,
  type NormalizeRuntimeErrorContext,
  type RuntimeErrorRecoverability,
  type StructuredRuntimeErrorCode,
} from '../ai/errors/structuredRuntimeError.ts';

export interface WorkbenchErrorNotice {
  type: 'error';
  message: string;
  errorCode: StructuredRuntimeErrorCode;
  operation: string;
  objectId?: string;
  recoverability: RuntimeErrorRecoverability;
  recoveryMessage: string;
}

export function createWorkbenchErrorNotice(
  error: unknown,
  context?: NormalizeRuntimeErrorContext,
): WorkbenchErrorNotice {
  const normalized = normalizeRuntimeError(error, context);
  return {
    type: 'error',
    message: userFacingMessage(normalized.message),
    errorCode: normalized.code,
    operation: normalized.operation,
    objectId: normalized.objectId,
    recoverability: normalized.recoverability,
    recoveryMessage: recoveryMessage(normalized.recoverability),
  };
}

function userFacingMessage(message: string): string {
  if (message === 'Question quality assessments are not identity-aligned.') {
    return '质量检查结果已更新，请重新检查后再确认发布。';
  }
  if (message === 'Observation Tasks in one batch require distinct question stems.') {
    return '当前任务方案包含重复题干，不能保存。原任务与候选均已保留，请重新生成补充候选。';
  }
  return message;
}

function recoveryMessage(recoverability: RuntimeErrorRecoverability): string {
  switch (recoverability) {
    case 'retry_safe':
      return '可以直接重试。';
    case 'reload_required':
      return '请刷新当前数据后再试。';
    case 'user_action_required':
      return '请按提示补充或修正后再继续。';
    case 'new_revision_required':
      return '请基于当前正式版本创建新修订。';
    case 'service_required':
      return '请先恢复共享资源服务。';
    case 'human_review_required':
      return '请保留错误码并进行人工检查。';
  }
}
