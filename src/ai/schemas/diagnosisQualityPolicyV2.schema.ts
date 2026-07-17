import type { OpenResponseAnswerStatus } from './diagnosis.schema.ts';
import type { DiagnosisQualityLevel, DiagnosisReviewerAgreement } from './diagnosisQualityEvaluation.schema.ts';

export const DIAGNOSIS_ANNOTATION_PROTOCOL_V2 = 'diagnosis_annotation_protocol_v2' as const;
export const DIAGNOSIS_QUALITY_POLICY_V2 = 'diagnosis_quality_policy_v2' as const;
export const DIAGNOSIS_QUALITY_POLICY_V21 = 'diagnosis_quality_policy_v2_1' as const;
export const DIAGNOSIS_QUALITY_V2_SCHEMA_VERSION = 'diagnosis_quality_evaluation_v2' as const;
export const DIAGNOSIS_CALIBRATION_REPORT_SCHEMA_VERSION = 'diagnosis_calibration_report_v1' as const;

export type DiagnosisQualityPolicyVersion =
  | typeof DIAGNOSIS_QUALITY_POLICY_V2
  | typeof DIAGNOSIS_QUALITY_POLICY_V21;

export type RootCauseBoundaryCategory =
  | 'missing_evidence'
  | 'unsupported_inference'
  | 'incorrect_causal_relation'
  | 'incomplete_summary'
  | 'misread_key_detail'
  | 'expression_incomplete'
  | 'no_clear_deficit_in_current_response'
  | 'unknown';

export type RequiredFactBoundary = {
  factId: string;
  canonicalMeaning: string;
  acceptedExpressions: string[];
  required: boolean;
};

export type DiagnosisEvaluationAnnotationV2 = {
  sampleId: string;
  allowedMainAbilities: string[];
  allowedAnswerStatuses: OpenResponseAnswerStatus[];
  allowedRootCauseCategories: RootCauseBoundaryCategory[];
  requiredFacts: RequiredFactBoundary[];
  forbiddenClaims: string[];
  reviewerAgreement: DiagnosisReviewerAgreement;
  reviewerNotes: string[];
};

export type DiagnosisEvaluationAnnotationSetV2 = {
  annotationSetId: string;
  annotationVersion: string;
  protocolVersion: typeof DIAGNOSIS_ANNOTATION_PROTOCOL_V2;
  datasetId: string;
  datasetVersion: string;
  datasetContentModified: false;
  status: 'accepted';
  annotations: DiagnosisEvaluationAnnotationV2[];
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type TextAttributionSource =
  | 'student_exact_quote'
  | 'task_material_quote'
  | 'rubric_term'
  | 'reference_answer_term'
  | 'system_paraphrase';

export type TextAttribution = {
  fieldPath: string;
  text: string;
  source: TextAttributionSource;
  presentedAsStudentQuote: boolean;
  valid: boolean;
  reason: string;
};

export type DiagnosisAttributionEnvelope = {
  sampleId: string;
  runId: string;
  attributions: TextAttribution[];
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type DiagnosisCandidateSnapshot = {
  mainAbility: string;
  answerStatus?: string;
  rootCause: string;
  surfaceError: string;
  abilityEvidence: string[];
  diagnosisSummary: string;
};

export type ReviewAttribution =
  | 'confirmed_model_issue'
  | 'evaluator_false_positive'
  | 'annotation_boundary_issue'
  | 'mixed_issue'
  | 'insufficient_evidence';

export type ReviewRecommendedAction =
  | 'prompt_change'
  | 'policy_change'
  | 'dataset_change'
  | 'no_change'
  | 'further_review';

export type DiagnosisReviewFinding = {
  dimension:
    | 'main_ability'
    | 'answer_status'
    | 'root_cause'
    | 'required_fact'
    | 'quote_attribution'
    | 'boundary';
  attribution: ReviewAttribution;
  recommendedAction: ReviewRecommendedAction;
  reason: string;
};

export type DiagnosisQualityPolicyV2Input = {
  datasetVersion: string;
  annotationVersion: string;
  sampleId: string;
  runId: string;
  studentAnswer: string;
  readingText?: string;
  question: string;
  referenceAnswer?: string;
  rubricTerms: string[];
  candidate: DiagnosisCandidateSnapshot;
  annotation: DiagnosisEvaluationAnnotationV2;
  previousPolicyResult?: {
    qualityLevel: DiagnosisQualityLevel;
    failedDimensions: string[];
    violations: string[];
  };
  evaluatedAt: string;
};

export type DiagnosisQualityEvaluationV2 = {
  schemaVersion: typeof DIAGNOSIS_QUALITY_V2_SCHEMA_VERSION;
  policyVersion: DiagnosisQualityPolicyVersion;
  annotationVersion: string;
  datasetVersion: string;
  evaluationId: string;
  sampleId: string;
  runId: string;
  qualityLevel: DiagnosisQualityLevel;
  dimensions: {
    mainAbilityAccepted: boolean;
    answerStatusAccepted: boolean;
    rootCauseCategoryAccepted: boolean;
    requiredFactsPresent: boolean;
    quoteAttributionValid: boolean;
    noBoundaryOverreach: boolean;
    noCriticalHallucination: boolean;
  };
  detectedRootCauseCategories: RootCauseBoundaryCategory[];
  matchedFactIds: string[];
  missingFactIds: string[];
  attributionEnvelope: DiagnosisAttributionEnvelope;
  reviewFindings: DiagnosisReviewFinding[];
  limitations: string[];
  offlineDecision: 'accepted_candidate' | 'human_review' | 'blocked' | 'critical_alert';
  canBecomeFormalCandidate: boolean;
  evaluatedAt: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type DiagnosisBoundaryStability =
  | 'stable_within_boundary'
  | 'boundary_unstable'
  | 'critical_violation'
  | 'insufficient_runs';

export type DiagnosisQualityStability =
  | 'stable_accepted'
  | 'stable_questionable'
  | 'quality_unstable'
  | 'critical_violation'
  | 'insufficient_runs';

export type DiagnosisStabilityEvaluationV2 = {
  sampleId: string;
  runCount: number;
  boundaryStability: DiagnosisBoundaryStability;
  qualityStability: DiagnosisQualityStability;
  qualityLevels: DiagnosisQualityLevel[];
  mainAbilityWithinBoundary: boolean;
  answerStatusWithinBoundary: boolean;
  criticalRunCount: number;
  reasons: string[];
};

export type DiagnosisCalibrationReport = {
  schemaVersion: typeof DIAGNOSIS_CALIBRATION_REPORT_SCHEMA_VERSION;
  reportId: string;
  createdAt: string;
  sourceReportId: string;
  datasetVersion: string;
  annotationVersion: string;
  policyVersion: DiagnosisQualityPolicyVersion;
  promptVersion: string;
  provider: string;
  model: string;
  providerCallsMade: 0;
  candidateRunCount: number;
  sampleCount: number;
  qualityCounts: Record<DiagnosisQualityLevel, number>;
  boundaryStabilityCounts: Record<DiagnosisBoundaryStability, number>;
  qualityStabilityCounts: Record<DiagnosisQualityStability, number>;
  modelQuality: {
    mainAbility: MetricCount;
    answerStatus: MetricCount;
    rootCauseCategory: MetricCount;
    reasonableAlternativeAcceptance: MetricCount;
    conciseValidAcceptance: MetricCount;
  };
  evaluatorQuality: {
    falsePositiveFindingCount: number;
    confirmedModelIssueFindingCount: number;
    mixedIssueRunCount: number;
    humanReviewRunCount: number;
  };
  evaluations: DiagnosisQualityEvaluationV2[];
  stability: DiagnosisStabilityEvaluationV2[];
  conclusion: 'policy_calibration_pass' | 'policy_calibration_requires_review';
  limitations: string[];
};

export type MetricCount = {
  numerator: number;
  denominator: number;
  rate: number;
};
