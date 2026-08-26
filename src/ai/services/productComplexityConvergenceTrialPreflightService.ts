import { adaptConvergenceFormalOwnerFact,
  type ConvergenceFormalOwnerFact } from
  '../agents/productComplexityConvergenceObservationOwnerAdapters.ts';
import type { ProductComplexityConvergenceObservationRepository } from
  '../repositories/productComplexityConvergenceObservationRepository.ts';
import {
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION,
  type ComplexityConvergenceStage4ObservationMode,
  type ComplexityConvergenceTrialWindow,
} from '../schemas/productComplexityConvergenceObservation.schema.ts';
import {
  CONVERGENCE_STAGE4_PREFLIGHT_CHECK_IDS,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_LAUNCH_RECORD_VERSION,
  PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PREFLIGHT_REPORT_VERSION,
  buildConvergenceActivationAudit,
  createDefaultConvergenceActivationState,
  launchRecordMatchesWindow,
  validateConvergenceActivationState,
  validateConvergenceSourceRegistrySnapshot,
  validateRealTrialWindowLaunchRecord,
  validateRealTrialWindowPreflightReport,
  type ConvergenceObservationActivationState,
  type ConvergenceObservationSourceRegistrySnapshot,
  type RealTrialWindowLaunchRecord,
  type RealTrialWindowPreflightCheckResult,
  type RealTrialWindowPreflightReport,
} from '../schemas/productComplexityConvergenceTrialPreflight.schema.ts';
import { recordConvergenceObservation } from './productComplexityConvergenceObservationService.ts';
import type { ProductRuntimeIdentity, RealTrialRuntimeIdentityBinding } from
  '../schemas/productRuntimeIdentity.schema.ts';
import { applyProductRuntimeTrialInvalidation } from './productRuntimeTrialIdentityService.ts';

export type ConvergenceActivationResolution = {
  state: ConvergenceObservationActivationState;
  learningAllowed: true;
  activationAllowed: boolean;
};

export type ConvergenceFormalOwnerObservationResult = {
  learningAllowed: true;
  mode: ComplexityConvergenceStage4ObservationMode;
  observedCount: number;
  admittedToRealDenominatorCount: number;
  issueCodes: string[];
};

export function resolveConvergenceActivation(input: {
  requestedMode: ComplexityConvergenceStage4ObservationMode;
  now: string;
  trialWindow?: ComplexityConvergenceTrialWindow;
  launchRecord?: RealTrialWindowLaunchRecord;
  preflightReport?: RealTrialWindowPreflightReport;
  registrySnapshot?: ConvergenceObservationSourceRegistrySnapshot;
  buildVersion?: string;
}): ConvergenceActivationResolution {
  const reasons: string[] = [];
  if (input.requestedMode === 'off') return {
    state: createDefaultConvergenceActivationState(input.now),
    learningAllowed: true,
    activationAllowed: false,
  };
  const registryIssues = input.registrySnapshot
    ? validateConvergenceSourceRegistrySnapshot(input.registrySnapshot) : ['registry_missing'];
  if (registryIssues.length) reasons.push(...registryIssues);

  if (input.requestedMode === 'isolated_acceptance') {
    const allIsolated = input.registrySnapshot?.entries.every((entry) => entry.enabledForIsolatedAcceptance);
    if (!allIsolated) reasons.push('isolated_registry_incomplete');
    const effectiveMode = reasons.length ? 'off' : 'isolated_acceptance';
    return {
      state: {
        activationStateVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_VERSION,
        activationStateId: 'product-complexity-convergence-stage4-current',
        requestedMode: input.requestedMode,
        effectiveMode,
        registrySnapshotHash: input.registrySnapshot?.sourcePolicySnapshotHash,
        reasonCodes: reasons.length ? unique(reasons) : ['isolated_acceptance_ready'],
        updatedAt: input.now,
      },
      learningAllowed: true,
      activationAllowed: effectiveMode === 'isolated_acceptance',
    };
  }

  if (!input.trialWindow) reasons.push('trial_window_missing');
  else if (input.trialWindow.status !== 'active') reasons.push('trial_window_not_active');
  if (!input.launchRecord) reasons.push('launch_record_missing');
  else reasons.push(...validateRealTrialWindowLaunchRecord(input.launchRecord));
  if (!input.preflightReport) reasons.push('preflight_report_missing');
  else {
    reasons.push(...validateRealTrialWindowPreflightReport(input.preflightReport));
    if (!input.preflightReport.eligibleForActivation) reasons.push('preflight_not_eligible');
  }
  if (input.trialWindow && input.launchRecord
    && !launchRecordMatchesWindow(input.launchRecord, input.trialWindow)) reasons.push('launch_window_mismatch');
  if (input.launchRecord && input.preflightReport
    && input.launchRecord.trialWindowId !== input.preflightReport.trialWindowId) reasons.push('launch_preflight_mismatch');
  if (!input.buildVersion || input.launchRecord?.buildVersion !== input.buildVersion) reasons.push('build_version_mismatch');
  if (input.registrySnapshot && input.trialWindow
    && (input.registrySnapshot.sourceRegistryVersion !== input.trialWindow.sourceRegistryVersion
      || input.registrySnapshot.sourcePolicySnapshotHash !== input.trialWindow.sourcePolicySnapshotHash)) reasons.push('registry_window_mismatch');
  if (input.registrySnapshot?.entries.some((entry) => !entry.enabledForRealTrial)) reasons.push('real_trial_registry_incomplete');
  if (input.trialWindow) {
    const now = Date.parse(input.now);
    if (Number.isNaN(now) || now < Date.parse(input.trialWindow.startsAt)
      || now > Date.parse(input.trialWindow.plannedEndsAt)) reasons.push('outside_trial_window');
  }
  const effectiveMode = reasons.length ? 'off' : 'real_trial';
  const state: ConvergenceObservationActivationState = {
    activationStateVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_ACTIVATION_STATE_VERSION,
    activationStateId: 'product-complexity-convergence-stage4-current',
    requestedMode: input.requestedMode,
    effectiveMode,
    trialWindowId: input.trialWindow?.trialWindowId,
    launchRecordId: input.launchRecord?.launchRecordId,
    registrySnapshotHash: input.registrySnapshot?.sourcePolicySnapshotHash,
    policySnapshotHash: input.trialWindow?.sourcePolicySnapshotHash,
    buildVersion: input.buildVersion,
    activatedAt: effectiveMode === 'real_trial' ? input.now : undefined,
    reasonCodes: reasons.length ? unique(reasons) : ['real_trial_activation_approved'],
    updatedAt: input.now,
  };
  return { state, learningAllowed: true, activationAllowed: effectiveMode === 'real_trial' };
}

export async function persistConvergenceActivationResolution(input: {
  resolution: ConvergenceActivationResolution;
  repository: ProductComplexityConvergenceObservationRepository;
}): Promise<void> {
  const stateIssues = validateConvergenceActivationState(input.resolution.state);
  if (stateIssues.length) throw new Error(`activation_state_invalid:${stateIssues.join(',')}`);
  await input.repository.saveActivationState(input.resolution.state);
  const action = input.resolution.state.effectiveMode === 'real_trial' ? 'activated'
    : input.resolution.state.effectiveMode === 'isolated_acceptance' ? 'approved'
      : input.resolution.state.requestedMode === 'off' ? 'deactivated' : 'rejected';
  await input.repository.appendActivationAudit(buildConvergenceActivationAudit({
    action,
    requestedMode: input.resolution.state.requestedMode,
    effectiveMode: input.resolution.state.effectiveMode,
    trialWindowId: input.resolution.state.trialWindowId,
    launchRecordId: input.resolution.state.launchRecordId,
    reasonCodes: input.resolution.state.reasonCodes,
    occurredAt: input.resolution.state.updatedAt,
  }));
}

export async function recoverConvergenceActivation(input: {
  repository: ProductComplexityConvergenceObservationRepository;
  now: string;
  buildVersion: string;
}): Promise<ConvergenceActivationResolution> {
  try {
    const current = await input.repository.getActivationState();
    if (!current || current.requestedMode === 'off') return {
      state: createDefaultConvergenceActivationState(input.now), learningAllowed: true, activationAllowed: false,
    };
    const trialWindow = current.trialWindowId
      ? await input.repository.getTrialWindow(current.trialWindowId) : undefined;
    const launchRecord = current.launchRecordId
      ? await input.repository.getLaunchRecord(current.launchRecordId) : undefined;
    const registrySnapshot = trialWindow
      ? await input.repository.getSourceRegistrySnapshot(trialWindow.sourceRegistryVersion) : undefined;
    const reports = trialWindow
      ? await input.repository.listPreflightReports(trialWindow.trialWindowId) : [];
    return resolveConvergenceActivation({
      requestedMode: current.requestedMode,
      now: input.now,
      trialWindow,
      launchRecord,
      preflightReport: reports.at(-1),
      registrySnapshot,
      buildVersion: input.buildVersion,
    });
  } catch {
    return {
      state: { ...createDefaultConvergenceActivationState(input.now), reasonCodes: ['activation_recovery_failed_off'] },
      learningAllowed: true,
      activationAllowed: false,
    };
  }
}

export async function deactivateConvergenceObservation(input: {
  repository: ProductComplexityConvergenceObservationRepository;
  now: string;
  reasonCode?: string;
}): Promise<ConvergenceObservationActivationState> {
  const state = {
    ...createDefaultConvergenceActivationState(input.now),
    deactivatedAt: input.now,
    reasonCodes: [input.reasonCode || 'explicitly_deactivated'],
  };
  await input.repository.saveActivationState(state);
  await input.repository.appendActivationAudit(buildConvergenceActivationAudit({
    action: 'deactivated', requestedMode: 'off', effectiveMode: 'off',
    reasonCodes: state.reasonCodes, occurredAt: input.now,
  }));
  return state;
}

export async function recordConvergenceFormalOwnerFact(input: {
  ownerFact: ConvergenceFormalOwnerFact;
  repository: ProductComplexityConvergenceObservationRepository;
  now: string;
  buildVersion: string;
  currentRuntimeIdentity?: ProductRuntimeIdentity;
  runtimeIdentityBinding?: RealTrialRuntimeIdentityBinding;
}): Promise<ConvergenceFormalOwnerObservationResult> {
  try {
    const activation = await recoverConvergenceActivation({
      repository: input.repository, now: input.now, buildVersion: input.buildVersion,
    });
    if (activation.state.effectiveMode === 'off') return {
      learningAllowed: true, mode: 'off', observedCount: 0,
      admittedToRealDenominatorCount: 0, issueCodes: activation.state.reasonCodes,
    };
    const identity = await applyProductRuntimeTrialInvalidation({
      repository: input.repository,
      currentIdentity: input.currentRuntimeIdentity,
      binding: input.runtimeIdentityBinding,
      now: input.now,
    });
    if (!identity.observationAllowed) return {
      learningAllowed: true, mode: 'off', observedCount: 0,
      admittedToRealDenominatorCount: 0, issueCodes: identity.reasonCodes,
    };
    const window = activation.state.trialWindowId
      ? await input.repository.getTrialWindow(activation.state.trialWindowId) : undefined;
    const registry = window
      ? await input.repository.getSourceRegistrySnapshot(window.sourceRegistryVersion) : undefined;
    if (!window || !registry) return safeResult(activation.state.effectiveMode, 'observation_context_missing');
    const adapted = adaptConvergenceFormalOwnerFact(input.ownerFact, registry);
    if (!adapted.accepted) return {
      ...safeResult(activation.state.effectiveMode, 'owner_fact_rejected'),
      issueCodes: adapted.issueCodes,
    };
    let observedCount = 0;
    let admittedToRealDenominatorCount = 0;
    const issueCodes: string[] = [];
    for (const source of adapted.sourceFacts) {
      const result = await recordConvergenceObservation({
        mode: activation.state.effectiveMode, source, trialWindow: window, repository: input.repository,
      });
      if (result.observed) observedCount += 1;
      if (result.admittedToRealDenominator) admittedToRealDenominatorCount += 1;
      if (result.runtimeIssue) issueCodes.push(result.runtimeIssue);
    }
    return {
      learningAllowed: true,
      mode: activation.state.effectiveMode,
      observedCount,
      admittedToRealDenominatorCount,
      issueCodes,
    };
  } catch (error) {
    return safeResult('off', `formal_owner_observation_failed:${error instanceof Error ? error.message : String(error)}`);
  }
}

export function buildRealTrialPreflightReport(input: {
  reportId: string;
  trialWindowId: string;
  gitCommit: string;
  buildVersion: string;
  startedAt: string;
  completedAt: string;
  checkResults: RealTrialWindowPreflightCheckResult[];
  writeCounts?: Partial<Pick<RealTrialWindowPreflightReport,
    'formalResourceWriteCount' | 'attemptWriteCount' | 'evidenceWriteCount'
    | 'profileWriteCount' | 'realDenominatorWriteCount'>>;
}): RealTrialWindowPreflightReport {
  const counts = {
    formalResourceWriteCount: input.writeCounts?.formalResourceWriteCount || 0,
    attemptWriteCount: input.writeCounts?.attemptWriteCount || 0,
    evidenceWriteCount: input.writeCounts?.evidenceWriteCount || 0,
    profileWriteCount: input.writeCounts?.profileWriteCount || 0,
    realDenominatorWriteCount: input.writeCounts?.realDenominatorWriteCount || 0,
  };
  const allPassed = CONVERGENCE_STAGE4_PREFLIGHT_CHECK_IDS.every((id) =>
    input.checkResults.find((result) => result.checkId === id)?.status === 'passed');
  return {
    reportVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_PREFLIGHT_REPORT_VERSION,
    reportId: input.reportId,
    trialWindowId: input.trialWindowId,
    gitCommit: input.gitCommit,
    buildVersion: input.buildVersion,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    checkResults: input.checkResults,
    ...counts,
    eligibleForActivation: allPassed && Object.values(counts).every((count) => count === 0),
  };
}

export function buildRealTrialLaunchRecord(input: Omit<RealTrialWindowLaunchRecord,
  'launchRecordVersion' | 'observationPolicyVersion' | 'decisionPolicyVersion'>): RealTrialWindowLaunchRecord {
  return {
    ...input,
    launchRecordVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_LAUNCH_RECORD_VERSION,
    observationPolicyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_OBSERVATION_POLICY_VERSION,
    decisionPolicyVersion: PRODUCT_COMPLEXITY_CONVERGENCE_STAGE4_DECISION_POLICY_VERSION,
  };
}

function safeResult(
  mode: ComplexityConvergenceStage4ObservationMode,
  issueCode: string,
): ConvergenceFormalOwnerObservationResult {
  return { learningAllowed: true, mode, observedCount: 0, admittedToRealDenominatorCount: 0, issueCodes: [issueCode] };
}
function unique(values: string[]): string[] { return [...new Set(values)]; }
