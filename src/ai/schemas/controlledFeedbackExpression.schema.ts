import type { DiagnosisQualityEvaluationV2 } from './diagnosisQualityPolicyV2.schema.ts';
import type { RealLLMDiagnosisRuntimeResult } from './diagnosisRunRecord.schema.ts';
import type { StudentLearningFeedback } from './studentLearningFeedback.schema.ts';
import type { TaskEvidenceReturnResult } from './taskEvidenceReturn.schema.ts';

export const CONTROLLED_FEEDBACK_SCHEMA_VERSION = 'controlled_feedback_expression_v1' as const;
export const CONTROLLED_FEEDBACK_PROMPT_VERSION = 'controlled_feedback_expression_prompt_v1_1' as const;
export const CONTROLLED_FEEDBACK_TEMPLATE_VERSION = 'controlled_feedback_template_v1' as const;

export type FeedbackAdmissionLimitation =
  | 'not_individually_human_annotated'
  | 'limited_to_directly_traceable_facts';

export type FeedbackAdmissionDecision = {
  status: 'content_allowed' | 'review_required' | 'blocked';
  expressionScope: 'full' | 'restricted' | 'system_notice' | 'none';
  basis: 'annotated_quality_evaluation' | 'formal_runtime_evidence_return';
  qualityLevel?: 'accepted' | 'questionable' | 'unacceptable' | 'critical_violation';
  sourceLinks: string[];
  limitations: FeedbackAdmissionLimitation[];
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type FeedbackFactSourceType =
  | 'student_exact_quote'
  | 'diagnosis_confirmed_fact'
  | 'evidence_confirmed_fact';

export type StructuredFeedbackFact = {
  factId: string;
  factType: 'student_statement' | 'observed_strength' | 'observed_attention_point';
  text: string;
  safeExpressions: string[];
  sourceType: FeedbackFactSourceType;
  sourceLinks: string[];
  exactQuote?: {
    text: string;
    start: number;
    end: number;
  };
};

export type StructuredFeedbackFacts = {
  factsId: string;
  feedbackRequestId: string;
  learningRoundId: string;
  studentId: string;
  taskId: string;
  responseId: string;
  formalDiagnosisId: string;
  studentStatements: StructuredFeedbackFact[];
  observedStrengths: StructuredFeedbackFact[];
  observedAttentionPoints: StructuredFeedbackFact[];
  validation: {
    passed: boolean;
    identityAligned: boolean;
    quoteSpansValid: boolean;
    sourceLinksComplete: boolean;
    issues: string[];
  };
};

export type ActionableSuggestion = {
  suggestionId: string;
  text: string;
  sourceType: 'diagnosis_next_training' | 'learning_round_next_step' | 'deterministic_feedback_rule';
  sourceLinks: string[];
};

export type FeedbackExpressionConfigSnapshot = {
  configId: string;
  provider: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxAttempts: number;
  expressionPolicy: 'deterministic_only' | 'llm_enhanced';
  promptVersion: string;
  schemaVersion: typeof CONTROLLED_FEEDBACK_SCHEMA_VERSION;
  templateVersion: string;
  createdAt: string;
};

export type FeedbackExpressionClaimBinding = {
  fieldPath: string;
  renderedText: string;
  factIds: string[];
  suggestionIds: string[];
};

export type FeedbackExpressionCandidate = {
  headline: string;
  summary: string;
  whatYouDidWell: string[];
  whatNeedsAttention: string[];
  nextActionText: string;
  usedFactIds: string[];
  usedSuggestionIds: string[];
  claimBindings: FeedbackExpressionClaimBinding[];
};

export type FeedbackExpressionValidation = {
  passed: boolean;
  checks: {
    schemaValid: boolean;
    identityAligned: boolean;
    allFactIdsExist: boolean;
    allClaimsWithinFactBoundary: boolean;
    studentQuotesExact: boolean;
    noInventedPositiveClaim: boolean;
    noInventedDeficitClaim: boolean;
    noLongTermAbilityClaim: boolean;
    noInternalFieldLeakage: boolean;
    noPromptLeakage: boolean;
    suggestionsSourceBound: boolean;
  };
  issues: string[];
};

export type ControlledFeedbackStatus =
  | 'feedback_ready'
  | 'template_baseline'
  | 'template_fallback'
  | 'review_required'
  | 'blocked';

export type ControlledFeedbackResult = {
  schemaVersion: typeof CONTROLLED_FEEDBACK_SCHEMA_VERSION;
  feedbackRequestId: string;
  learningRoundId: string;
  studentId: string;
  status: ControlledFeedbackStatus;
  expressionMode: 'llm' | 'deterministic_template' | 'system_notice';
  admissionDecision: FeedbackAdmissionDecision;
  structuredFacts?: StructuredFeedbackFacts;
  suggestions: ActionableSuggestion[];
  expressionCandidate?: FeedbackExpressionCandidate;
  expressionValidation: FeedbackExpressionValidation;
  baselineFeedback: StudentLearningFeedback;
  enhancedFeedback?: StudentLearningFeedback;
  finalFeedback: StudentLearningFeedback;
  finalSelection: 'deterministic_template' | 'llm_enhanced';
  studentLearningFeedback: StudentLearningFeedback;
  providerRunRef?: string;
  fallbackReason?: string;
  validation: {
    passed: boolean;
    issues: string[];
  };
};

export type ControlledFeedbackExpressionInput = {
  feedbackRequestId: string;
  learningRoundId: string;
  studentId: string;
  taskId: string;
  executionSessionId: string;
  responseId: string;
  studentResponseText: string;
  realDiagnosisRuntimeResult: RealLLMDiagnosisRuntimeResult;
  diagnosisQualityEvaluation?: DiagnosisQualityEvaluationV2;
  taskEvidenceReturnResult: TaskEvidenceReturnResult;
  expressionConfig: FeedbackExpressionConfigSnapshot;
  requestedAt: string;
};

export function isFeedbackExpressionConfigSnapshot(
  value: unknown,
): value is FeedbackExpressionConfigSnapshot {
  if (!value || typeof value !== 'object') return false;
  const config = value as FeedbackExpressionConfigSnapshot;
  return (
    isNonEmptyString(config.configId) &&
    isNonEmptyString(config.provider) &&
    isNonEmptyString(config.model) &&
    typeof config.temperature === 'number' &&
    config.temperature >= 0 &&
    config.temperature <= 2 &&
    Number.isInteger(config.maxOutputTokens) &&
    config.maxOutputTokens > 0 &&
    Number.isInteger(config.timeoutMs) &&
    config.timeoutMs > 0 &&
    Number.isInteger(config.maxAttempts) &&
    config.maxAttempts > 0 &&
    ['deterministic_only', 'llm_enhanced'].includes(config.expressionPolicy) &&
    isNonEmptyString(config.promptVersion) &&
    config.schemaVersion === CONTROLLED_FEEDBACK_SCHEMA_VERSION &&
    isNonEmptyString(config.templateVersion) &&
    isIsoDate(config.createdAt)
  );
}

export function isStructuredFeedbackFacts(value: unknown): value is StructuredFeedbackFacts {
  if (!value || typeof value !== 'object') return false;
  const facts = value as StructuredFeedbackFacts;
  return (
    isNonEmptyString(facts.factsId) &&
    isNonEmptyString(facts.feedbackRequestId) &&
    isNonEmptyString(facts.learningRoundId) &&
    isNonEmptyString(facts.studentId) &&
    isNonEmptyString(facts.taskId) &&
    isNonEmptyString(facts.responseId) &&
    isNonEmptyString(facts.formalDiagnosisId) &&
    Array.isArray(facts.studentStatements) && facts.studentStatements.every(isStructuredFact) &&
    Array.isArray(facts.observedStrengths) && facts.observedStrengths.every(isStructuredFact) &&
    Array.isArray(facts.observedAttentionPoints) && facts.observedAttentionPoints.every(isStructuredFact) &&
    typeof facts.validation?.passed === 'boolean' &&
    typeof facts.validation?.identityAligned === 'boolean' &&
    typeof facts.validation?.quoteSpansValid === 'boolean' &&
    typeof facts.validation?.sourceLinksComplete === 'boolean' &&
    Array.isArray(facts.validation?.issues)
  );
}

export function isControlledFeedbackResult(value: unknown): value is ControlledFeedbackResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as ControlledFeedbackResult;
  return (
    result.schemaVersion === CONTROLLED_FEEDBACK_SCHEMA_VERSION &&
    isNonEmptyString(result.feedbackRequestId) &&
    isNonEmptyString(result.learningRoundId) &&
    isNonEmptyString(result.studentId) &&
    ['feedback_ready', 'template_baseline', 'template_fallback', 'review_required', 'blocked'].includes(result.status) &&
    ['llm', 'deterministic_template', 'system_notice'].includes(result.expressionMode) &&
    Array.isArray(result.suggestions) &&
    result.suggestions.every(isActionableSuggestion) &&
    typeof result.expressionValidation?.passed === 'boolean' &&
    stableEqual(result.finalFeedback, result.studentLearningFeedback) &&
    ['deterministic_template', 'llm_enhanced'].includes(result.finalSelection) &&
    typeof result.validation?.passed === 'boolean' &&
    Array.isArray(result.validation?.issues)
  );
}

function isStructuredFact(value: unknown): value is StructuredFeedbackFact {
  if (!value || typeof value !== 'object') return false;
  const fact = value as StructuredFeedbackFact;
  return (
    isNonEmptyString(fact.factId) &&
    ['student_statement', 'observed_strength', 'observed_attention_point'].includes(fact.factType) &&
    isNonEmptyString(fact.text) &&
    Array.isArray(fact.safeExpressions) && fact.safeExpressions.length > 0 && fact.safeExpressions.every(isNonEmptyString) &&
    ['student_exact_quote', 'diagnosis_confirmed_fact', 'evidence_confirmed_fact'].includes(fact.sourceType) &&
    Array.isArray(fact.sourceLinks) && fact.sourceLinks.length > 0 && fact.sourceLinks.every(isNonEmptyString)
  );
}

function isActionableSuggestion(value: unknown): value is ActionableSuggestion {
  if (!value || typeof value !== 'object') return false;
  const suggestion = value as ActionableSuggestion;
  return (
    isNonEmptyString(suggestion.suggestionId) &&
    isNonEmptyString(suggestion.text) &&
    ['diagnosis_next_training', 'learning_round_next_step', 'deterministic_feedback_rule'].includes(suggestion.sourceType) &&
    Array.isArray(suggestion.sourceLinks) && suggestion.sourceLinks.length > 0 && suggestion.sourceLinks.every(isNonEmptyString)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: unknown): boolean {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function stableEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortValue(left)) === JSON.stringify(sortValue(right));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortValue(item)]),
  );
}
