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
import type {
  ConvergenceObservationActivationAuditV3,
  RealTrialReentryApprovalBundle,
  RealTrialReentryApprovalBundleCommitResult,
  RealTrialReentryAtomicActivation,
  RealTrialReentryPreflightReportV2,
  RealTrialWindowLaunchRecordV2,
} from '../schemas/productRuntimeTrialReentry.schema.ts';
import type { RealTrialRuntimeIdentityBinding } from '../schemas/productRuntimeIdentity.schema.ts';

export interface ProductComplexityConvergenceObservationRepository {
  saveTrialWindow(window: ComplexityConvergenceTrialWindow): Promise<void>;
  getTrialWindow(trialWindowId: string): Promise<ComplexityConvergenceTrialWindow | undefined>;
  listTrialWindows(): Promise<ComplexityConvergenceTrialWindow[]>;
  appendEvent(event: ComplexityConvergenceObservationEvent): Promise<'inserted' | 'duplicate'>;
  getEvent(eventId: string): Promise<ComplexityConvergenceObservationEvent | undefined>;
  listEvents(trialWindowId?: string): Promise<ComplexityConvergenceObservationEvent[]>;
  saveSnapshot(snapshot: ComplexityConvergenceAggregateSnapshot): Promise<void>;
  getSnapshot(snapshotId: string): Promise<ComplexityConvergenceAggregateSnapshot | undefined>;
  listSnapshots(trialWindowId?: string): Promise<ComplexityConvergenceAggregateSnapshot[]>;
  saveProposal(proposal: ComplexityConvergenceDecisionProposal): Promise<void>;
  getProposal(proposalId: string): Promise<ComplexityConvergenceDecisionProposal | undefined>;
  listProposals(trialWindowId?: string): Promise<ComplexityConvergenceDecisionProposal[]>;
  saveSourceRegistrySnapshot(snapshot: ConvergenceObservationSourceRegistrySnapshot): Promise<void>;
  getSourceRegistrySnapshot(sourceRegistryVersion: string): Promise<ConvergenceObservationSourceRegistrySnapshot | undefined>;
  listSourceRegistrySnapshots(): Promise<ConvergenceObservationSourceRegistrySnapshot[]>;
  savePreflightReport(report: RealTrialWindowPreflightReport): Promise<void>;
  getPreflightReport(reportId: string): Promise<RealTrialWindowPreflightReport | undefined>;
  listPreflightReports(trialWindowId?: string): Promise<RealTrialWindowPreflightReport[]>;
  saveLaunchRecord(record: RealTrialWindowLaunchRecord): Promise<void>;
  getLaunchRecord(launchRecordId: string): Promise<RealTrialWindowLaunchRecord | undefined>;
  listLaunchRecords(trialWindowId?: string): Promise<RealTrialWindowLaunchRecord[]>;
  saveActivationState(state: ConvergenceObservationActivationState): Promise<void>;
  getActivationState(): Promise<ConvergenceObservationActivationState | undefined>;
  appendActivationAudit(audit: ConvergenceObservationActivationAudit): Promise<'inserted' | 'duplicate'>;
  listActivationAudits(trialWindowId?: string): Promise<ConvergenceObservationActivationAudit[]>;
  commitRealTrialReentryApprovalBundle(
    bundle: RealTrialReentryApprovalBundle,
  ): Promise<RealTrialReentryApprovalBundleCommitResult>;
  getRealTrialReentryPreflightReport(reportId: string): Promise<RealTrialReentryPreflightReportV2 | undefined>;
  listRealTrialReentryPreflightReports(trialWindowId?: string): Promise<RealTrialReentryPreflightReportV2[]>;
  getRealTrialReentryLaunchRecord(launchRecordId: string): Promise<RealTrialWindowLaunchRecordV2 | undefined>;
  listRealTrialReentryLaunchRecords(trialWindowId?: string): Promise<RealTrialWindowLaunchRecordV2[]>;
  getRealTrialRuntimeIdentityBinding(bindingId: string): Promise<RealTrialRuntimeIdentityBinding | undefined>;
  activateRealTrialReentryAtomically(
    activation: RealTrialReentryAtomicActivation,
  ): Promise<'activated' | 'already_activated'>;
  listRealTrialReentryActivationAudits(
    trialWindowId?: string,
  ): Promise<ConvergenceObservationActivationAuditV3[]>;
  clear(): Promise<void>;
}
