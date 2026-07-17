import type { ConcreteLearningTask } from './concreteLearningTask.schema.ts';
import type { RealLLMDiagnosisRuntimeResult } from './diagnosisRunRecord.schema.ts';
import type { TaskExecutionResult } from './taskExecution.schema.ts';

export const DIAGNOSIS_EVALUATION_DATASET_SCHEMA_VERSION = 'diagnosis_evaluation_dataset_v1' as const;
export const DIAGNOSIS_QUALITY_EVALUATION_SCHEMA_VERSION = 'diagnosis_quality_evaluation_v1' as const;
export const DIAGNOSIS_QUALITY_POLICY_VERSION = 'diagnosis_quality_policy_v1' as const;
export const DIAGNOSIS_STABILITY_POLICY_VERSION = 'diagnosis_stability_policy_v1' as const;
export const DIAGNOSIS_PROMPT_REGRESSION_SCHEMA_VERSION = 'diagnosis_prompt_regression_v1' as const;
export const DIAGNOSIS_BATCH_REPORT_SCHEMA_VERSION = 'diagnosis_batch_report_v1' as const;

export type DiagnosisSampleCategory =
  | 'full_high_quality'
  | 'correct_insufficient_basis'
  | 'correct_judgement_wrong_explanation'
  | 'detail_correct_judgement_wrong'
  | 'partially_correct'
  | 'concise_valid'
  | 'reasonable_alternative'
  | 'colloquial_expression'
  | 'irrelevant'
  | 'copied_prompt_or_material'
  | 'unknown_placeholder'
  | 'prompt_injection';

export type DiagnosisValidityExpectation =
  | 'should_enter_diagnosis'
  | 'should_be_blocked_by_validity_gate'
  | 'boundary_stress_only';

export type DiagnosisReviewerAgreement = 'agreed' | 'partially_agreed' | 'disagreed';

export type HumanDiagnosisExpectedBoundaries = {
  allowedMainAbilities: string[];
  allowedAnswerStatuses: Array<'fully_meets' | 'partially_meets' | 'does_not_meet' | 'insufficient_evidence'>;
  requiredFacts: string[];
  acceptableRootCausePatterns: string[];
  optionalObservations: string[];
  forbiddenClaims: string[];
  forbiddenEvidenceClaims: string[];
  quotePolicy: {
    exactStudentQuotes: string[];
    paraphraseAllowed: boolean;
    inventedQuoteForbidden: true;
  };
  reviewerNotes: string[];
  reviewerAgreement: DiagnosisReviewerAgreement;
};

export type DiagnosisEvaluationSample = {
  sampleId: string;
  category: DiagnosisSampleCategory;
  targetAbilityId: string;
  deidentified: true;
  validityExpectation: DiagnosisValidityExpectation;
  concreteTask: ConcreteLearningTask;
  taskExecutionResult: TaskExecutionResult;
  expectedBoundaries: HumanDiagnosisExpectedBoundaries;
};

export type DiagnosisEvaluationDataset = {
  schemaVersion: typeof DIAGNOSIS_EVALUATION_DATASET_SCHEMA_VERSION;
  datasetId: string;
  datasetVersion: string;
  purpose: 'engineering_and_education_boundary_baseline';
  productConfidenceClaimed: false;
  frozenAt: string;
  sampleIds: string[];
  samples: DiagnosisEvaluationSample[];
};

export type DiagnosisDatasetValidationResult = {
  datasetId: string;
  datasetVersion: string;
  passed: boolean;
  sampleCount: number;
  categoryCounts: Record<string, number>;
  abilityCounts: Record<string, number>;
  issues: string[];
};

export type DiagnosisQualityLevel =
  | 'accepted'
  | 'questionable'
  | 'unacceptable'
  | 'critical_violation';

export type DiagnosisQualityDimensions = {
  providerOutputReceived: boolean;
  rawSchemaValid: boolean;
  postRepairSchemaValid: boolean;
  formalCandidateSchemaValid: boolean;
  mainAbilityAccepted: boolean;
  answerStatusAccepted: boolean;
  rootCauseAcceptable: boolean;
  requiredFactsPresent: boolean;
  studentQuoteFaithful: boolean;
  textEvidenceFaithful: boolean;
  invalidResponseHandledSafely: boolean;
  noBoundaryOverreach: boolean;
  noCriticalHallucination: boolean;
  semanticRepairSafe: boolean;
};

export type DiagnosisQualityEvaluationInput = {
  datasetVersion: string;
  sample: DiagnosisEvaluationSample;
  runtimeResult?: RealLLMDiagnosisRuntimeResult;
  rawSchemaValid: boolean;
  postRepairSchemaValid: boolean;
  evaluatedAt: string;
  evaluationRubricVersion: string;
};

export type DiagnosisQualityEvaluation = {
  schemaVersion: typeof DIAGNOSIS_QUALITY_EVALUATION_SCHEMA_VERSION;
  evaluationId: string;
  sampleId: string;
  requestId?: string;
  datasetVersion: string;
  promptVersion?: string;
  provider?: string;
  model?: string;
  qualityLevel: DiagnosisQualityLevel;
  dimensions: DiagnosisQualityDimensions;
  matchedFacts: string[];
  missingFacts: string[];
  violations: string[];
  limitations: string[];
  offlineDecision: 'accepted_candidate' | 'human_review' | 'blocked' | 'critical_alert';
  canBecomeFormalCandidate: boolean;
  evaluatedAt: string;
  policyVersion: typeof DIAGNOSIS_QUALITY_POLICY_VERSION;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type DiagnosisSampleStabilityStatus =
  | 'stable_accepted'
  | 'stable_questionable'
  | 'semantically_unstable'
  | 'critical_violation'
  | 'insufficient_runs';

export type DiagnosisSampleStabilityResult = {
  sampleId: string;
  runCount: number;
  status: DiagnosisSampleStabilityStatus;
  acceptedRunCount: number;
  questionableRunCount: number;
  unacceptableRunCount: number;
  criticalRunCount: number;
  mainAbilityStable: boolean;
  answerStatusStable: boolean;
  rootCauseWithinAcceptableBoundary: boolean;
  reasons: string[];
  policyVersion: typeof DIAGNOSIS_STABILITY_POLICY_VERSION;
};

export type DiagnosisQualityMetrics = {
  datasetVersion: string;
  promptVersion: string;
  provider: string;
  model: string;
  runCount: number;
  sampleCount: number;
  rawSchemaValidRate: number;
  postRepairSchemaValidRate: number;
  formalCandidateSchemaValidRate: number;
  mainAbilityAccuracy: number;
  answerStatusAccuracy: number;
  rootCauseAcceptability: number;
  studentQuoteFidelity: number;
  textEvidenceFidelity: number;
  semanticStabilityRate: number;
  samplesAcceptedAtLeastTwoOfThreeRate: number;
  samplesStableThreeOfThreeRate: number;
  samplesEverUnacceptableRate: number;
  criticalViolationCount: number;
  boundaryOverreachCount: number;
  invalidResponseWeaknessCount: number;
};

export type DiagnosisPromptRegressionRecommendation =
  | 'accept_candidate'
  | 'keep_baseline'
  | 'review_required';

export type DiagnosisPromptRegressionReport = {
  schemaVersion: typeof DIAGNOSIS_PROMPT_REGRESSION_SCHEMA_VERSION;
  reportId: string;
  baseline: DiagnosisQualityMetrics;
  candidate: DiagnosisQualityMetrics;
  recommendation: DiagnosisPromptRegressionRecommendation;
  regressions: string[];
  improvements: string[];
  validation: { passed: boolean; issues: string[] };
};

export type DiagnosisMetricDetail = {
  numerator: number;
  denominator: number;
  excludedCount: number;
  exclusionReasons: Record<string, number>;
  rate: number;
};

export type DiagnosisBatchRunOutcome =
  | 'validity_blocked'
  | 'provider_completed'
  | 'provider_failed';

export type DiagnosisBatchRunSummary = {
  sampleId: string;
  category: DiagnosisSampleCategory;
  targetAbilityId: string;
  runIndex: number;
  providerCallPlanned: boolean;
  outcome: DiagnosisBatchRunOutcome;
  runtimeStatus?: string;
  providerErrorCategory?: string;
  qualityLevel: DiagnosisQualityLevel;
  attemptCount: number;
  repairCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  failedDimensions: string[];
  matchedFacts: string[];
  missingFacts: string[];
  violations: string[];
  limitations: string[];
  candidateSnapshot?: {
    mainAbility: string;
    answerStatus?: string;
    rootCause: string;
    surfaceError: string;
    abilityEvidence: string[];
    diagnosisSummary: string;
  };
};

export type DiagnosisBatchReport = {
  schemaVersion: typeof DIAGNOSIS_BATCH_REPORT_SCHEMA_VERSION;
  reportId: string;
  createdAt: string;
  configuration: {
    reportPurpose: 'baseline' | 'manual_review_packet';
    datasetId: string;
    datasetVersion: string;
    datasetFrozenAt: string;
    provider: string;
    model: string;
    promptVersion: string;
    temperature: number;
    maxOutputTokens: number;
    maxAttempts: number;
    timeoutMs: number;
    repairPolicyVersion: string;
    executionMode: 'shadow';
    repetitions: number;
    sampleLimit: number;
    selectedSampleIds?: string[];
    maxProviderCalls: number;
    maxTotalTokens: number;
    maxProviderFailedRuns: number;
  };
  runSummary: {
    plannedLogicalRuns: number;
    plannedProviderCalls: number;
    completedLogicalRuns: number;
    completedProviderCalls: number;
    validityBlockedRuns: number;
    providerFailedRuns: number;
    qualityAcceptedRuns: number;
    qualityQuestionableRuns: number;
    qualityUnacceptableRuns: number;
    qualityCriticalRuns: number;
    abortedReason?: string;
  };
  providerSummary: {
    availability: DiagnosisMetricDetail;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalLatencyMs: number;
    averageLatencyMs: number;
    totalAttempts: number;
    retryCount: number;
    errorCategoryCounts: Record<string, number>;
  };
  qualityMetrics: DiagnosisQualityMetrics;
  metricDetails: Record<string, DiagnosisMetricDetail>;
  categoryDistribution: Record<string, number>;
  abilityDistribution: Record<string, number>;
  stabilityDistribution: Record<string, number>;
  failedRunIds: string[];
  manualReviewSampleIds: string[];
  acceptedAuditSampleIds: string[];
  runs: DiagnosisBatchRunSummary[];
  safety: {
    executionMode: 'shadow';
    evidenceCreated: false;
    profileUpdated: false;
    secretLogged: false;
    fullPromptLogged: false;
    rawOutputLogged: false;
  };
  baselineDecision: 'meets_automatic_thresholds' | 'requires_human_review' | 'blocked_by_critical_violation';
};

export function isDiagnosisQualityEvaluation(value: unknown): value is DiagnosisQualityEvaluation {
  if (!value || typeof value !== 'object') return false;
  const item = value as DiagnosisQualityEvaluation;
  return item.schemaVersion === DIAGNOSIS_QUALITY_EVALUATION_SCHEMA_VERSION &&
    isNonEmptyString(item.evaluationId) &&
    isNonEmptyString(item.sampleId) &&
    ['accepted', 'questionable', 'unacceptable', 'critical_violation'].includes(item.qualityLevel) &&
    isQualityDimensions(item.dimensions) &&
    Array.isArray(item.violations) &&
    Array.isArray(item.limitations) &&
    typeof item.canBecomeFormalCandidate === 'boolean' &&
    isIsoDate(item.evaluatedAt) &&
    typeof item.validation?.passed === 'boolean' &&
    Array.isArray(item.validation?.issues);
}

function isQualityDimensions(value: unknown): value is DiagnosisQualityDimensions {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).every((item) => typeof item === 'boolean') &&
    Object.keys(value).length === 14;
}

function isIsoDate(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
