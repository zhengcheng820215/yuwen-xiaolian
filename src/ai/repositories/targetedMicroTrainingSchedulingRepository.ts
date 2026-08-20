import type {
  TargetedMicroTrainingAssignment,
  TargetedMicroTrainingRequest,
} from '../schemas/targetedMicroTraining.schema.ts';
import type {
  TargetedMicroTrainingSchedulingSnapshot,
  TargetedMicroTrainingTriggerDecision,
} from '../schemas/targetedMicroTrainingScheduling.schema.ts';

export type TargetedMicroTrainingSchedulingCommit = {
  expectedRevision: number;
  decision: TargetedMicroTrainingTriggerDecision;
  request?: TargetedMicroTrainingRequest;
  assignment?: TargetedMicroTrainingAssignment;
  committedAt: string;
};

export type TargetedMicroTrainingSchedulingCommitResult = {
  status: 'committed' | 'reused' | 'conflict';
  snapshot: TargetedMicroTrainingSchedulingSnapshot;
  request?: TargetedMicroTrainingRequest;
  assignment?: TargetedMicroTrainingAssignment;
};

export type TargetedMicroTrainingSchedulingRepository = {
  load(): Promise<TargetedMicroTrainingSchedulingSnapshot>;
  commit(
    command: TargetedMicroTrainingSchedulingCommit,
  ): Promise<TargetedMicroTrainingSchedulingCommitResult>;
  updateAssignmentStatus(input: {
    assignmentId: string;
    expectedStatus: TargetedMicroTrainingAssignment['status'];
    nextStatus: TargetedMicroTrainingAssignment['status'];
    expectedRevision: number;
    updatedAt: string;
  }): Promise<TargetedMicroTrainingSchedulingCommitResult>;
  clear(): Promise<void>;
};
