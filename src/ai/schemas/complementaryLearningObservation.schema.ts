export type ComplementaryObservationPerformance = 'strong' | 'weak';

export type IndependentLearningObservation = {
  responseFormat: 'single_choice' | 'text';
  studentId: string;
  materialVersionId: string;
  taskId: string;
  attemptId: string;
  diagnosisId: string;
  evidenceId: string;
  abilityIds: string[];
  performance: ComplementaryObservationPerformance;
  observedAt: string;
};

export type ComplementaryObservationInterpretation =
  | 'prerequisite_gap_hypothesis'
  | 'constructed_response_gap_hypothesis'
  | 'evidence_conflict'
  | 'multi_source_positive';

export type ComplementaryTrainingRoute =
  | 'prerequisite_foundation'
  | 'constructed_response_training'
  | 'diagnostic_verification'
  | 'retest_or_transfer';

export type ComplementaryObservationDecision = {
  status: 'interpreted' | 'insufficient_scope';
  interpretation?: ComplementaryObservationInterpretation;
  trainingRoute?: ComplementaryTrainingRoute;
  rootCauseStatus: 'hypothesis' | 'unresolved';
  sourceAttemptIds: string[];
  sourceDiagnosisIds: string[];
  sourceEvidenceIds: string[];
  mergedScore?: never;
  issues: string[];
};
