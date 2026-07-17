import {
  buildActionableSuggestions,
  buildStructuredFeedbackFacts,
} from './structuredFeedbackFactsAgent.ts';
import { buildControlledFeedbackExpressionPrompt } from '../prompts/buildControlledFeedbackExpressionPrompt.ts';
import type { DiagnosisProviderAdapter } from '../providers/diagnosisProviderAdapter.ts';
import type { ControlledFeedbackRepository } from '../repositories/controlledFeedbackRepository.ts';
import {
  CONTROLLED_FEEDBACK_PROMPT_VERSION,
  CONTROLLED_FEEDBACK_SCHEMA_VERSION,
  CONTROLLED_FEEDBACK_TEMPLATE_VERSION,
  isFeedbackExpressionConfigSnapshot,
  type ActionableSuggestion,
  type ControlledFeedbackExpressionInput,
  type ControlledFeedbackResult,
  type FeedbackAdmissionDecision,
  type FeedbackExpressionCandidate,
  type FeedbackExpressionConfigSnapshot,
  type FeedbackExpressionValidation,
  type StructuredFeedbackFact,
  type StructuredFeedbackFacts,
} from '../schemas/controlledFeedbackExpression.schema.ts';
import { DIAGNOSIS_QUALITY_POLICY_V21 } from '../schemas/diagnosisQualityPolicyV2.schema.ts';
import type { StudentLearningFeedback } from '../schemas/studentLearningFeedback.schema.ts';

const LONG_TERM_CLAIM_PATTERN = /已经掌握|长期掌握|稳定提升|能力很差|能力退化|永久|天生/;
const INTERNAL_FIELD_PATTERN = /evidenceType|confidence|provider|prompt|schema|raw\s*json|internal\s*id|formalDiagnosisId/i;
const PROMPT_LEAK_PATTERN = /system prompt|系统提示词|Prompt Version|<feedback_data>/i;

export type ControlledFeedbackExpressionDependencies = {
  repository: ControlledFeedbackRepository;
  provider?: DiagnosisProviderAdapter;
};

export function createFeedbackExpressionConfigSnapshot(input: {
  configId?: string;
  provider?: string;
  model?: string;
  expressionPolicy?: 'deterministic_only' | 'llm_enhanced';
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  promptVersion?: string;
  templateVersion?: string;
  createdAt?: string;
} = {}): FeedbackExpressionConfigSnapshot {
  const expressionPolicy = input.expressionPolicy || 'deterministic_only';
  const provider = input.provider || (expressionPolicy === 'deterministic_only' ? 'none' : 'scripted');
  const model = input.model || (expressionPolicy === 'deterministic_only' ? 'deterministic-template' : 'controlled-feedback-model');
  return {
    configId: input.configId || `feedback-config-${expressionPolicy}-${sanitizeId(model)}`,
    provider,
    model,
    temperature: input.temperature ?? 0.1,
    maxOutputTokens: input.maxOutputTokens ?? 600,
    timeoutMs: input.timeoutMs ?? 12_000,
    maxAttempts: input.maxAttempts ?? 1,
    expressionPolicy,
    promptVersion: input.promptVersion || CONTROLLED_FEEDBACK_PROMPT_VERSION,
    schemaVersion: CONTROLLED_FEEDBACK_SCHEMA_VERSION,
    templateVersion: input.templateVersion || CONTROLLED_FEEDBACK_TEMPLATE_VERSION,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export async function runControlledFeedbackExpression(
  input: ControlledFeedbackExpressionInput,
  dependencies: ControlledFeedbackExpressionDependencies,
): Promise<ControlledFeedbackResult> {
  const existing = await dependencies.repository.getByRequestId(input.feedbackRequestId);
  if (existing) return existing;

  const admissionDecision = buildFeedbackAdmissionDecision(input);
  if (admissionDecision.status !== 'content_allowed') {
    return commitResult(
      buildNoticeResult(input, admissionDecision),
      dependencies.repository,
    );
  }

  const structuredFacts = buildStructuredFeedbackFacts({ request: input, admissionDecision });
  const suggestions = buildActionableSuggestions({ request: input, admissionDecision });
  if (!structuredFacts.validation.passed) {
    const blockedAdmission: FeedbackAdmissionDecision = {
      ...admissionDecision,
      status: 'blocked',
      expressionScope: 'none',
      validation: {
        passed: false,
        issues: [...admissionDecision.validation.issues, ...structuredFacts.validation.issues],
      },
    };
    return commitResult(buildNoticeResult(input, blockedAdmission), dependencies.repository);
  }

  const baselineFeedback = buildDeterministicFeedback(
    input,
    admissionDecision,
    structuredFacts,
    suggestions,
  );
  const baselineValidation = validBaselineValidation();

  if (
    input.expressionConfig.expressionPolicy === 'deterministic_only' ||
    !dependencies.provider
  ) {
    const result = buildContentResult({
      input,
      admissionDecision,
      structuredFacts,
      suggestions,
      baselineFeedback,
      expressionValidation: baselineValidation,
      status: 'template_baseline',
      expressionMode: 'deterministic_template',
      finalSelection: 'deterministic_template',
      finalFeedback: baselineFeedback,
      fallbackReason: dependencies.provider || input.expressionConfig.expressionPolicy === 'deterministic_only'
        ? undefined
        : 'expression_provider_missing',
    });
    return commitResult(result, dependencies.repository);
  }

  const prompt = buildControlledFeedbackExpressionPrompt({
    admissionDecision,
    facts: structuredFacts,
    suggestions,
  });
  let fallbackReason = 'expression_retry_exhausted';
  const providerRequestIds: string[] = [];

  for (let attempt = 1; attempt <= input.expressionConfig.maxAttempts; attempt += 1) {
    try {
      const response = await dependencies.provider.diagnose({
        requestId: input.feedbackRequestId,
        attempt,
        prompt,
        model: input.expressionConfig.model,
        temperature: input.expressionConfig.temperature,
        maxOutputTokens: input.expressionConfig.maxOutputTokens,
        timeoutMs: input.expressionConfig.timeoutMs,
      });
      providerRequestIds.push(response.providerRequestId);
      const candidate = parseFeedbackCandidate(response.rawOutput);
      if (!candidate) {
        fallbackReason = 'malformed_expression_output';
        continue;
      }
      const validation = validateFeedbackExpressionCandidate({
        candidate,
        facts: structuredFacts,
        suggestions,
        studentResponseText: input.studentResponseText,
      });
      if (!validation.passed) {
        fallbackReason = validation.issues[0] || 'expression_boundary_validation_failed';
        continue;
      }

      const enhancedFeedback = mapCandidateToFeedback(input, candidate);
      const result = buildContentResult({
        input,
        admissionDecision,
        structuredFacts,
        suggestions,
        baselineFeedback,
        enhancedFeedback,
        expressionCandidate: candidate,
        expressionValidation: validation,
        status: 'feedback_ready',
        expressionMode: 'llm',
        finalSelection: 'llm_enhanced',
        finalFeedback: enhancedFeedback,
        providerRunRef: `${dependencies.provider.providerName}:${providerRequestIds.join(',')}`,
      });
      return commitResult(result, dependencies.repository);
    } catch {
      fallbackReason = 'expression_provider_failed';
    }
  }

  const fallback = buildContentResult({
    input,
    admissionDecision,
    structuredFacts,
    suggestions,
    baselineFeedback,
    expressionValidation: failedExpressionValidation(fallbackReason),
    status: 'template_fallback',
    expressionMode: 'deterministic_template',
    finalSelection: 'deterministic_template',
    finalFeedback: baselineFeedback,
    providerRunRef: providerRequestIds.length > 0
      ? `${dependencies.provider.providerName}:${providerRequestIds.join(',')}`
      : undefined,
    fallbackReason,
  });
  return commitResult(fallback, dependencies.repository);
}

export function buildFeedbackAdmissionDecision(
  input: ControlledFeedbackExpressionInput,
): FeedbackAdmissionDecision {
  const issues = validateAdmissionInput(input);
  const baseLinks = [
    `diagnosis-run:${input.realDiagnosisRuntimeResult.runRecord.runId}`,
    `evidence-return:${input.taskEvidenceReturnResult.returnId}`,
  ];

  if (issues.length > 0) {
    return {
      status: 'blocked',
      expressionScope: 'none',
      basis: input.diagnosisQualityEvaluation
        ? 'annotated_quality_evaluation'
        : 'formal_runtime_evidence_return',
      qualityLevel: input.diagnosisQualityEvaluation?.qualityLevel,
      sourceLinks: baseLinks,
      limitations: [],
      validation: { passed: false, issues },
    };
  }

  const quality = input.diagnosisQualityEvaluation;
  if (!quality) {
    return {
      status: 'content_allowed',
      expressionScope: 'restricted',
      basis: 'formal_runtime_evidence_return',
      sourceLinks: baseLinks,
      limitations: [
        'not_individually_human_annotated',
        'limited_to_directly_traceable_facts',
      ],
      validation: { passed: true, issues: [] },
    };
  }

  const sourceLinks = [...baseLinks, `quality-evaluation:${quality.evaluationId}`];
  if (quality.qualityLevel === 'accepted' && quality.offlineDecision === 'accepted_candidate' && quality.canBecomeFormalCandidate) {
    return {
      status: 'content_allowed',
      expressionScope: 'full',
      basis: 'annotated_quality_evaluation',
      qualityLevel: 'accepted',
      sourceLinks,
      limitations: [],
      validation: { passed: true, issues: [] },
    };
  }
  if (quality.qualityLevel === 'questionable') {
    return {
      status: 'review_required',
      expressionScope: 'system_notice',
      basis: 'annotated_quality_evaluation',
      qualityLevel: 'questionable',
      sourceLinks,
      limitations: [],
      validation: { passed: true, issues: [] },
    };
  }
  return {
    status: 'blocked',
    expressionScope: 'none',
    basis: 'annotated_quality_evaluation',
    qualityLevel: quality.qualityLevel,
    sourceLinks,
    limitations: [],
    validation: { passed: true, issues: [] },
  };
}

export function validateFeedbackExpressionCandidate(input: {
  candidate: FeedbackExpressionCandidate;
  facts: StructuredFeedbackFacts;
  suggestions: ActionableSuggestion[];
  studentResponseText: string;
}): FeedbackExpressionValidation {
  const { candidate, facts, suggestions } = input;
  const issues: string[] = [];
  const allFacts = [...facts.studentStatements, ...facts.observedStrengths, ...facts.observedAttentionPoints];
  const factMap = new Map(allFacts.map((fact) => [fact.factId, fact]));
  const suggestionMap = new Map(suggestions.map((item) => [item.suggestionId, item]));
  const schemaValid = isFeedbackCandidateShape(candidate);
  if (!schemaValid) issues.push('Feedback expression candidate schema is invalid.');

  const referencedFactIds = new Set([
    ...candidate.usedFactIds,
    ...candidate.claimBindings.flatMap((binding) => binding.factIds),
  ]);
  const referencedSuggestionIds = new Set([
    ...candidate.usedSuggestionIds,
    ...candidate.claimBindings.flatMap((binding) => binding.suggestionIds),
  ]);
  const allFactIdsExist = [...referencedFactIds].every((id) => factMap.has(id));
  if (!allFactIdsExist) issues.push('Feedback candidate references an unknown factId.');
  const suggestionsSourceBound = [...referencedSuggestionIds].every((id) => suggestionMap.has(id)) &&
    suggestions.some((item) => item.text === candidate.nextActionText);
  if (!suggestionsSourceBound) issues.push('Feedback next action is not bound to a known suggestion.');

  const expectedBindings = [
    ...candidate.whatYouDidWell.map((text, index) => ({ fieldPath: `whatYouDidWell[${index}]`, text, factType: 'observed_strength' })),
    ...candidate.whatNeedsAttention.map((text, index) => ({ fieldPath: `whatNeedsAttention[${index}]`, text, factType: 'observed_attention_point' })),
  ];
  const contentBindingsValid = expectedBindings.every((expected) => {
    const binding = candidate.claimBindings.find((item) => item.fieldPath === expected.fieldPath && item.renderedText === expected.text);
    if (!binding || binding.factIds.length === 0 || binding.suggestionIds.length > 0) return false;
    return binding.factIds.every((id) => {
      const fact = factMap.get(id);
      return fact?.factType === expected.factType && fact.safeExpressions.includes(expected.text);
    });
  });
  const nextActionBinding = candidate.claimBindings.some((binding) =>
    binding.fieldPath === 'nextActionText' &&
    binding.renderedText === candidate.nextActionText &&
    binding.factIds.length === 0 &&
    binding.suggestionIds.some((id) => suggestionMap.get(id)?.text === candidate.nextActionText));
  const fixedTextValid = candidate.headline === '反馈' && candidate.summary === '下面是根据本次回答整理的反馈。';
  const allClaimsWithinFactBoundary = contentBindingsValid && nextActionBinding && fixedTextValid;
  if (!allClaimsWithinFactBoundary) issues.push('Feedback claim expands or escapes its bound fact or suggestion.');

  const studentQuotesExact = extractPresentedStudentQuotes(candidate).every((quote) => input.studentResponseText.includes(quote));
  if (!studentQuotesExact) issues.push('Feedback presents text as a student quote that is not exact.');
  const aggregate = JSON.stringify(candidate);
  const noLongTermAbilityClaim = !LONG_TERM_CLAIM_PATTERN.test(aggregate);
  if (!noLongTermAbilityClaim) issues.push('Feedback contains a forbidden long-term ability claim.');
  const noInternalFieldLeakage = !INTERNAL_FIELD_PATTERN.test([
    candidate.headline,
    candidate.summary,
    ...candidate.whatYouDidWell,
    ...candidate.whatNeedsAttention,
    candidate.nextActionText,
  ].join('\n'));
  if (!noInternalFieldLeakage) issues.push('Feedback exposes an internal Runtime field.');
  const noPromptLeakage = !PROMPT_LEAK_PATTERN.test(aggregate);
  if (!noPromptLeakage) issues.push('Feedback exposes Prompt content.');
  const noInventedPositiveClaim = candidate.whatYouDidWell.every((text) =>
    facts.observedStrengths.some((fact) => fact.safeExpressions.includes(text)));
  const noInventedDeficitClaim = candidate.whatNeedsAttention.every((text) =>
    facts.observedAttentionPoints.some((fact) => fact.safeExpressions.includes(text)));

  return {
    passed: schemaValid &&
      allFactIdsExist &&
      allClaimsWithinFactBoundary &&
      studentQuotesExact &&
      noInventedPositiveClaim &&
      noInventedDeficitClaim &&
      noLongTermAbilityClaim &&
      noInternalFieldLeakage &&
      noPromptLeakage &&
      suggestionsSourceBound,
    checks: {
      schemaValid,
      identityAligned: facts.validation.identityAligned,
      allFactIdsExist,
      allClaimsWithinFactBoundary,
      studentQuotesExact,
      noInventedPositiveClaim,
      noInventedDeficitClaim,
      noLongTermAbilityClaim,
      noInternalFieldLeakage,
      noPromptLeakage,
      suggestionsSourceBound,
    },
    issues,
  };
}

function validateAdmissionInput(input: ControlledFeedbackExpressionInput): string[] {
  const issues: string[] = [];
  const runtime = input.realDiagnosisRuntimeResult;
  const commit = runtime.formalDiagnosisCommit;
  const evidenceReturn = input.taskEvidenceReturnResult;
  if (!isFeedbackExpressionConfigSnapshot(input.expressionConfig)) issues.push('Feedback expression config is invalid.');
  if (input.expressionConfig.promptVersion !== CONTROLLED_FEEDBACK_PROMPT_VERSION) {
    issues.push('Feedback Prompt version does not match the implemented Prompt Builder.');
  }
  if (input.expressionConfig.templateVersion !== CONTROLLED_FEEDBACK_TEMPLATE_VERSION) {
    issues.push('Feedback template version does not match the implemented template.');
  }
  if (runtime.status !== 'formal_result_committed') issues.push('Real Diagnosis Runtime is not formally committed.');
  if (runtime.formalizationStatus !== 'committed' || commit?.status !== 'committed' || !commit.diagnosisResult) {
    issues.push('Committed Formal Diagnosis is missing.');
  }
  if (evidenceReturn.status !== 'evidence_returned' || !evidenceReturn.validation.passed) {
    issues.push('Task Evidence Return is not formally completed.');
  }
  const run = runtime.runRecord;
  const checks = [
    [run.studentId, input.studentId, 'studentId'],
    [run.taskId, input.taskId, 'taskId'],
    [run.executionSessionId, input.executionSessionId, 'executionSessionId'],
    [run.responseId, input.responseId, 'responseId'],
    [evidenceReturn.studentId, input.studentId, 'evidenceReturn.studentId'],
    [evidenceReturn.taskId, input.taskId, 'evidenceReturn.taskId'],
    [evidenceReturn.executionSessionId, input.executionSessionId, 'evidenceReturn.executionSessionId'],
    [evidenceReturn.responseId || '', input.responseId, 'evidenceReturn.responseId'],
  ];
  for (const [actual, expected, label] of checks) {
    if (actual !== expected) issues.push(`${label} mismatch.`);
  }
  const formalResponse = evidenceReturn.taskExecutionResult.studentResponse;
  if (!formalResponse || formalResponse.responseId !== input.responseId) {
    issues.push('Formal StudentResponse is missing or mismatched.');
  } else if (formalResponse.answerText !== input.studentResponseText) {
    issues.push('studentResponseText does not match the Formal StudentResponse.');
  }
  if (commit && !evidenceReturn.evidenceTraceLinks.some((link) =>
    link.diagnosisResultId === commit.formalDiagnosisId &&
    link.taskId === input.taskId &&
    link.executionSessionId === input.executionSessionId &&
    link.responseId === input.responseId)) {
    issues.push('Evidence trace does not include the committed Formal Diagnosis.');
  }
  if (commit && evidenceReturn.diagnosisResultId !== commit.formalDiagnosisId) {
    issues.push('Task Evidence Return diagnosisResultId does not match the committed Formal Diagnosis.');
  }
  if (commit) {
    for (const evidence of evidenceReturn.abilityEvidence) {
      if (evidence.studentId !== input.studentId) issues.push(`AbilityEvidence ${evidence.id} studentId mismatch.`);
      if (evidence.taskId !== input.taskId) issues.push(`AbilityEvidence ${evidence.id} taskId mismatch.`);
      if (evidence.diagnosisId !== commit.formalDiagnosisId) {
        issues.push(`AbilityEvidence ${evidence.id} diagnosisId mismatch.`);
      }
    }
  }
  const quality = input.diagnosisQualityEvaluation;
  if (quality) {
    if (quality.policyVersion !== DIAGNOSIS_QUALITY_POLICY_V21) issues.push('Diagnosis Quality Policy is not v2.1.');
    if (!quality.validation.passed) issues.push('Diagnosis Quality Evaluation validation failed.');
    if (quality.runId !== run.runId) issues.push('Diagnosis Quality Evaluation runId mismatch.');
  }
  return issues;
}

function buildNoticeResult(
  input: ControlledFeedbackExpressionInput,
  admissionDecision: FeedbackAdmissionDecision,
): ControlledFeedbackResult {
  const review = admissionDecision.status === 'review_required';
  const feedback: StudentLearningFeedback = {
    learningRoundId: input.learningRoundId,
    studentId: input.studentId,
    stage: 'result',
    resultStatus: review ? 'review_required' : 'blocked',
    headline: review ? '这次结果需要进一步确认' : '这次反馈暂时无法生成',
    summary: review
      ? '这次回答已经记录，系统需要进一步确认。本次结果暂时不会用于形成能力判断。'
      : '这次结果没有通过必要校验，系统不会据此生成能力反馈。',
    whatYouDidWell: [],
    whatNeedsAttention: [],
    nextActionText: review ? '可以先结束本轮，等待确认后再继续。' : '可以稍后重试或联系老师确认。',
    canRetry: !review,
    canFinishRound: true,
    source: 'evidence_return',
  };
  const validation = failedExpressionValidation(admissionDecision.validation.issues[0] || admissionDecision.status);
  return {
    schemaVersion: CONTROLLED_FEEDBACK_SCHEMA_VERSION,
    feedbackRequestId: input.feedbackRequestId,
    learningRoundId: input.learningRoundId,
    studentId: input.studentId,
    status: review ? 'review_required' : 'blocked',
    expressionMode: 'system_notice',
    admissionDecision,
    suggestions: [],
    expressionValidation: validation,
    baselineFeedback: feedback,
    finalFeedback: feedback,
    finalSelection: 'deterministic_template',
    studentLearningFeedback: feedback,
    fallbackReason: admissionDecision.validation.issues[0],
    validation: { passed: admissionDecision.validation.passed, issues: admissionDecision.validation.issues },
  };
}

function buildDeterministicFeedback(
  input: ControlledFeedbackExpressionInput,
  admissionDecision: FeedbackAdmissionDecision,
  facts: StructuredFeedbackFacts,
  suggestions: ActionableSuggestion[],
): StudentLearningFeedback {
  const whatYouDidWell = facts.observedStrengths.map((fact) => fact.safeExpressions[0]).filter(Boolean);
  const whatNeedsAttention = facts.observedAttentionPoints.map((fact) => fact.safeExpressions[0]).filter(Boolean);
  return {
    learningRoundId: input.learningRoundId,
    studentId: input.studentId,
    stage: 'result',
    resultStatus: 'completed',
    headline: '反馈',
    summary: admissionDecision.expressionScope === 'restricted'
      ? '下面是根据本次正式记录整理的受限反馈。'
      : '下面是根据本次回答整理的反馈。',
    whatYouDidWell,
    whatNeedsAttention,
    nextActionText: suggestions[0]?.text || '可以按本轮学习安排继续下一步。',
    canRetry: false,
    canFinishRound: true,
    source: 'evidence_return',
  };
}

function mapCandidateToFeedback(
  input: ControlledFeedbackExpressionInput,
  candidate: FeedbackExpressionCandidate,
): StudentLearningFeedback {
  return {
    learningRoundId: input.learningRoundId,
    studentId: input.studentId,
    stage: 'result',
    resultStatus: 'completed',
    headline: candidate.headline,
    summary: candidate.summary,
    whatYouDidWell: candidate.whatYouDidWell,
    whatNeedsAttention: candidate.whatNeedsAttention,
    nextActionText: candidate.nextActionText,
    canRetry: false,
    canFinishRound: true,
    source: 'evidence_return',
  };
}

function buildContentResult(input: {
  input: ControlledFeedbackExpressionInput;
  admissionDecision: FeedbackAdmissionDecision;
  structuredFacts: StructuredFeedbackFacts;
  suggestions: ActionableSuggestion[];
  baselineFeedback: StudentLearningFeedback;
  enhancedFeedback?: StudentLearningFeedback;
  expressionCandidate?: FeedbackExpressionCandidate;
  expressionValidation: FeedbackExpressionValidation;
  status: ControlledFeedbackResult['status'];
  expressionMode: ControlledFeedbackResult['expressionMode'];
  finalSelection: ControlledFeedbackResult['finalSelection'];
  finalFeedback: StudentLearningFeedback;
  providerRunRef?: string;
  fallbackReason?: string;
}): ControlledFeedbackResult {
  return {
    schemaVersion: CONTROLLED_FEEDBACK_SCHEMA_VERSION,
    feedbackRequestId: input.input.feedbackRequestId,
    learningRoundId: input.input.learningRoundId,
    studentId: input.input.studentId,
    status: input.status,
    expressionMode: input.expressionMode,
    admissionDecision: input.admissionDecision,
    structuredFacts: input.structuredFacts,
    suggestions: input.suggestions,
    expressionCandidate: input.expressionCandidate,
    expressionValidation: input.expressionValidation,
    baselineFeedback: input.baselineFeedback,
    enhancedFeedback: input.enhancedFeedback,
    finalFeedback: input.finalFeedback,
    finalSelection: input.finalSelection,
    studentLearningFeedback: input.finalFeedback,
    providerRunRef: input.providerRunRef,
    fallbackReason: input.fallbackReason,
    validation: {
      passed: input.admissionDecision.validation.passed && input.structuredFacts.validation.passed,
      issues: [...input.admissionDecision.validation.issues, ...input.structuredFacts.validation.issues],
    },
  };
}

async function commitResult(
  result: ControlledFeedbackResult,
  repository: ControlledFeedbackRepository,
): Promise<ControlledFeedbackResult> {
  const write = await repository.commit(result);
  return write.result;
}

function parseFeedbackCandidate(rawOutput: string): FeedbackExpressionCandidate | null {
  const trimmed = rawOutput.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isFeedbackCandidateShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isFeedbackCandidateShape(value: unknown): value is FeedbackExpressionCandidate {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as FeedbackExpressionCandidate;
  return (
    typeof candidate.headline === 'string' &&
    typeof candidate.summary === 'string' &&
    Array.isArray(candidate.whatYouDidWell) && candidate.whatYouDidWell.every(isString) &&
    Array.isArray(candidate.whatNeedsAttention) && candidate.whatNeedsAttention.every(isString) &&
    typeof candidate.nextActionText === 'string' &&
    Array.isArray(candidate.usedFactIds) && candidate.usedFactIds.every(isString) &&
    Array.isArray(candidate.usedSuggestionIds) && candidate.usedSuggestionIds.every(isString) &&
    Array.isArray(candidate.claimBindings) && candidate.claimBindings.every((binding) =>
      binding &&
      typeof binding === 'object' &&
      typeof binding.fieldPath === 'string' &&
      typeof binding.renderedText === 'string' &&
      Array.isArray(binding.factIds) && binding.factIds.every(isString) &&
      Array.isArray(binding.suggestionIds) && binding.suggestionIds.every(isString))
  );
}

function extractPresentedStudentQuotes(candidate: FeedbackExpressionCandidate): string[] {
  const aggregate = [
    candidate.headline,
    candidate.summary,
    ...candidate.whatYouDidWell,
    ...candidate.whatNeedsAttention,
    candidate.nextActionText,
  ].join('\n');
  return [...aggregate.matchAll(/你写出了[“"]([^”"]+)[”"]/g)].map((match) => match[1]);
}

function validBaselineValidation(): FeedbackExpressionValidation {
  return {
    passed: true,
    checks: {
      schemaValid: true,
      identityAligned: true,
      allFactIdsExist: true,
      allClaimsWithinFactBoundary: true,
      studentQuotesExact: true,
      noInventedPositiveClaim: true,
      noInventedDeficitClaim: true,
      noLongTermAbilityClaim: true,
      noInternalFieldLeakage: true,
      noPromptLeakage: true,
      suggestionsSourceBound: true,
    },
    issues: [],
  };
}

function failedExpressionValidation(reason: string): FeedbackExpressionValidation {
  const valid = validBaselineValidation();
  return {
    ...valid,
    passed: false,
    checks: { ...valid.checks, schemaValid: false },
    issues: [reason],
  };
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 96);
}
