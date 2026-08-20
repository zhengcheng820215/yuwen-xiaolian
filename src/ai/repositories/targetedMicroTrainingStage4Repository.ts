import type { TargetedMicroTrainingStage4Snapshot } from
  '../schemas/targetedMicroTrainingStage4.schema.ts';

export type TargetedMicroTrainingStage4WriteResult = {
  status: 'committed' | 'unchanged' | 'conflict';
  snapshot: TargetedMicroTrainingStage4Snapshot;
};

export type TargetedMicroTrainingStage4Repository = {
  load(): Promise<TargetedMicroTrainingStage4Snapshot>;
  save(
    snapshot: TargetedMicroTrainingStage4Snapshot,
    expectedRevision: number,
  ): Promise<TargetedMicroTrainingStage4WriteResult>;
  clear(): Promise<void>;
};

