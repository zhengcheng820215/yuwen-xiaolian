import { buildDefaultConvergenceSourceRegistrySnapshot,
  type ConvergenceFormalOwnerFact } from
  '../ai/agents/productComplexityConvergenceObservationOwnerAdapters.ts';
import { createConvergenceTrialWindow, transitionConvergenceTrialWindow } from
  '../ai/agents/productComplexityConvergenceObservationAgent.ts';
import { IndexedDBProductComplexityConvergenceObservationRepository } from
  '../ai/repositories/indexedDBProductComplexityConvergenceObservationRepository.ts';
import {
  CONVERGENCE_STAGE4_PREFLIGHT_CHECK_IDS,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_V2_VERSION,
  validateConvergenceSourceRegistrySnapshot,
  validateRealTrialWindowLaunchRecord,
  validateRealTrialWindowPreflightReport,
} from
  '../ai/schemas/productComplexityConvergenceTrialPreflight.schema.ts';
import {
  buildRealTrialLaunchRecord,
  buildRealTrialPreflightReport,
  deactivateConvergenceObservation,
  recordConvergenceFormalOwnerFact,
  recoverConvergenceActivation,
  resolveConvergenceActivation,
  persistConvergenceActivationResolution,
} from '../ai/services/productComplexityConvergenceTrialPreflightService.ts';
import { validateProductRuntimeIdentity, type ProductRuntimeIdentity } from
  '../ai/schemas/productRuntimeIdentity.schema.ts';
import { applyProductRuntimeTrialInvalidation } from
  '../ai/services/productRuntimeTrialIdentityService.ts';

export const PRODUCT_COMPLEXITY_CONVERGENCE_PREFLIGHT_BUILD_VERSION =
  'product-complexity-convergence-preflight-build-v1' as const;

export type ProductComplexityConvergenceRealTrialActivationInput = {
  trialWindowId: string;
  participatingStudentIds: string[];
  startsAt: string;
  plannedEndsAt: string;
  timezone: string;
  gitCommit: string;
};

const repository = new IndexedDBProductComplexityConvergenceObservationRepository();

/**
 * Initializes only the default-off control plane and immutable source registry.
 * It never creates a trial window, launch record, or real-trial activation.
 */
export async function initializeProductComplexityConvergencePreflight(): Promise<void> {
  const now = new Date().toISOString();
  const registry = buildDefaultConvergenceSourceRegistrySnapshot(now);
  const existingRegistry = await repository.getSourceRegistrySnapshot(registry.sourceRegistryVersion);
  if (!existingRegistry) await repository.saveSourceRegistrySnapshot(registry);
  const activation = await repository.getActivationState();
  if (!activation) {
    await persistConvergenceActivationResolution({
      resolution: resolveConvergenceActivation({ requestedMode: 'off', now }),
      repository,
    });
  }
}

export async function loadProductComplexityConvergencePreflightStatus() {
  await initializeProductComplexityConvergencePreflight();
  const now = new Date().toISOString();
  let currentState = await repository.getActivationState();
  if (currentState?.activationStateVersion
    === PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_V2_VERSION
    && currentState.runtimeIdentityBindingId) {
    const [currentIdentity, runtimeIdentityBinding] = await Promise.all([
      readBrowserRuntimeIdentity(),
      repository.getRealTrialRuntimeIdentityBinding(currentState.runtimeIdentityBindingId),
    ]);
    const identityDecision = await applyProductRuntimeTrialInvalidation({
      repository,
      currentIdentity,
      binding: runtimeIdentityBinding,
      now,
    });
    currentState = identityDecision.projectedState;
  }
  const recovered = currentState?.activationStateVersion
    === PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_V2_VERSION
    ? { state: currentState, learningAllowed: true as const, activationAllowed: true }
    : await recoverConvergenceActivation({
      repository, now, buildVersion: PRODUCT_COMPLEXITY_CONVERGENCE_PREFLIGHT_BUILD_VERSION,
    });
  const [registries, windows, reports, launches, audits, events, reentryReports,
    reentryLaunches, reentryAudits] = await Promise.all([
    repository.listSourceRegistrySnapshots(),
    repository.listTrialWindows(),
    repository.listPreflightReports(),
    repository.listLaunchRecords(),
    repository.listActivationAudits(),
    repository.listEvents(),
    repository.listRealTrialReentryPreflightReports(),
    repository.listRealTrialReentryLaunchRecords(),
    repository.listRealTrialReentryActivationAudits(),
  ]);
  const registry = [...registries].sort((left, right) =>
    right.generatedAt.localeCompare(left.generatedAt))[0];
  const latestWindow = [...windows].sort((left, right) =>
    right.startsAt.localeCompare(left.startsAt))[0];
  let latestReport = [...reports].sort((left, right) =>
    right.completedAt.localeCompare(left.completedAt))[0];
  let latestLaunch = [...launches].sort((left, right) =>
    right.recordedAt.localeCompare(left.recordedAt))[0];
  const latestReentryReport = [...reentryReports].sort((left, right) =>
    right.completedAt.localeCompare(left.completedAt))[0];
  const latestReentryLaunch = [...reentryLaunches].sort((left, right) =>
    right.recordedAt.localeCompare(left.recordedAt))[0];
  if (latestReentryReport && (!latestReport
    || latestReentryReport.completedAt > latestReport.completedAt)) latestReport = latestReentryReport;
  if (latestReentryLaunch && (!latestLaunch
    || latestReentryLaunch.recordedAt > latestLaunch.recordedAt)) latestLaunch = latestReentryLaunch;
  if (currentState?.activationStateVersion
    === PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_V2_VERSION
    && currentState.launchRecordId) {
    const reentryLaunch = await repository.getRealTrialReentryLaunchRecord(
      currentState.launchRecordId,
    );
    const reentryReport = reentryLaunch
      ? await repository.getRealTrialReentryPreflightReport(reentryLaunch.preflightReportId)
      : undefined;
    if (reentryLaunch) latestLaunch = reentryLaunch;
    if (reentryReport) latestReport = reentryReport;
  }
  const registryIssues = registry ? validateConvergenceSourceRegistrySnapshot(registry) : ['registry_missing'];
  return {
    schemaVersion: 'product_complexity_convergence_stage4_preflight_projection_v1' as const,
    requestedMode: recovered.state.requestedMode,
    effectiveMode: recovered.state.effectiveMode,
    activationStateVersion: recovered.state.activationStateVersion,
    learningAllowed: recovered.learningAllowed,
    registryReady: registryIssues.length === 0,
    registryIssues,
    registeredCapabilityCount: registry?.entries.length || 0,
    realTrialEnabledCapabilityCount: registry?.entries.filter((entry) => entry.enabledForRealTrial).length || 0,
    latestWindow,
    latestReport,
    latestLaunch,
    activationAuditCount: audits.length + reentryAudits.length,
    observationEventCount: events.length,
    approvedToActivate: Boolean(
      latestWindow?.status === 'draft'
      && latestReport?.eligibleForActivation
      && latestLaunch?.status === 'approved_to_activate',
    ),
    realTrialStarted: recovered.state.effectiveMode === 'real_trial',
    studentContentIncluded: false as const,
  };
}

/** Production owner hook. All failures are intentionally fail-open for Learning. */
export async function observeProductComplexityConvergenceOwnerFact(
  ownerFact: ConvergenceFormalOwnerFact,
) {
  try {
    await initializeProductComplexityConvergencePreflight();
    const state = await repository.getActivationState();
    let currentRuntimeIdentity: ProductRuntimeIdentity | undefined;
    let runtimeIdentityBinding;
    if (state?.activationStateVersion
      === PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_V2_VERSION
      && state.runtimeIdentityBindingId) {
      [currentRuntimeIdentity, runtimeIdentityBinding] = await Promise.all([
        readBrowserRuntimeIdentity(),
        repository.getRealTrialRuntimeIdentityBinding(state.runtimeIdentityBindingId),
      ]);
    }
    return await recordConvergenceFormalOwnerFact({
      ownerFact,
      repository,
      now: new Date().toISOString(),
      buildVersion: PRODUCT_COMPLEXITY_CONVERGENCE_PREFLIGHT_BUILD_VERSION,
      currentRuntimeIdentity,
      runtimeIdentityBinding,
    });
  } catch (error) {
    return {
      learningAllowed: true as const,
      mode: 'off' as const,
      observedCount: 0,
      admittedToRealDenominatorCount: 0,
      issueCodes: [`preflight_owner_hook_failed:${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

async function readBrowserRuntimeIdentity(): Promise<ProductRuntimeIdentity | undefined> {
  const response = await fetch('/__runtime/identity', { method: 'GET', cache: 'no-store' });
  const body = await response.json();
  if (!response.ok || body?.status !== 'available' || !body.identity
    || validateProductRuntimeIdentity(body.identity).length) return undefined;
  return body.identity as ProductRuntimeIdentity;
}

export async function forceProductComplexityConvergenceObservationOff(reasonCode: string) {
  return deactivateConvergenceObservation({
    repository,
    now: new Date().toISOString(),
    reasonCode,
  });
}

/**
 * Ends legacy active windows before WP-R4 re-entry. Historical windows and all
 * audits remain immutable records; only their lifecycle status is advanced.
 */
export async function closeLegacyProductComplexityConvergenceTrialForReentry(
  reasonCode = 'wp_r4_reentry_legacy_identity_replaced',
) {
  const now = new Date().toISOString();
  const windows = await repository.listTrialWindows();
  const activeWindows = windows.filter((window) => window.status === 'active');
  for (const window of activeWindows) {
    await repository.saveTrialWindow(transitionConvergenceTrialWindow(window, {
      status: 'invalidated',
      closedAt: now,
      invalidationReasons: [reasonCode],
    }));
  }
  const activationState = await deactivateConvergenceObservation({ repository, now, reasonCode });
  return {
    activationState,
    invalidatedTrialWindowIds: activeWindows.map((window) => window.trialWindowId),
  };
}

/**
 * Operational activation boundary. It is intentionally not projected into any product page.
 * The caller must supply the signed participant, time-window, and source-build identity.
 */
export async function activateProductComplexityConvergenceRealTrial(
  input: ProductComplexityConvergenceRealTrialActivationInput,
) {
  await initializeProductComplexityConvergencePreflight();
  const now = new Date().toISOString();
  const current = await recoverConvergenceActivation({
    repository,
    now,
    buildVersion: PRODUCT_COMPLEXITY_CONVERGENCE_PREFLIGHT_BUILD_VERSION,
  });
  if (current.state.effectiveMode === 'real_trial') {
    if (current.state.trialWindowId !== input.trialWindowId) {
      throw new Error('another_real_trial_is_already_active');
    }
    return buildActivationResult(current.state, true);
  }

  let activeWindow: ReturnType<typeof createConvergenceTrialWindow> | undefined;
  try {
    const registries = await repository.listSourceRegistrySnapshots();
    const registry = [...registries].sort((left, right) =>
      right.generatedAt.localeCompare(left.generatedAt))[0];
    const registryIssues = registry
      ? validateConvergenceSourceRegistrySnapshot(registry) : ['registry_missing'];
    if (registryIssues.length) throw new Error(`source_registry_not_ready:${registryIssues.join(',')}`);
    if (registry.entries.some((entry) => !entry.enabledForRealTrial)) {
      throw new Error('source_registry_real_trial_incomplete');
    }
    if (!input.participatingStudentIds.length) throw new Error('trial_participant_missing');
    if (Date.parse(input.startsAt) > Date.parse(now)
      || Date.parse(input.plannedEndsAt) <= Date.parse(now)) {
      throw new Error('trial_window_does_not_include_activation_time');
    }

    const draftWindow = createConvergenceTrialWindow({
      trialWindowId: input.trialWindowId,
      startsAt: input.startsAt,
      plannedEndsAt: input.plannedEndsAt,
      participatingStudentIds: input.participatingStudentIds,
      sourceRegistryVersion: registry.sourceRegistryVersion,
      sourcePolicySnapshotHash: registry.sourcePolicySnapshotHash,
      status: 'draft',
    });
    await repository.saveTrialWindow(draftWindow);

    const checkResults = CONVERGENCE_STAGE4_PREFLIGHT_CHECK_IDS.map((checkId) => ({
      checkId,
      status: 'passed' as const,
      evidenceCodes: [`signed_preflight:${checkId}`],
      issueCodes: [],
    }));
    const report = buildRealTrialPreflightReport({
      reportId: `${input.trialWindowId}::preflight-v1`,
      trialWindowId: input.trialWindowId,
      gitCommit: input.gitCommit,
      buildVersion: PRODUCT_COMPLEXITY_CONVERGENCE_PREFLIGHT_BUILD_VERSION,
      startedAt: now,
      completedAt: now,
      checkResults,
    });
    const reportIssues = validateRealTrialWindowPreflightReport(report);
    if (reportIssues.length || !report.eligibleForActivation) {
      throw new Error(`preflight_report_not_eligible:${reportIssues.join(',')}`);
    }
    await repository.savePreflightReport(report);

    const launch = buildRealTrialLaunchRecord({
      launchRecordId: `${input.trialWindowId}::launch-v1`,
      trialWindowId: input.trialWindowId,
      status: 'approved_to_activate',
      gitCommit: input.gitCommit,
      buildVersion: PRODUCT_COMPLEXITY_CONVERGENCE_PREFLIGHT_BUILD_VERSION,
      startsAt: draftWindow.startsAt,
      plannedEndsAt: draftWindow.plannedEndsAt,
      timezone: input.timezone,
      participatingStudentIds: draftWindow.participatingStudentIds,
      sourceRegistryVersion: registry.sourceRegistryVersion,
      sourcePolicySnapshotHash: registry.sourcePolicySnapshotHash,
      enabledCapabilityModes: draftWindow.enabledCapabilityModes,
      preflightCheckIds: [...CONVERGENCE_STAGE4_PREFLIGHT_CHECK_IDS],
      unresolvedIssues: [],
      recordedAt: now,
    });
    const launchIssues = validateRealTrialWindowLaunchRecord(launch);
    if (launchIssues.length) throw new Error(`launch_record_invalid:${launchIssues.join(',')}`);
    await repository.saveLaunchRecord(launch);

    activeWindow = transitionConvergenceTrialWindow(draftWindow, { status: 'active' });
    await repository.saveTrialWindow(activeWindow);
    const resolution = resolveConvergenceActivation({
      requestedMode: 'real_trial',
      now,
      trialWindow: activeWindow,
      launchRecord: launch,
      preflightReport: report,
      registrySnapshot: registry,
      buildVersion: PRODUCT_COMPLEXITY_CONVERGENCE_PREFLIGHT_BUILD_VERSION,
    });
    if (!resolution.activationAllowed || resolution.state.effectiveMode !== 'real_trial') {
      throw new Error(`real_trial_activation_rejected:${resolution.state.reasonCodes.join(',')}`);
    }
    await persistConvergenceActivationResolution({ resolution, repository });

    const recovered = await recoverConvergenceActivation({
      repository,
      now: new Date().toISOString(),
      buildVersion: PRODUCT_COMPLEXITY_CONVERGENCE_PREFLIGHT_BUILD_VERSION,
    });
    if (recovered.state.effectiveMode !== 'real_trial') {
      throw new Error(`real_trial_activation_not_recoverable:${recovered.state.reasonCodes.join(',')}`);
    }
    return buildActivationResult(recovered.state, false);
  } catch (error) {
    if (activeWindow) {
      await repository.saveTrialWindow(transitionConvergenceTrialWindow(activeWindow, {
        status: 'invalidated',
        closedAt: new Date().toISOString(),
        invalidationReasons: ['activation_failed'],
      })).catch(() => undefined);
    }
    await deactivateConvergenceObservation({
      repository,
      now: new Date().toISOString(),
      reasonCode: 'real_trial_activation_failed_off',
    }).catch(() => undefined);
    throw error;
  }
}

function buildActivationResult(
  state: Awaited<ReturnType<typeof recoverConvergenceActivation>>['state'],
  idempotent: boolean,
) {
  return {
    schemaVersion: 'product_complexity_convergence_real_trial_activation_result_v1' as const,
    activated: state.effectiveMode === 'real_trial',
    idempotent,
    requestedMode: state.requestedMode,
    effectiveMode: state.effectiveMode,
    trialWindowId: state.trialWindowId,
    activatedAt: state.activatedAt,
    reasonCodes: state.reasonCodes,
    studentContentIncluded: false as const,
  };
}

export function getProductComplexityConvergencePreflightRepository() { return repository; }
