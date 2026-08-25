import type { ProductRuntimeReasonCode } from './productRuntimeBaselineAudit.schema.ts';

export const PRODUCT_RUNTIME_HEALTH_VERSION = 'product_runtime_health_v1' as const;
export const PRODUCT_RUNTIME_LAUNCH_RESULT_VERSION = 'product_runtime_launch_result_v1' as const;
export const PRODUCT_RUNTIME_ID = 'chinese_ability_growth_system_local_runtime' as const;
export const PRODUCT_RUNTIME_PORT = 5174 as const;

export type ProductRuntimeOverallStatus = 'ready' | 'degraded' | 'blocked';
export type ProductRuntimeTrialMode = 'off' | 'isolated_acceptance' | 'real_trial';

export type ProductRuntimeHealth = {
  schemaVersion: typeof PRODUCT_RUNTIME_HEALTH_VERSION;
  checkedAt: string;
  overallStatus: ProductRuntimeOverallStatus;
  instance: {
    productId: typeof PRODUCT_RUNTIME_ID;
    port: typeof PRODUCT_RUNTIME_PORT;
    runtimeStatus: 'ready';
    buildIdentityStatus: 'insufficient' | 'available';
    buildIdentity?: string;
    reasonCodes: ProductRuntimeReasonCode[];
  };
  formalResourceStore: {
    status: 'ready' | 'blocked';
    initialized: boolean;
    revision?: number;
    activeMaterialCount?: number;
    currentQuestionCount?: number;
    learningConsumableQuestionCount?: number;
    baselineDigest?: string;
    reasonCodes: ProductRuntimeReasonCode[];
  };
  aiProvider: {
    providerId: 'deepseek';
    status: 'configured' | 'not_configured' | 'not_checked';
    verificationLevel: 'configuration_only';
    reasonCodes: ProductRuntimeReasonCode[];
  };
  learning: {
    status: ProductRuntimeOverallStatus;
    canReadFormalTasks: boolean;
    canStartRealLearning: boolean;
    canSubmitForDiagnosis: boolean;
    reasonCodes: ProductRuntimeReasonCode[];
  };
  trial: {
    requestedMode: ProductRuntimeTrialMode;
    effectiveMode: ProductRuntimeTrialMode;
    identityStatus: 'aligned' | 'mismatch' | 'insufficient_evidence';
    observationFailOpen: true;
    reasonCodes: ProductRuntimeReasonCode[];
  };
  summaryReasonCodes: ProductRuntimeReasonCode[];
  factDigest: string;
};

export const PRODUCT_RUNTIME_LAUNCH_STATUSES = [
  'READY',
  'ALREADY_RUNNING',
  'CHECK_READY',
  'CHECK_DEGRADED',
  'BLOCKED_RUNTIME_MISSING',
  'BLOCKED_DEPENDENCY_MISSING',
  'BLOCKED_PORT_CONFLICT',
  'BLOCKED_FORMAL_STORE_UNREADABLE',
  'BLOCKED_CHILD_EXITED',
  'BLOCKED_HEALTH_TIMEOUT',
] as const;
export type ProductRuntimeLaunchStatus = typeof PRODUCT_RUNTIME_LAUNCH_STATUSES[number];

export type ProductRuntimeLaunchResult = {
  schemaVersion: typeof PRODUCT_RUNTIME_LAUNCH_RESULT_VERSION;
  status: ProductRuntimeLaunchStatus;
  exitCode: 0 | 1;
  ownsChildProcess: boolean;
  childPid?: number;
  health?: ProductRuntimeHealth;
  reasonCodes: ProductRuntimeReasonCode[];
  urls: {
    learning: string;
    workbench: string;
    internalHealth: string;
    healthApi: string;
  };
};

export function isProductRuntimeHealth(value: unknown): value is ProductRuntimeHealth {
  if (!value || typeof value !== 'object') return false;
  const health = value as ProductRuntimeHealth;
  return health.schemaVersion === PRODUCT_RUNTIME_HEALTH_VERSION
    && health.instance?.productId === PRODUCT_RUNTIME_ID
    && health.instance?.port === PRODUCT_RUNTIME_PORT
    && health.instance?.runtimeStatus === 'ready'
    && ['ready', 'degraded', 'blocked'].includes(health.overallStatus)
    && ['ready', 'blocked'].includes(health.formalResourceStore?.status)
    && ['configured', 'not_configured', 'not_checked'].includes(health.aiProvider?.status)
    && ['ready', 'degraded', 'blocked'].includes(health.learning?.status)
    && health.trial?.observationFailOpen === true
    && Array.isArray(health.summaryReasonCodes)
    && typeof health.factDigest === 'string'
    && health.factDigest.startsWith('fnv1a-');
}

export function isProductRuntimeLaunchResult(value: unknown): value is ProductRuntimeLaunchResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as ProductRuntimeLaunchResult;
  return result.schemaVersion === PRODUCT_RUNTIME_LAUNCH_RESULT_VERSION
    && (PRODUCT_RUNTIME_LAUNCH_STATUSES as readonly string[]).includes(result.status)
    && [0, 1].includes(result.exitCode)
    && typeof result.ownsChildProcess === 'boolean'
    && Array.isArray(result.reasonCodes)
    && Boolean(result.urls?.healthApi);
}
