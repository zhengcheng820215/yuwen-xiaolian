import type { SharedFormalResourceSnapshot } from '../schemas/sharedFormalResourcePersistence.schema.ts';
import {
  PRODUCT_RUNTIME_HEALTH_VERSION,
  PRODUCT_RUNTIME_ID,
  PRODUCT_RUNTIME_PORT,
  type ProductRuntimeHealth,
  type ProductRuntimeTrialMode,
} from '../schemas/productRuntimeHealth.schema.ts';
import type { ProductRuntimeReasonCode } from '../schemas/productRuntimeBaselineAudit.schema.ts';
import { buildDynamicFormalResourceBaseline, stableHash } from './productRuntimeBaselineAuditService.ts';

export type ProductRuntimeHealthInput = {
  checkedAt: string;
  snapshot?: SharedFormalResourceSnapshot;
  formalStoreError?: boolean;
  aiConfigured: boolean | null;
  aiAvailabilityVerified?: boolean;
  buildIdentity?: string;
  buildIdentityContentAddressed?: boolean;
  runtimeIdentityVersion?: 'product_runtime_identity_v1';
  runtimeIdentityStatus?: 'available' | 'missing' | 'invalid' | 'dirty';
  trial?: {
    requestedMode: ProductRuntimeTrialMode;
    effectiveMode: ProductRuntimeTrialMode;
    identityStatus: 'aligned' | 'mismatch' | 'insufficient_evidence' | 'missing' | 'invalid' | 'dirty' | 'legacy_unverifiable';
    observationAvailable?: boolean;
  };
};

export function buildProductRuntimeHealth(input: ProductRuntimeHealthInput): ProductRuntimeHealth {
  const instanceReasons: ProductRuntimeReasonCode[] = input.buildIdentityContentAddressed
    ? [] : ['runtime_identity_insufficient'];
  const formal = buildFormalHealth(input);
  const availabilityVerified = input.aiConfigured === true && input.aiAvailabilityVerified === true;
  const ai = input.aiConfigured === true
    ? {
      providerId: 'deepseek' as const,
      status: 'configured' as const,
      verificationLevel: availabilityVerified ? 'live_verified' as const : 'configuration_only' as const,
      availabilityVerified,
      trialEligible: availabilityVerified,
      reasonCodes: availabilityVerified ? [] as ProductRuntimeReasonCode[] : ['ai_provider_status_not_checked' as const],
    }
    : input.aiConfigured === false
      ? { providerId: 'deepseek' as const, status: 'not_configured' as const, verificationLevel: 'configuration_only' as const, availabilityVerified: false, trialEligible: false, reasonCodes: ['ai_provider_not_configured' as const] }
      : { providerId: 'deepseek' as const, status: 'not_checked' as const, verificationLevel: 'configuration_only' as const, availabilityVerified: false, trialEligible: false, reasonCodes: ['ai_provider_status_not_checked' as const] };
  const learning = buildLearningHealth(formal.status, ai.status);
  const trialInput = input.trial || {
    requestedMode: 'off' as const,
    effectiveMode: 'off' as const,
    identityStatus: 'mismatch' as const,
    observationAvailable: true,
  };
  const trialReasons: ProductRuntimeReasonCode[] = [];
  if (trialInput.identityStatus === 'mismatch') trialReasons.push('trial_identity_mismatch', 'trial_reentry_required');
  if (['insufficient_evidence', 'missing', 'invalid', 'dirty', 'legacy_unverifiable'].includes(trialInput.identityStatus)) trialReasons.push('audit_evidence_incomplete', 'trial_reentry_required');
  if (trialInput.observationAvailable === false) trialReasons.push('trial_observation_unavailable');
  const summaryReasonCodes = uniqueSorted([
    ...instanceReasons,
    ...formal.reasonCodes,
    ...ai.reasonCodes,
    ...learning.reasonCodes,
    ...trialReasons,
  ]);
  const blocked = formal.status === 'blocked' || learning.status === 'blocked';
  const degraded = instanceReasons.length > 0 || ai.status !== 'configured' || !availabilityVerified
    || learning.status === 'degraded' || trialReasons.length > 0;
  const resultWithoutDigest = {
    schemaVersion: PRODUCT_RUNTIME_HEALTH_VERSION,
    checkedAt: input.checkedAt,
    overallStatus: blocked ? 'blocked' as const : degraded ? 'degraded' as const : 'ready' as const,
    instance: {
      productId: PRODUCT_RUNTIME_ID,
      port: PRODUCT_RUNTIME_PORT,
      runtimeStatus: 'ready' as const,
      buildIdentityStatus: input.buildIdentityContentAddressed ? 'available' as const : 'insufficient' as const,
      buildIdentity: input.buildIdentity,
      runtimeIdentityVersion: input.runtimeIdentityVersion,
      runtimeIdentityStatus: input.runtimeIdentityStatus,
      reasonCodes: instanceReasons,
    },
    formalResourceStore: formal,
    aiProvider: ai,
    learning,
    trial: {
      requestedMode: trialInput.requestedMode,
      effectiveMode: trialInput.identityStatus === 'aligned' ? trialInput.effectiveMode : 'off' as const,
      identityStatus: trialInput.identityStatus,
      identityAlignment: trialInput.identityStatus,
      observationFailOpen: true as const,
      reasonCodes: uniqueSorted(trialReasons),
    },
    summaryReasonCodes,
  };
  const { checkedAt: _checkedAt, ...facts } = resultWithoutDigest;
  return { ...resultWithoutDigest, factDigest: stableHash(facts) };
}

function buildFormalHealth(input: ProductRuntimeHealthInput): ProductRuntimeHealth['formalResourceStore'] {
  if (input.formalStoreError || !input.snapshot) return {
    status: 'blocked', initialized: false, reasonCodes: ['formal_store_unreadable'],
  };
  if (!input.snapshot.initialized) return {
    status: 'blocked', initialized: false, revision: input.snapshot.revision,
    reasonCodes: ['formal_store_uninitialized'],
  };
  try {
    const baseline = buildDynamicFormalResourceBaseline(input.snapshot, input.checkedAt);
    if (baseline.issueCodes.length) return {
      status: 'blocked', initialized: true, revision: baseline.storeRevision,
      activeMaterialCount: baseline.activeMaterialCount,
      currentQuestionCount: baseline.currentTaskCount,
      learningConsumableQuestionCount: baseline.learningConsumableQuestionCount,
      baselineDigest: baseline.baselineDigest,
      reasonCodes: ['formal_resource_baseline_inconsistent'],
    };
    return {
      status: 'ready', initialized: true, revision: baseline.storeRevision,
      activeMaterialCount: baseline.activeMaterialCount,
      currentQuestionCount: baseline.currentTaskCount,
      learningConsumableQuestionCount: baseline.learningConsumableQuestionCount,
      baselineDigest: baseline.baselineDigest,
      reasonCodes: [],
    };
  } catch {
    return { status: 'blocked', initialized: true, revision: input.snapshot.revision, reasonCodes: ['formal_store_unreadable'] };
  }
}

function buildLearningHealth(
  formalStatus: ProductRuntimeHealth['formalResourceStore']['status'],
  aiStatus: ProductRuntimeHealth['aiProvider']['status'],
): ProductRuntimeHealth['learning'] {
  if (formalStatus === 'blocked') return {
    status: 'blocked', canReadFormalTasks: false, canStartRealLearning: false,
    canSubmitForDiagnosis: false, reasonCodes: ['formal_resource_boundary_unavailable'],
  };
  if (aiStatus !== 'configured') return {
    status: 'degraded', canReadFormalTasks: true, canStartRealLearning: false,
    canSubmitForDiagnosis: false,
    reasonCodes: [aiStatus === 'not_configured' ? 'ai_provider_not_configured' : 'ai_provider_status_not_checked'],
  };
  // “允许发起”只表示本地产品可尝试调用已配置的服务；真实 Trial 是否可进入
  // 由 aiProvider.trialEligible 单独表达，不能反向阻断普通学习主链。
  return {
    status: 'ready', canReadFormalTasks: true, canStartRealLearning: true,
    canSubmitForDiagnosis: true, reasonCodes: [],
  };
}

function uniqueSorted(values: ProductRuntimeReasonCode[]): ProductRuntimeReasonCode[] {
  return [...new Set(values)].sort();
}
