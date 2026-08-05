import type { CandidateFieldKey } from './questionCandidate.schema.ts';

export const QUESTION_CANDIDATE_CORRECTION_SCHEMA_VERSION =
  'question-candidate-correction-v1' as const;

export type ExceptionCorrectionReasonCode =
  | 'typo'
  | 'proper_noun'
  | 'copyright'
  | 'required_wording'
  | 'other'
  | 'legacy_working_content';

export type ExceptionCorrectionPermissionRole =
  | 'resource_admin'
  | 'quality_reviewer';

export type ExceptionCorrectionTargetType =
  | 'candidate'
  | 'question_revision';

export type ExceptionCorrectionRecord = {
  correctionId: string;
  candidateId: string;
  trainingTaskId: string;
  targetType: ExceptionCorrectionTargetType;
  targetId: string;
  reasonCode: ExceptionCorrectionReasonCode;
  beforeHash: string;
  afterHash: string;
  changedFields: CandidateFieldKey[];
  correctedBy: string;
  permissionRole: ExceptionCorrectionPermissionRole;
  note?: string;
  sourceWorkingContentHash?: string;
  correctedAt: string;
  schemaVersion: typeof QUESTION_CANDIDATE_CORRECTION_SCHEMA_VERSION;
};

export type WorkingContentMigrationResult =
  | {
    status: 'migrated';
    trainingTaskId: string;
    candidateId: string;
    correctionId: string;
  }
  | {
    status: 'missing' | 'no_changes';
    trainingTaskId: string;
  }
  | {
    status: 'base_revision_conflict';
    trainingTaskId: string;
    reason: 'active_draft_changed' | 'revision_changed' | 'base_content_changed' |
      'base_draft_missing';
  }
  | {
    status: 'requires_protected_resolution';
    trainingTaskId: string;
    reason: 'contains_training_task_fields';
  };
