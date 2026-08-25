import type { StructuredRuntimeError } from '../errors/structuredRuntimeError.ts';
import type { ProductRuntimeHealth } from './productRuntimeHealth.schema.ts';
import type { ProductRuntimeReasonCode } from './productRuntimeBaselineAudit.schema.ts';

export const PRODUCT_RUNTIME_USER_PROJECTION_VERSION = 'product_runtime_user_projection_v1' as const;
export const PRODUCT_RUNTIME_USER_SURFACES = ['learning_entry', 'learning_workspace', 'workbench'] as const;
export type ProductRuntimeUserSurface = typeof PRODUCT_RUNTIME_USER_SURFACES[number];
export const PRODUCT_RUNTIME_USER_STATES = [
  'ready', 'runtime_unavailable', 'formal_resource_unavailable', 'no_task',
  'ai_configuration_required', 'ai_temporarily_unavailable', 'session_recoverable',
  'submission_recoverable', 'identity_conflict', 'operation_retryable', 'operation_blocked',
] as const;
export type ProductRuntimeUserProjectionState = typeof PRODUCT_RUNTIME_USER_STATES[number];
export type ProductRuntimeContentState =
  | 'not_started' | 'draft_preserved' | 'progress_preserved' | 'answer_submitted'
  | 'published_preserved' | 'unknown_requires_check';
export type ProductRuntimeProjectionOperation =
  | 'load_entry' | 'start_learning' | 'load_task' | 'submit_answer' | 'resume_diagnosis'
  | 'workbench_read' | 'workbench_generate' | 'workbench_adopt' | 'workbench_publish';

export type ProductRuntimeUserAction = {
  actionId: 'retry_health' | 'retry_read' | 'continue_learning' | 'continue_processing'
    | 'retry_current_operation' | 'return_to_entry' | 'none';
  label: string;
  emphasis: 'primary' | 'none';
  idempotencyRequired: boolean;
};

export type ProductRuntimeUserProjection = {
  schemaVersion: typeof PRODUCT_RUNTIME_USER_PROJECTION_VERSION;
  surface: ProductRuntimeUserSurface;
  state: ProductRuntimeUserProjectionState;
  tone: 'neutral' | 'information' | 'recoverable' | 'blocked';
  title: string;
  situationText: string;
  contentState: ProductRuntimeContentState;
  preservationText: string;
  primaryAction: ProductRuntimeUserAction;
  secondaryAction?: { actionId: 'return_to_entry'; label: '返回学习入口' | '返回工作台'; emphasis: 'secondary' };
  internal: { reasonCodes: ProductRuntimeReasonCode[]; errorRef?: string; healthFactDigest?: string };
  projectionDigest: string;
};

export type ProductRuntimeProjectionContext = {
  surface: ProductRuntimeUserSurface;
  operation?: ProductRuntimeProjectionOperation;
  health?: ProductRuntimeHealth;
  healthReadState: 'available' | 'unreachable' | 'timeout' | 'invalid';
  reasonCodes?: ProductRuntimeReasonCode[];
  ownerFacts: {
    hasActiveSession: boolean | 'unknown';
    hasDraft: boolean | 'unknown';
    attemptCommitted: boolean | 'unknown';
    checkpointPhase?: string;
    publishedResourceCommitted: boolean | 'unknown';
    currentWorkbenchObjectPresent: boolean | 'unknown';
  };
  taskAvailability?: 'available' | 'no_formal_resource' | 'no_eligible_match' | 'already_used' | 'stale_session';
  runtimeError?: StructuredRuntimeError;
  errorRef?: string;
};

export function isProductRuntimeUserProjection(value: unknown): value is ProductRuntimeUserProjection {
  if (!value || typeof value !== 'object') return false;
  const projection = value as ProductRuntimeUserProjection;
  return projection.schemaVersion === PRODUCT_RUNTIME_USER_PROJECTION_VERSION
    && (PRODUCT_RUNTIME_USER_SURFACES as readonly string[]).includes(projection.surface)
    && (PRODUCT_RUNTIME_USER_STATES as readonly string[]).includes(projection.state)
    && Boolean(projection.title?.trim())
    && Boolean(projection.situationText?.trim())
    && Boolean(projection.preservationText?.trim())
    && Boolean(projection.primaryAction?.actionId)
    && Array.isArray(projection.internal?.reasonCodes)
    && projection.projectionDigest?.startsWith('fnv1a-');
}
