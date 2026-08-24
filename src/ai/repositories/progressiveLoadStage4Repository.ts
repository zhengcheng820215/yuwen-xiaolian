import type {
  ProgressiveLoadCalibrationEvent,
  ProgressiveLoadCalibrationEventWriteResult,
  ProgressiveLoadCalibrationOutboxEntry,
  ProgressiveLoadCalibrationProjection,
  ProgressiveLoadCalibrationThresholdPolicy,
  ProgressiveLoadGovernanceContext,
} from '../schemas/progressiveLoadStage4.schema.ts';

export interface ProgressiveLoadStage4Repository {
  saveGovernanceContext(value: ProgressiveLoadGovernanceContext): Promise<ProgressiveLoadGovernanceContext>;
  getGovernanceContext(id: string): Promise<ProgressiveLoadGovernanceContext | null>;
  listGovernanceContexts(): Promise<ProgressiveLoadGovernanceContext[]>;
  saveEvent(value: ProgressiveLoadCalibrationEvent): Promise<ProgressiveLoadCalibrationEventWriteResult>;
  getEvent(id: string): Promise<ProgressiveLoadCalibrationEvent | null>;
  listEvents(): Promise<ProgressiveLoadCalibrationEvent[]>;
  saveOutboxEntry(value: ProgressiveLoadCalibrationOutboxEntry): Promise<ProgressiveLoadCalibrationOutboxEntry>;
  getOutboxEntry(id: string): Promise<ProgressiveLoadCalibrationOutboxEntry | null>;
  listDueOutboxEntries(now: string): Promise<ProgressiveLoadCalibrationOutboxEntry[]>;
  deleteOutboxEntry(id: string): Promise<void>;
  saveProjection(value: ProgressiveLoadCalibrationProjection): Promise<ProgressiveLoadCalibrationProjection>;
  listProjections(): Promise<ProgressiveLoadCalibrationProjection[]>;
  saveThresholdPolicy(value: ProgressiveLoadCalibrationThresholdPolicy): Promise<ProgressiveLoadCalibrationThresholdPolicy>;
  listThresholdPolicies(): Promise<ProgressiveLoadCalibrationThresholdPolicy[]>;
  clear(): Promise<void>;
}
