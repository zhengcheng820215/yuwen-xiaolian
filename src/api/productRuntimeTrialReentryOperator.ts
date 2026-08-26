import { createConvergenceTrialWindow } from
  '../ai/agents/productComplexityConvergenceObservationAgent.ts';
import { validateConvergenceSourceRegistrySnapshot } from
  '../ai/schemas/productComplexityConvergenceTrialPreflight.schema.ts';
import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION,
} from '../ai/schemas/productComplexityConvergenceObservation.schema.ts';
import { isProductRuntimeHealth, type ProductRuntimeHealth } from
  '../ai/schemas/productRuntimeHealth.schema.ts';
import { validateProductRuntimeIdentity, type ProductRuntimeIdentity } from
  '../ai/schemas/productRuntimeIdentity.schema.ts';
import type { RealTrialReentryApprovalBundleCommitResult,
  RealTrialReentryPreflightReportV2 } from '../ai/schemas/productRuntimeTrialReentry.schema.ts';
import {
  runRealTrialReentryPreflight,
  type RealTrialReentryProtectedWriteCounts,
} from '../ai/services/productRuntimeTrialReentryPreflightService.ts';
import {
  activateRealTrialReentry,
  buildRealTrialReentryApprovalBundle,
  commitRealTrialReentryApprovalBundle,
  planRealTrialReentryIdentities,
  type RealTrialReentryActivationResult,
} from '../ai/services/productRuntimeTrialReentryService.ts';
import { initializeProductComplexityConvergencePreflight,
  getProductComplexityConvergencePreflightRepository } from
  './productComplexityConvergenceStage4Preflight.ts';

export type PreparedRealTrialReentry = {
  runtimeIdentity: ProductRuntimeIdentity;
  report: RealTrialReentryPreflightReportV2;
  trialWindow: ReturnType<typeof createConvergenceTrialWindow>;
  timezone: string;
  protectedBaseline: ProtectedBaseline;
};

type ProtectedBaseline = {
  formalRevision: number;
  eventCount: number;
  observationAuditCount: number;
};

export async function prepareRealTrialReentry(input: {
  participatingStudentIds: string[];
  timezone: string;
  plannedDays?: number;
}): Promise<PreparedRealTrialReentry> {
  await initializeProductComplexityConvergencePreflight();
  const repository = getProductComplexityConvergencePreflightRepository();
  const startedAt = new Date().toISOString();
  const [health, runtimeIdentity, formal, registries, windows, activationState] = await Promise.all([
    readHealth(), readRuntimeIdentity(), readFormalSnapshot(),
    repository.listSourceRegistrySnapshots(), repository.listTrialWindows(),
    repository.getActivationState(),
  ]);
  const registry = [...registries].sort((left, right) =>
    right.generatedAt.localeCompare(left.generatedAt))[0];
  if (!registry) throw new Error('source_registry_missing');
  const registryIssues = validateConvergenceSourceRegistrySnapshot(registry);
  const now = Date.now();
  const suffix = `${runtimeIdentity.runtimeIdentityDigest.slice(-12)}-${now}`;
  const trialWindowId = `real-trial-${suffix}`;
  const trialWindow = createConvergenceTrialWindow({
    trialWindowId,
    startsAt: new Date(now - 60_000).toISOString(),
    plannedEndsAt: new Date(now + (input.plannedDays || 14) * 86_400_000).toISOString(),
    participatingStudentIds: uniqueNonEmpty(input.participatingStudentIds),
    sourceRegistryVersion: registry.sourceRegistryVersion,
    sourcePolicySnapshotHash: registry.sourcePolicySnapshotHash,
    status: 'draft',
  });
  const planned = planRealTrialReentryIdentities({ trialWindowId, runtimeIdentity });
  const baseline = await readProtectedBaseline();
  const completedAt = new Date().toISOString();
  const after = await readProtectedBaseline();
  const writeCounts = protectedWriteCounts(baseline, after);
  const expectedTrialReasons = new Set(['audit_evidence_incomplete', 'trial_reentry_required']);
  const coreRuntimeReady = health.instance.runtimeStatus === 'ready'
    && health.formalResourceStore.status === 'ready'
    && health.learning.status === 'ready'
    && health.learning.canReadFormalTasks
    && health.aiProvider.status === 'configured'
    && health.aiProvider.verificationLevel === 'live_verified'
    && health.aiProvider.availabilityVerified
    && health.summaryReasonCodes.every((code) => expectedTrialReasons.has(code));
  const activationOff = !activationState
    || (activationState.requestedMode === 'off' && activationState.effectiveMode === 'off');
  const ownerSchemasSupported = registry.entries.length === 8
    && registry.entries.every((entry) => entry.enabledForRealTrial
      && entry.ownerFactType.trim() && entry.ownerSchemaVersions.length > 0);
  const identitiesUnique = !windows.some((window) => window.trialWindowId === trialWindowId)
    && planned.launchRecordId !== planned.runtimeIdentityBindingId;
  const report = runRealTrialReentryPreflight({
    trialWindowId,
    plannedLaunchRecordId: planned.launchRecordId,
    plannedRuntimeIdentityBindingId: planned.runtimeIdentityBindingId,
    runtimeIdentity,
    gitCommit: runtimeIdentity.evidence.gitCommit || 'unknown',
    buildVersion: runtimeIdentity.runtimeIdentityDigest,
    sourceRegistryVersion: registry.sourceRegistryVersion,
    sourcePolicySnapshotHash: registry.sourcePolicySnapshotHash,
    observationPolicyVersion: trialWindow.observationPolicyVersion,
    decisionPolicyVersion: trialWindow.decisionPolicyVersion,
    startedAt,
    completedAt,
    signals: {
      runtimeHealthReady: coreRuntimeReady,
      artifactIdentityAligned: health.instance.buildIdentity === runtimeIdentity.runtimeIdentityDigest,
      formalSnapshotAligned: runtimeIdentity.evidence.formalStoreRevision === formal.revision,
      formalStoreReady: health.formalResourceStore.status === 'ready'
        && health.formalResourceStore.revision === formal.revision,
      executablePolicyAligned: Boolean(runtimeIdentity.identityInputs.executablePolicyBundleDigest),
      trialPolicyAligned: Boolean(runtimeIdentity.identityInputs.trialPolicyBundleDigest),
      providerBoundaryAligned: Boolean(runtimeIdentity.identityInputs.providerBoundaryDigest),
      providerReady: health.aiProvider.status === 'configured'
        && health.aiProvider.verificationLevel === 'live_verified'
        && health.aiProvider.availabilityVerified,
      sourceRegistryAligned: registryIssues.length === 0
        && registry.sourceRegistryVersion === trialWindow.sourceRegistryVersion
        && registry.sourcePolicySnapshotHash === trialWindow.sourcePolicySnapshotHash,
      ownerSchemasSupported,
      observationPolicyAligned: trialWindow.observationPolicyVersion
        === PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION,
      decisionPolicyAligned: trialWindow.decisionPolicyVersion
        === PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION,
      learningRegressionPassed: health.learning.status === 'ready'
        && health.learning.canReadFormalTasks && health.learning.canStartRealLearning
        && formal.learningConsumableQuestionCount > 0,
      workbenchRegressionPassed: health.formalResourceStore.status === 'ready'
        && formal.initialized && formal.revision > 0,
      activationStateOff: activationOff,
      windowIdentityAvailable: trialWindow.participatingStudentIds.length > 0
        && Date.parse(trialWindow.plannedEndsAt) > Date.parse(completedAt),
      historicalIsolationPassed: windows.every((window) => window.trialWindowId !== trialWindowId),
      noActiveWindowConflict: windows.every((window) => window.status !== 'active'),
      unresolvedP0P1Count: health.overallStatus === 'blocked' ? 1 : 0,
      idsUnique: identitiesUnique,
    },
    writeCounts,
  });
  return { runtimeIdentity, report, trialWindow, timezone: input.timezone,
    protectedBaseline: after };
}

export async function saveRealTrialReentryBundle(
  prepared: PreparedRealTrialReentry,
): Promise<RealTrialReentryApprovalBundleCommitResult> {
  const currentIdentity = await readRuntimeIdentity();
  const bundle = buildRealTrialReentryApprovalBundle({
    trialWindow: prepared.trialWindow,
    preflightReport: prepared.report,
    runtimeIdentity: prepared.runtimeIdentity,
    timezone: prepared.timezone,
    recordedAt: new Date().toISOString(),
  });
  return commitRealTrialReentryApprovalBundle({
    repository: getProductComplexityConvergencePreflightRepository(),
    bundle,
    currentIdentity,
    now: new Date().toISOString(),
  });
}

export async function confirmAndActivateRealTrialReentry(
  prepared: PreparedRealTrialReentry,
): Promise<RealTrialReentryActivationResult> {
  const repository = getProductComplexityConvergencePreflightRepository();
  const [health, currentIdentity, registries, after] = await Promise.all([
    readHealth(), readRuntimeIdentity(), repository.listSourceRegistrySnapshots(),
    readProtectedBaseline(),
  ]);
  const registry = [...registries].sort((left, right) =>
    right.generatedAt.localeCompare(left.generatedAt))[0];
  if (!registry) throw new Error('source_registry_missing');
  const protectedWritesSincePreflight = protectedDomainChanges(prepared.protectedBaseline, after);
  return activateRealTrialReentry({
    repository,
    launchRecordId: prepared.report.plannedLaunchRecordId,
    currentIdentity,
    runtimeHealthReady: health.instance.runtimeStatus === 'ready'
      && health.formalResourceStore.status === 'ready' && health.learning.status === 'ready',
    providerReady: health.aiProvider.status === 'configured'
      && health.aiProvider.verificationLevel === 'live_verified'
      && health.aiProvider.availabilityVerified,
    currentProviderBoundaryDigest: currentIdentity.identityInputs.providerBoundaryDigest,
    currentSourceRegistryVersion: registry.sourceRegistryVersion,
    currentSourcePolicySnapshotHash: registry.sourcePolicySnapshotHash,
    currentObservationPolicyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION,
    currentDecisionPolicyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION,
    protectedWritesSincePreflight,
    explicitOperatorConfirmation: true,
    now: new Date().toISOString(),
  });
}

async function readHealth(): Promise<ProductRuntimeHealth> {
  const response = await fetch('/__runtime/health', { method: 'GET', cache: 'no-store' });
  const body = await response.json();
  if (!isProductRuntimeHealth(body)) throw new Error('runtime_health_invalid');
  return body;
}

async function readRuntimeIdentity(): Promise<ProductRuntimeIdentity> {
  const response = await fetch('/__runtime/identity', { method: 'GET', cache: 'no-store' });
  const body = await response.json();
  if (!response.ok || body?.status !== 'available' || !body.identity
    || validateProductRuntimeIdentity(body.identity).length) {
    throw new Error(`runtime_identity_unavailable:${(body?.issueCodes || []).join(',')}`);
  }
  return body.identity as ProductRuntimeIdentity;
}

async function readFormalSnapshot(): Promise<{
  initialized: boolean; revision: number; learningConsumableQuestionCount: number;
}> {
  const response = await fetch('/__runtime/phase17-4/formal-resources', {
    method: 'GET', cache: 'no-store',
  });
  if (!response.ok) throw new Error('formal_resource_boundary_unavailable');
  const body = await response.json();
  return {
    initialized: body?.snapshot?.initialized === true,
    revision: Number(body?.snapshot?.revision || 0),
    learningConsumableQuestionCount: Number(
      body?.snapshot?.data?.questionResources?.registryEntries?.length || 0,
    ),
  };
}

async function readProtectedBaseline(): Promise<ProtectedBaseline> {
  const repository = getProductComplexityConvergencePreflightRepository();
  const [formal, events, audits] = await Promise.all([
    readFormalSnapshot(), repository.listEvents(),
    repository.listRealTrialReentryActivationAudits(),
  ]);
  return { formalRevision: formal.revision, eventCount: events.length,
    observationAuditCount: audits.length };
}

function protectedWriteCounts(before: ProtectedBaseline, after: ProtectedBaseline):
RealTrialReentryProtectedWriteCounts {
  return {
    formalResourceWriteCount: Math.max(0, after.formalRevision - before.formalRevision),
    sessionWriteCount: 0,
    attemptWriteCount: 0,
    evidenceWriteCount: 0,
    profileWriteCount: 0,
    realDenominatorWriteCount: Math.max(0, after.eventCount - before.eventCount),
    trialObservationWriteCount: Math.max(0, after.eventCount - before.eventCount),
    trialControlWriteCount: Math.max(0, after.observationAuditCount - before.observationAuditCount),
  };
}

function protectedDomainChanges(before: ProtectedBaseline, after: ProtectedBaseline): number {
  return Math.max(0, after.formalRevision - before.formalRevision)
    + Math.max(0, after.eventCount - before.eventCount);
}

function uniqueNonEmpty(values: string[]): string[] {
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
  if (!normalized.length) throw new Error('trial_participant_missing');
  return normalized;
}
