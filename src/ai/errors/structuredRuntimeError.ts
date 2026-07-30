export const STRUCTURED_RUNTIME_ERROR_VERSION = '1.0';

export type StructuredRuntimeErrorCode =
  | 'FORMAL_RESOURCE_IMMUTABLE_CONFLICT'
  | 'FORMAL_RESOURCE_REVISION_CONFLICT'
  | 'QUESTION_DRAFT_REVISION_CONFLICT'
  | 'QUESTION_REVIEW_IMMUTABLE_CONFLICT'
  | 'FORMAL_RESOURCE_NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'VALIDATION_REQUIRED'
  | 'VALIDATION_FAILED'
  | 'VALIDATION_STALE'
  | 'QUALITY_ASSESSMENT_REQUIRED'
  | 'REVIEW_WARNING_DECISION_REQUIRED'
  | 'PUBLICATION_PREFLIGHT_FAILED'
  | 'PUBLICATION_RECOVERY_REQUIRED'
  | 'SHARED_STORE_UNAVAILABLE'
  | 'OPERATION_NOT_ALLOWED'
  | 'INPUT_INVALID'
  | 'RUNTIME_OPERATION_FAILED';

export type RuntimeErrorRecoverability =
  | 'retry_safe'
  | 'reload_required'
  | 'user_action_required'
  | 'new_revision_required'
  | 'service_required'
  | 'human_review_required';

export interface StructuredRuntimeErrorInput {
  code: StructuredRuntimeErrorCode;
  message: string;
  operation: string;
  objectId?: string;
  recoverability: RuntimeErrorRecoverability;
  cause?: unknown;
}

export class StructuredRuntimeError extends Error {
  readonly errorVersion = STRUCTURED_RUNTIME_ERROR_VERSION;
  readonly code: StructuredRuntimeErrorCode;
  readonly operation: string;
  readonly objectId?: string;
  readonly recoverability: RuntimeErrorRecoverability;

  constructor(input: StructuredRuntimeErrorInput) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = 'StructuredRuntimeError';
    this.code = input.code;
    this.operation = input.operation;
    this.objectId = input.objectId;
    this.recoverability = input.recoverability;
  }

  toJSON() {
    return {
      errorVersion: this.errorVersion,
      name: this.name,
      code: this.code,
      message: this.message,
      operation: this.operation,
      objectId: this.objectId,
      recoverability: this.recoverability,
    };
  }
}

export function createStructuredRuntimeError(
  input: StructuredRuntimeErrorInput,
): StructuredRuntimeError {
  return new StructuredRuntimeError(input);
}

export function isStructuredRuntimeError(error: unknown): error is StructuredRuntimeError {
  return error instanceof StructuredRuntimeError;
}

export interface NormalizeRuntimeErrorContext {
  operation?: string;
  objectId?: string;
}

export function normalizeRuntimeError(
  error: unknown,
  context: NormalizeRuntimeErrorContext = {},
): StructuredRuntimeError {
  if (isStructuredRuntimeError(error)) return error;

  const originalMessage = error instanceof Error ? error.message : String(error);
  const mapped = mapLegacyError(originalMessage);

  return createStructuredRuntimeError({
    code: mapped.code,
    message: mapped.message || originalMessage || '运行操作失败。',
    operation: context.operation || mapped.operation || 'runtime.unknown',
    objectId: context.objectId || mapped.objectId,
    recoverability: mapped.recoverability,
    cause: error,
  });
}

interface LegacyErrorMapping {
  code: StructuredRuntimeErrorCode;
  message?: string;
  operation?: string;
  objectId?: string;
  recoverability: RuntimeErrorRecoverability;
}

function mapLegacyError(message: string): LegacyErrorMapping {
  const lower = message.toLowerCase();
  const objectId = extractObjectId(message);

  if (lower.includes('shared formal resource') || lower.includes('shared store')) {
    return {
      code: 'SHARED_STORE_UNAVAILABLE',
      message: '共享资源服务暂时不可用，正式写入已阻断。',
      operation: 'shared_store.access',
      objectId,
      recoverability: 'service_required',
    };
  }
  if (lower.includes('revision conflict') || lower.includes('revision mismatch')) {
    return {
      code: 'FORMAL_RESOURCE_REVISION_CONFLICT',
      message: '资源已被其他操作更新，请刷新后再继续。',
      objectId,
      recoverability: 'reload_required',
    };
  }
  if (lower.includes('immutable') || lower.includes('cannot overwrite')) {
    return {
      code: 'FORMAL_RESOURCE_IMMUTABLE_CONFLICT',
      message: '正式记录不可覆盖，请创建新修订版本。',
      objectId,
      recoverability: 'new_revision_required',
    };
  }
  if (lower.includes('quality assessment') && lower.includes('required')) {
    return {
      code: 'QUALITY_ASSESSMENT_REQUIRED',
      message: '缺少当前修订版本的质量评估，不能继续审核或冻结。',
      objectId,
      recoverability: 'user_action_required',
    };
  }
  if (lower.includes('validation is stale')) {
    return {
      code: 'VALIDATION_STALE',
      message: '题目已被修改，原校验结果已失效，请重新校验。',
      objectId,
      recoverability: 'user_action_required',
    };
  }
  if (lower.includes('validation has not passed')) {
    return {
      code: 'VALIDATION_FAILED',
      message: '当前题目校验未通过，不能继续审核或冻结。',
      objectId,
      recoverability: 'user_action_required',
    };
  }
  if (lower.includes('has not been validated') || lower.includes('validation is required')) {
    return {
      code: 'VALIDATION_REQUIRED',
      message: '当前题目尚未完成结构化校验。',
      objectId,
      recoverability: 'user_action_required',
    };
  }
  if (lower.includes('not found') || lower.includes('is missing')) {
    return {
      code: 'FORMAL_RESOURCE_NOT_FOUND',
      message: '未找到所需资源，请刷新数据并确认资源仍然有效。',
      objectId,
      recoverability: 'reload_required',
    };
  }
  if (lower.includes('cannot be') || lower.includes('only ') || lower.includes('current status')) {
    return {
      code: 'INVALID_STATE_TRANSITION',
      message,
      objectId,
      recoverability: 'user_action_required',
    };
  }
  if (lower.includes('required') || lower.includes('invalid')) {
    return {
      code: 'INPUT_INVALID',
      message,
      objectId,
      recoverability: 'user_action_required',
    };
  }

  return {
    code: 'RUNTIME_OPERATION_FAILED',
    message,
    objectId,
    recoverability: 'human_review_required',
  };
}

function extractObjectId(message: string): string | undefined {
  const trailing = message.match(
    /(?:conflict|immutable|missing|not found):\s*([a-z0-9][a-z0-9:_-]+)/i,
  );
  if (trailing?.[1]) return trailing[1];

  const labeled = message.match(
    /(?:assessment|draft|resource|plan|record|object)(?:\s+id)?\s*:\s*([a-z0-9][a-z0-9:_-]+)/i,
  );
  if (labeled?.[1]) return labeled[1];

  const quoted = message.match(/['"]([a-z0-9][a-z0-9:_-]{5,})['"]/i);
  return quoted?.[1];
}
