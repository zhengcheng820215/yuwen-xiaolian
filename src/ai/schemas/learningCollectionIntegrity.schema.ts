import type { LearningObservationEventType } from './learningObservationEvent.schema.ts';
import {
  CURRENT_LEARNING_COLLECTION_GENERATION,
  CURRENT_LEARNING_COLLECTION_STARTED_AT,
} from './learningCollectionGeneration.ts';

export {
  CURRENT_LEARNING_COLLECTION_GENERATION,
  CURRENT_LEARNING_COLLECTION_STARTED_AT,
} from './learningCollectionGeneration.ts';

export const LEARNING_COLLECTION_INTEGRITY_SCHEMA_VERSION =
  'learning_collection_integrity_report_v2' as const;

export type LearningCollectionIntegrityScope =
  | 'current_collection'
  | 'all_history';

export type LearningCollectionIntegrityIssueSeverity = 'warning' | 'fail';

export type LearningCollectionIntegrityIssueCode =
  | 'missing_question_presented'
  | 'missing_answer_submitted'
  | 'missing_diagnosis_completed'
  | 'missing_feedback_presented'
  | 'missing_round_completed'
  | 'missing_projection'
  | 'duplicate_event'
  | 'duplicate_projection'
  | 'resource_version_mismatch'
  | 'identity_mismatch'
  | 'demo_scope_leak'
  | 'occurred_at_inversion'
  | 'eligible_without_completed_round'
  | 'independent_sample_overcount';

export type LearningCollectionIntegrityIssue = {
  code: LearningCollectionIntegrityIssueCode;
  severity: LearningCollectionIntegrityIssueSeverity;
  learningRoundId?: string;
  attemptId?: string;
  sourceIds: string[];
  message: string;
};

export type LearningCollectionIntegrityReport = {
  schemaVersion: typeof LEARNING_COLLECTION_INTEGRITY_SCHEMA_VERSION;
  reportId: string;
  studentId: string;
  generatedAt: string;
  scope: LearningCollectionIntegrityScope;
  collectionGeneration: typeof CURRENT_LEARNING_COLLECTION_GENERATION;
  currentCollectionStartedAt: string;
  scopeTotals: {
    includedRounds: number;
    currentCollectionRounds: number;
    realLearningRounds: number;
    internalAcceptanceRounds: number;
    legacyRounds: number;
  };
  originPolicy: {
    policyVersion?: string;
    trialWindowId?: string;
    evaluatedOrigin: 'real_learning' | 'mixed_history';
  };
  totals: {
    sessions: number;
    roundsWithFormalQuestion: number;
    completedRounds: number;
    submittedAttempts: number;
    eligibleCalibrationAttempts: number;
    excludedCalibrationAttempts: number;
    projectionFailedAttempts: number;
    independentSubjects: number;
  };
  eventCounts: Record<LearningObservationEventType, number>;
  issues: LearningCollectionIntegrityIssue[];
  status: 'pass' | 'warning' | 'fail';
};

export function resolveLearningCollectionIntegrityStatus(
  issues: LearningCollectionIntegrityIssue[],
): LearningCollectionIntegrityReport['status'] {
  if (issues.some((issue) => issue.severity === 'fail')) return 'fail';
  if (issues.some((issue) => issue.severity === 'warning')) return 'warning';
  return 'pass';
}
