import { IndexedDBProductComplexityConvergenceObservationRepository } from
  '../ai/repositories/indexedDBProductComplexityConvergenceObservationRepository.ts';
import { recoverConvergenceActivation } from
  '../ai/services/productComplexityConvergenceTrialPreflightService.ts';
import { PRODUCT_COMPLEXITY_CONVERGENCE_PREFLIGHT_BUILD_VERSION } from
  './productComplexityConvergenceStage4Preflight.ts';

export async function loadProductComplexityConvergenceStage4Observation() {
  const repository = new IndexedDBProductComplexityConvergenceObservationRepository();
  const [windows, snapshots, proposals, events, activation] = await Promise.all([
    repository.listTrialWindows(), repository.listSnapshots(), repository.listProposals(), repository.listEvents(),
    recoverConvergenceActivation({
      repository,
      now: new Date().toISOString(),
      buildVersion: PRODUCT_COMPLEXITY_CONVERGENCE_PREFLIGHT_BUILD_VERSION,
    }),
  ]);
  const latestWindow = [...windows].sort((left, right) => right.startsAt.localeCompare(left.startsAt))[0];
  const latestSnapshot = latestWindow
    ? [...snapshots].filter((item) => item.trialWindowId === latestWindow.trialWindowId)
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0]
    : undefined;
  return {
    schemaVersion: 'product_complexity_convergence_stage4_internal_projection_v1' as const,
    mode: activation.state.effectiveMode,
    requestedMode: activation.state.requestedMode,
    activationReasonCodes: activation.state.reasonCodes,
    latestWindow,
    latestSnapshot,
    proposals: latestWindow
      ? proposals.filter((item) => item.trialWindowId === latestWindow.trialWindowId)
      : [],
    eventCount: latestWindow
      ? events.filter((item) => item.trialWindowId === latestWindow.trialWindowId).length
      : 0,
    studentContentIncluded: false as const,
  };
}
