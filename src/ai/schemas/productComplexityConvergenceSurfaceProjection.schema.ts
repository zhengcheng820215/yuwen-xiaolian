export const PRODUCT_COMPLEXITY_CONVERGENCE_STAGE1_SURFACE_PROJECTION_VERSION =
  'product_complexity_convergence_stage1_surface_projection_v1' as const;

export const PRODUCT_SURFACE_AUDIENCES = ['authoring_user', 'learning_student'] as const;
export type ProductSurfaceAudience = typeof PRODUCT_SURFACE_AUDIENCES[number];

export const PRODUCT_SURFACE_TONES = ['neutral', 'progress', 'success', 'warning', 'error'] as const;
export type ProductSurfaceTone = typeof PRODUCT_SURFACE_TONES[number];

export const PRODUCT_SURFACE_EMPHASIS = ['primary', 'secondary', 'text'] as const;
export type ProductSurfaceEmphasis = typeof PRODUCT_SURFACE_EMPHASIS[number];

export const AUTHORING_SURFACE_STATES = [
  'no_candidate', 'generating', 'candidate_ready', 'publishing', 'published',
  'recoverable_failure', 'version_conflict',
] as const;
export type AuthoringSurfaceState = typeof AUTHORING_SURFACE_STATES[number];

export const LEARNING_SURFACE_STATES = [
  'entry', 'task', 'feedback', 'revision', 'targeted', 'retest', 'transfer',
  'complete', 'recoverable_failure',
] as const;
export type LearningSurfaceState = typeof LEARNING_SURFACE_STATES[number];

export type ProductSurfaceAction = {
  actionId: string;
  commandId: string;
  label: string;
  emphasis: ProductSurfaceEmphasis;
  disabled: boolean;
  busy: boolean;
};

export type ProductSurfaceDisclosure = {
  disclosureId: string;
  label: string;
  expanded: boolean;
};

export type ProductSurfaceRecovery = {
  errorCategory: 'temporary' | 'conflict' | 'validation' | 'unavailable' | 'unknown';
  userMessage: string;
  preservationMessage: string;
  action: ProductSurfaceAction;
  internalErrorRef?: string;
};

export type ProductSurfaceProjection = {
  projectionVersion: typeof PRODUCT_COMPLEXITY_CONVERGENCE_STAGE1_SURFACE_PROJECTION_VERSION;
  surfaceId: string;
  audience: ProductSurfaceAudience;
  stateId: string;
  title?: string;
  status?: { tone: ProductSurfaceTone; label: string; detail?: string };
  primaryAction?: ProductSurfaceAction;
  secondaryActions: ProductSurfaceAction[];
  disclosureSections: ProductSurfaceDisclosure[];
  localRecovery?: ProductSurfaceRecovery;
};

export type AuthoringSurfaceFacts = {
  surfaceId: string;
  state: AuthoringSurfaceState;
  canGenerate?: boolean;
  canAdoptAndPublish?: boolean;
  canRegenerate?: boolean;
  canRetry?: boolean;
  publishedTaskCount?: number;
  preservedContent?: 'candidate' | 'draft' | 'published' | 'none';
  internalErrorRef?: string;
};

export type LearningSurfaceFacts = {
  surfaceId: string;
  state: LearningSurfaceState;
  currentQuestionNumber?: number;
  totalQuestionCount?: number;
  canContinue?: boolean;
  canSubmit?: boolean;
  canSaveDraft?: boolean;
  canRevise?: boolean;
  hintAvailable?: boolean;
  hintExpanded?: boolean;
  internalErrorRef?: string;
};

export function isProductSurfaceAction(value: unknown): value is ProductSurfaceAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as ProductSurfaceAction;
  return Boolean(action.actionId?.trim())
    && Boolean(action.commandId?.trim())
    && Boolean(action.label?.trim())
    && (PRODUCT_SURFACE_EMPHASIS as readonly string[]).includes(action.emphasis)
    && typeof action.disabled === 'boolean'
    && typeof action.busy === 'boolean';
}

export function isProductSurfaceProjection(value: unknown): value is ProductSurfaceProjection {
  if (!value || typeof value !== 'object') return false;
  const projection = value as ProductSurfaceProjection;
  if (projection.projectionVersion !== PRODUCT_COMPLEXITY_CONVERGENCE_STAGE1_SURFACE_PROJECTION_VERSION
    || !projection.surfaceId?.trim()
    || !(PRODUCT_SURFACE_AUDIENCES as readonly string[]).includes(projection.audience)
    || !projection.stateId?.trim()
    || !Array.isArray(projection.secondaryActions)
    || !projection.secondaryActions.every(isProductSurfaceAction)
    || !Array.isArray(projection.disclosureSections)) return false;
  if (projection.primaryAction && (!isProductSurfaceAction(projection.primaryAction)
    || projection.primaryAction.emphasis !== 'primary')) return false;
  if (projection.status && !(PRODUCT_SURFACE_TONES as readonly string[]).includes(projection.status.tone)) return false;
  if (projection.localRecovery && !isProductSurfaceAction(projection.localRecovery.action)) return false;
  return true;
}
