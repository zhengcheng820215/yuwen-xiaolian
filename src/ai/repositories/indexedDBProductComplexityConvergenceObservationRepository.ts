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

const DATABASE_NAME = 'yuwen-xiaolian-product-complexity-convergence-stage4';
const DATABASE_VERSION = 3;
const WINDOW_STORE = 'trial-windows';
const EVENT_STORE = 'observation-events';
const SNAPSHOT_STORE = 'aggregate-snapshots';
const PROPOSAL_STORE = 'decision-proposals';
const SOURCE_REGISTRY_STORE = 'source-registry-snapshots';
const PREFLIGHT_REPORT_STORE = 'preflight-reports';
const LAUNCH_RECORD_STORE = 'launch-records';
const ACTIVATION_STATE_STORE = 'activation-states';
const ACTIVATION_AUDIT_STORE = 'activation-audits';
const REENTRY_PREFLIGHT_REPORT_STORE = 'reentry-preflight-reports';
const REENTRY_LAUNCH_RECORD_STORE = 'reentry-launch-records';
const RUNTIME_IDENTITY_BINDING_STORE = 'runtime-identity-bindings';
const REENTRY_ACTIVATION_AUDIT_STORE = 'reentry-activation-audits';
const STATUS_RANK: Record<ComplexityConvergenceDecisionProposal['status'], number> = {
  proposed: 0, accepted: 1, rejected: 1, superseded: 2,
};

export class IndexedDBProductComplexityConvergenceObservationRepository
implements ProductComplexityConvergenceObservationRepository {
  private readonly databaseName: string;

  constructor(databaseName = DATABASE_NAME) {
    this.databaseName = databaseName;
  }

  async saveTrialWindow(window: ComplexityConvergenceTrialWindow): Promise<void> {
    const existing = await this.getTrialWindow(window.trialWindowId);
    if (existing && !sameWindowIdentity(existing, window)) throw new Error('trial_window_identity_conflict');
    if (existing && !validWindowTransition(existing.status, window.status)) throw new Error('trial_window_status_regression');
    await this.put(WINDOW_STORE, window);
  }

  async getTrialWindow(trialWindowId: string): Promise<ComplexityConvergenceTrialWindow | undefined> {
    return this.readOne(WINDOW_STORE, trialWindowId);
  }

  async listTrialWindows(): Promise<ComplexityConvergenceTrialWindow[]> {
    return this.readAll<ComplexityConvergenceTrialWindow>(WINDOW_STORE);
  }

  async appendEvent(event: ComplexityConvergenceObservationEvent): Promise<'inserted' | 'duplicate'> {
    const database = await this.open();
    try {
      const transaction = database.transaction(EVENT_STORE, 'readwrite');
      const store = transaction.objectStore(EVENT_STORE);
      const existing = await requestDone<ComplexityConvergenceObservationEvent | undefined>(store.get(event.eventId));
      if (existing) {
        if (existing.eventHash !== event.eventHash) throw new Error('observation_event_identity_conflict');
        return 'duplicate';
      }
      await requestDone(store.add(clone(event)));
      return 'inserted';
    } finally { database.close(); }
  }

  async getEvent(eventId: string): Promise<ComplexityConvergenceObservationEvent | undefined> {
    return this.readOne(EVENT_STORE, eventId);
  }

  async listEvents(trialWindowId?: string): Promise<ComplexityConvergenceObservationEvent[]> {
    const values = await this.readAll<ComplexityConvergenceObservationEvent>(EVENT_STORE);
    return values.filter((item) => !trialWindowId || item.trialWindowId === trialWindowId);
  }

  async saveSnapshot(snapshot: ComplexityConvergenceAggregateSnapshot): Promise<void> {
    const existing = await this.getSnapshot(snapshot.snapshotId);
    if (existing && existing.snapshotHash !== snapshot.snapshotHash) throw new Error('aggregate_snapshot_identity_conflict');
    if (!existing) await this.put(SNAPSHOT_STORE, snapshot);
  }

  async getSnapshot(snapshotId: string): Promise<ComplexityConvergenceAggregateSnapshot | undefined> {
    return this.readOne(SNAPSHOT_STORE, snapshotId);
  }

  async listSnapshots(trialWindowId?: string): Promise<ComplexityConvergenceAggregateSnapshot[]> {
    const values = await this.readAll<ComplexityConvergenceAggregateSnapshot>(SNAPSHOT_STORE);
    return values.filter((item) => !trialWindowId || item.trialWindowId === trialWindowId);
  }

  async saveProposal(proposal: ComplexityConvergenceDecisionProposal): Promise<void> {
    const existing = await this.getProposal(proposal.proposalId);
    if (existing && STATUS_RANK[proposal.status] < STATUS_RANK[existing.status]) return;
    if (existing && STATUS_RANK[proposal.status] === STATUS_RANK[existing.status]
      && existing.status !== proposal.status) throw new Error('proposal_terminal_status_conflict');
    await this.put(PROPOSAL_STORE, proposal);
  }

  async getProposal(proposalId: string): Promise<ComplexityConvergenceDecisionProposal | undefined> {
    return this.readOne(PROPOSAL_STORE, proposalId);
  }

  async listProposals(trialWindowId?: string): Promise<ComplexityConvergenceDecisionProposal[]> {
    const values = await this.readAll<ComplexityConvergenceDecisionProposal>(PROPOSAL_STORE);
    return values.filter((item) => !trialWindowId || item.trialWindowId === trialWindowId);
  }

  async saveSourceRegistrySnapshot(snapshot: ConvergenceObservationSourceRegistrySnapshot): Promise<void> {
    await this.putImmutable(SOURCE_REGISTRY_STORE, snapshot.sourceRegistryVersion, snapshot, 'source_registry_identity_conflict');
  }
  async getSourceRegistrySnapshot(sourceRegistryVersion: string): Promise<ConvergenceObservationSourceRegistrySnapshot | undefined> {
    return this.readOne(SOURCE_REGISTRY_STORE, sourceRegistryVersion);
  }
  async listSourceRegistrySnapshots(): Promise<ConvergenceObservationSourceRegistrySnapshot[]> {
    return this.readAll(SOURCE_REGISTRY_STORE);
  }
  async savePreflightReport(report: RealTrialWindowPreflightReport): Promise<void> {
    await this.putImmutable(PREFLIGHT_REPORT_STORE, report.reportId, report, 'preflight_report_identity_conflict');
  }
  async getPreflightReport(reportId: string): Promise<RealTrialWindowPreflightReport | undefined> {
    return this.readOne(PREFLIGHT_REPORT_STORE, reportId);
  }
  async listPreflightReports(trialWindowId?: string): Promise<RealTrialWindowPreflightReport[]> {
    const values = await this.readAll<RealTrialWindowPreflightReport>(PREFLIGHT_REPORT_STORE);
    return values.filter((item) => !trialWindowId || item.trialWindowId === trialWindowId);
  }
  async saveLaunchRecord(record: RealTrialWindowLaunchRecord): Promise<void> {
    await this.putImmutable(LAUNCH_RECORD_STORE, record.launchRecordId, record, 'launch_record_identity_conflict');
  }
  async getLaunchRecord(launchRecordId: string): Promise<RealTrialWindowLaunchRecord | undefined> {
    return this.readOne(LAUNCH_RECORD_STORE, launchRecordId);
  }
  async listLaunchRecords(trialWindowId?: string): Promise<RealTrialWindowLaunchRecord[]> {
    const values = await this.readAll<RealTrialWindowLaunchRecord>(LAUNCH_RECORD_STORE);
    return values.filter((item) => !trialWindowId || item.trialWindowId === trialWindowId);
  }
  async saveActivationState(state: ConvergenceObservationActivationState): Promise<void> {
    await this.put(ACTIVATION_STATE_STORE, state);
  }
  async getActivationState(): Promise<ConvergenceObservationActivationState | undefined> {
    return this.readOne(ACTIVATION_STATE_STORE, 'product-complexity-convergence-stage4-current');
  }
  async appendActivationAudit(audit: ConvergenceObservationActivationAudit): Promise<'inserted' | 'duplicate'> {
    const database = await this.open();
    try {
      const transaction = database.transaction(ACTIVATION_AUDIT_STORE, 'readwrite');
      const store = transaction.objectStore(ACTIVATION_AUDIT_STORE);
      const existing = await requestDone<ConvergenceObservationActivationAudit | undefined>(store.get(audit.auditId));
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(audit)) throw new Error('activation_audit_identity_conflict');
        return 'duplicate';
      }
      await requestDone(store.add(clone(audit)));
      return 'inserted';
    } finally { database.close(); }
  }
  async listActivationAudits(trialWindowId?: string): Promise<ConvergenceObservationActivationAudit[]> {
    const values = await this.readAll<ConvergenceObservationActivationAudit>(ACTIVATION_AUDIT_STORE);
    return values.filter((item) => !trialWindowId || item.trialWindowId === trialWindowId);
  }

  async commitRealTrialReentryApprovalBundle(
    bundle: RealTrialReentryApprovalBundle,
  ): Promise<RealTrialReentryApprovalBundleCommitResult> {
    const issues = validateRealTrialReentryApprovalBundle(bundle);
    if (issues.length) throw new Error(`trial_reentry_bundle_invalid:${issues.join(',')}`);
    const database = await this.open();
    const transaction = database.transaction([
      WINDOW_STORE, REENTRY_PREFLIGHT_REPORT_STORE, REENTRY_LAUNCH_RECORD_STORE,
      RUNTIME_IDENTITY_BINDING_STORE,
    ], 'readwrite');
    try {
      const windowStore = transaction.objectStore(WINDOW_STORE);
      const reportStore = transaction.objectStore(REENTRY_PREFLIGHT_REPORT_STORE);
      const launchStore = transaction.objectStore(REENTRY_LAUNCH_RECORD_STORE);
      const bindingStore = transaction.objectStore(RUNTIME_IDENTITY_BINDING_STORE);
      const values = await Promise.all([
        requestDone(windowStore.get(bundle.trialWindow.trialWindowId)),
        requestDone(reportStore.get(bundle.preflightReport.reportId)),
        requestDone(launchStore.get(bundle.launchRecord.launchRecordId)),
        requestDone(bindingStore.get(bundle.runtimeIdentityBinding.bindingId)),
      ]);
      const [allLaunches, allBindings] = await Promise.all([
        requestDone<RealTrialWindowLaunchRecordV2[]>(launchStore.getAll()),
        requestDone<RealTrialRuntimeIdentityBinding[]>(bindingStore.getAll()),
      ]);
      const populated = values.filter(Boolean).length;
      if (populated > 0 && populated < 4) throw new Error('trial_reentry_partial_bundle_conflict');
      if (populated === 4) {
        const incoming = [bundle.trialWindow, bundle.preflightReport, bundle.launchRecord,
          bundle.runtimeIdentityBinding];
        if (values.some((value, index) => !sameValue(value, incoming[index]))) {
          throw new Error('trial_reentry_bundle_conflict');
        }
        await transactionDone(transaction);
        return bundleResult(bundle, 'duplicate');
      }
      if (allLaunches.some((record) => record.runtimeIdentityBindingId === bundle.runtimeIdentityBinding.bindingId)
        || allBindings.some((binding) => binding.launchRecordId === bundle.launchRecord.launchRecordId)) {
        throw new Error('trial_reentry_bundle_conflict');
      }
      windowStore.add(clone(bundle.trialWindow));
      reportStore.add(clone(bundle.preflightReport));
      launchStore.add(clone(bundle.launchRecord));
      bindingStore.add(clone(bundle.runtimeIdentityBinding));
      await transactionDone(transaction);
      return bundleResult(bundle, 'committed');
    } catch (error) {
      try { transaction.abort(); } catch { /* transaction already completed */ }
      throw error;
    } finally { database.close(); }
  }

  async getRealTrialReentryPreflightReport(reportId: string): Promise<RealTrialReentryPreflightReportV2 | undefined> {
    return this.readOne(REENTRY_PREFLIGHT_REPORT_STORE, reportId);
  }
  async listRealTrialReentryPreflightReports(
    trialWindowId?: string,
  ): Promise<RealTrialReentryPreflightReportV2[]> {
    const values = await this.readAll<RealTrialReentryPreflightReportV2>(REENTRY_PREFLIGHT_REPORT_STORE);
    return values.filter((item) => !trialWindowId || item.trialWindowId === trialWindowId);
  }
  async getRealTrialReentryLaunchRecord(launchRecordId: string): Promise<RealTrialWindowLaunchRecordV2 | undefined> {
    return this.readOne(REENTRY_LAUNCH_RECORD_STORE, launchRecordId);
  }
  async listRealTrialReentryLaunchRecords(
    trialWindowId?: string,
  ): Promise<RealTrialWindowLaunchRecordV2[]> {
    const values = await this.readAll<RealTrialWindowLaunchRecordV2>(REENTRY_LAUNCH_RECORD_STORE);
    return values.filter((item) => !trialWindowId || item.trialWindowId === trialWindowId);
  }
  async getRealTrialRuntimeIdentityBinding(bindingId: string): Promise<RealTrialRuntimeIdentityBinding | undefined> {
    return this.readOne(RUNTIME_IDENTITY_BINDING_STORE, bindingId);
  }
  async activateRealTrialReentryAtomically(
    activation: RealTrialReentryAtomicActivation,
  ): Promise<'activated' | 'already_activated'> {
    const issues = validateRealTrialReentryAtomicActivation(activation);
    if (issues.length) throw new Error(`trial_reentry_activation_invalid:${issues.join(',')}`);
    const database = await this.open();
    const transaction = database.transaction([
      WINDOW_STORE, ACTIVATION_STATE_STORE, REENTRY_ACTIVATION_AUDIT_STORE,
    ], 'readwrite');
    try {
      const windowStore = transaction.objectStore(WINDOW_STORE);
      const stateStore = transaction.objectStore(ACTIVATION_STATE_STORE);
      const auditStore = transaction.objectStore(REENTRY_ACTIVATION_AUDIT_STORE);
      const [window, state, audit] = await Promise.all([
        requestDone<ComplexityConvergenceTrialWindow | undefined>(windowStore.get(activation.trialWindow.trialWindowId)),
        requestDone<ConvergenceObservationActivationState | undefined>(stateStore.get('product-complexity-convergence-stage4-current')),
        requestDone<ConvergenceObservationActivationAuditV3 | undefined>(auditStore.get(activation.activationAudit.auditId)),
      ]);
      if (window?.status === 'active' && state?.effectiveMode === 'real_trial'
        && state.trialWindowId === activation.trialWindow.trialWindowId
        && audit && sameValue(audit, activation.activationAudit)) {
        await transactionDone(transaction);
        return 'already_activated';
      }
      if (!window || window.status !== 'draft' || !sameWindowIdentity(window, activation.trialWindow)
        || (state && (state.requestedMode !== 'off' || state.effectiveMode !== 'off')) || audit) {
        throw new Error('trial_reentry_activation_conflict');
      }
      windowStore.put(clone(activation.trialWindow));
      stateStore.put(clone(activation.activationState));
      auditStore.add(clone(activation.activationAudit));
      await transactionDone(transaction);
      return 'activated';
    } catch (error) {
      try { transaction.abort(); } catch { /* transaction already completed */ }
      throw error;
    } finally { database.close(); }
  }
  async listRealTrialReentryActivationAudits(
    trialWindowId?: string,
  ): Promise<ConvergenceObservationActivationAuditV3[]> {
    const values = await this.readAll<ConvergenceObservationActivationAuditV3>(REENTRY_ACTIVATION_AUDIT_STORE);
    return values.filter((item) => !trialWindowId || item.trialWindowId === trialWindowId);
  }

  async clear(): Promise<void> {
    const database = await this.open();
    try {
      await Promise.all([WINDOW_STORE, EVENT_STORE, SNAPSHOT_STORE, PROPOSAL_STORE,
        SOURCE_REGISTRY_STORE, PREFLIGHT_REPORT_STORE, LAUNCH_RECORD_STORE,
        ACTIVATION_STATE_STORE, ACTIVATION_AUDIT_STORE, REENTRY_PREFLIGHT_REPORT_STORE,
        REENTRY_LAUNCH_RECORD_STORE, RUNTIME_IDENTITY_BINDING_STORE,
        REENTRY_ACTIVATION_AUDIT_STORE].map((storeName) =>
        requestDone(database.transaction(storeName, 'readwrite').objectStore(storeName).clear())));
    } finally { database.close(); }
  }

  private async readOne<T>(storeName: string, key: string): Promise<T | undefined> {
    const database = await this.open();
    try { return await requestDone(database.transaction(storeName, 'readonly').objectStore(storeName).get(key)); }
    finally { database.close(); }
  }

  private async readAll<T>(storeName: string): Promise<T[]> {
    const database = await this.open();
    try { return await requestDone(database.transaction(storeName, 'readonly').objectStore(storeName).getAll()); }
    finally { database.close(); }
  }

  private async put<T>(storeName: string, value: T): Promise<void> {
    const database = await this.open();
    try { await requestDone(database.transaction(storeName, 'readwrite').objectStore(storeName).put(clone(value))); }
    finally { database.close(); }
  }

  private async add<T>(storeName: string, value: T): Promise<void> {
    const database = await this.open();
    try { await requestDone(database.transaction(storeName, 'readwrite').objectStore(storeName).add(clone(value))); }
    finally { database.close(); }
  }

  private async putImmutable<T>(storeName: string, key: string, value: T, conflictCode: string): Promise<void> {
    const existing = await this.readOne<T>(storeName, key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(value)) throw new Error(conflictCode);
    if (!existing) await this.put(storeName, value);
  }

  private async open(): Promise<IDBDatabase> {
    return await new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, DATABASE_VERSION);
      request.onerror = () => reject(request.error || new Error('Stage 4 observation database failed to open.'));
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(WINDOW_STORE)) request.result.createObjectStore(WINDOW_STORE, { keyPath: 'trialWindowId' });
        if (!request.result.objectStoreNames.contains(EVENT_STORE)) request.result.createObjectStore(EVENT_STORE, { keyPath: 'eventId' });
        if (!request.result.objectStoreNames.contains(SNAPSHOT_STORE)) request.result.createObjectStore(SNAPSHOT_STORE, { keyPath: 'snapshotId' });
        if (!request.result.objectStoreNames.contains(PROPOSAL_STORE)) request.result.createObjectStore(PROPOSAL_STORE, { keyPath: 'proposalId' });
        if (!request.result.objectStoreNames.contains(SOURCE_REGISTRY_STORE)) request.result.createObjectStore(SOURCE_REGISTRY_STORE, { keyPath: 'sourceRegistryVersion' });
        if (!request.result.objectStoreNames.contains(PREFLIGHT_REPORT_STORE)) request.result.createObjectStore(PREFLIGHT_REPORT_STORE, { keyPath: 'reportId' });
        if (!request.result.objectStoreNames.contains(LAUNCH_RECORD_STORE)) request.result.createObjectStore(LAUNCH_RECORD_STORE, { keyPath: 'launchRecordId' });
        if (!request.result.objectStoreNames.contains(ACTIVATION_STATE_STORE)) request.result.createObjectStore(ACTIVATION_STATE_STORE, { keyPath: 'activationStateId' });
        if (!request.result.objectStoreNames.contains(ACTIVATION_AUDIT_STORE)) request.result.createObjectStore(ACTIVATION_AUDIT_STORE, { keyPath: 'auditId' });
        if (!request.result.objectStoreNames.contains(REENTRY_PREFLIGHT_REPORT_STORE)) request.result.createObjectStore(REENTRY_PREFLIGHT_REPORT_STORE, { keyPath: 'reportId' });
        if (!request.result.objectStoreNames.contains(REENTRY_LAUNCH_RECORD_STORE)) request.result.createObjectStore(REENTRY_LAUNCH_RECORD_STORE, { keyPath: 'launchRecordId' });
        if (!request.result.objectStoreNames.contains(RUNTIME_IDENTITY_BINDING_STORE)) request.result.createObjectStore(RUNTIME_IDENTITY_BINDING_STORE, { keyPath: 'bindingId' });
        if (!request.result.objectStoreNames.contains(REENTRY_ACTIVATION_AUDIT_STORE)) request.result.createObjectStore(REENTRY_ACTIVATION_AUDIT_STORE, { keyPath: 'auditId' });
      };
      request.onsuccess = () => resolve(request.result);
    });
  }
}

function requestDone<T = undefined>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Stage 4 observation operation failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Stage 4 observation transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Stage 4 observation transaction aborted.'));
  });
}

function clone<T>(value: T): T { return structuredClone(value); }
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
