import type { ProductComplexityConvergenceObservationRepository } from
  './productComplexityConvergenceObservationRepository.ts';
import type {
  ComplexityConvergenceAggregateSnapshot,
  ComplexityConvergenceDecisionProposal,
  ComplexityConvergenceObservationEvent,
  ComplexityConvergenceTrialWindow,
} from '../schemas/productComplexityConvergenceObservation.schema.ts';
import type {
  ConvergenceObservationActivationAudit,
  ConvergenceObservationActivationState,
  ConvergenceObservationSourceRegistrySnapshot,
  RealTrialWindowLaunchRecord,
  RealTrialWindowPreflightReport,
} from '../schemas/productComplexityConvergenceTrialPreflight.schema.ts';
import {
  validateRealTrialReentryApprovalBundle,
  validateRealTrialReentryAtomicActivation,
  type ConvergenceObservationActivationAuditV3,
  type RealTrialReentryApprovalBundle,
  type RealTrialReentryApprovalBundleCommitResult,
  type RealTrialReentryAtomicActivation,
  type RealTrialReentryPreflightReportV2,
  type RealTrialWindowLaunchRecordV2,
} from '../schemas/productRuntimeTrialReentry.schema.ts';
import type { RealTrialRuntimeIdentityBinding } from '../schemas/productRuntimeIdentity.schema.ts';

const STATUS_RANK: Record<ComplexityConvergenceDecisionProposal['status'], number> = {
  proposed: 0, accepted: 1, rejected: 1, superseded: 2,
};

export class InMemoryProductComplexityConvergenceObservationRepository
implements ProductComplexityConvergenceObservationRepository {
  private readonly windows = new Map<string, ComplexityConvergenceTrialWindow>();
  private readonly events = new Map<string, ComplexityConvergenceObservationEvent>();
  private readonly snapshots = new Map<string, ComplexityConvergenceAggregateSnapshot>();
  private readonly proposals = new Map<string, ComplexityConvergenceDecisionProposal>();
  private readonly registries = new Map<string, ConvergenceObservationSourceRegistrySnapshot>();
  private readonly preflightReports = new Map<string, RealTrialWindowPreflightReport>();
  private readonly launchRecords = new Map<string, RealTrialWindowLaunchRecord>();
  private activationState?: ConvergenceObservationActivationState;
  private readonly activationAudits = new Map<string, ConvergenceObservationActivationAudit>();
  private readonly reentryPreflightReports = new Map<string, RealTrialReentryPreflightReportV2>();
  private readonly reentryLaunchRecords = new Map<string, RealTrialWindowLaunchRecordV2>();
  private readonly runtimeIdentityBindings = new Map<string, RealTrialRuntimeIdentityBinding>();
  private readonly reentryActivationAudits = new Map<string, ConvergenceObservationActivationAuditV3>();

  async saveTrialWindow(window: ComplexityConvergenceTrialWindow): Promise<void> {
    const existing = this.windows.get(window.trialWindowId);
    if (existing && !sameWindowIdentity(existing, window)) throw new Error('trial_window_identity_conflict');
    if (existing && !validWindowTransition(existing.status, window.status)) throw new Error('trial_window_status_regression');
    this.windows.set(window.trialWindowId, clone(window));
  }

  async getTrialWindow(trialWindowId: string): Promise<ComplexityConvergenceTrialWindow | undefined> {
    return cloneOptional(this.windows.get(trialWindowId));
  }

  async listTrialWindows(): Promise<ComplexityConvergenceTrialWindow[]> {
    return [...this.windows.values()].map(clone);
  }

  async appendEvent(event: ComplexityConvergenceObservationEvent): Promise<'inserted' | 'duplicate'> {
    const existing = this.events.get(event.eventId);
    if (existing) {
      if (existing.eventHash !== event.eventHash) throw new Error('observation_event_identity_conflict');
      return 'duplicate';
    }
    this.events.set(event.eventId, clone(event));
    return 'inserted';
  }

  async getEvent(eventId: string): Promise<ComplexityConvergenceObservationEvent | undefined> {
    return cloneOptional(this.events.get(eventId));
  }

  async listEvents(trialWindowId?: string): Promise<ComplexityConvergenceObservationEvent[]> {
    return [...this.events.values()]
      .filter((item) => !trialWindowId || item.trialWindowId === trialWindowId)
      .map(clone);
  }

  async saveSnapshot(snapshot: ComplexityConvergenceAggregateSnapshot): Promise<void> {
    const existing = this.snapshots.get(snapshot.snapshotId);
    if (existing && existing.snapshotHash !== snapshot.snapshotHash) throw new Error('aggregate_snapshot_identity_conflict');
    if (!existing) this.snapshots.set(snapshot.snapshotId, clone(snapshot));
  }

  async getSnapshot(snapshotId: string): Promise<ComplexityConvergenceAggregateSnapshot | undefined> {
    return cloneOptional(this.snapshots.get(snapshotId));
  }

  async listSnapshots(trialWindowId?: string): Promise<ComplexityConvergenceAggregateSnapshot[]> {
    return [...this.snapshots.values()]
      .filter((item) => !trialWindowId || item.trialWindowId === trialWindowId)
      .map(clone);
  }

  async saveProposal(proposal: ComplexityConvergenceDecisionProposal): Promise<void> {
    const existing = this.proposals.get(proposal.proposalId);
    if (existing && STATUS_RANK[proposal.status] < STATUS_RANK[existing.status]) return;
    if (existing && STATUS_RANK[proposal.status] === STATUS_RANK[existing.status]
      && existing.status !== proposal.status) throw new Error('proposal_terminal_status_conflict');
    this.proposals.set(proposal.proposalId, clone(proposal));
  }

  async getProposal(proposalId: string): Promise<ComplexityConvergenceDecisionProposal | undefined> {
    return cloneOptional(this.proposals.get(proposalId));
  }

  async listProposals(trialWindowId?: string): Promise<ComplexityConvergenceDecisionProposal[]> {
    return [...this.proposals.values()]
      .filter((item) => !trialWindowId || item.trialWindowId === trialWindowId)
      .map(clone);
  }

  async saveSourceRegistrySnapshot(snapshot: ConvergenceObservationSourceRegistrySnapshot): Promise<void> {
    saveImmutable(this.registries, snapshot.sourceRegistryVersion, snapshot, 'source_registry_identity_conflict');
  }
  async getSourceRegistrySnapshot(sourceRegistryVersion: string): Promise<ConvergenceObservationSourceRegistrySnapshot | undefined> {
    return cloneOptional(this.registries.get(sourceRegistryVersion));
  }
  async listSourceRegistrySnapshots(): Promise<ConvergenceObservationSourceRegistrySnapshot[]> {
    return [...this.registries.values()].map(clone);
  }
  async savePreflightReport(report: RealTrialWindowPreflightReport): Promise<void> {
    saveImmutable(this.preflightReports, report.reportId, report, 'preflight_report_identity_conflict');
  }
  async getPreflightReport(reportId: string): Promise<RealTrialWindowPreflightReport | undefined> {
    return cloneOptional(this.preflightReports.get(reportId));
  }
  async listPreflightReports(trialWindowId?: string): Promise<RealTrialWindowPreflightReport[]> {
    return [...this.preflightReports.values()].filter((item) => !trialWindowId || item.trialWindowId === trialWindowId).map(clone);
  }
  async saveLaunchRecord(record: RealTrialWindowLaunchRecord): Promise<void> {
    saveImmutable(this.launchRecords, record.launchRecordId, record, 'launch_record_identity_conflict');
  }
  async getLaunchRecord(launchRecordId: string): Promise<RealTrialWindowLaunchRecord | undefined> {
    return cloneOptional(this.launchRecords.get(launchRecordId));
  }
  async listLaunchRecords(trialWindowId?: string): Promise<RealTrialWindowLaunchRecord[]> {
    return [...this.launchRecords.values()].filter((item) => !trialWindowId || item.trialWindowId === trialWindowId).map(clone);
  }
  async saveActivationState(state: ConvergenceObservationActivationState): Promise<void> {
    this.activationState = clone(state);
  }
  async getActivationState(): Promise<ConvergenceObservationActivationState | undefined> {
    return cloneOptional(this.activationState);
  }
  async appendActivationAudit(audit: ConvergenceObservationActivationAudit): Promise<'inserted' | 'duplicate'> {
    const existing = this.activationAudits.get(audit.auditId);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(audit)) throw new Error('activation_audit_identity_conflict');
      return 'duplicate';
    }
    this.activationAudits.set(audit.auditId, clone(audit));
    return 'inserted';
  }
  async listActivationAudits(trialWindowId?: string): Promise<ConvergenceObservationActivationAudit[]> {
    return [...this.activationAudits.values()].filter((item) => !trialWindowId || item.trialWindowId === trialWindowId).map(clone);
  }

  async commitRealTrialReentryApprovalBundle(
    bundle: RealTrialReentryApprovalBundle,
  ): Promise<RealTrialReentryApprovalBundleCommitResult> {
    const issues = validateRealTrialReentryApprovalBundle(bundle);
    if (issues.length) throw new Error(`trial_reentry_bundle_invalid:${issues.join(',')}`);
    const existingWindow = this.windows.get(bundle.trialWindow.trialWindowId);
    const existingReport = this.reentryPreflightReports.get(bundle.preflightReport.reportId);
    const existingLaunch = this.reentryLaunchRecords.get(bundle.launchRecord.launchRecordId);
    const existingBinding = this.runtimeIdentityBindings.get(bundle.runtimeIdentityBinding.bindingId);
    const existingValues = [existingWindow, existingReport, existingLaunch, existingBinding];
    const incomingValues = [bundle.trialWindow, bundle.preflightReport, bundle.launchRecord,
      bundle.runtimeIdentityBinding];
    const populated = existingValues.filter(Boolean).length;
    if (populated > 0 && populated < 4) throw new Error('trial_reentry_partial_bundle_conflict');
    if (populated === 4) {
      if (existingValues.some((value, index) => !sameValue(value, incomingValues[index]))) {
        throw new Error('trial_reentry_bundle_conflict');
      }
      return bundleResult(bundle, 'duplicate');
    }
    if ([...this.reentryLaunchRecords.values()].some((record) =>
      record.runtimeIdentityBindingId === bundle.runtimeIdentityBinding.bindingId)
      || [...this.runtimeIdentityBindings.values()].some((binding) =>
        binding.launchRecordId === bundle.launchRecord.launchRecordId)) {
      throw new Error('trial_reentry_bundle_conflict');
    }
    this.windows.set(bundle.trialWindow.trialWindowId, clone(bundle.trialWindow));
    this.reentryPreflightReports.set(bundle.preflightReport.reportId, clone(bundle.preflightReport));
    this.reentryLaunchRecords.set(bundle.launchRecord.launchRecordId, clone(bundle.launchRecord));
    this.runtimeIdentityBindings.set(bundle.runtimeIdentityBinding.bindingId, clone(bundle.runtimeIdentityBinding));
    return bundleResult(bundle, 'committed');
  }

  async getRealTrialReentryPreflightReport(reportId: string): Promise<RealTrialReentryPreflightReportV2 | undefined> {
    return cloneOptional(this.reentryPreflightReports.get(reportId));
  }
  async getRealTrialReentryLaunchRecord(launchRecordId: string): Promise<RealTrialWindowLaunchRecordV2 | undefined> {
    return cloneOptional(this.reentryLaunchRecords.get(launchRecordId));
  }
  async getRealTrialRuntimeIdentityBinding(bindingId: string): Promise<RealTrialRuntimeIdentityBinding | undefined> {
    return cloneOptional(this.runtimeIdentityBindings.get(bindingId));
  }
  async activateRealTrialReentryAtomically(
    activation: RealTrialReentryAtomicActivation,
  ): Promise<'activated' | 'already_activated'> {
    const issues = validateRealTrialReentryAtomicActivation(activation);
    if (issues.length) throw new Error(`trial_reentry_activation_invalid:${issues.join(',')}`);
    const currentWindow = this.windows.get(activation.trialWindow.trialWindowId);
    const currentState = this.activationState;
    const currentAudit = this.reentryActivationAudits.get(activation.activationAudit.auditId);
    if (currentWindow?.status === 'active' && currentState?.effectiveMode === 'real_trial'
      && currentState.trialWindowId === activation.trialWindow.trialWindowId
      && currentAudit && sameValue(currentAudit, activation.activationAudit)) return 'already_activated';
    if (!currentWindow || currentWindow.status !== 'draft') throw new Error('trial_reentry_activation_conflict');
    if (!sameWindowIdentity(currentWindow, activation.trialWindow)) throw new Error('trial_reentry_activation_conflict');
    if (currentState && (currentState.effectiveMode !== 'off' || currentState.requestedMode !== 'off')) {
      throw new Error('trial_reentry_activation_conflict');
    }
    if (currentAudit) throw new Error('trial_reentry_activation_conflict');
    this.windows.set(activation.trialWindow.trialWindowId, clone(activation.trialWindow));
    this.activationState = clone(activation.activationState);
    this.reentryActivationAudits.set(activation.activationAudit.auditId, clone(activation.activationAudit));
    return 'activated';
  }
  async listRealTrialReentryActivationAudits(
    trialWindowId?: string,
  ): Promise<ConvergenceObservationActivationAuditV3[]> {
    return [...this.reentryActivationAudits.values()]
      .filter((item) => !trialWindowId || item.trialWindowId === trialWindowId).map(clone);
  }

  async clear(): Promise<void> {
    this.windows.clear();
    this.events.clear();
    this.snapshots.clear();
    this.proposals.clear();
    this.registries.clear();
    this.preflightReports.clear();
    this.launchRecords.clear();
    this.activationState = undefined;
    this.activationAudits.clear();
    this.reentryPreflightReports.clear();
    this.reentryLaunchRecords.clear();
    this.runtimeIdentityBindings.clear();
    this.reentryActivationAudits.clear();
  }
}

function clone<T>(value: T): T { return structuredClone(value); }
function cloneOptional<T>(value: T | undefined): T | undefined { return value ? clone(value) : undefined; }
function saveImmutable<T>(map: Map<string, T>, key: string, value: T, conflictCode: string): void {
  const existing = map.get(key);
  if (existing && JSON.stringify(existing) !== JSON.stringify(value)) throw new Error(conflictCode);
  if (!existing) map.set(key, clone(value));
}
function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
function bundleResult(
  bundle: RealTrialReentryApprovalBundle,
  status: 'committed' | 'duplicate',
): RealTrialReentryApprovalBundleCommitResult {
  return { status, trialWindowId: bundle.trialWindow.trialWindowId,
    preflightReportId: bundle.preflightReport.reportId,
    launchRecordId: bundle.launchRecord.launchRecordId,
    runtimeIdentityBindingId: bundle.runtimeIdentityBinding.bindingId };
}
function sameWindowIdentity(left: ComplexityConvergenceTrialWindow, right: ComplexityConvergenceTrialWindow): boolean {
  const mutable = new Set(['status', 'closedAt', 'invalidationReasons']);
  return JSON.stringify(Object.fromEntries(Object.entries(left).filter(([key]) => !mutable.has(key))))
    === JSON.stringify(Object.fromEntries(Object.entries(right).filter(([key]) => !mutable.has(key))));
}
function validWindowTransition(
  from: ComplexityConvergenceTrialWindow['status'],
  to: ComplexityConvergenceTrialWindow['status'],
): boolean {
  return ({ draft: ['draft', 'active', 'invalidated'], active: ['active', 'closed', 'invalidated'],
    closed: ['closed'], invalidated: ['invalidated'] } as const)[from].includes(to as never);
}
