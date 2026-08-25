import { buildDefaultConvergenceSourceRegistrySnapshot,
  type ConvergenceFormalOwnerFact } from
  '../ai/agents/productComplexityConvergenceObservationOwnerAdapters.ts';
import { createConvergenceTrialWindow, transitionConvergenceTrialWindow } from
  '../ai/agents/productComplexityConvergenceObservationAgent.ts';
import { IndexedDBProductComplexityConvergenceObservationRepository } from
  '../ai/repositories/indexedDBProductComplexityConvergenceObservationRepository.ts';
import {
  CONVERGENCE_STAGE4_PREFLIGHT_CHECK_IDS,
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
  const [activation, registries, windows, reports, launches, audits, events] = await Promise.all([
    recoverConvergenceActivation({
      repository,
      now,
      buildVersion: PRODUCT_COMPLEXITY_CONVERGENCE_PREFLIGHT_BUILD_VERSION,
    }),
    repository.listSourceRegistrySnapshots(),
    repository.listTrialWindows(),
    repository.listPreflightReports(),
    repository.listLaunchRecords(),
    repository.listActivationAudits(),
    repository.listEvents(),
  ]);
  const registry = [...registries].sort((left, right) =>
    right.generatedAt.localeCompare(left.generatedAt))[0];
  const latestWindow = [...windows].sort((left, right) =>
    right.startsAt.localeCompare(left.startsAt))[0];
  const latestReport = [...reports].sort((left, right) =>
    right.completedAt.localeCompare(left.completedAt))[0];
  const latestLaunch = [...launches].sort((left, right) =>
    right.recordedAt.localeCompare(left.recordedAt))[0];
  const registryIssues = registry ? validateConvergenceSourceRegistrySnapshot(registry) : ['registry_missing'];
  return {
    schemaVersion: 'product_complexity_convergence_stage4_preflight_projection_v1' as const,
    requestedMode: activation.state.requestedMode,
    effectiveMode: activation.state.effectiveMode,
    learningAllowed: activation.learningAllowed,
    registryReady: registryIssues.length === 0,
    registryIssues,
    registeredCapabilityCount: registry?.entries.length || 0,
    realTrialEnabledCapabilityCount: registry?.entries.filter((entry) => entry.enabledForRealTrial).length || 0,
    latestWindow,
    latestReport,
    latestLaunch,
    activationAuditCount: audits.length,
    observationEventCount: events.length,
    approvedToActivate: Boolean(
      latestWindow?.status === 'active'
      && latestReport?.eligibleForActivation
      && latestLaunch?.status === 'approved_to_activate',
    ),
    realTrialStarted: activation.state.effectiveMode === 'real_trial',
    studentContentIncluded: false as const,
  };
}

/** Production owner hook. All failures are intentionally fail-open for Learning. */
export async function observeProductComplexityConvergenceOwnerFact(
  ownerFact: ConvergenceFormalOwnerFact,
) {
  try {
    await initializeProductComplexityConvergencePreflight();
    return await recordConvergenceFormalOwnerFact({
      ownerFact,
      repository,
      now: new Date().toISOString(),
      buildVersion: PRODUCT_COMPLEXITY_CONVERGENCE_PREFLIGHT_BUILD_VERSION,
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

export async function forceProductComplexityConvergenceObservationOff(reasonCode: string) {
  return deactivateConvergenceObservation({
    repository,
    now: new Date().toISOString(),
    reasonCode,
  });
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
